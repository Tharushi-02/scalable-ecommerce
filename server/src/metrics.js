import client from 'prom-client';

// One registry holds every metric this server exposes
export const register = new client.Registry();

// Built-in Node health: CPU, memory, event loop lag, garbage collection...
client.collectDefaultMetrics({ register });

// How long each request took, grouped by method, route and status code
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Cache lookups: hit, miss, or bypass (cache switched off)
export const cacheRequests = new client.Counter({
  name: 'cache_requests_total',
  help: 'Cache lookups by result',
  labelNames: ['result'],
  registers: [register],
});

// Times every request. The route is the PATTERN ("/api/v1/products/:id"),
// not the real URL, so 200,000 products don't create 200,000 separate lines.
export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
        const path = `${req.baseUrl}${req.route?.path ?? ''}`.replace(/\/$/, '') || '/';
    const route = req.route ? path : 'unmatched';
    end({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
}

// GET /metrics: the text Prometheus reads
export async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}