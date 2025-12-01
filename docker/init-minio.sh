#!/bin/bash
# Initialize MinIO buckets for local development
# This script creates the necessary S3 buckets for SkyDrive

set -e

echo "🚀 Initializing MinIO for OpenSky Suite..."

# Wait for MinIO to be ready
echo "⏳ Waiting for MinIO to be healthy..."
for i in {1..30}; do
  if curl -sf http://localhost:9000/minio/health/live > /dev/null; then
    echo "✅ MinIO is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ MinIO failed to start after 30 seconds"
    exit 1
  fi
  sleep 1
done

# Install mc (MinIO Client) if not already installed
if ! command -v mc &> /dev/null; then
  echo "📦 Installing MinIO Client (mc)..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install minio/stable/mc
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
    chmod +x /tmp/mc
    sudo mv /tmp/mc /usr/local/bin/
  else
    echo "❌ Unsupported OS. Please install 'mc' manually: https://min.io/docs/minio/linux/reference/minio-mc.html"
    exit 1
  fi
fi

# Configure mc alias
echo "🔧 Configuring MinIO client..."
mc alias set opensky-local http://localhost:9000 opensky dev_password_change_in_production

# Create buckets
echo "📦 Creating buckets..."
mc mb opensky-local/opensky-dev --ignore-existing
mc mb opensky-local/opensky-screenshots --ignore-existing
mc mb opensky-local/opensky-backups --ignore-existing

# Set bucket policies (public read for screenshots in dev)
echo "🔒 Setting bucket policies..."
cat > /tmp/screenshot-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::opensky-screenshots/*"]
    }
  ]
}
EOF

mc anonymous set-json /tmp/screenshot-policy.json opensky-local/opensky-screenshots

# List buckets
echo "✅ MinIO initialized successfully!"
echo ""
echo "📊 Buckets:"
mc ls opensky-local

echo ""
echo "🌐 Access MinIO Console: http://localhost:9001"
echo "   Username: opensky"
echo "   Password: dev_password_change_in_production"
echo ""
echo "💾 S3 Endpoint: http://localhost:9000"
echo "   Region: us-east-1"
echo "   Buckets: opensky-dev, opensky-screenshots, opensky-backups"
