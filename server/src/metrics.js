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
// Route label = the route PATTERN with its full prefix, e.g. "/api/v1/orders/:id/pay".
// Built from the URL because Express clears req.baseUrl when an error leaves a router.
function routeLabel(req) {
  if (!req.route) return 'unmatched';
  const patternParts = req.route.path.split('/').filter(Boolean);       // ['..', ':id', 'pay']
  const urlParts = req.originalUrl.split('?')[0].split('/').filter(Boolean);
  const prefix = urlParts.slice(0, urlParts.length - patternParts.length);
  return '/' + [...prefix, ...patternParts].join('/');
}

// Times every request, labelled by route pattern (not the real URL),
// so 200,000 products don't create 200,000 separate series.
export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: routeLabel(req), status: String(res.statusCode) });
  });
  next();
}

// GET /metrics: the text Prometheus reads
export async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}