# Code Review — Section 5: Wire `TaskHeatmapTable` with real data and new states

**Module:** Frontend (`src/frontend`)
**File under review:** `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
**Branch:** `feat/preview-card-real-data-wiring`
**Reviewer:** Code Reviewer (GREEN-phase gate)
**Verdict:** **CLEAN** — GREEN approved
**Optional non-blocking note:** 1 Nitpick (see below; does not block merge)

---

## Files read (mandatory gate)

1. `SPEC.md` — Task Preview Card Real-Data Wiring Specification (full)
2. `ACTION_PLAN.md` — Section 5 (full) + §4/§3 context
3. `src/frontend/AGENTS.md`
4. `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (full, under review)
5. `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (full — RED test file, unchanged)
6. `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` (`CellPreviewLookup`, `CellPreviewData`)
7. `src/frontend/src/features/classPage/assembleTaskPreviewData.ts` (full)
8. `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (full — confirmed `CARD_MAX_WIDTH = 400`, `CARD_BODY_MAX_HEIGHT = 480` NOT refactored out; confirmed "No reasoning available" / "No submission available" text)
9. `docs/developer/frontend/frontend-loading-and-width-standards.md` (§3, §8)
10. `docs/developer/frontend/frontend-spacing-and-padding-standards.md` (full)

Additional verification reads:

- `src/frontend/node_modules/antd/es/alert/Alert.d.ts` (confirmed antd v6.3.1 `message` is `@deprecated please use title instead` — `title` is the correct v6 API)
- `git diff src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (confirmed prop-type block unchanged, only destructuring added)
- `grep getTaskPreviewData TaskHeatmapTable.tsx` (exit 1 → import removed)

---

## Automated checks

| Check         | Command                                         | Result                                                                                        |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Frontend lint | `npm run lint:frontend`                         | 0 errors, 1 warning (pre-existing `apiService.spec.ts` magic-number — out of scope per brief) |
| Type-check    | `npm exec tsc -- -b src/frontend/tsconfig.json` | exit 0 (clean)                                                                                |
| Unit tests    | `npm run test:frontend -- TaskHeatmapTable`     | 16/16 passed                                                                                  |

---

## In-scope verification (all PASS)

1. **Consumption correctness** — `cellData = cellPreviewLookup?.get(record.studentId)?.get(taskColumn.taskId) ?? null` (line 280); `assembleTaskPreviewData(cellData, m, metric, taskColumn.taskId)` (line 281) with correct arg order `(CellPreviewData|null, MetricResult, HeatmapMetricKey, taskId)`. Popover branching (lines 284–290): `isAssignmentLoading` → skeleton; `else if showAssignmentError` → Alert; `else` → real `TaskPreviewCard`. ✓
2. **Inline skeleton** — non-exported `function TaskPreviewSkeleton(): JSX.Element` (line 194), feature-local, `role="status"` + `aria-busy="true"` (lines 197–198), cross-ref comment present (lines 186–190) referencing `CARD_MAX_WIDTH = 400` and `CARD_BODY_MAX_HEIGHT = 480`. `TaskPreviewCard.tsx` constants confirmed intact. ✓
3. **Error Alert** — `<Alert type="error" showIcon title="Couldn't load task details" />` (line 287). antd v6.3.1 deprecates `message` in favour of `title`; the implementation uses the correct v6 prop. Test `toContain("Couldn't load task details")` passes (text renders). Exact mandated string preserved. ✓
4. **`getTaskPreviewData` import removed** — grep returns no matches; import line replaced with `assembleTaskPreviewData`. ✓
5. **Stale-closure fix** — `buildTaskMetricSubColumns` signature (lines 238–245) now receives `cellPreviewLookup`, `isAssignmentLoading`, `showAssignmentError`; call site (lines 394–401) passes them; `columns` `useMemo` deps (line 404) include all three. ✓
6. **Prop-type declaration unchanged** — git diff shows the inline `Readonly<{...}>` type block unchanged; Section 5 only adds the destructuring bindings. Section 4 owns the type. ✓
7. **Standards** — British English in comments (mandated product string "Couldn't load task details" is verbatim from SPEC, not a reviewer discretion); KISS respected; no scope creep; no `console.*`; no error swallowing; fail-fast. ✓
8. **Spacing** — skeleton `marginBottom` uses `APP_GAP_MD` (16px, token-aligned). Skeleton width/height values (`400`, `200`, `24`, `120`, `'100%'`) are shape dimensions, not spacing, and are explicitly hard-coded+commented per SPEC §"New: Task Preview Skeleton". Alert has no inline spacing. No non-8px-multiple spacing literals introduced. ✓
9. **Lint / tsc** — clean (only the out-of-scope `apiService.spec` warning remains). ✓
10. **Optional `@remarks` follow-through** — MISSING (see Nitpick below).

---

## Findings

### Critical

None.

### Improvement

None.

### Nitpick (non-blocking)

- **N1 (optional, non-blocking) — `TaskHeatmapTable.tsx`:** ACTION_PLAN §5 "Optional `@remarks` JSDoc follow-through" suggests documenting the three popover states (skeleton / error / real) and the lookup path in a `@remarks` block on the render callback or component level. This is not present. It is explicitly optional and does not block GREEN. Recommend adding a brief `@remarks` on `buildTaskMetricSubColumns`'s `render` callback (or the component) describing the state-branch precedence and the `cellPreviewLookup?.get(studentId)?.get(taskId) ?? null` path, for future maintainers.

---

## Verdict

**CLEAN** — GREEN approved.

All in-scope acceptance criteria (Section 5 objectives 1–5, constraints, and acceptance criteria) are satisfied. Lint and tsc are clean; 16/16 TaskHeatmapTable unit tests pass. The one item (N1) is the plan's own optional follow-through and is explicitly non-blocking.

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
