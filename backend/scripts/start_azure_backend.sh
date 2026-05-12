#!/bin/bash
set -e

# Azure Container Apps startup script for JobShaman Backend API
# This script is called by the Docker ENTRYPOINT

echo "🚀 Starting JobShaman Backend (Azure)"
echo "Time: $(date)"
echo "Environment: $ENVIRONMENT"

# 1. Prepare database
echo "📦 Setting up database..."

if [ "${RUN_DB_MIGRATIONS_ON_START}" != "false" ]; then
  echo "  → Running database migrations..."
  python scripts/migrate_v2.py
  if [ $? -ne 0 ]; then
    echo "❌ Database migrations failed!"
    exit 1
  fi
  echo "  ✅ Migrations completed"
else
  echo "  ⏭️  Skipping migrations (RUN_DB_MIGRATIONS_ON_START=false)"
fi

# 2. Verify critical environment variables
echo "🔍 Verifying environment configuration..."

required_vars=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "JWT_SECRET"
  "STRIPE_SECRET_KEY"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

echo "  ✅ All required variables configured"

# 3. Start API server with Gunicorn + Uvicorn
echo "🌐 Starting API server..."
echo "  → Listening on 0.0.0.0:8080"
echo "  → Workers: 4"
echo "  → Worker class: uvicorn"

exec gunicorn backend.app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8080 \
  --access-logfile - \
  --error-logfile - \
  --log-level info \
  --timeout 60 \
  --graceful-timeout 30 \
  --keep-alive 65 \
  --max-requests 10000 \
  --max-requests-jitter 1000
