import { useState } from 'react';
import { Image, PanResponder, type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * Two photos stacked in one frame. Dragging anywhere moves the divider:
 * left of it shows `before`, right of it shows `after`.
 */
export function CompareSlider({ before, after, aspect, beforeLabel, afterLabel }: {
  before: string;
  after: string;
  /** Width / height of the frame. */
  aspect: number;
  beforeLabel: string;
  afterLabel: string;
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

  const x = pos * width;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Compare ${beforeLabel} with ${afterLabel}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pos * 100), text: `${Math.round(pos * 100)}% ${beforeLabel}` }}
      onAccessibilityAction={(e) => setPos(clamp(pos + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)))}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[s.frame, { aspectRatio: aspect, backgroundColor: t.surface2 }]}
      {...pan.panHandlers}>
      {width > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={{ uri: after }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[s.clip, { width: x }]}>
            <Image source={{ uri: before }} style={{ width, height: '100%' }} resizeMode="cover" />
          </View>
          <View style={[s.divider, { left: x - 1 }]} />
          <View style={[s.handle, { left: x - 18 }]}>
            <Text style={s.handleText}>‹ ›</Text>
          </View>
          <Text style={[s.tag, { left: 8 }]}>{beforeLabel}</Text>
          <Text style={[s.tag, { right: 8 }]}>{afterLabel}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff' },
  handle: {
    position: 'absolute', top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  handleText: { color: '#111', fontWeight: '700', fontSize: 14 },
  tag: {
    position: 'absolute', top: 8, color: '#fff', fontSize: 12, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
});
