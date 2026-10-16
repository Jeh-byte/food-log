// Barcode lookup in the free Open Food Facts database. Only the barcode number is sent.
import type { Estimate } from './nutrition';

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);

/** Returns an estimate shaped like Claude's, or null if the product is unknown. */
export async function lookup(code: string): Promise<Estimate | null> {
  const fields = 'product_name,brands,serving_size,serving_quantity,nutriments';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
      { signal: controller.signal, headers: { 'User-Agent': 'FoodLog/1.0 (personal Android app)' } },
    );
  } catch {
    throw new Error("Couldn't reach the barcode database. Are you online?");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Couldn't reach the barcode database. Are you online?");

  const data = (await res.json()) as {
    status: number;
    product?: {
      product_name?: string;
      brands?: string;
      serving_size?: string;
      serving_quantity?: number | string;
      nutriments?: Record<string, number>;
    };
  };
  const p = data.product;
  if (data.status !== 1 || !p) return null;

  const n = p.nutriments ?? {};
  const brand = p.brands?.split(',')[0]?.trim();
  const showBrand = brand && !p.product_name?.toLowerCase().includes(brand.toLowerCase());
  const name = [p.product_name, showBrand ? brand : null].filter(Boolean).join(' · ') || `Product ${code}`;
  const hasServing = n['energy-kcal_serving'] != null && num(p.serving_quantity) > 0;
  const per = hasServing ? '_serving' : '_100g';
  const kcal = n[`energy-kcal${per}`] ?? (n[`energy${per}`] != null ? n[`energy${per}`] / 4.184 : null);
  if (kcal == null) return null;

  return {
    meal_name: name,
    confidence: 'high',
    notes: hasServing ? '' : 'Values are per 100 g. Adjust the portion to match what you ate.',
    items: [
      {
        name,
        portion: hasServing ? p.serving_size || '1 serving' : '100 g',
        grams: hasServing ? num(p.serving_quantity) : 100,
        calories: num(kcal),
        protein: num(n[`proteins${per}`]),
        carbs: num(n[`carbohydrates${per}`]),
        fat: num(n[`fat${per}`]),
      },
    ],
  };
}
