[![CI](https://github.com/Tharushi-02/scalable-ecommerce/actions/workflows/ci.yml/badge.svg)](https://github.com/Tharushi-02/scalable-ecommerce/actions/workflows/ci.yml)

# Scalable E-Commerce Platform

A full-stack e-commerce platform built to **measure and prove scalability**, not just claim it:
Redis caching, Nginx load balancing across stateless API replicas, a Dockerized stack with
monitoring, and CI that tests the whole system on every push.

**Measured on one laptop (Docker Desktop, 12 cores, load generator on the same machine):**

| | Result |
|---|---|
| Concurrent shoppers (k6, realistic journeys) | **3,000 at 0% errors** (p95 browse 127 ms, checkout 474 ms) |
| Peak throughput (3 replicas) | **~3,900 req/s** |
| Redis cache vs database only | **~230 → 1,000+ req/s**, p95 **2,316 ms → 2.4 ms** at 250 req/s |
| Replica killed under ~3,400 req/s | **0 failed responses** (Nginx failover) |

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Performance results](#performance-results)
- [Screenshots](#screenshots)
- [Run it locally](#run-it-locally)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Project structure](#project-structure)
- [What I learned](#what-i-learned)
- [Limitations and next steps](#limitations-and-next-steps)

## Features

**Shop**
- Product catalogue with category, price and stock filters, sorting, pagination and full-text-style search (`ILIKE` backed by a `pg_trgm` GIN index)
- Cart, checkout and mock card payments, with an order history and an order status timeline
- Order lifecycle: pending → paid → shipped → delivered, with cancel and refund rules (state machine)
- Admin: product management, order management, stats

**Correctness under concurrency**
- Checkout runs in a **database transaction** with `SELECT … FOR UPDATE` row locks taken in a fixed order, so **stock can never be oversold**. A race test fires 20 buyers at 5 items: exactly 5 orders succeed and 15 get `409 Sold out`
- Payments can't be taken twice (partial unique indexes + state checks)
- Money is handled in integer cents

**Security**
- JWT access tokens (15 min) + **rotating refresh tokens** (stored hashed, with reuse detection), bcrypt passwords, role-based access
- Input validation with zod on every endpoint, Helmet headers, 1 MB body limit at Nginx and Express
- **Redis rate limiting**: per account (any IP), per IP (IPv6 grouped by /64), per user for checkout and payment, with `429` + `Retry-After`
- `trust proxy` set to the real number of proxies, so client IPs can't be spoofed via `X-Forwarded-For`
- Secrets only in `.env` (git-ignored); CI generates throwaway secrets for each run

**Scalability**
- **Cache-aside with Redis** for product lists and details, versioned list keys for cheap invalidation, and cached JSON served as text (no re-serialising on a hit)
- **Stateless API**: JWTs, Postgres and Redis hold all shared state, so any replica can serve any request
- **3 replicas behind Nginx** (round-robin), with DNS re-resolution (`resolve`) so scaling up/down needs no restart, upstream keep-alive, and automatic retry of safe requests on another replica
- Nginx serves the React build with **gzip** and **immutable caching** for fingerprinted assets
- B-tree partial indexes and trigram indexes chosen with `EXPLAIN ANALYZE`

## Architecture

```mermaid
flowchart LR
  U[Browser] -->|HTTPS| T[HTTPS edge<br/>Cloudflare Tunnel / Caddy]
  T --> N[Nginx<br/>React build, gzip, caching,<br/>load balancing]
  N -->|/api round-robin| S1[API replica 1]
  N --> S2[API replica 2]
  N --> S3[API replica 3]
  S1 & S2 & S3 --> R[(Redis 7<br/>cache + rate limits)]
  S1 & S2 & S3 --> P[(PostgreSQL 16)]
  M[migrate job] -->|on start| P
  PR[Prometheus<br/>scrapes /metrics] -.-> S1 & S2 & S3
  PR -.-> RE[redis-exporter]
  PR -.-> PE[postgres-exporter]
  G[Grafana] --> PR
```

- **Nginx** is the only public entry point. The API servers, Postgres and Redis live on Docker's private network.
- **API servers** are Express 5 apps in layers: routes → controllers → services → repositories.
- **Migrations** run as a one-off job before the servers start (Compose `depends_on: service_completed_successfully`).
- **Monitoring**: each replica exposes Prometheus metrics (request histogram per route, cache hits/misses, Node CPU, memory, event loop lag). Prometheus discovers replicas through DNS, and Grafana shows a provisioned dashboard.

## Tech stack

| Area | Tools |
|---|---|
| Backend | Node.js 24, Express 5, PostgreSQL 16 (`pg`), Redis 7 (`ioredis`), zod, JWT, bcrypt, node-pg-migrate |
| Frontend | React (Vite), React Router 7, Zustand |
| Infrastructure | Docker (multi-stage builds), Docker Compose, Nginx |
| Observability | prom-client, Prometheus, Grafana, redis/postgres exporters |
| Testing | Node test runner (API integration tests), k6 (load tests), race-condition test |
| CI/CD | GitHub Actions, Docker Hub |

## Performance results

All numbers come from [`docs/benchmarks.md`](docs/benchmarks.md), which logs every test and its setup.
Environment: one Windows laptop, Docker Desktop, 12 cores; the load generator ran on the same machine,
so these are conservative.

### Redis cache: on vs off (k6, fixed request rate, 201,000 products)

| Cache | Target | Achieved | p50 | p95 | Dropped requests |
|---|---|---|---|---|---|
| Off | 250 req/s | 238 | 727 ms | 2,316 ms | 213 |
| Off | 1,000 req/s | 225 | 8,591 ms | 10,335 ms | 44,542 |
| **On** | 250 req/s | 249 | 1.2 ms | **2.4 ms** | 0 |
| **On** | 1,000 req/s | 998 | 1.0 ms | **2.5 ms** | 0 |

Without the cache, the database saturates at ~230 req/s and extra load only grows the queue.

### Concurrent users (k6: 70% browse, 20% search, 10% buy, with think time)

| Peak users | Req/s | Errors | p95 browse | p95 checkout | Orders paid |
|---|---|---|---|---|---|
| 1,000 | 351 | 0% | 5 ms | 30 ms | 1,163 |
| 2,000 | 695 | 0% | 103 ms | 517 ms | 2,242 |
| 3,000 | 1,048 | 0% | 127 ms | 474 ms | 3,384 |

The limit here was the load generator's memory (~0.5 MB per virtual user), not the shop.

### Other measured improvements

| Change | Before | After |
|---|---|---|
| B-tree indexes: home page query | 32 ms | 0.25 ms |
| Trigram index: rare search | 77–97 ms | 2.9 ms |
| Nginx upstream keep-alive | 1,605 req/s, p99 89 ms, failures from port exhaustion | 2,953 req/s, p99 31 ms, 0 errors |
| gzip: JS bundle / product JSON | 290 KB / 8.1 KB | 90 KB / 2.0 KB |
| Serve cached JSON as text (A/B, alternating runs) | 1.30 ms CPU/request | 0.98 ms (−24% avg) |
| 1 → 3 replicas (load generator inside Docker) | 2,547 req/s | 5,721 req/s |

## Screenshots

| Shop | Grafana under 1,000 users |
|---|---|
| ![Shop](docs/screenshots/shop.png) | ![Grafana](docs/screenshots/grafana-1000-users.png) |

| Failover: a replica killed under load | CI catching a bug in a pull request |
|---|---|
| ![Failover](docs/screenshots/grafana-failover.png) | ![CI](docs/screenshots/ci-caught-bug.png) |

## Run it locally

Requirements: Docker Desktop, Node.js 24 (only for seeding and tests).

```bash
git clone https://github.com/Tharushi-02/scalable-ecommerce.git
cd scalable-ecommerce
cp .env.example .env          # then set real values (long random secrets)
docker compose up -d --build  # postgres, redis, migrations, 3 API replicas, nginx, monitoring
```

Seed demo data (1,000 products, 21 users, password `Password123!`):

```bash
cd server
npm ci
set -a; source ../.env; set +a
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5433/${POSTGRES_DB}"
npm run seed
```

<details>
<summary>Same on Windows PowerShell</summary>

```powershell
cd server
npm ci
Get-Content ..\.env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item "Env:$($matches[1])" $matches[2] } }
$env:DATABASE_URL = "postgres://$($env:POSTGRES_USER):$($env:POSTGRES_PASSWORD)@localhost:5433/$($env:POSTGRES_DB)"
npm run seed
```
</details>

| Open | URL |
|---|---|
| Shop | http://localhost:8080 (log in as `customer1@example.com` / `Password123!`) |
| Grafana | http://localhost:3000 (user `admin`, password from `GRAFANA_ADMIN_PASSWORD`) |
| Prometheus | http://localhost:9090 |

Useful commands: `docker compose ps`, `docker compose logs -f server`, `docker compose up -d --scale server=5`,
`docker compose down` (keeps data), `docker compose down -v` (wipes data).

## Testing

| Test | Command | What it checks |
|---|---|---|
| API integration (18 tests) | `cd server && npm run test:api` | catalogue, cache HIT/MISS, auth, cart → checkout → pay, access control, security headers, 413, 429 |
| Load tests (k6 in Docker) | `.\loadtest\run.ps1 mixed.js -K6Args @('-e','PEAK=1000')` | realistic journeys with thresholds (p95, error rate) |
| Throughput / stress | `.\loadtest\stress.ps1 -Rates 1000,2000,4000` | fixed arrival rate, CPU snapshots per container |
| Race condition | `cd server && npm run race` (dev mode) | 20 buyers, 5 in stock → exactly 5 orders |

Load tests need `LOAD_TEST_MODE=true` (disables rate limits, since all traffic comes from one IP). It is off by default
and logs a warning when on.

## CI/CD

Every push and pull request runs [GitHub Actions](.github/workflows/ci.yml):

1. **Lint and build**: ESLint (server), oxlint + Vite build (client)
2. **Integration tests**: starts the full Docker stack on the runner, seeds it, runs the 18 API tests; container logs are printed on failure
3. **Publish** (pushes to `main` only, after 1 and 2 pass): builds the server and client images and pushes them to Docker Hub as `latest` and `sha-<commit>`

A deliberately broken rate limiter in a pull request was caught by step 2 and never reached `main`.

## Project structure

```
├── client/                 React app + Nginx config (Dockerfile builds it, Nginx serves it)
├── server/
│   ├── src/
│   │   ├── modules/        auth, products, categories, cart, orders, admin (routes/controller/service/repository)
│   │   ├── middleware/     auth, validation, rate limiting, errors
│   │   ├── utils/          cache-aside helpers, errors
│   │   ├── db/             Postgres pool, Redis client, seed
│   │   └── metrics.js      Prometheus metrics
│   ├── migrations/         SQL migrations (node-pg-migrate)
│   ├── scripts/            smoke test, race test, EXPLAIN scripts, bulk data
│   └── test/               API integration tests
├── loadtest/               k6 scripts and PowerShell runners
├── monitoring/             Prometheus config, Grafana provisioning + dashboard
├── docs/                   benchmarks, deployment notes, screenshots
└── docker-compose.yml
```

## What I learned

- **Measure, then change one thing.** Every optimisation here has a before/after number. A single laptop run is noisy (thermal throttling), so the final CPU comparison used alternating A/B runs.
- **Bottlenecks move.** With one replica, Node's single core was the limit; with three, the next limits were the shared CPUs and Docker Desktop's network. More replicas than free cores made latency worse.
- **Caching changes the shape of failure.** Without Redis the database saturated at ~230 req/s and requests queued for 10 s; with Redis the same load took 2 ms.
- **Production-only problems.** Nginx ran out of ephemeral ports (TIME_WAIT) until upstream keep-alive was added; and live tests over IPv4 + IPv6 showed the per-account login limit could be dodged by switching IPs, so it now counts per email and groups IPv6 by /64.

## Limitations and next steps

- `COUNT(*)` for pagination and deep `OFFSET` pages scan many rows: keyset (cursor) pagination would fix both
- When a product sells out, every cached list is invalidated, so many requests miss at once (cache stampede): single-flight loading would cap it at one query per key
- Hosting: currently demoed through a Cloudflare Tunnel; a permanent cloud VM is planned
- Planned: AI semantic search and "similar products" with embeddings (pgvector), cached in Redis

## License

MIT
