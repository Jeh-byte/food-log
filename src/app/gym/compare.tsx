import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Button, Card, H2, Hint, Row, Screen, Segmented } from '@/components/ui';
import { AlignedPhoto, PhotoTag, SliderBar, Thumb, WipeCompare } from '@/components/gym';
import * as db from '@/lib/db';
import { MEASURES, PANEL_RATIO, ZOOMS, nearest, type Zoom } from '@/lib/gym';
import { toDisplayWeight } from '@/lib/activity';
import { daysBetween, shortDate } from '@/lib/dates';
import { useTheme } from '@/lib/theme';

type Mode = 'side' | 'wipe' | 'overlay';
const BEFORE = '#FF9F43';
const AFTER = '#3FD28A';

export default function Compare() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<db.GymPhoto[]>([]);
  const [before, setBefore] = useState<db.GymPhoto | null>(null);
  const [after, setAfter] = useState<db.GymPhoto | null>(null);
  const [mode, setMode] = useState<Mode>('side');
  const [aligned, setAligned] = useState(true);
  const [straighten, setStraighten] = useState(true);
  const [zoom, setZoom] = useState<Zoom>('normal');
  const shot = useRef<View>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [picking, setPicking] = useState<'before' | 'after' | null>(null);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [meas, setMeas] = useState<db.Measurement[]>([]);
  const [profile, setProfile] = useState(db.DEFAULT_PROFILE);

  const load = useCallback(async () => {
    const [all, sel, w, m, p, z] = await Promise.all([
      db.gymPhotos(), db.getSetting<{ before?: string; after?: string }>('compare', {}),
      db.weights(), db.gymMeasurements(), db.getProfile(), db.getSetting<Zoom>('compareZoom', 'normal'),
    ]);
    setPhotos(all);
    setWeights(w);
    setMeas(m);
    setProfile(p);
    setZoom(ZOOMS[z] ? z : 'normal');
    // Default: first and latest front photos (or any photos).
    const pool = all.some((x) => x.pose === 'front') ? all.filter((x) => x.pose === 'front') : all;
    setBefore(all.find((x) => x.id === sel.before) ?? pool[0] ?? null);
    setAfter(all.find((x) => x.id === sel.after) ?? pool[pool.length - 1] ?? null);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function choose(p: db.GymPhoto) {
    const role = picking;
    setPicking(null);
    if (!role) return;
    if (role === 'before') setBefore(p);
    else setAfter(p);
    const sel = await db.getSetting<{ before?: string; after?: string }>('compare', {});
    await db.setSetting('compare', { ...sel, [role]: p.id });
  }

  async function firstVsLatest() {
    const pose = before?.pose ?? 'front';
    const pool = photos.some((x) => x.pose === pose) ? photos.filter((x) => x.pose === pose) : photos;
    const first = pool[0] ?? null, last = pool[pool.length - 1] ?? null;
    setBefore(first);
    setAfter(last);
    await db.setSetting('compare', { before: first?.id, after: last?.id });
  }

  /** Saves the comparison and its changes as one picture and opens the share sheet. */
  async function share() {
    try {
      const uri = await captureRef(shot, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share your before and after' });
    } catch (e) {
      Alert.alert('Couldn’t make the image', (e as Error).message);
    }
  }

  async function swap() {
    setBefore(after);
    setAfter(before);
    await db.setSetting('compare', { before: after?.id, after: before?.id });
  }

  if (!photos.length) {
    return (
      <Screen>
        <Hint>Add some progress photos on the Gym tab first.</Hint>
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const fullW = width - 32;
  const sideW = (fullW - 8) / 2;
  const panelW = mode === 'side' ? sideW : fullW;
  const panelH = panelW / PANEL_RATIO;

  const wOn = (p: db.GymPhoto | null) => (p ? nearest(weights, p.date, 3) : null);
  const label = (role: string, p: db.GymPhoto | null) => {
    if (!p) return role;
    const w = wOn(p);
    return `${role} · ${shortDate(p.date)}${w ? ` · ${toDisplayWeight(w.kg, profile.units).toFixed(1)} ${profile.units}` : ''}`;
  };

  // What changed between the two dates.
  const changes: string[] = [];
  if (before && after) {
    const days = Math.abs(daysBetween(before.date, after.date));
    changes.push(`${days} day${days === 1 ? '' : 's'} apart`);
    const w0 = wOn(before), w1 = wOn(after);
    if (w0 && w1) {
      const d = toDisplayWeight(w1.kg - w0.kg, profile.units);
      changes.push(`Weight ${d > 0 ? '+' : ''}${d.toFixed(1)} ${profile.units}`);
    }
    for (const m of MEASURES) {
      const list = meas.filter((x) => x.kind === m.key);
      const a = nearest(list, before.date, 7), b = nearest(list, after.date, 7);
      if (a && b && a !== b) {
        const d = b.value - a.value;
        changes.push(`${m.label} ${d > 0 ? '+' : ''}${d.toFixed(1)} ${m.unit}`);
      }
    }
  }

  const missing = [before, after].some((p) => p && !p.align);
  const thumbW = Math.floor((width - 48 - 16) / 3);

  return (
    <Screen>
      <Row>
        <Button title={before ? `Before: ${shortDate(before.date)}` : 'Pick before'} small onPress={() => setPicking('before')} style={{ flex: 1, borderColor: BEFORE }} />
        <Button title="⇄" small onPress={swap} />
        <Button title={after ? `After: ${shortDate(after.date)}` : 'Pick after'} small onPress={() => setPicking('after')} style={{ flex: 1, borderColor: AFTER }} />
      </Row>
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[{ value: 'side', label: 'Side by side' }, { value: 'wipe', label: 'Slider' }, { value: 'overlay', label: 'Overlay' }]}
      />

      <View ref={shot} collapsable={false} style={{ gap: 12, backgroundColor: t.bg }}>
        {mode === 'side' && (
          <Row style={{ alignItems: 'flex-start' }}>
            <View>
              <AlignedPhoto photo={before} width={panelW} height={panelH} aligned={aligned} straighten={straighten} zoom={ZOOMS[zoom]} />
              <PhotoTag text={label('BEFORE', before)} color={BEFORE} />
            </View>
            <View>
              <AlignedPhoto photo={after} width={panelW} height={panelH} aligned={aligned} straighten={straighten} zoom={ZOOMS[zoom]} />
              <PhotoTag text={label('AFTER', after)} color={AFTER} />
            </View>
          </Row>
        )}
        {mode === 'wipe' && (
          <View>
            <WipeCompare before={before} after={after} width={panelW} height={panelH} aligned={aligned} straighten={straighten} zoom={ZOOMS[zoom]} />
            <PhotoTag text={label('BEFORE', before)} color={BEFORE} />
            <PhotoTag text={label('AFTER', after)} color={AFTER} right />
          </View>
        )}
        {mode === 'overlay' && (
          <View>
            <View style={{ width: panelW, height: panelH }}>
              <AlignedPhoto photo={before} width={panelW} height={panelH} aligned={aligned} straighten={straighten} zoom={ZOOMS[zoom]} />
              <View style={{ position: 'absolute', left: 0, top: 0 }}>
                <AlignedPhoto photo={after} width={panelW} height={panelH} aligned={aligned} straighten={straighten} zoom={ZOOMS[zoom]} opacity={opacity} />
              </View>
            </View>
            <PhotoTag text={label('BEFORE', before)} color={BEFORE} />
            <PhotoTag text={label('AFTER', after)} color={AFTER} right />
          </View>
        )}
        {changes.length > 0 && (
          <Card>
            <H2>What changed</H2>
            {changes.map((c) => <Text key={c} style={{ color: t.text, fontSize: 15 }}>{c}</Text>)}
          </Card>
        )}
      </View>
      {mode === 'overlay' && (
        <>
          <Hint>See-through “after” photo: {Math.round(opacity * 100)}%</Hint>
          <SliderBar value={opacity} onChange={setOpacity} />
        </>
      )}
      {mode === 'wipe' && <Hint>Drag across the photo to wipe between before and after.</Hint>}

      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontSize: 15 }}>Line up photos</Text>
        <Switch value={aligned} onValueChange={setAligned} trackColor={{ true: t.accent }} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontSize: 15 }}>Straighten tilted photos</Text>
        <Switch value={straighten} disabled={!aligned} onValueChange={setStraighten} trackColor={{ true: t.accent }} />
      </Row>
      {aligned && (
        <>
          <Text style={{ color: t.text, fontSize: 15 }}>Zoom</Text>
          <Segmented<Zoom>
            value={zoom}
            onChange={(z) => { setZoom(z); db.setSetting('compareZoom', z); }}
            options={[{ value: 'far', label: 'Far' }, { value: 'normal', label: 'Normal' }, { value: 'close', label: 'Close' }]}
          />
        </>
      )}
      {aligned && missing && (
        <Hint style={{ color: t.star }}>
          One of these photos isn’t lined up yet. Open it from the Gym tab and tap “Line up this photo”.
        </Hint>
      )}

      <Row>
        <Button title="First vs latest" small onPress={firstVsLatest} style={{ flex: 1 }} />
        <Button title="Share image" small kind="primary" onPress={share} disabled={!before || !after} style={{ flex: 1 }} />
      </Row>

      <Modal visible={!!picking} animationType="slide" onRequestClose={() => setPicking(null)}>
        <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 16 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <H2>Pick the {picking} photo</H2>
            <Button title="Close" small onPress={() => setPicking(null)} />
          </Row>
          <ScrollView contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...photos].reverse().map((p) => (
              <Thumb
                key={p.id}
                photo={p}
                size={thumbW}
                selected={p.id === (picking === 'before' ? before?.id : after?.id)}
                onPress={() => choose(p)}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
