/**
 * Backend-authoritative agent engine.
 *
 * All authority for telemetry collection, prediction, anomaly detection,
 * scaling decisions and scaling execution lives here. The browser only reads
 * the results. Runs with the service role, so RLS is bypassed by design.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectAnomalies as detectAnomalyRules } from "@/lib/anomaly-detection";
import { averageCpu, costForResource } from "@/lib/cost-engine";
import { predictWorkload } from "@/lib/prediction-engine";
import { decideScaling } from "@/lib/scaling-engine";
import type {
  Anomaly,
  MetricPoint,
  PredictionResult,
  Resource,
  ScalingDecision,
  ScalingPolicy,
} from "@/lib/types";

import { providerForMode, type CloudProvider } from "./cloud-provider.server";
import { nextPoint, seedPoint, type Scenario } from "./telemetry.server";

const LOCK_STALE_SECONDS = 45;
const COST_EVERY_TICKS = 10;
const HISTORY_SAMPLES = 40;
const ALERT_DEDUPE_MINUTES = 10;

export interface AgentCycleResult {
  ran: boolean;
  reason?: string;
  tick?: number;
  mode?: string;
  metrics_written?: number;
  predictions_written?: number;
  alerts_created?: number;
  decisions_recorded?: number;
  executions?: number;
  cost_snapshots?: number;
}

/* ------------------------------------------------------------------ helpers */

function effectivePolicy(resource: Resource, policy: ScalingPolicy | undefined): ScalingPolicy {
  return (
    policy ?? {
      id: resource.id,
      resource_id: resource.id,
      min_instances: resource.min_instances,
      max_instances: resource.max_instances,
      target_cpu: resource.target_cpu,
      target_memory: resource.target_memory,
      scale_up_cooldown: 300,
      scale_down_cooldown: 600,
      enabled: resource.enabled,
      updated_at: resource.updated_at,
    }
  );
}

/** Deterministic key so a decision can only ever execute once. */
function executionKey(resourceId: string, action: string, target: number, bucketMs = 60_000) {
  return `${resourceId}:${action}:${target}:${Math.floor(Date.now() / bucketMs)}`;
}

export async function writeAuditEvent(input: {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: string | null;
  status?: "success" | "failed";
}) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    user_id: input.userId ?? null,
    user_email: input.userEmail ?? null,
    action: input.action,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    details: input.details ?? null,
    status: input.status ?? "success",
  });
  if (error) console.error("[agent] audit write failed", error.message);
}

/* -------------------------------------------------------- phase 1 functions */

/** Produce the next reading for a resource (simulated collector). */
export function collectMetrics(input: {
  resource: Resource;
  previous: MetricPoint | undefined;
  tick: number;
  scenario: Scenario;
  scenarioAge: number;
  targeted: boolean;
}): MetricPoint {
  const previous = input.previous ?? seedPoint(input.resource);
  return nextPoint(
    previous,
    input.resource,
    input.tick,
    input.scenario,
    input.scenarioAge,
    input.targeted,
  );
}

export async function persistMetrics(points: MetricPoint[]) {
  if (points.length === 0) return 0;
  const { error } = await supabaseAdmin.from("metrics").insert(points);
  if (error) throw new Error(`metric persistence failed: ${error.message}`);
  return points.length;
}

export function generatePrediction(
  resource: Resource,
  series: MetricPoint[],
  policy: ScalingPolicy,
): PredictionResult {
  const latest = series[series.length - 1]!;
  return predictWorkload({
    cpu: latest.cpu,
    memory: latest.memory,
    requests: latest.requests,
    latency: latest.latency,
    error_rate: latest.error_rate,
    instances: resource.instance_count,
    history: series,
    target_cpu: policy.target_cpu,
    min_instances: policy.min_instances,
    max_instances: policy.max_instances,
  });
}

export async function persistPredictions(
  rows: { resource: Resource; prediction: PredictionResult }[],
) {
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("predictions").insert(
    rows.map(({ resource, prediction }) => ({
      resource_id: resource.id,
      horizon_minutes: 5,
      predicted_load: prediction.predicted_load,
      confidence: prediction.confidence,
      risk_level: prediction.risk_level,
      recommended_instances: prediction.recommended_instances,
      reasoning: prediction.reason,
    })),
  );
  if (error) throw new Error(`prediction persistence failed: ${error.message}`);
  return rows.length;
}

export function detectAnomalies(resource: Resource, series: MetricPoint[]): Anomaly[] {
  return detectAnomalyRules({
    resourceId: resource.id,
    resourceName: resource.name,
    window: series.slice(-12),
    targetCpu: resource.target_cpu,
  });
}

/** Creates alerts for anomalies, skipping anything already open or recent. */
export async function persistAnomalyAlerts(anomalies: Anomaly[]) {
  if (anomalies.length === 0) return 0;
  const since = new Date(Date.now() - ALERT_DEDUPE_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("alerts")
    .select("title,resource_id,status,created_at")
    .gte("created_at", since);
  const { data: open } = await supabaseAdmin
    .from("alerts")
    .select("title,resource_id,status")
    .neq("status", "resolved");

  const seen = new Set(
    [...(recent ?? []), ...(open ?? [])].map((a) => `${a.resource_id}:${a.title}`),
  );

  const fresh: Anomaly[] = [];
  for (const a of anomalies) {
    const key = `${a.resource_id}:${a.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(a);
  }
  if (fresh.length === 0) return 0;

  const { error } = await supabaseAdmin.from("alerts").insert(
    fresh.slice(0, 8).map((a) => ({
      resource_id: a.resource_id,
      alert_type: "anomaly",
      severity: a.severity,
      title: a.title,
      description: `${a.description} Recommended action: ${a.recommended_action}`,
    })),
  );
  if (error) throw new Error(`alert persistence failed: ${error.message}`);
  return Math.min(fresh.length, 8);
}

export function calculateScalingDecision(input: {
  resource: Resource;
  policy: ScalingPolicy;
  latest: MetricPoint;
  prediction: PredictionResult;
  lastEventAt: string | null;
  lastEventAction: string | null;
}): ScalingDecision {
  return decideScaling({
    currentInstances: input.resource.instance_count,
    cpu: input.latest.cpu,
    memory: input.latest.memory,
    policy: input.policy,
    prediction: input.prediction,
    lastEventAt: input.lastEventAt,
    lastEventAction: input.lastEventAction,
  });
}

export async function recordDecision(input: {
  resource: Resource;
  decision: ScalingDecision;
  riskLevel: string;
  trigger: string;
  requestedBy?: string | null;
}) {
  const key =
    input.decision.action === "hold"
      ? null
      : executionKey(input.resource.id, input.decision.action, input.decision.new_instances);
  const { data, error } = await supabaseAdmin
    .from("scaling_decisions")
    .insert({
      resource_id: input.resource.id,
      action: input.decision.action,
      previous_instances: input.decision.previous_instances,
      new_instances: input.decision.new_instances,
      reason: input.decision.reason,
      blocked_by_cooldown: input.decision.blocked_by_cooldown,
      risk_level: input.riskLevel,
      trigger: input.trigger,
      execution_key: key,
      requested_by: input.requestedBy ?? null,
    })
    .select("id,execution_key")
    .maybeSingle();
  // A duplicate execution key means this exact decision already exists.
  if (error && !error.message.includes("duplicate key")) {
    throw new Error(`decision could not be recorded: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Executes a decision. Validates bounds and cooldown again, then writes through
 * the cloud provider (simulated unless a real connection is configured).
 */
export async function executeScalingDecision(input: {
  resource: Resource;
  policy: ScalingPolicy;
  decision: ScalingDecision;
  trigger: string;
  provider: CloudProvider;
  decisionId?: string | null;
  executionKey?: string | null;
  actor?: { id: string | null; email: string | null };
}): Promise<{ ok: boolean; message: string; simulated: boolean }> {
  const { resource, policy, decision, provider } = input;
  const target = decision.new_instances;

  if (decision.action === "hold") return { ok: false, message: decision.reason, simulated: true };
  if (target < policy.min_instances || target > policy.max_instances) {
    return {
      ok: false,
      simulated: provider.simulated,
      message: `Rejected: ${target} instances is outside the allowed range ${policy.min_instances}–${policy.max_instances}.`,
    };
  }
  if (decision.blocked_by_cooldown) {
    return { ok: false, simulated: provider.simulated, message: decision.reason };
  }

  const key = input.executionKey ?? executionKey(resource.id, decision.action, target);

  // Idempotency: the unique index rejects a second execution of the same key.
  const { error: eventError } = await supabaseAdmin.from("scaling_events").insert({
    resource_id: resource.id,
    action: decision.action,
    previous_instances: resource.instance_count,
    new_instances: target,
    reason: decision.reason,
    trigger: input.trigger,
    status: "completed",
    execution_key: key,
  });
  if (eventError) {
    if (eventError.code === "23505" || eventError.message.includes("duplicate key")) {
      return {
        ok: false,
        simulated: provider.simulated,
        message: "This scaling decision has already been executed.",
      };
    }
    throw new Error(`scaling execution failed: ${eventError.message}`);
  }

  const result = await provider.scale({ resourceId: resource.id, from: resource.instance_count, to: target });
  if (!result.ok) {
    await supabaseAdmin
      .from("scaling_events")
      .update({ status: "failed", reason: `${decision.reason} ${result.message}` })
      .eq("execution_key", key);
    await writeAuditEvent({
      userId: input.actor?.id ?? null,
      userEmail: input.actor?.email ?? input.trigger,
      action: "scaling.failed",
      resourceType: "resource",
      resourceId: resource.id,
      details: result.message,
      status: "failed",
    });
    return { ok: false, simulated: result.simulated, message: result.message };
  }

  const { error: updateError } = await supabaseAdmin
    .from("resources")
    .update({ instance_count: target })
    .eq("id", resource.id);
  if (updateError) {
    await supabaseAdmin
      .from("scaling_events")
      .update({ status: "failed", reason: updateError.message })
      .eq("execution_key", key);
    return { ok: false, simulated: result.simulated, message: updateError.message };
  }

  if (input.decisionId) {
    await supabaseAdmin
      .from("scaling_decisions")
      .update({ executed: true })
      .eq("id", input.decisionId);
  }

  return { ok: true, simulated: result.simulated, message: result.message };
}

export async function calculateCostSnapshot(rows: { resource: Resource; series: MetricPoint[] }[]) {
  if (rows.length === 0) return 0;
  const snapshots = rows.map(({ resource, series }) => {
    const cost = costForResource(resource, averageCpu(series));
    return {
      resource_id: resource.id,
      hourly_cost: Number(cost.hourly.toFixed(2)),
      daily_cost: Number(cost.daily.toFixed(2)),
      monthly_estimate: Number(cost.monthly.toFixed(2)),
    };
  });
  const { error } = await supabaseAdmin.from("cost_records").insert(snapshots);
  if (error) throw new Error(`cost persistence failed: ${error.message}`);
  return snapshots.length;
}

/* ------------------------------------------------------------- cycle runner */

/** Acquires the single global execution lock. Returns null when already busy. */
async function acquireLock(minIntervalMs: number) {
  const { data: state } = await supabaseAdmin
    .from("agent_state")
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  if (!state) return null;

  const lastTick = state.last_tick_at ? new Date(state.last_tick_at).getTime() : 0;
  if (Date.now() - lastTick < minIntervalMs) return null;

  const staleBefore = new Date(Date.now() - LOCK_STALE_SECONDS * 1000).toISOString();
  const { data: locked } = await supabaseAdmin
    .from("agent_state")
    .update({ running: true, locked_at: new Date().toISOString() })
    .eq("id", "global")
    .or(`running.eq.false,locked_at.lt.${staleBefore}`)
    .select("*")
    .maybeSingle();
  return locked ?? null;
}

async function releaseLock(patch: { tick_count: number; cost_tick: number; error?: string | null }) {
  await supabaseAdmin
    .from("agent_state")
    .update({
      running: false,
      locked_at: null,
      last_tick_at: new Date().toISOString(),
      tick_count: patch.tick_count,
      cost_tick: patch.cost_tick,
      last_error: patch.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "global");
}

/**
 * One full agent cycle: collect → persist → predict → detect → decide → execute.
 * Guarded by a database lock and a minimum interval so any number of callers
 * (browser tabs, cron, manual trigger) collapse into a single run.
 */
export async function runAgentCycle(minIntervalMs = 4000): Promise<AgentCycleResult> {
  const state = await acquireLock(minIntervalMs);
  if (!state) return { ran: false, reason: "another cycle is in progress or too soon" };

  const tick = Number(state.tick_count) + 1;
  let costTick = Number(state.cost_tick);
  const summary: AgentCycleResult = {
    ran: true,
    tick,
    metrics_written: 0,
    predictions_written: 0,
    alerts_created: 0,
    decisions_recorded: 0,
    executions: 0,
    cost_snapshots: 0,
  };

  try {
    const [resRes, polRes, simRes, evtRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("resources").select("*").order("name"),
      supabaseAdmin.from("scaling_policies").select("*"),
      supabaseAdmin.from("simulation_state").select("*").eq("id", "global").maybeSingle(),
      supabaseAdmin
        .from("scaling_events")
        .select("resource_id,timestamp,action")
        .order("timestamp", { ascending: false })
        .limit(200),
      supabaseAdmin.from("cloud_settings").select("mode").limit(1).maybeSingle(),
    ]);

    const resources = (resRes.data ?? []) as Resource[];
    if (resources.length === 0) {
      await releaseLock({ tick_count: tick, cost_tick: costTick });
      return { ran: true, tick, reason: "no resources" };
    }
    const policies = (polRes.data ?? []) as ScalingPolicy[];
    const scenario = (simRes.data?.scenario ?? "normal") as Scenario;
    const scenarioTarget = simRes.data?.target_resource_id ?? null;
    const startedTick = Number(simRes.data?.started_tick ?? 0);
    const mode = settingsRes.data?.mode ?? "demo";
    const provider = providerForMode(mode);
    summary.mode = provider.label;

    const lastEvent: Record<string, { at: string; action: string }> = {};
    for (const e of evtRes.data ?? []) {
      if (!lastEvent[e.resource_id]) lastEvent[e.resource_id] = { at: e.timestamp, action: e.action };
    }

    // Recent persisted history per resource.
    const { data: metricRows } = await supabaseAdmin
      .from("metrics")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(resources.length * HISTORY_SAMPLES);
    const history: Record<string, MetricPoint[]> = {};
    for (const row of (metricRows ?? []) as MetricPoint[]) {
      const list = (history[row.resource_id] ??= []);
      if (list.length < HISTORY_SAMPLES) list.push(row);
    }
    for (const key of Object.keys(history)) history[key] = history[key]!.slice().reverse();

    const points: MetricPoint[] = [];
    const predictions: { resource: Resource; prediction: PredictionResult }[] = [];
    const anomalies: Anomaly[] = [];
    const seriesByResource: Record<string, MetricPoint[]> = {};

    for (const resource of resources) {
      const prior = history[resource.id] ?? [];
      const point = collectMetrics({
        resource,
        previous: prior[prior.length - 1],
        tick,
        scenario,
        scenarioAge: tick - startedTick,
        targeted: !scenarioTarget || scenarioTarget === resource.id,
      });
      points.push(point);
      const series = [...prior, point].slice(-HISTORY_SAMPLES);
      seriesByResource[resource.id] = series;

      const policy = effectivePolicy(resource, policies.find((p) => p.resource_id === resource.id));
      const prediction = generatePrediction(resource, series, policy);
      predictions.push({ resource, prediction });
      if (resource.enabled) anomalies.push(...detectAnomalies(resource, series));

      const ev = lastEvent[resource.id];
      const decision = calculateScalingDecision({
        resource,
        policy,
        latest: point,
        prediction,
        lastEventAt: ev?.at ?? null,
        lastEventAction: ev?.action ?? null,
      });

      const recorded = await recordDecision({
        resource,
        decision,
        riskLevel: prediction.risk_level,
        trigger: "AI",
      });
      summary.decisions_recorded = (summary.decisions_recorded ?? 0) + 1;

      if (
        state.autonomous &&
        resource.enabled &&
        policy.enabled &&
        decision.action !== "hold" &&
        recorded?.execution_key
      ) {
        const result = await executeScalingDecision({
          resource,
          policy,
          decision,
          trigger: "AI",
          provider,
          decisionId: recorded.id,
          executionKey: recorded.execution_key,
        });
        if (result.ok) summary.executions = (summary.executions ?? 0) + 1;
      }
    }

    summary.metrics_written = await persistMetrics(points);
    summary.predictions_written = await persistPredictions(predictions);
    summary.alerts_created = await persistAnomalyAlerts(anomalies);

    costTick += 1;
    if (costTick >= COST_EVERY_TICKS) {
      costTick = 0;
      summary.cost_snapshots = await calculateCostSnapshot(
        resources.map((r) => ({ resource: r, series: seriesByResource[r.id] ?? [] })),
      );
    }

    await releaseLock({ tick_count: tick, cost_tick: costTick });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "agent cycle failed";
    console.error("[agent] cycle failed:", message);
    await releaseLock({ tick_count: tick, cost_tick: costTick, error: message });
    return { ran: false, reason: message, tick };
  }
}
