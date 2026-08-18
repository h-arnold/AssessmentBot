# Pre-PR Review — feature/auth-service

- **Base branch:** main
- **Generated:** 2026-08-18T00:08:39Z
- **Regression gate:** PASS (no regressions) — 0 regressions, 0 new failures, 232 fixes. Note: 2 checks remain failing but are pre-existing in the baseline (backend `max-lines` warnings; 5 `classes-page.spec.ts` e2e timeouts), not regressions introduced by this branch.
- **Changed files:** 130 (8192 insertions, 2754 deletions)

```
 130 files changed, 8192 insertions(+), 2754 deletions(-)
```

## Verdict

**Fail** — four focuses reported Critical findings (de-sloppification, logging, security, error-handling), which must be resolved before merge.

## Focus areas

### Repo rule compliance

_No Critical findings._

- **[Improvement]** `src/backend/Utils/AuthService.js:124` (`checkAccess`) and `src/backend/y_controllers/AssignmentController.js:42` (`startProcessing`) carry behavioural defaults outside a constructor, contra AGENTS.md Core Principle 12 / Backend §8 (defaults belong in the module constructor).
- **[Improvement]** `src/backend/Utils/AuthService.js:70` (`isGroupMember`) lacks `Validate.requireParams`, inconsistent with the backend checklist.
- **[Nitpick]** Missing `/* global */` banners in `src/backend/Utils/AuthService.js` and `src/backend/Triggers/triggerHandler.js`.
- **[Nitpick]** `normalize` vs `normalise` identifier spelling at `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:277`.
- **[Nitpick]** Stale `FORBIDDEN` comment at `src/frontend/src/features/auth/useAuthorisationStatus.ts:18-21`.
- **[Nitpick]** `new ScriptAppManager()` at `src/backend/z_Api/z_apiHandler.js:25` — verify singleton pattern is respected.

#### Incidental (triage)

- `src/backend/Utils/ABLogger.js` uses `console.*` (it is the logging sink, by design).
- `RuntimeConstants` global assumption (pre-existing).
- `scripts/builder/eslint.config.js` widens lint coverage to `.opencode/plugins` — confirm intended.
- Deleted-file references (`logError.js`, `Utils/TriggerController.js`) are clean.

### KISS & DRY

_No Critical findings._

- **[Improvement (DRY)]** Six-hour cache-TTL constant + `hours×60×60` computation duplicated between `src/backend/Utils/AuthService.js:12,190-193` and `src/backend/RequestHandlers/CacheManager.js:6,133-134`.
- **[Improvement (DRY)]** `authGroupEmail: z.union([z.literal(''), z.email()])` hand-written in 3 schemas: `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts:72`, `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts:46`, `:72` — should be one shared schema.
- **[Improvement (DRY/robustness)]** `src/backend/Utils/AuthService.js:3` `/* global */` block lists 5 unused globals and omits 6 actually-used globals (`ConfigurationManager`, `Session`, `GroupsApp`, `CacheManager`, `Validate`, `RuntimeConstants`).
- **[Nitpick]** Redundant `|| ''` at `src/backend/z_Api/apiConfig.js:47`.
- **[Nitpick]** Internal `isGroupMember` should be `_isGroupMember` (`src/backend/Utils/AuthService.js:70`).
- **[Nitpick]** Ambiguous denial-log doc at `src/backend/Triggers/triggerHandler.js:91`.

#### Incidental (triage)

- `CacheManager.getCachedAssessment` (`src/backend/RequestHandlers/CacheManager.js:102-119`) re-implements `get`'s parse logic (`:26-40`).
- Double `requireParams` in `ReferenceDataController` update methods.
- `logError.js` deletion is consistent with DRY intent (responsibility absorbed by `ProgressTracker`).

### De-Sloppification

- **[Critical]** `CacheManager.remove()` — speculative dead method with no production caller. `src/backend/RequestHandlers/CacheManager.js:68-74`. `AuthService` (the only new production consumer) uses only `get()` (`AuthService.js:161`) and `put()` (`AuthService.js:187`); no production call site for `.remove(...)` exists (only its own definition and `tests/requestHandlers/CacheManager.test.js:302`). Violates core principle #3 (only fulfil the explicit request). Recommend removing `remove()` + its JSDoc + test until a real invalidation path appears.
- **[Improvement]** `getCachedAssessment`/`setCachedAssessment` duplicate the new generic `get`/`put`: `src/backend/RequestHandlers/CacheManager.js:102-119` and `128-141` vs `26-40` and `51-59`. The assessment methods re-implement the identical `try/catch` + `JSON.parse`/`JSON.stringify` + `ABLogger.error` glue instead of delegating.
- **[Improvement]** Duplicated error logging across the trigger boundary: `src/backend/Triggers/triggerHandler.js:106-110` and `src/backend/y_controllers/AssignmentController.js:151-153`, both calling `ProgressTracker.logAndThrowError` (`src/backend/Utils/ProgressTracker.js:247-250`) on the same message → the same user-facing message is written twice and rewrapped across two layers.
- **[Improvement]** `AuthStatusCard` denial branch unreachable in production with divergent denial copy: `src/frontend/src/features/auth/AuthStatusCard.tsx:16-19`; gate returns its own `Result` and never renders children when `!isAuthorised` (`src/frontend/src/features/auth/AppAuthGate.tsx:317-319`; `src/frontend/src/main.tsx:16-18`). Two different denial messages ("Permissions required" vs "You do not have access to this application.") for the same concept.
- **[Improvement]** `AuthService.checkAccess` JSDoc description and `@remarks` repeat the same content: `src/backend/Utils/AuthService.js:96-114` vs `115-123`.
- **[Nitpick]** `triggerHandler` `@remarks` duplicates inline numbered comments: `src/backend/Triggers/triggerHandler.js:29-51` vs `53-113`.
- **[Nitpick]** `TriggerController.createTimeBasedTrigger` hardcodes the retry-cleanup target `'triggerHandler'` instead of using its `functionName` parameter: `src/backend/Triggers/TriggerController.js:30-36`. Silent misbehaviour if a second handler is ever added.

#### Incidental (triage)

- `AssignmentController.startProcessing` has unreachable `toastMessage` after `logAndThrowError` — `src/backend/y_controllers/AssignmentController.js:52-59` and `67-77`.
- `mapErrorToUserMessage` redundant conditional — `src/frontend/src/errors/map-error-to-ui.ts:160-167` (both branches return the same string).
- `TriggerController.REQUIRED_SCOPES` duplicates the manifest scope list — `src/backend/Triggers/TriggerController.js:161-177` vs `src/backend/appsscript.json`.
- `errorCodes` const and `errorCodeToMessageMap` are two manually-synced enums with a runtime throw on drift — `src/frontend/src/errors/map-error-to-ui.ts:6-18` vs `29-53` and `61-67`.
- `AppAuthGate` state initialiser and `getStoredWarmupCycle` double-lookup `startupWarmupCycles` — `src/frontend/src/features/auth/AppAuthGate.tsx:42-53` vs `192-195`.

### Performance (Big-O)

_No Critical findings._

- **[Improvement]** `compactStore_` `shift()` loop is O(n²) on the per-request completion path: `src/backend/z_Api/requestStore.js:178-180` (called from `z_apiHandler.js:334`), bounded by `MAX_TRACKED_REQUESTS = 30`. Replace `shift()` with a single `slice`/`splice`.
- **[Improvement]** `checkAccess` re-reads and `JSON.parse`s the entire config blob on every request: `src/backend/Utils/AuthService.js:125` → `98_ConfigurationManagerClass.js:209-217, 258-262`. Constant-factor, but new per-request overhead (GAS execution means `configCache` is null each call).
- **[Improvement]** `_runAdmissionPhase` scans the request store 3–4 times just to log pruned entries: `src/backend/z_Api/z_apiHandler.js:256-266`; could fold into `pruneStaleEntries_`.
- **[Nitpick]** `getWarmupForbiddenMessage` runs O(k) on every render, unmemoised: `src/frontend/src/features/auth/AppAuthGate.tsx:167-174, 286`.

#### Incidental (triage)

- `setBackendConfig_` re-writes the full config store per field (O(k×S), pre-existing pattern).
- `triggerHandler` uses `bypassCache: true` (intended fail-closed).

### Logging rules compliance

- **[Critical]** `src/backend/z_Api/z_apiHandler.js:151-156` — the new auth-gate `catch` maps an unexpected auth-check exception to the `INTERNAL_ERROR` envelope via `_mapErrorToFailureEnvelope` **without logging it** to the GAS execution log. Violates `backend-logging-and-error-handling.md` §5.3 ("log once at the catch boundary") and §6.2. The sibling handler-failure path (`:189-198`) logs correctly; this one does not. Fix: add `ABLogger.getInstance().error(...)` before the `return`.
- **[Improvement]** `src/backend/Triggers/triggerHandler.js:97-103` × `src/backend/Utils/AuthService.js:175-181` — the same group-membership denial is audited twice (AuthService `warn` + triggerHandler `warn`), unlike the API path which logs once (§5.3).

#### Incidental (triage)

- `src/backend/z_Api/apiConfig.js:142` & `:161` — lossy `errorName`-only / message-only logs discard raw error detail (§5.3).
- `src/backend/z_Api/z_apiHandler.js:134` (+171/204/213) & `src/backend/Utils/ABLogger.js:159-162` — `ABLogger.debug` is ungated and logs `params` on every production request; for `setBackendConfig` this can include `apiKey` (§7/§8).
- `src/backend/z_Api/z_apiHandler.js:393` — `_success` uses `error` level for a defensive undefined-data warning; arguably `warn`.

### Frontend layout / design / accessibility

_No Critical findings._

- **[Improvement]** `src/frontend/src/features/auth/AppAuthGate.tsx:314` — loading state uses `<output>` (a calculation-result element) for a static "loading" message; exposes correct `role="status"` semantics but is a semantic mismatch and lacks a visible spinner. Suggest `<div role="status">` + `Spin`.
- **[Improvement]** `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx:26-34, 522-526` — field helper text is rendered outside `Form.Item` and pulled up with `marginTop: calc(-1 * var(--app-spacing-md))`, which can overlap Ant Design validation-error text. Recommend `Form.Item extra={helperText}`.
- **[Nitpick]** `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx:359` — redundant `aria-live="polite"` on an element already carrying `role="status"`.

#### Incidental (triage)

- `src/frontend/src/features/auth/AuthStatusCard.tsx:13-22` — `Card`+`Result` nesting with a single-child `Space`.

### Frontend data shape / schema consistency

_No Critical findings. Pass._

#### Incidental (triage)

- Frontend `errorCodes` (`src/frontend/src/errors/map-error-to-ui.ts:6-18`) omits `IN_USE` and `DEFINITION_STALE` documented in `transport-envelope.md:32-35,47-55` — pre-existing, not introduced by this branch.

### Backend data shape / schema consistency

_No Critical findings. Pass._

- **[Improvement]** `DEFAULTS.AUTH_GROUP_EMAIL` (`src/backend/ConfigurationManager/02_defaults.js:14`) is unused by `getAuthGroupEmail()` (which does not consult `DEFAULTS`), inconsistent with the `getJsonDbRootFolderId` pattern and `backend-config.md:36-38` — benign but worth tidying.

#### Incidental (triage)

- Bootstrap `getEmail()` ordering; `Validate.isEmail` "teacher email" log wording reused for group email; 21600s cache TTL is exactly the GAS maximum.

### Security & secrets

- **[Critical]** Bootstrap fail-open reaches `setBackendConfig` (and all protected methods) for every domain user → auth-group takeover. `src/backend/Utils/AuthService.js:128-145` fails open when `AUTH_GROUP_EMAIL` is empty; `src/backend/z_Api/z_apiHandler.js:147-160` applies that decision as the gate for everything except `getAuthorisationStatus`; `src/backend/z_Api/apiConfig.js:39,124-128` exposes `setBackendConfig` (which writes `authGroupEmail`) behind the same open gate. A domain member can set the auth group to one they control and become `admin`. Bounded by `webapp.access:"DOMAIN"` but not closed. Recommend restricting the open window (e.g. config-only writes behind a bootstrap token) or failing closed.
- **[Improvement]** `authGroupEmail` is only format-validated, not allowlisted (`src/backend/ConfigurationManager/01_configKeysAndSchema.js:104-120`).
- **[Improvement]** 6h auth cache with no revocation path retains privileges after group removal (`src/backend/Utils/AuthService.js:12,157-193`).
- **[Improvement]** Configured group email is disclosed to all members via `getBackendConfig` (`src/backend/z_Api/apiConfig.js:47`).
- **[Improvement]** `role` is returned but never enforced in `src/backend/z_Api/z_apiHandler.js` (fine now; flag for future admin-only methods).
- **[Improvement]** API key stored/transported/masked safely and never logged; no key _comparison_ exists in this diff, so timing-safe comparison is N/A here.

#### Incidental (triage)

- `src/backend/Utils/ABLogger.js` uses `console.*` (it is the logger itself; expected).
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js:14` JSDoc example contains a realistic API-key token that may trip secret scanners.
- `getAuthorisationStatus` gate exemption is safe (OAuth-status only).

### Test-coverage gaps

_No Critical findings._

- **[Improvement]** `src/backend/z_Api/z_apiHandler.js:147-160` (auth-gate `catch`, esp. `149-156`) — the fail-safe `INTERNAL_ERROR` branch (where `checkAccess` throws) has no test; `dispatcher-auth-gate.test.js` covers the grant path and the `allowed:false → FORBIDDEN` path only.
- **[Improvement]** `src/backend/y_controllers/AssignmentController.js:~107-110` — `processSelectedAssignment` now takes `{ assignmentId, definitionKey, courseId }` with a `Validate.requireParams` guard; `processSelectedAssignmentParams.test.js` covers only the happy path, no negative test for a missing/incomplete params object.

### Error-handling robustness

- **[Critical]** `src/backend/Triggers/triggerHandler.js:92-103` — the fail-closed `AuthService.checkAccess(...)` auth gate runs **outside** the `try/finally` (lines `106-113`) that owns trigger cleanup. If the auth check throws, `cleanupTrigger_()` is never called, leaking `trigger:<uid>:` Script Properties entries. Violates the file's own documented invariant ("cleanup … for any resolved, known triggerUid"). Fix: move the auth check inside a protected region.
- **[Improvement]** Double user-facing logging across the trigger boundary — `AssignmentController.processSelectedAssignment:151-153` and `triggerHandler.js:109-110` both call `ProgressTracker.logAndThrowError` on the same error (§5.3).
- **[Improvement]** `AuthService.isGroupMember` (`src/backend/Utils/AuthService.js:70`) has no `Validate.requireParams`, inconsistent with the rest of the backend.

#### Incidental (triage)

- `AssignmentController.startProcessing` unreachable `toastMessage` after `logAndThrowError` (pre-existing).
- `ConfigurationManager.safeParseConfigObject_` empty `catch` (`98_ConfigurationManagerClass.js:54`) silently swallows config parse errors.
- `_runCompletionPhase` (`src/backend/z_Api/z_apiHandler.js:200`) is outside any try/catch (pre-existing).

### Data-shape docs consistency

_No Critical findings. Pass — docs and code are in lockstep._

#### Incidental (triage)

- `backend-config.md:145/198` says an explicit empty `apiKey` clears the stored key, but frontend `BackendApiKeyWriteSchema` (`backendConfiguration.zod.ts:16-21`) rejects empty/blank, so that documented capability is unreachable from the frontend client.
- `transport-envelope.md:32-35/47-55` defines `DEFINITION_STALE` and `IN_USE` as valid error codes, but `map-error-to-ui.ts:6-18` omits both → generic fallback message.
- `transport-envelope.md:37` says `retriable` is "always present" while the quoted frontend schema at `:89` is `.optional()`.
- `backend-config.md:256` "blank → allowed" for `authGroupEmail` is slightly imprecise (blank only allowed when nothing stored).
- `request-store.md:195-208` and `trigger-context.md:121-129` known discrepancies already documented as Fragile/accepted.

## Decisions

### Repo rule compliance

- **[Improvement] `src/backend/Utils/AuthService.js:124` + `src/backend/y_controllers/AssignmentController.js:42`** — Decision: Fix now. Approach: move behavioural defaults into the respective module constructors (core principle #12) and remove the ad-hoc defaults at the call sites. Rationale: strict repo rule; both are small, localised changes.
- **[Improvement] `src/backend/Utils/AuthService.js:70`** — Decision: Fix now. Approach: add `Validate.requireParams` to `isGroupMember`. Rationale: consistency with the backend checklist.
- **[Nitpick]** Missing `/* global */` banners (`AuthService.js`, `triggerHandler.js`); `normalize`→`normalise` (`98_ConfigurationManagerClass.js:277`); stale `FORBIDDEN` comment (`useAuthorisationStatus.ts:18-21`); redundant `|| ''` (`apiConfig.js:47`); `isGroupMember`→`_isGroupMember` (`AuthService.js:70`); `createTimeBasedTrigger` hardcoded `'triggerHandler'` vs `functionName` param (`TriggerController.js:30-36`); redundant `aria-live` (`BackendSettingsPanel.tsx:359`); redundant `checkAccess` `@remarks` (`AuthService.js:115-123`). Decision: Fix now (batched). Approach: apply each trivial correction directly. Rationale: user wants the branch fully clean; all are low-risk.

### KISS & DRY

- **[Improvement] 6h cache-TTL dup — `src/backend/Utils/AuthService.js:12,190-193` / `src/backend/RequestHandlers/CacheManager.js:6,133-134`** — Decision: Fix now. Approach: extract a single TTL constant (single source of truth) shared by AuthService and CacheManager. Rationale: removes drift between two copies.
- **[Improvement] `authGroupEmail` zod union in 3 schemas — `backendSettingsForm.zod.ts:72`, `backendConfiguration.zod.ts:46,72`** — Decision: Fix now. Approach: extract one shared `authGroupEmailSchema`. Rationale: single source for the same validation rule.
- **[Improvement] `AuthService.js:3` incorrect `/* global */` block** — Decision: Fix now. Approach: correct the global list to match actual usage. Rationale: avoids false global assumptions.

### De-Sloppification

- **[Critical] `CacheManager.remove()` — `src/backend/RequestHandlers/CacheManager.js:68-74`** — Decision: Fix now. Approach: remove `remove()`, its JSDoc, and its unit test (`tests/requestHandlers/CacheManager.test.js:302`); reintroduce only when a real invalidation path exists. Rationale: speculative dead code (core principle #3).
- **[Improvement] `getCachedAssessment`/`setCachedAssessment` duplicate `get`/`put` glue — `CacheManager.js:102-119,128-141` vs `26-40,51-59`** — Decision: Fix now. Approach: collapse the assessment methods onto the generic `get`/`put` (preserve TTL behaviour; accept equivalent log text or pass a message param). Rationale: removes ~25 lines of duplicated glue.
- **[Improvement] Duplicated error logging — `triggerHandler.js:106-110` + `AssignmentController.js:151-153`** — Decision: Fix now. Approach: own the user-facing error log in exactly one place (make `processSelectedAssignment` let errors propagate unlogged and keep `triggerHandler` as the single logging boundary). Rationale: fixes double logging across the trigger boundary (also noted under error-handling and logging below).
- **[Improvement] Unreachable `AuthStatusCard` denial branch — `AuthStatusCard.tsx:16-19` / `AppAuthGate.tsx:317-319`** — Decision: Fix now. Approach: reduce `AuthStatusCard` to its reachable "Authorised" state and standardise on a single denial message. Rationale: dead UI branch + divergent copy.
- **[Improvement] `checkAccess` JSDoc description + `@remarks` duplicate — `AuthService.js:96-123`** — Decision: Fix now. Approach: fold the `@remarks` content into the description and delete the redundant block. Rationale: dedupe documentation.

### Performance (Big-O)

- **[Improvement] `compactStore_` `shift()` loop O(n²) — `src/backend/z_Api/requestStore.js:178-180`** — Decision: Fix now. Approach: replace `shift()` loop with a single `slice`/`splice`. Rationale: per-request completion path.
- **[Improvement] `checkAccess` re-parses full config every request — `AuthService.js:125`** — Decision: Fix now. Approach: avoid re-reading/`JSON.parse`ing the full config blob on each call where feasible. Rationale: new per-request overhead on the auth hot path.
- **[Improvement] `_runAdmissionPhase` scans store 3–4× — `z_apiHandler.js:256-266`** — Decision: Fix now. Approach: fold the pruning-log scan into `pruneStaleEntries_`. Rationale: reduces redundant iteration.

### Logging rules compliance

- **[Critical] Unlogged auth-gate catch — `src/backend/z_Api/z_apiHandler.js:151-156`** — Decision: Fix now. Approach: add `ABLogger.getInstance().error('Auth check failed.', { requestId, method: request.method }, error)` before the `INTERNAL_ERROR` return, matching the sibling handler-failure path (`:189-198`). Rationale: violates logging policy §5.3/§6.2.
- **[Improvement] Double denial audit — `triggerHandler.js:97-103` × `AuthService.js:175-181`** — Decision: Fix now. Approach: log the group-membership denial once, aligning the trigger path with the API path. Rationale: §5.3 one-boundary-log-per-layer.

### Frontend layout / design / accessibility

- **[Improvement] Loading `<output>` — `src/frontend/src/features/auth/AppAuthGate.tsx:314`** — Decision: Fix now. Approach: use `<div role="status">` + a spinner. Rationale: semantic mismatch + missing busy indicator.
- **[Improvement] Helper text negative-margin — `BackendSettingsPanel.tsx:26-34,522-526`** — Decision: Fix now. Approach: move helper text into `Form.Item extra={helperText}`. Rationale: avoids overlapping validation errors.

### Backend data shape / schema consistency

- **[Improvement] `DEFAULTS.AUTH_GROUP_EMAIL` unused — `src/backend/ConfigurationManager/02_defaults.js:14`** — Decision: Fix now. Approach: make `getAuthGroupEmail()` consult `DEFAULTS` (or drop the `DEFAULTS` entry). Rationale: consistency with `getJsonDbRootFolderId` and `backend-config.md:36-38`.

### Security & secrets

- **[Critical] Bootstrap fail-open → auth-group takeover — `AuthService.js:128-145` / `z_apiHandler.js:147-160` / `apiConfig.js:39,124-128`** — Decision: Defer + raise a GitHub issue. Approach: create a tracking issue; fix later by restricting the open window (e.g. config-only writes behind a bootstrap token) or failing closed. Rationale: user wants to build out more frontend management functionality before addressing this; residual risk bounded by `webapp.access:"DOMAIN"`.
- **[Improvement] `authGroupEmail` not allowlisted — `01_configKeysAndSchema.js:104-120`** — Decision: Defer with the bootstrap issue. Approach: add allowlist validation alongside the bootstrap fix.
- **[Improvement] 6h auth cache no revocation — `AuthService.js:12,157-193`** — Decision: Defer with the bootstrap issue. Approach: add a revocation/invalidation path.
- **[Improvement] Group email disclosed via `getBackendConfig` — `apiConfig.js:47`** — Decision: Defer with the bootstrap issue. Approach: restrict disclosure.
- **[Improvement] `role` returned but not enforced — `z_apiHandler.js`** — Decision: Defer with the bootstrap issue. Approach: enforce role for future admin-only methods.

### Test-coverage gaps

- **[Improvement] Auth-gate catch fail-safe untested — `z_apiHandler.js:147-160`** — Decision: Fix now. Approach: add a test where `checkAccess` throws, asserting the `INTERNAL_ERROR` envelope. Rationale: central security boundary.
- **[Improvement] `processSelectedAssignment` guard no negative test — `AssignmentController.js:~107-110`** — Decision: Fix now. Approach: add a negative test for a missing/incomplete params object. Rationale: `Validate.requireParams` behaviour is unverified.

### Incidental (triage) — decisions

- **[Incidental] `ABLogger.debug` logs `params` (may include `apiKey`) — `z_apiHandler.js:134` / `ABLogger.js:159-162`** — Decision: Wontfix. Rationale: debug-level logging only, not enabled in production; user accepts.
- **[Incidental] Dead-code/duplication batch** (unreachable `toastMessage` `AssignmentController.js:52-59,67-77`; redundant `mapErrorToUserMessage` conditional `map-error-to-ui.ts:160-167`; `REQUIRED_SCOPES` duplicating manifest `TriggerController.js:161-177`; two synced error enums `map-error-to-ui.ts:6-18 vs 29-53,61-67`; double `startupWarmupCycles` lookup `AppAuthGate.tsx:42-53 vs 192-195`; lossy `apiConfig.js:142,161` logs; double `requireParams` in `ReferenceDataController`; `getCachedAssessment` re-implements `get` `CacheManager.js:102-119`; `_success` error level `z_apiHandler.js:393`) — Decision: Fix now. Approach: apply each cleanup directly. Rationale: user wants these pre-existing slop items tidied as part of this PR.
- **[Incidental] Docs/other batch** (data-shape doc discrepancies: empty-apiKey clearing unreachable, `DEFINITION_STALE`/`IN_USE` omitted from frontend error map, `retriable` optional-vs-always, `blank authGroupEmail` wording; JSDoc realistic api-key token `98_ConfigurationManagerClass.js:14`; `safeParseConfigObject_` empty catch `98:54`; `_runCompletionPhase` outside try/catch `z_apiHandler.js:200`; builder eslint widening to `.opencode/plugins`; `AuthStatusCard` Card+Result nesting) — Decision: Fix now. Approach: correct docs and code where noted, and tidy the flagged items. Rationale: user wants full alignment of docs and code on this PR.
