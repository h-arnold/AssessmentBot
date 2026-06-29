# Code Review Synthesis: Branch `opencode/happy-mountain` vs `feat/ReactFrontend`

**Review date**: 25 June 2026
**Scope**: All files changed (41 files, +6699/-385 lines)
**Reviewers**: 4 parallel code reviewer agents focused on KISS/DRY, Code Compliance, Bug Detection, and Performance

---

## Executive Summary

This review covers the Data Analysis Service v1 feature delivery plus minor backend and frontend schema fixes. The implementation is broadly correct and well-structured, but **10 issues require attention before merge**, of which **4 are critical/high-severity bugs** and **2 are critical performance bottlenecks**.

**Overall rating**: Pass with mandatory remediation

---

## Critical Issues (Must Fix Before Merge)

### C1. Quadratic Task-Weighting Lookup in AveragingAnalyser

|              |                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| **Areas**    | Performance, Bug                                                                                       |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts` (lines 3862-3878) |
| **Severity** | **CRITICAL**                                                                                           |

**Issue**: `resolveTaskWeight` performs two sequential `.find()` array searches per submission item -- one over `assignmentDefinitionPartials` (O(P)) and one over `tasks` (O(T)). Called inside `processAssignment` which iterates all submissions x items, this yields O(classes x assignments x submissions x tasks x (P + T)).

**Impact**: In a realistic scenario with 10 classes, 20 assignments, 30 students, 5 tasks, and 50 partial definitions -> ~1.5M array scans per analysis run.

**Suggestion**: Pre-build `Map` lookups once at the start of `accumulateDataPoints`:

```typescript
const partialsByDefKey = new Map(assignmentDefinitionPartials.map((p) => [p.definitionKey, p]));
const taskWeightByDefKey = new Map<string, Map<string, number>>();
for (const p of assignmentDefinitionPartials) {
  const taskMap = new Map(p.tasks?.map((t) => [t.id, t.taskWeighting]) ?? []);
  taskWeightByDefKey.set(p.definitionKey, taskMap);
}
// Then O(1) lookup:
const taskWeight = taskWeightByDefKey.get(definitionKey)?.get(taskId) ?? 1;
```

---

### C2. Quadratic Filter Composition in `filterAssignments`

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| **Areas**    | Performance                                                                                       |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts` (lines 3949-3973) |
| **Severity** | **CRITICAL**                                                                                      |

**Issue**: Four independent predicate functions are called per assignment, each using O(K) `includes` on arrays.

**Impact**: For 200 assignments with 10 topic keys and 15 definition keys -> 5,000 unnecessary array scans.

**Suggestion**: Convert filter arrays to `Set` once at filter entry. Combine predicates into a single loop:

```typescript
const topicKeySet = new Set(topicKeys ?? []);
const defKeySet = new Set(assignmentDefinitionKeys ?? []);
return cls.assignments.filter((assignment) => {
  if (!assignment.assignmentDefinition) throw new Error(/*...*/);
  if (dateRange && (assignment.createdAt < dateRange.from || assignment.createdAt >= dateRange.to))
    return false;
  if (topicKeySet.size && !topicKeySet.has(assignment.assignmentDefinition.primaryTopicKey))
    return false;
  if (defKeySet.size && !defKeySet.has(assignment.assignmentDefinition.definitionKey)) return false;
  return true;
});
```

---

### C3. Backend Constructor Crashes on `tasks: undefined`

|              |                                                         |
| ------------ | ------------------------------------------------------- |
| **Areas**    | Bug Detection                                           |
| **Files**    | `src/backend/Models/AssignmentDefinition.js` (line 112) |
| **Severity** | **CRITICAL**                                            |

**Issue**: Constructor condition checks `tasks === null || (Array.isArray(tasks) && tasks.length === 0)` but does not handle `tasks === undefined`. When `undefined` is passed (e.g., via `fromJSON` or direct instantiation), the condition falls through to `_hydrateTasks(undefined)`, which hits `Object.entries(undefined)` -> `TypeError`.

**Impact**: Runtime crash on malformed input.

**Suggestion**: Add `tasks === undefined` to the condition:

```javascript
if (tasks === null || tasks === undefined || (Array.isArray(tasks) && tasks.length === 0)) {
```

---

### C4. `linkableDefinitions` Memo Has Incomplete Dependencies

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Areas**    | Bug Detection, Performance                                                              |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (lines 167-186) |
| **Severity** | **HIGH**                                                                                |

**Issue**: The `useMemo` for `linkableDefinitions` calls `queryClient.getQueryData(queryKeys.assignmentDefinitionPartials())` inside the memo body, but the cache data is not in the dependency array (the exhaustive-deps lint rule is suppressed here). When the `assignmentDefinitionPartials` cache refreshes, the memo does not recompute unless one of the listed dependencies happens to change.

**Impact**: Stale picker data -- user sees outdated linkable definitions after the cache updates.

**Suggestion**: Either (a) use `useQuery` instead of `getQueryData` for reactive updates, or (b) read the cache outside the memo and add it to the dependency array:

```typescript
const definitionPartialsFromCache = queryClient.getQueryData(
  queryKeys.assignmentDefinitionPartials()
);
const linkableDefinitions = useMemo(() => {
  // existing logic using definitionPartialsFromCache
}, [
  noMatchResolution,
  classPartialForWizard,
  selectedAssignmentForChoice,
  definitionPartialsFromCache,
]);
```

---

## High Severity Issues (Should Fix Before Merge)

### H1. `AveragingAnalyser` Over-Decomposed into 5 Files

|              |                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Areas**    | KISS/DRY                                                                                                                            |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`, `.accumulation.ts`, `.filters.ts`, `.rows.ts`, `.types.ts` |
| **Severity** | **HIGH**                                                                                                                            |

**Issue**: The analyser is split across 5 files (~600 lines total) for a single pure-function class. The main file (102 lines) merely orchestrates the helpers. This adds significant navigation overhead and indirection. Each helper file is only called from the main analyser.

**Suggestion**: Consolidate into 2 files: `averagingAnalyser.ts` (main class + private methods) and `averagingAnalyser.types.ts` (type definitions). This halves the file count and reduces cognitive load.

---

### H2. Test File Exceeds 500-Line Guideline by 3x (1655 lines)

|              |                                                                              |
| ------------ | ---------------------------------------------------------------------------- |
| **Areas**    | Code Compliance                                                              |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts` |
| **Severity** | **HIGH**                                                                     |

**Issue**: The test file is 1655 lines, over 3x the project's 500-line guideline. It contains inline fixture builders (`createTaskPartial`, `createDefinitionPartial`, `createSubmissionItem`, etc.) and assertion helpers (`expectMetricResult`, `checkMetricInvariant`) that should be extracted into shared test helpers.

**Suggestion**: Extract fixture builders to `src/frontend/src/test/dataAnalysis/averagingAnalyserTestHelpers.ts` following the project's shared-test-helpers convention (per `frontend-testing.md`). This enables reuse in `dataAnalysisService.spec.ts` and brings the file under the line limit.

---

### H3. Missing `React.memo` on Linkable Picker Component

|              |                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Areas**    | Performance                                                                                                            |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx` (referenced from `AssessTaskModal.tsx`) |
| **Severity** | **HIGH**                                                                                                               |

**Issue**: The list re-renders on every parent state change even when its props are stable.

**Suggestion**: Wrap in `React.memo` and stabilise callbacks with `useCallback`.

---

### H4. Inline Function Creation in Render (AssessTaskModal)

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| **Areas**    | Performance                                                                                       |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (lines 656, 744-748, 834) |
| **Severity** | **HIGH**                                                                                          |

**Issue**: Several event handlers are defined inline in JSX: `onChange={(value) => ...}`, `onClick={() => ...}`, `onSelect={(k) => ...}`. These create new function references on every render, breaking `React.memo` on child components.

**Suggestion**: Use `useCallback` for all event handlers or define them as stable module-level functions where possible.

---

### H5. `referenceDocumentId ?? undefined` Loses `null` Distinction

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Areas**    | Bug Detection                                                                           |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (lines 496-497) |
| **Severity** | **HIGH**                                                                                |

**Issue**: The upsert payload converts `referenceDocumentId: null` to `referenceDocumentId: undefined` using `null ?? undefined`. The backend expects nullable `string | null` -- `undefined` may be omitted from serialisation, losing the intent to clear the reference.

**Suggestion**: Use the value directly: `referenceDocumentId: selectedDefinitionForLink.referenceDocumentId ?? null`.

---

## Medium Severity Issues (Should Address Before or Shortly After Merge)

### M1. `DataAnalysisService` Uses Premature Strategy Pattern Registry

|              |                                                                 |
| ------------ | --------------------------------------------------------------- |
| **Areas**    | KISS/DRY                                                        |
| **Files**    | `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts` |
| **Severity** | **MEDIUM**                                                      |

**Issue**: A `Map<string, AveragingAnalyser>` registry exists for a single analyser (`'averaging'`). The SPEC explicitly reserves future analysers for a separate work stream.

**Suggestion**: Remove the registry; instantiate `AveragingAnalyser` directly. Add the registry only when a second analyser exists.

---

### M2. Single-Use Helper Extracted in `AssessTaskModal`

|              |                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------- |
| **Areas**    | KISS/DRY                                                                                  |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (lines 2902-2922) |
| **Severity** | **MEDIUM**                                                                                |

**Issue**: `resolveCachedDefinitionPartialForLink()` is extracted but only called from `handleLinkConfirm()`. This adds a function boundary for zero reuse.

**Suggestion**: Inline the logic back into `handleLinkConfirm()`.

---

### M3. `averagingAnalyser.types.ts` Exports Implementation Helpers, Not Just Types

|              |                                                                               |
| ------------ | ----------------------------------------------------------------------------- |
| **Areas**    | KISS/DRY                                                                      |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts` |
| **Severity** | **MEDIUM**                                                                    |

**Issue**: `createAccumulator()`, `createDataPointAccumulator()`, and `accumToMetric()` are implementation functions exported from the types file.

**Suggestion**: Move these to the main implementation file (or `.accumulation.ts` if retaining that split). Keep `.types.ts` for interfaces and type aliases only.

---

### M4. Modal Fetch Effect Doesn't Clean Up on Close Mid-Fetch

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Areas**    | Bug Detection                                                                           |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (lines 188-217) |
| **Severity** | **MEDIUM**                                                                              |

**Issue**: The `useEffect` for fetching assignments has no cleanup. If the user closes the modal while a fetch is in flight, the response handler still executes, briefly flashing stale data when the modal reopens.

**Suggestion**: Use an `AbortController` or a mounted flag:

```typescript
useEffect(() => {
  let cancelled = false;
  getGoogleClassroomAssignments(...).then(data => {
    if (!cancelled) { setAssignments(data); setFetchState('ready'); }
  });
  return () => { cancelled = true; };
}, [open, ...]);
```

---

### M5. `DEFINITION_STALE` in Matched Flow Doesn't Trigger Wizard Recovery

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Areas**    | Bug Detection                                                                           |
| **Files**    | `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (lines 347-355) |
| **Severity** | **MEDIUM**                                                                              |

**Issue**: When `handleMatchOutcome` receives `DEFINITION_STALE`, it sets a warning alert but doesn't transition to the wizard's stale-recovery flow. The SPEC implies the modal should open the wizard with the stale definition's data.

**Suggestion**: Transition to the `'creating'` state with the stale definition's data pre-loaded.

---

### M6. `.toSorted()` on Locally-Allocated Arrays Instead of `.sort()`

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Areas**    | Performance                                                                                               |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts` (lines 4075-4079, 4106-4110) |
| **Severity** | **MEDIUM**                                                                                                |

**Issue**: `rows.toSorted(...)` allocates a new array when `rows` is a freshly-created local array. Using `.sort()` (in-place) avoids the allocation.

**Suggestion**: Replace `rows.toSorted(...)` with `rows.sort(...)`.

---

### M7. File Approaching 500-Line Limit (390 lines)

|              |                                                                                      |
| ------------ | ------------------------------------------------------------------------------------ |
| **Areas**    | Code Compliance                                                                      |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts` |
| **Severity** | **MEDIUM**                                                                           |

**Issue**: At 390 lines, this file is approaching the 500-line threshold.

**Suggestion**: Monitor growth; if extended further, consider splitting or consolidating with the main analyser file.

---

## Low Severity Issues (Fix Opportunistically)

### L1. British English Inconsistencies

|              |                                                                         |
| ------------ | ----------------------------------------------------------------------- |
| **Areas**    | Code Compliance                                                         |
| **Files**    | Various analyser files (comments use "behavior" instead of "behaviour") |
| **Severity** | **LOW**                                                                 |

**Issue**: A few comments in the new analyser files use American English spelling.

**Suggestion**: Change "behavior" to "behaviour", "normalizes" to "normalises" to match project convention.

### L2. Backend Duplicated Normalisation Logic

|              |                                                                          |
| ------------ | ------------------------------------------------------------------------ |
| **Areas**    | KISS/DRY                                                                 |
| **Files**    | `src/backend/Models/AssignmentDefinition.js` (constructor vs `fromJSON`) |
| **Severity** | **LOW**                                                                  |

**Issue**: Constructor and `fromJSON` both normalise empty arrays to `null` with separate (but similar) logic.

**Suggestion**: Extract to a private static `normaliseTasksInput()` method.

### L3. Test Fixtures Not in Shared Helpers Location

|              |                                                           |
| ------------ | --------------------------------------------------------- |
| **Areas**    | KISS/DRY                                                  |
| **Files**    | `src/frontend/src/services/dataAnalysis/test/fixtures.ts` |
| **Severity** | **LOW**                                                   |

**Issue**: Fixtures are under `services/dataAnalysis/test/` rather than in the project's canonical shared-test-helpers directory (`src/frontend/src/test/`).

**Suggestion**: Move to `src/frontend/src/test/dataAnalysis/fixtures.ts` to follow convention and enable cross-analyser reuse.

### L4. Nearly-Empty Guard Test File Retained

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Areas**    | KISS/DRY                                                                                            |
| **Files**    | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsContract.guard.spec.ts` |
| **Severity** | **LOW**                                                                                             |

**Issue**: File gutted to one trivial test. Canonical validation lives in `assignmentDefinitionPartials.zod.spec.ts`.

**Suggestion**: Consider deleting this file.

### L5. Null Student Names Sort First in perStudent

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| **Areas**    | Bug Detection                                                                              |
| **Files**    | `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts` (lines 28-31) |
| **Severity** | **LOW**                                                                                    |

**Issue**: `(a.studentName ?? '').localeCompare(b.studentName ?? '')` sorts students with `null` names before named students. The SPEC doesn't specify null handling.

**Suggestion**: Document the sorting behaviour or handle nulls per product requirements.

### L6. `criterionWeightings` Tolerance Constant Not Exported

|              |                                                              |
| ------------ | ------------------------------------------------------------ |
| **Areas**    | KISS/DRY                                                     |
| **Files**    | `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` |
| **Severity** | **LOW**                                                      |

**Issue**: `CRITERION_WEIGHTINGS_TOLERANCE = 1e-9` is defined but not exported for potential reuse in the analyser.

**Suggestion**: Export the constant if the analyser ever needs internal validation of weightings.

---

## Positive Findings (What Was Done Well)

- Backend `AssignmentDefinition.js` changes are clean and minimal -- good KISS compliance, proper JSDoc, correct Node export guard
- Schema unification in `classDetailService.zod.ts` (removing duplicate `AssignmentDefinitionPartialSchema`) is an excellent DRY win
- Dead code removal from `AssessTaskModal.tsx` (removed unused tests, imports, and stale helper references) -- textbook slop cleanup
- Comprehensive test coverage for the new data analysis service with well-structured test cases covering: basic averages, empty states, filter operations, criterion weightings, edge cases
- British English compliance throughout most documentation (`SPEC.md`, `DATA_SHAPES.md`, `ACTION_PLAN.md`)
- Proper error handling -- analyser fails loudly on missing `assignmentDefinition` rather than silently producing wrong results
- Zod-first schema design with `.strict()` on all objects and `z.infer` type derivation
- Correct service isolation -- services are pure (no React/AntD imports), follow domain folder convention

---

## Remediation Priorities

| Priority                                | Items                                                                                                                                                               | Effort    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **P0 -- Before merge**                  | C1 (Map-based lookups), C2 (Set-based filters), C3 (undefined handling), C4 (memo deps), H1 (over-decomposition), H2 (test file splitting), H5 (null/undefined fix) | 1-2 days  |
| **P1 -- Before or shortly after merge** | M1 (service registry), M2 (inline helper), M3 (types file), M4 (fetch cleanup), M5 (DEFINITION_STALE), M6 (toSorted -> sort), M7 (file size)                        | 0.5-1 day |
| **P2 -- Opportunistically**             | L1-L6 (all low-severity)                                                                                                                                            | Few hours |

---

## 4-Focus Area Cross-Reference Matrix

| File                            | KISS/DRY       | Compliance | Bugs           | Performance |
| ------------------------------- | -------------- | ---------- | -------------- | ----------- |
| `averagingAnalyser.*` (5 files) | H1, M2, M3, L6 | H2, M7     | --             | C1, C2, M6  |
| `dataAnalysisService.ts`        | M1             | OK         | --             | OK          |
| `dataAnalysis.zod.ts`           | L6             | OK         | OK             | OK          |
| `AssessTaskModal.tsx`           | M2             | OK         | C4, H5, M4, M5 | H3, H4      |
| `AssignmentDefinition.js`       | L2             | OK         | C3             | OK          |
| `averagingAnalyser.spec.ts`     | L3             | H2         | OK             | OK          |

---

_Review generated by Agent Orchestrator using 4 parallel code reviewer agents (KISS/DRY, Code Compliance, Bug Detection, Performance) on 2026-06-25_
