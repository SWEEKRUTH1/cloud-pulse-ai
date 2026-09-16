-- helper functions (self-scoped, no arguments -> cannot be used to probe other users)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.resource_in_my_org(_resource_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.resources r
    join public.environments e on e.id = r.environment_id
    where r.id = _resource_id
      and e.organization_id = public.current_org_id()
  )
$$;

-- can_write: also require org membership context
create or replace function public.can_write()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','operator'))
$$;

-- profiles
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated
using (user_id = auth.uid() or (organization_id is not null and organization_id = public.current_org_id()));

-- organizations
drop policy if exists "orgs readable" on public.organizations;
create policy "orgs readable" on public.organizations for select to authenticated
using (id = public.current_org_id());

-- user_roles
drop policy if exists "roles readable" on public.user_roles;
create policy "roles readable" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- audit_logs
drop policy if exists "audit read" on public.audit_logs;
create policy "audit read" on public.audit_logs for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- cloud_connections: admin of owning org only
drop policy if exists "cloud_connections_read" on public.cloud_connections;
drop policy if exists "cloud_connections_admin_write" on public.cloud_connections;
create policy "cloud_connections_read" on public.cloud_connections for select to authenticated
using (public.is_admin() and organization_id = public.current_org_id());
create policy "cloud_connections_admin_write" on public.cloud_connections for all to authenticated
using (public.is_admin() and organization_id = public.current_org_id())
with check (public.is_admin() and organization_id = public.current_org_id());

-- cloud_settings
drop policy if exists "cloud_settings_read" on public.cloud_settings;
drop policy if exists "cloud_settings_admin_insert" on public.cloud_settings;
drop policy if exists "cloud_settings_admin_update" on public.cloud_settings;
create policy "cloud_settings_read" on public.cloud_settings for select to authenticated
using (organization_id = public.current_org_id());
create policy "cloud_settings_admin_insert" on public.cloud_settings for insert to authenticated
with check (public.is_admin() and organization_id = public.current_org_id());
create policy "cloud_settings_admin_update" on public.cloud_settings for update to authenticated
using (public.is_admin() and organization_id = public.current_org_id())
with check (public.is_admin() and organization_id = public.current_org_id());

-- environments
drop policy if exists "env read" on public.environments;
drop policy if exists "env write" on public.environments;
create policy "env read" on public.environments for select to authenticated
using (organization_id = public.current_org_id());
create policy "env write" on public.environments for all to authenticated
using (public.can_write() and organization_id = public.current_org_id())
with check (public.can_write() and organization_id = public.current_org_id());

-- resources
drop policy if exists "res read" on public.resources;
drop policy if exists "res write" on public.resources;
create policy "res read" on public.resources for select to authenticated
using (exists (select 1 from public.environments e where e.id = environment_id and e.organization_id = public.current_org_id()));
create policy "res write" on public.resources for all to authenticated
using (public.can_write() and exists (select 1 from public.environments e where e.id = environment_id and e.organization_id = public.current_org_id()))
with check (public.can_write() and exists (select 1 from public.environments e where e.id = environment_id and e.organization_id = public.current_org_id()));

-- metrics
drop policy if exists "metrics read" on public.metrics;
drop policy if exists "metrics delete" on public.metrics;
create policy "metrics read" on public.metrics for select to authenticated
using (public.resource_in_my_org(resource_id));
create policy "metrics delete" on public.metrics for delete to authenticated
using (public.is_admin() and public.resource_in_my_org(resource_id));

-- predictions
drop policy if exists "pred read" on public.predictions;
drop policy if exists "pred delete" on public.predictions;
create policy "pred read" on public.predictions for select to authenticated
using (public.resource_in_my_org(resource_id));
create policy "pred delete" on public.predictions for delete to authenticated
using (public.is_admin() and public.resource_in_my_org(resource_id));

-- cost_records
drop policy if exists "cost read" on public.cost_records;
drop policy if exists "cost read only" on public.cost_records;
create policy "cost read" on public.cost_records for select to authenticated
using (public.resource_in_my_org(resource_id));

-- scaling_policies
drop policy if exists "pol read" on public.scaling_policies;
drop policy if exists "pol write" on public.scaling_policies;
create policy "pol read" on public.scaling_policies for select to authenticated
using (public.resource_in_my_org(resource_id));
create policy "pol write" on public.scaling_policies for all to authenticated
using (public.can_write() and public.resource_in_my_org(resource_id))
with check (public.can_write() and public.resource_in_my_org(resource_id));

-- scaling_events
drop policy if exists "sev read" on public.scaling_events;
drop policy if exists "sev write" on public.scaling_events;
create policy "sev read" on public.scaling_events for select to authenticated
using (public.resource_in_my_org(resource_id));
create policy "sev write" on public.scaling_events for all to authenticated
using (public.can_write() and public.resource_in_my_org(resource_id))
with check (public.can_write() and public.resource_in_my_org(resource_id));

-- scaling_decisions
drop policy if exists "scaling_decisions read" on public.scaling_decisions;
create policy "scaling_decisions read" on public.scaling_decisions for select to authenticated
using (public.resource_in_my_org(resource_id));

-- alerts
drop policy if exists "alert read" on public.alerts;
drop policy if exists "alert write" on public.alerts;
create policy "alert read" on public.alerts for select to authenticated
using (resource_id is not null and public.resource_in_my_org(resource_id));
create policy "alert write" on public.alerts for all to authenticated
using (public.can_write() and resource_id is not null and public.resource_in_my_org(resource_id))
with check (public.can_write() and resource_id is not null and public.resource_in_my_org(resource_id));

-- lock down direct execution of privileged helpers
revoke all on function public.has_role(uuid, public.app_role) from anon, authenticated, public;
revoke all on function public.can_write() from anon, public;
revoke all on function public.is_admin() from anon, public;
revoke all on function public.current_org_id() from anon, public;
revoke all on function public.resource_in_my_org(uuid) from anon, public;
revoke all on function public.audit_scaling_event() from anon, authenticated, public;
revoke all on function public.handle_new_user() from anon, authenticated, public;
revoke all on function public.enforce_policy_bounds() from anon, authenticated, public;
revoke all on function public.enforce_resource_bounds() from anon, authenticated, public;
revoke all on function public.touch_updated_at() from anon, authenticated, public;

grant execute on function public.can_write() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.resource_in_my_org(uuid) to authenticated;