#!/usr/bin/env bash
set -euo pipefail
mirror="https://downloads.sevendesk.tech/deps"
# A dumb-HTTP Git mirror can advertise a commit in info/refs yet fail to
# deliver that exact SHA to Cargo (which fetches pinned submodule revisions).
# Exercise the same direct-SHA fetch path, not just ls-remote.
verify_dir="$(mktemp -d)"
trap 'rm -rf -- "$verify_dir"' EXIT
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

  # Fetch into an empty repository to detect a missing commit, pack, or Git
  # static-HTTP index before the platform's expensive native compilation.
  checkout="$verify_dir/$name"
  git init -q "$checkout"
  if ! GIT_TERMINAL_PROMPT=0 git -C "$checkout" \
    -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=15 \
    fetch --quiet --force "$mirror/$name.git" \
    "+$expected:refs/commit/$expected"; then
    echo "Mirror cannot fetch pinned Git commit: $name ($expected)" >&2
    exit 1
  fi
  git -C "$checkout" cat-file -e "$expected^{commit}" || {
    echo "Mirror delivered no valid commit: $name ($expected)" >&2
    exit 1
  }
  echo "Pinned commit fetch verified: $name"
done
echo "Mirrored Git dependency SHAs match exactly"
