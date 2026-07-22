# Code Review — Section 3 `assembleTaskPreviewData` RED-phase test

**File under review:** `src/frontend/src/features/classPage/assembleTaskPreviewData.spec.ts`
**Mode:** RED-phase review (implementation module does not exist; import failure is expected).
**Verdict:** CLEAN — RED approved to proceed to GREEN (1 non-blocking Improvement noted).

---

## Files read (mandatory + verification)

1. `/home/developer/AssessmentBot/SPEC.md` — Assembly mapping / coercion table, taskId propagation, `TaskPreviewData` shape.
2. `/home/developer/AssessmentBot/ACTION_PLAN.md` — Section 3 objective, constraints, 13 required test cases.
3. `/home/developer/AssessmentBot/src/frontend/AGENTS.md` — frontend standards (British English, function export, no backend import, etc.).
4. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/assembleTaskPreviewData.spec.ts` — file under review.
5. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/TaskPreviewCard.tsx` — `TaskPreviewData` interface (lines 45–53).
6. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/buildCellPreviewLookup.ts` — `CellPreviewData` shape (lines 13–24).
7. `/home/developer/AssessmentBot/src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` — `MetricResult` discriminated union (lines 84–114).
8. `/home/developer/AssessmentBot/src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts` — `HeatmapMetricKey` (line 18).
9. `/home/developer/AssessmentBot/docs/developer/frontend/frontend-testing.md` — naming (no action-plan numbering), co-location.
10. `/home/developer/AssessmentBot/src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts` — converter signature (verified exists; `spreadsheetToMarkdownTable(rows: Array<Array<string | number | null>>): string`).

**Tooling evidence:**

- `npm --prefix src/frontend exec tsc -- -b src/frontend/tsconfig.json` → only error in the file is `error TS2307: Cannot find module './assembleTaskPreviewData'` (line 11). No other type errors. Confirms inline `CellPreviewData`/`MetricResult` fixtures and call sites are well-typed.
- `npm run lint:frontend` → zero errors/warnings in `assembleTaskPreviewData.spec.ts`. The only project-wide lint item is a pre-existing `apiService.spec.ts:304` magic-number warning (out of scope per brief).

---

## Verification against the 5 in-scope checks

### 1. Completeness — all 13 required cases present and distinct ✅

| #   | Requirement                                         | Test location                                                |
| --- | --------------------------------------------------- | ------------------------------------------------------------ |
| 1   | TEXT, computed                                      | L124 `maps a TEXT artifact…`                                 |
| 2   | TABLE                                               | L133 `maps a TABLE artifact…`                                |
| 3   | IMAGE                                               | L143 `maps an IMAGE artifact…`                               |
| 4   | SPREADSHEET → TABLE + markdown                      | L153 `maps a SPREADSHEET artifact…`                          |
| 5   | base → TEXT, ''                                     | L168 `maps a base artifact…`                                 |
| 6   | null → empty defaults                               | L177 `handles null cellData…`                                |
| 7   | notAttempted → state 'notAttempted', score 'N'      | L189 `passes through notAttempted…`                          |
| 8   | error → state 'error', score 'E'                    | L198 `passes through error…`                                 |
| 9   | reasoning present matches                           | L211 `returns reasoning from cellData.reasoning[metricKey]…` |
| 10  | reasoning absent → ''                               | L223 `returns empty reasoning…`                              |
| 11  | metricKey pass-through (completeness/accuracy/spag) | L239, L247, L255                                             |
| 12  | taskId populated ('task-7')                         | L267 `forwards taskId unchanged when cellData is populated`  |
| 13  | taskId null ('task-9')                              | L280 `forwards taskId unchanged when cellData is null`       |

All distinct, all present.

### 2. Correctness — assertions match coercion table + pass-through rules ✅

- TEXT/TABLE/IMAGE: assert `artifactType` literal and `artifactContent` equals input string. Matches coercion table.
- SPREADSHEET (L153–166): `expectedMarkdown = spreadsheetToMarkdownTable(spreadsheetContent)` and asserts `result.artifactContent === expectedMarkdown` and `artifactType === 'TABLE'`. Checkable against the real converter (verified exists) — correct.
- base (L168): `artifactContent` asserted `''` — matches coercion rule.
- null (L177): `artifactType TEXT`, `artifactContent ''`, `reasoning ''` — matches `null` branch rule.
- notAttempted/error (L189/L198): fixtures use `value: 'N' as const` / `'E' as const` and assert `metricScore`/`metricState` — matches `MetricResult` union members.
- Reasoning (L211/L223): uses `cellData.reasoning[metricKey] ?? ''` semantics correctly — present value passes through, absent (`null`) → `''`.
- taskId (L267/L280): genuinely `expect(result.taskId).toBe('task-7')` / `toBe('task-9')` on both populated and null branches.

### 3. Type / schema validity ✅

- `CellPreviewData` fixture (`cellData` factory, L99–113): `artifactType` typed via `CellPreviewData['artifactType']`, `reasoning` object has all three keys as `string | null`. Valid.
- `MetricResult` fixtures: `computedMetric` returns `state: 'computed' as const` + `value: number` + weight/data-point fields satisfying `ComputedMetricSchema`; `NOT_ATTEMPTED_METRIC` satisfies `NotAttemptedMetricSchema` (`applicableDataPoints: 0`, `totalDataPoints: 1`); `ERROR_METRIC` satisfies `ErrorMetricSchema` (`applicableDataPoints: 0`, `totalDataPoints: 0`). All valid members of the union.
- Call sites supply `(CellPreviewData | null, MetricResult, HeatmapMetricKey, string)` — matches the planned signature. tsc confirms no type errors besides the missing module.

### 4. Standards ✅

- British English throughout (no `color`/`behavior`/`normalize`). ✅
- Co-located `.spec.ts` beside the planned implementation module. ✅
- No action-plan section numbering in any `it()` title or constant. ✅
- No unused imports: `describe/it/expect`, `assembleTaskPreviewData`, `CellPreviewData` (type, used in `cellData`), `spreadsheetToMarkdownTable` (used L160), `MetricResult` (type, used in fixtures) — all referenced. ✅
- Lint-clean for the file; the only project lint item is the pre-existing `apiService.spec.ts` warning (out of scope). ✅

### 5. taskId tests (12/13) ✅

Both L267 (`task-7`, populated) and L280 (`task-9`, null) assert `result.taskId === <expected>` directly.

---

## Findings

### Improvement (non-blocking)

- **`assembleTaskPreviewData.spec.ts` (whole-suite)** — The `computed` branch of the metric-score/state pass-through rule (`metricScore = metricResult.value`, `metricState = metricResult.state`, stated for _all_ states in ACTION_PLAN §3 acceptance criteria and SPEC §"Score and state") is never directly asserted. Five tests (1–6, 9–13) feed `computedMetric(...)` but only check artifact/reasoning/taskId/metricKey, never `result.metricScore` / `result.metricState` for the computed case. Tests 7/8 cover `notAttempted`/`error`, so the pass-through _path_ is exercised, but a computed-specific regression would not be caught.
  - **Concrete fix (optional):** add one assertion block to an existing computed test, e.g. in the TEXT test (L124–131) append:
    ```ts
    expect(result.metricScore).toBe(TEXT_SCORE);
    expect(result.metricState).toBe('computed');
    ```
    Or add a dedicated test `passes through computed metric score and state`. This is NOT required by the 13-case list, so it does not block RED.

### Nitpick

- None.

### Critical / blocking

- None.

---

## Verdict

**CLEAN** — all 13 required RED-phase cases are present, distinct, correctly asserted against the coercion table and pass-through rules, well-typed (tsc shows only the expected missing-module error), and lint-clean. The single Improvement above is non-blocking.

**RED approved to proceed to GREEN.** The only test failure is the expected `Cannot find module './assembleTaskPreviewData'` import-resolution error; once the implementation module is added, the suite should compile and the tests should pass (subject to GREEN implementation matching the stated coercion/pass-through contract).
