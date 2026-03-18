# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Replace the legacy ConfigurationManager frontend-callable globals with canonical `apiHandler` endpoints.
- Introduce backend transport methods named `getBackendConfig` and `setBackendConfig`.
- Add corresponding typed frontend service methods that route through `callApi`.
- Preserve current configuration read/write semantics, including masked API-key handling and partial-update behaviour.
- Update backend and frontend tests to validate the new transport boundary and remove reliance on legacy globals as the public entry surface.
- Update developer documentation for the new configuration API boundary if implementation changes require it.

### Out of scope

- Broader ConfigurationManager refactors unrelated to the transport migration.
- Changes to deprecated areas such as `src/AdminSheet` or `src/AssessmentRecordTemplate`, except as reference material.
- New configuration fields or behavioural changes beyond the existing configuration contract.
- TypeScript, ESLint, or builder configuration changes unless they are strictly required.

### Assumptions

1. The canonical backend transport entrypoint remains `src/backend/z_Api/apiHandler.js`, despite some older docs referring to `Api` more generically.
2. The public transport method names should be `getBackendConfig` and `setBackendConfig` to make the frontend/backend boundary explicit.
3. `getBackendConfig` should preserve the current public configuration payload shape exposed by legacy `getConfiguration()`, including masked `apiKey` and `hasApiKey`.
4. `setBackendConfig` should preserve current partial-update semantics: fields with value `undefined` are ignored, while explicit empty-string API-key updates clear the stored key.
5. Backend handlers should return plain data only; response envelope shaping must remain in `apiHandler`.
6. Frontend feature code should consume typed service helpers and must not call `google.script.run` directly.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.

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

## Section 1 — Backend configuration API migration

### Objective

- Add canonical backend API handlers for configuration reads and writes through `apiHandler`, replacing the legacy frontend-callable globals as the transport surface.

### Constraints

- Register new methods in `src/backend/z_Api/apiConstants.js`.
- Dispatch new methods from `ApiDispatcher._invokeAllowlistedMethod(...)` in `src/backend/z_Api/apiHandler.js`.
- Keep handler logic thin and centred on `ConfigurationManager.getInstance()`.
- Preserve existing configuration semantics from `src/backend/ConfigurationManager/99_globals.js` during migration.
- Do not expose the raw stored API key to the frontend.
- Do not move envelope shaping out of `apiHandler`.

### Acceptance criteria

- `API_METHODS` contains `getBackendConfig` and `setBackendConfig`.
- `API_ALLOWLIST` contains `getBackendConfig` and `setBackendConfig`.
- `apiHandler` dispatches both methods successfully.
- `getBackendConfig` returns the current configuration payload with masked `apiKey`, `hasApiKey`, and the existing public fields.
- `setBackendConfig` applies supported configuration updates through `ConfigurationManager` setters.
- `setBackendConfig` ignores `undefined` fields and preserves explicit API-key clearing with `apiKey: ''`.
- Legacy `src/backend/ConfigurationManager/99_globals.js` is no longer the intended frontend transport surface and is removed if nothing still depends on it.

### Required test cases (Red first)

Backend model tests:

1. No new model tests unless handler work requires ConfigurationManager contract changes.
2. If helper extraction changes ConfigurationManager interaction, add focused tests for any extracted helper behaviour.

Backend controller tests:

1. Not applicable unless a new controller or service abstraction is introduced.

API layer tests:

1. `tests/api/apiHandler.test.js` asserts `getBackendConfig` and `setBackendConfig` are present in `API_METHODS`.
2. `tests/api/apiHandler.test.js` asserts both methods are allowlisted and dispatched by `ApiDispatcher`.
3. Add focused backend API tests for `getBackendConfig` masked API-key behaviour.
4. Add focused backend API tests for `setBackendConfig` partial update semantics.
5. Add a test confirming `setBackendConfig` does not call setters for fields that are `undefined`.
6. Add a test confirming `setBackendConfig` does call `setApiKey('')` for explicit clear.
7. Add a test confirming error propagation remains envelope-based through `apiHandler`.

Frontend tests:

1. None in this section beyond any transport contract fixtures needed by frontend service work in Section 2.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/configurationManager/saveConfiguration.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 2 — Frontend configuration service and typed transport contract

### Objective

- Add typed frontend service methods for `getBackendConfig` and `setBackendConfig` using the established `callApi` pattern.

### Constraints

- Route all backend calls through `src/frontend/src/services/apiService.ts`.
- Do not call `google.script.run.<method>` directly from feature code.
- Use Zod-first schemas and infer types from those schemas.
- Keep service modules focused on transport and validation, not UI orchestration.
- Preserve the backend’s masked-secret contract in the frontend types.

### Acceptance criteria

- A dedicated frontend configuration schema module exists adjacent to the service.
- The frontend defines a typed `getBackendConfig()` service helper.
- The frontend defines a typed `setBackendConfig()` service helper.
- Both helpers validate inputs/outputs with Zod.
- The service uses the exact backend method names `getBackendConfig` and `setBackendConfig`.
- Malformed backend payloads are rejected by schema parsing rather than silently accepted.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None beyond the backend transport tests in Section 1.

Frontend tests:

1. Add a spec for the configuration service following the style used by existing frontend service tests.
2. Verify `getBackendConfig()` calls `callApi('getBackendConfig')`.
3. Verify `setBackendConfig()` calls `callApi('setBackendConfig', parsedInput)`.
4. Verify response parsing succeeds for a valid masked configuration payload.
5. Verify malformed read responses are rejected.
6. Verify malformed write responses are rejected.
7. Verify write-input validation rejects invalid payload shapes before transport.

### Section checks

- `npm run frontend:test -- src/services/configurationService.spec.ts`

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Section 3 — Legacy transport cleanup and usage migration

### Objective

- Complete the migration away from legacy configuration globals and ensure the codebase treats the new API handlers and frontend services as the canonical boundary.

### Constraints

- Do not leave duplicate public transport paths in place longer than necessary.
- Keep changes minimal and avoid speculative refactors.
- Preserve compatibility for any still-valid internal ConfigurationManager usage that is not part of the frontend transport boundary.
- Remove legacy references only after equivalent coverage exists for the new path.

### Acceptance criteria

- The codebase no longer relies on legacy configuration globals as the public frontend transport surface.
- Any frontend or test references to legacy `getConfiguration` / `saveConfiguration` transport usage are updated or removed.
- Legacy backend `globals.js` configuration transport file is removed if no longer required.
- The migrated boundary is clear from method names and service wrappers.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. Update any configuration-related tests still targeting the legacy globals so they instead validate the new API path.
2. Ensure no stale tests imply the legacy globals remain the supported frontend boundary.

Frontend tests:

1. Update or add any service-level mocks/fixtures that now expect `getBackendConfig` and `setBackendConfig`.
2. If any feature code consumes configuration services, update those tests to use the new helpers.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm run frontend:test -- src/services/configurationService.spec.ts`

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

## Regression and contract hardening

### Objective

- Verify that the new configuration transport boundary is stable, typed, and consistent across backend and frontend.

### Constraints

- Prefer focused test runs before broader validation.

### Acceptance criteria

- Backend API transport tests for configuration pass.
- Frontend configuration service tests pass.
- Relevant lint commands pass for touched areas.
- Any broader touched test suites pass before considering feature complete.

### Required test cases/checks

1. Run touched backend model/controller/API suites.
2. Run touched frontend service/UI suites.
3. Run backend frontend lint commands.
4. Run any required e2e tests.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/configurationManager/saveConfiguration.test.js`
- `npm run frontend:test -- src/services/configurationService.spec.ts`
- `npm run lint`
- `npm run frontend:lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

- Update docs to reflect the new configuration transport boundary and naming.

### Constraints

- Only modify documents relevant to the touched areas.

### Acceptance criteria

- Documentation accurately reflects the new `getBackendConfig` and `setBackendConfig` methods.
- API-layer documentation no longer implies configuration transport should use legacy globals.
- Any deviations or caveats are documented.

### Required checks

1. Verify docs mention persistence/transport strategies.
2. Verify API docs list new endpoints/methods.
3. Confirm notes/deviations fields are filled during implementation.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 (backend configuration API migration)
2. Section 2 (frontend configuration service and typed transport contract)
3. Section 3 (legacy transport cleanup and usage migration)
4. Regression and contract hardening
5. Documentation and rollout notes
