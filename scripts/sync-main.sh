#!/usr/bin/env bash
# sync-main.sh — fast-forward whichever local worktree has `main` checked out
# to match origin/main. Step 2 of 2 — run this as its OWN separate command,
# after `bash scripts/ship-main.sh` (or any push) has already completed and
# returned. See ship-main.sh's header comment for why these are split.
#
# Usage: bash scripts/sync-main.sh   (or: git sync-main)
set -euo pipefail

git fetch origin main
target_sha="$(git rev-parse origin/main)"
echo "==> target: origin/main = $target_sha"

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
git -C "$main_wt" merge --ff-only "$target_sha"

actual_sha="$(git -C "$main_wt" rev-parse HEAD)"
if [ "$actual_sha" = "$target_sha" ]; then
    echo "==> VERIFIED: main worktree HEAD is $actual_sha, matching origin/main."
else
    echo "==> FAST-FORWARD DID NOT LAND — main worktree HEAD is $actual_sha, expected $target_sha." >&2
    echo "    Re-run 'bash scripts/sync-main.sh' again as its own command." >&2
    exit 1
fi
