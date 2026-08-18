import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertOctagon, Flame, MemoryStick, Play, RotateCcw, Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AreaTrend, chartColors, toChartRows } from "@/components/charts";
import { EmptyState, Panel, PageHeader, RiskBadge, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { compact, ms, pct } from "@/lib/format";
import { useLive, type Scenario } from "@/lib/live-store";

export const Route = createFileRoute("/_authenticated/simulation")({
  head: () => ({
    meta: [
      { title: "Scenario Simulation — CloudOps AI" },
      {
        name: "description",
        content:
          "Inject traffic spikes, memory leaks, latency storms and outages, then watch detection, prediction and autonomous scaling respond live.",
      },
      { property: "og:title", content: "Scenario Simulation — CloudOps AI" },
      {
        property: "og:description",
        content: "Reproducible failure scenarios to demonstrate predictive auto-scaling end to end.",
      },
    ],
  }),
  component: SimulationPage,
});

const scenarios: {
  key: Scenario;
  label: string;
  text: string;
  icon: typeof Flame;
  tone: "healthy" | "warning" | "critical" | "info";
}[] = [
  { key: "normal", label: "Steady state", text: "Return every resource to its normal diurnal traffic pattern.", icon: Activity, tone: "healthy" },
  { key: "traffic_spike", label: "Traffic spike", text: "Flash sale burst — traffic climbs ~3.5x within a minute.", icon: Flame, tone: "warning" },
  { key: "memory_leak", label: "Memory leak", text: "Memory creeps upward continuously without release.", icon: MemoryStick, tone: "warning" },
  { key: "latency_storm", label: "Latency storm", text: "Downstream dependency slows down, errors climb.", icon: Timer, tone: "critical" },
  { key: "outage", label: "Instance outage", text: "Traffic collapses and error rate spikes — availability incident.", icon: AlertOctagon, tone: "critical" },
];

function SimulationPage() {
  const { resources, loading, scenario, runScenario, paused, setPaused, autoScaling, setAutoScaling } =
    useLive();
  const { canWrite } = useAuth();
  const [targetId, setTargetId] = useState<string | null>(null);

  if (loading) return <EmptyState title="Preparing simulation environment…" />;
  if (resources.length === 0) return <EmptyState title="No resources to simulate against" />;

  const focus = resources.find((r) => r.resource.id === targetId) ?? resources[0]!;
  const rows = toChartRows(focus.series.slice(-50), (p) => ({
    cpu: p.cpu,
    memory: p.memory,
  }));
  const trafficRows = toChartRows(focus.series.slice(-50), (p) => ({ requests: p.requests }));

  const launch = (s: Scenario) => {
    runScenario(s, targetId ?? undefined);
    setPaused(false);
    toast.success(
      s === "normal"
        ? "Returned to steady state"
        : `${scenarios.find((x) => x.key === s)?.label} injected`,
    );
  };

  return (
    <>
      <PageHeader
        title="Scenario Simulation"
        description="Inject a realistic failure mode and watch the full Collect → Analyze → Detect → Predict → Decide → Scale loop respond."
        actions={
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5">
            <Label className="text-xs text-muted-foreground">Autonomous scaling</Label>
            <Switch checked={autoScaling} onCheckedChange={setAutoScaling} disabled={!canWrite} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active scenario" value={scenarios.find((s) => s.key === scenario)?.label ?? "Steady state"} tone={scenario === "normal" ? "healthy" : "warning"} />
        <StatCard label="Stream" value={paused ? "Paused" : "Live"} tone={paused ? "warning" : "healthy"} />
        <StatCard label="Focus CPU" value={pct(focus.latest.cpu)} tone={focus.latest.cpu > 85 ? "critical" : "healthy"} />
        <StatCard label="Focus latency" value={ms(focus.latest.latency)} tone={focus.latest.latency > 400 ? "critical" : "healthy"} />
      </div>

      <Panel title="Scenario library" description="Applied to the selected target resource, or the whole environment when none is chosen">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Target:</span>
          <button onClick={() => setTargetId(null)}>
            <StatusBadge status={targetId ? "offline" : "info"} label="Entire environment" />
          </button>
          {resources.map((r) => (
            <button key={r.resource.id} onClick={() => setTargetId(r.resource.id)}>
              <StatusBadge status={targetId === r.resource.id ? "info" : r.status} label={r.resource.name} />
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((s) => (
            <div
              key={s.key}
              className={`rounded-lg border p-4 ${
                scenario === s.key ? "border-primary/50 bg-primary/10" : "border-border bg-surface-2"
              }`}
            >
              <div className="flex items-center gap-2">
                <s.icon className="size-4 text-primary" />
                <p className="text-sm font-medium text-foreground">{s.label}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
              <Button
                size="sm"
                variant={scenario === s.key ? "default" : "outline"}
                className="mt-3 w-full"
                disabled={!canWrite}
                onClick={() => launch(s.key)}
              >
                {s.key === "normal" ? <RotateCcw className="size-3.5" /> : <Play className="size-3.5" />}
                {s.key === "normal" ? "Reset" : "Inject"}
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${focus.resource.name} — utilisation`} description="Live response to the injected scenario">
          <AreaTrend
            data={rows}
            suffix="%"
            domain={[0, 100]}
            reference={focus.resource.target_cpu}
            series={[
              { key: "cpu", label: "CPU", color: chartColors.cpu },
              { key: "memory", label: "Memory", color: chartColors.memory },
            ]}
          />
        </Panel>
        <Panel title={`${focus.resource.name} — traffic`} description={`Forecast ${compact(focus.prediction.predicted_load)} req/min`}>
          <AreaTrend
            data={trafficRows}
            series={[{ key: "requests", label: "Requests", color: chartColors.requests }]}
          />
        </Panel>
      </div>

      <Panel title="Engine response" description="What the detection, prediction and decision layers concluded">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detection</p>
            {focus.anomalies.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No anomalies on this resource.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {focus.anomalies.map((a) => (
                  <li key={a.id} className="text-xs text-foreground">
                    <span className="font-medium">{a.title}</span>
                    <p className="text-muted-foreground">{a.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prediction</p>
              <RiskBadge risk={focus.prediction.risk_level} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{focus.prediction.reason}</p>
            <p className="num mt-2 text-[11px] text-muted-foreground">
              confidence {(focus.prediction.confidence * 100).toFixed(0)}% · trend {focus.prediction.trend}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision</p>
              <StatusBadge
                status={focus.decision.action === "hold" ? "healthy" : "warning"}
                label={focus.decision.action.replace("_", " ")}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{focus.decision.reason}</p>
            <p className="num mt-2 text-[11px] text-muted-foreground">
              {focus.decision.previous_instances} → {focus.decision.new_instances} instances
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
