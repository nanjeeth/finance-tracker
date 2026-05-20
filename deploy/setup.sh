#!/bin/bash
# Run this once on your Ubuntu server to set up auto-deploy
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Make scripts executable
chmod +x "$SCRIPT_DIR/deploy.sh"
chmod +x "$SCRIPT_DIR/auto-deploy.sh"

# Add cron job to check for updates every 2 minutes
CRON_CMD="*/2 * * * * $SCRIPT_DIR/auto-deploy.sh"
(crontab -l 2>/dev/null | grep -v "auto-deploy.sh"; echo "$CRON_CMD") | crontab -

echo ""
echo "=== Auto-deploy is set up! ==="
echo ""
echo "Your server will check for new commits every 2 minutes."
echo "When a PR is merged to main, it auto-pulls and rebuilds."
echo ""
echo "To check deploy logs:  cat $SCRIPT_DIR/deploy.log"
echo "To manually deploy:    bash $SCRIPT_DIR/deploy.sh"
echo "To remove auto-deploy: crontab -e  (delete the auto-deploy line)"
