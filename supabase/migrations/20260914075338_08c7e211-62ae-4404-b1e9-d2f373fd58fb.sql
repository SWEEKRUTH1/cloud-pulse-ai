-- 1. Safe default role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  org_id uuid;
  existing_count integer;
begin
  select id into org_id from public.organizations order by created_at limit 1;
  insert into public.profiles (user_id, name, email, organization_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, org_id);

  select count(*) into existing_count from public.user_roles;
  insert into public.user_roles (user_id, role)
  values (new.id, case when existing_count = 0 then 'admin'::app_role else 'viewer'::app_role end)
  on conflict do nothing;
  return new;
end;
$function$;

-- 2. Agent state (single row, doubles as an execution lock)
CREATE TABLE public.agent_state (
  id text PRIMARY KEY DEFAULT 'global',
  tick_count bigint NOT NULL DEFAULT 0,
  last_tick_at timestamp with time zone,
  running boolean NOT NULL DEFAULT false,
  locked_at timestamp with time zone,
  last_error text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_state TO authenticated;
GRANT ALL ON public.agent_state TO service_role;
ALTER TABLE public.agent_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_state read" ON public.agent_state FOR SELECT TO authenticated USING (true);
INSERT INTO public.agent_state (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- 3. Simulation state (server-side scenario injection)
CREATE TABLE public.simulation_state (
  id text PRIMARY KEY DEFAULT 'global',
  scenario text NOT NULL DEFAULT 'normal',
  target_resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  started_tick bigint NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.simulation_state TO authenticated;
GRANT ALL ON public.simulation_state TO service_role;
ALTER TABLE public.simulation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulation_state read" ON public.simulation_state FOR SELECT TO authenticated USING (true);
INSERT INTO public.simulation_state (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- 4. Recorded scaling decisions with idempotent execution keys
CREATE TABLE public.scaling_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_instances integer NOT NULL,
  new_instances integer NOT NULL,
  reason text,
  blocked_by_cooldown boolean NOT NULL DEFAULT false,
  risk_level text,
  trigger text NOT NULL DEFAULT 'AI',
  executed boolean NOT NULL DEFAULT false,
  execution_key text UNIQUE,
  requested_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scaling_decisions TO authenticated;
GRANT ALL ON public.scaling_decisions TO service_role;
ALTER TABLE public.scaling_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scaling_decisions read" ON public.scaling_decisions FOR SELECT TO authenticated USING (true);
CREATE INDEX scaling_decisions_resource_created_idx ON public.scaling_decisions (resource_id, created_at DESC);

-- 5. Idempotency for executions
ALTER TABLE public.scaling_events ADD COLUMN execution_key text;
CREATE UNIQUE INDEX scaling_events_execution_key_uniq
  ON public.scaling_events (execution_key) WHERE execution_key IS NOT NULL;

-- 6. Database-level safety enforcement
CREATE OR REPLACE FUNCTION public.enforce_resource_bounds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if NEW.min_instances < 1 then
    raise exception 'min_instances must be at least 1';
  end if;
  if NEW.min_instances > NEW.max_instances then
    raise exception 'min_instances (%) cannot exceed max_instances (%)', NEW.min_instances, NEW.max_instances;
  end if;
  if NEW.instance_count < NEW.min_instances or NEW.instance_count > NEW.max_instances then
    raise exception 'instance_count % is outside the allowed range %-%', NEW.instance_count, NEW.min_instances, NEW.max_instances;
  end if;
  if NEW.target_cpu < 20 or NEW.target_cpu > 95 or NEW.target_memory < 20 or NEW.target_memory > 98 then
    raise exception 'target utilisation values are outside the safe range';
  end if;
  return NEW;
end;
$function$;
CREATE TRIGGER resources_enforce_bounds
  BEFORE INSERT OR UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_resource_bounds();

CREATE OR REPLACE FUNCTION public.enforce_policy_bounds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if NEW.min_instances < 1 or NEW.min_instances > NEW.max_instances then
    raise exception 'invalid instance bounds %-%', NEW.min_instances, NEW.max_instances;
  end if;
  if NEW.target_cpu < 20 or NEW.target_cpu > 95 or NEW.target_memory < 20 or NEW.target_memory > 98 then
    raise exception 'target utilisation values are outside the safe range';
  end if;
  if NEW.scale_up_cooldown < 30 or NEW.scale_down_cooldown < 30 then
    raise exception 'cooldowns must be at least 30 seconds';
  end if;
  return NEW;
end;
$function$;
CREATE TRIGGER scaling_policies_enforce_bounds
  BEFORE INSERT OR UPDATE ON public.scaling_policies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_policy_bounds();

-- 7. Scaling executions land in the unified audit trail
CREATE OR REPLACE FUNCTION public.audit_scaling_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.audit_logs (user_id, user_email, action, resource_type, resource_id, details, status)
  values (
    null,
    NEW.trigger,
    'scaling.' || NEW.action,
    'resource',
    NEW.resource_id::text,
    format('%s → %s instances (%s). %s', NEW.previous_instances, NEW.new_instances, NEW.trigger, coalesce(NEW.reason, '')),
    case when NEW.status = 'completed' then 'success' else NEW.status end
  );
  return NEW;
end;
$function$;
CREATE TRIGGER scaling_events_audit
  AFTER INSERT ON public.scaling_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_scaling_event();

-- 8. Only the backend may write telemetry, forecasts and cost snapshots
DROP POLICY IF EXISTS "metrics write" ON public.metrics;
DROP POLICY IF EXISTS "pred write" ON public.predictions;
DROP POLICY IF EXISTS "cost write" ON public.cost_records;
CREATE POLICY "cost read only" ON public.cost_records FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE ON public.metrics FROM authenticated;
REVOKE INSERT, UPDATE ON public.predictions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cost_records FROM authenticated;

-- 9. Default cloud mode row per organisation
INSERT INTO public.cloud_settings (organization_id, mode)
SELECT o.id, 'demo' FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.cloud_settings cs WHERE cs.organization_id = o.id);