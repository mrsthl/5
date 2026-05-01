#!/bin/bash

# Test script for update detection and notification system
# Usage: bash test-update-system.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$PROJECT_ROOT/bin/install.js"

echo "Testing dev-workflow Update System"
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
  INSTALLED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.5/version.json','utf8')).packageVersion || '')")
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
echo '{"packageVersion":"0.9.0"}' > .5/version.json
node "$INSTALL_SCRIPT" --check
echo ""

# Test 4: Auto-Upgrade
echo "Test 4: Auto-Upgrade"
echo "--------------------"
node "$INSTALL_SCRIPT" --upgrade
UPDATED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.5/version.json','utf8')).packageVersion || '')")
echo "✓ Updated to version: $UPDATED"
echo ""

# Test 5: Version File Preservation
echo "Test 5: Version File Preservation"
echo "---------------------------------"
if [ -f ".5/version.json" ]; then
  PRESERVED_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.5/version.json','utf8')).packageVersion || '')")
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
touch test-5phase-2/.claude/commands/5/plan-implementation.md
touch test-5phase-2/.claude/commands/5/implement-feature.md
touch test-5phase-2/.claude/commands/5/quick-implement.md
touch test-5phase-2/.claude/commands/5/review-code.md
touch test-5phase-2/.claude/commands/5/verify-implementation.md
mkdir -p test-5phase-2/.claude/agents test-5phase-2/.claude/templates/workflow
touch test-5phase-2/.claude/agents/component-executor.md
touch test-5phase-2/.claude/templates/workflow/FEATURE-SPEC.md
cd test-5phase-2
node "$INSTALL_SCRIPT" --upgrade
if [ -f ".5/version.json" ]; then
  echo "✓ version.json created for legacy install"
else
  echo "✗ version.json not created for legacy install"
  exit 1
fi
if [ -f ".claude/commands/5/plan.md" ] && [ -f ".claude/commands/5/implement.md" ] && [ -f ".claude/commands/5/review.md" ]; then
  echo "✓ New v2 commands installed for legacy upgrade"
else
  echo "✗ New v2 commands missing after legacy upgrade"
  exit 1
fi
for old_file in \
  ".claude/commands/5/plan-feature.md" \
  ".claude/commands/5/plan-implementation.md" \
  ".claude/commands/5/implement-feature.md" \
  ".claude/commands/5/quick-implement.md" \
  ".claude/commands/5/review-code.md" \
  ".claude/commands/5/verify-implementation.md" \
  ".claude/agents/component-executor.md" \
  ".claude/templates/workflow/FEATURE-SPEC.md"; do
  if [ -e "$old_file" ]; then
    echo "✗ Legacy file still present: $old_file"
    exit 1
  fi
done
echo "✓ Legacy v1 files removed"
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
echo '{"packageVersion":"1.0.0"}' > test-5phase-4/.claude/.5/version.json
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

# Test 10: Codex Fresh Install
echo "Test 10: Codex Fresh Install"
echo "----------------------------"
cd /tmp
rm -rf test-5phase-codex-1
mkdir test-5phase-codex-1
cd test-5phase-codex-1
node "$INSTALL_SCRIPT" --codex --local
if [ -f ".5/version.json" ]; then
  echo "✓ version.json created"
else
  echo "✗ version.json not created"
  exit 1
fi
if [ -f ".codex/skills/5-plan/SKILL.md" ]; then
  echo "✓ Commands converted to Codex skills"
else
  echo "✗ Codex skills not created"
  exit 1
fi
if [ -f ".codex/instructions.md" ]; then
  echo "✓ instructions.md generated"
else
  echo "✗ instructions.md not generated"
  exit 1
fi
if [ -d ".codex/templates" ]; then
  echo "✓ Templates installed"
else
  echo "✗ Templates not installed"
  exit 1
fi
# Verify skill content has adapter header
if grep -q "codex_skill_adapter" .codex/skills/5-plan/SKILL.md; then
  echo "✓ Skill has Codex adapter header"
else
  echo "✗ Skill missing Codex adapter header"
  exit 1
fi
# Verify slash commands converted to skill mentions
if grep -q '\$5-implement' .codex/skills/5-plan/SKILL.md; then
  echo "✓ Slash commands converted to \$ skill mentions"
else
  echo "✗ Slash command conversion failed"
  exit 1
fi
# Verify no .claude/ directory references in converted skills
if grep -q '\.claude/' .codex/skills/5-plan/SKILL.md; then
  echo "✗ Still contains .claude/ path references"
  exit 1
else
  echo "✓ Path references converted from .claude/ to .codex/"
fi
# Verify no Claude hooks installed
if [ -d ".codex/hooks" ]; then
  echo "✗ Hooks directory should not exist for Codex"
  exit 1
else
  echo "✓ No hooks directory (correct for Codex)"
fi
echo ""

# Test 11: Codex Uninstall
echo "Test 11: Codex Uninstall"
echo "------------------------"
node "$INSTALL_SCRIPT" --codex --uninstall
for skill in 5-plan 5-implement 5-review; do
  if [ -f ".codex/skills/${skill}/SKILL.md" ]; then
    echo "✗ Workflow skill not removed: ${skill}"
    exit 1
  fi
done
echo "✓ Workflow skills removed"
if [ -f ".codex/instructions.md" ]; then
  echo "✗ instructions.md not removed"
  exit 1
else
  echo "✓ instructions.md removed"
fi
if [ -d ".5" ]; then
  echo "✗ .5/ directory not removed"
  exit 1
else
  echo "✓ .5/ directory removed"
fi
echo ""

# Test 12: Codex Legacy Install Migration
echo "Test 12: Codex Legacy Install Migration"
echo "---------------------------------------"
cd /tmp
rm -rf test-5phase-codex-legacy
mkdir -p test-5phase-codex-legacy/.codex/skills/5-plan-feature
mkdir -p test-5phase-codex-legacy/.codex/skills/5-implement-feature
echo "# old" > test-5phase-codex-legacy/.codex/skills/5-plan-feature/SKILL.md
echo "# old" > test-5phase-codex-legacy/.codex/skills/5-implement-feature/SKILL.md
cd test-5phase-codex-legacy
node "$INSTALL_SCRIPT" --codex --upgrade
if [ -f ".codex/skills/5-plan/SKILL.md" ] && [ -f ".codex/skills/5-implement/SKILL.md" ]; then
  echo "✓ New Codex v2 skills installed for legacy upgrade"
else
  echo "✗ New Codex v2 skills missing after legacy upgrade"
  exit 1
fi
if [ -e ".codex/skills/5-plan-feature" ] || [ -e ".codex/skills/5-implement-feature" ]; then
  echo "✗ Legacy Codex skills still present"
  exit 1
else
  echo "✓ Legacy Codex skills removed"
fi
echo ""

# Cleanup
echo "Cleanup"
echo "-------"
rm -rf /tmp/test-5phase-1 /tmp/test-5phase-2 /tmp/test-5phase-3 /tmp/test-5phase-4 /tmp/test-5phase-codex-1 /tmp/test-5phase-codex-legacy
echo "✓ Cleaned up test directories"
echo ""

echo "All tests passed!"
