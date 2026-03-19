# Feature Delivery Plan (TDD-First)

## Scope and assumptions

### Scope

- Implement the new frontend **Backend settings** feature under the existing `SettingsPage` tab structure.
- Replace the current backend settings placeholder with a sectioned Ant Design form that follows `SETTINGS_PAGE_LAYOUT.md`.
- Keep frontend/backend integration routed through the existing frontend service layer (`apiService.ts` → `backendConfigurationService.ts` → backend `apiHandler`).
- Add the required frontend feature files under `src/frontend/src/features/settings/backend/` and wire them into the existing settings page composition.
- Implement frontend-only validation, mapping, hook state management, user feedback, accessibility behaviour, and automated test coverage for the feature.
- Reuse existing shared frontend facilities wherever possible, including:
  - `src/frontend/src/services/apiService.ts`
  - `src/frontend/src/services/backendConfigurationService.ts`
  - `src/frontend/src/services/backendConfiguration.zod.ts`
  - shared frontend logging/error handling utilities
  - existing `SettingsPage` / `TabbedPageSection` composition
  - existing frontend test helpers and Playwright harness patterns

### Out of scope

- Changing the backend configuration transport contract unless implementation uncovers a genuine mismatch with the agreed layout plan.
- Introducing a bespoke recovery workflow for hard configuration load failures.
- Adding UI support for `revokeAuthTriggerSet`.
- Adding UI support for explicit API key clearing.
- Reworking the broader Settings information architecture beyond replacing the backend settings placeholder tab content.
- Changing TypeScript or ESLint configuration unless implementation uncovers a true blocker.

### Assumptions

1. `getBackendConfig` and `setBackendConfig` remain the canonical backend configuration methods, exposed through `backendConfigurationService.ts` and ultimately routed via `callApi(...)`.
2. The current backend validation limits and field semantics remain authoritative, so the new frontend form schema should mirror them rather than inventing parallel rules.
3. A successful save should immediately re-fetch backend configuration and re-base the form from the returned payload.
4. A complete initial load failure should fail fast and render a top-level Ant Design `Alert`.
5. Partial-load warnings returned as backend `loadError` should keep the form visible but block saving.
6. Shared frontend error contracts/mappers should be preferred, with backend-settings-specific mapping added only if the feature ends up with genuinely unique semantics.

---

## Global constraints and quality gates

### Engineering constraints

- Keep `SettingsPage.tsx` as a composition layer only.
- Keep `BackendSettingsPanel.tsx` presentational; place orchestration and side effects in `useBackendSettings.ts`.
- Route all frontend-to-backend calls through `callApi(...)`; never call backend globals or `google.script.run` directly.
- Reuse `backendConfigurationService.ts` and `backendConfiguration.zod.ts` rather than duplicating transport logic.
- Reuse shared error contracts/mappers and shared logging utilities before creating feature-specific abstractions.
- Fail fast on invalid inputs, transport failures, and persistence failures.
- Do not add a bespoke recovery path for hard load failures in this iteration.
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
- Frontend coverage: `npm run frontend:test:coverage`
- Frontend type-check: `npm exec tsc -- -b src/frontend/tsconfig.json`

---

## Section 1 — Frontend entry wiring and shell prerequisites

### Objective

- Replace the backend settings placeholder with a real feature entry point and add the shell prerequisites needed for context-aware Ant Design feedback.

### Constraints

- Keep `src/frontend/src/App.tsx` thin and avoid introducing feature orchestration there.
- Add Ant Design `App` support at the shell/root level rather than inside the backend settings feature.
- Preserve the existing `SettingsPage` tab structure and reuse `TabbedPageSection`.
- Do not introduce any direct backend calls in page components.

### Acceptance criteria

- `SettingsPage` renders `BackendSettingsPanel` for the backend settings tab instead of a blank placeholder card.
- The application shell provides the Ant Design `App` context required for `App.useApp()`.
- The existing settings heading/summary and tab structure still render correctly.
- No service calls or feature state machines are introduced into `App.tsx` or `SettingsPage.tsx`.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None unless frontend integration work uncovers a required transport contract adjustment.

Frontend tests:

1. `SettingsPage` renders the backend settings feature entry instead of the old placeholder panel.
2. `SettingsPage` still preserves the existing tabs and switches correctly between Classes and Backend settings.
3. The shell provides Ant Design `App` context without regressing the existing app render path.

### Section checks

- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx src/App.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

---

## Section 2 — Form contract, validation, and mapping

### Objective

- Introduce the backend settings form schema and mapping layer so frontend input rules mirror the backend contract while keeping transport validation and form validation separate.

### Constraints

- Reuse `src/frontend/src/services/backendConfiguration.zod.ts` for transport shape validation; do not duplicate that contract in the feature.
- Keep form-specific rules in `backendSettingsForm.zod.ts`.
- Mirror backend numeric ranges, enum values, URL semantics, and optional field rules exactly.
- Prefer shared frontend error contracts/mappers; add feature-specific mapping only if genuinely necessary.
- Keep API key handling to replacement or retention only.

### Acceptance criteria

- A dedicated `backendSettingsForm.zod.ts` exists and derives its TypeScript types from the schema.
- A dedicated mapper converts between backend configuration payloads, form values, and write payloads without duplicating transport logic.
- Form validation enforces the agreed field rules for `backendUrl`, integer ranges, log-level enum, optional Drive folder ID, and API key conditional requirements.
- API key handling preserves the stored-key/blank-field semantics described in `SETTINGS_PAGE_LAYOUT.md`.
- Error mapping uses shared contracts/utilities where possible and only adds backend-settings-specific mapping if unique semantics appear.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. Extend `tests/api/backendConfigApi.test.js` only if implementation reveals a real transport mismatch that must be fixed in backend configuration transport.

Frontend tests:

1. `backendSettingsForm.zod.ts` accepts valid form values matching backend ranges and enums.
2. `backendSettingsForm.zod.ts` rejects invalid URL, integer range, enum, and folder-ID inputs.
3. API key validation requires a value only when `hasStoredApiKey` is false.
4. Mapper logic converts backend masked payloads into form values without leaking masked API key content into the input.
5. Mapper logic omits `apiKey` from the write payload when a stored key exists and the field is left blank.
6. Mapper logic includes `apiKey` when a replacement value is entered.
7. Error mapping uses shared contracts for generic transport/domain failures and only introduces feature-specific mapping when warranted.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/settings/backend/backendSettingsForm.zod.spec.ts src/frontend/src/features/settings/backend/backendSettingsFormMapper.spec.ts src/frontend/src/services/backendConfigurationService.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

---

## Section 3 — Hook orchestration and state model

### Objective

- Implement `useBackendSettings.ts` as the single orchestration point for load, save, state transitions, blocking rules, error mapping, and successful-save re-fetch behaviour.

### Constraints

- Keep all backend interaction inside the hook/service boundary.
- Use the explicit state model from `SETTINGS_PAGE_LAYOUT.md` (`isInitialLoading`, `loadError`, `partialLoadError`, `isSaveBlocked`, `isSaving`, `saveError`, `hasApiKey`).
- A complete initial load failure must fail fast and surface a top-level `Alert` state.
- Partial-load warnings must block save without hiding the form.
- Successful save must re-fetch current config from the backend and re-base the form.
- Do not add a bespoke recovery workflow for hard load failures.

### Acceptance criteria

- `useBackendSettings.ts` owns initial load, save submission, re-fetch after save, and error clearing rules.
- The hook consumes `backendConfigurationService.ts` only; no direct transport calls or backend globals are introduced.
- Hard load failures map to a top-level failure state.
- Partial-load warnings set a blocked-save state while keeping editable data visible.
- Save submission uses the smallest safe write payload generated by the mapper.
- Successful save clears stale save errors, shows success feedback, re-fetches config, and re-bases the form from the fresh payload.
- Save failures preserve current input state and map to persistent user-safe inline feedback.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None unless implementation reveals a real transport contract issue.

Frontend tests:

1. Initial load enters `isInitialLoading` and resolves into editable state on success.
2. Initial hard load failure sets `loadError`, prevents save, and exposes the top-level failure state.
3. Successful read with backend `loadError` sets `partialLoadError` and `isSaveBlocked` while keeping form data available.
4. Save submission sets `isSaving`, clears stale save error, and calls the mapper/service correctly.
5. Successful save triggers `message.success`, re-fetches backend config, and re-bases the form from the returned payload.
6. Domain save failures (`{ success: false, error }`) map to persistent save error state.
7. Transport/runtime failures map to the shared user-safe error path and keep current form values intact.
8. API key branch logic behaves correctly for stored-key and no-key states.
9. Hook state resets appropriately after a successful reload/save.

### Section checks

- `npm run frontend:test -- src/features/settings/backend/useBackendSettings.spec.ts src/services/backendConfigurationService.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

---

## Section 4 — Backend settings panel UI and accessibility

### Objective

- Build the presentational backend settings panel with sectioned Ant Design cards, clear labels, correct field bindings, and accessible failure/success feedback.

### Constraints

- Keep the panel declarative and drive behaviour from the hook.
- Use the agreed Ant Design components and built-in features before adding custom behaviour.
- Use a top-level `Alert` for hard initial load failure and inline `Alert` components for partial-load/save failures.
- Use `scrollToFirstError={{ focus: true }}` and preserve visible labels and semantic grouping.
- Keep save as the only user action in this iteration; do not add reset/reload controls.

### Acceptance criteria

- `BackendSettingsPanel.tsx` renders the agreed cards/sections and field set from the layout plan.
- Ant Design `Form` is vertical, named, and configured to focus/scroll to the first invalid field on submit failure.
- The API key input behaves as a replacement-only field with stored-key helper text.
- `jsonDbBackupOnInitialise` binds through `valuePropName="checked"`.
- Hard load failures render a top-level `Alert`.
- Partial-load warnings and save failures render persistent inline `Alert` feedback.
- Save button loading/disabled state follows the hook state model.
- Success feedback uses `App.useApp()`/`message.success` within the provided Ant Design `App` context.
- The panel remains accessible with visible labels, semantic section grouping, and keyboard-friendly form behaviour.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. None.

Frontend tests:

1. Component renders skeleton during initial load.
2. Component renders top-level `Alert` for hard load failure.
3. Component renders inline warning for partial-load `loadError`.
4. Component renders all planned fields/cards with visible labels.
5. Save button is disabled when `isSaveBlocked` or `isSaving` is true.
6. Save button shows loading while save is in flight.
7. Validation errors are rendered inline and associated with the correct fields.
8. Submit failure focuses or scrolls to the first invalid field.
9. API key helper text changes correctly based on `hasStoredApiKey`.
10. Boolean and numeric fields bind correctly to Ant Design form state.

### Section checks

- `npm run frontend:test -- src/frontend/src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

---

## Section 5 — End-to-end-visible behaviour and cross-layer tests

### Objective

- Add comprehensive automated coverage for the new backend settings feature using the repo’s Vitest/Playwright split and existing service/API test locations.

### Constraints

- Follow the authoritative Vitest vs Playwright split from `docs/developer/frontend/frontend-testing.md`.
- Keep transport/service assertions in `src/frontend/src/services/backendConfigurationService.spec.ts`.
- Keep backend configuration transport assertions in `tests/api/backendConfigApi.test.js`.
- Every user-visible interaction must have Playwright coverage.
- Prefer extending existing test helpers over copying setup logic.

### Acceptance criteria

- Frontend unit/component tests cover validation, mapping, hook state transitions, rendering, accessibility attributes, and error mapping.
- Playwright covers the visible user journey through Settings → Backend settings, including validation, save, blocked-save state, keyboard interaction, and success/failure feedback.
- Transport-layer tests remain separated by responsibility between frontend service specs and backend API specs.
- New tests use behaviour-based names rather than action-plan section labels.

### Required test cases (Red first)

Backend model tests:

1. None.

Backend controller tests:

1. None.

API layer tests:

1. `tests/api/backendConfigApi.test.js` still verifies the backend configuration transport contract relied on by the frontend.
2. `tests/api/apiHandler.test.js` is updated only if dispatcher-level contract coverage must change.

Frontend tests:

1. `backendConfigurationService.spec.ts` continues to verify `callApi` usage and request/response validation boundaries.
2. `BackendSettingsPanel.spec.tsx` covers visible rendering outcomes and accessibility structure.
3. `useBackendSettings.spec.ts` covers invisible state transitions and orchestration.
4. Playwright covers:
   - navigation to Settings and the Backend settings tab
   - initial skeleton state
   - hard load failure top-level `Alert`
   - keyboard-only data entry
   - inline validation and first-invalid-field focus
   - blocked save when partial-load warning exists
   - API key retention with existing stored key
   - API key requirement when no stored key exists
   - successful save followed by visible refresh from backend data
   - visible save failure feedback

### Section checks

- `npm run frontend:test -- src/services/backendConfigurationService.spec.ts src/features/settings/backend/useBackendSettings.spec.ts src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/settings-backend.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Implementation notes / deviations / follow-up

---

## Regression and contract hardening

### Objective

- Verify the completed backend settings feature against transport contracts, lint/type-check standards, coverage requirements, and visible browser behaviour before considering the work complete.

### Constraints

- Prefer focused test runs before broader validation.
- Keep transport coverage separated by layer responsibility.
- Ensure frontend unit/component coverage remains at or above the repository threshold.

### Acceptance criteria

- Touched frontend service, hook, component, and e2e suites pass.
- Any touched backend configuration transport suites pass.
- Frontend lint, type-check, and coverage checks pass.
- No direct-backend-call regressions are introduced in frontend code.

### Required test cases/checks

1. Run touched frontend service/unit/component suites.
2. Run touched Playwright backend settings scenarios.
3. Run `tests/api/backendConfigApi.test.js` if transport-facing behaviour changes.
4. Run `npm run frontend:lint`.
5. Run `npm exec tsc -- -b src/frontend/tsconfig.json`.
6. Run `npm run frontend:test:coverage`.
7. Run broader validation commands if section-level runs expose coupling.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/backendConfigurationService.spec.ts src/frontend/src/features/settings/backend/useBackendSettings.spec.ts src/frontend/src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/settings-backend.spec.ts`
- `npm run frontend:test:coverage`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
- `npm test -- tests/api/backendConfigApi.test.js`

### Implementation notes / deviations / follow-up

---

## Documentation and rollout notes

### Objective

- Keep implementation-facing documentation aligned with the completed feature and record any genuine deviations discovered during development.

### Constraints

- Only modify documents relevant to the touched areas.
- Do not backfill the implementation-notes fields in this plan until sections are actually worked.

### Acceptance criteria

- `SETTINGS_PAGE_LAYOUT.md` still reflects the implemented behaviour, or is updated if implementation uncovers a justified deviation.
- Frontend agent guidance remains accurate if implementation confirms or refines transport/error-handling rules.
- Any implementation caveats discovered during delivery are recorded in the relevant section notes of this plan.
- No redundant new docs are added if existing docs already cover the implemented behaviour.

### Required checks

1. Verify the implemented feature still matches the agreed layout and constraint document.
2. Verify transport/error-handling docs remain accurate for any new shared abstractions.
3. Confirm implementation-notes/deviation fields are updated by the implementing agent as work progresses.

### Implementation notes / deviations / follow-up

---

## Suggested implementation order

1. Section 1 (frontend entry wiring and shell prerequisites)
2. Section 2 (form contract, validation, and mapping)
3. Section 3 (hook orchestration and state model)
4. Section 4 (backend settings panel UI and accessibility)
5. Section 5 (end-to-end-visible behaviour and cross-layer tests)
6. Regression and contract hardening
7. Documentation and rollout notes
