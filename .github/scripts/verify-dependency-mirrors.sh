#!/usr/bin/env bash
set -euo pipefail
mirror="https://downloads.sevendesk.tech/deps"
for record in \
  "hwcodec ec38ebaf2454269d4c5668a57e3813c6e5541be7" \
  "externals 8903740a1f47884906a6e347ad3d8d56304d9771"; do
  name="${record%% *}"
  expected="${record#* }"
  echo "Verifying Seven Desk mirror: $name"
  actual="$(git -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=15 \
    ls-remote "$mirror/$name.git" HEAD | awk 'NR==1 {print $1}')"
  if [ "$actual" != "$expected" ]; then
    echo "Mirror revision mismatch/unavailable: $name" >&2
    exit 1
  fi
done
echo "Mirrored Git dependency SHAs match exactly"
