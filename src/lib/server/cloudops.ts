import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ScalingPolicy } from "@/lib/types";

type AuthenticatedSupabase = SupabaseClient<Database>;

export interface ApplyScalingInput {
  resourceId: string;
  instances: number;
  reason: string;
  trigger: "AI" | "Manual";
}

export type ApplyScalingResult =
  Database["public"]["Functions"]["apply_scaling"]["Returns"][number];

export interface UpdateScalingPolicyInput {
  resourceId: string;
  minInstances?: number | null | undefined;
  maxInstances?: number | null | undefined;
  targetCpu?: number | null | undefined;
  targetMemory?: number | null | undefined;
  scaleUpCooldown?: number | null | undefined;
  scaleDownCooldown?: number | null | undefined;
  enabled?: boolean | null | undefined;
}

export interface SetResourceEnabledInput {
  resourceId: string;
  enabled: boolean;
}

export async function applyScaling(
  supabase: AuthenticatedSupabase,
  input: ApplyScalingInput,
): Promise<ApplyScalingResult> {
  const { data: result, error } = await supabase.rpc("apply_scaling", {
    p_resource_id: input.resourceId,
    p_instances: input.instances,
    p_reason: input.reason,
    p_trigger: input.trigger,
  });

  if (error) throw new Error(`Scaling operation failed: ${error.message}`);

  const operation = result?.[0];
  if (!operation) throw new Error("Scaling operation returned no result");

  return operation;
}

export async function updateScalingPolicy(
  supabase: AuthenticatedSupabase,
  input: UpdateScalingPolicyInput,
): Promise<ScalingPolicy> {
  const { data: result, error } = await supabase.rpc("update_scaling_policy", {
    p_resource_id: input.resourceId,
    p_min_instances: input.minInstances ?? null,
    p_max_instances: input.maxInstances ?? null,
    p_target_cpu: input.targetCpu ?? null,
    p_target_memory: input.targetMemory ?? null,
    p_scale_up_cooldown: input.scaleUpCooldown ?? null,
    p_scale_down_cooldown: input.scaleDownCooldown ?? null,
    p_enabled: input.enabled ?? null,
  });

  if (error) throw new Error(`Policy update failed: ${error.message}`);
  if (!result) throw new Error("Policy update returned no result");

  return result;
}

export async function setResourceEnabled(
  supabase: AuthenticatedSupabase,
  input: SetResourceEnabledInput,
): Promise<boolean> {
  const { data: result, error } = await supabase.rpc("set_resource_enabled", {
    p_resource_id: input.resourceId,
    p_enabled: input.enabled,
  });

  if (error) throw new Error(`Resource update failed: ${error.message}`);
  if (!result) throw new Error("Resource update returned no result");

  return result.enabled;
}
