// Progress photos live in the app's own document folder, not the gallery, so they stay private
// and survive the original being deleted. The database stores only the file name.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as db from './db';
import { today } from './dates';

const MAX_SIDE = 2000;

const photoDir = () => new Directory(Paths.document, 'gym-photos');

export const photoUri = (p: Pick<db.GymPhoto, 'file'>) => new File(photoDir(), p.file).uri;

export const POSES: { value: db.Pose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
  { value: 'other', label: 'Other' },
];

export const CM_PER_IN = 2.54;

export const PARTS = ['Chest', 'Waist', 'Hips', 'Arm', 'Thigh', 'Calf', 'Neck'];

/** Shrinks the picked image, copies it into app storage and records it. */
export async function addPhoto(src: { uri: string; width: number; height: number }, date: string, pose: db.Pose) {
  const ctx = ImageManipulator.manipulate(src.uri);
  if (Math.max(src.width, src.height) > MAX_SIDE) {
    ctx.resize(src.width >= src.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const dir = photoDir();
  dir.create({ idempotent: true, intermediates: true });
  const id = db.uid();
  const file = `${date}-${id}.jpg`;
  await new File(img.uri).copy(new File(dir, file));
  const photo: db.GymPhoto = {
    id, date, file, pose, width: img.width, height: img.height, created_at: new Date().toISOString(), align: null,
  };
  await db.saveGymPhoto(photo);
  return photo;
}

export async function deletePhoto(p: db.GymPhoto) {
  const f = new File(photoDir(), p.file);
  if (f.exists) f.delete();
  await db.deleteGymPhotoRow(p.id);
}

export function deleteAllPhotoFiles() {
  const dir = photoDir();
  if (dir.exists) dir.delete();
}

/** Reads the capture date from EXIF ("2026:10:20 07:15:00"), falling back to today. */
export function exifDate(exif: Record<string, unknown> | null | undefined) {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime;
  const m = typeof raw === 'string' ? /^(\d{4}):(\d{2}):(\d{2})/.exec(raw) : null;
  const d = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  return d && d <= today() ? d : today();
}

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());

/** The weigh-in on or closest before `date`, from the existing weight log. */
export function weightOn(weights: { date: string; kg: number }[], date: string) {
  let found: { date: string; kg: number } | undefined;
  for (const w of weights) {
    if (w.date <= date) found = w;
    else break;
  }
  return found;
}
