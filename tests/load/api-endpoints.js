/**
 * Load Test: API Endpoints
 * Tests various API endpoints under load
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 20 },   // Stay at 20 users
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 20 },   // Back to 20 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<1000'], // 99% under 1s
    'errors': ['rate<0.05'],             // Error rate under 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test_api_key';

export default function() {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  group('Mail API', function() {
    // List emails
    let res = http.get(`${BASE_URL}/api/mail/inbox`, { headers });
    errorRate.add(!check(res, {
      'inbox status 200': (r) => r.status === 200,
    }));

    // Get email thread
    res = http.get(`${BASE_URL}/api/mail/threads/1`, { headers });
    check(res, {
      'thread status 200 or 404': (r) => [200, 404].includes(r.status),
    });
  });

  group('Drive API', function() {
    // List files
    let res = http.get(`${BASE_URL}/api/drive/files`, { headers });
    errorRate.add(!check(res, {
      'files status 200': (r) => r.status === 200,
    }));

    // Get file metadata
    res = http.get(`${BASE_URL}/api/drive/files/1`, { headers });
    check(res, {
      'file status 200 or 404': (r) => [200, 404].includes(r.status),
    });
  });

  group('Docs API', function() {
    // List documents
    let res = http.get(`${BASE_URL}/api/docs`, { headers });
    errorRate.add(!check(res, {
      'docs status 200': (r) => r.status === 200,
    }));
  });

  sleep(2);
}
