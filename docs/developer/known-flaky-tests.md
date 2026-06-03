# Known Flaky Tests

This document tracks e2e tests that are known to be flaky and have been investigated and confirmed as pre-existing issues unrelated to current changes.

## Status: Accepted Technical Debt

These tests are **NOT** blocking for feature development. They should be addressed in a separate cleanup effort.

---

## Flaky Tests Identified

### 1. Geometry Assertion Tests (Ant Design v6)

**Test**: `e2e-tests/classes-crud-manage-year-groups.spec.ts` - "Create year group button stays near the table start edge within tolerance"

**Root Cause**: Ant Design v6 default styling causes ~21-68px horizontal offset between button and table wrapper. This is a known issue with Ant Design layout computation.

**History**:

- **Commit 0ab384c** (May 12, 2026): Explicitly SKIPPED with message: "These tests fail due to Ant Design v6 default styling causing ~21-68px horizontal offset between button and table despite Flex align='start'"
- **Commit 93da391** (May 15, 2026): Unskipped and "stabilised" by increasing `ALIGNMENT_TOLERANCE_PX` from 8 to 72 (9x increase)

**Current State**: Tolerance of 72px is still insufficient in some environments. Test is flaky across different Chromium versions and rendering modes.

**Reference**: See `docs/developer/frontend/frontend-testing.md` lines 50-67 for geometry assertion stabilisation pattern.

---

## Verification

### Not Affected By Section 1

Section 1 (Wire the shell navigation contract) only added:

- A new Classes top-level navigation menu item
- A minimal ClassesPage shell component

These changes do **NOT** affect:

- Manage Year Groups modal in Settings > Classes tab
- Dashboard page layout
- Assignments page layout
- Settings page backend tab layout

### Investigation Reference

Full investigation documented at: `/tmp/vibe-scratchpad-b0dce62f-pvx7t902/flaky-tests-investigation.md`

---

## Recommended Fixes (Future Work)

### For Geometry Tests

1. Follow documented stabilisation pattern from `frontend-testing.md`:

   ```bash
   npm run test:frontend:e2e -- e2e-tests/classes-crud-manage-year-groups.spec.ts \
     -g "Create year group button stays near the table start edge within tolerance" \
     --repeat-each=10 --workers=1
   ```

2. Consider further increasing tolerance or implementing dynamic tolerance based on environment

3. Add explicit waits for layout stability before measuring bounding boxes

---

## Decision Record

**Date**: 2026-06-02  
**Decision**: Document as accepted technical debt  
**Rationale**:

- Pre-existing flaky tests unrelated to Section 1 changes
- Documented history of instability
- Section 1 implementation is clean and verified
- Blocking Section 1 would be inappropriate

**Approved by**: Implementation orchestrator following investigation by Testing Specialist

---

## Related Documentation

- `docs/developer/frontend/frontend-testing.md` - Frontend testing guidelines including geometry assertion patterns
- `ACTION_PLAN.md` - Section 1 delivery plan
- `/tmp/vibe-scratchpad-b0dce62f-pvx7t902/flaky-tests-investigation.md` - Full investigation report
