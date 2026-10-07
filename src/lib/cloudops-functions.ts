import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scalingInput = z.object({
  resourceId: z.string().uuid(),
  instances: z.number().int().min(1).max(100),
  reason: z.string().trim().min(1).max(2000),
  trigger: z.enum(["AI", "Manual"]),
});

export const applyScaling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(scalingInput)
  .handler(async ({ data, context }) => {
    const cloudops = await import("@/lib/server/cloudops");
    return cloudops.applyScaling(context.supabase, data);
  });

const policyInput = z.object({
  resourceId: z.string().uuid(),
  minInstances: z.number().int().min(1).max(100).nullable().optional(),
  maxInstances: z.number().int().min(1).max(100).nullable().optional(),
  targetCpu: z.number().min(1).max(99).nullable().optional(),
  targetMemory: z.number().min(1).max(99).nullable().optional(),
  scaleUpCooldown: z.number().int().min(0).max(86400).nullable().optional(),
  scaleDownCooldown: z.number().int().min(0).max(86400).nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});

export const updateScalingPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(policyInput)
  .handler(async ({ data, context }) => {
    const cloudops = await import("@/lib/server/cloudops");
    return cloudops.updateScalingPolicy(context.supabase, data);
  });

const resourceEnabledInput = z.object({
  resourceId: z.string().uuid(),
  enabled: z.boolean(),
});

export const setResourceEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(resourceEnabledInput)
  .handler(async ({ data, context }) => {
    const cloudops = await import("@/lib/server/cloudops");
    return cloudops.setResourceEnabled(context.supabase, data);
  });
