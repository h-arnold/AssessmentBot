# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Replace the legacy ConfigurationManager frontend-callable globals with canonical `apiHandler` endpoints.
- Introduce backend transport methods named `getBackendConfig` and `setBackendConfig`.
- Add corresponding typed frontend service methods that route through `callApi`.
- Preserve current configuration read/write semantics, including masked API-key handling, partial-update behaviour, and the existing save-result contract.
- Update backend and frontend tests to validate the new transport boundary and remove reliance on legacy globals as the public entry surface.
- Update developer documentation and agent guidance for the new configuration API boundary and the current `z_Api` path authority.

### Out of scope

- Broader ConfigurationManager refactors unrelated to the transport migration.
- Changes to deprecated areas such as `src/AdminSheet` or `src/AssessmentRecordTemplate`, except as reference material.
- New configuration fields or behavioural changes beyond the existing configuration contract.
- TypeScript, ESLint, or builder configuration changes unless they are strictly required.

### Assumptions

1. The canonical backend transport entrypoint for this feature is `src/backend/z_Api/apiHandler.js`, with method registration in `src/backend/z_Api/apiConstants.js`.
2. The public transport method names should be `getBackendConfig` and `setBackendConfig` to make the frontend/backend boundary explicit.
3. `getBackendConfig` should preserve the current public configuration payload shape exposed by legacy `getConfiguration()`: `backendAssessorBatchSize`, masked `apiKey`, `hasApiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, `jsonDbRootFolderId`, plus optional `loadError`.
4. `setBackendConfig` should accept a flat partial-update object containing only writable configuration fields: `backendAssessorBatchSize`, `apiKey`, `backendUrl`, `revokeAuthTriggerSet`, `daysUntilAuthRevoke`, `slidesFetchBatchSize`, `jsonDbMasterIndexKey`, `jsonDbLockTimeoutMs`, `jsonDbLogLevel`, `jsonDbBackupOnInitialise`, and `jsonDbRootFolderId`.
5. `setBackendConfig` should preserve current save semantics by returning plain data shaped as `{ success: true }` on success or `{ success: false, error: string }` on partial-save failure, matching the existing legacy write contract.
6. `setBackendConfig` should preserve current partial-update semantics: fields with value `undefined` are ignored, while explicit empty-string API-key updates clear the stored key.
7. Backend handlers should return plain data only; response envelope shaping must remain in `apiHandler`.
8. Frontend feature code should consume typed service helpers and must not call `google.script.run` directly.
9. Legacy-removal decisions in this plan are judged against active code and supported tests only; deprecated references are allowed to break so they can be removed later with clear visibility.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- When updating tests, name cases after behaviour or the function/class under test; do not use action-plan section numbers in test names, helper constants, or describe-block labels.

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
- Frontend type check: `npm exec tsc -- -b src/frontend/tsconfig.json`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — Backend configuration API migration

### Delivery status

- Current phase: Complete
- Red tests added: complete
- Red review clean: complete
- Green implementation complete: complete
- Green review clean: complete
- Checks passed: complete
- Action plan updated: complete
- Commit created: complete
- Push completed: complete

### Objective

- Add canonical backend API handlers for configuration reads and writes through `apiHandler`, replacing the legacy frontend-callable globals as the active transport surface.

### Constraints

- Register new methods in `src/backend/z_Api/apiConstants.js`.
- Dispatch new methods from `ApiDispatcher._invokeAllowlistedMethod(...)` in `src/backend/z_Api/apiHandler.js`.
- Keep handler logic thin and centred on `ConfigurationManager.getInstance()`.
- Preserve existing configuration semantics from `src/backend/ConfigurationManager/99_globals.js` during migration, then delete that legacy transport file once active-code and supported-test callers have moved.
- Do not expose the raw stored API key to the frontend.
- Do not move envelope shaping out of `apiHandler`.
- Treat `loadError` as part of the read contract: it is expected to remain optional.
- Validate direct params at the API boundary and keep write-only vs read-only fields explicit.

### Acceptance criteria

- `API_METHODS` contains `getBackendConfig` and `setBackendConfig`.
- `API_ALLOWLIST` contains `getBackendConfig` and `setBackendConfig`.
- `apiHandler` dispatches both methods successfully.
- `getBackendConfig` returns plain data with exactly the current public configuration fields, masked `apiKey`, `hasApiKey`, and optional `loadError`.
- `setBackendConfig` accepts only the writable configuration patch fields listed in the assumptions section.
- `setBackendConfig` ignores `undefined` fields and preserves explicit API-key clearing with `apiKey: ''`.
- `setBackendConfig` returns `{ success: true }` on success or `{ success: false, error: string }` on partial-save failure.
- Read-only transport fields such as `hasApiKey` and `loadError` are not accepted as writable inputs.
- Legacy `src/backend/ConfigurationManager/99_globals.js` is no longer the active frontend transport surface and is removed once the new API-path coverage is in place.

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
4. Add focused backend API tests for `getBackendConfig` optional `loadError` propagation.
5. Add focused backend API tests for `setBackendConfig` partial-update semantics.
6. Add a test confirming `setBackendConfig` does not call setters for fields that are `undefined`.
7. Add a test confirming `setBackendConfig` does call `setApiKey('')` for explicit clear.
8. Add a test confirming read-only fields such as `hasApiKey` and `loadError` are rejected or ignored according to the final API validation decision, and document that decision explicitly during implementation.
9. Add tests confirming `setBackendConfig` returns the plain save-result shape `{ success: true }` and `{ success: false, error }` through the `apiHandler` envelope.
10. Add a test confirming error propagation remains envelope-based through `apiHandler`.
11. Place new configuration transport tests in a behaviour-named API test file or describe block; do not use action-plan section numbering in test names.

Frontend tests:

1. None in this section beyond any transport contract fixtures needed by frontend service work in Section 2.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/backendConfigApi.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added `getBackendConfig` and `setBackendConfig` to the backend API constants allowlist and wired both through `ApiDispatcher._invokeAllowlistedMethod(...)`. The configuration transport logic now lives in `src/backend/z_Api/apiConfig.js`, while `src/backend/z_Api/apiHandler.js` remains responsible for request validation, lifecycle tracking, allowlisted dispatch, and response envelope shaping. The extracted handlers preserve the legacy configuration payload shape and save semantics from `src/backend/ConfigurationManager/99_globals.js`, including masked `apiKey`, `hasApiKey`, partial updates, ignoring `undefined` fields, explicit API-key clearing with `apiKey: ''`, malformed write payload rejection, and envelope-based error handling through `apiHandler`. Added focused API tests for allowlisting, dispatch, masked reads, partial writes, malformed write payload rejection, and transport error propagation.
- **Deviations from plan:** `src/backend/ConfigurationManager/99_globals.js` was not removed in this section because backend tests still use it as the legacy semantic reference and the broader transport cleanup is deferred to Section 3.
- **Follow-up implications for later sections:** Frontend transport work in Section 2 should call the new `getBackendConfig` and `setBackendConfig` method names exclusively. Section 3 should remove any remaining frontend-facing reliance on the legacy configuration globals and can consolidate or delete legacy transport helpers once the migration is complete.

### Delivery evidence

- Commit SHA: `4cbb637`
- Commit message: `Section 1: update API handler and configuration save coverage`
- Commit SHA: `a1bf2cc`
- Commit message: `Section 1: extract backend config API handlers`
- Branch name: `feat/ReactFrontend`
- Push confirmation: pushed successfully after rebasing onto `origin/feat/ReactFrontend`

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
- Treat `loadError` as an expected optional read field.
- Keep the write-response schema aligned with the backend’s plain save-result contract: `{ success: true } | { success: false, error: string }`.

### Acceptance criteria

- A dedicated frontend configuration schema module exists adjacent to the service.
- The frontend defines a typed `getBackendConfig()` service helper.
- The frontend defines a typed `setBackendConfig()` service helper.
- Both helpers validate inputs/outputs with Zod.
- The service uses the exact backend method names `getBackendConfig` and `setBackendConfig`.
- Malformed backend payloads are rejected by schema parsing rather than silently accepted.
- The write-input schema excludes read-only fields such as `hasApiKey` and `loadError`.

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
4. Verify response parsing succeeds for a valid masked configuration payload, including optional `loadError` handling.
5. Verify malformed read responses are rejected.
6. Verify malformed write responses are rejected.
7. Verify write-input validation rejects invalid payload shapes before transport.
8. Verify write-input validation rejects read-only fields such as `hasApiKey` and `loadError`.
9. Keep test naming behaviour-focused; do not use action-plan section numbers in spec titles or helper names.

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
- Evaluate removal against active code and supported tests only; deprecated references may break and should then be removed deliberately.

### Acceptance criteria

- The codebase no longer relies on legacy configuration globals as the public frontend transport surface.
- Any active frontend or supported test references to legacy `getConfiguration` / `saveConfiguration` transport usage are updated or removed.
- No required test command in this plan imports or depends on `src/backend/ConfigurationManager/99_globals.js`.
- Legacy backend `99_globals.js` configuration transport file is removed once the new API-path tests are in place.
- The migrated boundary is clear from method names and service wrappers.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. Replace legacy configuration transport tests with API-path tests that validate `getBackendConfig` and `setBackendConfig` behaviour through `apiHandler`.
2. Ensure no stale tests imply the legacy globals remain the supported frontend boundary.
3. Remove action-plan section-number naming from any updated configuration transport tests.

Frontend tests:

1. Update or add any service-level mocks/fixtures that now expect `getBackendConfig` and `setBackendConfig`.
2. If any feature code consumes configuration services, update those tests to use the new helpers.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/backendConfigApi.test.js`
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
- Frontend TypeScript compilation passes for the new schemas/services.
- Any broader touched test suites pass before considering feature complete.

### Required test cases/checks

1. Run touched backend model/controller/API suites.
2. Run touched frontend service/UI suites.
3. Run backend and frontend lint commands.
4. Run `npm exec tsc -- -b src/frontend/tsconfig.json`.
5. Run any required e2e tests.

### Section checks

- `npm test -- tests/api/apiHandler.test.js`
- `npm test -- tests/api/backendConfigApi.test.js`
- `npm run frontend:test -- src/services/configurationService.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

- Update docs to reflect the new configuration transport boundary, the active `z_Api` path authority, and the testing-naming guidance discovered during plan review.

### Constraints

- Only modify documents relevant to the touched areas.
- Use the concrete file list below rather than relying on broad “update docs” wording.

### Acceptance criteria

- Documentation accurately reflects the new `getBackendConfig` and `setBackendConfig` methods.
- API-layer documentation no longer implies configuration transport should use legacy globals.
- Path guidance consistently points to `src/backend/z_Api` where it is the current active transport surface.
- Testing guidance explicitly warns against naming tests after action-plan sections.
- Any deviations or caveats are documented.

### Required checks

1. Verify docs mention the configuration transport and save-result strategies.
2. Verify API docs list the new endpoints/methods and payloads.
3. Verify path-guidance docs and agent files use `src/backend/z_Api` consistently where applicable.
4. Confirm notes/deviations fields are filled during implementation.

### Concrete documentation and guidance update list (from repo scan)

Must update for this feature:

- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/DATA_SHAPES.md`
- `ACTION_PLAN.md`

Also update for path-guidance and testing-guidance consistency:

- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/frontend/frontend-testing.md`
- `.github/agents/Testing.agent.md`
- `docs/developer/backend/AssessmentFlow.md`

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Backend configuration API migration
2. Frontend configuration service and typed transport contract
3. Legacy transport cleanup and usage migration
4. Regression and contract hardening
5. Documentation and rollout notes
