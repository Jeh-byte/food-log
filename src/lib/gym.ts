// Progress photos and body measurements: storage, alignment maths and file import.
// Photos are copied into the app's own folder and never leave the phone, except for the optional
// automatic line-up, which sends a small copy to Claude (see bodyLandmarks in claude.ts).
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as db from './db';
import { daysBetween, today } from './dates';
import { KG_PER_LB } from './activity';
import type { TransformsStyle } from 'react-native';

type TransformList = Exclude<NonNullable<TransformsStyle['transform']>, string>;

export const POSES: { value: db.Pose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
];

export const MEASURES = [
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arms', label: 'Arms', unit: 'cm' },
  { key: 'thighs', label: 'Thighs', unit: 'cm' },
  { key: 'bodyfat', label: 'Body fat', unit: '%' },
] as const;
export type MeasureKey = (typeof MEASURES)[number]['key'];
export const measureInfo = (k: string) => MEASURES.find((m) => m.key === k) ?? MEASURES[0];

/** Where to tap on each photo to line it up. */
export const ALIGN_HELP: Record<db.Pose, [string, string]> = {
  front: ['the base of your neck (top of the breastbone)', 'your belly button'],
  side: ['the base of your neck (front of the throat, collarbone level)', 'belly-button height (front of your stomach)'],
  back: ['the base of your neck (bump at the top of the spine)', 'your spine at belly-button height'],
};

// ---- photo files ----

const MAX_SIDE = 1600;

function photoDir() {
  const dir = new Directory(Paths.document, 'gym-photos');
  if (!dir.exists) dir.create();
  return dir;
}

export const photoUri = (p: db.GymPhoto) => new File(photoDir(), p.file).uri;

/** "2026:07:08 22:01:11" (EXIF) -> "2026-07-08" */
function exifDate(exif: Record<string, unknown> | null | undefined) {
  const v = exif?.DateTimeOriginal ?? exif?.DateTime;
  const m = typeof v === 'string' ? v.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Copies a picked/taken photo into the app (shrunk to a sensible size) and saves its details. */
export async function addPhoto(
  asset: { uri: string; width: number; height: number; exif?: Record<string, unknown> | null },
  pose: db.Pose,
) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const id = db.uid();
  const file = `${id}.jpg`;
  new File(img.uri).move(new File(photoDir(), file));
  const photo: db.GymPhoto = {
    id,
    date: exifDate(asset.exif) ?? today(),
    pose,
    file,
    width: img.width,
    height: img.height,
    align: null,
    auto: false,
  };
  await db.saveGymPhoto(photo);
  return photo;
}

export async function deletePhoto(p: db.GymPhoto) {
  try {
    const f = new File(photoDir(), p.file);
    if (f.exists) f.delete();
  } catch {}
  await db.deleteGymPhotoRow(p.id);
}

export function deleteAllPhotoFiles() {
  try {
    const dir = new Directory(Paths.document, 'gym-photos');
    if (dir.exists) dir.delete();
  } catch {}
}

/** A small JPEG of the photo as base64, for the automatic line-up. */
export async function smallBase64(p: db.GymPhoto) {
  const ctx = ImageManipulator.manipulate(photoUri(p));
  ctx.resize(p.width >= p.height ? { width: 768 } : { height: 768 });
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return img.base64 ?? '';
}

// ---- alignment ----

/**
 * Where the two points land in every comparison panel (fractions of the panel). Neck to belly button
 * is roughly a quarter of standing height, so this leaves room for the whole body, head to feet.
 */
export const ANCHOR_A = { x: 0.5, y: 0.16 };
export const ANCHOR_B = { x: 0.5, y: 0.33 };
export const PANEL_RATIO = 2 / 3; // width / height

/** How far lined-up photos are zoomed: 1 is the anchor spacing above, smaller shows more around the body. */
export const ZOOMS = { far: 0.55, normal: 0.75, close: 1 } as const;
export type Zoom = keyof typeof ZOOMS;

export type Placement = { scale: number; angle: number; tx: number; ty: number };

/**
 * How to draw a photo in a w×h panel: panel point = scale·rotate(angle)·photo pixel + (tx, ty).
 * With alignment points, the neck and belly button land on the same spots in every photo,
 * so photos taken closer, further away or slightly tilted still line up. `zoom` scales lined-up
 * photos about the middle of the body, so photos sharing a zoom stay lined up with each other.
 */
export function placement(p: db.GymPhoto, w: number, h: number, aligned: boolean, straighten = true, zoom = 1): Placement {
  const iw = p.width, ih = p.height;
  if (aligned && p.align) {
    const [[ax, ay], [bx, by]] = p.align;
    const sx = ax * iw, sy = ay * ih, ex = bx * iw, ey = by * ih;
    const srcLen = Math.hypot(ex - sx, ey - sy);
    if (srcLen > 2) {
      const tax = ANCHOR_A.x * w, tay = ANCHOR_A.y * h, tbx = ANCHOR_B.x * w, tby = ANCHOR_B.y * h;
      const scale = Math.hypot(tbx - tax, tby - tay) / srcLen;
      const angle = straighten ? Math.atan2(tby - tay, tbx - tax) - Math.atan2(ey - sy, ex - sx) : 0;
      const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
      const tx = tax - (c * sx - s * sy), ty = tay - (s * sx + c * sy);
      const cx = w / 2, cy = h * 0.45; // roughly the hips with the default anchors
      return { scale: scale * zoom, angle, tx: cx + (tx - cx) * zoom, ty: cy + (ty - cy) * zoom };
    }
  }
  const scale = Math.min(w / iw, h / ih);
  return { scale, angle: 0, tx: (w - iw * scale) / 2, ty: (h - ih * scale) / 2 };
}

/**
 * React Native transforms rotate/scale around the view's centre, so convert the placement above
 * into a transform list for an Image laid out at (0, 0) with the photo's pixel size.
 */
export function placementTransform(p: db.GymPhoto, pl: Placement): TransformList {
  const cx = p.width / 2, cy = p.height / 2;
  const c = Math.cos(pl.angle) * pl.scale, s = Math.sin(pl.angle) * pl.scale;
  const ux = pl.tx - cx + (c * cx - s * cy);
  const uy = pl.ty - cy + (s * cx + c * cy);
  return [
    { translateX: ux },
    { translateY: uy },
    { rotate: `${pl.angle}rad` },
    { scale: pl.scale },
  ];
}

// ---- comparing ----

/** The value on (or nearest to) a date, within maxDays. */
export function nearest<T extends { date: string }>(list: T[], date: string, maxDays: number) {
  let best: T | null = null, bestGap = Infinity;
  for (const x of list) {
    const gap = Math.abs(daysBetween(x.date, date));
    if (gap <= maxDays && gap < bestGap) {
      best = x;
      bestGap = gap;
    }
  }
  return best;
}

// ---- importing files (eufy, Me 360 / ZOZOFIT CSVs made from screenshots, and similar) ----

export type ImportRow = { date: string; time: number; member: string; values: Partial<Record<'weight' | MeasureKey, number>> };

// Column name words that identify each value, and words that rule a column out.
const COLUMNS: { key: 'weight' | MeasureKey; words: string[]; avoid: string[] }[] = [
  { key: 'weight', words: ['weight'], avoid: ['lean', 'muscle', 'bone', 'water', 'fat', 'protein', 'ideal', 'target'] },
  { key: 'bodyfat', words: ['body fat %', 'body fat(%)', 'body fat (%)', 'bodyfat', 'fat %'], avoid: ['mass', 'visceral', 'subcutaneous'] },
  { key: 'arms', words: ['bicep', 'arm'], avoid: [] },
  { key: 'chest', words: ['chest', 'bust'], avoid: [] },
  { key: 'waist', words: ['waist'], avoid: ['ratio', 'hip'] },
  { key: 'hips', words: ['hip', 'seat'], avoid: ['ratio', 'waist'] },
  { key: 'thighs', words: ['thigh'], avoid: [] },
];

function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function parseWhen(raw: string, dayFirst: boolean): Date | null {
  const t = raw.trim();
  if (/^\d{10}(\d{3})?$/.test(t)) return new Date(Number(t.slice(0, 10)) * 1000);
  const time = (h?: string, mi?: string, se?: string, ap?: string) => {
    let hh = Number(h ?? 0);
    if (ap) hh = (hh % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0);
    return [hh, Number(mi ?? 0), Number(se ?? 0)] as const;
  };
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (m) {
    const [hh, mi, se] = time(m[4], m[5], m[6], m[7]);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mi, se);
  }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const a = Number(m[1]), b = Number(m[2]);
    const [d, mo] = dayFirst ? [a, b] : [b, a];
    const [hh, mi, se] = time(m[4], m[5], m[6], m[7]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d, hh, mi, se);
  }
  return null;
}

/** Reads a scale or tape-measure export into rows of kg / cm / % values. */
export function parseBodyCsv(text: string): ImportRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const headIdx = lines.slice(0, 10).findIndex((l) => /date|time/i.test(l));
  if (headIdx < 0) throw new Error('No date or time column found.');
  const headLine = lines[headIdx];
  const sep = [',', ';', '\t'].sort((a, b) => headLine.split(b).length - headLine.split(a).length)[0];
  const head = splitCsvLine(headLine, sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const cTime = head.findIndex((h) => /date|time/.test(h));
  const cMember = head.findIndex((h) => h.includes('member') || h === 'name' || h === 'user' || h === 'profile');
  const cols = new Map<string, number>();
  for (const c of COLUMNS) {
    const i = head.findIndex((h, idx) =>
      ![...cols.values()].includes(idx) && c.words.some((w) => h.includes(w)) && !c.avoid.some((a) => h.includes(a)));
    if (i >= 0) cols.set(c.key, i);
  }
  if (!cols.size) throw new Error('No weight or measurement columns found.');
  const lb = cols.has('weight') && head[cols.get('weight')!].includes('lb');
  const inch = (k: string) => k !== 'weight' && k !== 'bodyfat' && /\(in\)|inch/.test(head[cols.get(k)!]);

  const body = lines.slice(headIdx + 1).map((l) => splitCsvLine(l, sep));
  // Day/month order: a first number over 12 can only be a day. Default to day first (Australia).
  let maxFirst = 0, maxSecond = 0;
  for (const r of body) {
    const m = (r[cTime] ?? '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (m) {
      maxFirst = Math.max(maxFirst, Number(m[1]));
      maxSecond = Math.max(maxSecond, Number(m[2]));
    }
  }
  const dayFirst = !(maxFirst > 0 && maxFirst <= 12 && maxSecond > 12);

  const rows: ImportRow[] = [];
  for (const r of body) {
    const when = parseWhen(r[cTime] ?? '', dayFirst);
    if (!when || isNaN(when.getTime())) continue;
    const values: ImportRow['values'] = {};
    for (const [k, i] of cols) {
      const m = (r[i] ?? '').trim().replace(',', '.').match(/^-?\d+(\.\d+)?/);
      let v = m ? Number(m[0]) : 0;
      if (!(v > 0)) continue; // eufy writes 0 for "not measured"
      if (k === 'weight' && lb) v *= KG_PER_LB;
      if (inch(k)) v *= 2.54;
      if (k === 'bodyfat' && !(v > 2 && v < 70)) continue;
      values[k as 'weight' | MeasureKey] = v;
    }
    if (!Object.keys(values).length) continue;
    rows.push({
      date: `${when.getFullYear()}-${pad2(when.getMonth() + 1)}-${pad2(when.getDate())}`,
      time: when.getTime(),
      member: cMember >= 0 ? (r[cMember] ?? '').trim() : '',
      values,
    });
  }
  return rows.sort((a, b) => a.time - b.time);
}

/** One set of values per day: each day's first reading (usually the morning weigh-in). */
export function firstPerDay(rows: ImportRow[]) {
  const days = new Map<string, ImportRow['values']>();
  for (const r of rows) {
    const day = days.get(r.date) ?? {};
    for (const [k, v] of Object.entries(r.values)) {
      if (day[k as keyof typeof day] === undefined) day[k as keyof typeof day] = v;
    }
    days.set(r.date, day);
  }
  return days;
}

/**
 * All weigh-ins and measurements as one CSV, one row per day. The Gym Progress desktop app
 * imports this file, and its own export uses the same columns, so the two apps can swap data.
 */
export async function bodyCsv() {
  const [weights, meas] = await Promise.all([db.weights(), db.gymMeasurements()]);
  const days = new Map<string, Record<string, number>>();
  for (const w of weights) days.set(w.date, { ...(days.get(w.date) ?? {}), weight: w.kg });
  for (const m of meas) days.set(m.date, { ...(days.get(m.date) ?? {}), [m.kind]: m.value });
  const cols: [string, string][] = [
    ['weight', 'Weight (kg)'], ['bodyfat', 'Body Fat %'], ['waist', 'Waist (cm)'], ['hips', 'Hips (cm)'],
    ['chest', 'Chest (cm)'], ['arms', 'Arms (cm)'], ['thighs', 'Thighs (cm)'],
  ];
  const lines = [['Date', ...cols.map((c) => c[1])].join(',')];
  for (const date of [...days.keys()].sort()) {
    const d = days.get(date)!;
    lines.push([date, ...cols.map(([k]) => (d[k] === undefined ? '' : String(Math.round(d[k] * 10) / 10)))].join(','));
  }
  return { csv: lines.join('\n'), days: days.size };
}

/** Saves imported days. Returns how many values were written. */
export async function saveImported(days: Map<string, ImportRow['values']>, replace: boolean) {
  const [weights, meas] = await Promise.all([db.weights(), db.gymMeasurements()]);
  const haveW = new Set(weights.map((w) => w.date));
  const haveM = new Set(meas.map((m) => `${m.date}|${m.kind}`));
  let n = 0;
  for (const [date, vals] of days) {
    for (const [k, v] of Object.entries(vals)) {
      if (v === undefined) continue;
      const value = Math.round(v * 10) / 10;
      if (k === 'weight') {
        if (replace || !haveW.has(date)) { await db.saveWeight(date, value); n++; }
      } else if (replace || !haveM.has(`${date}|${k}`)) {
        await db.saveGymMeasurement(date, k, value);
        n++;
      }
    }
  }
  return n;
}
