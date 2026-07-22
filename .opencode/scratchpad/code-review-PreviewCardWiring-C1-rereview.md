# Code Review — Re-review of C1 fix (PreviewCardWiring popover E2E locators)

**Reviewer:** Code Reviewer (automated agent)
**Scope:** Verify the C1 fix in `task-preview-card.spec.ts` and `task-heatmap.spec.ts`, and re-check the in-scope files for remaining concerns.
**In-scope files read:**

- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/hooks/useLogOnce.ts`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (unit, reviewed for quality)
- `src/frontend/e2e-tests/task-preview-card.spec.ts`
- `src/frontend/e2e-tests/task-heatmap.spec.ts`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `src/frontend/AGENTS.md`
- `src/frontend/src/theme/spacing.ts`

## Summary

**Pass** — The C1 fix correctly disambiguates the duplicate `aria-label` by scoping E2E locators to `[role="button"]`, and all 13 E2E tests pass (verified by running the suite). No Critical issues remain. One low-priority Improvement was noted (non-blocking).

## Verification of C1 fix

**Root cause (from prior review):** `TaskHeatmapTable.tsx` applies the same `aria-label` to both the `<td role="cell">` (via `onCell`) and the nested `<span role="button" aria-haspopup="dialog">` popover trigger. E2E selectors that used a bare `[aria-label="..."]` matched **two** elements, causing ambiguous/failing interactions.

**Fix:** Both E2E specs now target the popover trigger explicitly:

- `task-heatmap.spec.ts` line 66: `page.locator('[role="button"][aria-label="Student Two, task_001, Completeness: 5"]')`
- `task-preview-card.spec.ts` `metricCell()` helper: `page.locator('[role="button"][aria-label="${ariaLabel}"]')`

The trigger `<span>` is the element the hover/click interactions must act on, so this is the correct element to target. Comments in both specs and in `TaskHeatmapTable.tsx` document the dual-label design.

**Evidence:**

- `npm run lint:frontend` → 0 errors (1 pre-existing unrelated warning in `apiService.spec.ts`).
- `tsc -b src/frontend/tsconfig.json` → clean (exit 0).
- `playwright test task-heatmap.spec.ts task-preview-card.spec.ts` → **13 passed (23.1s)**, including the previously flaky "opens heatmap from recent assignment card" and all four `task-preview-card` popover tests.

## N1 nitpick (aria-haspopup="dialog")

Per the instruction and the approved `PR_REVIEW.md`, `aria-haspopup="dialog"` on the popover trigger (`TaskHeatmapTable.tsx` line 347) was explicitly approved and **stays**. Not raised again here.

## Remaining concerns

### Improvement (Frontend, non-blocking)

`src/frontend/src/features/classPage/TaskHeatmapTable.tsx` line 197 — `TaskPreviewSkeleton` hard-codes `style={{ width: 400 }}`. This duplicates the `CARD_MAX_WIDTH = 400` constant defined in `TaskPreviewCard.tsx` (line 66). The inline comment explains the constant was intentionally kept private, but to avoid a duplicated raw width literal (discouraged by `frontend-loading-and-width-standards.md` §7) the skeleton could reference the same constant (e.g. export `CARD_MAX_WIDTH` or define a shared local constant) so the two stay in sync. This is a deliberate, documented choice and not blocking.

## Universal standards re-check (all in-scope source)

- [x] No `console.*` calls in active source (grep: none).
- [x] No empty `catch` blocks (`TaskHeatmapPage.tsx` try/catch returns error to state and is surfaced via `useLogOnce` + message — no silent swallow).
- [x] British English in comments/identifiers (grep for `behavior|color|normalize|utilize`: none; e.g. "behaviour" used correctly at line 762 of the spec).
- [x] No speculative scope beyond the explicit request.
- [x] Files under 500 lines (`TaskHeatmapTable.tsx` 471, `TaskHeatmapPage.tsx` 248, `useLogOnce.ts` 22).
- [x] Spacing: the 4px popover-trigger padding uses the canonical `APP_GAP_XS` token with a documented exception rationale (permitted by `frontend-spacing-and-padding-standards.md` §5.2).
- [x] Accessible loading: `TaskPreviewSkeleton` uses `role="status"` + `aria-busy="true"` + `aria-label`, satisfying `frontend-loading-and-width-standards.md` §8.
- [x] `App.tsx` boundary respected (logic lives in `TaskHeatmapPage`/hooks; no backend imports in frontend).
- [x] Test quality: unit tests assert rendered outcomes (popover opens, sections present, aria-labels intact) rather than hook internals; E2E tests use web-first structural assertions and passed.

## Conclusion

The C1 finding is resolved and no Critical or blocking issues remain. The single Improvement is optional and may be addressed opportunistically.

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
