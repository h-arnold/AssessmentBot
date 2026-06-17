# `ABClassController` Decomposition Specification

## Status

- Draft v1.0
- Initial draft for `ABClassController` (996 lines, over the 550-line threshold
  in `src/backend/AGENTS.md` §10) decomposition into the facade pattern. This
  spec is independent of the `getABClass` endpoint spec
  (`SPEC.md` v1.3, signed off) — the two share a delivery but have
  non-overlapping scope. Awaiting `Planner Reviewer` review.

## Purpose

This document defines the intended behaviour for decomposing
`src/backend/y_controllers/ABClassController.js` (996 lines) into a folder
of focused sub-classes wired together through a thin facade, following the
`AssignmentDefinitionController/` precedent that `src/backend/AGENTS.md` §10
explicitly references.

The decomposition will be used to:

- reduce the size of the `ABClassController` file from 996 lines to a small
  facade (target ~150 lines including public methods and constructor)
- separate coherent responsibilities (validation, roster refresh, assignment
  operations, persistence, response mapping) into individually testable
  sub-classes
- keep the public API surface of `ABClassController` byte-for-byte identical
  so all callers (`z_Api/z_apiHandler.js`,
  `z_Api/assignmentAssessment.js`, `y_controllers/AssignmentController.js`)
  continue to work without any caller-side changes
- bring the new `readClass` and `_toReadView` methods being added by the
  `getABClass` endpoint work into the new structure (so they do not have to
  be migrated again later)

This decomposition is **not** intended to:

- change any observable backend behaviour (every method, including its
  logging, error throwing, and persistence side effects, is preserved)
- introduce a new public API (the facade exports the class under the same
  name, with the same `module.exports` shape)
- add new helpers or refactor adjacent code (e.g. `abclassMutations.js`,
  `z_Api/z_apiHandler.js`, `assignmentAssessment.js`, or `AssignmentController.js`)
  beyond what is required to make the existing test suite green
- change any of the responses, error envelopes, or storage shapes that
  existing callers depend on
- split `src/backend/Models/ABClass.js` (370 lines) — see "Out of scope"
  below

## Agreed product decisions

1. **Facade-pattern decomposition (per `src/backend/AGENTS.md` §10).** A new
   folder `src/backend/y_controllers/ABClassController/` contains the
   facade and sub-classes. The existing single-file class is removed. The
   facade class `ABClassController` in `index.js` re-exports the class
   itself (`module.exports = ABClassController;`) so every existing
   `require('../../src/backend/y_controllers/ABClassController.js')` and
   every `new ABClassController()` call across the codebase and the test
   suite continues to resolve to the same exported class.
2. **Five sub-classes (matching the `AssignmentDefinitionController/`
   decomposition shape, not the older 4-sub-file plan in
   `LARGE_CODE_FILES.md`).** The new structure:

   ```
   src/backend/y_controllers/ABClassController/
   ├── index.js                  # Facade — ABClassController class
   ├── ABClassValidation.js      # classId/courseLength/boolean validation,
   │                             # buildUpdatePatch, applyPatchToClass,
   │                             # isMissingCollectionError
   ├── ABClassRoster.js          # Classroom API calls + refresh/persist
   │                             # roster + initialise
   ├── ABClassAssignmentOps.js   # assignment run persistence + rehydration
   ├── ABClassPersistence.js     # persistClassAndPartial, upsertClassPartial
   └── ABClassResponseMapper.js  # normaliseClassPartial, buildClassSummary,
                                 # toReadView
   ```

   The 4-sub-file plan in `LARGE_CODE_FILES.md` (titled "→ `ABClassController.js`
   (CRUD API ~250), `_abClassRoster.js` (~250), `_abClassAssignmentOps.js`
   (~280), `_abClassUtils.js` (~200)") is **superseded** by this spec. It
   pre-dates the `AssignmentDefinitionController/` decomposition that
   `src/backend/AGENTS.md` §10 directly references and that
   `tests/setupGlobals.js` is already wired for.

   The complete method-to-sub-class assignment is:

   | Method                                                                 | Visibility | Sub-class               | Notes                                                                                            |
   | ---------------------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
   | `_applyCourseMetadata(abClass, courseId)`                              | private    | `ABClassRoster`         | Classroom API                                                                                    |
   | `_applyTeachers(abClass, courseId)`                                    | private    | `ABClassRoster`         | Classroom API + Teacher coercion                                                                 |
   | `_applyStudents(abClass, classId)`                                     | private    | `ABClassRoster`         | Classroom API                                                                                    |
   | `_buildClassroomRosterUpdatePayload(abClass)`                          | private    | `ABClassRoster`         | payload builder                                                                                  |
   | `_refreshRoster(abClass, classId)`                                     | private    | `ABClassRoster`         | calls 3 Classroom methods + clears arrays                                                        |
   | `_persistRoster(collection, existingDocument, abClass)`                | private    | `ABClassRoster`         | writes roster + delegates `_upsertClassPartial` to `ABClassPersistence`                          |
   | `initialise(classId, options)`                                         | **public** | `ABClassRoster`         | creates ABClass + populates roster (called by `AssignmentController.ensureDefinitionFromInputs`) |
   | `_loadFullAssignmentDocument(courseId, assignmentId)`                  | private    | `ABClassAssignmentOps`  |                                                                                                  |
   | `_validateAssignmentDocument(document)`                                | private    | `ABClassAssignmentOps`  |                                                                                                  |
   | `_ensureFullDefinition(assignment)`                                    | private    | `ABClassAssignmentOps`  |                                                                                                  |
   | `_replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment)` | private    | `ABClassAssignmentOps`  |                                                                                                  |
   | `_getFullAssignmentCollectionName(courseId, assignmentId)`             | private    | `ABClassAssignmentOps`  |                                                                                                  |
   | `persistAssignmentRun(abClass, assignment)`                            | **public** | `ABClassAssignmentOps`  | calls `this._persistence.persistClassAndPartial`                                                 |
   | `rehydrateAssignment(abClass, assignmentId)`                           | **public** | `ABClassAssignmentOps`  |                                                                                                  |
   | `_persistClassAndPartial(abClass)`                                     | private    | `ABClassPersistence`    | exposed as a public method on the sub-class so `ABClassAssignmentOps` can call it                |
   | `_upsertClassPartial(abClass)`                                         | private    | `ABClassPersistence`    |                                                                                                  |
   | `_validateClassId(classId, methodName)`                                | private    | `ABClassValidation`     |                                                                                                  |
   | `_validateDeleteClassId(classId, methodName)`                          | private    | `ABClassValidation`     |                                                                                                  |
   | `_isMissingCollectionError(error)`                                     | private    | `ABClassValidation`     | error classification is validation-adjacent                                                      |
   | `_validateCourseLength(courseLength, methodName)`                      | private    | `ABClassValidation`     |                                                                                                  |
   | `_buildUpdatePatch(parameters)`                                        | private    | `ABClassValidation`     |                                                                                                  |
   | `_applyPatchToClass(abClass, patch)`                                   | private    | `ABClassValidation`     |                                                                                                  |
   | `_normaliseClassPartial(partialDocument)`                              | private    | `ABClassResponseMapper` |                                                                                                  |
   | `_buildClassSummary(abClass)`                                          | private    | `ABClassResponseMapper` |                                                                                                  |
   | `_toReadView(abClass)`                                                 | private    | `ABClassResponseMapper` | new in this round (from the `getABClass` endpoint work)                                          |
   | `upsertABClass(parameters)`                                            | **public** | facade                  |                                                                                                  |
   | `updateABClass(parameters)`                                            | **public** | facade                  |                                                                                                  |
   | `deleteABClass(parameters)`                                            | **public** | facade                  |                                                                                                  |
   | `loadClass(classId)`                                                   | **public** | facade                  | calls `this._roster._refreshRoster`, `this._roster._persistRoster`                               |
   | `readClass(classId)`                                                   | **public** | facade                  | new in this round (from the `getABClass` endpoint work)                                          |
   | `saveClass(abClass)`                                                   | **public** | facade                  | validates + delegates to `this._persistence._persistClassAndPartial`                             |
   | `getAllClassPartials()`                                                | **public** | facade                  | delegates to `this._responseMapper._normaliseClassPartial`                                       |

   **Note on dead code:** the existing `_getCollectionMetadata(collection)`
   method at line 115 of the monolithic file is **not ported** to the new
   structure. It is dead code: no production caller, no test caller, and
   no other module references it (verified by `grep` across
   `src/backend` and `tests`). Removing it in the refactor is part of
   the de-sloppification that the refactor enables and is documented
   as a small, scoped deletion in Section 9 of the action plan.

   **Note on `initialise` visibility:** `initialise` has no leading
   underscore in the monolithic file, making it part of the public API
   surface (called by `AssignmentController.ensureDefinitionFromInputs`
   at line 428). It is therefore assigned to `ABClassRoster` as a
   **public method on the sub-class** and the facade exposes it as a
   public method via `initialise(classId, options) { return this._roster.initialise(classId, options); }`.

3. **Public API surface is identical.** Every method on the
   `ABClassController` class is preserved with the same name, signature,
   semantics, and JSDoc. The facade delegates each public method to the
   relevant sub-class instance held as a private field
   (`this._validation`, `this._roster`, `this._assignmentOps`,
   `this._persistence`, `this._responseMapper`). Every private
   leading-underscore method is also re-exposed on the facade as a
   one-line delegator so existing test access via
   `controller._methodName()` keeps working unchanged. The new
   `_toReadView` follows the same convention.

   **Facade delegation table.** The facade `index.js` must implement
   every method listed below as a one-line delegator. The shape is:

   ```js
   _privateMethodName(...args) {
     return this._<subclassField>._privateMethodName(...args);
   }
   ```

   (For public methods, replace `this._<subclassField>._privateMethodName`
   with `this._<subclassField>.publicMethodName` — same shape, no
   underscore on the public name.)

   | Method                                                                 | Delegate to                                                                                       |
   | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
   | `_applyCourseMetadata(abClass, courseId)`                              | `this._roster._applyCourseMetadata`                                                               |
   | `_applyTeachers(abClass, courseId)`                                    | `this._roster._applyTeachers`                                                                     |
   | `_applyStudents(abClass, classId)`                                     | `this._roster._applyStudents`                                                                     |
   | `_buildClassroomRosterUpdatePayload(abClass)`                          | `this._roster._buildClassroomRosterUpdatePayload`                                                 |
   | `_refreshRoster(abClass, classId)`                                     | `this._roster._refreshRoster`                                                                     |
   | `_persistRoster(collection, existingDocument, abClass)`                | `this._roster._persistRoster`                                                                     |
   | `initialise(classId, options)`                                         | `this._roster.initialise`                                                                         |
   | `_loadFullAssignmentDocument(courseId, assignmentId)`                  | `this._assignmentOps._loadFullAssignmentDocument`                                                 |
   | `_validateAssignmentDocument(document)`                                | `this._assignmentOps._validateAssignmentDocument`                                                 |
   | `_ensureFullDefinition(assignment)`                                    | `this._assignmentOps._ensureFullDefinition`                                                       |
   | `_replaceAssignmentInClass(abClass, assignmentId, hydratedAssignment)` | `this._assignmentOps._replaceAssignmentInClass`                                                   |
   | `_getFullAssignmentCollectionName(courseId, assignmentId)`             | `this._assignmentOps._getFullAssignmentCollectionName`                                            |
   | `persistAssignmentRun(abClass, assignment)`                            | `this._assignmentOps.persistAssignmentRun`                                                        |
   | `rehydrateAssignment(abClass, assignmentId)`                           | `this._assignmentOps.rehydrateAssignment`                                                         |
   | `_persistClassAndPartial(abClass)`                                     | `this._persistence._persistClassAndPartial`                                                       |
   | `_upsertClassPartial(abClass)`                                         | `this._persistence._upsertClassPartial`                                                           |
   | `_validateClassId(classId, methodName)`                                | `this._validation._validateClassId`                                                               |
   | `_validateDeleteClassId(classId, methodName)`                          | `this._validation._validateDeleteClassId`                                                         |
   | `_isMissingCollectionError(error)`                                     | `this._validation._isMissingCollectionError`                                                      |
   | `_validateCourseLength(courseLength, methodName)`                      | `this._validation._validateCourseLength`                                                          |
   | `_buildUpdatePatch(parameters)`                                        | `this._validation._buildUpdatePatch`                                                              |
   | `_applyPatchToClass(abClass, patch)`                                   | `this._validation._applyPatchToClass`                                                             |
   | `_normaliseClassPartial(partialDocument)`                              | `this._responseMapper._normaliseClassPartial`                                                     |
   | `_buildClassSummary(abClass)`                                          | `this._responseMapper._buildClassSummary`                                                         |
   | `_toReadView(abClass)`                                                 | `this._responseMapper._toReadView`                                                                |
   | `upsertABClass(parameters)`                                            | implemented on facade (orchestrates validation, persistence, response mapping)                    |
   | `updateABClass(parameters)`                                            | implemented on facade (orchestrates validation, persistence, response mapping)                    |
   | `deleteABClass(parameters)`                                            | implemented on facade (orchestrates validation, persistence)                                      |
   | `loadClass(classId)`                                                   | implemented on facade (orchestrates persistence, roster refresh, roster persist)                  |
   | `readClass(classId)`                                                   | implemented on facade (orchestrates persistence, response mapping) — new in this round            |
   | `saveClass(abClass)`                                                   | implemented on facade (validates input, delegates to `this._persistence._persistClassAndPartial`) |
   | `getAllClassPartials()`                                                | implemented on facade (delegates to `this._responseMapper._normaliseClassPartial`)                |

4. **Constructor remains trivial.** The facade constructor wires the
   sub-class instances, each of which accepts its dependencies via a
   single options object parameter (matching the
   `AssignmentDefinitionController/` precedent). Sub-classes that need
   `dbManager`, `validation`, or `persistence` receive them by
   reference; the facade constructs dependencies in an order that
   guarantees every sub-class receives a fully-constructed
   collaborator:
   ```js
   constructor() {
     const databaseManager = DbManager.getInstance();
     this._validation = new ABClassValidation();
     this._persistence = new ABClassPersistence({
       dbManager: databaseManager,
       validation: this._validation,
     });
     this._roster = new ABClassRoster({
       dbManager: databaseManager,
       validation: this._validation,
       persistence: this._persistence,
     });
     this._assignmentOps = new ABClassAssignmentOps({
       dbManager: databaseManager,
       validation: this._validation,
       persistence: this._persistence,
     });
     this._responseMapper = new ABClassResponseMapper();
   }
   ```
   The wiring order matters: `this._persistence` is constructed before
   `this._roster` and `this._assignmentOps` so both can receive a fully
   constructed `persistence` collaborator (the same ordering the
   `AssignmentDefinition/` facade uses for `_persistence` →
   `_upsertOrchestrator`). The `ABClassRoster` constructor needs
   `persistence` because `_persistRoster` (which lives on the roster
   sub-class — see Decision 2) calls
   `this._persistence._upsertClassPartial(abClass)`. The
   `ABClassAssignmentOps` constructor needs `persistence` because
   `persistAssignmentRun` calls `this._persistence.persistClassAndPartial(abClass)`
   (the persistence sub-class exposes `persistClassAndPartial` as a
   public method to keep the cross-sub-class call site simple). The
   sub-classes do not need `ProgressTracker` (no existing
   `ABClassController` method uses it — verified by searching the
   monolithic file).
5. **New `readClass` and `_toReadView` land in the new structure from
   day one.** `readClass(classId)` is a public method on the facade
   `index.js` (matching the `getABClass` endpoint work being added in
   `SPEC.md` v1.3 decision 2). `_toReadView(abClass)` is a private
   leading-underscore method on `ABClassResponseMapper` (the sub-class
   that owns the wire shape — same precedent as the
   `AssignmentDefinitionResponseMapper` sub-class that owns the
   `getFull` mapping). The facade re-exposes `_toReadView` as
   `this._toReadView` so existing test patterns that need to assert
   against the response shape can keep working.
6. **GAS concatenation load order is preserved.** All sub-class files
   load via `tests/setupGlobals.js` after `ABClass` / `Assignment` are
   loaded (mirroring the `AssignmentDefinition/` precedent at
   `tests/setupGlobals.js` lines 202-208). The `index.js` facade is
   loaded last; the `module.exports` block at the end of `index.js` is
   the only public export. Sub-class files have their own guarded
   `module.exports` blocks so tests can import them individually in
   isolation (matching `AssignmentDefinitionPersistence.js`,
   `AssignmentDefinitionValidation.js`, etc.).

   The required sub-class load order in `tests/setupGlobals.js`
   (each as a `g.ABClass<Name> = require(...)` line, matching the
   `AssignmentDefinition*` pattern at lines 202-208) is:
   1. `g.ABClassValidation = require('../src/backend/y_controllers/ABClassController/ABClassValidation.js');`
   2. `g.ABClassPersistence = require('../src/backend/y_controllers/ABClassController/ABClassPersistence.js');` — must load before roster and assignmentOps so the facade can pass it to both
   3. `g.ABClassRoster = require('../src/backend/y_controllers/ABClassController/ABClassRoster.js');`
   4. `g.ABClassAssignmentOps = require('../src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js');`
   5. `g.ABClassResponseMapper = require('../src/backend/y_controllers/ABClassController/ABClassResponseMapper.js');`

   The facade itself is not loaded as a global (it is loaded by
   callers via `require('../../src/backend/y_controllers/ABClassController.js')`
   which resolves to the new `index.js` via the existing file
   resolution — the folder name and the file name are identical to
   the old single-file path, so Node's resolution finds the
   `index.js` automatically).

7. **No production behaviour change.** Every existing test
   (`tests/controllers/abclass-loadClass.test.js`,
   `tests/controllers/abclass-upsert-update.test.js`,
   `tests/controllers/abclass-delete.test.js`,
   `tests/controllers/abclassController.persistAssignment.test.js`,
   `tests/controllers/abclassController.rehydrateAssignment.test.js`,
   `tests/controllers/abclass-roster-sync.test.js`,
   `tests/controllers/abclass-partials-read.test.js`,
   `tests/controllers/abclass-controller-partials.test.js`,
   `tests/models/abclassManager.initialise.test.js`,
   `tests/models/abclassManager.loadClass.test.js`,
   `tests/models/abclassManager.saveClass.test.js`,
   `tests/api/abclassMutations.test.js`,
   `tests/backend-api/abclassMutations.unit.test.js`,
   `tests/api/apiHandler/*.test.js`,
   `tests/api/apiHandler/shared.js`,
   `tests/helpers/apiHandlerTestUtils.js`,
   `tests/controllers/assignmentController.startAssessmentRun.test.js`,
   `tests/controllers/assignmentController.hydration.test.js`)
   continues to pass against the new structure with **no assertion
   changes** and **no test rewrites**. The only test-file changes are
   mechanical: any `require('../../src/backend/y_controllers/ABClassController.js')`
   that resolved to the monolithic file resolves to the new
   `index.js` instead (the file path is identical, so no test edits
   are required for this case at all).
8. **ABClass is not split (out of scope).** `src/backend/Models/ABClass.js`
   is 370 lines, below the 550-line threshold in
   `src/backend/AGENTS.md` §10. The §10 rule is explicit: _"Do not
   split files under 550 lines unless there is a clear maintainability
   reason."_ No clear maintainability reason applies to `ABClass`:
   - The class is well-organised; each method is small (most under 10
     lines).
   - Serialisation (`toJSON`, `toPartialJSON`, `fromJSON`) is tightly
     coupled to instance state and to the class's own serialiseOwner
     helper — splitting it out would not improve testability.
   - Teacher/Student/Assignment management are similar in shape but
     each collection is small (~30 lines) and split-extracting a
     generic `CollectionHelper` would be over-engineering for a
     370-line file.
   - The constructor handles a fixed set of properties in a clear
     order; splitting it would not improve clarity.
     Therefore the refactor is **scoped to `ABClassController` only**.
     The new `getABClass` endpoint work in `SPEC.md` v1.3 decision 4
     uses the controller's `_toReadView` method, which is the only
     way the `getABClass` delivery interacts with the model, and that
     surface does not change.

## Existing system constraints

### Backend or API constraints already in place

- `src/backend/AGENTS.md` §10 requires the facade pattern for non-API
  files over 550 lines and explicitly cites the
  `AssignmentDefinitionController/` decomposition as the canonical
  example. The new structure must match.
- `src/backend/AGENTS.md` §1.2 (concatenation and load-order model)
  applies: sub-class files must be loaded before the facade in the
  GAS concatenation order. In Node tests, the same order must be
  established in `tests/setupGlobals.js` (mirroring lines 202-208
  for `AssignmentDefinition`).
- `src/backend/AGENTS.md` §1.1 (Node test compatibility boundary)
  applies: production backend files may not use `require`, `import`,
  `export`, or `module.exports` for internal dependencies. The
  sub-class files only have a guarded `module.exports` block at the
  end (for test access) and reference their cross-sub-class
  dependencies via the `/* global ClassName */` JSDoc hint, exactly
  as the `AssignmentDefinition/` sub-classes do.
- `src/backend/AGENTS.md` §3 (Error and Logging Contract) applies:
  the new sub-classes must use `ABLogger.getInstance()` for
  diagnostics, not `console.*` (no production console calls in
  active areas). The existing `ABClassController` already follows
  this; the refactor preserves it.
- `src/backend/AGENTS.md` §4 (Defensive-Guard Policy) applies: the
  sub-classes must not add existence/type/feature checks for known
  internal modules. The existing `_isMissingCollectionError` helper
  is preserved as-is.
- `src/backend/AGENTS.md` §7 (Default Values Rule) applies: any
  sub-class default values must be set in the sub-class
  constructor.
- `src/backend/AGENTS.md` §9 (Testing Delegation) applies: all new
  tests in this round are delegated to `Testing Specialist`.
- `src/backend/AGENTS.md` §10 rules: _"Keep the public API surface
  (method names and signatures) identical after decomposition; the
  facade must preserve backward compatibility."_ This is the safety
  net for the refactor — every existing test must continue to pass
  without modification.
- `src/backend/AGENTS.md` §10 rules: _"Sub-class constructors
  should accept their dependencies via a single options object
  parameter for consistency with the existing pattern."_ This is
  why the sub-class constructors use `{ dbManager, validation, ... }`
  destructuring.

### Current data-shape constraints

- No data-shape changes. The decomposition is a code-organisation
  change. The response shapes returned by
  `getAllClassPartials()`, `upsertABClass()`, `updateABClass()`,
  `deleteABClass()`, `loadClass()`, the new `readClass()`, and the
  embedded partial assignments are all preserved.

### Frontend or consumer architecture constraints

- No frontend change is required. The `getABClass` endpoint work
  in `SPEC.md` v1.3 is delivered against the new structure (so the
  controller's `readClass` is on the facade, `_toReadView` is on
  the new `ABClassResponseMapper` sub-class). The frontend
  Zod schema and service module are unaffected.
- `tests/setupGlobals.js` must expose the 5 new sub-classes as
  globals in the right order (mirroring lines 202-208 for
  `AssignmentDefinition`). The order is:
  1.  `ABClassValidation`
  2.  `ABClassPersistence` (must load before Roster and AssignmentOps so the facade can pass it to both)
  3.  `ABClassRoster`
  4.  `ABClassAssignmentOps`
  5.  `ABClassResponseMapper`
  6.  (no facade global needed; the facade is loaded by callers via
      `require('../../src/backend/y_controllers/ABClassController.js')`
      which resolves to the new `index.js`)

## Domain and contract recommendations

### Why this approach is preferable

- **Matches the canonical pattern.** The
  `AssignmentDefinitionController/` decomposition is the example
  `src/backend/AGENTS.md` §10 cites. Reusing the same shape
  (folder + facade + sub-classes + `tests/setupGlobals.js` wiring)
  keeps the codebase consistent and makes the refactor
  review-friendly: any reviewer who has seen one
  `AssignmentDefinition/` decomposition has seen them all.
- **The existing test suite acts as a regression net.** Every
  controller test imports `ABClassController` and exercises a
  subset of the methods. With the public API preserved and the
  `module.exports` block preserved, the entire test suite must
  pass after the refactor with no test changes. This is the
  strongest possible regression test for the refactor: if any
  method's behaviour drifts, the test suite fails. No new
  contract tests are required.
- **The new `readClass` / `_toReadView` land in the right
  sub-class from day one.** The `getABClass` endpoint work in
  `SPEC.md` v1.3 is also being delivered in this round. Adding
  the new methods to the new structure from the start (rather
  than adding them to the monolithic file and then migrating
  them in a follow-up) avoids a follow-up PR.
- **The split boundaries are aligned with the existing
  responsibilities in the file.** The five sub-classes map to
  five natural responsibility clusters in the current file:
  - Validation (classId, courseLength, boolean, buildUpdatePatch,
    applyPatchToClass) — ~80 lines.
  - Roster (Classroom API calls, refresh, build payload,
    persist roster) — ~140 lines.
  - Assignment ops (assignment run persistence, rehydration,
    document loading, document validation, definition
    resolution, in-class replace) — ~190 lines.
  - Persistence (write-through to class collection, partial
    upsert, collection metadata) — ~80 lines.
  - Response mapping (`_normaliseClassPartial`,
    `_buildClassSummary`, `_toReadView`) — ~80 lines.
    This is a balanced split: no sub-class is over 200 lines, and
    each sub-class owns one coherent concern.

### Recommended data shapes

Not applicable. The refactor does not change any data shape.

### Naming recommendation

Prefer:

- Folder: `src/backend/y_controllers/ABClassController/`
  (PascalCase, matching the class name and the
  `AssignmentDefinition/` precedent)
- Facade: `index.js` inside the folder
  (matching `AssignmentDefinition/index.js`)
- Sub-classes: `ABClassValidation.js`,
  `ABClassRoster.js`, `ABClassAssignmentOps.js`,
  `ABClassPersistence.js`, `ABClassResponseMapper.js`
  (PascalCase prefix, matching the class name and the
  `AssignmentDefinition*` files in the precedent)
- Sub-class class names: `ABClassValidation`,
  `ABClassRoster`, `ABClassAssignmentOps`,
  `ABClassPersistence`, `ABClassResponseMapper`
  (matching file name without extension)
- Facade class name: `ABClassController`
  (preserved exactly — every `new ABClassController()` and
  every `instanceof ABClassController` check across the codebase
  continues to work)
- New sub-class private methods: leading-underscore
  (`_getFullAssignmentCollectionName`,
  `_validateAssignmentDocument`, etc.) — preserved from the
  existing monolithic class

Avoid:

- Flat files with leading-underscore naming
  (`_abClassRoster.js`, etc.) — superseded by the folder
  pattern; the older plan in `LARGE_CODE_FILES.md` is
  out-of-date
- Renaming the facade class to `ABClassControllerFacade` or
  similar — would break every `new ABClassController()` call
  across the codebase
- Renaming private methods to public (would require updating
  every test that uses `controller._methodName()` access)

### Validation recommendation

Not applicable. The refactor preserves all existing
validation. The transport validation rules for
`upsertABClass`/`updateABClass`/`deleteABClass` (owned by
`abclassMutations.js`) and the new `getABClass` (owned by
the new `abclassRead.js`) are unchanged. The domain
validation rules owned by the controller are split into
`ABClassValidation` and preserved verbatim.

### Display-resolution recommendation

Not applicable. The refactor does not change display logic.

## Feature architecture

### Placement

- New folder: `src/backend/y_controllers/ABClassController/`
  with the facade and 5 sub-classes (per decision 2 above).
- Removed: `src/backend/y_controllers/ABClassController.js`
  (replaced by `src/backend/y_controllers/ABClassController/index.js`).
- Updated: `tests/setupGlobals.js` to load the 5 new
  sub-classes in the right order (per decision 6 above).
- Unchanged: every caller of `ABClassController` (the
  facade class preserves the public API).
- Unchanged: every existing controller test file.
- Unchanged: the `getABClass` endpoint work in
  `SPEC.md` v1.3 — the new `readClass` lands on the facade
  and `_toReadView` lands on the new `ABClassResponseMapper`
  sub-class (per decision 5 above).

### Proposed high-level tree

```text
src/backend/
└── y_controllers/
    ├── ABClassController/                        (new folder)
    │   ├── index.js                              (new — facade)
    │   ├── ABClassValidation.js                  (new)
    │   ├── ABClassRoster.js                      (new)
    │   ├── ABClassAssignmentOps.js               (new)
    │   ├── ABClassPersistence.js                 (new)
    │   └── ABClassResponseMapper.js              (new)
    ├── ABClassController.js                      (removed)
    ├── AssignmentController.js                   (unchanged)
    ├── AssignmentDefinition/
    │   └── ...                                   (unchanged)
    └── ReferenceDataController.js                (unchanged)
```

```text
tests/
└── setupGlobals.js                               (modified — load
                                                  new sub-classes in
                                                  GAS-load order)
```

### Out of scope for this surface

- `src/backend/Models/ABClass.js` (370 lines) — not split
  (per decision 8 above)
- `src/backend/z_Api/abclassMutations.js` and
  `src/backend/z_Api/z_apiHandler.js` — the
  `abclassMutations.js` move to a new `z_Api/abclass/` folder
  is a separate, smaller workstream already covered by
  `SPEC.md` v1.3 + `ACTION_PLAN.md` Sections 1-2. It happens
  to land in the same delivery but is not part of this
  refactor.
- The new `getABClass` endpoint work in `SPEC.md` v1.3 — the
  new `readClass` and `_toReadView` methods are added to the
  facade and `ABClassResponseMapper` sub-class
  respectively, but the rest of that work (the transport
  handler, the frontend service module, the Zod schema, the
  query factory) is governed by `SPEC.md` v1.3 and
  `ACTION_PLAN.md` Sections 1-7, not by this spec.
- The 4-sub-file plan in `LARGE_CODE_FILES.md` for
  `ABClassController` — superseded by this spec.
- Renaming the facade class, changing the public API,
  changing the `module.exports` shape, or changing any
  caller's call site.

## Data loading and orchestration

Not applicable. The refactor is a code-organisation change
with no impact on data loading or orchestration. All
persistence, Classroom API calls, and read paths are
preserved verbatim.

## Core view model or behavioural model

Not applicable. The refactor does not change the
behavioural model. The `readClass` (new in this round) and
`loadClass` semantics are preserved.

## Main user-facing surface specification

Not applicable. The refactor has no user-facing surface. It
is a backend code-organisation change.

## Workflow specification

Not applicable. The refactor preserves all existing
workflows.

## Error, loading, and empty-state rules

Not applicable. The refactor preserves all existing error,
loading, and empty-state behaviour. Every `throw`, every
error message, every `ClassNotFoundError` /
`AssignmentNotFoundError` / `RangeError` / `TypeError` is
preserved.

## Accessibility and usability notes

Not applicable. No user-facing changes.

## Backend changes required

1. **Create the new folder** with the facade and 5 sub-classes
   (per decision 2 above). The facade is a thin orchestration
   layer that exposes all current public methods with identical
   signatures and delegates to the relevant sub-class. Each
   sub-class file ends with a guarded
   `if (typeof module !== 'undefined' && module.exports)` block
   (matching `AssignmentDefinition/`). The facade
   `index.js` ends with the same
   `module.exports = ABClassController;` line that the existing
   monolithic file ends with — this is the safety net that
   keeps every test passing without modification.
2. **Remove the existing monolithic file**
   `src/backend/y_controllers/ABClassController.js` (replaced
   by the new folder).
3. **Update `tests/setupGlobals.js`** to load the 5 new
   sub-classes in the right GAS-load order. The order
   matches the `AssignmentDefinition/` pattern at lines
   202-208, with the specific sequence documented in
   Decision 6 above (Validation → Persistence → Roster
   → AssignmentOps → ResponseMapper). The persistence
   sub-class must load before roster and assignmentOps
   so the facade can pass it to both. Sub-class
   constructors are written so they do not have side
   effects (matching the `AssignmentDefinition*`
   precedent), so the load order only matters for
   cross-sub-class references and the facade
   construction.
4. **Add the new `readClass` and `_toReadView` methods in
   the new structure.** `readClass(classId)` is on the
   facade `index.js`; `_toReadView(abClass)` is on
   `ABClassResponseMapper`. The implementation matches the
   description in `SPEC.md` v1.3 decision 2 and decision 4.
   The facade re-exposes `_toReadView` as
   `this._toReadView` so the controller's tests can
   continue to use `controller._toReadView(abClass)` if
   needed (this is a forward-looking convenience; existing
   tests do not require it).
5. **No documentation update is required for the
   refactor itself.** The existing `api-layer.md`
   references `src/backend/y_controllers/ABClassController.js`
   in many places (e.g. lines 310, 364, 367, 381, 388, 398).
   These references still resolve to the same class
   (the facade re-exports the class under the same name).
   However, since the file path is being changed (from a
   file to a folder), one minor doc update is required: a
   single sentence in `LARGE_CODE_FILES.md` noting that
   the 4-sub-file plan in that document is superseded by
   this spec (the new sub-file layout is documented in
   this spec, not in `LARGE_CODE_FILES.md`). This is a
   small, scoped documentation touch-up.

   The exact sentence to add to `LARGE_CODE_FILES.md`
   (immediately after the existing `y_controllers/ABClassController.js`
   table row at line 80) is:

   > **Note**: the 4-sub-file plan for `y_controllers/ABClassController.js`
   > (CRUD API ~250, `_abClassRoster.js` ~250, `_abClassAssignmentOps.js`
   > ~280, `_abClassUtils.js` ~200) is **superseded** by the folder-based
   > facade decomposition documented in
   > `ABClassControllerRefactor_SPEC.md` (5 sub-classes:
   > `ABClassValidation`, `ABClassPersistence`, `ABClassRoster`,
   > `ABClassAssignmentOps`, `ABClassResponseMapper`). The new plan follows
   > the `AssignmentDefinitionController/` precedent that
   > `src/backend/AGENTS.md` §10 directly references.

## Planning handoff notes

- The new sub-class constructors must be side-effect-free
  (no eager work, no `dbManager.getInstance()` at the top
  level) so that `tests/setupGlobals.js` can load them in
  the right order without uninitialised-state errors. The
  sub-classes follow the `AssignmentDefinition/` precedent:
  `dbManager` is passed into the sub-class constructor via
  the options object, and the facade wires the dependencies
  once in its own constructor.
- The GAS concatenation order in production mirrors the
  `tests/setupGlobals.js` load order (per Decision 6):
  1. (existing) `Models/ABClass.js` and dependencies
  2. (new) `ABClassController/ABClassValidation.js`
  3. (new) `ABClassController/ABClassPersistence.js`
  4. (new) `ABClassController/ABClassRoster.js`
  5. (new) `ABClassController/ABClassAssignmentOps.js`
  6. (new) `ABClassController/ABClassResponseMapper.js`
  7. (new) `ABClassController/index.js` (the facade)
     The `Persistence` sub-class must load before `Roster` and
     `AssignmentOps` because the facade constructor passes
     `this._persistence` to both of them. The
     `tests/setupGlobals.js` mirrors this order.
- The `LARGE_CODE_FILES.md` 4-sub-file plan for
  `ABClassController` is superseded by this spec. The
  doc should be updated to note that the new plan is in
  this spec, not the `LARGE_CODE_FILES.md` table.
- The `getABClass` endpoint work in `SPEC.md` v1.3 and
  `ACTION_PLAN.md` Sections 1-7 is delivered in the same
  delivery. Section 3 of `ACTION_PLAN.md` (which adds
  `readClass` + `_toReadView`) should be updated to
  reference the new structure: `readClass` on the facade,
  `_toReadView` on the new `ABClassResponseMapper`
  sub-class. Sections 1-2, 4-7 are otherwise unchanged.
- New `ACTION_PLAN.md` sections (numbered 8 onwards) cover
  the refactor itself:
  - Section 8: create the 5 sub-class skeletons
    (TDD-first; new unit tests for each sub-class in
    isolation, then implementation)
  - Section 9: create the facade `index.js` and wire the
    sub-classes
  - Section 10: update `tests/setupGlobals.js` to load
    the new sub-classes
  - Section 11: remove the monolithic file and verify
    the existing test suite passes
  - Section 12: documentation touch-up
    (one sentence in `LARGE_CODE_FILES.md` noting the
    plan is superseded; otherwise no doc changes)
  - Section 13: refactor regression checks (full backend
    test suite, full backend lint, regression checker)

## Testing expectations

- **Sub-class unit tests** (new):
  - `tests/controllers/ABClassController/ABClassValidation.unit.test.js`
    — covers `ABClassValidation.requireNonEmptyString`,
    `requireTrimmedString`, `requireIntegerGte`,
    `isMissingCollectionError`, `buildUpdatePatch`,
    `applyPatchToClass`
  - `tests/controllers/ABClassController/ABClassRoster.unit.test.js`
    — covers `ABClassRoster.applyCourseMetadata`,
    `applyTeachers`, `applyStudents`, `refreshRoster`,
    `buildClassroomRosterUpdatePayload`, `initialise`,
    `persistRoster` (these were previously tested through
    the controller tests; the new tests cover them in
    isolation against the sub-class instance)
  - `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js`
    — covers `ABClassAssignmentOps.persistAssignmentRun`,
    `rehydrateAssignment`, `loadFullAssignmentDocument`,
    `validateAssignmentDocument`, `ensureFullDefinition`,
    `replaceAssignmentInClass`, `getFullAssignmentCollectionName`
  - `tests/controllers/ABClassController/ABClassPersistence.unit.test.js`
    — covers `ABClassPersistence.persistClassAndPartial`
    and `upsertClassPartial` (the third pre-existing helper
    `_getCollectionMetadata` is dead code and is **not** covered
    or ported, per Decision 2's dead-code note)
  - `tests/controllers/ABClassController/ABClassResponseMapper.unit.test.js`
    — covers `ABClassResponseMapper.normaliseClassPartial` and
    `buildClassSummary`. The new private `_toReadView` method
    (introduced by the `getABClass` endpoint work) is **not**
    covered by isolated sub-class unit tests; it is covered by
    the `tests/controllers/abclassController.readClass.test.js`
    test file specified in `ACTION_PLAN.md` Section 3, which
    tests the transformation through the public `readClass`
    method on the facade. This aligns with the
    `_toReadView` test-strategy decision in `SPEC.md` v1.3
    (decision 3, lines 590-596: "Direct unit testing of the
    transformation is achieved through the public method, not
    via separate export of the private method"). The
    `ABClassResponseMapper._toReadView` method is still
    implemented and still exposed on the facade (per Decision
    3's delegation table) so test access via
    `controller._toReadView(...)` works if a future test
    chooses to exercise it directly.
- **Existing controller test suite** (regression — must pass
  unchanged):
  - `tests/controllers/abclass-loadClass.test.js`
  - `tests/controllers/abclass-upsert-update.test.js`
  - `tests/controllers/abclass-delete.test.js`
  - `tests/controllers/abclassController.persistAssignment.test.js`
  - `tests/controllers/abclassController.rehydrateAssignment.test.js`
  - `tests/controllers/abclass-roster-sync.test.js`
  - `tests/controllers/abclass-partials-read.test.js`
  - `tests/controllers/abclass-controller-partials.test.js`
  - `tests/models/abclassManager.initialise.test.js`
  - `tests/models/abclassManager.loadClass.test.js`
  - `tests/models/abclassManager.saveClass.test.js`
- **Existing API-layer test suite** (regression — must pass
  unchanged):
  - `tests/api/abclassMutations.test.js`
  - `tests/backend-api/abclassMutations.unit.test.js`
  - `tests/api/apiHandler/*.test.js`
  - `tests/api/apiHandler/shared.js`
  - `tests/helpers/apiHandlerTestUtils.js`
- **Cross-controller test suite** (regression — must pass
  unchanged):
  - `tests/controllers/assignmentController.startAssessmentRun.test.js`
  - `tests/controllers/assignmentController.hydration.test.js`
- No Playwright E2E tests are added in this round (no
  user-facing change).

## Documentation and rollout notes

- `LARGE_CODE_FILES.md` — add the following sentence
  immediately after the `y_controllers/ABClassController.js`
  row in the table (line 80):
  > **Note**: the 4-sub-file plan for `y_controllers/ABClassController.js`
  > (CRUD API ~250, `_abClassRoster.js` ~250, `_abClassAssignmentOps.js`
  > ~280, `_abClassUtils.js` ~200) is **superseded** by the folder-based
  > facade decomposition documented in
  > `ABClassControllerRefactor_SPEC.md` (5 sub-classes:
  > `ABClassValidation`, `ABClassPersistence`, `ABClassRoster`,
  > `ABClassAssignmentOps`, `ABClassResponseMapper`). The new plan follows
  > the `AssignmentDefinitionController/` precedent that
  > `src/backend/AGENTS.md` §10 directly references.
  > No other changes.
- `docs/developer/backend/api-layer.md` — no changes. The
  existing references to
  `src/backend/y_controllers/ABClassController.js` (lines
  310, 364, 367, 381, 388, 398) all resolve to the same
  class via the new folder; the public API is preserved.
  The new `getABClass` entry being added by the
  `SPEC.md` v1.3 work references the controller's
  `readClass` method, which lives on the facade (the
  file path it documents is the facade's path; the
  `_toReadView` reference stays accurate because the
  method lives on the new sub-class but is re-exposed
  on the facade for backward compatibility).
- `docs/developer/backend/DATA_SHAPES.md` — no changes
  (no data-shape change).
- No migration is required. The refactor is a code-
  organisation change; all production behaviour, all
  responses, all storage shapes, and all caller call sites
  are preserved.
- The `getABClass` endpoint work in `SPEC.md` v1.3 is
  affected only in the sense that its `readClass` method
  lands on the facade and its `_toReadView` method lands
  on the new `ABClassResponseMapper` sub-class. No
  product changes; no spec changes other than this note.

## V1 scope recommendation

### Include in v1

- New folder `src/backend/y_controllers/ABClassController/`
  with `index.js` facade and 5 sub-classes
  (`ABClassValidation`, `ABClassRoster`, `ABClassAssignmentOps`,
  `ABClassPersistence`, `ABClassResponseMapper`)
- Removal of the existing monolithic
  `src/backend/y_controllers/ABClassController.js` file
- Updated `tests/setupGlobals.js` to load the 5 new
  sub-classes in the right order
- New unit tests for each of the 5 sub-classes
- Updated `ACTION_PLAN.md` Section 3 so the new
  `readClass` lands on the facade and `_toReadView`
  lands on `ABClassResponseMapper` (no behavioural
  change to the `getABClass` endpoint work; only
  the file path and the sub-class owner)
- One-sentence doc touch-up in `LARGE_CODE_FILES.md`

### Defer from v1

- Splitting `src/backend/Models/ABClass.js` (370 lines,
  below threshold, no clear maintainability reason)
- Changing the public API of `ABClassController`
- Renaming the facade class
- Refactoring adjacent controllers
  (`AssignmentController.js`, `ReferenceDataController.js`,
  `AssignmentDefinitionController/`) — they are below
  their respective thresholds
- Adding sub-class `setInstance` / `getInstance`
  patterns — the sub-classes are pure collaborators
  with no singleton state
- Promoting the sub-classes to a shared abstraction
  (e.g. `BasePersistence`, `BaseRoster`) — there is
  no shared logic that warrants it
- Any visible UI or frontend change

## Open questions

1. **Decided**: the decomposition uses 5 sub-classes in
   a folder, not the 4-sub-file plan in
   `LARGE_CODE_FILES.md`. The folder pattern is the
   modern precedent (`AssignmentDefinition/`) and is
   what `tests/setupGlobals.js` is already wired for.
   No blocker.
2. **Decided**: `ABClass` is not split in this round
   (370 lines, below threshold, no clear maintainability
   reason). If a future round grows `ABClass` past 550
   lines, the same facade pattern can be applied. No
   blocker.
3. **Decided**: the new `readClass` and `_toReadView`
   methods being added by the `getABClass` endpoint work
   land in the new structure from day one. `readClass`
   is a public method on the facade; `_toReadView` lives
   on the new `ABClassResponseMapper` sub-class. No
   blocker.
4. **Decided**: the existing test suite must pass
   unchanged after the refactor. The public API is
   preserved (including `initialise` as a public method),
   the `module.exports` shape is preserved, every private
   method is re-exposed on the facade via one-line
   delegation, and the existing tests are the regression
   net. No blocker.
5. **Decided**: `_getCollectionMetadata` is dead code
   (verified by `grep` across `src/backend` and `tests`)
   and is **not** ported to the new structure. Its
   removal is a small de-sloppification that the refactor
   enables. No blocker.
6. **Decided**: the cross-sub-class call sites are
   `ABClassRoster._persistRoster` → `ABClassPersistence._upsertClassPartial`
   and `ABClassAssignmentOps.persistAssignmentRun` →
   `ABClassPersistence._persistClassAndPartial` (the
   latter exposed as a public method on the persistence
   sub-class to keep the call site simple). The
   `_persistClassAndPartial` method is named
   `persistClassAndPartial` on the sub-class to make
   the public call site self-documenting; the facade
   re-exposes the same method under its private name
   `_persistClassAndPartial` for backward compatibility
   with existing test access. No blocker.
