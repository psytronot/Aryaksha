# Security Policy

Aryaksha is an educational space-engineering project. Do not use it for flight-critical decisions.

## Reporting a vulnerability

Please do not publish exploit details or secrets in a public issue. Use GitHub's **Report a vulnerability** feature on this repository (Security tab) when private vulnerability reporting is enabled. If that option is unavailable, open an issue asking the maintainers for a private reporting channel without including exploit details.

Include the affected component, impact, reproduction steps, and any suggested mitigation. Please allow maintainers reasonable time to investigate before public disclosure.

## Secrets and credentials

Never commit API keys, access tokens, private keys, passwords, production environment files, or personal data. If a secret is exposed, revoke or rotate it immediately; deleting it from the latest commit alone does not invalidate it.

## Scope

Reports may cover the web application, API, dependencies, GitHub Actions workflows, and the Orekit service. Please distinguish confirmed vulnerabilities from theoretical concerns.

## Production security baseline

The following account- and host-level controls must be enabled by a repository/hosting administrator. A committed policy file does not enable these controls by itself.

### GitHub repository

- Set repository visibility to **Private** if the source is proprietary. Public forks and copies made before the change cannot be recalled.
- Enable the GitHub dependency graph, secret scanning, and push protection where available; review and remediate existing alerts. The dependency-review workflow requires the dependency graph to be enabled before it can be added as a required check.
- Enable private vulnerability reporting.
- Protect `main` with a ruleset: require pull requests, require the CI and CodeQL checks, block force pushes and branch deletion, and require conversation resolution.
- Require signed commits if the owner's signing workflow is configured.
- Enforce two-factor authentication on the GitHub account and review collaborator access.
- Keep Dependabot security updates and GitHub Actions updates enabled.

### Render and production services

- Store all credentials as Render environment variables; never put secrets in frontend `VITE_*` variables or commit them to Git.
- Restrict production environment access to the owner and essential operators.
- Keep the Orekit service private to backend-to-backend traffic where the hosting plan and network architecture permit it. If it must be public, add service authentication and rate limiting before exposing sensitive or costly operations.
- Rotate credentials immediately after suspected exposure; inspect deployment logs and access history.
- Verify TLS, security headers, API rate limits, request-size limits, and health checks after every release.

### Application controls and known limitations

- The API sets baseline browser security headers, a report-only Content Security Policy, request-size limits, and per-process rate limits.
- HSTS is emitted only when the request is confirmed as HTTPS by the trusted proxy configuration.
- The Content Security Policy remains in report-only mode until production violation reports are reviewed against the Three.js, imagery, and browser-worker requirements. Do not switch it to enforcement without a compatibility review.
- The in-memory rate limiter is per process/instance. It is not a distributed abuse-control boundary; use a shared store or edge-level protection for multi-instance production traffic.
- Public browser-delivered JavaScript, HTML, CSS, and assets can be inspected. Keep proprietary algorithms, credentials, and privileged data operations on authenticated server-side services. Obfuscation is not a security boundary.
- A successful CI run or deployment is not a penetration test or a guarantee that the application is secure.

## Scope of this policy

This document describes the intended security posture. It does not certify the system, replace a security assessment, or guarantee that every control is enabled in GitHub or Render.
