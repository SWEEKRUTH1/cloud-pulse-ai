import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { detectAnomalies, statusFromMetrics } from "@/lib/anomaly-detection";
import { predictWorkload } from "@/lib/prediction-engine";
import { decideScaling } from "@/lib/scaling-engine";
import type {
  Anomaly,
  Environment,
  MetricPoint,
  PredictionResult,
  Resource,
  ScalingDecision,
  ScalingPolicy,
} from "@/lib/types";

export type Scenario = "normal" | "traffic_spike" | "memory_leak" | "latency_storm" | "outage";

export interface ResourceState {
  resource: Resource;
  series: MetricPoint[];
  latest: MetricPoint;
  status: "healthy" | "warning" | "critical" | "offline";
  prediction: PredictionResult;
  decision: ScalingDecision;
  anomalies: Anomaly[];
  policy: ScalingPolicy | null;
}

interface LiveState {
  loading: boolean;
  error: string | null;
  environments: Environment[];
  environmentId: string | null;
  setEnvironmentId: (id: string) => void;
  resources: ResourceState[];
  allResources: ResourceState[];
  paused: boolean;
  setPaused: (p: boolean) => void;
  autoScaling: boolean;
  setAutoScaling: (v: boolean) => void;
  scenario: Scenario;
  runScenario: (s: Scenario, resourceId?: string) => void;
  tickCount: number;
  applyScaling: (resourceId: string, instances: number, reason: string, trigger: string) => Promise<void>;
  toggleResource: (resourceId: string, enabled: boolean) => Promise<void>;
  updatePolicy: (resourceId: string, patch: Partial<ScalingPolicy>) => Promise<void>;
  reload: () => Promise<void>;
}

const LiveContext = createContext<LiveState | null>(null);

const TICK_MS = 3000;
const MAX_POINTS = 120;

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Deterministic-ish traffic wave so charts look like real diurnal load. */
function wave(tick: number, offset: number) {
  return (
    Math.sin((tick + offset) / 22) * 0.5 + Math.sin((tick + offset) / 7) * 0.18 + 1
  );
}

function nextPoint(
  prev: MetricPoint,
  resource: Resource,
  tick: number,
  scenario: Scenario,
  scenarioAge: number,
  targeted: boolean,
): MetricPoint {
  const offset = resource.id.charCodeAt(0) % 30;
  const w = wave(tick, offset);
  const active = targeted && scenario !== "normal" && scenarioAge < 40;
  const ramp = active ? clamp(scenarioAge / 8, 0.15, 1) : 0;

  let requests = prev.requests * 0.75 + resource.instance_count * 620 * w * 0.25;
  requests += rnd(-60, 60);
  let cpu = prev.cpu * 0.7 + (requests / Math.max(1, resource.instance_count * 9)) * 0.3;
  let memory = prev.memory * 0.9 + rnd(-1.5, 1.8);
  let latency = prev.latency * 0.8 + (90 + cpu * 1.6) * 0.2 + rnd(-8, 8);
  let errorRate = clamp(prev.error_rate * 0.85 + (cpu > 88 ? rnd(0.2, 1.1) : rnd(-0.1, 0.12)), 0, 22);
  let disk = clamp(prev.disk + rnd(-0.15, 0.2), 12, 96);
  let connections = clamp(prev.connections * 0.8 + requests / 22, 5, 5000);

  if (active) {
    if (scenario === "traffic_spike") {
      requests *= 1 + 2.6 * ramp;
      cpu += 34 * ramp;
      latency *= 1 + 0.9 * ramp;
    }
    if (scenario === "memory_leak") {
      memory += 0.9 * scenarioAge;
      latency *= 1 + 0.35 * ramp;
    }
    if (scenario === "latency_storm") {
      latency *= 1 + 3.2 * ramp;
      errorRate += 3.2 * ramp;
    }
    if (scenario === "outage") {
      requests *= 0.08;
      cpu = 2 + rnd(0, 3);
      errorRate = 40 * ramp;
      latency *= 2.5;
    }
  }

  cpu = clamp(cpu, 1, 99.5);
  memory = clamp(memory, 8, 99);
  latency = clamp(latency, 35, 4000);
  requests = Math.max(0, Math.round(requests));

  return {
    resource_id: resource.id,
    timestamp: new Date().toISOString(),
    cpu: Number(cpu.toFixed(1)),
    memory: Number(memory.toFixed(1)),
    disk: Number(disk.toFixed(1)),
    network_in: Number((requests * 0.0021 + rnd(0, 0.4)).toFixed(2)),
    network_out: Number((requests * 0.0034 + rnd(0, 0.5)).toFixed(2)),
    requests,
    latency: Number(latency.toFixed(0)),
    error_rate: Number(errorRate.toFixed(2)),
    connections: Math.round(connections),
    instance_count: resource.instance_count,
  };
}

function seedPoint(resource: Resource): MetricPoint {
  const requests = Math.round(resource.instance_count * rnd(420, 700));
  const cpu = clamp(requests / Math.max(1, resource.instance_count * 9), 12, 78);
  return {
    resource_id: resource.id,
    timestamp: new Date().toISOString(),
    cpu: Number(cpu.toFixed(1)),
    memory: Number(rnd(38, 72).toFixed(1)),
    disk: Number(rnd(30, 62).toFixed(1)),
    network_in: 1.2,
    network_out: 1.9,
    requests,
    latency: Math.round(110 + cpu * 1.4),
    error_rate: Number(rnd(0, 0.6).toFixed(2)),
    connections: Math.round(requests / 20),
    instance_count: resource.instance_count,
  };
}

function evaluate(
  resource: Resource,
  series: MetricPoint[],
  policy: ScalingPolicy | null,
  lastEventAt: string | null,
  lastEventAction: string | null,
): ResourceState {
  const latest = series[series.length - 1]!;
  const prediction = predictWorkload({
    cpu: latest.cpu,
    memory: latest.memory,
    requests: latest.requests,
    latency: latest.latency,
    error_rate: latest.error_rate,
    instances: resource.instance_count,
    history: series,
    target_cpu: resource.target_cpu,
    min_instances: policy?.min_instances ?? resource.min_instances,
    max_instances: policy?.max_instances ?? resource.max_instances,
  });

  const effectivePolicy: ScalingPolicy = policy ?? {
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
  };

  const decision = decideScaling({
    currentInstances: resource.instance_count,
    cpu: latest.cpu,
    memory: latest.memory,
    policy: effectivePolicy,
    prediction,
    lastEventAt,
    lastEventAction,
  });

  const anomalies = detectAnomalies({
    resourceId: resource.id,
    resourceName: resource.name,
    window: series.slice(-12),
    targetCpu: resource.target_cpu,
  });

  return {
    resource,
    series,
    latest,
    status: resource.enabled ? statusFromMetrics(latest, resource.target_cpu) : "offline",
    prediction,
    decision,
    anomalies,
    policy: effectivePolicy,
  };
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [policies, setPolicies] = useState<ScalingPolicy[]>([]);
  const [seriesMap, setSeriesMap] = useState<Record<string, MetricPoint[]>>({});
  const [paused, setPaused] = useState(false);
  const [autoScaling, setAutoScaling] = useState(true);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [scenarioTarget, setScenarioTarget] = useState<string | null>(null);
  const [scenarioStart, setScenarioStart] = useState(0);
  const [tickCount, setTickCount] = useState(0);
  const lastEvent = useRef<Record<string, { at: string; action: string }>>({});
  const scalingBusy = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [envRes, resRes, polRes, evtRes] = await Promise.all([
        supabase.from("environments").select("*").order("name"),
        supabase.from("resources").select("*").order("name"),
        supabase.from("scaling_policies").select("*"),
        supabase
          .from("scaling_events")
          .select("resource_id,timestamp,action")
          .order("timestamp", { ascending: false })
          .limit(120),
      ]);
      if (envRes.error) throw envRes.error;
      if (resRes.error) throw resRes.error;

      const envs = (envRes.data ?? []) as Environment[];
      const rows = (resRes.data ?? []) as Resource[];
      setEnvironments(envs);
      setResources(rows);
      setPolicies((polRes.data ?? []) as ScalingPolicy[]);
      setEnvironmentId((prev) => prev ?? envs[0]?.id ?? null);

      const seen: Record<string, { at: string; action: string }> = {};
      for (const e of evtRes.data ?? []) {
        if (!seen[e.resource_id]) seen[e.resource_id] = { at: e.timestamp, action: e.action };
      }
      lastEvent.current = seen;

      const { data: metrics } = await supabase
        .from("metrics")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1000);

      const map: Record<string, MetricPoint[]> = {};
      for (const row of (metrics ?? []) as MetricPoint[]) {
        const list = (map[row.resource_id] ??= []);
        if (list.length < 60) list.push(row);
      }
      for (const r of rows) {
        const list = (map[r.id] ?? []).slice().reverse();
        map[r.id] = list.length > 0 ? list : [seedPoint(r)];
      }
      setSeriesMap(map);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load infrastructure");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live telemetry loop
  useEffect(() => {
    if (paused || loading || resources.length === 0) return;
    const id = window.setInterval(() => {
      setTickCount((t) => t + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, loading, resources.length]);

  useEffect(() => {
    if (tickCount === 0 || resources.length === 0) return;
    setSeriesMap((prev) => {
      const next: Record<string, MetricPoint[]> = { ...prev };
      for (const r of resources) {
        const series = prev[r.id] ?? [seedPoint(r)];
        const last = series[series.length - 1]!;
        const targeted = !scenarioTarget || scenarioTarget === r.id;
        const point = r.enabled
          ? nextPoint(last, r, tickCount, scenario, tickCount - scenarioStart, targeted)
          : { ...last, timestamp: new Date().toISOString(), cpu: 0, memory: 0, requests: 0, latency: 0, error_rate: 0 };
        next[r.id] = [...series, point].slice(-MAX_POINTS);
      }
      return next;
    });
  }, [tickCount, resources, scenario, scenarioStart, scenarioTarget]);

  const applyScaling = useCallback(
    async (resourceId: string, instances: number, reason: string, trigger: string) => {
      const resource = resources.find((r) => r.id === resourceId);
      if (!resource || instances === resource.instance_count) return;
      const previous = resource.instance_count;
      const action = instances > previous ? "scale_up" : "scale_down";
      setResources((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, instance_count: instances } : r)),
      );
      lastEvent.current[resourceId] = { at: new Date().toISOString(), action };
      await supabase.from("resources").update({ instance_count: instances }).eq("id", resourceId);
      await supabase.from("scaling_events").insert({
        resource_id: resourceId,
        action,
        previous_instances: previous,
        new_instances: instances,
        reason,
        trigger,
        status: "completed",
      });
    },
    [resources],
  );

  const allResources = useMemo(
    () =>
      resources.map((r) => {
        const series = seriesMap[r.id] ?? [seedPoint(r)];
        const ev = lastEvent.current[r.id];
        return evaluate(r, series, policies.find((p) => p.resource_id === r.id) ?? null, ev?.at ?? null, ev?.action ?? null);
      }),
    [resources, seriesMap, policies],
  );

  // Autonomous scaling executor
  useEffect(() => {
    if (!autoScaling || paused) return;
    for (const state of allResources) {
      const { decision, resource } = state;
      if (decision.action === "hold" || !resource.enabled) continue;
      if (scalingBusy.current.has(resource.id)) continue;
      scalingBusy.current.add(resource.id);
      void applyScaling(resource.id, decision.new_instances, decision.reason, "AI")
        .catch(() => undefined)
        .finally(() => {
          window.setTimeout(() => scalingBusy.current.delete(resource.id), 15000);
        });
    }
  }, [tickCount, autoScaling, paused, allResources, applyScaling]);

  const filtered = useMemo(
    () =>
      environmentId
        ? allResources.filter((r) => r.resource.environment_id === environmentId)
        : allResources,
    [allResources, environmentId],
  );

  const value = useMemo<LiveState>(
    () => ({
      loading,
      error,
      environments,
      environmentId,
      setEnvironmentId,
      resources: filtered,
      allResources,
      paused,
      setPaused,
      autoScaling,
      setAutoScaling,
      scenario,
      runScenario: (s, resourceId) => {
        setScenario(s);
        setScenarioTarget(resourceId ?? null);
        setScenarioStart(tickCount);
        if (s === "normal") setScenarioTarget(null);
      },
      tickCount,
      applyScaling,
      toggleResource: async (resourceId, enabled) => {
        setResources((prev) => prev.map((r) => (r.id === resourceId ? { ...r, enabled } : r)));
        await supabase.from("resources").update({ enabled }).eq("id", resourceId);
      },
      updatePolicy: async (resourceId, patch) => {
        setPolicies((prev) =>
          prev.map((p) => (p.resource_id === resourceId ? { ...p, ...patch } : p)),
        );
        setResources((prev) =>
          prev.map((r) =>
            r.id === resourceId
              ? {
                  ...r,
                  min_instances: patch.min_instances ?? r.min_instances,
                  max_instances: patch.max_instances ?? r.max_instances,
                  target_cpu: patch.target_cpu ?? r.target_cpu,
                  target_memory: patch.target_memory ?? r.target_memory,
                }
              : r,
          ),
        );
        await supabase.from("scaling_policies").update(patch).eq("resource_id", resourceId);
        const resourcePatch: Record<string, number> = {};
        if (patch.min_instances != null) resourcePatch['min_instances'] = patch.min_instances;
        if (patch.max_instances != null) resourcePatch['max_instances'] = patch.max_instances;
        if (patch.target_cpu != null) resourcePatch['target_cpu'] = patch.target_cpu;
        if (patch.target_memory != null) resourcePatch['target_memory'] = patch.target_memory;
        if (Object.keys(resourcePatch).length > 0)
          await supabase.from("resources").update(resourcePatch).eq("id", resourceId);
      },
      reload: load,
    }),
    [
      loading,
      error,
      environments,
      environmentId,
      filtered,
      allResources,
      paused,
      autoScaling,
      scenario,
      tickCount,
      applyScaling,
      load,
    ],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}
