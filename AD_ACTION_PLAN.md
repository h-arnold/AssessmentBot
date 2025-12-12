# Assignment Definition Hydration Action Plan

## Implementation Status

### ✅ Completed Stages

#### 1. **Model dual-hydration support** — COMPLETE

**Current State:**

- `AssignmentDefinition` provides `toJSON()` for full serialization (includes all artifact content and hashes)
- `AssignmentDefinition` provides `toPartialJSON()` for lightweight serialization (redacts artifact `content` and `contentHash` to null)
- No runtime hydration state tracking; serialization form determined purely by which method is called
- `_redactArtifact()` and `_redactTask()` static helpers strip heavy payload from artifacts
- Constructor validates required fields (primaryTitle, primaryTopic, documentType, doc IDs) and throws on missing data
- All tests passing in `tests/models/assignmentDefinition.test.js`

**Files:** src/AdminSheet/Models/AssignmentDefinition.js, tests/models/assignmentDefinition.test.js

#### 2. **Definition persistence split (registry + full store)** — COMPLETE

**Current State:**

- `AssignmentDefinitionController` implements dual-store pattern:
  - **Partial registry:** `assignment_definitions` collection stores lightweight definitions for fast lookup and embedding
  - **Full store:** `assdef_full_<definitionKey>` dedicated collections store complete definitions with all artifacts
- `getDefinitionByKey(definitionKey, { form })` fetches from full store by default (`form: 'full'`), optional `form: 'partial'` for registry
- `saveDefinition(definition)` synchronously upserts both full collection and partial registry
- `savePartialDefinition(definition)` upserts only the registry (used when full already persisted)
- `ensureDefinition()` orchestrates:
  - Topic name resolution (via ClassroomApiClient or fails fast if missing)
  - Drive timestamp fetching for staleness detection
  - Single DB query (fetches full definition only)
  - Refresh logic when Drive files newer than stored timestamps
  - Task parsing via SlidesParser/SheetsParser when refresh needed
  - Synchronous dual-store persistence
- Naming helpers: `_getFullCollectionName(definitionKey)`, `_getFullCollection(definitionKey)`
- All tests passing in `tests/controllers/assignmentDefinitionController.test.js`

**Files:** src/AdminSheet/y_controllers/AssignmentDefinitionController.js, tests/controllers/assignmentDefinitionController.test.js

#### 3. **Assignment load/save alignment** — COMPLETE

**Current State:**

- `Assignment.toJSON()` correctly calls `assignmentDefinition.toJSON()` for full serialisation (no invalid parameters)
- `Assignment.toPartialJSON()` correctly calls `assignmentDefinition.toPartialJSON()` for redacted serialisation
- Assignments never downgrade hydrated definitions to redacted when persisting full assignments
- `Assignment.fromJSON()` reconstructs with embedded definitions (partial or full based on source)
- Legacy alias properties (`documentType`, `referenceDocumentId`, `templateDocumentId`, `tasks`) maintained for backward compatibility
- Code quality improvements: replaced `Object.prototype.hasOwnProperty.call()` with `Object.hasOwn()`
- All existing tests passing in `tests/assignment/*.test.js`

**Files:** src/AdminSheet/AssignmentProcessor/Assignment.js, tests/assignment/assignmentSerialisation.test.js, tests/assignment/assignmentFactory.test.js

#### 4. **Run orchestration uses full definitions** — COMPLETE

**Current State:**

- `AssignmentController.processSelectedAssignment()` fetches full definition from `assdef_full_<definitionKey>` via `getDefinitionByKey(definitionKey, { form: 'full' })`
- `runAssignmentPipeline()` performs staleness checks comparing Drive timestamps against stored definition timestamps
- When stale, re-parses tasks and immediately persists updated definition to both full store and partial registry via `saveDefinition()`
- `startProcessing()` stores only `definitionKey` in DocumentProperties (no doc IDs or documentType)
- `ensureDefinitionFromInputs()` orchestrates definition creation/retrieval and returns definition key for persistence
- All existing tests passing

**Files:** src/AdminSheet/y_controllers/AssignmentController.js, tests/controllers/initController.test.js

#### 5. **ABClass persistence hooks** — COMPLETE

**Current State:**

- `persistAssignmentRun()` implements dual-store pattern correctly:
  - Full assignment with full definition → dedicated `assign_full_<courseId>_<assignmentId>` collection
  - Partial assignment with partial definition → ABClass.assignments array
- `rehydrateAssignment()` loads full assignment from dedicated collection and ensures full definition from `assdef_full_<definitionKey>`
- Refactored `rehydrateAssignment()` to reduce cognitive complexity (extracted helper methods: `_loadFullAssignmentDocument()`, `_validateAssignmentDocument()`, `_ensureFullDefinition()`, `_replaceAssignmentInClass()`)
- Hydration level markers (`_hydrationLevel`) correctly set to 'full' or 'partial' (transient, never persisted)
- All tests passing in `tests/controllers/abclassController.persistAssignment.test.js` and `tests/controllers/abclassController.rehydrateAssignment.test.js`

**Files:** src/AdminSheet/y_controllers/ABClassController.js, tests/controllers/abclassController.persistAssignment.test.js, tests/controllers/abclassController.rehydrateAssignment.test.js

### 🔲 Pending Stages

_All stages complete!_

### ✅ Stage 6 Complete: UI path relies on definition keys

**Completed Changes:**

- Updated `saveStartAndShowProgress` signature to remove redundant `referenceDocumentId` and `templateDocumentId` parameters (now only in `documentIds` object)
- Updated [SlideIdsModal.html](src/AdminSheet/UI/SlideIdsModal.html) to call `saveStartAndShowProgress` with simplified signature
- Updated [AssignmentController.js](src/AdminSheet/y_controllers/AssignmentController.js) to pass `documentIds` directly to `ensureDefinitionFromInputs`
- Updated global wrappers in:
  - [src/AdminSheet/AssignmentProcessor/globals.js](src/AdminSheet/AssignmentProcessor/globals.js)
  - [src/AssessmentRecordTemplate/menus/assignment.js](src/AssessmentRecordTemplate/menus/assignment.js)
- Updated [tests/ui/slideIdsModal.test.js](tests/ui/slideIdsModal.test.js) to assert correct parameter usage (3 params instead of 5)
- All 386 tests passing
- No linting errors
- Code adheres to all coding standards (British English, no defensive guards, proper error handling, JSDoc)

**Technical Details:**

- UI modals already correctly use definition keys via `openReferenceSlideModal` which fetches existing definitions to pre-fill forms
- `saveDocumentIdsForAssignment` already returns `definitionKey` (no changes needed)
- `startProcessing` already stores only `definitionKey` in DocumentProperties (no raw document IDs)
- Assignment pipeline correctly fetches full definitions from `assdef_full_<definitionKey>` collections

7. **Drive timestamp + parsing flow**

- ✅ Test coverage added for `DriveManager.getFileModifiedTime` integration with definition refresh logic
- ✅ Implementation validation completed - Drive timestamp staleness checks exercised and validated under test (see `tests/googleDriveManager/driveManager.definitionRefresh.test.js`)
- Files: src/AdminSheet/GoogleDriveManager/DriveManager.js, tests/googleDriveManager/driveManager.definitionRefresh.test.js (✅ complete)

8. **Docs and testing coverage**

- ✅ DATA_SHAPES.md and ASSIGNMENT_METADATA_SPEC.md already aligned with dual-store pattern
- ✅ Test suites added for full store semantics and hydration patterns
- ✅ Regression test validation completed - full test suite (386 tests) passes with no skipped tests after unskipping and implementing additional controller tests
- Files: docs/developer/DATA_SHAPES.md (✅ aligned), ASSIGNMENT_METADATA_SPEC.md (✅ aligned), tests/ (✅ tests added)

### 📝 Summary Status

**Completed (Stages 1-6, 7-8):**

- ✅ Model dual-hydration support
- ✅ Definition persistence split (registry + full store)
- ✅ Assignment load/save alignment
- ✅ Run orchestration uses full definitions
- ✅ ABClass persistence hooks
- ✅ UI updates to use definition keys
- ✅ Test coverage for core functionality

**All Stages Complete!**

The Assignment Definition Hydration refactoring is now fully complete. All stages have been implemented and tested successfully.

## Test Coverage Requirements

### Tests Updated

- ✅ `tests/controllers/assignmentDefinitionController.test.js` — Validates dual-store writes, ensureDefinition refresh logic, topic resolution
- ✅ `tests/models/assignmentDefinition.test.js` — Validates toJSON vs toPartialJSON redaction, serialization/deserialization
- ✅ `tests/assignment/assignmentFactory.test.js` — Verified factory/fromJSON uses embedded definitions correctly
- ✅ `tests/assignment/assignmentSerialisation.test.js` — Verified toJSON/toPartialJSON serialisation forms
- ✅ `tests/controllers/abclassController.persistAssignment.test.js` — Verified dual-store persistence pattern
- ✅ `tests/controllers/abclassController.rehydrateAssignment.test.js` — Verified full definition fetching during rehydration
- ✅ `tests/controllers/assignmentDefinitionController.fullStore.test.js` — Unskipped and implemented integration-style tests to validate saving to the full-definition collection and the partial registry
- ✅ `tests/controllers/assignmentController.hydration.test.js` — Updated to assert correct usage of full-definition hydrated instances and fixed harness mocks (Assignment.create, DriveManager, and assignment pipeline methods)
- ✅ `tests/ui/slideIdsModal.test.js` — Updated to assert `saveStartAndShowProgress` called with 3 parameters (assignmentTitle, documentIds, assignmentId) instead of 5

### Tests to Add

- ✅ `tests/controllers/assignmentDefinitionController.fullStore.test.js` — Assure named full-definition collection write/read semantics and that parsing persists full payload.
- ✅ `tests/controllers/assignmentController.hydration.test.js` — Confirm `processSelectedAssignment` fetches full definition synchronously and uses it for parsing/processing.
- ✅ `tests/googleDriveManager/driveManager.definitionRefresh.test.js` — Integration between `DriveManager.getFileModifiedTime` and definition refresh logic.
- ✅ `tests/controllers/assignmentDefinitionController.fullStore.test.js` (unskipped) — validated previously skipped scenarios for registry and full collection writes.

### Tests Removed

- None: existing suites updated to reflect new dual-store behaviour.

## Technical Notes

### Key Implementation Decisions

1. **No runtime hydration tracking:** Removed complex three-state hydration machinery in favor of structural serialization (toJSON vs toPartialJSON)
2. **Single DB query in ensureDefinition:** Fetches only full definition; partial registry updated via saveDefinition
3. **Fail-fast on missing topics:** No silent fallbacks; surface errors via ProgressTracker for teacher intervention
4. **Utils.definitionNeedsRefresh:** Checks for empty tasks, missing timestamps, or newer Drive file modifications

### Integration Points

- `DriveManager.getFileModifiedTime()` provides timestamps for staleness detection
- `ClassroomApiClient.fetchTopicName()` enriches topic metadata when only topicId available
- `SlidesParser`/`SheetsParser` extract TaskDefinitions during refresh
- `Utils.definitionNeedsRefresh()` centralizes staleness logic

### Regression/Test Fix Notes

- Unskipped and implemented previously skipped `assignmentDefinitionController.fullStore` tests to verify `saveDefinition()` writes to both full store and partial registry as expected (insert vs replace semantics).
- Fixed and extended `assignmentController.hydration.test.js` mocks to include `Assignment.create`, `DriveManager.getFileModifiedTime`, and missing assignment methods used by the pipeline (`fetchSubmittedDocuments`, `processAllSubmissions`, `assessResponses`).
- Updated assertions in tests to assert correct usage of `insertOne` vs `replaceOne` and registry partial payload redaction (`content`/`contentHash` set to null in registry).

### Data Flow

1. Controller calls `ensureDefinition()` with doc IDs and metadata
2. Controller generates definitionKey via `AssignmentDefinition.buildDefinitionKey()`
3. Fetch full definition from `assdef_full_<definitionKey>`
4. Compare Drive timestamps; re-parse if stale
5. Save to both full collection and partial registry
6. Return full AssignmentDefinition instance to caller
