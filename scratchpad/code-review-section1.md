# Code Review — Section 1 (Types, validation schemas, and input contracts)

**Review type:** Green-phase (implementation complete, tests pass)
**Module:** Frontend (`src/frontend/src/services/apiService.ts`)
**Date:** 2026-06-13

---

## Summary

**Verdict: Improvement required** — The production code is correct and satisfies all Section 1 acceptance criteria, but there is one Critical issue (a test-file TypeScript compilation error) and two Improvements (JSDoc inconsistency, missing documentation entries).

---

## Automated Checks

| Check                                                      | Result                      |
| ---------------------------------------------------------- | --------------------------- |
| `npm run lint:frontend`                                    | ✅ 0 errors, 0 warnings     |
| `npm run test:frontend -- src/services/apiService.spec.ts` | ✅ 17/17 PASS               |
| `npm exec tsc -- -b src/frontend/tsconfig.json`            | ❌ 1 error (test file only) |

TypeScript error:

```
src/frontend/src/services/apiService.spec.ts(539,76): error TS1016: A required parameter cannot follow an optional parameter.
```

---

## Acceptance Criteria Checklist (Section 1)

| Criterion                                                                                       | Status                                 |
| ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| `QueueState` exported with `pending: number` and `active: boolean`                              | ✅                                     |
| `callApiQueued` exported, accepts `(method, parameters, jobName)`, returns `Promise<TResponse>` | ✅ (see note on parameter optionality) |
| `getQueueState` exported, accepts `(jobName)`, returns `QueueState`                             | ✅                                     |
| Empty `method` throws synchronously for `callApiQueued`                                         | ✅                                     |
| Empty `jobName` throws synchronously for `callApiQueued`                                        | ✅                                     |
| Empty `jobName` throws synchronously for `getQueueState`                                        | ✅                                     |
| `getQueueState('nonexistent')` returns `{ pending: 0, active: false }`                          | ✅                                     |
| Existing `callApi` exports and tests unchanged                                                  | ✅                                     |
| Functions exported as functions (not const + arrow)                                             | ✅                                     |

---

## Detailed Findings

### Critical (must fix, blocking)

**1. Test file TypeScript error TS1016** — `src/frontend/src/services/apiService.spec.ts:539`

The local test type alias on line 539:

```typescript
type CallApiQueued = <TResponse>(
  method: string,
  parameters?: unknown,
  jobName: string
) => Promise<TResponse>;
```

This declares `parameters` as optional (`?`) followed by `jobName` as required, which violates TypeScript rule TS1016. The production function signature uses `_parameters: unknown` (required, not optional) because TypeScript 5.9 prohibits an optional parameter preceding a required one.

**Fix:** Remove the `?` from `parameters` in the test type alias:

```typescript
type CallApiQueued = <TResponse>(
  method: string,
  parameters: unknown,
  jobName: string
) => Promise<TResponse>;
```

This matches the actual production signature and resolves the `tsc` compilation failure. The existing test assertions (which always pass 3 arguments) will be unaffected.

---

### Improvement (should address, not blocking)

**1. JSDoc inconsistency — `_parameters` described as "Optional"** — `apiService.ts:216`

```typescript
 * @param {unknown} _parameters - Optional request parameters.
```

The JSDoc describes `_parameters` as "Optional", but the TypeScript signature makes it required (`_parameters: unknown`). This is misleading to consumers reading the docs (though not to the compiler, since `??` doesn't apply).

**Recommendation:** Update the JSDoc to match the current signature:

```typescript
 * @param {unknown} _parameters - Request parameters.
```

Or, if the intent is genuinely that callers can omit parameters, reorder the signature to `(method, jobName, parameters?)` so the optionality can be expressed in valid TypeScript (all optional parameters go last).

**2. Missing planned helper entries in canonical docs** — `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

The ACTION_PLAN Section 1 check requires:

> Planned helper entries have been added to `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` with status `Not implemented`.

The shared-helper plan in ACTION_PLAN §Section 1 lists three entries:

- `QueueState` interface (decision: `new`, status: `Not implemented`)
- `callApiQueued` function (decision: `new`, status: `Not implemented`)
- `getQueueState` function (decision: `new`, status: `Not implemented`)

These entries are not present in `frontend-shared-helpers-and-abstraction-standards.md`. The file ends at section `9.13 Assess Task Happy Path`. A new section (e.g. `9.14 API queueing system`) with the three `Not implemented` entries should be added to satisfy the Section 1 tracking requirement. These can be updated to `Implemented` status in the final Documentation section of the ACTION_PLAN.

---

### FYI / Observations

**1. `_parameters` underscore prefix convention**

The `_` prefix on `_parameters` is the standard TypeScript convention to suppress `noUnusedParameters`. The ACTION_PLAN notes this will be renamed to `parameters` in Section 2 when the parameter is actually used. This is a clean approach and follows convention.

**2. Synchronous throw pattern is correct for Section 1**

`callApiQueued` is declared as a regular function (not `async`), so the `throw` propagates synchronously. This allows `expect(() => fn()).toThrow()` to catch validation errors. When Section 2 wires up the actual queue processing and returns a real Promise, the function can remain non-`async` — the return type `Promise<TResponse>` is satisfied by manually constructing and returning a Promise. No design change is needed.

**3. Validation reuses correct schemas**

- `ApiRequestSchema.shape.method.parse(method)` — reuses existing schema's method field ✓
- `JobNameSchema.parse(jobName)` — uses the new `z.string().min(1)` schema ✓

This matches the ACTION_PLAN constraint exactly. The `defence-in-depth` approach (validating at the call boundary before enqueue, and again at dispatch via `callApi`) is correctly documented in the `@remarks`.

**4. `getQueueState` stub is correct**

The stub always returns `{ pending: 0, active: false }` after validating `jobName`. This satisfies all Section 1 requirements: unknown job names return zero-state, and validation throws synchronously for empty strings. The function will be wired to the internal queue map in Section 4.

**5. JSDoc `@remarks` quality**

Both `@remarks` blocks are present and correct:

- `callApiQueued` — documents defence-in-depth validation rationale ✓
- `getQueueState` — documents snapshot semantics and monotonicity warning ✓

These match the ACTION_PLAN's optional `@remarks` JSDoc follow-through requirements.

**6. File length**

`apiService.ts` is 249 lines — well under the 500-line limit.

**7. No antipatterns detected**

- No `console.*` calls ✓
- No empty `catch` blocks ✓
- No default values introduced ✓
- No imports from `src/backend/` ✓
- British English used in comments (`defence`, `behaviour`) ✓
- Exports are functions, not const + arrow ✓
- Existing `callApi` and `dispatchAttempt` untouched ✓

---

## Files Read

1. `src/frontend/AGENTS.md` (249 lines)
2. `SPEC.md` (266 lines)
3. `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (382 lines)
4. `ACTION_PLAN.md` (557 lines)
5. `src/frontend/src/services/apiService.ts` (249 lines)
6. `src/frontend/src/services/apiService.spec.ts` (579 lines)
7. `docs/developer/frontend/frontend-testing.md` (729 lines)

---

## Conclusion

The production code is well-structured and correctly implements all Section 1 acceptance criteria. The only blocking issue is a **test-file TypeScript compilation error** (TS1016 in a local type alias) that should be a trivial fix. Two Improvements cover a JSDoc inconsistency and missing planned documentation entries.

**Recommended next step:** Fix the test type alias and resolve the two Improvements, then proceed to Section 2.
