# Focused Code Review — Batches B, D, E1, E2, F2 (Branch `opencode/crisp-meadow`)

**Feature:** Class-page TaskHeatmap (frontend, TypeScript/React)
**Reviewer:** Code Reviewer (focused pass)
**Scope:** `TaskHeatmapPage.tsx`, `TaskHeatmapTable.tsx`, `StudentAveragesTableCard.tsx` and their spec files; `metricRangeFilter.tsx`/`metricRangeKey.ts` (B2 read-only references); synthesised review lines 49–144.

---

## Summary

**Verdict: PASS** (one non-blocking Nitpick).

All five batches are implemented correctly and the changes satisfy the fix intent:

- B1 (stale heatmap after refetch) — fixed via `useMemo`.
- B2 (non-functional score-range filters) — fixed end-to-end in both tables.
- D1 (silent generic-error navigation) — fixed; user-safe toast shown, App provider confirmed present.
- E1 (unbounded row rendering) — fixed via pagination.
- E2 (redundant recompute) — fixed via `useMemo`.
- F2 (`toSorted`) — kept per project lint/config; intentionally NOT flagged.

Automated checks all green: ESLint `--max-warnings 0` exit 0, `tsc -b src/frontend/tsconfig.json` exit 0, and `vitest run src/features/classPage/` → **148 passed / 0 failed** (including the updated D1 specs).

---

## Batch-by-batch findings

### B1 — `TaskHeatmapPage` heatmap recompute after refetch — ✅ PASS

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx:129-132`
- Replaced `const [state] = useState(() => computeHeatmapState(...))` with `const state = useMemo(() => computeHeatmapState(...), [analyserResult, classFull, assignmentId, assignmentDefinitionPartials])`.
- Dependency list contains **all four** inputs consumed by `computeHeatmapState` — correct; the result is recomputed when `refetch` delivers new `analyserResult`/`classFull`/`assignmentDefinitionPartials` references.
- `try/catch` inside `computeHeatmapState` is preserved (lines 86-93), so the two-path error handling (TaskTitlesUnavailableError Alert vs generic `message.error`+`onBack`) is intact.
- No early `return null`/hook-order violation: `useEffect` (line 149) is declared before the `isGenericError` early return (line 158), so hooks run unconditionally.
- **Verdict: PASS.**

### B2 — Score-range filters functional — ✅ PASS

**StudentAveragesTableCard.tsx**

- `:142` now `const [filters, setFilters] = useState<...>(INITIAL_FILTERS)` — setter is used.
- `handleTableChange` (`:189`) reads the second `filtersArgument` param and decodes each of `completeness/accuracy/spag/average` via the new `decodeFilterToRange` helper into `setFilters(...)`.
- End-to-end wiring confirmed: `useMemo` at `:156-159` calls `buildStudentAveragesTableColumns(filters)`, and `studentAveragesTableColumns.tsx:179-182` passes `filters.<col>` as `activeRange` into `buildMetricRangeFilter` (`:114-118`). So `filteredValue` is now derived from real state and `onFilter` actually applies.

**TaskHeatmapTable.tsx**

- `:259` lifts `const [tableFilters, setTableFilters] = useState<Record<string, FilterValue | null>>({})`.
- `:213` passes `activeRange: decodeFilterToRange(tableFilters[columnKey])` into `buildMetricRangeFilter` (replacing the hardcoded `[]`).
- `onChange` (`:328-330`) stores the full `filters` map; the controlled `filteredValue` (from `metricRangeFilter.tsx:102-112`) stays in sync, so the dropdown both highlights the active filter and filters rows.

- Both wires are correct; no discarded state. **Verdict: PASS.**

### D1 — Generic error surfaces user feedback — ✅ PASS

- `TaskHeatmapPage.tsx:143` `const { message } = AntdApp.useApp();`; `:153` `message.error('Something went wrong while loading the heatmap. Returning to class overview.');` before `backCallback()` (`:154`).
- Uses the context-aware `App.useApp()` API (Ant Design v6 correct pattern), not the static `message.error` method.
- Confirmed the runtime `<AntdApp>` provider exists in `AppThemeShell.tsx:83` (wrapping `AppShell` → ClassPage), so `App.useApp()` resolves at runtime and the toast renders in the App portal (persists after `backCallback` unmounts the page). Good UX, no leak.
- `logFrontendError('TaskHeatmapPage', state.error)` is still called for developer diagnostics; the user toast is user-safe (no raw error text) — no double-logging of identical details.
- Pre-existing `TaskTitlesUnavailableError` Alert path (`:162-176`) is untouched and still renders in-view.
- Specs updated to wrap renders in `<App>` (`TaskHeatmapPage.spec.tsx`, `ClassPageHeatmapView.spec.tsx`); the generic-error test still asserts `queryByRole('alert')` absent and **passes** (148/148), i.e. the `message` toast does not break the existing assertion and the catch-and-navigate behaviour is preserved.
- **Verdict: PASS.**

### E1 — `TaskHeatmapTable` pagination enabled — ✅ PASS

- `TaskHeatmapTable.tsx:323` `pagination={{ pageSize: 50, showSizeChanger: true }}` replaces `pagination={false}`.
- `scroll={{ x: 'max-content' }}` retained (`:326`); `size="small"`, `bordered` retained.
- Default 50/page is a reasonable bound for class sizes; `showSizeChanger` lets users raise it. Pagination is uncontrolled (no `current`/`onChange` for pagination) and the `onChange` handler only reads `filters`, so page changes are internally managed by Ant Design — correct, no double-bookkeeping.
- **Verdict: PASS.**

### E2 — `TaskHeatmapTable` memoises derived values — ✅ PASS

- `sortedRows` (`:266-269`) deps `[rows]` ✅
- `hasNoSubmissions` (`:274-287`) deps `[rows, taskColumns]` ✅
- `columns` (`:289-312`) deps `[taskColumns, tableFilters]` ✅ — and `columns` now incorporates `tableFilters` via extracted `buildTaskMetricSubColumns`, so the filter highlight recomputes when filters change (no stale closure).
- All closures used inside the memos (`compareHeatmapStudentName`, `buildMetricSorter`, `getCellMetric`, `METRIC_DISPLAY_META`, `HEATMAP_METRIC_KEYS`) are module-level/stable, so no stale-reference risk.
- Layers cleanly on top of B1's `useMemo` for `heatmapResult`; E2 remains valid and beneficial.
- **Verdict: PASS.**

### F2 — `rows.toSorted` — intentionally NOT flagged

- `TaskHeatmapTable.tsx:267` keeps `rows.toSorted(compareHeatmapStudentName)` (non-mutating). The project targets ES2024 and the `unicorn/no-array-sort` lint rule forbids mutating `.sort()`. ESLint passed (`--max-warnings 0`), confirming compliance. Per the task brief, the synthesised review's `slice().sort()` suggestion is overridden by project lint/config. **No finding.**

---

## Frontend standards compliance (changed code only)

- **No `console.*`** in the three source files — verified (grep + ESLint clean). ✅
- **British English** — scanned; the only `center` hits are Ant Design's `align: 'center'` / `justify="center"` API literals (required, not a spelling violation). No American spellings in comments/strings. ✅
- **Functions exported as functions** — `TaskHeatmapPage`, `TaskHeatmapTable`, `StudentAveragesTableCard` are all `export function`. Local helpers are `function` declarations. ✅
- **Explicit types** — params/returns typed; `tableFilters` typed `Record<string, FilterValue | null>`; `filtersArgument` typed. ✅
- **8px spacing grid** — no new padding/margin/gap literals introduced by these batches; existing `gap={APP_GAP_MD}` preserved. ✅
- **Ant Design v6 patterns** — no `@ant-design/v5-patch-for-react-19` added; `App.useApp()` used (D1). ✅
- **`App.tsx` stays thin** — not modified; composition still delegated to `AppThemeShell`/`AppShell`. ✅

---

## Findings

### Critical

- None.

### Improvement

- None blocking.

### Nitpick (non-blocking)

- **`decodeFilterToRange` duplicated across two files** — `TaskHeatmapTable.tsx:185` and `StudentAveragesTableCard.tsx:73` define byte-identical helpers. A natural, non-speculative shared home already exists: `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts` (it already exports `decodeMetricFilter`). Suggest exporting `decodeFilterToRange` from `metricRangeKey.ts` and importing it in both components to remove the duplication. This is optional cleanup; per the project's WET guidance-duplication tolerance it is not a defect, and ESLint/tsc/tests are all green.

### Pre-existing / out-of-scope notes (not blocking, not in changed lines)

- ESLint `--max-warnings 0` returned **0 warnings** across all three files, so there are no pre-existing lint warnings on touched lines to report.
- Batches C, E3, E4, E5 are explicitly out of scope for this focused pass and were not reviewed.

---

## Validation evidence

| Check          | Command                                                                                                                                                                                                                                       | Result                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Lint (scoped)  | `npm --prefix src/frontend exec -- eslint src/frontend/src/features/classPage/TaskHeatmapPage.tsx src/frontend/src/features/classPage/TaskHeatmapTable.tsx src/frontend/src/features/classPage/StudentAveragesTableCard.tsx --max-warnings 0` | exit 0, no warnings        |
| Type-check     | `npm exec tsc -- -b src/frontend/tsconfig.json`                                                                                                                                                                                               | exit 0                     |
| Tests (scoped) | `npx vitest run src/features/classPage/`                                                                                                                                                                                                      | 14 files, 148 tests passed |

---

## Files read (mandatory + supporting)

- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `src/frontend/src/features/classPage/StudentAveragesTableCard.spec.tsx`
- `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeFilter.tsx`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts`
- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx` (B2 wiring verification)
- `src/frontend/src/App.tsx` and `src/frontend/src/AppThemeShell.tsx` (D1 runtime `<App>` provider verification)
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `src/frontend/AGENTS.md`, `AGENTS.md` (root)
- `.opencode/scratchpad/code-review-crisp-meadow-synthesised.md` (lines 49–144)

---

> Remember, you must address **all** in-scope review items and then resubmit to the reviewer until the review comes back clean.
