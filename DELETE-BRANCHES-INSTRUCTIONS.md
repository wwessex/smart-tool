# How to Delete All Branches Except Main

This file provides step-by-step instructions for deleting all branches in this repository except the `main` branch.

## 🎯 Quick Summary

- **Branches to delete**: 43 branches (all except `main`)
- **Recommended method**: GitHub Actions workflow (after PR merge)
- **Alternative methods**: GitHub CLI script or git commands

## 📋 Step-by-Step Instructions

### Option 1: Using GitHub Actions (Recommended)

**Prerequisites**: This PR must be merged to `main` first.

1. **Merge this PR** to the `main` branch
2. **Go to Actions tab**: https://github.com/wwessex/smart-tool/actions
3. **Find the workflow**: Look for "Delete All Branches Except Main" in the left sidebar
4. **Click "Run workflow"** dropdown button (select main branch if prompted)
5. **Enter confirmation**: Type exactly `DELETE ALL BRANCHES` (without quotes) in the input field
6. **Click the green "Run workflow"** button to execute
7. **Monitor progress**: Watch the workflow run logs
8. **Verify results**: Check that only `main` branch remains

### Option 2: Using GitHub CLI (gh)

If you have GitHub CLI installed and authenticated:

```bash
# Navigate to the repository
cd /path/to/smart-tool

# Run the provided script
./scripts/delete-branches-gh-cli.sh

# When prompted, type 'yes' to confirm
```

### Option 3: Using Git Commands

If you have git credentials configured:

```bash
# Fetch all branches
git fetch --all --prune

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

## 📚 Detailed Documentation

For more detailed information, see:
- `.github/workflows/README-delete-branches.md` - Complete documentation
- `.github/workflows/delete-all-branches.yml` - The workflow file
- `scripts/delete-branches-gh-cli.sh` - GitHub CLI script

## ⚠️ Important Notes

- **This operation is irreversible** - deleted branches cannot be recovered
- **Only `main` branch will remain** after deletion
- **43 branches will be deleted** including:
  - apply-zip-* branches
  - claude/* branches
  - codex/* branches
  - copilot/* branches (including this branch after merge)
  - cursor/* branches
  - fix/* branches
  - unknown-branch

## ✅ Verification

After deletion, verify that only `main` remains:

### Using GitHub Web Interface
Visit: https://github.com/wwessex/smart-tool/branches

### Using GitHub CLI
```bash
gh api repos/wwessex/smart-tool/branches --paginate | jq -r '.[].name'
```

### Using Git
```bash
git ls-remote --heads origin
```

You should see only one branch: `main`

## 🆘 Troubleshooting

If you encounter issues:
1. Check that you have write permissions to the repository
2. Verify authentication (for gh CLI or git)
3. Review error messages in workflow logs or terminal output
4. Check for protected branches in repository settings
5. See detailed troubleshooting section in `.github/workflows/README-delete-branches.md`

## 📝 What This PR Adds

This pull request adds:
1. ✅ GitHub Actions workflow for automated branch deletion
2. ✅ GitHub CLI script for manual branch deletion  
3. ✅ Comprehensive documentation
4. ✅ Safety features (confirmation required)
5. ✅ Detailed logging and summary reporting

---

**Ready to proceed?** Choose your preferred method above and follow the steps!
