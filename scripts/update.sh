#!/bin/bash
# ============================================================
# Clinic Platform — Update Script
# Run on the LXC to pull latest from GitHub and restart
# Usage: bash /opt/clinic-platform/scripts/update.sh
# ============================================================
set -e

APP_DIR="/opt/clinic-platform"
BRANCH="${1:-main}"

echo "================================================"
echo "Clinic Platform Update"
echo "Branch: $BRANCH"
echo "================================================"

cd $APP_DIR

# Pull latest
echo "Pulling from GitHub..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Install any new dependencies
echo "Checking dependencies..."
npm install --production --silent

# Restart service
echo "Restarting service..."
systemctl restart clinic-platform

# Wait and check status
sleep 2
if systemctl is-active --quiet clinic-platform; then
  echo ""
  echo "✓ Update complete — clinic-platform is running"
  echo "  Version: $(git log -1 --format='%h %s' HEAD)"
else
  echo ""
  echo "✗ Service failed to start — check logs:"
  echo "  journalctl -u clinic-platform -n 50"
  exit 1
fi
