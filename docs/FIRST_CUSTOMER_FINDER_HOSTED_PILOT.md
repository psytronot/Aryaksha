# First Customer Finder — Hosted Pilot Architecture

Status: proposed; no live research execution is enabled.

## Decision

Build First Customer Finder as a separate, authenticated workflow inside the Arakshya software hub. Do not expose the upstream Codex skill or its local scripts directly as an anonymous web endpoint. The upstream scripts are useful for validating and rendering a research report; the actual discovery process depends on an agent with authorized web research access.

The first hosted pilot should be human-reviewed and provider-backed, with a small allowlisted cohort. It must not send outreach or create CRM records.

## User journey

1. User signs in and accepts the acceptable-use and privacy notices.
2. User submits a product description, intended customer type, geography, and optional official product URL.
3. API validates input size and URL safety; no arbitrary server-side URL fetches.
4. User confirms the research brief and starts a job.
5. A queue worker calls a selected research-provider adapter using server-held credentials and a strict source policy.
6. The worker records source URL, title, publication date if available, retrieval/check date, evidence excerpt, and confidence. External page content is treated as untrusted data, never as instructions.
7. A deterministic validator rejects incomplete or unsupported prospect records. Weighted scores are calculated from the upstream scoring dimensions; scores are research priorities, not conversion probabilities.
8. User reviews the shortlist and can keep/maybe/reject prospects or request a refresh.
9. User exports Markdown and CSV. HTML export is optional after output escaping and link safety tests.
10. User can delete the job and all associated research artifacts.

## Provider boundary

Define a provider-neutral interface before selecting a vendor:

- researchBrief(input, limits, abortSignal) returns structured candidate evidence only.
- inspectSource(url, limits, abortSignal) returns normalized source metadata and a bounded excerpt.
- health() reports provider readiness without exposing credentials.

Provider selection is a launch dependency. Compare terms for commercial use, geographic/source coverage, data retention, rate limits, pricing, attribution, and whether outputs may be stored/exported. Do not wire a provider until those terms and required credentials are approved. Do not use Google Maps scraping as a fallback.

## API contract (proposed)

- POST /api/software/first-customer/jobs — create a validated job; returns opaque job ID and queued status.
- GET /api/software/first-customer/jobs/:id — return status and progress for the authenticated owner only.
- GET /api/software/first-customer/jobs/:id/report — return the validated report for the authenticated owner only.
- POST /api/software/first-customer/jobs/:id/feedback — store explicit keep/maybe/reject feedback for a prospect in that job.
- DELETE /api/software/first-customer/jobs/:id — delete job, report, evidence and derived exports.

These routes must not be implemented until authentication, authorization, durable job ownership and retention controls exist. The existing global API rate limiter is not a substitute for per-user authentication or quotas.

## Minimum data model

- research_jobs: opaque ID, owner ID, normalized brief, status, provider, created/started/completed timestamps, expiry timestamp.
- prospects: job ID, stable entity ID, name, target role and observed/inferred basis, fit dimensions, computed score, caution, next step, draft opener (never sent).
- source_evidence: prospect ID, canonical URL, title, source type, publication date, checked timestamp, short excerpt, evidence status and confidence.
- public_contact_routes: prospect ID, route URL, route evidence URL, label, checked timestamp, status and note. No guessed or enriched private contact details.
- prospect_feedback: owner ID, prospect ID, verdict, reason and timestamp.

Tenant ownership must be checked on every read, write, export and delete. Use database row-level policies or equivalent server-enforced authorization. Do not rely on an unguessable job ID as access control.

## Security and privacy gates

- Authentication and verified ownership before creating or reading jobs.
- Per-user and per-institution quotas, request size limits, concurrency caps, provider timeouts and cancellation.
- SSRF defenses for any URL preview or source fetch: HTTPS only where appropriate, reject credentials, localhost, private, link-local and reserved IP ranges; validate DNS resolution and redirects at connection time; block non-web schemes.
- Source content is untrusted; strip scripts and active content, limit excerpt size, and prevent prompt injection from overriding the research policy.
- No sensitive-trait targeting, personal email/phone enrichment, private groups, data brokers or automatic outreach.
- Encrypt data at rest and in transit; never log full research payloads, secrets or raw uploaded documents.
- Default short retention for raw evidence and generated artifacts; publish expiry and deletion behavior.
- Per-user deletion must remove job rows, evidence, exports, caches and queued work.
- Audit events should record actor, job ID, action and outcome without retaining unnecessary personal data.
- Human review before any outreach suggestion is acted on; draft copy remains unsent.

## Pilot limits and acceptance tests

- Invite-only cohort; one active job per user initially.
- Start with small research caps (for example, up to 5 prospects) and a strict provider time/cost budget.
- Every primary prospect must have at least one inspected original source; unknown dates and missing contact routes lower scores.
- No result may be described as a confirmed buyer or conversion probability.
- Reject duplicate entities and invalid/missing evidence; show an honest empty shortlist when evidence is weak.
- Verify cross-user access denial, quota enforcement, cancellation, expiry, deletion, provider failure, malformed responses, unsafe URLs, export escaping and duplicate job submission.
- Keep the product free in the initial pilot; do not enable payments before operational costs and provider fees are measured.

## Decisions still required

1. Select an approved research provider and confirm commercial-use terms.
2. Select authentication and durable storage/queue infrastructure.
3. Set a pilot cohort and retention window.
4. Approve privacy notice, acceptable-use policy, and support contact.
5. Define an operating cost budget before deciding whether the ₹1 transaction target is viable.


## Current provider decision (2026-11-15)

A preliminary vendor screen is recorded in `docs/FIRST_CUSTOMER_FINDER_PROVIDER_DUE_DILIGENCE.md`. Tavily is the conditional first candidate because its current help centre describes commercial customer-facing use and broad output-retention rights, but its Platform Terms contain language that requires written clarification for this multi-tenant SaaS model. Do not integrate it until that clarification and the required data-processing terms are obtained. Exa and Brave are not approved for the persistent evidence/export workflow under their presently published default restrictions.
