import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Hint, Row, Screen, Segmented } from '@/components/ui';
import * as db from '@/lib/db';
import { photoUri } from '@/lib/gym';

type Point = 'neck' | 'belly';

export default function AlignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photo, setPhoto] = useState<db.GymPhoto | null>(null);
  const [align, setAlign] = useState<Partial<db.Align>>({});
  const [point, setPoint] = useState<Point>('neck');
  const [width, setWidth] = useState(0);

  useFocusEffect(useCallback(() => {
    db.getGymPhoto(id).then((p) => {
      setPhoto(p);
      setAlign(p?.align ?? {});
    });
  }, [id]));

  if (!photo) return null;
  const height = width * (photo.height / photo.width);
  const done = align.nx != null && align.bx != null;

  async function save() {
    if (!photo || !done) return;
    await db.saveGymPhoto({ ...photo, align: align as db.Align });
    router.back();
  }

  return (
    <Screen>
      <Hint>
        {photo.pose === 'back'
          ? 'Tap the base of your neck, then your spine at belly-button height.'
          : 'Tap the base of your neck, then your belly button.'}{' '}
        Marking the same two spots on every photo lets the app line them up even if you stood closer or the phone was tilted.
      </Hint>
      <Segmented<Point>
        value={point}
        options={[{ value: 'neck', label: 'Neck' }, { value: 'belly', label: photo.pose === 'back' ? 'Spine' : 'Belly button' }]}
        onChange={setPoint}
      />
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Pressable
            accessibilityLabel="Photo. Tap to place the selected point."
            style={{ width, height }}
            onPress={(e) => {
              const x = e.nativeEvent.locationX / width;
              const y = e.nativeEvent.locationY / height;
              if (point === 'neck') {
                setAlign({ ...align, nx: x, ny: y });
                setPoint('belly');
              } else {
                setAlign({ ...align, bx: x, by: y });
              }
            }}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: photoUri(photo) }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
              {align.nx != null && <Dot x={align.nx * width} y={align.ny! * height} color="#2A78D6" />}
              {align.bx != null && <Dot x={align.bx * width} y={align.by! * height} color="#EB6834" />}
            </View>
          </Pressable>
        )}
      </View>
      <Row>
        <Button title="Clear" style={{ flex: 1 }} onPress={() => { setAlign({}); setPoint('neck'); }} />
        <Button title="Save points" kind="primary" style={{ flex: 1 }} disabled={!done} onPress={save} />
      </Row>
    </Screen>
  );
}

function Dot({ x, y, color }: { x: number; y: number; color: string }) {
  return <View style={[s.dot, { left: x - 9, top: y - 9, backgroundColor: color }]} />;
}

const s = StyleSheet.create({
  dot: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
});
