#!/usr/bin/env bash
# open-pr.sh — replaces the old direct-push half of ship-main.sh.
#
# Pushes the current branch under its own name (never straight to main) and
# opens a GitHub PR against main. This exists because CRMgold's old
# push-straight-to-main workflow was the root cause of the 2026-09-15
# git-drift saga (local main silently 59 commits behind origin, discovered
# late) — routing every change through a real PR means GitHub's own merge
# button does the fast-forward, not a hand-rolled script.
#
# After the PR is merged (on GitHub, or via `gh pr merge`), run
# `bash scripts/sync-main.sh` (or `git sync-main`) as its own separate
# command to fast-forward whichever local worktree has `main` checked out —
# same script as before, still correct, just now triggered by a PR merge
# instead of a direct push.
#
# Usage: run from any worktree of this repo, on the branch you want merged.
#   bash scripts/open-pr.sh "PR title" ["PR body"]
#   or: git open-pr "PR title" ["PR body"]
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
    echo "==> gh (GitHub CLI) not found on PATH. Install it and run 'gh auth login' first." >&2
    exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" = "main" ]; then
    echo "==> refusing: you're on 'main' itself. Create/switch to a work branch first." >&2
    exit 1
fi

title="${1:-}"
body="${2:-}"
if [ -z "$title" ]; then
    echo "==> usage: bash scripts/open-pr.sh \"PR title\" [\"PR body\"]" >&2
    exit 1
fi

pushed_sha="$(git rev-parse HEAD)"
echo "==> pushing $current_branch ($pushed_sha) -> origin/$current_branch"
git push -u origin "HEAD:$current_branch"

echo "==> confirming origin actually reports $pushed_sha for $current_branch"
attempt=1
max_attempts=6
while true; do
    remote_sha="$(git ls-remote origin "refs/heads/$current_branch" | cut -f1)"
    if [ "$remote_sha" = "$pushed_sha" ]; then
        echo "    confirmed on attempt $attempt: origin/$current_branch = $pushed_sha"
        break
    fi
    if [ "$attempt" -ge "$max_attempts" ]; then
        echo "==> origin still reports '$remote_sha' (not '$pushed_sha') after $max_attempts checks." >&2
        exit 1
    fi
    echo "    attempt $attempt/$max_attempts: waiting 2s"
    sleep 2
    attempt=$((attempt + 1))
done

echo "==> opening PR: $current_branch -> main"
if [ -n "$body" ]; then
    gh pr create --base main --head "$current_branch" --title "$title" --body "$body"
else
    gh pr create --base main --head "$current_branch" --title "$title" --fill
fi

echo "==> PR opened. Merge it on GitHub (or 'gh pr merge --squash') when ready,"
echo "    THEN run 'bash scripts/sync-main.sh' as its own separate command."
