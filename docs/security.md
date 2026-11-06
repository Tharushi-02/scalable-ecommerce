# Security notes

## Checks run (Day 30)
- `npm audit --omit=dev`: client 0 vulnerabilities; server: 2 high (zod) fixed by `npm audit fix`.
- gitleaks over full Git history (39 commits): no leaks found.
- Trivy image scan (HIGH/CRITICAL, fixable): see results below.

## Accepted risks
| Package | Severity | Why accepted |
|---|---|---|
| glob / minimatch (via node-pg-migrate) | moderate | Only used by the one-off migrate job to list files in `migrations/` with a fixed pattern. No user input reaches it, so it isn't exploitable here. The only offered fix downgrades node-pg-migrate to an older major version. Revisit when node-pg-migrate updates its dependencies. |
| eslint chain | moderate | Dev-only (linting); never deployed. |

## Install scripts
- `@scarf/scarf` (from swagger-ui-express) install script left **unapproved**: it only sends usage analytics, and nothing needs it.

## Protections in place
Helmet headers, zod validation on every endpoint, 1 MB body limit (Nginx + Express), bcrypt passwords,
short-lived JWTs with rotating hashed refresh tokens and reuse detection, Redis rate limits (per account,
per IP with IPv6 grouped by /64, per user for checkout and pay), correct `trust proxy`, parameterised SQL,
secrets only in git-ignored `.env`, non-root containers, internal services not exposed, `/metrics` private.