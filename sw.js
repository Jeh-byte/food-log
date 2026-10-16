// Offline support + background meal reminders.
const CACHE = "food-log-v1";
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/db.js",
  "js/claude.js",
  "js/barcode.js",
  "js/charts.js",
  "js/reminders.js",
  "js/util.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate for the app's own files and the pinned SDK. API calls are never cached.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const cacheable = e.request.method === "GET" &&
    (url.origin === location.origin || url.hostname === "cdn.jsdelivr.net");
  if (!cacheable) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// ---- Background reminders (Periodic Background Sync; installed app on Chrome/Edge Android) ----
// Mirrors dueReminders() in js/reminders.js, reading the same IndexedDB database.

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("food-log", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // App hasn't run yet; nothing to remind about.
      req.transaction.abort();
    };
  });
}

const call = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function checkReminders() {
  const db = await idb();
  const kv = () => db.transaction("kv", "readwrite").objectStore("kv");
  const settings = await call(kv().get("reminders"));
  if (!settings?.enabled) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const fired = (await call(kv().get("remindersFired"))) || {};
  const entries = await call(db.transaction("entries").objectStore("entries").index("date").getAll(date));
  const logged = new Set(entries.map((e) => e.meal));

  const due = settings.items.filter((r) => r.time <= hhmm && fired[r.id] !== date && !logged.has(r.meal));
  for (const r of due) {
    fired[r.id] = date;
    await self.registration.showNotification("Food Log", {
      body: `You haven't logged ${r.meal} yet. Tap to add it.`,
      tag: `reminder-${r.id}`,
      icon: "icons/icon-192.png",
    });
  }
  if (due.length) await call(kv().put(fired, "remindersFired"));
}

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "meal-reminders") e.waitUntil(checkReminders().catch(() => {}));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      const open = list.find((c) => "focus" in c);
      return open ? open.focus() : self.clients.openWindow("./?view=log");
    }),
  );
});
