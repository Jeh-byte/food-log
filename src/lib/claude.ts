// Claude calls go straight from the phone to the Anthropic API with the user's own key.
// The official TypeScript SDK doesn't support React Native, so this uses the Messages API over HTTPS.
import type { Estimate, Nutrients } from './nutrition';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5-5';

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    portion: { type: 'string' },
    grams: { type: 'number' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
  },
  required: ['name', 'portion', 'grams', 'calories', 'protein', 'carbs', 'fat'],
  additionalProperties: false,
};

const ESTIMATE_SCHEMA = {
  type: 'object',
  properties: {
    meal_name: { type: 'string' },
    items: { type: 'array', items: ITEM_SCHEMA },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string' },
  },
  required: ['meal_name', 'items', 'confidence', 'notes'],
  additionalProperties: false,
};

const ESTIMATE_SYSTEM = `You are a nutrition estimator inside a personal food-logging app.
The user describes or photographs what they ate. Break it into separate food items and estimate,
for the portion actually eaten, the weight in grams, calories (kcal), protein, carbohydrate and fat in grams.
Use typical recipes and standard portion sizes when the user doesn't say. If a photo shows a nutrition
label, use the label's values. Keep item names short (e.g. "Fried egg", "Toast with butter").
Describe the portion in plain words ("2 large", "1 slice", "1 cup"). For drinks, give grams equal to millilitres.
Give a short meal_name for the whole meal. Use notes only for assumptions the user would want to check
(e.g. "Assumed whole milk"); otherwise leave it empty. If the input contains no food, return an empty
items list and explain in notes.`;

export type MealIdea = {
  name: string;
  why: string;
  prep_minutes: number;
  ingredients: string[];
  steps: string[];
  items: Estimate['items'];
};

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          why: { type: 'string' },
          prep_minutes: { type: 'number' },
          ingredients: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          items: { type: 'array', items: ITEM_SCHEMA },
        },
        required: ['name', 'why', 'prep_minutes', 'ingredients', 'steps', 'items'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
};

const IDEAS_SYSTEM = `You suggest practical meals inside a personal food-logging app.
Suggest exactly 3 different meals that fit the calories and macros the user has left, using everyday
ingredients from an ordinary supermarket. Favour filling, lower-calorie-density foods (vegetables, fruit,
lean protein, whole grains, soups) without being preachy. Respect every preference and restriction the
user gives. For each meal: a short name; one sentence on why it fits; prep time; an ingredient list with
amounts for one serving; up to 6 short steps; and the nutrition broken into food items for one serving,
using the same item fields as a food log (portion in plain words, grams, kcal, protein, carbs, fat).`;

type Content =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

async function call<T>(apiKey: string, system: string, content: Content[], schema: object): Promise<T> {
  if (!apiKey) throw new Error('Add your Claude API key in Settings first.');

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // If a safety classifier declines, the API retries on a fallback model instead of failing.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        fallbacks: 'default',
      }),
    });
  } catch {
    throw new Error("Couldn't reach Claude. Are you online?");
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch {}
    if (res.status === 401) throw new Error('Your API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Too many requests right now. Try again in a minute.');
    if (res.status === 529 || res.status >= 500) throw new Error('Claude is busy right now. Try again shortly.');
    throw new Error(`Claude returned an error (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  const msg = (await res.json()) as { stop_reason: string; content: { type: string; text?: string }[] };
  if (msg.stop_reason === 'refusal') throw new Error("Claude couldn't help with this one. Try describing it differently.");
  if (msg.stop_reason === 'max_tokens') throw new Error('The answer was cut off. Try asking for less at once.');
  const text = msg.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned an empty answer. Please try again.');
  return JSON.parse(text) as T;
}

/** Estimates nutrition from a description, a photo (base64 JPEG), or both. */
export function estimate(apiKey: string, text: string, imageBase64?: string) {
  const content: Content[] = [];
  if (imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } });
  content.push({ type: 'text', text: text.trim() || 'Estimate the nutrition for the food in this photo.' });
  return call<Estimate>(apiKey, ESTIMATE_SYSTEM, content, ESTIMATE_SCHEMA);
}

export async function mealIdeas(apiKey: string, opts: { meal: string; remaining: Nutrients; preferences: string }) {
  const r = opts.remaining;
  const text = [
    `Meal: ${opts.meal}.`,
    `Left for today: ${Math.max(0, Math.round(r.calories))} kcal, ${Math.max(0, Math.round(r.protein))} g protein, ` +
      `${Math.max(0, Math.round(r.carbs))} g carbs, ${Math.max(0, Math.round(r.fat))} g fat.`,
    opts.preferences.trim() ? `Preferences: ${opts.preferences.trim()}` : 'No particular preferences.',
  ].join('\n');
  const res = await call<{ ideas: MealIdea[] }>(apiKey, IDEAS_SYSTEM, [{ type: 'text', text }], IDEAS_SCHEMA);
  return res.ideas;
}

const LANDMARK_SCHEMA = {
  type: 'object',
  properties: {
    person_found: { type: 'boolean' },
    neck_base_x: { type: 'number' },
    neck_base_y: { type: 'number' },
    navel_x: { type: 'number' },
    navel_y: { type: 'number' },
  },
  required: ['person_found', 'neck_base_x', 'neck_base_y', 'navel_x', 'navel_y'],
  additionalProperties: false,
};

const LANDMARK_SYSTEM = `You help line up a person's own fitness progress photos inside a private body-progress app.
Find two points on the main person in the photo and give their positions on a 0–1000 scale, where x=0 is the
left edge, x=1000 the right edge, y=0 the top edge and y=1000 the bottom edge of the image:
1. neck_base: the base of the neck, where the neck meets the torso (the notch at the top of the breastbone from
   the front; the front of the throat at collarbone height from the side; the bump at the top of the spine from behind).
2. navel: the belly button from the front; the front of the stomach at belly-button height from the side; the
   spine at belly-button height from behind. If clothing covers it, estimate where it is.
Be as precise as you can. If there is no person whose torso is visible, set person_found to false and all numbers to 0.`;

/** Finds the base of the neck and the belly button in a progress photo, as fractions of width and height. */
export async function bodyLandmarks(apiKey: string, imageBase64: string) {
  const r = await call<{ person_found: boolean; neck_base_x: number; neck_base_y: number; navel_x: number; navel_y: number }>(
    apiKey,
    LANDMARK_SYSTEM,
    [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Find the base of the neck and the belly button.' },
    ],
    LANDMARK_SCHEMA,
  );
  if (!r.person_found) return null;
  const f = (v: number) => Math.min(1, Math.max(0, v / 1000));
  const pts: [[number, number], [number, number]] = [[f(r.neck_base_x), f(r.neck_base_y)], [f(r.navel_x), f(r.navel_y)]];
  // Sanity check: the belly button must be clearly below the neck.
  if (pts[1][1] - pts[0][1] < 0.05) return null;
  return pts;
}
