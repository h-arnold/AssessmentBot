# Release Automation - Decision Matrix & Implementation Paths

## 🎯 Quick Decision Guide

Answer these 3 questions to determine your path:

1. **How often do you release?** 
   - Weekly or more → Full automation worth it
   - Monthly → Semi-automation recommended
   - Quarterly or less → Minimal automation or keep manual

2. **What's your risk tolerance?**
   - Low → Start with Phase 1 (Semi-Automated)
   - Medium → Full automation with extensive testing
   - High → Consider architectural changes

3. **Development time available?**
   - 2-3 days → Phase 1 (Semi-Automated)
   - 1-2 weeks → Full Automation
   - 3-4 weeks → Architectural Redesign

---

## 📊 Implementation Path Comparison

### Path 1: Semi-Automated (RECOMMENDED)

**Manual Steps (5-10 minutes)**:
1. Create Drive folder for release
2. Copy Admin Sheet template → rename
3. Copy Assessment Record template → rename
4. Open Script Editor for each (creates bound containers)
5. Trigger GitHub Action (push tag)

**Automated Steps**:
6. Action finds script IDs via API
7. Pushes code to both scripts
8. Updates assessmentBotVersions.json
9. Creates GitHub Release with asset links
10. Opens PR with version file update

**Pros**:
- ✅ Avoids bound script creation problem entirely
- ✅ Low implementation complexity (2-3 days)
- ✅ Low risk - manual fallback always available
- ✅ Automates most error-prone steps (code pushing, JSON updates)
- ✅ Can iterate and enhance over time

**Cons**:
- ❌ Still requires 5-10 minutes of manual work
- ❌ Humans can still make errors in manual steps

**Recommended For**:
- Monthly releases
- Low risk tolerance
- Want quick wins
- Limited development time

**Implementation Checklist**:
- [ ] Create GitHub Action (tag trigger)
- [ ] Implement script ID discovery
- [ ] Implement code pushing logic
- [ ] Handle file ordering (numeric prefixes)
- [ ] Flatten directory structure correctly
- [ ] Update assessmentBotVersions.json
- [ ] Create GitHub Release
- [ ] Open PR for version file
- [ ] Test with dry run

**Estimated Time**: 2-3 days development + 1 day testing

---

### Path 2: Full Automation (Complex)

**Automated Steps (all)**:
1. Create Drive folder
2. Copy template sheets (WITH bound scripts)
3. Find new script IDs (via container matching)
4. Push code to scripts
5. Update JSON file
6. Make files publicly accessible
7. Create GitHub Release
8. Open PR with updates

**Manual Steps**:
- Push git tag
- Review and merge PR
- Create detailed release notes (optional)

**Pros**:
- ✅ Maximum time savings (25-30 mins per release)
- ✅ Minimal human intervention
- ✅ Consistent, repeatable process

**Cons**:
- ❌ High implementation complexity
- ❌ Script ID discovery is fragile (race conditions possible)
- ❌ Requires extensive error handling
- ❌ Debugging failures is harder (all automated)
- ❌ 1-2 weeks development time

**Recommended For**:
- Weekly releases
- Medium risk tolerance
- Team comfortable with Node.js/Google APIs
- After Phase 1 proven successful

**Implementation Checklist**:
- [ ] Service Account setup with domain-wide delegation
- [ ] Drive API folder/file creation
- [ ] Permission/sharing automation
- [ ] Reliable script ID discovery (with retry logic)
- [ ] Complete file collection implementation
- [ ] Directory structure handling
- [ ] File type detection (JS, HTML, JSON)
- [ ] Load order preservation
- [ ] Error handling and rollback
- [ ] Dry-run mode for testing
- [ ] Comprehensive logging
- [ ] Integration tests

**Estimated Time**: 1-2 weeks development + 3-5 days testing

**Critical Challenges**:
1. **Script ID Discovery**: May need polling/retry logic
2. **Race Conditions**: Newly copied scripts may not appear immediately in project list
3. **Error Recovery**: How to rollback partial deployments?
4. **File Ordering**: Must preserve 00_, zz_ prefixes across 77 AdminSheet files

---

### Path 3: Architectural Redesign (Fundamental Change)

**Change**: Move from bound scripts to standalone scripts + libraries

**Architecture**:
```
Current:
  Sheet (Admin) → Bound Script (all code)
  
Proposed:
  Sheet (Admin) → Standalone Script (library)
                  ↓
                  Deployed as Library
  
  Sheet calls library functions, not bound script
```

**Automated Steps**:
1. Create Drive folder
2. Copy template sheets (NO scripts needed)
3. Create/update standalone script projects
4. Push code to standalone scripts
5. Deploy scripts as libraries
6. Update library IDs in sheet configurations
7. Full GitHub Actions automation

**Pros**:
- ✅ Standalone scripts fully automatable
- ✅ Better separation of concerns
- ✅ Easier version control
- ✅ Can deploy script updates independently
- ✅ No bound script limitations

**Cons**:
- ❌ Requires rewriting how sheets call scripts
- ❌ Breaking change for existing users
- ❌ 3-4 weeks development time
- ❌ Need migration path for existing installations
- ❌ Changes user experience (script editor access)

**Recommended For**:
- Frequent releases (weekly+)
- Long-term project vision
- Willing to make breaking changes
- Team has bandwidth for major refactor

**Implementation Checklist**:
- [ ] Design new architecture (sheets ↔ standalone scripts)
- [ ] Create standalone script templates
- [ ] Refactor bound script code to library functions
- [ ] Update sheet code to call library
- [ ] Test library deployment and access
- [ ] Create migration guide for existing users
- [ ] Update all documentation
- [ ] Implement full automation
- [ ] Beta test with sample users

**Estimated Time**: 3-4 weeks development + 2 weeks testing + migration period

---

### Path 4: Use Clasp CLI (Alternative)

**Approach**: Use Google's official `clasp` tool instead of raw APIs

**Note**: `@google/clasp` is already in your package.json

**Workflow**:
1. Manual: Create folder, copy sheets, open Script Editor
2. Create `.clasp.json` files with script IDs
3. Use `clasp push` to deploy code (automated in GitHub Action)
4. Update JSON file (automated)
5. Create GitHub Release (automated)

**Pros**:
- ✅ Official Google tool
- ✅ Handles file ordering/structure automatically
- ✅ Simpler than raw API calls
- ✅ Already in your dependencies
- ✅ 1-2 days implementation

**Cons**:
- ❌ Still requires manual folder/sheet creation
- ❌ clasp authentication can be tricky in CI/CD
- ❌ Less control than raw APIs

**Recommended For**:
- Quick wins with minimal effort
- Developers familiar with clasp
- Don't want to learn Drive/Script APIs

**Implementation Checklist**:
- [ ] Research clasp CI/CD authentication
- [ ] Create .clasp.json templates
- [ ] Configure clasp credentials in GitHub Secrets
- [ ] Create GitHub Action using clasp push
- [ ] Test deployment workflow
- [ ] Add error handling

**Estimated Time**: 1-2 days

---

## 🔍 Detailed Comparison Table

| Aspect | Semi-Automated | Full Automation | Architectural Redesign | Clasp CLI |
|--------|---------------|-----------------|----------------------|-----------|
| **Manual Steps** | 4 steps (5-10 min) | 1 step (push tag) | 1 step (push tag) | 3 steps (5 min) |
| **Dev Time** | 2-3 days | 1-2 weeks | 3-4 weeks | 1-2 days |
| **Risk** | Low | Medium-High | High | Low-Medium |
| **Maintenance** | Low | Medium | Medium | Low |
| **Time Saved/Release** | 15-20 min | 25-30 min | 30 min | 18-22 min |
| **Complexity** | Low | High | Very High | Low |
| **Breaking Changes** | None | None | Yes (major) | None |
| **Future Flexibility** | Medium | High | Very High | Medium |

---

## 🚦 Decision Tree

```
START: Do you release weekly or more often?
│
├─ YES → Do you have 1-2 weeks for implementation?
│        │
│        ├─ YES → Are you willing to accept medium risk?
│        │        │
│        │        ├─ YES → Choose: Full Automation (Path 2)
│        │        └─ NO  → Choose: Semi-Automated (Path 1)
│        │
│        └─ NO  → Choose: Clasp CLI (Path 4) or Semi-Automated (Path 1)
│
└─ NO  → Do you release quarterly or less?
         │
         ├─ YES → Choose: Keep Manual (automation not worth it)
         └─ NO  → Choose: Semi-Automated (Path 1)

SPECIAL CASE: Planning major refactor anyway?
└─ YES → Consider: Architectural Redesign (Path 3)
```

---

## 💪 Recommended Path (Based on Your Repository)

**For AssessmentBot, I recommend: Path 1 (Semi-Automated)**

**Reasoning**:
1. **Repository Maturity**: v0.7.6 suggests stable, periodic releases
2. **Complexity**: 77 files in AdminSheet requires careful handling
3. **Risk Profile**: Production tool used by teachers - can't afford breakage
4. **Quick Wins**: Automate code pushing (most error-prone step)
5. **Iterative**: Can enhance to Path 2 later if proven valuable

**Expected Outcome**:
- 70% time reduction (from ~25 min to ~8 min per release)
- 90% error reduction (automated code sync, JSON updates)
- Minimal risk with manual fallback
- Foundation for future full automation

---

## 📋 Implementation Plan (Recommended Path 1)

### Week 1: Core Implementation

**Day 1-2**: Script ID Discovery
- Research script.projects.list API
- Implement container-to-script matching
- Add retry/timeout logic
- Test with actual sheets

**Day 3-4**: Code Pushing
- Implement file collection (handle subdirectories)
- Preserve numeric prefix ordering
- Handle different file types (JS, HTML, JSON)
- Flatten directory structure correctly
- Test with AdminSheet (77 files)
- Test with AssessmentRecordTemplate (5 files)

**Day 5**: Integration
- Create GitHub Action workflow
- Environment variable setup
- Error handling and logging
- Dry-run mode

### Week 2: Testing & Refinement

**Day 6-7**: Testing
- Test full workflow end-to-end
- Test error scenarios
- Verify JSON structure
- Verify file permissions
- Test GitHub Release creation

**Day 8-9**: Documentation
- Update README
- Create runbook for manual steps
- Document troubleshooting
- Add inline code comments

**Day 10**: Launch
- Set up GitHub Secrets/Variables
- Share Drive folder with Service Account
- Test with production credentials
- Conduct first automated release (dry run)

---

## 🎓 Learning Resources

### For Path 1 or 2 (API-based)
- [Google Apps Script API Quickstart](https://developers.google.com/apps-script/api/quickstart/nodejs)
- [Drive API Node.js Quickstart](https://developers.google.com/drive/api/quickstart/nodejs)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

### For Path 3 (Architectural)
- [Apps Script Libraries](https://developers.google.com/apps-script/guides/libraries)
- [Deploying Scripts as Web Apps](https://developers.google.com/apps-script/guides/web)

### For Path 4 (Clasp)
- [Clasp Documentation](https://github.com/google/clasp)
- [Clasp CI/CD Guide](https://github.com/google/clasp/blob/master/docs/continuous-integration.md)

---

## ✅ Next Steps

1. **Review** this decision matrix with stakeholders
2. **Choose** implementation path based on:
   - Release frequency
   - Available development time
   - Risk tolerance
   - Long-term vision

3. **Prepare** implementation:
   - Set up Service Account (all paths except manual)
   - Create test environment
   - Document current manual process timing (baseline)

4. **Implement** chosen path following checklist
5. **Test** thoroughly with dry runs
6. **Document** process and runbooks
7. **Deploy** to production
8. **Measure** time savings and error reduction
9. **Iterate** based on learnings

---

**Remember**: Perfect is the enemy of good. Start with semi-automation, prove value, then enhance. Don't let pursuit of full automation delay shipping working improvements.

**Document Version**: 1.0  
**Last Updated**: 2026-01-05  
**Status**: Ready for decision
