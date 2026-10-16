import { useCallback, useState } from 'react';
import { Alert, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, Hint, Label, Row, Screen, Segmented } from '@/components/ui';
import { AlignedPhoto } from '@/components/body';
import * as db from '@/lib/db';
import { POSES, deletePhoto } from '@/lib/body';
import { addDays, friendlyDate } from '@/lib/dates';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [photo, setPhoto] = useState<db.BodyPhoto | null>(null);
  const [dateText, setDateText] = useState('');

  const load = useCallback(async () => {
    const p = await db.getBodyPhoto(id);
    setPhoto(p);
    if (p) setDateText(p.date);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!photo) return <Screen><Hint>Loading…</Hint></Screen>;

  const w = width - 32;
  const h = (photo.height / photo.width) * w;

  async function update(patch: Partial<db.BodyPhoto>) {
    if (!photo) return;
    const next = { ...photo, ...patch };
    setPhoto(next);
    await db.saveBodyPhoto(next);
  }

  async function chooseFor(role: 'before' | 'after') {
    if (!photo) return;
    const sel = await db.getSetting<{ before?: string; after?: string }>('compare', {});
    await db.setSetting('compare', { ...sel, [role]: photo.id });
    router.push('/compare');
  }

  function remove() {
    if (!photo) return;
    Alert.alert('Delete this photo?', 'It’s removed from Food Log. Copies in your phone’s gallery are not touched.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePhoto(photo); router.back(); } },
    ]);
  }

  return (
    <Screen>
      <AlignedPhoto photo={photo} width={w} height={Math.min(h, w * 1.6)} aligned={false} />
      <Card>
        <Label>Date</Label>
        <Row>
          <Button title="‹" small onPress={() => { const d = addDays(photo.date, -1); setDateText(d); update({ date: d }); }} />
          <Field
            value={dateText}
            onChangeText={setDateText}
            onEndEditing={() => (DATE.test(dateText.trim()) ? update({ date: dateText.trim() }) : setDateText(photo.date))}
            placeholder="YYYY-MM-DD"
            style={{ flex: 1, textAlign: 'center' }}
          />
          <Button title="›" small onPress={() => { const d = addDays(photo.date, 1); setDateText(d); update({ date: d }); }} />
        </Row>
        <Hint>{friendlyDate(photo.date)}</Hint>
        <Label>Pose</Label>
        <Segmented<db.Pose> value={photo.pose} onChange={(pose) => update({ pose })} options={POSES} />
        <Label>Line-up points</Label>
        <Hint>
          {photo.align
            ? `Set${photo.auto ? ' automatically' : ''}. Tap below to check or nudge them.`
            : 'Not set yet. Without them this photo can look bigger or smaller than others.'}
        </Hint>
        <Button
          title={photo.align ? 'Check line-up' : 'Line up this photo'}
          kind={photo.align ? 'ghost' : 'primary'}
          onPress={() => router.push({ pathname: '/align/[id]', params: { id: photo.id } })}
        />
      </Card>
      <Row>
        <Button title="Use as Before" small onPress={() => chooseFor('before')} style={{ flex: 1 }} />
        <Button title="Use as After" small onPress={() => chooseFor('after')} style={{ flex: 1 }} />
      </Row>
      <View style={{ alignItems: 'flex-start' }}>
        <Button title="Delete photo" kind="danger" small onPress={remove} />
      </View>
    </Screen>
  );
}
