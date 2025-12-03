# Assignment Persistence TODO

## Intended Outcome

Deliver end-to-end assignment persistence using JsonDbApp so that:

- **Split Persistence Model**:
  - Each assessment run writes an immutable **Full Fidelity** record to `assign_full_<courseId>_<assignmentId>` (up to ~20MB). This serves as a cache for lazy-loading and re-runs.
  - `ABClass.assignments` maintains **Lightweight Summaries** (Partial) suitable for fast loading during cohort analysis and averages calculation.
- Controllers can rehydrate full assignments on demand without schema drift or duplicate roster data.
- Serialisation/deserialisation flows remain test-backed and aligned with documented data shapes.

- **Factory Pattern for Polymorphic Assignment Creation** (FOUNDATIONAL - REQUIRED FIRST)
  - **Factory Pattern for Polymorphic Assignment Creation** (COMPLETED)
    - Concise summary (completed):
      - Implemented `Assignment.create(...)` factory and `Assignment.fromJSON(...)` routing with legacy fallback and ABLogger warnings for invalid types.
      - Added `SlidesAssignment.fromJSON` / `SheetsAssignment.fromJSON` and overridden `toJSON()` in subclasses to include `documentType`, `referenceDocumentId` and `templateDocumentId`.
      - Base `toJSON()` continues to exclude transient fields; added `toPartialJSON()` and `_hydrationLevel` (transient) to support lightweight summaries.
      - Updated `ABClass.fromJSON()` to reconstruct typed Assignment instances and added `ABClass.findAssignmentIndex()` helper.
      - Added `ABClassController.persistAssignmentRun()` and `rehydrateAssignment()` (collection name pattern `assign_full_<courseId>_<assignmentId>`) with logging and error handling.
      - Tests: new factory/serialization tests and test helpers (avoid GAS in tests), plus updates to existing suites to use `fromJSON()` round-trips.
      - Docs: `DATA_SHAPES.md`, rehydration/how‑tos updated with migration notes for legacy data.
    - The long checklist for this section is now complete; keep this summary for reference.

- **Assignment Model Serialisation** (COMPLETED)
  - Override `toJSON()` in `SlidesAssignment` and `SheetsAssignment` to:
    - Call `super.toJSON()` to get base fields.
    - Add subclass-specific fields: `documentType`, `referenceDocumentId`, `templateDocumentId`.
    - Return merged object containing both base and subclass fields.
  - Ensure base `Assignment.toJSON()` explicitly excludes transient fields (`students`, `progressTracker`) even if present at runtime (already implemented but verify).
  - Add optional `_hydrationLevel` transient property ('full' or 'partial') to track hydration state without persisting it. Never include in `toJSON()` output.

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
  - **CRITICAL**: Update `ABClass.fromJSON()` to reconstruct Assignment objects instead of leaving them as plain objects:
    - Change `inst.assignments = Array.isArray(json.assignments) ? json.assignments.slice() : []`
    - To: `inst.assignments = Array.isArray(json.assignments) ? json.assignments.map(a => Assignment.fromJSON(a)) : []`
    - Wrap in try-catch to handle corrupt assignment data gracefully, logging errors via `ABLogger` and falling back to plain object if reconstruction fails.
  - Update/extend unit tests (`tests/models/abclassManager.*`) to verify that assignments round-trip correctly with polymorphic types preserved and are properly reconstructed as typed instances (not plain objects).

- **Persistence Workflow (ABClassController)**
  - **Rationale**: We split persistence to keep `ABClass` lightweight for analysis while preserving full context in a separate document for assessment runs.
  - Add `_getFullAssignmentCollectionName(courseId, assignmentId)` private helper method that returns the consistent collection name pattern: `assign_full_${courseId}_${assignmentId}`.
  - Add `persistAssignmentRun(abClass, assignment)` to `src/AdminSheet/y_controllers/ABClassController.js` that:
    1. Serialises the assignment to a **Full** payload via `assignment.toJSON()` and writes it to the full assignment collection (using `replaceOne` or `insertOne` + `save()`).
    2. Generates **Partial** summary via `assignment.toPartialJSON()`.
    3. Uses `Assignment.fromJSON(partialJson)` (factory pattern) to create a properly-typed partial instance.
    4. Finds and replaces the assignment in `abClass.assignments` by index (using `findAssignmentIndex`).
    5. Calls `saveClass(abClass)` to persist the updated class document with the partial assignment summary.
  - Introduce `rehydrateAssignment(abClass, assignmentId)` that:
    1. Reads the full assignment document from its collection.
    2. Uses `Assignment.fromJSON(doc)` (factory pattern) to reconstruct the correct subclass instance.
    3. Sets `assignment._hydrationLevel = 'full'` to mark as fully hydrated.
    4. Replaces the assignment in `abClass.assignments` by index and returns the hydrated instance.
    5. Throws clear errors when collection is missing, empty, or contains corrupt data.
  - Add logging via `ABLogger` for all persistence operations (write, read, rehydrate) following existing error-handling patterns.

- **AssignmentController Integration**
  - In `src/AdminSheet/y_controllers/AssignmentController.js`, update the creation flow to use the factory pattern:
    - Modify `createAssignmentInstance()` to call `Assignment.create(documentType, ...)` instead of `new AssignmentClass(...)`.
    - Remove the `AssignmentClass` parameter and replace with `documentType` parameter.
    - Note: The conditional routing in `processSelectedAssignment()` (lines ~275-296) remains necessary to call `processSlidesAssignment` vs `processSheetsAssignment` as these have different processing pipelines. The factory centralizes instantiation logic but doesn't eliminate all type-based conditionals.
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
      - Base `Assignment.toJSON()` already excludes transient fields - verify this remains true.
      - `toPartialJSON()` nulls out heavy fields while preserving structure.
      - Transient fields (`students`, `progressTracker`, `_hydrationLevel`) are never serialised.
    - `tests/models/abclass.assignment.test.js` validating:
      - `ABClass.toJSON()` serialises assignments with all subclass fields.
      - `ABClass.fromJSON()` reconstructs assignments as proper typed instances (not plain objects).
      - Round-trip preserves assignment types and polymorphic fields.
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
    - `documentType`, `referenceDocumentId`, `templateDocumentId` in all assignment examples (both SlidesAssignment and SheetsAssignment).
    - Clear examples of full vs partial hydration showing nulled fields in artifacts.
    - Note that `_hydrationLevel` is transient and never persisted.
    - Clarify that subclasses set `documentType` in their constructors (not passed as parameter).
  - Update `docs/developer/rehydration.md` with:
    - Factory pattern usage: `Assignment.create()` centralizes type-to-class mapping that mirrors `Assignment.fromJSON()` routing logic.
    - Explain that factory doesn't eliminate conditionals but centralizes type discrimination alongside deserialization.
    - Immutable replace contract using `findAssignmentIndex`.
    - Collection naming convention: `assign_full_${courseId}_${assignmentId}`.
    - Persistence workflow: full assignment to dedicated collection, partial summary in ABClass.
  - Update `docs/howTos/rehydration.md` with practical examples showing:
    - How to use `abClassController.persistAssignmentRun()` and `rehydrateAssignment()`.
    - When to trigger rehydration (re-running assessments, exports, audits).
    - Error scenarios and recovery strategies.
    - Migration path for existing data without documentType field.
