import { useCallback, useState } from 'react';
import { Alert, Linking, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Button, Card, Field, H2, Hint, IconButton, Label, Row, Screen, Segmented } from '@/components/ui';
import * as db from '@/lib/db';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/activity';
import { today } from '@/lib/dates';
import {
  DEFAULT_REMINDERS, REMINDER_DAYS, ensurePermission, getReminders, newReminder, saveReminders,
  type ReminderSettings,
} from '@/lib/reminders';
import { MEALS, MEAL_LABEL, NUTRIENTS, r0, scaled, type Meal } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function Settings() {
  const t = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [goals, setGoals] = useState(db.DEFAULT_GOALS);
  const [profile, setProfile] = useState(db.DEFAULT_PROFILE);
  const [weightText, setWeightText] = useState('');
  const [rem, setRem] = useState<ReminderSettings>({ enabled: false, items: [] });
  const [times, setTimes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [k, g, p, r] = await Promise.all([db.getApiKey(), db.getGoals(), db.getProfile(), getReminders()]);
    setApiKey(k);
    setKeySaved(!!k);
    setGoals(g);
    setProfile(p);
    setWeightText(toDisplayWeight(p.weightKg, p.units).toFixed(0));
    setRem(r);
    setTimes(Object.fromEntries(r.items.map((i) => [i.id, i.time])));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveKey() {
    await db.setApiKey(apiKey.trim());
    setKeySaved(!!apiKey.trim());
  }

  async function saveGoal(k: keyof db.Goals, v: string) {
    const next = { ...goals, [k]: Math.max(0, Number(v) || 0) };
    setGoals(next);
    await db.setSetting('goals', next);
  }

  async function saveProfile(patch: Partial<db.Profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    await db.setSetting('profile', next);
  }

  async function updateReminders(next: ReminderSettings) {
    setRem(next);
    setTimes(Object.fromEntries(next.items.map((i) => [i.id, i.time])));
    await saveReminders(next);
  }

  async function toggleReminders(on: boolean) {
    if (on && !(await ensurePermission())) {
      Alert.alert('Notifications are off', 'Allow notifications for Food Log in Android settings to get reminders.', [
        { text: 'Cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await updateReminders({ enabled: on, items: rem.items.length ? rem.items : DEFAULT_REMINDERS });
  }

  async function exportFile(name: string, contents: string, mime: string) {
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(contents);
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Save your Food Log backup' });
  }

  async function exportJson() {
    const data = await db.exportAll();
    await exportFile(`food-log-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  async function exportCsv() {
    const { entries } = await db.exportAll();
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: unknown[][] = [['date', 'time', 'meal', 'meal_name', 'item', 'portion', 'servings', 'grams', 'calories', 'protein_g', 'carbs_g', 'fat_g']];
    for (const e of entries as unknown as { date: string; time: string; meal: string; name: string; items: Parameters<typeof scaled>[0][] }[]) {
      for (const item of e.items) {
        const s = scaled(item);
        rows.push([e.date, e.time, e.meal, e.name, item.name, item.portion, item.factor, r0(s.grams), r0(s.calories), r0(s.protein), r0(s.carbs), r0(s.fat)]);
      }
    }
    await exportFile(`food-log-${today()}.csv`, rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
  }

  async function importJson() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    try {
      const data = JSON.parse(await new File(res.assets[0].uri).text());
      const n = await db.importAll(data);
      Alert.alert('Backup restored', `Restored ${n} meals.`);
      load();
    } catch {
      Alert.alert('Couldn’t restore', 'That doesn’t look like a Food Log backup file.');
    }
  }

  function wipe() {
    Alert.alert(
      'Delete all data?',
      'This deletes every meal, favorite, activity, weight and setting on this phone, including your API key. Export a backup first if you might want them.',
      [
        { text: 'Cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: async () => { await db.wipeAll(); await saveReminders({ enabled: false, items: [] }); load(); } },
      ],
    );
  }

  return (
    <Screen>
      <Card>
        <H2>Claude API key</H2>
        <Hint>
          Used only to send a meal photo or description to Claude for an estimate. Stored encrypted on this phone.
        </Hint>
        <Field
          value={apiKey}
          onChangeText={(v) => { setApiKey(v); setKeySaved(false); }}
          placeholder="sk-ant-…"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: t.accent }} onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}>
            Get a key ›
          </Text>
          <Button title={keySaved ? 'Saved ✓' : 'Save key'} kind="primary" small disabled={keySaved} onPress={saveKey} />
        </Row>
      </Card>

      <Card>
        <H2>Daily goals</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {NUTRIENTS.map((k) => (
            <View key={k} style={{ width: '47%' }}>
              <Label>{k === 'calories' ? 'Calories' : `${k[0].toUpperCase() + k.slice(1)} (g)`}</Label>
              <Field
                defaultValue={String(goals[k])}
                key={`${k}-${goals[k]}`}
                keyboardType="number-pad"
                onEndEditing={(e) => saveGoal(k, e.nativeEvent.text)}
              />
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <H2>You and activity</H2>
        <Label>Units</Label>
        <Segmented
          value={profile.units}
          onChange={(units) => { saveProfile({ units }); setWeightText(toDisplayWeight(profile.weightKg, units).toFixed(0)); }}
          options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
        />
        <Label>Body weight ({profile.units})</Label>
        <Field
          value={weightText}
          onChangeText={setWeightText}
          keyboardType="decimal-pad"
          onEndEditing={() => {
            const v = Number(weightText.replace(',', '.'));
            if (v > 20 && v < 700) saveProfile({ weightKg: fromDisplayWeight(v, profile.units) });
          }}
        />
        <Hint>Used to estimate calories burned. Updated automatically when you log your weight.</Hint>
        <Label>Daily step goal</Label>
        <Field
          defaultValue={String(profile.stepGoal)}
          key={`steps-${profile.stepGoal}`}
          keyboardType="number-pad"
          onEndEditing={(e) => saveProfile({ stepGoal: Math.max(0, Number(e.nativeEvent.text) || 0) })}
        />
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>Add exercise calories to my daily goal</Text>
          <Switch value={profile.addExercise} onValueChange={(addExercise) => saveProfile({ addExercise })} trackColor={{ true: t.accent }} />
        </Row>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <H2>Reminders</H2>
            <Hint>A nudge if you haven’t logged a meal by a set time.</Hint>
          </View>
          <Switch value={rem.enabled} onValueChange={toggleReminders} trackColor={{ true: t.accent }} />
        </Row>
        {rem.enabled && rem.items.map((r) => (
          <View key={r.id} style={{ gap: 6, marginTop: 6 }}>
            <Segmented<Meal>
              value={r.meal}
              onChange={(meal) => updateReminders({ ...rem, items: rem.items.map((x) => (x.id === r.id ? { ...x, meal } : x)) })}
              options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
            />
            <Row>
              <Text style={{ color: t.text2 }}>if not logged by</Text>
              <Field
                value={times[r.id] ?? r.time}
                onChangeText={(v) => setTimes({ ...times, [r.id]: v })}
                onEndEditing={() => {
                  const v = (times[r.id] ?? '').trim().padStart(5, '0');
                  if (TIME.test(v)) updateReminders({ ...rem, items: rem.items.map((x) => (x.id === r.id ? { ...x, time: v } : x)) });
                  else setTimes({ ...times, [r.id]: r.time });
                }}
                placeholder="HH:MM"
                keyboardType="numbers-and-punctuation"
                style={{ width: 90, textAlign: 'center' }}
              />
              <View style={{ flex: 1 }} />
              <IconButton label="Remove reminder" icon="✕" onPress={() => updateReminders({ ...rem, items: rem.items.filter((x) => x.id !== r.id) })} />
            </Row>
          </View>
        ))}
        {rem.enabled && (
          <>
            <Button title="Add reminder" small style={{ alignSelf: 'flex-start' }} onPress={() => updateReminders({ ...rem, items: [...rem.items, newReminder()] })} />
            <Hint>Times are 24-hour. Reminders are scheduled {REMINDER_DAYS} days ahead and refresh each time you open the app.</Hint>
          </>
        )}
      </Card>

      <Card>
        <H2>Your data</H2>
        <Hint>
          Everything is stored on this phone only. Photos and descriptions are sent to Claude just for the estimate,
          and barcodes to Open Food Facts. Export a backup now and then; uninstalling the app deletes its data.
        </Hint>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="Export backup" small onPress={exportJson} />
          <Button title="Export CSV" small onPress={exportCsv} />
          <Button title="Restore backup" small onPress={importJson} />
        </View>
        <Button title="Delete all data" kind="danger" small style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={wipe} />
      </Card>
    </Screen>
  );
}
