import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Card, H2, Hint, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { friendlyDate } from '@/lib/dates';
import { setDraft } from '@/lib/draft';
import { MEALS, MEAL_LABEL, macroLine, r0, totals, type Entry } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

export default function DayScreen() {
  const t = useTheme();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [entries, setEntries] = useState<Entry[]>([]);

  useFocusEffect(useCallback(() => { db.entriesOn(date).then(setEntries); }, [date]));

  const sum = totals(entries);
  return (
    <Screen>
      <Stack.Screen options={{ title: friendlyDate(date) }} />
      <Card>
        <H2>{r0(sum.calories)} kcal</H2>
        <Text style={{ color: t.text2 }}>{macroLine(sum)}</Text>
      </Card>
      {MEALS.map((meal) => {
        const list = entries.filter((e) => e.meal === meal);
        if (!list.length) return null;
        return (
          <Card key={meal}>
            <H2>{MEAL_LABEL[meal]}</H2>
            {list.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => { setDraft({ ...e }); router.push('/confirm'); }}
                style={{ flexDirection: 'row', paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16 }}>{e.name}</Text>
                  <Text style={{ color: t.text2, fontSize: 13 }}>{e.time} · {macroLine(totals([e]))}</Text>
                </View>
                <Text style={{ color: t.text2 }}>{r0(totals([e]).calories)}</Text>
              </Pressable>
            ))}
          </Card>
        );
      })}
      {!entries.length && <Hint>Nothing logged on this day.</Hint>}
    </Screen>
  );
}
