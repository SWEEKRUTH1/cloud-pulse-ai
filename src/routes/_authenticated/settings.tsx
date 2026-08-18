import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, Panel, PageHeader, StatusBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live-store";
import type { NotificationRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Notifications — CloudOps AI" },
      {
        name: "description",
        content:
          "Manage your operator profile, role permissions, simulation defaults and in-app notifications.",
      },
      { property: "og:title", content: "Settings & Notifications — CloudOps AI" },
      {
        property: "og:description",
        content: "Profile, role permissions and notification preferences for the CloudOps AI console.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, role, canWrite, isAdmin, refresh } = useAuth();
  const { environments, autoScaling, setAutoScaling, paused, setPaused, reload } = useLive();
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => setName(profile?.name ?? ""), [profile?.name]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      setNotifications((data ?? []) as NotificationRow[]);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ name }).eq("user_id", user.id);
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "profile.update",
      resource_type: "profile",
      details: `Display name set to ${name}`,
    });
    await refresh();
    setSaving(false);
    toast.success("Profile updated");
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Operator profile, permissions and console behaviour."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Profile" description="Shown across the console and in audit records">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} readOnly className="text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
              <span className="text-sm text-muted-foreground">Role</span>
              <StatusBadge status={isAdmin ? "healthy" : canWrite ? "info" : "offline"} label={role} />
            </div>
            <Button disabled={saving || !name.trim()} onClick={() => void saveProfile()}>
              Save profile
            </Button>
          </div>
        </Panel>

        <Panel title="Console behaviour" description="Applies to your current session">
          <div className="space-y-3">
            <ToggleRow
              label="Autonomous scaling"
              hint="Let the engine apply scaling decisions automatically"
              checked={autoScaling}
              disabled={!canWrite}
              onChange={setAutoScaling}
            />
            <ToggleRow
              label="Pause telemetry stream"
              hint="Freeze the live metric feed for inspection"
              checked={paused}
              onChange={setPaused}
            />
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-sm text-foreground">Permissions</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                <li>• View telemetry, forecasts and cost: all roles</li>
                <li>• Scale, edit policies, resolve alerts: operator and admin</li>
                <li>• Manage resources and destructive actions: admin</li>
              </ul>
            </div>
            <Button variant="outline" onClick={() => void reload()}>
              Reload infrastructure
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Environments" description="Logical groupings of monitored resources">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {environments.map((env) => (
            <div key={env.id} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{env.name}</p>
                <StatusBadge status={env.status === "healthy" ? "healthy" : "warning"} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{env.description ?? "No description"}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Notifications" description="Recent messages sent to your account">
        {notifications.length === 0 ? (
          <EmptyState title="No notifications" description="Alerts you acknowledge or resolve will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <StatusBadge
                  status={n.type === "critical" ? "critical" : n.type === "warning" ? "warning" : "info"}
                  label={n.type}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
