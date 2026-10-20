// Local-only storage in SQLite on the phone. Nothing here is synced anywhere.
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import type { Entry, Favorite, Item, Meal } from './nutrition';

const SCHEMA_VERSION = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('food-log.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;
  if (version < 1) await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, meal TEXT NOT NULL,
      name TEXT NOT NULL, items TEXT NOT NULL, source TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS entries_date ON entries (date);
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, meal TEXT NOT NULL, items TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
      minutes REAL NOT NULL, steps INTEGER NOT NULL, calories REAL NOT NULL);
    CREATE INDEX IF NOT EXISTS activities_date ON activities (date);
    CREATE TABLE IF NOT EXISTS weights (date TEXT PRIMARY KEY NOT NULL, kg REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS lessons_read (lesson_id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);
  // v2: gym progress photos (files live in the app's document folder) and body measurements.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS gym_photos (
      id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, file TEXT NOT NULL, pose TEXT NOT NULL,
      width INTEGER NOT NULL, height INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS gym_photos_date ON gym_photos (date);
    CREATE TABLE IF NOT EXISTS gym_measurements (
      date TEXT NOT NULL, part TEXT NOT NULL, cm REAL NOT NULL, PRIMARY KEY (date, part));
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ---- entries ----

type EntryRow = Omit<Entry, 'items'> & { items: string };
const toEntry = (r: EntryRow): Entry => ({ ...r, items: JSON.parse(r.items) as Item[] });

export async function entriesOn(date: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>('SELECT * FROM entries WHERE date = ? ORDER BY time', date);
  return rows.map(toEntry);
}

export async function entriesBetween(from: string, to: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date, time', from, to);
  return rows.map(toEntry);
}

export async function getEntry(id: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', id);
  return row ? toEntry(row) : null;
}

export async function saveEntry(e: Entry) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO entries (id, date, time, meal, name, items, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    e.id, e.date, e.time, e.meal, e.name, JSON.stringify(e.items), e.source);
}

export async function deleteEntry(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', id);
}

/** Dates (YYYY-MM-DD) that have at least one entry, newest first. */
export async function loggedDates() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM entries ORDER BY date DESC');
  return rows.map((r) => r.date);
}

// ---- favorites ----

type FavRow = Omit<Favorite, 'items'> & { items: string };

export async function favorites() {
  const db = await getDb();
  const rows = await db.getAllAsync<FavRow>('SELECT * FROM favorites ORDER BY name COLLATE NOCASE');
  return rows.map((r) => ({ ...r, items: JSON.parse(r.items) as Item[] }));
}

export async function saveFavorite(f: Favorite) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO favorites (id, name, meal, items) VALUES (?, ?, ?, ?)',
    f.id, f.name, f.meal, JSON.stringify(f.items));
}

export async function deleteFavorite(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM favorites WHERE id = ?', id);
}

export async function setFavorite(name: string, meal: Meal, items: Item[], on: boolean) {
  const existing = (await favorites()).find((f) => f.name === name);
  if (on && !existing) await saveFavorite({ id: uid(), name, meal, items });
  if (!on && existing) await deleteFavorite(existing.id);
}

// ---- activity ----

export type Activity = {
  id: string;
  date: string;
  kind: 'steps' | 'workout';
  name: string;
  minutes: number;
  steps: number;
  calories: number;
};

export async function activitiesBetween(from: string, to: string) {
  const db = await getDb();
  return db.getAllAsync<Activity>('SELECT * FROM activities WHERE date BETWEEN ? AND ? ORDER BY date', from, to);
}

export async function saveActivity(a: Activity) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO activities (id, date, kind, name, minutes, steps, calories) VALUES (?, ?, ?, ?, ?, ?, ?)',
    a.id, a.date, a.kind, a.name, a.minutes, a.steps, a.calories);
}

export async function deleteActivity(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
}

// ---- weight ----

export async function weights() {
  const db = await getDb();
  return db.getAllAsync<{ date: string; kg: number }>('SELECT * FROM weights ORDER BY date');
}

export async function saveWeight(date: string, kg: number) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO weights (date, kg) VALUES (?, ?)', date, kg);
}

export async function deleteWeight(date: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM weights WHERE date = ?', date);
}

// ---- gym ----

export type GymPhoto = {
  id: string;
  date: string;
  /** File name inside the gym photos folder; see lib/gym.ts. */
  file: string;
  pose: Pose;
  width: number;
  height: number;
  created_at: string;
};

export type Pose = 'front' | 'side' | 'back' | 'other';

export async function gymPhotos() {
  const db = await getDb();
  return db.getAllAsync<GymPhoto>('SELECT * FROM gym_photos ORDER BY date DESC, created_at DESC');
}

export async function getGymPhoto(id: string) {
  const db = await getDb();
  return db.getFirstAsync<GymPhoto>('SELECT * FROM gym_photos WHERE id = ?', id);
}

export async function saveGymPhoto(p: GymPhoto) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO gym_photos (id, date, file, pose, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    p.id, p.date, p.file, p.pose, p.width, p.height, p.created_at);
}

export async function deleteGymPhotoRow(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM gym_photos WHERE id = ?', id);
}

export type Measurement = { date: string; part: string; cm: number };

export async function gymMeasurements() {
  const db = await getDb();
  return db.getAllAsync<Measurement>('SELECT * FROM gym_measurements ORDER BY date, part');
}

export async function saveGymMeasurement(m: Measurement) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO gym_measurements (date, part, cm) VALUES (?, ?, ?)', m.date, m.part, m.cm);
}

export async function deleteGymMeasurement(date: string, part: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM gym_measurements WHERE date = ? AND part = ?', date, part);
}

// ---- lessons ----

export async function lessonsRead() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ lesson_id: string; date: string }>('SELECT * FROM lessons_read');
  return new Map(rows.map((r) => [r.lesson_id, r.date]));
}

export async function markLessonRead(id: string, date: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR IGNORE INTO lessons_read (lesson_id, date) VALUES (?, ?)', id, date);
}

// ---- settings ----

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : fallback;
}

export async function setSetting<T>(key: string, value: T) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export type Goals = { calories: number; protein: number; carbs: number; fat: number };
export const DEFAULT_GOALS: Goals = { calories: 2000, protein: 100, carbs: 250, fat: 70 };

export type Profile = { weightKg: number; units: 'kg' | 'lb'; addExercise: boolean; stepGoal: number };
export const DEFAULT_PROFILE: Profile = { weightKg: 70, units: 'kg', addExercise: false, stepGoal: 8000 };

export const getGoals = async () => ({ ...DEFAULT_GOALS, ...(await getSetting<Partial<Goals>>('goals', {})) });
export const getProfile = async () => ({ ...DEFAULT_PROFILE, ...(await getSetting<Partial<Profile>>('profile', {})) });

// The API key lives in the Android Keystore-backed secure store, not in the database or backups.
const API_KEY = 'anthropic-api-key';
export const getApiKey = async () => (await SecureStore.getItemAsync(API_KEY)) ?? '';
export const setApiKey = async (key: string) =>
  key ? SecureStore.setItemAsync(API_KEY, key) : SecureStore.deleteItemAsync(API_KEY);

// ---- backup ----

export async function exportAll() {
  const db = await getDb();
  const all = async (table: string) => db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  return {
    app: 'food-log',
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: (await all('entries')).map((r) => ({ ...r, items: JSON.parse(r.items as string) })),
    favorites: (await all('favorites')).map((r) => ({ ...r, items: JSON.parse(r.items as string) })),
    activities: await all('activities'),
    weights: await all('weights'),
    // Photos stay on the phone; backups carry measurements only.
    gymMeasurements: await all('gym_measurements'),
    lessonsRead: await all('lessons_read'),
    settings: Object.fromEntries((await all('kv')).map((r) => [r.key, JSON.parse(r.value as string)])),
  };
}

export type Backup = Awaited<ReturnType<typeof exportAll>>;

/** Merges a backup into the database. Accepts this app's backups and the earlier web version's. */
export async function importAll(data: Partial<Backup> & { goals?: unknown; reminders?: unknown }) {
  if (data.app !== 'food-log') throw new Error('Not a Food Log backup');
  const db = await getDb();
  let count = 0;
  await db.withTransactionAsync(async () => {
    for (const e of (data.entries ?? []) as unknown as Entry[]) {
      await saveEntry({ ...e, source: e.source ?? 'text' });
      count++;
    }
    for (const f of (data.favorites ?? []) as unknown as Favorite[]) await saveFavorite(f);
    for (const a of (data.activities ?? []) as unknown as Activity[]) await saveActivity(a);
    for (const w of (data.weights ?? []) as unknown as { date: string; kg: number }[]) await saveWeight(w.date, w.kg);
    for (const m of (data.gymMeasurements ?? []) as unknown as Measurement[]) await saveGymMeasurement(m);
    for (const l of (data.lessonsRead ?? []) as unknown as { lesson_id: string; date: string }[]) {
      await markLessonRead(l.lesson_id, l.date);
    }
    const settings = { ...(data.settings ?? {}) } as Record<string, unknown>;
    if (data.goals) settings.goals = data.goals; // web-version backup
    for (const [k, v] of Object.entries(settings)) {
      if (k !== 'reminders' || (v as { items?: unknown[] })?.items) await setSetting(k, v);
    }
  });
  return count;
}

export async function wipeAll() {
  const db = await getDb();
  await db.execAsync(
    'DELETE FROM entries; DELETE FROM favorites; DELETE FROM activities; DELETE FROM weights; DELETE FROM gym_photos; DELETE FROM gym_measurements; DELETE FROM lessons_read; DELETE FROM kv;');
  await setApiKey('');
}
