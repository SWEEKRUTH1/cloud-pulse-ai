import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  ChevronsUpDown,
  Coins,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Pause,
  Play,
  Server,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/kit";
import { useAuth } from "@/hooks/use-auth";
import { useLive } from "@/lib/live-store";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/infrastructure", label: "Infrastructure", icon: Server },
  { to: "/metrics", label: "Live Metrics", icon: Activity },
  { to: "/insights", label: "AI Insights", icon: BrainCircuit },
  { to: "/scaling", label: "Auto-Scaling", icon: Gauge },
  { to: "/simulation", label: "Simulation", icon: Sparkles },
  { to: "/cost", label: "Cost", icon: Coins },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile, user, role, signOut } = useAuth();
  const router = useRouter();
  const {
    environments,
    environmentId,
    setEnvironmentId,
    paused,
    setPaused,
    autoScaling,
    resources,
  } = useLive();

  const activeEnv = environments.find((e) => e.id === environmentId);
  const criticalCount = resources.filter((r) => r.status === "critical").length;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Zap className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">CloudOps AI</p>
            <p className="text-[11px] text-muted-foreground">Predictive Scaling</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.to === "/alerts" && criticalCount > 0 ? (
                  <span className="num ml-auto rounded-full bg-critical/15 px-1.5 text-[10px] font-semibold text-critical">
                    {criticalCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Autonomous mode</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <StatusDot status={autoScaling && !paused ? "healthy" : "offline"} />
              {autoScaling ? "On" : "Off"}
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Server className="size-3.5" />
                {activeEnv?.name ?? "All environments"}
                <ChevronsUpDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Environment</DropdownMenuLabel>
              {environments.map((env) => (
                <DropdownMenuItem key={env.id} onClick={() => setEnvironmentId(env.id)}>
                  <StatusDot status={env.status === "healthy" ? "healthy" : "warning"} pulse={false} />
                  {env.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={paused ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            {paused ? "Resume stream" : "Pause stream"}
          </Button>

          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <StatusDot status={paused ? "offline" : "healthy"} pulse={!paused} />
            {paused ? "Telemetry paused" : "Streaming telemetry"}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground sm:inline">
              {role}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {(profile?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 truncate sm:inline">
                    {profile?.name ?? user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    await router.navigate({ to: "/auth" });
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-20 flex gap-1 overflow-x-auto border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
      {nav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            "flex shrink-0 flex-col items-center gap-1 rounded-md px-3 py-1 text-[10px]",
            pathname === item.to ? "text-primary" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
