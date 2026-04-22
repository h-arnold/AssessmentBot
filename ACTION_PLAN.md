# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Treat that document as the source of truth for backend behaviour, contracts, and scope boundaries.
3. Use this action plan to sequence delivery and testing; do not redefine behaviour already settled in the spec.

## Scope and assumptions

### Scope

- Add backend support for assignment-topic reference data following the keyed reference-data pattern.
- Add an `apiHandler` assignment-definition upsert method that creates or updates full `AssignmentDefinition` records.
- Extend backend controller logic to support stable opaque `definitionKey` generation, duplicate-identity rejection, authoritative topic references, reparsing, immediate persistence, assignment weighting, and task weighting.
- Return full persisted `AssignmentDefinition` payloads from the upsert transport.

### Out of scope

- Assignments-page create/edit UI.
- Startup warm-up frontend integration for assignment topics.
- Assessment-wizard integration.
- Broad cleanup of `alternateTopics` modelling.

### Assumptions

1. First-create flows may omit `taskWeightings` because task IDs do not exist until parsing completes.
2. `assignment_topics` is authoritative in this phase, so upsert validates `primaryTopicKey` membership.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API handlers thin and delegate domain behaviour to controllers.
- Fail fast on invalid payloads, duplicate target keys, parsing failures, and persistence failures.
- Avoid defensive guards that hide internal wiring issues.
- Keep changes localised and aligned with existing `z_Api`, controller, parser, and reference-data patterns.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase:

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Backend tests: `npm test -- <target>`

---

## Section 0 — Documentation Sync

### Objective

- Update the canonical backend docs up front so delegated implementation work starts from the intended assignment-definition and topic-reference-data contract rather than the current pre-change state.

### Constraints

- Keep this section documentation-only.
- Do not implement production code in this section.
- Limit changes to docs that materially shape the backend contract for this feature.

### Delegation mandatory reads (when sub-agents are used)

Docs mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/backend/AssessmentFlow.md`
- `docs/developer/backend/DATA_SHAPES.md`
- `docs/developer/backend/api-layer.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- touched docs

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: assignment-definition upsert orchestration helper
   - Decision: `document existing plan`
   - Owning module/path: `docs/developer/backend/AssessmentFlow.md`
   - Call-site rationale: make the planned controller ownership and rollback expectations visible before implementation begins
   - Relevant canonical doc target: `docs/developer/backend/AssessmentFlow.md`
   - Planned doc status: `Not implemented`
2. Helper: assignment-definition task-weighting application helper
   - Decision: `document existing plan`
   - Owning module/path: `docs/developer/backend/DATA_SHAPES.md`
   - Call-site rationale: keep the intended weighting ownership visible to later agents
   - Relevant canonical doc target: `docs/developer/backend/DATA_SHAPES.md`
   - Planned doc status: `Not implemented`
3. Helper: assignment-definition upsert request validator
   - Decision: `document existing plan`
   - Owning module/path: `docs/developer/backend/api-layer.md`
   - Call-site rationale: keep transport-boundary validation ownership explicit before implementation starts
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Canonical backend docs reflect the greenfield assignment-definition upsert direction before production implementation starts.
- Docs no longer imply metadata-derived `definitionKey` rotation for this feature.
- Docs no longer imply non-authoritative assignment topics for this feature.
- Planned helper entries required by later sections are already present with status `Not implemented`.

### Required checks

1. Update `docs/developer/backend/AssessmentFlow.md` to reflect stable opaque `definitionKey` planning and remove stale key-rotation planning references for this feature.
2. Update `docs/developer/backend/DATA_SHAPES.md` to reflect the intended assignment-definition shape direction for authoritative topic keys and stable identifiers where the feature contract is documented.
3. Update `docs/developer/backend/api-layer.md` if needed so the planned upsert transport validation ownership is clear before implementation begins.
4. Verify the planned helper entries referenced by later sections are present and consistent.

### Section checks

- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Planned helper entries exist in the cited canonical docs with status `Not implemented` before production implementation starts.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** this section is intentionally front-loaded to reduce doc drift during the implementation loop.
- **Progress checklist:**
  - [x] `docs/developer/backend/AssessmentFlow.md` updated so the planned assignment-definition contract uses a stable opaque `definitionKey` and treats metadata-derived key building as legacy flow context only.
  - [x] `docs/developer/backend/DATA_SHAPES.md` updated so assignment-definition planning now uses authoritative `primaryTopicKey` reference data plus stable identifiers.
  - [x] `docs/developer/backend/api-layer.md` updated so planned upsert transport validation ownership is explicit.
  - [x] Planned helper entries verified in all cited canonical docs with status `Not implemented`.
- **Deviations from plan:** none in Section 0.
- **Follow-up implications for later sections:** subsequent agents should treat the synced docs plus `SPEC.md` and `ACTION_PLAN.md` as the working contract.

---

## Section 1 — Assignment Topics Reference Data

### Objective

- Add backend reference-data support for assignment topics so future UI work can use the same keyed CRUD pattern as cohorts and year groups.

### Constraints

- Keep the keyed-record pattern aligned with `ReferenceDataController`.
- Do not change frontend warm-up or UI code in this section.
- Keep topic storage separate from `AssignmentDefinition` persistence.
- Topic CRUD must become authoritative for `AssignmentDefinition.primaryTopicKey`.
- Topic delete should follow a fail-fast `IN_USE` style contract when one or more definitions reference the topic.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/backend/backend-testing.md`
- `src/backend/y_controllers/ReferenceDataController.js`
- existing reference-data tests in `tests/controllers/referenceDataController.test.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `src/backend/y_controllers/ReferenceDataController.js`
- `src/backend/z_Api/z_apiHandler.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- touched controller and API files
- touched tests

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: keyed reference-data resource config for assignment topics
   - Decision: `extend`
   - Owning module/path: `src/backend/y_controllers/ReferenceDataController.js`
   - Call-site rationale: reuse the existing keyed CRUD and duplicate-name handling pattern instead of creating a parallel topic controller
   - Relevant canonical doc target: `docs/developer/backend/DATA_SHAPES.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Backend exposes topic list/create/update/delete support using transport-safe `{ key, name }` records.
- Duplicate topic names are rejected consistently with existing reference-data behaviour.
- Topic CRUD is allowlisted through `apiHandler`.
- Topic delete is rejected when one or more definitions still reference the topic key.
- No frontend code is required for this section to be considered complete.

### Required test cases (Red first)

Backend controller tests:

1. Listing topics returns sorted `{ key, name }` records.
2. Creating a topic generates a stable key and rejects duplicates.
3. Updating a topic preserves the original key and rejects duplicate replacement names.
4. Deleting a topic removes the keyed record when unused.
5. Deleting a topic is rejected with a machine-readable in-use failure when one or more definitions reference the topic key.

API layer tests:

1. `apiHandler` allowlists the new topic methods.
2. Topic transport delegates to `ReferenceDataController` and preserves the standard success/error envelope mapping.

### Section checks

- `npm test -- tests/controllers/referenceDataController.test.js`
- `npm test -- tests/api/apiHandler.test.js`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries are present when helper changes are expected.
- Planned helper entries exist in the cited canonical docs with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** extend the existing keyed reference-data controller rather than introducing a new topic-specific controller unless reuse becomes materially unsafe.
- **Deviations from plan:** record any reason the topic resource cannot live inside `ReferenceDataController`.
- **Follow-up implications for later sections:** later frontend work should add assignment topics to startup warm-up and to the assignments create/edit flows.

---

## Section 2 — Assignment Definition Upsert Domain Logic

### Objective

- Extend assignment-definition domain behaviour to support create/update upsert semantics, stable `definitionKey`s, duplicate-identity rejection, authoritative topic references, reparsing, and weighting persistence.

### Constraints

- Preserve the dual-store persistence model.
- Keep `AssignmentDefinition` independent from `ABClass` and Classroom assignment lookup.
- Reuse the existing parser entry points.
- Do not rely on the excluded wizard tests as the primary regression suite.
- Because the stores are non-transactional, the implementation must define and test an explicit write ordering, rollback attempt, and cleanup-failure policy.
- Updates must preserve the stored `definitionKey` rather than deriving a new key from business metadata.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/backend/AssessmentFlow.md`
- `src/backend/y_controllers/AssignmentDefinitionController.js`
- `src/backend/Models/AssignmentDefinition.js`
- `src/backend/Models/TaskDefinition.js`
- `src/backend/DocumentParsers/SlidesParser.js`
- `src/backend/DocumentParsers/SheetsParser.js`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/backend/AssessmentFlow.md`
- `src/backend/y_controllers/AssignmentDefinitionController.js`
- `src/backend/Models/AssignmentDefinition.js`
- `src/backend/Models/TaskDefinition.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- touched controller/model files
- touched tests

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: assignment-definition upsert orchestration method
   - Decision: `extend`
   - Owning module/path: `src/backend/y_controllers/AssignmentDefinitionController.js`
   - Call-site rationale: keep creation, update, parsing, and persistence in the existing authoritative controller
   - Relevant canonical doc target: `docs/developer/backend/AssessmentFlow.md`
   - Planned doc status: `Not implemented`
2. Helper: task-weighting application helper
   - Decision: `new`
   - Owning module/path: `src/backend/y_controllers/AssignmentDefinitionController.js`
   - Call-site rationale: centralise task-weight validation and application after parsing/loading tasks
   - Relevant canonical doc target: `docs/developer/backend/DATA_SHAPES.md`
   - Planned doc status: `Not implemented`
3. Helper: rollback helper
   - Decision: `keep local`
   - Owning module/path: `src/backend/y_controllers/AssignmentDefinitionController.js`
   - Call-site rationale: no planned key rotation in the new UUID-based contract; any helper in this area should stay narrowly focused on rollback for failed same-key writes
   - Relevant canonical doc target: `docs/developer/backend/AssessmentFlow.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Controller supports create when `definitionKey` is absent.
- Controller supports update when `definitionKey` is present and the target exists.
- New create paths generate a stable opaque `definitionKey`.
- Update paths preserve the stored `definitionKey`.
- Duplicate business-identity tuples are rejected before mutation.
- Unknown `primaryTopicKey` values are rejected before mutation.
- Document-ID changes trigger reparsing.
- Unchanged documents continue to follow the existing refresh rules.
- `assignmentWeighting` and `taskWeighting` values persist on the saved definition.
- On successful same-key updates, both stores reflect the new definition state.
- Cleanup or rollback failure is surfaced as a hard failure and is covered by explicit tests.
- Omitted `alternateTitles` preserve stored values on update.
- `getAssignmentDefinitionPartials()` has a defined steady-state response shape that includes authoritative topic information.

### Required test cases (Red first)

Backend model/controller tests:

1. Create upsert persists a new full definition and registry partial from free-form metadata.
2. Create upsert generates a stable opaque `definitionKey`.
3. Update upsert changes metadata and returns the updated full definition without changing `definitionKey`.
4. Duplicate business-identity tuples are rejected without partial mutation.
5. Unknown `primaryTopicKey` values are rejected.
6. Changing document IDs reparses tasks and refreshes timestamps.
7. Leaving document IDs unchanged preserves existing refresh behaviour for fresh definitions.
8. Assignment weighting persists on save.
9. Valid task-weight patches persist on matching task IDs.
10. Unknown task IDs in `taskWeightings` are rejected.
11. Missing topic key remains a hard rejection.
12. Identical reference/template documents remain a hard rejection.
13. Omitted `alternateTitles` preserve the existing stored array.
14. Registry-write failure after full-store write triggers a rollback attempt and throws.
15. Full-store write failure before any registry write fails loudly without partial persistence.
16. Rollback failure after a later write step fails is surfaced distinctly as a repair-required failure.

### Section checks

- `npm test -- tests/controllers/assignmentDefinitionController.test.js`
- `npm test -- tests/controllers/assignmentDefinitionController.fullStore.test.js`
- Add and run a dedicated upsert-focused controller suite if the existing suites become too indirect.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries are present when helper changes are expected.
- Planned helper entries exist in the cited canonical docs with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Record the stable definition-key and rollback rationale if the final implementation uses a non-obvious replace-and-cleanup sequence.

### Implementation notes / deviations / follow-up

- **Implementation notes:** prefer evolving `AssignmentDefinitionController` rather than routing new create/update behaviour through `AssignmentController.createDefinitionFromWizardInputs`.
- **Deviations from plan:** record any reason a dedicated rollback helper becomes necessary.
- **Follow-up implications for later sections:** the API layer can stay thin once this controller owns the full upsert flow.

---

## Section 3 — Assignment Definition Upsert Transport

### Objective

- Add the `apiHandler` transport method for assignment-definition upsert with strict request validation and full-definition response shaping.

### Constraints

- Keep transport validation in `src/backend/z_Api`.
- Keep the handler thin and controller-driven.
- Preserve the existing `apiHandler` admission/completion lifecycle.
- Follow the validation-ownership rule strictly: `z_Api` owns payload shape and safe-key checks; the controller owns business validity for year group and weighting values.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`
- `src/backend/z_Api/z_apiHandler.js`
- current assignment-definition transport file(s)

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/backend/api-layer.md`
- `src/backend/z_Api/z_apiHandler.js`
- current assignment-definition transport file(s)
- `src/backend/y_controllers/AssignmentDefinitionController.js`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ACTION_PLAN.md`
- touched API files
- touched controller files
- touched tests

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: assignment-definition upsert request validator
   - Decision: `new`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js` or a sibling assignment-definition mutations file
   - Call-site rationale: keep request-shape, safe-key, and structural `taskWeightings` validation local to the backend API boundary
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Not implemented`
2. Helper: full-definition response normaliser
   - Decision: `keep local`
   - Owning module/path: assignment-definition API transport file
   - Call-site rationale: response shaping should stay close to the transport contract unless reuse emerges across methods
   - Relevant canonical doc target: `docs/developer/backend/DATA_SHAPES.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `apiHandler` allowlists `upsertAssignmentDefinition`.
- Transport rejects malformed request payloads with `ApiValidationError`.
- Transport delegates successful calls to the controller and returns the full persisted definition payload.
- Transport preserves the standard `apiHandler` envelope and failure logging behaviour.

### Required test cases (Red first)

API layer tests:

1. Valid create payload delegates to the controller and returns full definition data.
2. Valid update payload delegates with the supplied `definitionKey`.
3. Missing required fields are rejected at the transport boundary.
4. Unsafe or untrimmed update `definitionKey` values are rejected at the transport boundary.
5. Malformed `taskWeightings` payloads are rejected at the transport boundary.
6. Missing or malformed `primaryTopicKey` payload shape is rejected at the transport boundary.
7. `apiHandler` includes `upsertAssignmentDefinition` in the allowlist.
8. Controller-thrown validation errors map to the standard `INVALID_REQUEST` envelope.

### Section checks

- `npm test -- tests/api/assignmentDefinitionUpsertApi.test.js`
- `npm test -- tests/api/apiHandler.test.js`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries are present when helper changes are expected.
- Planned helper entries exist in the cited canonical docs with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- None unless transport validation ends up intentionally stricter than the controller contract.

### Implementation notes / deviations / follow-up

- **Implementation notes:** place the transport helper beside the existing assignment-definition read/delete helpers unless the file becomes too mixed.
- **Deviations from plan:** record if splitting read/delete and mutation transport files becomes necessary for clarity.
- **Follow-up implications for later sections:** frontend service work can build directly on the stable envelope and full-definition response shape.

---

## Regression and contract hardening

### Objective

- Verify the new topic reference-data and assignment-definition upsert surfaces are stable, non-duplicative, and compatible with the existing dispatcher and persistence rules.

### Constraints

- Prefer focused backend suites before broader validation.

### Acceptance criteria

- New and touched controller/API suites pass.
- Backend lint passes.
- No existing assignment-definition read/delete contract is regressed.

### Required test cases/checks

1. Run touched controller suites for reference data and assignment definitions.
2. Run touched API suites for dispatcher and assignment-definition transport.
3. Re-run existing assignment-definition partials/delete transport tests.
4. Run backend lint.
5. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- `npm test -- tests/controllers/referenceDataController.test.js`
- `npm test -- tests/controllers/assignmentDefinitionController.test.js`
- `npm test -- tests/controllers/assignmentDefinitionController.fullStore.test.js`
- `npm test -- tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- `npm test -- tests/api/assignmentDefinitionDeleteApi.test.js`
- `npm test -- tests/api/apiHandler.test.js`
- `npm run lint`

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise any regression failures that expose older drift in parser/controller contracts.
- **Deviations from plan:** note any extra contract hardening required to keep touched tests stable.

---

## Documentation notes

### Objective

- Update backend documentation so the new upsert and topic-reference-data contracts are discoverable and future UI work can build on them safely.

### Constraints

- Only update docs relevant to the touched backend surfaces.

### Acceptance criteria

- Backend docs describe the new topic reference-data endpoints and assignment-definition upsert contract.
- Data-shape docs reflect assignment and task weighting persistence expectations.
- Stable-key behaviour and rollback caveats are documented.

### Required checks

1. Update `docs/developer/backend/DATA_SHAPES.md` for the final upsert response/request assumptions where needed.
2. Update `docs/developer/backend/AssessmentFlow.md` if controller ownership or lifecycle wording changes materially.
3. Confirm notes/deviations fields are filled during implementation.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.
5. Reconcile planned shared-helper entries in canonical docs: keep `Not implemented` where still pending, and update implemented entries where delivered.

### Optional `@remarks` JSDoc review

- Review whether the final controller implementation needs `@remarks` explaining stable definition-key handling, duplicate-target rejection, or task-weight application.

### Implementation notes / deviations / follow-up

- The future assignments UI should add assignment topics to startup warm-up alongside cohorts and year groups.
- No layout spec is required for this phase because the planned work is backend-only.

---

## Suggested implementation order

1. Section 0 (documentation sync)
2. Section 1 (assignment topics reference data)
3. Section 2 (assignment-definition upsert domain logic)
4. Section 3 (assignment-definition upsert transport)
5. Regression and contract hardening
6. Documentation notes
