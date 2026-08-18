import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CheckCheck, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, Panel, PageHeader, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live-store";
import type { Alert } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts & Incidents — CloudOps AI" },
      {
        name: "description",
        content:
          "Acknowledge and resolve infrastructure alerts raised by anomaly detection, with a full operator audit trail.",
      },
      { property: "og:title", content: "Alerts & Incidents — CloudOps AI" },
      {
        property: "og:description",
        content: "Alert triage with acknowledgement, resolution and audit logging.",
      },
    ],
  }),
  component: AlertsPage,
});

const sevTone = { critical: "critical", warning: "warning", info: "info" } as const;

function AlertsPage() {
  const { resources, tickCount } = useLive();
  const { canWrite, user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setAlerts((data ?? []) as Alert[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Raise alerts for live anomalies that have no matching active alert yet.
  useEffect(() => {
    if (!canWrite) return;
    const anomalies = resources.flatMap((r) => r.anomalies);
    const pending = anomalies.filter(
      (a) => !alerts.some((al) => al.status !== "resolved" && al.title === a.title),
    );
    if (pending.length === 0) return;
    void (async () => {
      await supabase.from("alerts").insert(
        pending.slice(0, 4).map((a) => ({
          resource_id: a.resource_id,
          alert_type: "anomaly",
          severity: a.severity,
          title: a.title,
          description: `${a.description} Recommended action: ${a.recommended_action}`,
        })),
      );
      await load();
    })();
  }, [tickCount, resources, alerts, canWrite, load]);

  const nameFor = (id: string | null) =>
    resources.find((r) => r.resource.id === id)?.resource.name ?? "Environment";

  const act = async (alert: Alert, mode: "ack" | "resolve") => {
    setBusy(alert.id);
    const patch =
      mode === "ack"
        ? { status: "acknowledged", acknowledged_by: user?.id ?? null, acknowledged_at: new Date().toISOString() }
        : { status: "resolved", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() };
    await supabase.from("alerts").update(patch).eq("id", alert.id);
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action: mode === "ack" ? "alert.acknowledge" : "alert.resolve",
      resource_type: "alert",
      resource_id: alert.id,
      details: alert.title,
    });
    await load();
    setBusy(null);
    toast.success(mode === "ack" ? "Alert acknowledged" : "Alert resolved");
  };

  const active = alerts.filter((a) => a.status === "active");
  const acked = alerts.filter((a) => a.status === "acknowledged");
  const resolved = alerts.filter((a) => a.status === "resolved");

  return (
    <>
      <PageHeader
        title="Alerts & Incidents"
        description="Anomaly detections are promoted to alerts automatically and tracked to resolution."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active" value={active.length} tone={active.length ? "critical" : "healthy"} icon={<BellRing className="size-4" />} />
        <StatCard label="Acknowledged" value={acked.length} tone="warning" />
        <StatCard label="Resolved" value={resolved.length} tone="healthy" icon={<ShieldCheck className="size-4" />} />
        <StatCard label="Critical severity" value={alerts.filter((a) => a.severity === "critical" && a.status !== "resolved").length} tone="critical" />
      </div>

      {[
        { title: "Active", list: active, empty: "No active alerts" },
        { title: "Acknowledged", list: acked, empty: "Nothing awaiting resolution" },
        { title: "Resolved", list: resolved.slice(0, 20), empty: "No resolved alerts yet" },
      ].map((group) => (
        <Panel key={group.title} title={group.title} description={`${group.list.length} alert(s)`}>
          {group.list.length === 0 ? (
            <EmptyState title={group.empty} />
          ) : (
            <ul className="divide-y divide-border">
              {group.list.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
                  <StatusBadge
                    status={sevTone[(a.severity as keyof typeof sevTone) ?? "info"] ?? "info"}
                    label={a.severity}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {nameFor(a.resource_id)} · {relativeTime(a.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {a.status === "active" ? (
                      <Button size="sm" variant="outline" disabled={!canWrite || busy === a.id} onClick={() => void act(a, "ack")}>
                        Acknowledge
                      </Button>
                    ) : null}
                    {a.status !== "resolved" ? (
                      <Button size="sm" disabled={!canWrite || busy === a.id} onClick={() => void act(a, "resolve")}>
                        <CheckCheck className="size-3.5" /> Resolve
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ))}
    </>
  );
}
