# Known Flaky Tests

This document lists e2e tests with known flake patterns and their current mitigations. These tests do not block feature development; address them in a separate cleanup effort.

## Flaky Tests Identified

### 1. Geometry Assertion Tests (Ant Design v6)

**Test**: `src/frontend/e2e-tests/classes-crud-manage-year-groups.spec.ts` - "Create year group button stays near the table start edge within tolerance"

**Root cause**: Ant Design v6 default styling causes a horizontal offset of roughly 21–68px between the button and the table wrapper during layout computation.

**Current state**: `ALIGNMENT_TOLERANCE_PX` is set to 72px and still proves insufficient in some environments; the test flakes across Chromium versions and rendering modes.

**Reference**: See [geometry assertion stabilisation](frontend/frontend-playwright-e2e.md#geometry-assertion-stabilisation).

### 2. Bulk Progress Modal Tests (Ant Design v6 modal-click race)

**Tests**: `src/frontend/e2e-tests/classes-crud-bulk-progress.spec.ts`

- "cancelling pending rows in a multi-row create closes the progress modal and shows a cancellation message"
- "toolbar bulk-action buttons remain disabled while the bulk-create queue is active and re-enable after drain"

**Root cause**: Intermittent Ant Design v6 modal entrance-animation race. During the `rc-dialog` open animation the confirmation click can be swallowed, so the cancel/dismiss interaction occasionally fails to register. The `clickModalConfirmAndDismiss` helper in `src/frontend/e2e-tests/helpers/classes-crud-bulk-scaffold.ts` waits for enablement and retries only while the dialog is genuinely open.

**Current state**: Flaky under full-suite load; the helper mitigates the click race.

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

## Related Documentation

- [Geometry assertion stabilisation](frontend/frontend-playwright-e2e.md#geometry-assertion-stabilisation) - the documented stabilisation pattern
- `docs/developer/frontend/frontend-testing.md` - Frontend testing guidelines
- `src/frontend/e2e-tests/classes-crud-manage-year-groups.spec.ts` - The flaky test file (section 1)
- `src/frontend/e2e-tests/classes-crud-bulk-progress.spec.ts` - Bulk progress modal flaky tests (section 2)
