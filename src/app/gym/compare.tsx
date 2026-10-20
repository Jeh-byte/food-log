import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Card, Hint, Label, Row, Screen, Segmented } from '@/components/ui';
import { CompareSlider } from '@/components/compare';
import * as db from '@/lib/db';
import { daysBetween, shortDate } from '@/lib/dates';
import { toDisplayWeight } from '@/lib/activity';
import { CM_PER_IN, POSES, photoUri, weightOn } from '@/lib/gym';
import { useTheme } from '@/lib/theme';

export default function CompareScreen() {
  const t = useTheme();
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const [photos, setPhotos] = useState<db.GymPhoto[]>([]);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [measurements, setMeasurements] = useState<db.Measurement[]>([]);
  const [profile, setProfile] = useState(db.DEFAULT_PROFILE);
  const [pose, setPose] = useState<db.Pose | null>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([db.gymPhotos(), db.weights(), db.gymMeasurements(), db.getProfile()]).then(([p, w, m, prof]) => {
      setPhotos(p.filter((x) => x.date === a || x.date === b));
      setWeights(w);
      setMeasurements(m);
      setProfile(prof);
    });
  }, [a, b]));

  const [first, second] = a <= b ? [a, b] : [b, a];
  const onDate = (d: string) => photos.filter((p) => p.date === d);
  // Poses photographed on both dates come first, so the default comparison is like for like.
  const shared = POSES.filter((p) => onDate(first).some((x) => x.pose === p.value) && onDate(second).some((x) => x.pose === p.value));
  const options = shared.length ? shared : POSES.filter((p) => photos.some((x) => x.pose === p.value));
  const current = pose && options.some((o) => o.value === pose) ? pose : options[0]?.value;
  const pickFor = (d: string) => onDate(d).find((p) => p.pose === current) ?? onDate(d)[0];
  const before = pickFor(first);
  const after = pickFor(second);

  const wA = weightOn(weights, first);
  const wB = weightOn(weights, second);
  const inches = profile.units === 'lb';
  const lenUnit = inches ? 'in' : 'cm';
  const latestOnOrBefore = (part: string, d: string) =>
    measurements.filter((m) => m.part === part && m.date <= d).pop();
  const parts = [...new Set(measurements.map((m) => m.part))];
  const rows = parts
    .map((part) => ({ part, x: latestOnOrBefore(part, first), y: latestOnOrBefore(part, second) }))
    .filter((r) => r.x && r.y && r.x.date !== r.y.date);

  if (!before || !after) return <Screen><Hint>Those photos aren’t here any more.</Hint></Screen>;

  return (
    <Screen>
      {options.length > 1 && current && <Segmented value={current} options={options} onChange={setPose} />}
      <CompareSlider
        key={before.id + after.id}
        before={photoUri(before)}
        after={photoUri(after)}
        aspect={after.width / after.height || 0.75}
        beforeLabel={shortDate(first)}
        afterLabel={shortDate(second)}
      />
      <Hint style={{ textAlign: 'center' }}>Drag across the photo to slide between the two dates.</Hint>
      {!shared.length && <Hint>No pose was photographed on both dates, so these may not line up.</Hint>}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>{daysBetween(first, second)} days apart</Label>
        </Row>
        <View style={[s.tr, { borderBottomColor: t.border }]}>
          <Text style={[s.td, { color: t.text2 }]} />
          <Text style={[s.td, s.num, { color: t.text2 }]}>{shortDate(first)}</Text>
          <Text style={[s.td, s.num, { color: t.text2 }]}>{shortDate(second)}</Text>
          <Text style={[s.td, s.num, { color: t.text2 }]}>Change</Text>
        </View>
        {wA && wB && (
          <Line
            label={`Weight (${profile.units})`}
            x={toDisplayWeight(wA.kg, profile.units)}
            y={toDisplayWeight(wB.kg, profile.units)}
          />
        )}
        {rows.map(({ part, x, y }) => (
          <Line
            key={part}
            label={`${part} (${lenUnit})`}
            x={inches ? x!.cm / CM_PER_IN : x!.cm}
            y={inches ? y!.cm / CM_PER_IN : y!.cm}
          />
        ))}
        {!(wA && wB) && !rows.length && <Hint>Log weight and measurements to see the numbers change here too.</Hint>}
        {wA && wB && <Hint>Weight is the latest weigh-in on or before each date.</Hint>}
      </Card>
    </Screen>
  );
}

function Line({ label, x, y }: { label: string; x: number; y: number }) {
  const t = useTheme();
  const d = y - x;
  return (
    <View style={[s.tr, { borderBottomColor: t.border }]}>
      <Text style={[s.td, { color: t.text }]}>{label}</Text>
      <Text style={[s.td, s.num, { color: t.text }]}>{x.toFixed(1)}</Text>
      <Text style={[s.td, s.num, { color: t.text }]}>{y.toFixed(1)}</Text>
      <Text style={[s.td, s.num, { color: t.text }]}>{d > 0 ? '+' : ''}{d.toFixed(1)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  td: { flex: 1, fontSize: 14 },
  num: { textAlign: 'right' },
});
