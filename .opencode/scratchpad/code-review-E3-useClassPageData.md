# Code Review — PR E3: `useClassPageData.runAdapterStep` fail-closed

**Reviewer:** Code Reviewer agent
**Date:** 2026-07-17
**Module:** Frontend (`src/frontend`)
**Changed file:** `src/frontend/src/features/classPage/useClassPageData.ts`
**Diff scope:** `runAdapterStep` null-guard (lines 171-176) only.

---

## Summary

**Verdict: Pass** — The change correctly converts the silent fail-soft null guard in
`runAdapterStep` into an explicit fail-closed `Error` tuple. The returned `Error` is
consumed by the existing pipeline/surface-state machinery as a blocking `adapterError`,
the return type is unchanged, the normal path is untouched, and there are no new lint or
type errors. One non-blocking observation about reachability/coverage is recorded as a
Nitpick.

---

## Checklist (Frontend-only rows applied)

- [x] No `console.*` calls in active source.
- [x] No empty `catch` blocks (the `try/catch` at lines 185-188 logs then returns the error).
- [x] British English in comments and identifiers (uses "analyser", "behaviour" conventions; error strings use "null" correctly).
- [x] No speculative scope expansion — change is localised to the one guard.
- [x] No new default values introduced.
- [x] `@remarks` present on key functions.
- [x] File well under 500 lines (493).
- [x] Return type `readonly [ClassPageAdapterResult | null, Error | null]` unchanged.
- [x] No imports from `src/backend/`.
- [x] `App.tsx` unaffected (change is in a feature hook).
- [x] No behaviour change for the normal (non-null) path.
- [x] Lint clean (only pre-existing `apiService.spec.ts:304` no-magic-numbers warning, out of scope).
- [x] `tsc -b src/frontend/tsconfig.json` passes with no errors.
- [x] `useClassPageData.spec.ts`: 30/30 tests pass.

---

## Focus verification

### 1. Error handling — fail-closed, not silent fail-soft

**Before:**

```ts
if (analyserResult === null || assignmentDefinitionPartials === null) {
  return [null, null];
}
```

**After (lines 171-176):**

```ts
if (analyserResult === null) {
  return [null, new Error('useClassPageData.runAdapterStep: analyserResult is null')];
}
if (assignmentDefinitionPartials === null) {
  return [null, new Error('useClassPageData.runAdapterStep: assignmentDefinitionPartials is null')];
}
```

Both null cases now return a concrete `Error` instead of a silent `[null, null]`. This
aligns with AGENTS §6.1 ("Required degraded or untrustworthy data fails closed by
default") and the logging policy's avoidance of catch-and-ignore. No swallowed errors.

### 2. `Error` correctly consumed as a blocking condition

- Caller `useMemo` (lines 312-320) destructures `[adResult, adError]` and, on `adError !== null`,
  returns `[null, null, null, adError]`.
- `surfaceState` memo (line 354) calls `computeServiceError(adapterError, analyserError)`
  with `adapterError === adError`.
- `computeServiceError` (helpers lines 101-114) maps a non-null `adapterError` to
  `{ type: 'adapterError', cause: adapterError }`, producing `{ status: 'blocking', error }`.
- The blocking error then propagates to `error` (line 384-385) and the surface state.
  Verified correct consumption. No caller changes were required.

### 3. Return type unchanged

Signature remains `readonly [ClassPageAdapterResult | null, Error | null]`. Caller
destructuring at line 312 already expected a 2-tuple. No type drift.

### 4. Normal path unchanged

When `analyserResult` and `assignmentDefinitionPartials` are non-null, control falls
through to the unchanged `try/catch` around `adaptClassPageToViewModel`. Behaviour
identical to before.

### 5. British English

Error literal strings and comments are consistent with the project's British-English
convention; no American spellings introduced.

### 6. Lint / type errors

- `npm run lint:frontend` → only the pre-existing, out-of-scope `apiService.spec.ts:304`
  no-magic-numbers warning. No new errors from this change.
- `tsc -b src/frontend/tsconfig.json` → no output (clean).

---

## Nitpick (non-blocking)

**Nitpick (Frontend) — `src/frontend/src/features/classPage/useClassPageData.ts:171-176`**
The new fail-closed guards are defensive over inputs that are already guaranteed non-null
by the existing pipeline invariants, so the branches are structurally unreachable through
the public hook today:

- `assignmentDefinitionPartials === null` is impossible here because `shouldRunPipeline`
  (lines 262-269) returns `false` when `assignmentDefinitionPartials` is null, so the
  pipeline `useMemo` short-circuits at line 302-304 and never calls `runAdapterStep`.
- `analyserResult === null` (passed as `aResult`) with `aError === null` is impossible
  because `runAnalyserStep` returns `[null, null]` only when `classFull === null` (line
  132, unreachable here) and otherwise returns `[response[0] ?? null, null]` where
  `response[0]` is typed `AveragingResult` (non-null once the `response.length === 0`
  check at line 145 passes).

Consequence: because `runAdapterStep` is module-private (not exported), these two branches
cannot be exercised by a unit test through `useClassPageData` without violating the
pipeline contract, so there is no direct test for them (the existing spec covers the
`adaptClassPageToViewModel` throw path at lines 461-481, which is reachable).

This is acceptable — the fail-closed hardening is strictly safer than the prior silent
`[null, null]` and protects against future refactors — but flagged for awareness:
the guards are currently dead/redundant code with no test coverage. If the team prefers
to keep them, consider a brief `@remarks` note that they are defensive fail-closed guards
over guaranteed inputs, so future readers do not mistake them for reachable paths.

---

## Files read

- `src/frontend/AGENTS.md` (§6 error handling context)
- `src/frontend/src/features/classPage/useClassPageData.helpers.ts` (`computeServiceError`)
- `src/frontend/src/features/classPage/useClassPageData.ts` (changed file + callers)
- `docs/developer/frontend/frontend-logging-and-error-handling.md` (canonical policy)
- `src/frontend/src/features/classPage/useClassPageData.spec.ts` (test coverage verification)
- `git diff HEAD -- src/frontend/src/features/classPage/useClassPageData.ts` (change confirmation)

## Commands run

- `npm run lint:frontend` — clean (pre-existing warning only, out of scope)
- `npm exec tsc -- -b src/frontend/tsconfig.json` — no errors
- `npx vitest run src/features/classPage/useClassPageData.spec.ts` — 30/30 passed
