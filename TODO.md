# Assignment Persistence TODO

## Intended Outcome

Deliver end-to-end assignment persistence using JsonDbApp so that:

- Each assessment run writes an immutable full-fidelity record to `assign_full_<courseId>_<assignmentId>`.
- `ABClass.assignments` maintains lightweight summaries suitable for fast loading.
- Controllers can rehydrate full assignments on demand without schema drift or duplicate roster data.
- Serialisation/deserialisation flows remain test-backed and aligned with documented data shapes.

- **Factory Pattern for Polymorphic Assignment Creation** (FOUNDATIONAL - REQUIRED FIRST)
  - Add `documentType` field to base `Assignment` class as a property (string: 'SLIDES' or 'SHEETS'). Subclasses set this in their constructors (e.g., `this.documentType = 'SLIDES'`), not via constructor parameter.
  - Add static `Assignment.create(documentType, courseId, assignmentId, referenceDocumentId, templateDocumentId)` factory method that instantiates the correct subclass based on `documentType`. This centralizes type-to-class mapping logic in one location alongside deserialization.
    - Throw clear error for unknown/invalid documentType values.
    - Perform basic validation (null/undefined checks) on documentType parameter.
  - Refactor existing `Assignment.fromJSON(data)` to become `Assignment._baseFromJSON(data)` (internal helper for base fields only).
  - Implement new `Assignment.fromJSON(data)` that checks `data.documentType` and routes to appropriate subclass `fromJSON()` (e.g., `SlidesAssignment.fromJSON(data)`). Include fallback handling for legacy data without `documentType` field.
    - Route to `SlidesAssignment.fromJSON(data)` when `data.documentType === 'SLIDES'`.
    - Route to `SheetsAssignment.fromJSON(data)` when `data.documentType === 'SHEETS'`.
    - **Legacy fallback**: When `data.documentType` is missing/undefined, call `Assignment._baseFromJSON(data)` to create base Assignment instance (backward compatibility).
    - **Invalid documentType**: Log warning via ABLogger and fall back to base Assignment (graceful degradation).
  - Add `SlidesAssignment.fromJSON(data)` and `SheetsAssignment.fromJSON(data)` static methods that:
    - Call `Assignment._baseFromJSON(data)` to restore base fields or manually reconstruct via `Object.create(SlidesAssignment.prototype)` / `Object.create(SheetsAssignment.prototype)`.
    - Explicitly restore `referenceDocumentId`, `templateDocumentId`, and `documentType` fields.
    - Return properly typed subclass instances with all fields populated.
  - Override `toJSON()` in `SlidesAssignment` and `SheetsAssignment` to include subclass-specific fields:
    - Call `super.toJSON()` to get base fields.
    - Merge in `{ documentType: this.documentType, referenceDocumentId: this.referenceDocumentId, templateDocumentId: this.templateDocumentId }`.
    - Return merged object.
  - Update `AssignmentController.createAssignmentInstance()` to use `Assignment.create(documentType, ...)` factory method, centralizing type-based instantiation logic that mirrors deserialization routing.
  - Add unit tests for factory creation and polymorphic deserialization covering both SLIDES and SHEETS types, including legacy data without `documentType`.

  - **Testing Plan:**
    - **Key Principles:**
      - Use `fromJSON()` in test factory functions to avoid constructor GAS service calls.
      - Test both happy paths and error cases (invalid documentType, malformed data).
      - Verify transient field exclusion (students, progressTracker, \_hydrationLevel).
      - Test legacy fallback for backward compatibility.
      - Use `test.each` patterns to reduce duplication in round-trip tests.
      - Focus on serialization/deserialization logic, not GAS API interactions.
    - [x] **Update `tests/helpers/modelFactories.js`:**
      - [x] Add `createSlidesAssignment(props)` and `createSheetsAssignment(props)` helper functions to ensure tests are DRY and setup is consistent.
      - [x] **CRITICAL**: Factory functions must use `Assignment.fromJSON()` internally (not constructors) to avoid GAS service calls (`fetchAssignmentName` → `Classroom.Courses.CourseWork.get`).
      - [x] Provide sensible defaults: `courseId='c1'`, `assignmentId='a1'`, `referenceDocumentId='ref1'`, `templateDocumentId='tpl1'`, `assignmentName='Test Assignment'`, `documentType='SLIDES'|'SHEETS'`.
      - [x] Accept props object with overrides for all fields plus nested data (tasks, submissions).
  - [x] **Example implementation pattern**:

        ```javascript
        function createSlidesAssignment(props = {}) {
          const {
            courseId = 'c1',
            assignmentId = 'a1',
            referenceDocumentId = 'ref1',
            templateDocumentId = 'tpl1',
            assignmentName = 'Test Slides Assignment',
            tasks = {},
            submissions = [],
            ...rest
          } = props;

          return Assignment.fromJSON({
            courseId,
            assignmentId,
            referenceDocumentId,
            templateDocumentId,
            assignmentName,
            documentType: 'SLIDES',
            tasks,
            submissions,
            ...rest,
          });
        }
        ```

    - [x] **Create new test suite `tests/assignment/assignmentFactory.test.js`:**
      - [x] **`Assignment.create()` Factory Method:**
        - [x] `it('should create a SlidesAssignment for documentType SLIDES')`
        - [x] `it('should create a SheetsAssignment for documentType SHEETS')`
        - [x] `it('should throw an error for an unknown documentType')`
        - [x] `it('should throw for null/undefined documentType')`
        - [x] `it('should pass all constructor arguments correctly to the subclass')`
        - [x] `it('should set documentType field on created instance')`
        - [x] `it('should return instance of correct subclass (instanceof check)')`
        - [ ] **Note**: These tests will invoke constructors and require proper Classroom API mocks. Consider whether testing via `fromJSON()` polymorphism is sufficient.
      - [x] **`Assignment.fromJSON()` Polymorphic Deserialization:**
        - [x] `it('should deserialize to a SlidesAssignment when data.documentType is SLIDES')`
        - [x] `it('should deserialize to a SheetsAssignment when data.documentType is SHEETS')`
        - [x] `it('should fall back to creating a base Assignment for legacy data without a documentType')`
        - [x] `it('should correctly restore all base properties (courseId, assignmentId, assignmentName, etc.)')`
        - [x] `it('should correctly restore subclass-specific properties (referenceDocumentId, templateDocumentId)')`

  - [x] `it('should throw or fallback gracefully for invalid documentType (e.g., "INVALID")')`
  - [x] `it('should handle malformed data (null, undefined, empty object) with clear error messages')`
  - [x] `it('should exclude transient fields (students, progressTracker, _hydrationLevel) from deserialization')`
  - [x] `it('should verify transient fields are never present in deserialized JSON')`
    - [x] **Polymorphic Round-Trip:**
      - [x] `it('should preserve type and data for a SlidesAssignment after a toJSON() -> fromJSON() round-trip')` - verify instanceof, documentType, referenceDocumentId, templateDocumentId.
      - [x] `it('should preserve type and data for a SheetsAssignment after a toJSON() -> fromJSON() round-trip')` - verify instanceof, documentType, referenceDocumentId, templateDocumentId.
  - [ ] **DRY alternative**: Use `test.each([['SLIDES', SlidesAssignment], ['SHEETS', SheetsAssignment]])` pattern to reduce duplication.
  - [x] `it('should preserve complex nested data (tasks with artifacts, submissions with items) through round-trip')` - [x] `it('should explicitly verify documentType field survives round-trip')`
    - [x] **Subclass-Specific Serialization:**
      - [x] `it('should include documentType, referenceDocumentId, templateDocumentId in SlidesAssignment.toJSON()')`
      - [x] `it('should include documentType, referenceDocumentId, templateDocumentId in SheetsAssignment.toJSON()')`
  - [x] `it('should call super.toJSON() and merge subclass fields')`
    - [ ] **Transient Field Exclusion:**
  - [x] `it('should not serialize students array even if present at runtime')`
  - [x] `it('should not serialize progressTracker even if present')`
  - [x] `it('should not serialize _hydrationLevel even if present')`
    - [ ] **Update Existing Tests:**
      - [x] Review `tests/requestHandlers/assignmentPhase3.test.js`:
        - [x] Currently calls `new Assignment(...)` directly which will break (Classroom API call).
        - [x] Either add comprehensive Classroom/DriveApp mocks or refactor to use `Assignment.fromJSON()`.
        - [x] If updating to use factory pattern, ensure mocks for `AssignmentController`'s dependencies are correct.
      - [x] Review `tests/assignment/assignmentLastUpdated.test.js`:
        - [x] Currently uses `Assignment.fromJSON()` without `documentType` - this will test **legacy fallback** path.
        - [x] Add explicit test: `it('should support legacy data without documentType (creates base Assignment)')`.
        - [x] Verify that lastUpdated behavior works identically for base Assignment and subclasses.
        - [x] Optionally add variant tests using `createSlidesAssignment()` and `createSheetsAssignment()` to verify subclass behavior.

- **Assignment Model Serialisation**
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
      - **Legacy data handling**: fromJSON with missing documentType field falls back gracefully.
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
    - Document backward compatibility: legacy data without `documentType` handled by fallback in `fromJSON()`.
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
