/**
 * Auto-scaling decision engine.
 *
 * Deterministic rules with cooldown protection and hard min/max bounds.
 * Consumed by `scalingService.evaluate`, which persists the resulting event.
 */

import type { PredictionResult, ScalingDecision, ScalingPolicy } from "./types";

export interface ScalingInput {
  currentInstances: number;
  cpu: number;
  memory: number;
  policy: Pick<
    ScalingPolicy,
    | "min_instances"
    | "max_instances"
    | "target_cpu"
    | "target_memory"
    | "scale_up_cooldown"
    | "scale_down_cooldown"
    | "enabled"
  >;
  prediction: PredictionResult;
  /** ISO timestamp of the most recent scaling event for this resource. */
  lastEventAt?: string | null;
  lastEventAction?: string | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function decideScaling(input: ScalingInput): ScalingDecision {
  const { policy, prediction, cpu, memory, currentInstances } = input;
  const hold = (reason: string, blocked = false): ScalingDecision => ({
    action: "hold",
    previous_instances: currentInstances,
    new_instances: currentInstances,
    reason,
    blocked_by_cooldown: blocked,
  });

  if (!policy.enabled) return hold("Auto-scaling is disabled for this resource.");

  const secondsSinceLast = input.lastEventAt
    ? (Date.now() - new Date(input.lastEventAt).getTime()) / 1000
    : Number.POSITIVE_INFINITY;

  const cpuOverTarget = cpu > policy.target_cpu;
  const memOverTarget = memory > policy.target_memory;
  const riskHigh = prediction.risk_level === "HIGH" || prediction.risk_level === "CRITICAL";
  const wantsUp =
    (cpuOverTarget || memOverTarget || riskHigh) &&
    prediction.recommended_instances > currentInstances;

  const cpuWellUnder = cpu < policy.target_cpu - 20;
  const memWellUnder = memory < policy.target_memory - 15;
  const wantsDown =
    cpuWellUnder &&
    memWellUnder &&
    prediction.trend !== "increasing" &&
    prediction.recommended_instances < currentInstances;

  if (wantsUp) {
    if (currentInstances >= policy.max_instances)
      return hold(
        `Scale-up required but the resource is already at its maximum of ${policy.max_instances} instances.`,
      );
    if (secondsSinceLast < policy.scale_up_cooldown && input.lastEventAction === "scale_up")
      return hold(
        `Scale-up suppressed by cooldown (${Math.round(policy.scale_up_cooldown - secondsSinceLast)}s remaining).`,
        true,
      );
    const target = clamp(
      prediction.recommended_instances,
      currentInstances + 1,
      policy.max_instances,
    );
    return {
      action: "scale_up",
      previous_instances: currentInstances,
      new_instances: target,
      reason: prediction.reason,
      blocked_by_cooldown: false,
    };
  }

  if (wantsDown) {
    if (currentInstances <= policy.min_instances)
      return hold(
        `Utilisation is low but the resource is already at its minimum of ${policy.min_instances} instances.`,
      );
    if (secondsSinceLast < policy.scale_down_cooldown && input.lastEventAction === "scale_down")
      return hold(
        `Scale-down suppressed by cooldown (${Math.round(policy.scale_down_cooldown - secondsSinceLast)}s remaining).`,
        true,
      );
    const target = clamp(
      prediction.recommended_instances,
      policy.min_instances,
      currentInstances - 1,
    );
    return {
      action: "scale_down",
      previous_instances: currentInstances,
      new_instances: target,
      reason: prediction.reason,
      blocked_by_cooldown: false,
    };
  }

  return hold(
    `No scaling action required. CPU ${cpu.toFixed(0)}% / memory ${memory.toFixed(0)}% are inside the target band and predicted load is ${prediction.trend}.`,
  );
}
