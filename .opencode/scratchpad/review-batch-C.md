# Code Review — Batch C (Frontend analyser robustness)

**Reviewer:** Code Reviewer (focused pass on Batch C)
**Branch:** `opencode/crisp-meadow`
**Scope:** `resolveAssignmentDefinition.ts`, `averagingAnalyser.accumulation.ts`, `metricRangeKey.ts` (+ their specs) — Batch C items C1/C2/C3 and the related `metricRangeKey` gate fix.

---

## Summary

**Verdict: PASS** (with two non-blocking nitpicks).

All three Batch C changes are correctly implemented, degrade gracefully, are covered by tests that assert the _new correct_ behaviour (not merely made to pass), and pass scoped static analysis and tests:

- `eslint` (3 source files, `--max-warnings 0`) → exit 0.
- `tsc -b src/frontend/tsconfig.json` → no errors in any in-scope file.
- `averagingAnalyser.accumulation.spec.ts` → 22/22 pass.

The lone remaining refinement (C1 logging level) is explicitly sanctioned by the review brief ("logging via `logFrontendError` is acceptable") and is therefore non-blocking.

---

## C1 — `resolveAssignmentDefinition` no longer throws for the whole class

**File:** `src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts:27-41` (returns `ResolvedAssignmentDefinition | null`), called from `averagingAnalyser.accumulation.ts:314-323`.

**Assessment: PASS.**

- `resolveAssignmentDefinitionData` now returns `null` instead of throwing when the `definitionKey` is absent from the partials Map.
- The only caller (`accumulateDataPoints`) correctly guards with `if (!resolved)` (line 316), logs via `logFrontendError` and `continue`s — degrading per-assignment rather than failing the whole run. Confirmed the analyser run still completes and the class yields a result instead of throwing.
- A grep confirms there are **no other callers** of `resolveAssignmentDefinitionData`, so the signature change is fully contained; no stale throw-expecting call sites remain.
- **Not silent / fails loudly in development:** the `logFrontendError` call emits an `error`-level structured log (context `accumulateDataPoints`, errorMessage, full stack, and `metadata: { definitionKey }`). This was verified live in the test run's stderr output — the error is clearly surfaced in dev. This satisfies "fail loudly in development" because the failure is logged and visible, not swallowed.
- Blast radius is the intended, documented behaviour: a single missing partial skips only that assignment; other assignments in the same class are still analysed.

**Nitpick (non-blocking):** `averagingAnalyser.accumulation.ts:317` — `logFrontendError` raises an `error`-level entry for what is effectively a _degraded-but-recoverable_ skip. The frontend logging policy (`frontend-logging-and-error-handling.md`, §3) defines `warn` as the level for "degraded but recoverable behaviour" and `error` for failures. Using `logFrontendEvent('warn', ...)` would more precisely match that policy. This is explicitly acceptable per the review brief, so it does not block; flagging only for consistency awareness.

---

## C2 — `weight === 0` skip no longer shows spurious `'E'`

**File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:211-234`.

**Assessment: PASS.**

Trace of the zero-weight branch:

- When `assignmentWeighting * taskWeighting === 0`, the branch now increments `nCount` and `totalDataPoints` on both the task accumulator (`getOrCreateTaskAccum`) and the per-(student,task) accumulator (`getOrCreatePerStudentTaskAccum`), then `continue`s.
- `accumToMetric` returns `notAttempted` (`'N'`) when `nCount > 0 && applicableDataPoints === 0` (line 59-67), so the zero-weight task now surfaces as `'N'`, not `'E'`.
- Crucially, `perClass` is built from `allPerStudentTaskAccums` (`averagingAnalyser.ts:107-117`), which the zero-weight branch **does** populate. Hence the class-level (`perClass`), per-student, and per-task rows all correctly report `notAttempted` with `totalDataPoints: 1` for the excluded task, matching the updated test expectations exactly.
- **No impact on normal accumulation:** the `weight === 0` guard only triggers for genuinely zero-weighted data points; non-zero tasks take the normal `processItemAssessments` path. Verified normal cases (`uses product of assignmentWeighting and taskWeighting ...`, `resolves taskWeighting from ... cross-reference`, etc.) still produce `computed` results.
- The task key used in the zero-weight branch (`${definitionKey}::${taskId}`) matches the key used in the normal path, but the `continue` prevents double processing. No double-counting.

Tests `skips assignment when assignmentWeighting is 0` and `skips task when taskWeighting is 0` both assert the new `notAttempted`/`totalDataPoints:1` (and perClass `overall.totalDataPoints:3`) behaviour and pass.

---

## C3 — `computeOverallComposite` no longer throws on all-zero weights

**File:** `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts:451-463`.

**Assessment: PASS.**

- The previous `throw new Error('computeOverallComposite: no computed criteria in composite')` is replaced with a safe `notAttempted` (`value: 'N'`) return.
- **Schema validity:** `NotAttemptedMetricSchema` requires `totalDataPoints: z.number().int().min(1)` (`dataAnalysis.zod.ts:92-98`). Reaching `denominator === 0` implies `hasComputed` is true (the `!hasComputed` guard at line 398 already returned), so at least one computed criterion exists with `applicableDataPoints >= 1` → `totalDataPoints >= 1`. The summed `totalDataPoints` in the safe return is therefore always `>= 1`, satisfying the schema. (The pre-existing `!hasComputed` `notAttempted` branch is also schema-safe: when not all-error and not computed, at least one criterion is `notAttempted`, which itself carries `totalDataPoints >= 1`.)
- **Compatibility with `classPageAdapter.computeAverageMetric`:** `computeAverageMetric` (`classPageAdapter.ts:137-143`) simply returns `computeOverallComposite(...)` whose type is `MetricResult`. The safe `notAttempted` value is a valid `MetricResult` variant, so the adapter receives a well-typed result instead of crashing. No caller assumes `computed`-only output.
- The `metricRangeKey` gate change is **not** part of the report per the brief, but was sanity-checked (see below) and is sound.

---

## Related gate fix (sanity-checked, not reported on)

**File:** `metricRangeKey.ts:63` — `decodeMetricFilter(key?: unknown)` now takes an optional parameter; `metricRangeKey.spec.ts:97` calls `decodeMetricFilter()` (no arg).

**Verdict: Sensible — no issue.**

- The function body already returns `null` for any non-string input (`typeof key !== 'string'`), so an `undefined` argument (no-arg call) is handled identically and returns `null`.
- The spec now covers both `decodeMetricFilter()` and `decodeMetricFilter(undefined)` returning `null`, so the change is test-backed.
- This is a legitimate widening of the signature to support callers that may invoke without an argument; it does not change behaviour for existing callers that pass a defined key.

---

## Checklist (module-scoped)

### Frontend-only items

- [x] TypeScript: no implicit `any`; explicit types on public interfaces (signature `ResolvedAssignmentDefinition | null`, `MetricResult` return shapes — explicit).
- [x] `App.tsx` unaffected (no change).
- [x] Side effects in hooks/services — not applicable; these are pure analyser helpers.
- [x] No imports from `src/backend/`.
- [x] No `@ant-design/v5-patch-for-react-19` added.
- [x] No CDN-dependent runtime assets.
- [x] Playwright not required — changes are pure analyser logic; no user-visible interaction change.

### Universal items

- [x] No `console.*` in active source (eslint `--max-warnings 0` passed).
- [x] No empty `catch` blocks.
- [x] British English in comments/identifiers (e.g. "submissions", "excluded", "partial").
- [x] No speculative scope; each change maps to a documented Batch C item.
- [x] No default values introduced without instruction.
- [x] Functions exported as functions, not arrow-constant exports (`export function resolveAssignmentDefinitionData`, `export function computeOverallComposite`, `export function decodeMetricFilter`).
- [x] File lengths: `averagingAnalyser.accumulation.ts` = 510 lines (≤ 500 guideline is a soft target; not a new violation and not introduced by this batch — no action).

---

## Findings

### Critical

- None.

### Improvement

- None blocking.

### Nitpick (non-blocking)

1. **C1 — logging level** (`averagingAnalyser.accumulation.ts:317`): consider `logFrontendEvent('warn', ...)` instead of `logFrontendError` for the per-assignment skip, to align with the logging policy's `warn` = "degraded but recoverable" semantics. Explicitly acceptable per the review brief; no change required to pass.

---

## Validation commands run (evidence)

```
# Lint (scoped, zero warnings)
npm --prefix src/frontend exec -- eslint \
  src/frontend/src/services/dataAnalysis/analysers/resolveAssignmentDefinition.ts \
  src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts \
  src/frontend/src/services/dataAnalysis/metricDisplay/metricRangeKey.ts --max-warnings 0
# → exit 0

# Type-check (no errors in in-scope files)
npm exec tsc -- -b src/frontend/tsconfig.json
# → grep for in-scope paths returned nothing (no type errors)

# Tests
npm run test:frontend -- src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts
# → 22 passed (42 ms)
```

The error-level log produced by C1 was also observed directly in the test run's stderr, confirming the degradation is logged and visible in development (not silent).
