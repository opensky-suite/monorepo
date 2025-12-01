# Load Testing

## Overview

Performance and load testing using **k6** - modern load testing tool for APIs and microservices.

---

## Quick Start

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```powershell
choco install k6
```

### Run Load Tests

```bash
# Authentication flow
npm run load:auth

# API endpoints
npm run load:api

# Database queries
npm run load:db

# All tests
npm run load:all
```

---

## Test Scenarios

### 1. Authentication Flow (auth-flow.js)

**What it tests:**
- User login
- Authenticated requests
- Logout

**Load profile:**
- Ramp up: 0 → 10 users (30s)
- Sustained: 10 users (1m)
- Ramp up: 10 → 50 users (30s)
- Sustained: 50 users (1m)
- Ramp down: 50 → 0 users (30s)

**Thresholds:**
- 95% of requests < 500ms
- Error rate < 10%

**Run:**
```bash
npm run load:auth
```

---

### 2. API Endpoints (api-endpoints.js)

**What it tests:**
- Mail API (inbox, threads)
- Drive API (files, metadata)
- Docs API (document list)

**Load profile:**
- Ramp up: 0 → 20 users (1m)
- Sustained: 20 users (3m)
- Spike: 20 → 100 users (1m)
- Sustained spike: 100 users (1m)
- Recovery: 100 → 20 users (1m)
- Ramp down: 20 → 0 users (1m)

**Thresholds:**
- 99% of requests < 1s
- Error rate < 5%

**Run:**
```bash
npm run load:api
```

---

### 3. Database Queries (database-queries.js)

**What it tests:**
- Email search (full-text)
- User with joins
- Aggregation queries

**Load profile:**
- Ramp up: 0 → 50 users (2m)
- Sustained: 50 users (5m)
- Spike: 50 → 100 users (2m)
- Sustained spike: 100 users (5m)
- Ramp down: 100 → 0 users (2m)

**Thresholds:**
- 95% of queries < 200ms
- 99% of requests < 500ms

**Run:**
```bash
npm run load:db
```

---

## Custom Configuration

### Environment Variables

```bash
# Custom base URL
BASE_URL=https://staging.opensky.ai npm run load:auth

# Custom API key
API_KEY=your_api_key npm run load:api

# Both
BASE_URL=https://staging.opensky.ai API_KEY=your_key npm run load:all
```

### Custom Options

Edit test files to adjust:
- Duration
- User count
- Ramp rates
- Thresholds

Example:
```javascript
export const options = {
  stages: [
    { duration: '5m', target: 1000 },  // 1000 concurrent users
    { duration: '10m', target: 1000 }, // Sustained for 10 minutes
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(99)<1000'], // Stricter threshold
  },
};
```

---

## Understanding Results

### Sample Output

```
     ✓ login status 200
     ✓ login has token
     ✓ dashboard status 200
     ✓ logout status 200

   ✓ checks.........................: 100.00% ✓ 12000 ✗ 0
     data_received..................: 24 MB   400 kB/s
     data_sent......................: 6.0 MB  100 kB/s
     http_req_duration..............: avg=45ms  min=12ms med=38ms max=250ms p(90)=75ms p(95)=105ms
     http_reqs......................: 12000   200/s
     iterations.....................: 3000    50/s
     vus............................: 50      min=0 max=50
     vus_max........................: 50      min=50 max=50
```

### Key Metrics

- **http_req_duration**: Response time
  - `avg`: Average
  - `p(95)`: 95th percentile (most important)
  - `p(99)`: 99th percentile
  - `max`: Worst case

- **http_reqs**: Requests per second (throughput)

- **vus**: Virtual users (concurrent load)

- **checks**: Pass rate for assertions

- **iterations**: Complete test iterations

---

## Performance Targets

### Response Times

| Endpoint Type | p(95) Target | p(99) Target |
|---------------|--------------|--------------|
| Auth (login) | < 200ms | < 500ms |
| API reads | < 100ms | < 300ms |
| API writes | < 300ms | < 800ms |
| Search queries | < 200ms | < 500ms |
| File upload | < 2s | < 5s |

### Throughput

| Scenario | Target |
|----------|--------|
| Auth flow | 100 req/s |
| API reads | 500 req/s |
| API writes | 200 req/s |
| Database queries | 1000 queries/s |

### Error Rates

- **Target**: < 1% under normal load
- **Spike**: < 5% during traffic spikes
- **Recovery**: < 0.1% after spike

---

## Optimization Strategies

### If Response Times High

1. **Add database indexes**
   ```sql
   CREATE INDEX idx_emails_user_received ON emails(user_id, received_at DESC);
   ```

2. **Enable query caching**
   - Redis for frequent queries
   - Application-level caching

3. **Optimize queries**
   - Use EXPLAIN ANALYZE
   - Remove N+1 queries
   - Add pagination

4. **Scale horizontally**
   - Add read replicas
   - Load balancer

### If Error Rate High

1. **Add rate limiting**
   - Per-user limits
   - Global limits

2. **Increase timeouts**
   - Database connection timeout
   - HTTP request timeout

3. **Add circuit breakers**
   - Fail fast on errors
   - Auto-recovery

4. **Improve monitoring**
   - Error tracking (Sentry)
   - Performance monitoring (DataDog)

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Testing

on:
  schedule:
    # Run nightly at 2am
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - name: Run load tests
        run: npm run load:all
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: results/
```

---

## Best Practices

### 1. Test Against Staging

Never run load tests against production!

```bash
BASE_URL=https://staging.opensky.ai npm run load:auth
```

### 2. Gradual Ramp Up

Don't spike immediately - ramp up gradually:

```javascript
stages: [
  { duration: '2m', target: 100 },  // Gradual ramp
  { duration: '5m', target: 100 },  // Sustained
  { duration: '2m', target: 0 },    // Ramp down
]
```

### 3. Realistic Think Time

Add sleep between requests:

```javascript
sleep(Math.random() * 3 + 1);  // 1-4 seconds
```

### 4. Monitor During Tests

Watch server metrics:
- CPU usage
- Memory usage
- Database connections
- Query duration
- Error logs

### 5. Test Edge Cases

- High load (spike testing)
- Sustained load (endurance testing)
- Gradual increase (stress testing)
- Sudden stop (recovery testing)

---

## Troubleshooting

### k6 Not Found

```bash
# Install k6
brew install k6  # macOS
```

### Connection Refused

```bash
# Start services
npm run docker:up
npm run dev
```

### High Error Rate

1. Check server logs: `npm run docker:logs`
2. Check database connections: `npm run db:test`
3. Reduce load: Lower user count in test file

### Timeouts

1. Increase timeout in k6:
   ```javascript
   export const options = {
     timeout: '60s',  // Increase from default 30s
   };
   ```

2. Increase server timeout

---

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/)

---

## Summary

**Commands:**
```bash
npm run load:auth   # Test authentication
npm run load:api    # Test API endpoints
npm run load:db     # Test database queries
npm run load:all    # Run all load tests
```

**Result:** Performance validated under load! 🚀📈
