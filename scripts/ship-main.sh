#!/usr/bin/env bash
# ship-main.sh — DEPRECATED 2026-09-24. Use `scripts/open-pr.sh` instead.
#
# This script pushed straight to main with no review step, which is what
# caused the 2026-09-15 git-drift saga in the first place. main now has
# branch protection requiring a PR — this script will simply be rejected by
# GitHub if you try to run it. Kept only for the fast-forward-confirmation
# logic it pioneered (see open-pr.sh, which reuses the same pattern).
#
# This is step 1 of 2. Run `bash scripts/sync-main.sh` (or `git sync-main`)
# AFTERWARD, AS ITS OWN SEPARATE COMMAND, to fast-forward whichever local
# worktree has `main` checked out.
#
# Why two separate commands instead of one: earlier versions of this script
# tried to push-then-fast-forward in one run and reported false success THREE
# times in a row (2026-09-15) — each time `git merge --ff-only` (and even a
# same-process `git rev-parse HEAD` right after it) claimed the worktree had
# advanced, while a genuinely separate, later command proved it hadn't. The
# push+confirm half below was solid on every one of those runs (ls-remote is a
# direct network query and never lied). Only the same-process fast-forward
# was unreliable — every time that exact fast-forward was instead run as its
# OWN fresh command afterward, it worked and stayed correct. So: don't fight
# it, use two commands. (Most likely cause: something — Windows Defender
# real-time scanning is the prime suspect — transiently locks .git's ref
# files right after the network I/O from a push, inside the same process.)
#
# Usage: run from any worktree of this repo.
#   bash scripts/ship-main.sh   (or: git ship-main)
#   bash scripts/sync-main.sh   (or: git sync-main)   <- run this second, separately
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
pushed_sha="$(git rev-parse HEAD)"
echo "==> pushing $current_branch ($pushed_sha) -> origin/main"
git push origin HEAD:main

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
        echo "    That's not just a race — something else is wrong." >&2
        exit 1
    fi
    echo "    attempt $attempt/$max_attempts: origin still shows '$remote_sha' — waiting 2s"
    sleep 2
    attempt=$((attempt + 1))
done

echo "==> pushed and confirmed on origin/main."
echo "==> NOW run this as a SEPARATE command (do not chain it after this one):"
echo "        bash scripts/sync-main.sh"
echo "    or: git sync-main"
