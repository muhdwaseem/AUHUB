#!/usr/bin/env bash
# ship-main.sh — push the current branch to origin/main, then fast-forward
# whichever local worktree has `main` checked out so it never drifts stale.
#
# Why this exists: this repo's workflow is "do the work on worktree-vercel-prep,
# ship it with `git push origin HEAD:main`". A plain push updates origin/main but
# NOT the separate local worktree that has `main` checked out — git has no
# client-side "after push" hook, so that worktree silently goes stale until
# someone remembers to pull it (it drifted 59 commits/50-behind once already,
# 2026-09-15). This script is the fix: it IS the push command from now on.
#
# Two earlier versions of this script (2026-09-15) both reported false success:
# a `git fetch` run immediately after the push can race GitHub's own ref
# propagation, so the freshly-fetched `origin/main` was still the OLD value —
# and comparing the worktree's HEAD against that stale fetch matched, because
# both sides were stale together. Fix: verify against the exact SHA this run
# actually pushed (known locally, no fetch needed to learn it), confirmed via
# `git ls-remote` (a direct network query, not a local cache) in a retry loop,
# BEFORE fetching objects or touching the main worktree at all.
#
# Usage: run from any worktree of this repo.
#   bash scripts/ship-main.sh
# or, after `git config alias.ship-main '!bash scripts/ship-main.sh'` (run once,
# already done by setup):
#   git ship-main
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
pushed_sha="$(git rev-parse HEAD)"
echo "==> pushing $current_branch ($pushed_sha) -> origin/main"
git push origin HEAD:main

# Find the worktree (if any) that has `main` checked out — may or may not be
# the one we're running from.
main_wt=""
current_wt=""
while read -r line; do
    case "$line" in
        worktree\ *) current_wt="${line#worktree }" ;;
        branch\ refs/heads/main) main_wt="$current_wt" ;;
    esac
done < <(git worktree list --porcelain)

if [ -z "$main_wt" ]; then
    echo "==> no local worktree has 'main' checked out — nothing to fast-forward."
    exit 0
fi

echo "==> confirming origin actually reports $pushed_sha for main (direct remote query, retried if not yet visible)"
attempt=1
max_attempts=6
while true; do
    remote_sha="$(git ls-remote origin refs/heads/main | cut -f1)"
    if [ "$remote_sha" = "$pushed_sha" ]; then
        echo "    confirmed on attempt $attempt: origin main = $pushed_sha"
        break
    fi
    if [ "$attempt" -ge "$max_attempts" ]; then
        echo "==> origin still reports '$remote_sha' (not '$pushed_sha') for main after $max_attempts checks." >&2
        echo "    That's not just a race — something else is wrong. Main worktree left untouched." >&2
        exit 1
    fi
    echo "    attempt $attempt/$max_attempts: origin still shows '$remote_sha' — waiting 2s"
    sleep 2
    attempt=$((attempt + 1))
done

echo "==> fetching objects"
git fetch origin main

echo "==> fast-forwarding main worktree at $main_wt to $pushed_sha"
git -C "$main_wt" merge --ff-only "$pushed_sha"

actual_sha="$(git -C "$main_wt" rev-parse HEAD)"
if [ "$actual_sha" = "$pushed_sha" ]; then
    echo "==> VERIFIED: main worktree HEAD is $actual_sha, matching what was pushed."
else
    echo "==> FAST-FORWARD DID NOT LAND — main worktree HEAD is $actual_sha, expected $pushed_sha." >&2
    echo "    Resolve manually: git -C \"$main_wt\" status" >&2
    exit 1
fi
