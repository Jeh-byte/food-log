// Hand-rolled SVG for the calorie ring and the weekly bar chart.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Progress ring. `value`/`goal` in kcal. */
export function ring(value, goal) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal;
  const left = Math.round(goal - value);
  return `
  <svg viewBox="0 0 128 128" class="ring" role="img" aria-label="${Math.round(value)} of ${goal} calories eaten">
    <circle cx="64" cy="64" r="${r}" class="ring-track"/>
    <circle cx="64" cy="64" r="${r}" class="ring-fill${over ? " over" : ""}"
      stroke-dasharray="${(pct * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 64 64)"/>
    <text x="64" y="60" class="ring-value">${Math.round(value)}</text>
    <text x="64" y="78" class="ring-label">${over ? `${-left} over` : `${left} left`}</text>
  </svg>`;
}

/**
 * Weekly bar chart.
 * @param {{label: string, title: string, value: number}[]} days  seven days, oldest first
 * @param {number} goal  kcal goal, drawn as a dashed reference line
 */
export function weekBars(days, goal) {
  const W = 320, H = 180, padL = 36, padR = 8, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(goal * 1.15, ...days.map((d) => d.value), 100);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const slot = plotW / days.length;
  const barW = Math.min(28, slot - 8);

  const ticks = niceTicks(max);
  const grid = ticks
    .map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="grid"/>
      <text x="${padL - 6}" y="${y(t) + 3}" class="axis" text-anchor="end">${t >= 1000 ? `${t / 1000}k` : t}</text>`)
    .join("");

  const bars = days
    .map((d, i) => {
      const x = padL + i * slot + (slot - barW) / 2;
      const h = Math.max(0, padT + plotH - y(d.value));
      const r = Math.min(4, h / 2);
      // Rounded top, square bottom anchored on the baseline.
      const top = y(d.value);
      const base = padT + plotH;
      const path = h > 0
        ? `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`
        : "";
      return `<g class="bar-group" tabindex="0" data-tip="${esc(d.title)}: ${Math.round(d.value)} kcal">
        <rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" class="hit"/>
        ${path ? `<path d="${path}" class="bar"/>` : ""}
        <text x="${x + barW / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.label)}</text>
      </g>`;
    })
    .join("");

  const goalLine = goal > 0
    ? `<line x1="${padL}" x2="${W - padR}" y1="${y(goal)}" y2="${y(goal)}" class="goal-line"/>
       <text x="${W - padR}" y="${y(goal) - 4}" class="axis goal-text" text-anchor="end">Goal ${goal}</text>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" class="week-chart" role="img" aria-label="Calories per day this week">
    ${grid}
    <line x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}" class="baseline"/>
    ${bars}${goalLine}
  </svg>`;
}

function niceTicks(max) {
  const step = [250, 500, 1000, 2000].find((s) => max / s <= 5) || 2500;
  const out = [];
  for (let t = step; t < max; t += step) out.push(t);
  return out;
}
