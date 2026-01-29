#!/bin/bash

# Script to delete all remote branches except main using GitHub CLI
# This script uses the GitHub CLI (gh) to delete branches
# It will work if you have proper authentication set up

set -e

REPO_PATH="/home/runner/work/smart-tool/smart-tool"
cd "$REPO_PATH"

echo "=== Branch Deletion Script ==="
echo ""
echo "This script will delete all remote branches except 'main'"
echo ""

# Check if gh is available
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed"
  echo "Please install it from https://cli.github.com/"
  exit 1
fi

# Check authentication
echo "Checking GitHub CLI authentication..."
if ! gh auth status &> /dev/null; then
  echo "Error: GitHub CLI is not authenticated"
  echo "Please run: gh auth login"
  exit 1
fi

echo "✓ GitHub CLI is authenticated"
echo ""

# Get repository information
REPO_OWNER="wwessex"
REPO_NAME="smart-tool"

echo "Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Fetch latest remote information
echo "Fetching latest remote information..."
git fetch --prune

# Get all remote branches except main
echo "Getting list of branches..."
branches=$(gh api repos/$REPO_OWNER/$REPO_NAME/branches --paginate | jq -r '.[].name' | grep -v '^main$')

branch_count=$(echo "$branches" | wc -l)

echo ""
echo "Found $branch_count branches to delete (excluding main)"
echo ""
echo "Branches to be deleted:"
echo "================================"
echo "$branches" | nl
echo ""

read -p "Do you want to proceed with deleting these branches? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "Deletion cancelled."
  exit 0
fi

echo ""
echo "Deleting branches using GitHub API..."
echo "================================"

# Counter for tracking
total=0
deleted=0
failed=0

for branch in $branches; do
  total=$((total + 1))
  echo -n "[$total] Deleting branch: $branch ... "
  
  if gh api -X DELETE repos/$REPO_OWNER/$REPO_NAME/git/refs/heads/$branch &> /dev/null; then
    echo "✓ DELETED"
    deleted=$((deleted + 1))
  else
    echo "✗ FAILED"
    failed=$((failed + 1))
  fi
done

echo ""
echo "================================"
echo "Summary:"
echo "  Total processed: $total"
echo "  Successfully deleted: $deleted"
echo "  Failed: $failed"
echo "================================"
echo ""

# Show remaining branches
echo "Remaining remote branches:"
gh api repos/$REPO_OWNER/$REPO_NAME/branches --paginate | jq -r '.[].name'
echo ""
