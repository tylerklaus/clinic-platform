# Clinic Platform

Volleyball officials clinic presentation platform. Built for IHSA Boys Volleyball.

## What it does

- Multi-presentation management with a public landing page
- Full-screen presentation viewer with frame-by-frame video playback
- Slide editor protected by Pocket ID (OIDC)
- Password-protected presentation access from the listing page
- Direct `/p/{slug}` links bypass password entirely
- Video library — shared clips available to all presentations, private clips per presentation
- 10 slide types: title, scenario, answer reveal, rule change, points of emphasis, mechanics, discussion, casebook, stat, embed (Slido)

## URL Structure

| URL | Access |
|-----|--------|
| `clinic.santahouse.me` | Public — presentation listing |
| `clinic.santahouse.me/p/{slug}` | Public — direct viewer (no password) |
| `clinic.santahouse.me/edit/{slug}` | Pocket ID — creators + admins |
| `clinic.santahouse.me/admin` | Pocket ID — admins only |

## Project Structure

```
clinic-platform/
├── server.js              # Express backend
├── package.json
├── config.example.env     # Copy to .env and fill in secrets
├── .gitignore
├── public/
│   ├── index.html         # Landing page
│   ├── assets/
│   │   └── renderer.js    # Shared slide renderer (viewer + editor)
│   ├── viewer/
│   │   └── index.html     # Presentation viewer
│   ├── edit/
│   │   └── index.html     # Slide editor
│   └── admin/
│       └── index.html     # Admin dashboard
└── scripts/
    ├── create-lxc.sh      # Run on Proxmox host — creates the LXC
    ├── bootstrap.sh       # Run inside LXC — clones repo, installs app
    └── update.sh          # Run inside LXC — pulls latest and restarts
```

## First-time Deployment

### 1. Push to GitHub

Set up this repo on your Mac using GitHub Desktop, then push to `tylerklaus/clinic-platform` (private).

### 2. Create the LXC

On your Proxmox host:
```bash
bash scripts/create-lxc.sh
```

### 3. Bootstrap the LXC

```bash
pct exec CTID -- bash -s < scripts/bootstrap.sh
```

This will:
- Install Node 22 + dependencies
- Generate an SSH deploy key and prompt you to add it to GitHub
- Clone the repo
- Generate a `.env` with random secrets
- Install and start the systemd service

### 4. Fill in OIDC credentials

Register a new app in Pocket ID at `https://auth.santahouse.me`:
- Name: `clinic-app`
- Redirect URI: `https://clinic.santahouse.me/auth/callback`
- Scopes: `openid profile email groups`

Then on the LXC:
```bash
nano /opt/clinic-platform/.env
# Fill in OIDC_CLIENT_ID and OIDC_CLIENT_SECRET
systemctl restart clinic-platform
```

### 5. Cloudflare Tunnel

Add to your existing tunnel:
- Subdomain: `clinic`
- Domain: `santahouse.me`
- Type: HTTP
- URL: `LXC_IP:3000`

### 6. Nginx Proxy Manager

Add proxy host for `clinic.santahouse.me` → `LXC_IP:3000`

In the **Advanced** tab, add:
```nginx
client_max_body_size 2G;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

### 7. Make yourself admin

After first login at `https://clinic.santahouse.me/auth/login`:
```bash
sqlite3 /opt/clinic-platform/data/clinic.db \
  "UPDATE users SET role='admin' WHERE email='your@email.com';"
```

### 8. NFS videos (when ready)

```bash
mkdir -p /mnt/clinic-videos
echo 'UNAS_IP:/share/path /mnt/clinic-videos nfs defaults,_netdev 0 0' >> /etc/fstab
mount -a
# Update VIDEO_DIR in .env then:
systemctl restart clinic-platform
```

---

## Making Updates

Most changes come through Claude. The workflow:

1. Ask Claude to make a change
2. Download the updated file(s) from the chat
3. Drop them into your local `clinic-platform` folder, replacing the old files
4. In GitHub Desktop: write a commit message → Commit → Push
5. On the LXC run:

```bash
bash /opt/clinic-platform/scripts/update.sh
```

Or from Proxmox:
```bash
pct exec CTID -- bash /opt/clinic-platform/scripts/update.sh
```

---

## Useful Commands

```bash
# View live logs
pct exec CTID -- journalctl -u clinic-platform -f

# Restart
pct exec CTID -- systemctl restart clinic-platform

# Check status
pct exec CTID -- systemctl status clinic-platform

# Update to latest
pct exec CTID -- bash /opt/clinic-platform/scripts/update.sh

# Update to specific branch
pct exec CTID -- bash /opt/clinic-platform/scripts/update.sh dev
```
