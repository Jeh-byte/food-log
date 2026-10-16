import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card, H2, Hint, IconButton, Row, Screen, Button } from '@/components/ui';
import { ColourBar, ColourDot, ProgressBar, Ring } from '@/components/charts';
import * as db from '@/lib/db';
import { addDays, friendlyDate, today } from '@/lib/dates';
import { nextLesson, type Lesson } from '@/lib/lessons';
import { setDraft } from '@/lib/draft';
import {
  MEALS, MEAL_LABEL, colourBreakdown, colourOf, macroLine, r0, totals,
  type Entry, type FoodColour,
} from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

type State = {
  entries: Entry[];
  goals: db.Goals;
  profile: db.Profile;
  favNames: Set<string>;
  steps: number;
  burned: number;
  lesson: Lesson | null;
  hasKey: boolean;
};

export default function Today() {
  const t = useTheme();
  const [day, setDay] = useState(today());
  const [s, setS] = useState<State | null>(null);

  const load = useCallback(async () => {
    const [entries, goals, profile, favs, acts, read, key] = await Promise.all([
      db.entriesOn(day), db.getGoals(), db.getProfile(), db.favorites(),
      db.activitiesBetween(day, day), db.lessonsRead(), db.getApiKey(),
    ]);
    setS({
      entries,
      goals,
      profile,
      favNames: new Set(favs.map((f) => f.name)),
      steps: acts.reduce((n, a) => n + a.steps, 0),
      burned: acts.reduce((n, a) => n + a.calories, 0),
      lesson: nextLesson(read),
      hasKey: !!key,
    });
  }, [day]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!s) return <Screen>{null}</Screen>;

  const sum = totals(s.entries);
  const budget = s.goals.calories + (s.profile.addExercise ? Math.round(s.burned) : 0);
  const split: Record<FoodColour, number> = colourBreakdown(s.entries);

  const toggleFav = async (e: Entry) => {
    await db.setFavorite(e.name, e.meal, e.items, !s.favNames.has(e.name));
    load();
  };

  const edit = (e: Entry) => {
    setDraft({ ...e });
    router.push('/confirm');
  };

  return (
    <Screen>
      {!s.hasKey && (
        <Card style={{ borderColor: t.accent }}>
          <Hint>Add your Claude API key to estimate meals from photos and descriptions.</Hint>
          <Button title="Open Settings" small onPress={() => router.navigate('/settings')} style={{ alignSelf: 'flex-start' }} />
        </Card>
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton label="Previous day" icon="‹" onPress={() => setDay(addDays(day, -1))} />
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{friendlyDate(day)}</Text>
        {day < today() ? (
          <IconButton label="Next day" icon="›" onPress={() => setDay(addDays(day, 1))} />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </Row>

      <Card style={styles.progress}>
        <Ring value={sum.calories} goal={budget} />
        <View style={{ flex: 1, gap: 10 }}>
          <ProgressBar label="Protein" value={sum.protein} goal={s.goals.protein} unit="g" color={t.protein} />
          <ProgressBar label="Carbs" value={sum.carbs} goal={s.goals.carbs} unit="g" color={t.carbs} />
          <ProgressBar label="Fat" value={sum.fat} goal={s.goals.fat} unit="g" color={t.fat} />
        </View>
      </Card>
      {s.profile.addExercise && s.burned > 0 && (
        <Hint>Goal includes {r0(s.burned)} kcal from activity.</Hint>
      )}

      {sum.calories > 0 && (
        <Card>
          <H2>Food colours</H2>
          <ColourBar split={split} />
          <Hint>Green foods fill you up for fewer calories. Aim for plenty of green; orange is fine in smaller portions.</Hint>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>Activity</H2>
          <Button title="+ Log" small onPress={() => router.push({ pathname: '/activity', params: { date: day } })} />
        </Row>
        <ProgressBar label="Steps" value={s.steps} goal={s.profile.stepGoal} unit="" color={t.accent} />
        <Hint>{s.burned > 0 ? `${r0(s.burned)} kcal burned from logged activity` : 'No activity logged yet.'}</Hint>
      </Card>

      {s.lesson && day === today() && (
        <Pressable onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: s.lesson!.id } })}>
          <Card>
            <Hint>Today’s lesson · {s.lesson.topic}</Hint>
            <H2>{s.lesson.title}</H2>
            <Text style={{ color: t.accent, fontWeight: '600' }}>Read (2 min) ›</Text>
          </Card>
        </Pressable>
      )}

      {MEALS.map((meal) => {
        const list = s.entries.filter((e) => e.meal === meal);
        if (!list.length) return null;
        return (
          <Card key={meal} style={{ gap: 0 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <H2>{MEAL_LABEL[meal]}</H2>
              <Text style={{ color: t.text2 }}>{r0(totals(list).calories)} kcal</Text>
            </Row>
            {list.map((e, i) => {
              const n = totals([e]);
              return (
                <View key={e.id} style={[styles.entry, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                  <Pressable style={{ flex: 1, paddingVertical: 10 }} onPress={() => edit(e)} accessibilityHint="Edit this meal">
                    <Row style={{ gap: 6 }}>
                      <Text style={{ color: t.text, fontWeight: '500', fontSize: 16, flexShrink: 1 }} numberOfLines={1}>{e.name}</Text>
                      {e.items.map((it, j) => <ColourDot key={j} colour={colourOf(it)} />)}
                    </Row>
                    <Text style={{ color: t.text2, fontSize: 13 }}>{macroLine(n)}</Text>
                  </Pressable>
                  <Text style={{ color: t.text2 }}>{r0(n.calories)}</Text>
                  <IconButton
                    label={s.favNames.has(e.name) ? 'Remove from favorites' : 'Save as favorite'}
                    icon="★"
                    color={s.favNames.has(e.name) ? t.star : t.border}
                    onPress={() => toggleFav(e)}
                  />
                </View>
              );
            })}
          </Card>
        );
      })}

      {!s.entries.length && (
        <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
          <Hint>Nothing logged {day === today() ? 'yet today' : 'on this day'}.</Hint>
          <Button title="Log a meal" kind="primary" onPress={() => router.navigate('/log')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
