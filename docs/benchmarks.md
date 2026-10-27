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