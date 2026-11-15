# Upstream Tool Review — Arakshya Software Products

Review date: 2026-11-15

This review is limited to the upstream source files listed below. It is a product-integration and security triage, not a legal opinion or a full independent security audit. Neither upstream project is owned by Arakshya Space Lab.

## 1. Google Maps Scrapper

- Upstream: https://github.com/zohaibbashir/Google-Maps-Scrapper
- License: MIT (copyright notice belongs to the upstream author; preserve it in any permitted redistribution).
- Reviewed revision: `main.py` blob `36335cd8e5df8af290dd52c63c2782fb6e31fa00`; `requirements.txt` blob `9dd0bed666361e6cffee068e46b76e4c7fa3d81d`.
- Stack: Python, Playwright synchronous API, pandas; pinned older dependency versions including Playwright 1.44.0 and pandas 2.2.2.
- Operation: opens Google Maps in a visible Chromium browser, submits a search string, scrolls result listings, clicks each listing, extracts business name/address/site/phone/review metrics/hours/category and writes CSV.
- Reliability: hard-coded XPaths and CSS classes are tightly coupled to Google Maps DOM; the project README itself warns that DOM/XPath changes can break extraction. No robust retry, backoff, schema contract, or automated test suite was identified in the reviewed files.
- Safety/operations: no authentication, tenant isolation, quota enforcement, consent workflow, deletion policy, audit trail, or hosted job isolation exists in this script. Browser is launched with `headless=False`; it has no first-class timeout/budget controls for the overall job. User-supplied output paths are written locally.
- Compliance: the implementation extracts and persists Google Maps content. Current Google Maps Platform terms include restrictions on scraping/exporting Maps content for use outside Google services. The exact legal application depends on the service, data source and use; do not deploy this as a public extraction service or retain/export Maps-derived content until qualified review approves the exact workflow.
- Decision: **do not productize this code as-is**. Keep its catalogue card in compliance-review state. Explore an authorized business-data provider with documented API rights, or build a generic user-supplied-CSV cleanup/qualification tool that does not extract Maps content.

## 2. First Customer Finder

- Upstream: https://github.com/Kappaemme-git/codex-first-customer-finder-skill
- License: MIT; package metadata identifies Francesco Mistero as author. Preserve upstream copyright/license notices in any permitted redistribution.
- Reviewed revision: package metadata blob `7696d9841ca33098b23575eba2d2e6f5351782e9`; validation helper blob `ce683878c68e39ec848634ea6f95fa1672c92b39`; report generator blob `60eba0e28a9e4896ae34eaf3b680d945e314134a`; history helper blob `a3b944cccd1c211213e5b298e48f9c88425fc613`.
- Stack: Codex skill instructions plus Python 3.9+ standard-library helpers and a Node installer. The package test command runs Python unittest discovery and Node's installer tests.
- Important architecture distinction: the skill's live discovery and source inspection are performed by the Codex agent using its available web/browser capabilities. The Python scripts validate supplied research records, calculate weighted scores, manage local history and generate Markdown/CSV/optional HTML reports. The scripts themselves explicitly state that they do not perform network I/O.
- Strengths: schema validation; weighted scoring; duplicate identity handling; source/date and public contact-route evidence requirements; missing-route score caps; local product-scoped history; explicit feedback/outcome recording; HTML escaping; no automatic outreach; no private email discovery, data brokers, sensitive-trait targeting or private-group access.
- Integration gaps: this is not a web SaaS backend, multi-user service, hosted research engine, queue, or payment product. Its Codex agent workflow cannot simply be exposed to anonymous website users. It requires a separate, authorized research execution layer and user-facing orchestration.
- Security design requirements before hosting: isolate each job and tenant; treat source pages and imported files as untrusted prompt-injection content; enforce URL allowlists/egress controls and block localhost/private/link-local destinations if any server-side fetch is introduced; impose strict request/time/token limits; avoid shared persistent prospect history by default; encrypt transient data; define short retention and user deletion; escape exports; log security events without logging sensitive research payloads.
- Decision: **best candidate for a controlled pilot**, but initially as a human-reviewed workflow with sample data and user-supplied product descriptions. Do not claim that the web app can perform live research until an authorized execution provider and its terms/quotas are integrated.

## Product direction

1. Prioritize First Customer Finder for a small, supervised pilot.
2. Keep Google Maps Scrapper visibly unavailable until the exact data source and use are approved; prefer a licensed provider or a source-neutral CSV research utility.
3. Do not charge users or collect payment data until the execution service, privacy controls, support, and payment verification are in place.
4. Retain attribution and license notices; MIT licensing does not override third-party platform terms or grant rights to Google Maps data.


## Current Google Maps Platform terms cross-check (2026-11-15)

The current Google Maps Platform Terms of Service explicitly state that customers must not export, extract or scrape Google Maps Content for use outside the Services. The examples include pre-fetching, indexing, storing, resharing or rehosting content and copying business names, addresses or user reviews. See Section 3.2.3(a)–(c): https://cloud.google.com/maps-platform/terms

This reinforces the existing launch gate: do not operate the upstream Google Maps Scrapper as a hosted extraction product or use it to build/export a business database. The prototype's MIT licence does not grant rights to the Google Maps content it may collect. Keep the Maps product paused and prioritize user-supplied data or a separately licensed data source. This is a technical/product risk note, not legal advice.
