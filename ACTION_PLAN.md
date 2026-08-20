# Auth-Mode Bypass Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `@SPEC.md` — the Auth Service specification. The v1.9 increment ("Auth-mode bypass
   increment (v1.9)") at the end of the file is the source of truth for this feature; the v1.8
   body documents the already-delivered Google Groups gate that this feature builds on.
2. Read `@docs/developer/data-shapes/backend-config.md` — the BackendConfig contract, which now
   carries planned `authMode` rows marked `[Not implemented — planned]`.
3. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
   Do not restate or redefine settled material.

## Scope and assumptions

### Scope

Add an opt-in "authentication options" setting (`authMode`: `googleGroups` | `none`) that, when set
to `none`, makes the backend group-membership gate (`AuthService.checkAccess`) always authorise the
caller as a plain `user`. The OAuth scope-authorisation check is **unchanged**. The bypass covers
both the interactive API gate and trigger execution, and is commented in code as a temporary,
security-sensitive development measure.

Files in scope:

- Backend: `src/backend/ConfigurationManager/01_configKeysAndSchema.js`,
  `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`,
  `src/backend/Utils/AuthService.js`, `src/backend/z_Api/apiConfig.js`.
- Frontend: `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`,
  `src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`,
  `src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`,
  `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`.
- Docs: `docs/developer/data-shapes/backend-config.md` (already seeded with planned entries),
  `src/backend/AGENTS.md` (one-line note in §2.3).

### Out of scope

- Any change to the OAuth scope-authorisation check (`ScriptAppManager.isAuthorised()`,
  `getAuthorisationStatus`, `AppAuthGate`, `useAuthorisationStatus`).
- Removing the `groups` / `userinfo.email` scopes from `appsscript.json` while `none` is selected.
- Decomposing `ConfigurationManager/98_ConfigurationManagerClass.js` or
  `BackendSettingsPanel.tsx` (both already exceed the size threshold; see LOC notes — deferred as a
  separate refactor).
- A frontend layout spec is **not** required: this is a single `Select` field added to an existing
  form via the existing declarative descriptor pattern (identical precedent: `authGroupEmail` and
  `jsonDbLogLevel`). No new page/tab/modal/workflow or form restructure is introduced.

### Assumptions

1. `authMode` values are the exact literals `googleGroups` (default) and `none`.
2. The getter enforces the secure default itself (`none` only for the literal `none`, otherwise
   `googleGroups`); no `02_defaults.js` entry is added, matching `getAuthGroupEmail()`.
3. The frontend read schema marks `authMode` `.optional()` (deploy-order tolerance, same rationale
   as `authGroupEmail`), and the form mapper defaults a missing value to `googleGroups`.

---

## Baseline technical debt (accepted — recorded at plan start)

The regression checker (`npm run regression-checker`, branch `feature/auth-service`) was run
before any code change. It reported `Overall Status: FAILING` with **2 failing checks**, both
pre-existing on the branch and **out of scope** for this plan:

1. **`backend-lint-check` (eslint) — 14 `max-lines` failures.** Includes
   `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js` (669 lines) and
   `src/backend/z_Api/z_apiHandler.js` (513 lines). This plan's §1 and §2 explicitly note these
   files already exceed the 500-line threshold and decomposition is deferred (see §Regression
   follow-up in §7). Adding ~16 lines to `98_ConfigurationManagerClass.js` keeps it failing on the
   same pre-existing `max-lines` rule (no new distinct failure introduced).
2. **`frontend-e2e-check` (playwright) — failing.** This plan makes no E2E/Playwright changes
   (all frontend work is Vitest unit tests for Zod schemas, mapper, and panel). The E2E suite
   failure is pre-existing environment/branch debt and is not gated by this plan.

**§4 accepted debt (user-authorised Regression Gate override):** §4 made `authMode` a **required**
field of `BackendSettingsFormSchema`. The consumer `backendSettingsFormMapper.ts` (and the panel
form values it feeds via `form.setFieldsValue`) do not yet populate `authMode`, so
`BackendSettingsFormSchema.safeParse(...)` now fails inside `BackendSettingsPanel.tsx` and the
regression checker reports **3 new failing tests** in `BackendSettingsPanel.spec.tsx`
(`binds boolean and numeric fields through Ant Design form state`,
`moves focus to the first invalid field after submit failure`,
`sets a field error and skips the save when a configured auth group email is cleared on submit`).
These failures are expected and will be cleared by §5 (mapper `authMode` mapping + dropdown control).
By explicit user decision the §4 Regression Gate is overridden on this occasion, and these 3 panel
test failures are recorded as accepted §4 debt rather than blocking the §4 commit.

**§4 max-lines growth (extension of debt item 1):** §1 (+~28 lines to `98_ConfigurationManagerClass.js`)
and §3 (+~107 lines to `backendConfigApi.test.js`, with `z_apiHandler.js` also rising) increased the
already-documented `max-lines` debt. These are the same pre-existing rule firing on larger files, not a
distinct new failure, and remain accepted debt.

**Regression-gate policy for this plan:** Because the agreed scope cannot clear the pre-existing
checks, the Regression Gate per section is satisfied by (a) the section's own `Section checks`
commands passing, and (b) no _new_ lint error or test failure being introduced beyond the
already-documented `max-lines` debt and the §4 accepted panel-test debt above. The full
regression-checker is re-run at §7 for a final comparison; any newly-introduced regression there
blocks completion.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin; add the getter/setter to `ConfigurationManager` following the existing
  `getAuthGroupEmail`/`setAuthGroupEmail` pattern.
- Fail fast on invalid config values; do not add defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments, docs, and user-facing text.
- Backend logging via `ABLogger` only; no `console.*`.
- The `none` bypass must carry a prominent code comment marking it as a **temporary development
  measure** with a security caveat (user requirement).

### TDD workflow (mandatory per section)

For each section: **Red** (write failing tests) → **Green** (smallest passing change) →
**Refactor** (tidy, tests still green) → run section-level verification commands.

### Delegation mandatory-read gate

Each delegated handoff (Testing Specialist, Implementation, Code Reviewer, Docs, Data Shapes Agent)
must include a `Mandatory Reading` list of `@`-prefixed paths and a `Files read` evidence block.
Block progression if any mandatory file is missing from `Files read`.

### Shared-helper planning gate

Sections that introduce helper reuse/extension/new abstraction record a helper plan block and add
planned entries to the relevant canonical docs with status `Not implemented` before implementation.

### Data-shape planning gate

Any section that changes a schema/persistence/transport shape references the relevant data-shape
doc and the planned entry (already recorded in `backend-config.md`). The Data Shapes Agent flips
`Not implemented` → implemented as code lands.

### Validation commands

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`

---

## Section 1 — Backend: `AUTH_MODE` config key, schema, getter, and setter

### Objective

Add the `AUTH_MODE` (`authMode`) configuration key to `ConfigurationManager`, with a
secure-by-default getter and an enum-validated setter, without any `02_defaults.js` change.

### Constraints

- Add `AUTH_MODE: 'authMode'` to `CONFIG_KEYS` and a `CONFIG_SCHEMA` entry (storage `script`) with
  an inline enum validator accepting only `none` and `googleGroups`.
- `getAuthMode()` must be implemented exactly as the secure fallback (do **not** copy the raw-return
  shape of `getAuthGroupEmail()`):

  ```javascript
  getAuthMode() {
    const value = this.getProperty(ConfigurationManager.CONFIG_KEYS.AUTH_MODE);
    return value === 'none' ? 'none' : 'googleGroups';
  }
  ```

  This prevents a malformed stored value (e.g. `'foo'`) from being emitted by `getBackendConfig_()`
  and rejected by the frontend `z.enum(...)` under `.strict()`.

- `setAuthMode(value)` delegates to `this.setProperty(CONFIG_KEYS.AUTH_MODE, value)`; the
  `CONFIG_SCHEMA` validator rejects invalid values so they surface as an aggregated
  `setBackendConfig` error via the existing `safeSet` path.
- **LOC assessment:** `98_ConfigurationManagerClass.js` is 669 lines → ~685 after this change (the
  550-line backend decomposition threshold is already exceeded). Decomposing it is **out of scope**
  for this feature (a dedicated facade-pattern refactor is deferred — see §Regression follow-up).
  `01_configKeysAndSchema.js` is 131 → ~140 (no action needed).

### Delegation mandatory reads

- `@SPEC.md` (v1.9 increment)
- `@docs/developer/data-shapes/backend-config.md`
- `@src/backend/ConfigurationManager/01_configKeysAndSchema.js`
- `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `@src/backend/ConfigurationManager/02_defaults.js`
- `@src/backend/AGENTS.md`

### Shared helper plan

1. Helper: enum validation for `authMode`.
   - Decision: `keep local` (inline `CONFIG_SCHEMA` validator, precedent: `AUTH_GROUP_EMAIL`).
   - Owning module/path: `src/backend/ConfigurationManager/01_configKeysAndSchema.js`.
   - Call-site rationale: two-value enum with a secure default; no reusable generic validator is
     warranted yet.
   - Relevant canonical doc target: `docs/developer/data-shapes/backend-config.md`.
   - Planned doc status: `Not implemented` (already recorded).

### Data-shape planning

- `authMode` is a new BackendConfig field. The planned entries are already recorded in
  `@docs/developer/data-shapes/backend-config.md` (persistence row 14, read/write transport rows,
  validation note, discrepancy #8) marked `[Not implemented — planned]`. This section implements the
  persistence side; the Data Shapes Agent reconciles in §6.

### Acceptance criteria

- `getAuthMode()` returns `googleGroups` when unset, blank, or any value other than `none`.
- `getAuthMode()` returns `none` only when the stored value is exactly `none`.
- `setAuthMode('none')` and `setAuthMode('googleGroups')` persist; `setAuthMode('foo')` throws.
- `CONFIG_SCHEMA[AUTH_MODE]` rejects invalid values on the `setProperty` path.

### Required test cases (Red first)

Backend (ConfigurationManager) — extend or mirror
`@tests/configurationManager/configurationManagerAuthGroupEmail.test.js`:

1. `getAuthMode()` returns `googleGroups` when no value is stored.
2. `getAuthMode()` returns `googleGroups` when a blank value is stored.
3. `getAuthMode()` returns `googleGroups` when an unknown value (e.g. `'foo'`) is stored.
4. `getAuthMode()` returns `none` when `'none'` is stored.
5. `setAuthMode('none')` persists and round-trips through `getAuthMode()`.
6. `setAuthMode('foo')` throws (invalid enum).
7. `CONFIG_SCHEMA` validator returns the canonical value for valid inputs (`'none'` → `'none'`,
   `'googleGroups'` → `'googleGroups'`) and throws on `'foo'`. (The validator's _return_ value is
   what `setProperty` serialises — see `98_ConfigurationManagerClass.js` — so this assertion guards
   the round-trip, not just the throw.)

### Section checks

- `npm run test:backend -- tests/configurationManager`
- `npm run lint:backend`
- Shared-helper and data-shape planning entries present (above).
- Mandatory-read evidence gate passed for delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` on `getAuthMode()` explaining the secure-by-default fallback and that `none` is a
  temporary development bypass, so future maintainers do not "simplify" it into a raw getter.

### Implementation notes / deviations / follow-up

- **Implementation notes:** `AUTH_MODE: 'authMode'` added to `CONFIG_KEYS`; `CONFIG_SCHEMA[AUTH_MODE]`
  added with an inline enum validator that returns the canonical literal (`'none'`/`'googleGroups'`)
  and throws on any other value. `getAuthMode()` implemented exactly as the secure fallback
  (`value === 'none' ? 'none' : 'googleGroups'`); `setAuthMode()` delegates to `setProperty`. No
  `02_defaults.js` entry added (matches `AUTH_GROUP_EMAIL` precedent). `@remarks` JSDoc added to
  `getAuthMode()` documenting the secure default and the temporary-development-measure caveat.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** §2 depends on `getAuthMode()`; §3 transport will
  emit `getAuthMode()` and call `setAuthMode()`.

---

## Section 2 — Backend: `AuthService.checkAccess` `none` short-circuit

### Objective

Add the `none` bypass at the very top of `AuthService.checkAccess()`, before the group-email read,
session identity resolution, and `requireConfigured` branch.

### Constraints

- The short-circuit must precede `const groupEmail = ...` and `const email = ...` in
  `checkAccess()` so `Session`/`GroupsApp`/`CacheManager` are never touched in `none` mode and the
  trigger path (`requireConfigured: true`) is bypassed identically.
- Return `{ allowed: true, role: 'user' }`.
- Log a loud `ABLogger.getInstance().warn(...)` including `{ method, authMode: 'none' }`.
- Include a prominent comment marking the bypass as a **temporary development measure** with an
  explicit security caveat ("must not be used in production").
- **LOC assessment:** `AuthService.js` is 203 → ~222 (no separation needed).

### Delegation mandatory reads

- `@SPEC.md` (v1.9 increment, decisions 11–14)
- `@src/backend/Utils/AuthService.js`
- `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `@src/backend/z_Api/z_apiHandler.js`
- `@src/backend/Triggers/triggerHandler.js`
- `@src/backend/AGENTS.md`

### Shared helper plan

1. Helper: none. The short-circuit is a direct control-flow change inside `checkAccess`.
   - Decision: `keep local`.
   - Owning module/path: `src/backend/Utils/AuthService.js`.

### Data-shape planning

- No new shape: the returned decision object `{ allowed, role }` is unchanged; only its derivation
  changes. No data-shape doc edit is required beyond §1's `authMode` entry.

### Test-harness prerequisites (before Green — required to keep existing suites green)

Adding `getAuthMode()` to `checkAccess()` introduces a new `ConfigurationManager` dependency that
the existing green suites' mocks do not provide. Update the harness mocks as part of this section so
the existing suites do not break:

1. `@tests/utils/authService/authService.test.js` — `provisionAuthContext` builds a
   `ConfigurationManager` mock exposing only `getAuthGroupEmail`. Add
   `getAuthMode: vi.fn(() => authMode.value)` with a new `authMode = { value: 'googleGroups' }`
   default; the new `none` tests set `authMode.value = 'none'`. Assert that in `none` mode the
   short-circuit returns **before** `getAuthGroupEmail` is consulted (to prove the bypass fires first).
2. `@tests/triggers/triggerHandler.test.js` — the `beforeEach` `ConfigurationManager` mock exposes
   only `getAuthGroupEmail`. Add a `const authMode = { value: 'googleGroups' }` alongside the
   existing `authGroup` object and `getAuthMode: vi.fn(() => authMode.value)` so the existing "real
   AuthService" tests still pass and the new `none` test can set `authMode.value = 'none'`.
3. `@tests/setupGlobals.js` — the default global `ConfigurationManager` mock (which backs the real
   auth gate for any dispatcher test that does not provision its own) exposes only
   `getAuthGroupEmail`. Add `getAuthMode: vi.fn(() => 'googleGroups')` so the real `checkAccess`
   path stays green suite-wide.
4. `@tests/api/apiHandler/dispatcher-auth-gate.test.js` — `provisionAuthEnvironment` builds a
   `ConfigurationManager` mock with only `getAuthGroupEmail` and drives the **real**
   `AuthService.checkAccess`. Add `getAuthMode: vi.fn(() => 'googleGroups')`.

Note: `@tests/api/apiHandler/shared.js` `makeVmGlobals` is intentionally **not** changed — it mocks
`AuthService` directly, so `getAuthMode` is never reached there.

### Acceptance criteria

- With `authMode === 'none'`, `checkAccess({})` returns `{ allowed: true, role: 'user' }` and does
  not call `Session.getActiveUser()`, `GroupsApp.getGroupByEmail()`, or `CacheManager`.
- With `authMode === 'none'` and `requireConfigured: true` (and/or `bypassCache: true`), the result
  is still `{ allowed: true, role: 'user' }`.
- With `googleGroups` (or unset), behaviour is unchanged from the current group-check path.
- A `warn` log is emitted on the bypass path.

### Required test cases (Red first)

Backend (`@tests/utils/authService/authService.test.js`):

1. `none` → allowed, role `user`; `Session`/`GroupsApp`/`CacheManager` are not called.
2. `none` + `requireConfigured: true` → still allowed (fail-closed branch is not reached).
3. `none` + `bypassCache: true` → still allowed.
4. `none` → a warning is logged via `ABLogger`.
5. Regression: `googleGroups`/unset still denies a non-member and allows a member (existing tests
   stay green).

Backend integration (`@tests/triggers/triggerHandler.test.js`):

6. With `authMode === 'none'`, `triggerHandler` proceeds to dispatch (no denial) and still performs
   context resolution and cleanup.

### Section checks

- `npm run test:backend -- tests/utils/authService`
- `npm run test:backend -- tests/triggers`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- The short-circuit comment itself doubles as the required `@remarks`: state why the bypass exists,
  what it disables, and that it must be reverted for production.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added the `none` short-circuit at the very top of `checkAccess()`,
  before the group-email read, session identity resolution, and the `requireConfigured`
  fail-closed branch. Returns `{ allowed: true, role: 'user' }` and logs a loud `ABLogger.warn`
  carrying `{ method, authMode: 'none' }`; `Session`/`GroupsApp`/`CacheManager` are never touched
  in `none` mode. A prominent comment marks the bypass as a TEMPORARY DEVELOPMENT MEASURE with an
  explicit security caveat.
- **Deviations from plan:** (1) The prescribed two-`getInstance()` snippet was collapsed into a
  single hoisted `const configManager = ConfigurationManager.getInstance();` so the existing
  `getInstance` call-count assertions in the transport suites stay green without editing tests —
  behaviour-preserving, approved by review. (2) `getAuthMode` was also added to
  `tests/helpers/backendConfigTestHelpers.js` (a harness helper backing the real `checkAccess` for
  transport suites), which §2's 4-file list omitted but §7's "any other ConfigurationManager fake"
  requirement covers; this is a correct prerequisite, not scope creep.
- **Follow-up implications for later sections:** §3 (transport) depends on `getAuthMode()` and will
  add `setAuthMode`/`authMode` payload to `backendConfigTestHelpers.js`.

---

## Section 3 — Backend: `apiConfig.js` transport (get/set `authMode`)

### Objective

Emit `authMode` in `getBackendConfig_()` and add an `authMode` entry to the `setBackendConfig_()`
`updates` array.

### Constraints

- `getBackendConfig_()` emits `authMode: configManager.getAuthMode()` (always present; defaults to
  `googleGroups`).
- `setBackendConfig_()` adds `{ name: 'authMode', value: config.authMode, applySetting: (value) =>
configManager.setAuthMode(value) }` to the `updates` array.
- Invalid values surface through the existing `safeSet` error aggregation (`success: false, error:
'Failed to save some configuration values: authMode: ...'`).
- **LOC assessment:** `apiConfig.js` is 173 → ~181 (no separation needed).

### Delegation mandatory reads

- `@SPEC.md` (v1.9 increment)
- `@src/backend/z_Api/apiConfig.js`
- `@src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
- `@src/backend/AGENTS.md`

### Shared helper plan

1. Helper: none — the change follows the existing `updates` array pattern.
   - Decision: `keep local` / reuse existing `safeSet`.

### Data-shape planning

- Implements the transport side of the planned `authMode` entry in
  `@docs/developer/data-shapes/backend-config.md` (read/write transport tables). The Data Shapes
  Agent reconciles in §6.

### Test-harness prerequisites (before Green — required to keep existing suites green)

`getBackendConfig_()` will now emit `authMode`, which the existing transport suite's expected
payload does not include, and `setBackendConfig_()` will call `setAuthMode`, which the mock does not
provide. Update `@tests/helpers/backendConfigTestHelpers.js` as part of this section:

1. `buildBackendConfigResponse(overrides)` — add `authMode: 'googleGroups'` (before `...overrides`)
   so existing `toEqual(buildBackendConfigResponse())` assertions keep matching.
2. `createConfigurationManagerMock(...)` — add `getAuthMode: vi.fn(() => (hasPersistedConfiguration
? values.authMode : 'googleGroups'))` and `setAuthMode: vi.fn(setterImplementations.setAuthMode ||
(() => {}))`, and add `authMode: 'googleGroups'` to the `values` object. This lets the transport
   read/write tests exercise `authMode` and keeps existing `getBackendConfig`/`setBackendConfig`
   tests green.

### Deployment coordination (lockstep note)

The §4 frontend schema change must ship **before or atomically with** this §3 backend transport
change. `BackendConfigSchema` uses `.strict()`, so a backend that emits `authMode` before the
frontend schema accepts it would reject the entire `getBackendConfig` response; frontend-ahead is
safe because `authMode` is `.optional()` (see `backend-config.md` discrepancy #8). Never deploy §3
without §4 — rollout order is §4-first (or §4 and §3 together).

### Acceptance criteria

- `getBackendConfig_()` returns `authMode` (default `googleGroups`).
- `setBackendConfig_({ authMode: 'none' })` persists; a subsequent `getBackendConfig_()` returns
  `none`.
- `setBackendConfig_({ authMode: 'foo' })` returns `{ success: false }` with an aggregated error.

### Required test cases (Red first)

Backend transport (`@tests/api/backendConfigApi.test.js`, mirroring
`@tests/api/backendConfigAuthGroupEmail.test.js`):

1. `getBackendConfig_` includes `authMode` with default `googleGroups` when unset.
2. `setBackendConfig_({ authMode: 'none' })` returns `{ success: true }` and invokes
   `setAuthMode('none')` (assert the setter was called, not a mock round-trip — mirrors the
   `backendConfigAuthGroupEmail.test.js` precedent).
3. `setBackendConfig_({ authMode: 'googleGroups' })` returns `{ success: true }` and invokes
   `setAuthMode('googleGroups')`.
4. `setBackendConfig_` with an invalid `authMode` returns `{ success: false }` and an aggregate
   error mentioning `authMode`. (Pass a **validating** `setAuthMode` implementation to
   `createConfigurationManagerMock` via `setterImplementations` — the default is a no-op `vi.fn`,
   which would let the invalid value through and invert this assertion.)

### Section checks

- `npm run test:backend -- tests/api/backendConfigApi.test.js tests/api/backendConfigAuthGroupEmail.test.js`
- `npm run lint:backend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None (the transport change is a plain field addition following existing rows).

### Implementation notes / deviations / follow-up

- **Implementation notes:** `getBackendConfig_()` now emits `authMode: configManager.getAuthMode()`
  (always present, secure-default `googleGroups`). `setBackendConfig_()` gained an `updates` entry
  `{ name: 'authMode', value: config.authMode, applySetting: (v) => configManager.setAuthMode(v) }`
  that reuses the existing `safeSet` error aggregation, so an invalid value surfaces as
  `{ success: false, error: 'Failed to save some configuration values: authMode: ...' }`.
- **Deviations from plan:** The `buildBackendConfigResponse(overrides)` helper addition
  (`authMode: 'googleGroups'`) was applied in the **GREEN** phase rather than RED. The existing
  `backendConfigApi.test.js` asserts `response.data` equals `buildBackendConfigResponse()` for many
  cases; adding `authMode` to the helper during RED (before `getBackendConfig_` emitted it) would
  have broken those pre-existing assertions, violating the plan's own "existing get/setBackendConfig
  tests green" requirement. Pairing the helper change with the production change in GREEN keeps RED
  limited to the four intended new-test failures and leaves existing suites green throughout. This is a
  justified, plan-preserving sequencing decision.
- **Follow-up implications for later sections:** §4 (frontend schema) depends on this transport
  contract. Rollout lockstep: the §4 frontend `authMode` schema must ship **before or atomically
  with** this §3 backend transport (frontend-ahead is safe because `authMode` is `.optional()`; see
  §3 Deployment coordination and `backend-config.md` discrepancy #8).

---

## Section 4 — Frontend: Zod schemas (`authMode`)

### Objective

Add `authModeSchema` and wire `authMode` into the read, write, and form schemas.

### Constraints

- Define `authModeSchema = z.enum(['googleGroups', 'none'])` in
  `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts` and export it.
- `BackendConfigSchema`: `authMode: authModeSchema.optional()` (deploy-order tolerance, same as
  `authGroupEmail`).
- `BackendConfigWriteInputSchema`: `authMode: authModeSchema.optional()`.
- `BackendSettingsFormSchema` (`backendSettingsForm.zod.ts`): `authMode: authModeSchema` (required —
  the dropdown always has a value).
- Import `authModeSchema` from the service schema file rather than redefining it (shared helper).
- `backendConfigurationService.ts` and `useBackendSettings.ts` need **no change** — both consume
  `BackendConfigSchema`/`BackendSettingsFormSchema` and the form mapper, and do not enumerate config
  fields.
- **LOC assessment:** `backendConfiguration.zod.ts` 106 → ~114; `backendSettingsForm.zod.ts` 88 →
  ~92. No separation needed.

### Delegation mandatory reads

- `@SPEC.md` (v1.9 increment)
- `@docs/developer/data-shapes/backend-config.md`
- `@src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `@src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `@src/frontend/AGENTS.md`

### Shared helper plan

1. Helper: `authModeSchema` (shared Zod enum).
   - Decision: `new` (single canonical schema in `backendConfiguration.zod.ts`).
   - Owning module/path: `src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`.
   - Call-site rationale: reused by read, write, and form schemas; avoids three divergent literals
     (precedent: `authGroupEmailSchema`).
   - Relevant canonical doc target: `docs/developer/data-shapes/backend-config.md`.
   - Planned doc status: `Not implemented` (recorded in §6 reconciliation).

### Data-shape planning

- Mirrors the BackendConfig contract; reconciles against `@docs/developer/data-shapes/backend-config.md`.

### Acceptance criteria

- `authModeSchema` accepts `googleGroups` and `none`; rejects any other value.
- `BackendConfigSchema` parses a payload with/without `authMode` (optional).
- `BackendConfigWriteInputSchema` accepts an optional `authMode`.
- `BackendSettingsFormSchema` requires `authMode`.

### Required test cases (Red first)

Frontend (`@src/frontend/src/services/backendConfiguration/backendConfiguration.zod.spec.ts`,
`@src/frontend/src/features/settings/backend/backendSettingsForm.zod.spec.ts`):

1. `authModeSchema` accepts `googleGroups` and `none`.
2. `authModeSchema` rejects `foo`, `''`, `null`.
3. `BackendConfigSchema` parses a response that includes `authMode`.
4. `BackendConfigSchema` parses a response that omits `authMode` (optional).
5. `BackendSettingsFormSchema` rejects a form value missing `authMode`.

### Section checks

- `npm run test:frontend -- backendConfiguration.zod backendSettingsForm.zod`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` on `authModeSchema` noting the secure default and that `none` is a development
  bypass.

### Implementation notes / deviations / follow-up

- **Implementation notes:** `authModeSchema = z.enum(['googleGroups', 'none'])` defined and exported in
  `backendConfiguration.zod.ts` (mirrors the `jsonDatabaseLogLevelValues` pattern; `@remarks` notes the
  enum does not default — consumers apply the secure `googleGroups` default). `authMode` wired as
  `.optional()` into `BackendConfigSchema` and `BackendConfigWriteInputSchema`, and as **required** into
  `BackendSettingsFormSchema` (imported, not redefined). RED: 9 new tests added across
  `backendConfiguration.zod.spec.ts` and `backendSettingsForm.zod.spec.ts` (8 fail pre-GREEN). GREEN:
  schema changes + `validFormValues` fixture gains `authMode: 'googleGroups'`; the "requires authMode"
  test omits the key via `delete` to stay meaningful. All 39 §4 section tests pass; `npm run lint:frontend`
  clean; Code Review CLEAN. Commits: `feat:` f723f7a; paired `docs(plan):` commit on `feature/auth-service`.
- **Deviations from plan:** None in the schema itself. (See Baseline technical debt for the accepted
  §4 panel-test Regression Gate override.)
- **Follow-up implications for later sections:** §5 (mapper/panel) must supply `authMode` to clear the
  3 accepted-debt panel test failures and the §5 TS2741 type errors; §6 flips the `backend-config.md`
  `authMode` entries to implemented.

---

## Section 5 — Frontend: form mapper and `BackendSettingsPanel` dropdown

### Objective

Map `authMode` in both directions and render the "Authentication options" dropdown.

### Constraints

- `backendSettingsFormMapper.ts`:
  - read: `authMode: backendConfig.authMode ?? 'googleGroups'`.
  - write: `authMode: formValues.authMode`.
- `BackendSettingsPanel.tsx`:
  - add `'authMode'` to `backendSettingsFieldNames`.
  - add a field descriptor: `name: 'authMode'`, `label: 'Authentication options'`,
    `renderInput: () => <Select options={authModeOptions} />`, `section: 'Backend'`,
    `withSchemaValidation: true`, `helperText` (security warning, below).
  - add `const authModeOptions = [{ label: 'Google Groups', value: 'googleGroups' }, { label:
'None', value: 'none' }];`.
  - helper text: "Controls how access to this application is verified. 'None' disables the access
    gate entirely — for development and testing only; do not use in production."
- **LOC assessment:** `backendSettingsFormMapper.ts` 77 → ~83; `BackendSettingsPanel.tsx` 525 →
  ~545. `BackendSettingsPanel.tsx` is already large; decomposition is **out of scope** for this
  feature (a dedicated, separately-scoped refactor — see §Regression follow-up). The addition follows
  the existing descriptor pattern (`jsonDbLogLevel` `Select` precedent) with no new abstraction.

### Delegation mandatory reads

- `@SPEC.md` (v1.9 increment)
- `@src/frontend/src/features/settings/backend/backendSettingsFormMapper.ts`
- `@src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- `@src/frontend/src/features/settings/backend/backendSettingsForm.zod.ts`
- `@src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`
- `@src/frontend/AGENTS.md`
- `@docs/developer/frontend/frontend-spacing-and-padding-standards.md` (UI change)

### Shared helper plan

1. Helper: `authModeOptions` (local option list).
   - Decision: `keep local` (single-use, mirrors `jsonDatabaseLogLevelOptions`).
   - Owning module/path: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`.

### Data-shape planning

- No new shape beyond §4; reconciles with `@docs/developer/data-shapes/backend-config.md`.

### Acceptance criteria

- The mapper defaults a missing `authMode` to `googleGroups` on read and passes `authMode` through on
  write.
- The panel renders a `Select` labelled "Authentication options" with options `Google Groups` and
  `None`, in the Backend section, with the security helper text.

### Required test cases (Red first)

Frontend (`@src/frontend/src/features/settings/backend/backendSettingsFormMapper.spec.ts`,
`@src/frontend/src/features/settings/backend/BackendSettingsPanel.spec.tsx`):

1. Mapper read maps `authMode` through and defaults `undefined` → `googleGroups`.
2. Mapper write maps `authMode` through.
3. Panel renders the dropdown with the correct label, both options, and the security helper text.

### Section checks

- `npm run test:frontend -- backendSettingsFormMapper BackendSettingsPanel`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` on the `authMode` descriptor explaining the security caveat of the `None` option.

### Implementation notes / deviations / follow-up

- **Implementation notes:** `backendSettingsFormMapper.ts` — read `authMode: backendConfig.authMode ?? 'googleGroups'` and write `authMode: formValues.authMode`. `BackendSettingsPanel.tsx` — added `authModeOptions` (`Google Groups`/`none`), `'authMode'` to `backendSettingsFieldNames`, and a descriptor (`label: 'Authentication options'`, `Select`, `section: 'Backend'`, `withSchemaValidation: true`, security `helperText`, `SECURITY` comment). RED: 4 new tests (3 mapper + 1 panel dropdown). GREEN: production changes + `BackendSettingsPanel.spec.tsx` fixtures gained `authMode: 'googleGroups'` in 4 places (3 §4-debt tests + the `buildRefreshingBackendSettingsState` literal) to satisfy the now-required form field. Result: `npm run test:frontend -- backendSettingsFormMapper BackendSettingsPanel` = 24 passed / 0 failed; `npm run lint:frontend` clean; Code Review CLEAN. **The 3 accepted §4 panel-test failures are now CLEARED** — `frontend-test-coverage-check` passes again (regression checker: `New Failures Count: 0`, §4 debt fixed).
- **Deviations from plan:** The plan assumed the mapper change alone would clear the 3 §4-debt panel tests, but the panel spec mocks the hook and bypasses the real mapper, so the form values lacked `authMode`. An attempted panel validator/handler default (`form.getFieldValue('authMode') ?? 'googleGroups'`) was added in GREEN, then REVERTED after Code Review flagged it as out-of-scope (violates "never set defaults unless explicitly instructed" and duplicates the mapper default). The canonical fix was updating the 4 panel test fixtures instead. **No production deviation from plan remains.**
- **Follow-up implications for later sections:** §6 reconciles the data-shape doc; §7 final regression.

---

## Section 6 — Data-shape reconciliation (Data Shapes Agent)

### Objective

Flip the planned `authMode` entries in `docs/developer/data-shapes/backend-config.md` from
`[Not implemented — planned]` to implemented, and verify the field counts and discrepancy note.

### Constraints

- Update persistence row 14, the read/write transport rows, the validation note, and discrepancy #8
  to remove `[Not implemented — planned]`.
- Confirm the field-count notes remain correct (14 read fields, 12 frontend-writable fields, 13
  backend-writable superset).
- Do not change unrelated rows.

### Delegation mandatory reads

- `@SPEC.md` (v1.9 increment + Data-shape planning table)
- `@docs/developer/data-shapes/backend-config.md`
- `@docs/developer/data-shapes/INDEX.md`
- `@src/backend/z_Api/apiConfig.js`
- `@src/frontend/src/services/backendConfiguration/backendConfiguration.zod.ts`

### Acceptance criteria

- No `[Not implemented — planned]` markers remain for `authMode`.
- `backend-config.md` accurately describes the delivered `authMode` contract.

### Section checks

- Review diff of `docs/developer/data-shapes/backend-config.md` (no unrelated churn).
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Data Shapes Agent flipped all five `[Not implemented — planned]` markers for `authMode` in `docs/developer/data-shapes/backend-config.md` (persistence row 14, read transport row, write transport row, validation note, discrepancy #8 heading) and reworded the discrepancy #6 phrase from `(13 delivered + authMode, planned)` to `including authMode (now delivered)`. `grep` confirms zero `Not implemented — planned` (and zero `planned`) remains for `authMode`; canonical counts (14 read / 12 frontend-writable / 13 backend-writable) unchanged and internally consistent. Source-code alignment re-verified against `apiConfig.js`, `98_ConfigurationManagerClass.js`, `01_configKeysAndSchema.js`, and `backendConfiguration.zod.ts`.
- **Deviations from plan:** None.
- **Follow-up implications for later sections:** §7 (regression) confirms end-to-end.

---

## Section 7 — Regression hardening and documentation/rollout

### Objective

Run the full touched suites and lints, add the backend AGENTS note, and record rollout caveats.

### Constraints

- Update `@src/backend/AGENTS.md` §2.3 (AuthService singleton) with a one-line note that the
  `authMode: 'none'` setting is a temporary development bypass of the group-membership gate.
- No new documentation files; keep the note a signpost (policy detail lives in `SPEC.md`).

### Acceptance criteria

- All touched backend and frontend suites pass; backend and frontend lint clean.
- `src/backend/AGENTS.md` §2.3 mentions the `none` development bypass.

### Required test cases/checks

1. `npm run test:backend -- tests/configurationManager tests/utils/authService tests/triggers
tests/api/backendConfigApi.test.js tests/api/backendConfigAuthGroupEmail.test.js
tests/api/apiHandler/dispatcher-auth-gate.test.js`
2. `npm run test:frontend -- backendConfiguration backendSettingsForm backendSettingsFormMapper
BackendSettingsPanel useBackendSettings`
3. `npm run lint:backend && npm run lint:frontend`
4. Verify mandatory-read evidence for every delegated handoff.
5. Confirm every test that exercises `AuthService.checkAccess` (`tests/utils/authService`,
   `tests/triggers`, `tests/api/apiHandler/dispatcher-auth-gate.test.js`, the `tests/setupGlobals.js`
   default mock, and any other `ConfigurationManager` fake) provides a `getAuthMode` mock returning
   `'googleGroups'` by default — this is the final confirmation that the §2 harness prerequisites
   (items 1–4) are all present and no other `checkAccess` exerciser was missed.

### Section checks

- All commands green.

### Optional `@remarks` JSDoc review

- Confirm the temporary-measure/security comments and `@remarks` from §1–§5 are present in code.

### Implementation notes / deviations / follow-up

- **Implementation notes:** `src/backend/AGENTS.md` §2.3 gained a one-line signpost note that
  `authMode: 'none'` is a temporary development bypass of the group-membership gate (secure default
  `googleGroups`; policy detail in `SPEC.md`). Final regression gate: `New Failures Count: 0`; only the
  two accepted baseline-debt checks fail (`backend-lint-check` max-lines, `frontend-e2e-check` playwright).
  All touched suites green — backend 211 passed (18 files), frontend §7 scope 112 passed (7 files);
  `npm run lint:backend && npm run lint:frontend` clean (warnings-only `max-lines` accepted debt).
  Every `checkAccess` exerciser provides a `getAuthMode` mock returning `'googleGroups'` by default
  (§2 harness prerequisite), confirmed by the green backend suite.
- **Follow-up (deferred, not this feature):** facade-decompose
  `ConfigurationManager/98_ConfigurationManagerClass.js` (669 lines) and split
  `BackendSettingsPanel.tsx` (525 lines) — both already exceed their size thresholds and were left
  untouched to avoid opportunistic scope expansion.

---

## Suggested implementation order

1. §1 (config key + getter/setter)
2. §2 (AuthService bypass, incl. trigger integration test + harness mocks)
3. §3 (transport get/set)
4. §4 (frontend Zod)
5. §5 (mapper + panel dropdown)
6. §6 (data-shape reconciliation)
7. §7 (regression + docs/rollout)

Deployment order note: build order above is implementation-only. For rollout, the §4 frontend schema
must be live **before or together with** the §3 backend transport (see §3 "Deployment coordination").
