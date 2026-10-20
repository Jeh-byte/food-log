import { useCallback, useState } from 'react';
import { Alert, Image } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Hint, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { shortDate } from '@/lib/dates';
import { POSES, deletePhoto, photoUri } from '@/lib/gym';

export default function GymPhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photo, setPhoto] = useState<db.GymPhoto | null>(null);

  useFocusEffect(useCallback(() => { db.getGymPhoto(id).then(setPhoto); }, [id]));

  if (!photo) return null;

  function remove() {
    if (!photo) return;
    Alert.alert('Delete this photo?', 'It is removed from the app for good.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePhoto(photo); router.back(); } },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: shortDate(photo.date) }} />
      <Image
        source={{ uri: photoUri(photo) }}
        style={{ width: '100%', aspectRatio: photo.width / photo.height || 0.75, borderRadius: 12 }}
        resizeMode="contain"
        accessibilityLabel={`${photo.pose} photo, ${shortDate(photo.date)}`}
      />
      <Hint>{POSES.find((p) => p.value === photo.pose)?.label} · {shortDate(photo.date)}</Hint>
      <Button title="Delete photo" kind="danger" onPress={remove} />
    </Screen>
  );
}
