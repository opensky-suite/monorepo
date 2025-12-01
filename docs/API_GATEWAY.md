# API Gateway

## Overview

Unified REST API gateway for OpenSky Suite with JWT authentication, API key support, rate limiting, and comprehensive middleware.

---

## Quick Start

### Development

```bash
cd apps/api
npm install
npm run dev
```

API Gateway runs on: **http://localhost:4000**

### Health Check

```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-01T18:00:00.000Z",
  "uptime": 123.45,
  "version": "0.1.0"
}
```

---

## Authentication

### JWT Authentication (for users)

**Include JWT token in Authorization header:**

```bash
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/api/mail/inbox
```

**Token format:**
```javascript
{
  userId: "uuid",
  email: "user@example.com",
  role: "user"
}
```

### API Key Authentication (for LLMs)

**Include API key in header:**

```bash
curl -H "X-API-Key: your_api_key_here" \
  http://localhost:4000/api/llm/mail/inbox
```

Or:

```bash
curl -H "Authorization: Bearer your_api_key_here" \
  http://localhost:4000/api/llm/mail/inbox
```

**Scopes:**
- `read` - Read access
- `write` - Write access
- `admin` - Administrative access

---

## Middleware Stack

### 1. Security (Helmet)
- XSS protection
- Content Security Policy
- HSTS
- X-Frame-Options

### 2. CORS
- Configurable origins
- Credentials support
- Whitelisted methods

### 3. Body Parsing
- JSON (10MB limit)
- URL-encoded
- Multipart (file uploads)

### 4. Request Logging (Morgan)
- Combined format
- All requests logged
- Request/response timing

### 5. Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable per route
- Standard headers (RateLimit-*)

### 6. Authentication
- JWT validation
- API key validation
- Role-based access control

### 7. Validation (Zod)
- Request body validation
- Query parameter validation
- Path parameter validation

### 8. Error Handling
- Centralized error handler
- Consistent error format
- Development vs production modes

---

## API Routes

### Public Routes (no auth)

```
GET  /health          - Health check
GET  /api/version     - API version info
POST /api/auth/login  - User login
POST /api/auth/register - User registration
```

### Authenticated Routes (JWT required)

```
GET    /api/mail/inbox           - List emails
GET    /api/mail/threads/:id     - Get thread
POST   /api/mail/send            - Send email
GET    /api/drive/files          - List files
GET    /api/drive/files/:id      - Get file
POST   /api/drive/upload         - Upload file
GET    /api/docs                 - List documents
POST   /api/docs                 - Create document
```

### LLM Routes (API key required)

```
GET    /api/llm/mail/inbox       - List emails (API key)
POST   /api/llm/mail/send        - Send email (API key)
GET    /api/llm/drive/files      - List files (API key)
```

---

## Error Responses

### Standard Format

```json
{
  "error": "Unauthorized",
  "message": "Invalid token",
  "code": "TOKEN_INVALID",
  "timestamp": "2025-12-01T18:00:00.000Z",
  "path": "/api/mail/inbox"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Rate Limiting

### Default Limits

- **Global**: 100 requests / 15 minutes per IP
- **Auth endpoints**: 10 requests / 15 minutes per IP
- **API key endpoints**: 1000 requests / 15 minutes per key

### Headers

Response includes rate limit info:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1638360000
```

### Bypass

Set `RATE_LIMIT_SKIP=true` in development.

---

## Request Validation

### Using Zod Schema

```typescript
import { validateRequest } from './middleware/validation';
import { z } from 'zod';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(255),
  body: z.string(),
});

router.post(
  '/mail/send',
  validateRequest({ body: sendEmailSchema }),
  (req, res) => {
    // req.body is validated and typed
    const { to, subject, body } = req.body;
    // ... send email
  }
);
```

### Validation Error Response

```json
{
  "error": "Validation Error",
  "message": "Invalid request data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email",
      "code": "invalid_string"
    }
  ]
}
```

---

## Environment Variables

```bash
# Server
API_PORT=4000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Authentication
JWT_SECRET=your-secret-key-here
API_KEYS=key1,key2,key3

# Rate Limiting
RATE_LIMIT_SKIP=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
```

---

## Development

### Run in Watch Mode

```bash
npm run dev
```

Changes auto-reload with `tsx watch`.

### Test API

```bash
# Health check
curl http://localhost:4000/health

# Version
curl http://localhost:4000/api/version

# With auth (need real token)
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/mail/inbox
```

---

## Production Deployment

### Build

```bash
npm run build
```

Compiles TypeScript to `dist/`.

### Run

```bash
NODE_ENV=production npm start
```

### Environment

Set production environment variables:
- Strong `JWT_SECRET`
- Secure `API_KEYS`
- Proper `CORS_ORIGIN`
- Disable `RATE_LIMIT_SKIP`

---

## Extending

### Add New Route

```typescript
// apps/api/src/routes/calendar.ts
import { Router } from 'express';

const router = Router();

router.get('/events', (req, res) => {
  res.json({ events: [] });
});

export default router;
```

```typescript
// apps/api/src/routes/index.ts
import calendarRouter from './calendar';

router.use('/calendar', calendarRouter);
```

### Add Custom Middleware

```typescript
// apps/api/src/middleware/custom.ts
export function customMiddleware(req, res, next) {
  // Your logic
  next();
}
```

```typescript
// apps/api/src/server.ts
import { customMiddleware } from './middleware/custom';

app.use('/api/custom', customMiddleware, customRouter);
```

---

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Tests

```bash
k6 run tests/load/api-endpoints.js
```

---

## Monitoring

### Logs

All requests logged via Morgan:
```
GET /api/mail/inbox 200 45ms
POST /api/mail/send 201 123ms
GET /api/drive/files 401 5ms
```

### Metrics

- Request count
- Response time
- Error rate
- Rate limit hits

### Alerting

- High error rate (>5%)
- Slow responses (>1s)
- Rate limit exceeded
- Auth failures

---

## Security

### Best Practices

1. **Use HTTPS** in production
2. **Rotate JWT secrets** regularly
3. **Rate limit** aggressively
4. **Validate** all inputs
5. **Log** security events
6. **Monitor** for anomalies

### Headers

Helmet sets security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`

---

## Summary

**Features:**
- ✅ JWT authentication
- ✅ API key authentication
- ✅ Rate limiting
- ✅ Request validation
- ✅ Error handling
- ✅ CORS support
- ✅ Security headers
- ✅ Request logging
- ✅ API versioning

**Result:** Production-ready API Gateway! 🚀🔒
