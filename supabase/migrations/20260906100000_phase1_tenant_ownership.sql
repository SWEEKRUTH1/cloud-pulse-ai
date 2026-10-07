code supabase\tests\phase1_security.sql-- Phase 1 follow-up: explicit ownership for alerts and audit records.
-- Orphaned legacy rows remain inaccessible until an administrator assigns ownership.

alter table public.alerts
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.audit_logs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.alerts alert
set organization_id = environment.organization_id
from public.resources resource
join public.environments environment on environment.id = resource.environment_id
where alert.resource_id = resource.id
  and alert.organization_id is null;

update public.audit_logs audit
set organization_id = profile.organization_id
from public.profiles profile
where audit.user_id = profile.user_id
  and audit.organization_id is null
  and profile.organization_id is not null;

update public.audit_logs audit
set organization_id = environment.organization_id
from public.resources resource
join public.environments environment on environment.id = resource.environment_id
where audit.resource_id = resource.id::text
  and audit.organization_id is null;

-- NOT VALID preserves any legacy orphan rows while enforcing ownership on all
-- new and updated records. The constraint can be validated after remediation.
alter table public.alerts
  add constraint alerts_organization_id_required
  check (organization_id is not null) not valid;

alter table public.audit_logs
  add constraint audit_logs_organization_id_required
  check (organization_id is not null) not valid;

create index if not exists alerts_organization_id_created_at_idx
  on public.alerts (organization_id, created_at desc);
create index if not exists audit_logs_organization_id_created_at_idx
  on public.audit_logs (organization_id, created_at desc);

drop policy if exists "alerts same organization read" on public.alerts;
drop policy if exists "alerts same organization manage" on public.alerts;
drop policy if exists "audit same organization read" on public.audit_logs;
drop policy if exists "audit own insert" on public.audit_logs;

create policy "alerts owned organization read" on public.alerts
for select to authenticated
using (
  organization_id is not null
  and organization_id = public.current_user_organization_id()
);

create policy "alerts owned organization manage" on public.alerts
for all to authenticated
using (
  organization_id is not null
  and organization_id = public.current_user_organization_id()
  and public.can_manage_current_organization()
)
with check (
  organization_id is not null
  and organization_id = public.current_user_organization_id()
  and public.can_manage_current_organization()
  and (resource_id is null or public.resource_in_current_organization(resource_id))
);

create policy "audit owned organization read" on public.audit_logs
for select to authenticated
using (
  organization_id is not null
  and organization_id = public.current_user_organization_id()
);

create policy "audit owned organization insert" on public.audit_logs
for insert to authenticated
with check (
  organization_id is not null
  and organization_id = public.current_user_organization_id()
  and user_id = auth.uid()
);

-- Keep orphaned legacy rows for investigation, but make them inaccessible to
-- authenticated users until ownership is explicitly repaired.
