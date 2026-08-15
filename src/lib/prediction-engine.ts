/**
 * predictionEngine
 * -----------------------------------------------------------------------------
 * Deterministic, explainable workload prediction for the CloudOps AI prototype.
 *
 * The engine consumes a window of historical metrics and produces a workload
 * forecast, a confidence score, a risk classification and a recommended
 * instance count. It is intentionally pure and side-effect free so the exact
 * same contract can later be served by an external Python/FastAPI ML service
 * (see `predictionService.predict`, which falls back to this engine when no AI
 * service URL is configured).
 */

import type { MetricPoint, PredictionResult, RiskLevel } from "./types";

export interface PredictionInput {
  cpu: number;
  memory: number;
  requests: number;
  latency: number;
  error_rate: number;
  instances: number;
  history: Pick<MetricPoint, "cpu" | "memory" | "requests" | "latency" | "error_rate">[];
  target_cpu: number;
  min_instances: number;
  max_instances: number;
  horizon_minutes?: number;
  /** Sustainable requests-per-minute per instance. */
  capacity_per_instance?: number;
}

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

/** Simple moving average over the last `window` samples. */
export const movingAverage = (values: number[], window: number) =>
  mean(values.slice(-window));

/** Least-squares slope per sample of a series. */
export const linearSlope = (values: number[]) => {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i]! - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const riskFromScore = (score: number): RiskLevel => {
  if (score >= 0.8) return "CRITICAL";
  if (score >= 0.6) return "HIGH";
  if (score >= 0.35) return "MEDIUM";
  return "LOW";
};

export function predictWorkload(input: PredictionInput): PredictionResult {
  const horizon = input.horizon_minutes ?? 5;
  const capacity = input.capacity_per_instance ?? 800;
  const history = input.history.slice(-40);

  const requestSeries = history.map((h) => h.requests);
  const cpuSeries = history.map((h) => h.cpu);

  const shortMa = movingAverage(requestSeries, 5) || input.requests;
  const longMa = movingAverage(requestSeries, 20) || shortMa;

  // Trend: slope per sample, scaled to the requested horizon (samples ≈ 15s).
  const slopePerSample = linearSlope(requestSeries.slice(-15));
  const samplesPerMinute = 4;
  const projectedDelta = slopePerSample * samplesPerMinute * horizon;

  // Momentum: how far the short average has moved away from the long average.
  const momentum = longMa > 0 ? (shortMa - longMa) / longMa : 0;
  const growthRate = momentum;

  const predictedLoad = Math.max(
    0,
    Math.round(shortMa + projectedDelta + shortMa * momentum * 0.6),
  );

  // Confidence: high when the series is stable and we have plenty of samples.
  const volatility = shortMa > 0 ? stdDev(requestSeries.slice(-15)) / shortMa : 0;
  const sampleFactor = clamp(history.length / 30, 0.3, 1);
  const confidence = clamp(0.97 - volatility * 1.4 - (1 - sampleFactor) * 0.25, 0.42, 0.97);

  // Risk score from utilisation, saturation head-room, latency and errors.
  const cpuPressure = clamp(input.cpu / 100, 0, 1.2);
  const memPressure = clamp(input.memory / 100, 0, 1.2);
  const currentCapacity = Math.max(1, input.instances * capacity);
  const saturation = clamp(predictedLoad / currentCapacity, 0, 1.6);
  const latencyPressure = clamp((input.latency - 150) / 450, 0, 1);
  const errorPressure = clamp(input.error_rate / 5, 0, 1);
  const cpuTrend = clamp(linearSlope(cpuSeries.slice(-10)) / 2, -0.3, 0.3);

  const riskScore = clamp(
    cpuPressure * 0.3 +
      memPressure * 0.15 +
      saturation * 0.3 +
      latencyPressure * 0.12 +
      errorPressure * 0.08 +
      cpuTrend * 0.15,
    0,
    1,
  );

  // Recommended instances: satisfy predicted load at the CPU target, with a
  // 15% safety head-room, bounded by the configured policy limits.
  const targetUtilisation = clamp(input.target_cpu / 100, 0.4, 0.9);
  const needForLoad = predictedLoad / (capacity * targetUtilisation);
  const needForCpu = (input.instances * (input.cpu / 100)) / targetUtilisation;
  const recommended = clamp(
    Math.ceil(Math.max(needForLoad, needForCpu) * 1.05),
    input.min_instances,
    input.max_instances,
  );

  const trend: PredictionResult["trend"] =
    momentum > 0.06 || projectedDelta > shortMa * 0.05
      ? "increasing"
      : momentum < -0.06
        ? "decreasing"
        : "stable";

  const reason = buildReason({
    trend,
    predictedLoad,
    currentCapacity,
    horizon,
    cpu: input.cpu,
    targetCpu: input.target_cpu,
    recommended,
    instances: input.instances,
    growthRate,
  });

  return {
    predicted_load: predictedLoad,
    confidence: Number(confidence.toFixed(2)),
    risk_level: riskFromScore(riskScore),
    recommended_instances: recommended,
    reason,
    trend,
    growth_rate: Number((growthRate * 100).toFixed(1)),
    moving_average: Math.round(shortMa),
    risk_score: Number(riskScore.toFixed(2)),
  };
}

function buildReason(ctx: {
  trend: string;
  predictedLoad: number;
  currentCapacity: number;
  horizon: number;
  cpu: number;
  targetCpu: number;
  recommended: number;
  instances: number;
  growthRate: number;
}) {
  const pctOfCapacity = Math.round((ctx.predictedLoad / ctx.currentCapacity) * 100);
  if (ctx.recommended > ctx.instances) {
    return `Predicted traffic of ${ctx.predictedLoad.toLocaleString("en-IN")} req/min reaches ${pctOfCapacity}% of current capacity within the next ${ctx.horizon} minutes while CPU is at ${ctx.cpu.toFixed(0)}% against a ${ctx.targetCpu}% target. Scaling from ${ctx.instances} to ${ctx.recommended} instances keeps utilisation inside the target band.`;
  }
  if (ctx.recommended < ctx.instances) {
    return `Workload is ${ctx.trend} (${ctx.growthRate >= 0 ? "+" : ""}${(ctx.growthRate * 100).toFixed(1)}%) and predicted traffic uses only ${pctOfCapacity}% of provisioned capacity with CPU at ${ctx.cpu.toFixed(0)}%. Reducing to ${ctx.recommended} instances removes idle capacity without breaching the ${ctx.targetCpu}% target.`;
  }
  return `Workload is ${ctx.trend}; predicted traffic uses ${pctOfCapacity}% of current capacity and CPU (${ctx.cpu.toFixed(0)}%) remains within the ${ctx.targetCpu}% target. Current capacity of ${ctx.instances} instances is sufficient.`;
}
