# Feature Delivery Plan (TDD-First) — Auth Service

## Execution progress (orchestrator-maintained)

| Section                                 | Status       | Commit                                     |
| --------------------------------------- | ------------ | ------------------------------------------ |
| 1. Data-shape doc updates               | ✅ Completed | `55456dd` (pushed)                         |
| 2. Backend config AUTH_GROUP_EMAIL      | ✅ Completed | `b9c2633` (red) / `HEAD` (green, unpushed) |
| 3. CacheManager generic methods         | Pending      | —                                          |
| 4. AuthService singleton                | Pending      | —                                          |
| 5. FORBIDDEN + auth gate                | Pending      | —                                          |
| 6. appsscript.json scopes + webapp      | Pending      | —                                          |
| 7. Security audit                       | Pending      | —                                          |
| 8. Triggers/ domain                     | Pending      | —                                          |
| 9. processSelectedAssignment signature  | Pending      | —                                          |
| 10. startProcessing trigger integration | Pending      | —                                          |
| 11. Frontend config transport + form    | Pending      | —                                          |
| 12. Frontend auth features              | Pending      | —                                          |
| Regression + contract hardening         | Pending      | —                                          |
| Documentation + rollout notes           | Pending      | —                                          |

### Execution log (orchestrator-maintained)

- **Section 1** — delivered, reviewed clean, committed `55456dd`, pushed to `feature/auth-service`.
- **Section 2 (red)** — completed and reviewed clean:
  - New: `tests/configurationManager/configurationManagerAuthGroupEmail.test.js` (13 model/schema tests), `tests/api/backendConfigAuthGroupEmail.test.js` (3 transport tests).
  - Modified (test infra): `tests/helpers/backendConfigTestHelpers.js` (+3 lines: `authGroupEmail: ''` value + `getAuthGroupEmail`/`setAuthGroupEmail` vi.fn).
  - Red suite confirmed failing (16 expected failures) against current code; lint clean.
- **Section 2 (green)** — **NOT started.** The implementation handoff was interrupted before any production file was modified (`git diff` shows no `src/backend` changes). Resume by re-delegating the green implementation per the section's contract.
- **Section 2 (green, completed 2026-08-02):** implemented and reviewed clean. Production changes: `AUTH_GROUP_EMAIL` key/schema/defaults/getter/setter, compulsory-once-set guard in the `CONFIG_SCHEMA` validator, transport emission + write path in `apiConfig.js`; test-helper sync (`authGroupEmail: ''` in `buildBackendConfigResponse()`); `backend-config.md` markers removed for delivered entries (Section 11 frontend markers retained). Data-shape canonical pass corrected write-side field counts (12 writable = 11 documented + `revokeAuthTriggerSet`; frontend `BackendConfigWriteInputSchema` 11 fields). 31/31 tests pass; lint 0 errors. Coverage follow-up (non-blocking, from code review): no explicit transport-level test drives a `setBackendConfig` payload with `authGroupEmail: ''` against a stored value asserting the aggregated rejection envelope — model-level coverage exists.
- **Worktree hygiene (2026-08-01):** a concurrent process committed `41aabff` (task-files plugin: `files` schema-required) and has uncommitted model-field edits in `.opencode/agents/{data-shapes-agent,docs,implementation,testing-specialist}.md` (`opencode/deepseek-v4-flash-free` → `openrouter/poolside/laguna-s-2.1:free`). These are **not** part of this feature — do not stage them in feature commits; decide separately.

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

| File                              | Current LOC | Projected Δ      | Projected LOC | Over 550?    | Action                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------- | ---------------- | ------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `98_ConfigurationManagerClass.js` | 650         | +30              | 680           | Already >550 | **Documented AGENTS §11 deviation:** no split this feature — scope changes are minimal (2 renames in §7 + `getAuthGroupEmail`/`setAuthGroupEmail` in §2); file was already over the 550-line threshold before this feature. Facade decomposition (per `src/backend/AGENTS.md` §11) is deferred to a tracked follow-up. |
| `z_apiHandler.js`                 | 486         | +50              | 536           | No           | Under backend 550-line threshold                                                                                                                                                                                                                                                                                       |
| `BackendSettingsPanel.tsx`        | 468         | +20              | 488           | No           | Under general 500-line threshold                                                                                                                                                                                                                                                                                       |
| `AssignmentController.js`         | 466         | +30              | 496           | No           | Under 500                                                                                                                                                                                                                                                                                                              |
| `ReferenceDataController.js`      | 436         | 0 (renames only) | 436           | No           | Under 500                                                                                                                                                                                                                                                                                                              |

No mandatory file separation is required for this feature. **Known deviation (AGENTS §11):** `98_ConfigurationManagerClass.js` is 650 lines (over the 550-line non-API threshold) and is intentionally NOT decomposed in this feature — the changes are additive (one getter/setter pair) plus two renames, and the file was already over threshold before this feature. A facade-pattern decomposition (per `src/backend/AGENTS.md` §11) is tracked as a separate follow-up and is out of scope here.

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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/ConfigurationManager/01_configKeysAndSchema.js`
- `src/backend/ConfigurationManager/02_defaults.js`
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `src/backend/z_Api/apiConfig.js`
- `tests/api/backendConfigApi.test.js` (or equivalent config transport test)
- Any existing ConfigurationManager or apiConfig test files
- `docs/developer/data-shapes/backend-config.md`

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
- `docs/developer/data-shapes/auth-cache.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/RequestHandlers/CacheManager.js`
- `docs/developer/data-shapes/auth-cache.md`
- `docs/developer/backend/singletons.md`
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
- **CacheManager instantiation (third-pass review finding I5):** `AuthService` must obtain CacheManager via `new CacheManager()` (the established pattern — `LLMRequestManager.js:23` uses `new CacheManager()`; CacheManager is a plain instantiable class, **not** a singleton). Do NOT convert CacheManager into a singleton as part of this section.
- Denials are never cached.
- `checkAccess(options?)` accepts `{ bypassCache?: boolean, requireConfigured?: boolean, method?: string }`. When `method` is provided it is included in the audit log entry (the "method if available" the SPEC audit contract promises). The API gate passes `request.method`; `triggerHandler` passes the trigger method resolved from context.
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
- `docs/developer/data-shapes/auth-cache.md`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/RequestHandlers/CacheManager.js`
- `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `src/backend/Utils/AuthService.js` (new file path)
- `tests/setupGlobals.js` (GAS stubs for Session, GroupsApp, CacheService must be added here)
- `docs/developer/data-shapes/auth-cache.md`
- `docs/developer/backend/singletons.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/AuthService.js`
- `src/backend/RequestHandlers/CacheManager.js`
- `docs/developer/data-shapes/auth-cache.md`
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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/Utils/AuthService.js`
- `tests/setupGlobals.js` (GAS stubs for Session, GroupsApp — needed for auth gate tests)
- Any existing ApiDispatcher test files
- `docs/developer/data-shapes/transport-envelope.md`

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
- `docs/developer/data-shapes/transport-envelope.md`
- Any test files created by this section

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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `tests/api/apiHandler/globalExposure.test.js`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/z_Api/requestStore.js` (rename target — 7 functions)
- `src/backend/z_Api/z_apiHandler.js` (ADD — forced caller of renamed requestStore exports; GAS-branch globals at lines 92–98 and ten `requestStoreFns.<name>()` call sites at lines 232–312). The GAS branch also builds a `requestStoreFns = { loadStore, saveStore, createStartedRecord, markSuccess, markError, compactStore, pruneStaleEntries }` object from global names (lines 85–99) — after the rename these must reference the renamed globals or the GAS bundle breaks while Node tests pass (second-pass review finding I5).
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
- `docs/developer/data-shapes/request-store.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All changed/deleted source files (list above)
- All changed test files (list above)
- `tests/api/apiHandler/globalExposure.test.js`
- `docs/developer/data-shapes/request-store.md`

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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/TriggerController.js` (current location — the move to Triggers/ happens during implementation; this provides source context for red-phase tests)
- `src/backend/Triggers/TriggerController.js` (moved path — contract reference for tests)
- `src/backend/Triggers/triggerHandler.js` (new file — contract from SPEC)
- `src/backend/Triggers/triggerMethodHandlers.js` (new file — contract from SPEC)
- `src/backend/Utils/AuthService.js`
- Any existing TriggerController test file (to be relocated)
- `docs/developer/data-shapes/trigger-context.md`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/Utils/TriggerController.js` (current location)
- `src/backend/Triggers/TriggerController.js` (moved path — target)
- `src/backend/Triggers/triggerHandler.js` (new file — target)
- `src/backend/Triggers/triggerMethodHandlers.js` (new file — target)
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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- Any existing AssignmentController test files

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- Any test files created by this section

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

- `AssignmentController.js` current LOC: 466. Projected after change: ~486. Under 500-line threshold.
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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- `src/backend/Triggers/TriggerController.js`
- `src/backend/Triggers/triggerMethodHandlers.js`
- Any existing AssignmentController test files
- `docs/developer/data-shapes/trigger-context.md`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- `src/backend/Triggers/TriggerController.js`
- `src/backend/Triggers/triggerMethodHandlers.js`
- `docs/developer/data-shapes/trigger-context.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/backend/y_controllers/AssignmentController.js`
- `src/backend/Triggers/TriggerController.js`
- `src/backend/Triggers/triggerMethodHandlers.js`
- `docs/developer/data-shapes/trigger-context.md`
- Any test files created by this section

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

- `AssignmentController.js` current LOC: 466. Projected after change: ~496. Under 500-line threshold.
- This section MUST be delivered after Section 8 (needs `TriggerController.storeTriggerContext`) and after Section 9 (needs the params-accepting `processSelectedAssignment`).

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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `src/frontend/src/features/settings/backend/useBackendSettings.ts` (owns compulsory-once-set baseline)
- Any existing spec files for these modules
- `docs/developer/data-shapes/backend-config.md`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`
- `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `src/frontend/src/features/settings/backend/useBackendSettings.ts` (owns compulsory-once-set baseline)
- `docs/developer/data-shapes/backend-config.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

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

Testing Specialist receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/errors/map-error-to-ui.ts`
- `src/frontend/src/errors/map-error-to-ui.spec.ts`
- `src/frontend/src/features/auth/useAuthorisationStatus.ts`
- `src/frontend/src/features/auth/useAuthorisationStatus.spec.tsx`
- `src/frontend/src/features/auth/AppAuthGate.tsx`
- `src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.spec.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/data-shapes/transport-envelope.md`

Implementation receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `src/frontend/src/errors/map-error-to-ui.ts`
- `src/frontend/src/errors/map-error-to-ui.spec.ts`
- `src/frontend/src/features/auth/useAuthorisationStatus.ts`
- `src/frontend/src/features/auth/useAuthorisationStatus.spec.tsx`
- `src/frontend/src/features/auth/AppAuthGate.tsx`
- `src/frontend/src/features/auth/AppAuthGate.auth.spec.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.tsx`
- `src/frontend/src/features/auth/AuthStatusCard.spec.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/data-shapes/transport-envelope.md`

Code Reviewer receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- All files listed under Testing Specialist and Implementation above

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

Docs subagent receives:

- `ACTION_PLAN.md`
- `SPEC.md`
- `docs/developer/backend/singletons.md`
- `docs/developer/backend/oauth-scopes.md`
- `docs/developer/backend/api-layer.md` (add `FORBIDDEN` row to §Error mapping — review finding §1-8)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/data-shapes/backend-config.md`
- `docs/developer/data-shapes/transport-envelope.md`
- `docs/developer/data-shapes/request-store.md`
- `docs/developer/data-shapes/trigger-context.md`
- `docs/developer/data-shapes/auth-cache.md`
- `.opencode/agents/data-shapes-agent.md` (§1 file tree and §2.1 "seven contracts" heading drift — review finding §1-9)

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
