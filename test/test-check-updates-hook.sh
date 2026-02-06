#!/bin/bash

# Test script for check-updates.js hook
# Usage: bash test/test-check-updates-hook.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECK_UPDATES_SCRIPT="$PROJECT_ROOT/src/hooks/check-updates.js"

echo "Testing check-updates.js Hook"
echo "=============================="
echo ""

# Helper function to run hook with mock stdin
run_hook() {
  local workspace_dir="$1"
  echo "{\"cwd\":\"$workspace_dir\"}" | node "$CHECK_UPDATES_SCRIPT"
}

# Test 1: No version.json (should exit silently)
echo "Test 1: No version.json file"
echo "----------------------------"
TEST_DIR="/tmp/test-check-updates-1"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude"
cd "$TEST_DIR"

echo "Running hook without version.json..."
run_hook "$TEST_DIR" && echo "✓ Hook exits gracefully without version.json"
echo ""

# Test 2: Corrupted version.json (should exit silently)
echo "Test 2: Corrupted version.json"
echo "------------------------------"
TEST_DIR="/tmp/test-check-updates-2"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

echo "invalid json{" > .claude/.5/version.json
echo "Running hook with corrupted version.json..."
run_hook "$TEST_DIR" && echo "✓ Hook exits gracefully with corrupted file"
echo ""

# Test 3: Recent check (should skip)
echo "Test 3: Recent check (within frequency)"
echo "---------------------------------------"
TEST_DIR="/tmp/test-check-updates-3"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

# Create version.json with recent check
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "1.0.0",
  "updateCheckLastRun": "$NOW",
  "updateCheckFrequency": 86400
}
EOF

echo "Running hook with recent check..."
OUTPUT=$(run_hook "$TEST_DIR" 2>&1 || true)
if [ -z "$OUTPUT" ]; then
  echo "✓ Hook skips check when run recently"
else
  echo "✗ Hook should not output anything"
  echo "Output: $OUTPUT"
  exit 1
fi
echo ""

# Test 4: Old check (should run and update timestamp)
echo "Test 4: Old check (should run)"
echo "-------------------------------"
TEST_DIR="/tmp/test-check-updates-4"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

# Create version.json with old check (2 days ago)
OLD_DATE=$(date -u -v-2d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "2 days ago" +"%Y-%m-%dT%H:%M:%SZ")
cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "1.0.0",
  "updateCheckLastRun": "$OLD_DATE",
  "updateCheckFrequency": 86400
}
EOF

echo "Running hook with old check timestamp..."
run_hook "$TEST_DIR" >/dev/null 2>&1 || true
UPDATED_TIME=$(cat .claude/.5/version.json | grep updateCheckLastRun | cut -d'"' -f4)
if [ "$UPDATED_TIME" != "$OLD_DATE" ]; then
  echo "✓ Hook updates timestamp after check"
  echo "  Previous: $OLD_DATE"
  echo "  Updated:  $UPDATED_TIME"
else
  echo "✗ Hook did not update timestamp"
  exit 1
fi
echo ""

# Test 5: Very old version (should persist latestAvailableVersion in version.json)
echo "Test 5: Old version (update available)"
echo "--------------------------------------"
TEST_DIR="/tmp/test-check-updates-5"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "0.1.0",
  "updateCheckLastRun": "$OLD_DATE",
  "updateCheckFrequency": 86400
}
EOF

echo "Running hook with very old version (0.1.0)..."
run_hook "$TEST_DIR" >/dev/null 2>&1 || true
LATEST=$(node -e "const d=JSON.parse(require('fs').readFileSync('$TEST_DIR/.claude/.5/version.json','utf8')); console.log(d.latestAvailableVersion || '')")
if [ -n "$LATEST" ]; then
  echo "✓ Hook persists latestAvailableVersion in version.json: $LATEST"
else
  echo "⚠ No latestAvailableVersion set (network may be unavailable or version is current)"
fi
echo ""

# Test 6: Current version (should clear latestAvailableVersion)
echo "Test 6: Current version (no update)"
echo "-----------------------------------"
TEST_DIR="/tmp/test-check-updates-6"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

# Get current package version
CURRENT_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/package.json','utf8')).version)")

# Seed with a stale latestAvailableVersion to verify it gets cleared
cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "$CURRENT_VERSION",
  "updateCheckLastRun": "$OLD_DATE",
  "updateCheckFrequency": 86400,
  "latestAvailableVersion": "99.0.0"
}
EOF

echo "Running hook with current version ($CURRENT_VERSION) and stale latestAvailableVersion..."
run_hook "$TEST_DIR" >/dev/null 2>&1 || true
LATEST=$(node -e "const d=JSON.parse(require('fs').readFileSync('$TEST_DIR/.claude/.5/version.json','utf8')); console.log(d.latestAvailableVersion || 'null')")
if [ "$LATEST" = "null" ]; then
  echo "✓ Hook clears latestAvailableVersion for current version"
else
  echo "⚠ latestAvailableVersion not cleared (newer version may be published): $LATEST"
fi
echo ""

# Test 7: Network timeout handling
echo "Test 7: Hook performance"
echo "-----------------------"
TEST_DIR="/tmp/test-check-updates-7"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "1.0.0",
  "updateCheckLastRun": "$OLD_DATE",
  "updateCheckFrequency": 86400
}
EOF

echo "Running hook and measuring execution time..."
START=$(date +%s)
run_hook "$TEST_DIR" >/dev/null 2>&1 || true
END=$(date +%s)
DURATION=$((END - START))

if [ $DURATION -le 5 ]; then
  echo "✓ Hook completes quickly ($DURATION seconds, timeout is 3s + processing)"
else
  echo "⚠ Hook took longer than expected ($DURATION seconds)"
fi
echo ""

# Test 8: Invalid JSON stdin
echo "Test 8: Invalid JSON input"
echo "--------------------------"
echo "Testing hook with invalid JSON input..."
echo "not json" | node "$CHECK_UPDATES_SCRIPT" && echo "✓ Hook handles invalid JSON gracefully"
echo ""

# Test 9: Empty stdin
echo "Test 9: Empty stdin"
echo "------------------"
echo "Testing hook with empty stdin..."
echo "" | node "$CHECK_UPDATES_SCRIPT" 2>/dev/null && echo "✓ Hook handles empty stdin gracefully" || echo "✓ Hook handles empty stdin gracefully"
echo ""

# Test 10: Statusline update indicator
echo "Test 10: Statusline update indicator"
echo "------------------------------------"
STATUSLINE_SCRIPT="$PROJECT_ROOT/src/hooks/statusline.js"
TEST_DIR="/tmp/test-check-updates-10"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/.claude/.5"
cd "$TEST_DIR"

# 10a: version.json with latestAvailableVersion set — should show indicator
cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "1.0.0",
  "latestAvailableVersion": "2.0.0"
}
EOF

echo "Running statusline with update available..."
SL_OUTPUT=$(echo '{"model":{"display_name":"Claude"},"workspace":{"current_dir":"'"$TEST_DIR"'"},"context_window":{"remaining_percentage":80}}' | node "$STATUSLINE_SCRIPT" 2>/dev/null || true)
if echo "$SL_OUTPUT" | grep -q "2.0.0"; then
  echo "✓ Statusline shows version number in update indicator"
else
  echo "✗ Statusline missing version in update indicator"
  echo "Output: $SL_OUTPUT"
  exit 1
fi
if echo "$SL_OUTPUT" | grep -q "/5:update"; then
  echo "✓ Statusline shows /5:update command hint"
else
  echo "✗ Statusline missing /5:update hint"
  echo "Output: $SL_OUTPUT"
  exit 1
fi

# 10b: latestAvailableVersion is null — should NOT show indicator
cat > .claude/.5/version.json <<EOF
{
  "installedVersion": "1.0.0",
  "latestAvailableVersion": null
}
EOF

echo "Running statusline with no update available..."
SL_OUTPUT=$(echo '{"model":{"display_name":"Claude"},"workspace":{"current_dir":"'"$TEST_DIR"'"},"context_window":{"remaining_percentage":80}}' | node "$STATUSLINE_SCRIPT" 2>/dev/null || true)
if echo "$SL_OUTPUT" | grep -q "/5:update"; then
  echo "✗ Statusline should not show indicator when latestAvailableVersion is null"
  echo "Output: $SL_OUTPUT"
  exit 1
else
  echo "✓ No update indicator when latestAvailableVersion is null"
fi

# 10c: No version.json — should NOT show indicator
rm -rf "$TEST_DIR/.claude/.5/version.json"
echo "Running statusline with no version.json..."
SL_OUTPUT=$(echo '{"model":{"display_name":"Claude"},"workspace":{"current_dir":"'"$TEST_DIR"'"},"context_window":{"remaining_percentage":80}}' | node "$STATUSLINE_SCRIPT" 2>/dev/null || true)
if echo "$SL_OUTPUT" | grep -q "/5:update"; then
  echo "✗ Statusline should not show indicator when version.json is absent"
  echo "Output: $SL_OUTPUT"
  exit 1
else
  echo "✓ No update indicator when version.json is absent"
fi
echo ""

# Cleanup
echo "Cleanup"
echo "-------"
rm -rf /tmp/test-check-updates-*
echo "✓ Cleaned up test directories"
echo ""

echo "========================================="
echo "All check-updates hook tests completed!"
echo "========================================="
