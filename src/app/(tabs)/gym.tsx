import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Busy, Button, Card, Field, H2, Hint, Label, Row, Screen, Segmented } from '@/components/ui';
import { LineChart } from '@/components/charts';
import * as db from '@/lib/db';
import { shortDate, today } from '@/lib/dates';
import { toDisplayWeight } from '@/lib/activity';
import { CM_PER_IN, PARTS, POSES, addPhoto, exifDate, isDate, photoUri, weightOn } from '@/lib/gym';
import { useTheme } from '@/lib/theme';

type Pending = { uri: string; width: number; height: number; date: string; pose: db.Pose };

export default function Gym() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const chartW = width - 32 - 28;
  const [photos, setPhotos] = useState<db.GymPhoto[]>([]);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [measurements, setMeasurements] = useState<db.Measurement[]>([]);
  const [profile, setProfile] = useState(db.DEFAULT_PROFILE);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [p, w, m, prof] = await Promise.all([db.gymPhotos(), db.weights(), db.gymMeasurements(), db.getProfile()]);
    setPhotos(p);
    setWeights(w);
    setMeasurements(m);
    setProfile(prof);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dates = [...new Set(photos.map((p) => p.date))]; // newest first
  const beforeDate = dates.includes(before) ? before : dates[dates.length - 1];
  const afterDate = dates.includes(after) ? after : dates[0];
  const inches = profile.units === 'lb';
  const lenUnit = inches ? 'in' : 'cm';
  const toLen = (cm: number) => (inches ? cm / CM_PER_IN : cm);
  const weightLabel = (date: string) => {
    const w = weightOn(weights, date);
    return w ? `${toDisplayWeight(w.kg, profile.units).toFixed(1)} ${profile.units}` : '';
  };

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Allow ${fromCamera ? 'camera' : 'photo'} access in Android settings to add progress photos.`);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: !fromCamera };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const a = res.assets[0];
    setPending({
      uri: a.uri, width: a.width, height: a.height,
      date: fromCamera ? today() : exifDate(a.exif),
      pose: pending?.pose ?? 'front',
    });
  }

  async function savePending() {
    if (!pending) return;
    if (!isDate(pending.date) || pending.date > today()) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD, no later than today.');
      return;
    }
    setBusy(true);
    try {
      await addPhoto(pending, pending.date, pending.pose);
      setPending(null);
      await load();
    } catch (e) {
      Alert.alert('Couldn’t save the photo', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMeasurements() {
    const date = today();
    let saved = 0;
    for (const part of PARTS) {
      const raw = inputs[part]?.replace(',', '.').trim();
      if (!raw) continue;
      const v = Number(raw);
      if (!(v > 0 && v < 400)) {
        Alert.alert('Check the number', `${part} should be in ${lenUnit}.`);
        return;
      }
      await db.saveGymMeasurement({ date, part, cm: inches ? v * CM_PER_IN : v });
      saved++;
    }
    if (saved) {
      setInputs({});
      load();
    }
  }

  const byPart = new Map<string, db.Measurement[]>();
  for (const m of measurements) byPart.set(m.part, [...(byPart.get(m.part) ?? []), m]);
  const latestWeight = weights[weights.length - 1];

  return (
    <Screen>
      <Card>
        <H2>Progress photos</H2>
        <Row>
          <Button title="Take photo" kind="primary" style={{ flex: 1 }} onPress={() => pick(true)} />
          <Button title="Pick from gallery" style={{ flex: 1 }} onPress={() => pick(false)} />
        </Row>
        {pending ? (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: pending.uri }} style={[s.preview, { aspectRatio: pending.width / pending.height || 0.75 }]} resizeMode="contain" />
            <Label>Date</Label>
            <Field value={pending.date} onChangeText={(date) => setPending({ ...pending, date })} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            <Label>Pose</Label>
            <Segmented value={pending.pose} options={POSES} onChange={(pose) => setPending({ ...pending, pose })} />
            <Row>
              <Button title="Cancel" style={{ flex: 1 }} onPress={() => setPending(null)} />
              <Button title="Save photo" kind="primary" style={{ flex: 1 }} onPress={savePending} />
            </Row>
          </View>
        ) : (
          <Hint>Photos are kept inside this app, not in your gallery. Same spot, same light and same pose make the comparison fair.</Hint>
        )}
      </Card>

      {dates.length >= 2 && (
        <Card>
          <H2>Compare two dates</H2>
          <Label>Before</Label>
          <DateChips dates={dates} value={beforeDate} onChange={setBefore} />
          <Label>After</Label>
          <DateChips dates={dates} value={afterDate} onChange={setAfter} />
          <Button
            title="Compare side by side"
            kind="primary"
            disabled={beforeDate === afterDate}
            onPress={() => router.push({ pathname: '/gym/compare', params: { a: beforeDate, b: afterDate } })}
          />
        </Card>
      )}

      {dates.map((date) => (
        <Card key={date}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>{shortDate(date)}</Text>
            <Text style={{ color: t.text2, fontSize: 13 }}>{weightLabel(date)}</Text>
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.filter((p) => p.date === date).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${p.pose} photo, ${shortDate(date)}`}
                onPress={() => router.push({ pathname: '/gym/photo/[id]', params: { id: p.id } })}>
                <Image source={{ uri: photoUri(p) }} style={[s.thumb, { backgroundColor: t.surface2 }]} />
                <Text style={{ color: t.text2, fontSize: 11, textAlign: 'center' }}>{POSES.find((x) => x.value === p.pose)?.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      ))}

      <Card>
        <H2>Weight</H2>
        {weights.length >= 2 && (
          <LineChart
            width={chartW}
            unit={profile.units}
            points={weights.slice(-30).map((w) => ({ date: w.date, value: toDisplayWeight(w.kg, profile.units) }))}
          />
        )}
        {latestWeight ? (
          <Hint>
            Latest: {toDisplayWeight(latestWeight.kg, profile.units).toFixed(1)} {profile.units} on {shortDate(latestWeight.date)}
          </Hint>
        ) : <Hint>No weigh-ins yet.</Hint>}
        <Button title="Log weight on Progress" small onPress={() => router.navigate('/progress')} />
      </Card>

      <Card>
        <H2>Measurements</H2>
        {[...byPart].map(([part, list]) => {
          const last = list[list.length - 1];
          const diff = toLen(last.cm - list[0].cm);
          return (
            <View key={part} style={[s.tr, { borderBottomColor: t.border }]}>
              <Text style={[s.td, { color: t.text }]}>{part}</Text>
              <Text style={[s.td, s.num, { color: t.text }]}>{toLen(last.cm).toFixed(1)} {lenUnit}</Text>
              <Text style={[s.td, s.num, { color: t.text2 }]}>
                {list.length > 1 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)} since ${shortDate(list[0].date)}` : shortDate(last.date)}
              </Text>
            </View>
          );
        })}
        <Label>Today ({lenUnit})</Label>
        <View style={s.grid}>
          {PARTS.map((part) => (
            <Field
              key={part}
              value={inputs[part] ?? ''}
              onChangeText={(v) => setInputs({ ...inputs, [part]: v })}
              placeholder={part}
              keyboardType="decimal-pad"
              style={s.gridField}
            />
          ))}
        </View>
        <Button title="Save measurements" kind="primary" onPress={saveMeasurements} disabled={!Object.values(inputs).some((v) => v.trim())} />
      </Card>
      <Busy visible={busy} text="Saving photo…" />
    </Screen>
  );
}

function DateChips({ dates, value, onChange }: { dates: string[]; value: string; onChange: (d: string) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {dates.map((d) => {
        const on = d === value;
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(d)}
            style={[s.chip, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : 'transparent' }]}>
            <Text style={{ color: on ? t.onAccent : t.text, fontSize: 13 }}>{shortDate(d)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  preview: { width: '100%', maxHeight: 360, borderRadius: 10 },
  thumb: { width: 96, height: 128, borderRadius: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  td: { flex: 1, fontSize: 14 },
  num: { textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridField: { width: '31%' },
});
