import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, H2, Hint, IconButton, Label, Screen, Segmented } from '@/components/ui';
import * as db from '@/lib/db';
import { WORKOUTS, stepCalories, workoutCalories } from '@/lib/activity';
import { friendlyDate, today } from '@/lib/dates';
import { r0 } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

export default function ActivityScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? today();
  const [kind, setKind] = useState<'steps' | 'workout'>('steps');
  const [steps, setSteps] = useState('');
  const [workout, setWorkout] = useState(WORKOUTS[0].name);
  const [minutes, setMinutes] = useState('30');
  const [profile, setProfile] = useState(db.DEFAULT_PROFILE);
  const [logged, setLogged] = useState<db.Activity[]>([]);

  const load = useCallback(async () => {
    setProfile(await db.getProfile());
    setLogged(await db.activitiesBetween(date, date));
  }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stepsN = Number(steps) || 0;
  const minN = Number(minutes) || 0;
  const kcal = kind === 'steps' ? stepCalories(stepsN, profile.weightKg) : workoutCalories(workout, minN, profile.weightKg);
  const valid = kind === 'steps' ? stepsN > 0 && stepsN < 200000 : minN > 0 && minN <= 600;

  async function save() {
    await db.saveActivity({
      id: db.uid(),
      date,
      kind,
      name: kind === 'steps' ? 'Steps' : workout,
      minutes: kind === 'steps' ? 0 : minN,
      steps: kind === 'steps' ? stepsN : 0,
      calories: Math.round(kcal),
    });
    router.back();
  }

  function remove(a: db.Activity) {
    Alert.alert('Delete this activity?', a.name, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await db.deleteActivity(a.id); load(); } },
    ]);
  }

  return (
    <Screen>
      <Hint>For {friendlyDate(date)}. Calories use your weight from Settings ({r0(profile.weightKg)} kg).</Hint>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[{ value: 'steps', label: 'Steps' }, { value: 'workout', label: 'Workout' }]}
      />

      {kind === 'steps' ? (
        <>
          <Label>Steps</Label>
          <Field value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 7500" />
          <Hint>Copy today’s count from your phone’s step counter or watch app.</Hint>
        </>
      ) : (
        <>
          <Label>Type</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WORKOUTS.map((w) => {
              const on = w.name === workout;
              return (
                <Pressable
                  key={w.name}
                  onPress={() => setWorkout(w.name)}
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                    borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : t.surface,
                  }}>
                  <Text style={{ color: on ? t.onAccent : t.text }}>{w.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label>Minutes</Label>
          <Field value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </>
      )}

      <Card>
        <H2>≈ {r0(kcal)} kcal burned</H2>
        <Hint>An estimate of calories above what you’d burn resting.</Hint>
      </Card>
      <Button title="Save" kind="primary" disabled={!valid} onPress={save} />

      {logged.length > 0 && (
        <>
          <Label>Already logged</Label>
          {logged.map((a) => (
            <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16 }}>{a.kind === 'steps' ? `${a.steps.toLocaleString()} steps` : `${a.name}, ${a.minutes} min`}</Text>
                <Text style={{ color: t.text2 }}>{a.calories} kcal</Text>
              </View>
              <IconButton label="Delete activity" icon="✕" onPress={() => remove(a)} />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
