# Focused Code Review — Batches E3 / E4 / F1 / F3 / E5

**Branch:** `opencode/crisp-meadow`
**Scope:** Frontend data-analysis adapter/rows layer (6 files, listed in `Mandatory Reading`).
**Reviewer:** Code Reviewer (focused pass)

---

## Summary

**Verdict: NEEDS IMPROVEMENT**

The four performance/robustness changes — E3 (sort-then-slice before rollup), E4 (`Array.find` instead of per-student `Map`), F1 (`Object.freeze` on the shared `NOT_ATTEMPTED_METRIC`), and E5 (inverted index) — are all **behaviour-preserving and correct**, and pass ESLint (`--max-warnings 0`), `tsc -b`, and all 39 scoped Vitest tests.

However, **F3 cannot be confirmed as described in the synthesised review.** The review's premise is that the removed null-`taskTitle` branch was _dead code_ because "the schema enforces non-nullable `taskTitle`." That premise is **false**: `TaskPartialSchema.taskTitle` is `z.string().nullable()` (see `taskPartial.zod.ts:22`). The branch was reachable, so its removal is a **real behaviour change** (null titles now flow through instead of throwing `TaskTitlesUnavailableError`). The change is internally consistent and tested, but **three documentation sites still describe the old contract** and must be corrected.

---

## Validation performed

| Check      | Command                                                                                                   | Result                          |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| ESLint     | `npm --prefix src/frontend exec -- eslint <3 source files> --max-warnings 0`                              | Clean (exit 0)                  |
| Type-check | `npm exec tsc -- -b src/frontend/tsconfig.json`                                                           | Clean (exit 0)                  |
| Unit tests | `npm run test:frontend -- heatmapAdapter.spec.ts classPageAdapter.spec.ts averagingAnalyser.rows.spec.ts` | 3 files, **39 passed** (exit 0) |

No `console.*` in changed source; no American-English spellings (`behavior`/`color`/`utilize`) in changed source; no leftover references to the removed `collectAccumulatorsForTask`.

---

## Per-batch assessment

### E3 — `classPageAdapter` rolls up only the 3 kept assignments — ✅ PASS

`src/frontend/src/features/classPage/classPageAdapter.ts:289–316`

- Sort key is identical: original sorted by `b.lastAssessedAt.localeCompare(a.lastAssessedAt)`; new sorts by `b.validatedUpdatedAt.localeCompare(a.validatedUpdatedAt)`. `lastAssessedAt` was always set to the validated `updatedAt` string, so the key is the same value.
- Ordering is descending in both; both rely on a stable sort (`Array.prototype.sort` historically, `Array.prototype.toSorted` for the new code), so **tie-breaking is identical** (equal timestamps keep `classFull.assignments` order).
- `MAX_RECENT_ASSIGNMENTS` (3) slice semantics unchanged.
- **Trust validation is preserved**: the new `.map(...)` still calls `validateUpdatedAt(...)` for **every** assignment before slicing, so a null/unparseable `updatedAt` still throws exactly as before (just earlier — fail-fast, which is preferable).
- The shared-definitionKey test (`classPageAdapter.spec.ts:932`) and the millisecond-precision test (`classPageAdapter.spec.ts:333`) still pass, confirming output order and rollup grouping are unchanged.

### E4 — `heatmapAdapter` avoids per-student `Map` allocation — ✅ PASS

`src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:200–216`

- Replaced `new Map(studentMetrics.map((m) => [m.taskKey, m]))` + `.get(...)` with `studentMetrics.find((m) => m.taskKey === column.taskKey)`.
- `studentMetrics` is the per-student list from `metricsByStudent` (unique `taskKey` per student), so `Map.get` and `Array.find` return the same element. Behaviour is identical; only the per-student `Map` allocation is removed (constant-factor improvement, as intended).

### F1 — `NOT_ATTEMPTED_METRIC` frozen + documented — ✅ PASS

`src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:79–94`

- `Object.freeze(...)` on an object of **primitive** fields makes it fully immutable (no nested objects to deep-freeze). `Readonly<MetricResult>` typing is correct.
- The shared object is still assigned by reference to `completeness`/`accuracy`/`spag` of missing cells — identical to the previous (un-frozen) behaviour, now with protection against accidental mutation. Safe improvement.

### F3 — `TaskTitlesUnavailableError` dead null-title branch removed — ⚠️ NEEDS FIX

`src/frontend/src/services/dataAnalysis/heatmapAdapter.ts:155–166` (removed `if (taskColumns.some((c) => c.taskTitle === null)) throw ...`)

- **Premise in synthesised review is incorrect.** `TaskPartialSchema` defines `taskTitle: z.string().nullable()` (`taskPartial.zod.ts:22`), and `AssignmentDefinitionPartialSchema.tasks` is `z.array(TaskPartialSchema)`. There is **no transport-level rejection of null titles** — a partial with a null `taskTitle` is fully valid wire data. Therefore the removed branch was **reachable, not dead**.
- **Behaviour change, not dead-code removal:** previously a heatmap assignment whose warm-up partial contained a null `taskTitle` threw `TaskTitlesUnavailableError` (and `TaskHeatmapPage` rendered an in-view `Alert` via `isTitleError`). Now the `null` is carried through to `HeatmapTaskColumn.taskTitle` and the adapter succeeds.
- The new behaviour is internally consistent: `HeatmapTaskColumn.taskTitle` is typed `string | null`, the test (`heatmapAdapter.spec.ts:392–412`) now asserts _no throw_ + `null` carried through, and `TaskHeatmapPage.spec.tsx:121–126` still validates the missing-partial throw path. So the change is **intentional and tested** — but the documentation was not updated.

**Stale documentation that must be corrected (in-scope files):**

1. **`heatmapAdapter.ts:9–17`** — `TaskTitlesUnavailableError` JSDoc still states it is thrown "when the warm-up `assignmentDefinitionPartials` dataset has no entry for the assignment's `definitionKey`, **or the located partial has at least one task with a `null` `taskTitle`**." The second clause is now false.
2. **`heatmapAdapter.ts:51–63`** — `HeatmapTaskColumn` JSDoc states `taskTitle` "may be `null` (**which triggers a `TaskTitlesUnavailableError` during projection**)." Now false.
3. **`taskPartial.zod.ts:15–17`** — comment states "`taskTitle` is nullable so that legacy or missing titles reach the `TaskTitlesUnavailableError` path (Section 8)." Now contradicts the adapter behaviour.

**Out-of-scope but directly caused by F3 (flagged for orchestrator):** `TaskHeatmapTable.tsx:307` renders `title: taskColumn.taskTitle` with **no** `taskId` fallback, despite the `HeatmapTaskColumn` JSDoc claiming "The table header falls back to `taskId` for display." With the throw removed, a null `taskTitle` now produces a **blank/null column header** instead of the previously surfaced Alert. Either restore the throw for null titles, or implement the documented `taskId` fallback in the table. (File is outside this review's scope; listed so the impact is not lost.)

### E5 — `averagingAnalyser.rows` inverted index — ✅ PASS

`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts:48–66, 136–151`

- Removed `collectAccumulatorsForTask` (confirmed: zero references remain anywhere under `src/frontend`).
- New inverted index `taskKeyToAccumulators` is built with a single `O(S·T)` pass; per-task lookup is now `taskKeyToAccumulators.get(taskKey) ?? []`. For a given `taskKey`, the collected accumulators are identical in **membership and order** (student-iteration order) to the old function, so `rollupAccumulators` input is unchanged. `rollupAccumulators` aggregates order-independently.
- No leftover stale comment referencing the old function (the only `rescan` mention is the new, accurate comment at line 140). All 10 `averagingAnalyser.rows.spec.ts` tests pass, including the updated date-range test that now supplies a `createDefinitionPartial` (required because `resolveAssignmentDefinition` on this branch needs the partial to be present — a legitimate, minimal test fix).

---

## Findings

### Improvement (must fix before merge — F3 documentation)

- **`heatmapAdapter.ts:9–17`** — `TaskTitlesUnavailableError` JSDoc still lists "null `taskTitle`" as a throwing condition. Remove that clause; the error is now thrown **only** when the warm-up partial is missing for the `definitionKey`.
- **`heatmapAdapter.ts:51–63`** — `HeatmapTaskColumn` JSDoc: delete "which triggers a `TaskTitlesUnavailableError` during projection". State that a `null` `taskTitle` is carried through and the header falls back to `taskId` (and ensure the table actually implements that fallback — see below).
- **`taskPartial.zod.ts:15–17`** — Correct the comment: `taskTitle` is nullable and the adapter now carries `null` through (degrades to the `taskId` fallback) rather than raising `TaskTitlesUnavailableError`.

### Nitpick / Observation (F3 — out of focused file set, escalate)

- **`TaskHeatmapTable.tsx:307`** — `title: taskColumn.taskTitle` has no `taskId` fallback, contradicting the `HeatmapTaskColumn` JSDoc. Since F3 now lets null titles through, this renders a blank header instead of the documented fallback (or the previous Alert). Recommend implementing `taskColumn.taskTitle ?? taskColumn.taskId` (or restoring the throw). Not in the reviewed file set; flag to orchestrator.

### Nitpick

- **Synthesised review premise correction:** Batch F3 / E3–F3 text asserts "the partial schema enforces non-nullable `taskTitle`." This is inaccurate (`z.string().nullable()`). The branch removal should be recorded as a **behaviour change** (graceful null-title passthrough) rather than "dead-code removal," so future readers are not misled.

---

## What passed cleanly (no action)

- E3, E4, F1, E5 code changes: behaviour-preserving, correct, idiomatic, British-English comments, functions exported as `function` (not arrow constants).
- All automated gates green (ESLint, tsc, 39 Vitest tests).
- No `console.*`, no empty `catch`, no scope creep, no speculative defaults.

---

## Files read

- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
- `src/frontend/src/features/classPage/classPageAdapter.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.spec.ts`
- `src/frontend/src/features/classPage/classPageAdapter.spec.ts`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`
- `.opencode/scratchpad/code-review-crisp-meadow-synthesised.md` (Batch E lines 123–142, Batch F lines 148–167)
- `src/frontend/AGENTS.md`, `AGENTS.md` (root)
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` (schema evidence)
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts` (schema evidence)
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (consumer impact, line 307)
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` / `.spec.tsx` (error-handling consumer, grep)
