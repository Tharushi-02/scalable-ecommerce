import { browseJourney, searchJourney } from './browse.js';
import { shopperJourney } from './checkout.js';

// Total users at the top of the wave (e.g. -e PEAK=200)
const PEAK = Number(__ENV.PEAK || 50);

// Same wave shape for every group, scaled by its share of the visitors
const wave = (share) => {
  const users = Math.max(1, Math.round(PEAK * share));
  return [
    { duration: '30s', target: users }, // ramp up
    { duration: '1m', target: users },  // hold at the peak
    { duration: '15s', target: 0 },     // ramp down
  ];
};

export const options = {
  scenarios: {
    browsers:  { executor: 'ramping-vus', exec: 'browsers',  startVUs: 0, stages: wave(0.7) },
    searchers: { executor: 'ramping-vus', exec: 'searchers', startVUs: 0, stages: wave(0.2) },
    buyers:    { executor: 'ramping-vus', exec: 'buyers',    startVUs: 0, stages: wave(0.1) },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    // What visitors feel, per group
    'http_req_duration{scenario:browsers}': ['p(95)<500'],
    'http_req_duration{scenario:searchers}': ['p(95)<500'],
    // Per endpoint
    'http_req_duration{name:GET /products (list)}': ['p(95)<500'],
    'http_req_duration{name:GET /products (search)}': ['p(95)<500'],
    'http_req_duration{name:GET /products/:id}': ['p(95)<500'],
    'http_req_duration{name:POST /orders}': ['p(95)<1000'],
    'http_req_duration{name:POST /orders/:id/pay}': ['p(95)<1000'],
  },
};

export function browsers() { browseJourney(); }
export function searchers() { searchJourney(); }
export function buyers() { shopperJourney(); }