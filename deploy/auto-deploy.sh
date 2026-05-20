#!/bin/bash
# Polls GitHub for new commits on main and auto-deploys
set -e

REPO_DIR="$HOME/finance-tracker"
LOG_FILE="$REPO_DIR/deploy/deploy.log"

cd "$REPO_DIR"

# Fetch latest without merging
git fetch origin main --quiet

LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "$(date): New commits detected, deploying..." >> "$LOG_FILE"
    git pull origin main >> "$LOG_FILE" 2>&1
    docker compose up -d --build >> "$LOG_FILE" 2>&1
    echo "$(date): Deploy complete" >> "$LOG_FILE"
fi
