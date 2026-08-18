import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Gauge, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, Panel, PageHeader, RiskBadge, StatCard, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { relativeTime } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useLive } from "@/lib/live-store";
import type { ScalingEvent } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/scaling")({
  head: () => ({
    meta: [
      { title: "Auto-Scaling Console — CloudOps AI" },
      {
        name: "description",
        content:
          "Configure scaling policies, cooldowns and capacity bounds, or scale manually — every action is logged with reasoning.",
      },
      { property: "og:title", content: "Auto-Scaling Console — CloudOps AI" },
      {
        property: "og:description",
        content: "Autonomous and manual scaling with cooldown protection and a complete decision log.",
      },
    ],
  }),
  component: ScalingPage,
});

function ScalingPage() {
  const { resources, loading, autoScaling, setAutoScaling, applyScaling, updatePolicy, tickCount } =
    useLive();
  const { canWrite, role } = useAuth();
  const [events, setEvents] = useState<ScalingEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("scaling_events")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(30);
      if (!cancelled) setEvents((data ?? []) as ScalingEvent[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [tickCount]);

  if (loading) return <EmptyState title="Loading scaling policies…" />;
  if (resources.length === 0) return <EmptyState title="No resources to scale" />;

  const nameFor = (id: string) =>
    resources.find((r) => r.resource.id === id)?.resource.name ?? "Resource";

  const manualScale = async (id: string, target: number, label: string) => {
    setBusy(id);
    await applyScaling(id, target, `Manual ${label} by ${role}.`, "Manual");
    setBusy(null);
    toast.success(`${nameFor(id)} scaled to ${target} instances`);
  };

  const pending = resources.filter((r) => r.decision.action !== "hold");

  return (
    <>
      <PageHeader
        title="Auto-Scaling"
        description="Policy-driven autonomous scaling with cooldown protection and manual override."
        actions={
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5">
            <Label className="text-xs text-muted-foreground">Autonomous mode</Label>
            <Switch checked={autoScaling} onCheckedChange={setAutoScaling} disabled={!canWrite} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mode" value={autoScaling ? "Autonomous" : "Manual"} tone={autoScaling ? "healthy" : "warning"} icon={<Gauge className="size-4" />} />
        <StatCard label="Pending decisions" value={pending.length} tone={pending.length ? "info" : "healthy"} />
        <StatCard label="Total instances" value={resources.reduce((a, r) => a + r.resource.instance_count, 0)} />
        <StatCard label="Events logged" value={events.length} hint="most recent 30" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {resources.map((r) => {
          const policy = r.policy!;
          return (
            <Panel
              key={r.resource.id}
              title={r.resource.name}
              description={`${r.resource.instance_count} instances · bounds ${policy.min_instances}–${policy.max_instances}`}
              actions={<StatusBadge status={r.status} />}
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Engine decision
                    </span>
                    <div className="flex items-center gap-2">
                      <RiskBadge risk={r.prediction.risk_level} />
                      <StatusBadge
                        status={
                          r.decision.action === "scale_up"
                            ? "warning"
                            : r.decision.action === "scale_down"
                              ? "info"
                              : "healthy"
                        }
                        label={r.decision.action.replace("_", " ")}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {r.decision.reason}
                  </p>
                  {r.decision.blocked_by_cooldown ? (
                    <p className="mt-1.5 text-[11px] text-warning">Cooldown window active</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      CPU target · <span className="num text-foreground">{policy.target_cpu}%</span>
                    </Label>
                    <Slider
                      className="mt-2"
                      min={40}
                      max={90}
                      step={5}
                      value={[policy.target_cpu]}
                      disabled={!canWrite}
                      onValueChange={([v]) => void updatePolicy(r.resource.id, { target_cpu: v! })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Memory target · <span className="num text-foreground">{policy.target_memory}%</span>
                    </Label>
                    <Slider
                      className="mt-2"
                      min={40}
                      max={95}
                      step={5}
                      value={[policy.target_memory]}
                      disabled={!canWrite}
                      onValueChange={([v]) => void updatePolicy(r.resource.id, { target_memory: v! })}
                    />
                  </div>
                  <BoundInput
                    label="Min instances"
                    value={policy.min_instances}
                    disabled={!canWrite}
                    onCommit={(v) => void updatePolicy(r.resource.id, { min_instances: v })}
                  />
                  <BoundInput
                    label="Max instances"
                    value={policy.max_instances}
                    disabled={!canWrite}
                    onCommit={(v) => void updatePolicy(r.resource.id, { max_instances: v })}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite || busy === r.resource.id || r.resource.instance_count <= policy.min_instances}
                    onClick={() =>
                      void manualScale(r.resource.id, r.resource.instance_count - 1, "scale down")
                    }
                  >
                    {busy === r.resource.id ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                    Scale down
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite || busy === r.resource.id || r.resource.instance_count >= policy.max_instances}
                    onClick={() =>
                      void manualScale(r.resource.id, r.resource.instance_count + 1, "scale up")
                    }
                  >
                    <ChevronUp className="size-3.5" /> Scale up
                  </Button>
                  {r.decision.action !== "hold" ? (
                    <Button
                      size="sm"
                      disabled={!canWrite || busy === r.resource.id}
                      onClick={() =>
                        void manualScale(r.resource.id, r.decision.new_instances, "apply recommendation")
                      }
                    >
                      Apply recommendation ({r.decision.new_instances})
                    </Button>
                  ) : null}
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    Policy
                    <Switch
                      checked={policy.enabled}
                      disabled={!canWrite}
                      onCheckedChange={(v) => void updatePolicy(r.resource.id, { enabled: v })}
                    />
                  </span>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Scaling decision log" description="Every autonomous and manual action with its reasoning">
        {events.length === 0 ? (
          <EmptyState title="No scaling events yet" description="Trigger a traffic spike from the Simulation page." />
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-3 py-3">
                <StatusBadge
                  status={e.action === "scale_up" ? "warning" : e.action === "scale_down" ? "info" : "healthy"}
                  label={e.action.replace("_", " ")}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {nameFor(e.resource_id)}{" "}
                    <span className="num text-muted-foreground">
                      {e.previous_instances} → {e.new_instances}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.reason}</p>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  <p>{e.trigger}</p>
                  <p>{relativeTime(e.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function BoundInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="mt-2"
        type="number"
        min={1}
        max={40}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number(draft);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed !== value) onCommit(parsed);
          else setDraft(String(value));
        }}
      />
    </div>
  );
}
