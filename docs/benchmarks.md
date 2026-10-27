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