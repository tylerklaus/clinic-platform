#!/bin/bash
# ============================================================
# Clinic Platform — LXC Bootstrap Script
# Run this INSIDE the LXC after it's created
# Usage: bash bootstrap.sh
# ============================================================
set -e

REPO="git@github.com:tylerklaus/clinic-platform.git"
APP_DIR="/opt/clinic-platform"
SERVICE_USER="root"

echo "================================================"
echo "Clinic Platform Bootstrap"
echo "================================================"

# Install dependencies
echo "[1/6] Installing system packages..."
apt-get update -qq
apt-get install -y -qq curl git sqlite3 nfs-common openssh-client

# Install Node 22
echo "[2/6] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs
echo "      Node $(node --version) installed"

# Generate SSH deploy key
echo "[3/6] Generating SSH deploy key..."
mkdir -p /root/.ssh
if [ ! -f /root/.ssh/clinic_deploy ]; then
  ssh-keygen -t ed25519 -C "clinic-platform-lxc" -f /root/.ssh/clinic_deploy -N ""
fi

# Add GitHub to known hosts
ssh-keyscan github.com >> /root/.ssh/known_hosts 2>/dev/null

# Configure SSH to use deploy key for GitHub
cat > /root/.ssh/config << SSHEOF
Host github.com
  IdentityFile /root/.ssh/clinic_deploy
  StrictHostKeyChecking no
SSHEOF

echo ""
echo "================================================"
echo "ACTION REQUIRED — Add this deploy key to GitHub"
echo "================================================"
echo ""
echo "1. Copy the public key below:"
echo ""
cat /root/.ssh/clinic_deploy.pub
echo ""
echo "2. Go to: https://github.com/tylerklaus/clinic-platform/settings/keys"
echo "3. Click 'Add deploy key'"
echo "4. Title: clinic-lxc"
echo "5. Paste the key"
echo "6. Check 'Allow write access': NO (read only is fine)"
echo "7. Click 'Add key'"
echo ""
read -p "Press ENTER once you've added the deploy key..."

# Clone the repo
echo "[4/6] Cloning repository..."
git clone $REPO $APP_DIR
cd $APP_DIR

# Install Node dependencies
echo "[5/6] Installing Node dependencies..."
npm install --production

# Create directory structure
mkdir -p $APP_DIR/{data,videos/shared,videos/presentations}

# Generate .env from example
echo "[6/6] Setting up environment..."
SESSION_SECRET=$(openssl rand -hex 32)
PW_SALT=$(openssl rand -hex 16)

cp $APP_DIR/config.example.env $APP_DIR/.env
sed -i "s/REPLACE_WITH_RANDOM_SECRET/$SESSION_SECRET/" $APP_DIR/.env
sed -i "s/REPLACE_WITH_RANDOM_SALT/$PW_SALT/" $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Install systemd service
cat > /etc/systemd/system/clinic-platform.service << SVCEOF
[Unit]
Description=Clinic Platform
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable clinic-platform
systemctl start clinic-platform

sleep 2

echo ""
echo "================================================"
echo "Bootstrap complete!"
echo "================================================"
echo ""
echo "Service status: $(systemctl is-active clinic-platform)"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Edit /opt/clinic-platform/.env and fill in:"
echo "   OIDC_CLIENT_ID and OIDC_CLIENT_SECRET"
echo "   from Pocket ID at https://auth.santahouse.me"
echo ""
echo "   nano /opt/clinic-platform/.env"
echo "   systemctl restart clinic-platform"
echo ""
echo "2. Register OIDC app in Pocket ID:"
echo "   Name:         clinic-app"
echo "   Redirect URI: https://clinic.santahouse.me/auth/callback"
echo "   Scopes:       openid profile email groups"
echo ""
echo "3. Add to Cloudflare Tunnel:"
echo "   clinic.santahouse.me -> http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "4. Add to NPM (see clinic-npm-config.txt in repo)"
echo "   Important: set client_max_body_size 2G in Advanced tab"
echo ""
echo "5. First login, then set yourself as admin:"
echo "   sqlite3 /opt/clinic-platform/data/clinic.db \\"
echo "   \"UPDATE users SET role='admin' WHERE email='YOUR_EMAIL';\""
echo ""
echo "6. NFS videos (when UNAS share is ready):"
echo "   mkdir -p /mnt/clinic-videos"
echo "   echo 'UNAS_IP:/share /mnt/clinic-videos nfs defaults,_netdev 0 0' >> /etc/fstab"
echo "   mount -a"
echo "   # Then update VIDEO_DIR in .env and restart"
echo ""
echo "To update in future: bash $APP_DIR/scripts/update.sh"
echo "================================================"
