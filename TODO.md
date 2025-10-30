# Assignment Persistence TODO

## Intended Outcome

Deliver end-to-end assignment persistence using JsonDbApp so that:

- Each assessment run writes an immutable full-fidelity record to `assign_full_<courseId>_<assignmentId>`.
- `ABClass.assignments` maintains lightweight summaries suitable for fast loading.
- Controllers can rehydrate full assignments on demand without schema drift or duplicate roster data.
- Serialisation/deserialisation flows remain test-backed and aligned with documented data shapes.

- **Factory Pattern for Polymorphic Assignment Creation** (FOUNDATIONAL - REQUIRED FIRST)

  - Add `documentType` field to base `Assignment` class constructor (string: 'SLIDES' or 'SHEETS', set by subclasses).
  - Add static `Assignment.create(documentType, courseId, assignmentId, referenceDocumentId, templateDocumentId)` factory method that instantiates the correct subclass based on `documentType`.
  - Refactor existing `Assignment.fromJSON(data)` to become `Assignment._baseFromJSON(data)` (internal fallback).
  - Implement new `Assignment.fromJSON(data)` that checks `data.documentType` and routes to appropriate subclass `fromJSON()` (e.g., `SlidesAssignment.fromJSON(data)`).
  - Add `SlidesAssignment.fromJSON(data)` and `SheetsAssignment.fromJSON(data)` static methods that properly reconstruct subclass instances with all fields.
  - Update `AssignmentController` to use `Assignment.create(documentType, ...)` instead of direct instantiation, removing conditional logic from controller.
  - Add unit tests for factory creation and polymorphic deserialization covering both SLIDES and SHEETS types.

- **Assignment Model Serialisation**

  - Override `toJSON()` in `SlidesAssignment` and `SheetsAssignment` to emit subclass-specific fields (`documentType`, `referenceDocumentId`, `templateDocumentId`) alongside base fields via `super.toJSON()`.
  - Ensure base `Assignment.toJSON()` explicitly excludes transient fields (`students`, `progressTracker`) even if present at runtime.
  - Add optional `_hydrationLevel` transient flag ('full' or 'partial') to track hydration state without persisting it.

- **Partial Serialisation Support**

  - Add `toPartialJSON()` method to base `Assignment` class that returns a lightweight summary by:
    - Calling `toJSON()` to get full structure.
    - Nulling out heavy fields in artifacts (`content`, `contentHash`) while preserving identifiers (`taskId`, `role`, `uid`, `type`, `pageId`, `documentId`).
    - Keeping assessment scores, feedback summaries, and metadata intact for UI display.
  - Update `TaskDefinition.toPartialJSON()` and `BaseTaskArtifact.toPartialJSON()` helpers if needed to support partial serialisation at the artifact level.
  - Ensure `Assignment.fromJSON()` (via factory pattern) correctly handles both full and partial payloads, reconstructing with `_hydrationLevel` set appropriately.

- **ABClass Enhancements**

  - Add `findAssignmentIndex(predicate)` helper method to `ABClass` that returns the array index of a matching assignment (returns -1 if not found), supporting immutable replace pattern during rehydration.
  - Ensure `ABClass.toJSON()` serialises assignments via their `toJSON()` methods (already implemented), maintaining polymorphic type information through `documentType` field.
  - Update/extend unit tests (`tests/models/abclassManager.*`) to verify that assignments round-trip correctly with polymorphic types preserved.

- **Persistence Workflow (ABClassController)**

  - Add `_getFullAssignmentCollectionName(courseId, assignmentId)` private helper method that returns the consistent collection name pattern: `assign_full_${courseId}_${assignmentId}`.
  - Add `persistAssignmentRun(abClass, assignment)` to `src/AdminSheet/y_controllers/ABClassController.js` that:
    1. Serialises the assignment to a full payload via `assignment.toJSON()` and writes it to the full assignment collection (using `replaceOne` or `insertOne` + `save()`).
    2. Generates partial summary via `assignment.toPartialJSON()`.
    3. Uses `Assignment.fromJSON(partialJson)` (factory pattern) to create a properly-typed partial instance.
    4. Finds and replaces the assignment in `abClass.assignments` by index (using `findAssignmentIndex`).
    5. Calls `saveClass(abClass)` to persist the updated class document with partial assignment.
  - Introduce `rehydrateAssignment(abClass, assignmentId)` that:
    1. Reads the full assignment document from its collection.
    2. Uses `Assignment.fromJSON(doc)` (factory pattern) to reconstruct the correct subclass instance.
    3. Sets `assignment._hydrationLevel = 'full'` to mark as fully hydrated.
    4. Replaces the assignment in `abClass.assignments` by index and returns the hydrated instance.
    5. Throws clear errors when collection is missing, empty, or contains corrupt data.
  - Add logging via `ABLogger` for all persistence operations (write, read, rehydrate) following existing error-handling patterns.

- **AssignmentController Integration**

  - In `src/AdminSheet/y_controllers/AssignmentController.js`, update the creation flow to use the factory pattern:
    - Replace `createAssignmentInstance(AssignmentClass, ...)` calls with `Assignment.create(documentType, ...)`.
    - Remove the conditional `if (documentType === 'SLIDES')` / `else if (documentType === 'SHEETS')` logic as factory handles routing.
  - After `assignment.touchUpdated()` (line ~298), replace `abClass.addAssignment(assignment)` with `abClassController.persistAssignmentRun(abClass, assignment)`.
  - Verify that the in-memory `assignment` instance remains fully hydrated for downstream analysis/feedback generation while the persisted summary in `abClass.assignments` is partial.

- **Database Utilities**

  - Optionally extend `src/AdminSheet/DbManager/DbManager.js` with a concise helper (for example `replaceOneById`) if persistence code becomes noisy, keeping in line with existing patterns.

- **Testing Coverage**

  - Add new Vitest suites:
    - `tests/assignment/assignmentFactory.test.js` covering:
      - `Assignment.create()` instantiates correct subclass for each documentType.
      - `Assignment.fromJSON()` routes to correct subclass fromJSON method.
      - Polymorphic round-trip: create → toJSON → fromJSON preserves type and fields.
      - Error handling for unknown/missing documentType.
    - `tests/assignment/assignmentSerialisation.test.js` for:
      - `toJSON()` in subclasses includes documentType, referenceDocumentId, templateDocumentId.
      - `toPartialJSON()` nulls out heavy fields while preserving structure.
      - Transient fields (`students`, `progressTracker`) are never serialised.
    - `tests/controllers/abclassController.persistAssignment.test.js` validating:
      - Full assignment written to dedicated collection.
      - Partial summary created and stored in ABClass.
      - DB interactions with mocks and error handling.
    - `tests/controllers/abclassController.rehydrateAssignment.test.js` covering:
      - Successful rehydration restores correct subclass with \_hydrationLevel set.
      - Missing collection throws appropriate error.
      - Corrupt data throws with clear message.
  - Update existing assignment-related tests to assert new fields survive round-tripping and types are preserved.

- **Documentation & Contracts**
  - Refresh `docs/developer/DATA_SHAPES.md` to include:
    - `documentType`, `referenceDocumentId`, `templateDocumentId` in all assignment examples.
    - Clear examples of full vs partial hydration showing nulled fields.
    - Note that `_hydrationLevel` is transient and never persisted.
  - Update `docs/developer/rehydration.md` with:
    - Factory pattern usage (`Assignment.create()` and `Assignment.fromJSON()` routing).
    - Immutable replace contract using `findAssignmentIndex`.
    - Collection naming convention and persistence workflow.
  - Update `docs/howTos/rehydration.md` with practical examples showing:
    - How to use `abClassController.persistAssignmentRun()` and `rehydrateAssignment()`.
    - When to trigger rehydration (re-running assessments, exports, audits).
    - Error scenarios and recovery strategies.
