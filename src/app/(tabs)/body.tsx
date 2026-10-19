import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Busy, Button, Card, H2, Hint, Row, Screen, Segmented } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { Thumb } from '@/components/body';
import * as db from '@/lib/db';
import {
  MEASURES, POSES, addPhoto, bodyCsv, firstPerDay, measureInfo, parseBodyCsv, saveImported, smallBase64,
  type ImportRow, type MeasureKey,
} from '@/lib/body';
import { bodyLandmarks } from '@/lib/claude';
import { shortDate, today } from '@/lib/dates';
import { useTheme } from '@/lib/theme';

type PoseFilter = 'all' | db.Pose;

export default function Body() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const chartW = width - 32 - 28;
  const thumbW = Math.floor((width - 32 - 28 - 16) / 3);
  const [photos, setPhotos] = useState<db.BodyPhoto[]>([]);
  const [meas, setMeas] = useState<db.Measurement[]>([]);
  const [pose, setPose] = useState<PoseFilter>('all');
  const [kind, setKind] = useState<MeasureKey>('waist');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState('');
  const [members, setMembers] = useState<{ rows: ImportRow[]; names: [string, number][] } | null>(null);

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([db.bodyPhotos(), db.measurements()]);
    setPhotos(p);
    setMeas(m);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = photos.filter((p) => pose === 'all' || p.pose === pose).reverse();
  const unaligned = photos.filter((p) => !p.align);

  // ---- adding photos ----

  function askPose(): Promise<db.Pose | null> {
    return new Promise((resolve) => {
      Alert.alert('Which pose?', 'You can change it later for each photo.', [
        ...POSES.map((p) => ({ text: p.label, onPress: () => resolve(p.value) })),
      ], { cancelable: true, onDismiss: () => resolve(null) });
    });
  }

  async function add(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Allow ${fromCamera ? 'camera' : 'photo'} access in Android settings to add progress photos.`);
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: true })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 1, exif: true, allowsMultipleSelection: true, selectionLimit: 0,
      });
    if (res.canceled || !res.assets.length) return;
    const p = await askPose();
    if (!p) return;
    const added: db.BodyPhoto[] = [];
    try {
      for (let i = 0; i < res.assets.length; i++) {
        setBusy(`Adding photo ${i + 1} of ${res.assets.length}…`);
        added.push(await addPhoto(res.assets[i], p));
      }
    } catch (e) {
      Alert.alert('Couldn’t add a photo', (e as Error).message);
    } finally {
      setBusy('');
    }
    await load();
    if (added.length) {
      Alert.alert(
        `Added ${added.length} photo${added.length > 1 ? 's' : ''}`,
        'Line them up so photos taken at different distances compare fairly?',
        [
          { text: 'Later' },
          { text: 'Do it myself', onPress: () => router.push({ pathname: '/align/[id]', params: { id: added[0].id } }) },
          { text: 'Automatically', onPress: () => autoAlign(added) },
        ],
      );
    }
  }

  // ---- automatic line-up ----

  async function autoAlign(list: db.BodyPhoto[]) {
    if (!list.length) {
      Alert.alert('All lined up', 'Every photo already has its line-up points.');
      return;
    }
    const key = await db.getApiKey();
    if (!key) {
      Alert.alert('Claude API key needed', 'Automatic line-up uses Claude. Add your key in Settings, or line photos up yourself.', [
        { text: 'Cancel' },
        { text: 'Open Settings', onPress: () => router.navigate('/settings') },
      ]);
      return;
    }
    const ok = await db.getSetting('bodyAlignConsent', false);
    if (!ok) {
      const agreed = await new Promise<boolean>((resolve) => Alert.alert(
        'Send photos to Claude?',
        'To find your neck and belly button, a small copy of each photo is sent to Claude (Anthropic) with your API key, ' +
        'the same way meal photos are. Nothing else is shared, and the app doesn’t keep it anywhere but this phone. ' +
        'You can always line photos up yourself instead.',
        [{ text: 'Cancel', onPress: () => resolve(false) }, { text: 'Continue', onPress: () => resolve(true) }],
        { cancelable: true, onDismiss: () => resolve(false) },
      ));
      if (!agreed) return;
      await db.setSetting('bodyAlignConsent', true);
    }
    let done = 0, failed = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        setBusy(`Lining up photo ${i + 1} of ${list.length}…`);
        const pts = await bodyLandmarks(key, await smallBase64(list[i]));
        if (pts) {
          await db.saveBodyPhoto({ ...list[i], align: pts, auto: true });
          done++;
        } else failed++;
      }
    } catch (e) {
      Alert.alert('Line-up stopped', (e as Error).message);
    } finally {
      setBusy('');
    }
    await load();
    Alert.alert(
      'Line-up done',
      `Lined up ${done} photo${done === 1 ? '' : 's'}.` +
      (failed ? ` Couldn’t find you in ${failed}; open those and tap the two points yourself.` : '') +
      ' The points are estimates, so check a few: open a photo and tap “Line up” to nudge them.',
    );
  }

  // ---- importing files ----

  async function importFiles() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    let rows: ImportRow[] = [];
    for (const a of res.assets) {
      try {
        rows = rows.concat(parseBodyCsv(await new File(a.uri).text()));
      } catch (e) {
        Alert.alert('Couldn’t read a file', `${a.name}: ${(e as Error).message}\n\nIn the EufyLife app use Me › Data › Export All Data.`);
        return;
      }
    }
    if (!rows.length) {
      Alert.alert('Nothing found', 'No weigh-ins or measurements were found in those files.');
      return;
    }
    // The eufy export holds everyone who uses the scale. Rows without a name (Me 360, ZOZOFIT) are yours.
    const counts = new Map<string, number>();
    for (const r of rows) if (r.member) counts.set(r.member, (counts.get(r.member) ?? 0) + 1);
    if (counts.size > 1) {
      setMembers({ rows, names: [...counts].sort((a, b) => b[1] - a[1]) });
      return;
    }
    confirmImport(rows);
  }

  async function confirmImport(rows: ImportRow[]) {
    const days = firstPerDay(rows);
    const dates = [...days.keys()].sort();
    const kinds = new Set<string>();
    for (const v of days.values()) for (const k of Object.keys(v)) kinds.add(k);
    const label = (k: string) => (k === 'weight' ? 'Weight' : measureInfo(k).label);
    const run = async (replace: boolean) => {
      const n = await saveImported(days, replace);
      await load();
      Alert.alert('Imported', `Saved ${n} value${n === 1 ? '' : 's'} across ${days.size} day${days.size === 1 ? '' : 's'}.`);
    };
    Alert.alert(
      'Import these?',
      `${days.size} day${days.size === 1 ? '' : 's'} from ${shortDate(dates[0])} to ${shortDate(dates[dates.length - 1])}.\n` +
      `Includes: ${[...kinds].map(label).join(', ')}.\n\nIf you weighed in more than once a day, the first reading is used.`,
      [
        { text: 'Cancel' },
        { text: 'Replace mine', onPress: () => run(true) },
        { text: 'Add new only', onPress: () => run(false) },
      ],
    );
  }

  // ---- exporting for the Gym Progress desktop app ----

  async function exportForPc() {
    const { csv, days } = await bodyCsv();
    if (!days) {
      Alert.alert('Nothing to export yet', 'Log a weight or some measurements first.');
      return;
    }
    const file = new File(Paths.cache, `body-data-${today()}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Send your body data to your PC' });
  }

  // ---- measurements chart ----

  const series = meas.filter((m) => m.kind === kind);
  const info = measureInfo(kind);
  const latestByKind = MEASURES.flatMap((m) => {
    const list = meas.filter((x) => x.kind === m.key);
    return list.length ? [{ ...m, first: list[0], last: list[list.length - 1] }] : [];
  });

  return (
    <Screen>
      <Card>
        <H2>Progress photos</H2>
        <Row>
          <Button title="Take photo" kind="primary" small onPress={() => add(true)} style={{ flex: 1 }} />
          <Button title="From gallery" small onPress={() => add(false)} style={{ flex: 1 }} />
        </Row>
        {photos.length > 0 && (
          <>
            <Segmented<PoseFilter>
              value={pose}
              onChange={setPose}
              options={[{ value: 'all', label: 'All' }, ...POSES]}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(showAll ? shown : shown.slice(0, 9)).map((p) => (
                <Thumb key={p.id} photo={p} size={thumbW} onPress={() => router.push({ pathname: '/photo/[id]', params: { id: p.id } })} />
              ))}
            </View>
            {shown.length > 9 && (
              <Button title={showAll ? 'Show fewer' : `Show all ${shown.length}`} small onPress={() => setShowAll(!showAll)} />
            )}
            <Button title="Compare two photos" kind="primary" onPress={() => router.push('/compare')} />
          </>
        )}
        {!photos.length && (
          <Hint>
            Take a front, side and back photo every week or two. Same spot, same light, same time of day works best.
            Then compare any two side by side.
          </Hint>
        )}
      </Card>

      {photos.length > 0 && (
        <Card>
          <H2>Line up photos</H2>
          <Hint>
            Each photo needs two points (base of neck and belly button) so that photos taken closer or further away
            show you at the same size. {unaligned.length ? `${unaligned.length} still to do.` : 'All done.'}
          </Hint>
          <Row>
            <Button title="Automatically" small kind={unaligned.length ? 'primary' : 'ghost'} onPress={() => autoAlign(unaligned)} style={{ flex: 1 }} />
            <Button
              title="Myself"
              small
              disabled={!unaligned.length}
              onPress={() => router.push({ pathname: '/align/[id]', params: { id: unaligned[0].id } })}
              style={{ flex: 1 }}
            />
          </Row>
        </Card>
      )}

      <Card>
        <H2>Measurements</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {MEASURES.map((m) => (
            <Button key={m.key} title={m.label} small kind={kind === m.key ? 'primary' : 'ghost'} onPress={() => setKind(m.key)} />
          ))}
        </View>
        {series.length >= 2 ? (
          <LineChart width={chartW} unit={info.unit} points={series.map((m) => ({ date: m.date, value: m.value }))} />
        ) : (
          <Hint>{series.length ? 'Add one more to see a chart.' : `No ${info.label.toLowerCase()} measurements yet.`}</Hint>
        )}
        {latestByKind.map((m) => {
          const ch = m.first !== m.last ? m.last.value - m.first.value : null;
          return (
            <Row key={m.key} style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: t.text, fontSize: 15 }}>{m.label}</Text>
              <Text style={{ color: t.text2, fontSize: 14 }}>
                {m.last.value.toFixed(1)} {m.unit}
                {ch !== null ? `  (${ch > 0 ? '+' : ''}${ch.toFixed(1)} since ${shortDate(m.first.date)})` : ''}
              </Text>
            </Row>
          );
        })}
        <Row>
          <Button title="Add measurements" small kind="primary" onPress={() => router.push('/measure')} style={{ flex: 1 }} />
          <Button title="Import files" small onPress={importFiles} style={{ flex: 1 }} />
        </Row>
        <Button title="Send to Gym Progress on PC" small onPress={exportForPc} />
        <Hint>
          Import works with the eufy scale export, measurement CSVs and the Gym Progress app’s export. “Send to Gym
          Progress” makes a file with all your weigh-ins and measurements: save it to your PC (email it to yourself
          or save it to OneDrive) and import it there.
        </Hint>
      </Card>

      <Modal visible={!!members} transparent animationType="fade" onRequestClose={() => setMembers(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <Card>
            <H2>Whose readings?</H2>
            <Hint>This file has readings for several people. Import the ones for:</Hint>
            {members && members.names.map(([name, n]) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                onPress={() => {
                  const rows = members.rows.filter((r) => r.member === name || !r.member);
                  setMembers(null);
                  confirmImport(rows);
                }}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Text style={{ color: t.text, fontSize: 16 }}>{name}</Text>
                <Text style={{ color: t.text2, fontSize: 13 }}>{n} readings</Text>
              </Pressable>
            ))}
            <Button title="Cancel" small onPress={() => setMembers(null)} />
          </Card>
        </View>
      </Modal>
      <Busy visible={!!busy} text={busy} />
    </Screen>
  );
}
