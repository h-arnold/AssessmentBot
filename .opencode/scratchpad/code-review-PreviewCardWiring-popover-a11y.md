# Code Review — PreviewCardWiring: popover deferral, a11y labels, and `useLogOnce` extraction

**Reviewer:** Code Reviewer (frontend module checklist)
**Branch:** `feat/PreviewCardWiring`
**Date:** 2026-07-22

## Summary

**Verdict: FAIL** — the change is well-structured and passes lint, `tsc`, and the 27 unit
tests, but it **breaks 5 existing Playwright E2E tests** via a duplicated `aria-label`
introduced by Fix D. This is a failed automated check on a user-visible interaction and
must be resolved before merge. The remainder of the change is sound.

## Files read (evidence)

- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (full)
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (full)
- `src/frontend/src/hooks/useLogOnce.ts` (new, full)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (full, for `CARD_MAX_WIDTH` reference)
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (full)
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx` (full)
- `docs/developer/frontend/frontend-loading-and-width-standards.md` (full)
- `docs/developer/frontend/frontend-logging-and-error-handling.md` (full)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (full, §3–§9)
- `src/frontend/AGENTS.md` (full)
- `src/frontend/e2e-tests/task-preview-card.spec.ts` and `task-heatmap.spec.ts` (for blast radius)

## Automated checks executed

| Check           | Command                                                         | Result                                                     |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| Lint (frontend) | `npm run lint:frontend`                                         | **0 errors** (1 unrelated warning in `apiService.spec.ts`) |
| Type-check      | `npm exec tsc -- -b src/frontend/tsconfig.json`                 | **clean**                                                  |
| Unit (2 specs)  | `vitest run TaskHeatmapTable.spec.tsx TaskHeatmapPage.spec.tsx` | **27/27 pass**                                             |
| E2E popover     | `playwright test task-preview-card.spec.ts`                     | **4 failed** (root cause: duplicate `aria-label`)          |
| E2E table       | `playwright test task-heatmap.spec.ts`                          | **1 failed** (same root cause)                             |

## Critical

### C1 — Fix D duplicates `aria-label` on `<td>` and trigger `<span>`, breaking 5 E2E tests

**Evidence.** `TaskHeatmapTable.tsx`:

- `onCell` already returns `'aria-label': ariaLabel` on the `<td>` (pre-existing).
- Fix D adds the _same_ `ariaLabel` to the inner `<span role="button">`.

Two E2E specs locate the cell with `page.locator('[aria-label="${label}']')` and assert
`toHaveCount(1)`. With the duplicate they resolve to 2 elements:

- `e2e-tests/task-preview-card.spec.ts:97,120,147,172` → 4 tests fail.
- `e2e-tests/task-heatmap.spec.ts:65-66` → 1 test fails.

Failure message (representative): `Locator ... Expected: 1 Received: 2`.

**Why it matters.** This is a user-visible interaction change (popover trigger). The frontend
review checklist requires Playwright E2E to pass for such changes; it does not. The change
also did not update these E2E locators (only the unit-spec helper in `TaskHeatmapTable.spec.tsx`
was updated to tolerate the duplication via `getAllByLabelText(label)[0]`).

**Required fix.** Disambiguate the E2E locators to the interactive trigger element, e.g.:

```ts
function metricCell(page: Page, ariaLabel: string) {
  return page.locator(`[role="button"][aria-label="${ariaLabel}"]`);
}
```

and in `task-heatmap.spec.ts:65` change to the same `[role="button"][aria-label="..."]`
locator. This:

- keeps Fix D's accessibility gain (the trigger button now has a descriptive name),
- keeps the `<td>` cell-level label (useful for table-grid navigation),
- resolves the ambiguity so exactly one element matches.

Do **not** "fix" this by removing the span `aria-label` (that would leave the button with a
weak name of just the score) or by removing the `<td>` `aria-label` (that weakens grid
navigation). The duplicate is benign for screen readers; only the test selector needs
disambiguation.

## Improvement

### I1 — New `useLogOnce` hook has no co-located spec

`src/frontend/src/hooks/useLogOnce.ts` is a new reusable abstraction but ships without a
test. Add `src/frontend/src/hooks/useLogOnce.spec.tsx` covering:

- fires the callback exactly once when `condition` transitions to true;
- does **not** re-fire when `condition` toggles false → true again (persistent ref);
- is StrictMode-safe (double mount/invoke → single call);
- does not fire while `condition` stays false.

### I2 — `isTitleError` log-once (Fix B, TaskHeatmapPage) is untested

The new `useLogOnce(isTitleError, () => logFrontendEvent('warn', { context: 'TaskHeatmapPage', errorMessage: 'Task titles are currently unavailable.' }))`
has no assertion in `TaskHeatmapPage.spec.tsx`. Add a test verifying the `logFrontendEvent('warn', ...)`
call on the title-error path (the existing title-error test only checks the in-view Alert).

### I3 — Record `useLogOnce` in the shared-helpers doc

`frontend-shared-helpers-and-abstraction-standards.md` §9 tracks helper-abstraction
decisions. Add a §9.x entry documenting the `useLogOnce` extraction (generalises the
triplicated `useRef`+`useEffect` guard; 4 call sites in `TaskHeatmapPage`, with the
§4.3 "≥2 active call sites" justification satisfied).

## Nitpick

### N1 — `aria-haspopup="dialog"` is semantically loose

The popover content is an informational preview card, not a modal dialog. `aria-haspopup`
values `menu|listbox|tree|grid|dialog` — a non-modal Popover is best expressed as
`aria-haspopup="true"` (generic popup) or omitted. Not blocking; flag for accuracy.

### N2 — Hard-coded `width: 400` in `TaskPreviewSkeleton`

`TaskPreviewSkeleton` uses `style={{ width: 400 }}` mirroring `CARD_MAX_WIDTH`, which
`TaskPreviewCard.tsx` intentionally does not export. The comment documents this rationale,
so it is consistent with the existing local decision and acceptable. Surface only for
awareness; reconcile if a shared panel-width token is later introduced.

### N3 — `useLogOnce` effect dependency includes the unstable `callback`

`useEffect(..., [condition, callback])` re-runs every render because the caller passes a
fresh arrow function. Functionally correct (the `useRef` guard prevents duplicate
execution) and equivalent to the previous hand-rolled effect deps. Optional cleanliness:
call sites could wrap callbacks in `useCallback`, or the hook could accept a stable ref.

## Positive notes (no action required)

- **Fix A (deferral) is correct and beneficial.** `CellPopoverContent` is passed as
  `Popover content`; Ant Design does not mount popup content until the popover opens, so
  `assembleTaskPreviewData` (and `spreadsheetToMarkdownTable`) is no longer invoked for
  every cell on every table render. Behaviour on open is unchanged (verified by the
  passing popover unit + E2E structure assertions once the locator issue is fixed).
- **Fix B** adds `aria-label="Loading task preview"` to the `role="status"` skeleton —
  satisfies `frontend-loading-and-width-standards.md` §8 (accessible loading semantics).
- **Fix C** comment correction is accurate (the body-max-height reference was misleading).
- **`useLogOnce`** is a justified, well-scoped extraction (≥2 call sites, removes genuine
  duplication), correctly placed in `src/frontend/src/hooks/`, and exported as a function
  (not a const arrow) per AGENTS §2.
- No `console.*`, no empty `catch`, British English throughout, no backend imports, no
  `@ant-design/v5-patch-for-react-19` added, App.tsx untouched.

## Required action before merge

Fix **C1** (update the two E2E locators to target `[role="button"][aria-label="..."]`), then
re-run `npm run test:frontend:e2e` for `task-preview-card.spec.ts` and `task-heatmap.spec.ts`
to confirm green. I1–I3 and N1–N3 are non-blocking follow-ups.
