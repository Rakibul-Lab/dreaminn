#!/usr/bin/env bash
# Run on cPanel server after git pull (manual or via GitHub Actions).
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

echo "==> Deploying from $APP_DIR (branch: $BRANCH)"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Prisma generate"
npx prisma generate

echo "==> Building Next.js (standalone)"
npm run build

echo "==> Database schema"
if npx prisma migrate deploy 2>/dev/null; then
  echo "Migrations applied"
else
  echo "No migrations — running prisma db push"
  npx prisma db push
fi

echo "==> Restart app (Passenger / cPanel Node)"
mkdir -p tmp
touch tmp/restart.txt

echo "==> Deploy finished"
