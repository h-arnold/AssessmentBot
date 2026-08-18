# Review-Fix Delivery Plan (TDD-First)

## Read-First Context

This plan delivers the **"Fix now" decisions** recorded in the pre-PR review of the
`feature/auth-service` branch, except where explicitly re-scoped below (see "Decision
reconciliation"). There is **no `SPEC.md`** for this work: the user confirmed the
changes carry no real user-visible behaviour change (logging, dead-code removal, deduplication,
minor layout corrections, and test coverage), so product behaviour is unchanged.

1. Read `PR_REVIEW.md` (source of truth for findings and decisions — especially the
   **Decisions** section) before executing any section.
2. Read the module instruction files for every component touched:
   - Backend: `@src/backend/AGENTS.md`
   - Frontend: `@src/frontend/AGENTS.md`
3. Treat the review findings' `file:line` evidence as the authoritative defect list; do not
   re-litigate them.

## Scope and assumptions

### Scope

Corrective cleanup across backend and frontend, plus tests and docs, for the review findings
marked **Fix now**:

- Backend: CacheManager dead-code + dedup, AuthService cleanups, trigger error-handling +
  cleanup-leak fix, z_apiHandler logging + admission-phase simplification, requestStore O(n²)
  fix, apiConfig/ReferenceDataController/ConfigurationManager/AssignmentController tidy-ups.
- Frontend: AppAuthGate/AuthStatusCard/useAuthorisationStatus/BackendSettingsPanel layout +
  dead-code fixes, map-error-to-ui error-code additions + dedup, shared `authGroupEmail` schema.
- Tests: fill the two coverage gaps; update specs for removed/changed code.
- Docs: correct the minor data-shape doc discrepancies noted in the review.

### Decision reconciliation (user-confirmed deviations from PR_REVIEW)

Two findings recorded as **"Fix now"** in `PR_REVIEW.md` are deliberately re-scoped here, with
the user's explicit confirmation (recorded during planning):

1. **`AuthService.checkAccess` option-parameter defaults** (`PR_REVIEW.md` repo-rule decision) —
   **retained, not changed.** `{ bypassCache = false, requireConfigured = false, method = null } = {}`
   are per-call option overrides, not module-state defaults; core principle #12 governs module
   field defaults, not method option parameters. The related genuine default —
   `startProcessing(..., courseId = '')` — **is** fixed in Section 5 (made required + validated).

2. **`AuthService.checkAccess` per-request full config-blob parse** (`PR_REVIEW.md` performance
   decision) — **accepted as-is, not changed.** Config is persisted as a single JSON blob under
   one Script Properties key, so any read parses the whole blob; with GAS's stateless
   per-execution model this is already the minimum (one parse per request). Avoiding it would
   require a per-key config-storage refactor, which is out of scope.

### Out of scope

- **Security bootstrap fail-open + 4 related hardening items** — deferred to GitHub issue
  **#284** (`Security: bootstrap fail-open auth gate allows domain-member auth-group takeover`).
  Do **not** change `AuthService.checkAccess` fail-open behaviour, `01_configKeysAndSchema.js`
  allowlisting, cache revocation, group-email disclosure, or `role` enforcement in this plan.
- **Decomposing files already over the 550-line backend threshold** (e.g.
  `98_ConfigurationManagerClass.js` at 668 lines, `z_apiHandler.js` at 508 lines). The
  pre-existing `max-lines` lint warnings are not addressed here; changes in this plan are
  net-negative or trivial and do not add meaningful lines.
- **`ABLogger.debug` param logging (may include `apiKey`)** — decision recorded as Wontfix
  (debug-level only).
- **`AuthService.checkAccess` option-parameter defaults** and **per-request full config-blob
  parse** — see "Decision reconciliation" above (retained/accepted, not fixed).

### Assumptions

1. No user-visible behaviour changes; existing tests (except those explicitly updated for
   removed/changed code) must continue to pass unchanged.
2. British English is used in all comments and user-facing copy.
3. Backend files use the GAS concatenation model; guarded `module.exports` blocks remain the
   only Node test shim.
4. The GitHub issue #284 owns all deferred security hardening; this plan must not touch those
   code paths.

---

## Global constraints and quality gates

### Engineering constraints

- Keep changes minimal, localised, and consistent with repository conventions.
- Do not change method signatures that would ripple into `ALLOWLISTED_METHOD_HANDLERS` or the
  transport contract.
- Fail fast; never introduce empty `catch` blocks or silent error swallowing.
- Use British English in comments and documentation.
- Backend defaults belong in constructors (core principle #12) — when a default is removed from
  a method signature, validate the now-required parameter instead.

### TDD workflow (mandatory per section)

For each section:

1. **Red**: write failing tests for the section's acceptance criteria (delegate to
   `Testing Specialist` for Vitest/backend tests).
2. **Green**: implement the smallest change needed to pass (delegate to `Implementation`).
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

Each delegated handoff must include a `Mandatory Reading` section (the `@`-prefixed paths listed
per section below) and must return a `Files read` list containing every mandatory path. If any
mandatory file is missing from `Files read`, return the work to the same sub-agent and block
progression.

### Shared-helper planning gate (mandatory when helper changes are expected)

Where a section introduces helper reuse/extraction, the helper decision is recorded in that
section. Implementation must update the canonical docs status from `Not implemented` only if a
canonical doc entry is involved (see each section).

### LOC / file-separation note

Current line counts of the materially changed backend files:

| File                              | Current LOC | Projected | Action                                                      |
| --------------------------------- | ----------- | --------- | ----------------------------------------------------------- |
| `z_apiHandler.js`                 | 508         | ~512      | No split (net ±4; under 550 backend threshold)              |
| `CacheManager.js`                 | 147         | ~110      | Shrinks (dedup)                                             |
| `AuthService.js`                  | 215         | ~210      | Shrinks (JSDoc dedupe)                                      |
| `AssignmentController.js`         | 440         | ~430      | Shrinks (dead `toastMessage` removal)                       |
| `98_ConfigurationManagerClass.js` | 668         | ~668      | Trivial edits only; decomposition deliberately out of scope |

No file is projected to cross a separation threshold as a result of this plan.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend e2e tests (only if UX changed; none expected): `npm run test:frontend:e2e -- <target>`

---

## Section 1 — Backend: CacheManager dead-code removal + generic get/put dedup

### Objective

Remove the speculative `remove()` method and collapse `getCachedAssessment`/`setCachedAssessment`
onto the generic `get`/`put`, eliminating duplicated cache-read/write glue.

### Constraints

- Preserve the exact observable behaviour of `getCachedAssessment`/`setCachedAssessment`
  (best-effort writes, `null` on miss/parse error, same TTL).
- `generateCacheKey` is unchanged.
- Keep the guarded `module.exports` block at the end of the file.

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/backend/AGENTS.md`
- `@src/backend/RequestHandlers/CacheManager.js`
- `@tests/requestHandlers/CacheManager.test.js`
- `@docs/developer/backend/backend-logging-and-error-handling.md`

### Shared helper plan

1. Helper: cache-expiry TTL (hours → seconds).
   - Decision: `extend` — expose a single TTL-seconds value from `CacheManager` (the sole home;
     e.g. a module-level `CACHE_EXPIRY_SECONDS` constant or a static getter on the class),
     replacing both `CacheManager.setCachedAssessment` (`CACHE_EXPIRY_HOURS` at line 6) and
     `AuthService.checkAccess` (`AUTH_CACHE_EXPIRY_HOURS` at line 12 + inline
     `HOURS * MINUTES_PER_HOUR * SECONDS_PER_MINUTE` at lines 190-193).
   - Owning module/path: `src/backend/RequestHandlers/CacheManager.js` (decided, not optional).
     `AuthService` already resolves `CacheManager` as a global (`new CacheManager()`), so it
     references the `CacheManager` surface for the shared TTL.
   - Call-site rationale: AuthService and CacheManager currently duplicate both the `6` constant
     and the hours→seconds computation.
   - Relevant canonical doc target: none (code-level constant, not a data shape).
   - Planned doc status: `Not implemented` (n/a — no canonical doc entry).

### Acceptance criteria

- `CacheManager.remove()` and its JSDoc are deleted; no production or test code references it.
- `getCachedAssessment`/`setCachedAssessment` delegate to `get`/`put` (no duplicated
  `try/catch` + `JSON.parse`/`JSON.stringify` glue).
- The auth TTL and cache TTL share one source of truth.

### Required test cases (Red first)

1. Remove the `remove()` unit test case (currently at `tests/requestHandlers/CacheManager.test.js:302`).
2. Keep existing `getCachedAssessment`/`setCachedAssessment` behaviour tests green (they define
   the contract the dedup must preserve).

### Section checks

- `npm run test:backend -- tests/requestHandlers/CacheManager.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** The shared TTL source of truth is a module-level `const CACHE_EXPIRY_HOURS = 6;` derived to `const CACHE_EXPIRY_SECONDS = CACHE_EXPIRY_HOURS * RuntimeConstants.MINUTES_PER_HOUR * RuntimeConstants.SECONDS_PER_MINUTE;`, exposed as the static `CacheManager.CACHE_EXPIRY_SECONDS` for cross-module reuse (consumed by AuthService in Section 2). `remove()` and its JSDoc were deleted; `getCachedAssessment`/`setCachedAssessment` now delegate to `get`/`put` with the falsy-key early-return preserved. The three assessment-specific log-message assertions were aligned to the generic `get`/`put` messages (PR_REVIEW permits "equivalent log text"); the 25/25 CacheManager tests pass and `CacheManager.js` lints clean (0 errors, 0 warnings).
- **Deviations:** none.
- **Follow-up:** Section 2 (AuthService) consumes the shared TTL via `CacheManager.CACHE_EXPIRY_SECONDS`.

---

## Section 2 — Backend: AuthService cleanups

### Objective

Add `Validate.requireParams` to `isGroupMember`; rename `isGroupMember` to `_isGroupMember`
(private helper convention); fix the incorrect `/* global */` block; dedupe the `checkAccess`
JSDoc `@remarks`; and remove the duplicated TTL constant now that Section 1 provides a shared
source. `checkAccess`'s option-parameter defaults are deliberately retained (see Out of scope).

### Constraints

- Do **not** alter `checkAccess` fail-open/fail-closed behaviour (out of scope — issue #284).
- Do **not** move `checkAccess`'s option-parameter defaults to the constructor (see Out of scope).
- Singleton pattern (`getInstance`) and `BaseSingleton` contract unchanged.
- Renaming `isGroupMember` → `_isGroupMember` must update the internal call in `checkAccess`
  (line 174) and any test that references the method by name.

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/backend/AGENTS.md`
- `@src/backend/Utils/AuthService.js`
- `@tests/utils/authService/authService.test.js`
- `@docs/developer/backend/backend-logging-and-error-handling.md`

### Shared helper plan

1. Helper: cache-expiry TTL — `reuse` the shared source established in Section 1.
   - Owning module/path: as decided in Section 1.
   - Call-site rationale: remove `AUTH_CACHE_EXPIRY_HOURS` and the inline computation.

### Acceptance criteria

- `_isGroupMember` (renamed) calls `Validate.requireParams({ email, groupEmail }, '_isGroupMember')`.
- The `/* global */` block lists only actually-used globals. Verified set for `AuthService.js`:
  `BaseSingleton`, `ABLogger`, `ConfigurationManager`, `Session`, `GroupsApp`, `CacheManager`,
  `Validate`, and `RuntimeConstants` (the last only if the inline TTL computation remains after
  Section 1; drop it otherwise). The implementer must verify against final usage — do not copy a
  stale list.
- `checkAccess` JSDoc no longer repeats the `@remarks` content verbatim.
- The TTL references a shared source, not a second `6`.

### Required test cases (Red first)

1. `_isGroupMember` throws a `TypeError` when `email` or `groupEmail` is missing/null/undefined.
2. Existing AuthService tests remain green (behaviour unchanged); update any test that referenced
   `isGroupMember` by name.

### Section checks

- `npm run test:backend -- tests/utils/authService/authService.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Confirm the single remaining `checkAccess` JSDoc still documents fail-open bootstrap and the
  cache-key format (`auth:<groupEmail>:<email>`).

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the corrected `/* global */` list.
- **Follow-up:** denial-logging single-boundary is coordinated in Section 3.

---

## Section 3 — Backend: trigger error-handling, cleanup leak, and single log boundary

### Objective

Fix the Critical cleanup leak (auth check runs outside the `try/finally`), single-owner the
user-facing error log across the trigger boundary, log the group-membership denial exactly once,
use `functionName` in `createTimeBasedTrigger`'s retry path, and trim duplicated `@remarks`.

### Constraints

- `triggerHandler()` must clean up (`clearTriggerContext` + `deleteTriggerById`) for any
  resolved, known `triggerUid` on every path, including when `checkAccess` throws.
- `processSelectedAssignment` remains the method dispatched via `TRIGGER_METHOD_HANDLERS`.
- The user-facing error is logged at exactly one boundary.
- The group-membership denial is logged exactly once (align the trigger path with the API path
  per logging policy §5.3).

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/backend/AGENTS.md`
- `@src/backend/Triggers/triggerHandler.js`
- `@src/backend/Triggers/TriggerController.js`
- `@src/backend/y_controllers/AssignmentController.js`
- `@tests/triggers/triggerHandler.test.js`
- `@tests/triggers/triggerController.test.js`
- `@tests/controllers/assignmentController/assignmentController.startProcessingTriggerIntegration.test.js`
- `@docs/developer/backend/backend-logging-and-error-handling.md`

### Acceptance criteria

- `triggerHandler`'s `checkAccess` call is protected so `cleanupTrigger_()` runs if the auth
  check throws. **Target structure (avoid double-cleanup):** wrap the `checkAccess` call in its
  own `try/catch`; on `catch`, call `cleanupTrigger_(triggerController, event.triggerUid)` then
  rethrow (or log per policy). Keep the existing explicit cleanup on the denial path
  (`triggerHandler.js:97-103`) and the existing dispatch `try/finally` (`106-113`) unchanged, so
  no path cleans twice. Do **not** wrap auth-check-through-dispatch in a single `finally` that
  would also fire on the allow path.
- Only one layer calls `ProgressTracker.logAndThrowError` for the same dispatch error
  (recommended: `triggerHandler` owns it; `processSelectedAssignment`'s outer `catch` at
  `AssignmentController.js:151-153` lets errors propagate unlogged).
- The group-membership denial is logged once: remove the duplicate `triggerHandler` `warn`
  (`triggerHandler.js:98-100`), since `AuthService.checkAccess` already logs `AuthService:
access denied.` (`AuthService.js:176-181`) — matching the API path's single-log behaviour.
- `createTimeBasedTrigger` uses `functionName` (not the literal `'triggerHandler'`) in its
  `removeTriggers(...)` retry path and log message.
- `triggerHandler` `@remarks` no longer restates the inline numbered comments verbatim.

### Required test cases (Red first)

1. `triggerHandler`: a thrown `checkAccess` (mock `AuthService.checkAccess` to throw) still
   invokes cleanup (`clearTriggerContext` + `deleteTriggerById`) for a known `triggerUid`.
2. `processSelectedAssignment` negative test: missing/incomplete params object throws
   (`tests/controllers/assignmentController/assignmentController.processSelectedAssignmentParams.test.js`
   currently covers only the happy path).
3. `TriggerController.createTimeBasedTrigger`: the "too many triggers" retry path calls
   `removeTriggers` with the same `functionName` passed in.

### Section checks

- `npm run test:backend -- tests/triggers tests/controllers/assignmentController/assignmentController.processSelectedAssignmentParams.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Update `triggerHandler` JSDoc to keep the one non-obvious contract point: cleanup ownership
  (who cleans up on which path), now including the auth-throw path.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the chosen single log boundary.
- **Follow-up:** the same double-logging fix is consistent with the de-sloppification finding.

---

## Section 4 — Backend: z_apiHandler logging + admission-phase simplification + requestStore

### Objective

Fix the Critical unlogged auth-gate catch; fold the admission-phase prune-logging scan into
`pruneStaleEntries_`; replace the `compactStore_` `shift()` loop with a single splice/slice; and
correct the `_success` warning level.

### Constraints

- The auth-gate catch must log once at the transport boundary before returning the
  `INTERNAL_ERROR` envelope.
- `_runAdmissionPhase` must still log each pruned entry; just avoid the extra keys-before/after
  scan by having `pruneStaleEntries_` report what it pruned.
- `compactStore_` preserves oldest-completed-dropped-first ordering and active-entry preservation.

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/backend/AGENTS.md`
- `@src/backend/z_Api/z_apiHandler.js`
- `@src/backend/z_Api/requestStore.js`
- `@tests/api/apiHandler/dispatcher-auth-gate.test.js`
- `@tests/api/requestStore.test.js`
- `@docs/developer/backend/backend-logging-and-error-handling.md`

### Shared helper plan

1. Helper: `pruneStaleEntries_` return value.
   - Decision: `extend` — collect and return the list of pruned entry IDs (e.g. return
     `{ store, prunedIds }`) so `_runAdmissionPhase` logs them without a second scan.
   - Owning module/path: `src/backend/z_Api/requestStore.js`.
   - Call-site rationale: `_runAdmissionPhase` (`z_apiHandler.js:256-266`) currently scans
     `keysBefore` vs `keysAfterSet`; folding reporting into `pruneStaleEntries_` removes the
     redundant iteration. The only caller ignores the return value today (mutates in place), so
     changing the return shape is non-breaking.
   - Relevant canonical doc target: `docs/developer/data-shapes/request-store.md` — §6 currently
     documents `pruneStaleEntries_` as "Mutates and returns the store". Because the return shape
     changes, a planned-only entry marking this change `Not implemented` MUST be added to
     `request-store.md` before code changes begin, and reconciled to implemented during the
     documentation pass.
   - Planned doc status: `Not implemented` (firm — not conditional).

### Acceptance criteria

- The auth-gate catch logs `ABLogger.getInstance().error('Auth check failed.', { requestId, method: request.method }, error)` before returning.
- `compactStore_` no longer shifts from the front of an array in a loop.
- `_runAdmissionPhase` no longer builds `keysBefore`/`keysAfterSet`; prune logging comes from
  `pruneStaleEntries_`.
- `_success` uses `warn` (not `error`) for the defensive undefined-data message.

### Required test cases (Red first)

1. `dispatcher-auth-gate.test.js`: a test where `AuthService.checkAccess` **throws**, asserting
   the `INTERNAL_ERROR` envelope (covers the previously-untested fail-safe branch at
   `z_apiHandler.js:147-160`).
2. `requestStore.test.js`: `compactStore_` still drops the oldest completed entries (existing
   tests) — add/confirm a case with many completed entries to exercise the non-`shift` path.
3. `requestStore.test.js`: `pruneStaleEntries_` reports the pruned IDs (new contract).

### Section checks

- `npm run test:backend -- tests/api/apiHandler/dispatcher-auth-gate.test.js tests/api/requestStore.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Document the `pruneStaleEntries_` return-shape change in its JSDoc.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record whether `pruneStaleEntries_` returns pruned IDs or accepts a
  reporting callback.
- **Follow-up:** none.

---

## Section 5 — Backend: apiConfig, ReferenceDataController, ConfigurationManager, AssignmentController tidy-ups

### Objective

Apply the remaining backend Improvements/Nitpicks: redundant `|| ''`, lossy logs, double
`requireParams`, `DEFAULTS.AUTH_GROUP_EMAIL` wiring, `normalize`→`normalise`, `safeParseConfigObject_`
empty catch, JSDoc api-key token, and `startProcessing` default/unreachable-code removal.

### Constraints

- No change to config persistence shape or transport contract.
- The `normalize`→`normalise` rename touches both `01_configKeysAndSchema.js` (spec field) and
  `98_ConfigurationManagerClass.js:277`; update together.
- Do not change the "empty apiKey clears the stored key" backend behaviour (only fix docs in
  Section 10).

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/backend/AGENTS.md`
- `@src/backend/z_Api/apiConfig.js`
- `@src/backend/y_controllers/ReferenceDataController.js`
- `@src/backend/ConfigurationManager/01_configKeysAndSchema.js`
- `@src/backend/ConfigurationManager/02_defaults.js`
- `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `@src/backend/y_controllers/AssignmentController.js`
- `@tests/configurationManager/configurationManagerAuthGroupEmail.test.js`
- `@tests/api/backendConfigApi.test.js`

### Acceptance criteria

- `apiConfig.js:47` drops the redundant `|| ''`; `safeSet` and the aggregate save log include
  the raw error (not only `errorName`).
- `ReferenceDataController` update methods do not call `requireParams` twice for the same params.
- `getAuthGroupEmail()` already returns `''` when unset (via `getProperty`'s `|| ''`), so
  `DEFAULTS.AUTH_GROUP_EMAIL` (`02_defaults.js:14`) is genuinely unused. **Decided:** remove the
  unused `AUTH_GROUP_EMAIL` entry from `DEFAULTS` (do not wire `getAuthGroupEmail` to consult it
  — that adds nothing). Update any test referencing `DEFAULTS.AUTH_GROUP_EMAIL`.
- `normalize` renamed to `normalise` in the config spec (both files).
- `safeParseConfigObject_` no longer silently swallows parse errors (log + degrade or rethrow
  per logging policy — no empty catch).
- The `98_ConfigurationManagerClass.js` JSDoc example no longer contains a realistic API-key
  token.
- `AssignmentController.startProcessing` no longer carries a `courseId = ''` default (validate
  it instead); the unreachable `toastMessage` calls after `logAndThrowError` are removed.
- `TriggerController.REQUIRED_SCOPES` sync is enforced: add a backend test asserting
  `TriggerController.REQUIRED_SCOPES` matches the `oauthScopes` array in
  `src/backend/appsscript.json` (the runtime array and the manifest are two sources of truth;
  the test enforces their sync rather than attempting a runtime merge).

### Required test cases (Red first)

1. `configurationManagerAuthGroupEmail.test.js`: assert `getAuthGroupEmail()` returns `''` when
   unset (guards the `DEFAULTS.AUTH_GROUP_EMAIL` removal).
2. New/existing backend test: assert `TriggerController.REQUIRED_SCOPES` equals the
   `appsscript.json` `oauthScopes` array (scope-sync enforcement).
3. Existing `backendConfigApi.test.js` and `validateClassInfo.test.js` remain green after the
   `normalise` rename.

### Section checks

- `npm run test:backend -- tests/configurationManager tests/api/backendConfigApi.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None beyond the existing JSDoc edits.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record that `DEFAULTS.AUTH_GROUP_EMAIL` was removed and which tests
  were updated.
- **Deviations:** the `normalize`→`normalise` rename may surface in additional call sites;
  keep it contained to the config spec.

---

## Section 6 — Frontend: AppAuthGate + AuthStatusCard corrections

### Objective

Fix the loading-state element semantics, memoise the warm-up forbidden-message lookup, remove
the redundant `startupWarmupCycles` double-lookup, remove the unreachable `AuthStatusCard`
denial branch (standardising on a single denial message owned by the gate), and correct the
stale `FORBIDDEN` comment in `useAuthorisationStatus.ts`.

### Constraints

- Use Ant Design `Spin` (or equivalent) for the loading affordance with `role="status"`.
- Do not alter the warm-up orchestration flow or the FORBIDDEN precedence.
- `AuthStatusCard` retains its reachable "Authorised" state; the gate owns denial copy.

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/frontend/AGENTS.md`
- `@src/frontend/src/features/auth/AppAuthGate.tsx`
- `@src/frontend/src/features/auth/AuthStatusCard.tsx`
- `@src/frontend/src/features/auth/useAuthorisationStatus.ts`
- `@src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`
- `@src/frontend/src/features/auth/AuthStatusCard.spec.tsx`
- `@docs/developer/frontend/frontend-loading-and-width-standards.md`
- `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Acceptance criteria

- The loading state uses a semantic status element (not `<output>`) and shows a visible spinner.
- `getWarmupForbiddenMessage` is memoised (or otherwise not recomputed on every render).
- The `useState` initialiser no longer double-reads `startupWarmupCycles`.
- `AuthStatusCard` no longer renders the unreachable denial branch; the gate's denial message is
  the single source.
- The stale `FORBIDDEN` comment in `src/frontend/src/features/auth/useAuthorisationStatus.ts`
  (the `@remarks` block, lines 17-24) is corrected or removed.

### Required test cases (Red first)

1. `AppAuthGate.auth.spec.tsx`: loading state exposes `role="status"` and renders a spinner.
2. `AuthStatusCard.spec.tsx`: update to reflect the reduced (authorised-only) component — remove
   or repurpose the denial-state test.

### Section checks

- `npm run test:frontend -- AppAuthGate AuthStatusCard`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Confirm `AppAuthGate` `@remarks` still describe FORBIDDEN precedence accurately after the
  memoisation change.

### Implementation notes / deviations / follow-up

- **Follow-up:** Section 7 handles the BackendSettingsPanel and map-error-to-ui changes.

---

## Section 7 — Frontend: BackendSettingsPanel helper text + map-error-to-ui additions

### Objective

Move the helper text into `Form.Item extra`; remove the redundant `aria-live`; add `IN_USE` and
`DEFINITION_STALE` to the frontend error codes; and make the error-code message map exhaustively
typed so drift fails at compile time.

### Constraints

- Read `docs/developer/frontend/frontend-spacing-and-padding-standards.md` before touching the
  helper-text spacing (the negative-margin style must be removed).
- `IN_USE`/`DEFINITION_STALE` messages must match `transport-envelope.md` intent; no backend
  contract change.

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/frontend/AGENTS.md`
- `@src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `@src/frontend/src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `@src/frontend/src/errors/map-error-to-ui.ts`
- `@src/frontend/src/errors/map-error-to-ui.spec.ts`
- `@docs/developer/data-shapes/transport-envelope.md`
- `@docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Shared helper plan

1. Helper: error-code → message mapping.
   - Decision: `extend` (not `new`) — change `errorCodeToMessageMap` from a `Map` to a typed
     `Record<ErrorCode, string>` (or add a compile-time exhaustiveness check) so adding a code to
     `errorCodes` without a message fails type-checking, and collapse the redundant
     `instanceof Error` fallback branch in `mapErrorToUserMessage`.
   - Owning module/path: `src/frontend/src/errors/map-error-to-ui.ts`.
   - Call-site rationale: two manually-synced enumerations currently drift and throw at runtime.
   - Relevant canonical doc target: none (aligns code to `transport-envelope.md`, which is already
     correct).

### Acceptance criteria

- Helper text renders inside `Form.Item extra`; the negative-margin style is removed.
- No redundant `aria-live` on the element already carrying `role="status"`.
- `errorCodes` includes `IN_USE` and `DEFINITION_STALE` with messages; the mapping is
  exhaustively typed.
- `mapErrorToUserMessage` no longer has two identical fallback branches.

### Required test cases (Red first)

1. `map-error-to-ui.spec.ts`: `IN_USE` and `DEFINITION_STALE` map to non-generic messages.
2. `BackendSettingsPanel.spec.tsx`: helper text is associated with the `Form.Item` (not a
   separately positioned block).

### Section checks

- `npm run test:frontend -- map-error-to-ui BackendSettingsPanel`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Follow-up:** Section 8 extracts the shared `authGroupEmail` schema; Section 10 reconciles
  docs.

---

## Section 8 — Frontend: shared `authGroupEmail` schema extraction

### Objective

Extract a single `authGroupEmailSchema` and reuse it in the three places it is currently
hand-written.

### Constraints

- Behaviour-identical: read/write schemas remain `.optional()`; the form schema remains required.
- The shared schema must live where `backendSettingsForm.zod.ts` can import it without circular
  imports.

### Delegation mandatory reads (when sub-agents are used)

Implementation / Testing Specialist / Code Reviewer mandatory docs:

- `@PR_REVIEW.md`
- `@src/frontend/AGENTS.md`
- `@src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `@src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `@docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `@docs/developer/data-shapes/backend-config.md`

### Shared helper plan

1. Helper: `authGroupEmailSchema`.
   - Decision: `new` (small shared Zod schema) — `z.union([z.literal(''), z.email()])`.
   - Owning module/path: `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
     (exported), consumed by `backendSettingsForm.zod.ts`.
   - Call-site rationale: three hand-written copies of the same union at
     `backendConfiguration.zod.ts:46`, `:72`, and `backendSettingsForm.zod.ts:72`.
   - Relevant canonical doc target: `docs/developer/data-shapes/backend-config.md` (field 13) —
     already correct; no doc change, but verify field name/optionality still matches.

### Acceptance criteria

- Exactly one definition of the `authGroupEmail` union; the three call sites reference it.

### Required test cases (Red first)

1. Existing `backendConfiguration.zod.spec.ts` and `backendSettingsForm.zod.spec.ts` remain
   green (behaviour unchanged).

### Section checks

- `npm run test:frontend -- backendConfiguration.zod backendSettingsForm.zod`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Follow-up:** none.

---

## Section 9 — Backend incidental slop tidy-ups (error-handling robustness)

### Objective

**No additional work — folded into Section 5.** This section exists to preserve section
numbering referenced elsewhere. The incidental error-handling items it would have covered
(`safeParseConfigObject_` empty catch and the unreachable `toastMessage` after
`logAndThrowError`) are already specified as acceptance criteria in Section 5. Do not re-scan or
re-implement them here.

### Constraints

- If any error-handling item is discovered that is NOT already covered by Section 5, stop and
  record it as a follow-up rather than expanding this section silently.

### Acceptance criteria

- Section 5 acceptance criteria for `safeParseConfigObject_` and `toastMessage` removal are
  satisfied.

### Required test cases (Red first)

1. None — covered by Section 5.

### Section checks

- Confirm Section 5 checks passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** mark this section "no additional work".

---

## Regression and contract hardening

### Objective

Verify no regressions across backend and frontend after the fix sections, and confirm the two
coverage-gap tests are in place.

### Constraints

- Prefer focused test runs before broader validation.

### Acceptance criteria

- All touched backend suites, frontend suites, and lint commands pass.
- No new lint/type/test failures versus the review baseline.

### Required test cases/checks

1. `npm run test:backend -- tests/requestHandlers/CacheManager.test.js tests/utils/authService tests/triggers tests/api/apiHandler/dispatcher-auth-gate.test.js tests/api/requestStore.test.js tests/configurationManager tests/api/backendConfigApi.test.js tests/controllers/assignmentController`
2. `npm run test:frontend -- AppAuthGate AuthStatusCard map-error-to-ui BackendSettingsPanel backendConfiguration.zod backendSettingsForm.zod`
3. `npm run lint:backend && npm run lint:frontend`
4. `npm run test:frontend:e2e -- auth-status.spec.ts settings-backend.spec.ts` (only if any
   user-visible copy/layout changed; otherwise skip and note why).
5. Verify mandatory-read evidence (`Files read`) is complete for every delegated handoff.

### Section checks

- All commands above return green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record the final test/lint results.

---

## Documentation and rollout notes

### Objective

Reconcile the minor data-shape doc discrepancies noted in the review (incidental docs batch,
**Fix now**).

### Constraints

- Only modify documents relevant to the touched areas.
- Data-shape docs remain the canonical source; update them to match code (not vice versa).

### Acceptance criteria

- `docs/developer/data-shapes/backend-config.md` clarifies that the frontend does not support
  empty-`apiKey` clearing (backend honours it on raw calls) and that `authGroupEmail` blank is
  only allowed when nothing is stored.
- `docs/developer/data-shapes/transport-envelope.md` reconciles the `retriable` optionality note
  with the frontend `.optional()` schema.
- `PR_REVIEW.md` Decisions section is updated to reflect completion of "Fix now" items (or left
  as-is with a completion note).

### Required checks

1. Cross-reference the edited docs against the implementing code.
2. Confirm no planned shared-helper entry is left in an inconsistent `Not implemented` state.

### Optional `@remarks` JSDoc review

- Confirm no non-obvious design decision from the fix sections is lost; record `None` if not
  needed.

### Implementation notes / deviations / follow-up

- **Follow-up:** the deferred security work remains owned by GitHub issue #284.

---

## Suggested implementation order

1. Section 1 (CacheManager) — foundational shared TTL.
2. Section 2 (AuthService) — consumes shared TTL.
3. Section 3 (trigger error-handling / cleanup leak) — Critical fix.
4. Section 4 (z_apiHandler logging / requestStore) — Critical logging fix + coverage test.
5. Section 5 (apiConfig / ConfigurationManager / AssignmentController tidy-ups).
6. Section 6 (AppAuthGate / AuthStatusCard).
7. Section 7 (BackendSettingsPanel / map-error-to-ui).
8. Section 8 (shared `authGroupEmail` schema).
9. Section 9 (incidental backend tidy-ups — fold into Section 5 where overlapping).
10. Regression and contract hardening.
11. Documentation and rollout notes.
