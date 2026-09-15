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
# Three earlier versions of this script (2026-09-15) all reported false
# success. First: a `git fetch` run immediately after the push can race
# GitHub's own ref propagation, so the freshly-fetched `origin/main` was still
# the OLD value, and comparing the worktree's HEAD against that stale fetch
# matched (both sides stale together). Second: even after confirming the push
# via `git ls-remote` (a direct network query) and fetching the objects, the
# `git merge --ff-only` run immediately after, inside the same script, still
# reported "Already up to date" while HEAD provably had NOT advanced — yet the
# IDENTICAL command run standalone moments later always worked. That's a
# timing race in rapid back-to-back git invocations (observed consistently,
# likely filesystem/ref-cache related on Windows), not a logic error. Fix:
# retry the merge step itself with a short pause, verifying the actual SHA
# after every attempt — never trust git's own "up to date"/"fast-forward"
# message on its own.
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
attempt=1
max_attempts=5
while true; do
    git -C "$main_wt" merge --ff-only "$pushed_sha" || true
    actual_sha="$(git -C "$main_wt" rev-parse HEAD)"
    if [ "$actual_sha" = "$pushed_sha" ]; then
        echo "==> VERIFIED on attempt $attempt: main worktree HEAD is $actual_sha, matching what was pushed."
        break
    fi
    if [ "$attempt" -ge "$max_attempts" ]; then
        echo "==> FAST-FORWARD DID NOT LAND after $max_attempts attempts — main worktree HEAD is" >&2
        echo "    $actual_sha, expected $pushed_sha. Resolve manually:" >&2
        echo "    git -C \"$main_wt\" status" >&2
        echo "    git -C \"$main_wt\" merge --ff-only $pushed_sha" >&2
        exit 1
    fi
    echo "    attempt $attempt/$max_attempts: HEAD is still $actual_sha — waiting 2s and retrying the merge"
    sleep 2
    attempt=$((attempt + 1))
done
