# `getABClass` API Endpoint — Delivery Plan (TDD-First)

> **Plan status**: v1.2 (rewritten after first review pass found the file described the wrong feature; updated after second review pass to add ESLint relaxed-rule entries and clarify wording; updated after third review pass to (a) add `abclassValidation.js` to Section 4's ESLint relaxed-rule acceptance criteria, (b) clarify JSDoc global hint placement in Section 2, (c) sharpen Section 4 test case 1 language, (d) explicitly require removal of the old `ClassNotFoundError` JSDoc sentence in Section 7, (e) clarify `TeacherSummary` redefinition vs import in Section 5, and (f) add `invalidateAbClass` helper to Section 6). Awaiting final sign-off.

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (v1.3, signed off by `Planner Reviewer`).
2. Read `src/backend/AGENTS.md` (backend conventions, §0.1 trailing-underscore handler pattern, §0.2 validation ownership, §1.1 Node test compatibility, §8 date handling, §3 logging, §11 API domain folder organisation).
3. Read `src/frontend/AGENTS.md` (frontend conventions, §4.1 required API transport pattern, §4.3 prohibited types in `google.script.run`, §8 Zod validation, §12 service domain folder organisation).
4. Read `docs/developer/backend/api-layer.md` for canonical API-layer rules.
5. Read `docs/developer/DATA_SHAPES.md` (and its `backend/DATA_SHAPES.md` mirror) for the canonical partial shape contracts.
6. Treat those documents as the source of truth for product behaviour, contracts, and rules.
7. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec.

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
- `ABClassController` decomposition (over 1000 lines; planned in `LARGE_CODE_FILES.md` but not yet implemented).
- Reorganising the pre-existing `classPartials*` files into a subfolder (pre-existing rule deviation; out of scope for this round).
- Any visible class-detail page (out of scope; will get its own layout spec when built).
- New shared helper extraction beyond the `abclassValidation.js` already specified (no other new shared helpers are introduced).
- Updating the `z_Api` builder concatenation order to use numeric prefixes (the existing `localeCompare` order is sufficient because all function calls in the new `abclass/` folder are lazy).

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

- **Implementation notes**: pure location move; the require-path change in `z_apiHandler.js`'s `module.exports` branch is one line; the `eslint.config.js` change is one line; the three test-file require changes are mechanical.
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

Add `readClass(classId)` (public) and `_toReadView(abClass)` (private, leading underscore) methods to `ABClassController`. The new methods form the pure-read counterpart to the existing `loadClass`: they read a stored class document, deserialise it, and return a transport-ready plain object with partial assignments and defence-in-depth strip. No Classroom API calls, no storage mutation.

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
- `queryKeys.ts` also exports an `invalidateAbClass: (classId: string) => queryKeys.abClass(classId)` invalidation key factory (per SPEC.md §"Manual refresh" — React Query standard `invalidateQueries({ queryKey: queryKeys.invalidateAbClass(classId) })` works).
- `sharedQueries.ts` exports a `getABClassQueryOptions(classId: string)` function that returns `queryOptions({ ... })`.
- The new query is **not** added to `startupWarmupQueryDefinitions`.
- Existing `queryOptions` / `queryKeys` invalidation patterns work with the new query (`invalidateQueries({ queryKey: queryKeys.invalidateAbClass(classId) })`).

### Required test cases (Red first)

Frontend query tests (extended — `src/frontend/src/query/sharedQueries.query.spec.tsx`):

1. **RED**: `queryKeys.abClass` is not defined. Test fails.
2. **GREEN**: `queryKeys.abClass('class-001')` returns `['abClass', 'class-001']`. Test passes.
3. `queryKeys.invalidateAbClass('class-001')` returns `['abClass', 'class-001']` (same as `queryKeys.abClass('class-001')` — the invalidation key factory re-uses the query key). Test passes.
4. **RED**: `getABClassQueryOptions` is not defined. Test fails.
5. **GREEN**: `getABClassQueryOptions('class-001')` returns an object with `queryKey: ['abClass', 'class-001']` and a `queryFn` that calls `getABClass({ classId: 'class-001' })`. Test passes.
6. The `queryFn` is awaitable and propagates errors from `getABClass` (e.g. Zod parse errors). Test passes.

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

## Regression and contract hardening

### Objective

Verify that no existing functionality is broken by the changes, and that the new endpoint behaves correctly under the documented contract (envelope shape, error mapping, response shape).

### Constraints

- All existing tests in the touched areas (backend API tests, controller tests, frontend service tests, frontend query tests) still pass.
- The full backend lint (`npm run lint:backend`) and frontend lint (`npm run lint:frontend`) pass.
- No new lint warnings introduced.
- The new endpoint is correctly registered in `ALLOWLISTED_METHOD_HANDLERS` and reachable from the frontend.
- The shared `validateParametersObject_` is correctly referenced as a global from `abclassMutations.js` and `abclassRead.js`.

### Acceptance criteria

- All tests across the touched areas pass.
- The lint commands pass.
- A manual smoke test of the new endpoint (in a sandbox or test environment) confirms:
  - `getABClass({ classId: 'class-001' })` returns the full class envelope with partial assignments.
  - `getABClass({ classId: 'nonexistent' })` returns `null`.
  - `getABClass({ classId: '../unsafe' })` returns an `INVALID_REQUEST` envelope.

### Required test cases/checks

1. Run `npm test` — all tests pass.
2. Run `npm run lint:backend` — passes.
3. Run `npm run lint:frontend` — passes.
4. Run the regression checker (per the `.opencode/skills/regression-checker` workflow):
   - Establish a baseline (if not already done).
   - Run the current state.
   - Compare the baseline to the current state; verify no regressions are introduced.
5. Verify `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js` contains the new `getABClass` entry.
6. Verify `queryKeys.ts` and `sharedQueries.ts` contain the new entries.
7. Verify the `Files read` evidence is complete for every delegated handoff across sections 1–7.

### Section checks

- `npm test` passes (full test suite).
- `npm run lint:backend` passes.
- `npm run lint:frontend` passes.
- Regression checker shows no new failures.
- `Files read` evidence gate passed for every delegated handoff in this round.

### Implementation notes / deviations / follow-up

- **Implementation notes**: the regression check is a verification pass; no code changes unless issues are found.
- **Deviations from plan**: none expected.
- **Follow-up implications for later sections**: this is the final regression check for this round. A future class-detail page round will re-run the regression checker with a new baseline that includes the class-detail page code.

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

1. **Section 1** — Move `abclassMutations.js` into the new folder. (Foundational; no behaviour change.)
2. **Section 2** — Create `abclassValidation.js` and update `abclassMutations.js` to reference the global. (Foundational; unlocks the shared-validation pattern.)
3. **Section 3** — Add `ABClassController.readClass` and `_toReadView`. (Controller layer; required by section 4.)
4. **Section 4** — Add `getABClass_` transport handler and `ALLOWLISTED_METHOD_HANDLERS` entry. (Transport layer; depends on section 3.)
5. **Section 5** — Frontend service module and Zod schema. (Frontend; independent of sections 1–4 in terms of compile-time dependencies, but logically the frontend consumes the backend contract from section 4.)
6. **Section 6** — Frontend query factory. (Depends on section 5.)
7. **Section 7** — `ClassNotFoundError` JSDoc + `api-layer.md` + `DATA_SHAPES.md` documentation. (Documentation; can be done at any point but is grouped here for clarity.)
8. **Regression and contract hardening** — Final verification.
9. **Documentation and rollout notes** — Helper-entry reconciliation + docs reviewer sign-off.
