#!/bin/bash
# Auto-deploy script — pulls latest code and rebuilds containers
set -e

REPO_DIR="$HOME/finance-tracker"
LOG_FILE="$REPO_DIR/deploy/deploy.log"

echo "$(date): Deploy triggered" >> "$LOG_FILE"

cd "$REPO_DIR"
git pull origin main >> "$LOG_FILE" 2>&1
docker compose up -d --build >> "$LOG_FILE" 2>&1

echo "$(date): Deploy complete" >> "$LOG_FILE"
