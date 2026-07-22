# Code Review — PR I1 + I2 (frontend)

**Reviewer**: Code Reviewer (poolside/laguna-s-2.1:free)
**Date**: 2026-07-17
**Modules in scope**: Frontend (`src/frontend/`)

## Summary

**Verdict: PASS (no outstanding in-scope issues).**

The I1 change correctly replaces the inlined `primaryTitleByKey` Map with the shared
`getAssignmentDefinitionPartial` seam and preserves the fail-closed `TaskTitlesUnavailableError`
throw. The I2 change correctly routes `getABClass` response parsing through the single
`parseApiResponse` choke point, retains null-not-found behaviour via the `.nullable()`
schema, and removes the now-unused `logFrontendError` import. The test mock was updated so all
tests pass. Automated lint is clean (only the pre-existing, out-of-scope `apiService.spec.ts:304`
no-magic-numbers warning remains) and all 25 affected unit tests pass.

## Mandatory Checks Performed

- Read `src/frontend/AGENTS.md` §5.1 (transport pattern / single choke point) and §9 (Zod).
- Read all three changed files in full.
- Read the shared seam `assignmentDefinitionUtilities.ts` and the `parseApiResponse`
  implementation in `apiService.ts` to confirm contract semantics.
- Read `classDetailService.zod.ts` to confirm `ClassFullResponseSchema = ClassFullSchema.nullable()`.
- Ran `npm run lint:frontend` → 0 errors (1 pre-existing warning, out of scope).
- Ran `vitest run` on `classDetailService.spec.ts` (5 tests) and `classPageAdapter.spec.ts`
  (20 tests) → 25/25 passed.
- Confirmed `classPageAdapter.spec.ts` covers the `TaskTitlesUnavailableError` fail-closed path
  (line 1042).

## Findings Against Review Focus

### I1 — `classPageAdapter.ts`

- **Shared seam used correctly**: `getAssignmentDefinitionPartial(assignmentDefinitionPartials, definitionKey)`
  is imported once (line 31) and called at line 327. No inlined `primaryTitleByKey` Map or build
  loop remains (confirmed via `git diff` and re-read of file).
- **Fail-closed throw preserved**: when the seam returns `null`, `TaskTitlesUnavailableError(definitionKey)`
  is still thrown (lines 328-330). `partial.primaryTitle` is then accessed only on the non-null
  branch; TypeScript narrows correctly.
- **Behavioural note (non-blocking, not a defect)**: the previous inline loop used last-match-wins
  on duplicate `definitionKey` entries; the seam uses first-match (`Array.find`). First-match is the
  canonical, documented seam behaviour and is the intended unification, so this is an improvement,
  not a regression.
- **`perTaskLookup` unchanged**: the analyser-result lookup (`buildPerTaskLookup` + `perTaskLookup.get(definitionKey)`
  at line 335) is a distinct concern and was correctly left untouched, as specified.

### I2 — `classDetailService.ts`

- **Single choke point**: `getABClass` now calls
  `parseApiResponse(ClassFullResponseSchema, GET_AB_CLASS_METHOD, responseData)` (line 27),
  replacing the inline `try { ClassFullResponseSchema.parse(...) } catch { logFrontendError; throw }`.
  `parseApiResponse` is the canonical transport-parsing choke point (AGENTS §5.1 / apiService.ts:167).
- **Null-not-found preserved**: `ClassFullResponseSchema` is `ClassFullSchema.nullable()`
  (classDetailService.zod.ts:153), so a `data: null` envelope still yields `null` and the
  `Promise<ClassFull | null>` contract is unchanged. Test at spec line 107 confirms `null` return.
- **Unused import removed**: the `logFrontendError` import from `../../../logging/frontendLogger`
  was removed (confirmed: no remaining `logFrontendError` references in the file). Logging of Zod
  failures is now centralised inside `parseApiResponse` (apiService.ts:178), preserving the
  fail-loud behaviour.
- **No import duplication / clash**: `callApi` and `parseApiResponse` are imported together from
  `'../../apiService'` on a single line (line 1). No duplicate import, no name clash.

### I2 — `classDetailService.spec.ts`

- **Mock updated**: `parseApiResponse` added to the `vi.mock('../../apiService')` factory, delegating
  to `schema.parse(data)`, so `getABClass` resolves/rejects as before. The "propagates Zod parse
  errors loudly" test (line 117) still throws because `schema.parse` throws on invalid data.

### Cross-cutting

- **British English**: no American spellings introduced in the changed regions.
- **No `console.*`**, **no empty catch blocks**, **no speculative scope**, **no new defaults**.
- **Export style**: both `getAssignmentDefinitionPartial` and `getABClass` are declared as plain
  `export function`s, satisfying AGENTS §2.

## Actionable Findings

None. No Critical, Improvement, or Nitpick items within the in-scope review focus.

## Out of Scope (noted, not assessed)

- Pre-existing `apiService.spec.ts:304` no-magic-numbers warning (explicitly excluded by the task).
