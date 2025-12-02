/**
 * Load Test: Database Query Performance
 * Tests database query performance under concurrent load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const queryDuration = new Trend('query_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustained load
    { duration: '2m', target: 100 },  // Spike
    { duration: '5m', target: 100 },  // Sustained spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'query_duration': ['p(95)<200'],      // 95% under 200ms
    'http_req_duration': ['p(99)<500'],   // 99% under 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test_api_key';

export default function() {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Heavy query: List emails with search
  const searchRes = http.get(
    `${BASE_URL}/api/mail/search?q=test&limit=50`, 
    { headers }
  );

  check(searchRes, {
    'search status 200': (r) => r.status === 200,
    'search fast': (r) => r.timings.duration < 500,
  });

  queryDuration.add(searchRes.timings.duration);

  // Join-heavy query: User with organizations
  const userRes = http.get(
    `${BASE_URL}/api/users/me?include=organizations`, 
    { headers }
  );

  check(userRes, {
    'user status 200': (r) => r.status === 200,
  });

  queryDuration.add(userRes.timings.duration);

  // Aggregation query: Email stats
  const statsRes = http.get(
    `${BASE_URL}/api/mail/stats`, 
    { headers }
  );

  check(statsRes, {
    'stats status 200': (r) => r.status === 200,
  });

  queryDuration.add(statsRes.timings.duration);

  sleep(1);
}
