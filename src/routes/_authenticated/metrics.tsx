import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";

import { AreaTrend, LineTrend, chartColors, toChartRows } from "@/components/charts";
import { EmptyState, Meter, Panel, PageHeader, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { compact, downloadCsv, ms, pct } from "@/lib/format";
import { useLive } from "@/lib/live-store";

export const Route = createFileRoute("/_authenticated/metrics")({
  head: () => ({
    meta: [
      { title: "Live Metrics — CloudOps AI" },
      {
        name: "description",
        content:
          "Streaming CPU, memory, disk, network, latency and error-rate telemetry for every monitored cloud resource.",
      },
      { property: "og:title", content: "Live Metrics — CloudOps AI" },
      {
        property: "og:description",
        content: "Second-by-second infrastructure telemetry with exportable history.",
      },
    ],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const { resources, loading, paused } = useLive();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <EmptyState title="Loading telemetry…" />;
  if (resources.length === 0) return <EmptyState title="No resources to monitor" />;

  const selected = resources.find((r) => r.resource.id === selectedId) ?? resources[0]!;
  const series = selected.series;
  const latest = selected.latest;

  const utilisation = toChartRows(series, (p) => ({ cpu: p.cpu, memory: p.memory, disk: p.disk }));
  const traffic = toChartRows(series, (p) => ({ requests: p.requests, connections: p.connections }));
  const quality = toChartRows(series, (p) => ({ latency: p.latency, errors: p.error_rate }));
  const network = toChartRows(series, (p) => ({ in: p.network_in, out: p.network_out }));

  return (
    <>
      <PageHeader
        title="Live Metrics"
        description={paused ? "Stream paused — showing last captured window" : "Streaming telemetry from the monitoring agent"}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                `${selected.resource.name.replace(/\s+/g, "-").toLowerCase()}-metrics`,
                series.map((p) => ({ ...p })),
              )
            }
          >
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {resources.map((r) => (
          <button
            key={r.resource.id}
            onClick={() => setSelectedId(r.resource.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              r.resource.id === selected.resource.id
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <StatusBadge status={r.status} label={r.resource.name} />
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="CPU" value={pct(latest.cpu)} hint={`target ${selected.resource.target_cpu}%`} tone={latest.cpu > 85 ? "critical" : "healthy"} />
        <StatCard label="Memory" value={pct(latest.memory)} hint={`target ${selected.resource.target_memory}%`} tone={latest.memory > 88 ? "critical" : "healthy"} />
        <StatCard label="Requests" value={compact(latest.requests)} unit="req/min" />
        <StatCard label="Error rate" value={pct(latest.error_rate, 2)} tone={latest.error_rate > 2 ? "critical" : "healthy"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Utilisation" description="CPU, memory and disk usage">
          <AreaTrend
            data={utilisation}
            suffix="%"
            domain={[0, 100]}
            reference={selected.resource.target_cpu}
            series={[
              { key: "cpu", label: "CPU", color: chartColors.cpu },
              { key: "memory", label: "Memory", color: chartColors.memory },
              { key: "disk", label: "Disk", color: chartColors.latency },
            ]}
          />
        </Panel>
        <Panel title="Current snapshot" description={selected.resource.provider.toUpperCase()}>
          <div className="space-y-4">
            <Meter label="CPU" value={latest.cpu} target={selected.resource.target_cpu} />
            <Meter label="Memory" value={latest.memory} target={selected.resource.target_memory} />
            <Meter label="Disk" value={latest.disk} />
            <dl className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <Detail label="Instances" value={String(selected.resource.instance_count)} />
              <Detail label="Connections" value={compact(latest.connections)} />
              <Detail label="Latency" value={ms(latest.latency)} />
              <Detail label="Net in" value={`${latest.network_in.toFixed(2)} MB/s`} />
              <Detail label="Net out" value={`${latest.network_out.toFixed(2)} MB/s`} />
              <Detail label="Region" value={selected.resource.region} />
            </dl>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Traffic" description="Requests per minute and open connections">
          <AreaTrend
            data={traffic}
            series={[
              { key: "requests", label: "Requests", color: chartColors.requests },
              { key: "connections", label: "Connections", color: chartColors.memory },
            ]}
          />
        </Panel>
        <Panel title="Response quality" description="Latency in ms and error rate in %">
          <LineTrend
            data={quality}
            series={[
              { key: "latency", label: "Latency", color: chartColors.latency },
              { key: "errors", label: "Error rate", color: chartColors.errors },
            ]}
          />
        </Panel>
        <Panel title="Network throughput" description="MB/s ingress and egress" className="lg:col-span-2">
          <AreaTrend
            data={network}
            suffix=" MB/s"
            series={[
              { key: "in", label: "Ingress", color: chartColors.cpu },
              { key: "out", label: "Egress", color: chartColors.requests },
            ]}
            height={180}
          />
        </Panel>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num text-sm text-foreground">{value}</dd>
    </div>
  );
}
