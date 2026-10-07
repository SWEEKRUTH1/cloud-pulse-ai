code supabase\migrations\20260906100000_phase1_tenant_ownership.sql-- Phase 1: organization isolation and trusted CloudOps operations.
-- Cloud provider execution remains deliberately simulated until a later phase.

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.user_in_current_organization(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
    and exists (
      select 1
      from public.profiles target_profile
      where target_profile.user_id = target_user_id
        and target_profile.organization_id = public.current_user_organization_id()
    )
$$;

create or replace function public.resource_in_current_organization(target_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_resource_id is not null
    and exists (
      select 1
      from public.resources resource
      join public.environments environment on environment.id = resource.environment_id
      where resource.id = target_resource_id
        and environment.organization_id = public.current_user_organization_id()
    )
$$;

create or replace function public.environment_in_current_organization(target_environment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_environment_id is not null
    and exists (
      select 1
      from public.environments environment
      where environment.id = target_environment_id
        and environment.organization_id = public.current_user_organization_id()
    )
$$;

create or replace function public.can_manage_current_organization()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles role
    where role.user_id = auth.uid()
      and role.role in ('admin', 'operator')
  )
$$;

create or replace function public.can_admin_current_organization()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles role
    where role.user_id = auth.uid()
      and role.role = 'admin'
  )
$$;

-- New accounts bootstrap their own organization. They are never attached to an
-- existing organization's first row. Future invitations can assign membership
-- explicitly through a trusted service.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'cloudops-user'), '@', 1));
  insert into public.organizations (name)
  values (display_name || '''s CloudOps')
  returning id into new_organization_id;

  insert into public.profiles (user_id, name, email, organization_id)
  values (new.id, display_name, new.email, new_organization_id);

  insert into public.user_roles (user_id, role)
  values (new.id, 'admin')
  on conflict do nothing;

  return new;
end;
$$;

-- Remove the old broad policies before installing organization-scoped policies.
drop policy if exists "orgs readable" on public.organizations;
drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "roles readable" on public.user_roles;
drop policy if exists "env read" on public.environments;
drop policy if exists "env write" on public.environments;
drop policy if exists "res read" on public.resources;
drop policy if exists "res write" on public.resources;
drop policy if exists "metrics read" on public.metrics;
drop policy if exists "metrics write" on public.metrics;
drop policy if exists "metrics delete" on public.metrics;
drop policy if exists "pred read" on public.predictions;
drop policy if exists "pred write" on public.predictions;
drop policy if exists "pred delete" on public.predictions;
drop policy if exists "pol read" on public.scaling_policies;
drop policy if exists "pol write" on public.scaling_policies;
drop policy if exists "sev read" on public.scaling_events;
drop policy if exists "sev write" on public.scaling_events;
drop policy if exists "alert read" on public.alerts;
drop policy if exists "alert write" on public.alerts;
drop policy if exists "own notifications" on public.notifications;
drop policy if exists "audit read" on public.audit_logs;
drop policy if exists "audit insert" on public.audit_logs;
drop policy if exists "cost read" on public.cost_records;
drop policy if exists "cost write" on public.cost_records;
drop policy if exists "cloud_settings_read" on public.cloud_settings;
drop policy if exists "cloud_settings_admin_insert" on public.cloud_settings;
drop policy if exists "cloud_settings_admin_update" on public.cloud_settings;
drop policy if exists "cloud_connections_read" on public.cloud_connections;
drop policy if exists "cloud_connections_admin_write" on public.cloud_connections;

create policy "organizations own organization read" on public.organizations
for select to authenticated
using (id = public.current_user_organization_id());

create policy "profiles same organization read" on public.profiles
for select to authenticated
using (public.user_in_current_organization(user_id));
create policy "profiles own update" on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and organization_id = public.current_user_organization_id());
create policy "profiles own insert" on public.profiles
for insert to authenticated
with check (user_id = auth.uid() and organization_id = public.current_user_organization_id());

create policy "roles same organization read" on public.user_roles
for select to authenticated
using (public.user_in_current_organization(user_id));

create policy "environments same organization read" on public.environments
for select to authenticated
using (organization_id = public.current_user_organization_id());
create policy "environments same organization manage" on public.environments
for all to authenticated
using (organization_id = public.current_user_organization_id() and public.can_manage_current_organization())
with check (organization_id = public.current_user_organization_id() and public.can_manage_current_organization());

create policy "resources same organization read" on public.resources
for select to authenticated
using (public.environment_in_current_organization(environment_id));
create policy "resources same organization manage" on public.resources
for all to authenticated
using (public.environment_in_current_organization(environment_id) and public.can_manage_current_organization())
with check (public.environment_in_current_organization(environment_id) and public.can_manage_current_organization());

create policy "metrics same organization read" on public.metrics
for select to authenticated
using (public.resource_in_current_organization(resource_id));
create policy "metrics same organization insert" on public.metrics
for insert to authenticated
with check (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization());
create policy "metrics same organization delete" on public.metrics
for delete to authenticated
using (public.resource_in_current_organization(resource_id) and public.can_admin_current_organization());

create policy "predictions same organization read" on public.predictions
for select to authenticated
using (public.resource_in_current_organization(resource_id));
create policy "predictions same organization insert" on public.predictions
for insert to authenticated
with check (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization());
create policy "predictions same organization delete" on public.predictions
for delete to authenticated
using (public.resource_in_current_organization(resource_id) and public.can_admin_current_organization());

create policy "policies same organization read" on public.scaling_policies
for select to authenticated
using (public.resource_in_current_organization(resource_id));
create policy "policies same organization manage" on public.scaling_policies
for all to authenticated
using (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization())
with check (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization());

create policy "scaling events same organization read" on public.scaling_events
for select to authenticated
using (public.resource_in_current_organization(resource_id));
create policy "scaling events same organization manage" on public.scaling_events
for all to authenticated
using (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization())
with check (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization());

create policy "alerts same organization read" on public.alerts
for select to authenticated
using (resource_id is null or public.resource_in_current_organization(resource_id));
create policy "alerts same organization manage" on public.alerts
for all to authenticated
using ((resource_id is null or public.resource_in_current_organization(resource_id)) and public.can_manage_current_organization())
with check ((resource_id is null or public.resource_in_current_organization(resource_id)) and public.can_manage_current_organization());

create policy "notifications own rows" on public.notifications
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "audit same organization read" on public.audit_logs
for select to authenticated
using (user_id is null or public.user_in_current_organization(user_id));
create policy "audit own insert" on public.audit_logs
for insert to authenticated
with check (user_id = auth.uid());

create policy "cost same organization read" on public.cost_records
for select to authenticated
using (public.resource_in_current_organization(resource_id));
create policy "cost same organization manage" on public.cost_records
for all to authenticated
using (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization())
with check (public.resource_in_current_organization(resource_id) and public.can_manage_current_organization());

create policy "cloud settings same organization read" on public.cloud_settings
for select to authenticated
using (organization_id = public.current_user_organization_id());
create policy "cloud settings same organization admin write" on public.cloud_settings
for all to authenticated
using (organization_id = public.current_user_organization_id() and public.can_admin_current_organization())
with check (organization_id = public.current_user_organization_id() and public.can_admin_current_organization());

create policy "cloud connections same organization read" on public.cloud_connections
for select to authenticated
using (organization_id = public.current_user_organization_id());
create policy "cloud connections same organization admin write" on public.cloud_connections
for all to authenticated
using (organization_id = public.current_user_organization_id() and public.can_admin_current_organization())
with check (organization_id = public.current_user_organization_id() and public.can_admin_current_organization());

-- Trusted, atomic simulated scaling operation. The provider boundary remains
-- deliberately simulated; this function only changes demo resource state.
create or replace function public.apply_scaling(
  p_resource_id uuid,
  p_instances integer,
  p_reason text,
  p_trigger text
)
returns table (
  resource_id uuid,
  previous_instances integer,
  new_instances integer,
  action text,
  event_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_resource public.resources%rowtype;
  policy_row public.scaling_policies%rowtype;
  new_action text;
  new_event_id uuid;
begin
  if auth.uid() is null or not public.can_manage_current_organization() then
    raise exception using errcode = '42501', message = 'You are not authorized to scale this resource';
  end if;
  if p_instances is null or p_instances < 1 then
    raise exception using errcode = '22023', message = 'Instance count must be at least 1';
  end if;
  if length(coalesce(trim(p_reason), '')) = 0 or length(p_reason) > 2000 then
    raise exception using errcode = '22023', message = 'A scaling reason between 1 and 2000 characters is required';
  end if;
  if p_trigger not in ('AI', 'Manual') then
    raise exception using errcode = '22023', message = 'Invalid scaling trigger';
  end if;

  select * into locked_resource
  from public.resources
  where id = p_resource_id
  for update;
  if not found or not public.environment_in_current_organization(locked_resource.environment_id) then
    raise exception using errcode = 'P0002', message = 'Resource not found in your organization';
  end if;

  select * into policy_row
  from public.scaling_policies
  where resource_id = p_resource_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Scaling policy not found';
  end if;
  if p_instances < policy_row.min_instances or p_instances > policy_row.max_instances then
    raise exception using errcode = '22023', message = 'Requested capacity is outside the scaling policy bounds';
  end if;
  if p_instances = locked_resource.instance_count then
    raise exception using errcode = '22023', message = 'Resource is already at the requested capacity';
  end if;

  new_action := case when p_instances > locked_resource.instance_count then 'scale_up' else 'scale_down' end;
  update public.resources
  set instance_count = p_instances, updated_at = now()
  where id = p_resource_id;

  insert into public.scaling_events (
    resource_id, action, previous_instances, new_instances, reason, trigger, status
  ) values (
    p_resource_id, new_action, locked_resource.instance_count, p_instances, p_reason, p_trigger, 'simulated'
  ) returning id into new_event_id;

  insert into public.audit_logs (
    organization_id, user_id, user_email, action, resource_type, resource_id, details, status
  ) values (
    public.current_user_organization_id(), auth.uid(), (select email from auth.users where id = auth.uid()), 'scaling.apply', 'resource', p_resource_id::text,
    jsonb_build_object(
      'organization_id', public.current_user_organization_id(),
      'previous_instances', locked_resource.instance_count,
      'new_instances', p_instances,
      'trigger', p_trigger,
      'reason', p_reason
    )::text,
    'success'
  );

  return query select p_resource_id, locked_resource.instance_count, p_instances, new_action, new_event_id;
end;
$$;

create or replace function public.update_scaling_policy(
  p_resource_id uuid,
  p_min_instances integer default null,
  p_max_instances integer default null,
  p_target_cpu numeric default null,
  p_target_memory numeric default null,
  p_scale_up_cooldown integer default null,
  p_scale_down_cooldown integer default null,
  p_enabled boolean default null
)
returns public.scaling_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_resource public.resources%rowtype;
  old_policy public.scaling_policies%rowtype;
  updated_policy public.scaling_policies%rowtype;
  next_min integer;
  next_max integer;
begin
  if auth.uid() is null or not public.can_manage_current_organization() then
    raise exception using errcode = '42501', message = 'You are not authorized to update scaling policy';
  end if;

  select * into locked_resource from public.resources where id = p_resource_id for update;
  if not found or not public.environment_in_current_organization(locked_resource.environment_id) then
    raise exception using errcode = 'P0002', message = 'Resource not found in your organization';
  end if;
  select * into old_policy from public.scaling_policies where resource_id = p_resource_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Scaling policy not found';
  end if;

  next_min := coalesce(p_min_instances, old_policy.min_instances);
  next_max := coalesce(p_max_instances, old_policy.max_instances);
  if next_min < 1 or next_max < next_min or next_max > 100 then
    raise exception using errcode = '22023', message = 'Invalid scaling policy bounds';
  end if;
  if coalesce(p_target_cpu, old_policy.target_cpu) < 1 or coalesce(p_target_cpu, old_policy.target_cpu) > 99
     or coalesce(p_target_memory, old_policy.target_memory) < 1 or coalesce(p_target_memory, old_policy.target_memory) > 99 then
    raise exception using errcode = '22023', message = 'Target utilization must be between 1 and 99';
  end if;
  if coalesce(p_scale_up_cooldown, old_policy.scale_up_cooldown) < 0
     or coalesce(p_scale_down_cooldown, old_policy.scale_down_cooldown) < 0 then
    raise exception using errcode = '22023', message = 'Cooldown values cannot be negative';
  end if;

  update public.scaling_policies
  set min_instances = next_min,
      max_instances = next_max,
      target_cpu = coalesce(p_target_cpu, target_cpu),
      target_memory = coalesce(p_target_memory, target_memory),
      scale_up_cooldown = coalesce(p_scale_up_cooldown, scale_up_cooldown),
      scale_down_cooldown = coalesce(p_scale_down_cooldown, scale_down_cooldown),
      enabled = coalesce(p_enabled, enabled),
      updated_at = now()
  where resource_id = p_resource_id
  returning * into updated_policy;

  update public.resources
  set min_instances = updated_policy.min_instances,
      max_instances = updated_policy.max_instances,
      target_cpu = updated_policy.target_cpu,
      target_memory = updated_policy.target_memory,
      updated_at = now()
  where id = p_resource_id;

  insert into public.audit_logs (
    organization_id, user_id, user_email, action, resource_type, resource_id, details, status
  ) values (
    public.current_user_organization_id(), auth.uid(), (select email from auth.users where id = auth.uid()), 'scaling_policy.update', 'resource', p_resource_id::text,
    jsonb_build_object('previous', to_jsonb(old_policy), 'new', to_jsonb(updated_policy))::text,
    'success'
  );

  return updated_policy;
end;
$$;

create or replace function public.set_resource_enabled(
  p_resource_id uuid,
  p_enabled boolean
)
returns public.resources
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_resource public.resources%rowtype;
  updated_resource public.resources%rowtype;
begin
  if auth.uid() is null or not public.can_manage_current_organization() then
    raise exception using errcode = '42501', message = 'You are not authorized to update this resource';
  end if;
  select * into locked_resource from public.resources where id = p_resource_id for update;
  if not found or not public.environment_in_current_organization(locked_resource.environment_id) then
    raise exception using errcode = 'P0002', message = 'Resource not found in your organization';
  end if;

  update public.resources
  set enabled = p_enabled, updated_at = now()
  where id = p_resource_id
  returning * into updated_resource;

  insert into public.audit_logs (
    organization_id, user_id, user_email, action, resource_type, resource_id, details, status
  ) values (
    public.current_user_organization_id(), auth.uid(), (select email from auth.users where id = auth.uid()), 'resource.monitoring_update', 'resource', p_resource_id::text,
    jsonb_build_object('previous_enabled', locked_resource.enabled, 'new_enabled', p_enabled)::text,
    'success'
  );

  return updated_resource;
end;
$$;

revoke all on function public.current_user_organization_id() from public, anon;
revoke all on function public.user_in_current_organization(uuid) from public, anon;
revoke all on function public.resource_in_current_organization(uuid) from public, anon;
revoke all on function public.environment_in_current_organization(uuid) from public, anon;
revoke all on function public.can_manage_current_organization() from public, anon;
revoke all on function public.can_admin_current_organization() from public, anon;
revoke all on function public.apply_scaling(uuid, integer, text, text) from public, anon;
revoke all on function public.update_scaling_policy(uuid, integer, integer, numeric, numeric, integer, integer, boolean) from public, anon;
revoke all on function public.set_resource_enabled(uuid, boolean) from public, anon;
grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.user_in_current_organization(uuid) to authenticated;
grant execute on function public.resource_in_current_organization(uuid) to authenticated;
grant execute on function public.environment_in_current_organization(uuid) to authenticated;
grant execute on function public.can_manage_current_organization() to authenticated;
grant execute on function public.can_admin_current_organization() to authenticated;
grant execute on function public.apply_scaling(uuid, integer, text, text) to authenticated;
grant execute on function public.update_scaling_policy(uuid, integer, integer, numeric, numeric, integer, integer, boolean) to authenticated;
grant execute on function public.set_resource_enabled(uuid, boolean) to authenticated;
