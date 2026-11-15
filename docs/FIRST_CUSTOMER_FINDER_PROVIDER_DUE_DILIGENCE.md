# First Customer Finder — Research Provider Due Diligence

Review date: 2026-11-15
Status: preliminary vendor screen; no provider approved or integrated.

## Decision

Do not integrate a research provider yet. Keep the local user-supplied CSV workflow available while obtaining written clarification from a provider. The product needs permission for a multi-tenant, customer-facing application that stores per-customer evidence and exports reports; an API key alone is not sufficient.

**Conditional first candidate: Tavily Search API**, subject to written confirmation that the intended Arakshya workflow is allowed under the applicable contract and that the intended per-tenant retention/export model is permitted. The current public documents are not sufficiently consistent to treat this as cleared.

## Provider comparison

| Provider | Published commercial / customer-app position | Data and output constraints | Preliminary fit |
|---|---|---|---|
| Tavily | Its help centre says commercial customer-facing applications and paid SaaS are permitted, with the API key kept server-side. | Its Nov 2, 2026 help articles say output metadata, snippets, page content and derived summaries may be stored, but sharing cached results across multiple customers requires contacting support. The Platform Terms last updated May 4, 2026 also describe use for the customer's internal business purposes and say the API itself must not be transferred or made available to third parties. Query data and AI-functionality inputs/outputs may be used to improve/train services under the published privacy/terms. Get a written answer and a DPA before sending user briefs or enabling customer access. | **Conditional candidate** — promising output-retention guidance, but customer-facing/multi-tenant permission and data processing need written resolution. |
| Exa | API use is licensed subject to its technical documentation and terms. | Published Terms restrict copying, distributing, displaying, reproducing, publishing or offering information obtained through the Services, and restrict reselling/sublicensing the Services. Its privacy policy says query data is used to improve products, including model training/fine-tuning. Enterprise Zero Data Retention is advertised, but ZDR alone does not grant rights to retain, display or export Search Results. | **Not approved for this use** without a written output licence and data-processing agreement. |
| Brave Search API | Terms expressly contemplate Customer Applications and third-party end users, with an end-user agreement and privacy notices required. | Search Results cannot be stored, cached or placed in a database except transient storage required for operation; redistribution/resale is prohibited. | **Poor fit** for a persistent evidence-backed report and downloadable prospect exports unless Brave grants written exceptions. |

## Published pricing signals (USD; verify before purchase)

- Tavily pricing page: 1,000 API credits/month on the free Researcher plan; pay-as-you-go is listed at $0.008 per credit. Credit use varies by request type and complexity.
- Exa pricing page: Search starts at $4 per 1,000 requests; deeper search and other endpoints have separate pricing.
- Brave Search API: $5 per 1,000 requests, with $5 monthly credits shown on the pricing page.

These are vendor list prices, not a complete per-job cost. A real cost model must include number of searches, content extraction, model tokens, retries, monitoring, infrastructure, support and payment fees. A ₹1 customer transaction is not yet economically validated.

## Written questions before selecting Tavily

1. Confirm that Arakshya Space Lab may operate a customer-facing, multi-tenant SaaS in which end users trigger searches through Arakshya's server-side API key.
2. Confirm whether search metadata, short excerpts, source URLs, checked timestamps, derived evidence summaries and prospect scores can be stored per tenant and exported by that tenant.
3. Confirm whether any output may be reused across tenants; default implementation should avoid shared result caches unless explicitly approved.
4. Clarify which privacy terms apply to search queries and whether query data, user-entered briefs or generated outputs may be used for training. Obtain a DPA and any available no-training / retention commitments.
5. Confirm acceptable use for public-company prospect research and the limits on collecting or displaying business contact routes.
6. Confirm credit consumption, request limits, rate limits, student/education eligibility, support and cancellation terms.

## Implementation requirements regardless of provider

- Provider adapter on the server only; never expose API keys in browser code.
- Keep customer briefs free of personal or confidential data unless the provider contract and privacy notice expressly support it.
- Store source URL, title, publication/check date, short evidence excerpt, and retrieval status; do not represent model-generated inference as source fact.
- Validate each prospect against original source evidence and show uncertainty.
- Do not infer or enrich private email addresses or personal phone numbers.
- Keep per-tenant reports isolated; no cross-tenant cache until explicitly approved.
- Enforce spend caps, per-user quotas, concurrency limits, cancellation and provider timeouts.
- Retain only what the provider licence, publisher rights and applicable law permit.
- No automatic outreach.

## Official sources reviewed

- Tavily permitted use: https://help.tavily.com/articles/5880393096-permitted-use-customer-applications
- Tavily storing/caching/retaining output: https://help.tavily.com/articles/1612400809-storing-caching-retaining-output
- Tavily governing terms: https://help.tavily.com/articles/3473422950-governing-terms-contracting-permissions
- Tavily Platform Terms: https://www.tavily.com/terms
- Tavily pricing: https://www.tavily.com/pricing
- Exa Terms of Service: https://exa.ai/assets/Exa_Labs_Terms_of_Service.pdf
- Exa Privacy Policy: https://exa.ai/privacy-policy
- Exa pricing: https://exa.ai/pricing
- Brave Search API Terms: https://api-dashboard.search.brave.com/documentation/resources/terms-of-service
- Brave pricing: https://api-dashboard.search.brave.com/app/plans?tab=normal

This is a product and vendor due-diligence note, not legal advice or a substitute for written vendor approval and qualified legal review.
