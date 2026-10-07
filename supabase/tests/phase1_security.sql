begin;

select plan(17);

-- Test fixtures use synthetic JWT subjects and are rolled back at the end.
insert into public.organizations (id, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Phase 1 Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Phase 1 Org B');

insert into public.profiles (user_id, name, email, organization_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Org A Admin', 'a-admin@example.test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Org B Admin', 'b-admin@example.test', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Org A Viewer', 'a-viewer@example.test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

insert into public.user_roles (user_id, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'viewer');

insert into public.environments (id, organization_id, name)
values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A Environment'),
  ('bbbbbbbb-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B Environment');

insert into public.resources (id, environment_id, name, resource_type)
values
  ('aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-111111111111', 'Org A Resource', 'Server'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-1111-1111-1111-111111111111', 'Org B Resource', 'Server');

insert into public.scaling_policies (resource_id, min_instances, max_instances)
values
  ('aaaaaaaa-2222-2222-2222-222222222222', 1, 4),
  ('bbbbbbbb-2222-2222-2222-222222222222', 1, 4);

insert into public.alerts (organization_id, resource_id, severity, title)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-2222-2222-2222-222222222222', 'info', 'Org A alert'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-2222-2222-2222-222222222222', 'info', 'Org B alert'),
  (null, null, 'info', 'Orphan alert');

insert into public.audit_logs (organization_id, user_id, action)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000001', 'org-a.action'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000001', 'org-b.action'),
  (null, null, 'orphan.action');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);

select is((select count(*)::integer from public.resources), 1, 'Org A reads only its resources');
select is((select count(*)::integer from public.alerts), 1, 'Org A reads only owned alerts');
select is((select count(*)::integer from public.audit_logs), 1, 'Org A reads only owned audit records');
select is((select count(*)::integer from public.alerts where title = 'Orphan alert'), 0, 'Orphan alerts are denied');
select is((select count(*)::integer from public.audit_logs where action = 'orphan.action'), 0, 'Orphan audit records are denied');
select throws_ok(
  $$select public.apply_scaling('bbbbbbbb-2222-2222-2222-222222222222', 3, 'cross-org attempt', 'Manual')$$,
  'P0002',
  'Resource not found in your organization',
  'Org A cannot scale an Org B resource'
);
select is((with changed as (
  update public.resources
  set instance_count = 4
  where id = 'bbbbbbbb-2222-2222-2222-222222222222'
  returning 1
) select count(*)::integer from changed), 0, 'Org A cannot modify an Org B resource');
select throws_ok(
  $$select public.apply_scaling('aaaaaaaa-2222-2222-2222-222222222222', 10, 'out of bounds', 'Manual')$$,
  '22023',
  'Requested capacity is outside the scaling policy bounds',
  'Out-of-bounds scaling is rejected'
);
select is((select instance_count from public.resources where id = 'aaaaaaaa-2222-2222-2222-222222222222'), 2, 'Rejected scaling preserves resource state');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.apply_scaling('aaaaaaaa-2222-2222-2222-222222222222', 3, 'viewer attempt', 'Manual')$$,
  '42501',
  'You are not authorized to scale this resource',
  'Viewer cannot scale an owned resource'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
select is((select new_instances from public.apply_scaling(
  'aaaaaaaa-2222-2222-2222-222222222222', 3, 'authorized demo scale', 'Manual'
)), 3, 'Authorized admin can perform simulated scaling');
select is((select count(*)::integer from public.scaling_events where resource_id = 'aaaaaaaa-2222-2222-2222-222222222222' and status = 'simulated'), 1, 'Scaling event is recorded as simulated');
select is((select count(*)::integer from public.audit_logs where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'scaling.apply'), 1, 'Scaling action has an owned audit record');
select lives_ok(
  $$select * from public.update_scaling_policy('aaaaaaaa-2222-2222-2222-222222222222', 1, 4, 70, 75, 300, 600, true)$$,
  'Authorized admin can update a scaling policy'
);
select is((select count(*)::integer from public.audit_logs where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'scaling_policy.update'), 1, 'Policy change has an owned audit record');
select lives_ok(
  $$select * from public.set_resource_enabled('aaaaaaaa-2222-2222-2222-222222222222', false)$$,
  'Authorized admin can update resource monitoring'
);
select is((select count(*)::integer from public.audit_logs where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and action = 'resource.monitoring_update'), 1, 'Resource change has an owned audit record');

select * from finish();
rollback;
