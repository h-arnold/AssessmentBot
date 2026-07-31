# Feature Delivery Plan (TDD-First) — Auth Service

## Read-First Context

1. Read `SPEC.md` v1.7 — the canonical source of truth for behaviour, contracts, and layout rules.
2. No frontend layout spec was required — this feature does not materially change frontend layout or workflow structure (the auth gate is an existing component made blocking, and the settings form gets one new field in an existing panel).
3. Treat SPEC.md as authoritative; do not restate or redefine material already settled there.

## Scope and assumptions

### Scope

The full Auth Service feature as defined in SPEC.md v1.7:

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

1. `Session.getActiveUser().getEmail()` is available in installable-trigger execution context (to be verified in staging).
2. The `triggerUid` returned by `TriggerController.createTimeBasedTrigger()` equals `event.triggerUid` at trigger fire time (standard GAS behaviour; verify in staging alongside assumption 1).
3. Existing triggers are drained before deployment — old triggers use the UserProperties model and point at the deleted `triggerProcessSelectedAssignment`.
4. GAS stubs (`Session`, `GroupsApp`, `CacheService`) provisioned in the test harness before auth gate tests integrate.
5. Backend files run in concatenated GAS environment; load order matters: `AuthService` must load after `BaseSingleton`; `triggerHandler.js` and `triggerMethodHandlers.js` must load after `TriggerController.js`.

### LOC assessment

| File                              | Current LOC | Projected Δ      | Projected LOC | Over 550?    | Action                                                                                                         |
| --------------------------------- | ----------- | ---------------- | ------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `98_ConfigurationManagerClass.js` | 650         | +30              | 680           | Already >550 | No split — scope changes are minimal (getter/setter only); file was already over threshold before this feature |
| `z_apiHandler.js`                 | 486         | +50              | 536           | No           | Under backend 550-line threshold                                                                               |
| `BackendSettingsPanel.tsx`        | 468         | +20              | 488           | No           | Under general 500-line threshold                                                                               |
| `AssignmentController.js`         | 466         | +30              | 496           | No           | Under 500                                                                                                      |
| `ReferenceDataController.js`      | 436         | 0 (renames only) | 436           | No           | Under 500                                                                                                      |

No mandatory file separation is required for this feature.

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

Implementation (Docs subagent) receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `docs/developer/data-shapes/INDEX.md`
- `docs/developer/data-shapes/backend-config.md`
- `docs/developer/data-shapes/transport-envelope.md`
- `docs/developer/data-shapes/request-store.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `docs/developer/data-shapes/INDEX.md`
- `docs/developer/data-shapes/backend-config.md`
- `docs/developer/data-shapes/transport-envelope.md`
- `docs/developer/data-shapes/request-store.md`
- All new/updated data-shape files produced by this section

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
- `INDEX.md` updated with two new contract file entries (total: nine contracts; update the "All seven contracts" prose).
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

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js`
- `src/backend/ConfigurationManager/02_defaults.js`
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `src/backend/z_Api/apiConfig.js`
- `tests/api/backendConfigApi.test.js` (or equivalent config transport test)
- Any existing ConfigurationManager or apiConfig test files

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js`
- `src/backend/ConfigurationManager/02_defaults.js`
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `src/backend/z_Api/apiConfig.js`
- `docs/developer/data-shapes/backend-config.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All files listed under Testing Specialist and Implementation above
- Any new test files created by this section

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

Backend transport tests:

6. `getBackendConfig_()` includes `authGroupEmail` field with `|| ''` fallback when unset.
7. `getBackendConfig_()` includes `authGroupEmail` field with the stored value when set.
8. `setBackendConfig_()` with `authGroupEmail` in config payload calls `configManager.setAuthGroupEmail()`.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/configurationManager/`
- `npm run test:backend -- tests/api/backendConfigApi.test.js`
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- The `setAuthGroupEmail` setter mirrors the existing per-key setter pattern (e.g. `setBackendUrl`, `setApiKey`).
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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/RequestHandlers/CacheManager.js`
- Any existing CacheManager test files

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/RequestHandlers/CacheManager.js`
- `docs/developer/backend/singletons.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/RequestHandlers/CacheManager.js`
- Any test files created by this section

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
- Denials are never cached.
- `checkAccess(options?)` accepts `{ bypassCache?: boolean, requireConfigured?: boolean }`.
- When `AUTH_GROUP_EMAIL` is empty/missing and `requireConfigured` is falsy: returns `{ allowed: true, role: 'user' }` with `ABLogger.warn` (fail-open bootstrap).
- When `AUTH_GROUP_EMAIL` is empty/missing and `requireConfigured` is true: returns `{ allowed: false }` with `ABLogger.error` (fail-closed for triggers).
- All logging via `ABLogger` (no `console.*`).
- Audit logging: every access attempt (allowed and denied) is logged with user email, method if available, and outcome.
- Must load after `BaseSingleton` in GAS concatenation order (no other load-order requirements).

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/AuthService.js` (to be created — use SPEC.md for contract)
- `src/backend/RequestHandlers/CacheManager.js`
- `tests/setupGlobals.js` (GAS stubs for Session, GroupsApp, CacheService must be added here)

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/RequestHandlers/CacheManager.js`
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `src/backend/Utils/AuthService.js` (new file path)
- `tests/setupGlobals.js` (GAS stubs for Session, GroupsApp, CacheService must be added here)

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/AuthService.js`
- `src/backend/RequestHandlers/CacheManager.js`
- Any test files created by this section
- `docs/developer/backend/singletons.md`

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
- Audit logging via `ABLogger` for every access attempt.

### Required test cases (Red first)

1. Authorised user — cache miss → GroupsApp check → cache set → return `{ allowed: true, role }`.
2. Authorised user — cache hit → return cached result without GroupsApp call.
3. Denied user (not member) — cache miss → GroupsApp check → return `{ allowed: false }`, no cache set.
4. Denied user — cache hit on a previously allowed entry returns cached result (cached denials are never stored).
5. Blank email → deny.
6. GroupsApp error → deny.
7. Group not found → deny.
8. Missing config value, `requireConfigured` falsy → `{ allowed: true, role: 'user' }` with `ABLogger.warn`.
9. Missing config value, `requireConfigured: true` → `{ allowed: false }` with `ABLogger.error`.
10. Role mapping: `OWNER` → `admin`, `MANAGER` → `admin`, `MEMBER` → `user`, `INVITED` → deny, `PENDING` → deny, `BANNED` → deny.
11. `bypassCache: true` always calls GroupsApp despite cache hit.
12. Audit logging: verify `ABLogger` is called for both allowed and denied attempts.

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
- Auth gate inserted after request validation, before `_runAdmissionPhase()`.
- `getAuthorisationStatus` is gate-exempt — skips directly to admission.
- When `AUTH_GROUP_EMAIL` is empty/missing: skip auth check, log warning, proceed to admission (fail-open).
- On denial: return `_failure(requestId, 'FORBIDDEN', 'Access denied.', false)` without proceeding to admission.
- Auth check uses `AuthService.getInstance().checkAccess()`.
- Audit logging handled inside AuthService (not duplicated here).

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/Utils/AuthService.js`
- `tests/setupGlobals.js` (GAS stubs for Session, GroupsApp — needed for auth gate tests)
- Any existing ApiDispatcher test files

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/Utils/AuthService.js`
- `tests/setupGlobals.js` (GAS stubs for Session, GroupsApp — needed for auth gate tests)
- `docs/developer/data-shapes/transport-envelope.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/Utils/AuthService.js`
- Any test files created by this section

### Data-shape planning

This section implements the `FORBIDDEN` error code planned in Section 1 (`docs/developer/data-shapes/transport-envelope.md`). The implementation agent must update the `transport-envelope.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- `FORBIDDEN` registered in `API_ERROR_CODE_MAP` in `z_apiHandler.js`.
- Auth gate runs after request validation, before `_runAdmissionPhase()`.
- `getAuthorisationStatus` method skips the auth gate (gate-exempt).
- When `AUTH_GROUP_EMAIL` is empty: auth gate skipped with `ABLogger.warn`, request proceeds normally (fail-open).
- When auth is denied: `_failure(requestId, 'FORBIDDEN', 'Access denied.', false)` returned, no admission phase runs, no lock consumed.
- When auth is allowed: request proceeds to `_runAdmissionPhase()` normally.

### Required test cases (Red first)

1. Authorised user: gate passes, admission phase runs, handler dispatched.
2. Denied user: gate returns `FORBIDDEN`, admission phase NOT run, no lock consumed.
3. `getAuthorisationStatus` method: gate skipped, admission phase runs normally.
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
- Update `TriggerController.REQUIRED_SCOPES` to include both new scopes.
- Update the stale comment in `TriggerController` about scope synchronisation.
- This is critical: without `userinfo.email`, `Session.getActiveUser().getEmail()` returns blank → all users denied. Without `webapp.executeAs = USER_ACCESSING`, the identity model is unreliable.

### Delegation files

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/appsscript.json`
- `src/backend/Utils/TriggerController.js` (for REQUIRED_SCOPES update)
- `docs/developer/backend/oauth-scopes.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/appsscript.json`
- `src/backend/Utils/TriggerController.js`
- `docs/developer/backend/oauth-scopes.md`

### Acceptance criteria

- `oauthScopes` array in `appsscript.json` includes both `groups` and `userinfo.email` scopes.
- `webapp` block present with `executeAs: USER_ACCESSING` and `access: DOMAIN`.
- `TriggerController.REQUIRED_SCOPES` updated with both new scopes.
- Stale sync-script comment updated to note manual scope sync with `appsscript.json`.

### Required test cases

None — manifest validation is manual. `appsscript.json` is a configuration file; no runtime test needed.

### Section checks

- `npm run lint:backend`
- Manual review of `appsscript.json` to confirm `webapp` block structure.

---

## Section 7 — Security audit: delete dead code, rename public functions, guard test

### Objective

Eliminate all unauthorised public function exposure surface by deleting dead wrapper functions and empty files, renaming 20 internal functions with trailing underscores, and extending the global-exposure guard test to enforce the private-by-default convention.

### Constraints

- **Delete 6 dead wrapper functions** from `AssignmentProcessor/globals.js` (`startProcessing`, `removeTrigger`, `testWorkflow`, `triggerProcessSelectedAssignment`), `y_controllers/globals.js` (`getAllPartialDefinitions`), and `Utils/logError.js` (`logError`).
- **Delete 3 empty source files:** `src/backend/Utils/logError.js`, `src/backend/y_controllers/globals.js`, `src/backend/AssignmentProcessor/globals.js`.
- **Delete 2 corresponding test files:** `tests/utils/logError.test.js`, `tests/assignmentProcessor/globals.test.js`.
- **Rename 20 functions** with trailing underscores across 6 files (see SPEC.md §Security Audit table).
- Update all internal references to use renamed functions.
- Update `module.exports` in each file to export renamed functions.
- **Extend guard test** (`tests/api/apiHandler/globalExposure.test.js`) to scan all backend source files using a **static source scan**: discover files at test time via a glob over `src/backend/**/*.js`, read each file's text, and flag any top-level `function <name>(…)` declaration whose name does not end in `_` and is not in the explicit allowlist (`apiHandler`, `doGet`, `triggerHandler`). This matches GAS's actual exposure rule, avoids load-time `class extends`/`ReferenceError` failures from execution-based scanning, and automatically covers new backend files added in future (satisfying the guard's future-proofing purpose). SPEC §Security (lines 302/802/930) aligns with this method — the static source scan supersedes the legacy execution-based `globalExposure.test.js` helper.

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `tests/api/apiHandler/globalExposure.test.js`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/z_Api/requestStore.js` (rename target — 7 functions)
- `src/backend/z_Api/z_apiHandler.js` (ADD — forced caller of renamed requestStore exports; GAS-branch globals at lines 92–98 and ten `requestStoreFns.<name>()` call sites at lines 232–312)
- `src/backend/ConfigurationManager/03_validators.js` (rename target — 7 functions)
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js` (ADD — forced caller; lines 10, 55, 64, 82-83, 88 reference renamed validators as globals: `validateLogLevel`, `validateApiKey`, `toBooleanString`)
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` (rename target — 2 functions)
- `src/backend/Utils/ABLogger.js` (rename target — 1 function)
- `src/backend/AssignmentProcessor/Assignment/index.js` (rename target — 1 function)
- `src/backend/Models/Cohort.js` (rename target — 1 function)
- `src/backend/y_controllers/ReferenceDataController.js` (rename target — 1 function)
- `src/backend/AssignmentProcessor/globals.js` (DELETE — 4 dead functions)
- `src/backend/y_controllers/globals.js` (DELETE — 1 dead function)
- `src/backend/Utils/logError.js` (DELETE — 1 dead function)
- `tests/api/apiHandler/globalExposure.test.js` (guard test to extend)
- `tests/api/apiHandler/shared.js`
- `tests/api/requestStore.test.js` (references renamed globals)
- `tests/api/requestStore.pruning.test.js` (references renamed globals)
- `tests/setupGlobals.js` (wires renamed ConfigurationManager validators as globals: lines 152-157 reference `validateLogLevel`, `validateApiKey`, `validateClassInfo`, `toBoolean`, `toBooleanString`, `toReadableKey`)
- `tests/configurationManager/validateClassInfo.test.js` (references renamed `validateClassInfo_()`)
- `tests/configurationManager/configurationManager.test.js` (references renamed validators)
- `tests/configurationManager/configurationManagerInternalHelpers.test.js` (references renamed validators)
- `tests/utils/ablogger.test.js` (references renamed `isErrorLike_()`)
- `tests/utils/logError.test.js` (DELETE)
- `tests/assignmentProcessor/globals.test.js` (DELETE)

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All changed/deleted source files (list above)
- All changed test files (list above)
- `tests/api/apiHandler/globalExposure.test.js`

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

---

## Section 8 — Triggers/ domain: TriggerController move/extend, triggerHandler, triggerMethodHandlers

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
- `triggerHandler()` calls `AuthService.checkAccess({ bypassCache: true, requireConfigured: true })` before dispatching.
- Trigger context keys: `trigger:<uid>:method` and `trigger:<uid>:params`.
- Update `TriggerController.createTimeBasedTrigger` hardcoded recovery path from `'triggerProcessSelectedAssignment'` to `'triggerHandler'`.
- Cleanup only runs for known, resolved triggerUid (malformed input does not trigger cleanup).

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/TriggerController.js` (current location — the move to Triggers/ happens during implementation; this provides source context for red-phase tests)
- `src/backend/Triggers/TriggerController.js` (moved path — contract reference for tests)
- `src/backend/Triggers/triggerHandler.js` (new file — contract from SPEC)
- `src/backend/Triggers/triggerMethodHandlers.js` (new file — contract from SPEC)
- `src/backend/Utils/AuthService.js`
- Any existing TriggerController test file (to be relocated)

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/TriggerController.js` (current location)
- `src/backend/Utils/AuthService.js`
- `src/backend/Utils/00_GASPropertiesUtils.js`
- `src/backend/y_controllers/AssignmentController.js`
- `docs/developer/data-shapes/trigger-context.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All files listed under Testing Specialist and Implementation above
- Any new test files created by this section

### Data-shape planning

This section implements the trigger-context storage shape planned in Section 1 (`docs/developer/data-shapes/trigger-context.md`). The implementation agent must update the `trigger-context.md` entry to remove the `Not implemented` marker after delivery.

### Acceptance criteria

- `Triggers/` domain folder exists at `src/backend/Triggers/`.
- `TriggerController.js` moved from `Utils/` to `Triggers/`.
- All `console.*` calls in `TriggerController.js` replaced with `ABLogger`.
- `storeTriggerContext`, `getTriggerContext`, `clearTriggerContext` methods exist and use `GASPropertiesUtils` with ScriptProperties keys `trigger:<uid>:method` and `trigger:<uid>:params`.
- `triggerHandler(event)` validates input: missing event → log error, unknown triggerUid → `INVALID_REQUEST`, unknown method → `UNKNOWN_METHOD`.
- `triggerHandler()` calls `AuthService.checkAccess({ bypassCache: true, requireConfigured: true })` before dispatch.
- On auth denial: log, abort, clean up trigger context.
- On success: retrieve context, dispatch to handler, clean up in `finally`, delete trigger.
- `TRIGGER_METHOD_HANDLERS` registry maps `processSelectedAssignment` to `AssignmentController.processSelectedAssignment()`.
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
9. Unknown triggerUid: `INVALID_REQUEST` returned.
10. Unknown method: `UNKNOWN_METHOD` returned.
11. Unconfigured group with `requireConfigured: true` → auth denied.
12. Cache bypass used (`bypassCache: true` passed to `checkAccess`).

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/triggers/` (relocated test path)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- The existing `tests/utils/triggerController.test.js` must be relocated to `tests/triggers/`.
- `triggerHandler` is a new public entrypoint — the guard test allowlist must include it (already planned in Section 7).
- `TriggerController.js` current LOC: 100. After move + ABLogger conversion + context methods: ~170. Well under threshold.

---

## Section 9 — AssignmentController trigger integration

### Objective

Update `AssignmentController.startProcessing()` to use the new trigger context storage model (ScriptProperties via TriggerController) and update `processSelectedAssignment()` to accept params directly instead of reading from UserProperties.

### Constraints

- `startProcessing()` creates trigger pointing at `triggerHandler` (not `triggerProcessSelectedAssignment`).
- `startProcessing()` stores task context via `TriggerController.storeTriggerContext(triggerUid, { method: 'processSelectedAssignment', params: { assignmentId, definitionKey, courseId } })`.
- `processSelectedAssignment()` accepts params directly: `processSelectedAssignment({ assignmentId, definitionKey, courseId })`.
- No longer reads from or writes to UserProperties for task context.
- No longer cleans up trigger context or deletes the trigger — `triggerHandler()` owns all cleanup.
- Must keep existing `createTimeBasedTrigger` integration — only the target function name and context storage change.

### Data-shape planning

Consumes the `trigger-context.md` shape (created Section 1, implemented Section 8); no new data-shape entry required here.

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- `src/backend/Triggers/TriggerController.js`
- Any existing AssignmentController test files

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- `src/backend/Triggers/TriggerController.js`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- Any test files created by this section

### Acceptance criteria

- `startProcessing()` stores context via `TriggerController.storeTriggerContext()` with correct method and params.
- `startProcessing()` creates trigger pointing at `'triggerHandler'`.
- `processSelectedAssignment({ assignmentId, definitionKey, courseId })` uses params directly.
- No UserProperties reads/writes for task context remain.
- No trigger cleanup in `processSelectedAssignment()` — that is owned by `triggerHandler()`.

### Required test cases (Red first)

1. `startProcessing()` calls `TriggerController.storeTriggerContext()` with correct `triggerUid`, method `'processSelectedAssignment'`, and params `{ assignmentId, definitionKey, courseId }`.
2. `startProcessing()` creates trigger with `triggerHandler` as the target function.
3. `processSelectedAssignment()` accepts direct params and does not read from UserProperties.
4. `processSelectedAssignment()` does not clean up trigger context or delete trigger.

### Section checks

- `npm run lint:backend`
- `npm run test:backend -- tests/controllers/assignmentController/` (or equivalent path)
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- `AssignmentController.js` current LOC: 466. Projected after change: ~496. Under 500-line threshold.

---

## Section 10 — Frontend: config transport + settings form

### Objective

Add `authGroupEmail` to the frontend backend config transport schema, form schema, form mapper, and settings panel with descriptor type extension and declarative helper text.

### Constraints

- `BackendConfigSchema` (read): add `authGroupEmail: z.union([z.literal(''), z.email()]).optional()`.
- `BackendConfigWriteInputSchema` (write): add `authGroupEmail: z.union([z.literal(''), z.email()]).optional()`.
- `BackendSettingsFormSchema`: add `authGroupEmail` as `z.union([z.literal(''), z.email()])` (blank-tolerant, follows `jsonDbRootFolderId` idiom for form-level blank handling). Form-level compulsory-once-set rule: clearing a previously-set value is rejected. Enforced in `useBackendSettings.ts` using the loaded `backendSettingsFormValues.authGroupEmail` baseline (mirrors the existing `hasApiKey` pattern); `BackendSettingsPanel.handleFinish` surfaces the rejection.
- `backendSettingsFormMapper.ts`: map `authGroupEmail` in both directions.
- `BackendSettingsPanel.tsx`:
  - Extend `BackendSettingsFieldDescriptor` type with `helperText?: string`.
  - Add `authGroupEmail` to `backendSettingsFieldNames` array.
  - Add field descriptor with static `helperText`.
  - Keep existing `apiKey` dynamic helper case preserved.
  - Use declarative helper text rendering in the field render loop.

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `src/frontend/src/features/settings/backend/useBackendSettings.ts` (owns compulsory-once-set baseline)
- Any existing spec files for these modules

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `src/frontend/src/features/settings/backend/useBackendSettings.ts` (owns compulsory-once-set baseline)
- `docs/developer/data-shapes/backend-config.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All files listed under Testing Specialist and Implementation above
- Any spec files created by this section

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
- Form-level compulsory-once-set rule: clearing a previously-set `authGroupEmail` value is rejected.

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
11. Clearing a previously-set value triggers form-level compulsory-once-set rejection.

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

## Section 11 — Frontend: FORBIDDEN registration + useAuthorisationStatus + AppAuthGate + AuthStatusCard

### Objective

Register the `FORBIDDEN` error code in the frontend error mapping, update the `useAuthorisationStatus` hook contract, make `AppAuthGate` truly blocking, and simplify `AuthStatusCard`.

### Constraints

- `map-error-to-ui.ts`: add `FORBIDDEN` to `errorCodes` object and `errorCodeToMessageMap` with message: `'You do not have permission to access this application. Please contact your administrator.'`.
- `useAuthorisationStatus.ts`: update return type to `{ isAuthorised: boolean, isLoading: boolean, error: string | null }`. `error` captures transport failures only; does NOT observe `FORBIDDEN`.
- `AppAuthGate.tsx`:
  - Make truly blocking: wrap around `StartupWarmupStateProvider`.
  - Consume `{ isAuthorised, isLoading, error }` from `useAuthorisationStatus`.
  - `isLoading === true`: render loading indicator.
  - `error` non-null: render transport error with retry option (retry invalidates the `getAuthorisationStatus` query via `queryClient.invalidateQueries`).
  - `isAuthorised === false`: render "Permissions required" message (recoverable — OAuth denial).
  - `isAuthorised === true`: render children inside `StartupWarmupStateProvider`.
  - Group-denial detection: read warmup query error from React Query cache; if error code is `'FORBIDDEN'`, replace children with access-denied message from `map-error-to-ui.ts`. Only deny on `FORBIDDEN`; other warmup failures are surfaced as errors.
  - Accept transient shell render before warmup FORBIDDEN retraction (safety via closed queries).
- `AuthStatusCard.tsx`: update to consume new hook shape `{ isAuthorised, isLoading, error }`. Simplified — renders only authorised state content (loading/OAuth-denied/error/group-denied states subsumed by the gate).

### Delegation files

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/errors/map-error-to-ui.ts`
- `src/frontend/src/features/auth/useAuthorisationStatus.ts`
- `src/frontend/src/features/auth/AppAuthGate.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- Any existing spec files for these modules

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/errors/map-error-to-ui.ts`
- `src/frontend/src/features/auth/useAuthorisationStatus.ts`
- `src/frontend/src/features/auth/AppAuthGate.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/data-shapes/transport-envelope.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All files listed under Testing Specialist and Implementation above
- Any spec files created by this section

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
- `AppAuthGate` detects warmup query `FORBIDDEN` from React Query cache and renders access-denied message.
- `AuthStatusCard` renders authorised state content when `isAuthorised === true`.
- `AuthStatusCard` does not render denial/loading/error states (these are owned by the gate).

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
11. Renders access-denied message when warmup query in React Query cache has `FORBIDDEN` error code.
12. Does NOT render access-denied for non-FORBIDDEN warmup errors.

AuthStatusCard tests:

13. Renders authorised content when `isAuthorised === true`.
14. Does not render loading/error/denied states (these are owned by AppAuthGate).

### Section checks

- `npm run lint:frontend`
- `npm run test:frontend -- map-error-to-ui`
- `npm run test:frontend -- useAuthorisationStatus`
- `npm run test:frontend -- AppAuthGate`
- `npm run test:frontend -- AuthStatusCard`
- Confirm `files` array populated for every delegated handoff.

### Implementation notes / deviations / follow-up

- `AppAuthGate.tsx` current LOC: 270. Projected after change: ~340. The gate currently only controls warmup orchestration; the blocking auth logic is a substantive behavioural change.
- The warmup query FORBIDDEN detection reads from `queryClient.getQueryState()` — follow the existing `getDatasetWarmupState` pattern for accessing query cache.
- `AuthStatusCard.tsx` current LOC: 36. Projected after change: ~30 (simplified). Well under threshold.

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
- Guard test passes with all 28 public functions accounted for.
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
8. **Section 8** — Triggers/ domain (move, extend, triggerHandler, registry) — depends on AuthService (Section 4) AND on Section 6 (Section 8 moves/extends `TriggerController.js`, which Section 6 edits — Section 8 must run after Section 6).
9. **Section 9** — AssignmentController trigger integration — depends on Triggers/ (Section 8).
10. **Section 10** — Frontend config transport + settings form — depends on backend config (Section 2). Can run in parallel with 4-9. **Must ship in the same deployment as Section 2** (`.strict()` read schema rejects new `authGroupEmail` field otherwise — see Section 2 co-deploy note).
11. **Section 11** — Frontend auth features (FORBIDDEN, hook, gate, card) — depends on FORBIDDEN code (Section 5) and transport-envelope data-shape (Section 1).
12. **Regression and contract hardening** — after all feature sections complete.
13. **Documentation and rollout notes** — after regression passes.

**Concurrent-edit rule:** Sections that share a file must not run concurrently: Sections 2 & 7 share `01_configKeysAndSchema.js`; Sections 5 & 7 share `z_apiHandler.js`; Sections 6 & 8 share `TriggerController.js`. When sections share a file, the later-dependent section must run after the earlier one completes.
