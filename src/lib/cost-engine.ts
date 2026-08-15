/**
 * Cost estimation and optimisation logic.
 * All amounts are in INR to match the demonstration currency.
 */

import type { MetricPoint, Resource } from "./types";

export interface ResourceCost {
  resource: Resource;
  hourly: number;
  daily: number;
  monthly: number;
  utilisation: number;
  optimisedInstances: number;
  optimisedMonthly: number;
  saving: number;
  verdict: "optimised" | "over-provisioned" | "idle" | "under-provisioned";
  recommendation: string;
}

export const costForResource = (
  resource: Resource,
  avgCpu: number,
  instances = resource.instance_count,
): ResourceCost => {
  const hourly = resource.hourly_rate * instances;
  const daily = hourly * 24;
  const monthly = daily * 30;

  // Instances needed to run at the configured CPU target instead of the
  // current utilisation, never below the policy minimum.
  const needed = Math.max(
    resource.min_instances,
    Math.ceil((instances * (avgCpu / 100)) / (resource.target_cpu / 100)) || resource.min_instances,
  );
  const optimisedInstances = Math.min(instances, needed);
  const optimisedMonthly = resource.hourly_rate * optimisedInstances * 24 * 30;
  const saving = Math.max(0, monthly - optimisedMonthly);

  let verdict: ResourceCost["verdict"] = "optimised";
  let recommendation = `Utilisation of ${avgCpu.toFixed(0)}% sits within the ${resource.target_cpu}% target band. No change recommended.`;

  if (avgCpu < 12) {
    verdict = "idle";
    recommendation = `${resource.name} is effectively idle at ${avgCpu.toFixed(0)}% utilisation. Consider decommissioning it or scheduling it off outside working hours.`;
  } else if (avgCpu < 25 && optimisedInstances < instances) {
    verdict = "over-provisioned";
    recommendation = `${resource.name} is consistently below 25% utilisation. Reduce capacity from ${instances} to ${optimisedInstances} instances during low-traffic periods.`;
  } else if (avgCpu > resource.target_cpu + 15) {
    verdict = "under-provisioned";
    recommendation = `${resource.name} runs at ${avgCpu.toFixed(0)}% against a ${resource.target_cpu}% target. Additional capacity will protect latency during peaks.`;
  }

  return {
    resource,
    hourly,
    daily,
    monthly,
    utilisation: avgCpu,
    optimisedInstances,
    optimisedMonthly,
    saving,
    verdict,
    recommendation,
  };
};

export const averageCpu = (points: MetricPoint[]) =>
  points.length === 0 ? 0 : points.reduce((sum, p) => sum + p.cpu, 0) / points.length;

export const summariseCosts = (costs: ResourceCost[]) => {
  const monthly = costs.reduce((s, c) => s + c.monthly, 0);
  const optimised = costs.reduce((s, c) => s + c.optimisedMonthly, 0);
  return {
    hourly: costs.reduce((s, c) => s + c.hourly, 0),
    daily: costs.reduce((s, c) => s + c.daily, 0),
    monthly,
    optimised,
    saving: Math.max(0, monthly - optimised),
    savingPct: monthly > 0 ? ((monthly - optimised) / monthly) * 100 : 0,
  };
};
