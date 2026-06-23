# Code Review: `averagingAnalyser.spec.ts` (Red Phase)

**Summary: Needs Improvement** — The test file is well-structured with mathematically correct assertions and follows frontend testing conventions, but it is **missing 9 of the 19 required test cases** from ACTION_PLAN.md Section 6. These omissions are Critical and must be addressed before the Green phase implementation can be validated.

---

## Critical Issues

### 1. Missing Required Test Cases (9 of 19 from ACTION_PLAN.md §6)

The ACTION_PLAN.md Section 6 "Required test cases (Red first)" lists **19** mandatory test cases. The test file implements only **16** (matching the user's summary list). The following required test cases are **absent**:

| #   | ACTION_PLAN Test Case                                                                             | Status     |
| --- | ------------------------------------------------------------------------------------------------- | ---------- |
| 6   | **Date range filter** excludes assignments with `createdAt` outside `[from, to)`                  | ❌ Missing |
| 7   | **Topic filter** excludes assignments where `primaryTopicKey` not in `topicKeys`                  | ❌ Missing |
| 8   | **Assignment definition-key filter** excludes non-matching `definitionKey`                        | ❌ Missing |
| 9   | **Task weighting resolution** from pre-fetched `AssignmentDefinitionPartial[]` cross-reference    | ❌ Missing |
| 10  | **Task weighting fallback** → `taskWeighting = 1` when no matching partial/task entry             | ❌ Missing |
| 11  | `assignmentWeighting = null` → defaults to `1`                                                    | ❌ Missing |
| 12  | **Missing `assignmentDefinition`** → typed error with `classId` / `assignmentId`                  | ❌ Missing |
| 18  | **Student with no qualifying submissions** (all outside date filter) → excluded from `perStudent` | ❌ Missing |
| 19  | **All criteria `'N'`** for a data point → `overall` for that data point is `null`                 | ❌ Missing |

**Impact**: Without these tests, the Green-phase implementation cannot be verified against the full algorithm specification (SPEC.md § "Core view model or behavioural model"). The missing cases cover:

- All three filter dimensions (date, topic, definition-key)
- Task-weighting cross-reference logic (the analyser's primary integration point with pre-fetched data)
- Defensive error handling for malformed input
- Edge cases for SPaG `'N'` handling and student exclusion

**Required action**: Add all 9 missing test cases before proceeding to implementation.

---

## Improvement Issues

### 2. File Length Exceeds Guideline (1158 lines > 500 lines)

The test file is **1158 lines**, more than double the 500-line guideline in the Review Checklist (Universal). While test files can reasonably be longer due to fixture builders, this file could benefit from:

- Extracting the fixture builders (`createTaskPartial`, `createDefinitionPartial`, `createSubmissionItem`, `createSubmission`, `createAssignmentPartial`, `createClassFull`, `buildInput`) into a **shared test helper** under `src/frontend/src/test/dataAnalysis/` (per `frontend-testing.md` § "Shared test helpers" and AGENTS.md §12).
- The `expectMetricResult` and `checkMetricInvariant` helpers are also candidates for shared extraction.

**Rationale**: The fixture builders are complex (200+ lines) and will likely be reused by `dataAnalysisService.spec.ts` and future analyser specs. Centralising them avoids duplication and drift.

---

## Nitpicks

### 3. Minor Comment Style Inconsistency

- Line 259: "behaviour" (British) ✓
- Line 277: "behaviour" (British) ✓
- Line 774: "excludes" (verb) — consider "excludes" is fine, but "excluded" would match "renormalised" on line 774
- Line 823: "uses product" — consider "multiplies" for precision

These are extremely minor; the file consistently uses British English overall.

---

## Positive Findings (Passing Checks)

### ✅ Test Fixture Correctness

- Uses imported canonical type `AveragingAnalyserInput` from `../dataAnalysis.zod` (not local redefinitions)
- Submission fixtures correctly model the **nested `items` dictionary** keyed by `taskId` (matching the corrected `StudentSubmissionPartialSchema` from Section 2)
- All scores are integers `0–5` or `'N'` — no out-of-range values
- `DEFAULT_CREATED_AT` uses strict ISO 8601 with milliseconds and timezone (`2026-01-01T00:00:00.000Z`) matching `IsoDateTimeWithTimezoneSchema`

### ✅ Algorithm Assertions Verified

All 16 implemented test cases have **mathematically correct expected values** per SPEC.md:

- Weight calculation: `assignmentWeighting × taskWeighting` ✓
- SPaG `'N'` renormalisation (denominator shrinks) ✓
- Per-criterion weighted means ✓
- Overall renormalised weighted mean ✓
- Sort orders: `perStudent` by name/ID, `perTask` by (definitionKey, taskId), `AveragingResult[]` by classId ✓
- `MetricResult.value === null` iff `applicableDataPoints === 0` invariant ✓
- `appliedCriterionWeightings` echoes constructor defaults/overrides ✓
- `taskTitle` is `null` in v1 output ✓

### ✅ Frontend AGENTS.md Compliance

- **Exports functions as functions** (fixture builders are `function` declarations, not `const` arrows) — line 26, 40, 81, 113, 142, 187, 220, 275, 1149
- **No `src/backend` imports** — only imports from `../dataAnalysis.zod` and `./averagingAnalyser`
- **No `console.*` calls** — verified absent
- **No empty `catch` blocks** — verified absent
- **Zod-first types** — imports inferred type from Zod schema
- **Pure test logic** — no React, Ant Design, or side effects

### ✅ Test Structure & Readability

- Clear `describe`/`it` hierarchy matching the 16 scenarios
- Well-documented fixture builders with JSDoc `@param`/`@returns`
- `expectMetricResult` helper uses `toBeCloseTo` with `FLOAT_TOLERANCE = 10` for floating-point safety
- `checkMetricInvariant` helper correctly encodes the schema invariant
- Fixture builders are composable and parameterised

---

## Recommendations

### Before Green Phase (Mandatory)

1. **Add the 9 missing test cases** from ACTION_PLAN.md §6 (rows 6, 7, 8, 9, 10, 11, 12, 18, 19). These are not optional — they are the acceptance criteria for the analyser implementation.

2. **Consider extracting fixture builders** to `src/frontend/src/test/dataAnalysis/averagingAnalyserTestHelpers.ts` to:
   - Reduce file length below 500 lines
   - Enable reuse in `dataAnalysisService.spec.ts`
   - Follow `frontend-testing.md` shared-helper guidance

### Optional (Post-Implementation)

3. **Add `@remarks` JSDoc** to the test file explaining the fixture builders' alignment with the corrected `StudentSubmissionPartialSchema` (nested `items` dictionary) and the canonical `AssignmentDefinitionPartialSchema` (with `tasks: TaskPartial[]`).

---

## Verdict

| Category    | Status                                                    |
| ----------- | --------------------------------------------------------- |
| Critical    | ❌ **Fail** — 9/19 required test cases missing            |
| Improvement | ⚠️ **Needs Improvement** — file too long, extract helpers |
| Nitpick     | ✅ **Pass** — minor style only                            |

**Cannot proceed to Green phase** until all 19 ACTION_PLAN.md §6 test cases are present. The existing 16 tests are high-quality and mathematically sound, but incomplete coverage will allow implementation gaps to go undetected.

---

## Files Read for This Review

1. `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/AGENTS.md`
2. `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/SPEC.md`
3. `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/ACTION_PLAN.md`
4. `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`
5. `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/src/frontend/AGENTS.md`
6. `/home/developer/.local/share/opencode/worktree/7f924f640724282485ab6878b284e8c4ec11a00e/happy-mountain/docs/developer/frontend/frontend-testing.md`
