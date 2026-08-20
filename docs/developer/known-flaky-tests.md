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

**Reference**: See `docs/developer/frontend/frontend-playwright-e2e.md` lines 395-408 for geometry assertion stabilisation pattern.

### 2. Bulk Progress Modal Tests (Ant Design v6 modal-click race)

**Tests**: `e2e-tests/classes-crud-bulk-progress.spec.ts`

- "cancelling pending rows in a multi-row create closes the progress modal and shows a cancellation message"
- "toolbar bulk-action buttons remain disabled while the bulk-create queue is active and re-enable after drain"

**Root Cause**: Intermittent Ant Design v6 modal entrance-animation race. During the `rc-dialog` open animation the confirmation click can be swallowed, so the cancel/dismiss interaction occasionally fails to register. This same class of flake was previously documented and mitigated in commit `feb046a`, which added a modal-confirmation click-stabilisation helper (`classes-crud-bulk-progress.spec.ts:147-163`) that waits for enablement and retries only while the dialog is genuinely open.

**History**:

- **Investigated 2026-08-17** (branch `feature/auth-service`): the regression checker reported these two tests as current failures. Targeted re-runs — including `--repeat-each=3 --workers=4` of the `bulk progress modal` block — passed 6/6 with no failures and no flakes. The failures appeared only in the full-suite regression run, i.e. a live flake under suite load rather than a deterministic failure.
- The tests assert current behaviour: on cancel, the progress modal closes and a cancellation message is shown; while the bulk-create queue is active the toolbar bulk-action buttons are disabled and they re-enable after the queue drains. Neither test asserts pending-row removal, nor a success alert banner on drain — the application intentionally shows no alert on a successful drain.

**Current State**: Flaky under full-suite load; pre-existing (`New Failures Count: 0` versus the 2026-08-16 baseline) and unrelated to current changes. The `feb046a` stabilisation helper already mitigates the race.

**Reference**: See `docs/developer/frontend/frontend-playwright-e2e.md` (modal-confirmation stabilisation patterns) and commit `feb046a`.

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

1. Follow documented stabilisation pattern from `docs/developer/frontend/frontend-playwright-e2e.md` (Geometry Assertion Stabilisation section):

   ```bash
   npm run test:frontend:e2e -- e2e-tests/classes-crud-manage-year-groups.spec.ts \
     -g "Create year group button stays near the table start edge within tolerance" \
     --repeat-each=10 --workers=1
   ```

   The test file lives at `src/frontend/e2e-tests/classes-crud-manage-year-groups.spec.ts`.

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

### 2026-08-17 — Bulk Progress Modal tests

**Decision**: Document the two `classes-crud-bulk-progress.spec.ts` tests as accepted flaky technical debt and tidy their titles to match the actual assertions.

**Rationale**:

- Pre-existing flake (Ant Design v6 modal-click race); `New Failures Count: 0` versus the 2026-08-16 baseline, so unrelated to current changes.
- Root cause already mitigated by commit `feb046a`; not reproducible in targeted/repeated runs.
- The previous titles over-claimed behaviour (pending-row removal; a success alert banner on drain) that the tests do not assert.

**Approved by**: Agent orchestrator following investigation by the Playwright agent.

---

## Related Documentation

- `docs/developer/frontend/frontend-playwright-e2e.md` - Geometry assertion stabilisation patterns (lines 395-408)
- `docs/developer/frontend/frontend-testing.md` - Frontend testing guidelines
- `src/frontend/e2e-tests/classes-crud-manage-year-groups.spec.ts` - The flaky test file (section 1)
- `src/frontend/e2e-tests/classes-crud-bulk-progress.spec.ts` - Bulk progress modal flaky tests (section 2)
- commit `feb046a` - modal-confirmation click-stabilisation helper
- `ACTION_PLAN.md` - Section 1 delivery plan
- `/tmp/vibe-scratchpad-b0dce62f-pvx7t902/flaky-tests-investigation.md` - Full investigation report
