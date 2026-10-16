export type Nutrients = { calories: number; protein: number; carbs: number; fat: number };
export const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'] as const;

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** One food in a meal. `base` is the estimate for one portion; `factor` is how many portions were eaten. */
export type Item = {
  name: string;
  portion: string;
  base: Nutrients & { grams: number };
  factor: number;
};

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD, local
  time: string; // HH:MM
  meal: Meal;
  name: string;
  items: Item[];
  source: 'photo' | 'text' | 'voice' | 'barcode' | 'favorite' | 'repeat' | 'idea';
};

export type Favorite = { id: string; name: string; meal: Meal; items: Item[] };

/** What Claude (or the barcode database) returns for a meal. */
export type Estimate = {
  meal_name: string;
  items: { name: string; portion: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[];
  confidence: 'low' | 'medium' | 'high';
  notes: string;
};

export function scaled(item: Item): Nutrients & { grams: number } {
  const f = item.factor;
  const b = item.base;
  return { grams: b.grams * f, calories: b.calories * f, protein: b.protein * f, carbs: b.carbs * f, fat: b.fat * f };
}

export function totals(sources: { items: Item[] }[] | Item[]): Nutrients {
  const sum: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const s of sources) {
    const items = 'items' in s ? s.items : [s];
    for (const item of items) {
      const v = scaled(item);
      for (const k of NUTRIENTS) sum[k] += v[k];
    }
  }
  return sum;
}

export const r0 = (n: number | undefined) => Math.round(n || 0);
export const macroLine = (n: Nutrients) => `P ${r0(n.protein)} · C ${r0(n.carbs)} · F ${r0(n.fat)}`;

export function itemsFromEstimate(est: Estimate): Item[] {
  return est.items.map((i) => ({
    name: i.name,
    portion: i.portion,
    base: { grams: i.grams, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat },
    factor: 1,
  }));
}

export function guessMeal(d = new Date()): Meal {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'breakfast';
  if (h >= 11 && h < 14.5) return 'lunch';
  if (h >= 17 && h < 21.5) return 'dinner';
  return 'snack';
}

// ---- Food colour system ----
// Groups foods by calorie density (calories per gram). Lighter foods fill you up for fewer calories;
// denser foods pack more calories into each bite. It's a guide to portions, not "good" vs "bad" food.

export type FoodColour = 'green' | 'yellow' | 'orange';
export const COLOURS: FoodColour[] = ['green', 'yellow', 'orange'];

export const COLOUR_INFO: Record<FoodColour, { label: string; range: string; hint: string }> = {
  green: { label: 'Green', range: 'under 1 kcal/g', hint: 'Light and filling: eat freely' },
  yellow: { label: 'Yellow', range: '1–2.4 kcal/g', hint: 'Moderate: watch portions' },
  orange: { label: 'Orange', range: 'over 2.4 kcal/g', hint: 'Dense: enjoy in smaller portions' },
};

export function colourOf(item: Item): FoodColour | null {
  if (!item.base.grams || item.base.grams <= 0) return null;
  const density = item.base.calories / item.base.grams;
  if (density < 1) return 'green';
  if (density <= 2.4) return 'yellow';
  return 'orange';
}

/** Calories eaten per colour. Items without a weight are left out. */
export function colourBreakdown(entries: { items: Item[] }[]): Record<FoodColour, number> {
  const out: Record<FoodColour, number> = { green: 0, yellow: 0, orange: 0 };
  for (const e of entries) {
    for (const item of e.items) {
      const c = colourOf(item);
      if (c) out[c] += scaled(item).calories;
    }
  }
  return out;
}
