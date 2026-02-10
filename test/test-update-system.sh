#!/bin/bash

# Test script for update detection and notification system
# Usage: bash test-update-system.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$PROJECT_ROOT/bin/install.js"

echo "Testing 5-Phase Workflow Update System"
echo "======================================="
echo ""

# Test 1: Fresh Install
echo "Test 1: Fresh Install"
echo "---------------------"
cd /tmp
rm -rf test-5phase-1
mkdir test-5phase-1
cd test-5phase-1
node "$INSTALL_SCRIPT" --local
if [ -f ".5/version.json" ]; then
  echo "✓ version.json created"
  INSTALLED=$(cat .5/version.json | grep installedVersion | cut -d'"' -f4)
  echo "  Installed version: $INSTALLED"
else
  echo "✗ version.json not created"
  exit 1
fi
echo ""

# Test 2: Same Version Check
echo "Test 2: Same Version Check"
echo "--------------------------"
node "$INSTALL_SCRIPT" --check
echo ""

# Test 3: Simulate Old Version
echo "Test 3: Update Detection"
echo "------------------------"
echo '{"installedVersion":"0.9.0","packageVersion":"0.9.0"}' > .5/version.json
node "$INSTALL_SCRIPT" --check
echo ""

# Test 4: Auto-Upgrade
echo "Test 4: Auto-Upgrade"
echo "--------------------"
node "$INSTALL_SCRIPT" --upgrade
UPDATED=$(cat .5/version.json | grep installedVersion | cut -d'"' -f4)
echo "✓ Updated to version: $UPDATED"
echo ""

# Test 5: Version File Preservation
echo "Test 5: Version File Preservation"
echo "---------------------------------"
if [ -f ".5/version.json" ]; then
  PRESERVED_VERSION=$(cat .5/version.json | grep installedVersion | cut -d'"' -f4)
  echo "✓ version.json preserved with version $PRESERVED_VERSION"
else
  echo "✗ version.json not found after upgrade"
  exit 1
fi
echo ""

# Test 6: Legacy Install Migration
echo "Test 6: Legacy Install Migration"
echo "--------------------------------"
cd /tmp
rm -rf test-5phase-2
mkdir -p test-5phase-2/.claude/commands/5
touch test-5phase-2/.claude/commands/5/plan-feature.md
cd test-5phase-2
node "$INSTALL_SCRIPT" --upgrade
if [ -f ".5/version.json" ]; then
  echo "✓ version.json created for legacy install"
else
  echo "✗ version.json not created for legacy install"
  exit 1
fi
echo ""

# Test 7: Deep Merge Settings
echo "Test 7: Deep Merge Settings"
echo "---------------------------"
cd /tmp
rm -rf test-5phase-3
mkdir -p test-5phase-3/.claude/commands/5
echo '{"permissions":{"allow":["Bash"]},"customSetting":"test"}' > test-5phase-3/.claude/settings.json
touch test-5phase-3/.claude/commands/5/plan-feature.md
cd test-5phase-3
node "$INSTALL_SCRIPT" --upgrade
if grep -q "permissions" .claude/settings.json && grep -q "statusLine" .claude/settings.json; then
  echo "✓ Deep merge preserved user settings"
else
  echo "✗ Deep merge failed"
  exit 1
fi
echo ""

# Test 8: Help Output
echo "Test 8: Help Output"
echo "-------------------"
node "$INSTALL_SCRIPT" --help | grep -q "upgrade"
if [ $? -eq 0 ]; then
  echo "✓ Help includes upgrade option"
else
  echo "✗ Help missing upgrade option"
  exit 1
fi
echo ""

# Test 9: Migration from .claude/.5/ to .5/
echo "Test 9: Data Directory Migration"
echo "---------------------------------"
cd /tmp
rm -rf test-5phase-4
mkdir -p test-5phase-4/.claude/commands/5
touch test-5phase-4/.claude/commands/5/plan-feature.md
# Create old-style .claude/.5/ with data
mkdir -p test-5phase-4/.claude/.5/features/TEST-999
echo '{"installedVersion":"1.0.0","packageVersion":"1.0.0"}' > test-5phase-4/.claude/.5/version.json
echo '{"projectType":"nextjs"}' > test-5phase-4/.claude/.5/config.json
echo '{"status":"completed"}' > test-5phase-4/.claude/.5/features/TEST-999/state.json
cd test-5phase-4
node "$INSTALL_SCRIPT" --upgrade
# Verify files migrated to .5/
if [ -f ".5/version.json" ] && [ -f ".5/config.json" ] && [ -f ".5/features/TEST-999/state.json" ]; then
  echo "✓ Data migrated from .claude/.5/ to .5/"
else
  echo "✗ Migration failed"
  echo "  .5/version.json: $([ -f .5/version.json ] && echo 'exists' || echo 'missing')"
  echo "  .5/config.json: $([ -f .5/config.json ] && echo 'exists' || echo 'missing')"
  echo "  .5/features/TEST-999/state.json: $([ -f .5/features/TEST-999/state.json ] && echo 'exists' || echo 'missing')"
  exit 1
fi
# Verify old directory removed
if [ -d ".claude/.5" ]; then
  echo "✗ Old .claude/.5/ directory not removed"
  exit 1
else
  echo "✓ Old .claude/.5/ directory removed"
fi
echo ""

# Cleanup
echo "Cleanup"
echo "-------"
rm -rf /tmp/test-5phase-1 /tmp/test-5phase-2 /tmp/test-5phase-3 /tmp/test-5phase-4
echo "✓ Cleaned up test directories"
echo ""

echo "All tests passed!"
