#!/bin/bash
# ============================================================
# Clinic Platform — Proxmox LXC Creation Script
# Run on the PROXMOX HOST (not inside an LXC)
# Usage: bash scripts/create-lxc.sh
# ============================================================
set -e

CT_RAM=4096
CT_CORES=4
CT_DISK="200"
CT_STORAGE="local-lvm"
CT_BRIDGE="vmbr0"

# Auto-pick next available CTID
CTID=$(pvesh get /cluster/nextid)
echo "Using CTID: $CTID"

# Download Debian 12 template if not present
echo "Checking Debian 12 template..."
pveam update > /dev/null 2>&1
TEMPLATE=$(pveam available --section system | grep "debian-12-standard" | sort -V | tail -1 | awk '{print $2}')
if ! pveam list local | grep -q "debian-12-standard"; then
  echo "Downloading $TEMPLATE..."
  pveam download local $TEMPLATE
fi
TEMPLATE_PATH="local:vztmpl/$TEMPLATE"

# Create LXC
echo "Creating LXC $CTID (4 cores, 4GB RAM, 200GB disk)..."
pct create $CTID $TEMPLATE_PATH \
  --hostname clinic-platform \
  --cores $CT_CORES \
  --memory $CT_RAM \
  --rootfs $CT_STORAGE:$CT_DISK \
  --net0 name=eth0,bridge=$CT_BRIDGE,ip=dhcp \
  --ostype debian \
  --unprivileged 1 \
  --features nesting=1 \
  --start 1

echo "Waiting for LXC to get IP..."
sleep 12

CT_IP=$(pct exec $CTID -- hostname -I | awk '{print $1}')

echo ""
echo "================================================"
echo "LXC created successfully!"
echo "  CTID: $CTID"
echo "  IP:   $CT_IP"
echo "================================================"
echo ""
echo "NEXT: Run the bootstrap script inside the LXC:"
echo ""
echo "  pct exec $CTID -- bash -s < scripts/bootstrap.sh"
echo ""
echo "Or SSH in first:"
echo "  ssh root@$CT_IP"
echo "  bash -s < scripts/bootstrap.sh"
echo ""

# Save for reference
echo "CTID=$CTID" > /tmp/clinic-lxc.txt
echo "CT_IP=$CT_IP" >> /tmp/clinic-lxc.txt
echo "Saved to /tmp/clinic-lxc.txt"
