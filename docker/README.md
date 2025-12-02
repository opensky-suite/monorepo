# Docker Local Development Setup

## Overview
Complete local AWS simulation using Docker Compose. All services run locally with no external dependencies.

## Services

### 1. PostgreSQL (port 5432)
- **Image**: postgres:17-alpine
- **Database**: opensky_dev
- **User**: opensky
- **Password**: dev_password_change_in_production
- **Health Check**: `pg_isready`

### 2. Redis (port 6379)
- **Image**: redis:7-alpine
- **Purpose**: Caching, sessions, pub/sub
- **Health Check**: `redis-cli ping`

### 3. Elasticsearch (ports 9200, 9300)
- **Image**: elasticsearch:8.15.0
- **Purpose**: Full-text search (SkyMail, SkySearch, SkyDrive)
- **Memory**: 512MB heap
- **Security**: Disabled for local dev
- **Health Check**: Cluster health endpoint

### 4. MinIO (ports 9000, 9001)
- **Image**: minio/minio:latest
- **Purpose**: S3-compatible object storage (SkyDrive)
- **Console**: http://localhost:9001
- **API**: http://localhost:9000
- **Credentials**: opensky / dev_password_change_in_production
- **Health Check**: Health endpoint

### 5. MailHog (ports 1025, 8025)
- **Image**: mailhog/mailhog:latest
- **Purpose**: SMTP testing (SkyMail)
- **SMTP**: localhost:1025
- **Web UI**: http://localhost:8025
- **Health Check**: Web UI availability

### 6. Coturn (ports 3478, 49152-65535)
- **Image**: coturn/coturn:latest
- **Purpose**: TURN/STUN server (SkyMeet WebRTC)
- **Realm**: opensky.local
- **Credentials**: opensky / dev_turn_password
- **Mode**: host network (required for TURN)

## Quick Start

```bash
# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Check service status
npm run docker:ps

# Stop all services
npm run docker:down

# Initialize MinIO buckets
./docker/init-minio.sh
```

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache/Sessions |
| Elasticsearch | http://localhost:9200 | Search |
| MinIO Console | http://localhost:9001 | S3 Storage UI |
| MinIO API | http://localhost:9000 | S3 API |
| MailHog UI | http://localhost:8025 | Email Testing |
| TURN Server | turn:localhost:3478 | WebRTC |

## Initial Setup

### 1. Copy Environment File
```bash
cp .env.example .env
```

### 2. Start Services
```bash
npm run docker:up
```

### 3. Initialize MinIO
```bash
./docker/init-minio.sh
```

This creates the `opensky-dev` bucket for file storage.

### 4. Run Migrations
```bash
npm run db:migrate
```

## Health Checks

All services have health checks. Wait for all to be healthy:

```bash
# Watch until all healthy
watch docker-compose ps
```

Expected output:
```
NAME                  STATUS          PORTS
opensky-postgres      healthy         5432/tcp
opensky-redis         healthy         6379/tcp
opensky-elasticsearch healthy         9200/tcp, 9300/tcp
opensky-minio         healthy         9000-9001/tcp
opensky-mailhog       healthy         1025/tcp, 8025/tcp
opensky-coturn        running         (host network)
```

## Data Persistence

All data is persisted in Docker volumes:
- `postgres_data` - Database
- `redis_data` - Redis snapshots
- `elasticsearch_data` - Search indexes
- `minio_data` - S3 objects

### Reset All Data
```bash
# WARNING: Deletes all local data
docker-compose down -v
npm run docker:up
./docker/init-minio.sh
npm run db:migrate
```

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if running
docker ps | grep postgres

# Check logs
docker logs opensky-postgres

# Connect manually
docker exec -it opensky-postgres psql -U opensky -d opensky_dev
```

### MinIO Access Issues
```bash
# Check health
curl http://localhost:9000/minio/health/live

# Login to console
open http://localhost:9001
# User: opensky
# Pass: dev_password_change_in_production
```

### Elasticsearch Memory Issues
```bash
# If fails to start, increase Docker memory to 4GB+
# Docker Desktop > Settings > Resources > Memory
```

### TURN Server Issues
```bash
# Check if running (uses host network)
docker logs opensky-coturn

# Test TURN connectivity
# Use https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
# Add: turn:localhost:3478 (username: opensky, password: dev_turn_password)
```

## Production Differences

| Service | Local | Production |
|---------|-------|------------|
| PostgreSQL | Docker | AWS RDS |
| Redis | Docker | AWS ElastiCache |
| Elasticsearch | Docker | AWS OpenSearch |
| S3 Storage | MinIO | AWS S3 |
| Email | MailHog | AWS SES |
| TURN | Coturn | AWS MediaLive / Twilio |

## Screenshot Testing

All screenshot tests run against this local environment:

```bash
# Start services
npm run docker:up

# Wait for healthy
docker-compose ps

# Run screenshot tests
npm run test:screenshots

# Update baselines
npm run screenshots:update
```

## CI/CD Integration

GitHub Actions uses these same services for integration tests:

```yaml
# In .github/workflows/*.yml
services:
  postgres:
    image: postgres:17-alpine
    # ... same config as docker-compose.yml
```

## Notes

- All passwords are for LOCAL DEVELOPMENT ONLY
- Never commit actual .env file (gitignored)
- Production uses AWS services with proper security
- Screenshot baselines are checked in, test artifacts are not
- Services start in dependency order (healthchecks)
- Total resource usage: ~2GB RAM, 10GB disk
