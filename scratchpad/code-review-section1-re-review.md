# Code Review — Re-Review: Section 1 Green Phase (after fixes)

**Review type:** Re-review after fixes from original review
**Module:** Frontend (`src/frontend/src/services/apiService.ts`)
**Date:** 2026-06-13

---

## Summary

**Verdict: Needs Improvement** — All three issues from the previous review are properly resolved. However, one new Improvement has been identified: a discrepancy between the SPEC-mandated optional `parameters` argument and the required `_parameters` argument in the implementation signature. No Critical issues remain.

---

## Automated Checks (all clean)

| Check                                                      | Result                  |
| ---------------------------------------------------------- | ----------------------- |
| `npm run lint:frontend`                                    | ✅ 0 errors, 0 warnings |
| `npm run test:frontend -- src/services/apiService.spec.ts` | ✅ 17/17 PASS           |
| `npm exec tsc -- -b src/frontend/tsconfig.json`            | ✅ 0 errors             |

---

## Previous Issues — Resolution Confirmation

### Critical 1: TS1016 in test type alias — ✅ RESOLVED

**Original finding:** Test type alias on line 539 had `parameters?: unknown` followed by required `jobName`, causing TS1016.

**Fix:** Changed to `parameters: unknown` (required, matching production `_parameters: unknown`).

**Verification:**

- `apiService.spec.ts:539`: `type CallApiQueued = <TResponse>(method: string, parameters: unknown, jobName: string) => Promise<TResponse>;`
- `tsc` compilation: 0 errors ✅
- All 17 tests pass ✅
- Tests pass all 3 arguments as before — no behavioural change ✅

### Improvement 1: JSDoc "Optional" qualifier on `_parameters` — ✅ RESOLVED

**Original finding:** JSDoc `@param` for `_parameters` said "Optional request parameters" despite the parameter being required in the signature.

**Fix:** Changed to `@param {unknown} _parameters - Request parameters.`

**Verification:**

- `apiService.ts:216`: `@param {unknown} _parameters - Request parameters.` — no "Optional" qualifier ✅
- British English used ("Request parameters") ✅

### Improvement 2: Missing planned helper entries in canonical docs — ✅ RESOLVED

**Original finding:** Three `Not implemented` entries from ACTION_PLAN Section 1 were missing from `frontend-shared-helpers-and-abstraction-standards.md`.

**Fix:** Added subsection `### 9.14 API queueing system` with three entries.

**Verification:**

- Entry 1: `QueueState` interface — Decision: `new`, Owning: `apiService.ts`, Status: `Not implemented` ✅
- Entry 2: `callApiQueued` function — Decision: `new`, Owning: `apiService.ts`, Status: `Not implemented` ✅
- Entry 3: `getQueueState` function — Decision: `new`, Owning: `apiService.ts`, Status: `Not implemented` ✅
- Format matches preceding sections (e.g. 9.13) ✅
- Call-site rationale present for each entry ✅

---

## New Issues

### Improvement (should address, not blocking)

**1. `callApiQueued` `_parameters` signature differs from SPEC contract** — `apiService.ts:225-229`

```typescript
export function callApiQueued<TResponse>(
  method: string,
  _parameters: unknown, // ← required
  jobName: string
): Promise<TResponse>;
```

The SPEC §Recommended data shapes (lines 66-72) states:

> ```ts
> function callApiQueued<TResponse>(
>   method: string,
>   parameters?: unknown, // ← optional
>   jobName: string
> ): Promise<TResponse>;
> ```
>
> The `parameters` argument is optional, matching the existing `callApi` signature.

The existing `callApi` signature (`apiService.ts:172`) uses `parameters?: unknown` (optional). The implementation makes `_parameters` required, which deviates from the agreed SPEC contract.

**Impact:** Low — this is a green-phase stub where the parameter isn't yet consumed (the function throws immediately). No callers exist yet. Callers could pass `undefined` explicitly, but cannot omit the argument as `callApi` callers can.

**Recommendation:** Change the signature to `_parameters?: unknown` to match the SPEC. The underscore prefix keeps the `noUnusedParameters` suppression, and the `?` restores the optionality described in the SPEC. When Section 2 wires up the actual queue processing, the parameter will be forwarded to `callApi(..., parameters)` which already accepts `undefined`.

---

## Acceptance Criteria Re-Check (Section 1)

| Criterion                                                                                       | Status                                          |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `QueueState` exported with `pending: number` and `active: boolean`                              | ✅                                              |
| `callApiQueued` exported, accepts `(method, parameters, jobName)`, returns `Promise<TResponse>` | ⚠️ `parameters` required, not optional per SPEC |
| `getQueueState` exported, accepts `(jobName)`, returns `QueueState`                             | ✅                                              |
| Empty `method` throws synchronously for `callApiQueued`                                         | ✅                                              |
| Empty `jobName` throws synchronously for `callApiQueued`                                        | ✅                                              |
| Empty `jobName` throws synchronously for `getQueueState`                                        | ✅                                              |
| `getQueueState('nonexistent')` returns `{ pending: 0, active: false }`                          | ✅                                              |
| Existing `callApi` exports and tests unchanged                                                  | ✅                                              |
| Functions exported as functions (not const + arrow)                                             | ✅                                              |
| Planned helper entries in canonical docs                                                        | ✅                                              |

---

## General Code Quality

- ✅ No `console.*` calls anywhere
- ✅ No empty `catch` blocks
- ✅ British English in comments (`defence`, `behaviour`)
- ✅ No speculative features or scope creep
- ✅ No default values introduced without instruction
- ✅ `@remarks` JSDoc comments present on both `callApiQueued` and `getQueueState`
- ✅ `apiService.ts` is 249 lines — well under 500-line limit
- ✅ `apiService.spec.ts` is 579 lines — pre-existing condition with ~50 new lines for validation tests; coherent block, reasonable to keep adjacently
- ✅ No imports from `src/backend/`
- ✅ Exports are function declarations, not `const` + arrow functions
- ✅ `_parameters` underscore prefix correctly suppresses `noUnusedParameters` in green-phase stub
- ✅ Validation reuses correct schemas (`ApiRequestSchema.shape.method` and `JobNameSchema`)
- ✅ Defence-in-depth validation approach documented in `@remarks`
- ✅ `getQueueState` stub correctly returns zero-state for valid, unknown job names
- ✅ Test assertions cover empty method, empty jobName (both functions), and unknown job name zero-state
- ✅ No Ant Design, React, or hook dependencies introduced in service layer

---

## Files Read

1. `src/frontend/AGENTS.md` (249 lines)
2. `SPEC.md` (266 lines)
3. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (405 lines)
4. `src/frontend/src/services/apiService.ts` (249 lines)
5. `src/frontend/src/services/apiService.spec.ts` (579 lines)
6. `scratchpad/code-review-section1.md` (original review, 159 lines)

---

## Conclusion

**All three previous issues are properly resolved.** The TS1016 compilation error is gone, the JSDoc is consistent, and the shared-helper documentation entries are present and correctly formatted.

One new Improvement is raised: the `_parameters` parameter in `callApiQueued` should be optional (`_parameters?: unknown`) to match the SPEC contract and the existing `callApi` signature. This is a low-impact, trivial fix that can be applied now or deferred to Section 2 when the parameter is actually consumed.

**Recommended next step:** Apply the `_parameters?: unknown` fix, then proceed to Section 2 implementation.
