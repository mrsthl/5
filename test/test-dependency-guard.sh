#!/bin/bash
# Verifies the dependency-guard Stop hook: blocks once per session on new dependencies,
# stays silent otherwise, and never blocks on errors.
set -u
HOOK="$(cd "$(dirname "$0")/.." && pwd)/src/hooks/dependency-guard.js"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
FAILS=0

run() { echo "{\"cwd\":\"$T\",\"session_id\":\"$1\",\"stop_hook_active\":${2:-false}}" | node "$HOOK"; }
expect_block() { if echo "$2" | grep -q '"decision":"block"'; then echo "✓ $1"; else echo "✗ $1"; FAILS=$((FAILS+1)); fi; }
expect_silent() { if [ -z "$2" ]; then echo "✓ $1"; else echo "✗ $1: $2"; FAILS=$((FAILS+1)); fi; }

cd "$T" && git init -q && git config user.email t@t && git config user.name t && mkdir .5
echo '{"name":"x","version":"1.0.0","dependencies":{"a":"1"}}' > package.json
printf 'flask\n' > requirements.txt
git add -A && git commit -qm init

expect_silent "clean tree" "$(run s1)"

sed -i 's/1.0.0/1.0.1/' package.json
expect_silent "version bump is not a dependency" "$(run s1)"

echo '{"name":"x","version":"1.0.1","dependencies":{"a":"1","lodash":"4"}}' > package.json
printf 'flask\n# comment\nrequests==2\n' > requirements.txt
printf 'module x\n\ngo 1.22\n\nrequire (\n\tgithub.com/foo/bar v1.0.0\n)\n' > go.mod
OUT=$(run s1)
expect_block "new dependencies block" "$OUT"
for dep in lodash requests==2 github.com/foo/bar; do
  if echo "$OUT" | grep -q "$dep"; then echo "✓ reports $dep"; else echo "✗ missing $dep"; FAILS=$((FAILS+1)); fi
done
if echo "$OUT" | grep -qE 'module x|go 1.22|flask|comment|require \('; then echo "✗ reports non-dependency lines"; FAILS=$((FAILS+1)); else echo "✓ ignores metadata and comments"; fi

expect_block "session started in a subdirectory" "$(mkdir -p sub && echo "{\"cwd\":\"$T/sub\",\"session_id\":\"s0\"}" | node "$HOOK")"
expect_silent "same set in same session asks only once" "$(run s1)"
expect_silent "stop_hook_active never blocks" "$(run s2 true)"
expect_block "new session asks again" "$(run s2)"
expect_silent "outside a git repo" "$(echo '{"cwd":"/"}' | node "$HOOK")"
expect_silent "unparseable input" "$(echo 'garbage' | node "$HOOK")"

[ "$FAILS" -eq 0 ] && echo "All dependency-guard tests passed!" || { echo "$FAILS failure(s)"; exit 1; }
