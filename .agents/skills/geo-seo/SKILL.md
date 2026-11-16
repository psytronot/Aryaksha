---
name: geo-seo
description: "Audit and improve technical SEO and Generative Engine Optimization (GEO) for GENSER or Aryaksha. Use for crawlability, indexability, canonical metadata, sitemap/robots, structured data, content clarity, entity trust, citation readiness, AI search visibility and measurement. GEO means Generative Engine Optimization here, not local geographic SEO."
---

# GEO + SEO Engineering Skill

## Purpose

Improve discoverability in conventional search and AI answer experiences through technically sound, useful, trustworthy pages. GEO means **Generative Engine Optimization** in this repository. It does not mean adding city keywords or local-business landing pages.

**Principle: documentation quality, not ranking tricks.** Search and answer engines decide what to crawl, index, rank, summarize or cite. Never promise rankings, citations or traffic from an implementation change.

## Source basis and attribution

This project-local workflow is an original adaptation informed by:
- Google Search Central, *Optimizing your website for generative AI features on Google Search*: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Bing Webmaster Guidelines: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- Schema.org: https://schema.org/
- The GEO skill by Tech Leads Club / Fernando Paladini: https://github.com/tech-leads-club/agent-skills (MIT; concepts adapted, not bundled wholesale).

Google's guidance explicitly says normal SEO foundations remain relevant. It also says llms.txt, forced content chunking, special GEO markup and inauthentic mentions are not ranking requirements. Do not turn these into mandatory tasks.

## Six quality pillars

1. **Discoverable** — public pages return successful responses, robots rules are intentional, sitemap URLs are canonical and current, HTTPS works, canonical tags resolve correctly, and important content is crawlable.
2. **Understandable** — descriptive title/description, one clear primary heading, semantic structure, correct language, stable URL, clear page purpose and internal links.
3. **Useful** — original, accurate, audience-first content with clear answers, useful evidence, real examples and no doorway/duplicate pages.
4. **Trustworthy** — accountable organization/authorship where appropriate, verifiable contact/about details, primary-source citations, accurate dates, transparent limits and no fabricated claims.
5. **Quotable** — self-contained sections, descriptive headings, precise definitions, concise answer-first paragraphs where natural, meaningful lists/tables, clear attribution and visible sources.
6. **Fresh** — review genuinely time-sensitive claims, update visible dates and structured data only when content materially changes, remove stale claims and preserve version/history where useful.

## Mandatory workflow

### A. Establish deployment truth before SEO changes
- Identify production, staging, preview and local origins separately.
- Inspect hosting configuration, canonical URL, sitemap, robots and redirect behavior.
- Never remove a preview's intentional `noindex` or `Disallow: /` protection.
- Never make a preview canonical to itself if the approved public domain is known; never guess the production domain.
- Do not change DNS, Search Console, Bing Webmaster Tools, analytics, production hosting or release settings without explicit approval.

### B. Audit existing implementation before editing
Inspect metadata/head, server rendering, routes, robots, sitemap, redirects, structured data, page content, image alt text, internal links, mobile performance and build/test configuration. Trace framework-specific generation (e.g. Next metadata/robots/sitemap APIs or static HTML) rather than layering duplicate tags.

Produce a prioritized findings table: severity, URL/component, evidence, user/search impact, smallest safe fix, verification.

### C. Fix in priority order
1. Accidental index blocking, wrong canonical/origin, broken sitemap/robots, 4xx/5xx or redirect loops.
2. Missing/duplicate/incorrect title, description, language, canonical, headings and internal links.
3. Inaccurate or invalid structured data; it must exactly reflect visible page content.
4. Missing substantive content, unclear page purpose, weak provenance, stale claims or poor content hierarchy.
5. Image alternatives, performance, mobile usability and other page experience issues.

### D. Structured data rules
- Use Schema.org types only when they accurately describe the page and visible content.
- Do not add fake reviews, ratings, FAQs, authors, dates, locations, credentials, awards, product availability or organization facts.
- JSON-LD is not a special GEO ranking switch. Structured data helps machines interpret content and can enable supported rich results; it does not guarantee AI citations.
- Do not add FAQPage markup just because a page contains questions. Follow current search-engine eligibility rules.
- Escape serialized JSON-LD safely and validate it with Schema.org Validator and Google's Rich Results Test where applicable.

### E. Robots and AI crawlers
- Read the actual robots.txt and provider documentation before changing crawler policy.
- Distinguish search crawlers from model-training crawlers. For OpenAI, OAI-SearchBot and GPTBot serve different purposes; blocking one must not be assumed to block the other.
- Never blanket-allow or blanket-block crawlers without owner intent and a documented privacy/licensing decision.
- Robots.txt is a crawl directive, not access control. Protect private content with authentication.
- Do not insert a crawler policy into a preview that overrides its intentional noindex/disallow behavior.

### F. llms.txt
- Optional, never a prerequisite for SEO/GEO.
- Google Search says llms.txt is not used as a special mechanism for Search or AI feature eligibility.
- Add only if there is a clear human/agent navigation use case, the owner approves maintenance, and links are canonical and public. Do not create one as a claimed ranking boost.

### G. Content and entity quality
- Write for actual audiences, not a synthetic list of prompt variants.
- Prefer original engineering insight, documented methods, real project examples, clear limitations and primary references.
- Avoid mass-produced thin pages, keyword stuffing, fabricated testimonials, fake authority/mentions and unsupported superlatives.
- Preserve scientific accuracy, dates, units, provenance and educational/operational limitations.

### H. Measurement and reporting
- Use Search Console and Bing Webmaster Tools only when the site owner has verified access and has approved connection/configuration.
- Use Lighthouse/PageSpeed for technical page experience, and rich-results/schema validators for markup.
- Compare indexed pages, crawl errors, query impressions/clicks and referral/citation observations over time. Separate correlation from causation.
- AI citation checks are snapshots, not ranking guarantees. Record engine, prompt, date, cited URL and competitors if manually sampled.
- Report exact checks run, URLs tested, results, unverified areas and owner actions still needed.

## Project-specific guardrails

### GENSER
- Preserve production Joomla/hosting/DNS boundaries; the redesign preview is not production.
- Preview environments must remain noindex/disallowed unless the release owner explicitly approves public indexing.
- Use the approved production domain only when it is documented and verified; do not infer it from old content or preview URLs.
- Keep aerospace, customer, programme, certification and capability claims evidence-backed and approved.
- Do not publish unapproved imagery, customer identities or sensitive programme details.

### Aryaksha
- Describe the product as an educational aerospace engineering workstation, not a flight-critical or certified system.
- Preserve model limitations, units, reference frames, epochs, data source and provenance.
- Distinguish demo/AppDeploy, Render and GitHub deployment origins. Do not assume a source repo's canonical host is the public production origin.
- Do not imply real-time telemetry, authoritative operational data or validated mission performance unless supported.

## Definition of done
- Each finding has evidence and a prioritized disposition.
- No preview index-protection regression.
- Metadata, canonicals, robots, sitemap and structured data match the verified deployment.
- No invented claims, fake schema or duplicate SEO tags.
- Focused tests/build pass; inspect rendered HTML and mobile layout.
- Record exact commit, URL, tools/checks, outcomes and unresolved risks.
