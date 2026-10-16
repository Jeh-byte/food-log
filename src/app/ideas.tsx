import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Busy, Button, Card, Field, H2, Hint, Label, Row, Screen, Segmented } from '@/components/ui';
import * as db from '@/lib/db';
import { mealIdeas, type MealIdea } from '@/lib/claude';
import { setDraft } from '@/lib/draft';
import { nowTime, today } from '@/lib/dates';
import { MEALS, MEAL_LABEL, guessMeal, itemsFromEstimate, macroLine, r0, totals, type Meal, type Nutrients } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

export default function Ideas() {
  const t = useTheme();
  const [meal, setMeal] = useState<Meal>(guessMeal());
  const [prefs, setPrefs] = useState('');
  const [remaining, setRemaining] = useState<Nutrients | null>(null);
  const [ideas, setIdeas] = useState<MealIdea[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [goals, entries, prefsSaved] = await Promise.all([
        db.getGoals(), db.entriesOn(today()), db.getSetting('foodPreferences', ''),
      ]);
      const eaten = totals(entries);
      setRemaining({
        calories: goals.calories - eaten.calories,
        protein: goals.protein - eaten.protein,
        carbs: goals.carbs - eaten.carbs,
        fat: goals.fat - eaten.fat,
      });
      setPrefs(prefsSaved);
    })();
  }, []);

  async function ask() {
    if (!remaining) return;
    setBusy(true);
    try {
      await db.setSetting('foodPreferences', prefs);
      // Suggest for this meal: give it a share of what's left rather than the whole remainder.
      const share = { breakfast: 0.3, lunch: 0.4, dinner: 0.8, snack: 0.15 }[meal];
      const target: Nutrients = {
        calories: remaining.calories * share,
        protein: remaining.protein * share,
        carbs: remaining.carbs * share,
        fat: remaining.fat * share,
      };
      setIdeas(await mealIdeas(await db.getApiKey(), { meal: MEAL_LABEL[meal], remaining: target, preferences: prefs }));
    } catch (e) {
      Alert.alert('Couldn’t get ideas', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function logIt(idea: MealIdea) {
    setDraft({
      id: null, date: today(), time: nowTime(), meal, name: idea.name,
      items: itemsFromEstimate({ meal_name: idea.name, items: idea.items, confidence: 'medium', notes: '' }),
      source: 'idea',
    });
    router.push('/confirm');
  }

  async function save(idea: MealIdea) {
    const items = itemsFromEstimate({ meal_name: idea.name, items: idea.items, confidence: 'medium', notes: '' });
    await db.setFavorite(idea.name, meal, items, true);
    setSaved(new Set(saved).add(idea.name));
  }

  return (
    <Screen>
      {remaining && (
        <Card>
          <Hint>Left for today</Hint>
          <H2>{Math.max(0, r0(remaining.calories))} kcal</H2>
          <Text style={{ color: t.text2 }}>{macroLine({
            calories: 0,
            protein: Math.max(0, remaining.protein),
            carbs: Math.max(0, remaining.carbs),
            fat: Math.max(0, remaining.fat),
          })}</Text>
        </Card>
      )}
      <Label>Ideas for</Label>
      <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} />
      <Label>Preferences (optional)</Label>
      <Field
        value={prefs}
        onChangeText={setPrefs}
        placeholder="e.g. vegetarian, no mushrooms, 15 minutes max"
        multiline
      />
      <Button title={ideas.length ? 'Get new ideas' : 'Get ideas'} kind="primary" onPress={ask} disabled={!remaining} />

      {ideas.map((idea) => {
        const n = totals(itemsFromEstimate({ meal_name: idea.name, items: idea.items, confidence: 'medium', notes: '' }));
        return (
          <Card key={idea.name}>
            <H2>{idea.name}</H2>
            <Text style={{ color: t.text2 }}>
              {r0(n.calories)} kcal · {macroLine(n)} · {r0(idea.prep_minutes)} min
            </Text>
            <Hint>{idea.why}</Hint>
            <Label>Ingredients</Label>
            {idea.ingredients.map((x, i) => <Text key={i} style={{ color: t.text }}>• {x}</Text>)}
            <Label>Steps</Label>
            {idea.steps.map((x, i) => <Text key={i} style={{ color: t.text }}>{i + 1}. {x}</Text>)}
            <Row style={{ justifyContent: 'flex-end', marginTop: 6 }}>
              <Button
                title={saved.has(idea.name) ? 'Saved ★' : 'Save to favorites'}
                small
                disabled={saved.has(idea.name)}
                onPress={() => save(idea)}
              />
              <Button title="Log it" kind="primary" small onPress={() => logIt(idea)} />
            </Row>
          </Card>
        );
      })}
      {!ideas.length && (
        <View style={{ paddingVertical: 8 }}>
          <Hint>Claude suggests three meals that fit what you have left, with ingredients and steps.</Hint>
        </View>
      )}
      <Busy visible={busy} text="Claude is thinking up meals…" />
    </Screen>
  );
}
