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

ff_and_verify() {
    git -C "$main_wt" merge --ff-only origin/main >/dev/null 2>&1 || return 1
    [ "$(git -C "$main_wt" rev-parse HEAD)" = "$(git rev-parse origin/main)" ]
}

echo "==> fast-forwarding main worktree at $main_wt"
if ff_and_verify; then
    echo "==> done: origin/main, and the local 'main' worktree, are both current."
else
    # Observed once (2026-09-15): git merge --ff-only reported "Already up to
    # date" right after a fetch, yet HEAD had NOT actually advanced — a
    # transient ref-refresh issue, not a real conflict. One re-fetch + retry
    # cleared it immediately. Trust the verified SHA comparison, not the
    # merge command's own message, before ever reporting success.
    echo "==> mismatch after merge attempt — re-fetching and retrying once"
    git fetch origin main
    if ff_and_verify; then
        echo "==> done (after retry): origin/main, and the local 'main' worktree, are both current."
    else
        echo "==> FAST-FORWARD FAILED after retry — the main worktree may have local" >&2
        echo "    changes that conflict with origin/main, or something else is wrong." >&2
        echo "    It was left as-is; resolve manually (git -C \"$main_wt\" status) and" >&2
        echo "    confirm 'git -C \"$main_wt\" rev-parse HEAD' matches 'git rev-parse origin/main'" >&2
        echo "    before trusting it again." >&2
        exit 1
    fi
fi
