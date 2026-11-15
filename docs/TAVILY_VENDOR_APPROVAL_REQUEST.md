# Tavily — Written Approval Request (Draft)

**To:** support@tavily.com  
**Subject:** Written confirmation requested: customer-facing multi-tenant SaaS use and output retention

Hello Tavily team,

We are evaluating Tavily Search API as the research layer for First Customer Finder, a customer-facing product operated by Arakshya Space Lab.

The intended workflow is:
- End users submit a product/service description, intended customer type and geography through our application.
- Our backend, not the browser, calls Tavily using a server-held API key.
- We process public web results into a per-customer research report with source URLs, titles, publication/check dates, short evidence excerpts, confidence, fit rationale and a human-review next step.
- Each customer can view and export only their own report. We will not expose or resell the Tavily API itself.
- We will not share cached search results across customers unless you expressly approve that model.
- We will not send private personal data, confidential customer lists, private email addresses or phone numbers in search queries.

Before integrating, please confirm in writing:

1. Does the applicable Tavily agreement permit this customer-facing, multi-tenant SaaS model, where third-party end users trigger searches through our backend API key?
2. May we store each customer's search-result metadata, source URLs, short excerpts, timestamps and derived summaries/scores in that customer's own account, and allow that customer to export their own report?
3. Are there restrictions on displaying source titles, URLs, excerpts or derived evidence in a report visible to the end user?
4. Does the November 2, 2026 help-centre guidance on commercial customer applications and output retention override or clarify any broader wording in the May 4, 2026 Platform Terms about internal business use and third-party access?
5. Does Tavily process or retain API search queries for model training or service improvement? Can you offer a no-training commitment, DPA or other data-processing terms for user-entered research briefs?
6. Are there any restrictions on public-company prospect research, business contact routes or human-reviewed lead qualification?
7. Please confirm credit consumption, rate limits, concurrency limits, cancellation behavior and any production support requirements for a small pilot.

We will keep the API key server-side, enforce per-user quotas, avoid cross-tenant caching, apply human review and comply with your Acceptable Use Policy. We will not launch the live provider integration until the relevant permissions and data-processing terms are clear.

Please point us to the controlling contract terms or provide written confirmation/addendum covering the above use.

Regards,  
Arakshya Space Lab

---

**Internal note:** This is a draft only. No email has been sent and no provider account or API key has been connected.
