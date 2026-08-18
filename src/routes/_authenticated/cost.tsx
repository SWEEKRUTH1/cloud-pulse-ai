import { createFileRoute } from "@tanstack/react-router";
import { Coins, Download, PiggyBank, TrendingDown } from "lucide-react";

import { BarSeries, chartColors } from "@/components/charts";
import { EmptyState, Panel, PageHeader, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { averageCpu, costForResource, summariseCosts } from "@/lib/cost-engine";
import { downloadCsv, inr, pct } from "@/lib/format";
import { useLive } from "@/lib/live-store";

export const Route = createFileRoute("/_authenticated/cost")({
  head: () => ({
    meta: [
      { title: "Cost Optimisation — CloudOps AI" },
      {
        name: "description",
        content:
          "Hourly, daily and monthly cloud spend per resource with right-sizing recommendations and quantified savings in INR.",
      },
      { property: "og:title", content: "Cost Optimisation — CloudOps AI" },
      {
        property: "og:description",
        content: "Utilisation-aware cost analytics with concrete right-sizing recommendations.",
      },
    ],
  }),
  component: CostPage,
});

const verdictTone = {
  optimised: "healthy",
  "over-provisioned": "warning",
  idle: "info",
  "under-provisioned": "critical",
} as const;

function CostPage() {
  const { resources, loading } = useLive();

  if (loading) return <EmptyState title="Calculating cost posture…" />;
  if (resources.length === 0) return <EmptyState title="No resources to price" />;

  const costs = resources.map((r) => costForResource(r.resource, averageCpu(r.series)));
  const summary = summariseCosts(costs);
  const chart = costs.map((c) => ({
    t: c.resource.name.split(" ")[0] ?? c.resource.name,
    current: Math.round(c.monthly),
    optimised: Math.round(c.optimisedMonthly),
  }));

  return (
    <>
      <PageHeader
        title="Cost Optimisation"
        description="Spend is derived from live instance counts and utilisation — all amounts in INR."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "cloudops-cost-report",
                costs.map((c) => ({
                  resource: c.resource.name,
                  type: c.resource.resource_type,
                  instances: c.resource.instance_count,
                  utilisation_pct: c.utilisation.toFixed(1),
                  hourly_inr: c.hourly.toFixed(2),
                  daily_inr: c.daily.toFixed(2),
                  monthly_inr: c.monthly.toFixed(2),
                  optimised_instances: c.optimisedInstances,
                  monthly_saving_inr: c.saving.toFixed(2),
                  verdict: c.verdict,
                })),
              )
            }
          >
            <Download className="size-4" /> Export report
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hourly spend" value={inr(summary.hourly)} icon={<Coins className="size-4" />} />
        <StatCard label="Daily spend" value={inr(summary.daily)} />
        <StatCard label="Projected monthly" value={inr(summary.monthly)} tone="info" />
        <StatCard
          label="Identified savings"
          value={inr(summary.saving)}
          hint={`${summary.savingPct.toFixed(1)}% of monthly spend`}
          tone="healthy"
          icon={<PiggyBank className="size-4" />}
        />
      </div>

      <Panel title="Current vs optimised monthly spend" description="Right-sizing each resource to its CPU target">
        <BarSeries
          data={chart}
          suffix=" ₹"
          series={[
            { key: "current", label: "Current", color: chartColors.requests },
            { key: "optimised", label: "Optimised", color: chartColors.memory },
          ]}
          height={260}
        />
      </Panel>

      <Panel title="Per-resource breakdown" description="Utilisation-driven recommendations with quantified impact">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Resource</th>
                <th className="pb-2 font-medium">Instances</th>
                <th className="pb-2 font-medium">Avg CPU</th>
                <th className="pb-2 font-medium">Hourly</th>
                <th className="pb-2 font-medium">Monthly</th>
                <th className="pb-2 font-medium">Optimised</th>
                <th className="pb-2 font-medium">Saving</th>
                <th className="pb-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.resource.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3">
                    <p className="font-medium text-foreground">{c.resource.name}</p>
                    <p className="text-xs text-muted-foreground">{c.resource.resource_type}</p>
                  </td>
                  <td className="num py-3">{c.resource.instance_count}</td>
                  <td className="num py-3">{pct(c.utilisation)}</td>
                  <td className="num py-3">{inr(c.hourly)}</td>
                  <td className="num py-3">{inr(c.monthly)}</td>
                  <td className="num py-3">{c.optimisedInstances}</td>
                  <td className="num py-3 text-healthy">{c.saving > 0 ? inr(c.saving) : "—"}</td>
                  <td className="py-3">
                    <StatusBadge status={verdictTone[c.verdict]} label={c.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recommendations" description="Ranked by monthly impact">
        <ul className="space-y-3">
          {[...costs]
            .sort((a, b) => b.saving - a.saving)
            .map((c) => (
              <li key={c.resource.id} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{c.resource.name}</p>
                  <span className="num flex items-center gap-1.5 text-xs text-healthy">
                    <TrendingDown className="size-3.5" />
                    {c.saving > 0 ? `${inr(c.saving)} / month` : "No saving available"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.recommendation}</p>
              </li>
            ))}
        </ul>
      </Panel>
    </>
  );
}
