# Release Automation Plan - Executive Summary

## 📋 Overview

A comprehensive review of the proposed release automation plan has been completed. The review identified **20 distinct issues** ranging from critical architectural flaws to minor implementation details.

## 🚨 Key Finding: The Plan Cannot Work As Written

The most critical finding is that **Google Apps Script API does NOT support programmatic creation of bound scripts**. The plan's core assumption—that you can create a bound script via API using "clean templates"—is fundamentally incompatible with Google's API design.

## 📊 Issues Breakdown

| Severity | Count | Examples |
|----------|-------|----------|
| 🔴 Critical | 6 | Bound script creation, Script ID retrieval, Git push from tag |
| 🟡 Major | 9 | Missing file collection, Load order handling, JSON structure mismatch |
| 🟢 Minor | 5 | Error handling, Dependencies, Validation |

## 🔴 Top 5 Critical Issues

### 1. Bound Scripts Cannot Be Created via API
**Problem**: `script.projects.create()` creates standalone scripts, NOT bound scripts. The `parentId` parameter is for organizational folders, not for binding to containers.

**Impact**: The entire automation script will fail at step 3.

**Evidence**: [Google Apps Script API Documentation](https://developers.google.com/apps-script/api/reference/rest/v1/projects/create)

### 2. "Clean Templates" Strategy Won't Work
**Problem**: Templates without bound scripts cannot have code pushed to them because there's no script container to push to.

**Impact**: Contradicts the goal of automation.

### 3. Script ID Retrieval is Fragile
**Problem**: Even with bound scripts, copying a sheet doesn't expose the new script ID. Must list all projects and match by container ID, which is unreliable.

**Impact**: High risk of deployment failures.

### 4. Wrong JSON Structure
**Problem**: Plan adds `adminScriptId` and `recordScriptId` fields that don't exist in current schema.

**Current Structure**:
```json
{
  "0.7.6": {
    "assessmentRecordTemplateFileId": "...",
    "adminSheetFileId": "..."
  }
}
```

**Impact**: Will break existing code that reads this file.

### 5. Git Push from Tag Won't Work
**Problem**: Tag-triggered workflows checkout in detached HEAD state. `git push origin HEAD:main` will fail.

**Impact**: Version file update won't be committed back to repository.

## 💡 Recommended Next Steps

### Immediate (Before Any Implementation)

1. **Make Critical Decisions**:
   - ✅ Choose template strategy (templates WITH bound scripts, not clean)
   - ✅ Decide on git workflow (PR recommended over direct push)
   - ✅ Clarify release notes process (manual vs automated)
   - ✅ Decide if script IDs should be stored in JSON

2. **Manual Testing**:
   - Test copying a sheet with bound script
   - Verify script.projects.list can find the script ID
   - Document any timing issues or race conditions

3. **Service Account Setup**:
   - Verify domain-wide delegation requirements
   - Test file creation and sharing permissions
   - Confirm Apps Script API access works

### Recommended Approach: Phased Automation

Instead of attempting full automation immediately, implement in phases:

#### Phase 1: Semi-Automated (Low Risk)
**Manual Steps**:
- Create folder and copy sheets (5 minutes)
- Open Script Editor once per sheet (create bound containers)

**Automated Steps**:
- Find script IDs via API
- Push code via API
- Update JSON file
- Create GitHub Release
- Open PR for version file

**Benefits**: Avoids the bound script creation problem while automating the most error-prone steps (code pushing, JSON updating).

#### Phase 2: Enhanced Automation (After Phase 1 Proven)
Only proceed if Phase 1 saves significant time:
- Automate folder/sheet creation
- Improve script ID discovery reliability
- Add release note generation from commits

### Alternative: Architectural Change

Consider switching from bound scripts to standalone scripts:

**Pros**:
- Standalone scripts are fully automatable
- Cleaner separation of concerns
- Easier version control

**Cons**:
- Requires rewriting how sheets interact with scripts
- Breaking change for existing users
- Significant development effort

## 📖 Review Document

The complete annotated review is in: **`ReleaseAutomationPlan_REVIEWED.md`**

This document contains:
- Inline annotations for every issue (marked with 🔴🟡🟢)
- Code examples showing correct implementations
- Links to relevant Google documentation
- Suggested fixes for each problem
- Complete reference documentation list

## ✅ What To Do Now

1. **Read** `ReleaseAutomationPlan_REVIEWED.md` thoroughly
2. **Decide** on the critical architectural questions:
   - Template strategy
   - Automation scope (full vs phased)
   - JSON schema changes
   - Git workflow
3. **Test** manually:
   - Copy sheet with bound script
   - Verify script ID retrieval works
   - Time the manual vs automated steps
4. **Choose** an implementation path:
   - **Conservative**: Phase 1 (semi-automated)
   - **Moderate**: Full automation with templates that have scripts
   - **Ambitious**: Architectural redesign to standalone scripts

5. **Implement** incrementally:
   - Start with one component (e.g., code pushing)
   - Test thoroughly before adding next component
   - Keep manual fallback available

## 🎯 Expected Outcomes

### If Proceeding with Phased Approach (Recommended)

**Time Investment**: 2-3 days to implement Phase 1

**Time Savings Per Release**: 15-20 minutes (code pushing, JSON updating, GitHub release creation)

**Risk Level**: Low (manual steps remain as fallback)

**Success Criteria**:
- [ ] Code pushes to both sheets reliably
- [ ] JSON file updates correctly
- [ ] GitHub releases created with proper links
- [ ] PR workflow works smoothly

### If Proceeding with Full Automation

**Time Investment**: 1-2 weeks (includes testing and error handling)

**Time Savings Per Release**: 25-30 minutes (nearly full automation)

**Risk Level**: Medium-High (complex script ID retrieval, potential race conditions)

**Success Criteria**:
- [ ] All manual steps eliminated
- [ ] Robust error handling
- [ ] Reliable script ID discovery
- [ ] Automated rollback on failure

## 📞 Questions to Answer

Before proceeding, you should answer:

1. **How much time does the current manual process actually take?**
   - If it's 10 minutes, full automation may not be worth the complexity
   - If it's 60+ minutes, automation is more valuable

2. **How often do you release?**
   - Weekly releases: automation worth it
   - Monthly releases: maybe not worth it
   - Quarterly releases: probably not worth it

3. **What's most error-prone in current process?**
   - Focus automation on those steps first

4. **Are you willing to change the architecture (bound → standalone scripts)?**
   - If yes: opens up better automation options
   - If no: must work within bound script constraints

5. **What's your risk tolerance?**
   - Low: Start with Phase 1 (semi-automated)
   - Medium: Full automation with lots of testing
   - High: Architectural redesign

## 🔗 Additional Resources

- [Google Apps Script API - Service Accounts](https://developers.google.com/apps-script/api/how-tos/service-accounts)
- [GitHub Actions - Creating Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- [Google Drive API - Permissions](https://developers.google.com/drive/api/v3/reference/permissions)
- [Apps Script - Bound vs Standalone](https://developers.google.com/apps-script/guides/bound)

## 📝 Notes

- The reviewed plan is thorough in its ambition but overestimates API capabilities
- Google's APIs are designed more for reading/executing than for creation/deployment
- Many Google Workspace automation tasks still require some manual steps
- The phased approach balances automation benefits with implementation complexity
- Consider using `clasp` CLI as an alternative (already in package.json dependencies)

---

**Document Created**: 2026-01-05  
**Reviewer**: GitHub Copilot  
**Status**: Recommendations ready for decision
