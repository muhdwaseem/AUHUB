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
# Usage: run from any worktree of this repo.
#   bash scripts/ship-main.sh
# or, after `git config alias.ship-main '!bash scripts/ship-main.sh'` (run once,
# already done by setup):
#   git ship-main
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
echo "==> pushing $current_branch -> origin/main"
git push origin HEAD:main

echo "==> fetching origin/main"
git fetch origin main

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

echo "==> fast-forwarding main worktree at $main_wt"
if git -C "$main_wt" merge --ff-only origin/main; then
    echo "==> done: origin/main, and the local 'main' worktree, are both current."
else
    echo "==> FAST-FORWARD FAILED — the main worktree has local changes that" >&2
    echo "    conflict with origin/main. It was left as-is; resolve manually" >&2
    echo "    (git -C \"$main_wt\" status) before trusting it again." >&2
    exit 1
fi
