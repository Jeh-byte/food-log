import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, H2, Hint, ProgressRow, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { LESSONS, nextLesson } from '@/lib/lessons';
import { useTheme } from '@/lib/theme';

export default function Learn() {
  const t = useTheme();
  const [read, setRead] = useState<Map<string, string>>(new Map());

  useFocusEffect(useCallback(() => { db.lessonsRead().then(setRead); }, []));

  const next = nextLesson(read);
  const open = (id: string) => router.push({ pathname: '/lesson/[id]', params: { id } });

  return (
    <Screen>
      <Card>
        <H2>{read.size} of {LESSONS.length} lessons read</H2>
        <ProgressRow value={read.size} max={LESSONS.length} />
        <Hint>
          A two-minute lesson a day on hunger, cravings, portions and habits. General education, not medical advice.
        </Hint>
      </Card>

      {LESSONS.map((l, i) => {
        const done = read.has(l.id);
        const isNext = next?.id === l.id;
        return (
          <Pressable key={l.id} onPress={() => open(l.id)}>
            <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, isNext && { borderColor: t.accent }]}>
              <Ionicons
                name={done ? 'checkmark-circle' : isNext ? 'play-circle' : 'ellipse-outline'}
                size={26}
                color={done ? t.carbs : isNext ? t.accent : t.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text2, fontSize: 12 }}>{i + 1} · {l.topic}{isNext ? ' · Up next' : ''}</Text>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{l.title}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
