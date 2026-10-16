import * as db from "./db.js";
import { estimate } from "./claude.js";
import * as barcode from "./barcode.js";
import { ring, weekBars } from "./charts.js";
import * as reminders from "./reminders.js";
import { today, parseDate, addDays, esc, r0, NUTRIENTS, scaled, totals, guessMeal, downscale, download } from "./util.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const DEFAULT_GOALS = { calories: 2000, protein: 100, carbs: 250, fat: 70 };
const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const VIEW_TITLE = { today: "Today", log: "Log food", history: "History", settings: "Settings" };

const state = {
  view: "today",
  day: today(),
  weekEnd: today(),
  month: today().slice(0, 7),
  goals: DEFAULT_GOALS,
  photo: null, // {data, mediaType, preview}
  draft: null, // entry being confirmed/edited
};

// ---------- helpers ----------

function toast(msg, action) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="link">${esc(action.label)}</button>` : ""}`;
  el.hidden = false;
  if (action) el.querySelector("button").onclick = () => { el.hidden = true; action.run(); };
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), action ? 6000 : 3000);
}

function busy(on, text = "Estimating…") {
  $("#busy").hidden = !on;
  $("#busy-text").textContent = text;
}

function friendlyDate(s) {
  const t = today();
  if (s === t) return "Today";
  if (s === addDays(t, -1)) return "Yesterday";
  return parseDate(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const kcal = (n) => `${r0(n)} kcal`;
const macroLine = (s) => `P ${r0(s.protein)} · C ${r0(s.carbs)} · F ${r0(s.fat)}`;

/** Turns an estimate (from Claude or the barcode database) into a draft entry. */
function draftFrom(result, source) {
  return {
    id: null,
    name: result.meal_name || result.items[0]?.name || "Meal",
    notes: result.notes || "",
    confidence: result.confidence,
    source,
    meal: guessMeal(),
    date: state.day,
    items: result.items.map((i) => ({
      name: i.name,
      portion: i.portion,
      base: { grams: i.grams, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat },
      factor: 1,
    })),
  };
}

const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------- navigation ----------

function show(view) {
  state.view = view;
  for (const v of Object.keys(VIEW_TITLE)) $(`#view-${v}`).hidden = v !== view;
  $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#screen-title").textContent = VIEW_TITLE[view];
  if (view === "today") renderToday();
  if (view === "log") renderLog();
  if (view === "history") renderHistory();
  window.scrollTo(0, 0);
}

$$(".tabbar button").forEach((b) => (b.onclick = () => show(b.dataset.view)));

// ---------- today ----------

async function renderToday() {
  const entries = (await db.entriesOn(state.day)).sort((a, b) => a.time.localeCompare(b.time));
  const sum = totals(entries);
  const g = state.goals;

  $("#today-date").textContent = friendlyDate(state.day);
  $('[data-day-step="1"]').disabled = state.day >= today();
  $("#ring").innerHTML = ring(sum.calories, g.calories);
  $("#macros").innerHTML = ["protein", "carbs", "fat"]
    .map((k) => {
      const pct = g[k] ? Math.min(100, (sum[k] / g[k]) * 100) : 0;
      return `<div class="macro macro-${k}">
        <div class="macro-head"><span>${k[0].toUpperCase() + k.slice(1)}</span><span>${r0(sum[k])} / ${g[k]} g</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");

  const favNames = new Set((await db.getAll("favorites")).map((f) => f.name));
  const html = reminders.MEALS.map((meal) => {
    const list = entries.filter((e) => e.meal === meal);
    if (!list.length) return "";
    return `<div class="card meal-card">
      <h2 class="meal-title"><span>${MEAL_LABEL[meal]}</span><span>${kcal(totals(list).calories)}</span></h2>
      ${list.map((e) => {
        const s = totals([e]);
        return `<div class="entry" data-id="${e.id}">
          <button class="entry-main" data-edit="${e.id}">
            <span class="entry-name">${esc(e.name)}</span>
            <span class="entry-sub">${esc(macroLine(s))}</span>
          </button>
          <span class="entry-kcal">${r0(s.calories)}</span>
          <button class="icon-btn star${favNames.has(e.name) ? " on" : ""}" data-fav="${e.id}" aria-label="Save as favorite">★</button>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");

  $("#meals").innerHTML = html || `<div class="empty">
      <p>Nothing logged ${state.day === today() ? "yet today" : "on this day"}.</p>
      <button class="btn primary" id="empty-log">Log a meal</button>
    </div>`;
  $("#empty-log")?.addEventListener("click", () => show("log"));

  $$("[data-edit]").forEach((b) => (b.onclick = () => openConfirm(clone(entries.find((e) => e.id === b.dataset.edit)))));
  $$("[data-fav]").forEach((b) => (b.onclick = async () => {
    const e = entries.find((x) => x.id === b.dataset.fav);
    await toggleFavorite(e);
    renderToday();
  }));
}

$$("[data-day-step]").forEach((b) => (b.onclick = () => {
  state.day = addDays(state.day, Number(b.dataset.dayStep));
  renderToday();
}));

async function toggleFavorite(entry) {
  const favs = await db.getAll("favorites");
  const existing = favs.find((f) => f.name === entry.name);
  if (existing) {
    await db.remove("favorites", existing.id);
    toast(`Removed “${entry.name}” from favorites`);
  } else {
    await db.put("favorites", { id: db.uid(), name: entry.name, meal: entry.meal, items: clone(entry.items) });
    toast(`Saved “${entry.name}” to favorites`);
  }
}

// ---------- log ----------

async function renderLog() {
  const favs = (await db.getAll("favorites")).sort((a, b) => a.name.localeCompare(b.name));
  $("#favorites").innerHTML = favs.length
    ? favs.map((f) => `<span class="chip">
        <button data-relog-fav="${f.id}">${esc(f.name)} <small>${r0(totals([f]).calories)}</small></button>
        <button class="chip-x" data-unfav="${f.id}" aria-label="Remove ${esc(f.name)} from favorites">✕</button>
      </span>`).join("")
    : `<p class="hint">Tap ★ on a logged meal to save it here. Then one tap logs it again.</p>`;

  $$("[data-relog-fav]").forEach((b) => (b.onclick = () => relog(favs.find((f) => f.id === b.dataset.relogFav))));
  $$("[data-unfav]").forEach((b) => (b.onclick = async () => {
    await db.remove("favorites", b.dataset.unfav);
    renderLog();
  }));

  // Recent: distinct meals from the last two weeks, newest first.
  const recent = (await db.entriesBetween(addDays(today(), -14), today()))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const seen = new Set();
  const unique = recent.filter((e) => !seen.has(e.name) && seen.add(e.name)).slice(0, 8);
  $("#recent").innerHTML = unique.length
    ? unique.map((e) => `<button class="list-row" data-recent="${e.id}">
        <span>${esc(e.name)}<small>${friendlyDate(e.date)} · ${MEAL_LABEL[e.meal]}</small></span>
        <span class="list-kcal">${r0(totals([e]).calories)}</span>
      </button>`).join("")
    : `<p class="hint">Meals you log will show up here for quick repeats.</p>`;
  $$("[data-recent]").forEach((b) => (b.onclick = () => {
    const e = unique.find((x) => x.id === b.dataset.recent);
    openConfirm({ ...clone(e), id: null, date: state.day, meal: guessMeal(), notes: "" });
  }));
}

/** One-tap re-log of a favorite, with undo. */
async function relog(fav) {
  const entry = {
    id: db.uid(),
    name: fav.name,
    meal: guessMeal(),
    date: today(),
    time: new Date().toTimeString().slice(0, 5),
    items: clone(fav.items),
    source: "favorite",
  };
  await db.put("entries", entry);
  toast(`Logged ${fav.name} · ${kcal(totals([entry]).calories)}`, {
    label: "Undo",
    run: async () => { await db.remove("entries", entry.id); refresh(); },
  });
  refresh();
}

function resetInput() {
  state.photo = null;
  $("#photo-preview").hidden = true;
  $("#photo-preview").removeAttribute("src");
  $("#food-text").value = "";
}

$("#clear-input").onclick = resetInput;

$$(".mode").forEach((b) => (b.onclick = () => {
  const mode = b.dataset.mode;
  if (mode === "photo") $("#photo-input").click();
  if (mode === "text") $("#food-text").focus();
  if (mode === "voice") startVoice();
  if (mode === "barcode") openScanner();
}));

$("#photo-input").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    state.photo = await downscale(file);
    $("#photo-preview").src = state.photo.preview;
    $("#photo-preview").hidden = false;
    $("#food-text").placeholder = "Optional: add details, e.g. “I ate half”";
    runEstimate();
  } catch {
    toast("Couldn't read that photo.");
  }
};

$("#estimate-btn").onclick = runEstimate;

async function runEstimate() {
  const text = $("#food-text").value.trim();
  if (!text && !state.photo) return toast("Describe your food or take a photo first.");
  busy(true, "Claude is estimating…");
  try {
    const result = await estimate({ apiKey: await db.getSetting("apiKey", ""), text, image: state.photo });
    if (!result.items.length) {
      toast(result.notes || "No food found. Try describing it in words.");
      return;
    }
    openConfirm(draftFrom(result, state.photo ? "photo" : "text"));
  } catch (err) {
    toast(err.message);
    if (/API key/.test(err.message)) show("settings");
  } finally {
    busy(false);
  }
}

// Voice: the browser's speech recognition fills the text box. Unsupported browsers fall back to
// the keyboard's own dictation mic.
let recognition;
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = $("#voice-status");
  if (!SR) {
    $("#food-text").focus();
    status.hidden = false;
    status.textContent = "Tap the mic on your keyboard to dictate.";
    return;
  }
  if (recognition) return recognition.stop();
  recognition = new SR();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  const before = $("#food-text").value;
  recognition.onresult = (e) => {
    const said = [...e.results].map((r) => r[0].transcript).join(" ");
    $("#food-text").value = (before ? before + " " : "") + said;
  };
  recognition.onstart = () => { status.hidden = false; status.textContent = "Listening… tap “Say it” again to stop."; };
  recognition.onerror = (e) => { status.textContent = e.error === "not-allowed" ? "Microphone access was blocked." : "Didn't catch that. Try again."; };
  recognition.onend = () => {
    recognition = null;
    if ($("#food-text").value.trim() && $("#food-text").value !== before) {
      status.hidden = true;
      runEstimate();
    }
  };
  recognition.start();
}

// ---------- barcode ----------

let scanSession;
async function openScanner() {
  const dlg = $("#scanner");
  const video = $("#scanner-video");
  $("#barcode-manual").value = "";
  dlg.showModal();
  if (!barcode.canScan()) {
    video.hidden = true;
    $("#scanner-hint").textContent = "Live scanning isn't supported in this browser. Type the number under the barcode, or snap a photo of the nutrition label instead.";
    return;
  }
  video.hidden = false;
  $("#scanner-hint").textContent = "Point the camera at the barcode.";
  scanSession = barcode.scan(video);
  try {
    const code = await scanSession.promise;
    if (code) lookupBarcode(code);
  } catch {
    video.hidden = true;
    $("#scanner-hint").textContent = "Couldn't open the camera. Type the number instead.";
  }
}

function closeScanner() {
  scanSession?.stop();
  scanSession = null;
  if ($("#scanner").open) $("#scanner").close();
}

$("#scanner-close").onclick = closeScanner;
$("#scanner").addEventListener("close", () => scanSession?.stop());
$("#barcode-form").onsubmit = (e) => {
  e.preventDefault();
  const code = $("#barcode-manual").value.replace(/\D/g, "");
  if (code.length >= 8) lookupBarcode(code);
};

async function lookupBarcode(code) {
  closeScanner();
  busy(true, "Looking up product…");
  try {
    const result = await barcode.lookup(code);
    if (!result) return toast(`Product ${code} isn't in the database. Try a photo of the label instead.`);
    openConfirm(draftFrom(result, "barcode"));
  } catch (err) {
    toast(err.message);
  } finally {
    busy(false);
  }
}

// ---------- confirm / edit sheet ----------

function openConfirm(draft) {
  state.draft = draft;
  $("#confirm-name").value = draft.name;
  const conf = draft.confidence && draft.confidence !== "high" ? `Claude's confidence: ${draft.confidence}. ` : "";
  $("#confirm-notes").textContent = conf + (draft.notes || (draft.id ? "" : "Check the portions, then save."));
  $("#confirm-meal").value = draft.meal;
  $("#confirm-delete").hidden = !draft.id;
  db.getAll("favorites").then((favs) => ($("#confirm-fav").checked = favs.some((f) => f.name === draft.name)));
  renderConfirmItems();
  $("#confirm").showModal();
}

function renderConfirmItems() {
  const d = state.draft;
  $("#confirm-items").innerHTML = d.items.map((item, i) => {
    const s = scaled(item);
    return `<div class="item">
      <div class="item-head">
        <input class="item-name" data-i="${i}" value="${esc(item.name)}" aria-label="Item name">
        <button type="button" class="icon-btn" data-remove="${i}" aria-label="Remove ${esc(item.name)}">✕</button>
      </div>
      <div class="item-portion">
        <span class="hint">${esc(item.portion)}${item.base.grams ? ` (${r0(item.base.grams)} g)` : ""}</span>
        <div class="stepper">
          <button type="button" data-step="-1" data-i="${i}" aria-label="Less">−</button>
          <span>${item.factor}×</span>
          <button type="button" data-step="1" data-i="${i}" aria-label="More">＋</button>
        </div>
      </div>
      <div class="item-nums"><strong>${kcal(s.calories)}</strong><span>${macroLine(s)}${s.grams ? ` · ${r0(s.grams)} g` : ""}</span></div>
    </div>`;
  }).join("") || `<p class="hint">No items left. Cancel, or go back and describe the meal again.</p>`;

  const t = totals(d.items);
  $("#confirm-total").innerHTML = `<span>Total</span><strong>${kcal(t.calories)}</strong><span>${macroLine(t)}</span>`;
  $("#confirm-save").disabled = !d.items.length;

  $$("[data-step]").forEach((b) => (b.onclick = () => {
    const item = d.items[b.dataset.i];
    item.factor = Math.max(0.25, Math.min(10, item.factor + Number(b.dataset.step) * 0.25));
    renderConfirmItems();
  }));
  $$("[data-remove]").forEach((b) => (b.onclick = () => {
    d.items.splice(Number(b.dataset.remove), 1);
    renderConfirmItems();
  }));
  $$(".item-name").forEach((inp) => (inp.oninput = () => (d.items[inp.dataset.i].name = inp.value)));
}

$("#confirm").addEventListener("close", async () => {
  const action = $("#confirm").returnValue;
  const d = state.draft;
  state.draft = null;
  if (!d) return;

  if (action === "delete" && d.id) {
    const old = (await db.entriesOn(d.date)).find((e) => e.id === d.id);
    await db.remove("entries", d.id);
    toast("Entry deleted", { label: "Undo", run: async () => { await db.put("entries", old); refresh(); } });
    return refresh();
  }
  if (action !== "save") return;

  const entry = {
    ...d,
    id: d.id || db.uid(),
    name: $("#confirm-name").value.trim() || d.name,
    meal: $("#confirm-meal").value,
    time: d.time || new Date().toTimeString().slice(0, 5),
  };
  delete entry.notes;
  delete entry.confidence;
  await db.put("entries", entry);

  const favs = await db.getAll("favorites");
  const fav = favs.find((f) => f.name === entry.name);
  if ($("#confirm-fav").checked && !fav) {
    await db.put("favorites", { id: db.uid(), name: entry.name, meal: entry.meal, items: clone(entry.items) });
  } else if (!$("#confirm-fav").checked && fav) {
    await db.remove("favorites", fav.id);
  }

  navigator.storage?.persist?.();
  resetInput();
  toast(`${d.id ? "Updated" : "Logged"} ${entry.name} · ${kcal(totals([entry]).calories)}`);
  state.day = entry.date;
  show("today");
});

// ---------- history ----------

async function renderHistory() {
  // Week chart
  const end = state.weekEnd;
  const start = addDays(end, -6);
  const entries = await db.entriesBetween(start, end);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const dayEntries = entries.filter((e) => e.date === date);
    const d = parseDate(date);
    days.push({
      date,
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      title: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      value: totals(dayEntries).calories,
      sums: totals(dayEntries),
      logged: dayEntries.length > 0,
    });
  }
  $("#week-label").textContent = `${days[0].title} – ${days[6].title}`;
  $("#week-next").disabled = end >= today();
  $("#week-chart").innerHTML = weekBars(days, state.goals.calories);
  $("#week-tip").textContent = "Tap a bar for details";
  $$("#week-chart .bar-group").forEach((g) => {
    const showTip = () => ($("#week-tip").textContent = g.dataset.tip);
    g.addEventListener("click", showTip);
    g.addEventListener("focus", showTip);
    g.addEventListener("mouseenter", showTip);
  });

  const logged = days.filter((d) => d.logged);
  const avg = (k) => (logged.length ? logged.reduce((s, d) => s + d.sums[k], 0) / logged.length : 0);
  $("#week-avg").innerHTML = logged.length
    ? `<p class="hint">Daily average over ${logged.length} logged day${logged.length > 1 ? "s" : ""}</p>
      <table class="avg-table">
        <tr><th></th><th>Average</th><th>Goal</th></tr>
        ${NUTRIENTS.map((k) => `<tr><td>${k[0].toUpperCase() + k.slice(1)}</td>
          <td>${r0(avg(k))}${k === "calories" ? "" : " g"}</td><td>${state.goals[k]}${k === "calories" ? "" : " g"}</td></tr>`).join("")}
      </table>`
    : `<p class="hint">No meals logged this week.</p>`;

  // Calendar
  const [y, m] = state.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthEntries = await db.entriesBetween(`${state.month}-01`, `${state.month}-31`);
  const byDay = {};
  for (const e of monthEntries) (byDay[e.date] ||= []).push(e);

  $("#month-label").textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  $("#month-next").disabled = state.month >= today().slice(0, 7);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const names = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }));
  let cells = names.map((n) => `<div class="cal-head">${n}</div>`).join("");
  cells += `<div></div>`.repeat(lead);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${state.month}-${String(d).padStart(2, "0")}`;
    const list = byDay[date];
    const cal = list ? totals(list).calories : 0;
    const pct = state.goals.calories ? Math.min(100, (cal / state.goals.calories) * 100) : 0;
    const future = date > today();
    cells += `<button class="cal-day${list ? " logged" : ""}${date === today() ? " today" : ""}" data-date="${date}" ${future ? "disabled" : ""}
        aria-label="${date}${list ? `, ${r0(cal)} calories` : ""}">
      <span>${d}</span>${list ? `<small>${r0(cal)}</small><i style="width:${pct}%"></i>` : ""}
    </button>`;
  }
  $("#calendar").innerHTML = cells;
  $$(".cal-day[data-date]").forEach((b) => (b.onclick = () => {
    state.day = b.dataset.date;
    show("today");
  }));
}

$("#week-prev").onclick = () => { state.weekEnd = addDays(state.weekEnd, -7); renderHistory(); };
$("#week-next").onclick = () => {
  state.weekEnd = addDays(state.weekEnd, 7) > today() ? today() : addDays(state.weekEnd, 7);
  renderHistory();
};
function stepMonth(n) {
  const [y, m] = state.month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  state.month = today(d).slice(0, 7);
  renderHistory();
}
$("#month-prev").onclick = () => stepMonth(-1);
$("#month-next").onclick = () => stepMonth(1);

// ---------- settings ----------

async function renderSettings() {
  $("#api-key").value = await db.getSetting("apiKey", "");
  for (const k of NUTRIENTS) $(`#goal-${k}`).value = state.goals[k];
  const rem = await db.getSetting("reminders", { enabled: false, items: [] });
  $("#reminders-on").checked = rem.enabled;
  $("#reminder-list").innerHTML = rem.items.map((r) => `<div class="reminder-row" data-id="${r.id}">
      <select data-field="meal">${reminders.MEALS.map((m) => `<option value="${m}"${m === r.meal ? " selected" : ""}>${MEAL_LABEL[m]}</option>`).join("")}</select>
      <span>by</span>
      <input type="time" data-field="time" value="${r.time}">
      <button class="icon-btn" data-del-rem="${r.id}" aria-label="Remove reminder">✕</button>
    </div>`).join("") || `<p class="hint">No reminders yet.</p>`;

  $$(".reminder-row [data-field]").forEach((inp) => (inp.onchange = async () => {
    const cur = await db.getSetting("reminders", { enabled: false, items: [] });
    const item = cur.items.find((x) => x.id === inp.closest(".reminder-row").dataset.id);
    item[inp.dataset.field] = inp.value;
    await db.setSetting("reminders", cur);
  }));
  $$("[data-del-rem]").forEach((b) => (b.onclick = async () => {
    const cur = await db.getSetting("reminders", { enabled: false, items: [] });
    cur.items = cur.items.filter((x) => x.id !== b.dataset.delRem);
    await db.setSetting("reminders", cur);
    renderSettings();
  }));
}

$("#api-key").onchange = (e) => db.setSetting("apiKey", e.target.value.trim());

for (const k of NUTRIENTS) {
  $(`#goal-${k}`).onchange = async (e) => {
    state.goals = { ...state.goals, [k]: Math.max(0, Number(e.target.value) || 0) };
    await db.setSetting("goals", state.goals);
  };
}

$("#reminders-on").onchange = async (e) => {
  const cur = await db.getSetting("reminders", { enabled: false, items: [] });
  cur.enabled = e.target.checked;
  if (cur.enabled && !cur.items.length) {
    cur.items = [
      { id: db.uid(), meal: "breakfast", time: "10:00" },
      { id: db.uid(), meal: "lunch", time: "14:00" },
      { id: db.uid(), meal: "dinner", time: "20:00" },
    ];
  }
  await db.setSetting("reminders", cur);
  if (cur.enabled) {
    const background = await reminders.enableBackground();
    $("#reminder-note").textContent = background
      ? "You'll get a notification even when the app is closed (your phone decides the exact timing)."
      : "Reminders show while Food Log is open. For alarms when it's closed, tap “Add to calendar”.";
  }
  renderSettings();
};

$("#add-reminder").onclick = async () => {
  const cur = await db.getSetting("reminders", { enabled: true, items: [] });
  cur.items.push({ id: db.uid(), meal: "snack", time: "16:00" });
  await db.setSetting("reminders", cur);
  renderSettings();
};

$("#reminder-ics").onclick = async () => {
  const cur = await db.getSetting("reminders", { enabled: false, items: [] });
  if (!cur.items.length) return toast("Add a reminder first.");
  download("food-log-reminders.ics", reminders.calendarFile(cur.items), "text/calendar");
  toast("Open the file to add daily alarms to your calendar.");
};

$("#export-json").onclick = async () => {
  const data = {
    app: "food-log",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: await db.getAll("entries"),
    favorites: await db.getAll("favorites"),
    goals: state.goals,
    reminders: await db.getSetting("reminders", { enabled: false, items: [] }),
  };
  download(`food-log-backup-${today()}.json`, JSON.stringify(data, null, 2), "application/json");
  await db.setSetting("lastExport", today());
};

$("#export-csv").onclick = async () => {
  const entries = (await db.getAll("entries")).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["date", "time", "meal", "meal_name", "item", "portion", "servings", "grams", "calories", "protein_g", "carbs_g", "fat_g"]];
  for (const e of entries) {
    for (const item of e.items) {
      const s = scaled(item);
      rows.push([e.date, e.time, e.meal, e.name, item.name, item.portion, item.factor, r0(s.grams), r0(s.calories), r0(s.protein), r0(s.carbs), r0(s.fat)]);
    }
  }
  download(`food-log-${today()}.csv`, rows.map((r) => r.map(q).join(",")).join("\n"), "text/csv");
};

$("#import-json").onclick = () => $("#import-file").click();
$("#import-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "food-log") throw new Error();
    for (const x of data.entries || []) await db.put("entries", x);
    for (const x of data.favorites || []) await db.put("favorites", x);
    if (data.goals) { state.goals = data.goals; await db.setSetting("goals", data.goals); }
    if (data.reminders) await db.setSetting("reminders", data.reminders);
    toast(`Restored ${data.entries?.length || 0} entries`);
    renderSettings();
  } catch {
    toast("That doesn't look like a Food Log backup file.");
  }
};

$("#wipe").onclick = async () => {
  if (!confirm("Delete every meal, favorite and setting on this phone? Export a backup first if you might want them.")) return;
  await Promise.all(["entries", "favorites", "kv"].map((s) => db.clear(s)));
  state.goals = DEFAULT_GOALS;
  toast("All data deleted");
  renderSettings();
};

// ---------- reminders while the app is open ----------

async function checkReminders() {
  const due = await reminders.dueReminders();
  const banner = $("#banner");
  if (!due.length) return;
  const meals = [...new Set(due.map((r) => r.meal))];
  banner.innerHTML = `<span>You haven't logged ${meals.join(" or ")} yet.</span><button class="link">Log now</button><button class="icon-btn" aria-label="Dismiss">✕</button>`;
  banner.hidden = false;
  const [logBtn, closeBtn] = banner.querySelectorAll("button");
  logBtn.onclick = () => { banner.hidden = true; show("log"); };
  closeBtn.onclick = () => (banner.hidden = true);
  if (document.visibilityState === "hidden") for (const r of due) await reminders.notify(r);
  await reminders.markFired(due);
}

// ---------- startup ----------

function refresh() {
  if (state.view === "today") renderToday();
  if (state.view === "log") renderLog();
  if (state.view === "history") renderHistory();
}

$$(".tabbar button").find((b) => b.dataset.view === "settings").addEventListener("click", renderSettings);

async function init() {
  state.goals = { ...DEFAULT_GOALS, ...(await db.getSetting("goals", {})) };
  const view = new URLSearchParams(location.search).get("view");
  show(VIEW_TITLE[view] ? view : "today");
  if (view === "settings") renderSettings();
  if (!(await db.getSetting("apiKey", ""))) {
    const banner = $("#banner");
    banner.innerHTML = `<span>Add your Claude API key to start estimating meals.</span><button class="link">Settings</button>`;
    banner.hidden = false;
    banner.querySelector("button").onclick = () => { banner.hidden = true; show("settings"); renderSettings(); };
  }
  checkReminders();
  setInterval(checkReminders, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (state.day !== today() && state.view === "today") state.day = today();
      refresh();
    }
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
}

init();
