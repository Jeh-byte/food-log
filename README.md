# Food Log

A private food diary for Android, built with Expo (React Native and TypeScript). Log a meal by photo, voice, text or barcode, and Claude estimates calories, protein, carbs and fat. Everything you log stays on your phone.

## Features

**Logging**
- **Any way you like.** Snap a photo or pick one from the gallery, say "two eggs and toast", type it, or scan a barcode. Photos and text go to Claude; barcodes are looked up in [Open Food Facts](https://world.openfoodfacts.org).
- **Confirm before saving.** You see Claude's guess broken into items. Adjust each portion in ¼ steps, rename or remove items, pick the meal, then save. Tap any logged meal later to edit or delete it.
- **Favorites and repeats.** Star a meal and it becomes a one-tap chip on the Log screen, with Undo. Recent meals from the last two weeks can be repeated too.

**Understanding what you eat**
- **Daily goals and progress.** Set calorie and macro targets. A ring fills up through the day, with a bar for each macro.
- **Food colours.** Each food is tagged green, yellow or orange by calorie density (kcal per gram):

  | Colour | Density | Meaning |
  |---|---|---|
  | Green | under 1 kcal/g | Light and filling |
  | Yellow | 1–2.4 kcal/g | Moderate |
  | Orange | over 2.4 kcal/g | Dense; smaller portions |

  Today shows your day's colour mix. It's a guide to portions, not "good" or "bad" food.
- **Daily lessons.** 21 two-minute lessons on hunger, cravings, emotional eating, portions, motivation, habits and maintenance. Each ends with a "try today" step. They're general education, not medical advice.
- **Meal ideas.** Claude suggests three meals that fit what's left of your day, with ingredients and steps. Log one or save it as a favorite.

**Activity and progress**
- **Steps and exercise.** Log steps and workouts (12 types). Calories burned are estimated from your weight using standard MET values. You can optionally add them to your daily goal.
- **History and trends.** Weekly calorie and step charts against your goals, weekly averages, a month calendar (tap a day to see it), and a weight chart.
- **Streaks and badges.** Current and best logging streaks, plus 12 badges for logging, lessons and activity.

**Gym progress (Gym tab)**
- **Progress photos.** Take or pick front, side and back photos (several at once from the gallery). The photo date comes from the picture itself.
- **Line them up.** Mark two points on each photo (base of neck, belly button), or let Claude find them, and every photo is sized, moved and straightened to match, even if you stood closer or further away.
- **Compare.** Any two photos side by side, with a drag-to-wipe slider, or as a see-through overlay. Shows the days between them and how your weight and measurements changed, and shares the comparison as one image.
- **Measurements.** Log waist, hips, chest, arms, thighs and body fat, with a chart for each.
- **Import.** Bring in the eufy scale export (weight and circumference files; it asks whose readings to use) and measurement CSVs such as ones made from Me 360 or ZOZOFIT scans.

**Reminders and privacy**
- **Gentle reminders.** Optional "you haven't logged lunch yet" notifications. Today's reminder is cancelled once you log that meal.
- **Private by design.** Data lives in SQLite on the phone, and the API key sits in Android's encrypted secure store. Android cloud backup is turned off. Export a JSON backup (restorable, and also accepts backups from the earlier web version) or a CSV.

## Install on your phone

1. On your phone, open the **[latest release](https://github.com/Jeh-byte/food-log/releases/tag/latest)** and download the `.apk`.
2. Open it. Android will ask you to allow installs from your browser or file manager the first time.
3. Open Food Log, go to **Settings**, and paste a Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys). You pay Anthropic directly for each estimate (model `claude-opus-5-5`). Barcode lookups are free.

To update, download the newer APK from the same link and install it over the old one. Your data is kept.

## Build the APK

GitHub Actions ([.github/workflows/android.yml](.github/workflows/android.yml)) runs on every push to `main`. It typechecks, lints, builds a release APK, and replaces the `latest` release.

The workflow only publishes when four signing secrets are set (*Settings → Secrets and variables → Actions*): `FOODLOG_KEYSTORE_BASE64`, `FOODLOG_KEYSTORE_PASSWORD`, `FOODLOG_KEY_ALIAS` and `FOODLOG_KEY_PASSWORD`. Every build then has the same signature, so updates install over each other. Keep the keystore backed up privately and never commit it. If it's lost, a new key means uninstalling the app (and its data) once.

## Develop

Requires Node.js LTS.

```
npm install
npx expo start
```

Scan the QR code with **Expo Go**. Everything works in Expo Go except *Say it*, which needs the real APK; in Expo Go it falls back to your keyboard's mic.

Before committing, run:

```
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## What leaves your phone

| What | Where it goes | When |
|---|---|---|
| Meal photo or description | Anthropic API | When you tap *Estimate* |
| Remaining calories and food preferences | Anthropic API | When you ask for meal ideas |
| Barcode number | Open Food Facts | When you scan or type a barcode |
| Voice audio | Android's speech recognition service | When you use *Say it* |

Nothing else is sent anywhere.

## Code map

| Path | Purpose |
|---|---|
| `src/app/(tabs)/` | Today, Log, Progress, Learn and Settings tabs |
| `src/app/confirm.tsx` | Check and adjust an estimate before saving |
| `src/app/scanner.tsx`, `ideas.tsx`, `activity.tsx` | Barcode scanner, meal ideas, activity logging |
| `src/app/lesson/[id].tsx`, `day/[date].tsx` | A lesson; a past day |
| `src/lib/db.ts` | SQLite storage, settings, backup and restore |
| `src/lib/claude.ts` | Claude Messages API calls with JSON-schema outputs |
| `src/lib/nutrition.ts` | Types, totals and the food colour system |
| `src/lib/reminders.ts` | Scheduled local notifications |
| `src/lib/lessons.ts` | Lesson content |
| `plugins/withReleaseSigning.js` | Config plugin for release signing from CI secrets |

An earlier browser-only version of the app is on the [`pwa`](https://github.com/Jeh-byte/food-log/tree/pwa) branch.
