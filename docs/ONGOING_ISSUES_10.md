# Ten issues found in the active Arakshya work — remediation log

**Repository:** `psytronot/Aryaksha`  
**Branch:** `security/hardening-20-checklist`  
**Review date:** 2026-11-15  
**Scope:** active security hardening, backend API boundaries, CI reliability and the software-products work. This is a source-level review, not a production penetration test.

| # | Issue found | Risk | Remediation | Status |
|---:|---|---|---|---|
| 1 | Orekit's 90-second abort timer was cleared as soon as response headers arrived, so a stalled response body could hang beyond the intended timeout. | Upstream resource exhaustion / hung requests | Keep the abort timer active through content-type validation, bounded body consumption, JSON parsing and normalization. | Fixed in `backend/server.mjs` |
| 2 | Orekit response parsing used unbounded `response.json()` and did not enforce a JSON content type. | Memory exhaustion and ambiguous upstream responses | Require `application/json`, cap the streamed body at 64 KiB, parse explicitly and reject invalid JSON. | Fixed in `backend/server.mjs` |
| 3 | CelesTrak ISS requests had no explicit timeout. | Requests could remain open indefinitely during provider stalls. | Add a 10-second abort deadline that remains active through body consumption. | Fixed in `backend/server.mjs` |
| 4 | CelesTrak output was unbounded and its redirect destination/content type/TLE validity were not checked. | Oversized or unexpected provider data could enter tracking responses. | Cap at 16 KiB; require HTTPS `celestrak.org`, `text/plain`, valid 69-character TLE lines and successful SGP4 parsing. | Fixed in `backend/server.mjs` |
| 5 | NASA imagery used `arrayBuffer()`, so a chunked upstream response without Content-Length could exceed the asset budget before validation. | Memory exhaustion through oversized upstream image bodies. | Stream into a bounded buffer and abort once the per-asset byte limit is exceeded. | Fixed in `backend/planetaryImagery.mjs`; regression tests added |
| 6 | The in-memory rate limiter evicted the oldest active client entry when its map filled. | Source-IP churn could erase another client's active rate-limit budget. | Expire stale entries only; reject new clients with HTTP 503 when the map remains full. Added a regression test. | Fixed in `backend/security.mjs` |
| 7 | Rate limiting is process-local and resets on restart; it is not shared across Render instances. | Distributed deployments can multiply the effective request budget and restart resets abuse state. | Documented as a production scale-up gate. A shared Redis/managed limiter or edge/WAF quota requires an approved provider and credentials not available in this repository. | Open operational blocker; do not claim distributed protection |
| 8 | Trusted proxy depth was hard-coded to one hop. | A different hosting topology could misidentify client IPs and HTTPS state. | Introduced validated `TRUST_PROXY_HOPS` (integer 0–5); keep default 1 only for the verified Render topology. | Fixed in `backend/server.mjs`; hosting value still needs verification |
| 9 | Orekit response allowlisting lacked a focused test proving extra fields were not forwarded. | A future refactor could reintroduce broad upstream object spreading. | Extracted `normalizeOrekitResponse` and added positive, negative and extra-field regression tests. | Fixed in `backend/orekitResponse.mjs` and `tests/orekit-response.test.mjs` |
| 10 | Secret scan evidence covered only the PR comparison range, not all fetched refs and their reachable history. | Historical credentials could be missed by a green PR-diff scan. | Added a separate Gitleaks CLI job using `--log-opts="--all"` after full-depth checkout. The earlier PR-range scan found no leaks in 15 commits; the new all-ref job must pass before this control is closed. | Implemented; first all-ref CI result pending |

## Additional reliability/documentation repairs

- CI now cancels superseded runs on the same branch/ref instead of spending runner capacity on stale commits.
- The 20-point security review now distinguishes the PR-range scan from the all-ref scan and records the new upstream limits and response tests.
- The route inventory now documents the actual Orekit 503 behavior, CelesTrak validation, and process-local rate-limit limitation.

## Verification still required

1. Wait for the latest CI run on this branch and inspect every job, especially full-repository secret history, browser E2E, and the new backend regression tests.
2. Run a genuinely all-ref history scan and review any finding; rotate any exposed secret before considering history cleanup.
3. Verify `TRUST_PROXY_HOPS=1` against the actual Render request path and inspect deployment secrets in the Render dashboard.
4. Configure a shared rate-limit store or edge quota before horizontal scaling or high-volume public exposure.
5. Run live post-deploy API and browser smoke tests only after an approved deployment; no production deployment is performed by this review.

**Release rule:** an item marked Fixed above means the source change and/or regression test exists. It does not mean production hosting, distributed abuse controls, or the full CI suite has passed.
