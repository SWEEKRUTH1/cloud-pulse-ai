import { createFileRoute } from "@tanstack/react-router";
import { Download, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState, Panel, PageHeader, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dateTime, downloadCsv, relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live-store";
import type { AuditLog, ScalingEvent } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History & Audit Trail — CloudOps AI" },
      {
        name: "description",
        content:
          "Complete record of scaling events and operator actions across the monitored cloud estate, exportable as CSV.",
      },
      { property: "og:title", content: "History & Audit Trail — CloudOps AI" },
      {
        property: "og:description",
        content: "Scaling event timeline and operator audit log with CSV export.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { resources, tickCount } = useLive();
  const [events, setEvents] = useState<ScalingEvent[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    void (async () => {
      const [ev, au] = await Promise.all([
        supabase.from("scaling_events").select("*").order("timestamp", { ascending: false }).limit(100),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      setEvents((ev.data ?? []) as ScalingEvent[]);
      setLogs((au.data ?? []) as AuditLog[]);
    })();
  }, [tickCount]);

  const nameFor = (id: string) =>
    resources.find((r) => r.resource.id === id)?.resource.name ?? "Resource";

  const upCount = events.filter((e) => e.action === "scale_up").length;
  const downCount = events.filter((e) => e.action === "scale_down").length;
  const aiCount = events.filter((e) => e.trigger === "AI").length;

  return (
    <>
      <PageHeader
        title="History & Audit Trail"
        description="Every capacity change and operator action, with the reasoning that produced it."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "cloudops-scaling-history",
                events.map((e) => ({
                  timestamp: dateTime(e.timestamp),
                  resource: nameFor(e.resource_id),
                  action: e.action,
                  from: e.previous_instances,
                  to: e.new_instances,
                  trigger: e.trigger,
                  status: e.status,
                  reason: e.reason ?? "",
                })),
              )
            }
          >
            <Download className="size-4" /> Export history
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scaling events" value={events.length} icon={<HistoryIcon className="size-4" />} />
        <StatCard label="Scale ups" value={upCount} tone="warning" />
        <StatCard label="Scale downs" value={downCount} tone="info" />
        <StatCard label="Autonomous actions" value={aiCount} tone="healthy" hint={`${events.length - aiCount} manual`} />
      </div>

      <Panel title="Scaling timeline" description="Newest first">
        {events.length === 0 ? (
          <EmptyState title="No scaling events recorded" />
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[26px] top-1.5 size-2.5 rounded-full ${
                    e.action === "scale_up" ? "bg-warning" : e.action === "scale_down" ? "bg-info" : "bg-healthy"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{nameFor(e.resource_id)}</p>
                  <StatusBadge
                    status={e.action === "scale_up" ? "warning" : e.action === "scale_down" ? "info" : "healthy"}
                    label={`${e.previous_instances} → ${e.new_instances}`}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {e.trigger} · {relativeTime(e.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="Operator audit log" description="Who did what, and when">
        {logs.length === 0 ? (
          <EmptyState title="No operator actions logged yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Target</th>
                  <th className="pb-2 font-medium">Details</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="num py-2.5 text-xs text-muted-foreground">{dateTime(l.created_at)}</td>
                    <td className="py-2.5 text-xs text-foreground">{l.user_email ?? "system"}</td>
                    <td className="py-2.5 text-xs text-foreground">{l.action}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{l.resource_type ?? "—"}</td>
                    <td className="max-w-[280px] truncate py-2.5 text-xs text-muted-foreground">{l.details ?? "—"}</td>
                    <td className="py-2.5">
                      <StatusBadge status={l.status === "success" ? "healthy" : "critical"} label={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
