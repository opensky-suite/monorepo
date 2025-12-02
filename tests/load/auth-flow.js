/**
 * Load Test: Authentication Flow
 * Tests user login/logout under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests under 500ms
    'errors': ['rate<0.1'],             // Error rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  // Login request
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'alice@opensky.local',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => r.json('token') !== undefined,
  });

  errorRate.add(!loginSuccess);

  if (loginSuccess) {
    const token = loginRes.json('token');

    // Authenticated request
    const dashboardRes = http.get(`${BASE_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const dashboardSuccess = check(dashboardRes, {
      'dashboard status 200': (r) => r.status === 200,
    });

    errorRate.add(!dashboardSuccess);

    // Logout
    const logoutRes = http.post(`${BASE_URL}/api/auth/logout`, null, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    check(logoutRes, {
      'logout status 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
