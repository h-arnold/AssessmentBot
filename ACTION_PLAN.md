# `getABClass` API Endpoint + `ABClassController` Refactor — Delivery Plan (TDD-First)

> **Plan status**: v1.3 (this delivery bundles the `getABClass` endpoint work from `SPEC.md` v1.3 with the `ABClassController` decomposition from `ABClassControllerRefactor_SPEC.md` v1.0. Sections 1-7 cover the new endpoint; Sections 8-13 cover the refactor. Both share the same TDD-first discipline and the same regression test suite, but the refactor's only externally visible change is the file path of the controller module. Awaiting `Planner Reviewer` sign-off.)
>
> **Section 1 — Status**: ✅ COMPLETE (committed `243fbf0`) — `abclassMutations.js` moved to `z_Api/abclass/`, paths updated, all tests pass, regression gate passed.
>
> **Section 2 — Status**: ✅ COMPLETE (committed `c790aa6`) — `validateParametersObject_` extracted to `abclassValidation.js`, global reference added, eslint config updated, regression gate passed.
>
> **Section 3 — Status**: ✅ COMPLETE (committed `305e8fa`) — `readClass` and `_toReadView` added to ABClassController, all 9 tests pass, regression gate passed. Technical debt: ABClassController.js is 1061 lines (was 996 pre-Section-3) — exceeds 500-line limit; resolved by decomposition in Sections 8-13.
>
> **Section 4 — Status**: ✅ COMPLETE (committed `b644800`) — `abclassRead.js` with `getABClass_` transport handler created, `ALLOWLISTED_METHOD_HANDLERS` entry added, `globalThis.getABClass_` wired in `z_apiHandler.js`, `eslint.config.js` updated. All 12 tests pass, regression gate passed (0 new regressions from Section 4).
>
> **Section 5 — Status**: ✅ COMPLETE (committed `██████`) — `classDetailService.zod.ts` (all Zod schemas) and `classDetailService.ts` (`getABClass` service function) created in `googleClassrooms/classDetail/` subfolder. All 38 tests pass, regression gate passed (0 new regressions from Section 5; ABClassController.js max-lines is pre-existing from Section 3; frontend-e2e-check failure is a flaky layout positioning test unrelated to Section 5).

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (v1.3, signed off by `Planner Reviewer`).
2. Read `ABClassControllerRefactor_SPEC.md` (v1.0, signed off by `Planner Reviewer`).
3. Read `src/backend/AGENTS.md` (backend conventions, §0.1 trailing-underscore handler pattern, §0.2 validation ownership, §1.1 Node test compatibility, §8 date handling, §3 logging, §10 large file decomposition, §11 API domain folder organisation).
4. Read `src/frontend/AGENTS.md` (frontend conventions, §4.1 required API transport pattern, §4.3 prohibited types in `google.script.run`, §8 Zod validation, §12 service domain folder organisation).
5. Read `docs/developer/backend/api-layer.md` for canonical API-layer rules.
6. Read `docs/developer/DATA_SHAPES.md` (and its `backend/DATA_SHAPES.md` mirror) for the canonical partial shape contracts.
7. Treat those documents as the source of truth for product behaviour, contracts, and rules.
8. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec.

## Scope and assumptions

### Scope

- Move `src/backend/z_Api/abclassMutations.js` into a new `src/backend/z_Api/abclass/` domain folder (per backend AGENTS §11). Update require paths in `z_apiHandler.js`, the relaxed-rule path in `eslint.config.js`, and three test file require paths.
- Create a new shared validation file `src/backend/z_Api/abclass/abclassValidation.js` containing `validateParametersObject_` (extracted from the moved `abclassMutations.js`).
- Add `ABClassController.readClass(classId)` and private `ABClassController._toReadView(abClass)` methods to `src/backend/y_controllers/ABClassController.js`.
- Create `src/backend/z_Api/abclass/abclassRead.js` with the thin-pass-through `getABClass_` transport handler.
- Add the `getABClass` entry in `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js` and wire `globalThis.getABClass_` in the `module.exports` branch (with updated `abclassMutations_` require path).
- Update `src/backend/Utils/ErrorTypes/ClassNotFoundError.js` JSDoc per the spec.
- Create `src/frontend/src/services/googleClassrooms/classDetail/` subfolder (per frontend AGENTS §12) containing `classDetailService.ts`, `classDetailService.zod.ts`, `classDetailService.zod.spec.ts`, `classDetailService.spec.ts`.
- Add `queryKeys.abClass(classId)` in `src/frontend/src/query/queryKeys.ts` and `getABClassQueryOptions(classId)` in `src/frontend/src/query/sharedQueries.ts`.
- Backend tests: new `tests/controllers/abclassController.readClass.test.js`; new `tests/api/abclassRead.test.js`; new or extended `tests/backend-api/abclassValidation.unit.test.js`; update three existing test file require paths.
- Frontend tests: new `classDetailService.spec.ts` and `classDetailService.zod.spec.ts` (in the new subfolder).
- Documentation updates: `docs/developer/backend/api-layer.md` (new endpoint entry); `docs/developer/backend/DATA_SHAPES.md` (new response shape section).

### Out of scope

- Per-assignment full rehydration — the existing `getAssignment` endpoint is the canonical path.
- Roster refresh on read — the assessment-run path (`startAssessmentRun`) and `upsertABClass` are the existing entry points.
- Reorganising the pre-existing `classPartials*` files into a subfolder (pre-existing rule deviation; out of scope for this round).
- Any visible class-detail page (out of scope; will get its own layout spec when built).
- New shared helper extraction beyond the `abclassValidation.js` already specified (no other new shared helpers are introduced).
- Updating the `z_Api` builder concatenation order to use numeric prefixes (the existing `localeCompare` order is sufficient because all function calls in the new `abclass/` folder are lazy).
- The `ABClassController` decomposition is **NOT out of scope** — it is
  covered by Sections 8-13 of this plan and governed by
  `ABClassControllerRefactor_SPEC.md` v1.0.

### Assumptions

1. The `eslint.config.js` relaxed-rule file list (lines 192–212) is the only ESLint configuration entry that needs updating; the root-level `.eslintrc.js` and `config/eslint/*.cjs` files do not reference any of the moved or new files.
2. The existing `assignmentDefinitionValidation.js` / `assignmentDefinitionTransport.js` pair demonstrates the lazy-call load-order pattern: `assignmentDefinitionTransport.js` loads alphabetically before `assignmentDefinitionValidation.js`, yet `upsertAssignmentDefinition_` calls `validateUpsertParameters_` at runtime without issue. The new `abclass/` folder follows the same pattern (no numeric prefixes needed).
3. `ABClassController.loadClass` is preserved unchanged (it still has its write-effect semantics for the assessment-run path). The new `readClass` is purely additive and does not call `_refreshRoster` or `_persistRoster`.
4. The existing `tests/api/abclassMutations.test.js` will require the new path but its assertions are unchanged. The new transport test (`tests/api/abclassRead.test.js`) follows the pattern of `tests/api/assignmentReadApi.test.js`.
5. `classDetailService.zod.ts` schema matches `Assignment.toPartialJSON()` output exactly (lines 116–134 of `src/backend/AssignmentProcessor/Assignment.js`); the Zod schema is the source of truth for the response shape and the TypeScript type is derived via `z.infer<typeof ...>`.
6. The frontend Zod schema for `ClassFull` uses `z.nullable()` on the outer response (per frontend AGENTS §8, because the backend `_success()` coerces `undefined → null`).

---

## Global constraints and quality gates

### Engineering constraints

- Keep API handler thin and delegate to controller methods (per backend AGENTS §0.1).
- Fail fast on invalid inputs with `ApiValidationError`; do not add defensive guards.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- `ABLogger` is mandatory for all new backend code in active areas (per backend AGENTS §3).
- The new `_toReadView` controller method uses **leading underscore** (controller private method convention); the new `getABClass_` transport handler uses **trailing underscore** (GAS-hiding convention). These two conventions are not interchangeable.
- Production backend files must not use `require`/`import`/`module.exports` for internal dependencies (per backend AGENTS §1.1). Shared functions are referenced as globals via `/* global ... */` JSDoc.
- The `validateParametersObject_` global is defined in `abclassValidation.js` and referenced from `abclassMutations.js` and `abclassRead.js` via `/* global validateParametersObject_ */`.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads. For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

This work introduces one new shared validation file and reuses several existing primitives. No new types or shared helper extraction beyond what is specified.

Helper decision entries:

1. Helper: `validateParametersObject_` (extracted to `abclassValidation.js`, not new)
   - Decision: `extend` (move from `abclassMutations.js` to new shared file; the function body is unchanged)
   - Owning module/path: `src/backend/z_Api/abclass/abclassValidation.js` (new file)
   - Call-site rationale: backend AGENTS §0.2 rule 3 forbids same-layer duplication without
     explicit defence-in-depth. The primitive was duplicated in `abclassMutations.js`
     and `abclassRead.js`; extracting to the new shared file follows the
     `assignmentDefinitionValidation.js` precedent.
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md` §"Shared
     Helper Status" (existing list; add new entry)
   - Planned doc status: `Not implemented` (entry to be added when implementation lands)
2. Helper: `validateSafeTrimmedIdentifier_` (existing, reused)
   - Decision: `reuse`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionValidation.js` (existing)
   - Call-site rationale: the new `validateIdentifier_` file-local wrapper in
     `abclassRead.js` calls `validateSafeTrimmedIdentifier_` with the same
     `throwValidationError` and error message template used by `getAssignment_`
     (`assignmentAssessment.js` line 52). No new primitive needed.
   - Relevant canonical doc target: `docs/developer/backend/api-layer.md`
     §"Validation ownership rules" (existing reference; no update)
3. Helper: `getAssignmentDefinitionQueryOptions` precedent (existing, reused as pattern)
   - Decision: `reuse as pattern`
   - Owning module/path: `src/frontend/src/query/sharedQueries.ts` (existing)
   - Call-site rationale: the new `getABClassQueryOptions(classId)` factory follows the
     same `queryOptions` + `queryKeys` factory pattern. The exact signature mirrors
     `getAssignmentDefinitionQueryOptions`.
   - Relevant canonical doc target: frontend AGENTS §2.2 (existing reference; no
     update)

### Validation commands hierarchy

- Backend lint: `npm run lint:backend` (per backend AGENTS §8 and root AGENTS §8)
- Frontend lint: `npm run lint:frontend` (per root AGENTS §8)
- Backend tests: `npm test -- <target>` (e.g. `npm test -- tests/controllers/abclassController.readClass.test.js`)
- Frontend unit tests: `npm run frontend:test -- <target>` (e.g. `npm run frontend:test -- src/frontend/src/services/googleClassrooms/classDetail/`)
- Frontend e2e tests: not added in this round (no visible UI changes)

---

## Section 1 — Move `abclassMutations.js` into new `z_Api/abclass/` folder, update paths

### Objective

Create the new `z_Api/abclass/` domain folder (per backend AGENTS §11) and move `abclassMutations.js` into it. Update all references: the `z_apiHandler.js` require path, the `eslint.config.js` relaxed-rule path, and the three test file require paths. This is a pure location move with no behaviour change (the `validateParametersObject_` extraction is handled in section 2).

### Constraints

- The moved file's content is unchanged except the `validateParametersObject_` extraction (handled in section 2; in this section, the file is moved as-is).
- The `ALLOWLISTED_METHOD_HANDLERS` closure entry `upsertABClass: (parameters) => upsertABClass_(parameters),` is unchanged.
- The new folder is a single-file domain at this point; the `abclass/` domain is completed in later sections.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§11 API domain folder organisation, §0.1 trailing-underscore pattern, §1.1 Node test compatibility)
- `src/backend/z_Api/z_apiHandler.js` (the require block in the `module.exports` branch)
- `eslint.config.js` (the relaxed-rule file list at lines 192–212)
- `tests/api/abclassMutations.test.js` (require path at line 3, line 91)
- `tests/api/apiHandler/shared.js` (require path at line 15)
- `tests/backend-api/abclassMutations.unit.test.js` (require path at lines 2 and 8)

Testing Specialist mandatory docs:

- Same as Implementation, plus the existing test file bodies (no assertion changes; the path move is mechanical)

Code Reviewer mandatory docs:

- Same as Implementation, plus `docs/developer/backend/api-layer.md` (the existing `abclassMutations` entries at lines 381, 388, 398 — these references use the file path and will need updating in the documentation section later, but the code review of this section is about the path move only)

Other delegated agents (if used) mandatory docs:

- None for this section (no Documentation or Playwright involvement yet)

### Shared helper plan (when helper changes are expected)

No helper changes in this section. The `validateParametersObject_` extraction is in section 2.

### Acceptance criteria

- `src/backend/z_Api/abclass/abclassMutations.js` exists with byte-for-byte identical content to the original `src/backend/z_Api/abclassMutations.js` **at the end of this section** (the `validateParametersObject_` extraction is performed in Section 2; at the end of this section the file is still a pure location move).
- `src/backend/z_Api/abclassMutations.js` no longer exists.
- `src/backend/z_Api/z_apiHandler.js` requires `'./abclass/abclassMutations.js'` (and `globalThis.abclassMutations_ = require('./abclass/abclassMutations.js').abclassMutations_` or equivalent).
- `eslint.config.js` relaxed-rule file list contains `'src/backend/z_Api/abclass/abclassMutations.js'` (replacing the old path).
- The three test files (`tests/api/abclassMutations.test.js`, `tests/api/apiHandler/shared.js`, `tests/backend-api/abclassMutations.unit.test.js`) require from the new path.
- All existing tests still pass (no behavioural change).

### Required test cases (Red first)

Backend tests (existing — verify no regression):

1. `tests/api/abclassMutations.test.js` runs against the new path and all assertions pass.
2. `tests/api/apiHandler/shared.js` (if it has any path-dependent test cases) still passes.
3. `tests/backend-api/abclassMutations.unit.test.js` runs against the new path and all assertions pass.

Backend controller tests:

4. No new tests in this section (this is a pure path move).

### Section checks

- `npm run lint:backend` passes (no new lint errors from the path move).
- `npm test -- tests/api/abclassMutations.test.js` passes.
- `npm test -- tests/api/apiHandler/` passes.
- `npm test -- tests/backend-api/abclassMutations.unit.test.js` passes.
- `npm test -- tests/controllers/abclass-loadClass.test.js` and other ABClass-related test files still pass (regression check).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- None for this section.

### Implementation notes / deviations / follow-up

- **Implementation notes**: pure location move; the require-path change in `z_apiHandler.js`'s `module.exports` branch is one line; the `eslint.config.js` change is one line; the three test-file require changes are mechanical. The file's content is byte-for-byte identical at the end of this section; the `validateParametersObject_` extraction happens in Section 2. This creates a brief intermediate state where the moved file still contains its local helper — this is intentional and the file is not broken because the helper is still defined locally. `SPEC.md` step 1 describes the combined end state of Sections 1–2, not the intermediate state after Section 1 alone.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: section 2 will remove the file-local `validateParametersObject_` from `abclassMutations.js` and add the `abclassValidation.js` shared file. Section 2 must be done in lockstep with this section or the file will temporarily have a broken import if a future refactor moves the function out.

---

## Section 2 — Create `abclassValidation.js` shared validation file

### Objective

Create `src/backend/z_Api/abclass/abclassValidation.js` containing `validateParametersObject_` (moved from `abclassMutations.js`). Update `abclassMutations.js` to reference the global instead of defining its own copy. This avoids same-layer duplication (per backend AGENTS §0.2 rule 3) and follows the `assignmentDefinitionValidation.js` precedent.

### Constraints

- `validateParametersObject_` is a top-level `z_Api` function; trailing-underscore pattern applies.
- The function body is unchanged (it remains the same primitive that was in `abclassMutations.js` line 18).
- `abclassMutations.js` references the function as a global via `/* global validateParametersObject_ */` (no `require` / `import`).
- The `module.exports` block in `abclassValidation.js` exports `validateParametersObject_` for Node test access.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§0.1 trailing-underscore pattern, §1.1 Node test compatibility)
- `src/backend/z_Api/assignmentDefinitionValidation.js` (the existing shared-validation-file pattern; line 690 has the `module.exports` block)
- `src/backend/z_Api/abclassMutations.js` (the source of the moved function — line 18, lines 55, 70, 103 for callers)

Testing Specialist mandatory docs:

- Same as Implementation, plus the existing test patterns in `tests/api/abclassMutations.test.js` (which exercises `validateParametersObject_` indirectly)

Code Reviewer mandatory docs:

- Same as Implementation, plus `docs/developer/backend/api-layer.md` (no new doc entry needed for this section; the new shared primitive is internal)

### Shared helper plan

This section is the `extend` decision for `validateParametersObject_` recorded in §"Shared-helper planning gate" entry 1. The `Not implemented` status moves to `Implemented` once the file is created and the helper is exported.

### Acceptance criteria

- `src/backend/z_Api/abclass/abclassValidation.js` exists.
- The file defines `validateParametersObject_(parameters, methodName)` with the same body as the original (moved from `abclassMutations.js` line 18).
- The file ends with the guarded `if (typeof module !== 'undefined' && module.exports) { module.exports = { validateParametersObject_ }; }` block.
- `src/backend/z_Api/abclass/abclassMutations.js` no longer defines `validateParametersObject_` locally; instead, it has a `/* global validateParametersObject_ */` JSDoc hint at the very top of the file (before any function definitions), matching the existing pattern in `assignmentAssessment.js` line 1.
- `eslint.config.js` relaxed-rule file list (the array at lines 192–212) contains `'src/backend/z_Api/abclass/abclassValidation.js'`. Without this, the new file's test fixtures using indexed property access will fail lint.
- All existing tests still pass (the function is used by `validateUpsertABClassParameters_`, `validateUpdateABClassParameters_`, `validateDeleteABClassParameters_` — these callers reference the global now).

### Required test cases (Red first)

Backend API tests (new):

1. `tests/backend-api/abclassValidation.unit.test.js` (new file) covers:
   - `validateParametersObject_` is exported in Node test runtime
   - `validateParametersObject_` accepts a plain object without throwing
   - `validateParametersObject_` rejects `null` with `ApiValidationError` (`'params must be an object.'`)
   - `validateParametersObject_` rejects `undefined` with `ApiValidationError`
   - `validateParametersObject_` rejects an array with `ApiValidationError` (arrays are objects in JS but not plain objects for our purposes)
   - `validateParametersObject_` rejects a string with `ApiValidationError`
   - `validateParametersObject_` includes the `method` and `fieldName: 'params'` in the thrown error's options

Backend API tests (existing — verify no regression):

2. `tests/api/abclassMutations.test.js` still passes (the function is now a global, but the behaviour is identical).

### Section checks

- `npm run lint:backend` passes.
- `npm test -- tests/backend-api/abclassValidation.unit.test.js` passes.
- `npm test -- tests/api/abclassMutations.test.js` passes (regression check).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- The exported `validateParametersObject_` gets a brief JSDoc noting it is the shared primitive for the `abclass/` domain (referenced via `/* global ... */` from `abclassMutations.js` and `abclassRead.js`).

### Implementation notes / deviations / follow-up

- **Implementation notes**: pure extraction; the function body is unchanged. The JSDoc on the moved function can be lightly extended to document the new sharing pattern.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: section 5 (`abclassRead.js`) will reference this global. If section 2 and section 5 are done in the same delivery, the test for `abclassRead.js` will verify the global reference works at runtime.

---

## Section 3 — Add `ABClassController.readClass` and private `_toReadView`

### Objective

Add `readClass(classId)` (public) and `_toReadView(abClass)` (private, leading underscore) methods to the **current** monolithic `ABClassController.js`. The new methods form the pure-read counterpart to the existing `loadClass`: they read a stored class document, deserialise it, and return a transport-ready plain object with partial assignments and defence-in-depth strip. No Classroom API calls, no storage mutation.

> **Refactor note**: this section adds the methods to the
> monolithic `ABClassController.js` because the file is still in its
> pre-refactor state at this point in the plan. Section 8+
> decomposes the file (now ~1100 lines) into a folder of
> sub-classes per `ABClassControllerRefactor_SPEC.md` v1.0.
> `readClass` lands on the new facade `index.js` and
> `_toReadView` lands on the new `ABClassResponseMapper`
> sub-class. The unit tests in this section remain valid
> after the refactor because the facade re-exposes
> `_toReadView` via delegation (per
> `ABClassControllerRefactor_SPEC.md` Decision 3) and
> `readClass` is a public method on the facade.

### Constraints

- `readClass` throws `ClassNotFoundError` with the same message format and `courseId` metadata as `loadClass` lines 875–886 (no distinction between missing-collection and missing-document).
- `readClass` does not call `_refreshRoster`, `_persistRoster`, or any Classroom API method.
- `_toReadView` uses **leading underscore** (controller private method convention).
- `_toReadView` is **not** exported via `module.exports` (existing controllers export only the class itself).
- The defence-in-depth `delete _hydrationLevel` and `delete progressTracker` calls on each embedded assignment are kept even though they are currently a no-op (mirrors `getAssignment_` precedent for `progressTracker`).
- Mandatory `@remarks` JSDoc on `readClass` documents the pure-read intent and references `_toReadView` for the partial shape.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§0.1 trailing-underscore vs leading-underscore conventions, §3 logging, §4 defensive-guard policy, §7 default values rule)
- `src/backend/y_controllers/ABClassController.js` (the existing `loadClass` and `_normaliseClassPartial` patterns; lines 869–895, lines 153–172)
- `src/backend/Models/ABClass.js` (`toJSON()` shape, `fromJSON` reconstruction, line 356's `_hydrationLevel: 'partial'`)
- `src/backend/AssignmentProcessor/Assignment.js` (`toPartialJSON()` shape, lines 116–134; `_baseFromJSON` `_hydrationLevel` behaviour at lines 172–227)
- `src/backend/Utils/ErrorTypes/ClassNotFoundError.js` (the typed error class; constructor signature)
- `docs/howTos/rehydration.md` (the redaction contract for `Assignment.toPartialJSON()`)

Testing Specialist mandatory docs:

- Same as Implementation, plus the existing `tests/controllers/abclass-loadClass.test.js` pattern

Code Reviewer mandatory docs:

- Same as Implementation, plus `src/backend/z_Api/assignmentAssessment.js` (the `getAssignment_` precedent for defence-in-depth strip and `ClassNotFoundError` catch)

### Shared helper plan

No new shared helpers. The new methods are private to `ABClassController`.

### Acceptance criteria

- `ABClassController` has a new `readClass(classId)` method.
- `ABClassController` has a new `_toReadView(abClass)` method (leading underscore; not exported).
- `readClass` returns a plain object (not a model instance).
- `readClass` throws `ClassNotFoundError` when the collection is missing (with structured `courseId` metadata).
- `readClass` throws `ClassNotFoundError` when the document is missing (same message and metadata).
- `readClass` does **not** call `ClassroomApiClient.fetchCourse`, `fetchTeachers`, or `fetchAllStudents`.
- `readClass` does **not** call any `dbManager.getCollection(...).insertOne`, `replaceOne`, `updateOne`, or `save` (no storage mutation).
- `readClass`'s returned plain object has `assignments[]` entries as `Assignment.toPartialJSON()` output (not `Assignment.toJSON()` output).
- The returned plain object has `_hydrationLevel` and `progressTracker` stripped from each embedded assignment.
- `readClass` surfaces corrupt documents as `INTERNAL_ERROR` rather than as `null` (matching `loadClass` precedent; the error surfaces inside `_toReadView` / `toPartialJSON()`).
- The `readClass` JSDoc includes the mandatory `@remarks` block: _"Pure read — does not call `_refreshRoster`, `_persistRoster`, or any Classroom API. Use `loadClass` when roster freshness is required. Returns a plain object with `assignments[]` as `Assignment.toPartialJSON()` output; the partial shape is produced by the private `_toReadView` method."_

### Required test cases (Red first)

Backend controller tests (new — `tests/controllers/abclassController.readClass.test.js`):

1. **RED**: `readClass` does not exist yet — `ABClassController.prototype.readClass` is `undefined` (the method is not on the prototype). The test creates a new `ABClassController` instance, calls `instance.readClass('class-001')`, and asserts the method exists (e.g. `expect(typeof instance.readClass).toBe('function')`). Test fails because the method is not yet defined.
2. **GREEN**: `readClass` returns the transport-shaped plain object (not a model instance) for a stored class document with all fields populated. Test passes.
3. `readClass` throws `ClassNotFoundError` with the same message format and `courseId: <classId>` metadata as `loadClass` when the collection is missing. Test passes.
4. `readClass` throws `ClassNotFoundError` with the same message format and `courseId: <classId>` metadata as `loadClass` when the document is missing. Test passes.
5. `readClass` does **not** call `ClassroomApiClient.fetchCourse`, `fetchTeachers`, or `fetchAllStudents` (verified by spy assertion). Test passes.
6. `readClass` does **not** call `dbManager.getCollection(...).insertOne`, `replaceOne`, `updateOne`, or `save` (verified by spy assertion). Test passes.
7. `readClass`'s returned plain object has `assignments[]` as `Assignment.toPartialJSON()` output (verified by `expect(assignments[0]).toEqual(expectedPartialShape)`). Test passes.
8. The returned plain object has `_hydrationLevel` and `progressTracker` stripped from each embedded assignment (verified by `expect(assignments[0]).not.toHaveProperty('_hydrationLevel')`). Test passes.
9. `readClass` surfaces corrupt documents as `INTERNAL_ERROR` (test sets up a document that causes `Assignment.fromJSON` → `toPartialJSON()` to throw; test asserts the error propagates). Test passes.
10. `readClass` JSDoc has the mandatory `@remarks` block (test verifies the string is present in the function's JSDoc comment). Test passes.

### Section checks

- `npm run lint:backend` passes.
- `npm test -- tests/controllers/abclassController.readClass.test.js` passes.
- `npm test -- tests/controllers/abclass-loadClass.test.js` passes (regression check — `loadClass` is unchanged).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- `readClass`: the mandatory `@remarks` block per the acceptance criteria.
- `_toReadView`: a brief JSDoc noting it produces the transport-shaped response from a model instance; called only by `readClass`.

### Implementation notes / deviations / follow-up

- **Implementation notes**: the controller file is over 1000 lines and has a planned decomposition in `LARGE_CODE_FILES.md`. This delivery does **not** decompose the file (out of scope per the spec). The new methods are added alongside the existing `loadClass`.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: section 4 (transport handler) will call `readClass`. Section 7 (`ClassNotFoundError` JSDoc update) clarifies the typed-error contract that `readClass` already throws.

---

## Section 4 — Add `getABClass_` transport handler and `ALLOWLISTED_METHOD_HANDLERS` entry

### Objective

Create `src/backend/z_Api/abclass/abclassRead.js` with the thin-pass-through `getABClass_` transport handler. Add the `getABClass` entry in `ALLOWLISTED_METHOD_HANDLERS` and wire `globalThis.getABClass_` in the test-harness branch.

### Constraints

- `abclassRead.js` is a thin pass-through: validate params, call `new ABClassController().readClass(parameters.classId)`, catch `ClassNotFoundError` and return `null`, log via `ABLogger` at the `getAssignment_` precedent levels (`info` on success, `warn` on not-found, `error` on other failures).
- The file-local `validateIdentifier_(value, fieldName)` wrapper calls `validateSafeTrimmedIdentifier_` from `assignmentDefinitionValidation.js` (line 118) with the same `throwValidationError` and error message template used by `getAssignment_`.
- The handler does **not** call `DateUtils.normaliseDateFields` (the response root has no `Date` fields).
- The handler does **not** export `validateIdentifier_` (matches the `assignmentAssessment.js` precedent of exporting only the handler).
- The `module.exports` block exports `{ getABClass_ }` only.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§0.1 trailing-underscore pattern, §0.2 validation ownership, §3 logging, §11 API domain folder)
- `src/backend/z_Api/z_apiHandler.js` (the `ALLOWLISTED_METHOD_HANDLERS` registry, the `module.exports` test-harness wiring block, the error envelope)
- `src/backend/z_Api/assignmentAssessment.js` (the `getAssignment_` precedent — lines 52–66 for `validateIdentifier_` wrapper, lines 122–153 for log levels and `ClassNotFoundError` catch, lines 155–156 for the `module.exports` block)
- `src/backend/z_Api/assignmentDefinitionValidation.js` (the source of `validateSafeTrimmedIdentifier_`; line 118)
- `src/backend/z_Api/abclass/abclassValidation.js` (the source of `validateParametersObject_`, from section 2)
- `src/backend/y_controllers/ABClassController.js` (the `readClass` method, from section 3)
- `src/backend/Utils/ErrorTypes/ClassNotFoundError.js` (the typed error class)

Testing Specialist mandatory docs:

- Same as Implementation, plus `tests/api/assignmentReadApi.test.js` (the closest precedent — defines the test pattern for a thin transport handler with `ClassNotFoundError` catch)

Code Reviewer mandatory docs:

- Same as Implementation, plus `docs/developer/backend/api-layer.md` (for consistency with the documented transport patterns)

### Shared helper plan

No new shared helpers in this section. The `validateIdentifier_` wrapper is a thin file-local wrapper that reuses the existing `validateSafeTrimmedIdentifier_`.

### Acceptance criteria

- `src/backend/z_Api/abclass/abclassRead.js` exists with the thin-pass-through `getABClass_` handler.
- `z_apiHandler.js` `ALLOWLISTED_METHOD_HANDLERS` contains `getABClass: (parameters) => getABClass_(parameters),`.
- `z_apiHandler.js` `module.exports` branch contains `globalThis.getABClass_ = require('./abclass/abclassRead.js').getABClass_;` (and the updated `abclassMutations_` require path from section 1).
- `eslint.config.js` relaxed-rule file list (the array at lines 192–212) contains `'src/backend/z_Api/abclass/abclassRead.js'` (the new transport file) and `'src/backend/z_Api/abclass/abclassValidation.js'` (the shared validation file added in Section 2; verified here because `abclassRead.js` references the shared global and its test fixtures also exercise the shared validation). Without these entries, the new files' test fixtures using indexed property access will fail lint.
- The handler validates `params` (plain object) and `classId` (non-empty, trimmed, no path-traversal, no control characters).
- The handler returns the controller's shaped response on success (pass-through).
- The handler returns `null` when the controller throws `ClassNotFoundError`.
- The handler re-throws other controller errors loudly (no defensive catch-and-ignore).
- The handler logs at the `getAssignment_` precedent levels.
- The `module.exports` block exports `{ getABClass_ }` only.

### Required test cases (Red first)

Backend API tests (new — `tests/api/abclassRead.test.js`):

1. **RED**: `getABClass_` is not exported in Node test runtime — `require('../../src/backend/z_Api/abclass/abclassRead.js').getABClass_` is `undefined`. Test fails.
2. **GREEN**: `getABClass_` is exported in Node test runtime. Test passes.
3. `getABClass_` rejects non-object, `null`, and `undefined` `params` with `ApiValidationError` (`'params must be an object.'`). Test passes.
4. `getABClass_` rejects missing `classId` with `ApiValidationError` (`'classId must be a non-empty string.'`). Test passes.
5. `getABClass_` rejects untrimmed `classId` with `ApiValidationError`. Test passes.
6. `getABClass_` rejects `classId` with path-traversal characters (`..`, `/`, `\`) with `ApiValidationError`. Test passes.
7. `getABClass_` rejects `classId` with ASCII control characters (code points 0–31 and 127) with `ApiValidationError`. Test passes.
8. `getABClass_` returns the controller's shaped response on success (verified by `expect(result).toEqual(controllerResult)` deep equality). Test passes.
9. `getABClass_` returns `null` when the controller throws `ClassNotFoundError` (verified by stubbing the controller to throw, then asserting `null` is returned). Test passes.
10. `getABClass_` re-throws other controller errors loudly (verified by stubbing the controller to throw a non-`ClassNotFoundError` and asserting the error propagates). Test passes.
11. The handler does **not** call `DateUtils.normaliseDateFields` at the response root (verified by spying on `DateUtils.normaliseDateFields` and asserting it is not called). Test passes.
12. `ABLogger.getInstance().info` is called on successful read (verified by spy). Test passes.
13. `ABLogger.getInstance().warn` is called on not-found (verified by spy). Test passes.
14. `ABLogger.getInstance().error` is called on other failures (verified by spy). Test passes.

### Section checks

- `npm run lint:backend` passes.
- `npm test -- tests/api/abclassRead.test.js` passes.
- `npm test -- tests/api/abclassMutations.test.js` passes (regression check — the existing mutations still work).
- `npm test -- tests/api/apiHandler/` passes (regression check — the dispatcher still works for all methods).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- `getABClass_`: the JSDoc describes the wire contract, the `ClassNotFoundError` → `null` mapping, the log levels, and the lack of date normalisation (matching the `getAssignment_` precedent at `assignmentAssessment.js` lines 69–108).

### Implementation notes / deviations / follow-up

- **Implementation notes**: the handler is small (~40 lines including the validation helpers). The `module.exports` block is one line.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: section 5 (frontend service) will call this handler via `callApi('getABClass', { classId })`. The handler is fully self-contained.

---

## Section 5 — Frontend service module and Zod schema (`classDetail/` subfolder)

### Objective

Create `src/frontend/src/services/googleClassrooms/classDetail/` subfolder (per frontend AGENTS §12) with `classDetailService.ts`, `classDetailService.zod.ts`, `classDetailService.zod.spec.ts`, and `classDetailService.spec.ts`. The service exposes `getABClass({ classId })` that calls `callApi('getABClass', params)` and validates the response through the Zod schema. The Zod schema is the source of truth for the response shape and the TypeScript type is derived via `z.infer<typeof ...>`.

### Constraints

- Zod is the validation framework (per frontend AGENTS §8). Schema first, type derived.
- The response schema uses `.nullable()` on the outer schema (per frontend AGENTS §8: void / null-result schemas must accept `null` because the backend `_success()` coerces `undefined → null`).
- The `AssignmentPartial` schema matches `Assignment.toPartialJSON()` output exactly (lines 116–134 of `src/backend/AssignmentProcessor/Assignment.js`).
- The `TeacherSummary` schema is **redefined inline** in `classDetailService.zod.ts` with the same shape as the existing `classPartials.zod.ts` `TeacherSummarySchema` (`userId`, `email`, `teacherName`, all nullable) — not imported from the pre-existing `classPartials*` files (which violate frontend AGENTS §12 and are flagged as a follow-up reorganisation; importing from them would couple the new service to a file that will move).
- All service exports follow the existing `classPartialsService.ts` pattern (typed async function returning `Promise<ClassFull | null>`).

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/frontend/AGENTS.md` (§4.1 required API transport pattern, §4.3 prohibited types, §8 Zod validation, §12 service domain folder organisation)
- `src/frontend/src/services/googleClassrooms/classPartialsService.ts` (the closest service analog — typed async function, `callApi(methodName, params)`, Zod response parsing)
- `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` (the closest Zod schema analog — `TeacherSummarySchema` shape, `ClassPartialsResponseSchema = z.array(ClassPartialSchema)` pattern, tri-state `active` handling)
- `src/frontend/src/services/apiService.ts` (the `callApi` choke point — date normalisation, envelope parsing)
- `src/backend/AssignmentProcessor/Assignment.js` lines 116–134 (the canonical `Assignment.toPartialJSON()` shape that `AssignmentPartial` must mirror)
- `src/backend/Models/StudentSubmission.js` lines 121–126 (the canonical `StudentSubmissionItem.toPartialJSON()` shape with redactions)
- `src/backend/Models/Artifacts/0_BaseTaskArtifact.js` lines 142–147 (the canonical `BaseTaskArtifact.toPartialJSON()` redaction of `content` and `contentHash`)
- `src/backend/Models/AssignmentDefinition.js` lines 320–338 (the canonical `AssignmentDefinition.toPartialJSON()` shape with `tasks: null`)
- `SPEC.md` §"Recommended data shapes" (the documented `ClassFull` and `AssignmentPartial` shapes)

Testing Specialist mandatory docs:

- Same as Implementation, plus `src/frontend/src/services/googleClassrooms/classPartialsService.spec.ts` (the closest service-spec analog)
- `src/frontend/src/services/googleClassrooms/classPartials.zod.spec.ts` (the closest Zod-spec analog)

Code Reviewer mandatory docs:

- Same as Implementation, plus `src/frontend/src/test/testDeferredPromise.ts` (for the deferred-promise pattern if used) and any relevant shared test helpers

Other delegated agents (if used) mandatory docs:

- None for this section (no Docs, no Playwright)

### Shared helper plan

No new shared helpers. The Zod schema is co-located with the service (frontend AGENTS §8: "store validation schemas in a dedicated adjacent schema file"). The `TeacherSummary` primitive is reused (already in `classPartials.zod.ts`) — but the new schema can redefine the shape inline to avoid cross-folder coupling (the existing `classPartials*` files violate frontend AGENTS §12 and are flagged as a follow-up).

### Acceptance criteria

- `src/frontend/src/services/googleClassrooms/classDetail/` directory exists.
- `classDetailService.ts` exports a `getABClass({ classId }: { classId: string }): Promise<ClassFull | null>` function that calls `callApi('getABClass', { classId })` and parses the response through `ClassFullResponseSchema`.
- `classDetailService.zod.ts` defines `TeacherSummarySchema`, `AssignmentPartialSchema`, `StudentSummarySchema`, `ClassFullSchema`, and `ClassFullResponseSchema = ClassFullSchema.nullable()`.
- The Zod schema's `AssignmentPartial` shape matches `Assignment.toPartialJSON()` exactly (verified by comparing to the documented shape in `SPEC.md`).
- `classDetailService.zod.spec.ts` tests the Zod schema in isolation (happy path, missing required field, wrong type, null-result shape accepts `null`).
- `classDetailService.spec.ts` tests the service (delegates to `callApi` with the correct method name and params; parses through `ClassFullResponseSchema`; returns `null` on null response; propagates Zod parse errors).

### Required test cases (Red first)

Frontend Zod schema tests (new — `classDetailService.zod.spec.ts`):

1. **RED**: `ClassFullSchema.parse(...)` is not defined. Test fails.
2. **GREEN**: `ClassFullSchema` parses a representative full response. Test passes.
3. `ClassFullSchema` rejects a response missing `classId` (required field). Test passes.
4. `ClassFullSchema` rejects a response where `classOwner` has a wrong type (e.g. string instead of object). Test passes.
5. `ClassFullResponseSchema` accepts `null` (the null-result contract). Test passes.
6. `ClassFullResponseSchema` rejects undefined. Test passes.
7. `AssignmentPartialSchema` parses a representative partial assignment shape with `createdAt` (ISO string), `documentType`, `submissions[]` (with redacted artifacts and stripped assessment reasoning), and `assignmentDefinition` (with `tasks: null`). Test passes.

Frontend service tests (new — `classDetailService.spec.ts`):

8. `getABClass` delegates to `callApi` with the `getABClass` method name and the supplied `{ classId }`. Test passes.
9. `getABClass` parses the response through `ClassFullResponseSchema` and returns a typed `ClassFull`. Test passes.
10. `getABClass` returns `null` when the backend returns `data: null`. Test passes.
11. `getABClass` propagates Zod parse errors loudly (does not catch and rethrow as a silent error). Test passes.

### Section checks

- `npm run lint:frontend` passes.
- `npm run frontend:test -- src/frontend/src/services/googleClassrooms/classDetail/` passes.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- `getABClass` JSDoc describes the return contract (`Promise<ClassFull | null>`), the `null` meaning (class not found), and the Zod schema validation.

### Implementation notes / deviations / follow-up

- **Implementation notes**: the Zod schema is the largest piece of this section. The service file is small (~10 lines).
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: section 6 (query factory) imports `getABClass` from this file. The frontend app is now ready to call the new endpoint; a future class-detail page will use `getABClassQueryOptions(classId)` to fetch the data.

---

## Section 6 — Frontend query factory (`queryKeys.abClass` + `getABClassQueryOptions`)

### Objective

Add `queryKeys.abClass(classId)` in `src/frontend/src/query/queryKeys.ts` and `getABClassQueryOptions(classId)` in `src/frontend/src/query/sharedQueries.ts`. The factory follows the existing `queryOptions` + `queryKeys` pattern (frontend AGENTS §2.2). The new query is **not** added to the `startupWarmup` set (the new query is per-class, not a global list).

### Constraints

- `queryKeys.abClass: (classId: string) => ['abClass', classId]` — same shape as `queryKeys.assignmentDefinitionByKey(definitionKey) → ['assignmentDefinition', definitionKey]`.
- `getABClassQueryOptions(classId)` returns `queryOptions({ queryKey: queryKeys.abClass(classId), queryFn: () => getABClass({ classId }) })`.
- The new query is **not** added to `startupWarmupQueryDefinitions` (per `SPEC.md` Open question #3, decided).
- Tests follow the existing `src/frontend/src/query/sharedQueries.query.spec.tsx` patterns.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/frontend/AGENTS.md` (§2.2 hook/query factory pattern)
- `src/frontend/src/query/queryKeys.ts` (the existing factory pattern)
- `src/frontend/src/query/sharedQueries.ts` (the existing factory pattern, lines 96–101 for `getAssignmentDefinitionQueryOptions`)
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` (the `getABClass` import, from section 5)

Testing Specialist mandatory docs:

- Same as Implementation, plus `src/frontend/src/query/sharedQueries.query.spec.tsx` (the existing test pattern for query factories)

Code Reviewer mandatory docs:

- Same as Implementation

### Shared helper plan

No new shared helpers. The factory follows the existing pattern.

### Acceptance criteria

- `queryKeys.ts` exports an `abClass: (classId: string) => ['abClass', classId]` factory.
- `sharedQueries.ts` exports a `getABClassQueryOptions(classId: string)` function that returns `queryOptions({ ... })`.
- The new query is **not** added to `startupWarmupQueryDefinitions`.
- Existing `queryOptions` / `queryKeys` invalidation patterns work with the new query (`invalidateQueries({ queryKey: queryKeys.abClass(classId) })`).

### Required test cases (Red first)

Frontend query tests (extended — `src/frontend/src/query/sharedQueries.query.spec.tsx`):

1. **RED**: `queryKeys.abClass` is not defined. Test fails.
2. **GREEN**: `queryKeys.abClass('class-001')` returns `['abClass', 'class-001']`. Test passes.
3. **RED**: `getABClassQueryOptions` is not defined. Test fails.
4. **GREEN**: `getABClassQueryOptions('class-001')` returns an object with `queryKey: ['abClass', 'class-001']` and a `queryFn` that calls `getABClass({ classId: 'class-001' })`. Test passes.
5. The `queryFn` is awaitable and propagates errors from `getABClass` (e.g. Zod parse errors). Test passes.

### Section checks

- `npm run lint:frontend` passes.
- `npm run frontend:test -- src/frontend/src/query/sharedQueries.query.spec.tsx` passes.
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- `getABClassQueryOptions` JSDoc describes the query key, the per-class lazy-load policy, and the invalidation pattern.

### Implementation notes / deviations / follow-up

- **Implementation notes**: the factory is small (~5 lines). The test file extension is ~10 lines.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: none — the query factory is the final frontend deliverable for this round.

---

## Section 7 — `ClassNotFoundError` JSDoc + `api-layer.md` + `DATA_SHAPES.md` documentation

### Objective

Update `src/backend/Utils/ErrorTypes/ClassNotFoundError.js` JSDoc to clarify the dispatcher-mapping contract. Add the new `getABClass` entry to `docs/developer/backend/api-layer.md` "Current migrated endpoints" section. Add the new "ABClass full-read (`getABClass` response)" section to `docs/developer/backend/DATA_SHAPES.md`.

### Constraints

- The `ClassNotFoundError` JSDoc must explain that the `apiHandler` dispatcher has **no** special mapping for this error — unmapped errors fall through to `INTERNAL_ERROR` — and that endpoints wanting the `null`-on-not-found contract must catch the typed error explicitly.
- The `api-layer.md` entry for `getABClass` must be placed **immediately after** the existing `getABClassPartials` entry (avoiding the ambiguous "after X and before Y" wording).
- The `DATA_SHAPES.md` section must document the response shape with the same depth as the existing class-partial section, and must reference `Assignment.toPartialJSON()` as the canonical source for the partial shape.
- No hardcoded line numbers in any documentation entry (entries should reference each other by name).

### Delegation mandatory reads (when sub-agents are used)

Docs agent mandatory docs:

- `docs/developer/backend/api-layer.md` (the existing endpoint entries — for format reference; the `getABClassPartials` entry at line 309–315, the `getAssignment` entry at line 363–370 for the closest analog)
- `docs/developer/backend/DATA_SHAPES.md` (the existing "ABClassPartials" section near line 173; the "AssignmentDefinition full-read" section for the closest analog)
- `docs/howTos/rehydration.md` (for the redaction contract)
- `src/backend/Utils/ErrorTypes/ClassNotFoundError.js` (the current JSDoc to be replaced)
- `SPEC.md` §"Documentation and rollout notes" (the precise update guidance)

Code Reviewer mandatory docs:

- Same as Docs, plus `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js` (for the typed-error pattern to mirror in the `ClassNotFoundError` JSDoc)

Other delegated agents (if used) mandatory docs:

- None for this section

### Shared helper plan

No new shared helpers. This is a documentation update.

### Acceptance criteria

- `ClassNotFoundError.js` JSDoc is updated per the spec's `§Documentation and rollout notes`. The existing sentence _"This error maps to `INTERNAL_ERROR` at the transport boundary (via the dispatcher's fallback path) since `loadClass` is not directly callable from the frontend"_ is **removed** (not just left in place) and replaced with the clearer wording: the `apiHandler` dispatcher has **no** special mapping for `ClassNotFoundError` — unmapped errors fall through to `INTERNAL_ERROR` — and the new `getABClass` handler catches the typed error explicitly and returns `null`; any future endpoint wanting the same `null` contract must do the same.
- `api-layer.md` has a new bullet for `getABClass` immediately after the `getABClassPartials` entry. The entry mirrors the `getABClassPartials` format and includes the explicit note that the response shape is produced by the controller's private `_toReadView` method.
- `DATA_SHAPES.md` has a new "ABClass full-read (`getABClass` response)" section after the "ABClassPartials" section. The section documents the response shape and references `Assignment.toPartialJSON()` as the canonical source.
- No hardcoded line numbers in any of the new doc entries.

### Required test cases (Red first)

Backend tests (verification):

1. `tests/utils/ClassNotFoundError.test.js` (if not already present, may be added) verifies the JSDoc presence and the constructor signature. (If the test file is not in scope, skip — the JSDoc update is documentation-only and doesn't have functional tests.)

Documentation review (verification by `Docs` agent):

2. The new `api-layer.md` entry matches the format of `getABClassPartials` entry (same bullet structure, same level of detail).
3. The new `DATA_SHAPES.md` section matches the depth of the existing class-partial section.

### Section checks

- `npm run lint:backend` passes (no code changes in this section; documentation only).
- `npm run lint:frontend` passes (no frontend changes in this section).
- `npm run docs:build` (or equivalent mkdocs build) passes if configured (verify the new content renders).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- `ClassNotFoundError.js` JSDoc is the primary deliverable; no other JSDoc updates in this section.

### Implementation notes / deviations / follow-up

- **Implementation notes**: this section is documentation-only. No code changes.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: the documentation is the final deliverable for this round. The next round (e.g. the class-detail page) will consume the new endpoint, the new query factory, and the new shared validation file.

---

# Part 2 — `ABClassController` Decomposition (governed by `ABClassControllerRefactor_SPEC.md` v1.0)

The remaining sections implement the `ABClassController` decomposition
into a folder of 5 sub-classes per `ABClassControllerRefactor_SPEC.md`
v1.0. The sections preserve every existing public method on the
controller, every existing private method (re-exposed on the facade
via one-line delegation), and every existing test (no test rewrites
are required — the public API is preserved and the test files use the
same `require` paths).

Section ordering is TDD-first: red sub-class tests, green sub-class
implementations, then facade creation, then `tests/setupGlobals.js`
wiring, then monolithic file removal, then documentation, then full
regression.

---

## Section 8 — Sub-class unit tests (RED) + sub-class file creation (GREEN)

### Objective

Add 5 new unit-test files (one per sub-class) that test the new
sub-classes in isolation. Create the 5 new sub-class files in the new
folder, with each method body moved verbatim from the existing
monolithic `ABClassController.js` to its target sub-class. The
monolithic file is **not** modified in this section — it stays in
place and continues to work; the new sub-classes exist alongside it.
This section is a "lift-and-shift" of method bodies to new files; no
behaviour changes are made yet.

### Constraints

- Method bodies are moved verbatim — no refactoring, no behaviour
  changes, no signature changes. The JSDoc is preserved.
- Sub-class constructors accept their dependencies via a single
  options object parameter (per `ABClassControllerRefactor_SPEC.md`
  Decision 4 and the `AssignmentDefinitionController/` precedent).
- Sub-class files end with the guarded
  `if (typeof module !== 'undefined' && module.exports)` block so
  they can be imported individually in tests.
- The new folder
  `src/backend/y_controllers/ABClassController/` is created with
  the 5 sub-class files (no `index.js` facade yet — that's Section
  9).
- The monolithic `src/backend/y_controllers/ABClassController.js`
  is **not** modified and **not** removed in this section.

### Method-to-sub-class assignment (per `ABClassControllerRefactor_SPEC.md` Decision 2)

| Sub-class                  | Methods                                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ABClassValidation.js`     | `_validateClassId`, `_validateDeleteClassId`, `_isMissingCollectionError`, `_validateCourseLength`, `_buildUpdatePatch`, `_applyPatchToClass`                                                                           |
| `ABClassRoster.js`         | `_applyCourseMetadata`, `_applyTeachers`, `_applyStudents`, `_buildClassroomRosterUpdatePayload`, `_refreshRoster`, `_persistRoster`, `initialise` (public)                                                             |
| `ABClassAssignmentOps.js`  | `_loadFullAssignmentDocument`, `_validateAssignmentDocument`, `_ensureFullDefinition`, `_replaceAssignmentInClass`, `_getFullAssignmentCollectionName`, `persistAssignmentRun` (public), `rehydrateAssignment` (public) |
| `ABClassPersistence.js`    | `_persistClassAndPartial`, `_upsertClassPartial` (note: the existing dead-code `_getCollectionMetadata` is **not ported** per `ABClassControllerRefactor_SPEC.md` Decision 2 dead-code note)                            |
| `ABClassResponseMapper.js` | `_normaliseClassPartial`, `_buildClassSummary`, `_toReadView` (the last is the new private method added by Section 3)                                                                                                   |

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§10 large file decomposition, §1.1 Node test compatibility boundary, §1.2 concatenation and load-order model, §3 logging, §7 default values rule)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js` (the canonical sub-class pattern)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionPersistence.js` (the canonical persistence sub-class pattern, with `dbManager` and `validation` options)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionResponseMapper.js` (the canonical response-mapper sub-class pattern)
- `src/backend/y_controllers/ABClassController.js` (the source file for the moved method bodies)
- `ABClassControllerRefactor_SPEC.md` (the full Decision 2 method-to-sub-class table)

Testing Specialist mandatory docs:

- `tests/controllers/assignmentDefinitionController.upsert.test.js` (the existing sub-class-in-isolation test pattern from the `AssignmentDefinition/` precedent)
- `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js` (the constructor options-object pattern that the new tests should target)

Code Reviewer mandatory docs:

- Same as Implementation, plus `src/backend/y_controllers/AssignmentDefinition/index.js` (the canonical facade wiring pattern for context)

Other delegated agents (if used) mandatory docs:

- None for this section (no Docs, no Playwright)

### Shared helper plan

No new shared helpers. The sub-classes are pure collaborators with
no cross-sub-class logic beyond what `ABClassControllerRefactor_SPEC.md`
Decision 4 documents (roster calls persistence.\_upsertClassPartial;
assignmentOps calls persistence.persistClassAndPartial).

### Acceptance criteria

- 5 new files exist in
  `src/backend/y_controllers/ABClassController/`:
  - `ABClassValidation.js`
  - `ABClassRoster.js`
  - `ABClassAssignmentOps.js`
  - `ABClassPersistence.js`
  - `ABClassResponseMapper.js`
- Each sub-class file defines its class as a global
  (e.g. `class ABClassValidation { ... }`) — the class name
  matches the filename minus the extension, matching the
  `AssignmentDefinition*` precedent.
- Each sub-class file ends with the guarded
  `if (typeof module !== 'undefined' && module.exports) {
module.exports = <ClassName>; }` block.
- Each sub-class constructor accepts a single options object
  parameter and destructures the required dependencies
  (e.g. `constructor({ dbManager, validation } = {})`).
- The 5 sub-class files contain the moved method bodies from
  the monolithic `ABClassController.js` (verbatim — no
  refactoring, no signature changes).
- The `_getCollectionMetadata` dead code is **not** ported
  (per `ABClassControllerRefactor_SPEC.md` Decision 2).
- The monolithic `src/backend/y_controllers/ABClassController.js`
  is **unchanged** (still in place, still working).
- 5 new unit-test files exist in
  `tests/controllers/ABClassController/`:
  - `ABClassValidation.unit.test.js`
  - `ABClassRoster.unit.test.js`
  - `ABClassAssignmentOps.unit.test.js`
  - `ABClassPersistence.unit.test.js`
  - `ABClassResponseMapper.unit.test.js`
- The new unit tests test each sub-class in isolation against
  the constructor options-object pattern.
- All 5 new unit-test files pass.
- The pre-existing `ABClassController` test suite (all 14
  tests referenced in `ABClassControllerRefactor_SPEC.md`
  §"Testing expectations") still passes unchanged (the
  monolithic file is untouched, so this is automatic).

### Required test cases (Red first)

For each of the 5 sub-classes, the new unit-test file follows
this pattern:

Backend sub-class unit tests (new — 5 files):

1. `tests/controllers/ABClassController/ABClassValidation.unit.test.js`
   (new file) covers:
   - Constructor accepts `{ dbManager, validation } = {}` (or
     `{}` only — no required deps for the validation sub-class).
   - `requireNonEmptyString(value, fieldName)` returns trimmed
     value when valid, throws `TypeError` when invalid.
   - `requireTrimmedString(value, fieldName)` returns trimmed
     value when valid, throws `TypeError` when invalid.
   - `requireIntegerGte(value, minValue, fieldName)` returns
     the integer when valid, throws `TypeError` when invalid.
   - `isMissingCollectionError(error)` returns `true` for
     `error.code === 'COLLECTION_NOT_FOUND'`, `false`
     otherwise.
   - `buildUpdatePatch(parameters)` builds a patch with only
     provided fields (preserves the `Object.hasOwn` semantics
     of the monolithic implementation).
   - `applyPatchToClass(abClass, patch)` applies the patch
     fields to the `ABClass` instance.

2. `tests/controllers/ABClassController/ABClassRoster.unit.test.js`
   (new file) covers:
   - Constructor accepts `{ dbManager, validation, persistence }`.
   - `applyCourseMetadata(abClass, courseId)` calls
     `ClassroomApiClient.fetchCourse` and applies the result to
     the `ABClass` instance.
   - `applyTeachers(abClass, courseId)` calls
     `ClassroomApiClient.fetchTeachers` and populates teachers
     and classOwner.
   - `applyStudents(abClass, classId)` calls
     `ClassroomApiClient.fetchAllStudents` and populates
     students.
   - `refreshRoster(abClass, classId)` clears owner/teachers/students
     and calls the three `apply*` methods.
   - `persistRoster(collection, existingDocument, abClass)`
     calls `this._persistence._upsertClassPartial(abClass)`
     after the write succeeds (verify the cross-sub-class
     call site is wired correctly).
   - `initialise(classId, options)` returns a new
     `ABClass` instance with the cohortKey, yearGroupKey,
     courseLength, and assignments applied, then populates
     the roster.

3. `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js`
   (new file) covers:
   - Constructor accepts `{ dbManager, validation, persistence }`.
   - `getFullAssignmentCollectionName(courseId, assignmentId)`
     returns `assign_full_<courseId>_<assignmentId>`.
   - `persistAssignmentRun(abClass, assignment)` writes the full
     assignment to the dedicated collection, generates a partial
     summary, and replaces the assignment in the `ABClass`
     instance; calls `this._persistence.persistClassAndPartial(abClass)`
     at the end (verify the cross-sub-class call site).
   - `rehydrateAssignment(abClass, assignmentId)` loads the
     full document, validates it, ensures the definition is
     full, replaces the assignment in the class, and returns
     the hydrated instance.
   - `loadFullAssignmentDocument(courseId, assignmentId)` throws
     `AssignmentNotFoundError` when the document is not found.
   - `validateAssignmentDocument(document)` throws on missing
     required fields.
   - `ensureFullDefinition(assignment)` throws when the
     authoritative definition is partial.
   - `replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment)`
     throws when the assignment is not in the class.

4. `tests/controllers/ABClassController/ABClassPersistence.unit.test.js`
   (new file) covers:
   - Constructor accepts `{ dbManager, validation }`.
   - `persistClassAndPartial(abClass)` writes the full class
     document to its collection (insertOne or replaceOne)
     and then calls `upsertClassPartial`.
   - `upsertClassPartial(abClass)` writes the partial
     document to the `abclass_partials` collection
     (insertOne or replaceOne) and calls `partialsCollection.save()`.

5. `tests/controllers/ABClassController/ABClassResponseMapper.unit.test.js`
   (new file) covers:
   - Constructor accepts `{}` (no required deps for the response
     mapper).
   - `normaliseClassPartial(partialDocument)` returns the
     normalised class partial payload (preserves the
     `Object.hasOwn` semantics of the monolithic implementation).
   - `buildClassSummary(abClass)` returns
     `normaliseClassPartial(abClass.toPartialJSON())`.
   - **Note**: `toReadView` is **not** covered by isolated
     sub-class unit tests per `ABClassControllerRefactor_SPEC.md`
     §"Testing expectations" — the existing
     `tests/controllers/abclassController.readClass.test.js`
     from Section 3 covers the transformation through the
     public `readClass` method on the facade. The
     `ABClassResponseMapper._toReadView` method is still
     implemented (as part of the method-body lift from the
     monolithic file) but not directly tested in this
     section.

### Section checks

- `npm run lint:backend` passes.
- `npm test -- tests/controllers/ABClassController/ABClassValidation.unit.test.js` passes.
- `npm test -- tests/controllers/ABClassController/ABClassRoster.unit.test.js` passes.
- `npm test -- tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js` passes.
- `npm test -- tests/controllers/ABClassController/ABClassPersistence.unit.test.js` passes.
- `npm test -- tests/controllers/ABClassController/ABClassResponseMapper.unit.test.js` passes.
- `npm test -- tests/controllers/abclass-loadClass.test.js` passes (regression — the monolithic file is unchanged).
- `npm test -- tests/controllers/abclass-upsert-update.test.js` passes (regression).
- `npm test -- tests/controllers/abclassController.persistAssignment.test.js` passes (regression).
- `npm test -- tests/controllers/abclassController.rehydrateAssignment.test.js` passes (regression).
- `npm test -- tests/api/abclassMutations.test.js` passes (regression).
- `npm test -- tests/api/apiHandler/` passes (regression).
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Each new sub-class file gets a top-of-file JSDoc that mirrors
  the `AssignmentDefinition*` precedent (one-line class
  description + ownership statement).
- Each moved method preserves its existing JSDoc verbatim —
  no `@remarks` updates in this section.
- The `_toReadView` JSDoc is preserved verbatim from Section 3
  (it was added in the monolithic file in Section 3 and is
  lifted to `ABClassResponseMapper` in this section).

### Implementation notes / deviations / follow-up

- **Implementation notes**: this is a "lift-and-shift" — method
  bodies are moved from the monolithic file to the new sub-class
  files, but the monolithic file is **not** modified in this
  section. The new sub-class files are not yet wired into
  `tests/setupGlobals.js` (that's Section 10) and the new
  facade is not yet created (that's Section 9). The new
  sub-class unit tests are isolated (they directly `require`
  the new sub-class files).
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: Section 9
  creates the facade and wires the sub-classes; Section 10
  adds the new sub-classes to `tests/setupGlobals.js`;
  Section 11 removes the monolithic file. The unit tests
  in this section are the contract for the new sub-classes
  — they must continue to pass after Section 11 removes
  the monolithic file.

---

## Section 9 — Create the facade `index.js` with full delegation

### Objective

Create the new `src/backend/y_controllers/ABClassController/index.js`
facade file. The facade wires the 5 sub-class instances in its
constructor (per `ABClassControllerRefactor_SPEC.md` Decision 4) and
exposes the full public + private API of the existing monolithic
`ABClassController` via one-line delegation. The facade ends with
`module.exports = ABClassController;` (the same `module.exports`
shape the monolithic file uses) so every existing
`require('../../src/backend/y_controllers/ABClassController.js')`
and every `new ABClassController()` call continues to work.

In this section, the facade is created **alongside** the existing
monolithic file. The monolithic file is **not** removed in this
section (that's Section 11). To prevent Node module-resolution
conflicts (two files both exporting `ABClassController`), the
monolithic file is renamed or its `module.exports` line is
temporarily commented out — see implementation notes below for
the chosen approach.

### Constraints

- The facade exposes every public method on the existing
  `ABClassController` class with the same name, signature, and
  semantics. See `ABClassControllerRefactor_SPEC.md` Decision 3
  for the complete delegation table.
- The facade exposes every private leading-underscore method as
  a one-line delegator to the appropriate sub-class instance.
  See `ABClassControllerRefactor_SPEC.md` Decision 3 for the
  complete delegation table.
- The new `readClass` and `_toReadView` methods land in the
  facade as a public method and a private delegator,
  respectively (the method bodies were added to the monolithic
  file in Section 3 and are lifted to the sub-classes in
  Section 8).
- The facade constructor wires the sub-class instances in the
  order specified by `ABClassControllerRefactor_SPEC.md`
  Decision 4: `validation` → `persistence` → `roster` →
  `assignmentOps` → `responseMapper`. `persistence` is
  constructed before `roster` and `assignmentOps` so the
  facade can pass `this._persistence` to both.
- The facade ends with
  `if (typeof module !== 'undefined' && module.exports) {
module.exports = ABClassController; }` — the same
  `module.exports` shape the monolithic file uses. This is
  the safety net that keeps every existing test passing
  without modification.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§10, §1.1, §1.2)
- `src/backend/y_controllers/AssignmentDefinition/index.js` (the canonical facade)
- `ABClassControllerRefactor_SPEC.md` (the full Decision 3 delegation table; the Decision 4 constructor wiring)
- `src/backend/y_controllers/ABClassController.js` (the source of the public-method bodies that are moved to the facade)
- `src/backend/y_controllers/ABClassController/ABClassValidation.js` and the other 4 sub-class files (created in Section 8; the facade delegates to them)

Testing Specialist mandatory docs:

- `tests/controllers/abclassController.persistAssignment.test.js` (tests that exercise private methods on the controller — the facade must re-expose every private method)
- `tests/controllers/abclassController.rehydrateAssignment.test.js` (same)

Code Reviewer mandatory docs:

- Same as Implementation, plus `docs/developer/backend/api-layer.md` (the documentation references to `ABClassController.js` — the facade preserves the class name so these references stay accurate)

Other delegated agents (if used) mandatory docs:

- None for this section

### Shared helper plan

No new shared helpers. The facade is a pure delegation layer.

### Acceptance criteria

- `src/backend/y_controllers/ABClassController/index.js` exists.
- The facade defines the `ABClassController` class as a global
  (`class ABClassController { ... }`).
- The facade constructor wires the 5 sub-class instances in the
  order specified by `ABClassControllerRefactor_SPEC.md`
  Decision 4.
- The facade exposes all 8 public methods (`upsertABClass`,
  `updateABClass`, `deleteABClass`, `loadClass`, `readClass`,
  `saveClass`, `getAllClassPartials`, `initialise`) and all
  23+ private methods (the complete list is in
  `ABClassControllerRefactor_SPEC.md` Decision 3) as one-line
  delegators.
- The facade ends with the
  `if (typeof module !== 'undefined' && module.exports) {
module.exports = ABClassController; }` block.
- **Node module-resolution conflict resolution**: the monolithic
  `src/backend/y_controllers/ABClassController.js` and the new
  `src/backend/y_controllers/ABClassController/index.js` would
  both resolve to the same `require(...)` path. To avoid this
  conflict, the implementation in this section:
  1. **Option A (recommended)**: rename the monolithic file
     to `src/backend/y_controllers/ABClassController.legacy.js`
     and add a temporary re-export shim at the old path
     (`module.exports = require('./ABClassController/index.js').ABClassController;`)
     so the existing tests continue to work.
  2. **Option B**: temporarily move the monolithic file to
     `src/backend/y_controllers/ABClassController.monolith.js.bak`
     and create a temporary re-export shim at the old path.
  3. **Option C**: skip the shim and update all test files
     to use the new path. **This is rejected** because it
     would force a test-file edit in Section 9, violating the
     refactor's "no test rewrites" promise.
     The implementation must use Option A or B (Section 11
     removes the shim and the monolithic file together).
- The existing test suite continues to pass with the shim in
  place. The shim makes `require('../../src/backend/y_controllers/ABClassController.js')`
  resolve to the new facade.

### Required test cases (Red first)

No new tests in this section. The facade creation is a
"GREEN" step for the existing test suite — the existing
tests are the regression net. The test cases that verify
the facade are the existing tests (they continue to pass
unchanged).

Backend controller tests (regression — must pass unchanged):

1. `tests/controllers/abclass-loadClass.test.js` passes
   (the `ABClassController` class still resolves and the
   `loadClass` method is exposed via facade delegation).
2. `tests/controllers/abclass-upsert-update.test.js`
   passes (`upsertABClass`, `updateABClass`,
   `_validateClassId`, `_buildUpdatePatch`,
   `_applyPatchToClass`, etc., all accessible via the
   facade).
3. `tests/controllers/abclass-delete.test.js` passes
   (`deleteABClass`, `_validateDeleteClassId`).
4. `tests/controllers/abclassController.persistAssignment.test.js`
   passes (`persistAssignmentRun`,
   `_getFullAssignmentCollectionName`).
5. `tests/controllers/abclassController.rehydrateAssignment.test.js`
   passes (`rehydrateAssignment`).
6. `tests/controllers/abclass-roster-sync.test.js` passes.
7. `tests/controllers/abclass-partials-read.test.js` passes.
8. `tests/controllers/abclass-controller-partials.test.js` passes
   (`saveClass`).
9. `tests/models/abclassManager.initialise.test.js` passes
   (`initialise`).
10. `tests/models/abclassManager.loadClass.test.js` passes.
11. `tests/models/abclassManager.saveClass.test.js` passes.
12. `tests/api/abclassMutations.test.js` passes.
13. `tests/backend-api/abclassMutations.unit.test.js` passes.
14. `tests/api/apiHandler/` tests pass
    (`z_apiHandler.js` still uses `new ABClassController()`).
15. `tests/controllers/assignmentController.startAssessmentRun.test.js`
    and `tests/controllers/assignmentController.hydration.test.js`
    pass (`AssignmentController` still uses
    `new ABClassController()`).

### Section checks

- `npm run lint:backend` passes.
- All 15+ regression test suites listed above pass unchanged
  (the facade preserves the public API).
- Mandatory-read evidence gate passed for all delegated
  handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- The facade gets a top-of-file JSDoc that mirrors the
  `AssignmentDefinition/index.js` precedent.
- The public methods on the facade preserve their JSDoc
  verbatim (the JSDoc is on the facade, not the sub-class,
  because the facade is the public API).
- The private delegator methods on the facade do not need
  JSDoc (they are one-line delegators; the JSDoc lives on
  the sub-class method).

### Implementation notes / deviations / follow-up

- **Implementation notes**: this section uses Option A
  (rename the monolithic file to `.legacy.js` and add a
  re-export shim at the old path). The shim is a
  one-liner. The shim and the legacy file are removed in
  Section 11.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: Section 10
  wires the new sub-classes into `tests/setupGlobals.js`
  (required for the sub-class unit tests to work in the
  full test suite, though they pass in isolation in this
  section); Section 11 removes the legacy file and the
  shim.

---

## Section 10 — Wire `tests/setupGlobals.js` to load the new sub-classes

### Objective

Update `tests/setupGlobals.js` to load the 5 new sub-classes as
globals in the right order (per `ABClassControllerRefactor_SPEC.md`
Decision 6): `ABClassValidation` → `ABClassPersistence` →
`ABClassRoster` → `ABClassAssignmentOps` → `ABClassResponseMapper`.
The facade itself is not loaded as a global (it is loaded by callers
via `require(...)` which resolves to the new `index.js` via Node's
folder-based resolution).

### Constraints

- The new `g.ABClassValidation = require(...)`, etc., lines
  must follow the `AssignmentDefinition*` pattern at lines
  202-208 of the current `tests/setupGlobals.js`.
- The load order must be: `ABClassValidation` →
  `ABClassPersistence` → `ABClassRoster` →
  `ABClassAssignmentOps` → `ABClassResponseMapper`. The
  `Persistence` sub-class must load before `Roster` and
  `AssignmentOps` so the facade can pass `this._persistence`
  to both.
- No new global is required for the facade itself.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `tests/setupGlobals.js` lines 202-208 (the canonical `g.AssignmentDefinition* = require(...)` pattern)
- `src/backend/AGENTS.md` §1.2 (concatenation and load-order model)

Testing Specialist mandatory docs:

- Same as Implementation, plus the 5 new sub-class unit-test
  files from Section 8 (they will be exercised by the full
  test suite after this section adds the wiring).

Code Reviewer mandatory docs:

- Same as Implementation

Other delegated agents (if used) mandatory docs:

- None for this section

### Shared helper plan

No new shared helpers.

### Acceptance criteria

- `tests/setupGlobals.js` contains 5 new lines (in this order):
  ```js
  g.ABClassValidation = require('../src/backend/y_controllers/ABClassController/ABClassValidation.js');
  g.ABClassPersistence = require('../src/backend/y_controllers/ABClassController/ABClassPersistence.js');
  g.ABClassRoster = require('../src/backend/y_controllers/ABClassController/ABClassRoster.js');
  g.ABClassAssignmentOps = require('../src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js');
  g.ABClassResponseMapper = require('../src/backend/y_controllers/ABClassController/ABClassResponseMapper.js');
  ```
- The lines are placed after the existing `g.AssignmentDefinition*`
  lines (lines 202-208) to keep the global load order
  consistent (sub-classes from the same decomposition-style
  folder are grouped together).
- The full backend test suite passes (the new sub-class
  unit tests from Section 8 now run in the full test
  suite, and the existing tests still pass).
- The full backend lint passes.

### Required test cases (Red first)

No new tests in this section. The wiring is a configuration
change; the existing tests (both the new sub-class tests
from Section 8 and the existing controller tests) are the
regression net.

Backend tests (regression — must pass):

1. The 5 new sub-class unit-test files from Section 8 pass
   in the full test suite (`npm test`).
2. The 15+ existing controller test suites from Section 9
   pass in the full test suite.
3. The full backend lint passes.

### Section checks

- `npm run lint:backend` passes.
- `npm test` passes (full backend test suite, including the
  new sub-class unit tests and the existing controller
  tests).
- Mandatory-read evidence gate passed for all delegated
  handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None for this section (configuration change only).

### Implementation notes / deviations / follow-up

- **Implementation notes**: this is a 5-line addition to
  `tests/setupGlobals.js`. The order is critical — putting
  `ABClassPersistence` after `ABClassRoster` or
  `ABClassAssignmentOps` would not cause an immediate
  failure (the load order is only relevant when the facade
  is constructed, which happens lazily on first
  `new ABClassController()` call) but would be a latent
  bug that surfaces when the facade is constructed.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: Section 11
  removes the legacy file and the shim; the regression
  check in Section 13 verifies the full test suite still
  passes after that removal.

---

## Section 11 — Remove the monolithic file and re-export shim

### Objective

Remove the renamed legacy file
(`src/backend/y_controllers/ABClassController.legacy.js` from
Section 9 Option A, or `src/backend/y_controllers/ABClassController.monolith.js.bak`
from Option B) and the re-export shim at
`src/backend/y_controllers/ABClassController.js` (Option A) or
the shim-only file (Option B). After this section, the only
remaining file with the name `ABClassController` is the new
folder. The existing test suite must continue to pass unchanged
because the new facade preserves the public API and the
`module.exports` shape.

### Constraints

- The legacy file is removed in its entirety.
- The re-export shim is removed in its entirety.
- The new folder
  `src/backend/y_controllers/ABClassController/` is the only
  file or folder with the name `ABClassController` in
  `src/backend/y_controllers/`.
- No test file is modified.
- The full backend test suite passes.
- The full backend lint passes.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/AGENTS.md` (§10, §1.1)
- `src/backend/y_controllers/AssignmentDefinition/` (the precedent for the final folder-only state)
- The state of `src/backend/y_controllers/ABClassController.*` after Sections 8-10 (legacy file, shim, and new folder all present)

Testing Specialist mandatory docs:

- Same as Implementation, plus the existing `ABClassController`
  test files (they must continue to pass against the new
  structure)

Code Reviewer mandatory docs:

- Same as Implementation, plus the `assignmentController*` test
  files (they use `new ABClassController()` and must continue
  to work)

Other delegated agents (if used) mandatory docs:

- None for this section

### Shared helper plan

No new shared helpers. This section is a deletion.

### Acceptance criteria

- `src/backend/y_controllers/ABClassController.legacy.js`
  (or `.monolith.js.bak`, depending on the Section 9 option
  chosen) does **not** exist.
- `src/backend/y_controllers/ABClassController.js` does
  **not** exist (the shim is removed; the new folder is
  the only path that resolves to the `ABClassController`
  class via Node's folder-based resolution).
- `src/backend/y_controllers/ABClassController/` folder
  contains exactly: `index.js` (facade),
  `ABClassValidation.js`, `ABClassRoster.js`,
  `ABClassAssignmentOps.js`, `ABClassPersistence.js`,
  `ABClassResponseMapper.js`.
- `eslint.config.js` relaxed-rule file list (the array at
  lines 192–212) is updated: the entry
  `'src/backend/y_controllers/ABClassController.js'` is
  replaced with `'src/backend/y_controllers/ABClassController/index.js'`.
  Without this update, the new facade file's test fixtures
  using indexed property access would fail lint.
- The full backend test suite passes.
- The full backend lint passes.

### Required test cases (Red first)

No new tests in this section. The deletion is verified by
the existing test suite continuing to pass.

Backend tests (regression — must pass):

1. All 15+ existing controller test suites from Section 9
   pass (the facade now stands alone; the legacy file and
   shim are gone).
2. The 5 new sub-class unit-test files from Section 8 pass.
3. The full backend lint passes.

### Section checks

- `npm run lint:backend` passes.
- `npm test` passes (full backend test suite).
- Mandatory-read evidence gate passed for all delegated
  handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None for this section (deletion only).

### Implementation notes / deviations / follow-up

- **Implementation notes**: this is a 2-file deletion plus a
  1-line `eslint.config.js` path update. The removal is a
  clean cut — the legacy file is no longer referenced by any
  code path, and the shim is no longer needed because the
  new folder resolves to the same
  `require(...)` path.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: Section 12
  is the documentation touch-up; Section 13 is the full
  regression check.

---

## Section 12 — Documentation touch-up

### Objective

Add the exact sentence documented in
`ABClassControllerRefactor_SPEC.md` Backend Changes step 5 to
`LARGE_CODE_FILES.md`, immediately after the existing
`y_controllers/ABClassController.js` table row (line 80). The
sentence notes that the 4-sub-file plan in that document is
superseded by the new folder-based decomposition.

No other documentation changes are required. The existing
`api-layer.md` references to
`src/backend/y_controllers/ABClassController.js` (lines 310, 364,
367, 381, 388, 398) still resolve to the same class via the new
folder (Node's folder-based resolution finds the `index.js`).

### Constraints

- The sentence is added verbatim per
  `ABClassControllerRefactor_SPEC.md` §"Documentation and rollout notes".
- No other lines in `LARGE_CODE_FILES.md` are modified.
- No other documentation files are modified.

### Delegation mandatory docs

Docs agent mandatory docs:

- `LARGE_CODE_FILES.md` (the file being updated)
- `ABClassControllerRefactor_SPEC.md` (the exact sentence to add)

Code Reviewer mandatory docs:

- Same as Docs

### Shared helper plan

None for this section.

### Acceptance criteria

- The exact sentence from
  `ABClassControllerRefactor_SPEC.md` §"Documentation and rollout notes"
  is added to `LARGE_CODE_FILES.md` immediately after line 80.
- No other changes to `LARGE_CODE_FILES.md`.
- The full backend lint passes (no code changes; this is a
  documentation-only section).

### Required test cases / checks

No new tests. The acceptance is verified by reading the
updated `LARGE_CODE_FILES.md`.

Documentation review (verification by `Docs` agent):

1. The new sentence matches the spec verbatim.
2. The new sentence is placed immediately after the
   `y_controllers/ABClassController.js` row.
3. No other changes to `LARGE_CODE_FILES.md`.

### Section checks

- `npm run lint:backend` passes (no code changes).
- Mandatory-read evidence gate passed for all delegated
  handoffs in this section.

### Optional `@remarks` JSDoc follow-through

None for this section.

### Implementation notes / deviations / follow-up

- **Implementation notes**: this is a 1-sentence addition.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: Section 13
  is the final regression check for the refactor.

---

## Section 13 — Refactor regression checks

### Objective

Run the full regression suite for the refactor: the full backend
test suite (including the 5 new sub-class unit tests, the 15+
existing controller tests, and the 6+ existing cross-controller
tests), the full backend lint, and the regression checker. Verify
that no regressions are introduced by the refactor and that all
the new sub-class unit tests pass in the full test suite.

### Constraints

- All test commands run against the final state of the
  refactor (legacy file removed, shim removed, new folder
  in place, `tests/setupGlobals.js` updated).
- The regression checker baseline is updated to reflect the
  refactor (per the `.opencode/skills/regression-checker`
  workflow).

### Acceptance criteria

- `npm test` passes (full backend test suite).
- `npm run lint:backend` passes.
- Regression checker baseline established, current run
  compared to baseline, no regressions introduced.
- The 5 new sub-class unit tests pass in the full test
  suite.
- The 15+ existing controller test suites pass in the full
  test suite.
- The 6+ existing cross-controller test suites pass in the
  full test suite.
- The 4 callers of `ABClassController` (in
  `z_apiHandler.js` line 25,
  `assignmentAssessment.js` line 125,
  `abclassMutations.js` line 7,
  `AssignmentController.js` lines 138 and 427) continue to
  work without any caller-side changes.

### Required checks

1. Run `npm test` — all tests pass.
2. Run `npm run lint:backend` — passes.
3. Run the regression checker baseline + comparison — no
   regressions introduced.
4. Verify the 5 new sub-class unit-test files are exercised
   by the full test suite.
5. Verify the 4 callers of `ABClassController` continue to
   work (grep for `new ABClassController()` in
   `src/backend` — there should be no changes from the
   pre-refactor state).
6. Verify the `Files read` evidence is complete for every
   delegated handoff in Sections 8-12.

### Section checks

- `npm test` passes (full backend test suite).
- `npm run lint:backend` passes.
- Regression checker shows no new failures.
- `Files read` evidence gate passed for every delegated
  handoff in Sections 8-12.

### Implementation notes / deviations / follow-up

- **Implementation notes**: this is a verification pass; no
  code changes unless issues are found.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: this is the
  final refactor-only regression check. The next round
  (e.g. the class-detail page) will re-run the regression
  checker with a new baseline.

---

## Regression and contract hardening (refactor + endpoint combined)

### Objective

Verify that no existing functionality is broken by either the
`getABClass` endpoint work (Sections 1-7) or the
`ABClassController` refactor (Sections 8-13), and that the new
endpoint behaves correctly under the documented contract
(envelope shape, error mapping, response shape).

### Constraints

- All existing tests in the touched areas (backend API tests,
  controller tests, frontend service tests, frontend query
  tests) still pass.
- The full backend lint (`npm run lint:backend`) and
  frontend lint (`npm run lint:frontend`) pass.
- No new lint warnings introduced.
- The new endpoint is correctly registered in
  `ALLOWLISTED_METHOD_HANDLERS` and reachable from the
  frontend.
- The shared `validateParametersObject_` is correctly
  referenced as a global from `abclassMutations.js` and
  `abclassRead.js`.
- The `ABClassController` class is accessible via
  `require('../../src/backend/y_controllers/ABClassController.js')`
  (which resolves to the new `index.js` via Node's
  folder-based resolution) and the public API is preserved.

### Acceptance criteria

- All tests across the touched areas pass.
- The lint commands pass.
- A manual smoke test of the new endpoint (in a sandbox or
  test environment) confirms:
  - `getABClass({ classId: 'class-001' })` returns the full
    class envelope with partial assignments.
  - `getABClass({ classId: 'nonexistent' })` returns
    `null`.
  - `getABClass({ classId: '../unsafe' })` returns an
    `INVALID_REQUEST` envelope.
- The 4 callers of `ABClassController` (in
  `z_apiHandler.js` line 25,
  `assignmentAssessment.js` line 125,
  `abclassMutations.js` line 7,
  `AssignmentController.js` lines 138 and 427) continue to
  work without any caller-side changes.

### Required test cases/checks

1. Run `npm test` — all tests pass.
2. Run `npm run lint:backend` — passes.
3. Run `npm run lint:frontend` — passes.
4. Run the regression checker (per the
   `.opencode/skills/regression-checker` workflow):
   - Establish a baseline (if not already done).
   - Run the current state.
   - Compare the baseline to the current state; verify no
     regressions are introduced.
5. Verify `ALLOWLISTED_METHOD_HANDLERS` in
   `z_apiHandler.js` contains the new `getABClass` entry.
6. Verify `queryKeys.ts` and `sharedQueries.ts` contain the
   new entries.
7. Verify the new `ABClassController/` folder exists and the
   legacy `ABClassController.js` file is removed.
8. Verify the `Files read` evidence is complete for every
   delegated handoff across Sections 1-13.

### Section checks

- `npm test` passes (full test suite).
- `npm run lint:backend` passes.
- `npm run lint:frontend` passes.
- Regression checker shows no new failures.
- `Files read` evidence gate passed for every delegated
  handoff in this round.

### Implementation notes / deviations / follow-up

- **Implementation notes**: the regression check is a
  verification pass; no code changes unless issues are found.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: this is the
  final regression check for this round. A future
  class-detail page round will re-run the regression checker
  with a new baseline that includes the class-detail page
  code.

---

## Documentation and rollout notes

### Objective

Reconcile the planned-only helper entries in canonical docs to their actual implementation status, and verify all documentation is up to date.

### Constraints

- The `validateParametersObject_` shared-helper entry in `docs/developer/backend/api-layer.md` §"Shared Helper Status" is updated from `Not implemented` to `Implemented` (with the new location noted).
- Any other planned-only entries that landed are reconciled.

### Acceptance criteria

- `docs/developer/backend/api-layer.md` §"Shared Helper Status" reflects the actual state of the codebase (no stale `Not implemented` markers).
- All new doc entries (`api-layer.md`, `DATA_SHAPES.md`, `ClassNotFoundError.js` JSDoc) are merged.

### Required checks

1. Verify `api-layer.md` §"Shared Helper Status" lists the `validateParametersObject_` entry as `Implemented` with the correct file path (`src/backend/z_Api/abclass/abclassValidation.js`).
2. Confirm no other planned-only entries need reconciling.
3. Run the docs reviewer (per `.github/agents/docs.agent.md`) for a final check.

### Section checks

- `npm run docs:build` (if configured) passes.
- Docs reviewer signs off.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation. The current spec has `@remarks` blocks on `readClass` and on `getABClass_`; verify they are present in the implementation.
- If earlier sections planned `@remarks`, verify that the relevant code now contains them before deleting the action plan.
- If no further `@remarks` are needed, record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes**: documentation reconciliation is the final pass. No code changes unless issues are found.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: this is the final section of the action plan. The plan can be deleted after the next round (the future class-detail page round) per the workflow convention.

---

## Suggested implementation order

### Part 1 — `getABClass` API endpoint (governed by `SPEC.md` v1.3)

1. **Section 1** — Move `abclassMutations.js` into the new folder. (Foundational; no behaviour change.)
2. **Section 2** — Create `abclassValidation.js` and update `abclassMutations.js` to reference the global. (Foundational; unlocks the shared-validation pattern.)
3. **Section 3** — Add `ABClassController.readClass` and `_toReadView` to the monolithic `ABClassController.js`. (Controller layer; required by section 4.)
4. **Section 4** — Add `getABClass_` transport handler and `ALLOWLISTED_METHOD_HANDLERS` entry. (Transport layer; depends on section 3.)
5. **Section 5** — Frontend service module and Zod schema. (Frontend; independent of sections 1–4 in terms of compile-time dependencies, but logically the frontend consumes the backend contract from section 4.)
6. **Section 6** — Frontend query factory. (Depends on section 5.)
7. **Section 7** — `ClassNotFoundError` JSDoc + `api-layer.md` + `DATA_SHAPES.md` documentation. (Documentation; can be done at any point but is grouped here for clarity.)

### Part 2 — `ABClassController` decomposition (governed by `ABClassControllerRefactor_SPEC.md` v1.0)

8. **Section 8** — Sub-class unit tests (RED) + sub-class file creation (GREEN). Lift method bodies from the monolithic file to the 5 new sub-class files; the monolithic file remains untouched. Sub-class unit tests in isolation.
9. **Section 9** — Create the facade `index.js` with full delegation. Rename the monolithic file to `.legacy.js` (or `.monolith.js.bak`) and add a re-export shim so existing tests continue to resolve. The new facade stands alongside the legacy file.
10. **Section 10** — Wire `tests/setupGlobals.js` to load the 5 new sub-classes in the right order (Validation → Persistence → Roster → AssignmentOps → ResponseMapper).
11. **Section 11** — Remove the legacy file and the re-export shim. The new folder is the only path that resolves to the `ABClassController` class.
12. **Section 12** — Documentation touch-up: add the exact sentence to `LARGE_CODE_FILES.md` noting the 4-sub-file plan is superseded.
13. **Section 13** — Refactor regression checks. Full backend test suite, full backend lint, regression checker.

### Combined

14. **Regression and contract hardening** — Final verification across Parts 1 and 2.
15. **Documentation and rollout notes** — Helper-entry reconciliation + docs reviewer sign-off.
