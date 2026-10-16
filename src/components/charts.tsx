import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { COLOURS, COLOUR_INFO, type FoodColour, r0 } from '@/lib/nutrition';
import { useTheme } from '@/lib/theme';

/** Calorie ring: fills toward the goal; turns red past it. */
export function Ring({ value, goal, size = 132 }: { value: number; goal: number; size?: number }) {
  const t = useTheme();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal;
  const left = Math.round(goal - value);
  return (
    <View accessible accessibilityLabel={`${r0(value)} of ${goal} calories. ${over ? `${-left} over` : `${left} left`}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surface2} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? t.over : t.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${pct * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <SvgText x={size / 2} y={size / 2 + 2} fontSize={26} fontWeight="700" fill={t.text} textAnchor="middle">
          {r0(value)}
        </SvgText>
        <SvgText x={size / 2} y={size / 2 + 20} fontSize={11} fill={t.text2} textAnchor="middle">
          {over ? `${-left} over` : `${left} left`}
        </SvgText>
      </Svg>
    </View>
  );
}

export function ProgressBar({ label, value, goal, unit, color }: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const t = useTheme();
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <View accessible accessibilityLabel={`${label}: ${r0(value)} of ${goal} ${unit}`}>
      <View style={s.barHead}>
        <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
        <Text style={{ color: t.text2, fontSize: 13 }}>
          {r0(value).toLocaleString()} / {goal.toLocaleString()} {unit}
        </Text>
      </View>
      <View style={[s.track, { backgroundColor: t.surface2 }]}>
        <View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Today's calories split by food colour, as one stacked bar with a labelled legend. */
export function ColourBar({ split }: { split: Record<FoodColour, number> }) {
  const t = useTheme();
  const total = COLOURS.reduce((sum, c) => sum + split[c], 0);
  if (total <= 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <View style={[s.stack, { backgroundColor: t.surface2 }]}>
        {COLOURS.filter((c) => split[c] > 0).map((c) => (
          <View
            key={c}
            style={{ flex: split[c], backgroundColor: t.food[c], borderRightWidth: 2, borderRightColor: t.surface }}
          />
        ))}
      </View>
      <View style={s.legend}>
        {COLOURS.map((c) => (
          <View key={c} style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: t.food[c] }]} />
            <Text style={{ color: t.text2, fontSize: 12 }}>
              {COLOUR_INFO[c].label} {Math.round((split[c] / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ColourDot({ colour }: { colour: FoodColour | null }) {
  const t = useTheme();
  if (!colour) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${COLOUR_INFO[colour].label} food`}
      style={[s.dot, { backgroundColor: t.food[colour] }]}
    />
  );
}

type Bar = { key: string; label: string; title: string; value: number };

/** Bar chart with a dashed goal line. Tap a bar to read its value. */
export function BarChart({ bars, goal, unit, width }: { bars: Bar[]; goal: number; unit: string; width: number }) {
  const t = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const H = 180, padL = 36, padR = 8, padT = 14, padB = 22;
  const plotW = width - padL - padR, plotH = H - padT - padB;
  const max = Math.max(goal * 1.15, ...bars.map((b) => b.value), 10);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const slot = plotW / bars.length;
  const barW = Math.min(28, slot - 8);
  const ticks = niceTicks(max);
  const sel = bars.find((b) => b.key === selected);

  return (
    <View>
      <Svg width={width} height={H}>
        {ticks.map((tick) => (
          <G key={tick}>
            <Line x1={padL} x2={width - padR} y1={y(tick)} y2={y(tick)} stroke={t.border} strokeWidth={1} />
            <SvgText x={padL - 6} y={y(tick) + 3} fontSize={10} fill={t.text2} textAnchor="end">
              {tick >= 1000 ? `${tick / 1000}k` : tick}
            </SvgText>
          </G>
        ))}
        <Line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke={t.muted} strokeWidth={1} />
        {bars.map((b, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const top = y(b.value);
          const base = padT + plotH;
          const h = base - top;
          const r = Math.min(4, h / 2);
          const path = h > 0
            ? `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`
            : '';
          return (
            <G key={b.key}>
              {path ? <Path d={path} fill={t.accent} opacity={selected && selected !== b.key ? 0.55 : 1} /> : null}
              <SvgText x={x + barW / 2} y={H - 6} fontSize={10} fill={t.text2} textAnchor="middle">{b.label}</SvgText>
            </G>
          );
        })}
        {goal > 0 && (
          <G>
            <Line x1={padL} x2={width - padR} y1={y(goal)} y2={y(goal)} stroke={t.text2} strokeWidth={1.5} strokeDasharray="4 4" />
            <SvgText x={width - padR} y={y(goal) - 4} fontSize={10} fill={t.text2} textAnchor="end">
              Goal {goal.toLocaleString()}
            </SvgText>
          </G>
        )}
      </Svg>
      {/* Hit targets laid over the chart: bigger than the bars, one per day. */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', left: padL, right: padR }]}>
        {bars.map((b) => (
          <Pressable
            key={b.key}
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel={`${b.title}: ${r0(b.value)} ${unit}`}
            onPress={() => setSelected(selected === b.key ? null : b.key)}
          />
        ))}
      </View>
      <Text style={{ color: t.text, textAlign: 'center', fontSize: 14, minHeight: 20 }}>
        {sel ? `${sel.title}: ${r0(sel.value).toLocaleString()} ${unit}` : 'Tap a bar for details'}
      </Text>
    </View>
  );
}

/** Simple line chart for weight over time. */
export function LineChart({ points, width, unit }: { points: { date: string; value: number }[]; width: number; unit: string }) {
  const t = useTheme();
  const H = 160, padL = 40, padR = 12, padT = 12, padB = 22;
  if (points.length < 2) return null;
  const vals = points.map((p) => p.value);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = new Date(points[0].date).getTime(), t1 = new Date(points[points.length - 1].date).getTime();
  const x = (d: string) => padL + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - padT - padB);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const fmt = (s: string) => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <Svg width={width} height={H} accessibilityLabel={`Weight from ${vals[0].toFixed(1)} to ${vals[vals.length - 1].toFixed(1)} ${unit}`}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <G key={v}>
          <Line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={t.border} />
          <SvgText x={padL - 6} y={y(v) + 3} fontSize={10} fill={t.text2} textAnchor="end">{v.toFixed(0)}</SvgText>
        </G>
      ))}
      <Path d={d} stroke={t.accent} strokeWidth={2} fill="none" />
      {points.map((p) => (
        <Circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={4} fill={t.accent} stroke={t.surface} strokeWidth={2} />
      ))}
      <SvgText x={padL} y={H - 6} fontSize={10} fill={t.text2}>{fmt(points[0].date)}</SvgText>
      <SvgText x={width - padR} y={H - 6} fontSize={10} fill={t.text2} textAnchor="end">
        {fmt(points[points.length - 1].date)}
      </SvgText>
    </Svg>
  );
}

function niceTicks(max: number) {
  const step = [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 2500, 5000].find((st) => max / st <= 5) ?? 10000;
  const out: number[] = [];
  for (let v = step; v < max; v += step) out.push(v);
  return out;
}

const s = StyleSheet.create({
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4 },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  legend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
