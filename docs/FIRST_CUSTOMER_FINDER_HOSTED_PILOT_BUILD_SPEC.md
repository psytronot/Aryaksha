# First Customer Finder — Hosted Pilot Build Specification

Review date: 2026-11-15
Status: implementation-ready design; NOT deployed or connected to external services.

## 1. Pilot product decision

Recommended rollout:
- Phase A: individual accounts, invite-only.
- Phase B: institution-managed workspaces with explicit owner/admin/member roles, after Phase A access-control tests pass.
- Keep institution_id nullable in the first schema so Phase B does not require a destructive redesign.
- No payments in the pilot. Measure provider cost, compute cost, support load and repeat usage before pricing.
- No automated outreach, private contact enrichment, CRM writes or Google Maps scraping.

This is a recommended default for planning, not an owner-approved purchase or legal decision.

## 2. Service boundaries

- Web client: collects a bounded research brief, displays job status/report, captures explicit feedback and requests export/deletion.
- API: authenticates each request, authorizes owner/workspace scope, validates input, enforces quotas, persists jobs and enqueues work.
- PostgreSQL: durable tenant-scoped source of truth for users, workspaces, jobs, prospects, evidence, feedback and audit events.
- Worker: claims jobs, calls only an approved provider adapter, validates evidence, computes deterministic priority scores and persists results.
- Provider adapter: fixed allowlisted integration. No user-controlled arbitrary fetch URL or dynamic tool execution.
- Observability: structured operational events with opaque IDs; never log secrets, full briefs, raw imported files or unnecessary personal data.

## 3. Relational schema proposal

Use UUID primary keys generated server-side. Store timestamps in UTC. Every tenant-owned row must have an owner_id and, where applicable, a workspace_id. Foreign keys should include tenant keys where practical to prevent cross-tenant references.

### users
- id UUID PRIMARY KEY (maps to verified identity-provider subject)
- email_verified_at TIMESTAMPTZ NULL
- created_at, updated_at TIMESTAMPTZ NOT NULL
- disabled_at TIMESTAMPTZ NULL

Do not store passwords or duplicate identity-provider credentials.

### workspaces
- id UUID PRIMARY KEY
- name TEXT NOT NULL
- created_by UUID REFERENCES users(id)
- created_at, updated_at TIMESTAMPTZ NOT NULL
- deleted_at TIMESTAMPTZ NULL

### workspace_memberships
- workspace_id UUID REFERENCES workspaces(id)
- user_id UUID REFERENCES users(id)
- role TEXT CHECK role IN ('owner','admin','member')
- created_at TIMESTAMPTZ NOT NULL
- PRIMARY KEY (workspace_id, user_id)

Membership changes must be audited. Only owner/admin may invite or remove members; ownership transfer requires explicit confirmation.

### research_jobs
- id UUID PRIMARY KEY
- owner_id UUID REFERENCES users(id) NOT NULL
- workspace_id UUID NULL REFERENCES workspaces(id)
- brief JSONB NOT NULL (validated schema; bounded fields only)
- status TEXT CHECK status IN ('queued','running','succeeded','failed','cancel_requested','cancelled','expired','deleting')
- provider_key TEXT NULL
- idempotency_key TEXT NOT NULL
- attempt_count INTEGER NOT NULL DEFAULT 0
- progress SMALLINT NOT NULL DEFAULT 0 CHECK progress BETWEEN 0 AND 100
- created_at, updated_at TIMESTAMPTZ NOT NULL
- started_at, completed_at, expires_at TIMESTAMPTZ NULL
- failure_code TEXT NULL (safe enum, not raw provider response)
- UNIQUE (owner_id, idempotency_key)

### prospects
- id UUID PRIMARY KEY
- job_id UUID REFERENCES research_jobs(id) ON DELETE CASCADE
- owner_id UUID REFERENCES users(id) NOT NULL
- workspace_id UUID NULL
- canonical_entity_key TEXT NOT NULL
- organization_name TEXT NOT NULL
- fit_summary TEXT NOT NULL
- score SMALLINT NOT NULL CHECK score BETWEEN 0 AND 100
- score_label TEXT CHECK score_label IN ('high','medium','low')
- score_explanation JSONB NOT NULL
- next_step TEXT NULL
- draft_opener TEXT NULL (never sent)
- created_at TIMESTAMPTZ NOT NULL
- UNIQUE (job_id, canonical_entity_key)

### source_evidence
- id UUID PRIMARY KEY
- prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE
- owner_id UUID REFERENCES users(id) NOT NULL
- workspace_id UUID NULL
- source_url TEXT NOT NULL
- canonical_url TEXT NULL
- source_title TEXT NULL
- source_type TEXT NOT NULL
- published_at TIMESTAMPTZ NULL
- checked_at TIMESTAMPTZ NOT NULL
- excerpt TEXT NOT NULL (strict length cap)
- evidence_status TEXT CHECK evidence_status IN ('supports','weak','contradicts','unverified')
- confidence TEXT CHECK confidence IN ('high','medium','low')
- created_at TIMESTAMPTZ NOT NULL

### prospect_feedback
- id UUID PRIMARY KEY
- prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE
- job_id UUID REFERENCES research_jobs(id) ON DELETE CASCADE
- actor_user_id UUID REFERENCES users(id) NOT NULL
- verdict TEXT CHECK verdict IN ('keep','maybe','reject')
- reason TEXT NULL
- created_at TIMESTAMPTZ NOT NULL

### audit_events
- id UUID PRIMARY KEY
- actor_user_id UUID NULL REFERENCES users(id)
- workspace_id UUID NULL
- job_id UUID NULL
- action TEXT NOT NULL (allowlisted enum)
- outcome TEXT NOT NULL CHECK outcome IN ('allowed','denied','success','failure')
- request_id TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL
- metadata JSONB NOT NULL DEFAULT '{}'

Audit metadata must be allowlisted and redacted. Never store briefs, evidence excerpts, email addresses, credentials or provider payloads in audit metadata.

### queue_outbox (transactional enqueue)
- id UUID PRIMARY KEY
- job_id UUID REFERENCES research_jobs(id) ON DELETE CASCADE
- event_type TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL
- published_at TIMESTAMPTZ NULL
- attempts INTEGER NOT NULL DEFAULT 0

Insert the job and outbox event in the same database transaction. A dispatcher publishes unpublished outbox rows to the selected queue and marks them published only after acknowledgement. This avoids losing a job between DB commit and queue publish.

## 4. Tenant authorization rules

These rules are mandatory regardless of the chosen auth/database vendor:
1. Verify signed identity and account status before any protected route.
2. Derive actor ID from verified server-side identity claims; never accept owner_id from request body/query as authority.
3. Individual job access: owner_id must equal authenticated actor.
4. Workspace job access: actor must have an active membership; role determines permitted action.
5. Check scope on every read, report fetch, feedback write, export, retry, cancellation and delete.
6. Check prospect/evidence scope through the parent job; do not authorize by opaque UUID alone.
7. Exports must use the same authorization path as report reads.
8. Membership revocation takes effect immediately for new requests.
9. Use database RLS as defense in depth after identity provider and DB session-claim propagation are selected and tested.
10. Never allow a worker or API route to bypass scope checks for user-triggered operations.

Required negative tests: user A cannot read, mutate, export, cancel or delete user B's job; workspace member cannot administer membership; removed member loses access; guessed prospect/evidence IDs reveal no data; workspace A cannot reference workspace B records.

## 5. Job lifecycle and worker behavior

Allowed transitions:
- queued -> running | cancel_requested | expired
- running -> succeeded | failed | cancel_requested
- cancel_requested -> cancelled | failed
- succeeded/failed/cancelled -> deleting
- deleting -> expired (after artifacts and dependent rows are removed)

Worker requirements:
- Claim jobs with an atomic lease/lock and bounded lease expiry.
- Enforce one active job per user in Phase A.
- Use idempotency keys to reject duplicate submissions.
- Retry only transient failures with bounded exponential backoff and jitter.
- Do not retry policy, validation, permission or permanent provider errors.
- Enforce provider timeout, max prospects, max source inspections, max excerpt length and per-job spend ceiling.
- Cancellation is checked between provider operations and before persistence.
- Dead-letter exhausted jobs with a safe failure code.
- Worker must not trust client-provided progress or status.
- A periodic reconciler expires stale leases and jobs.
- Delete/cancel must prevent queued work from recreating deleted data.

Suggested queue: PostgreSQL-backed pg-boss is the first option to evaluate because the relational store is already required and it avoids a second Redis service for a small pilot. This is a design recommendation only; benchmark compatibility, deployment model, retry/cancel semantics and operational cost before selection.

## 6. Abuse, source safety and privacy

- Fixed provider adapter allowlist; never accept arbitrary provider URLs.
- If URL inspection is enabled, HTTPS-only policy, reject URL credentials and non-web schemes, resolve and validate DNS at connection time, block loopback/private/link-local/reserved IPs, revalidate redirects and cap response bytes/time.
- Treat all page text as hostile data; it cannot change system policy, request secrets or trigger tools.
- Strict input schema, max brief size, max geography length and allowed industry/category fields.
- Per-user and per-workspace rate, concurrency, provider-call, time and spend budgets.
- CAPTCHA or abuse challenge only if observed abuse warrants it; avoid collecting unnecessary identity data.
- No sensitive-trait targeting, private-group research, data brokers, private email/phone enrichment or automatic outreach.
- Encrypt in transit and at rest; secrets only in server-side secret storage.
- Publish purpose, data categories, provider subprocessors, retention, deletion and support contact before pilot invitations.
- Default pilot retention proposal: delete raw source excerpts and reports after 30 days unless the user deletes earlier; retain only minimal redacted operational events for a separately approved period. This requires owner/legal review before publication.

## 7. Provider approval gate

Tavily remains a conditional candidate, not an approved dependency. Before integration, obtain written confirmation covering:
- customer-facing multi-tenant SaaS use;
- commercial use and redistribution/display of results;
- rights to persist source metadata, excerpts and generated reports;
- data processing, subprocessors, retention and deletion;
- geographic coverage, rate limits, attribution and per-job cost;
- whether user research briefs are used for model training or product improvement.

No provider key is to be requested, stored or used until written approval and owner acceptance of terms.

## 8. API contract (not yet implemented)

- POST /api/software/first-customer/jobs
  - authenticated; validated brief; idempotency key; server-derived owner/workspace.
- GET /api/software/first-customer/jobs/:jobId
  - authenticated; owner/workspace scoped status only.
- GET /api/software/first-customer/jobs/:jobId/report
  - authenticated; owner/workspace scoped report and evidence.
- POST /api/software/first-customer/jobs/:jobId/feedback
  - authenticated; scoped prospect ID; keep/maybe/reject.
- POST /api/software/first-customer/jobs/:jobId/cancel
  - authenticated; scoped cancellation request.
- DELETE /api/software/first-customer/jobs/:jobId
  - authenticated; scoped deletion of job, evidence, reports, exports and queued work.

Return generic 404 for inaccessible IDs to avoid confirming another tenant's resource exists. Use structured error codes; never return provider secrets or raw exception traces.

## 9. Acceptance test matrix

| Area | Required test |
|---|---|
| Authentication | Missing, expired, revoked and disabled identity rejected |
| Authorization | Cross-user and cross-workspace read/write/export/delete denied |
| Membership | Member/admin/owner permissions enforced; revoked member denied |
| Idempotency | Duplicate submission creates one job |
| Queue | Crash after DB commit still dispatches via outbox |
| Worker | Lease expiry, retry, dead-letter and duplicate delivery are safe |
| Cancellation | Cancellation prevents further provider calls and persistence |
| Quotas | Per-user concurrency and provider spend caps enforced server-side |
| Provider | Timeout, 429, malformed JSON and permanent errors handled safely |
| SSRF | localhost, private IP, link-local, redirect-to-private, DNS rebinding and non-HTTP schemes blocked |
| Prompt injection | Source text cannot override policy or invoke tools |
| Output | HTML/CSV escaping; formula injection neutralized |
| Retention | Expired jobs and dependent artifacts are purged |
| Deletion | Delete removes evidence, exports, cache, outbox and queued work |
| Audit | Events are redacted and actor/action/outcome traceable |

## 10. Implementation sequence after owner approvals

1. Owner confirms individual-first / institutional-later default, pilot cohort and retention.
2. Select identity provider and complete account/DPA review.
3. Select managed PostgreSQL region, backups and secret ownership.
4. Implement schema and migrations; test tenant isolation.
5. Select and deploy queue/worker; test outbox, retries, cancellation and dead letters.
6. Obtain written provider approval and approve budget.
7. Implement provider adapter with strict limits and contract tests.
8. Implement authenticated API, scoped report/export/feedback/delete routes.
9. Add quotas, redacted audit telemetry, retention and deletion worker.
10. Run security acceptance suite, then invite-only pilot; measure evidence quality, cost/job, failure rate and repeat use.

## 11. Explicit non-actions

This document does not provision cloud resources, select or accept vendor terms, create secrets, send emails, enable payments, expose a live endpoint, merge PR #124 or deploy production. Those actions require owner/account authorization and verified acceptance tests.
