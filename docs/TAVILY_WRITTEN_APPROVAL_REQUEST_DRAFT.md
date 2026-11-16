# Tavily written-approval request — First Customer Finder

Status: draft for owner review; NOT sent.

To: Tavily support / legal contact (use the official support channel)
Subject: Written permission and data-processing clarification for Arakshya customer-facing multi-tenant application

Hello Tavily team,

We are evaluating Tavily Search API as a research provider for First Customer Finder, a product within Arakshya Space Lab. Before integrating or sending any user data, we need written clarification on whether our intended workflow is permitted under the applicable contract and what data-processing terms would apply.

**Intended product model**
- Arakshya operates a customer-facing application. Individual customers (and, in a later phase, institution-managed workspaces) submit their own product/customer research briefs.
- Requests are sent from our server using our API credentials; end users do not receive or directly access our API key.
- We would display each customer only their own research report.
- For each prospect, we intend to retain source URL, title, publication date where available, retrieval/check timestamp, a short evidence excerpt, a confidence/evidence label and derived fit/priority notes.
- Customers may export their own reports as Markdown or CSV.
- We intend to avoid cross-customer result caching unless expressly permitted.
- We will not use the service for automated outreach, private contact enrichment or sensitive-trait targeting.

Could you please confirm in writing:

1. Is this customer-facing, multi-tenant SaaS use permitted when all searches are initiated server-side through Arakshya's account?
2. May we store source metadata, URLs, short excerpts, derived summaries and prospect-priority scores separately for each customer, and allow that customer to export those records?
3. Are there restrictions on displaying, retaining or exporting such records to the customer who initiated the query?
4. May any search result or derived output be reused across different customers? Our default design is tenant-isolated storage and no shared result cache.
5. What data-processing agreement and subprocessor terms apply? Can you confirm whether customer-entered research briefs, search queries, retrieved content or generated outputs are used for model training or product improvement, and whether a no-training / limited-retention option is available?
6. What are the applicable data retention, deletion, geographic processing, attribution and source-display requirements?
7. What are the rate limits, credit consumption rules, commercial pricing and any restrictions relevant to business prospect research?
8. Do you require any specific end-user terms, privacy disclosures or attribution in our application?

Please point us to the controlling contract terms and confirm whether the answers above are binding for our proposed use case. We will not transmit customer research briefs or enable the integration until the permissions and data-processing terms are clear and accepted.

Thank you,
Arakshya Space Lab

---

## Owner checklist before sending

- Confirm the legal contracting entity and sender identity.
- Review Tavily's current Platform Terms and applicable DPA.
- Do not include real customer data or credentials in this request.
- Send through an official Tavily support/legal channel only.
- Save the response and contract version in the project records.
- Obtain owner acceptance before enabling a provider key or processing user briefs.
