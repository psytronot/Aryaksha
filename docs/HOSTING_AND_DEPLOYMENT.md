# Hosting and deployment decision

**Reviewed:** 2026-11-16  
**Scope:** Arakshya / Aryaksha only. GENSER has a separate hosting decision in its own repository.

## Decision

Keep the existing Render topology for the current Arakshya application:

- One Render Node Web Service serves the Vite-built frontend and Express API from the same origin.
- A separate Render Docker Web Service hosts the Java/Spring Boot Orekit engine.
- Do not split the frontend onto a static host yet. The current UI expects same-origin `/api/*` routes, and the Express server owns API validation, security headers, rate limiting and static SPA fallback. Splitting now would require an explicit API-origin, CORS, CSP, cookie/auth and environment configuration change.

This is a demo/preview topology on free compute, not a production-availability guarantee.

## Verified production topology

| Component | Render service | Branch | URL | Latest known live deployment |
|---|---|---|---|---|
| Vite UI + Express API | `aryaksha-web` (`srv-dbhm5nks728c73d2f73g`) | `main` | https://aryaksha-web.onrender.com | `f11ce41b73faf41ff81dad496070193ec694dd62` |
| Orekit API | `aryaksha-orekit` (`srv-dbhm5p942hec73cr4ddg`) | `main` | https://aryaksha-orekit.onrender.com | Latest deployment recorded live on the same main revision at the time of this review |

The web service runs `npm install && npm run build`, then `npm start`; the Node process serves `dist/` and handles API routes. The Orekit service builds from `orekit-service/Dockerfile` in the `orekit-service` context. Both services currently use Render Free compute in Singapore.

The web service requires `OREKIT_SERVICE_URL=https://aryaksha-orekit.onrender.com` for the numerical mission-analysis route. Never put secrets into the repository or frontend build variables.

## Software Products PR #124

- Feature branch: `feature/software-products-hub`.
- Current reviewed branch commit: `2cfdebd8508291d07994564423109446a053fe73`.
- This branch is not the Render production branch and is not currently deployed by `aryaksha-web`.
- Keep PR #124 as a draft until the full Playwright suite and all required checks are green.
- A public staging deployment should be a separate Render Web Service attached to the feature branch, not a change to the existing `aryaksha-web` service. Build with `npm ci && npm run build`, start with `npm start`, and set `OREKIT_SERVICE_URL` to the existing Orekit service. Create it only after CI passes and the owner approves a public preview; a public URL is not access-controlled by default.
- Do not point the production domain or `main` deployment at the feature branch. Do not deploy the Google Maps scraping workflow; it remains compliance-blocked.

## Free-tier reality and launch recommendation

Render documents the following Free Web Service constraints:

- Services spin down after 15 minutes without inbound traffic and take about one minute to wake.
- Free web services have ephemeral filesystems, no persistent disks, no horizontal scaling and can be restarted.
- Each workspace receives 750 free instance-hours per calendar month; bandwidth and build pipeline allowances are shared across services.
- Free Render Postgres expires after 30 days and has no backups; do not use it as the durable production database.

These constraints apply to both the web/API service and Orekit service. They are acceptable for demos and early evaluation but can cause slow first requests and unreliable customer experience.

**Recommended path:**
1. Keep current free services for engineering demos and low-stakes preview while verifying the end-to-end user journeys.
2. Before public customer launch, budget for always-on paid compute for both the web/API and Orekit services, or move the backend to an equivalent managed always-on host. Size Orekit with a measured load test; do not assume the smallest instance will sustain production traffic.
3. Add a managed persistent database only when user accounts, saved projects or hosted research jobs are implemented. Include backups, migrations, tenant isolation, retention and deletion before storing customer data.
4. Keep First Customer Finder's hosted job runner/provider integration separate from the existing web process until provider approval, authentication, queue/worker, quotas and tenant isolation are implemented.
5. Keep the current same-origin frontend/API design until there is a measured reason to split it.

## Platform comparison for future static-only projects

| Platform | Appropriate use | Important constraints |
|---|---|---|
| Render Static Site | Static landing pages, docs and exports | Free; shared bandwidth/build allowances. Existing Render account is already connected. |
| Cloudflare Pages | Static sites with private GitHub integration and branch/PR previews | Free tier currently has 500 builds/month, one concurrent build, 20-minute timeout, 20,000 files and 25 MiB per asset. No connected Pages project was verified. |
| Netlify Free | Small static projects where its metered allowance is acceptable | 300 credits/month; usage exhaustion can pause sites. No connected Netlify projects were found. |
| Vercel Hobby | Personal, non-commercial prototypes | Free Hobby terms restrict use to personal/non-commercial projects; not the default for a commercial product. |

For future static-only marketing sites, Cloudflare Pages is a credible alternative if a Cloudflare account and GitHub integration are deliberately set up. For the existing GENSER site, keep Render because it is already deployed and owner preference is to retain the working preview. For Arakshya, keep the combined Render web/API service plus Orekit until the API boundary is intentionally redesigned.

## Domains, DNS and environments

- Use separate preview/staging and production hostnames. Example naming only: `preview.<brand-domain>`, `app.<brand-domain>` and `api.<brand-domain>`; actual domain names and DNS provider must be confirmed from the owner.
- Do not transfer nameservers, alter existing DNS, register domains or change production routing as part of this PR.
- Keep production deployment tied to an approved `main` commit; deploy preview from a dedicated branch/service; promote only after CI, browser, live API, accessibility, security and rollback gates pass.
- Add a service health check at `/api/v1/health` for the web/API and Orekit services after confirming the exact health contract and configuring it in Render. Current Render service health-check fields are empty.
- Keep the deployment runbook current with service IDs, deployment IDs, health URLs, environment-variable names (never values), rollback targets and evidence timestamps.

## Owner decisions still required

- Confirm the domains and who controls their DNS.
- Approve whether a separate public PR preview should be created for PR #124 after CI is green.
- Approve any paid always-on compute before customer launch.
- Approve any production domain cutover separately.

## Verified boundaries

- This is a documentation-only hosting decision.
- No Render service, build command, environment variable, domain, DNS, database, production deployment or PR merge was changed.
- Render service/deployment inventory and GitHub branch/PR state were read on 2026-11-16. Recheck immediately before any release.
