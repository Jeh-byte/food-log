import { useState } from 'react';
import { Image, PanResponder, type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import type { Align } from '@/lib/db';
import { useTheme } from '@/lib/theme';

export type CompareMode = 'slider' | 'side' | 'overlay';

export type ComparePhoto = { uri: string; width: number; height: number; align: Align | null; label: string };

// Where the base of the neck and the belly button land in an aligned frame, as fractions of its height.
// Neck to belly button is roughly a quarter of standing height, so this leaves room for head and feet.
const NECK_Y = 0.16;
const BELLY_Y = 0.33;

/**
 * A photo filling a frame. When `aligned` and the photo has its two points marked, it is scaled,
 * moved and (with `straighten`) rotated so those points sit at the same place in every frame.
 */
export function AlignedImage({ photo, frame, aligned, straighten }: {
  photo: ComparePhoto;
  frame: { width: number; height: number };
  aligned: boolean;
  straighten: boolean;
}) {
  const a = photo.align;
  if (!aligned || !a) {
    return <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }
  const { width: w, height: h } = photo;
  const n = { x: a.nx * w, y: a.ny * h };
  const v = { x: (a.bx - a.nx) * w, y: (a.by - a.ny) * h };
  const scale = ((BELLY_Y - NECK_Y) * frame.height) / Math.max(1, Math.hypot(v.x, v.y));
  const angle = straighten ? Math.atan2(v.x, v.y) : 0;
  const sw = w * scale;
  const sh = h * scale;
  // Rotate about the neck point: offset from the image centre, rotate, offset back.
  const px = n.x * scale - sw / 2;
  const py = n.y * scale - sh / 2;
  return (
    <Image
      source={{ uri: photo.uri }}
      resizeMode="stretch"
      style={{
        position: 'absolute',
        width: sw,
        height: sh,
        left: frame.width / 2 - n.x * scale,
        top: NECK_Y * frame.height - n.y * scale,
        transform: [{ translateX: px }, { translateY: py }, { rotate: `${angle}rad` }, { translateX: -px }, { translateY: -py }],
      }}
    />
  );
}

/**
 * Before and after in one of three views. Dragging across the frame moves the slider divider,
 * or in overlay view sets how see-through the after photo is.
 */
export function CompareView({ before, after, mode, aspect, aligned, straighten }: {
  before: ComparePhoto;
  after: ComparePhoto;
  mode: CompareMode;
  /** Width / height of each frame. */
  aspect: number;
  aligned: boolean;
  straighten: boolean;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState(0.5);
  const clamp = (p: number) => Math.min(1, Math.max(0, p));
  // The photos ignore touches, so locationX is always relative to the frame.
  const follow = (e: GestureResponderEvent) => {
    if (width) setPos(clamp(e.nativeEvent.locationX / width));
  };
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: follow,
    onPanResponderMove: follow,
  });

  if (mode === 'side') {
    const half = width / 2 - 3;
    const frame = { width: half, height: half / aspect };
    return (
      <View style={s.sideRow} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && [before, after].map((p) => (
          <View key={p.label} style={[s.frame, frame, { backgroundColor: t.surface2 }]}>
            <AlignedImage photo={p} frame={frame} aligned={aligned} straighten={straighten} />
            {aligned && <Guides />}
            <Text style={[s.tag, { left: 6 }]}>{p.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  const frame = { width, height: width / aspect };
  const x = pos * width;
  const pct = Math.round(pos * 100);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={mode === 'slider'
        ? `Compare ${before.label} with ${after.label}`
        : `Overlay of ${after.label} on ${before.label}`}
      accessibilityValue={{ min: 0, max: 100, now: pct, text: mode === 'slider' ? `${pct}% ${before.label}` : `${pct}% ${after.label}` }}
      onAccessibilityAction={(e) => setPos(clamp(pos + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)))}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[s.frame, { width: '100%', aspectRatio: aspect, backgroundColor: t.surface2 }]}
      {...pan.panHandlers}>
      {width > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {mode === 'slider' ? (
            <>
              <AlignedImage photo={after} frame={frame} aligned={aligned} straighten={straighten} />
              <View style={[s.clip, { width: x }]}>
                <View style={frame}>
                  <AlignedImage photo={before} frame={frame} aligned={aligned} straighten={straighten} />
                </View>
              </View>
              <View style={[s.divider, { left: x - 1 }]} />
              <View style={[s.handle, { left: x - 18 }]}>
                <Text style={s.handleText}>‹ ›</Text>
              </View>
            </>
          ) : (
            <>
              <AlignedImage photo={before} frame={frame} aligned={aligned} straighten={straighten} />
              <View style={[StyleSheet.absoluteFill, { opacity: pos }]}>
                <AlignedImage photo={after} frame={frame} aligned={aligned} straighten={straighten} />
              </View>
              <Text style={[s.tag, { top: undefined, bottom: 8, left: 8 }]}>{after.label} {pct}%</Text>
            </>
          )}
          {aligned && <Guides />}
          <Text style={[s.tag, { left: 8 }]}>{before.label}</Text>
          <Text style={[s.tag, { right: 8 }]}>{after.label}</Text>
        </View>
      )}
    </View>
  );
}

/** Dashed lines where the neck and belly button should sit when photos are aligned. */
function Guides() {
  return (
    <>
      <View pointerEvents="none" style={[s.guide, { top: `${NECK_Y * 100}%` }]} />
      <View pointerEvents="none" style={[s.guide, { top: `${BELLY_Y * 100}%` }]} />
    </>
  );
}

const s = StyleSheet.create({
  frame: { borderRadius: 14, overflow: 'hidden' },
  sideRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff' },
  handle: {
    position: 'absolute', top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  handleText: { color: '#111', fontWeight: '700', fontSize: 14 },
  guide: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)' },
  tag: {
    position: 'absolute', top: 8, color: '#fff', fontSize: 12, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
});
