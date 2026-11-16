---
name: seo
description: "Audit and improve conventional search-engine optimization for GENSER or Aryaksha. Use for technical SEO, crawling/indexing, site architecture, on-page optimization, internal linking, image SEO, performance, accessibility, content quality, link earning and Search Console measurement. Pair with geo-seo when AI answer-engine visibility is in scope."
---

# Search Engine Optimization (SEO) Engineering Skill

## Purpose and boundary

This skill owns **conventional search SEO**: helping search engines discover, crawl, understand, index and present useful public pages. It covers technical SEO, on-page SEO, site architecture, content quality, image discoverability, page experience and ethical authority building.

It is separate from `geo-seo`:
- **SEO**: search crawling, indexation, snippets, organic queries, internal/external links, page experience and Search Console performance.
- **GEO**: AI answer-engine discoverability, citation readiness, entity/context clarity and measurement of AI-mediated answers.

Use both when a task spans both channels. Do not duplicate or conflict with the deployment/crawler protections in `geo-seo`.

## Source basis

Use current primary documentation:
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google crawling and indexing: https://developers.google.com/search/docs/crawling-indexing
- Google page experience: https://developers.google.com/search/docs/appearance/page-experience
- Bing Webmaster Guidelines: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a
- Schema.org: https://schema.org/

Search algorithms and eligibility rules change. Recheck current documentation for implementation-specific decisions; do not rely on old ranking folklore.

## Mandatory workflow

### 1. Establish the real deployment
- Identify production, staging, preview and local environments.
- Verify approved production hostname, canonical URL strategy, redirects and hosting behavior from repository/deployment evidence.
- Preserve preview noindex/disallow protections. Never expose a preview to indexing as part of SEO work.
- Do not change DNS, production hosting, Search Console/Bing ownership, analytics, indexing permissions or release configuration without explicit approval.
- Robots.txt is not access control; private material requires authentication.

### 2. Audit before editing
Inspect:
- HTTP status, redirect chains, canonical URLs, index/noindex directives and robots rules.
- XML sitemap coverage, freshness, canonical consistency and discoverability.
- Titles, descriptions, headings, language, duplicate/thin pages and rendered HTML.
- URL structure, navigation, breadcrumbs where useful, internal links and orphaned pages.
- Structured data validity and correspondence to visible content.
- Image filenames, dimensions, modern formats, loading priority, responsive sources and useful alt text.
- Mobile usability, Core Web Vitals/Lighthouse evidence, accessibility and performance.
- Content usefulness, source quality, authorship, factual accuracy and search intent.
- Search Console/Bing data only where owner-authorized access exists.

Produce prioritized findings with severity, affected URL/component, evidence, likely impact, minimal fix and verification method.

### 3. Fix in risk-first order
1. Indexing blockers, incorrect canonical, redirect loops, broken public routes, server errors and sitemap errors.
2. Duplicate/empty metadata, wrong headings/language, inaccessible content and broken internal links.
3. Thin, stale, inaccurate or unhelpful content; missing sources and unclear page purpose.
4. Image discoverability, page performance, mobile usability and accessibility.
5. Navigation depth, breadcrumbs, sensible internal linking and content architecture.
6. Ethical authority and external-link opportunities grounded in real expertise and useful resources.

### 4. On-page optimization
- Map one primary purpose/search intent to each important page.
- Write unique, accurate titles and descriptions that help users choose; avoid keyword stuffing and boilerplate.
- Use clear headings and semantic HTML; keep one obvious page-level heading where appropriate.
- Use natural language, related terminology and descriptive link text.
- Make important content available in crawlable HTML; do not hide essential information behind interaction-only UI.
- Avoid doorway pages, near-duplicate location pages, keyword variants generated at scale and content written solely to manipulate rankings.
- Do not change URLs without a migration plan, redirects and link updates.

### 5. Technical SEO
- Ensure successful public pages return appropriate status codes.
- Use stable, absolute canonical URLs that resolve and match sitemap entries.
- Sitemap should contain only intended canonical, indexable URLs; exclude redirects, errors and previews.
- Use robots directives deliberately and check meta robots / X-Robots-Tag interactions.
- Keep pagination, faceted navigation, query parameters and duplicate variants intentional.
- Structured data must be valid and reflect visible, verifiable content. Never fabricate ratings, reviews, authors, awards, products, FAQs or organization details.
- Do not add schema purely as a ranking trick or assume it guarantees rich results.
- Optimize rendering, images and Core Web Vitals based on measured bottlenecks, not guesswork.

### 6. Content and authority
- Prioritize original, useful, accurate material for the actual audience.
- Support claims with primary sources and verifiable evidence.
- Build authority through genuinely useful resources, research, partnerships and earned editorial references.
- Never buy links, participate in link schemes, create fake profiles, spam directories, manufacture reviews or automate outreach deceptively.
- Do not invent capabilities, certifications, customers, performance results, authors or credentials.
- Maintain accurate dates and revise content when facts change; do not change dates merely to appear fresh.

### 7. Measurement
- Use Google Search Console and Bing Webmaster Tools only with owner-authorized access.
- Track indexed/canonical URLs, crawl issues, impressions, clicks, CTR, query intent and landing-page performance over meaningful time windows.
- Use Lighthouse/PageSpeed and field data where available; distinguish lab scores from real-user metrics.
- Validate structured data with current official tools.
- Report the exact environment, URLs, date, tools, findings, checks run, outcomes and unresolved items.
- Do not promise ranking positions, traffic gains or rich-result eligibility.

## Project-specific guardrails

### GENSER
- Keep redesign previews noindex/disallowed. Never change preview crawl protections or preview canonicals to make a demo appear in search.
- Use only an explicitly verified, approved production domain as canonical. Do not infer it from a preview URL, historical content or guesswork.
- Preserve aerospace accuracy and approved claims about customers, programmes, certifications and capabilities.
- Do not publish confidential, export-controlled, proprietary or unapproved customer information.
- Respect Joomla/production hosting and DNS boundaries; preview code changes are not production deployment authorization.

### Aryaksha
- Position the product accurately as an educational aerospace engineering workstation, not a certified or flight-critical system.
- Preserve units, model limitations, reference frames, epochs, data provenance and scientific caveats.
- Verify actual production origin before canonical/sitemap changes; distinguish GitHub, AppDeploy and Render preview/deployment origins.
- Do not imply authoritative real-time telemetry, operational mission use or validated performance without evidence.

## Definition of done
- Findings are evidence-backed and prioritized.
- Production vs preview indexing intent remains correct.
- Canonicals, robots, sitemap, redirects and rendered metadata agree.
- Content and structured data are accurate, useful and non-deceptive.
- Focused tests/build pass; inspect rendered HTML and mobile layouts.
- Record commit, affected URLs, verification and remaining risks.
