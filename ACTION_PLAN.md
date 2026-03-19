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
2. The current backend validation limits remain authoritative, and the frontend should align field semantics where practical. For `backendUrl`, the frontend form schema should normalise by trimming before validation, and both the transport schema and the form schema should use Zod URL validation as the frontend contract, with a follow-on backend hardening task to bring `Validate.validateUrl(...)` into the same contract.
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

### Delivery status

- Current phase: Complete
- Status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Review findings log

- Red review clean. The reviewer confirmed the new `SettingsPage` and `AppThemeShell` tests are correctly targeted at the missing Section 1 wiring. The temporary React `act(...)` warning in the shell spec is acceptable during red and should only be revisited if it remains once the shell wrapper is implemented.
- Green review clean. The reviewer confirmed the backend settings tab now mounts the feature entry component, the shell now provides Ant Design `App` context at the correct level, and `App.tsx` plus `SettingsPage.tsx` remain composition-only.

### Verification log

- `npm run frontend:test -- src/pages/SettingsPage.spec.tsx src/AppThemeShell.spec.tsx` passed.
- `npm run frontend:lint` passed.
- `npm exec tsc -- -b src/frontend/tsconfig.json` passed.

### Delivery artefacts

- Branch: `feat/SettingsPage`
- Commit SHA: `20e131a`
- Commit message: `feat: wire backend settings shell entry`
- Push confirmation: `git push` succeeded for `feat/SettingsPage`

### Objective

- Replace the backend settings placeholder with a real feature entry point, add the Ant Design `App` shell wrapper required for `App.useApp()`, and add the shell prerequisites needed for context-aware Ant Design feedback.

### Constraints

- Keep `src/frontend/src/App.tsx` thin and avoid introducing feature orchestration there.
- Add Ant Design `App` support at the shell/root level rather than inside the backend settings feature, so `App.useApp()` can be used for context-aware feedback.
- Preserve the existing `SettingsPage` tab structure and reuse `TabbedPageSection`.
- Do not introduce any direct backend calls in page components.

### Acceptance criteria

- `SettingsPage` renders `BackendSettingsPanel` for the backend settings tab instead of a blank placeholder card.
- The application shell wraps the UI in Ant Design `App`, providing the context required for `App.useApp()`.
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

### Required `@remarks` JSDoc follow-through

- Add `@remarks` to the shell/root component or wrapper introduced for Ant Design `App` support, explaining that `App.useApp()` is required for context-aware `message`/`notification` usage inside the backend settings feature and therefore the provider must live at the application shell rather than inside the feature subtree.
- Add `@remarks` to any new Settings-page composition entry point that simply wires in `BackendSettingsPanel`, clarifying that `SettingsPage.tsx` is intentionally kept as a composition layer with no backend orchestration.

### Implementation notes / deviations / follow-up

- Complete.
- No deviation from the plan in this section.
- Introduced a minimal `BackendSettingsPanel` entry component only; form behaviour and backend orchestration remain for later sections.

---

## Section 2 — Form contract, validation, and mapping

### Delivery status

- Current phase: Complete
- Status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Review findings log

- Red review initially found a compile blocker in `backendSettingsFormMapper.spec.ts` because the placeholder schema inferred an empty object type. The test scaffolding was adjusted so the suite still compiles while keeping the intended runtime-red assertions unchanged.
- Green review initially found two frontend write-contract mismatches: `revokeAuthTriggerSet` was still writable, and blank `apiKey` writes were still accepted at the transport boundary. The implementation was tightened so retention is represented by omission only and read-only fields are rejected before transport.
- Green review clean. The reviewer confirmed the form schema, mapper, and frontend transport schema now match the Section 2 replacement-or-retention semantics.

### Verification log

- `npm run frontend:test -- src/features/settings/backend/backendSettingsForm.zod.spec.ts src/features/settings/backend/backendSettingsFormMapper.spec.ts src/services/backendConfigurationService.spec.ts` passed.
- `npm run frontend:lint` completed with warnings only and no errors.
- `npm exec tsc -- -b src/frontend/tsconfig.json` passed.

### Delivery artefacts

- Branch: `feat/SettingsPage`
- Commit SHA: `b720143`
- Commit message: `feat: add backend settings form contract`
- Push confirmation: `git push` succeeded for `feat/SettingsPage`

### Objective

- Introduce the backend settings form schema and mapping layer so frontend input rules mirror the backend contract while keeping transport validation and form validation separate.

### Constraints

- Reuse `src/frontend/src/services/backendConfiguration.zod.ts` for transport shape validation, but tighten `backendUrl` there to use Zod URL validation instead of a plain string.
- Keep form-specific rules in `backendSettingsForm.zod.ts`.
- Mirror backend numeric ranges, enum values, and optional field rules exactly where the backend already provides a clear contract.
- Normalise `backendUrl` by trimming before frontend form validation, use Zod URL validation for `backendUrl` in both the transport schema and the form schema, and record follow-on backend validator hardening so all layers converge on the same URL contract.
- Prefer shared frontend error contracts/mappers; add feature-specific mapping only if genuinely necessary.
- Keep API key handling to replacement or retention only.
- Treat `revokeAuthTriggerSet` as read-only in the frontend and never include it in feature write payloads.

### Acceptance criteria

- `backendConfiguration.zod.ts` validates `backendUrl` with Zod URL validation at the transport boundary.
- A dedicated `backendSettingsForm.zod.ts` exists and derives its TypeScript types from the schema.
- A dedicated mapper converts between backend configuration payloads, form values, and write payloads without duplicating transport logic.
- Form validation normalises `backendUrl` by trimming before enforcing the agreed URL rule, and enforces the agreed field rules for integer ranges, log-level enum, optional Drive folder ID, and API key conditional requirements.
- API key handling preserves the stored-key/blank-field semantics described in `SETTINGS_PAGE_LAYOUT.md`.
- Mapper logic only emits editable fields in the write payload and never sends `hasApiKey`, masked read `apiKey`, `loadError`, or `revokeAuthTriggerSet`.
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
3. API key validation requires a value only when `hasApiKey` is false.
4. Mapper logic converts backend masked payloads into form values without leaking masked API key content into the input.
5. Mapper logic omits `apiKey` from the write payload when a stored key exists and the field is left blank.
6. Mapper logic includes `apiKey` when a replacement value is entered.
7. Mapper logic never includes `revokeAuthTriggerSet`, `hasApiKey`, or `loadError` in the write payload.
8. Error mapping uses shared contracts for generic transport/domain failures and only introduces feature-specific mapping when warranted.

### Section checks

- `npm run frontend:test -- src/features/settings/backend/backendSettingsForm.zod.spec.ts src/features/settings/backend/backendSettingsFormMapper.spec.ts src/services/backendConfigurationService.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Required `@remarks` JSDoc follow-through

- Add `@remarks` to `backendSettingsForm.zod.ts` documenting why `backendUrl` is normalised by trimming before validation and why the frontend now uses Zod URL validation even though backend hardening is tracked as follow-up work.
- Add `@remarks` to the mapper function(s) in `backendSettingsFormMapper.ts` that handle API key and write-payload shaping, explaining:
  - why masked read `apiKey` values are never echoed back
  - why blank `apiKey` means retention when `hasApiKey` is true
  - why `revokeAuthTriggerSet`, `hasApiKey`, and `loadError` are excluded from writes
- Add `@remarks` to any feature-specific error-mapping helper introduced here, clarifying why shared transport/domain mapping is preferred and when a backend-settings-specific mapper is justified.

### Implementation notes / deviations / follow-up

- Complete.
- No behavioural deviation from the plan in this section.
- The frontend transport schema intentionally still allows blank `backendUrl` on read payloads so later sections can surface backend `loadError` partial-load states without failing the entire query.

---

## Section 3 — Hook orchestration and state model

### Delivery status

- Current phase: Complete
- Status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [x] push completed

### Review findings log

- Red review initially found a frontend type-check blocker in the Ant Design mock inside `useBackendSettings.spec.ts` because `vi.importActual('antd')` was inferred as `unknown`. The test setup was tightened with an explicit `typeof Antd` cast so the suite fails only for the intended missing hook behaviour.
- Red review clean. The reviewer confirmed the targeted hook spec now compiles, type-checks, and fails only on the missing Section 3 orchestration behaviour.
- Green review initially found that the post-save refresh bypassed React Query by calling the service directly and mutating cache state manually. The hook was tightened so successful saves now refresh through the shared backend-config React Query path instead.
- Green review clean. The reviewer confirmed the hook now keeps the refresh path inside React Query, publishes query-derived values for form rebasing, and satisfies the Section 3 state-model contract.

### Verification log

- `npm exec tsc -- -b src/frontend/tsconfig.json` passed after the red-phase mock typing fix.
- `npm run frontend:lint` completed with warnings only and no errors during the red phase.
- `npm run frontend:test -- src/features/settings/backend/useBackendSettings.spec.ts src/services/backendConfigurationService.spec.ts` failed as intended during the red phase, with `backendConfigurationService.spec.ts` passing and `useBackendSettings.spec.ts` failing on the expected missing-hook assertions.
- `npm run frontend:test -- src/features/settings/backend/useBackendSettings.spec.ts src/services/backendConfigurationService.spec.ts` passed after the Section 3 implementation and refresh-path fix.
- `npm run frontend:lint` completed with warnings only and no errors after the Section 3 implementation. Remaining warnings are the pre-existing schema warnings in `backendSettingsForm.zod.ts` and `backendConfiguration.zod.ts`.
- `npm exec tsc -- -b src/frontend/tsconfig.json` passed after the Section 3 implementation.

### Delivery artefacts

- Branch: `feat/SettingsPage`
- Code commit SHA: `baf4ecf`
- Code commit message: `feat: add backend settings hook orchestration`
- Plan commit SHA: `77071a3`
- Plan commit message: `docs: record section 3 delivery status`
- Push confirmation: `git push` succeeded for `feat/SettingsPage`

### Objective

- Implement `useBackendSettings.ts` as the single orchestration point for load, save, state transitions, blocking rules, error mapping, React Query-backed read orchestration, and successful-save re-fetch behaviour.

### Constraints

- Keep all backend interaction inside the hook/service boundary.
- Use the agreed hybrid data-loading approach: React Query for backend configuration reads, local Ant Design form state for editing, and service-layer writes followed by query-driven refresh.
- Use the explicit state model from `SETTINGS_PAGE_LAYOUT.md` (`isInitialLoading`, `loadError`, `partialLoadError`, `isSaveBlocked`, `isSaving`, `saveError`, `hasApiKey`).
- A complete initial load failure must fail fast and surface a top-level `Alert` state.
- Partial-load warnings must block save without hiding the form.
- Successful save must re-fetch current config from the backend and re-base the form.
- Do not add a bespoke recovery workflow for hard load failures.

### Acceptance criteria

- `useBackendSettings.ts` owns initial load, save submission, re-fetch after save, and error clearing rules.
- The feature uses the agreed hybrid model: React Query owns the backend configuration read lifecycle, while the form keeps local edit state until save.
- `BackendSettingsPanel.tsx` owns the Ant Design `FormInstance` and re-bases form state with `form.setFieldsValue(...)` when the hook publishes fresh values after load or save.
- The hook consumes `backendConfigurationService.ts` only; no direct transport calls or backend globals are introduced.
- Hard load failures map to a top-level failure state.
- Partial-load warnings set a blocked-save state while keeping editable data visible, without introducing a separate thrown-error path for user submission.
- Save submission uses the smallest safe write payload generated by the mapper.
- Successful save clears stale save errors, shows success feedback, re-fetches config, and re-bases the form from the fresh payload via `form.setFieldsValue(...)`.
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
4. Save submission sets `isSaving`, clears stale save error, and calls the mapper/service correctly without moving edit state into shared query cache.
5. Successful save triggers `message.success`, re-fetches backend config, and re-bases the form from the returned payload via `form.setFieldsValue(...)`.
6. Domain save failures (`{ success: false, error }`) map to persistent save error state.
7. Transport/runtime failures map to the shared user-safe error path and keep current form values intact.
8. API key branch logic behaves correctly for stored-key and no-key states.
9. Hook state resets appropriately after a successful reload/save.
10. React Query-backed reads and local form editing remain correctly separated in the hybrid model.

### Section checks

- `npm run frontend:test -- src/features/settings/backend/useBackendSettings.spec.ts src/services/backendConfigurationService.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Required `@remarks` JSDoc follow-through

- Add `@remarks` to `useBackendSettings.ts` documenting the chosen hybrid architecture: React Query owns backend-configuration reads/refresh, while the Ant Design form keeps local edit state so in-progress edits are not moved into shared query cache.
- Add `@remarks` to the hook method(s) that publish fresh values after load/save, explaining why rebasing is done by the panel via `form.setFieldsValue(...)` rather than relying on `initialValues` or a keyed remount.
- Add `@remarks` to any save handler or blocked-save guard, clarifying why partial-load warnings disable save while keeping the form visible instead of introducing a separate recovery workflow.

### Implementation notes / deviations / follow-up

- Complete.
- No behavioural deviation from the plan in this section.
- The hook now derives published form values directly from the shared backend-config query result so the panel can rebase from query-owned snapshots without effect-driven mirror state.

---

## Section 4 — Backend settings panel UI and accessibility

### Delivery status

- Current phase: Complete
- Status: Complete
- Checklist:
  - [x] red tests added
  - [x] red review clean
  - [x] green implementation complete
  - [x] green review clean
  - [x] checks passed
  - [x] action plan updated
  - [x] commit created
  - [ ] push completed

### Review findings log

- Red review clean. The reviewer confirmed `BackendSettingsPanel.spec.tsx` is well scoped to the planned load states, field rendering, validation/focus behaviour, API key helper copy, and save-state affordances, and that the suite fails only because the current panel still renders the placeholder card.
- Green review initially found a user-visible validation bug in `BackendSettingsPanel.tsx`: controlled inline field errors were never cleared after the field became valid or after the form rebased from fresh backend values. The panel now clears those controlled errors on valid field changes and on form rebase, and the missing `@remarks` follow-through was added for the helper-copy and submit-failure paths.
- Green review clean. The reviewer confirmed the stale inline-error problem is resolved, the panel remains hook-driven and declarative, and the Section 4 implementation now satisfies the required UI and accessibility behaviour.

### Verification log

- `npm run frontend:test -- src/features/settings/backend/BackendSettingsPanel.spec.tsx` failed as intended during the red phase, with 11 of 11 tests failing because the planned Section 4 panel UI is not implemented yet.
- `npm run frontend:lint` completed with existing warnings only and no errors during the red phase.
- `npm run frontend:test -- src/features/settings/backend/BackendSettingsPanel.spec.tsx` passed after the Section 4 implementation and stale-error fix, with 10 tests passing.
- `npm run frontend:lint` completed with warnings only and no errors after the Section 4 implementation. Remaining warnings are the pre-existing schema warnings in `backendSettingsForm.zod.ts` and `backendConfiguration.zod.ts`.
- `npm exec tsc -- -b src/frontend/tsconfig.json` passed after the Section 4 implementation.

### Delivery artefacts

- Branch: `feat/SettingsPage`
- Code commit SHA: `edac4d2`
- Code commit message: `feat: add backend settings panel ui`
- Plan commit SHA: pending
- Plan commit message: pending
- Push confirmation: pending

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
9. API key helper text changes correctly based on `hasApiKey`.
10. Boolean and numeric fields bind correctly to Ant Design form state.

### Section checks

- `npm run frontend:test -- src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### Required `@remarks` JSDoc follow-through

- Add `@remarks` to `BackendSettingsPanel.tsx` explaining that the component owns the Ant Design `FormInstance` for library-integration reasons, while orchestration remains in the hook.
- Add `@remarks` to any helper that renders API key guidance copy, documenting the replacement-or-retention UX decision and why explicit key clearing is intentionally out of scope.
- Add `@remarks` to any form-submit failure handler, clarifying why `scrollToFirstError={{ focus: true }}` is required for accessibility and browser-visible validation behaviour.

### Implementation notes / deviations / follow-up

- Complete.
- No behavioural deviation from the plan in this section.
- Added a small `matchMedia` shim to the shared frontend test setup so Ant Design responsive observers behave consistently in jsdom-backed component tests.

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

- Frontend unit/component tests cover validation, mapping, hook state transitions, rendering, accessibility attributes, error mapping, and the agreed hybrid read/edit split.
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
   - visible save-button disabled/loading affordances during blocked and saving states
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

- `npm run frontend:test -- src/services/backendConfigurationService.spec.ts src/features/settings/backend/useBackendSettings.spec.ts src/features/settings/backend/BackendSettingsPanel.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/settings-backend.spec.ts`
- `npm run frontend:test:coverage`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
- `npm test -- tests/api/backendConfigApi.test.js`

### Required `@remarks` JSDoc follow-through

- During final review, confirm the non-obvious implementation decisions captured in earlier sections are reflected in `@remarks` on the relevant exported schemas, mappers, hooks, components, and shell wrappers before deleting this plan.

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
