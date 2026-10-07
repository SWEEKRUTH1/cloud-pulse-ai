# CloudOps AI Repository Audit

## Audit method

This audit was performed against the current workspace on 2026-09-17. It inspected the project manifest, README, AGENTS guidance, Vite/TypeScript configuration, route files, authentication and Supabase clients, live state, domain engines, server functions, server-agent modules, AI visual component, all listed authenticated pages, generated database types, all Supabase migrations, and `supabase/tests/phase1_security.sql`.

The audit intentionally distinguishes:

- **REAL:** code executes and uses the application backend/database or a verified external integration.
- **SIMULATED:** values or effects are generated locally or explicitly marked simulated.
- **PARTIAL:** a meaningful implementation exists but an important required layer is absent or disconnected.
- **MISSING:** no implementation was found in the inspected source.

## Scope inventory

| Area | Evidence inspected | Result |
|---|---|---|
| Project configuration np| `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `bunfig.toml`, `components.json` | Stack and build claims verified |
| Documentation | `README.md`, `src/routes/README.md`, `AGENTS.md` | README contains intended/future language; source was treated as authority |
| Routes | `src/routes/index.tsx`, `auth.tsx`, `__root.tsx`, `_authenticated/route.tsx`, and 11 authenticated page files | 15 route TSX files verified |
| Components | `src/components/layout/Shell.tsx`, `ai-agent/AiCore.tsx`, shared kit/charts, UI components | Navigation, charts, controls, 3D visual verified |
| Client state | `src/lib/live-store.tsx`, `src/hooks/use-auth.tsx` | Active runtime path verified |
| Engines | `anomaly-detection.ts`, `prediction-engine.ts`, `scaling-engine.ts`, `cost-engine.ts`, `format.ts` | Pure calculations verified |
| Server logic | `cloudops-functions.ts`, `server/cloudops.ts`, `agent/*.server.ts` | Three protected server functions and unreferenced agent verified |
| Integrations | Supabase browser/server clients, auth middleware, generated types | Auth/RLS/service-role boundaries verified |
| Database | 10 migration SQL files and generated database types | 18 public tables, RPCs, triggers, policies verified |
| Tests | `supabase/tests/phase1_security.sql` | 17 pgTAP assertions declared |

No application source, `package.json`, or migration was modified for this audit.

## Route verification

| Route | File | Evidence | Classification |
|---|---|---|---|
| `/` | `src/routes/index.tsx` | `createFileRoute("/")`; landing links to auth | REAL UI |
| `/auth` | `src/routes/auth.tsx` | `createFileRoute("/auth")`; sign-in/sign-up forms | REAL auth UI |
| `/ai-agent` | `src/routes/_authenticated/ai-agent.tsx` | protected file route; mounts `AiCore` | VISUAL-ONLY |
| `/overview` | `src/routes/_authenticated/overview.tsx` | `useLive`, charts, forecasts, costs | PARTIAL |
| `/infrastructure` | `src/routes/_authenticated/infrastructure.tsx` | resources, environment, monitoring switch | PARTIAL |
| `/metrics` | `src/routes/_authenticated/metrics.tsx` | synthetic series charts and CSV export | SIMULATED/PARTIAL |
| `/insights` | `src/routes/_authenticated/insights.tsx` | prediction/anomaly display | SIMULATED/PARTIAL |
| `/scaling` | `src/routes/_authenticated/scaling.tsx` | policy controls, manual actions, event log | PARTIAL |
| `/simulation` | `src/routes/_authenticated/simulation.tsx` | five local scenarios | SIMULATED |
| `/cost` | `src/routes/_authenticated/cost.tsx` | local cost engine and export | SIMULATED/PARTIAL |
| `/alerts` | `src/routes/_authenticated/alerts.tsx` | alert query, insert, acknowledge, resolve | PARTIAL |
| `/history` | `src/routes/_authenticated/history.tsx` | scaling/audit queries and export | REAL/PARTIAL |
| `/settings` | `src/routes/_authenticated/settings.tsx` | profile update, session toggles, notifications read | PARTIAL |

`src/routes/routeTree.gen.ts` confirms the generated route paths, but it is generated and was not treated as the owner of behavior.

## Feature evidence

### Authentication and roles

- Browser auth client: `src/integrations/supabase/client.ts`.
- Session/profile/role loading: `src/hooks/use-auth.tsx`, `AuthProvider`, `loadIdentity`.
- Protected layout: `src/routes/_authenticated/route.tsx`, `beforeLoad` calls `supabase.auth.getUser()`.
- Server mutation auth: `src/integrations/supabase/auth-middleware.ts`, `requireSupabaseAuth` validates a Bearer token and calls `getClaims`.
- Roles: `src/lib/types.ts` (`admin`, `operator`, `viewer`); role lookup in `use-auth.tsx`.
- UI write gate: `canWrite` is admin/operator; admin flag is admin.
- Backend role gate: migration functions `can_manage_current_organization`, `can_admin_current_organization`, `is_admin`; RLS and protected RPCs.

### Active live data path

- `src/lib/live-store.tsx`, `LiveProvider.load` reads environments, resources, policies, scaling events, and metrics.
- `TICK_MS = 3000`; browser interval increments `tickCount`.
- Local `seedPoint` and `nextPoint` create metric points with random noise and scenario modifiers.
- `seriesMap` is React state with a maximum of 120 points per resource.
- No `.insert()` for generated live points occurs in `LiveProvider`.
- The visible metrics stream is therefore SIMULATED and session/runtime-local, with only initial metric history read from Supabase.

### Statistical prediction

- `src/lib/prediction-engine.ts`, `predictWorkload`.
- Uses moving averages, least-squares slope, volatility, pressure terms, configured capacity, and policy bounds.
- Returns confidence and risk, but no model/service import or network call exists.
- Classification: SIMULATED/PARTIAL; accurate term is deterministic statistical workload prediction, not ML.

### Anomaly detection

- `src/lib/anomaly-detection.ts`, `detectAnomalies` and `statusFromMetrics`.
- Rolling window thresholds cover CPU, memory, requests, latency, errors, and instance count.
- Active page path computes anomalies locally.
- `/alerts` can persist browser-computed anomalies; server `persistAnomalyAlerts` can also persist them if the server cycle runs.
- Classification: PARTIAL, with synthetic inputs and real alert persistence.

### Scaling

- Client decision: `src/lib/scaling-engine.ts`, `decideScaling`.
- Active state: `src/lib/live-store.tsx`, autonomous effect calls `applyScaling` when enabled.
- Server function: `src/lib/cloudops-functions.ts`, `applyScaling`, protected by `requireSupabaseAuth` and Zod.
- Server wrapper: `src/lib/server/cloudops.ts`, calls RPC `apply_scaling`.
- Database implementation: `supabase/migrations/20260906090000_phase1_security_and_operations.sql`, `public.apply_scaling` locks the resource, validates org/role/bounds, updates `resources`, inserts `scaling_events` with `status = 'simulated'`, and inserts `audit_logs`.
- Cloud boundary: `src/lib/agent/cloud-provider.server.ts`, `SimulatedProvider.scale` returns success without external calls; `AwsProvider.scale` fails closed.
- Classification: REAL database mutation and audit; SIMULATED cloud effect; overall PARTIAL.

### Server agent

- `src/lib/agent/engine.server.ts`, `runAgentCycle` implements collect -> persist -> predict -> detect -> decide -> execute.
- Uses service-role Supabase client `src/integrations/supabase/client.server.ts`.
- Reads `agent_state`, `simulation_state`, `cloud_settings`, resources, policies, events, and metrics.
- Writes `metrics`, `predictions`, `alerts`, `scaling_decisions`, `scaling_events`, `resources`, `cost_records`, and audit rows.
- Uses lock fields in `agent_state`, minimum interval, stale lock timeout, execution keys, and cost snapshots every 10 ticks.
- Search of the inspected source found no import/call from route files, server functions, `src/server.ts`, package scripts, or a cron definition.
- Classification: PARTIAL/unwired implementation, not an active background job.

### Cost

- Client: `src/lib/cost-engine.ts`; routes `/cost`, `/overview`, `/infrastructure`.
- Formula: hourly rate x instances, daily x 24, monthly x 30; optimized count based on average CPU/target.
- Server persistence: `calculateCostSnapshot` in `engine.server.ts` writes `cost_records` only during `runAgentCycle`.
- No provider billing API or billing data import.
- Classification: REAL local arithmetic; SIMULATED estimate; PARTIAL persistence path.

### Alerts and notifications

- Alerts page reads `alerts`, creates anomaly rows, updates status, and writes audit rows.
- Notifications page section reads `notifications` for current user.
- No source reference to an insert into `notifications` was found in the active route/client code; server agent also does not write notifications.
- No email/webhook/push integration exists in `package.json` or source.
- Classification: alerts PARTIAL/REAL persistence; notifications schema/read-only and MISSING producer/delivery.

### AI Agent visual

- `src/routes/_authenticated/ai-agent.tsx` contains no `useLive`, Supabase, server function, or agent-engine import.
- `src/components/ai-agent/AiCore.tsx` uses `Canvas`, `useFrame`, Three.js meshes, particles, orbit arcs, energy pulse, bloom, pointer interaction, and reduced-motion support.
- `AGENT ONLINE` is static presentation state, not a backend health result.
- Classification: REAL rendered UI; VISUAL-ONLY operational capability.

### Cloud/SaaS connectivity

- Schema: `supabase/migrations/20260819113634...sql` creates `cloud_settings` and `cloud_connections`.
- Types: `src/integrations/supabase/types.ts` includes provider, account, auth, credential reference, scopes, status, and error fields.
- Provider boundary: `src/lib/agent/cloud-provider.server.ts` includes simulated provider and inert AWS stub.
- No route, wizard, credential handling, connection test, SDK call, normalized collector, or metrics mapping was found.
- Classification: MISSING user-facing connectivity; PARTIAL schema/interface only.

## Database and migration evidence

### Tables verified

`organizations`, `profiles`, `user_roles`, `environments`, `resources`, `metrics`, `predictions`, `scaling_policies`, `scaling_events`, `alerts`, `notifications`, `audit_logs`, `cost_records`, `cloud_settings`, `cloud_connections`, `agent_state`, `simulation_state`, and `scaling_decisions` are declared across the migration history: 18 public tables.

### Important constraints/functions

- `resources_enforce_bounds` checks min/max, instance range, and target utilization.
- `scaling_policies_enforce_bounds` checks bounds, targets, and minimum cooldowns.
- `apply_scaling` validates auth, organization, role, bounds, trigger, reason, and changed capacity.
- `update_scaling_policy` validates organization, bounds, targets, and cooldowns.
- `set_resource_enabled` validates organization and role.
- `scaling_events_audit` writes to `audit_logs` after scaling event insertion.
- Later migrations revoke authenticated inserts/updates for metrics and predictions and authenticated writes for cost records.
- Later migrations add execution-key uniqueness to scaling events and a single-row agent/simulation state model.

### RLS findings

The migration sequence first creates broad policies and later replaces many with organization-aware policies. The latest inspected policy migration scopes environments/resources/metrics/predictions/policies/events/costs/settings/connections to the current organization. Alerts and audit logs receive explicit organization ownership columns and policies.

The supplied pgTAP test inserts two organizations and checks that Org A cannot read Org B rows, cannot scale Org B resources, cannot exceed bounds, and cannot scale as a viewer. It also checks successful admin scaling, audit creation, policy update, and resource monitoring update.

## Verified security concerns

1. **Service-role bypass boundary:** `client.server.ts` creates a service-role client that bypasses RLS. The server agent imports it and can update multiple tables without per-request user context. This is intentional for trusted backend operation, but the source contains no active scheduler/caller boundary to evaluate beyond server-only module naming.
2. **Migration role bootstrap drift:** `handle_new_user` is redefined in multiple migrations with different organization/role behavior. Deployment must confirm the final applied function, not infer behavior from the earliest migration.
3. **Generated types lag schema:** `src/integrations/supabase/types.ts` exposes only a subset of later RPCs/functions and does not visibly include all later-added organization/execution-key fields in every table shape. This can create compile-time blind spots.
4. **Connection metadata is not a credential system:** `credential_ref` exists in a table, but no secure secret vault, provider verification, or use path was found. Treating a row as a verified connection would be unsupported.
5. **Client-generated alert provenance:** the active browser can persist alerts derived from synthetic client values. These rows are database-backed but do not represent provider-observed incidents.

No secret value was copied into this audit. No verified evidence was found of a hard-coded service-role key, external credential, or client exposure of a secret.

## Dead or schema-only surfaces

- `cloud_connections`: schema and RLS only; no application route/service use.
- `cloud_settings`: schema and server-agent read only; no settings control in current routes.
- `simulation_state`: server-agent read only; active simulation uses React state.
- `agent_state`: server-agent lock/state table; no caller found.
- `scaling_decisions`: server-agent record table; no active page query found.
- `predictions`: server-agent persistence table; active pages calculate from `useLive` rather than querying it.
- `cost_records`: server-agent snapshot table; active Cost page calculates locally.
- `notifications`: active Settings read only; no producer found.

These are not necessarily removable; they are documented as currently disconnected from the visible workflow.

## Test evidence

`supabase/tests/phase1_security.sql` begins with `select plan(17)` and ends with `finish()`. Its assertions cover:

- organization-scoped resource, alert, and audit reads;
- inaccessible orphan rows;
- cross-organization scaling rejection;
- cross-organization update rejection;
- out-of-bounds scaling rejection and state preservation;
- viewer scaling rejection;
- authorized admin simulated scaling;
- scaling event and audit insertion;
- authorized policy update and audit insertion;
- authorized resource monitoring update and audit insertion.

No `tests/` directory was present in the supplied workspace tree, and no package test script is defined in `package.json`.

## Final classification

### Real

- Supabase email/password authentication and session handling.
- Protected route gate and role/profile reads.
- Organization-scoped database reads under the applied RLS policies.
- Database-backed resource monitoring toggle.
- Database-backed policy update.
- Database-backed manual scaling mutation and event/audit records.
- Alert acknowledgement/resolution and audit writes.
- History/audit reads and local CSV exports.
- Rendering of the React/Three.js interface.

### Simulated

- Active live telemetry values.
- Scenario effects.
- Client forecasts and anomaly inputs.
- Cloud scaling effect.
- Cost estimates and optimization savings.
- AI-agent operational appearance.

### Partial

- Overview, metrics, insights, scaling, infrastructure, alerts, settings, and cost workflows because their UI and/or database pieces exist but production collection, scheduling, or external execution is absent.
- Server agent because the full cycle is coded but unwired.
- Cloud provider abstraction because only simulated and inert providers exist.

### Missing

- Real cloud-provider adapters and API calls.
- SaaS/application connection wizard and credential verification.
- Production telemetry collector.
- Verified scheduler/background job invoking `runAgentCycle`.
- ML model or external AI service.
- Notification producer and delivery integration.
- Comprehensive automated application tests.

## Audit conclusion

The repository is a credible full-stack demonstration prototype with a real Supabase control plane and a polished simulated operations experience. It should not currently be described as a production cloud monitoring platform, real-time provider autoscaler, machine-learning system, or fully autonomous agent. The PRD uses those boundaries explicitly.
