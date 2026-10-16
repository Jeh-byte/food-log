// Gentle reminders: "you haven't logged lunch yet". A web app has no server to push from, so this uses
// three layers: (1) checks while the app is open, (2) background checks via Periodic Background Sync
// where the phone supports it (installed app in Chrome/Edge on Android), and (3) an optional calendar
// file the phone's own calendar app can alarm from, which always works but can't see what you've logged.
import * as db from "./db.js";
import { today } from "./util.js";

export const MEALS = ["breakfast", "lunch", "dinner", "snack"];

/** Reminders that are due now: past their time, not yet fired today, and that meal not logged today. */
export async function dueReminders(now = new Date()) {
  const settings = await db.getSetting("reminders", { enabled: false, items: [] });
  if (!settings.enabled) return [];
  const date = today(now);
  const fired = await db.getSetting("remindersFired", {});
  const logged = new Set((await db.entriesOn(date)).map((e) => e.meal));
  const hhmm = now.toTimeString().slice(0, 5);
  return settings.items.filter((r) => r.time <= hhmm && fired[r.id] !== date && !logged.has(r.meal));
}

export async function markFired(reminders, now = new Date()) {
  const fired = await db.getSetting("remindersFired", {});
  for (const r of reminders) fired[r.id] = today(now);
  await db.setSetting("remindersFired", fired);
}

export async function notify(reminder) {
  const body = `You haven't logged ${reminder.meal} yet. Tap to add it.`;
  if ("Notification" in window && Notification.permission === "granted") {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification("Food Log", { body, tag: `reminder-${reminder.id}`, icon: "icons/icon-192.png" });
    return new Notification("Food Log", { body });
  }
  return null;
}

export async function enableBackground() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  const reg = await navigator.serviceWorker?.ready;
  if (!reg || !("periodicSync" in reg)) return false;
  try {
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state !== "granted") return false;
    await reg.periodicSync.register("meal-reminders", { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** A daily repeating calendar event with an alarm for each reminder (.ics). */
export function calendarFile(items) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = items.map((r) => {
    const [h, m] = r.time.split(":");
    return [
      "BEGIN:VEVENT",
      `UID:food-log-${r.id}@food-log`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${h}${m}00`,
      "DURATION:PT5M",
      "RRULE:FREQ=DAILY",
      `SUMMARY:Log your ${r.meal}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:Log your ${r.meal} in Food Log`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Food Log//EN", ...events, "END:VCALENDAR"].join("\r\n");
}
