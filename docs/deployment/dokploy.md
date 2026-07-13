# Dokploy Deployment Runbook

Operator runbook for deploying this static Astro/nginx site to a self-managed VPS
through Dokploy. It transcribes the deployment contract from
`docs/superpowers/plans/2026-07-10-astro-landing-dokploy.md` (Task 12) and is
cross-checked against the current `Dockerfile` and `nginx.conf`.

> **No remote deployment has been performed.** This document is the repository
> deliverable only. The required operator inputs and remote access (see
> [Required operator inputs](#required-operator-inputs)) are absent in the
> authoring environment, so every step past the preflight gate is left for the
> operator to run on the VPS.

## Required operator inputs

These are **required operator inputs**, not repository defaults. Do not invent or
substitute example values for any of them.

| Input | Meaning | Source |
| --- | --- | --- |
| `PRODUCTION_DOMAIN` | Public hostname the site serves on (e.g. the school's domain). | Operator |
| Production branch | The Git branch Dokploy builds from. | Operator |
| VPS / Dokploy access | SSH and Dokploy dashboard credentials for the target host. | Operator |
| DNS control | Ability to create the A/(AAAA) record for `PRODUCTION_DOMAIN`. | Operator |

## Preflight gate (fail fast)

Stop immediately if `PRODUCTION_DOMAIN` is empty. Run this before any deploy,
domain, or HTTPS step; it aborts without contacting infrastructure:

```bash
: "${PRODUCTION_DOMAIN:?PRODUCTION_DOMAIN is a required operator input — stop; do not deploy}"
```

Do the same human check for the production branch, Dokploy access, and DNS
control. If any is missing, **halt** — do not proceed to the destructive/remote
steps below.

## Step 1 — Dokploy Application configuration

Create a Dokploy **Application** (not a Docker Compose service) with exactly these
values:

```text
Resource: Application
Source: project Git repository
Branch: production branch selected by the operator
Build type: Dockerfile
Build context: .
Dockerfile path: Dockerfile
Build argument: PUBLIC_SITE_URL=https://$PRODUCTION_DOMAIN
Container port: 80
Published host ports: none
Health URL: /healthz
Health interval: 30 seconds
Health timeout: 3 seconds
```

`PRODUCTION_DOMAIN` is a required operator input, not a repository default. The
runbook must stop if it is empty (see [Preflight gate](#preflight-gate-fail-fast)).

## Step 2 — Infrastructure prerequisites

```text
- Dokploy is installed and reachable on the VPS.
- Dokploy can read the repository/production branch.
- DNS A record points PRODUCTION_DOMAIN to the VPS IPv4 address.
- DNS AAAA exists only when IPv6 routing is configured.
- VPS firewall allows inbound TCP 80 and 443.
- No application host port is published; Traefik routes to container port 80.
```

## Step 3 — Domain and HTTPS sequence

```text
1. Verify DNS resolution from outside the VPS.
2. Deploy application and wait for healthy status.
3. Add PRODUCTION_DOMAIN in Dokploy Domains.
4. Set container port 80.
5. Enable HTTPS/Let's Encrypt and HTTP→HTTPS redirect.
6. Verify certificate hostname, issuer and expiry.
```

This matches Dokploy's Application/Traefik model; do not use Docker Compose labels
for this single-container site.

## Step 4 — Production smoke and rollback

### Logs

Dokploy exposes the build and runtime logs for the Application under its
deployment view. Read them there to confirm a healthy status before smoke, and
capture them on failure (rollback Step 1). The container's own liveness is
reported by the Docker `HEALTHCHECK` against `/healthz` (see
[Repository cross-check](#repository-cross-check)).

### Production smoke

Run after the preflight gate has confirmed `PRODUCTION_DOMAIN`:

```bash
curl --fail --silent --show-error "https://$PRODUCTION_DOMAIN/healthz"
curl --fail --silent --show-error "https://$PRODUCTION_DOMAIN/" | grep -F "Здоровье без таблеток"
```

The first command asserts the health endpoint returns success; the second asserts
the homepage renders the approved title copy (`src/pages/index.astro`).

### Rollback

```text
1. Mark the failed Dokploy deployment and save logs.
2. Select the immediately previous successful deployment/image.
3. Redeploy it without changing DNS.
4. Re-run /healthz and homepage smoke commands.
5. Never patch files inside the running container.
```

## Step 5 — Official Dokploy references

```text
https://docs.dokploy.com/docs/core/applications
https://docs.dokploy.com/docs/core/domains
https://docs.dokploy.com/docs/core/docker-compose/domains
```

The Compose link is included only to explain why this Application does not use
Traefik labels.

## Repository cross-check

The runbook values above are consistent with the current repository build:

| Runbook item | Repository source | Confirmed |
| --- | --- | --- |
| Build type `Dockerfile`, context `.` | `Dockerfile` (multi-stage `node` → `nginx`) | confirmed |
| Build argument `PUBLIC_SITE_URL` | `Dockerfile` (`ARG`/`ENV PUBLIC_SITE_URL`); consumed in `astro.config.mjs` | confirmed |
| Container port `80` | `Dockerfile` `EXPOSE 80`; `nginx.conf` `listen 80` | confirmed |
| Health URL `/healthz` | `nginx.conf` `location = /healthz { return 200 "ok" }`; `Dockerfile` `HEALTHCHECK … /healthz` | confirmed |
| Health interval 30s / timeout 3s | `Dockerfile` `HEALTHCHECK --interval=30s --timeout=3s` | confirmed |
| No published host ports; Traefik routes to `:80` | `nginx.conf` serves on `:80`; no host port bindings in repo | confirmed |
| Security headers present | `nginx.conf` `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` | confirmed |
| Static caching (`/_astro` immutable, `index.html` no-cache) | `nginx.conf` `location ^~ /_astro/`, `location = /index.html` | confirmed |
| Homepage smoke string | `src/pages/index.astro` title `Здоровье без таблеток…` | confirmed |

## Remote execution status (unresolved operator gate)

Remote execution of this runbook was **not** performed. The blockers are operator
inputs and access that are absent here:

- `PRODUCTION_DOMAIN` — not supplied; the preflight gate halts the runbook.
- Production branch — not selected.
- VPS / Dokploy dashboard credentials and reachability — not supplied.
- DNS control for `PRODUCTION_DOMAIN` — not supplied.

Until an operator provides these and runs Steps 1–5 on the VPS, no production
deployment exists and none is claimed by this document.
