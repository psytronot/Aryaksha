# Security Policy

Aryaksha is an educational space-engineering project. Do not use it for flight-critical decisions.

## Reporting a vulnerability

Please do not publish exploit details or secrets in a public issue. Use GitHub's **Report a vulnerability** feature on this repository (Security tab) when private vulnerability reporting is enabled. If that option is unavailable, open an issue asking the maintainers for a private reporting channel without including exploit details.

Include the affected component, impact, reproduction steps, and any suggested mitigation. Please allow maintainers reasonable time to investigate before public disclosure.

## Secrets and credentials

Never commit API keys, access tokens, private keys, passwords, production environment files, or personal data. If a secret is exposed, revoke or rotate it immediately; deleting it from the latest commit alone does not invalidate it.

## Scope

Reports may cover the web application, API, dependencies, GitHub Actions workflows, and the Orekit service. Please distinguish confirmed vulnerabilities from theoretical concerns.
