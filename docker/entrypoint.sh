#!/bin/sh
set -e

mkdir -p /app/data /app/public/uploads
export DATABASE_URL="${DATABASE_URL:-file:/app/data/prod.db}"

echo "Applying schema..."
./node_modules/.bin/prisma db push

echo "Seeding users..."
./node_modules/.bin/tsx prisma/seed.ts

echo "Starting ShapeCraft on :3000..."
exec ./node_modules/.bin/next start -H 0.0.0.0 -p 3000
