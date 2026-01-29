# Branch Cleanup Workflow

This document explains how to use the automated workflow to delete all branches except `main`.

## Overview

The `delete-all-branches.yml` workflow provides a safe and automated way to delete all remote branches in the repository except for the `main` branch.

## How to Use

1. **Navigate to the Actions tab** in the GitHub repository
2. **Select the workflow** named "Delete All Branches Except Main" from the list on the left
3. **Click "Run workflow"** button on the right
4. **Type confirmation**: In the input field, type exactly: `DELETE ALL BRANCHES`
5. **Click "Run workflow"** button to start the process

## Safety Features

- **Confirmation required**: The workflow will NOT run unless you provide the exact confirmation text
- **Protected branches**: The workflow preserves the `main` branch
- **Detailed logging**: The workflow provides detailed output showing which branches were deleted and which failed
- **Summary report**: After completion, you get a summary of total branches processed, deleted, and failed

## What Gets Deleted

The workflow will delete ALL remote branches except:
- `main` branch

Currently, this includes 43 branches:
- apply-zip-* branches
- claude/* branches  
- codex/* branches
- copilot/* branches
- cursor/* branches
- fix/* branches
- unknown-branch

## Verification

After the workflow completes, it will display a list of remaining branches. Only `main` should remain.

## Troubleshooting

If some branches fail to delete:
- Check if they are protected in the repository settings
- Verify you have the necessary permissions
- Review the workflow logs for specific error messages

## Alternative: Manual Deletion

If you prefer to delete branches manually, you can use the following command locally:

```bash
# Get list of all branches except main
git ls-remote --heads origin | grep -v 'refs/heads/main$' | awk '{print $2}' | sed 's|refs/heads/||' | while read branch; do
  echo "Deleting $branch"
  git push origin --delete "$branch"
done
```

**Note**: You need write permissions to the repository to delete branches.
