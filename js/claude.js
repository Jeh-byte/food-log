// Nutrition estimates from Claude. Calls go straight from the phone to the Anthropic API
// using the user's own key; nothing passes through any other server.
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm";

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are a nutrition estimator inside a personal food-logging app.
The user describes or photographs what they ate. Break it into separate food items and estimate,
for the portion actually eaten, the weight in grams, calories (kcal), protein, carbohydrate and fat in grams.
Use typical recipes and standard portion sizes when the user doesn't say. If a photo shows a nutrition
label, use the label's values. Keep item names short (e.g. "Fried egg", "Toast with butter").
Describe the portion in plain words ("2 large", "1 slice", "1 cup"). Give a short meal_name for the whole
meal. Use notes only for assumptions the user would want to check (e.g. "Assumed whole milk"); otherwise
leave it empty. If the input contains no food, return an empty items list and explain in notes.`;

const SCHEMA = {
  type: "object",
  properties: {
    meal_name: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          grams: { type: "number" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
        required: ["name", "portion", "grams", "calories", "protein", "carbs", "fat"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
  required: ["meal_name", "items", "confidence", "notes"],
  additionalProperties: false,
};

/**
 * @param {{apiKey: string, text?: string, image?: {data: string, mediaType: string}}} input
 *   image.data is base64 without the data: prefix.
 */
export async function estimate({ apiKey, text, image }) {
  if (!apiKey) throw new Error("Add your Anthropic API key in Settings first.");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const content = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  }
  content.push({
    type: "text",
    text: text?.trim() || "Estimate the nutrition for the food in this photo.",
  });

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      // If a safety classifier declines, the API retries on a fallback model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Your API key was rejected. Check it in Settings.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Too many requests right now. Try again in a minute.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach Claude. Are you online?");
    if (err instanceof Anthropic.APIError) throw new Error(`Claude returned an error (${err.status ?? "?"}): ${err.message}`);
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude couldn't estimate this one. Try describing it in words instead.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("The estimate was cut off. Try logging fewer items at once.");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Claude returned no estimate. Please try again.");
  return JSON.parse(textBlock.text);
}
