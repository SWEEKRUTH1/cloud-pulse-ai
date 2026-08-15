
-- ===== roles =====
create type public.app_role as enum ('admin','operator','viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;
create policy "orgs readable" on public.organizations for select to authenticated using (true);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text,
  email text,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = user_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles readable" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.can_write()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','operator'))
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare org_id uuid;
begin
  select id into org_id from public.organizations order by created_at limit 1;
  insert into public.profiles (user_id, name, email, organization_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, org_id);
  insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== infrastructure =====
create table public.environments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'healthy',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.environments to authenticated;
grant all on public.environments to service_role;
alter table public.environments enable row level security;
create policy "env read" on public.environments for select to authenticated using (true);
create policy "env write" on public.environments for all to authenticated using (public.can_write()) with check (public.can_write());

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  name text not null,
  resource_type text not null,
  provider text not null default 'demo',
  region text not null default 'ap-south-1',
  status text not null default 'healthy',
  enabled boolean not null default true,
  instance_count int not null default 2,
  min_instances int not null default 1,
  max_instances int not null default 10,
  target_cpu numeric not null default 70,
  target_memory numeric not null default 75,
  hourly_rate numeric not null default 4.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.resources (environment_id);
grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resources to service_role;
alter table public.resources enable row level security;
create policy "res read" on public.resources for select to authenticated using (true);
create policy "res write" on public.resources for all to authenticated using (public.can_write()) with check (public.can_write());

create table public.metrics (
  id bigserial primary key,
  resource_id uuid not null references public.resources(id) on delete cascade,
  timestamp timestamptz not null default now(),
  cpu numeric not null,
  memory numeric not null,
  disk numeric not null default 40,
  network_in numeric not null default 0,
  network_out numeric not null default 0,
  requests numeric not null default 0,
  latency numeric not null default 0,
  error_rate numeric not null default 0,
  connections numeric not null default 0,
  instance_count int not null default 2
);
create index on public.metrics (resource_id, timestamp desc);
grant select, insert, delete on public.metrics to authenticated;
grant all on public.metrics to service_role;
alter table public.metrics enable row level security;
create policy "metrics read" on public.metrics for select to authenticated using (true);
create policy "metrics write" on public.metrics for insert to authenticated with check (public.can_write());
create policy "metrics delete" on public.metrics for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  timestamp timestamptz not null default now(),
  horizon_minutes int not null default 5,
  predicted_load numeric not null,
  confidence numeric not null,
  risk_level text not null,
  recommended_instances int not null,
  reasoning text
);
create index on public.predictions (resource_id, timestamp desc);
grant select, insert, delete on public.predictions to authenticated;
grant all on public.predictions to service_role;
alter table public.predictions enable row level security;
create policy "pred read" on public.predictions for select to authenticated using (true);
create policy "pred write" on public.predictions for insert to authenticated with check (public.can_write());
create policy "pred delete" on public.predictions for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.scaling_policies (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null unique references public.resources(id) on delete cascade,
  min_instances int not null default 2,
  max_instances int not null default 10,
  target_cpu numeric not null default 70,
  target_memory numeric not null default 75,
  scale_up_cooldown int not null default 300,
  scale_down_cooldown int not null default 600,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.scaling_policies to authenticated;
grant all on public.scaling_policies to service_role;
alter table public.scaling_policies enable row level security;
create policy "pol read" on public.scaling_policies for select to authenticated using (true);
create policy "pol write" on public.scaling_policies for all to authenticated using (public.can_write()) with check (public.can_write());

create table public.scaling_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  timestamp timestamptz not null default now(),
  action text not null,
  previous_instances int not null,
  new_instances int not null,
  reason text,
  trigger text not null default 'AI',
  status text not null default 'completed'
);
create index on public.scaling_events (timestamp desc);
grant select, insert, update, delete on public.scaling_events to authenticated;
grant all on public.scaling_events to service_role;
alter table public.scaling_events enable row level security;
create policy "sev read" on public.scaling_events for select to authenticated using (true);
create policy "sev write" on public.scaling_events for all to authenticated using (public.can_write()) with check (public.can_write());

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references public.resources(id) on delete cascade,
  alert_type text not null default 'anomaly',
  severity text not null,
  title text not null,
  description text,
  status text not null default 'active',
  acknowledged_by uuid,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
create index on public.alerts (created_at desc);
grant select, insert, update, delete on public.alerts to authenticated;
grant all on public.alerts to service_role;
alter table public.alerts enable row level security;
create policy "alert read" on public.alerts for select to authenticated using (true);
create policy "alert write" on public.alerts for all to authenticated using (public.can_write()) with check (public.can_write());

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  message text,
  type text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text not null,
  resource_type text,
  resource_id text,
  details text,
  status text not null default 'success',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit read" on public.audit_logs for select to authenticated using (true);
create policy "audit insert" on public.audit_logs for insert to authenticated with check (auth.uid() = user_id);

create table public.cost_records (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  timestamp timestamptz not null default now(),
  hourly_cost numeric not null,
  daily_cost numeric not null,
  monthly_estimate numeric not null
);
create index on public.cost_records (resource_id, timestamp desc);
grant select, insert, delete on public.cost_records to authenticated;
grant all on public.cost_records to service_role;
alter table public.cost_records enable row level security;
create policy "cost read" on public.cost_records for select to authenticated using (true);
create policy "cost write" on public.cost_records for all to authenticated using (public.can_write()) with check (public.can_write());

alter publication supabase_realtime add table public.metrics;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.scaling_events;
alter publication supabase_realtime add table public.resources;

-- ===== seed demo data =====
insert into public.organizations (id, name) values ('11111111-1111-1111-1111-111111111111','CloudOps Demo');

insert into public.environments (id, organization_id, name, description) values
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Production','Live customer-facing workloads'),
 ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Staging','Pre-release verification'),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Development','Engineering sandbox'),
 ('22222222-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Testing','Automated test infrastructure');

insert into public.resources (id, environment_id, name, resource_type, provider, region, status, instance_count, min_instances, max_instances, target_cpu, target_memory, hourly_rate) values
 ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','Production API Server','EC2','aws','ap-south-1','healthy',4,2,10,70,75,6.4),
 ('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','Production Worker','Kubernetes Pod','kubernetes','ap-south-1','healthy',3,2,12,65,70,3.8),
 ('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','Production Database','Database','aws','ap-south-1','warning',2,2,4,75,80,12.5),
 ('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','Production Load Balancer','Load Balancer','aws','ap-south-1','healthy',2,2,6,60,65,2.9),
 ('33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000002','Staging API','EC2','aws','ap-south-1','healthy',2,1,4,70,75,3.1),
 ('33333333-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000003','Development API','Container','kubernetes','ap-south-1','offline',1,1,3,70,75,1.2);

insert into public.scaling_policies (resource_id, min_instances, max_instances, target_cpu, target_memory)
select id, min_instances, max_instances, target_cpu, target_memory from public.resources;

-- 24h of 2-minute metrics with realistic daily traffic curve
insert into public.metrics (resource_id, timestamp, cpu, memory, disk, network_in, network_out, requests, latency, error_rate, connections, instance_count)
select r.id,
       ts,
       round((base_cpu + 22 * curve + 6 * sin(extract(epoch from ts)/420.0))::numeric, 2),
       round((base_mem + 14 * curve + 4 * sin(extract(epoch from ts)/900.0))::numeric, 2),
       round((38 + 8 * curve)::numeric, 2),
       round((120 + 260 * curve)::numeric, 2),
       round((90 + 210 * curve)::numeric, 2),
       round((base_req * (0.55 + 0.75 * curve))::numeric, 0),
       round((110 + 130 * curve * curve)::numeric, 1),
       round((0.25 + 1.1 * curve * curve)::numeric, 2),
       round((80 + 320 * curve)::numeric, 0),
       r.instance_count
from public.resources r
cross join generate_series(now() - interval '24 hours', now(), interval '2 minutes') as ts
cross join lateral (
  select 0.5 + 0.5 * sin((extract(hour from ts) + extract(minute from ts)/60.0 - 9) * pi() / 12) as curve
) c
cross join lateral (
  select case r.resource_type when 'Database' then 46 when 'Load Balancer' then 28 else 38 end as base_cpu,
         case r.resource_type when 'Database' then 58 else 44 end as base_mem,
         case r.name when 'Production API Server' then 2600 when 'Production Load Balancer' then 3100 when 'Production Worker' then 900 when 'Production Database' then 1400 when 'Staging API' then 320 else 90 end as base_req
) b;

insert into public.cost_records (resource_id, timestamp, hourly_cost, daily_cost, monthly_estimate)
select r.id, ts,
       round((r.hourly_rate * r.instance_count)::numeric,2),
       round((r.hourly_rate * r.instance_count * 24)::numeric,2),
       round((r.hourly_rate * r.instance_count * 24 * 30)::numeric,2)
from public.resources r
cross join generate_series(now() - interval '24 hours', now(), interval '1 hour') as ts;

insert into public.scaling_events (resource_id, timestamp, action, previous_instances, new_instances, reason, trigger, status) values
 ('33333333-0000-0000-0000-000000000001', now() - interval '6 hours','scale_up',3,4,'CPU above target with rising predicted traffic','AI','completed'),
 ('33333333-0000-0000-0000-000000000002', now() - interval '11 hours','scale_up',2,3,'Queue backlog growth detected','AI','completed'),
 ('33333333-0000-0000-0000-000000000001', now() - interval '19 hours','scale_down',5,3,'Sustained low utilisation during off-peak window','AI','completed'),
 ('33333333-0000-0000-0000-000000000005', now() - interval '2 hours','scale_up',1,2,'Manual scale before release verification','Manual','completed');

insert into public.alerts (resource_id, alert_type, severity, title, description, status, created_at) values
 ('33333333-0000-0000-0000-000000000003','high_memory','critical','Memory pressure on Production Database','Memory utilisation sustained above 88% for 10 minutes.','active', now() - interval '18 minutes'),
 ('33333333-0000-0000-0000-000000000001','high_latency','warning','Elevated response latency','p95 latency increased to 284 ms, above the 250 ms threshold.','active', now() - interval '42 minutes'),
 ('33333333-0000-0000-0000-000000000004','traffic_spike','info','Traffic spike absorbed','Request rate increased 62% and was handled without scaling.','active', now() - interval '3 hours'),
 ('33333333-0000-0000-0000-000000000006','resource_failure','critical','Development API offline','No metrics received from the resource for 15 minutes.','acknowledged', now() - interval '5 hours'),
 ('33333333-0000-0000-0000-000000000002','high_cpu','warning','CPU above target','CPU averaged 78% against a 65% target.','resolved', now() - interval '9 hours');
