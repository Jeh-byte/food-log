import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Busy, Button, Card, Field, H2, Hint, Row, Screen } from '@/components/ui';
import * as db from '@/lib/db';
import { estimate } from '@/lib/claude';
import { setDraft } from '@/lib/draft';
import { addDays, friendlyDate, nowTime, today } from '@/lib/dates';
import { listen, speechAvailable } from '@/lib/speech';
import { syncReminders } from '@/lib/reminders';
import { MEAL_LABEL, guessMeal, itemsFromEstimate, r0, totals, type Entry, type Favorite } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

type Photo = { uri: string; base64: string };

export default function Log() {
  const t = useTheme();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState('');
  const [listening, setListening] = useState<null | (() => void)>(null);
  const [voiceHint, setVoiceHint] = useState('');
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [undo, setUndo] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    setFavs(await db.favorites());
    const rows = await db.entriesBetween(addDays(today(), -14), today());
    const seen = new Set<string>();
    setRecent(
      rows.reverse().filter((e) => !seen.has(e.name) && !!seen.add(e.name)).slice(0, 8),
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function run(textNow: string, img: Photo | null, source: Entry['source']) {
    if (!textNow.trim() && !img) {
      Alert.alert('Nothing to estimate', 'Describe your food or take a photo first.');
      return;
    }
    setBusy('Claude is estimating…');
    try {
      const est = await estimate(await db.getApiKey(), textNow, img?.base64);
      if (!est.items.length) {
        Alert.alert('No food found', est.notes || 'Try describing it in words.');
        return;
      }
      setDraft({
        id: null, date: today(), time: nowTime(), meal: guessMeal(), name: est.meal_name || est.items[0].name,
        items: itemsFromEstimate(est), source, notes: est.notes, confidence: est.confidence,
      });
      setText('');
      setPhoto(null);
      router.push('/confirm');
    } catch (e) {
      const msg = (e as Error).message;
      Alert.alert('Estimate failed', msg, msg.includes('API key')
        ? [{ text: 'Cancel' }, { text: 'Open Settings', onPress: () => router.navigate('/settings') }]
        : undefined);
    } finally {
      setBusy('');
    }
  }

  async function takePhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Allow ${fromCamera ? 'camera' : 'photo'} access in Android settings to log by photo.`);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const asset = res.assets[0];
    // Shrink before sending: smaller uploads, faster answers, same accuracy.
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > 1280) {
      ctx.resize(asset.width >= asset.height ? { width: 1280 } : { height: 1280 });
    }
    const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    const p = { uri: img.uri, base64: img.base64 ?? '' };
    setPhoto(p);
    run(text, p, 'photo');
  }

  async function voice() {
    if (listening) {
      listening();
      return;
    }
    if (!speechAvailable()) {
      input.current?.focus();
      setVoiceHint('Tap the microphone on your keyboard to dictate.');
      return;
    }
    const before = text;
    let said = '';
    try {
      const stop = await listen({
        onText: (s) => {
          said = s;
          setText((before ? before + ' ' : '') + s);
        },
        onError: (m) => setVoiceHint(m),
        onEnd: () => {
          setListening(null);
          setVoiceHint('');
          if (said.trim()) run((before ? before + ' ' : '') + said, photo, 'voice');
        },
      });
      setListening(() => stop);
      setVoiceHint('Listening… tap “Say it” again to stop.');
    } catch (e) {
      setVoiceHint((e as Error).message === 'unavailable' ? 'Tap the microphone on your keyboard to dictate.' : (e as Error).message);
      input.current?.focus();
    }
  }

  async function relog(f: Favorite) {
    const entry: Entry = {
      id: db.uid(), date: today(), time: nowTime(), meal: guessMeal(), name: f.name,
      items: f.items.map((i) => ({ ...i })), source: 'favorite',
    };
    await db.saveEntry(entry);
    syncReminders().catch(() => {});
    setUndo(entry);
    setTimeout(() => setUndo((u) => (u?.id === entry.id ? null : u)), 6000);
  }

  function repeat(e: Entry) {
    setDraft({ ...e, id: null, date: today(), time: nowTime(), meal: guessMeal(), source: 'repeat' });
    router.push('/confirm');
  }

  async function removeFav(f: Favorite) {
    Alert.alert('Remove favorite?', f.name, [
      { text: 'Cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await db.deleteFavorite(f.id); load(); } },
    ]);
  }

  type Mode = 'photo' | 'gallery' | 'voice' | 'barcode';
  const modes: { key: Mode; label: string; icon: keyof typeof Ionicons.glyphMap; active?: boolean }[] = [
    { key: 'photo', label: 'Photo', icon: 'camera-outline' },
    { key: 'gallery', label: 'Gallery', icon: 'images-outline' },
    { key: 'voice', label: listening ? 'Stop' : 'Say it', icon: listening ? 'stop-circle-outline' : 'mic-outline', active: !!listening },
    { key: 'barcode', label: 'Barcode', icon: 'barcode-outline' },
  ];
  const pickMode = (mode: Mode) => {
    if (mode === 'photo') takePhoto(true);
    if (mode === 'gallery') takePhoto(false);
    if (mode === 'voice') voice();
    if (mode === 'barcode') router.push('/scanner');
  };

  return (
    <>
      <Screen>
        <View style={styles.modes}>
          {modes.map((m) => (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              onPress={() => pickMode(m.key)}
              style={({ pressed }) => [styles.mode, {
                backgroundColor: m.active ? t.accent : t.surface,
                borderColor: t.border,
                opacity: pressed ? 0.7 : 1,
              }]}>
              <Ionicons name={m.icon} size={26} color={m.active ? t.onAccent : t.accent} />
              <Text style={{ color: m.active ? t.onAccent : t.text2, fontWeight: '600', fontSize: 13 }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        <Card>
          {photo && <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Meal photo" />}
          <H2>What did you eat?</H2>
          <Field
            ref={input}
            value={text}
            onChangeText={setText}
            placeholder={photo ? 'Optional: add details, e.g. “I ate half”' : 'e.g. two eggs and toast with butter'}
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          {!!voiceHint && <Hint>{voiceHint}</Hint>}
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title="Clear" onPress={() => { setText(''); setPhoto(null); }} />
            <Button title="Estimate" kind="primary" onPress={() => run(text, photo, 'text')} />
          </Row>
        </Card>

        <Pressable onPress={() => router.push('/ideas')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="restaurant-outline" size={24} color={t.accent} />
            <View style={{ flex: 1 }}>
              <H2>Need an idea?</H2>
              <Hint>Get meal and recipe ideas that fit what’s left of today’s goals.</Hint>
            </View>
            <Text style={{ color: t.text2, fontSize: 20 }}>›</Text>
          </Card>
        </Pressable>

        <H2 style={{ marginTop: 4 }}>Favorites</H2>
        {favs.length ? (
          <View style={styles.chips}>
            {favs.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => relog(f)}
                onLongPress={() => removeFav(f)}
                accessibilityHint="Logs this meal now. Long-press to remove."
                style={({ pressed }) => [styles.chip, { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ color: t.text }}>{f.name}</Text>
                <Text style={{ color: t.text2, fontSize: 12 }}>{r0(totals([f]).calories)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Hint>Tap ★ on a logged meal to save it here. Then one tap logs it again.</Hint>
        )}

        <H2 style={{ marginTop: 4 }}>Recent</H2>
        {recent.length ? recent.map((e) => (
          <Pressable key={e.id} onPress={() => repeat(e)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16 }}>{e.name}</Text>
                <Text style={{ color: t.text2, fontSize: 13 }}>{friendlyDate(e.date)} · {MEAL_LABEL[e.meal]}</Text>
              </View>
              <Text style={{ color: t.text2 }}>{r0(totals([e]).calories)}</Text>
            </Card>
          </Pressable>
        )) : <Hint>Meals you log will show up here for quick repeats.</Hint>}
      </Screen>

      {undo && (
        <View style={[styles.toast, { backgroundColor: t.text }]}>
          <Text style={{ color: t.bg, flex: 1 }}>Logged {undo.name} · {r0(totals([undo]).calories)} kcal</Text>
          <Pressable
            onPress={async () => { await db.deleteEntry(undo.id); setUndo(null); syncReminders().catch(() => {}); }}
            hitSlop={8}>
            <Text style={{ color: t.bg, fontWeight: '700', textDecorationLine: 'underline' }}>Undo</Text>
          </Pressable>
        </View>
      )}
      <Busy visible={!!busy} text={busy} />
    </>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  photo: { width: '100%', height: 200, borderRadius: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
