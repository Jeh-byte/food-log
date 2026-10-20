import { useCallback, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Busy, Button, Hint, Row, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { ALIGN_HELP, photoUri, smallBase64 } from '@/lib/gym';
import { bodyLandmarks } from '@/lib/claude';
import { shortDate } from '@/lib/dates';
import { useTheme } from '@/lib/theme';

const COLORS = ['#FF9F43', '#3FD28A'];

export default function AlignScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width, height: winH } = useWindowDimensions();
  const [photo, setPhoto] = useState<db.GymPhoto | null>(null);
  const [pts, setPts] = useState<[number, number][]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const p = await db.getGymPhoto(id);
    setPhoto(p);
    setPts(p?.align ? [...p.align] : []);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!photo) return <Screen><Hint>Loading…</Hint></Screen>;

  // Fit the photo into the box.
  const boxW = width - 32;
  const boxH = Math.min(winH * 0.55, boxW * 1.6);
  const s = Math.min(boxW / photo.width, boxH / photo.height);
  const dw = photo.width * s, dh = photo.height * s;
  const ox = (boxW - dw) / 2, oy = (boxH - dh) / 2;
  const toScreen = ([x, y]: [number, number]) => ({ x: ox + x * dw, y: oy + y * dh });
  const toNorm = (x: number, y: number): [number, number] =>
    [Math.min(1, Math.max(0, (x - ox) / dw)), Math.min(1, Math.max(0, (y - oy) / dh))];

  function grab(x: number, y: number) {
    let best = -1, bestD = 40;
    pts.forEach((p, i) => {
      const sp = toScreen(p);
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < bestD) { best = i; bestD = d; }
    });
    if (best < 0 && pts.length < 2) {
      setPts([...pts, toNorm(x, y)]);
      setDrag(pts.length);
      return;
    }
    if (best < 0) {
      // Both placed: move whichever is closer.
      const d = pts.map((p) => { const sp = toScreen(p); return Math.hypot(sp.x - x, sp.y - y); });
      best = d[0] <= d[1] ? 0 : 1;
    }
    setDrag(best);
    move(x, y, best);
  }

  function move(x: number, y: number, i = drag) {
    if (i === null) return;
    setPts((cur) => cur.map((p, j) => (j === i ? toNorm(x, y) : p)));
  }

  async function save(goNext: boolean) {
    if (!photo) return;
    const align = pts.length === 2 ? ([pts[0], pts[1]] as db.AlignPoints) : null;
    await db.saveGymPhoto({ ...photo, align, auto: false });
    if (goNext) {
      const next = (await db.gymPhotos()).find((p) => !p.align && p.id !== photo.id);
      if (next) {
        router.replace({ pathname: '/gym/align/[id]', params: { id: next.id } });
        return;
      }
    }
    router.back();
  }

  async function auto() {
    if (!photo) return;
    const key = await db.getApiKey();
    if (!key) {
      Alert.alert('Claude API key needed', 'Add your key in Settings, or tap the two points yourself.');
      return;
    }
    setBusy('Finding your neck and belly button…');
    try {
      const found = await bodyLandmarks(key, await smallBase64(photo));
      if (found) setPts(found);
      else Alert.alert('Couldn’t find you', 'Tap the two points yourself.');
    } catch (e) {
      Alert.alert('Line-up failed', (e as Error).message);
    } finally {
      setBusy('');
    }
  }

  const [a, b] = ALIGN_HELP[photo.pose];
  const step = pts.length === 0 ? `Tap ${a}.` : pts.length === 1 ? `Now tap ${b}.` : 'Drag a point to adjust it, then save.';

  // A plain (non-scrolling) view, so dragging a point never scrolls the screen instead.
  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: t.bg }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS[Math.min(pts.length, 1)] }}>{step}</Text>
      <View style={{ width: boxW, height: boxH, backgroundColor: '#111', borderRadius: 10, overflow: 'hidden' }}>
        <Image source={{ uri: photoUri(photo) }} style={{ position: 'absolute', left: ox, top: oy, width: dw, height: dh }} />
        {pts.length === 2 && (() => {
          const p0 = toScreen(pts[0]), p1 = toScreen(pts[1]);
          const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          return (
            <View style={[{
              position: 'absolute', left: (p0.x + p1.x) / 2 - len / 2, top: (p0.y + p1.y) / 2 - 1, width: len, height: 2,
              backgroundColor: 'rgba(255,255,255,0.8)', transform: [{ rotate: `${ang}rad` }],
            }, { pointerEvents: 'none' }]} />
          );
        })()}
        {pts.map((p, i) => {
          const sp = toScreen(p);
          return (
            <View key={i} style={[st.dot, { left: sp.x - 12, top: sp.y - 12, backgroundColor: COLORS[i], pointerEvents: 'none' }]}>
              <Text style={st.dotText}>{i + 1}</Text>
            </View>
          );
        })}
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => grab(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          onResponderMove={(e) => move(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          onResponderRelease={() => setDrag(null)}
        />
      </View>
      <Hint>
        {shortDate(photo.date)} · {photo.pose}. Mark the same two spots on every photo: 1 = {a}, 2 = {b}.
        The app then sizes and straightens photos so they line up.
      </Hint>
      <Row>
        <Button title="Automatically" small onPress={auto} style={{ flex: 1 }} />
        <Button title="Clear" small onPress={() => setPts([])} style={{ flex: 1 }} />
      </Row>
      <Row>
        <Button title="Save" kind="primary" disabled={pts.length === 1} onPress={() => save(false)} style={{ flex: 1 }} />
        <Button title="Save, next photo" disabled={pts.length !== 2} onPress={() => save(true)} style={{ flex: 1 }} />
      </Row>
      <Busy visible={!!busy} text={busy} />
    </View>
  );
}

const st = StyleSheet.create({
  dot: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  dotText: { color: '#000', fontSize: 12, fontWeight: '700' },
});
