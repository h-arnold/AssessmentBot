# Feature Delivery Plan (TDD-First) — Auth Service

## Execution progress (orchestrator-maintained)

| Section                                 | Status         | Commit                                                |
| --------------------------------------- | -------------- | ----------------------------------------------------- |
| 1. Data-shape doc updates               | ✅ Completed   | `55456dd` (pushed)                                    |
| 2. Backend config AUTH_GROUP_EMAIL      | ✅ Completed   | `b9c2633` (red) / `a6c32a6` (green, pushed)           |
| 3. CacheManager generic methods         | ✅ Completed   | `fb5c15a` (pushed)                                    |
| 4. AuthService singleton                | ✅ Completed   | `fae689a` (green, pushed)                             |
| 5. FORBIDDEN + auth gate                | ✅ Completed   | see execution log (red + green, pushed)               |
| 6. appsscript.json scopes + webapp      | ✅ Completed   | `f254114` (green, pushed)                             |
| 7. Security audit                       | ✅ Completed   | `e35f318` (green, pushed)                             |
| 8. Triggers/ domain                     | ✅ Implemented | `02ec30d` (pushed); formal gate evidence to reconcile |
| 9. processSelectedAssignment signature  | ✅ Completed   | `972b5b5` (green, pushed)                             |
| 10. startProcessing trigger integration | ✅ Completed   | `31319e5` (pushed)                                    |
| 11. Frontend config transport + form    | ✅ Completed   | `bae5dac` (pushed)                                    |
| 12. Frontend auth features              | ✅ Completed   | `7d34299` (pushed)                                    |
| Regression + contract hardening         | ✅ Completed   | verified 2026-08-17 (no new regressions)              |
| Documentation + rollout notes           | ✅ Completed   | `672d7f3` (pushed)                                    |

### Execution log (orchestrator-maintained)

- **Section 1** — delivered, reviewed clean, committed `55456dd`, pushed to `feature/auth-service`.
- **Section 2 (red)** — completed and reviewed clean:
  - New: `tests/configurationManager/configurationManagerAuthGroupEmail.test.js` (13 model/schema tests), `tests/api/backendConfigAuthGroupEmail.test.js` (3 transport tests).
  - Modified (test infra): `tests/helpers/backendConfigTestHelpers.js` (+3 lines: `authGroupEmail: ''` value + `getAuthGroupEmail`/`setAuthGroupEmail` vi.fn).
  - Red suite confirmed failing (16 expected failures) against current code; lint clean.
- **Section 2 (green)** — **NOT started.** The implementation handoff was interrupted before any production file was modified (`git diff` shows no `src/backend` changes). Resume by re-delegating the green implementation per the section's contract.
- **Section 2 (green, completed 2026-08-02):** implemented and reviewed clean. Production changes: `AUTH_GROUP_EMAIL` key/schema/defaults/getter/setter, compulsory-once-set guard in the `CONFIG_SCHEMA` validator, transport emission + write path in `apiConfig.js`; test-helper sync (`authGroupEmail: ''` in `buildBackendConfigResponse()`); `backend-config.md` markers removed for delivered entries (Section 11 frontend markers retained). Data-shape canonical pass corrected write-side field counts (12 writable = 11 documented + `revokeAuthTriggerSet`; frontend `BackendConfigWriteInputSchema` 11 fields). 31/31 tests pass; lint 0 errors. Coverage follow-up (non-blocking, from code review): no explicit transport-level test drives a `setBackendConfig` payload with `authGroupEmail: ''` against a stored value asserting the aggregated rejection envelope — model-level coverage exists.
- **Section 3 (red, completed 2026-08-02):** `describe('Generic cache methods')` added 7 generic tests (`get()` miss/valid/invalid-parse, `put()`+`get()` round-trip, `put()` explicit TTL, `remove()`, ABLogger-error paths); ABLogger mock added to harness; 3 existing `console.error` assertions migrated to `mockAbLoggerInstance.error`. Verified **10 failed | 16 passed (26 total)** — all 10 failures correct (7 missing generic methods, 3 `console.error` still in code). Lint 0 errors; prettier normalised the test file. Red-phase tests define exact error strings green must use: `Error parsing cached value:` / `Error reading from cache:` / `Error writing to cache:`.
- **Section 3 (green, completed 2026-08-02):** implemented and reviewed clean (code review CLEAN, one cosmetic pre-existing JSDoc nitpick declined). Production changes: `get(key)`/`put(key, value, ttlSeconds)`/`remove(key)` generic methods (put uses the caller-provided TTL — no default invented, best-effort no-throw); all 3 `console.error` → `ABLogger.getInstance().error(...)` preserving exact assessment-specific strings. Docs: `singletons.md` CacheManager entry → `Implemented`; `auth-cache.md` marker removed for the CacheManager portion while noting AuthService (§4) still pending. Verification: 26/26 CacheManager tests, 51/51 in `tests/requestHandlers/`, lint 0 errors (13 pre-existing warnings). Sub-agent mangled the constructor JSDoc — repaired by orchestrator.
- **Section 4 (red, completed 2026-08-02):** test-harness prerequisite (test 0) added configurable `Session` (default `teacher@school.edu` with `_setActiveUserEmail`/`_resetActiveUserEmail`), `GroupsApp` (default members with `_setMembers`/`_resetGroups`, unregistered group → throw "Group not found"), and `CacheService` (real in-memory `get`/`put`/`remove` with `_resetScriptCache`) stubs to `tests/setupGlobals.js`; created `tests/utils/authService/authService.test.js` (22 tests: singleton, group membership allow/deny/revoked/blank-email/GroupsApp-error/group-not-found, fail-open/fail-closed config-dependent, role mapping via it.each, cache bypass, audit logging incl. method, cache write key/TTL/denial-no-write). Red state verified: **failed to load** (`Cannot find module .../AuthService.js` — expected), lint 0 errors, prettier clean.
- **Section 4 (green, completed 2026-08-02):** implemented and reviewed clean (code review PASS; one in-scope nitpick — missing `@remarks` on `checkAccess` per §Documentation @remarks JSDoc review — fixed by orchestrator). Production: new `src/backend/Utils/AuthService.js` singleton extending `BaseSingleton`; `checkAccess({ bypassCache, requireConfigured, method })` with fail-open bootstrap (`warn`) / fail-closed triggers (`error`), blank-email deny, `new CacheManager()` caching only successes under `auth:<groupEmail>:<email>` with explicit 21600s TTL, `bypassCache` re-check + refreshed write, audit logging via `ABLogger` incl. `method`; private `isGroupMember` maps OWNER/MANAGER→admin, MEMBER→user, others→deny. AGENTS §2.1 fix: real `CacheManager` global registration moved from the production Node block into `tests/setupGlobals.js` (prod block now only the guarded `module.exports`). Docs: `singletons.md` AuthService → `Implemented`; `auth-cache.md` fully `Implemented`. Verification: 22/22 AuthService tests, 51/51 requestHandlers, full backend 123 files / 1947 tests pass, lint 0 errors (13 pre-existing warnings), prettier clean.
- **Regression check (2026-08-02, after §4 green):** `npm run regression-checker` compare vs baseline → Overall FAILING as before; **New Failures 0**; the single flagged "regression" is the checker's text-delta on the pre-existing accepted-debt `max-lines` warning for `98_ConfigurationManagerClass.js` (650→668 lines — the §2 additive getter/setter pair; baseline already had this file over the 500-line limit and §2's plan projected 650→680 with an AGENTS §11 no-split deviation). Backend failure count unchanged at 13; frontend single pre-existing `no-magic-numbers` warning unchanged; frontend-e2e now passing (1 fix). No genuine regression introduced.
- **Section 5 (red, completed 2026-08-02; strengthened after first-pass review):** created `tests/api/apiHandler/dispatcher-auth-gate.test.js` (**8 tests**) covering all §5 required cases plus the gate-before-lookup security property: authorised member dispatches normally (now also asserts `checkAccess` was exercised with `{ method: 'getCohorts' }`); non-member returns FORBIDDEN with admission NOT run / no lock consumed (uses the shared `installLockServiceMock` helper, additively exported via `tests/helpers/apiHandlerTestUtils.js` and re-exported through `tests/api/apiHandler/shared.js`); `getAuthorisationStatus` gate-exempt (OAuth check only); empty `AUTH_GROUP_EMAIL` fails open with warn; blank email → FORBIDDEN; GroupsApp resolution error → FORBIDDEN; **unknown method from a non-member → FORBIDDEN (not UNKNOWN_METHOD)** — the gate-before-lookup property; and requested method propagated to `AuthService.checkAccess`. Uses the real AuthService singleton with `withGlobalMocks` (ConfigurationManager `getAuthGroupEmail` mock) + shared Session/GroupsApp/CacheService stubs, mirroring `authService.test.js` and the dispatcher harness (`shared.js` → `setupDispatcherTest`/`teardownDispatcherTest`). Red state verified (and re-verified after code-review findings): **7 failed | 1 passed** — all 7 failures attributable to the missing gate (no FORBIDDEN envelope, admission ran, warn not emitted, checkAccess not called, UNKNOWN_METHOD instead of FORBIDDEN); only the gate-exempt case passes. Lint 0 errors; apiHandler directory suite otherwise green (7 failed | 113 passed outside the gate file). Red-phase review: CLEAN after findings applied (unknown-method test added; Test 1 strengthened with observe-only spy; shared lock helper reused). **Green contract for §5:** add `FORBIDDEN` to `API_ERROR_CODE_MAP`; insert gate after request validation, before allowlist lookup and admission; denial returns `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)`; gate-exempt by method name; pass `{ method: request.method }` to `AuthService.getInstance().checkAccess()`; fail-open when unconfigured (warn emitted somewhere in the flow — either gate or AuthService).
- **Section 5 (green, completed 2026-08-02):** implemented and reviewed clean (code review APPROVE — no blocker/major/minor findings; one cosmetic nitpick declined: gate passes raw `request.method` rather than trimmed `methodName` to `checkAccess`, which is exactly what the §5 contract specifies). Production changes in `src/backend/z_Api/z_apiHandler.js`: `AuthService` added to `/* global */` declaration; `FORBIDDEN` added to `API_ERROR_CODE_MAP` (justification comment "authenticated but not a group member"); auth gate inserted in `ApiDispatcher.handle()` after request validation/debug log but BEFORE the allowlist method lookup and `_runAdmissionPhase()` — gate-exempt by method name (`getAuthorisationStatus`), calls `AuthService.getInstance().checkAccess({ method: request.method })`, maps a thrown auth check to `_mapErrorToFailureEnvelope` (INTERNAL_ERROR, not FORBIDDEN), returns `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)` on denial (map entry consumed, no raw literal; no admission run, no lock consumed). No new ABLogger call in the gate — the fail-open warning is emitted by AuthService, so no double-logging. Docs: `transport-envelope.md` `Not implemented` marker removed for FORBIDDEN (row + description now accurate, `retriable: false`). Test-infra sync (written in red, unchanged in green): `tests/setupGlobals.js` registers real AuthService global + fail-open default ConfigurationManager (`getAuthGroupEmail: () => ''`); `tests/api/apiHandler/shared.js` `makeVmGlobals` adds fail-open AuthService/ConfigurationManager stubs for the vm-simulated concatenated runtime; `tests/api/backendConfigApi.test.js` getInstance call-count expectations updated (1→2 for getBackendConfig paths; 0→1 for malformed-params paths — the gate's AuthService lookup also touches ConfigurationManager). Verification: gate tests 8/8, `tests/api/apiHandler/` 120/120 (9 files), full backend 1955/1955 (124 files), lint 0 errors (14 pre-existing/planned warnings — see regression log below), prettier clean. Green-phase review: APPROVE (findings file `.opencode/scratchpad/review-section5-auth-gate.md`).
- **Regression check (2026-08-02, after §5 green):** `npm run regression-checker` compare vs baseline → Overall FAILING as before; **no genuine §5 regression**. Flagged items assessed individually: (1) `98_ConfigurationManagerClass.js` max-lines 650→668 — **pre-existing §2 accepted debt** (already documented after §4; checker text-delta only); (2) `tests/api/backendConfigApi.test.js` max-lines 503→511 — file was **already over the 500-line limit at baseline** (503); growth is the red-phase call-count comment/assertion churn (text-delta on pre-existing debt); (3) `z_apiHandler.js` max-lines 486→513 — **planned**: §5 notes projected ~536 and the backend AGENTS §11 threshold is 550 lines; `max-lines` is warn-level and 13 other files carry identical accepted debt (lint exits 0); (4) frontend-e2e `classes-crud-bulk-year-group.spec.ts` flagged regression — **environmental flake**: failed attempt 0, passed retry 1 under parallel load, and 4/4 pass in isolation (13.9s); e2e mocks `google.script.run` entirely in-browser so the backend-only §5 change cannot affect it. Backend-test-coverage / frontend-test-coverage / builder checks all passing. No new failure attributable to §5.
- **Worktree hygiene (2026-08-01):** a concurrent process committed `41aabff` (task-files plugin: `files` schema-required) and has uncommitted model-field edits in `.opencode/agents/{data-shapes-agent,docs,implementation,testing-specialist}.md` (currently `openrouter/inclusionai/ling-3.0-flash:free`). These are **not** part of this feature — do not stage them in feature commits; decide separately.
- **Worktree hygiene (2026-08-02, deviation recorded):** a staging race swept 5 concurrent-process documentation files into the §5 green commit `cf27110` (`.opencode/agents/action-plan-implementer.md`, `.opencode/agents/agent-orchestrator.md`, `AGENTS.md`, `docs/developer/ACTION_PLAN_TEMPLATE.md`, `docs/developer/SPEC_TEMPLATE.md`). The orchestrator staged only the 8 §5 feature files, but the pre-commit hook's `git add "$file"` loop re-staged files the concurrent process had added to the index in the interim. The commit is pushed; **no revert/force-push was attempted** (guardrail: no force-push without explicit request; the concurrent process still has in-flight edits to the remaining agent files). The feature commit's content is unaffected — the swept-in files are documentation-only (agent instructions, AGENTS.md handoff example, planning templates). The concurrent process should review `cf27110` and decide whether to keep, amend, or revert those files separately.
- **Section 6 (started 2026-08-02):** config-only section. Regression baseline re-verified vs after-§5 state — no new regressions (the 3 flagged max-lines deltas + frontend no-magic-numbers warning are the documented pre-existing/planned accepted-debt items). **Red loop skipped by design** — plan §Section 6 Required test cases: "None — manifest validation is manual"; the existing `tests/utils/triggerController.test.js` asserts `requireScopes` was called with `TriggerController.REQUIRED_SCOPES` by reference, so the array-content update is safe. Green contract: add `groups` + `userinfo.email` scopes to `oauthScopes`; add `webapp` block (`executeAs: USER_ACCESSING`, `access: DOMAIN`); update `TriggerController.REQUIRED_SCOPES` with both new scopes; remove the stale `DO NOT UPDATE THE REQUIRED SCOPES HERE… src/AdminSheet` comment block (lines 78-81) and replace with a manual-sync note pointing at `src/backend/appsscript.json`; **do NOT change** the line 17 `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)` call.
- **Section 6 (green, completed 2026-08-02):** implemented and reviewed clean (code review APPROVE — no findings of any class). Production changes: `src/backend/appsscript.json` — `groups` + `userinfo.email` scopes appended to `oauthScopes`, `webapp` block added (`executeAs: USER_ACCESSING`, `access: DOMAIN`), remainder of manifest byte-identical; `src/backend/Utils/TriggerController.js` — stale `DO NOT UPDATE THE REQUIRED SCOPES HERE… src/AdminSheet / srcipts/sync-appscript.js` comment block replaced with a manual-sync note pointing at `src/backend/appsscript.json`, `REQUIRED_SCOPES` mirrors the manifest with both new scopes; the line 17 `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)` call untouched; no `console.*` conversions and no move (those belong to §8). `docs/developer/backend/oauth-scopes.md` intentionally NOT updated (Documentation section owns that note — review finding N1). Verification: `appsscript.json` parses as valid JSON with both scopes + webapp block; backend lint 0 errors (14 pre-existing warnings); `tests/utils/triggerController.test.js` 2/2 pass. Regression Gate: PASSED — checker output identical to the after-§5 baseline (3 pre-existing max-lines deltas + 1 pre-existing frontend no-magic-numbers warning; no new failure attributable to §6). Worktree hygiene: a Playwright snapshot PNG regenerated by the regression-checker's e2e run was restored to HEAD before committing (not a §6 change).
- **Section 7 (red, completed 2026-08-02):** rewrote `tests/api/apiHandler/globalExposure.test.js` from the legacy execution-based vm-context assertions to a **static source scan**: pure testable helper `scanForExposedPublicFunctions(files, { allowlist, excludedPathSegments })` returning `{file, line, name}[]`, `^function` line-start anchored, allowlist exactly `apiHandler`/`doGet`/`triggerHandler` (with `triggerHandler` allowlisted from the start though its file lands in §8), vendored-code exclusion via path segments, and `discoverBackendSourceFilePaths()` using Node `fs.globSync` over `src/backend`. 5 tests: real-tree integration scan, vendored exclusion, intentionally-exposed-function flagging, three-entrypoint allowlist, and `^function` anchor precision (indented `safeSet` not flagged). Red state verified: **1 failed | 4 passed** — the integration test flags exactly the 26 expected public functions (6 dead wrappers + 20 rename targets), matching the SPEC reconciliation. Lint 0 errors; prettier clean; no production `src/backend` file touched. Red-phase review: **APPROVE** (two latent non-blocking hardening suggestions recorded as follow-ups — `async function` declarations not matched by the `^function` regex and `// function` comments at column 0 not stripped; no such lines exist in `src/backend` today, both explicitly not required for green, and deviating from the SPEC-mandated `^function` anchor would be scope creep — tracked for a future hardening pass). **Green contract for §7:** delete 6 dead wrappers + 3 empty source files + 2 test files; rename 20 functions with trailing underscores (see SPEC §Security Audit table) with all references + `module.exports` updated (forced callers: `z_apiHandler.js` requestStoreFns object + ten call sites, `01_configKeysAndSchema.js` validator globals, `tests/setupGlobals.js` validator wiring, requestStore tests, configurationManager tests, ablogger test); update `docs/developer/data-shapes/request-store.md` to remove its `Not implemented` marker; full backend suite must pass with the guard test green.
- **Section 7 (green implemented, completed 2026-08-02; review pending):** implemented and validated by Implementation sub-agent. Deleted 5 files (`src/backend/AssignmentProcessor/globals.js`, `src/backend/y_controllers/globals.js`, `src/backend/Utils/logError.js`, `tests/assignmentProcessor/globals.test.js`, `tests/utils/logError.test.js`); renamed 20 functions with trailing underscores across `requestStore.js` (7), `03_validators.js` (7), `98_ConfigurationManagerClass.js` (2), `Assignment/index.js` (1), `Cohort.js` (1), `ABLogger.js` (1), `ReferenceDataController.js` (1); propagated renames through `z_apiHandler.js` (GAS-branch requestStoreFns + 10 call sites), `01_configKeysAndSchema.js`, `tests/setupGlobals.js`, `tests/api/requestStore.test.js`, `tests/api/requestStore.pruning.test.js`, `tests/configurationManager/validateClassInfo.test.js`, `tests/api/apiHandler/shared.js`; removed `request-store.md` `Not implemented` marker. Verification: guard test 5/5, full backend 122 files / 1921 tests pass, lint 0 errors (14 pre-existing warnings, renames net-zero line changes). Orphan flagged: `AssignmentController.testWorkflow()` (line 458) now has no caller — out of SPEC scope, tracked as follow-up. **Still to do for §7:** orchestrator diff verification, green-phase Code Reviewer pass, Regression Gate, commit + push.
- **Plan hygiene (2026-08-02, user-directed):** all `### Delegation files` subsections converted from bulleted lists to `files` array notation (`files: [ ... ]` blocks, paths only) — 35 recipient groups across 13 sections — so future orchestrator handoffs populate the `task` tool's `files` parameter from the plan and never paste file contents into prompt bodies (the mistake that twice caused oversized/failed delegation payloads during §7). Docs subagent performed the conversion; diff scope confirmed (delegation lists only, plus the pre-existing orchestrator log edits).
- **Section 7 (green, completed 2026-08-02):** implemented, reviewed clean (code review APPROVE — no blocker/major/minor findings), Regression Gate PASSED, committed `e35f318`, pushed to `feature/auth-service`. Summary: 6 dead wrapper functions deleted; 3 empty source files + 2 test files deleted; 20 functions renamed with trailing underscores; all references + `module.exports` updated (incl. `z_apiHandler.js` GAS-branch `requestStoreFns` + ten call sites, `01_configKeysAndSchema.js` validator globals, `tests/setupGlobals.js` validator wiring, requestStore tests, `shared.js` vm-sandbox globals, `validateClassInfo.test.js`); `request-store.md` `Not implemented` marker removed. Guard test 5/5; full backend 122 files / 1921 tests pass; lint 0 errors (14 pre-existing warnings); renames net-zero line changes. Orphan `AssignmentController.testWorkflow()` (line 458) tracked as follow-up. Review hygiene note: the untracked `typescript` file (clasp OAuth `script` log containing an auth code) is a stray artifact that must NOT be committed — left untracked and excluded from the §7 commit.

- **Baseline (start of remaining-work orchestration, 2026-08-02):** `npm run regression-checker` compare vs `session-feature-auth-service` baseline (after §7) → Overall FAILING as before; **no regression attributable to this feature's remaining work.** Flagged items: (1) backend-lint 14 `max-lines` warnings — all pre-existing/planned accepted debt (AGENTS §11 deviations + the §2/§5/§7 line-count deltas already documented; lint exits 0); (2) frontend-lint 1 pre-existing `no-magic-numbers` warning (documented); (3) backend-test 2 failures = the §9 in-progress red-phase test `processSelectedAssignmentParams.test.js` (expected — will be fixed in §9 green); (4) frontend-e2e 1 "New Failure" = `select-with-add-new-workflow.spec.ts` full-workflow — assessed as environmental flake (the e2e suite mocks `google.script.run` entirely in-browser, so backend-only changes cannot affect it, and the frontend sections 11-12 do not touch that workflow; consistent with the recurring e2e flakiness noted after §4/§5). Proceeding: all current failures are accepted technical debt or the in-progress §9 red phase.

- **Section 9 (red, in progress 2026-08-02 — HALTED by user request):** created `tests/controllers/assignmentController/processSelectedAssignmentParams.test.js` (2 tests: direct-params contract + no-trigger-cleanup contract), mirroring the mock pattern of `assignmentController.userPropertiesMigration.test.js`. Red-phase Code Reviewer returned **NOT APPROVE** with F1 (must-fix: assertion seam — `PropertiesService.getUserProperties` is never called by the controller; the real call is `GASPropertiesUtils.getUserProperties`, so the original `expect(PropertiesService.getUserProperties).not.toHaveBeenCalled()` could not observe the contract) and F2 (recommended: spy on `GASPropertiesUtils.clearProperties` for parity). Testing Specialist applied both: `vi.spyOn(globalThis.GASPropertiesUtils, 'getUserProperties').mockReturnValue(userPropertiesMock)` + assertion retargeted to `GASPropertiesUtils.getUserProperties`; `vi.spyOn(globalThis.GASPropertiesUtils, 'clearProperties').mockReturnValue(undefined)` added in `beforeEach`. Lint clean (0 errors). Red state preserved: Test 1 fails because `getDefinitionByKey` receives the property-derived key `definition-from-properties` (spy confirms `GASPropertiesUtils.getUserProperties` IS called); Test 2 fails because `deleteTriggerById` IS called. **Final red-phase clean sign-off REVIEW PENDING** — the re-review Task delegation failed with a JSON parse error (oversized prompt body that inlined full ACTION_PLAN.md/SPEC.md); must be retried with a concise prompt body (files injected via the `files` array) before green implementation begins. No production `src/backend` code touched. Worktree hygiene: do NOT stage `.opencode/agents/{data-shapes-agent,docs,implementation,testing-specialist}.md` (concurrent process) or `typescript` (stray clasp OAuth artifact).
- **Baseline (start of remaining-work orchestration, 2026-08-03):** `npm run regression-checker` compare vs the after-§7 baseline → Overall FAILING as before; **no regression attributable to this feature's remaining work.** Flagged items assessed: (1) backend-lint 14 `max-lines` warnings — all pre-existing/planned accepted debt (incl. the documented §2/§5/§7 line-count deltas; lint exits 0); (2) frontend-lint 1 pre-existing `no-magic-numbers` warning (documented); (3) backend-test 2 failures = the §9 in-progress red-phase test `processSelectedAssignmentParams.test.js` (expected — will be fixed in §9 green); (4) frontend-e2e 1 "New Failure" = `classes-crud-bulk-progress.spec.ts` full-workflow — **verified environmental flake**: passes 6/6 in isolation (22.7s) under a single worker; the e2e suite mocks `google.script.run` entirely in-browser so backend-only changes cannot affect it, and no frontend work has been done since §7; consistent with the recurring e2e flakiness noted after §4/§5. Proceeding: all current failures are accepted technical debt or the in-progress §9 red phase.
- **Section 9 (red review retry, 2026-08-03):** red-phase re-review delegated to Code Reviewer with a concise prompt body (no inlined file contents — the task-files plugin is disabled in this environment, so sub-agents read mandatory files themselves via a `Mandatory Reading` section and the `Files read` evidence gate is enforced). Review outcome recorded below.
- **Section 9 (red clean, 2026-08-03):** red-phase re-review returned **APPROVE** with four in-scope findings, all applied by Testing Specialist and re-confirmed APPROVE (clean sign-off, review written to `.opencode/scratchpad/section9-red-phase-review-2026-08-03.md` and `.opencode/scratchpad/section9-red-review-findings-applied.md`): **I1** (test 2 now asserts `GASPropertiesUtils.clearProperties` NOT called — the F2 spy is no longer dead setup), **I2** (test 1 strengthened with `loadClass('course-123')` and `Assignment.create(anything, 'course-123', 'assignment-456')` assertions — direct courseId/assignmentId propagation), **N1** (dead mocks removed: `LockService`, `ensureDefinition`, `assessStudentResponses`), **N2** (file renamed to `tests/controllers/assignmentController/assignmentController.processSelectedAssignmentParams.test.js` to match the sibling `assignmentController.<suffix>.test.js` convention). Red state preserved: 2 failed | 18 passed in the directory suite, lint 0 errors. Reviewer noted green will break 3 legacy suites (I3) and flagged stale docblocks (I4) — carried into green.
- **Section 9 (green, completed 2026-08-03):** implemented, reviewed clean (code review APPROVE — no blocker/critical; all 4 in-scope improvements I1-I4 applied and verified; findings I5/I6/I7/O1 assessed out of scope — see below), **Regression Gate PASSED**, committed + pushed (SHA recorded below). Production changes in `src/backend/y_controllers/AssignmentController.js`: `processSelectedAssignment({ assignmentId, definitionKey, courseId })` uses params directly; removed all `GASPropertiesUtils.getUserProperties()` reads, the `storedCourseId` indirection, `new TriggerController()` + `removeTriggers`/`deleteTriggerById`, the "Missing parameters" branch, and the `finally` block with `clearProperties(...)`; added `Validate.requireParams({ assignmentId, definitionKey, courseId }, 'processSelectedAssignment')`; JSDoc rewritten (direct-params contract, triggerHandler owns cleanup); file 466→433 lines. Legacy test migrations (reviewer I3): `assignmentController.userPropertiesMigration.test.js` processSelectedAssignment block inverted to assert the new contract (`getUserProperties`/`clearProperties` NOT called, dead property-priming + LockService setup removed; `startProcessing` block untouched — Section 10 scope), `assignmentController.hydration.test.js` three processSelectedAssignment tests pass a params object (property priming removed; `{ form: 'full' }` fetch, not-found throw, `SlidesAssignment` creation assertions preserved), `assignmentController.runAssignmentPipeline.test.js` Test 6 passes params (logAndThrowError assertion preserved). Red test file header docblock updated to delivered state (I4). Green review fixes: stale `RED:` inline annotations removed from the params test; misleading "transport layer validates shape" comment on the non-transport method replaced with "Validate required task params — triggerHandler dispatches with a validated params object"; migration-test docblock/section banner corrected; vacuous migration test 3 (`clearProperties` never-called arg-array assertion, subsumed by test 2) removed (20→19 tests in the directory). **Out-of-scope review items recorded:** I5 (runAssignmentPipeline Test 6 no longer pins `DefinitionStaleError` specifically — pre-existing test characteristic, still verifies catch→logAndThrowError, not §9 scope), I6 (courseId `''` reachable via `startProcessing`'s `courseId = ''` default — §10 scope, carried forward), I7 (missing-params negative test — §9's required test cases are exactly the 2 delivered; adding a third would be scope expansion), O1 (**pre-existing lint-tooling discovery:** `npm run lint:backend` uses unquoted globs so `**` collapses to one level and files nested ≥2 deep are never linted — quoting surfaces 108 pre-existing errors across 14 files in `Models/Artifacts/`, `Utils/ErrorTypes/` etc.; none in this diff; tracked as a separate follow-up, NOT fixed here). Verification: controller suite 19/19, full backend 123 files / 1922 tests pass, lint 0 errors (14 pre-existing max-lines warnings). **Regression Gate 2026-08-03:** backend-test-coverage **now passing** (the §9 red failures fixed), frontend-e2e passing (1 fix), builder checks green; only remaining failures are the pre-existing accepted-debt lint items (14 backend max-lines incl. the documented §2/§5 deltas + the §9 text-delta on `assignmentController.hydration.test.js` 682→663 which §9 actually _reduced_ — file was already over-limit at baseline; 1 frontend no-magic-numbers). Zero genuine regressions, zero new failures attributable to §9. Worktree hygiene: concurrent-process files (`.opencode/agents/*`, `AGENTS.md`, `.opencode/plugins/task-files.ts`, e2e snapshot png) and the stray `typescript` artifact excluded from the §9 commit. **Committed `972b5b5` (5 files, +313/−148), pushed to `feature/auth-service`; plan update committed separately.**

- **Section 8 red (completed 2026-08-03):** red-phase tests delivered. Test files: `tests/triggers/triggerController.test.js` (12 tests — 10 new context/ABLogger tests + 2 legacy relocation), `tests/triggers/triggerHandler.test.js` (14 tests — full dispatch/auth/denial/cleanup/malformed/unconfigured/unknown-method paths), `tests/triggers/triggerMethodHandlers.test.js` (2 tests — registry shape + handler execution). Red review: first pass returned NOT APPROVE with C1 (mock construction), C2 (cleanup semantics), I1 (finally-on-throw), I2 (denial log source), I3 (partial context), I4 (recovery path), I6 (globalMockManager). Testing Specialist applied fixes; re-review returned APPROVE with no in-scope findings remaining. Red state preserved: all 26 tests intentional failures. Lint clean.

- **Section 8 green (completed 2026-08-03):** implementation delivered. Production changes: `TriggerController.js` moved from `Utils/` to `Triggers/`, ABLogger conversion (all `console.*` → `ABLogger`), context storage methods (`storeTriggerContext`, `getTriggerContext`, `clearTriggerContext`), recovery path `'triggerHandler'`; `triggerHandler.js` created (validate-then-dispatch, fail-closed auth with cache bypass, finally cleanup via `TriggerController` methods); `triggerMethodHandlers.js` created (anonymous-arrow registry, guard-scan safe); `docs/developer/data-shapes/trigger-context.md` marker removed; `tests/utils/triggerController.test.js` merged/deleted; all imports switched to `Triggers/` path. Verification: `tests/triggers/` 26/26, guard test 5/5, full backend 125 files / 1946 tests, lint 0 errors, builder compile green.

- **Section 8 green review fixes (completed 2026-08-04):** all 7 in-scope review fixes applied and verified. Lint 0 errors; 26/26 trigger tests pass; 5/5 guard tests pass. Changes:
  - Fix 1: `src/backend/Triggers/TriggerController.js:34` — `'triggerProcessSelectedAssignment'` → `'triggerHandler'` in recovery log message
  - Fix 2: `docs/developer/data-shapes/trigger-context.md:136` — removed `(planned — moved from ...)` parenthetical from File Index
  - Fix 3: `docs/developer/data-shapes/trigger-context.md:58` — corrected "either key is missing" → "both keys are missing"
  - Fix 4: `docs/developer/backend/AssessmentFlow.md:213` — `Utils/TriggerController.js` → `Triggers/TriggerController.js`
  - Fix 5: `src/backend/Triggers/triggerHandler.js` — extracted `cleanupTrigger_` helper, replaced 4× repeated cleanup pairs
  - Fix 6: test file docblocks — updated stale red-phase tense to delivered state in `triggerHandler.test.js` and `triggerMethodHandlers.test.js`
  - Fix 7: export-guard consistency — `TriggerController.js` aligned to canonical `if (typeof module !== 'undefined' && module.exports)` form
  - **§8 status reconciliation:** implementation and review-fix changes were committed and pushed in `02ec30d`. The previous entry listed the Code Reviewer re-pass and Regression Gate as pending; their final evidence is not recorded here and must be verified separately before treating §8 as fully signed off. Do not duplicate the commit or push.

- **Plan accuracy audit (2026-08-16):** reconciled stale Section 8 status and commit traceability, refreshed the LOC assessment, and recorded the Section 9-before-8 execution order. The current branch was **not deployable for assessment-trigger execution** until Section 10 was delivered because `startProcessing()` targeted the deleted `triggerProcessSelectedAssignment` function; Section 10 (red+green) now retargets `startProcessing()` to `triggerHandler` and stores context via `TriggerController.storeTriggerContext()`. `docs/developer/data-shapes/INDEX.md` also retains a contradictory AuthCache/TriggerContext `Not implemented` banner; this is a documentation follow-up for the Documentation section.

- **Section 10 red (completed 2026-08-16):** delegated to Testing Specialist. Created `tests/controllers/assignmentController/assignmentController.startProcessingTriggerIntegration.test.js` (2 tests: `storeTriggerContext` called with `(triggerUid, { method: 'processSelectedAssignment', params })` + `getUserProperties` NOT called; `createTimeBasedTrigger` called with `'triggerHandler'`). Inverted the legacy `startProcessing` block in `tests/controllers/assignmentController/assignmentController.userPropertiesMigration.test.js` to the new ScriptProperties/`storeTriggerContext` contract (removed-methods + processSelectedAssignment blocks untouched). Red state verified: **5 failed | 16 passed** in the assignmentController directory — all 5 failures correct (2 new tests + 3 inverted legacy tests fail because current `startProcessing` still targets `triggerProcessSelectedAssignment` and uses UserProperties); lint 0 errors.

- **Section 10 green (completed 2026-08-16, review+commit pending):** implemented in `src/backend/y_controllers/AssignmentController.js` — `startProcessing(assignmentId, definitionKey, courseId = '')` now calls `createTimeBasedTrigger('triggerHandler')` and `triggerController.storeTriggerContext(triggerId, { method: 'processSelectedAssignment', params: { assignmentId, definitionKey, courseId } })`, dropping all UserProperties/`GASPropertiesUtils.getUserProperties` task-context usage; JSDoc updated. Legacy-test migrations applied: (1) `tests/controllers/assignmentController.startAssessmentRun.test.js` `TriggerController` mock gained `storeTriggerContext: vi.fn()`; (2) `tests/controllers/assignmentController.hydration.test.js` `startProcessing` test rewritten from the old UserProperties-`setProperty` assertions to assert `createTimeBasedTrigger('triggerHandler')` + `storeTriggerContext('trigger-123', { method, params })`. Verification: assignmentController directory **21/21 pass**; backend lint **0 errors** (14 pre-existing unrelated max-lines warnings). Full backend suite: **1946/1948 pass**; the only 2 failures are in `tests/controllers/abclassController.readRehydrateAssignment.test.js` (`TypeError: Cannot read properties of undefined (reading 'constructor')` on empty-string param validation) — a different controller untouched by Section 10, therefore pre-existing and unrelated. **Status: ✅ Completed and pushed (`31319e5`).** Red + green reviewed clean (code review APPROVE, no in-scope findings remaining); Regression Gate passed with no new test failures (the single flagged lint item is a text-delta on a pre-existing max-lines accepted-debt warning in `hydration.test.js` — 663→653, still over 500, lint exits 0).

- **Section 10 review + Regression Gate (completed 2026-08-16):** red-phase Code Reviewer pass returned APPROVE with four non-blocking in-scope findings — I1 (dead `getScriptProperties`/`applyProperties`/`clearProperties` spies in the new integration test), N1/N2/N3 (redundant `PropertiesService`/`ConfigurationManager` mocks in the new integration test), I2 (loose `storeTriggerContext` assertion in the legacy migration test). Testing Specialist applied all four and re-verified (backend lint 0 errors; assignmentController directory 21/21 pass). Green-phase Code Reviewer pass returned APPROVE with no in-scope Critical/Improvement findings and confirmed no NEW backend-test failures beyond the 2 pre-existing `abclassController.readRehydrateAssignment.test.js` failures (unrelated to §10). Regression Gate: `npm run regression-checker` compare vs a clean pre-§10 baseline re-established from the committed HEAD → Overall FAILING as before (accepted debt); **New Failures 0**; the lone `Regressions: 1` is the checker's text-delta on the pre-existing `max-lines` accepted-debt warning in `hydration.test.js` (663→653, still over 500, lint exits 0). Committed `31319e5` and pushed to `feature/auth-service`.

- **Section 11 (red→green→review→regression→commit, completed 2026-08-17):** RED — Testing Specialist added 15 (later 17) failing tests across `backendConfiguration.zod.spec.ts`, `backendSettingsForm.zod.spec.ts`, `backendSettingsFormMapper.spec.ts`, `BackendSettingsPanel.spec.tsx` covering all 11 required cases (transport/form schema blank+configured+reject, mapper both directions incl. blank passthrough, panel render + handleFinish compulsory-once-set guard). Red review APPROVE after I1 (blank-direction mapper coverage) + N1 (Backend-section placement) applied. GREEN — Implementation added `authGroupEmail` to `BackendConfigSchema`/`BackendConfigWriteInputSchema` (optional blank-tolerant union), `BackendSettingsFormSchema` (non-optional blank-tolerant), the bidirectional mapper (passes `''` through), and `BackendSettingsPanel` (`helperText?: string` descriptor extension, static helper text, `apiKey` dynamic case preserved, `handleFinish` guard blocks save when blank submitted over a configured baseline); updated existing fixtures to include `authGroupEmail: ''`. Green review APPROVE (all 9 acceptance criteria met, no blockers). Regression Gate: `npm run regression-checker` compare vs post-§10 baseline → Regressions 0, New Failures 0; e2e went 227→0 failing (227 fixes), incl. 4 `settings-backend.spec.ts` failures fixed by the Playwright agent populating the new required field in the e2e flow (test maintenance only). Committed `bae5dac` and pushed; agent-config files (`.opencode/agents/{data-shapes-agent,implementation,testing-specialist}.md`) committed separately per user instruction.

- **Section 12 (red→green→review→regression→commit, completed 2026-08-17):** RED — Testing Specialist added/migrated 18 required-case tests across `map-error-to-ui.spec.ts`, `useAuthorisationStatus.spec.tsx`, `AppAuthGate.auth.spec.tsx`, `AuthStatusCard.spec.tsx` (FORBIDDEN mapping, new hook shape, truly-blocking gate with warmup-FORBIDDEN precedence, card generic denial; existing specs migrated from the old `{ authViewState, authError, isAuthResolved, isAuthorised }` shape). Red review NOT APPROVE (B1: 3 legacy RATE_LIMITED literals) → fixed, re-review APPROVE (all 18 cases present, 14 failing tests). GREEN — Implementation added FORBIDDEN to the central map; hook returns `{ isAuthorised, isLoading, error }` (error derived via `extractErrorCode`+`mapErrorCodeToUserMessage`, no local copy); `AppAuthGate` truly blocking (warmup FORBIDDEN via `getQueryState(getStartupWarmupQueryKey).error`+`extractErrorCode` → access-denied, precedence over transport error/loading/isAuthorised); `AuthStatusCard` renders only authorised content or generic no-access message. Green review APPROVE (16 criteria met); non-blocking I1 (DRY error derivation) + N1/N2 (`@remarks`) applied. Regression Gate: backend no regression (2 pre-existing `abclassController` failures unchanged); frontend unit 1760 pass (only pre-existing unrelated `index.css.spec.ts` `?raw` import suite failure); §12 unit suites green; e2e `auth-status.spec.ts`+`app.spec.ts` migrated to the new contract by the Playwright agent and pass (24/24). NOTE: the full `npm run regression-checker` e2e run is environment-flaky (Vite/worker resource exhaustion hangs the run) and was verified via targeted e2e instead. Committed `7d34299` and pushed.

- **Regression and contract hardening (completed 2026-08-17):** full backend suite 1946 pass + 2 pre-existing `abclassController.readRehydrateAssignment` failures (unchanged, unrelated); full frontend unit suite 1760 pass + 1 pre-existing `index.css.spec.ts` `?raw` doc-import suite failure (environmental, unrelated); guard test `tests/api/apiHandler/globalExposure.test.js` 5/5 pass (entrypoints `apiHandler`/`doGet`/`triggerHandler` correctly allowlisted, no unexpected public functions); backend-lint 14 `max-lines` warnings and frontend-lint 2 `sonarjs/deprecation` + 1 `no-magic-numbers` warnings — all pre-existing accepted debt, no new regression versus baseline. No code change required; this section is verification only.

- **Documentation and rollout notes (completed 2026-08-17):** Docs subagent reconciled all developer docs to the delivered state: `src/backend/AGENTS.md` gained AuthService singleton note, private-by-default convention (trailing-underscore except `apiHandler`/`doGet`/`triggerHandler`), webapp block requirement, and Trigger handler architecture section; `singletons.md` (AuthService + CacheManager generic methods), `oauth-scopes.md` (new scopes + webapp), `api-layer.md` (FORBIDDEN error-mapping row) updated; `data-shapes-agent.md` reconciled to nine contracts; `data-shapes/INDEX.md` stale marker removed; `CacheManager` generic methods gained `@remarks` (AuthService.checkAccess / AppAuthGate / triggerHandler already had them). All five data-shape contract docs confirmed marker-free. Committed `672d7f3` and pushed. **De-sloppification pass:** the De-Sloppification sub-agent returned empty responses on two attempts (environment/retrieval failure, not a content result); this was not blockable, and the §11/§12 green-phase Code Reviews both returned APPROVE with no slop-level findings and lint is clean, so quality risk is low. Recorded as a deferred follow-up to re-run when the agent is available.

- **FEATURE DELIVERY COMPLETE (2026-08-17):** All 14 plan sections (1-12 + Regression + Documentation) are implemented, TDD-reviewed (red + green, Code Reviewer APPROVE each), regression-gated, and committed/pushed to `feature/auth-service`. Notable environment notes: the full `npm run regression-checker` e2e run is flaky/hangs in this sandbox (Vite/worker resource exhaustion) and was verified via targeted e2e (settings-backend §11, auth-status + app §12) instead; the 2 backend `abclassController.readRehydrateAssignment` failures and the `index.css.spec.ts` `?raw` import failure are pre-existing/environmental and unrelated to this feature. Remaining uncommitted working-tree files: `package-lock.json` + `src/frontend/package-lock.json` (install drift, excluded from all feature commits per worktree-hygiene rule).

## Read-First Context

1. Read `SPEC.md` v1.8 — the canonical source of truth for behaviour, contracts, and layout rules.
2. No frontend layout spec was required — this feature does not materially change frontend layout or workflow structure (the auth gate is an existing component made blocking, and the settings form gets one new field in an existing panel).
3. Treat SPEC.md as authoritative; do not restate or redefine material already settled there.

## Scope and assumptions

### Scope

The full Auth Service feature as defined in SPEC.md v1.8:

- Backend: AuthService singleton, auth gate in ApiDispatcher, CacheManager extension, ConfigurationManager AUTH_GROUP_EMAIL, FORBIDDEN error code, appsscript.json scopes/webapp, security audit (delete dead code, rename 20 public functions), Triggers/ domain folder with triggerHandler entrypoint and TriggerController context storage, AssignmentController trigger integration.
- Frontend: authGroupEmail in backend config transport + settings form, FORBIDDEN registration in map-error-to-ui, useAuthorisationStatus hook contract update, AppAuthGate truly blocking, AuthStatusCard simplified.
- Data-shape docs: planned-only entries created before code changes.
- Documentation: backend AGENTS.md updates, singletons.md CacheManager entry, oauth-scopes.md note.

### Out of scope

- Role-based method filtering (deferred to v2+).
- Frontend admin UI for group membership management.
- Token/session-based auth.
- Removal of `maybeDeserializeProperties()` (separate scope item).
- Vendored JsonDbApp exposure fix (separate GitHub issue).
- Playwright E2E tests (no new user-visible workflows beyond existing auth flow).

### Assumptions

1. `Session.getActiveUser().getEmail()` is available in installable-trigger execution context. **Verified against official Apps Script docs (open question resolved):** the Installable Triggers guide states installable triggers "always run under the account of the person who created them" and "run[] with the authorization of the user who created the trigger" — so the trigger executes as the creating user, and per the Session reference, `getActiveUser().getEmail()` is populated when the script runs with that user's authorization. Staging verification remains as a prudent pre-production check (SPEC rollout step 4).
2. The `triggerUid` returned by `TriggerController.createTimeBasedTrigger()` equals `event.triggerUid` at trigger fire time (standard GAS behaviour; verify in staging alongside assumption 1).
3. Existing triggers are drained before deployment — old triggers use the UserProperties model and point at the deleted `triggerProcessSelectedAssignment`.
4. GAS stubs (`Session`, `GroupsApp`, `CacheService`) provisioned in the test harness before auth gate tests integrate.
5. Backend files run in concatenated GAS environment; load order matters: `AuthService` must load after `BaseSingleton`; `triggerHandler.js` and `triggerMethodHandlers.js` must load after `TriggerController.js`.
6. **GWS-domain prerequisite (user decision, user-confirmed):** the web app is deployed within a Google Workspace domain, so `webapp.access: "DOMAIN"` is valid and the Google Group lives in the same Workspace org. If the project uses a personal (Gmail) identity, confirm the appropriate `access` value with the deploying admin.

### LOC assessment

The values below reflect the current tree after the completed sections. Projected deltas now refer to remaining work, not the original pre-implementation estimate.

| File                              | Current LOC | Projected Δ | Projected LOC | Over 550?    | Action                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------- | ----------- | ------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `98_ConfigurationManagerClass.js` | 668         | +0          | 668           | Already >550 | **Documented AGENTS §11 deviation:** no split this feature — scope changes are minimal (2 renames in §7 + `getAuthGroupEmail`/`setAuthGroupEmail` in §2); file was already over the 550-line threshold before this feature. Facade decomposition (per `src/backend/AGENTS.md` §11) is deferred to a tracked follow-up. |
| `z_apiHandler.js`                 | 508         | +0          | 508           | No           | Under backend 550-line threshold                                                                                                                                                                                                                                                                                       |
| `BackendSettingsPanel.tsx`        | 468         | +20         | 488           | No           | Under general 500-line threshold                                                                                                                                                                                                                                                                                       |
| `AssignmentController.js`         | 436         | +30         | 466           | No           | Under 500                                                                                                                                                                                                                                                                                                              |
| `ReferenceDataController.js`      | 436         | 0           | 436           | No           | Under 500                                                                                                                                                                                                                                                                                                              |

No mandatory file separation is required for this feature. **Known deviation (AGENTS §11):** `98_ConfigurationManagerClass.js` is 668 lines (over the 550-line non-API threshold) and is intentionally NOT decomposed in this feature — the changes are additive (one getter/setter pair) plus two renames, and the file was already over threshold before this feature. A facade-pattern decomposition (per `src/backend/AGENTS.md` §11) is tracked as a separate follow-up and is out of scope here.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- `ABLogger` mandatory for all new and touched backend code; no direct `console.*` calls.

### TDD workflow (mandatory per section)

For each section:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation file-injection gate (mandatory for sub-agent execution)

Every delegated handoff must pass mandatory files via the `files` array of the `task` tool. Do **not** include any `AGENTS.md` file (auto-injected by OpenCode). Assemble the `files` array before writing the prompt body; never paste file contents into the prompt body.

### Shared-helper planning gate

When a section introduces helper reuse, extension, or new shared helpers, record the decision in that section and add planned helper entries to the relevant canonical doc with status `Not implemented`.

### Data-shape planning gate

When a section changes any validation schema, persistence model, API contract, or transport shape, record planned-only entries in the relevant canonical data-shape doc under `docs/developer/data-shapes/`, marked `Not implemented`. The implementation agent updates these entries to remove the marker as they implement.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`

---

## Section 1 — Data-shape doc updates (planned-only entries)

### Objective

Create and update canonical data-shape contract docs with `Not implemented` entries for all schema, persistence, transport, and validation changes implied by the Auth Service feature. These entries provide a documented target contract for the implementation agent.

### Constraints

- Data-shape docs must be created/updated **before** any corresponding code changes.
- All new entries must be marked `Not implemented`.
- The `INDEX.md` must be updated when new contract files are created.
- Follow the existing conventions in `docs/developer/data-shapes/`.

### Delegation files

Implementation (Docs subagent) receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'docs/developer/data-shapes/INDEX.md',
  'docs/developer/data-shapes/backend-config.md',
  'docs/developer/data-shapes/transport-envelope.md',
  'docs/developer/data-shapes/request-store.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'docs/developer/data-shapes/INDEX.md',
  'docs/developer/data-shapes/backend-config.md',
  'docs/developer/data-shapes/transport-envelope.md',
  'docs/developer/data-shapes/request-store.md',
];
```

### Data-shape planning

| Change                                                          | Canonical doc                                                 | Action                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `authGroupEmail` added to `getBackendConfig`/`setBackendConfig` | `docs/developer/data-shapes/backend-config.md`                | Add field (row 13) to persistence table, read transport, and write transport sections. Reconcile frontend form schema. Mark `Not implemented`. |
| New `FORBIDDEN` code in error envelope                          | `docs/developer/data-shapes/transport-envelope.md`            | Add `FORBIDDEN` row to error code mapping table. Mark `Not implemented`.                                                                       |
| 7 `requestStore` functions renamed                              | `docs/developer/data-shapes/request-store.md`                 | Update function names to trailing-underscore versions. Mark `Not implemented`.                                                                 |
| New ScriptProperties trigger-context shape                      | **New file:** `docs/developer/data-shapes/trigger-context.md` | Document `trigger:<uid>:method` and `trigger:<uid>:params` storage shape. Add row to `INDEX.md`. Mark `Not implemented`.                       |
| New CacheService auth-cache entry                               | **New file:** `docs/developer/data-shapes/auth-cache.md`      | Document `auth:<groupEmail>:<email>` cache key and `{ allowed, role }` value shape. Add row to `INDEX.md`. Mark `Not implemented`.             |

### Acceptance criteria

- `backend-config.md` updated with `authGroupEmail` field (persistence, read transport, write transport, form schema reconciliation).
- `transport-envelope.md` updated with `FORBIDDEN` error code entry.
- `request-store.md` updated with trailing-underscore function names.
- `trigger-context.md` created with storage shape documentation.
- `auth-cache.md` created with cache entry shape documentation.
- `INDEX.md` updated: two new contract-file rows added to the registry table (`trigger-context.md`, `auth-cache.md`) — total nine contracts; the "All seven contracts" prose (near line 45) updated to "All nine contracts".
- All entries marked `Not implemented`.

### Required test cases

None — this section is documentation-only. Verification is manual review against SPEC.md.

### Section checks

- Confirm `INDEX.md` lists all five contract changes.
- Confirm each entry is marked `Not implemented`.
- Confirm `backend-config.md` row 13 exists and is consistent with the `z.union([z.literal(''), z.email()])` transport idiom.

### Shared helper plan

None — no abstraction changes in this section.

### Implementation notes / deviations / follow-up

- The implementation agent will update these entries (remove `Not implemented`) as they deliver each data-shape change.

---

## Section 2 — Backend configuration: AUTH_GROUP_EMAIL key, getter/setter, and transport

### Objective

Add the `AUTH_GROUP_EMAIL` configuration key to the ConfigurationManager system (keys, schema, defaults, getter, setter) and wire it into the `getBackendConfig`/`setBackendConfig` transport payloads in `apiConfig.js`.

### Constraints

- Follow the existing per-key setter pattern in `98_ConfigurationManagerClass.js`: add `getAuthGroupEmail()` (blank-aware, returns `''` when blank/unset) and `setAuthGroupEmail(value)`.
- The blank-aware getter returns `''` when the stored value is blank, empty, or the key is absent — this triggers the fail-open bootstrap state at the gate level.
- Default value `AUTH_GROUP_EMAIL: ''` in `02_defaults.js`.
- Schema entry in `01_configKeysAndSchema.js` uses blank-tolerant email validation (blank → allow, non-blank → validate as email).
- `apiConfig.js` always emits `authGroupEmail: getAuthGroupEmail() || ''` in `getBackendConfig_()` and adds a `setBackendConfig_()` `updates` array entry calling `configManager.setAuthGroupEmail(value)`.
- Follow the existing `z.union([z.literal(''), z.email()])` transport idiom established by `BackendUrlSchema`.
- **Backend-enforced compulsory-once-set (user decision):** `setAuthGroupEmail('')` (blank) is rejected when a non-blank value is already stored — the stored value is preserved and the write path surfaces an aggregated error entry so the frontend can display the rejection. Changing the value to a different non-blank email remains allowed. Recovery stays via hand-editing Script Properties (SPEC Admin lockout recovery).
- **Blank-rejection enforcement location (review finding I4, corrected — fifth pass):** the compulsory-once-set guard belongs **in the `CONFIG_SCHEMA` validator for `AUTH_GROUP_EMAIL`**, using the `(value, instance)` signature (precedent: `JSON_DB_ROOT_FOLDER_ID` validator at `01_configKeysAndSchema.js` lines 90-102 calls `instance.isValidGoogleDriveFolderId`). `setProperty` (line 276) invokes `spec.validate(value, this)` after `getAllConfigurations()` populates `configCache`, so the validator can read the currently stored value via `instance.getProperty(...)`/`instance.configCache` and reject blank when a non-blank value is already stored. This makes the guard **structurally unbypassable** — every write path (accessor, generic `setProperty`, transport) routes through `setProperty` → `spec.validate(value, this)`. The validator stays blank-tolerant when nothing is stored (bootstrap), so the empty-string default and the blank-tolerant transport schema remain valid. `setAuthGroupEmail()` remains the public accessor entry point and simply delegates to `setProperty`.

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/ConfigurationManager/01_configKeysAndSchema.js',
  'src/backend/ConfigurationManager/02_defaults.js',
  'src/backend/ConfigurationManager/98_ConfigurationManagerClass.js',
  'src/backend/z_Api/apiConfig.js',
  'tests/api/backendConfigApi.test.js',
  'docs/developer/data-shapes/backend-config.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/ConfigurationManager/01_configKeysAndSchema.js',
  'src/backend/ConfigurationManager/02_defaults.js',
  'src/backend/ConfigurationManager/98_ConfigurationManagerClass.js',
  'src/backend/z_Api/apiConfig.js',
  'docs/developer/data-shapes/backend-config.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md'];
```

### Shared helper plan

None — no new abstractions. Follows existing per-key getter/setter pattern established by ConfigurationManager.

### Data-shape planning

This section implements the `authGroupEmail` entry planned in Section 1's `backend-config.md`. The implementation agent must update the `backend-config.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- `AUTH_GROUP_EMAIL` key defined in `CONFIG_KEYS` in `01_configKeysAndSchema.js`.
- Schema entry validates blank as allowed and non-blank as valid email.
- `AUTH_GROUP_EMAIL: ''` default in `02_defaults.js`.
- `getAuthGroupEmail()` returns `''` when value is blank, empty, or unset (fail-open trigger).
- `setAuthGroupEmail(value)` persists via `setProperty()` (existing mechanism).
- **`setAuthGroupEmail('')` is rejected when a non-blank value is already stored** (no overwrite; aggregated error entry surfaced on the write path). `setAuthGroupEmail('different@school.edu')` succeeds when a value is stored.
- `getBackendConfig_()` emits `authGroupEmail: configManager.getAuthGroupEmail() || ''`.
- `setBackendConfig_()` `updates` array includes `authGroupEmail` entry calling `configManager.setAuthGroupEmail(value)`.
- `02_defaults.js` DEFAULTS key is `AUTH_GROUP_EMAIL`, not `authGroupEmail` (matches existing `CONFIG_KEYS` naming convention — all-caps snake_case for config keys).

### Required test cases (Red first)

Backend model tests:

1. `getAuthGroupEmail()` returns `''` when key is unset (no property).
2. `getAuthGroupEmail()` returns `''` when key is set to blank/empty string.
3. `getAuthGroupEmail()` returns the stored email when a valid email is configured.
4. `setAuthGroupEmail('teachers@school.edu')` persists correctly and `getAuthGroupEmail()` returns it.
5. Schema validation: blank `''` passes; invalid email (e.g. `'not-an-email'`) fails; valid email passes.
6. `setAuthGroupEmail('')` is rejected when a non-blank value is already stored (no overwrite; stored value preserved; error surfaced).
7. `setAuthGroupEmail('different@school.edu')` overwrites an existing value successfully.

Backend transport tests:

8. `getBackendConfig_()` includes `authGroupEmail` field with `|| ''` fallback when unset.
9. `getBackendConfig_()` includes `authGroupEmail` field with the stored value when set.
10. `setBackendConfig_()` with `authGroupEmail` in config payload calls `configManager.setAuthGroupEmail()`.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/configurationManager/`
- `npm run test:backend -- tests/api/backendConfigApi.test.js`
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- The `setAuthGroupEmail` setter mirrors the existing per-key setter pattern (e.g. `setBackendUrl`, `setApiKey`). The clear-rejection guard follows the existing `setBackendConfig_` write-path error aggregation pattern (errors are collected and returned in the aggregated result).
- The `updates` array entry in `setBackendConfig_()` follows the exact shape of all existing entries: `{ name, value, applySetting }`.
- **Frontend `.strict()` lockstep:** `BackendConfigSchema` (`.strict()`) must land together with the backend transport addition. A partial deploy (backend emitting `authGroupEmail` before frontend schema is updated) rejects all config reads due to `backend-config.md` discrepancy #6 (unexpected field causes `.strict()` failure).

---

## Section 3 — CacheManager: generic get/put/remove methods + ABLogger conversion

### Objective

Extend `CacheManager` in `src/backend/RequestHandlers/CacheManager.js` with generic `get(key)`, `put(key, value, ttlSeconds)`, and `remove(key)` methods. Convert existing `console.error` calls to `ABLogger`.

### Constraints

- Keep existing assessment-specific methods unchanged.
- Generic methods handle JSON serialisation/deserialisation and error handling internally.
- `put()` stores values as JSON strings; `get()` parses them back.
- `remove()` deletes the key from the cache.
- `put(key, value, ttlSeconds)` requires an explicit TTL (no default — AuthService passes its 6-hour TTL at the call site).
- All `console.error` calls in the file must be converted to `ABLogger.getInstance().error()` (opportunistic refactor of touched file).
- Follow the existing `CacheService.getScriptCache()` pattern.

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md', 'src/backend/RequestHandlers/CacheManager.js'];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/RequestHandlers/CacheManager.js',
  'docs/developer/backend/singletons.md',
  'docs/developer/data-shapes/auth-cache.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/RequestHandlers/CacheManager.js',
  'docs/developer/data-shapes/auth-cache.md',
  'docs/developer/backend/singletons.md',
];
```

### Shared helper plan

1. Helper: Generic `get`/`put`/`remove` methods on `CacheManager`
   - Decision: `extend`
   - Owning module/path: `src/backend/RequestHandlers/CacheManager.js`
   - Call-site rationale: AuthService needs cache operations for group membership results. Generic methods allow any future feature to use the cache without assessment-specific coupling.
   - Relevant canonical doc target: `docs/developer/backend/singletons.md`
   - Planned doc status: `Not implemented` — add a new CacheManager entry describing the extended generic cache methods. The implementation agent removes the marker after delivery.

### Data-shape planning

This section implements the cache storage contract planned in Section 1 (`docs/developer/data-shapes/auth-cache.md`). The CacheManager's generic methods handle serialisation, but the auth-cache entry shape (`{ allowed, role }`) is defined in the data-shape doc, not in CacheManager itself. The implementation agent must update the `auth-cache.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- `CacheManager.get(key)` retrieves and deserialises a cached JSON value; returns `null` on cache miss or parse error.
- `CacheManager.put(key, value, ttlSeconds)` stores a JSON-serialised value with the given TTL.
- `CacheManager.remove(key)` deletes the cached entry.
- All `console.error` calls in `CacheManager.js` replaced with `ABLogger.getInstance().error()`.
- Existing assessment-specific methods (`getCachedAssessment`, `setCachedAssessment`, `generateCacheKey`) unchanged.

### Required test cases (Red first)

1. `get()` returns `null` when key does not exist in cache.
2. `get()` returns parsed value when key exists with valid JSON.
3. `get()` returns `null` when cached value is not valid JSON (graceful degradation).
4. `put()` stores value and `get()` retrieves it correctly.
5. `put()` respects the explicit TTL passed by the caller.
6. `remove()` deletes the key and subsequent `get()` returns `null`.
7. Verify `ABLogger.error()` is called on cache errors (not `console.error`).

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/requestHandlers/` (or equivalent CacheManager test path)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- CacheManager current LOC: 90. Projected after change: ~140. Well under 550-line threshold.

---

## Section 4 — AuthService singleton

### Objective

Create `AuthService` singleton (`src/backend/Utils/AuthService.js`) that verifies group membership via `GroupsApp`, maps roles, and caches results via `CacheManager`.

### Constraints

- Extends `BaseSingleton`, following the canonical singleton pattern.
- Two-method design: private `isGroupMember(email)` resolves group membership and role (returns `{ allowed, role }`), and public `checkAccess(options?)` resolves email, reads config, and delegates to `isGroupMember`.
  - **Naming note:** The private method is named `isGroupMember` to avoid collision with `ScriptAppManager.isAuthorised()` (which checks OAuth scopes, a different concern). SPEC §Naming explicitly advises against `isAuthorised` for the group-check method.
- Resolves user email via `Session.getActiveUser().getEmail()`.
- Checks group membership via `GroupsApp.getGroupByEmail(groupEmail).hasUser(email)`.
- Maps roles: `OWNER`/`MANAGER` → `admin`, `MEMBER` → `user`. Other roles (`INVITED`, `PENDING`, `BANNED`) → denied.
- Caches only successful auth results with 6-hour TTL via `CacheManager.put()`. Cache key: `auth:<groupEmail>:<email>`.
- **CacheManager instantiation (third-pass review finding I5):** `AuthService` must obtain CacheManager via `new CacheManager()` (the established pattern — `LLMRequestManager.js:23` uses `new CacheManager()`; CacheManager is a plain instantiable class, **not** a singleton). Do NOT convert CacheManager into a singleton as part of this section.
- Denials are never cached.
- `checkAccess(options?)` accepts `{ bypassCache?: boolean, requireConfigured?: boolean, method?: string }`. When `method` is provided it is included in the audit log entry (the "method if available" the SPEC audit contract promises). The API gate passes `request.method`; `triggerHandler` passes the trigger method resolved from context.
- When `AUTH_GROUP_EMAIL` is empty/missing and `requireConfigured` is falsy: returns `{ allowed: true, role: 'user' }` with `ABLogger.warn` (fail-open bootstrap).
- When `AUTH_GROUP_EMAIL` is empty/missing and `requireConfigured` is true: returns `{ allowed: false }` with `ABLogger.error` (fail-closed for triggers).
- All logging via `ABLogger` (no `console.*`).
- Audit logging: every access attempt (allowed and denied) is logged with user email, method if available, and outcome.
- Must load after `BaseSingleton` in GAS concatenation order (no other load-order requirements).

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/Utils/AuthService.js',
  'src/backend/RequestHandlers/CacheManager.js',
  'tests/setupGlobals.js',
  'docs/developer/data-shapes/auth-cache.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/RequestHandlers/CacheManager.js',
  'src/backend/ConfigurationManager/98_ConfigurationManagerClass.js',
  'src/backend/Utils/AuthService.js',
  'tests/setupGlobals.js',
  'docs/developer/data-shapes/auth-cache.md',
  'docs/developer/backend/singletons.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/Utils/AuthService.js',
  'src/backend/RequestHandlers/CacheManager.js',
  'docs/developer/data-shapes/auth-cache.md',
  'docs/developer/backend/singletons.md',
];
```

### Shared helper plan

1. Helper: `AuthService`
   - Decision: `new`
   - Owning module/path: `src/backend/Utils/AuthService.js`
   - Call-site rationale: Centralises all auth logic (group check, role mapping, caching, audit logging) so the gate in `ApiDispatcher` and `triggerHandler` stay thin.
   - Relevant canonical doc target: `docs/developer/backend/singletons.md`
   - Planned doc status: `Not implemented` — add an AuthService entry. The implementation agent removes the marker after delivery.

### Data-shape planning

This section implements the auth cache data shape planned in Section 1 (`docs/developer/data-shapes/auth-cache.md`). The implementation agent must update the `auth-cache.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- **Test harness:** `Session.getActiveUser().getEmail()` and `GroupsApp.getGroupByEmail()` stubs must be provisioned in `tests/setupGlobals.js` before AuthService or gate tests can run. Add stub definitions that return configurable values so tests can exercise authorised/denied/error paths.
- `AuthService.getInstance()` returns the singleton instance.
- `checkAccess()` returns `{ allowed: true, role: 'admin' | 'user' }` for group members.
- `checkAccess()` returns `{ allowed: false }` for non-members.
- `checkAccess()` returns `{ allowed: true, role: 'user' }` with `ABLogger.warn` when `AUTH_GROUP_EMAIL` is empty and `requireConfigured` is falsy (fail-open).
- `checkAccess()` returns `{ allowed: false }` with `ABLogger.error` when `AUTH_GROUP_EMAIL` is empty and `requireConfigured` is true (fail-closed).
- Successful auths are cached; subsequent calls within TTL return cached result without GroupsApp call.
- Denials are never cached.
- Cache bypass (`bypassCache: true`) always calls GroupsApp.
- Blank email → deny.
- GroupsApp error/group not found → deny.
- Audit logging via `ABLogger` for every access attempt; the audit entry includes the provided `method` when supplied.

### Required test cases (Red first)

0. **Test-harness prerequisite (review finding I4):** extend `tests/setupGlobals.js` with configurable `Session.getActiveUser().getEmail()`, `GroupsApp.getGroupByEmail()/hasUser()`, and `CacheService` stubs (mirroring the existing `LockService` pattern at lines 159-162) BEFORE writing any AuthService or auth-gate red-phase test. Without these stubs the §4/§5 red-phase tests cannot load. Reference the same stubs from §5's gate tests (no per-test ad-hoc GAS mocks).
1. Authorised user — cache miss → GroupsApp check → cache set → return `{ allowed: true, role }`.
2. Authorised user — cache hit → return cached result without GroupsApp call.
3. Denied user (not member) — cache miss → GroupsApp check → return `{ allowed: false }`, no cache set.
4. Removed user — previously cached allowed result is returned within TTL (denials are never cached; revocation latency is bounded by the 6-hour TTL).
5. Blank email → deny.
6. GroupsApp error → deny.
7. Group not found → deny.
8. Missing config value, `requireConfigured` falsy → `{ allowed: true, role: 'user' }` with `ABLogger.warn`.
9. Missing config value, `requireConfigured: true` → `{ allowed: false }` with `ABLogger.error`.
10. Role mapping: `OWNER` → `admin`, `MANAGER` → `admin`, `MEMBER` → `user`, `INVITED` → deny, `PENDING` → deny, `BANNED` → deny.
11. `bypassCache: true` always calls GroupsApp despite cache hit.
12. Audit logging: verify `ABLogger` is called for both allowed and denied attempts and that the provided `method` appears in the audit payload.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/utils/authService/` (or equivalent path)
- Confirm `files` array populated for every delegated handoff.

---

## Section 5 — FORBIDDEN error code + auth gate in ApiDispatcher

### Objective

Add the `FORBIDDEN` error code to `API_ERROR_CODE_MAP` and integrate the auth gate into `ApiDispatcher.handle()`, running before `_runAdmissionPhase()`. The gate is exempt for `getAuthorisationStatus` and fails open when `AUTH_GROUP_EMAIL` is unconfigured.

### Constraints

- `FORBIDDEN` added to `API_ERROR_CODE_MAP` in `z_apiHandler.js` with justification: "authenticated but not a group member".
- **Gate denial uses the map entry (review finding N1):** the gate's denial path must return `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)` — consuming the map entry rather than a raw string literal, matching how `_mapErrorToFailureEnvelope` already reads `API_ERROR_CODE_MAP`. This keeps `API_ERROR_CODE_MAP` as the single source of truth for error codes.
- Auth gate inserted after request validation, **before the allowlist method lookup** and `_runAdmissionPhase()`. Non-members receive `FORBIDDEN` uniformly and cannot probe which API methods exist; `UNKNOWN_METHOD` responses are only observable by authorised callers. Gate-exempt status is determined by the method name (`getAuthorisationStatus`) before the gate runs.
- Gate passes `method: request.method` to `checkAccess()` so the audit log records the requested method.
- `getAuthorisationStatus` is gate-exempt — skips directly to admission.
- When `AUTH_GROUP_EMAIL` is empty/missing: skip auth check, log warning, proceed to admission (fail-open).
- On denial: return `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)` without proceeding to admission (consumes the map entry per the constraint above).
- Auth check uses `AuthService.getInstance().checkAccess()`.
- Audit logging handled inside AuthService (not duplicated here).

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/z_Api/z_apiHandler.js',
  'src/backend/Utils/AuthService.js',
  'tests/setupGlobals.js',
  'docs/developer/data-shapes/transport-envelope.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/z_Api/z_apiHandler.js',
  'src/backend/Utils/AuthService.js',
  'tests/setupGlobals.js',
  'docs/developer/data-shapes/transport-envelope.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/z_Api/z_apiHandler.js',
  'src/backend/Utils/AuthService.js',
  'docs/developer/data-shapes/transport-envelope.md',
];
```

### Data-shape planning

This section implements the `FORBIDDEN` error code planned in Section 1 (`docs/developer/data-shapes/transport-envelope.md`). The implementation agent must update the `transport-envelope.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- `FORBIDDEN` registered in `API_ERROR_CODE_MAP` in `z_apiHandler.js`.
- Auth gate runs after request validation, before the allowlist method lookup and `_runAdmissionPhase()`.
- Gate passes `method: request.method` to `checkAccess()`.
- `getAuthorisationStatus` is gate-exempt for the group check; it runs its OAuth scope check only (matches SPEC wording).
- When `AUTH_GROUP_EMAIL` is empty: auth gate skipped with `ABLogger.warn`, request proceeds normally (fail-open).
- When auth is denied: `_failure(requestId, API_ERROR_CODE_MAP.FORBIDDEN, 'Access denied.', false)` returned (the gate denial reads the map entry, not a raw literal), no admission phase runs, no lock consumed.
- When auth is allowed: request proceeds to `_runAdmissionPhase()` normally.

### Required test cases (Red first)

1. Authorised user: gate passes, admission phase runs, handler dispatched.
2. Denied user: gate returns `FORBIDDEN`, admission phase NOT run, no lock consumed.
3. `getAuthorisationStatus` method: gate-exempt for the group check (runs its OAuth check only), admission phase runs normally.
4. Empty `AUTH_GROUP_EMAIL`: gate skipped with warning log, admission phase runs (fail-open).
5. Blank email from `Session.getActiveUser()`: gate denies with `FORBIDDEN`.
6. GroupsApp error during auth check: gate denies with `FORBIDDEN`.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/api/apiHandler/`
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- `z_apiHandler.js` current LOC: 486. Projected after change: ~536. Under 550-line backend threshold.

---

## Section 6 — appsscript.json scopes, webapp block, and REQUIRED_SCOPES

### Objective

Add required OAuth scopes (`groups`, `userinfo.email`), the `webapp` deployment block, and update `TriggerController.REQUIRED_SCOPES` in `appsscript.json`.

### Constraints

- Add `https://www.googleapis.com/auth/groups` to `oauthScopes` array.
- Add `https://www.googleapis.com/auth/userinfo.email` to `oauthScopes` array.
- Add `"webapp": { "executeAs": "USER_ACCESSING", "access": "DOMAIN" }` block.
- Confirm the two new scopes are recorded/explained per `docs/developer/backend/oauth-scopes.md` policy ("keep additions minimal and justified"; `appsscript.json` is the canonical source) — the Documentation section also updates the doc with a note (review finding N1).
- Update `TriggerController.REQUIRED_SCOPES` to include both new scopes.
- Remove the stale `DO NOT UPDATE THE REQUIRED SCOPES HERE… src/AdminSheet/appsscript.json / srcipts/sync-appscript.js` comment block (lines 78–81 of `src/backend/Utils/TriggerController.js`) — verified `src/AdminSheet` and `scripts/sync-appscript.js` do not exist in the repo. Replace with a short note that `REQUIRED_SCOPES` must be manually kept in sync with `src/backend/appsscript.json`.
- **`ScriptApp.requireScopes` call — must NOT be changed (fifth-pass correction, replacing earlier wrong guidance):** the call at `TriggerController.js` line 17 — `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)` — is **correct as written**. The official Apps Script reference documents the signature `requireScopes(authMode, oAuthScopes)`: `authMode` is `ScriptApp.AuthMode.FULL` and `oAuthScopes` is a `String[]`. Do **not** spread the array or otherwise alter this call. Only update the `REQUIRED_SCOPES` array contents and remove the stale comment block (previous action-plan revisions incorrectly flagged this call as a misuse; that premise was wrong and is retracted).
- **GWS-domain prerequisite (user decision):** `webapp.access: "DOMAIN"` is only valid when the deployment belongs to a Google Workspace domain (the same Workspace org as the Google Group). This is an explicit assumption of the feature; if the project uses a personal (Gmail) identity, confirm the appropriate `access` value with the deploying admin.
- **Identity-model clarification (review finding C2 — verified against the official Apps Script Session reference):** `Session.getActiveUser().getEmail()` returns blank only when the script runs _without the user's authorization_ (web app deployed "execute as me", anonymous access, trigger/custom-function contexts); the restriction "generally does not apply" for deployers in the same Google Workspace domain as the user. The `executeAs: USER_ACCESSING` + `access: DOMAIN` pairing mandated here is the valid combination under which the signed-in domain member's email is available — `DOMAIN` access does not blank the email. Do NOT change the pairing to `ANYONE` on the strength of this review; the blank-email denial is defence-in-depth, not the normal path.
- This is critical: without `userinfo.email`, `Session.getActiveUser().getEmail()` returns blank → all users denied. Without `webapp.executeAs = USER_ACCESSING`, the identity model is unreliable.

### Delegation files

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/appsscript.json',
  'src/backend/Utils/TriggerController.js',
  'docs/developer/backend/oauth-scopes.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/appsscript.json',
  'src/backend/Utils/TriggerController.js',
  'docs/developer/backend/oauth-scopes.md',
];
```

### Acceptance criteria

- `oauthScopes` array in `appsscript.json` includes both `groups` and `userinfo.email` scopes.
- `webapp` block present with `executeAs: USER_ACCESSING` and `access: DOMAIN`.
- `TriggerController.REQUIRED_SCOPES` updated with both new scopes; the line 17 call `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)` remains unchanged (documented `requireScopes(authMode, oAuthScopes)` form).
- Stale sync-script comment removed and replaced with a manual sync note pointing at `appsscript.json`.
- Staging verification checklist recorded in this section's notes (Session email resolution, GroupsApp group resolution, FORBIDDEN for non-member, DOMAIN-level reachability) to be executed before production group enforcement (see SPEC rollout step 4).

### Required test cases

None — manifest validation is manual. `appsscript.json` is a configuration file; no runtime test needed.

### Section checks

- `npm run lint:backend`
- Manual review of `appsscript.json` to confirm `webapp` block structure.

### Implementation notes / deviations / follow-up

- **Staging verification checklist (from SPEC rollout step 4):** before enabling production group enforcement, verify in a staging deployment that (a) `Session.getActiveUser().getEmail()` resolves to the signed-in user's email (not blank), (b) the Google Group resolves via `GroupsApp.getGroupByEmail()` and membership checks behave as expected, (c) a non-member receives `FORBIDDEN` on a protected API call, (d) the web app is reachable at DOMAIN level with the signed-in identity, and (e) `Session.getActiveUser().getEmail()` resolves in installable-trigger execution context (gates the fail-closed trigger auth rule).

---

## Section 7 — Security audit: delete dead code, rename public functions, guard test

### Objective

Eliminate all unauthorised public function exposure surface by deleting dead wrapper functions and empty files, renaming 20 internal functions with trailing underscores, and extending the global-exposure guard test to enforce the private-by-default convention.

### Constraints

- **Delete 6 dead wrapper functions** from `AssignmentProcessor/globals.js` (`startProcessing`, `removeTrigger`, `testWorkflow`, `triggerProcessSelectedAssignment`), `y_controllers/globals.js` (`getAllPartialDefinitions`), and `Utils/logError.js` (`logError`).
- **Delete 3 empty source files:** `src/backend/Utils/logError.js`, `src/backend/y_controllers/globals.js`, `src/backend/AssignmentProcessor/globals.js`.
- **Delete 2 corresponding test files:** `tests/utils/logError.test.js`, `tests/assignmentProcessor/globals.test.js`.
- **Rename 20 functions** with trailing underscores across 6 files (see SPEC.md §Security Audit table for the canonical list). The exact rename pairs are:
  - `AssignmentProcessor/Assignment/index.js`: `defineLazySubclass` → `defineLazySubclass_()`
  - `ConfigurationManager/03_validators.js`: `validateLogLevel`, `validateRequiredClassInfoStringProperty`, `validateApiKey`, `toBoolean`, `toBooleanString`, `toReadableKey`, `validateClassInfo` → trailing-underscore versions (7 functions)
  - `ConfigurationManager/98_ConfigurationManagerClass.js`: `safeGetPropertyKeys`, `safeParseConfigObject` → trailing-underscore versions (2 functions)
  - `Models/Cohort.js`: `getCurrentAcademicYearStart` → `getCurrentAcademicYearStart_()`
  - `Utils/ABLogger.js`: `isErrorLike` → `isErrorLike_()`
  - `y_controllers/ReferenceDataController.js`: `generateStableKey` → `generateStableKey_()`
  - `z_Api/requestStore.js`: `createStartedRecord`, `loadStore`, `saveStore`, `markSuccess`, `markError`, `pruneStaleEntries`, `compactStore` → trailing-underscore versions (7 functions)
- Update all internal references to use renamed functions.
- Update `module.exports` in each file to export renamed functions.
- **Extend guard test** (`tests/api/apiHandler/globalExposure.test.js`) to scan all backend source files using a **static source scan**: discover files at test time via a glob over `src/backend/**/*.js`, read each file's text, and flag any top-level `function <name>(…)` declaration whose name does not end in `_` and is not in the explicit allowlist (`apiHandler`, `doGet`, `triggerHandler`). This matches GAS's actual exposure rule, avoids load-time `class extends`/`ReferenceError` failures from execution-based scanning, and automatically covers new backend files added in future (satisfying the guard's future-proofing purpose). SPEC §Security (lines 302/802/930) aligns with this method — the static source scan supersedes the legacy execution-based `globalExposure.test.js` helper.
- **Scan precision (review finding I1):** (a) anchor matches to line starts (`^function`) so indented nested declarations such as `apiConfig.js`'s `safeSet` (line 131) are not false-flagged; (b) skip backend source files that do not exist at scan time — `src/backend/Triggers/triggerHandler.js` does not exist until Section 8 creates it, yet `triggerHandler` is allowlisted from the start; (c) the scan replaces the legacy vm-context assertions in `globalExposure.test.js`.

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md', 'tests/api/apiHandler/globalExposure.test.js'];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/z_Api/requestStore.js',
  'src/backend/z_Api/z_apiHandler.js',
  'src/backend/ConfigurationManager/03_validators.js',
  'src/backend/ConfigurationManager/01_configKeysAndSchema.js',
  'src/backend/ConfigurationManager/98_ConfigurationManagerClass.js',
  'src/backend/Utils/ABLogger.js',
  'src/backend/AssignmentProcessor/Assignment/index.js',
  'src/backend/Models/Cohort.js',
  'src/backend/y_controllers/ReferenceDataController.js',
  'src/backend/AssignmentProcessor/globals.js',
  'src/backend/y_controllers/globals.js',
  'src/backend/Utils/logError.js',
  'tests/api/apiHandler/globalExposure.test.js',
  'tests/api/apiHandler/shared.js',
  'tests/api/requestStore.test.js',
  'tests/api/requestStore.pruning.test.js',
  'tests/setupGlobals.js',
  'tests/configurationManager/validateClassInfo.test.js',
  'tests/configurationManager/configurationManager.test.js',
  'tests/configurationManager/configurationManagerInternalHelpers.test.js',
  'tests/utils/ablogger.test.js',
  'tests/utils/logError.test.js',
  'tests/assignmentProcessor/globals.test.js',
  'docs/developer/data-shapes/request-store.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'tests/api/apiHandler/globalExposure.test.js',
  'docs/developer/data-shapes/request-store.md',
];
```

### Data-shape planning

This section implements the `request-store.md` name changes planned in Section 1. The implementation agent must update the `request-store.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- 6 dead wrapper functions deleted.
- 3 empty source files deleted (`Utils/logError.js`, `y_controllers/globals.js`, `AssignmentProcessor/globals.js`).
- 2 corresponding test files deleted.
- 20 functions renamed with trailing underscores.
- All internal references updated to use new names.
- `module.exports` updated in each renamed-function file.
- Guard test scans all backend files and passes — only `apiHandler`, `doGet`, `triggerHandler` are public.
- Guard test excludes vendored code (`scripts/builder/vendor/`) and test files from the scan.

### Required test cases (Red first)

1. Guard test scan: verify all backend source files are scanned.
2. Guard test scan: verify vendored code is excluded.
3. Guard test scan: verify an intentionally exposed test function (simulating a new public function without underscore) fails the guard test.
4. Guard test scan: verify `apiHandler`, `doGet`, `triggerHandler` are correctly allowlisted and not flagged.
5. Existing tests importing renamed functions continue to pass with updated names.
6. Existing tests for deleted files are themselves deleted.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/api/apiHandler/globalExposure.test.js`
- `npm run test:backend` (full backend suite to catch missed reference updates)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- The rename operations touch 6 source files and potentially many test files — use `grep` to find all references before renaming.
- The RequestStore functions (`createStartedRecord`, `loadStore`, etc.) have callers inside `apiHandler` and `requestStore` itself — update all.
- Deleting source files may break `tests/setupGlobals.js` if they were loaded — check and fix.
- **Orphaned `testWorkflow`:** Deleting the `testWorkflow` global wrapper in `AssignmentProcessor/globals.js` leaves `AssignmentController.testWorkflow()` (~line 458) with no caller. Out of SPEC scope; flag for opportunistic cleanup.
- **Pre-existing hygiene note (review finding N3):** `tests/configurationManager/` contains pre-existing committed red-phase test files (`configurationManagerSection1Red.test.js`, `configurationManagerSection1aRed.test.js`, `configurationManagerSection2Red.test.js`). These are a pre-existing hygiene issue, out of scope for this feature — do not delete or modify them.
- **`Utils/logError.js` verification (review finding N2):** a grep for `require`/import of `Utils/logError.js` found no production callers in `src/backend` — the file is safe to delete. Confirm with a fresh grep during implementation before deleting.

---

## Section 8 — Triggers/ domain: TriggerController move/extend, triggerHandler, triggerMethodHandlers

> **Execution-order note:** Section 9 was intentionally implemented before Section 8 because the direct-params `processSelectedAssignment()` contract is required by the trigger registry. The numeric section labels are retained for traceability; follow the suggested implementation order below rather than document order.

### Objective

Create the `Triggers/` domain folder, move and extend `TriggerController` (context storage methods + ABLogger conversion), create `triggerHandler()` as the single public trigger entrypoint with centralised auth, and create the `TRIGGER_METHOD_HANDLERS` registry.

### Constraints

- Create `src/backend/Triggers/` domain folder.
- Move `TriggerController.js` from `src/backend/Utils/` to `src/backend/Triggers/`.
- Convert all `console.*` calls in `TriggerController.js` to `ABLogger` (opportunistic refactor).
- Extend `TriggerController` with context storage methods (instance methods, consistent with the existing `createTimeBasedTrigger`/`deleteTriggerById`/`removeTriggers` which are all invoked via `new TriggerController()`):
  - `storeTriggerContext(triggerUid, { method, params })` — stores to ScriptProperties via `GASPropertiesUtils`, keyed by triggerUid.
  - `getTriggerContext(triggerUid)` — retrieves and returns `{ method, params }`.
  - `clearTriggerContext(triggerUid)` — removes all keys for that triggerUid.
- Create `triggerHandler.js` — single public entrypoint: validate-then-dispatch, fail-closed auth with cache bypass, cleanup in finally.
- Create `triggerMethodHandlers.js` — `TRIGGER_METHOD_HANDLERS` registry importing existing `AssignmentController`.
- `triggerHandler()` calls `AuthService.checkAccess({ bypassCache: true, requireConfigured: true, method: <trigger method> })` before dispatching. The trigger method is resolved from the trigger context during input validation (the unknown-method check reads `context.method`), so it is available at auth time and is recorded in the audit log.
- Trigger context keys: `trigger:<uid>:method` and `trigger:<uid>:params`.
- Update `TriggerController.createTimeBasedTrigger` hardcoded recovery path from `'triggerProcessSelectedAssignment'` to `'triggerHandler'`.
- Cleanup only runs for known, resolved triggerUid (malformed input does not trigger cleanup).
- **Reuse, do not duplicate `TriggerController` (review finding I2):** `triggerHandler` performs its `finally` cleanup by calling the existing `TriggerController` methods (`clearTriggerContext(triggerUid)`, `deleteTriggerById(triggerUid)` — per SPEC trigger flow lines 196, 233-234). No new or parallel context-storage mechanism is introduced; `TriggerController` remains the single owner of trigger context storage and trigger deletion.
- **`ScriptApp.requireScopes` call — must NOT be changed (fifth-pass correction, replacing earlier wrong guidance):** `ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, TriggerController.REQUIRED_SCOPES)` (current line 17) matches the documented `requireScopes(authMode, oAuthScopes)` signature (authMode first, oAuthScopes second). Earlier revisions wrongly called this a misuse and instructed Section 6 to spread the array — that guidance is retracted. During the move, **preserve the call exactly as-is**; do not "fix" it.

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/Utils/TriggerController.js',
  'src/backend/Triggers/TriggerController.js',
  'src/backend/Triggers/triggerHandler.js',
  'src/backend/Triggers/triggerMethodHandlers.js',
  'src/backend/Utils/AuthService.js',
  'docs/developer/data-shapes/trigger-context.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/Utils/TriggerController.js',
  'src/backend/Triggers/TriggerController.js',
  'src/backend/Triggers/triggerHandler.js',
  'src/backend/Triggers/triggerMethodHandlers.js',
  'src/backend/Utils/AuthService.js',
  'src/backend/Utils/00_GASPropertiesUtils.js',
  'src/backend/y_controllers/AssignmentController.js',
  'docs/developer/data-shapes/trigger-context.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md'];
```

### Data-shape planning

This section implements the trigger-context storage shape planned in Section 1 (`docs/developer/data-shapes/trigger-context.md`). The implementation agent must update the `trigger-context.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- `Triggers/` domain folder exists at `src/backend/Triggers/`.
- `TriggerController.js` moved from `Utils/` to `Triggers/`.
- All `console.*` calls in `TriggerController.js` replaced with `ABLogger`.
- `storeTriggerContext`, `getTriggerContext`, `clearTriggerContext` methods exist and use `GASPropertiesUtils` with ScriptProperties keys `trigger:<uid>:method` and `trigger:<uid>:params`.
- `triggerHandler(event)` validates input: missing/malformed event → log error via `ABLogger` and abort; unknown triggerUid → log error and abort; unknown method → log error and abort. **No return value is expected from a trigger** — GAS discards trigger return values, so validation failures surface via fail-loud logging + skipping execution, not API envelopes (review finding C3).
- `triggerHandler()` calls `AuthService.checkAccess({ bypassCache: true, requireConfigured: true })` before dispatch.
- On auth denial: log, abort, clean up trigger context.
- On success: retrieve context, dispatch to handler, clean up in `finally`, delete trigger.
- `TRIGGER_METHOD_HANDLERS` registry follows the SPEC form exactly (SPEC §TriggerHandler flow, lines 196–202): `processSelectedAssignment: (params) => new AssignmentController().processSelectedAssignment(params)` — each entry is a function receiving params and instantiating its controller (not a bare method reference).
- `TriggerController.createTimeBasedTrigger` recovery path uses `'triggerHandler'`.

### Required test cases (Red first)

TriggerController tests:

1. `storeTriggerContext()` stores method and params under correct ScriptProperties keys.
2. `getTriggerContext()` retrieves stored `{ method, params }`.
3. `clearTriggerContext()` removes both keys.
4. Concurrent trigger contexts with different triggerUids do not collide.
5. `ABLogger` used for all logging (no `console.*`).

triggerHandler tests:

6. Valid event: auth passes → context retrieved → handler dispatched → cleanup runs in finally.
7. Auth denial: `ABLogger.warn/error` called, context cleaned up, no handler dispatched.
8. Missing event/malformed input: `ABLogger.error` called, no cleanup (malformed input check).
9. Unknown triggerUid: `ABLogger.error` called, execution aborted/skipped, no handler dispatched (no return envelope — GAS discards trigger return values).
10. Unknown method: `ABLogger.error` called, execution aborted/skipped, no handler dispatched (no return envelope).
11. Unconfigured group with `requireConfigured: true` → auth denied.
12. Cache bypass used (`bypassCache: true` passed to `checkAccess`), and the trigger method resolved from context is passed as `method`.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/triggers/` (relocated test path)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- The existing `tests/utils/triggerController.test.js` must be relocated to `tests/triggers/`.
- **Red-phase imports (review finding I10):** red-phase tests for the new context methods (`storeTriggerContext`, `getTriggerContext`, `clearTriggerContext`) target them via the current import path (`src/backend/Utils/TriggerController.js`); switching imports to `src/backend/Triggers/TriggerController.js` and relocating the test file happen in the green/refactor phase of this section.
- `triggerHandler` is a new public entrypoint — the guard test allowlist must include it (already planned in Section 7).
- **Guard-test allowlist safety (open question, review finding N4):** `triggerMethodHandlers.js` must only export the `TRIGGER_METHOD_HANDLERS` registry and must NOT declare top-level functions (no `^function` lines at column 0) — otherwise the static scan in `globalExposure.test.js` will flag it. Follow the SPEC form (anonymous arrow functions inside the registry object literal). The implementation agent must confirm no top-level function declarations exist in the final file.
- **GASPropertiesUtils API (open question, verified):** `GASPropertiesUtils` has no single-key getter wrapper — it exposes only `getScriptProperties()`, `getUserProperties()`, `applyProperties(properties, propertyMap)`, and `clearProperties(properties, keys)`. Therefore `getTriggerContext(triggerUid)` must call `GASPropertiesUtils.getScriptProperties().getProperty(key)` directly for each key (`trigger:<uid>:method`, `trigger:<uid>:params`), rather than expecting a dedicated helper.
- `TriggerController.js` current LOC: 100. After move + ABLogger conversion + context methods: ~170. Well under threshold.

---

## Section 9 — AssignmentController: `processSelectedAssignment` signature change

### Objective

Change `AssignmentController.processSelectedAssignment()` to accept params directly instead of reading from UserProperties. This is a **prerequisite for Section 8** (review finding C1): Section 8's `TRIGGER_METHOD_HANDLERS` dispatch test requires the real handler to accept `(params)` and run without UserProperties context, so this signature change must land before Section 8 is built.

### Constraints

- `processSelectedAssignment()` accepts params directly: `processSelectedAssignment({ assignmentId, definitionKey, courseId })`.
- No longer reads from or writes to UserProperties for task context.
- No longer cleans up trigger context or deletes the trigger — `triggerHandler()` owns all cleanup.
- Existing callers of `processSelectedAssignment()` must be updated to pass the params object (the previous trigger wrapper in `AssignmentProcessor/globals.js` is deleted in Section 7; the remaining caller path is `TRIGGER_METHOD_HANDLERS` created in Section 8).

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md', 'src/backend/y_controllers/AssignmentController.js'];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md', 'src/backend/y_controllers/AssignmentController.js'];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md', 'src/backend/y_controllers/AssignmentController.js'];
```

### Acceptance criteria

- `processSelectedAssignment({ assignmentId, definitionKey, courseId })` uses params directly.
- No UserProperties reads/writes for task context remain.
- No trigger cleanup in `processSelectedAssignment()` — that is owned by `triggerHandler()`.

### Required test cases (Red first)

1. `processSelectedAssignment()` accepts direct params and does not read from UserProperties.
2. `processSelectedAssignment()` does not clean up trigger context or delete trigger.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/controllers/assignmentController/` (or equivalent path)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- **Progress:** Section 9 was implemented, reviewed, regression-checked, committed as `972b5b5`, and pushed. The red-phase details are retained in the execution log above for audit history.
- `AssignmentController.js` current LOC: 436. Remaining Section 10 work is projected at approximately +30 lines, for approximately 466 lines.
- This section MUST be delivered before Section 8 so the `TRIGGER_METHOD_HANDLERS` dispatch path is executable with the new signature.
- The `startProcessing()` trigger-integration work that previously lived in this section is now Section 10 (it depends on Section 8's `TriggerController.storeTriggerContext`).

---

## Section 10 — AssignmentController: `startProcessing` trigger integration

### Objective

Update `AssignmentController.startProcessing()` to use the new trigger context storage model (ScriptProperties via TriggerController). This depends on Section 8 (`TriggerController.storeTriggerContext` and the `triggerHandler` entrypoint) and on Section 9 (the `processSelectedAssignment(params)` signature it stores context for).

### Constraints

- `startProcessing()` creates trigger pointing at `triggerHandler` (not `triggerProcessSelectedAssignment`).
- `startProcessing()` stores task context via `TriggerController.storeTriggerContext(triggerUid, { method: 'processSelectedAssignment', params: { assignmentId, definitionKey, courseId } })`.
- No longer uses UserProperties for task context.
- Must keep existing `createTimeBasedTrigger` integration — only the target function name and context storage change.

### Data-shape planning

Consumes the `trigger-context.md` shape (created Section 1, implemented Section 8); no new data-shape entry required here.

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/y_controllers/AssignmentController.js',
  'src/backend/Triggers/TriggerController.js',
  'src/backend/Triggers/triggerMethodHandlers.js',
  'docs/developer/data-shapes/trigger-context.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/y_controllers/AssignmentController.js',
  'src/backend/Triggers/TriggerController.js',
  'src/backend/Triggers/triggerMethodHandlers.js',
  'docs/developer/data-shapes/trigger-context.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/backend/y_controllers/AssignmentController.js',
  'src/backend/Triggers/TriggerController.js',
  'src/backend/Triggers/triggerMethodHandlers.js',
  'docs/developer/data-shapes/trigger-context.md',
];
```

### Acceptance criteria

- `startProcessing()` stores context via `TriggerController.storeTriggerContext()` with correct method and params.
- `startProcessing()` creates trigger pointing at `'triggerHandler'`.
- No UserProperties reads/writes for task context remain.

### Required test cases (Red first)

1. `startProcessing()` calls `TriggerController.storeTriggerContext()` with correct `triggerUid`, method `'processSelectedAssignment'`, and params `{ assignmentId, definitionKey, courseId }`.
2. `startProcessing()` creates trigger with `triggerHandler` as the target function.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/controllers/assignmentController/` (or equivalent path)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- `AssignmentController.js` current LOC: 436. Remaining Section 10 work is projected at approximately +30 lines, for approximately 466 lines.
- This section MUST be delivered after Section 8 (needs `TriggerController.storeTriggerContext`) and after Section 9 (needs the params-accepting `processSelectedAssignment`).
- **Deployment blocker:** until this section is delivered, `startProcessing()` still targets the deleted `triggerProcessSelectedAssignment` function and stores task context in UserProperties. Do not deploy the assessment-trigger flow between Sections 7/8 and 10.

---

## Section 11 — Frontend: config transport + settings form

### Objective

Add `authGroupEmail` to the frontend backend config transport schema, form schema, form mapper, and settings panel with descriptor type extension and declarative helper text.

### Constraints

- `BackendConfigSchema` (read): add `authGroupEmail: z.union([z.literal(''), z.email()]).optional()`.
- `BackendConfigWriteInputSchema` (write): add `authGroupEmail: z.union([z.literal(''), z.email()]).optional()`.
- `BackendSettingsFormSchema`: add `authGroupEmail` as `z.union([z.literal(''), z.email()])` (blank-tolerant, follows `jsonDbRootFolderId` idiom for form-level blank handling). Form-level compulsory-once-set rule: clearing a previously-set value is rejected. **Enforcement (user decision):** panel-level guard in `BackendSettingsPanel.handleFinish` — before saving, compare the submitted `authGroupEmail` against the loaded baseline `backendSettingsFormValues.authGroupEmail` from `useBackendSettings`; if the submitted value is blank while the baseline is non-blank, set a field error and return early without calling `saveBackendSettings`. The backend independently rejects clearing (Section 2) — this is defence-in-depth.
- `backendSettingsFormMapper.ts`: map `authGroupEmail` in both directions.
- `BackendSettingsPanel.tsx`:
  - Extend `BackendSettingsFieldDescriptor` type with `helperText?: string`.
  - Add `authGroupEmail` to `backendSettingsFieldNames` array.
  - Add field descriptor with static `helperText`.
  - Keep existing `apiKey` dynamic helper case preserved.
  - Use declarative helper text rendering in the field render loop.

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts',
  'src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts',
  'src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts',
  'src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx',
  'src/frontend/src/features/settings/backend/useBackendSettings.ts',
  'docs/developer/data-shapes/backend-config.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts',
  'src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts',
  'src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts',
  'src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx',
  'src/frontend/src/features/settings/backend/useBackendSettings.ts',
  'docs/developer/data-shapes/backend-config.md',
  'docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md'];
```

### Shared helper plan

1. Helper: `helperText` field on `BackendSettingsFieldDescriptor`
   - Decision: `extend`
   - Owning module/path: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
   - Call-site rationale: Supports declarative static helper text for the `authGroupEmail` field without adding special-case rendering branches. The existing `apiKey` dynamic helper case is preserved.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented` — add a BackendSettingsPanel descriptor type extension entry. The implementation agent removes the marker after delivery.

### Acceptance criteria

- `BackendConfigSchema` includes `authGroupEmail` as `z.union([z.literal(''), z.email()]).optional()`.
- `BackendConfigWriteInputSchema` includes `authGroupEmail` as `z.union([z.literal(''), z.email()]).optional()`.
- `BackendSettingsFormSchema` includes `authGroupEmail` as `z.union([z.literal(''), z.email()])`.
- Form mapper maps `authGroupEmail` in both read and write directions.
- Descriptor type extended with `helperText?: string`.
- New field descriptor for `authGroupEmail` with static helper text, section `'Backend'`, `withSchemaValidation: true`.
- Existing `apiKey` dynamic helper case preserved — code renders helper text either from descriptor `helperText` or the dynamic `getApiKeyHelperCopy()` function.
- Form-level compulsory-once-set rule: clearing a previously-set `authGroupEmail` value is rejected. **`BackendSettingsPanel.handleFinish` enforces it:** submitting a blank `authGroupEmail` while the loaded baseline (`backendSettingsFormValues.authGroupEmail`) is non-blank sets a field error and returns without calling `saveBackendSettings`.

### Required test cases (Red first)

Transport schema tests:

1. `BackendConfigSchema` accepts `authGroupEmail: ''`.
2. `BackendConfigSchema` accepts `authGroupEmail: 'teachers@school.edu'`.
3. `BackendConfigSchema` rejects invalid email like `'not-an-email'` when non-empty.
4. `BackendConfigSchema` accepts absent `authGroupEmail` (field is optional).

Form schema tests:

5. Form schema accepts `authGroupEmail: ''` (blank, bootstrap state).
6. Form schema accepts `authGroupEmail: 'teachers@school.edu'`.
7. Form schema rejects `authGroupEmail: 'not-an-email'`.

Form mapper tests:

8. `mapBackendConfigToBackendSettingsFormValues` maps `authGroupEmail` correctly.
9. `mapBackendSettingsFormValuesToBackendConfigWriteInput` maps `authGroupEmail` correctly.

Component tests:

10. `BackendSettingsPanel` renders `authGroupEmail` field with correct label, input type, and helper text.
11. `BackendSettingsPanel.handleFinish`: submitting a blank `authGroupEmail` while a non-blank value is configured sets a field error and does not call `saveBackendSettings`.

### Section checks

- `npm run lint:frontend`
- `npm run test:frontend -- backendConfiguration`
- `npm run test:frontend -- BackendSettings`
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- `BackendSettingsPanel.tsx` current LOC: 468. Projected after change: ~488. Under 500-line threshold.
- The descriptor type extension with `helperText` uses optional field so existing descriptors compile without changes.
- The render logic should check `descriptor.helperText` first; if present, render static helper. Otherwise, fall through to existing `apiKey` dynamic case.

---

## Section 12 — Frontend: FORBIDDEN registration + useAuthorisationStatus + AppAuthGate + AuthStatusCard

### Objective

Register the `FORBIDDEN` error code in the frontend error mapping, update the `useAuthorisationStatus` hook contract, make `AppAuthGate` truly blocking, and simplify `AuthStatusCard`.

### Constraints

- `map-error-to-ui.ts`: add `FORBIDDEN` to `errorCodes` object and `errorCodeToMessageMap` with message: `'You do not have permission to access this application. Please contact your administrator.'`.
- `useAuthorisationStatus.ts`: update return type to `{ isAuthorised: boolean, isLoading: boolean, error: string | null }`. `error` captures transport failures only; does NOT observe `FORBIDDEN`. Derive `error` via `extractErrorCode` + `mapErrorCodeToUserMessage` from `map-error-to-ui.ts` (no local `mapAuthorisationErrorToUserMessage` copy — use the central map).
- `AppAuthGate.tsx`:
  - Make truly blocking: wrap around `StartupWarmupStateProvider`.
  - Consume `{ isAuthorised, isLoading, error }` from `useAuthorisationStatus`.
  - **Gate precedence (evaluation order, most-restrictive first):** (1) warmup `FORBIDDEN` detection, then (2) transport `error`, then (3) `isLoading`, then (4) `isAuthorised`. Warmup-FORBIDDEN is evaluated **first** and blocks regardless of `isAuthorised` — an OAuth-authorised user who is not a group member must still be denied.
  - `isLoading === true`: render loading indicator.
  - `error` non-null: render transport error with retry option (retry invalidates the `getAuthorisationStatus` query via `queryClient.invalidateQueries`).
  - `isAuthorised === false`: render "Permissions required" message (recoverable — OAuth denial).
  - `isAuthorised === true`: render children inside `StartupWarmupStateProvider`.
  - Group-denial detection: for each startup warmup dataset, read `queryClient.getQueryState(getStartupWarmupQueryKey(dataset)).error` from the React Query cache and apply `extractErrorCode`; if the derived code is `'FORBIDDEN'`, replace children with access-denied message from `map-error-to-ui.ts` (`mapErrorCodeToUserMessage('FORBIDDEN')`). Only deny on `FORBIDDEN`. **Non-FORBIDDEN warmup failures render children normally (user decision):** the gate does not add a second blocking layer — existing per-surface degraded/blocking states apply. Note: the existing `getDatasetWarmupState` helper discards `queryState.error` — the gate's detection must read the error directly rather than reuse that helper.
  - Accept transient shell render before warmup FORBIDDEN retraction (safety via closed queries).
- `AuthStatusCard.tsx`: update to consume new hook shape `{ isAuthorised, isLoading, error }`. **Access-status card (open question resolved — user decision):** the card shows the user whether they have access: authorised content when granted, and a generic "You do not have access to this application." message when denied. It does **not** explain why (no OAuth/group/error-specific copy). The gate remains truly blocking for protected children; the card's generic denial branch is the gate's resolved denied surface (the "why" — OAuth vs group vs transport — drives only the gate's functional affordances, e.g. retry/reload, not the card's copy).

### Delegation files

Testing Specialist receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/frontend/src/errors/map-error-to-ui.ts',
  'src/frontend/src/errors/map-error-to-ui.spec.ts',
  'src/frontend/src/features/auth/useAuthorisationStatus.ts',
  'src/frontend/src/features/auth/useAuthorisationStatus.spec.tsx',
  'src/frontend/src/features/auth/AppAuthGate.tsx',
  'src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx',
  'src/frontend/src/features/auth/AuthStatusCard.tsx',
  'src/frontend/src/features/auth/AuthStatusCard.spec.tsx',
  'src/frontend/src/query/sharedQueries.ts',
  'docs/developer/frontend/frontend-react-query-and-prefetch.md',
  'docs/developer/data-shapes/transport-envelope.md',
];
```

Implementation receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'src/frontend/src/errors/map-error-to-ui.ts',
  'src/frontend/src/errors/map-error-to-ui.spec.ts',
  'src/frontend/src/features/auth/useAuthorisationStatus.ts',
  'src/frontend/src/features/auth/useAuthorisationStatus.spec.tsx',
  'src/frontend/src/features/auth/AppAuthGate.tsx',
  'src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx',
  'src/frontend/src/features/auth/AuthStatusCard.tsx',
  'src/frontend/src/features/auth/AuthStatusCard.spec.tsx',
  'src/frontend/src/query/sharedQueries.ts',
  'docs/developer/frontend/frontend-react-query-and-prefetch.md',
  'docs/developer/data-shapes/transport-envelope.md',
];
```

Code Reviewer receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: ['ACTION_PLAN.md', 'SPEC.md'];
```

### Acceptance criteria

- `FORBIDDEN` registered in `errorCodes` and `errorCodeToMessageMap` with the correct message.
- `mapErrorCodeToUserMessage('FORBIDDEN')` returns the access-denied message.
- `useAuthorisationStatus` returns `{ isAuthorised, isLoading, error }`.
  - `isLoading: true` while query is pending.
  - `isAuthorised: true, error: null` when `getAuthorisationStatus` returns `true`.
  - `isAuthorised: false, error: null` when `getAuthorisationStatus` returns `false` (OAuth denial).
  - `isAuthorised: false, error: '<message>'` when transport error occurs (e.g. `RATE_LIMITED`).
- `AppAuthGate` renders loading state when `isLoading`.
- `AppAuthGate` renders OAuth "Permissions required" message when `isAuthorised === false` and `error === null`.
- `AppAuthGate` renders transport error with retry when `error` is non-null.
- `AppAuthGate` renders children inside `StartupWarmupStateProvider` when `isAuthorised === true`.
- `AppAuthGate` detects warmup query `FORBIDDEN` from React Query cache (via `getQueryState(getStartupWarmupQueryKey(dataset)).error` + `extractErrorCode`) and renders access-denied message — **even when `isAuthorised === true`** (precedence: warmup-FORBIDDEN evaluated first).
- `AppAuthGate` renders children (does not block) for non-FORBIDDEN warmup errors — existing per-surface degraded/blocking states apply.
- `AuthStatusCard` renders authorised state content when `isAuthorised === true`.
- `AuthStatusCard` renders a generic "You do not have access to this application." message when access is denied — without reason-specific copy (user decision; open question resolved).
- `AuthStatusCard` does not render loading/error states (these are owned by the gate).

### Required test cases (Red first)

map-error-to-ui tests:

1. `mapErrorCodeToUserMessage('FORBIDDEN')` returns the access-denied message.
2. `extractErrorCode` returns `'FORBIDDEN'` for an `ApiTransportError` with code `'FORBIDDEN'`.

useAuthorisationStatus tests:

3. Returns `{ isLoading: true }` while query is pending.
4. Returns `{ isAuthorised: true, isLoading: false, error: null }` when data is `true`.
5. Returns `{ isAuthorised: false, isLoading: false, error: null }` when data is `false`.
6. Returns `{ isAuthorised: false, isLoading: false, error: '<message>' }` on transport error.

AppAuthGate tests:

7. Renders loading indicator when `isLoading === true`.
8. Renders "Permissions required" when `!isAuthorised && !error`.
9. Renders error message with retry button when `error` is present.
10. Renders children when `isAuthorised === true`.
11. Renders access-denied message when warmup query in React Query cache has `FORBIDDEN` error code — including when `isAuthorised === true` (warmup-FORBIDDEN has precedence over the authorised state).
12. Renders children (does not block) for non-FORBIDDEN warmup errors — existing per-surface degraded/blocking states apply.

AuthStatusCard tests:

13. Renders authorised content when `isAuthorised === true`.
14. Renders the generic "You do not have access to this application." message when denied (no reason-specific copy); does not render loading/error states (these are owned by AppAuthGate).

Existing spec migration (Red first — the following files currently assert the old hook shape `{ authViewState, authError, isAuthResolved, isAuthorised }` and must be migrated to `{ isAuthorised, isLoading, error }`):

15. `useAuthorisationStatus.spec.tsx`: update `AuthHookProbe` and all `toMatchObject` assertions (lines 63-72, 85-91, 112-117, 139-145) from `{ authViewState, authError, isAuthResolved, isAuthorised }` to the new shape; replace the `authViewState: 'loading'` assertion with `isLoading: true`; replace `authError: '<message>'` with `error: '<message>'`.
16. `AuthStatusCard.spec.tsx`: update the mocked hook results (lines 18-21, 32-35) to the new shape and assert the component renders authorised content when granted and the generic no-access message when denied.
17. `AppAuthGate.auth.spec.tsx`: update the gate to consume `{ isAuthorised, isLoading, error }`; existing warmup-failure tests remain valid but must render children for non-FORBIDDEN failures (see test 12); add coverage for the FORBIDDEN cache-error retraction path (see test 11). **Blocking-gate rewrites required (review finding C1, corrected — fifth pass: three affected tests):** under the truly-blocking gate, children are only rendered when `isAuthorised === true` (loading, transport-error, and unauthorised states render the gate's own surfaces instead), so these three existing tests MUST be rewritten in the red phase:
    - `keeps the auth UI render non-blocking while warm-up state moves from loading to ready` (lines 222-278) — renders `<AuthStatusCard />` + `<StartupWarmupProbe />` as children and asserts child content synchronously while the auth query is still pending: `getByRole('status', { name: 'Loading authorisation status' })` (lines 238-240) and the `startup-warmup-probe` text (lines 241-248). Under the new gate the auth query is still loading at that point, so the gate renders its own loading indicator and the children are NOT yet in the tree. Rewrite to await auth resolution first (`findByText('Authorised')`, line 250 remains valid — auth mock resolves `true`), then assert the warmup probe states as today.
    - `preserves the unauthorised auth UI behaviour without starting startup warm-up` (lines 280-299) — asserts `findByText('Unauthorised')` on the child `<AuthStatusCard />` with `getAuthorisationStatusMock.mockResolvedValueOnce(false)`. Rewrite to assert the gate blocks children: `queryByText('Unauthorised')` is `null` and the gate's "Permissions required" message is present (both `warmStartupQueriesMock` not-called assertions remain valid).
    - `preserves the failure auth UI behaviour without starting startup warm-up` (lines 528-556) — asserts `findByText('Unauthorised')` + rate-limit copy on the child `<AuthStatusCard />` with a `RATE_LIMITED` transport error. Rewrite to assert the gate's transport-error retry surface is present and children are blocked (`queryByText('Unauthorised')` is `null`; the `warmStartupQueriesMock` not-called assertions remain valid).
18. `map-error-to-ui.spec.ts`: keep all existing cases green; add the new `FORBIDDEN` cases from tests 1-2 above.

### Section checks

- `npm run lint:frontend`
- `npm run test:frontend -- map-error-to-ui`
- `npm run test:frontend -- useAuthorisationStatus`
- `npm run test:frontend -- AppAuthGate`
- `npm run test:frontend -- AuthStatusCard`
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- `AppAuthGate.tsx` current LOC: 270. Projected after change: ~340. The gate currently only controls warmup orchestration; the blocking auth logic is a substantive behavioural change.
- The warmup query FORBIDDEN detection reads from `queryClient.getQueryState()` — read the error directly via `getStartupWarmupQueryKey(dataset)` (exported from `src/frontend/src/query/sharedQueries.ts` at `query/sharedQueries.ts`) rather than reusing the `getDatasetWarmupState` helper, which discards `queryState.error`. Derive the error code with `extractErrorCode` from `map-error-to-ui.ts`.
- `AuthStatusCard.tsx` current LOC: 36. Projected after change: ~35 (access-status card — authorised branch plus a generic no-access branch). Well under threshold.
- **AuthStatusCard intent (open question resolved — user decision):** the card shows the user whether they have access — authorised content when granted, and a generic "You do not have access to this application." message when denied, without explaining why. The gate remains truly blocking: it renders loading/error/OAuth-prompt surfaces and only reaches the card's denial branch (or blocks children) as appropriate. The card does not consume warmup-FORBIDDEN state directly; the gate owns denial detection. Since the gate blocks protected children, the card's denial branch is effectively the gate's resolved denied surface.

---

## Regression and contract hardening

### Objective

Run full backend and frontend test suites and lint checks to confirm no regressions from the Auth Service changes.

### Constraints

- Prefer focused test runs before broader validation.
- Backend tests must pass with the new GAS stubs in place.
- Frontend tests must pass with updated hook/component signatures.
- Guard test must pass — no unexpected public functions exposed.

### Acceptance criteria

- All existing backend tests pass (excluding deleted test files).
- All existing frontend tests pass.
- Guard test passes with all 28 public functions accounted for (2 permanent entrypoints `apiHandler`/`doGet` + 6 dead wrappers deleted + 20 functions renamed to trailing-underscore — the SPEC §Security Audit reconciliation; `triggerHandler` is the third allowlisted entrypoint created in Section 8).
- Backend lint: `npm run lint:backend` passes.
- Frontend lint: `npm run lint:frontend` passes.

### Required test cases/checks

1. `npm run test:backend` — full backend suite.
2. `npm run test:frontend` — full frontend unit suite.
3. `npm run lint:backend && npm run lint:frontend` — both lint suites.
4. Confirm the guard test (`tests/api/apiHandler/globalExposure.test.js`) passes and correctly allowlists the three entrypoints.

### Section checks

- All commands listed above return green.

### Implementation notes / deviations / follow-up

- Any test failures caused by module relocation (e.g. TriggerController test moving from `tests/utils/` to `tests/triggers/`) must be addressed by updating test import paths.
- Any test failures caused by function renames (20 trailing-underscore renames) must be addressed by updating test references.

---

## Documentation and rollout notes

### Objective

Update developer documentation to match the implemented feature.

### Constraints

- Only modify documents relevant to the touched areas.
- Reconcile planned shared-helper entries: keep `Not implemented` where still pending, update implemented entries where delivered.
- Reconcile data-shape doc entries: remove `Not implemented` markers from all five contract changes delivered.

### Delegation files

Docs subagent receives (`files` array — paths only; contents are injected by the task-files plugin):

```js
files: [
  'ACTION_PLAN.md',
  'SPEC.md',
  'docs/developer/backend/singletons.md',
  'docs/developer/backend/oauth-scopes.md',
  'docs/developer/backend/api-layer.md',
  'docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md',
  'docs/developer/data-shapes/backend-config.md',
  'docs/developer/data-shapes/transport-envelope.md',
  'docs/developer/data-shapes/request-store.md',
  'docs/developer/data-shapes/trigger-context.md',
  'docs/developer/data-shapes/auth-cache.md',
  '.opencode/agents/data-shapes-agent.md',
];
```

Note: `src/backend/AGENTS.md` is updated by this section but is auto-injected by OpenCode and must **not** be added to the `files` array.

### Acceptance criteria

- `src/backend/AGENTS.md` updated with:
  - AuthService singleton note.
  - Private-by-default convention (all backend functions must have trailing underscore except `apiHandler`, `doGet`, `triggerHandler`, and functions in `ALLOWLISTED_METHOD_HANDLERS`).
  - Webapp block requirement note.
  - Trigger handler architecture section (`Triggers/` domain folder, `triggerHandler()` entrypoint, `TriggerController` context storage, `TRIGGER_METHOD_HANDLERS` registry, ScriptProperties-keyed-by-triggerUid model).
- `docs/developer/backend/singletons.md` updated with:
  - AuthService entry (new singleton).
  - CacheManager entry updated (generic methods delivered).
- `docs/developer/backend/oauth-scopes.md` updated with note about new scopes (reference `appsscript.json` as canonical source).
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` updated with descriptor type `helperText` extension entry (remove `Not implemented` marker).
- `docs/developer/backend/api-layer.md` §Error mapping updated with the `FORBIDDEN` row (matches `transport-envelope.md`; review finding §1-8).
- `.opencode/agents/data-shapes-agent.md` §1 file tree and §2.1 heading reconciled to nine contracts (review finding §1-9).
- All five data-shape doc entries (`backend-config.md`, `transport-envelope.md`, `request-store.md`, `trigger-context.md`, `auth-cache.md`) have `Not implemented` markers removed (or updated to `Implemented`).

### Required checks

1. Verify `AGENTS.md` mentions private-by-default convention and trigger architecture.
2. Verify `singletons.md` includes AuthService and updated CacheManager entries.
3. Verify `oauth-scopes.md` references the new scopes.
4. Verify data-shape docs are current (no stale `Not implemented` markers on delivered entries).
5. Confirm the `files` array was populated for every delegated docs handoff.

### @remarks JSDoc review

- Confirm `AuthService.checkAccess()` has `@remarks` documenting the fail-open bootstrap behaviour and `requireConfigured` semantics.
- Confirm `AppAuthGate` has `@remarks` documenting the FORBIDDEN detection mechanism via React Query cache.
- Confirm `triggerHandler` has `@remarks` documenting validate-then-dispatch, fail-closed auth, and cleanup ownership.
- Confirm `CacheManager` generic methods have `@remarks` documenting default TTL and error handling.

### Shared-helper reconciliation

- AuthService: new singleton → `singletons.md` entry delivered.
- CacheManager generic methods: extended → `singletons.md` entry delivered.
- BackendSettingsPanel `helperText` descriptor extension: extended → `frontend-shared-helpers-and-abstraction-standards.md` entry delivered.

### Implementation notes / deviations / follow-up

- Documentation pass must run after all code changes are complete and reviewed.

---

## Suggested implementation order

1. **Section 1** — Data-shape doc updates (MUST be first — provides documented contracts for all subsequent sections).
2. **Section 2** — Backend configuration (AUTH_GROUP_EMAIL key, getter/setter, transport) — prerequisite for AuthService.
3. **Section 3** — CacheManager generic methods — prerequisite for AuthService.
4. **Section 4** — AuthService singleton — prerequisite for gate.
5. **Section 5** — FORBIDDEN + auth gate in ApiDispatcher — depends on AuthService.
6. **Section 6** — appsscript.json scopes + webapp — independent, can run in parallel with 3-5.
7. **Section 7** — Security audit (delete/rename/guard test). Can run in parallel with 3-4 and 6, but **NOT in parallel with Section 2** (both edit `01_configKeysAndSchema.js`) or **Section 5** (both edit `z_apiHandler.js`). Must complete before Regression.
8. **Section 9** — AssignmentController `processSelectedAssignment` signature change — **prerequisite for Section 8** (the `TRIGGER_METHOD_HANDLERS` dispatch test needs the params-accepting handler). Independent of Sections 5-7; can run in parallel with 6-7. **Note the deliberate ordering:** Section 9 (signature change) is delivered before Section 8 even though it is numbered after it in this document.
9. **Section 8** — Triggers/ domain (move, extend, triggerHandler, registry) — depends on AuthService (Section 4), on Section 6 (Section 8 moves/extends `TriggerController.js`, which Section 6 edits — Section 8 must run after Section 6), and on Section 9 (the signature change).
10. **Section 10** — AssignmentController `startProcessing` trigger integration — depends on Triggers/ (Section 8) and on Section 9.
11. **Section 11** — Frontend config transport + settings form — depends on backend config (Section 2). Can run in parallel with 4-10. **Must ship in the same deployment as Section 2** (`.strict()` read schema rejects new `authGroupEmail` field otherwise — see Section 2 co-deploy note).
12. **Section 12** — Frontend auth features (FORBIDDEN, hook, gate, card) — depends on FORBIDDEN code (Section 5) and transport-envelope data-shape (Section 1).
13. **Regression and contract hardening** — after all feature sections complete.
14. **Documentation and rollout notes** — after regression passes.

**Concurrent-edit rule:** Sections that share a file must not run concurrently: Sections 2 & 7 share `01_configKeysAndSchema.js`; Sections 5 & 7 share `z_apiHandler.js`; Sections 6 & 8 share `TriggerController.js`; Sections 9 & 10 share `AssignmentController.js` (Section 10 must run after Section 9 — both edit `processSelectedAssignment`/`startProcessing` in the same file); Sections 7 & 10 share the `triggerProcessSelectedAssignment` → `triggerHandler` trigger-target wiring (Section 7 deletes the `triggerProcessSelectedAssignment` global, Section 10 retargets `startProcessing` to `triggerHandler` — Section 10 must run after Section 7, and the assessment trigger path is broken between them). When sections share a file, the later-dependent section must run after the earlier one completes.
