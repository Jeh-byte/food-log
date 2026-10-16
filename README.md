# Food Log

A private food diary that runs on your phone. Log a meal by photo, voice, text or barcode, and Claude estimates calories, protein, carbs and fat.

It's an installable web app (PWA): plain HTML, CSS and JavaScript with no build step and no server.

## Features

- **Log any way you like.** Snap a photo, say "two eggs and toast", type it, or scan a barcode. Photos and text go to Claude for an estimate. Barcodes are looked up in [Open Food Facts](https://world.openfoodfacts.org).
- **Confirm before saving.** You see Claude's guess broken into items. Adjust each portion (¼× steps), rename or remove items, pick the meal, then save. Tap any logged meal later to edit or delete it.
- **Favorites and repeats.** Star a meal and it appears as a chip on the Log screen; one tap logs it again, with Undo. Recent meals from the last two weeks are listed too.
- **Daily goals and progress.** Set calorie and macro targets. A ring fills up through the day, with a bar for each macro.
- **History and trends.** A weekly bar chart against your goal, weekly averages, and a month calendar. Tap a day to open it.
- **Gentle reminders.** Optional "you haven't logged lunch yet" nudges. See [How reminders work](#how-reminders-work).
- **Private by design.** Meals, favorites, goals and your API key are stored in this browser's IndexedDB on your phone. Export a JSON backup (restorable) or a CSV for spreadsheets.

## Setup

1. **Host it.** In the GitHub repo, go to *Settings → Pages* and deploy from the `main` branch, `/ (root)`. The app will be at `https://<user>.github.io/food-log/`. Any static host works; it needs HTTPS for camera, microphone and install.
2. **Install it.** Open the URL on your phone:
   - Android (Chrome): menu → *Install app*.
   - iPhone (Safari): Share → *Add to Home Screen*.
3. **Add your Claude API key.** Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys) and paste it in *Settings*. You pay Anthropic directly for each estimate. Barcode lookups are free.

To run it locally: `python -m http.server` in this folder, then open http://localhost:8000.

## What leaves your phone

| What | Where it goes | When |
|---|---|---|
| Your photo or description | Anthropic API (`claude-opus-5-5`) | When you tap *Estimate* |
| Barcode number | Open Food Facts | When you scan or type a barcode |
| Voice audio | Your browser's speech service (e.g. Google on Chrome) | When you use *Say it* |

Nothing else is sent anywhere. Your log never leaves the device unless you export it.

The API key is stored on the device and sent only to `api.anthropic.com`. Calling the API from the browser means anyone with access to your unlocked phone could read the key. Use a key with a spending limit.

## How reminders work

A web app has no server to send push notifications from, so reminders use three layers:

1. **While the app is open** (or in a background tab), it checks every minute and shows a banner or notification.
2. **Background checks.** On Android, when the app is installed from Chrome or Edge, it registers Periodic Background Sync. The phone wakes the app about once an hour, decided by the OS based on how often you use it, and notifies you only if the meal isn't logged.
3. **Add to calendar.** This exports an `.ics` file with a daily alarm for each reminder. It always fires on time, on any phone, but it can't tell whether you've already logged.

iPhones don't support background sync. Use *Add to calendar* there.

## Browser support notes

- **Barcode scanning** uses the built-in `BarcodeDetector` (Chrome or Edge on Android). Elsewhere, type the number under the barcode, or photograph the nutrition label instead.
- **Voice** uses the Web Speech API (Chrome, Edge, Safari). Where it's missing, use your keyboard's dictation mic.

## Code map

| File | Purpose |
|---|---|
| `index.html` | App shell: Today, Log, History and Settings views, plus confirm and scanner sheets |
| `js/app.js` | UI and app logic |
| `js/claude.js` | Claude API call with a JSON-schema structured output |
| `js/barcode.js` | Camera scanning and Open Food Facts lookup |
| `js/db.js` | IndexedDB storage |
| `js/charts.js` | Calorie ring and weekly bar chart (SVG) |
| `js/reminders.js` | Reminder checks, background sync and `.ics` export |
| `sw.js` | Offline cache and background reminder checks |
