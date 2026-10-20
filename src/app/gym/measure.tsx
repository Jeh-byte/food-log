import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Hint, Label, Row, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { MEASURES } from '@/lib/gym';
import { addDays, friendlyDate, today } from '@/lib/dates';
import { useTheme } from '@/lib/theme';

export default function MeasureScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date ?? today());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const all = (await db.gymMeasurements()).filter((m) => m.date === date);
    const v = Object.fromEntries(all.map((m) => [m.kind, m.value]));
    setSaved(v);
    setValues(Object.fromEntries(all.map((m) => [m.kind, String(m.value)])));
  }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save() {
    for (const m of MEASURES) {
      const raw = (values[m.key] ?? '').trim().replace(',', '.');
      if (!raw) {
        if (saved[m.key] !== undefined) await db.deleteGymMeasurement(date, m.key);
        continue;
      }
      const v = Number(raw);
      const ok = m.key === 'bodyfat' ? v > 2 && v < 70 : v > 10 && v < 300;
      if (!ok) {
        Alert.alert('Check the number', `${m.label} doesn’t look right (${raw} ${m.unit}).`);
        return;
      }
      await db.saveGymMeasurement(date, m.key, v);
    }
    router.back();
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button title="‹" small onPress={() => setDate(addDays(date, -1))} />
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{friendlyDate(date)}</Text>
        <Button title="›" small disabled={date >= today()} onPress={() => setDate(addDays(date, 1))} />
      </Row>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {MEASURES.map((m) => (
            <View key={m.key} style={{ width: '47%' }}>
              <Label>{m.label} ({m.unit})</Label>
              <Field
                value={values[m.key] ?? ''}
                onChangeText={(v) => setValues({ ...values, [m.key]: v })}
                keyboardType="decimal-pad"
                placeholder="–"
              />
            </View>
          ))}
        </View>
        <Hint>
          Fill in any you measured. Measure at the same spots each time: waist at the belly button, hips at the widest
          point, arms and thighs at the widest part of one side.
        </Hint>
      </Card>
      <Button title="Save" kind="primary" onPress={save} />
    </Screen>
  );
}
