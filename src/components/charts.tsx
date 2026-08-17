import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { clockTime } from "@/lib/format";

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function TipBox({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-panel">
      {label ? <p className="mb-1 font-medium text-popover-foreground">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}</span>
          <span className="num text-popover-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}
            {suffix ?? ""}
          </span>
        </p>
      ))}
    </div>
  );
}

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export function AreaTrend({
  data,
  series,
  height = 220,
  suffix,
  reference,
  domain,
}: {
  data: Record<string, number | string>[];
  series: SeriesDef[];
  height?: number;
  suffix?: string;
  reference?: number;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" {...axis} minTickGap={28} />
        <YAxis {...axis} domain={domain ?? ["auto", "auto"]} width={44} />
        <Tooltip content={<TipBox suffix={suffix} />} />
        {reference != null ? (
          <ReferenceLine
            y={reference}
            stroke="var(--color-warning)"
            strokeDasharray="4 4"
            label={{ value: "target", fill: "var(--color-warning)", fontSize: 10, position: "right" }}
          />
        ) : null}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
            isAnimationActive={false}
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({
  data,
  series,
  height = 220,
  suffix,
  dashedKeys = [],
}: {
  data: Record<string, number | string>[];
  series: SeriesDef[];
  height?: number;
  suffix?: string;
  dashedKeys?: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" {...axis} minTickGap={28} />
        <YAxis {...axis} width={44} />
        <Tooltip content={<TipBox suffix={suffix} />} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={dashedKeys.includes(s.key) ? "5 4" : undefined}
            isAnimationActive={false}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data,
  series,
  height = 220,
  suffix,
}: {
  data: Record<string, number | string>[];
  series: SeriesDef[];
  height?: number;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" {...axis} interval={0} angle={0} />
        <YAxis {...axis} width={52} />
        <Tooltip content={<TipBox suffix={suffix} />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({
  values,
  color = "var(--color-chart-1)",
  height = 40,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.6}
          fill={`url(#spark-${color.replace(/\W/g, "")})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const chartColors = {
  cpu: "var(--color-chart-1)",
  memory: "var(--color-chart-2)",
  requests: "var(--color-chart-5)",
  latency: "var(--color-chart-3)",
  errors: "var(--color-chart-4)",
};

export const toChartRows = <T extends { timestamp: string }>(
  points: T[],
  pick: (p: T) => Record<string, number>,
) => points.map((p) => ({ t: clockTime(p.timestamp), ...pick(p) }));
