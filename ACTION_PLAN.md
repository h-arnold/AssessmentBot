# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Refactor backend `ConfigurationManager` persistence so configuration values are stored as one serialised POJO in Script Properties rather than as individual properties.
- Remove `IS_ADMIN_SHEET` from `ConfigurationManager` key/schema/API surface and remove runtime usages that depend on it.
- Move `REVOKE_AUTH_TRIGGER_SET` handling to Script Properties as part of the single-POJO storage strategy.
- Update backend tests affected by the schema, API surface, and persistence behaviour changes.

### Out of scope

- No backwards compatibility path for legacy per-key persisted configuration values.
- No migration script for existing deployments.
- No behavioural refactors to `src/backend/ConfigurationManager/99_globals.js` beyond the minimal, mechanical edits required to keep it compiling and free of new runtime errors introduced by this task (deeper changes are deferred to future `apiHandler` migration work).
- No frontend or builder changes.

### Assumptions

1. Existing deployments can tolerate a clean break from legacy persisted configuration keys.
2. `REVOKE_AUTH_TRIGGER_SET` can be safely treated as script-wide rather than document-scoped.
3. Removing `IS_ADMIN_SHEET` is aligned with the React-frontend direction and no longer required in backend runtime logic.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Keep backend production code GAS-first; do not introduce Node runtime wiring beyond existing guarded module exports.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — Configuration schema and single-POJO storage contract

### Objective

- Define the new configuration persistence contract in `ConfigurationManager` so all config fields are stored in one script-level JSON object.

### Constraints

- Remove `IS_ADMIN_SHEET` entirely from config keys and schema.
- Keep `REVOKE_AUTH_TRIGGER_SET` as a supported key but persisted in script scope.
- Do not add migration logic or fallback reads of legacy individual keys.

### Acceptance criteria

- `01_configKeysAndSchema.js` no longer defines `IS_ADMIN_SHEET`.
- `REVOKE_AUTH_TRIGGER_SET` schema persists to script scope.
- `98_ConfigurationManagerClass.js` reads and writes one serialised JSON object using a dedicated config store key.
- `getProperty` and `setProperty` operate against the in-memory POJO cache and persist full-object updates.
- Persistence failures remain logged and rethrown.

### Required test cases (Red first)

Backend model tests:

1. Writing a valid field updates only that field in the in-memory object and persists one serialised object.
2. Reading values loads from the serialised store and returns expected values for numeric, string, and boolean-backed fields.
3. Malformed or non-object stored JSON yields a safe empty config object behaviour.
4. `REVOKE_AUTH_TRIGGER_SET` validates and normalises correctly under script-scoped persistence.

Backend controller tests:

1. N/A for this section.

API layer tests:

1. N/A for this section.

Frontend tests:

1. N/A for this section.

### Section checks

- `npm test -- tests/configurationManager/configurationManager.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:** _Intentionally not completed in this planning document._
- **Deviations from plan:** _Intentionally not completed in this planning document._
- **Follow-up implications for later sections:** _Intentionally not completed in this planning document._

---

## Section 2 — Remove IS_ADMIN_SHEET runtime dependencies

### Objective

- Remove or refactor backend runtime logic that currently depends on `ConfigurationManager.getIsAdminSheet()`.

### Constraints

- Do not reintroduce `IS_ADMIN_SHEET` through alternative hidden config paths.
- Keep behavioural changes minimal and aligned with the new frontend-driven architecture.
- Preserve fail-fast behaviour where operations must be constrained.

### Acceptance criteria

- `ConfigurationManager` no longer exposes `getIsAdminSheet` or `setIsAdminSheet`.
- All backend references to `getIsAdminSheet()` are removed or replaced with new non-config-driven logic.
- `Utils.validateIsAdminSheet` is either removed (if obsolete) or reworked to use the new approved source of truth.
- `ProgressTracker.complete` no longer branches on `isAdminSheet` config.

### Required test cases (Red first)

Backend model tests:

1. ConfigurationManager API-surface tests fail if `getIsAdminSheet`/`setIsAdminSheet` still exist.

Backend controller tests:

1. Update any controller tests mocking `getIsAdminSheet` so they reflect the new logic path and still validate intended behaviour.

API layer tests:

1. N/A for this section.

Frontend tests:

1. N/A for this section.

### Section checks

- `npm test -- tests/controllers/initController.test.js`
- `npm test -- tests/singletons/progressTrackerLazyInit.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:** _Intentionally not completed in this planning document._
- **Deviations from plan:** _Intentionally not completed in this planning document._
- **Follow-up implications for later sections:** _Intentionally not completed in this planning document._

---

## Section 3 — Test and mock alignment for the new config contract

### Objective

- Align backend tests, mocks, and fixtures with single-POJO persistence and the reduced `ConfigurationManager` API.

### Constraints

- Keep test changes tightly scoped to affected contracts.
- Do not add production code solely to satisfy tests.

### Acceptance criteria

- Configuration manager tests assert single-object persistence semantics instead of per-key property writes.
- Tests no longer reference removed `IS_ADMIN_SHEET` key/methods.
- Shared test mocks/factories reflect the new configuration API and field set.

### Required test cases (Red first)

Backend model tests:

1. `tests/configurationManager/configurationManager.test.js` updated for POJO persistence and key removal.
2. `tests/configurationManager/saveConfiguration.test.js` updated only where required by API surface changes.

Backend controller tests:

1. Update any `tests/controllers/**` suites that assume `isAdminSheet` config mocking.

API layer tests:

1. N/A for this section.

Frontend tests:

1. N/A for this section.

### Section checks

- `npm test -- tests/configurationManager/configurationManager.test.js`
- `npm test -- tests/configurationManager/saveConfiguration.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:** _Intentionally not completed in this planning document._
- **Deviations from plan:** _Intentionally not completed in this planning document._
- **Follow-up implications for later sections:** _Intentionally not completed in this planning document._

---

## Regression and contract hardening

### Objective

- Verify that the backend remains stable after configuration persistence and API-surface changes.

### Constraints

- Prefer targeted runs first, then broader validation.

### Acceptance criteria

- All touched backend tests pass.
- Backend lint passes.
- No failing references to removed `IS_ADMIN_SHEET` remain in backend runtime code or tests.

### Required test cases/checks

1. Run touched backend model/controller suites.
2. Run backend lint.
3. Run broader backend test sweep if targeted runs indicate dependency spread.

### Section checks

- `npm run lint`
- `npm test -- tests/configurationManager/`
- `npm test -- tests/controllers/initController.test.js`
- `npm test`

### Implementation notes / deviations / follow-up

- **Implementation notes:** _Intentionally not completed in this planning document._
- **Deviations from plan:** _Intentionally not completed in this planning document._

---

## Documentation and rollout notes

### Objective

- Keep developer documentation and rollout expectations clear for this intentional contract change.

### Constraints

- Only update docs relevant to touched backend behaviour.
- Do not document deferred `99_globals` migration work as complete.

### Acceptance criteria

- Document states there is no legacy migration and no backwards compatibility for per-key config properties.
- Notes clearly state `99_globals.js` is intentionally unchanged in this task.

### Required checks

1. Verify any updated docs mention single-POJO persistence strategy.
2. Verify docs do not claim `99_globals` has been migrated.
3. Confirm implementation-notes sections are left for execution-time updates.

### Implementation notes / deviations / follow-up

- **Implementation notes:** _Intentionally not completed in this planning document._
- **Deviations from plan:** _Intentionally not completed in this planning document._

---

## Suggested implementation order

1. Section 1 (schema and storage contract refactor).
2. Section 2 (remove `IS_ADMIN_SHEET` runtime dependencies).
3. Section 3 (test and mock alignment).
4. Regression and contract hardening.
5. Documentation updates (if required by resulting implementation).
