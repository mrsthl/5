#!/bin/bash
# Verification script to check that all workflow files are listed in install.js

set -e

# Get the project root directory (parent of test/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "Verifying install.js Configuration"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERROR_COUNT=0

# Function to compare lists
compare_lists() {
    local category=$1
    local files_list=$2
    local install_list=$3

    echo "=== $category ==="
    echo ""

    echo "Files in repository:"
    echo "$files_list"
    echo ""

    echo "Listed in install.js:"
    echo "$install_list"
    echo ""

    # Check if lists match
    local missing=""
    while IFS= read -r file; do
        if ! echo "$install_list" | grep -q "^$file$"; then
            missing="${missing}  - $file\n"
        fi
    done <<< "$files_list"

    if [ -n "$missing" ]; then
        echo -e "${RED}❌ Missing from install.js:${NC}"
        echo -e "$missing"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    else
        echo -e "${GREEN}✓ All files listed in install.js${NC}"
    fi
    echo ""
}

# Check agents (now empty - instructions are embedded inline)
echo "Checking agents..."
if [ -d "src/agents" ] && [ "$(ls -1 src/agents/*.md 2>/dev/null)" ]; then
    AGENT_FILES=$(ls -1 src/agents/*.md 2>/dev/null | xargs -n1 basename | sort)
else
    AGENT_FILES=""
fi
# Extract only the agents array (stop at the closing bracket)
AGENT_LIST=$(grep -A 5 "agents: \[" bin/install.js | sed -n '/agents: \[/,/\]/p' | grep "\.md" | sed "s/.*'\(.*\)'.*/\1/" | sort || echo "")
compare_lists "Agents" "$AGENT_FILES" "$AGENT_LIST"

# Check skills
echo "Checking skills..."
SKILL_DIRS=$(ls -1 src/skills/ 2>/dev/null | sort || echo "")
# Extract only the skills array (stop at the closing bracket)
SKILL_LIST=$(grep -A 10 "skills: \[" bin/install.js | sed -n '/skills: \[/,/\]/p' | grep "'" | sed "s/.*'\(.*\)'.*/\1/" | sort)
compare_lists "Skills" "$SKILL_DIRS" "$SKILL_LIST"

# Check hooks
echo "Checking hooks..."
HOOK_FILES=$(ls -1 src/hooks/*.js 2>/dev/null | xargs -n1 basename | sort || echo "")
# Extract only the hooks array (stop at the closing bracket)
HOOK_LIST=$(grep -A 10 "hooks: \[" bin/install.js | sed -n '/hooks: \[/,/\]/p' | grep "\.js" | sed "s/.*'\(.*\)'.*/\1/" | sort)
compare_lists "Hooks" "$HOOK_FILES" "$HOOK_LIST"

# Check templates
echo "Checking templates..."
TEMPLATE_FILES=$(ls -1 src/templates/*.md 2>/dev/null | xargs -n1 basename | sort || echo "")
TEMPLATE_LIST=$(grep -A 20 "templates: \[" bin/install.js | grep "\.md" | sed "s/.*'\(.*\)'.*/\1/" | sort)
compare_lists "Templates" "$TEMPLATE_FILES" "$TEMPLATE_LIST"

# Summary
echo "========================================"
if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All workflow files are properly listed in install.js${NC}"
    echo ""
    echo "install.js verification PASSED"
    exit 0
else
    echo -e "${RED}❌ Found $ERROR_COUNT categories with missing files${NC}"
    echo ""
    echo "Please update getWorkflowManagedFiles() in bin/install.js"
    echo "to include all workflow files."
    echo ""
    echo "install.js verification FAILED"
    exit 1
fi
