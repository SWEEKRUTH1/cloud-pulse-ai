import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/lib/types";

export type StatusKind = "healthy" | "warning" | "critical" | "offline" | "info";

const statusStyles: Record<StatusKind, string> = {
  healthy: "bg-healthy/12 text-healthy border-healthy/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  critical: "bg-critical/14 text-critical border-critical/35",
  offline: "bg-offline/12 text-muted-foreground border-border",
  info: "bg-info/12 text-info border-info/30",
};

const dotColor: Record<StatusKind, string> = {
  healthy: "bg-healthy",
  warning: "bg-warning",
  critical: "bg-critical",
  offline: "bg-offline",
  info: "bg-info",
};

export function StatusDot({ status, pulse = true }: { status: StatusKind; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        dotColor[status],
        pulse && status !== "offline" && "live-dot",
      )}
    />
  );
}

export function StatusBadge({ status, label }: { status: StatusKind; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        statusStyles[status],
      )}
    >
      <StatusDot status={status} />
      {label ?? status}
    </span>
  );
}

const riskKind: Record<RiskLevel, StatusKind> = {
  LOW: "healthy",
  MEDIUM: "warning",
  HIGH: "critical",
  CRITICAL: "critical",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        statusStyles[riskKind[risk]],
      )}
    >
      {risk}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  trend,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  trend?: number;
  tone?: "default" | "healthy" | "warning" | "critical" | "info";
  icon?: ReactNode;
}) {
  const toneRing: Record<string, string> = {
    default: "",
    healthy: "border-healthy/30",
    warning: "border-warning/30",
    critical: "border-critical/35",
    info: "border-info/30",
  };
  return (
    <div className={cn("panel p-4 shadow-panel", toneRing[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-2xl font-semibold text-foreground">{value}</span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend != null ? (
          <span
            className={cn(
              "num text-xs font-medium",
              trend > 0 ? "text-warning" : trend < 0 ? "text-healthy" : "text-muted-foreground",
            )}
          >
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "•"} {Math.abs(trend).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel shadow-panel", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Meter({
  value,
  target,
  label,
}: {
  value: number;
  target?: number;
  label?: string;
}) {
  const kind: StatusKind = value >= 90 ? "critical" : target && value > target ? "warning" : "healthy";
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="num text-foreground">{value.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", dotColor[kind])}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function LiveTag({ paused }: { paused: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      <StatusDot status={paused ? "offline" : "healthy"} pulse={!paused} />
      {paused ? "Paused" : "Live"}
    </span>
  );
}
