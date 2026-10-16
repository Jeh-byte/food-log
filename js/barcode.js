// Barcode scanning with the browser's built-in BarcodeDetector (Chrome/Edge on Android),
// then a lookup in the free Open Food Facts database. Only the barcode number is sent.

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export const canScan = () => "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

/** Streams the camera into `video` until a barcode is seen. Returns {promise, stop}. */
export function scan(video) {
  let stream;
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  const promise = (async () => {
    const detector = new window.BarcodeDetector({ formats: FORMATS });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    await video.play();
    while (!stopped) {
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          stop();
          return codes[0].rawValue;
        }
      } catch {
        // Frame not ready yet; keep trying.
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  })();

  promise.catch(stop);
  return { promise, stop };
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

/** Looks up a barcode. Returns an estimate shaped like Claude's, or null if the product is unknown. */
export async function lookup(code) {
  const fields = "product_name,brands,serving_size,serving_quantity,nutriments";
  let res;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`,
      { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Couldn't reach the barcode database. Are you online?");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Couldn't reach the barcode database. Are you online?");
  const data = await res.json();
  const p = data.product;
  if (data.status !== 1 || !p) return null;

  const n = p.nutriments || {};
  const brand = p.brands?.split(",")[0]?.trim();
  const showBrand = brand && !p.product_name?.toLowerCase().includes(brand.toLowerCase());
  const name = [p.product_name, showBrand && brand].filter(Boolean).join(" · ") || `Product ${code}`;
  const hasServing = n["energy-kcal_serving"] != null && num(p.serving_quantity) > 0;
  const per = hasServing ? "_serving" : "_100g";
  const kcal = n[`energy-kcal${per}`] ?? (n[`energy${per}`] != null ? n[`energy${per}`] / 4.184 : null);
  if (kcal == null) return null;

  return {
    meal_name: name,
    confidence: "high",
    notes: hasServing ? "" : "Values are per 100 g. Adjust the portion to match what you ate.",
    items: [
      {
        name,
        portion: hasServing ? p.serving_size || "1 serving" : "100 g",
        grams: hasServing ? num(p.serving_quantity) : 100,
        calories: num(kcal),
        protein: num(n[`proteins${per}`]),
        carbs: num(n[`carbohydrates${per}`]),
        fat: num(n[`fat${per}`]),
      },
    ],
  };
}
