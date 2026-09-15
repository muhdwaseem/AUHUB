#!/usr/bin/env bash
# sync-main.sh — fast-forward whichever local worktree has `main` checked out
# to match origin/main. Step 2 of 2 — run this as its OWN separate command,
# after `bash scripts/ship-main.sh` (or any push) has already completed and
# returned. See ship-main.sh's header comment for why these are split.
#
# Uses `git reset --hard`, not `git merge --ff-only`. On 2026-09-15, testing
# on this machine showed `merge --ff-only` reporting success (and even an
# immediate same-process `rev-parse HEAD` matching) while a genuinely
# separate, later command proved the ref had NOT actually persisted — three
# times in a row. `update-ref` + `reset --hard` is the only mechanism that
# was independently re-verified correct, twice, across fresh separate calls.
# Guarded: refuses (does not touch anything) unless the worktree's current
# HEAD is an ancestor of the target, i.e. a true fast-forward — this worktree
# should never carry its own commits, but the guard exists so a future
# violation of that assumption fails loudly instead of discarding work.
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
    echo "==> no local worktree has 'main' checked out — nothing to sync."
    exit 0
fi

current_sha="$(git -C "$main_wt" rev-parse HEAD)"
if [ "$current_sha" = "$target_sha" ]; then
    echo "==> already at $target_sha — nothing to do."
    exit 0
fi

if ! git -C "$main_wt" merge-base --is-ancestor "$current_sha" "$target_sha"; then
    echo "==> REFUSING: $main_wt's HEAD ($current_sha) is NOT an ancestor of" >&2
    echo "    origin/main ($target_sha) — this would not be a fast-forward." >&2
    echo "    That worktree may have its own commits. Left untouched; resolve" >&2
    echo "    manually: git -C \"$main_wt\" status && git -C \"$main_wt\" log --oneline -5" >&2
    exit 1
fi

echo "==> fast-forwarding main worktree at $main_wt: $current_sha -> $target_sha"
git -C "$main_wt" update-ref refs/heads/main "$target_sha"
git -C "$main_wt" reset --hard "$target_sha"

actual_sha="$(git -C "$main_wt" rev-parse HEAD)"
if [ "$actual_sha" = "$target_sha" ]; then
    echo "==> done: main worktree HEAD is $actual_sha."
    echo "    (Re-check with a fresh 'git -C \"$main_wt\" rev-parse HEAD' if you want to be sure —"
    echo "    this script's own report has been wrong before on this machine.)"
else
    echo "==> DID NOT LAND — main worktree HEAD is $actual_sha, expected $target_sha." >&2
    echo "    Re-run 'bash scripts/sync-main.sh' again as its own command." >&2
    exit 1
fi
