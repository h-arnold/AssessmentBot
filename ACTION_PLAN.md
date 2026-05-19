# Assignment Definition Creation Path Refactoring — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` v1.9.0.
2. Read `src/backend/AGENTS.md`.
3. Read `docs/developer/backend/api-layer.md`.
4. Treat those documents as the source of truth for product behaviour, contracts, and architectural rules.
5. This plan sequences delivery and testing; it does not restate or redefine material already settled in SPEC.md.

---

## Scope and assumptions

### Scope

This plan covers the complete refactoring of the assignment definition creation path as specified in SPEC.md v1.9.0:

- **Section 0 (MANDATORY GATE):** Shared-helper planning gate — add required entries to `docs/developer/backend/api-layer.md`
- **Section 1:** Model-level changes — remove `yearGroup`, add `yearGroupKey` non-null requirement at model boundary, add `assignmentWeighting` defaulting and range validation
- **Section 2:** AssignmentDefinitionController — remove `ensureDefinition`, remove `yearGroup` from all signatures, update validation helpers
- **Section 3:** AssignmentController — rename `yearGroup` to `yearGroupKey`, update delegation to `upsertDefinition`
- **Section 4:** AssignmentProcessor/globals.js — rename `yearGroup` to `yearGroupKey`
- **Section 5:** API layer — remove helper functions, inline logic, update transport boundary (depends on Section 1)
- **Regression:** Full validation and contract hardening
- **Documentation:** Final documentation pass

### Out of scope

- Frontend changes (user confirmed "no frontend changes required")
- Deprecated code in `src/AdminSheet` (explicitly excluded per SPEC.md)
- Legacy `globals.js` files other than `src/backend/AssignmentProcessor/globals.js`
- Backwards compatibility for `yearGroup` in stored data (per Option B — no migration)

### Assumptions

1. **Controller-resolution pattern:** Controllers that accept `yearGroupKey: string | null` must resolve to a non-null value before passing to model methods; the model boundary receives non-null `yearGroupKey` only (per SPEC.md Core Principle 3 and Validation Ownership Constraints)
2. **Validation ownership:** Domain validation (required-field completeness, null resolution) belongs in controller; data integrity validation (type checking, range validation) belongs in model (per `src/backend/AGENTS.md` §0.2)
3. **`yearGroupLabel` resolution:** Controller resolves `yearGroupLabel` from authoritative year-group reference data and passes it to the model; model does not perform this resolution (per SPEC.md Core Principle 4)
4. Model constructor owns all defaulting: `assignmentWeighting` defaults to 1, range 0-10 enforced
5. Controller must not apply defaults; passes raw values to model
6. API layer must not apply defaults; only performs transport validation
7. Partial/full storage schema distinction (`tasks: null` vs `tasks: {...}`) must be preserved
8. Public API contracts for `upsertAssignmentDefinition_`, `getAssignmentDefinitionPartials_`, `getAssignmentDefinition_`, `deleteAssignmentDefinition_` remain stable

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin; delegate behaviour to controllers and models.
- Fail fast on invalid inputs; never hide errors behind catch-and-ignore.
- Avoid defensive guards that mask internal wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments, code, and documentation.
- Preserve separation of concerns: transport → API, domain → controller, defaults/integrity → model.

### TDD workflow (mandatory per section)

For each section below:

1. **Red:** write failing tests for the section's acceptance criteria
2. **Green:** implement the smallest change needed to pass
3. **Refactor:** tidy implementation with all tests still green
4. Run section-level verification commands

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan defines and enforces mandatory documentation reads.

For each delegated phase:

1. List required documentation file paths under that phase
2. Require the sub-agent handoff to include `Files read` with explicit file paths
3. Verify every mandatory file is listed before accepting the handoff
4. If any mandatory file is missing, return the work to the same sub-agent and block progression

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. Record helper decisions in that section before implementation
2. Include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. Add planned helper entries to relevant canonical docs with status `Not implemented`
4. During documentation pass, reconcile planned entries against actual implementation

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Backend tests: `npm test -- <target>`
- Full backend test suite: `npm test`

---

## Section 0 — Shared-helper planning gate (MANDATORY — MUST COMPLETE FIRST)

### Objective

- Add all planned shared-helper entries to `docs/developer/backend/api-layer.md` 'Shared Helper Status' section **before any implementation begins**
- This is a **mandatory pre-implementation gate** that must be completed and verified before Section 1 starts
- Per SPEC.md Planning Handoff Notes, add/update entries for removed helpers with status `Removed`; add entry for new helper with status `Not implemented`
- **Status: COMPLETE** — All 7 required entries have been added to `docs/developer/backend/api-layer.md` 'Shared Helper Status' section with correct status values

### Constraints

- **BLOCKING:** All subsequent sections are blocked until this section is complete and verified
- All entries for **removed** helpers must have status `Removed`
- The entry for the **new** helper must have status `Not implemented`
- This section must be completed and verified before any other section begins
- **Blocking scope:** The 7 entries explicitly required by SPEC.md Planning Handoff Notes must be present with correct status

### Acceptance criteria

- Entry for 'Assignment-definition full-definition response mapper' **updated** from `Not applicable` to `Removed` — `toCanonicalTransportDefinition_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
- Entry added for 'Assignment-definition partial row serializer' with Status: `Removed` — `toPlainPartialRow_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
- Entry added for 'Assignment-definition upsert payload builder' with Status: `Removed` — `buildControllerUpsertPayload_` in `src/backend/z_Api/assignmentDefinitionPartials.js`
- Entry added for 'Assignment-definition upsert context builder' with Status: `Removed` — `_buildUpsertContext` in `src/backend/y_controllers/AssignmentDefinitionController.js`
- Entry added for 'Assignment-definition creation method' with Status: `Removed` — `ensureDefinition` in `src/backend/y_controllers/AssignmentDefinitionController.js`
- Entry added for 'AssignmentDefinition yearGroup field' with Status: `Removed` — `yearGroup` parameter and property in `src/backend/Models/AssignmentDefinition.js`
- Entry added for 'Assignment-definition transport partial row helper' with Status: `Not implemented` — `toTransportPartialRow_` in `src/backend/z_Api/assignmentDefinitionPartials.js`

### Section checks

- ✅ Verify all 7 entries exist in `docs/developer/backend/api-layer.md` 'Shared Helper Status' with correct status values
- ✅ Run: `grep -n "toCanonicalTransportDefinition_\|toPlainPartialRow_\|buildControllerUpsertPayload_\|_buildUpsertContext\|ensureDefinition\|yearGroup\|toTransportPartialRow_" docs/developer/backend/api-layer.md`
- ✅ Verify Section 0 is marked as complete in this ACTION_PLAN.md
- ✅ **MANDATORY:** All subsequent sections remain blocked until this verification passes

### Blocked by

None — this is the first section and has no dependencies.

### Must complete before

All other sections (Section 1 through Documentation)

---

## Section 1 — Model-level `yearGroup` deprecation and `assignmentWeighting` defaulting

**Status: COMPLETE** — All acceptance criteria implemented, all 27 tests passing, Green Review clean.

### Objective

- Remove `yearGroup` field entirely from `AssignmentDefinition` model
- Add fail-fast validation: constructor and `fromJSON()` throw `TypeError` when `yearGroup` is present
- Add type validation: constructor throws `TypeError` when `yearGroupKey` is not a string (null/undefined check is controller responsibility per validation ownership)
- Add `assignmentWeighting` defaulting to 1 with range validation 0-10 in constructor
- Rename `buildDefinitionKey()` parameter from `yearGroup` to `yearGroupKey`

### Constraints

- **BLOCKING:** This section is blocked until Section 0 is complete
- Must preserve partial/full storage schema distinction
- Must preserve `yearGroupLabel` as an accepted optional parameter (controller provides it)
- Stored value for `assignmentWeighting` must never be null
- At model boundary, `yearGroupKey` must be a non-null string (controllers guarantee this per SPEC.md)
- All validation must respect the ownership contract: transport → API, domain → controller, defaults/integrity → model
- This section **must be completed before Section 5** as Section 5's transport helper depends on model serialization output

### Blocked by

Section 0 (Shared-helper planning gate)

### Must complete before

Section 2, Section 5

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/Models/AssignmentDefinition.js`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/Models/AssignmentDefinition.js`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/Models/AssignmentDefinition.js`

### Shared helper plan

Helper decision entries: None — no shared helpers affected in this section.

### Acceptance criteria

- `AssignmentDefinition` constructor throws `TypeError` when params contain `yearGroup` property
- `AssignmentDefinition` constructor throws `TypeError` when `yearGroupKey` is not a string (type check only; null/undefined is controller responsibility)
- `AssignmentDefinition.fromJSON()` throws `TypeError` when input JSON contains `yearGroup` field
- `AssignmentDefinition.fromJSON()` throws `TypeError` when input JSON does not contain a valid `yearGroupKey` string (type check)
- `this.yearGroup` property does not exist on model instances
- `yearGroup` is not included in `toJSON()` or `toPartialJSON()` return objects
- Both `toJSON()` and `toPartialJSON()` include `yearGroupKey` and `yearGroupLabel` fields (when present)
- `assignmentWeighting` defaults to 1 when null, undefined, or missing in constructor
- Constructor throws `RangeError` when `assignmentWeighting` is outside range 0-10
- Stored value for `assignmentWeighting` is always a number, never null
- `buildDefinitionKey()` parameter renamed from `yearGroup` to `yearGroupKey`
- Constructor call to `buildDefinitionKey` updated to pass `{ yearGroupKey: this.yearGroupKey }`
- `fromJSON()` passes `json.assignmentWeighting` as-is to constructor; constructor handles defaulting
- JSDoc updated: All constructor and method JSDoc in `AssignmentDefinition.js` remove references to `yearGroup` parameter and property
- **Schema preservation:** `toPartialJSON()` returns `tasks: null` for partial definitions; `toJSON()` returns `tasks: {...}` for full definitions

### Required test cases (Red first)

Backend model tests (in `tests/models/assignmentDefinition.test.js`):

1. **Constructor rejects yearGroup presence:**
   - Test that passing `{ yearGroup: 10, ... }` throws `TypeError`
   - Test that passing `{ yearGroup: null, ... }` throws `TypeError`
   - Test message includes "yearGroup" and "deprecated"

2. **Constructor validates yearGroupKey type (not presence):**
   - Test that passing `{ yearGroupKey: 123, ... }` throws `TypeError` (wrong type)
   - Test that passing `{ yearGroupKey: 'valid-key', ... }` succeeds
   - **Note:** Null/undefined validation is controller responsibility, not model

3. **fromJSON rejects yearGroup field:**
   - Test that `fromJSON({ yearGroup: 10, ... })` throws `TypeError`
   - Test that `fromJSON({ yearGroup: null, ... })` throws `TypeError`

4. **fromJSON validates yearGroupKey type:**
   - Test that `fromJSON({ yearGroupKey: 123, ... })` throws `TypeError`
   - Test that `fromJSON({ yearGroupKey: 'valid-key', ... })` succeeds

5. **assignmentWeighting defaults to 1:**
   - Test constructor with `assignmentWeighting: null` results in `assignmentWeighting === 1`
   - Test constructor with `assignmentWeighting: undefined` results in `assignmentWeighting === 1`
   - Test constructor with missing `assignmentWeighting` results in `assignmentWeighting === 1`
   - Test constructor with `assignmentWeighting: 5` results in `assignmentWeighting === 5`

6. **assignmentWeighting range validation:**
   - Test constructor with `assignmentWeighting: -1` throws `RangeError`
   - Test constructor with `assignmentWeighting: 11` throws `RangeError`
   - Test constructor with `assignmentWeighting: 0` succeeds
   - Test constructor with `assignmentWeighting: 10` succeeds

7. **Serialization excludes yearGroup:**
   - Test `toJSON()` does not include `yearGroup` field
   - Test `toPartialJSON()` does not include `yearGroup` field

8. **Serialization includes yearGroupKey and yearGroupLabel:**
   - Test `toJSON()` includes `yearGroupKey` field
   - Test `toJSON()` includes `yearGroupLabel` field when provided
   - Test `toPartialJSON()` includes `yearGroupKey` field
   - Test `toPartialJSON()` includes `yearGroupLabel` field when provided

9. **Schema preservation:**
   - Test `toPartialJSON()` returns `tasks: null` for partial definitions
   - Test `toJSON()` returns `tasks: {...}` (object) for full definitions

10. **buildDefinitionKey parameter renamed:**
    - Test `buildDefinitionKey({ primaryTitle: 'A', primaryTopic: 'B', yearGroupKey: 'yg-10' })` returns `'A_B_yg-10'`

11. **Model instance has no yearGroup property:**
    - Test `new AssignmentDefinition({ yearGroupKey: 'yg-10', ... })` does not have `yearGroup` property
    - Test accessing `instance.yearGroup` returns `undefined`

### Section checks

- `npm test -- tests/models/assignmentDefinition.test.js`
- Mandatory-read evidence gate passed for all delegated handoffs in this section
- Shared-helper planning entries: None required
- Verify all delegated handoffs include `Files read` with all mandatory documentation paths listed

### Optional @remarks JSDoc follow-through

1. `AssignmentDefinition` constructor: Add `@remarks` noting that `yearGroup` is deprecated and will cause TypeError if present; `yearGroupKey` must be a string (type validation only; null/undefined is controller responsibility)
2. `AssignmentDefinition.fromJSON`: Add `@remarks` noting that input JSON must not contain `yearGroup` field; `yearGroupKey` must be a string
3. `AssignmentDefinition.buildDefinitionKey`: Add `@remarks` noting parameter rename from `yearGroup` to `yearGroupKey`; no parameter validation performed

---

## Section 2 — AssignmentDefinitionController: Remove `ensureDefinition` and `yearGroup` usage

### Objective

- Delete `ensureDefinition` method entirely from `AssignmentDefinitionController`
- Remove `yearGroup` from all method signatures and internal logic
- Update `_resolveYearGroupContextForUpsert` to return only `{ yearGroupKey, yearGroupLabel }` with `yearGroupLabel` resolved from reference data
- Update `_assertNoDuplicateBusinessTuple` to use only `yearGroupKey` (no `yearGroup` fallback)
- Update `_resolveAssignmentWeightingForUpsert` to be validation-only (no defaulting, returns raw payload value)
- Move all validation logic from `_buildUpsertContext` into the `upsertDefinition` method body and delete `_buildUpsertContext`

### Constraints

- **BLOCKING:** This section is blocked until Section 1 is complete
- Must not change public API of `upsertDefinition`
- Must preserve domain validation ownership per `src/backend/AGENTS.md` §0.2
- Validation ownership rationale: Domain validation (required fields, business rules) remains in controller; value defaulting must be in model layer only
- Methods accepting `yearGroupKey: string | null` must resolve to non-null before calling model methods
- Controller must resolve `yearGroupLabel` from reference data

### Blocked by

Section 0, Section 1

### Must complete before

Section 3

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentDefinitionController.js`
- `tests/controllers/assignmentDefinitionController.test.js`
- `tests/controllers/assignmentDefinitionController.upsert.test.js`
- `tests/controllers/assignmentDefinitionController.fullStore.test.js`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentDefinitionController.js`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentDefinitionController.js`

### Shared helper plan

Helper decision entries:

1. Helper: `_buildUpsertContext`
   - Decision: `Removed`
   - Owning module/path: `src/backend/y_controllers/AssignmentDefinitionController.js`
   - Call-site rationale: Logic moved into `upsertDefinition` method body per SPEC.md; helper deleted with no replacement
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Removed`

2. Helper: `ensureDefinition`
   - Decision: `Removed`
   - Owning module/path: `src/backend/y_controllers/AssignmentDefinitionController.js`
   - Call-site rationale: Removed per architectural decision (single canonical creation method)
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Removed`

### Acceptance criteria

- `ensureDefinition` method is removed from `AssignmentDefinitionController`
- `_buildUpsertContext` helper is removed; its validation logic moved into `upsertDefinition` method body
- `yearGroup` parameter removed from all method signatures in controller
- `_assertNoDuplicateBusinessTuple` signature updated to remove `yearGroup` parameter; must not accept `yearGroup` in any form
- `_resolveYearGroupContextForUpsert` returns only `{ yearGroupKey, yearGroupLabel }` (no `yearGroup` field)
- `_resolveYearGroupContextForUpsert` must NOT extract `yearGroup` from reference data (remove the `getYearGroup` call)
- `_assertNoDuplicateBusinessTuple` uses only `yearGroupKey` for duplicate detection (no `yearGroup` fallback)
- `_resolveYearGroupContextForUpsert` resolves `yearGroupLabel` from authoritative year-group reference data
- `_resolveAssignmentWeightingForUpsert` returns the raw payload value (which may be `null`, `undefined`, or a number) — no defaulting
- All validation logic from `_buildUpsertContext` preserved within `upsertDefinition` method body
- `upsertDefinition` signature unchanged
- `upsertDefinition` still requires resolved non-null `yearGroupKey: string`
- No code in `AssignmentDefinitionController` passes `yearGroup` to model methods
- Methods accepting `yearGroupKey: string | null` resolve to non-null before calling model methods

### Required test cases (Red first)

Backend controller tests:

1. **ensureDefinition removed:**
   - Test that calling `controller.ensureDefinition()` throws (method does not exist)

2. **buildUpsertContext removed:**
   - Test that calling `controller._buildUpsertContext()` throws (helper does not exist)

3. **resolveYearGroupContextForUpsert returns correct shape:**
   - Test returns object with `yearGroupKey` property
   - Test returns object with `yearGroupLabel` property
   - Test returns object WITHOUT `yearGroup` property
   - Test `yearGroupLabel` is resolved from reference data

4. **assertNoDuplicateBusinessTuple uses yearGroupKey only:**
   - Test method uses `yearGroupKey` parameter
   - Test method does not reference `yearGroup` in its implementation

5. **resolveAssignmentWeightingForUpsert no defaulting:**
   - Test with missing `assignmentWeighting` in payload returns `undefined`
   - Test with `assignmentWeighting: null` in payload returns `null`
   - Test with `assignmentWeighting: 5` in payload returns `5`

6. **upsertDefinition validation preserved:**
   - Test `upsertDefinition` throws when payload missing required fields
   - Test `upsertDefinition` throws when `yearGroupKey` is null (before resolution)
   - Test `upsertDefinition` succeeds with valid payload and resolved non-null `yearGroupKey`

### Required test updates/deletions

**Constraint:** Verify test patterns against actual test file contents before applying deletions/updates to ensure no unintended matches.

Tests to DELETE (because methods are removed):

- `tests/controllers/assignmentDefinitionController.test.js`:
  - Tests matching 'should ensureDefinition creates new definition'
  - Tests matching 'should ensureDefinition returns existing definition if fresh'
  - Tests matching 'should refresh definition if Drive files are newer'
- `tests/controllers/assignmentDefinitionController.fullStore.test.js`:
  - Tests matching 'should persist parsed tasks to full store when creating new definition'
  - Tests matching 'should re-persist full definition when Drive files are newer'
  - Tests matching 'should update registry when definition is refreshed'

Tests to UPDATE:

- `tests/controllers/assignmentDefinitionController.upsert.test.js`:
  - Tests for `_assertNoDuplicateBusinessTuple` — verify only `yearGroupKey` parameter used (no `yearGroup` fallback)
  - Tests for `_resolveYearGroupContextForUpsert` to verify return shape includes `yearGroupLabel` and excludes `yearGroup`
  - Tests for `_resolveAssignmentWeightingForUpsert` to verify no defaulting (returns raw payload value)

### Section checks

- `npm test -- tests/controllers/assignmentDefinitionController.test.js`
- `npm test -- tests/controllers/assignmentDefinitionController.upsert.test.js`
- `npm test -- tests/controllers/assignmentDefinitionController.fullStore.test.js`
- Mandatory-read evidence gate passed for all delegated handoffs
- Shared-helper planning entries present in `docs/developer/backend/api-layer.md` with status `Removed`
- Verify all delegated handoffs include `Files read` with all mandatory documentation paths listed

### Optional @remarks JSDoc follow-through

1. `AssignmentDefinitionController.upsertDefinition`: Add `@remarks` noting that this is now the sole creation/update method; requires resolved non-null `yearGroupKey`
2. `_resolveYearGroupContextForUpsert`: Add `@remarks` noting that `yearGroup` field is no longer returned; resolves `yearGroupLabel` from reference data
3. `_resolveAssignmentWeightingForUpsert`: Add `@remarks` noting that this method is validation-only and does not apply defaults; returns raw payload value for model to handle

---

## Section 3 — AssignmentController: Rename `yearGroup` to `yearGroupKey` and update delegation

### Objective

- Rename `yearGroup` parameter to `yearGroupKey` in `ensureDefinitionFromInputs` and `createDefinitionFromWizardInputs`
- Remove code that dynamically sets `abClass.yearGroup` entirely
- Update `ensureDefinitionFromInputs` to resolve `yearGroupKey` from input or `abClass.yearGroupKey`
- Update `ensureDefinitionFromInputs` to resolve `primaryTopicKey` from `topicId` + `courseId` via Classroom API
- Update `ensureDefinitionFromInputs` to throw when `yearGroupKey` resolution fails (both input and `abClass.yearGroupKey` are null)
- Change `ensureDefinitionFromInputs` to delegate to `controller.upsertDefinition` (replacing `controller.ensureDefinition`) with resolved non-null `yearGroupKey` and `primaryTopicKey`
- Update `createDefinitionFromWizardInputs` to pass `yearGroupKey` to `ensureDefinitionFromInputs`
- Preserve `saveStartAndShowProgress` signature unchanged

### Constraints

- **BLOCKING:** This section is blocked until Section 2 is complete (depends on `controller.ensureDefinition` being removed and `upsertDefinition` being the sole method)
- Callers will be updated in Section 4; no backwards compatibility required per SPEC.md
- Pre-condition: ABClass model already includes `yearGroupKey` property per existing codebase; fallback resolution assumes this property is available on loaded ABClass instances
- Must throw when `yearGroupKey` resolution fails
- Must resolve `primaryTopicKey` via Classroom API (1:1 mapping from Classroom topic ID to AssessmentBot topic key)
- Must delegate to `controller.upsertDefinition` instead of `controller.ensureDefinition`
- Must not set `abClass.yearGroup` anywhere

### Blocked by

Section 0, Section 1, Section 2

### Must complete before

Section 4

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentController.js`
- `tests/controllers/assignmentController.hydration.test.js`
- `tests/controllers/createDefinitionFromWizardInputs.test.js`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentController.js`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/y_controllers/AssignmentController.js`

### Shared helper plan

Helper decision entries: None

### Acceptance criteria

- `ensureDefinitionFromInputs` accepts `yearGroupKey: string | null` instead of `yearGroup: number | null`
- `ensureDefinitionFromInputs` resolves `yearGroupKey` from input or `abClass.yearGroupKey`
- `ensureDefinitionFromInputs` throws when `yearGroupKey` resolution fails (both input and `abClass.yearGroupKey` are null)
- `ensureDefinitionFromInputs` resolves `primaryTopicKey` from `topicId` + `courseId` via Classroom API
- `ensureDefinitionFromInputs` delegates to `controller.upsertDefinition` (replacing `controller.ensureDefinition`) with resolved non-null `yearGroupKey` and `primaryTopicKey`
- `createDefinitionFromWizardInputs` accepts `yearGroupKey: string | null` instead of `yearGroup: number | null`
- `createDefinitionFromWizardInputs` passes `yearGroupKey` parameter (not `yearGroup`) to `ensureDefinitionFromInputs`
- Code that dynamically sets `abClass.yearGroup` is removed entirely
- No code in `AssignmentController` passes `yearGroup` to model methods
- Verify `saveStartAndShowProgress` continues to function correctly with updated parameter names
- `saveStartAndShowProgress` signature remains unchanged

### Required test cases (Red first)

Backend controller tests:

1. **ensureDefinitionFromInputs accepts yearGroupKey:**
   - Test with `yearGroupKey: 'year-group-10'` succeeds
   - Test with `yearGroupKey: null` and valid `abClass.yearGroupKey` succeeds
   - Test with `yearGroupKey: null` and null `abClass.yearGroupKey` throws

2. **ensureDefinitionFromInputs resolves yearGroupKey:**
   - Test that `yearGroupKey` from input is used when provided
   - Test that `abClass.yearGroupKey` is used when input is null

3. **ensureDefinitionFromInputs resolves primaryTopicKey:**
   - Test that `primaryTopicKey` is resolved from `topicId` + `courseId` via Classroom API
   - Test that resolved `primaryTopicKey` is passed to `controller.upsertDefinition`

4. **ensureDefinitionFromInputs delegates to upsertDefinition:**
   - Test that `ensureDefinitionFromInputs` calls `controller.upsertDefinition` (not `controller.ensureDefinition`)
   - Test that both resolved `yearGroupKey` and `primaryTopicKey` are passed to `upsertDefinition`

5. **createDefinitionFromWizardInputs accepts yearGroupKey:**
   - Test with `yearGroupKey: 'year-group-10'` succeeds
   - Test passes `yearGroupKey` to `ensureDefinitionFromInputs`

6. **No yearGroup setting on abClass:**
   - Test that `abClass.yearGroup` is never modified during execution

### Required test updates

**Constraint:** Verify test patterns against actual test file contents before applying deletions/updates to ensure no unintended matches.

Tests to UPDATE:

- `tests/controllers/assignmentController.hydration.test.js`:
  - Tests matching 'should fetch year group from ABClass' — UPDATE to verify `yearGroupKey` resolution from input or `abClass.yearGroupKey`
  - Tests matching 'ensureDefinitionFromInputs' — UPDATE to use `yearGroupKey` parameter instead of `yearGroup`
- `tests/controllers/createDefinitionFromWizardInputs.test.js`:
  - All calls to `controller.createDefinitionFromWizardInputs` — UPDATE to pass `yearGroupKey` instead of `yearGroup`
  - Tests matching 'throws when yearGroup provided and persisting ABClass fails' — UPDATE to verify new `yearGroupKey` persistence flow
  - Update tests to verify that `abClass.yearGroupKey` is used instead of `abClass.yearGroup`

### Section checks

- `npm test -- tests/controllers/assignmentController.hydration.test.js`
- `npm test -- tests/controllers/createDefinitionFromWizardInputs.test.js`
- Mandatory-read evidence gate passed for all delegated handoffs
- Verify all delegated handoffs include `Files read` with all mandatory documentation paths listed

### Optional @remarks JSDoc follow-through

1. `AssignmentController.ensureDefinitionFromInputs`: Add `@remarks` noting parameter rename from `yearGroup` to `yearGroupKey`; now delegates to `controller.upsertDefinition` (not `controller.ensureDefinition`); resolves both `yearGroupKey` and `primaryTopicKey` before delegation; throws when resolution fails
2. `AssignmentController.createDefinitionFromWizardInputs`: Add `@remarks` noting parameter rename from `yearGroup` to `yearGroupKey`; passes `yearGroupKey` to `ensureDefinitionFromInputs`; no longer sets `abClass.yearGroup`

---

## Section 4 — AssignmentProcessor/globals.js: Rename `yearGroup` to `yearGroupKey`

### Objective

- Update `createDefinitionFromWizardInputs` in `src/backend/AssignmentProcessor/globals.js` to accept `yearGroupKey = null` (string) instead of `yearGroup = null` (number)
- Call controller method with `yearGroupKey`
- Preserve `saveStartAndShowProgress` unchanged

### Constraints

- **BLOCKING:** This section is blocked until Section 3 is complete (depends on `controller.createDefinitionFromWizardInputs` accepting `yearGroupKey`)
- No backwards compatibility required per SPEC.md; this section completes caller parameter migration
- Must pass `yearGroupKey` to controller
- `src/backend/AssignmentProcessor/globals.js` requires updates to maintain compatibility with existing callers during the transition period

### Blocked by

Section 0, Section 1, Section 2, Section 3

### Must complete before

Section 5, Regression

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/AssignmentProcessor/globals.js`
- `tests/controllers/createDefinitionFromWizardInputs.test.js`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/AssignmentProcessor/globals.js`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/AssignmentProcessor/globals.js`

### Shared helper plan

Helper decision entries: None

### Acceptance criteria

- `createDefinitionFromWizardInputs` in `globals.js` accepts `yearGroupKey = null` (string) parameter
- `createDefinitionFromWizardInputs` calls controller with `yearGroupKey`
- `saveStartAndShowProgress` unchanged
- No code in `AssignmentProcessor/globals.js` passes `yearGroup` to any model or controller method

### Required test cases (Red first)

Backend globals tests:

1. **createDefinitionFromWizardInputs accepts yearGroupKey:**
   - Test with `yearGroupKey: 'year-group-10'` passes correct value to controller
   - Test with `yearGroupKey: null` passes `null` to controller

### Required test updates

**Note:** No direct tests exist for `src/backend/AssignmentProcessor/globals.js` functions. The globals.js functions are tested indirectly through the controllers that call them.

Tests to UPDATE (indirect coverage):

- All tests in `tests/controllers/createDefinitionFromWizardInputs.test.js` already test the controller method, which internally calls the globals.js function. These tests have been updated in Section 3 to pass `yearGroupKey` instead of `yearGroup`.
- No additional test updates required for globals.js itself, as it has no direct test file.

### Section checks

- `npm test -- tests/controllers/createDefinitionFromWizardInputs.test.js` (indirect coverage)
- Mandatory-read evidence gate passed for all delegated handoffs
- Verify all delegated handoffs include `Files read` with all mandatory documentation paths listed

### Optional @remarks JSDoc follow-through

1. `createDefinitionFromWizardInputs` in globals.js: Add `@remarks` noting parameter rename from `yearGroup` to `yearGroupKey`

---

## Section 5 — API layer: Remove helper functions, inline logic, and update transport boundary

### Objective

- Delete `toCanonicalTransportDefinition_` from `assignmentDefinitionPartials.js`
- Replace call sites with direct `controller.toCanonicalFullDefinitionResponse(definition)`
- Delete `buildControllerUpsertPayload_`; inline URL-to-ID translation logic into `upsertAssignmentDefinition_` **without** the `assignmentWeighting` defaulting logic (lines 548-550)
- Delete `toPlainPartialRow_`; create exported helper `toTransportPartialRow_` in `assignmentDefinitionPartials.js` that accepts an `AssignmentDefinition` model instance, calls `definition.toPartialJSON()`, defensively strips any `yearGroup` field (safety net), and normalises Date fields to ISO strings
- Update `getAssignmentDefinitionPartials_` to use `toTransportPartialRow_`
- Add `toTransportPartialRow_` to the `module.exports` block for test accessibility
- Keep transport validation helpers unchanged: `validateRequiredYearGroupKey_`, `validateUpsertParameters_`, `validateReadParameters_`, `validateDeleteParameters_`
- Call sites to update: `upsertAssignmentDefinition_`, `getAssignmentDefinition_`
- **HARD DEPENDENCY:** Section 5 **MUST NOT START UNTIL Section 1 is complete**. The transport helper depends on Section 1's model serialization changes; defensive `yearGroup` stripping provides safety but does not replace Section 1's model-level removal

### Constraints

- **BLOCKING:** This section is blocked until Section 1 is complete (model serialization changes required)
- Must preserve transport validation ownership per `src/backend/AGENTS.md` §0.2
- Must not apply model defaults in API layer
- Must preserve Date normalisation at transport boundary
- The transport-boundary helper must explicitly strip `yearGroup` field from `definition.toPartialJSON()` output as a defensive measure **in addition to** the model-level removal from Section 1

### Blocked by

Section 0, Section 1

### Must complete before

Regression

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `docs/developer/backend/api-layer.md`
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js`

Implementation mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `docs/developer/backend/api-layer.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/z_Api/assignmentDefinitionPartials.js`
- `docs/developer/backend/api-layer.md`

### Shared helper plan

Helper decision entries (using consistent function-name identifiers):

1. Helper: `toCanonicalTransportDefinition_`
   - Decision: `Removed`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js`
   - Call-site rationale: Callers now use `controller.toCanonicalFullDefinitionResponse(definition)` directly
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Removed`

2. Helper: `buildControllerUpsertPayload_`
   - Decision: `Removed`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js`
   - Call-site rationale: URL-to-ID translation inlined into `upsertAssignmentDefinition_`; defaulting logic for `assignmentWeighting` (lines 548-550) must be removed per SPEC.md validation ownership rules
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Removed`

3. Helper: `toPlainPartialRow_`
   - Decision: `Removed`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js`
   - Call-site rationale: Replaced with `toTransportPartialRow_` helper
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Removed`

4. Helper: `toTransportPartialRow_`
   - Decision: `New`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js`
   - Call-site rationale: Exported transport-boundary helper that accepts an `AssignmentDefinition` model instance, calls `definition.toPartialJSON()`, defensively strips `yearGroup`, and normalises Date fields
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `toCanonicalTransportDefinition_` is removed
- Call sites `upsertAssignmentDefinition_` and `getAssignmentDefinition_` use `controller.toCanonicalFullDefinitionResponse(definition)` directly
- `buildControllerUpsertPayload_` is removed
- URL-to-ID translation logic inlined into `upsertAssignmentDefinition_` **without `assignmentWeighting` defaulting logic**
- `toPlainPartialRow_` is removed
- `getAssignmentDefinitionPartials_` uses `toTransportPartialRow_(definition)` helper that accepts an `AssignmentDefinition` model instance, calls `definition.toPartialJSON()`, removes `yearGroup` field defensively, and normalises Date fields to ISO strings
- Transport validation helpers unchanged: `validateRequiredYearGroupKey_`, `validateUpsertParameters_`, `validateReadParameters_`, `validateDeleteParameters_`
- `toTransportPartialRow_` is added to `module.exports` block for test accessibility
- No code in API layer helpers passes `yearGroup` to controller or model methods

### Required test cases (Red first)

API layer tests:

1. **Helper functions removed from source:**
   - Verify `toCanonicalTransportDefinition_` is not present in source file
   - Verify `buildControllerUpsertPayload_` is not present in source file
   - Verify `toPlainPartialRow_` is not present in source file

2. **Call sites updated:**
   - Verify `upsertAssignmentDefinition_` calls `controller.toCanonicalFullDefinitionResponse(definition)`
   - Verify `getAssignmentDefinition_` calls `controller.toCanonicalFullDefinitionResponse(definition)`

3. **getAssignmentDefinitionPartials\_ return shape:**
   - Test that returned objects have same shape as `definition.toPartialJSON()` but without `yearGroup` field
   - Test that Date fields (`createdAt`, `updatedAt`) are normalised as ISO strings defensively (handles both Date instances and pre-normalised strings)
   - Test that all other expected fields are present
   - Test that `tasks` field is `null` for partial definitions

4. **Transport validation unchanged:**
   - Test `validateRequiredYearGroupKey_` throws `ApiValidationError` when `yearGroupKey` is null
   - Test `validateRequiredYearGroupKey_` throws `ApiValidationError` when `yearGroupKey` is missing
   - Test `validateUpsertParameters_` still works correctly
   - Test `validateReadParameters_` still works correctly
   - Test `validateDeleteParameters_` still works correctly

5. **No `assignmentWeighting` defaulting in inlined code:**
   - Test that inlined URL-to-ID translation does NOT add `assignmentWeighting: 1` when missing from payload

### Required test updates/deletions

**Constraint:** Verify test patterns against actual test file contents before applying deletions/updates to ensure no unintended matches.

Tests to UPDATE:

- `tests/backend-api/assignmentDefinitionPartials.unit.test.js`:
  - Tests for `getAssignmentDefinitionPartials_` — UPDATE to verify `yearGroup` field is NOT included in returned objects and Date fields are normalised
  - Tests for `toTransportPartialRow_` — ADD new tests for the new helper
- `tests/api/assignmentDefinitionReadApi.test.js`:
  - Tests for `getAssignmentDefinition_` — UPDATE to verify `yearGroup` field is NOT included in response

### Section checks

- `npm test -- tests/backend-api/assignmentDefinitionPartials.unit.test.js`
- `npm test -- tests/api/assignmentDefinitionReadApi.test.js`
- Mandatory-read evidence gate passed for all delegated handoffs
- Shared-helper planning entries present in `docs/developer/backend/api-layer.md` with status `Removed` or `Not implemented` as appropriate
- Verify all delegated handoffs include `Files read` with all mandatory documentation paths listed

### Optional @remarks JSDoc follow-through

1. `getAssignmentDefinitionPartials_`: Add `@remarks` noting that it now uses transport-boundary helper for Date normalisation and yearGroup removal
2. `toTransportPartialRow_`: Add `@remarks` noting that this is a defensive transport-boundary helper that strips `yearGroup` and normalises Dates; works with model instances from Section 1

---

## Regression and contract hardening

### Objective

- Verify no regressions in assignment definition creation, update, list, read, and delete operations
- Verify `AssignmentController` workflows (start processing, wizard flows) continue to function correctly
- Verify all fail-fast behaviours work as expected
- Verify no code in active paths passes `yearGroup` to any model method

### Constraints

- **BLOCKING:** This section is blocked until Sections 0-5 are complete
- Prefer focused test runs before broader validation
- Run full backend test suite before considering feature complete

### Blocked by

Section 0, Section 1, Section 2, Section 3, Section 4, Section 5

### Must complete before

Documentation and rollout notes

### Acceptance criteria

- All assignment definition CRUD operations work correctly
- All `AssignmentController` workflows work correctly
- All fail-fast validations throw appropriate errors
- No code in active paths passes `yearGroup` to any model method
- All active code paths enforce the controller-resolution pattern for `yearGroupKey` (null accepted at controller, non-null at model)
- All tests pass
- All lint checks pass

### Required test cases/checks

1. **Explicit `yearGroup` field absence verification:**
   - Verify via grep/code search that no active code paths call `new AssignmentDefinition({ yearGroup: ... })` or pass objects containing `yearGroup` to model methods
   - Test that `getAssignmentDefinitionPartials_` response objects do NOT include `yearGroup` field
   - Test that `getAssignmentDefinition_` response does NOT include `yearGroup` field
   - Test that `upsertAssignmentDefinition_` response does NOT include `yearGroup` field

2. **Verify `PARTIAL_REQUIRED_FIELDS` constant does NOT include `yearGroup`:**
   - Verify `PARTIAL_REQUIRED_FIELDS` constant in `assignmentDefinitionPartials.js` excludes `yearGroup`

3. **Audit downstream consumers of `assignmentWeighting`:**
   - Run code search to audit all downstream consumers of `assignmentWeighting` for `assignmentWeighting === null` checks
   - Document findings and update or remove any code that relies on `assignmentWeighting` being null

4. **Verify fail-fast on deprecated `yearGroup` parameter:**
   - Test that `AssignmentDefinition` constructor throws `TypeError` when `yearGroup` is passed
   - Test that `AssignmentDefinition.fromJSON()` throws `TypeError` when `yearGroup` is present in input JSON

5. **Verify controller-resolution pattern:**
   - Test that controllers accepting `yearGroupKey: string | null` resolve to non-null before model calls
   - Test that model boundary receives non-null `yearGroupKey`

6. Run touched backend model suite: `npm test -- tests/models/assignmentDefinition.test.js`
7. Run touched backend controller suites:
   - `npm test -- tests/controllers/assignmentDefinitionController.test.js`
   - `npm test -- tests/controllers/assignmentDefinitionController.upsert.test.js`
   - `npm test -- tests/controllers/assignmentDefinitionController.fullStore.test.js`
   - `npm test -- tests/controllers/assignmentController.hydration.test.js`
   - `npm test -- tests/controllers/createDefinitionFromWizardInputs.test.js`
8. Run touched API layer suites:
   - `npm test -- tests/backend-api/assignmentDefinitionPartials.unit.test.js`
   - `npm test -- tests/api/assignmentDefinitionReadApi.test.js`
   - `npm test -- tests/api/assignmentDefinitionUpsertApi.test.js`
   - `npm test -- tests/api/assignmentDefinitionDeleteApi.test.js`
9. Run backend lint: `npm run lint:backend`
10. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff

### Section checks

- All commands listed above return green results
- No regressions detected in assignment definition operations
- No regressions detected in AssignmentController workflows
- Verify all delegated handoffs include `Files read` with all mandatory documentation paths listed

### Implementation notes / deviations / follow-up

- **Implementation notes:** Summarise what was done during regression phase
- **Deviations from plan:** Note any additional work discovered or done
- **Follow-up implications:** Record any downstream effects

---

## Documentation and rollout notes

### Objective

- Final documentation verification and cleanup
- Ensure all `@remarks` JSDoc documented in sections above are added
- Reconcile planned shared-helper entries in canonical docs

### Constraints

- **BLOCKING:** This section is blocked until Regression is complete
- Only modify documents relevant to the touched areas
- Keep documentation accurate and up to date

### Blocked by

Section 0, Section 1, Section 2, Section 3, Section 4, Section 5, Regression

### Acceptance criteria

- Documentation accurately reflects data shapes, API methods, and behavioural changes
- Any deviations or caveats are documented
- All planned `@remarks` JSDoc entries are present in code
- All shared-helper entries in `docs/developer/backend/api-layer.md` have correct final status (`Removed` for removed helpers, `Implemented` for new helpers)

### Required checks

1. Verify docs mention persistence/transport strategies
2. Verify API docs list any changed contracts
3. Confirm notes/deviations fields are filled during implementation
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs
5. Reconcile planned shared-helper entries in canonical docs: update status from `Not implemented` to `Implemented` for delivered helpers (`toTransportPartialRow_`)

### Optional @remarks JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation
- If earlier sections planned `@remarks`, verify that the relevant code now contains them before deleting the action plan
- If no `@remarks` are needed, record `None`

### Implementation notes / deviations / follow-up

- Record any notes from implementation
- Record any deviations from this plan
- Record any follow-up implications

---

## Suggested implementation order

**Status:** Section 0 **COMPLETE** - Section 1 **COMPLETE** - Ready to proceed to Section 2. All subsequent sections are now unblocked.

1. **Section 0** — Shared-helper planning gate (add/update entries in `api-layer.md` with correct status values) — **MANDATORY FIRST STEP**
2. **Section 1** — Model-level changes (foundation for all other changes; **must complete before Section 5**)
3. **Section 2** — AssignmentDefinitionController changes (**blocked by Section 1**)
4. **Section 3** — AssignmentController changes (**blocked by Section 2**: `AssignmentController.ensureDefinitionFromInputs` must call `controller.upsertDefinition` replacing the removed `controller.ensureDefinition`)
5. **Section 4** — AssignmentProcessor/globals.js changes (**blocked by Section 3**: `globals.js` calls `controller.createDefinitionFromWizardInputs` which must accept `yearGroupKey` parameter)
6. **Section 5** — API layer changes (**blocked by Section 1**: model serialization changes required; defensive stripping provides additional safety)
7. **Regression and contract hardening** — Full validation (**blocked by Sections 0-5**)
8. **Documentation and rollout notes** — Final documentation pass (**blocked by Regression**)

---

## Files affected by this plan

### Backend Model

- `src/backend/Models/AssignmentDefinition.js` — Core model changes

### Backend Controllers

- `src/backend/y_controllers/AssignmentDefinitionController.js` — Remove ensureDefinition, update yearGroup handling
- `src/backend/y_controllers/AssignmentController.js` — Rename parameters, remove yearGroup setting

### Backend API

- `src/backend/z_Api/assignmentDefinitionPartials.js` — Remove helpers, inline logic, add new transport helper

### Legacy Code

- `src/backend/AssignmentProcessor/globals.js` — Rename parameter

### Documentation

- `docs/developer/backend/api-layer.md` — Update Shared Helper Status (**Section 0 — MUST BE DONE FIRST**)

### Tests (to be updated/deleted)

- `tests/models/assignmentDefinition.test.js` — Add new tests, update existing
- `tests/controllers/assignmentDefinitionController.test.js` — Delete ensureDefinition tests, update others
- `tests/controllers/assignmentDefinitionController.upsert.test.js` — Update as needed
- `tests/controllers/assignmentDefinitionController.fullStore.test.js` — Delete ensureDefinition tests
- `tests/controllers/assignmentController.hydration.test.js` — Update parameter names
- `tests/controllers/createDefinitionFromWizardInputs.test.js` — Update parameter names
- `tests/backend-api/assignmentDefinitionPartials.unit.test.js` — Delete removed helper tests, add new helper tests
- `tests/api/assignmentDefinitionReadApi.test.js` — Verify return shape
- `tests/api/assignmentDefinitionUpsertApi.test.js` — Verify transport validation

---

_This action plan implements SPEC.md v1.9.0 with TDD-first approach. Each section is independently testable. **Section 0 MUST be completed before any other section begins.** Section 1 must be completed before Section 5 begins. Shared-helper planning entries must be added to canonical docs with correct status values before implementation starts. Explicit blocking dependencies are enforced in each section header._
