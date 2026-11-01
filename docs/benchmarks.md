## Day 15: product list, before Redis caching

| Endpoint | p50 latency | p99 latency | Requests/sec |
|---|---|---|---|
| GET /products (default) | 52 ms | 101 ms | 895 |
| GET /products?q=chair&sort=price_asc | 59 ms | 77 ms | 822 |



## Day 15: product list, after Redis caching (cache-aside, 60 s TTL)

| Endpoint | p50 latency | p99 latency | Requests/sec |
|---|---|---|---|
| GET /products (default) | 9 ms | 23 ms | 4,767 |
| GET /products?q=chair&sort=price_asc | 9 ms | 19 ms | 5,025 |

### Before → after

| Endpoint | p50 latency | p99 latency | Requests/sec |
|---|---|---|---|
| GET /products (default) | 52 → 9 ms | 101 → 23 ms | 895 → 4,767 (×5.3) |
| GET /products?q=chair&sort=price_asc | 59 → 9 ms | 77 → 19 ms | 822 → 5,025 (×6.1) |

Notes: in a 10-second run every request after the first is a cache hit, so this is the best case
for popular pages. Real traffic mixes many filter combinations, so the overall hit rate is lower.


## Day 16: cache invalidation

| Version | p50 | p99 | Requests/sec (GET /products) |
|---|---|---|---|
| Day 15 (cache, no invalidation) | 9 ms | 23 ms | 4,767 |
| Day 16 (versioned keys, 2 Redis calls per request) | 14 ms | 33 ms | 3,126 |
| Day 16 (+ version remembered in memory for 1 s) | 8 ms | 17 ms | 5,487 |

Lesson: the version lookup doubled the Redis round trips (-34%). Remembering it for 1 second
removed almost all of them, at the cost of up to 1 s of staleness on other API instances.


## Day 18: database queries with ~201,000 products (EXPLAIN ANALYZE, before indexes)

| Query | Plan | Execution time |
|---|---|---|
| Q1 home page, newest first | Parallel Seq Scan + sort all rows | 32.4 ms |
| Q2 total count | Parallel Seq Scan | 24.0 ms |
| Q3 category, cheapest first | category_id index, then sort 16,763 rows | 21.5 ms |
| Q4 search "chair" | Parallel Seq Scan, ILIKE on every row (~187k rows discarded) | 99.4 ms |
| Q5 page 5,000 (OFFSET 99980) | Seq Scan + sort spilled to disk (4.8 MB) | 59.8 ms |


## Day 18: after B-tree indexes

| Query | Plan after | Before | After |
|---|---|---|---|
| Q1 home page, newest first | Index Scan on products_active_newest_idx, no sort | 32.4 ms | 0.46 ms (~70×) |
| Q2 total count | Parallel Index Only Scan (still counts every row) | 24.0 ms | 20.1 ms |
| Q3 category, cheapest first | Index Scan on price index, stops after 249 rows | 21.5 ms | 1.45 ms (~15×) |
| Q5 page 5,000 (OFFSET 99980) | Index Scan, still walks 100,000 entries | 59.8 ms | 65.6 ms (no gain: needs keyset pagination) |




## Day 18: trigram (pg_trgm GIN) indexes for search

| Query | Before | After | Plan after |
|---|---|---|---|
| Q4 search "chair" (common word) | 99.4 ms | 1.1 ms | newest index, stops after 20 matches |
| Q6 search a rare phrase (1 match) | 77–97 ms (full table scan) | 2.9 ms (~30×) | BitmapOr of both trigram indexes |

Index sizes: description_trgm 13 MB · name_trgm 7 MB (B-tree indexes ~6 MB).
Trade-off: bigger indexes and slightly slower writes, in exchange for fast "contains" search.
Searches shorter than 3 letters can't use trigrams.



### Whole API, 201,000 products (autocannon -c 50 -d 10)

| Endpoint | Cache on | Cache off (DB only) |
|---|---|---|
| /products | 5,559 req/s · p99 15 ms | 148 req/s · p99 414 ms |
| /products?q=chair | 5,300 req/s · p99 17 ms | 344 req/s · p99 178 ms |
| /products?q=item 123457. | n/a | 753 req/s · p99 90 ms |

Cache off, the plain list is slowest: COUNT(*) over all 201k rows on every request is now the bottleneck.
Known limits: COUNT(*) (~18 ms) and deep OFFSET pages (~66 ms). The fix is keyset (cursor) pagination.



## Day 21: gzip in Nginx (comp level 5)

| Response | Plain | gzip | Saved |
|---|---|---|---|
| JS bundle | 290 KB | 90 KB | 69% |
| CSS | 7.4 KB | 2.0 KB | 73% |
| /products?limit=20 (JSON) | 8.1 KB | 2.0 KB | 76% |


## Day 21: through Nginx (Docker Compose, Docker Desktop on Windows, production mode)

| Test (autocannon -c 50 -d 10) | Req/s | p50 | p99 | Notes |
|---|---|---|---|---|
| API via Nginx, new upstream connection per request | 1,605 | 26 ms | 89 ms | failed after ~20 s: ephemeral ports exhausted (TIME_WAIT), error 99 |
| API via Nginx, upstream keepalive pool | 2,953 | 16 ms | 31 ms | 0 errors, ~1.8x req/s, ~3x lower p99 |
| same + Accept-Encoding: gzip | 2,737 | 17 ms | 27 ms | 8.3 MB/s vs 26.9 MB/s (-69% bandwidth) |
| / static (Nginx only, no Node) | 12,695 | 7 ms | 13 ms | ~4x the API |

gzip on assets: JS 290 KB -> 90 KB, CSS 7.4 KB -> 2.0 KB, products JSON 8.1 KB -> 2.0 KB.
Caching: /assets/* = 1 year immutable, index.html = no-cache (304 on repeat).
Not directly comparable with Day 16 (Express on host, logging off).



## Day 22: horizontal scaling (Nginx round-robin, Docker Desktop on Windows, 12 CPUs)

| Replicas (autocannon -c 100 -d 15 -w 4, /products) | Req/s | p50 | p99 |
|---|---|---|---|
| 1 | 2,547 | 37 ms | 65 ms |
| 3 | 3,757 | 24 ms | 66 ms |

~1.5x throughput, p50 -35%. Not 3x: with 1 replica the single Node core was the limit; with 3,
the bottleneck moved to the shared host (Docker Desktop's Windows→VM port forwarding,
Nginx, Redis and the load generator all on the same 12 cores).
Failover: killed 1 of 3 replicas under ~3,400 req/s → 0 non-2xx responses (Nginx retried
in-flight GETs on healthy replicas, then dropped the dead one via DNS re-resolve).

| 3 (load generator inside Docker's network, no Windows→VM hop) | 5,721 | 15 ms | 41 ms |

The Windows→VM port forwarding cost ~35% of throughput. Measured from inside Docker,
3 replicas reach ~2.2x of 1 replica (from Windows). Real Linux servers don't have that hop.