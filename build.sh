#!/bin/bash
set -e

APP_DIR="/home/ubuntu/cura_app"

cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull

echo "==> Building and restarting Docker containers..."
docker compose up -d --build

echo "==> Deploy complete."
