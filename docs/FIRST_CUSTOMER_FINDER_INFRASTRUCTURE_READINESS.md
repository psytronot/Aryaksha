# First Customer Finder — Infrastructure Readiness and Next 10 Steps

Review date: 2026-11-15
Status: architecture assessment only; no external services selected, connected or provisioned.

## Current repository facts

The current Aryaksha web application is a React/Vite frontend with an Express API host and a separately hosted Orekit service. The existing API host has:
- no authentication or account identity;
- no account-based authorization or tenant ownership;
- no database dependency or durable job store in the current frontend/API package;
- no job queue or worker process;
- a process-local in-memory rate limiter (60 requests/minute in the API host), which resets on restart and is not a distributed quota;
- existing API body-size limits and security headers.

The software hub is currently a browser-only demo workflow. The CSV tool reads the user's file locally and downloads the cleaned output. No research provider, user account, payment service or hosted Finder endpoint has been connected.

## Architecture decision

**Do not implement live research endpoints in the existing unauthenticated API host.** Adding job routes before identity, durable ownership and quotas exist would create a public resource-consumption endpoint and could expose customer research across users.

The smallest safe hosted shape is:
1. Identity middleware verifies a signed user identity on every protected route.
2. A relational database stores tenant-owned research jobs, candidate records, source evidence, feedback and deletion state.
3. A bounded worker consumes queued jobs outside the request process; browser requests never hold a research job open.
4. A provider adapter runs only with approved credentials and contract permissions.
5. The API checks owner/institution scope for every read, update, export and delete.
6. Per-user and per-institution quotas, cancellation, expiry, cost ceilings and audit events are enforced server-side.

## Technology options — decision criteria, not a vendor selection

| Layer | Viable options to evaluate | Required evidence before selection |
|---|---|---|
| Authentication | Supabase Auth, Clerk, Auth0 or an existing institutional identity provider | India availability, verified email/SSO, session revocation, organization membership, pricing, DPA, data residency/retention and integration with the current React + Express app |
| Relational storage | Managed PostgreSQL (including a separately provisioned Render or Supabase database) | Backups, encryption, RLS/tenant isolation, deletion semantics, region, connection limits, recovery and cost |
| Queue/worker | PostgreSQL-backed queue (e.g. pg-boss) or Redis-backed queue (e.g. BullMQ) | Durable retry semantics, deduplication, cancellation, dead-letter handling, concurrency caps, worker deployment and operating cost |
| Research provider | Conditional Tavily evaluation; other providers only after output rights are checked | Written customer-facing/multi-tenant permission, source display and storage rights, data-processing terms, quotas, training/retention terms and per-job cost |
| Observability | Structured server logs plus provider/job metrics | No raw research briefs, private contact data or credentials in logs; retention and access policy |

No option is approved by this note. Avoid installing packages or provisioning services until the owner selects the operating model and supplies the required account/secret setup.

## Data isolation model

- Every job has an immutable owner ID and optional institution ID.
- Every query/update/export/delete must filter by the authenticated owner or an explicitly authorized institution role.
- Database row-level security is defense in depth, not a substitute for server-side authorization.
- Opaque IDs are not access control.
- Evidence and reports are scoped to a single job; do not share caches across tenants.
- Deletion must cover job rows, evidence, exports, cached content, pending work and derived data according to the published retention policy.

## Security and abuse controls

- Authenticate before job creation; verify authorization on every job operation.
- Validate request schema, maximum brief length and permitted geography.
- Use fixed provider adapters, not user-supplied arbitrary fetch URLs.
- If source inspection fetches URLs, defend against SSRF at DNS resolution, redirect and connection time; block loopback, private, link-local, reserved and non-HTTP destinations.
- Treat web page content as untrusted input; never allow source text to change the research policy or invoke tools.
- Apply per-user/institution rate, concurrency, time, token and money budgets.
- Make cancellation effective in both API and worker.
- Avoid logging full prompts, raw imported files, personal contact data or provider secrets.
- Keep all outreach manual; no private email/phone enrichment or sensitive-trait targeting.

## Next 10 implementation steps

These steps follow the completed local CSV hardening cycle. They are ordered to prevent premature live endpoints.

| # | Step | Can proceed now? | Exit condition |
|---|---|---|---|
| 1 | Confirm pilot identity model (individual accounts vs institutional SSO) | Needs owner decision | Written identity and organization-role requirements |
| 2 | Select an authentication provider | Needs owner decision/account | Approved provider, DPA and verified account configuration |
| 3 | Select database and region | Needs owner decision/account | Managed Postgres provisioned with backup/retention plan |
| 4 | Define tenant schema and RLS policies | Design can proceed; implementation waits for DB | Tests prove cross-tenant reads/writes/exports/deletes are denied |
| 5 | Select durable queue/worker topology | Design can proceed | Retry, dedupe, cancellation, dead-letter and concurrency behavior specified |
| 6 | Obtain written research-provider approval | Draft is ready; vendor response needed | Written confirmation covering SaaS, output storage/export and data processing |
| 7 | Implement server-side provider adapter | Blocked on steps 2, 3, 5 and 6 | Credentials server-only; timeouts, quotas and provider response validation tested |
| 8 | Implement authenticated job API and deletion | Blocked on steps 2–5 | Owner-scoped CRUD/export/delete and cross-tenant tests pass |
| 9 | Add abuse controls, retention and audit telemetry | Design can proceed; production setup waits | Quotas, cancellation, expiry, deletion and redacted logs verified |
| 10 | Run an invite-only pilot and measure real unit economics | Blocked on steps 1–9 | Small cohort completes research jobs; quality, cost, failure rate and support load measured |

## Owner decisions needed before live hosting

1. Individual accounts only, or institution-managed accounts with roles?
2. Is a managed Postgres service acceptable, and which account/provider should own it?
3. Is a paid authentication/database/queue budget available for the pilot?
4. Who will send the Tavily approval request and accept the vendor's DPA/terms?
5. What is the pilot cohort size and retention period?

Until these decisions are made, the safe deliverable is the local-only brief and CSV workflow. Do not represent the live Finder as launched.
