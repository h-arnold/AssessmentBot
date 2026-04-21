# Transport Layer De-Sloppification — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md` — source of truth for all design decisions, contracts, and scope boundaries.
2. Read `SLOP_REVIEW.md` — the original findings that motivate this refactor.
3. Read `AGENTS.md`, `src/backend/AGENTS.md`, and `src/frontend/AGENTS.md`.
4. Use this action plan to sequence delivery and testing only; do not restate or redefine material already
   settled in `SPEC.md`.

---

## Scope and assumptions

### Scope

- `src/backend/z_Api/apiConstants.js` — delete `API_METHODS` and `API_ALLOWLIST`.
- `src/backend/z_Api/z_apiHandler.js` — simplify dispatch; inline ten handler closures for trivial
  methods; wire trailing-underscore private transport helper calls for non-trivial methods; remove
  `_invokeAllowlistedMethod`.
- `src/backend/z_Api/auth.js` — delete.
- `src/backend/z_Api/abclassPartials.js` — delete.
- `src/backend/z_Api/referenceData.js` — delete.
- `src/backend/z_Api/googleClassrooms.js` — rename `getGoogleClassrooms` to `getGoogleClassrooms_`;
  update exports; update `z_apiHandler.js` closure to call `getGoogleClassrooms_(parameters)`.
- `src/backend/z_Api/assignmentDefinitionPartials.js` — rename handler and helper functions to
  a trailing underscore: `getAssignmentDefinitionPartials_`, `deleteAssignmentDefinition_`, and all
  internal helpers; update exports.
- `src/backend/z_Api/apiConfig.js` — rename `getBackendConfig` → `getBackendConfig_`,
  `setBackendConfig` → `setBackendConfig_`, `maskApiKey` → `maskApiKey_`; update exports; update
  `z_apiHandler.js` Node-compat wiring to import the renamed helpers.
- `src/backend/z_Api/abclassMutations.js` — rename handler and helper functions to a trailing underscore
  (`upsertABClass_`, `updateABClass_`, `deleteABClass_`, `getAbClassController_`,
  `validateParametersObject_`, `validateMutationClassId_`, and the per-operation validators); remove
  `validateClassId`, `validateCourseLength`, `requireParameters` (duplicate of controller logic);
  retain remaining transport-boundary checks under trailing-underscore private names.
- `src/frontend/src/services/authService.ts` — add `z.boolean()` Zod validation.
- `src/frontend/src/services/authService.zod.ts` — new file with `AuthorisationStatusSchema`.
- `src/frontend/src/services/authService.spec.ts` — add Zod validation tests.
- `tests/api/apiHandler.test.js` — update registry tests; update handler stubs to trailing-underscore private
  function globals for non-trivial methods; add parameter extraction contract tests; remove
  `_invokeAllowlistedMethod` direct test; update VM context tests.
- `tests/api/apiHandlerLocking.test.js` — update stubs from handler globals to controller constructor
  mocks (Pass A), then trailing-underscore private function globals (Pass B).
- `tests/api/apiHandlerTiming.test.js` — same two-pass update.
- `tests/api/staleAdmission.test.js` — update all three `globalThis.getAuthorisationStatus`
  assertions to check `context.scriptAppManagerInstance.isAuthorised` instead.
- `tests/helpers/apiHandlerTestUtils.js` — Pass A: add `installControllerMocks` /
  `restoreControllerMocks`; retain `additionalHandlers` temporarily for non-trivial globals
  (`getGoogleClassrooms`, `upsertABClass`, `updateABClass`, `deleteABClass`,
  `getAssignmentDefinitionPartials`, `deleteAssignmentDefinition`) only. `getBackendConfig` and
  `setBackendConfig` are NOT in `additionalHandlers` at any stage — they are wired via module-level
  variables in `z_apiHandler.js`. Pass B: replace `additionalHandlers` with trailing-underscore
  function globals (`globalThis.getGoogleClassrooms_`, etc.); remove all non-underscore global-function
  wiring.
- `tests/backend-api/abclassPartials.unit.test.js` — delete.
- `tests/backend-api/referenceData.unit.test.js` — delete.
- `tests/api/auth.test.js` — delete (two controller-delegation tests migrated to `apiHandler.test.js`;
  vm-context file test dropped).
- `tests/api/abclassPartials.test.js` — delete (routing/envelope coverage migrated before deletion).
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js` — update module-load pattern to
  destructure `getAssignmentDefinitionPartials_` / `deleteAssignmentDefinition_` from the module
  export; validation tests are unaffected.
- `tests/backend-api/abclassMutations.unit.test.js` — update module-load pattern to destructure
  `upsertABClass_`, `updateABClass_`, `deleteABClass_`; remove tests for deleted validation
  (classId non-empty, courseLength range, requireParams).
- `tests/api/googleClassrooms.test.js` — update all direct `getGoogleClassrooms` accesses to use
  `getGoogleClassrooms_` from the module export; update export-shape assertion.
- `tests/api/assignmentDefinitionDeleteApi.test.js` — update all direct `deleteAssignmentDefinition`
  accesses to use `deleteAssignmentDefinition_` from the module export.
- `tests/api/abclassMutations.test.js` — Section 3: delete two VM coexistence tests that
  `fs.readFileSync` `referenceData.js` (lines ≈ 256–339); these tests become obsolete once
  `referenceData.js` is deleted. Section 4: update all direct function accesses (`upsertABClass`,
  `updateABClass`, `deleteABClass`) to use `upsertABClass_`, `updateABClass_`, `deleteABClass_`
  from the module export. Section 5: remove `courseLength` validation test cases (lines ≈ 341–373)
  that test validation now removed from the transport layer.
- `tests/api/backendConfigApi.test.js` — confirm green after Section 4 apiConfig.js rename; the
  test routes through apiHandler dispatch so no module-load changes required.
- `docs/developer/backend/api-layer.md` — two passes: docs-first signpost (Section 1),
  reconciliation (Documentation section).
- `src/backend/AGENTS.md` — two passes: docs-first signpost (Section 1), reconciliation.
- `src/frontend/AGENTS.md` — update § 4.1 method-name alignment guidance.

### Out of scope

- Changing controllers beyond confirming / adding validation required for abclassMutations dedup.
- `apiService.ts` and all frontend services other than `authService.ts`.
- Any new API endpoint, feature, or behavioural change.
- Any data migration or persistence change.

### Assumptions

1. `ScriptAppManager` is already available as a global in `tests/setupGlobals.js`. `ABClassController`
   and `ReferenceDataController` are not registered there; they are installed per-test via
   `installControllerMocks` / `restoreControllerMocks` in `apiHandlerTestUtils.js`.
2. The transport envelope shape and admission-control behaviour are unchanged throughout.
3. All test runs use the commands defined in the validation command hierarchy below.
4. `ABClassController` already owns `_validateClassId`, `_validateCourseLength`,
   `_validateDeleteClassId`, and calls `Validate.requireParams` in all three mutation methods —
   confirmed in source at lines 612, 656, 628, 758, 807, 835.
5. The `active` boolean/null check and the forbidden-fields check in `abclassMutations.js` are retained
   at the transport boundary (not present in controller).

---

## LOC baseline

These are the current measured line counts for every file this plan intends to touch. The measurable
pass-gate for the whole refactor is a **net reduction of ≥ 200 lines** across all files in this table at
the point the documentation and rollout section is complete.

| File                                                          | Baseline LOC | Expected LOC after | Expected Δ | Reason                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------ | ------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/z_Api/auth.js`                                   | 13           | 0 (deleted)        | −13        | Inlined into apiHandler; top-level global removed                                                                                                                                                                                                                                               |
| `src/backend/z_Api/abclassPartials.js`                        | 16           | 0 (deleted)        | −16        | Inlined into apiHandler; top-level global removed                                                                                                                                                                                                                                               |
| `src/backend/z_Api/referenceData.js`                          | 107          | 0 (deleted)        | −107       | Inlined into apiHandler; top-level globals removed                                                                                                                                                                                                                                              |
| `src/backend/z_Api/apiConstants.js`                           | 69           | ≈ 29               | ≈ −40      | Delete `API_METHODS` (18+2 lines) + `API_ALLOWLIST` (18+2 lines) blocks and their exports                                                                                                                                                                                                       |
| `src/backend/z_Api/z_apiHandler.js`                           | 432          | ≈ 415              | ≈ −17      | Remove `apiAllowlist` var and init (3 lines), remove `_invokeAllowlistedMethod` (15 lines), simplify dispatch call (1 line); handler closures stay as single-expression entries; non-trivial handlers wired via trailing-underscore private function calls                                      |
| `src/backend/z_Api/googleClassrooms.js`                       | 45           | ≈ 45               | ≈ 0        | Rename `getGoogleClassrooms` → `getGoogleClassrooms_`; update exports; no structural change                                                                                                                                                                                                     |
| `src/backend/z_Api/assignmentDefinitionPartials.js`           | 333          | ≈ 333              | ≈ 0        | Rename handler and helper functions to a trailing underscore; no structural wrapping overhead; validation unchanged                                                                                                                                                                             |
| `src/backend/z_Api/apiConfig.js`                              | 168          | ≈ 168              | ≈ 0        | Rename `getBackendConfig` → `getBackendConfig_`, `setBackendConfig` → `setBackendConfig_`, `maskApiKey` → `maskApiKey_`; update exports; no structural change                                                                                                                                   |
| `src/backend/z_Api/abclassMutations.js`                       | 219          | ≈ 165              | ≈ −54      | Rename handlers and helpers to a trailing underscore; remove `validateClassId` (≈8 lines), `validateCourseLength` (≈8 lines), `requireParameters` (≈10 lines), simplify validation callers (≈20 lines); no structural wrapping overhead                                                         |
| `src/frontend/src/services/authService.ts`                    | 12           | ≈ 14               | +2         | Add import of `AuthorisationStatusSchema` and wrap `callApi` return                                                                                                                                                                                                                             |
| `src/frontend/src/services/authService.zod.ts`                | 0 (new)      | ≈ 5                | +5         | New schema file: 3 content lines + schema + type export                                                                                                                                                                                                                                         |
| `src/frontend/src/services/authService.spec.ts`               | 23           | ≈ 33               | +10        | Add two Zod rejection tests                                                                                                                                                                                                                                                                     |
| `tests/backend-api/abclassPartials.unit.test.js`              | 53           | 0 (deleted)        | −53        | Wrapper no longer exists; tests were asserting indirection only                                                                                                                                                                                                                                 |
| `tests/backend-api/referenceData.unit.test.js`                | 114          | 0 (deleted)        | −114       | Wrapper no longer exists; tests were asserting indirection only                                                                                                                                                                                                                                 |
| `tests/backend-api/assignmentDefinitionPartials.unit.test.js` | 178          | ≈ 178              | ≈ 0        | Update module-load to destructure `getAssignmentDefinitionPartials_` / `deleteAssignmentDefinition_`; validation tests unchanged                                                                                                                                                                |
| `tests/backend-api/abclassMutations.unit.test.js`             | 88           | ≈ 60               | ≈ −28      | Update module-load to destructure `upsertABClass_`, `updateABClass_`, `deleteABClass_`; remove test cases for deleted classId non-empty and courseLength validation; unsafe path-char tests retained                                                                                            |
| `tests/api/googleClassrooms.test.js`                          | 118          | ≈ 118              | ≈ 0        | Update all direct handler accesses to use `getGoogleClassrooms_` from module export; update export-shape assertion; test count and content unchanged                                                                                                                                            |
| `tests/api/assignmentDefinitionDeleteApi.test.js`             | 116          | ≈ 116              | ≈ 0        | Update direct handler accesses to use `deleteAssignmentDefinition_` from module export; test content unchanged                                                                                                                                                                                  |
| `tests/api/abclassMutations.test.js`                          | 455          | ≈ 330              | ≈ −125     | Delete two VM coexistence tests referencing `referenceData.js` (≈84 lines); update function accesses to `upsertABClass_`, `updateABClass_`, `deleteABClass_`; remove `courseLength` tests (≈33 lines), requireParams tests (≈28 lines), restructure deleteABClass classId `it.each` (≈−5 lines) |
| `tests/api/backendConfigApi.test.js`                          | 504          | ≈ 504              | ≈ 0        | Routes through apiHandler dispatch; no direct module-load changes; confirm green after Section 4                                                                                                                                                                                                |
| `tests/api/auth.test.js`                                      | 67           | 0 (deleted)        | −67        | Tests the now-deleted `auth.js`; two controller-delegation tests migrated to `apiHandler.test.js`; vm-context file test dropped                                                                                                                                                                 |
| `tests/api/abclassPartials.test.js`                           | 119          | 0 (deleted)        | −119       | Tests `API_METHODS`, `API_ALLOWLIST`, and `globalThis.getABClassPartials`, all removed; routing/envelope coverage migrated to `apiHandler.test.js`                                                                                                                                              |
| `tests/api/apiHandler.test.js`                                | 1,491        | ≈ 1,420            | ≈ −71      | Remove `API_METHODS`/`API_ALLOWLIST` tests (≈70 lines); remove `_invokeAllowlistedMethod` test (8 lines); add parameter-extraction contract tests and trailing-underscore private function stubs (≈6 lines net after old global-function stubs removed)                                         |
| `tests/api/apiHandlerLocking.test.js`                         | 194          | ≈ 194              | ≈ 0        | Stub type changes: controller constructor mocks (Pass A), then trailing-underscore private function globals (Pass B); count stable                                                                                                                                                              |
| `tests/api/apiHandlerTiming.test.js`                          | 216          | ≈ 216              | ≈ 0        | Same two-pass stub updates; count stable                                                                                                                                                                                                                                                        |
| `tests/api/staleAdmission.test.js`                            | 183          | ≈ 183              | ≈ 0        | Update `getAuthorisationStatus` assertion to check controller instance; count stable                                                                                                                                                                                                            |
| `tests/helpers/apiHandlerTestUtils.js`                        | 220          | ≈ 250              | ≈ +30      | Add `installControllerMocks`/`restoreControllerMocks`; Pass A `additionalHandlers` retained; Pass B replace with trailing-underscore private function globals; net smaller than original estimate as `additionalHandlers` is removed                                                            |
| `docs/developer/backend/api-layer.md`                         | 205          | ≈ 192              | ≈ −13      | Update dispatch section + endpoint source notes for deleted and restructured files                                                                                                                                                                                                              |
| `src/backend/AGENTS.md`                                       | 162          | ≈ 162              | ≈ 0        | Update migration pattern signpost; add transport-helper pattern description; count stable                                                                                                                                                                                                       |
| **Total (affected files)**                                    | **≈ 5,442**  | **≈ 4,582**        | **≈ −860** | Expanded scope with corrected baseline counts; net reduction well above the ≥ 200 line pass-gate; trailing-underscore renaming adds no overhead versus IIFE/object-literal patterns, marginally improving the delta                                                                             |

> Every existing-file baseline LOC figure in this table is an exact current `wc -l` measurement where
> available; estimated rows are marked `≈`. New-file rows use a baseline of `0` by definition. Expected
> post-change LOC and Δ figures remain estimates where marked with `≈`.

---

## Global constraints and quality gates

### Engineering constraints

- Transport envelope shape must be identical before and after; no functional change is permitted.
- Fail fast on invalid inputs; do not add defensive guards that mask wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- The guarded `if (typeof module !== 'undefined' && module.exports)` export block is the only permitted
  Node-testing shim in backend production files.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase:

1. List required documentation file paths under that phase before delegation.
2. Require the sub-agent handoff to include `Files read` with explicit file paths.
3. Verify every mandatory file is listed before accepting the handoff.
4. If any mandatory file is missing, return the work to the same sub-agent and block progression.

### Validation command hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Backend tests (apiHandler suite): `npm test -- tests/api/apiHandler.test.js`
- Backend tests (all api/ suites): `npm test -- tests/api/`
- Backend tests (backend-api suite): `npm test -- tests/backend-api/`
- Frontend unit tests (authService): `npm run frontend:test -- src/frontend/src/services/authService.spec.ts`
- Full backend test run: `npm test`
- Full frontend test run: `npm run frontend:test`

---

## Section 1 — Architecture signpost and docs-first pass

### Objective

Update `docs/developer/backend/api-layer.md` and `src/backend/AGENTS.md` to describe the target
architecture **before any production code changes are made**. Mark planned patterns as
`Not implemented` so that agents executing later sections cannot inadvertently recreate the old
multi-entry-point pattern. This section contains documentation changes only; no production source
files may be modified.

### Constraints

- No production code changes are permitted in this section.
- Docs changes must be the minimum needed to codify the architectural intent and planned helper/pattern
  entries; do not pre-write implementation details that belong in later sections.
- Use `Not implemented` status markers consistently for any planned helper pattern that is not yet in
  code.
- British English throughout.

### Delegation mandatory reads

Docs mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/apiConfig.js`

### Shared helper plan

Helper decision entries:

1. Helper: trailing-underscore private transport-helper function pattern (for non-trivial z_Api files)
   - Decision: `new`
   - Owning module/path: `src/backend/z_Api/*` (per-file)
   - Call-site rationale: the official Apps Script specification excludes functions whose names end
     with `_` from the callable surface exposed to `google.script.run`. Renaming handler functions
     with a trailing underscore prevents direct invocation without requiring IIFE or namespace-object wrappers.
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` and
     `src/backend/AGENTS.md`
   - Planned doc status: **Not implemented** — add to both docs in this section before code lands
     (already added in the current doc-update pass; confirm markers are present before code changes
     start)

2. Helper: `installControllerMocks` / `restoreControllerMocks` in `apiHandlerTestUtils.js`
   - Decision: `new`
   - Owning module/path: `tests/helpers/apiHandlerTestUtils.js`
   - Call-site rationale: after trivial handler inlining, test stubs must target controller
     constructors rather than global handler functions.
   - Relevant canonical doc target: `docs/developer/backend/backend-testing.md` (if it documents
     test helper patterns) — check before adding.
   - Planned doc status: **Not implemented** — add entry in this section

3. Helper: trailing-underscore private stubs in `apiHandlerTestUtils.js` (Pass B)
   - Decision: `new`
   - Owning module/path: `tests/helpers/apiHandlerTestUtils.js`
   - Call-site rationale: after non-trivial handlers move to trailing-underscore private helpers, test
     stubs must target `globalThis.getGoogleClassrooms_` etc. rather than public global handler functions.
   - Planned doc status: **Not implemented** — add entry in this section

### Acceptance criteria

- `docs/developer/backend/api-layer.md` contains a clearly labelled section describing:
  - The architectural target: `apiHandler` as the sole frontend-callable GAS entry point.
  - The trivial-inline pattern (anonymous closure in `ALLOWLISTED_METHOD_HANDLERS`).
  - The trailing-underscore private transport-helper pattern (`function handlerName_(…)`), marked
    `Not implemented`.
  - The validation ownership rules (transport boundary vs domain invariants).
- `src/backend/AGENTS.md` § 0.1 is updated to:
  - Remove the instruction to register in `API_METHODS` and `API_ALLOWLIST` (still to be removed
    from code, but the doc instruction is updated now so agents do not follow the old pattern during
    the refactor).
  - Describe both the trivial-inline and trailing-underscore private transport-helper patterns.
  - Codify the transport-vs-domain validation ownership rules (§ 0.2).
  - Mark the trailing-underscore private helper pattern `Not implemented`.
- No production source files are changed.
- All tests remain green (no code changed; test run confirms baseline still passes).
- Planned helper entries in `docs/developer/backend/backend-testing.md` are added with status
  `Not implemented` for `installControllerMocks` and the trailing-underscore private function stub pattern.

### Required test cases (Red first)

No new test cases are written in this section (documentation only). The section check is a full
baseline test run to confirm no regressions were introduced by docs changes.

### Section checks

- `npm test` — full backend test run; all tests green (no code changes; confirms baseline).
- `npm run lint` — no lint errors.
- Mandatory-read evidence gate passed for all delegated docs handoffs.
- `Not implemented` markers are present for both planned helper entries in the relevant canonical docs.

### Optional `@remarks` JSDoc follow-through

- None; no code is changed in this section.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Section 1 acceptance criteria were already satisfied at baseline; no additional file changes were required for this section.
- **Deviations from plan:** None.
- **Follow-up implications for Section 2:** Section 2 can proceed without carry-over work from Section 1; keep the existing docs-first markers intact.
- **Baseline note:** A pre-existing lint warning was observed and treated as non-blocking for this documentation-only section.

### Section 1 completion checklist

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created _(pending)_
- [ ] push completed _(pending)_

---

## Section 2 — Registry consolidation

### Objective

Remove `API_METHODS` and `API_ALLOWLIST` from `apiConstants.js`. Simplify the dispatch path in
`z_apiHandler.js` so that `handle()` looks up `methodName` directly in `ALLOWLISTED_METHOD_HANDLERS`
and calls the result, eliminating the two-step lookup and `_invokeAllowlistedMethod`.

This section does **not** yet change handler closures or delete wrapper files. It proves the simplified
dispatch path is correct before the closures change.

### Constraints

- The transport envelope shape is unchanged.
- All existing dispatcher tests that are not about `API_METHODS`, `API_ALLOWLIST`, or
  `_invokeAllowlistedMethod` must remain green.
- Handler globals (`globalThis.getAuthorisationStatus`, `globalThis.getCohorts`, etc.) are still in place
  at this stage; the test harness does not change in this section.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `tests/api/apiHandler.test.js`

### Shared helper plan

No new shared helpers are expected in this section.

### Acceptance criteria

- `API_METHODS` is not present in `apiConstants.js` or its `module.exports`.
- `API_ALLOWLIST` is not present in `apiConstants.js` or its `module.exports`.
- `ALLOWLISTED_METHOD_HANDLERS` object in `z_apiHandler.js` is unchanged.
- `handle()` performs a single lookup: `const handler = ALLOWLISTED_METHOD_HANDLERS[methodName]`.
- `_invokeAllowlistedMethod` no longer exists in `z_apiHandler.js`.
- The `apiAllowlist` module-level variable and both its initialisation lines (Node require block and GAS
  branch) are removed.
- `ALLOWLISTED_METHOD_HANDLERS` is added to the guarded `module.exports` block in `z_apiHandler.js`
  so tests can assert its keys directly, consistent with the pattern used for `apiHandler` and
  `ApiDispatcher`. This is the preferred approach over a vm-level introspection workaround.
- All existing dispatcher lifecycle tests pass (admission, completion, rate limiting, error mapping,
  request ID, success/failure envelopes).
- Tests that previously asserted `API_METHODS` or `API_ALLOWLIST` presence are removed or replaced with
  tests that assert the relevant methods are keys in `ALLOWLISTED_METHOD_HANDLERS`.
- The direct `_invokeAllowlistedMethod` test (line ≈ 1179 in the baseline file) is removed.
- The VM context test that passes `API_ALLOWLIST` as a vm global is updated to work without it.

### Required test cases (Red first)

API layer tests (update/replace in `tests/api/apiHandler.test.js`):

1. **Remove**: test asserting `API_METHODS.getAuthorisationStatus === 'getAuthorisationStatus'`.
2. **Remove**: all tests asserting that `API_METHODS` contains specific method groups
   (`REFERENCE_DATA_API_METHOD_NAMES`, `ABCLASS_TRANSPORT_API_METHOD_ENTRIES`,
   `BACKEND_CONFIG_API_METHOD_ENTRIES`, `ASSIGNMENT_DEFINITION_API_METHOD_ENTRIES`).
3. **Remove**: all tests asserting `API_ALLOWLIST` contains specific method groups (same groups).
4. **Replace** with: a single test that `ALLOWLISTED_METHOD_HANDLERS` (loaded via `loadApiHandlerModule`)
   contains all 18 expected method names as own keys.
5. **Remove**: test `'throws when an unrecognised handler name is passed to _invokeAllowlistedMethod'`.
6. **Update**: VM context test `'operates correctly via BaseSingleton in a GAS-like VM context'` — remove
   `API_ALLOWLIST` from its `makeVmGlobals` override; `getAuthorisationStatus` remains a top-level vm
   global at this stage because the closure still delegates to it; the vm context now relies only on
   `ALLOWLISTED_METHOD_HANDLERS` for routing.
7. **Update**: VM context test `'uses global API_ALLOWLIST in vm context and returns INTERNAL_ERROR...'`
   — this test is no longer meaningful after registry consolidation; replace with a test verifying that a
   method present in `ALLOWLISTED_METHOD_HANDLERS` but whose handler throws returns `INTERNAL_ERROR`. In
   the replacement test, `makeVmGlobals` must provide a top-level `getAuthorisationStatus` global that
   throws rather than a `ScriptAppManager` mock; `API_ALLOWLIST` must not be provided. (Note: providing a
   top-level `getAuthorisationStatus` global is still correct at this stage because Section 2 does not
   inline the closure — the handler still delegates to the global; the restriction on top-level vm globals
   is enforced in Section 3 after inlining.)

### Section checks

- `npm test -- tests/api/apiHandler.test.js` — all tests green.
- `npm run lint` — no backend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` note to `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` confirming it is the single
  authoritative registry and that all frontend-callable methods must be added here only.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red phase completed by replacing legacy allowlist/API-method assertions with handler-registry coverage updates in `tests/api/apiHandler.test.js`, including VM-context updates that no longer depend on `API_ALLOWLIST`. Green phase completed by removing legacy registry exports from `src/backend/z_Api/apiConstants.js` and consolidating dispatch onto `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
- **Deviations from plan:** None.
- **Follow-up implications for Section 3:** Section 3 can proceed on the consolidated handler registry baseline with no additional Section 2 carry-over.

**Section 2 completion checklist**

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created _(pending)_
- [ ] push completed _(pending)_

---

## Section 3 — Wrapper file elimination and handler inlining

### Objective

Delete `auth.js`, `abclassPartials.js`, and `referenceData.js`. Inline their controller calls as
single-expression closures in `ALLOWLISTED_METHOD_HANDLERS`. Update `apiHandlerTestUtils.js` (Pass A)
to mock controller constructors instead of global handler functions for the inlined methods; temporarily
retain `additionalHandlers` for the non-trivial globals that still exist as top-level functions at this
stage (`getGoogleClassrooms`, `upsertABClass`, `updateABClass`, `deleteABClass`,
`getAssignmentDefinitionPartials`, `deleteAssignmentDefinition`). `getBackendConfig` and
`setBackendConfig` are NOT in `additionalHandlers` at any stage. Delete the now-obsolete wrapper unit
tests. Update `apiHandler.test.js` to use controller mocks and add parameter extraction contract tests.

**Important**: the non-trivial handler globals (`getGoogleClassrooms`, `upsertABClass`, etc.) are NOT
inlined or wrapped in this section — they remain as top-level GAS callable functions. Section 4 handles
their restructure. `additionalHandlers` and `buildApiHandlerTestHandlers()` are deliberately kept for
them during this section and will be removed in Section 4.

### Constraints

- Parameter extraction shapes must exactly match the contracts documented in `SPEC.md` § "Parameter
  extraction contract for inlined reference-data closures".
- Each controller is instantiated fresh per call (same behaviour as the old wrapper files).
- No top-level GAS `function` declarations for `getAuthorisationStatus`, `getABClassPartials`,
  `getCohorts`, `createCohort`, `updateCohort`, `deleteCohort`, `getYearGroups`, `createYearGroup`,
  `updateYearGroup`, `deleteYearGroup` may exist anywhere after this section.
- `getAuthorisationStatus` must not appear as a top-level vm global in any vm sandbox test after this
  section; any vm context test that dispatches `getAuthorisationStatus` must do so through the inlined
  closure using a `ScriptAppManager` mock.
- All tests that were not about these now-deleted wrapper files must remain green.
- `apiHandlerTestUtils.js` is a test helper; it follows the backend test conventions (`docs/developer/backend/backend-testing.md`).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `tests/api/apiHandler.test.js`
- `tests/api/apiHandlerLocking.test.js`
- `tests/api/apiHandlerTiming.test.js`
- `tests/api/staleAdmission.test.js`
- `tests/api/auth.test.js`
- `tests/api/abclassPartials.test.js`
- `tests/api/abclassMutations.test.js`
- `tests/helpers/apiHandlerTestUtils.js`
- `tests/backend-api/abclassPartials.unit.test.js`
- `tests/backend-api/referenceData.unit.test.js`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/auth.js`
- `src/backend/z_Api/abclassPartials.js`
- `src/backend/z_Api/referenceData.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/auth.js`
- `src/backend/z_Api/abclassPartials.js`
- `src/backend/z_Api/referenceData.js`
- `tests/api/apiHandler.test.js`
- `tests/api/apiHandlerLocking.test.js`
- `tests/api/apiHandlerTiming.test.js`
- `tests/api/staleAdmission.test.js`
- `tests/api/auth.test.js`
- `tests/api/abclassPartials.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `tests/api/apiHandler.test.js`
- `tests/api/apiHandlerLocking.test.js`
- `tests/api/apiHandlerTiming.test.js`
- `tests/api/staleAdmission.test.js`
- `tests/api/auth.test.js`
- `tests/api/abclassPartials.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

### Shared helper plan

Helper decision entries:

1. Helper: `setupApiHandlerTestContext` controller mock pattern
   - Decision: `extend`
   - Owning module/path: `tests/helpers/apiHandlerTestUtils.js`
   - Call-site rationale: the existing helper installs handler function globals; after inlining, tests for
     affected methods require controller constructor globals instead. Adding an `installControllerMocks`
     sub-helper alongside the existing `installApiMethodHandlers` keeps the extension localised.
   - Relevant canonical doc target: `docs/developer/backend/backend-testing.md` (if it documents test
     helper patterns) — check before adding.
   - Planned doc status: Not implemented

### Acceptance criteria

- `src/backend/z_Api/auth.js` does not exist.
- `src/backend/z_Api/abclassPartials.js` does not exist.
- `src/backend/z_Api/referenceData.js` does not exist.
- `tests/backend-api/abclassPartials.unit.test.js` does not exist.
- `tests/backend-api/referenceData.unit.test.js` does not exist.
- `tests/api/auth.test.js` does not exist.
- `tests/api/abclassPartials.test.js` does not exist.
- The two VM coexistence tests that `readFileSync` `referenceData.js` in `tests/api/abclassMutations.test.js`
  are deleted; `tests/api/abclassMutations.test.js` no longer contains `fs.readFileSync(referenceDataPath)`
  or `import fs`, `import path`, `import vm` unless they are still needed by other tests.
- `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` contains inline closures for all ten affected methods
  using the exact controller call patterns from `SPEC.md`.
- The dispatcher routes `getAuthorisationStatus` to `new ScriptAppManager().isAuthorised()`.
- The dispatcher routes `getABClassPartials` to `new ABClassController().getAllClassPartials()`.
- The dispatcher routes `getCohorts` to `new ReferenceDataController().listCohorts()` (no args).
- `createCohort` extracts `parameters.record` and passes it to `ReferenceDataController.createCohort`.
- `updateCohort` passes the full `parameters` object to `ReferenceDataController.updateCohort`.
- `deleteCohort` extracts `parameters.key` and passes it to `ReferenceDataController.deleteCohort`.
- Same extraction patterns hold for the four year-group methods.
- `apiHandler.test.js` tests for `getAuthorisationStatus`, `getABClassPartials`, and all reference-data
  methods use controller constructor mocks, not `globalThis[methodName]` mocks.
- `apiHandlerLocking.test.js`, `apiHandlerTiming.test.js`, and `staleAdmission.test.js` all pass with the
  updated constructor-mock context (no `globalThis.getAuthorisationStatus` stubs remain).
- `staleAdmission.test.js` all three `globalThis.getAuthorisationStatus` assertions (positive at line ≈ 45,
  negative at line ≈ 69, and positive at line ≈ 181) are migrated to check
  `context.scriptAppManagerInstance.isAuthorised` using the handle returned by `installControllerMocks`.
- Error propagation tests for reference-data handlers (e.g. controller throwing) are present in
  `apiHandler.test.js`.
- `npm test -- tests/api/abclassMutations.test.js` passes green (coexistence tests deleted; remaining
  function-delegation tests still pass using top-level function exports, which still exist at this stage).

### Required test cases (Red first)

Test file deletions:

1. **Delete** `tests/backend-api/abclassPartials.unit.test.js`.
2. **Delete** `tests/backend-api/referenceData.unit.test.js`.
3. **Delete** `tests/api/auth.test.js` — this file contains three tests:
   - The two controller-delegation tests (`creates ScriptAppManager and returns true when authorised`
     and `creates ScriptAppManager and returns false when not authorised`) must be migrated as new tests
     in `tests/api/apiHandler.test.js` asserting that the dispatcher's `getAuthorisationStatus` closure
     calls the mocked `ScriptAppManager` constructor and returns the expected boolean.
   - The third test (`works when module exports are unavailable in the runtime context`) tests vm-context
     loading of the deleted `auth.js` file and is dropped with the file; it must not be migrated.
4. **Delete** `tests/api/abclassPartials.test.js` — verify that routing and error-envelope coverage
   for `getABClassPartials` (dispatch to `ABClassController` mock, success envelope, error maps to
   failure envelope) has been added to `tests/api/apiHandler.test.js` before deleting. If this coverage
   does not already exist in `apiHandler.test.js`, add it first. The task is to add new routing/envelope
   coverage in `apiHandler.test.js`; do not attempt to update the existing stubs in the deleted file.

API layer tests (update/add in `tests/api/apiHandler.test.js`):

1. **Update**: routing tests for `getAuthorisationStatus` — mock `globalThis.ScriptAppManager` constructor
   to return `{ isAuthorised: vi.fn(() => true) }`; assert constructor called and result returned.
2. **Update**: routing tests for `getABClassPartials` — mock `globalThis.ABClassController` constructor
   to return `{ getAllClassPartials: vi.fn(() => [...]) }`; assert constructor called and result returned.
3. **Update**: routing tests for all eight reference-data methods — mock `globalThis.ReferenceDataController`
   constructor to return an object with all eight controller methods as vi.fn() stubs; assert constructor
   called once per dispatch and correct method called with correct args. Note that two transport names do
   not map directly to controller method names: the transport method `getCohorts` calls
   `ReferenceDataController.listCohorts`, and `getYearGroups` calls `ReferenceDataController.listYearGroups`;
   all other reference-data transport names map directly to the identically-named controller method.
4. **New — parameter extraction contract tests**:
   - `createCohort` with `params = { record: { name: 'X' } }` — assert controller's `createCohort` is
     called with `{ name: 'X' }` (not the full `parameters` object).
   - `deleteCohort` with `params = { key: 'coh-001' }` — assert controller's `deleteCohort` is called
     with `'coh-001'` (string, not the wrapper object).
   - `updateCohort` with `params = { key: 'coh-001', record: { ... } }` — assert controller's
     `updateCohort` is called with the full `params` object.
   - Same three shapes for year-group variants.
5. **Update**: error-mapping tests that iterate over `INVALID_REQUEST_FAILURE_CASES` and currently mock
   `globalThis[handlerName].mockImplementation(...)` — update only the reference-data cases to throw from
   the controller stub. Specifically, when `handlerName` corresponds to a `ReferenceDataController` method
   (e.g. `createCohort`), the override becomes
   `context.referenceDataControllerInstance.createCohort.mockImplementation(() => { throw ... })` (and
   likewise for the other reference-data methods in the loop). The `upsertABClass` and `updateABClass`
   cases in the same loop are **not** inlined in Section 3 — those handler globals remain on `globalThis`
   until Section 4, and their `mockImplementation` overrides stay as global stubs in this section; do not
   migrate them to trailing-underscore private helper mocks until Section 4.
6. **Update**: `IN_USE` error tests for `deleteCohort` / `deleteYearGroup` — update stubs to throw from
   `context.referenceDataControllerInstance[handlerName]`, not a global function.
7. **Update**: the basic success-envelope test (line ≈ 480, `data: { authorised: true }`) — once the auth
   dispatch closure returns the boolean from `ScriptAppManager.isAuthorised()`, update the expectation to
   `data: true`.
8. **Audit — `getAuthorisationStatus`**: before the section is considered complete, run a grep/search for
   `getAuthorisationStatus` in `tests/api/apiHandler.test.js`. Every hit that is a direct
   `globalThis.getAuthorisationStatus` assignment, stub override, or `mockImplementation` call must be
   migrated to the `ScriptAppManager` constructor mock pattern before this section is complete. The review
   found many such occurrences spread across the suite; every instance must be updated.
9. **Audit — inlined reference-data and class-partials globals**: run a second grep/search for the direct
   global stubs that correspond to the other inlined methods:
   ```
   grep -n 'updateYearGroup\|deleteCohort\|getABClassPartials\|globalThis\.getCohorts\|globalThis\.createCohort\|globalThis\.updateCohort\|globalThis\.getYearGroups\|globalThis\.createYearGroup\|globalThis\.deleteYearGroup' tests/api/apiHandler.test.js
   ```
   Every hit that is a direct `globalThis` assignment, stub override, or `mockImplementation` call for any
   of these names must be migrated to the appropriate controller mock (`referenceDataControllerInstance` or
   `abClassControllerInstance`) before this section is considered complete. Stubs for
   `updateYearGroup`, `deleteCohort`, and `getABClassPartials` are particularly easy to miss because they
   may appear outside the main failure-cases loop.

VM-context migration (`tests/api/apiHandler.test.js`):

1. **Update** `makeVmGlobals`: ensure `getAuthorisationStatus` is not provided as a top-level vm global
   after inlining; the `getAuthorisationStatus` closure in `ALLOWLISTED_METHOD_HANDLERS` dispatches via
   `new ScriptAppManager().isAuthorised()` — `ScriptAppManager` must be present in the sandbox instead.
2. **Add** `ScriptAppManager` to the base `makeVmGlobals` object (or via an override) so that any vm
   context test that dispatches `getAuthorisationStatus` works through the inlined closure.
3. **Update** the INTERNAL_ERROR replacement vm test (introduced in Section 2): if it dispatches
   `getAuthorisationStatus`, provide a `ScriptAppManager` mock whose `isAuthorised` throws rather than
   a top-level `getAuthorisationStatus` global.

Test helper updates (`tests/helpers/apiHandlerTestUtils.js`):

1. Add `installControllerMocks(vi, { scriptAppManagerBehaviour, abClassControllerBehaviour, referenceDataControllerBehaviour })` helper that installs constructor stubs for the three controllers and returns both the originals and all mock handles:
   ```
   {
     originals,
     scriptAppManagerCtor,
     scriptAppManagerInstance,
     abClassControllerCtor,
     abClassControllerInstance,
     referenceDataControllerCtor,
     referenceDataControllerInstance,
   }
   ```
   `scriptAppManagerInstance` is the mock object returned by `new ScriptAppManager()`, enabling callers to override `isAuthorised.mockImplementation(...)` per test. `abClassControllerInstance` is the mock object returned by `new ABClassController()`, enabling callers to override `getAllClassPartials.mockImplementation(...)`. `referenceDataControllerInstance` is the mock object returned by `new ReferenceDataController()`, enabling callers to override any of its eight method stubs per test.
2. Add `restoreControllerMocks(originals)` counterpart.
3. Update `setupApiHandlerTestContext`: retain the existing `handler` option, redefining it as the default
   implementation used by the mocked `ScriptAppManager().isAuthorised()` path — the installed
   `ScriptAppManager` constructor mock's `isAuthorised()` method delegates to `handler()`, defaulting to
   `() => true`. Retain `additionalHandlers` for non-inlined globals only (`googleClassrooms`,
   `abclassMutations`, `assignmentDefinitionPartials`). Note: `getBackendConfig` and `setBackendConfig`
   are **not** installed via `additionalHandlers` or as `globalThis` function globals; they are wired
   through `getBackendConfig_` / `setBackendConfig_` imports in `z_apiHandler.js` via the guarded
   Node require block and require no change in the test helper.
   Remove `buildReferenceDataHandlers()` from `buildApiHandlerTestHandlers()` in `apiHandler.test.js`
   — reference-data methods are now dispatched through `ReferenceDataController` constructor mocks and
   must not be stubbed as global handler functions. Keep only the remaining non-inlined handler globals
   there (`buildAbClassTransportHandlers()` and `buildAssignmentDefinitionHandlers()`).
   Additionally, any direct `globalThis.getABClassPartials` stub in `apiHandler.test.js` must be migrated
   to an `ABClassController` constructor mock via `installControllerMocks`; this is part of the Section 3
   handler-inlining work and must be complete before the section is considered done.
   Replace the `globalThis.getAuthorisationStatus` installation in `installApiMethodHandlers` with an
   `installControllerMocks` call covering the inlined methods.
   All handles returned by `installControllerMocks` (i.e. `scriptAppManagerCtor`,
   `scriptAppManagerInstance`, `abClassControllerCtor`, `abClassControllerInstance`,
   `referenceDataControllerCtor`, `referenceDataControllerInstance`) must be **merged onto the context
   object** returned by `setupApiHandlerTestContext`, so that individual tests can access them as
   `context.scriptAppManagerInstance`, `context.abClassControllerInstance`, and
   `context.referenceDataControllerInstance` without separately calling `installControllerMocks`.
4. Update `teardownApiHandlerTestContext` to call `restoreControllerMocks`.

`tests/api/abclassMutations.test.js` VM coexistence test deletion:

The two VM coexistence tests (lines ≈ 256–339) read `referenceData.js` from disk via `fs.readFileSync`
to verify GAS global-scope isolation between the two files. Once `referenceData.js` is deleted, these
tests fail with a file-not-found error. They are deleted in this section:

1. Delete the test `'keeps using the ABClass controller when reference-data API helpers are loaded into
the same GAS global scope'` (lines ≈ 256–296).
2. Delete the test `'keeps using the reference-data controller when ABClass API helpers are loaded into
the same GAS global scope'` (lines ≈ 298–339).
3. Remove the `import fs from 'node:fs'`, `import path from 'node:path'`, and `import vm from 'node:vm'`
   imports at the top of the file if they are no longer used by any remaining test in the file.

4. **`tests/api/apiHandlerLocking.test.js`** — **audit the entire file** for every direct
   `globalThis.getAuthorisationStatus` stub, assignment, or assertion — not just the instance near
   line 39. Run `grep -n 'getAuthorisationStatus' tests/api/apiHandlerLocking.test.js` before
   starting migration and treat every hit as in scope. Remove all such stubs; the default
   `ScriptAppManager` constructor mock installed by `setupApiHandlerTestContext` handles the auth path.
   Where a test requires specific auth behaviour (e.g. for call-order tracking), override
   `context.scriptAppManagerInstance.isAuthorised.mockImplementation(...)` using the handle returned by
   `installControllerMocks`. Update all call-order assertions that reference `getAuthorisationStatus`
   to reference the `ScriptAppManager` instance method instead.
5. **`tests/api/apiHandlerTiming.test.js`** — the suite contains two error-path tests that override
   `globalThis.getAuthorisationStatus` with a throwing stub (lines ≈ 151–153 and ≈ 170–172). These must
   be migrated to override `context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => { throw thrownError; })` using the handle returned by `installControllerMocks`. Verify that
   `callAuthorisationStatus(dispatcher)` continues to work through the updated default context for all
   non-error-path timing tests.
6. **`tests/api/staleAdmission.test.js`** — update all three assertions to use
   `context.scriptAppManagerInstance.isAuthorised` (the instance method spy on the mock object returned
   by `new ScriptAppManager()`, available via the handle returned by `installControllerMocks`):
   - Positive assertion (line ≈ 45): change `expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1)`
     to `expect(context.scriptAppManagerInstance.isAuthorised).toHaveBeenCalledTimes(1)`.
   - Negative assertion (line ≈ 69): change `expect(globalThis.getAuthorisationStatus).not.toHaveBeenCalled()`
     to `expect(context.scriptAppManagerInstance.isAuthorised).not.toHaveBeenCalled()`.
   - Positive assertion (line ≈ 181): change `expect(globalThis.getAuthorisationStatus).toHaveBeenCalledTimes(1)`
     to `expect(context.scriptAppManagerInstance.isAuthorised).toHaveBeenCalledTimes(1)`.

### Section checks

- `npm test -- tests/api/apiHandler.test.js` — all tests green.
- `npm test -- tests/api/apiHandlerLocking.test.js` — all tests green.
- `npm test -- tests/api/apiHandlerTiming.test.js` — all tests green.
- `npm test -- tests/api/staleAdmission.test.js` — all tests green.
- `npm test -- tests/api/abclassMutations.test.js` — all retained tests green; coexistence tests absent.
- `npm test -- tests/backend-api/` — no test files exist for deleted wrappers; suite passes (empty or
  with other test files unchanged).
- `npm run lint` — no backend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entry in `docs/developer/backend/backend-testing.md` (if applicable) has status
  `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` to `ALLOWLISTED_METHOD_HANDLERS` noting that closures are intentionally non-global so
  that only `apiHandler` is callable via `google.script.run`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red-phase migration completed by deleting wrapper-focused tests/files (`tests/backend-api/abclassPartials.unit.test.js`, `tests/backend-api/referenceData.unit.test.js`, `tests/api/auth.test.js`, `tests/api/abclassPartials.test.js`), removing the two `referenceData.js` VM coexistence tests from `tests/api/abclassMutations.test.js`, and updating `tests/helpers/apiHandlerTestUtils.js` plus API-layer suites to use controller-constructor mocks (`ScriptAppManager`, `ABClassController`, `ReferenceDataController`) for the inlined transport methods.
- **Implementation notes:** Green-phase implementation completed by deleting `src/backend/z_Api/auth.js`, `src/backend/z_Api/abclassPartials.js`, and `src/backend/z_Api/referenceData.js`, and inlining the corresponding trivial handler closures directly in `src/backend/z_Api/z_apiHandler.js` (including required parameter extraction shapes).
- **Implementation notes:** Review and required checks completed clean for this section.
- **Deviations from plan:** None.
- **Follow-up implications for Section 4:** Transitional `additionalHandlers` entries intentionally retained only for non-trivial handlers: `getGoogleClassrooms`, `upsertABClass`, `updateABClass`, `deleteABClass`, `getAssignmentDefinitionPartials`, and `deleteAssignmentDefinition` (with `getBackendConfig`/`setBackendConfig` still excluded).

**Section 3 completion checklist**

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created _(pending)_
- [ ] push completed _(pending)_

---

## Section 4 — Non-trivial transport helper restructure

### Objective

Rename handler functions in `googleClassrooms.js`, `assignmentDefinitionPartials.js`, `apiConfig.js`,
and `abclassMutations.js` to use trailing-underscore private names. The trailing underscore prevents
GAS from exposing them to `google.script.run` per the official Apps Script specification, making IIFE
and namespace-object wrappers unnecessary. Update `ALLOWLISTED_METHOD_HANDLERS` closures and
Node-compat wiring to reference the renamed functions. Update the test harness (Pass B): replace
`additionalHandlers` and non-underscore global-function stubs with trailing-underscore private
function globals. Confirm no non-underscore handler globals remain.

### Constraints

- Each file's validation and transformation logic is unchanged in this section. Functions are renamed
  in place; no validation is added or removed here (that is Section 5's remit).
- No IIFE or namespace-object wrappers are introduced; the trailing underscore alone is sufficient.
- `apiConfig.js` has special wiring today: `z_apiHandler.js` currently uses
  `getBackendConfigHandler` / `setBackendConfigHandler` indirection. In this section, remove that
  indirection entirely so both GAS and Node paths call `getBackendConfig_` / `setBackendConfig_`
  directly from `ALLOWLISTED_METHOD_HANDLERS`. The guarded Node require block must import the renamed
  helpers by name; no non-underscore `getBackendConfig` / `setBackendConfig` reference may remain in
  any GAS-executed code path.
- Node-compat bridge rule: do **not** add module-level `let`/`const getBackendConfig_` or
  `setBackendConfig_` bindings in `z_apiHandler.js`, because those would collide with the GAS
  top-level function declarations after concatenation. Instead, the guarded Node require block assigns
  the imported functions onto `global.getBackendConfig_` / `global.setBackendConfig_` so the
  `ALLOWLISTED_METHOD_HANDLERS` closures resolve the same names in both Node and GAS.
- After this section, `additionalHandlers` must be removed from `apiHandlerTestUtils.js` entirely;
  no `additionalHandlers` usages may remain in the codebase.
- All tests that were green after Section 3 must remain green after Section 4.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`
- `tests/api/googleClassrooms.test.js`
- `tests/api/assignmentDefinitionDeleteApi.test.js`
- `tests/api/abclassMutations.test.js`
- `tests/api/backendConfigApi.test.js`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/apiConfig.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/z_Api/z_apiHandler.js`
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- `tests/backend-api/abclassMutations.unit.test.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/apiConfig.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/z_Api/z_apiHandler.js`
- `tests/helpers/apiHandlerTestUtils.js`
- `tests/api/apiHandler.test.js`
- `tests/api/googleClassrooms.test.js`
- `tests/api/assignmentDefinitionDeleteApi.test.js`
- `tests/api/abclassMutations.test.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/apiConfig.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/z_Api/z_apiHandler.js`
- `tests/api/apiHandler.test.js`
- `tests/api/googleClassrooms.test.js`
- `tests/api/assignmentDefinitionDeleteApi.test.js`
- `tests/api/abclassMutations.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

### Shared helper plan

Helper decision entries:

1. Helper: trailing-underscore private function stubs in `apiHandlerTestUtils.js` (Pass B)
   - Decision: `implement` (entry was added as `Not implemented` in Section 1)
   - Owning module/path: `tests/helpers/apiHandlerTestUtils.js`
   - Call-site rationale: replaces the transitional `additionalHandlers` mechanism with a structured
     stub pattern aligned with how controller mocks work. Installs `globalThis.getGoogleClassrooms_`,
     `globalThis.upsertABClass_`, etc. as `vi.fn()` stubs; merges handles onto the context object.
   - Planned doc status: update `Not implemented` → `Implemented` in `docs/developer/backend/backend-testing.md`

### Acceptance criteria

- `src/backend/z_Api/googleClassrooms.js` exports `{ getGoogleClassrooms_ }` from its guarded
  `module.exports` block; no non-underscore top-level `function getGoogleClassrooms` declaration exists.
- `src/backend/z_Api/assignmentDefinitionPartials.js` exports
  `{ getAssignmentDefinitionPartials_, deleteAssignmentDefinition_ }` from its guarded `module.exports`
  block; all handler and helper function names end with `_`; no non-underscore top-level function
  declarations for handlers or helpers exist.
- `src/backend/z_Api/apiConfig.js` exports `{ getBackendConfig_, setBackendConfig_ }` from its guarded
  `module.exports` block; no non-underscore top-level function declarations for those handlers exist.
  `maskApiKey_` (or equivalent) also uses the trailing-underscore convention.
- `src/backend/z_Api/abclassMutations.js` exports `{ upsertABClass_, updateABClass_, deleteABClass_ }`
  from its guarded `module.exports` block; all function names end with `_`; `getAbClassController_`
  and `validateMutationClassId_` are explicitly renamed; no non-underscore
  top-level function declarations for handlers or helpers exist.
- `z_apiHandler.js` ALLOWLISTED*METHOD_HANDLERS contains closures that call the trailing-underscore private
  functions directly: `(parameters) => getGoogleClassrooms*(parameters)`, etc.
- `z_apiHandler.js` no longer contains `getBackendConfigHandler` / `setBackendConfigHandler`
  indirection; the Node require block imports `getBackendConfig_` and `setBackendConfig_` by name
  from `apiConfig.js`, assigns them to `global.getBackendConfig_` / `global.setBackendConfig_`, and
  the dispatcher closures call those private helpers directly.
- `tests/helpers/apiHandlerTestUtils.js` no longer contains `additionalHandlers` or
  `buildApiHandlerTestHandlers()` global-function stub wiring; trailing-underscore private function stubs are
  set up on `globalThis` (`globalThis.getGoogleClassrooms_`, `globalThis.upsertABClass_`, etc.) and
  their handles are merged onto the context object.
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js` loads the module and accesses
  `getAssignmentDefinitionPartials_` / `deleteAssignmentDefinition_` directly; all existing validation
  tests pass.
- `tests/backend-api/abclassMutations.unit.test.js` loads the module and accesses `upsertABClass_`,
  `updateABClass_`, `deleteABClass_` directly; tests for transport boundary (path-character safety,
  `validateParametersObject_`) still pass; `getAbClassController_` and `validateMutationClassId_`
  follow the trailing-underscore convention; tests for now-retained checks (`active` type, forbidden
  fields) still pass.
- `tests/api/googleClassrooms.test.js` — all tests updated to destructure `getGoogleClassrooms_` from
  the module and call it directly; export assertion checks for `getGoogleClassrooms_` as a function.
- `tests/api/assignmentDefinitionDeleteApi.test.js` — all tests updated to destructure
  `deleteAssignmentDefinition_` from the module and call it directly.
- `tests/api/abclassMutations.test.js` (function-delegation tests) — all direct accesses to
  `upsertABClass`, `updateABClass`, `deleteABClass` from the module are updated to use
  `upsertABClass_`, `updateABClass_`, `deleteABClass_`; the `courseLength` validation test cases
  (lines ≈ 341–373) are **not** removed in this section — they are removed in Section 5.
- `tests/api/backendConfigApi.test.js` — all tests pass green; the test routes through the apiHandler
  dispatch path, so no direct module-load changes are needed.
- A grep for `globalThis.getGoogleClassrooms`, `globalThis.upsertABClass`, `globalThis.updateABClass`,
  `globalThis.deleteABClass`, `globalThis.getAssignmentDefinitionPartials`,
  `globalThis.deleteAssignmentDefinition`, `globalThis.getBackendConfig`, `globalThis.setBackendConfig`
  in all test files returns zero results.

### Required test cases (Red first)

Trailing-underscore private structural tests (add to `tests/api/apiHandler.test.js` or a new focused file):

1. **Red**: load the renamed `googleClassrooms.js` source in a vm context and assert
   `typeof globalThis.getGoogleClassrooms === 'undefined'` while
   `typeof globalThis.getGoogleClassrooms_ === 'function'`.
2. **Red**: repeat the same direct-module vm assertion for the other renamed non-trivial handler
   names (`upsertABClass_`, `updateABClass_`, `deleteABClass_`,
   `getAssignmentDefinitionPartials_`, `deleteAssignmentDefinition_`,
   `getBackendConfig_`, `setBackendConfig_`), confirming the public non-underscore names are absent.
3. **Red**: dispatching `getGoogleClassrooms` via `apiHandler` calls
   `globalThis.getGoogleClassrooms_` and returns its result in the success envelope.
4. **Red**: dispatching `upsertABClass`, `updateABClass`, `deleteABClass` via `apiHandler` calls the
   corresponding private globals (`globalThis.upsertABClass_`, etc.).
5. **Red**: dispatching `getAssignmentDefinitionPartials`, `deleteAssignmentDefinition` via `apiHandler`
   calls `globalThis.getAssignmentDefinitionPartials_` / `globalThis.deleteAssignmentDefinition_`.

Test helper updates (`tests/helpers/apiHandlerTestUtils.js`):

1. Add `installTransportHelperMocks(vi, { googleClassroomsBehaviour, abclassMutationsBehaviour, assignmentDefinitionBehaviour })` — installs `globalThis.getGoogleClassrooms_`, `globalThis.upsertABClass_`, `globalThis.updateABClass_`, `globalThis.deleteABClass_`, `globalThis.getAssignmentDefinitionPartials_`, `globalThis.deleteAssignmentDefinition_` as `vi.fn()` stubs. Returns originals and all stub handles as a flat object. The returned handles must be merged onto the context object by `setupApiHandlerTestContext`. `getBackendConfig_` / `setBackendConfig_` are intentionally excluded because the module's own require bridge wires those names.
2. Add `restoreTransportHelperMocks(originals)` counterpart.
3. Remove `additionalHandlers` option from `setupApiHandlerTestContext`; remove `buildApiHandlerTestHandlers()` and all non-underscore global-function stub wiring that was previously installed via that mechanism.

Backend-api unit tests:

1. **Update** `tests/backend-api/assignmentDefinitionPartials.unit.test.js`: change all
   `const { getAssignmentDefinitionPartials, deleteAssignmentDefinition } = loadAssignmentDefinitionPartialsModule()` patterns to `const { getAssignmentDefinitionPartials_, deleteAssignmentDefinition_ } = loadAssignmentDefinitionPartialsModule()` and call the functions directly.
2. **Update** `tests/backend-api/abclassMutations.unit.test.js`: change all module-load patterns to
   destructure `upsertABClass_`, `updateABClass_`, `deleteABClass_`; confirm unsafe path-character tests
   still pass; confirm `validateParametersObject_` tests still pass.

Direct test-file updates for refactored modules:

3. **Update** `tests/api/googleClassrooms.test.js`: change `loadGoogleClassroomsModuleWithGlobals`
   destructuring from `{ getGoogleClassrooms }` to `{ getGoogleClassrooms_ }` in all tests; update
   all calls to `getGoogleClassrooms_(...)`; update the export-shape assertion to check
   `{ getGoogleClassrooms_: expect.any(Function) }`.
4. **Update** `tests/api/assignmentDefinitionDeleteApi.test.js`: change `loadAssignmentDefinitionPartialsModule`
   destructuring from `{ deleteAssignmentDefinition }` to `{ deleteAssignmentDefinition_ }` in all
   tests; update all calls to `deleteAssignmentDefinition_(...)`.
5. **Update** `tests/api/abclassMutations.test.js` (function-delegation tests): change
   `loadAbclassMutationsModuleWithGlobals` destructuring from `{ upsertABClass }`, `{ updateABClass }`,
   `{ deleteABClass }` to `{ upsertABClass_, updateABClass_, deleteABClass_ }`; update all direct
   function calls. Do NOT remove the `courseLength` validation tests in this section — they are
   removed in Section 5.
6. **Confirm green** `tests/api/backendConfigApi.test.js` — no changes required; test routes through
   dispatcher dispatch only.

### Section checks

- `npm test -- tests/api/apiHandler.test.js` — all tests green.
- `npm test -- tests/api/googleClassrooms.test.js` — all tests green.
- `npm test -- tests/api/assignmentDefinitionDeleteApi.test.js` — all tests green.
- `npm test -- tests/api/abclassMutations.test.js` — all tests green (courseLength tests still present
  at this point; they are removed in Section 5).
- `npm test -- tests/api/backendConfigApi.test.js` — all tests green.
- `npm test -- tests/backend-api/assignmentDefinitionPartials.unit.test.js` — all tests green.
- `npm test -- tests/backend-api/abclassMutations.unit.test.js` — all tests green.
- `npm test -- tests/api/` — all tests green.
- `npm run lint` — no backend lint errors.
- `grep -r 'globalThis\.getGoogleClassrooms\|globalThis\.upsertABClass\|globalThis\.updateABClass\|globalThis\.deleteABClass\|globalThis\.getAssignmentDefinitionPartials\|globalThis\.deleteAssignmentDefinition\|globalThis\.getBackendConfig\|globalThis\.setBackendConfig' tests/` returns zero results (note: `globalThis.getGoogleClassrooms_` and other trailing-underscore variants ARE expected to exist; only the non-underscore forms must be absent).
- Mandatory-read evidence gate passed for all delegated handoffs.
- Planned trailing-underscore private function stub helper entry in `docs/developer/backend/backend-testing.md`
  updated to `Implemented`.

### Optional `@remarks` JSDoc follow-through

- Confirm each trailing-underscore private handler function (`getGoogleClassrooms_`, `upsertABClass_`, etc.)
  carries a `@remarks` note explaining it is intentionally private to `google.script.run` by virtue
  of its trailing underscore per the Apps Script specification, and is called exclusively from the
  `ALLOWLISTED_METHOD_HANDLERS` closure in `z_apiHandler.js`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Red-phase work completed: Pass B test/helper migration landed by replacing
  transitional `additionalHandlers` wiring in `tests/helpers/apiHandlerTestUtils.js` with
  trailing-underscore transport helper stubs, and updating affected API/backend-api tests to consume
  underscore handler names.
- **Implementation notes:** Green-phase production work completed: non-trivial API handlers and related
  helper functions were renamed to trailing-underscore forms in `googleClassrooms.js`,
  `assignmentDefinitionPartials.js`, `apiConfig.js`, and `abclassMutations.js`; `z_apiHandler.js`
  ALLOWLISTED*METHOD_HANDLERS now dispatches directly to underscore helpers, with
  `getBackendConfig*`/`setBackendConfig\_`wired through the Node bridge onto`global`.
- **Implementation notes:** Code review returned clean and required section checks passed.
- **Deviations from plan:** None.
- **Follow-up implications for Section 5:** Section 5 should now target underscore helper names only
  (for example `validateParametersObject_`/other renamed validation helpers) when removing duplicated
  transport-layer validation; the planned validation removals are still pending.

**Section 4 completion checklist**

- [x] red tests added
- [x] red review clean
- [x] green implementation complete
- [x] green review clean
- [x] checks passed
- [x] action plan updated
- [ ] commit created _(pending)_
- [ ] push completed _(pending)_

---

## Section 5 — abclassMutations validation deduplication

### Objective

Remove the validation logic from `abclassMutations.js` that is already owned by
`ABClassController`. Confirm that `ABClassController` covers each removed check. Retain only genuine
transport-boundary validation. Update the `abclassMutations` unit tests to match.
`validateMutationClassId_` is retained as the shared guarded path-character safety helper and
simplified so it keeps only that responsibility after the duplicate domain checks are removed.

### Constraints

- Do not remove any validation check unless `ABClassController` already owns an equivalent check —
  confirmed at source lines listed in Assumption 4.
- The path-character safety check (`..`, `/`, `\\` in classId) is retained at the transport boundary
  for all three mutations because the controller only covers `..` and `/` for delete via
  `_validateDeleteClassId`; the transport adds `\\` and covers upsert and update.
- The path-character safety check **must be guarded** with `typeof classId === 'string'` before
  calling `.includes()`. A missing or non-string `classId` must fall through to the controller
  rather than crashing in the transport helper (which would surface as `INTERNAL_ERROR`).
- The `active` boolean/null check is retained (not in controller).
- The forbidden-fields check is retained (not in controller).
- The `validateParametersObject` plain-object check is retained (not in controller).
- Removing checks changes the error type for those inputs from `ApiValidationError` to `TypeError`
  (thrown by the controller). This change is acceptable per SPEC.md Decision 10; test assertions must
  be updated to match.
- `ABClassController` is not changed in this section unless a confirmed missing check requires
  addition (per SPEC.md Decision 10 constraint).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `tests/backend-api/abclassMutations.unit.test.js`
- `tests/api/abclassMutations.test.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/y_controllers/ABClassController.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/y_controllers/ABClassController.js`
- `tests/backend-api/abclassMutations.unit.test.js`
- `tests/api/abclassMutations.test.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/abclassMutations.js`
- `src/backend/y_controllers/ABClassController.js`
- `tests/backend-api/abclassMutations.unit.test.js`
- `tests/api/abclassMutations.test.js`

### Shared helper plan

No new shared helpers are expected in this section.

### Acceptance criteria

- `abclassMutations.js` no longer contains `validateClassId`, `validateCourseLength`, or
  `requireParameters` functions (or any trailing-underscore transport equivalents of those removed checks) —
  these are deleted entirely, not merely renamed.
- `validateUpsertABClassParameters_` inside the file retains only:
  `validateParametersObject_` call and the path-character safety check.
- `validateUpdateABClassParameters_` inside the file retains only:
  `validateParametersObject_` call, path-character safety check, forbidden-fields check, and `active`
  type check.
- `validateDeleteABClassParameters_` inside the file retains only:
  `validateParametersObject_` call and path-character safety check.
- Each path-character safety check is guarded: `.includes()` is only called when
  `typeof classId === 'string'`. Passing `{ classId: undefined }`, `{ classId: null }`, or
  any non-string `classId` to any of the three mutations does not throw from within the
  transport helper; the value falls through to the controller without causing `INTERNAL_ERROR`.
- `tests/backend-api/abclassMutations.unit.test.js` does not contain test cases asserting that the
  transport layer rejects a non-empty-string `classId` on its own; does not contain test cases for
  `courseLength` range validation or missing required fields at transport layer.
- `tests/api/abclassMutations.test.js` — the `it.each` block at lines ≈ 167–194 (missing required
  params for `upsertABClass`/`updateABClass`) is removed. The `it.each` block at lines ≈ 218–238 is
  restructured: `'missing classId'` (`{}`) and `'empty classId'` (`{ classId: '' }`) cases are
  removed; `'missing params'` (undefined → `validateParametersObject`) and `'unsafe classId'`
  (`'../class-001'` → path-character safety) cases are retained.
- `npm test -- tests/backend-api/abclassMutations.unit.test.js` passes.
- `npm test -- tests/api/abclassMutations.test.js` passes.
- `npm test -- tests/api/apiHandler.test.js` passes.

### Required test cases (Red first)

In `tests/backend-api/abclassMutations.unit.test.js`:

1. **Remove**: any test asserting `upsertABClass` or `updateABClass` or `deleteABClass` throws
   `ApiValidationError` for a non-empty-string `classId` that has no path-safety concern (e.g. an
   empty string `''`). The transport layer no longer owns this check; the controller will throw
   `TypeError`.
2. **Remove**: any test asserting the transport layer throws for invalid `courseLength` (non-integer
   or `< 1`). The controller now owns this exclusively.
3. **Remove**: any test asserting the transport layer throws for missing required fields (`classId`,
   `cohortKey`, etc.) via `requireParameters`. The controller owns this.
4. **Retain and confirm green**: all unsafe path-character test cases (`../class-001`, `class/001`,
   `class\001`, `class..001`).
   4a. **New — type-guard regression test**: for each of the three mutations (`upsertABClass`,
   `updateABClass`, `deleteABClass`), add a test that calls the transport function with
   `{ classId: undefined }` and `{ classId: null }` and asserts that no `TypeError` is thrown
   from within the transport helper (the call may proceed to the controller stub; what must not
   happen is a crash inside the `.includes()` call). This test prevents regression to
   `INTERNAL_ERROR` when a missing or non-string `classId` is received at the transport boundary.
5. **Retain and confirm green**: `validateParametersObject` test cases (null, array, non-object params).
6. **Retain and confirm green**: forbidden-fields test cases for `updateABClass`.
7. **Retain and confirm green**: `active` type test cases for `updateABClass`.

In `tests/api/abclassMutations.test.js`:

8. **Remove**: the entire `it.each` block (lines ≈ 167–194) titled `'throws ApiValidationError when
required params are missing for %s'`. This block tests transport-layer enforcement of
   `requireParameters` for `upsertABClass` (missing classId, cohortKey, yearGroupKey, courseLength)
   and `updateABClass` (missing classId). These checks are removed from the transport layer; the
   controller will throw `TypeError`/`Error` for these inputs, which is tested by the controller's
   own test suite.
9. **Restructure** the `it.each` block at lines ≈ 218–238 titled `'deleteABClass throws
ApiValidationError for %s'`. This block currently has four cases:
   - `'missing params'` (undefined params) — RETAIN (`validateParametersObject` still catches this)
   - `'missing classId'` (`{}`) — REMOVE (transport no longer owns `requireParameters` for classId)
   - `'empty classId'` (`{ classId: '' }`) — REMOVE (transport no longer owns `validateClassId`)
   - `'unsafe classId'` (`{ classId: '../class-001' }`) — RETAIN (path-safety check retained)
     After restructuring, the remaining `it.each` cases should pass.
10. **Remove**: the `it.each` block (lines ≈ 341–373) that asserts `upsertABClass` and `updateABClass`
    throw `ApiValidationError` for invalid `courseLength` values — addressed in the Section 4 note and
    confirmed here for removal.
11. **Retain and confirm green**: all other tests in `tests/api/abclassMutations.test.js` (forbidden
    fields, active handling, path-character safety, controller delegation, rethrows unexpected errors,
    exports assertion).

### Section checks

- `npm test -- tests/backend-api/abclassMutations.unit.test.js` — all retained tests green.
- `npm test -- tests/api/abclassMutations.test.js` — all retained tests green; requireParams,
  courseLength, and deleted classId cases absent; unsafe classId and missing-params cases still pass.
- `npm test -- tests/api/apiHandler.test.js` — all tests green.
- `npm test` — full backend test run green.
- `npm run lint` — no backend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` note to `validateUpsertABClassParameters_` (and equivalent) inside the file
  explaining which checks are intentionally absent because the controller already owns them.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record actual changes when done.
- **Deviations from plan:** note any departures.
- **Follow-up implications for Section 6:** record effects.

---

## Section 6 — `authService.ts` Zod validation

### Objective

Add `z.boolean()` Zod response validation to `authService.ts` so the service owns the transport contract
as required by `src/frontend/AGENTS.md` § 4.1 and § 8. Create the adjacent schema file per the § 8 policy.

### Constraints

- `src/frontend/AGENTS.md` § 8 requires validation schemas in a dedicated adjacent schema file (`*.zod.ts`);
  inline schemas in the service file are not permitted.
- Create `src/frontend/src/services/authService.zod.ts` to hold `AuthorisationStatusSchema`.
- The service function signature and return type (`Promise<boolean>`) are unchanged.
- The `callApi` call is unchanged; only the return value is wrapped in `AuthorisationStatusSchema.parse(…)`.
- `apiService.ts` must not be changed.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `docs/developer/frontend/frontend-testing.md`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/classPartials.zod.ts`
- `src/frontend/src/services/referenceDataService.ts`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `src/frontend/src/services/classPartialsService.ts`
- `src/frontend/src/services/classPartials.zod.ts`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`

### Shared helper plan

No new shared helpers are expected in this section.

### Acceptance criteria

- `src/frontend/src/services/authService.zod.ts` exists and exports `AuthorisationStatusSchema` (a
  `z.boolean()` schema) and `AuthorisationStatus` (the inferred type).
- `authService.ts` imports `AuthorisationStatusSchema` from `./authService.zod`.
- `getAuthorisationStatus()` returns
  `AuthorisationStatusSchema.parse(await callApi<boolean>(GET_AUTHORISATION_STATUS_METHOD))`.
- `authService.spec.ts` includes tests asserting that a non-boolean backend response causes a Zod parse
  error to be thrown (see required test cases below).
- The existing test asserting that `callApi` is called with `'getAuthorisationStatus'` and the boolean
  result is returned continues to pass.
- No changes to `apiService.ts`, `sharedQueries.ts`, or any consumer of `getAuthorisationStatus`.
- `src/frontend/AGENTS.md` § 8 policy is met (schema in adjacent file, type inferred from schema).

### Required test cases (Red first)

Frontend service tests (`src/frontend/src/services/authService.spec.ts`):

1. **Red**: `callApiMock.mockResolvedValueOnce('yes')` → `getAuthorisationStatus()` rejects (Zod
   parse failure for non-boolean).
2. **Red**: `callApiMock.mockResolvedValueOnce(null)` → `getAuthorisationStatus()` rejects (Zod
   parse failure for null).
3. Confirm existing green test `callApi called with 'getAuthorisationStatus' and returns true` still passes.

### Section checks

- `npm run frontend:test -- src/frontend/src/services/authService.spec.ts` — all tests green.
- `npm run frontend:lint` — no frontend lint errors.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- None needed; the change is small and self-evident from the schema constant.

### Implementation notes / deviations / follow-up

- **Implementation notes:** record actual changes when done.
- **Deviations from plan:** note any departures.
- **Follow-up implications for regression section:** record effects.

---

## Regression and contract hardening

### Objective

Verify that the entire affected surface passes all lint and test checks after all six sections are
complete, and confirm the LOC-reduction target is met.

### Constraints

- Prefer focused test runs before the broad run.
- Do not introduce any new test skips or disabled lint rules.

### Delegation mandatory reads

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/apiConfig.js`
- `src/backend/z_Api/abclassMutations.js`
- `src/frontend/src/services/authService.ts`
- `src/frontend/src/services/authService.spec.ts`
- `tests/api/apiHandler.test.js`
- `tests/helpers/apiHandlerTestUtils.js`

### Acceptance criteria

- `npm run lint` passes with no errors.
- `npm run frontend:lint` passes with no errors.
- `npm test` passes with no failures or skips.
- `npm run frontend:test` passes with no failures or skips.
- Files deleted: `auth.js`, `abclassPartials.js`, `referenceData.js`,
  `tests/backend-api/abclassPartials.unit.test.js`, `tests/backend-api/referenceData.unit.test.js`,
  `tests/api/auth.test.js`, `tests/api/abclassPartials.test.js`.
- No `API_METHODS` or `API_ALLOWLIST` symbols remain in any production or test file.
- No `_invokeAllowlistedMethod` reference remains in any production or test file.
- No `globalThis.getAuthorisationStatus` mock or stub remains in any test file.
- No `additionalHandlers` option or `buildApiHandlerTestHandlers()` call remains in any test file.
- No top-level non-underscore `function getGoogleClassrooms`, `function upsertABClass`,
  `function updateABClass`, `function deleteABClass`, `function getAssignmentDefinitionPartials`,
  `function deleteAssignmentDefinition`, `function getBackendConfig`, `function setBackendConfig`
  declarations remain in any backend file (trailing-underscore forms `getGoogleClassrooms_` etc.
  ARE expected to remain).
- No `fs.readFileSync(referenceDataPath)` or vm coexistence code referencing `referenceData.js`
  remains in `tests/api/abclassMutations.test.js`.
- `tests/api/googleClassrooms.test.js` exports-assertion checks for `getGoogleClassrooms_` as a function.
- `tests/api/assignmentDefinitionDeleteApi.test.js` uses `deleteAssignmentDefinition_` directly.
- `tests/api/abclassMutations.test.js` uses `upsertABClass_`, `updateABClass_`, `deleteABClass_`; `courseLength` test block absent.
- `apiService.ts` is byte-for-byte unchanged from the baseline.
- Net LOC reduction across all files in the baseline table is **≥ 200 lines**.

### Required test cases / checks

1. `npm test -- tests/api/apiHandler.test.js` — green.
2. `npm test -- tests/api/apiHandlerLocking.test.js` — green.
3. `npm test -- tests/api/apiHandlerTiming.test.js` — green.
4. `npm test -- tests/api/staleAdmission.test.js` — green.
5. `npm test -- tests/backend-api/` — passes (no deleted-file references remain; updated files pass).
6. `npm run frontend:test -- src/frontend/src/services/authService.spec.ts` — green.
7. `npm run lint` — green.
8. `npm run frontend:lint` — green.
9. `npm test` (full backend) — green.
10. `npm run frontend:test` (full frontend) — green.
11. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- All commands above return green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise regression findings when done.
- **Deviations from plan:** note any additional work discovered.

---

## Documentation and rollout notes

### Objective

Reconcile `docs/developer/backend/api-layer.md`, `src/backend/AGENTS.md`, and `src/frontend/AGENTS.md`
to reflect the fully implemented architecture. Update all `Not implemented` planned-helper markers to
`Implemented`. Verify LOC counts against the baseline table.

### Constraints

- Only modify documentation relevant to the touched areas.
- Do not add speculative documentation about future endpoints or patterns.
- The docs-first section (Section 1) laid the groundwork; this section reconciles rather than
  rewriting from scratch.

### Delegation mandatory reads

Docs mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`
- `src/backend/z_Api/z_apiHandler.js`
- `src/backend/z_Api/apiConstants.js`
- `src/backend/z_Api/googleClassrooms.js`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `src/backend/z_Api/apiConfig.js`
- `src/backend/z_Api/abclassMutations.js`

### Acceptance criteria

- `docs/developer/backend/api-layer.md` contains the architecture signpost sections added in Section 1,
  now updated to reflect the implemented state (all `Not implemented` entries removed or updated).
- `docs/developer/backend/api-layer.md` "Dispatch and allowlist pattern" section describes the
  single-registry approach: one entry in `ALLOWLISTED_METHOD_HANDLERS`, no `API_METHODS` or
  `API_ALLOWLIST`.
- All references to `API_METHODS` and `API_ALLOWLIST` are removed from `api-layer.md`.
- The endpoint-specific sections for trivially inlined methods reference `z_apiHandler.js` (inline).
- The endpoint-specific sections for non-trivial methods reference their trailing-underscore private handler
  function and file (e.g. `getGoogleClassrooms_` in `googleClassrooms.js`).
- The trailing-underscore private transport-helper pattern is documented as the authoritative approach for
  non-trivial handlers (no longer marked `Not implemented`).
- `src/backend/AGENTS.md` § 0.1 describes both the trivial-inline and trailing-underscore private
  transport-helper patterns; § 0.2 codifies the transport-vs-domain validation ownership rules;
  no reference to `API_METHODS`, `API_ALLOWLIST`, or `_invokeAllowlistedMethod` remains.
- `src/frontend/AGENTS.md` § 4.1 method-name alignment instruction references
  `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` rather than the deleted `API_METHODS`.
- The step list for adding a new transport method in `api-layer.md` reads as a single step (add to
  `ALLOWLISTED_METHOD_HANDLERS`) rather than three steps.
- A repo-wide search confirms no remaining `API_METHODS` or `API_ALLOWLIST` references in any
  production or documentation file.
- All planned helper entries in `docs/developer/backend/backend-testing.md` are reconciled:
  `installControllerMocks` and trailing-underscore private function stub patterns updated from
  `Not implemented` to `Implemented`.
- `wc -l` on all surviving and new files in the LOC baseline table, with deleted rows counted as
  final LOC `0`, confirms net reduction ≥ 200 lines.

### Required checks

1. Read `docs/developer/backend/api-layer.md` and confirm no `API_METHODS`/`API_ALLOWLIST` references
   remain. Specifically confirm:
   - The "Dispatch and allowlist pattern" section now describes a single-step add to
     `ALLOWLISTED_METHOD_HANDLERS` with no `Not implemented` markers.
   - The "Non-callable transport helpers" section is updated to remove `Not implemented` markers and
     names the actual trailing-underscore private functions now in production.
   - Run a full-text search across the file to catch any additional occurrences.
2. Read `src/backend/AGENTS.md` and confirm § 0.1 and § 0.2 are correct post-implementation.
3. Read `src/frontend/AGENTS.md` and confirm § 4.1 no longer references `API_METHODS`.
4. Run `wc -l` on all surviving and new baseline-table files, treat deleted rows as final LOC `0`,
   and compare the final total against the baseline table.
5. Verify mandatory-read evidence (`Files read`) is complete for delegated docs handoffs.
6. Reconcile all planned helper entries in `docs/developer/backend/backend-testing.md`: update status
   to `Implemented` for `installControllerMocks` and trailing-underscore private stub patterns.

### Optional `@remarks` JSDoc review

- Confirm `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` carries the `@remarks` note planned in
  Sections 2 and 3 about it being the sole callable registry.
- Confirm each trailing-underscore private handler function (`getGoogleClassrooms_`, `upsertABClass_`, etc.)
  carries a `@remarks` note per Section 4.
- Confirm the Section 5 `@remarks` notes on `validateUpsertABClassParameters_` etc. are present.
- Confirm no other `@remarks` are needed for changed areas.

### Implementation notes / deviations / follow-up

- Record final LOC counts here once verified.

---

## Suggested implementation order

1. Section 1 — Architecture signpost and docs-first pass (no code changes; establishes `Not
implemented` markers).
2. Section 2 — Registry consolidation (`apiConstants.js` + `z_apiHandler.js` dispatch simplification).
3. Section 3 — Wrapper file elimination and handler inlining; test harness Pass A (depends on
   Section 2's simplified dispatch).
4. Section 4 — Non-trivial transport helper restructure; test harness Pass B (depends on Section 3's
   green test suite with `additionalHandlers` in place).
5. Section 5 — abclassMutations validation deduplication (depends on Section 4's trailing-underscore rename).
6. Section 6 — `authService.ts` Zod validation (independent; may be done in parallel with 2–5).
7. Regression and contract hardening.
8. Documentation and rollout notes.
