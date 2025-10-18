# Assignment Persistence TODO

## Intended Outcome

Deliver end-to-end assignment persistence using JsonDbApp so that:

- Each assessment run writes an immutable full-fidelity record to `assign_full_<courseId>_<assignmentId>`.
- `ABClass.assignments` maintains lightweight summaries suitable for fast loading.
- Controllers can rehydrate full assignments on demand without schema drift or duplicate roster data.
- Serialisation/deserialisation flows remain test-backed and aligned with documented data shapes.

- **Assignment Model Serialisation**

  - Extend `src/AdminSheet/AssignmentProcessor/Assignment.js` to expose `documentType`, `referenceDocumentId`, `templateDocumentId`, ensure `toJSON()` emits them, and update `fromJSON()` to restore them alongside a `_hydrationLevel` flag.
  - Override `toJSON()`/`fromJSON()` in `SlidesAssignment` and `SheetsAssignment` (or via shared utility) so subclass-specific fields persist correctly without duplicating base logic.
  - Add minimal helpers on `Assignment` (for example `markHydrationLevel`) to tag instances while keeping transient data (`students`, `progressTracker`) out of persisted payloads.

- **Serializer Utility**

  - Create `src/AdminSheet/AssignmentProcessor/AssignmentSerializer.js` that builds deep-cloned payloads via an assignment instance, stripping runtime-only attributes and distinguishing between:
    - A full payload (exact `toJSON()` output, minus transient properties).
    - A partial summary where heavy fields (`artifact.content`, `contentHash`, large metadata) are replaced with `null` while identifiers, metadata shells, assessments, and feedback remain intact.
  - Provide a `rehydrate(json)` entry point that instantiates the correct assignment subclass and tags the resulting instance with `_hydrationLevel`.

- **ABClass Enhancements**

  - Implement an `upsertAssignmentSummary(summaryJson)` helper in `src/AdminSheet/Models/ABClass.js` to replace or append partial assignment records by `assignmentId`, keeping `assignments` serialisable.
  - Update/extend unit tests (for example `tests/models/abclassManager.*`) to cover the new helper and guarantee schema stability.

- **Persistence Workflow (ABClassController)**

  - Add `persistAssignmentRun(abClass, assignment)` to `src/AdminSheet/y_controllers/ABClassController.js` that:
    1. Serialises the assignment to a full payload and writes it to `assign_full_<courseId>_<assignmentId>` (replace existing doc, then `save()` the collection).
    2. Generates the partial summary, calls `abClass.upsertAssignmentSummary(...)`, and reuses `saveClass` to persist the refreshed class document.
  - Introduce `rehydrateAssignment(abClass, assignmentId)` that reads the full collection document, rehydrates an assignment instance, marks it as full, replaces the in-memory entry by index, and throws when data is missing or corrupt.
  - Add small helpers inside the controller for consistent collection naming and logging that fit the existing error-handling contract.

- **AssignmentController Integration**

  - In `src/AdminSheet/y_controllers/AssignmentController.js`, replace the direct `abClass.addAssignment(assignment)` call with `abClassController.persistAssignmentRun(abClass, assignment)` after `assignment.touchUpdated()`.
  - Ensure the persisted summary keeps UI flows intact, while the in-memory `assignment` retains full data for downstream analysis/feedback generation.

- **Database Utilities**

  - Optionally extend `src/AdminSheet/DbManager/DbManager.js` with a concise helper (for example `replaceOneById`) if persistence code becomes noisy, keeping in line with existing patterns.

- **Testing Coverage**

  - Add new Vitest suites:
    - `tests/assignment/assignmentSerializer.test.js` for full vs partial serialisation and hydration flags.
    - `tests/controllers/abclassController.persistAssignment.test.js` (or similar) validating DB interactions with mocks, summary upserts, and error handling.
    - `tests/controllers/abclassController.rehydrateAssignment.test.js` covering success and failure paths.
  - Update existing assignment-related tests to assert new fields (`documentType`, `referenceDocumentId`, `templateDocumentId`) survive round-tripping.

- **Documentation & Contracts**
  - Refresh `docs/developer/DATA_SHAPES.md` and `docs/developer/rehydration.md` with the implemented fields, `_hydrationLevel`, and the immutable replace contract.
  - Capture the new persistence workflow in `docs/howTos/rehydration.md` (collection naming, controller entry points) so future contributors stay aligned.
