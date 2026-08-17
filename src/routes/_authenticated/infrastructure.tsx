import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Server } from "lucide-react";

import { Sparkline, chartColors } from "@/components/charts";
import { EmptyState, Meter, Panel, PageHeader, RiskBadge, StatCard, StatusBadge } from "@/components/kit";
import { Switch } from "@/components/ui/switch";
import { costForResource, averageCpu } from "@/lib/cost-engine";
import { compact, inr, ms, pct } from "@/lib/format";
import { useLive } from "@/lib/live-store";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/infrastructure")({
  head: () => ({
    meta: [
      { title: "Infrastructure Inventory — CloudOps AI" },
      {
        name: "description",
        content:
          "Every monitored compute, container, database and load balancer resource with live health, capacity bounds and cost.",
      },
      { property: "og:title", content: "Infrastructure Inventory — CloudOps AI" },
      {
        property: "og:description",
        content: "Live inventory of cloud resources with monitoring toggles and cost per resource.",
      },
    ],
  }),
  component: InfrastructurePage,
});

function InfrastructurePage() {
  const { resources, loading, environments, toggleResource } = useLive();
  const { canWrite } = useAuth();

  if (loading) return <EmptyState title="Loading inventory…" />;

  const totalInstances = resources.reduce((a, r) => a + r.resource.instance_count, 0);
  const costs = resources.map((r) => costForResource(r.resource, averageCpu(r.series)));
  const monthly = costs.reduce((a, c) => a + c.monthly, 0);

  return (
    <>
      <PageHeader
        title="Infrastructure"
        description="Monitored resources, capacity bounds and live health across the selected environment."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Resources" value={resources.length} icon={<Server className="size-4" />} />
        <StatCard label="Running instances" value={totalInstances} icon={<Cpu className="size-4" />} />
        <StatCard label="Environments" value={environments.length} />
        <StatCard label="Monthly cost" value={inr(monthly)} tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {resources.map((r) => {
          const cost = costForResource(r.resource, averageCpu(r.series));
          return (
            <Panel
              key={r.resource.id}
              title={r.resource.name}
              description={`${r.resource.resource_type} · ${r.resource.provider.toUpperCase()} · ${r.resource.region}`}
              actions={
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <Switch
                    checked={r.resource.enabled}
                    disabled={!canWrite}
                    onCheckedChange={(v) => void toggleResource(r.resource.id, v)}
                    aria-label="Monitoring enabled"
                  />
                </div>
              }
            >
              <div className="space-y-4">
                <div className="h-12">
                  <Sparkline values={r.series.slice(-40).map((p) => p.cpu)} color={chartColors.cpu} height={48} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Meter label="CPU" value={r.latest.cpu} target={r.resource.target_cpu} />
                  <Meter label="Memory" value={r.latest.memory} target={r.resource.target_memory} />
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Cell label="Instances" value={`${r.resource.instance_count}`} />
                  <Cell label="Bounds" value={`${r.resource.min_instances}–${r.resource.max_instances}`} />
                  <Cell label="Traffic" value={`${compact(r.latest.requests)}/min`} />
                  <Cell label="Latency" value={ms(r.latest.latency)} />
                  <Cell label="Errors" value={pct(r.latest.error_rate, 2)} />
                  <Cell label="Hourly rate" value={inr(r.resource.hourly_rate)} />
                  <Cell label="Monthly" value={inr(cost.monthly)} />
                  <Cell label="Verdict" value={cost.verdict} />
                </dl>
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Forecast {compact(r.prediction.predicted_load)} req/min · recommended{" "}
                    <span className="num text-foreground">{r.prediction.recommended_instances}</span> instances
                  </p>
                  <RiskBadge risk={r.prediction.risk_level} />
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="num text-sm capitalize text-foreground">{value}</dd>
    </div>
  );
}
