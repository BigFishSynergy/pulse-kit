#!/usr/bin/env bash
# Pulse Kit updates (.github/workflows/kit-updates.yml). Brings the kit's newest changes into this copy as one pull request
# to approve. Never touches the files in .pulse-kit/keep.txt (your rules, settings, team, brand, map). A file you or your
# Claude changed gets the kit's change merged in on top of yours; if the two can't be merged cleanly, the file is left as
# yours and listed in the pull request for your Claude to bring over by hand. Nothing goes live until you approve it.
set -euo pipefail
KIT="${KIT_REPO:-BigFishSynergy/pulse-kit}"
BRANCH=kit-update
URL="https://github.com/$KIT.git"
URL="${KIT_URL:-$URL}"  # KIT_URL: for testing against a local copy
[ -n "${KIT_TOKEN:-}" ] && [ -z "${KIT_URL:-}" ] && URL="https://x-access-token:${KIT_TOKEN}@github.com/$KIT.git"

git config user.name "Pulse Kit updates"
git config user.email "pulse-kit-updates@users.noreply.github.com"
if ! git fetch -q "$URL" main:refs/kit/main 2>/dev/null; then
  echo "::error::Can't read the Pulse Kit ($KIT). The KIT_TOKEN key may have expired: make a new one (docs/SETUP.md, Day to day, Pulse Kit updates) and save it over the old secret. Still failing? Ask Benny to check your Pulse Kit access."
  exit 1
fi
HEAD_SHA=$(git rev-parse refs/kit/main)

# The kit version this copy was last brought up to. The first time: the last kit change before this copy was made.
if [ -s .pulse-kit/base ]; then BASE=$(tr -d '[:space:]' < .pulse-kit/base)
else
  MADE=$(git log --reverse --format=%cI | head -1)
  BASE=$(git rev-list -1 --before="$MADE" refs/kit/main || true)
  [ -n "$BASE" ] || BASE=$(git rev-list --max-parents=0 refs/kit/main)
fi
if [ "$BASE" = "$HEAD_SHA" ]; then echo "Already up to date with the Pulse Kit."; exit 0; fi

# What changed in the kit, minus your own files (and workflow files, unless KIT_TOKEN may change them)
EXCL=(":(exclude).pulse-kit/")
while IFS= read -r k; do
  k="${k%%#*}"; k="$(echo "$k" | xargs)"; [ -n "$k" ] && EXCL+=(":(exclude)$k")
done < <(cat .pulse-kit/keep.txt 2>/dev/null || true)
WF_NOTE=""
if [ -z "${KIT_TOKEN:-}" ]; then
  EXCL+=(":(exclude).github/workflows/")
  if [ -n "$(git diff --name-only "$BASE" "$HEAD_SHA" -- .github/workflows/)" ]; then
    WF_NOTE="The kit also changed some GitHub jobs (.github/workflows). GitHub only lets a key do that, so ask your Claude: \"bring over the Pulse Kit's workflow changes\"."
  fi
fi

git checkout -q -B "$BRANCH"
RUNNER_TMP_DIR="${RUNNER_TEMP:-/tmp}"
SKIPPED=""; NSKIP=0
CHANGED=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  # already the same as the kit's newest (for example, your Claude brought it over by hand)
  if [ "$(git rev-parse -q --verify "HEAD:$f" 2>/dev/null)" = "$(git rev-parse -q --verify "$HEAD_SHA:$f" 2>/dev/null)" ]; then continue; fi
  git diff --binary "$BASE" "$HEAD_SHA" -- "$f" > "$RUNNER_TMP_DIR/kit.patch"
  if git apply --3way --index "$RUNNER_TMP_DIR/kit.patch" 2>/dev/null; then CHANGED=1
  else
    git reset -q -- "$f" 2>/dev/null || true
    git checkout -q HEAD -- "$f" 2>/dev/null || rm -f "$f"
    SKIPPED="$SKIPPED- \`$f\`
"; NSKIP=$((NSKIP + 1))
  fi
done < <(git diff --name-only "$BASE" "$HEAD_SHA" -- . "${EXCL[@]}")
if [ "$CHANGED" = 0 ] && [ "$NSKIP" = 0 ] && [ -z "$WF_NOTE" ]; then echo "Nothing in the newest Pulse Kit changes touches this copy."; exit 0; fi
mkdir -p .pulse-kit && echo "$HEAD_SHA" > .pulse-kit/base && git add .pulse-kit/base

NEW=$(git log --format='- %s' --no-merges "$BASE..$HEAD_SHA")
{
  echo "**New in the Pulse Kit** (approve this pull request to bring it into your Pulse; your site updates a minute or two later):"
  echo; echo "$NEW"; echo
  echo "Your rules, settings, team, brand and map are never changed by an update."
  if [ "$NSKIP" -gt 0 ]; then
    echo; echo "**For your Claude:** these files had your own changes and the kit's didn't merge cleanly, so they were left as yours. Ask your Claude: \"bring over the Pulse Kit changes to these files and keep my changes\":"
    printf "%s" "$SKIPPED"
  fi
  [ -n "$WF_NOTE" ] && { echo; echo "$WF_NOTE"; }
  echo; echo "Not sure? Ask your Claude: \"look over the Pulse Kit update pull request and tell me what it changes.\""
} > "$RUNNER_TMP_DIR/kit-body.md"

git commit -q -m "Pulse Kit updates $(date -u +%Y-%m-%d)" -m "$NEW"
git push -q -f origin "$BRANCH"
TITLE="Pulse Kit updates ($(git log --format=%s --no-merges "$BASE..$HEAD_SHA" | wc -l | tr -d ' ') new)"
if gh pr view "$BRANCH" --json state -q .state 2>/dev/null | grep -q OPEN; then
  gh pr edit "$BRANCH" --title "$TITLE" --body-file "$RUNNER_TMP_DIR/kit-body.md"
elif ! gh pr create --head "$BRANCH" --base main --title "$TITLE" --body-file "$RUNNER_TMP_DIR/kit-body.md"; then
  # GitHub's "Allow GitHub Actions to create pull requests" setting is off: leave a note with the one-click link instead
  gh issue create --title "$TITLE" --body "$(cat "$RUNNER_TMP_DIR/kit-body.md")

Open the update here and click **Create pull request**, then approve it: https://github.com/$GITHUB_REPOSITORY/compare/main...$BRANCH"
fi
echo "Update ready for approval."
