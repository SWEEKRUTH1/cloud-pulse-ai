import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Coins,
  Cpu,
  Gauge,
  Server,
  Timer,
} from "lucide-react";

import { AreaTrend, Sparkline, chartColors, toChartRows } from "@/components/charts";
import { EmptyState, Panel, PageHeader, RiskBadge, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { averageCpu, costForResource, summariseCosts } from "@/lib/cost-engine";
import { compact, inr, ms, pct, relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live-store";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Operations Overview — CloudOps AI" },
      {
        name: "description",
        content:
          "Real-time health, workload forecasts, anomalies and cost posture across every monitored cloud environment.",
      },
      { property: "og:title", content: "Operations Overview — CloudOps AI" },
      {
        property: "og:description",
        content: "Live cloud telemetry with predictive scaling decisions and cost analytics.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { resources, loading, paused, autoScaling, environments, environmentId } = useLive();

  if (loading) return <EmptyState title="Connecting to telemetry stream…" />;
  if (resources.length === 0)
    return <EmptyState title="No resources in this environment" description="Add a resource from the Infrastructure page." />;

  const avg = (fn: (n: (typeof resources)[number]) => number) =>
    resources.reduce((a, r) => a + fn(r), 0) / resources.length;

  const totalRequests = resources.reduce((a, r) => a + r.latest.requests, 0);
  const totalInstances = resources.reduce((a, r) => a + r.resource.instance_count, 0);
  const anomalies = resources.flatMap((r) => r.anomalies);
  const criticalCount = resources.filter((r) => r.status === "critical").length;
  const warningCount = resources.filter((r) => r.status === "warning").length;
  const highRisk = resources.filter(
    (r) => r.prediction.risk_level === "HIGH" || r.prediction.risk_level === "CRITICAL",
  );
  const pendingActions = resources.filter((r) => r.decision.action !== "hold");

  const costs = resources.map((r) => costForResource(r.resource, averageCpu(r.series)));
  const costSummary = summariseCosts(costs);

  // Aggregate cluster series for the hero chart.
  const len = Math.min(...resources.map((r) => r.series.length));
  const clusterRows = Array.from({ length: len }, (_, i) => {
    const idx = resources.map((r) => r.series[r.series.length - len + i]!);
    return {
      timestamp: idx[0]!.timestamp,
      cpu: Number((idx.reduce((a, p) => a + p.cpu, 0) / idx.length).toFixed(1)),
      memory: Number((idx.reduce((a, p) => a + p.memory, 0) / idx.length).toFixed(1)),
    };
  });
  const chartData = toChartRows(clusterRows, (p) => ({ cpu: p.cpu, memory: p.memory }));

  const envName = environments.find((e) => e.id === environmentId)?.name ?? "All environments";

  return (
    <>
      <PageHeader
        title="Operations Overview"
        description={`${envName} · ${resources.length} monitored resources · ${totalInstances} running instances`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/insights">
                <BrainCircuit className="size-4" /> AI insights
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/simulation">
                <Activity className="size-4" /> Run simulation
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average CPU"
          value={avg((r) => r.latest.cpu).toFixed(1)}
          unit="%"
          hint={`target ${resources[0]!.resource.target_cpu}%`}
          tone={avg((r) => r.latest.cpu) > 80 ? "critical" : "healthy"}
          icon={<Cpu className="size-4" />}
        />
        <StatCard
          label="Traffic"
          value={compact(totalRequests)}
          unit="req/min"
          hint={`${resources.length} resources`}
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="p95 latency"
          value={Math.round(avg((r) => r.latest.latency))}
          unit="ms"
          tone={avg((r) => r.latest.latency) > 300 ? "warning" : "healthy"}
          icon={<Timer className="size-4" />}
        />
        <StatCard
          label="Projected monthly cost"
          value={inr(costSummary.monthly)}
          hint={`${inr(costSummary.saving)} identified savings`}
          tone="info"
          icon={<Coins className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Cluster utilisation"
          description={paused ? "Stream paused" : "Rolling live window, updated every few seconds"}
        >
          <AreaTrend
            data={chartData}
            suffix="%"
            domain={[0, 100]}
            reference={resources[0]!.resource.target_cpu}
            series={[
              { key: "cpu", label: "CPU", color: chartColors.cpu },
              { key: "memory", label: "Memory", color: chartColors.memory },
            ]}
          />
        </Panel>

        <Panel title="Fleet status" description="Health distribution and autonomous posture">
          <div className="space-y-3">
            <Row label="Healthy" value={`${resources.length - warningCount - criticalCount}`} status="healthy" />
            <Row label="Warning" value={`${warningCount}`} status="warning" />
            <Row label="Critical" value={`${criticalCount}`} status="critical" />
            <div className="h-px bg-border" />
            <Row
              label="Autonomous scaling"
              value={autoScaling ? "Enabled" : "Manual"}
              status={autoScaling ? "healthy" : "offline"}
            />
            <Row
              label="Pending decisions"
              value={`${pendingActions.length}`}
              status={pendingActions.length > 0 ? "info" : "healthy"}
            />
            <Row
              label="Open anomalies"
              value={`${anomalies.length}`}
              status={anomalies.length > 0 ? "warning" : "healthy"}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="Predictive risk"
        description="Five-minute workload forecast per resource with recommended capacity"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/scaling">
              Scaling console <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Resource</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">CPU</th>
                <th className="pb-2 font-medium">Latency</th>
                <th className="pb-2 font-medium">Trend</th>
                <th className="pb-2 font-medium">Forecast</th>
                <th className="pb-2 font-medium">Risk</th>
                <th className="pb-2 font-medium">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.resource.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3">
                    <Link
                      to="/metrics"
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {r.resource.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.resource.resource_type} · {r.resource.region}
                    </p>
                  </td>
                  <td className="py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="num py-3">{pct(r.latest.cpu)}</td>
                  <td className="num py-3">{ms(r.latest.latency)}</td>
                  <td className="w-28 py-3">
                    <Sparkline values={r.series.slice(-30).map((p) => p.cpu)} height={32} />
                  </td>
                  <td className="num py-3">{compact(r.prediction.predicted_load)} req/min</td>
                  <td className="py-3">
                    <RiskBadge risk={r.prediction.risk_level} />
                  </td>
                  <td className="num py-3">
                    {r.resource.instance_count}
                    {r.prediction.recommended_instances !== r.resource.instance_count ? (
                      <span className="ml-1 text-xs text-info">
                        → {r.prediction.recommended_instances}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Live anomalies" description="Detected from rate-of-change rules on the rolling window">
          {anomalies.length === 0 ? (
            <EmptyState title="No anomalies detected" description="All monitored signals are inside expected bands." />
          ) : (
            <ul className="space-y-3">
              {anomalies.slice(0, 6).map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <StatusBadge
                      status={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info"}
                      label={a.severity}
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

        <Panel title="High-risk forecasts" description="Resources predicted to breach their target band">
          {highRisk.length === 0 ? (
            <EmptyState title="No elevated risk" description="Forecast utilisation stays within target for every resource." />
          ) : (
            <ul className="space-y-3">
              {highRisk.map((r) => (
                <li key={r.resource.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{r.resource.name}</p>
                    <RiskBadge risk={r.prediction.risk_level} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {r.prediction.reason}
                  </p>
                  <p className="num mt-1.5 text-[11px] text-muted-foreground">
                    confidence {(r.prediction.confidence * 100).toFixed(0)}% · trend {r.prediction.trend}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink to="/infrastructure" icon={<Server className="size-4" />} title="Infrastructure" text="Inventory, capacity bounds and per-resource controls." />
        <QuickLink to="/scaling" icon={<Gauge className="size-4" />} title="Auto-Scaling" text="Policies, cooldowns and autonomous decision log." />
        <QuickLink to="/alerts" icon={<AlertTriangle className="size-4" />} title="Alerts" text="Acknowledge and resolve incidents with an audit trail." />
        <QuickLink to="/cost" icon={<Coins className="size-4" />} title="Cost" text="Right-sizing recommendations and savings in INR." />
      </div>
    </>
  );
}

function Row({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "healthy" | "warning" | "critical" | "offline" | "info";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <StatusBadge status={status} label={value} />
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  text,
}: {
  to: "/infrastructure" | "/scaling" | "/alerts" | "/cost";
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link to={to} className="panel p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2 text-primary">{icon}
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{text}</p>
    </Link>
  );
}
