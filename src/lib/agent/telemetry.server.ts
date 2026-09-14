/**
 * Server-side telemetry synthesis.
 *
 * This is the collector that used to run as a browser timer. It is the only
 * place in the system that produces readings, so history no longer depends on
 * an open tab and multiple tabs can never create duplicate rows.
 *
 * Values are SIMULATED (SimulatedProvider). Nothing here talks to a real cloud
 * provider — see cloud-provider.server.ts for the provider boundary.
 */

import type { MetricPoint, Resource } from "@/lib/types";

export type Scenario = "normal" | "traffic_spike" | "memory_leak" | "latency_storm" | "outage";

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function wave(tick: number, offset: number) {
  return Math.sin((tick + offset) / 22) * 0.5 + Math.sin((tick + offset) / 7) * 0.18 + 1;
}

export function seedPoint(resource: Resource): MetricPoint {
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

export function nextPoint(
  prev: MetricPoint,
  resource: Resource,
  tick: number,
  scenario: Scenario,
  scenarioAge: number,
  targeted: boolean,
): MetricPoint {
  if (!resource.enabled) {
    return {
      ...prev,
      resource_id: resource.id,
      timestamp: new Date().toISOString(),
      cpu: 0,
      memory: 0,
      requests: 0,
      latency: 0,
      error_rate: 0,
      connections: 0,
      instance_count: resource.instance_count,
    };
  }

  const offset = resource.id.charCodeAt(0) % 30;
  const w = wave(tick, offset);
  const active = targeted && scenario !== "normal" && scenarioAge >= 0 && scenarioAge < 40;
  const ramp = active ? clamp(scenarioAge / 8, 0.15, 1) : 0;

  let requests = prev.requests * 0.75 + resource.instance_count * 620 * w * 0.25;
  requests += rnd(-60, 60);
  let cpu = prev.cpu * 0.7 + (requests / Math.max(1, resource.instance_count * 9)) * 0.3;
  let memory = prev.memory * 0.9 + rnd(-1.5, 1.8);
  let latency = prev.latency * 0.8 + (90 + cpu * 1.6) * 0.2 + rnd(-8, 8);
  let errorRate = clamp(
    prev.error_rate * 0.85 + (cpu > 88 ? rnd(0.2, 1.1) : rnd(-0.1, 0.12)),
    0,
    22,
  );
  const disk = clamp(prev.disk + rnd(-0.15, 0.2), 12, 96);
  const connections = clamp(prev.connections * 0.8 + requests / 22, 5, 5000);

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
