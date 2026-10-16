import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type * as db from '@/lib/db';
import { photoUri, placement, placementTransform } from '@/lib/body';
import { shortDate } from '@/lib/dates';
import { useTheme } from '@/lib/theme';

/** A progress photo drawn in a w×h panel, lined up by its alignment points when `aligned` is on. */
export function AlignedPhoto({ photo, width, height, aligned = true, opacity = 1 }: {
  photo: db.BodyPhoto | null;
  width: number;
  height: number;
  aligned?: boolean;
  opacity?: number;
}) {
  const t = useTheme();
  if (!photo) {
    return (
      <View style={[s.panel, { width, height, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: t.text2 }}>Pick a photo</Text>
      </View>
    );
  }
  const pl = placement(photo, width, height, aligned);
  return (
    <View style={[s.panel, { width, height, backgroundColor: '#111', pointerEvents: 'none' }]}>
      <Image
        source={{ uri: photoUri(photo) }}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: photo.width,
          height: photo.height,
          opacity,
          transform: placementTransform(photo, pl),
        }}
      />
    </View>
  );
}

/** Small label pinned to a corner of a photo panel. */
export function PhotoTag({ text, color, right }: { text: string; color: string; right?: boolean }) {
  return (
    <View style={[[s.tag, right ? { right: 6 } : { left: 6 }], { pointerEvents: 'none' }]}>
      <View style={[s.tagBar, { backgroundColor: color }]} />
      <Text style={s.tagText}>{text}</Text>
    </View>
  );
}

/** Square-ish thumbnail for photo grids. */
export function Thumb({ photo, size, onPress, selected }: {
  photo: db.BodyPhoto;
  size: number;
  onPress: () => void;
  selected?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${photo.pose} photo, ${shortDate(photo.date)}${photo.align ? '' : ', not lined up yet'}`}
      style={{ width: size }}>
      <View style={{
        width: size, height: size * 1.25, borderRadius: 10, overflow: 'hidden', backgroundColor: t.surface2,
        borderWidth: selected ? 3 : 0, borderColor: t.accent,
      }}>
        <Image source={{ uri: photoUri(photo) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {!photo.align && (
          <View style={s.warn}><Text style={{ color: '#fff', fontSize: 11 }}>not lined up</Text></View>
        )}
      </View>
      <Text style={{ color: t.text2, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
        {shortDate(photo.date)} · {photo.pose[0].toUpperCase() + photo.pose.slice(1)}
      </Text>
    </Pressable>
  );
}

/** A thin draggable track that reports a 0–1 value (used for overlay opacity). */
export function SliderBar({ value, onChange, style }: { value: number; onChange: (v: number) => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const [w, setW] = useState(1);
  const set = (x: number) => onChange(Math.min(1, Math.max(0, x / w)));
  return (
    <View
      style={[{ height: 36, justifyContent: 'center' }, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width || 1)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => set(e.nativeEvent.locationX)}
      onResponderMove={(e) => set(e.nativeEvent.locationX)}>
      <View style={[{ height: 6, borderRadius: 3, backgroundColor: t.surface2 }, { pointerEvents: 'none' }]}>
        <View style={{ width: `${value * 100}%`, height: '100%', borderRadius: 3, backgroundColor: t.accent }} />
      </View>
      <View style={[[s.knob, { left: value * w - 11, backgroundColor: t.accent, borderColor: t.surface }], { pointerEvents: 'none' }]} />
    </View>
  );
}

/** Drag-to-wipe comparison: before on the left of the line, after on the right. */
export function WipeCompare({ before, after, width, height, aligned }: {
  before: db.BodyPhoto | null;
  after: db.BodyPhoto | null;
  width: number;
  height: number;
  aligned: boolean;
}) {
  const [split, setSplit] = useState(0.5);
  const set = (x: number) => setSplit(Math.min(1, Math.max(0, x / width)));
  return (
    <View style={{ width, height }}>
      <AlignedPhoto photo={after} width={width} height={height} aligned={aligned} />
      <View style={[{ position: 'absolute', left: 0, top: 0, width: split * width, height, overflow: 'hidden' }, { pointerEvents: 'none' }]}>
        <AlignedPhoto photo={before} width={width} height={height} aligned={aligned} />
      </View>
      <View style={[[s.divider, { left: split * width - 1, height }], { pointerEvents: 'none' }]} />
      <View style={[[s.handle, { left: split * width - 16, top: height / 2 - 16 }], { pointerEvents: 'none' }]}>
        <Text style={{ color: '#333', fontWeight: '700' }}>‹ ›</Text>
      </View>
      <View
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => set(e.nativeEvent.locationX)}
        onResponderMove={(e) => set(e.nativeEvent.locationX)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  panel: { overflow: 'hidden', borderRadius: 10 },
  tag: {
    position: 'absolute', top: 6, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6,
  },
  tagBar: { width: 3, height: 12, borderRadius: 2 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  warn: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(200,120,0,0.85)', alignItems: 'center', paddingVertical: 1 },
  knob: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 3 },
  divider: { position: 'absolute', top: 0, width: 2, backgroundColor: '#fff' },
  handle: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
});
