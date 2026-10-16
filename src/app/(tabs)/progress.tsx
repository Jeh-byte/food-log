import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Card, Field, H2, Hint, IconButton, Row, Screen } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';
import * as db from '@/lib/db';
import { addDays, parseDate, shortDate, today } from '@/lib/dates';
import { badges, bestStreak, currentStreak, type Badge } from '@/lib/badges';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/activity';
import { LESSONS } from '@/lib/lessons';
import { NUTRIENTS, r0, totals, type Entry, type Nutrients } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

type Day = { date: string; sums: Nutrients; logged: boolean; steps: number };

export default function Progress() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const chartW = width - 32 - 28;
  const [weekEnd, setWeekEnd] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [goals, setGoals] = useState(db.DEFAULT_GOALS);
  const [profile, setProfile] = useState(db.DEFAULT_PROFILE);
  const [week, setWeek] = useState<Day[]>([]);
  const [monthEntries, setMonthEntries] = useState<Entry[]>([]);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [earned, setEarned] = useState<Badge[]>([]);
  const [chart, setChart] = useState<'calories' | 'steps'>('calories');

  const load = useCallback(async () => {
    const start = addDays(weekEnd, -6);
    const [g, p, entries, acts, mEntries, w, dates, read, favs, allActs] = await Promise.all([
      db.getGoals(), db.getProfile(), db.entriesBetween(start, weekEnd), db.activitiesBetween(start, weekEnd),
      db.entriesBetween(`${month}-01`, `${month}-31`), db.weights(), db.loggedDates(), db.lessonsRead(),
      db.favorites(), db.activitiesBetween('0000-01-01', '9999-12-31'),
    ]);
    setGoals(g);
    setProfile(p);
    setWeek([...Array(7)].map((_, i) => {
      const date = addDays(start, i);
      const dayEntries = entries.filter((e) => e.date === date);
      return {
        date,
        sums: totals(dayEntries),
        logged: dayEntries.length > 0,
        steps: acts.filter((a) => a.date === date).reduce((n, a) => n + a.steps, 0),
      };
    }));
    setMonthEntries(mEntries);
    setWeights(w);
    const best = bestStreak(dates);
    setStreak({ current: currentStreak(dates), best });
    const stepsByDay = new Map<string, number>();
    for (const a of allActs) stepsByDay.set(a.date, (stepsByDay.get(a.date) ?? 0) + a.steps);
    setEarned(badges({
      loggedDays: dates.length,
      bestStreak: best,
      lessonsRead: read.size,
      totalLessons: LESSONS.length,
      workouts: allActs.filter((a) => a.kind === 'workout').length,
      maxSteps: Math.max(0, ...stepsByDay.values()),
      weighIns: w.length,
      favorites: favs.length,
    }));
  }, [weekEnd, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logged = week.filter((d) => d.logged);
  const avg = (k: keyof Nutrients) => (logged.length ? logged.reduce((s, d) => s + d.sums[k], 0) / logged.length : 0);

  async function addWeight() {
    const v = Number(weightInput.replace(',', '.'));
    if (!(v > 20 && v < 700)) {
      Alert.alert('Check the number', `Enter your weight in ${profile.units}.`);
      return;
    }
    const kg = fromDisplayWeight(v, profile.units);
    await db.saveWeight(today(), kg);
    // Keep the activity calorie estimates in step with the latest weight.
    await db.setSetting('profile', { ...profile, weightKg: kg });
    setWeightInput('');
    load();
  }

  const stepMonth = (n: number) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(today(new Date(y, m - 1 + n, 1)).slice(0, 7));
  };

  // Month calendar, Monday first.
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay = new Map<string, Entry[]>();
  for (const e of monthEntries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const dayNames = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Stat value={`${streak.current}`} label="day streak" />
        <Stat value={`${streak.best}`} label="best streak" />
        <Stat value={`${earned.filter((b) => b.earned).length}/${earned.length}`} label="badges" />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton label="Previous week" icon="‹" onPress={() => setWeekEnd(addDays(weekEnd, -7))} />
          <Text style={{ color: t.text, fontWeight: '700' }}>
            {week[0] ? `${shortDate(week[0].date)} – ${shortDate(week[6].date)}` : ''}
          </Text>
          {weekEnd < today() ? (
            <IconButton label="Next week" icon="›" onPress={() => {
              const n = addDays(weekEnd, 7);
              setWeekEnd(n > today() ? today() : n);
            }} />
          ) : <View style={{ width: 40 }} />}
        </Row>
        <Row style={{ justifyContent: 'center' }}>
          <Button title="Calories" small kind={chart === 'calories' ? 'primary' : 'ghost'} onPress={() => setChart('calories')} />
          <Button title="Steps" small kind={chart === 'steps' ? 'primary' : 'ghost'} onPress={() => setChart('steps')} />
        </Row>
        <BarChart
          key={chart + weekEnd}
          width={chartW}
          unit={chart === 'calories' ? 'kcal' : 'steps'}
          goal={chart === 'calories' ? goals.calories : profile.stepGoal}
          bars={week.map((d) => ({
            key: d.date,
            label: parseDate(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }),
            title: shortDate(d.date),
            value: chart === 'calories' ? d.sums.calories : d.steps,
          }))}
        />
        {logged.length ? (
          <View>
            <Hint>Daily average over {logged.length} logged day{logged.length > 1 ? 's' : ''}</Hint>
            <View style={[styles.tr, { borderBottomColor: t.border }]}>
              <Text style={[styles.td, { color: t.text2 }]} />
              <Text style={[styles.td, styles.num, { color: t.text2 }]}>Average</Text>
              <Text style={[styles.td, styles.num, { color: t.text2 }]}>Goal</Text>
            </View>
            {NUTRIENTS.map((k) => (
              <View key={k} style={[styles.tr, { borderBottomColor: t.border }]}>
                <Text style={[styles.td, { color: t.text }]}>{k[0].toUpperCase() + k.slice(1)}</Text>
                <Text style={[styles.td, styles.num, { color: t.text }]}>{r0(avg(k))}{k === 'calories' ? '' : ' g'}</Text>
                <Text style={[styles.td, styles.num, { color: t.text }]}>{goals[k]}{k === 'calories' ? '' : ' g'}</Text>
              </View>
            ))}
          </View>
        ) : <Hint>No meals logged this week.</Hint>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton label="Previous month" icon="‹" onPress={() => stepMonth(-1)} />
          <Text style={{ color: t.text, fontWeight: '700' }}>
            {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          {month < today().slice(0, 7) ? <IconButton label="Next month" icon="›" onPress={() => stepMonth(1)} /> : <View style={{ width: 40 }} />}
        </Row>
        <View style={styles.grid}>
          {dayNames.map((n, i) => <Text key={`h${i}`} style={[styles.cell, styles.head, { color: t.text2 }]}>{n}</Text>)}
          {[...Array(lead)].map((_, i) => <View key={`b${i}`} style={styles.cell} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`;
            const list = byDay.get(date);
            const cal = list ? totals(list).calories : 0;
            const pct = goals.calories ? Math.min(100, (cal / goals.calories) * 100) : 0;
            const future = date > today();
            return (
              <View key={date} style={styles.cell}>
                <Pressable
                  disabled={future || !list}
                  accessibilityLabel={`${date}${list ? `, ${r0(cal)} calories` : ''}`}
                  onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
                  style={[styles.day, { backgroundColor: t.surface2, opacity: future ? 0.35 : 1 },
                    date === today() && { borderWidth: 2, borderColor: t.accent }]}>
                  <Text style={{ color: t.text, fontSize: 13 }}>{i + 1}</Text>
                  {list && <Text style={{ color: t.text2, fontSize: 9 }}>{r0(cal)}</Text>}
                  {list && <View style={[styles.dayBar, { width: `${pct}%`, backgroundColor: t.accent }]} />}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Hint>Tap a logged day to see what you ate.</Hint>
      </Card>

      <Card>
        <H2>Weight</H2>
        {weights.length >= 2 ? (
          <LineChart
            width={chartW}
            unit={profile.units}
            points={weights.slice(-30).map((w) => ({ date: w.date, value: toDisplayWeight(w.kg, profile.units) }))}
          />
        ) : null}
        {weights.length > 0 && (
          <Hint>
            Latest: {toDisplayWeight(weights[weights.length - 1].kg, profile.units).toFixed(1)} {profile.units} on{' '}
            {shortDate(weights[weights.length - 1].date)}
            {weights.length >= 2 ? ` · change: ${fmtChange(toDisplayWeight(weights[weights.length - 1].kg - weights[0].kg, profile.units))} ${profile.units} since ${shortDate(weights[0].date)}` : ''}
          </Hint>
        )}
        <Row>
          <Field
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder={`Today’s weight (${profile.units})`}
            style={{ flex: 1 }}
          />
          <Button title="Save" kind="primary" onPress={addWeight} disabled={!weightInput} />
        </Row>
        <Hint>Weight swings day to day with water. Watch the trend over a few weeks.</Hint>
      </Card>

      <H2>Badges</H2>
      <View style={styles.badges}>
        {earned.map((b) => (
          <View
            key={b.id}
            accessible
            accessibilityLabel={`${b.title}: ${b.detail}. ${b.earned ? 'Earned' : 'Not yet earned'}`}
            style={[styles.badge, { backgroundColor: t.surface, borderColor: b.earned ? t.star : t.border, opacity: b.earned ? 1 : 0.5 }]}>
            <Text style={{ fontSize: 26 }}>{b.icon}</Text>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>{b.title}</Text>
            <Text style={{ color: t.text2, fontSize: 11, textAlign: 'center' }}>{b.detail}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const fmtChange = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

function Stat({ value, label }: { value: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: t.text2, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  td: { flex: 1, fontSize: 14 },
  num: { textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  head: { textAlign: 'center', fontSize: 12 },
  day: { aspectRatio: 0.9, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dayBar: { position: 'absolute', left: 0, bottom: 0, height: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { width: '31.5%', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, gap: 2 },
});
