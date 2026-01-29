# Branch Cleanup - Delete All Branches Except Main

This document explains how to delete all branches in the repository except `main`.

## Overview

This repository provides multiple methods to delete all remote branches except the `main` branch. The automated GitHub Actions workflow is the recommended approach.

## Current Branch Count

As of the last check, there are **43 branches** that will be deleted:
- apply-zip-* branches (2)
- claude/* branches (3)
- codex/* branches (6)
- copilot/* branches (3)
- cursor/* branches (27)
- fix/* branches (1)
- unknown-branch (1)

Only the `main` branch will be preserved.

---

## Method 1: GitHub Actions Workflow (Recommended)

The `delete-all-branches.yml` workflow provides a safe and automated way to delete all remote branches.

### Prerequisites
- The workflow must be merged to the `main` branch first
- You must have write permissions to the repository

### Steps to Use

1. **Navigate to the Actions tab** in the GitHub repository: https://github.com/wwessex/smart-tool/actions
2. **Select the workflow** named "Delete All Branches Except Main" from the list on the left
3. **Click "Run workflow"** dropdown button on the right
4. **Select branch**: Choose `main` from the branch dropdown (if shown)
5. **Type confirmation**: In the input field, type exactly `DELETE ALL BRANCHES` (without quotes)
6. **Click the green "Run workflow"** button to start the process
7. **Monitor progress** in the workflow run logs
8. **Review summary** after completion

### Safety Features

- ✅ **Confirmation required**: The workflow will NOT run unless you provide the exact confirmation text
- ✅ **Protected branches**: The workflow preserves the `main` branch
- ✅ **Detailed logging**: Shows which branches were deleted and which failed
- ✅ **Summary report**: Shows total branches processed, deleted, and failed
- ✅ **Verification step**: Lists remaining branches after deletion

### Expected Output

The workflow will:
1. List all 43 branches to be deleted
2. Delete each branch one by one
3. Show a summary of results
4. Verify that only `main` branch remains

---

## Method 2: GitHub CLI (gh)

If you have the GitHub CLI installed and authenticated, you can use it to delete branches.

### Prerequisites
- GitHub CLI installed: https://cli.github.com/
- Authenticated: `gh auth login`
- Write permissions to the repository

### Using the Script

A script is provided to automate this process:

```bash
# Download and run the script
chmod +x scripts/delete-branches-gh-cli.sh
./scripts/delete-branches-gh-cli.sh
```

### Manual gh Commands

```bash
# List all branches
gh api repos/wwessex/smart-tool/branches --paginate | jq -r '.[].name'

# Delete a specific branch
gh api -X DELETE repos/wwessex/smart-tool/git/refs/heads/BRANCH_NAME

# Delete all branches except main (bash one-liner)
gh api repos/wwessex/smart-tool/branches --paginate | jq -r '.[].name' | grep -v '^main$' | while read branch; do
  echo "Deleting $branch"
  gh api -X DELETE repos/wwessex/smart-tool/git/refs/heads/$branch
done
```

---

## Method 3: Git Command Line

If you have git credentials configured, you can use standard git commands.

### Prerequisites
- Git installed
- Write permissions to the repository
- Authentication configured (SSH or HTTPS)

### Commands

```bash
# Fetch all branches
git fetch --all --prune

# List all remote branches except main
git ls-remote --heads origin | grep -v 'refs/heads/main$' | awk '{print $2}' | sed 's|refs/heads/||'

# Delete all branches except main
git ls-remote --heads origin | \
  grep -v 'refs/heads/main$' | \
  awk '{print $2}' | \
  sed 's|refs/heads/||' | \
  while read branch; do
    echo "Deleting $branch"
    git push origin --delete "$branch"
  done
```

---

## Verification

After deletion, verify that only the `main` branch remains:

### Using GitHub CLI
```bash
gh api repos/wwessex/smart-tool/branches --paginate | jq -r '.[].name'
```

### Using Git
```bash
git ls-remote --heads origin
```

### Using GitHub Web Interface
Visit: https://github.com/wwessex/smart-tool/branches

---

## Troubleshooting

### Authentication Errors
- Ensure you're authenticated with GitHub (for gh CLI or git)
- Verify you have write permissions to the repository
- Check if you need to use a Personal Access Token (PAT)

### Protected Branches
- Some branches may be protected in repository settings
- Go to: Settings → Branches → Branch protection rules
- Remove protection before deleting, or delete manually through GitHub UI

### Permission Denied
- Verify you're a repository admin or have write access
- Check organization/repository permissions

### Workflow Not Visible
- The workflow file must be merged to the `main` branch first
- After merging, it should appear in the Actions tab

---

## Important Notes

⚠️ **Warning**: This operation is **irreversible**. Deleted branches cannot be recovered unless you have local copies.

📝 **Best Practice**: Before deleting branches, ensure:
- All important work is merged
- Any open Pull Requests are handled
- Team members are notified
- You have backups if needed

🔒 **Security**: Only users with write permissions can delete branches.

---

## Support

If you encounter issues:
1. Check the workflow logs in the Actions tab
2. Review the error messages
3. Verify permissions and authentication
4. Check repository settings for branch protections
