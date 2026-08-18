import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, CheckCircle2, CircleDot } from "lucide-react";
import { useState } from "react";

import { LineTrend, chartColors, toChartRows } from "@/components/charts";
import { EmptyState, Panel, PageHeader, RiskBadge, StatCard, StatusBadge } from "@/components/kit";
import { compact, pct, relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live-store";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — CloudOps AI" },
      {
        name: "description",
        content:
          "Explainable workload forecasts, confidence scores, anomaly detections and the reasoning behind every scaling recommendation.",
      },
      { property: "og:title", content: "AI Insights — CloudOps AI" },
      {
        property: "og:description",
        content: "Five-minute workload forecasts with confidence, risk level and plain-language reasoning.",
      },
    ],
  }),
  component: InsightsPage,
});

const stages = [
  { key: "collect", label: "Collect", text: "Telemetry ingested from the monitoring agent" },
  { key: "analyze", label: "Analyze", text: "Moving averages and trend slopes computed" },
  { key: "detect", label: "Detect", text: "Rate-of-change anomaly rules evaluated" },
  { key: "predict", label: "Predict", text: "Workload forecast for the next horizon" },
  { key: "decide", label: "Decide", text: "Policy, cooldowns and bounds applied" },
  { key: "scale", label: "Scale", text: "Capacity adjusted and event recorded" },
] as const;

function InsightsPage() {
  const { resources, loading, tickCount } = useLive();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(5);

  if (loading) return <EmptyState title="Warming up the prediction engine…" />;
  if (resources.length === 0) return <EmptyState title="No resources to analyse" />;

  const selected = resources.find((r) => r.resource.id === selectedId) ?? resources[0]!;
  const p = selected.prediction;
  const anomalies = resources.flatMap((r) => r.anomalies);
  const activeStage = stages[tickCount % stages.length]!;

  // Forecast overlay: actual history plus projected value at the horizon.
  const history = toChartRows(selected.series.slice(-40), (m) => ({ actual: m.requests }));
  const forecast = [
    ...history.map((row) => ({ ...row, forecast: undefined as number | undefined })),
    { t: `+${horizon}m`, actual: undefined as unknown as number, forecast: p.predicted_load },
  ];
  const bridged = forecast.map((row, i) =>
    i === forecast.length - 2 ? { ...row, forecast: (row as { actual?: number }).actual } : row,
  );

  return (
    <>
      <PageHeader
        title="AI Insights"
        description="Every prediction shows the numbers that produced it — no black boxes."
        actions={
          <div className="flex items-center gap-2">
            {[5, 10, 15].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  horizon === h
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {h} min
              </button>
            ))}
          </div>
        }
      />

      <Panel title="Decision pipeline" description="The loop runs continuously against the live stream">
        <ol className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {stages.map((s) => {
            const active = s.key === activeStage.key;
            return (
              <li
                key={s.key}
                className={`rounded-lg border p-3 transition-colors ${
                  active ? "border-primary/50 bg-primary/10" : "border-border bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {active ? (
                    <CircleDot className="size-4 text-primary" />
                  ) : (
                    <CheckCircle2 className="size-4 text-healthy" />
                  )}
                  {s.label}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="flex flex-wrap gap-2">
        {resources.map((r) => (
          <button key={r.resource.id} onClick={() => setSelectedId(r.resource.id)}>
            <StatusBadge status={r.resource.id === selected.resource.id ? "info" : r.status} label={r.resource.name} />
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Predicted load" value={compact(p.predicted_load)} unit="req/min" hint={`in ${horizon} minutes`} />
        <StatCard label="Confidence" value={(p.confidence * 100).toFixed(0)} unit="%" tone={p.confidence > 0.8 ? "healthy" : "warning"} />
        <StatCard label="Growth rate" value={p.growth_rate} unit="%" trend={p.growth_rate} hint={p.trend} />
        <StatCard label="Recommended capacity" value={p.recommended_instances} unit="instances" hint={`now ${selected.resource.instance_count}`} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Workload forecast" description="Actual traffic with the projected value at the selected horizon">
          <LineTrend
            data={bridged as Record<string, number | string>[]}
            dashedKeys={["forecast"]}
            series={[
              { key: "actual", label: "Actual", color: chartColors.requests },
              { key: "forecast", label: "Forecast", color: chartColors.latency },
            ]}
            height={260}
          />
        </Panel>

        <Panel title="Why this prediction" description={`${selected.resource.name} · risk assessment`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-primary" />
              <RiskBadge risk={p.risk_level} />
              <span className="num text-xs text-muted-foreground">score {p.risk_score.toFixed(2)}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{p.reason}</p>
            <dl className="space-y-2 border-t border-border pt-3 text-sm">
              <Fact label="Moving average" value={`${compact(p.moving_average)} req/min`} />
              <Fact label="Current CPU" value={pct(selected.latest.cpu)} />
              <Fact label="CPU target" value={pct(selected.resource.target_cpu, 0)} />
              <Fact label="Trend" value={p.trend} />
              <Fact label="Capacity bounds" value={`${selected.resource.min_instances}–${selected.resource.max_instances}`} />
              <Fact label="Decision" value={selected.decision.action.replace("_", " ")} />
            </dl>
            <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
              {selected.decision.reason}
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Anomaly detections" description="Explainable rules over the rolling metric window">
        {anomalies.length === 0 ? (
          <EmptyState title="No anomalies right now" description="Run a scenario from the Simulation page to see detection in action." />
        ) : (
          <ul className="space-y-3">
            {anomalies.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  <StatusBadge
                    status={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info"}
                    label={`${a.metric} · ${a.severity}`}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                <p className="mt-1.5 text-xs text-info">→ {a.recommended_action}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(a.detected_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num capitalize text-foreground">{value}</dd>
    </div>
  );
}
