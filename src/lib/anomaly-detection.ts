/**
 * Anomaly detection for the CloudOps AI prototype.
 *
 * Uses deterministic rate-of-change and z-score style rules over a rolling
 * metric window. Every detection carries the numbers that produced it so the
 * result is explainable rather than a black box.
 */

import type { Anomaly, MetricPoint, Severity } from "./types";

export interface AnomalyRuleContext {
  resourceId: string;
  resourceName: string;
  window: MetricPoint[];
  targetCpu: number;
}

const first = (window: MetricPoint[]) => window[0];
const last = (window: MetricPoint[]) => window[window.length - 1];

const makeId = (resourceId: string, metric: string) =>
  `${resourceId}:${metric}:${Math.floor(Date.now() / 30000)}`;

export function detectAnomalies(ctx: AnomalyRuleContext): Anomaly[] {
  const { window } = ctx;
  if (window.length < 4) return [];
  const start = first(window)!;
  const end = last(window)!;
  const detected: Anomaly[] = [];
  const seconds = Math.max(
    30,
    Math.round((new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 1000),
  );

  const push = (
    metric: string,
    severity: Severity,
    title: string,
    description: string,
    action: string,
  ) =>
    detected.push({
      id: makeId(ctx.resourceId, metric),
      resource_id: ctx.resourceId,
      resource_name: ctx.resourceName,
      metric,
      severity,
      title,
      description,
      recommended_action: action,
      detected_at: end.timestamp,
    });

  const cpuDelta = end.cpu - start.cpu;
  if (cpuDelta >= 25 && end.cpu >= 75) {
    push(
      "cpu",
      end.cpu >= 90 ? "critical" : "warning",
      `Sudden CPU increase on ${ctx.resourceName}`,
      `CPU increased from ${start.cpu.toFixed(0)}% to ${end.cpu.toFixed(0)}% in ${seconds} seconds (target ${ctx.targetCpu}%).`,
      "Scale up capacity",
    );
  }

  const memDelta = end.memory - start.memory;
  if (memDelta >= 18 && end.memory >= 80) {
    push(
      "memory",
      end.memory >= 92 ? "critical" : "warning",
      `Memory pressure on ${ctx.resourceName}`,
      `Memory rose from ${start.memory.toFixed(0)}% to ${end.memory.toFixed(0)}% in ${seconds} seconds.`,
      "Scale up or inspect for leaks",
    );
  }

  if (start.requests > 0) {
    const growth = (end.requests - start.requests) / start.requests;
    if (growth >= 0.5) {
      push(
        "requests",
        growth >= 1 ? "critical" : "warning",
        `Traffic spike on ${ctx.resourceName}`,
        `Request rate grew ${Math.round(growth * 100)}% (${Math.round(start.requests)} → ${Math.round(end.requests)} req/min) in ${seconds} seconds.`,
        "Scale up ahead of the spike",
      );
    }
    if (growth <= -0.45) {
      push(
        "traffic_drop",
        "info",
        `Traffic drop on ${ctx.resourceName}`,
        `Request rate fell ${Math.abs(Math.round(growth * 100))}% (${Math.round(start.requests)} → ${Math.round(end.requests)} req/min).`,
        "Consider scaling down to save cost",
      );
    }
  }

  if (end.latency >= 320 && end.latency - start.latency >= 60) {
    push(
      "latency",
      end.latency >= 500 ? "critical" : "warning",
      `Latency degradation on ${ctx.resourceName}`,
      `Response latency increased from ${Math.round(start.latency)} ms to ${Math.round(end.latency)} ms.`,
      "Scale up and inspect slow dependencies",
    );
  }

  if (end.error_rate >= 3 && end.error_rate - start.error_rate >= 1) {
    push(
      "errors",
      end.error_rate >= 6 ? "critical" : "warning",
      `Error rate rising on ${ctx.resourceName}`,
      `Error rate moved from ${start.error_rate.toFixed(1)}% to ${end.error_rate.toFixed(1)}%.`,
      "Investigate failing requests",
    );
  }

  if (end.instance_count < start.instance_count && end.cpu >= ctx.targetCpu) {
    push(
      "instances",
      "critical",
      `Instance failure on ${ctx.resourceName}`,
      `Healthy instances dropped from ${start.instance_count} to ${end.instance_count} while load remained high.`,
      "Replace failed instances immediately",
    );
  }

  return detected;
}

export const statusFromMetrics = (
  point: MetricPoint | undefined,
  targetCpu: number,
): "healthy" | "warning" | "critical" | "offline" => {
  if (!point) return "offline";
  if (point.cpu >= 90 || point.memory >= 92 || point.error_rate >= 5 || point.latency >= 500)
    return "critical";
  if (point.cpu >= targetCpu + 8 || point.memory >= 85 || point.latency >= 300) return "warning";
  return "healthy";
};
