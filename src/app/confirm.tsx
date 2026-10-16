import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, H2, Hint, IconButton, Label, Row, Screen, Segmented } from '@/components/ui';
import { ColourDot } from '@/components/charts';
import * as db from '@/lib/db';
import { clearDraft, takeDraft, type Draft } from '@/lib/draft';
import { friendlyDate } from '@/lib/dates';
import { syncReminders } from '@/lib/reminders';
import { COLOUR_INFO, MEALS, MEAL_LABEL, colourOf, macroLine, r0, scaled, totals, type Meal } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

const STEP = 0.25;

export default function Confirm() {
  const t = useTheme();
  const [d, setD] = useState<Draft | null>(() => takeDraft());
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (!d) return;
    db.favorites().then((fs) => setFav(fs.some((f) => f.name === d.name)));
    // Only on open: the name can change while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => clearDraft, []);

  if (!d) {
    return (
      <Screen>
        <Hint>Nothing to confirm.</Hint>
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const update = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const setItem = (i: number, patch: Partial<Draft['items'][number]>) =>
    update({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  const sum = totals(d.items);

  async function save() {
    if (!d) return;
    const entry = { ...d, id: d.id ?? db.uid(), name: d.name.trim() || 'Meal' };
    delete (entry as Partial<Draft>).notes;
    delete (entry as Partial<Draft>).confidence;
    await db.saveEntry(entry as typeof entry & { id: string });
    await db.setFavorite(entry.name, entry.meal, entry.items, fav);
    syncReminders().catch(() => {});
    router.dismissTo('/');
  }

  function remove() {
    if (!d?.id) return;
    Alert.alert('Delete this meal?', d.name, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await db.deleteEntry(d.id!);
          syncReminders().catch(() => {});
          router.back();
        },
      },
    ]);
  }

  const note = [
    d.confidence && d.confidence !== 'high' ? `Claude’s confidence: ${d.confidence}.` : '',
    d.notes ?? '',
  ].filter(Boolean).join(' ');

  return (
    <Screen>
      <Field value={d.name} onChangeText={(name) => update({ name })} accessibilityLabel="Meal name" style={styles.title} />
      <Hint>{note || (d.id ? `Logged ${friendlyDate(d.date)} at ${d.time}.` : 'Check the portions, then save.')}</Hint>

      {d.items.map((item, i) => {
        const v = scaled(item);
        const colour = colourOf(item);
        return (
          <Card key={i}>
            <Row>
              <ColourDot colour={colour} />
              <Field
                value={item.name}
                onChangeText={(name) => setItem(i, { name })}
                accessibilityLabel="Item name"
                style={styles.itemName}
              />
              <IconButton label={`Remove ${item.name}`} icon="✕" onPress={() => update({ items: d.items.filter((_, j) => j !== i) })} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Hint style={{ flex: 1 }}>
                {item.portion}{item.base.grams ? ` (${r0(item.base.grams)} g)` : ''}
                {colour ? ` · ${COLOUR_INFO[colour].label}` : ''}
              </Hint>
              <View style={[styles.stepper, { backgroundColor: t.surface2 }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Less"
                  onPress={() => setItem(i, { factor: Math.max(STEP, item.factor - STEP) })}
                  style={styles.stepBtn}>
                  <Text style={[styles.stepText, { color: t.text }]}>−</Text>
                </Pressable>
                <Text style={{ color: t.text, fontWeight: '700', minWidth: 44, textAlign: 'center' }}>{item.factor}×</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More"
                  onPress={() => setItem(i, { factor: Math.min(10, item.factor + STEP) })}
                  style={styles.stepBtn}>
                  <Text style={[styles.stepText, { color: t.text }]}>+</Text>
                </Pressable>
              </View>
            </Row>
            <Text style={{ color: t.text }}>
              <Text style={{ fontWeight: '700' }}>{r0(v.calories)} kcal</Text>
              <Text style={{ color: t.text2 }}>  {macroLine(v)}{v.grams ? ` · ${r0(v.grams)} g` : ''}</Text>
            </Text>
          </Card>
        );
      })}
      {!d.items.length && <Hint>No items left. Cancel, or go back and describe the meal again.</Hint>}

      <Card style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <H2>Total {r0(sum.calories)} kcal</H2>
        <Text style={{ color: t.text2 }}>{macroLine(sum)}</Text>
      </Card>

      <Label>Meal</Label>
      <Segmented<Meal>
        value={d.meal}
        onChange={(meal) => update({ meal })}
        options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
      />

      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: t.text, fontSize: 16 }}>Save as favorite</Text>
        <Switch value={fav} onValueChange={setFav} trackColor={{ true: t.accent }} />
      </Row>

      <Row style={{ marginTop: 8 }}>
        {d.id ? <Button title="Delete" kind="danger" onPress={remove} /> : null}
        <View style={{ flex: 1 }} />
        <Button title="Cancel" onPress={() => router.back()} />
        <Button title={d.id ? 'Save' : 'Log it'} kind="primary" disabled={!d.items.length} onPress={save} />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700' },
  itemName: { flex: 1, paddingVertical: 6, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 999 },
  stepBtn: { width: 44, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20 },
});
