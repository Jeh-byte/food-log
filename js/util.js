const pad = (n) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return today(d);
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const r0 = (n) => Math.round(n || 0);

export const NUTRIENTS = ["calories", "protein", "carbs", "fat"];

/** An item's nutrition after its portion factor is applied. */
export function scaled(item) {
  const out = {};
  for (const k of [...NUTRIENTS, "grams"]) out[k] = (item.base[k] || 0) * item.factor;
  return out;
}

export function totals(entriesOrItems) {
  const sum = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const x of entriesOrItems) {
    const items = x.items || [x];
    for (const item of items) {
      const s = scaled(item);
      for (const k of NUTRIENTS) sum[k] += s[k];
    }
  }
  return sum;
}

export function guessMeal(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "breakfast";
  if (h >= 11 && h < 14.5) return "lunch";
  if (h >= 17 && h < 21.5) return "dinner";
  return "snack";
}

/** Shrinks a photo to at most `max` px on its longest side and returns base64 JPEG (no prefix). */
export async function downscale(file, max = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mediaType: "image/jpeg", preview: url };
}

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
