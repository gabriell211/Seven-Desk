#!/usr/bin/env bash
set -euo pipefail

upstream_commit=680b60395ecf99a76f74a1d934e453bb6e5e0aa2
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
build_dir=${1:-"$repo_root/.worktrees/signaling-build"}

if [ -e "$build_dir" ]; then
  echo "Build directory already exists: $build_dir" >&2
  exit 1
fi

git clone --filter=blob:none https://github.com/rustdesk/rustdesk-server.git "$build_dir"
git -C "$build_dir" checkout --detach "$upstream_commit"
git -C "$build_dir" submodule update --init --depth 1
git -C "$build_dir" apply --check "$repo_root/signaling/rustdesk-server-license.patch"
git -C "$build_dir" apply "$repo_root/signaling/rustdesk-server-license.patch"
cargo test --manifest-path "$build_dir/Cargo.toml" --lib seven_license
cargo build --manifest-path "$build_dir/Cargo.toml" --release --bin hbbs --bin hbbr

mkdir -p "$repo_root/signaling/dist"
cp "$build_dir/target/release/hbbs" "$repo_root/signaling/dist/seven-id"
cp "$build_dir/target/release/hbbr" "$repo_root/signaling/dist/seven-relay"
sha256sum "$repo_root/signaling/dist/seven-id" "$repo_root/signaling/dist/seven-relay"
