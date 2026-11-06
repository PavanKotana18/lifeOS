#!/usr/bin/env bash
set -euo pipefail

if [[ ! -c /dev/kvm ]]; then
  echo '::error::This hosted runner does not expose /dev/kvm; x86_64 emulation cannot be accelerated.'
  exit 1
fi

# GitHub-hosted Linux runners expose /dev/kvm as root:kvm, while the Actions
# runner account is not a member of that group. The runner VM is ephemeral.
echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' \
  | sudo tee /etc/udev/rules.d/99-kvm4all.rules >/dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger --name-match=kvm
sudo chmod 0666 /dev/kvm

if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  echo '::error::KVM device exists but remains inaccessible after applying the ephemeral-runner rule.'
  exit 1
fi
printf 'KVM device: '
stat -c '%A %U:%G %n' /dev/kvm
printf 'Runner identity: '
id
