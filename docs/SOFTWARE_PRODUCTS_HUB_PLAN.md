# Arakshya Software Products Hub — Implementation Plan

## Purpose and ownership boundary

This is an independent Arakshya Space Lab initiative. It is not part of GENSER and must have its own roadmap, product identity, deployment decisions, analytics, and revenue reporting.

The current Arakshya engineering application is the Aryaksha repository: https://github.com/psytronot/Aryaksha. Its existing mission-design and satellite-engineering experience must remain intact. The software-products hub should be added as a distinct section rather than repurposing or replacing the aerospace workspaces.

## Initial products identified

### 1. Google Maps Scrapper
- Upstream repository: https://github.com/zohaibbashir/Google-Maps-Scrapper
- Upstream README describes a Python + Playwright browser automation script, CSV export, business listing fields, and MIT licensing.
- Upstream README also warns that Google Maps DOM/XPath changes can break extraction and that the project expects Python 3.8/3.9.
- The upstream repository is third-party and is read-only to the connected GitHub account. Do not imply ownership or push changes upstream.
- **Launch gate:** do not publicly offer a Google Maps data extraction service or export stored Google Maps business content until the implementation and proposed use have been reviewed against current Google Maps terms and applicable law. Google Maps Platform terms expressly prohibit scraping/exporting Google Maps content for use outside its services, including copying business names, addresses, and reviews. Evaluate an authorized data provider or a compliant user-directed workflow before productizing.

### 2. First Customer Finder
- Upstream repository: https://github.com/Kappaemme-git/codex-first-customer-finder-skill
- Upstream README describes an MIT-licensed Codex skill that researches public demand signals, scores potential prospects, verifies public contact routes, and generates Markdown/CSV/HTML reports.
- It is currently an agent skill, not a ready-made multi-user web SaaS. A public product experience requires a separate user interface and a controlled execution boundary.
- Preserve the human-in-the-loop design: potential customers are research hypotheses, not confirmed buyers; no automatic outreach; no private contact enrichment; no sensitive-trait targeting; respect source and platform rules.

## Audience

- Schools and colleges (educational demonstrations, workshops, supervised access)
- Students and individual learners
- Early-stage founders and small businesses
- People learning market research, prospect qualification, and business discovery

## Pricing and payment principles

- Public user price target: free by default; if a direct charge is introduced, never exceed ₹1 per user transaction without a new owner decision.
- Do not make paid access mandatory for basic educational use.
- Institutional sponsorships, workshops, deployment/support services, and custom integrations can fund free access.
- Payment methods requested: UPI, cards, and cash.
- For UPI/cards, use a compliant payment gateway and server-side payment verification; never collect or store raw card details.
- Cash is a manual institutional/on-site collection flow with receipt and reconciliation, not an automated online checkout.
- Show any gateway fee, tax, or amount clearly. Do not promise that ₹1 transactions are economically viable until gateway minimums and fees are checked.

## Product hub experience

1. A distinct Software Tools entry in the Arakshya navigation.
2. Product cards with status: research, private beta, demo, or available.
3. Clear audience, use cases, prerequisites, limitations, and privacy notes.
4. Guided onboarding and a safe sample/demo mode.
5. Access request / institution enquiry flow.
6. Usage quotas and abuse controls before opening public access.
7. Minimal analytics: visits, activations, successful runs, repeat use, failures, and opt-in feedback.
8. A support and responsible-use page.

## Delivery phases

### Phase 0 — repository and compliance verification
- Verify the exact upstream repositories and licenses.
- Review the scraper's data source, extraction behavior, persistence, and rate controls.
- Decide whether the Google Maps tool must be replaced with an authorized provider.
- Review First Customer Finder's scripts, dependencies, outputs, and safe execution model.
- Define privacy notice, retention, acceptable-use rules, and institutional consent requirements.

### Phase 1 — Arakshya catalogue and product landing pages
- Add a separate Software Tools section to Aryaksha without altering aerospace workflows.
- Add product detail pages and clear status labels.
- Add a request-access / school-college enquiry flow.
- No live scraper, prospect data processing, or payment capture in this phase.

### Phase 2 — safe product delivery
- Package First Customer Finder behind a controlled, isolated job runner with quotas and manual review.
- Rework the Google Maps offering only after the compliance gate is passed; otherwise substitute a compliant source or reposition it as a non-scraping research helper.
- Add authentication, rate limits, job isolation, secure file handling, deletion/retention controls, and audit logs.

### Phase 3 — payments and sustainability
- Add UPI/card gateway only after merchant account and webhook verification are configured.
- Add cash collection receipts for approved institutional events.
- Test ₹0 and ₹1 flows, refunds, duplicate webhook handling, reconciliation, and gateway economics.
- Measure institutional sponsorship and service revenue separately from user charges.

### Phase 4 — adoption
- Pilot with a small number of schools/colleges and individual users.
- Publish tutorial material and guided demonstrations.
- Improve based on activation, successful completion, repeat usage, and support burden.

## Acceptance criteria

- Arakshya software hub is visually and technically separate from GENSER.
- Existing Aryaksha aerospace routes and engineering workflows continue to work.
- Both products have accurate provenance, license notices, and capability descriptions.
- Google Maps scraping is not exposed as a public service unless a documented compliance review approves the exact data source and usage.
- First Customer Finder never sends outreach automatically or exposes private/sensitive personal data.
- No payment flow goes live before gateway configuration, server-side verification, receipt/reconciliation, privacy terms, and failure handling are tested.
- Public launch is opt-in, monitored, and has a clear support/contact route.

## Current status

- [x] Located the upstream repositories and inspected their READMEs and MIT license files.
- [x] Confirmed the current Aryaksha repository is the space-exploration lab codebase.
- [x] Created an isolated implementation branch for this initiative.
- [x] Confirm upstream ownership/provenance, license notices, core scraper implementation, dependencies and First Customer Finder helper architecture; see [UPSTREAM_TOOL_AUDIT.md](./UPSTREAM_TOOL_AUDIT.md).
- [ ] Complete compliance and privacy review.
- [x] Implement the Software Tools catalogue UI on the isolated branch, including an explicitly fictional First Customer Finder sample report preview.
- [x] Add dedicated desktop and mobile browser acceptance coverage for catalogue disclosures, navigation and the fictional sample report.
- [ ] Implement controlled First Customer Finder execution (architecture proposal: [FIRST_CUSTOMER_FINDER_HOSTED_PILOT.md](./FIRST_CUSTOMER_FINDER_HOSTED_PILOT.md)); provider, authentication and storage decisions remain open.
- [ ] Decide the compliant replacement/architecture for Google Maps data.
- [ ] Configure and test payment collection.
- [x] Opened draft pull request #124 for review.
- [x] Latest CI web build, TypeScript check, unit tests, Orekit service tests and CodeQL passed.
- [ ] Resolve or isolate the unrelated Earth 3D browser-test timeout (43 browser tests passed; one existing timeline-toggle test timed out while clicking an already-visible control).
- [ ] Pilot with schools, colleges, and individual users.


## Implemented preview workflow (2026-11-15)

The current branch includes a local-first preview of the First Customer Finder:
- Intake validates an offer, intended customer and geography, then creates a downloadable Markdown research brief.
- The report walkthrough identifies the evidence fields required for a genuine result: original source, publication/checked dates, evidence quality, confidence, fit rationale and a human-reviewed next step.
- A separate user-supplied CSV utility parses and previews business rows locally in the browser, removes duplicates, applies a 2 MB limit, neutralizes spreadsheet formula prefixes on export and downloads a cleaned CSV.
- Neither flow performs live web research, uploads the user's CSV, scrapes Google Maps, enriches private contact details or sends outreach.

This preview is suitable for demonstrating the intended workflow, not for claiming the hosted First Customer Finder is live. Live research remains gated on written provider approval, authentication, tenant isolation, durable job controls and a lawful retention/export policy.


## CSV template and bounded local processing

The First Customer Finder data utility now includes a blank downloadable `Company,Website,City` CSV template. Upload guidance states the local processing limits: 2 MB per file, 10,000 data rows, 50 columns and 4,096 characters per cell. The parser is isolated in `src/businessCsv.ts` for focused unit testing, rejects ambiguous quote/row structures, and never sends uploaded data to a server. The file input resets after selection so users can retry the same file after correcting an error.
