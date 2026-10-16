import { useEffect } from 'react';
import { Text } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, H2, Hint, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { today } from '@/lib/dates';
import { LESSONS } from '@/lib/lessons';
import { useTheme } from '@/lib/theme';

export default function LessonScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const index = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[index];

  useEffect(() => {
    if (lesson) db.markLessonRead(lesson.id, today());
  }, [lesson]);

  if (!lesson) return <Screen><Hint>Lesson not found.</Hint></Screen>;
  const next = LESSONS[index + 1];

  return (
    <Screen>
      <Stack.Screen options={{ title: `Lesson ${index + 1} of ${LESSONS.length}` }} />
      <Hint>{lesson.topic}</Hint>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '700' }}>{lesson.title}</Text>
      {lesson.body.map((p, i) => <Body key={i}>{p}</Body>)}
      <Card style={{ borderColor: t.accent }}>
        <H2>Try today</H2>
        <Body>{lesson.tryToday}</Body>
      </Card>
      {next ? (
        <Button title={`Next: ${next.title}`} onPress={() => router.replace({ pathname: '/lesson/[id]', params: { id: next.id } })} />
      ) : (
        <Hint>That’s every lesson. Revisit any of them from the Learn tab.</Hint>
      )}
    </Screen>
  );
}
