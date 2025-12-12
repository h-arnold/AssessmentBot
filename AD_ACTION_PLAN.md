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

6. **UI path relies on definition keys**
   - Update SlideIdsModal and AssignmentDropdown flows to stop passing/storing raw document IDs; route through controller endpoints that return the definitionKey, and persist only that key in properties.
   - Files: src/AdminSheet/UI/SlideIdsModal.html, src/AdminSheet/UI/AssignmentDropdown.html, any UIManager plumbing that bridges to saveStartAndShowProgress/openReferenceSlideModal, tests/ui/\*.test.js (if present).

7. **Drive timestamp + parsing flow**
   - Ensure DriveManager.getFileModifiedTime continues to feed staleness checks; add tests around definition refresh using the split stores to prove the full definition is persisted when parsed.
   - Files: src/AdminSheet/GoogleDriveManager/DriveManager.js, tests/googleDriveManager/driveManager\*.test.js.

8. **Docs and testing coverage**
   - Keep DATA_SHAPES and ASSIGNMENT_METADATA_SPEC aligned with the new dual-store pattern; add regression tests to confirm full definitions are written/read and partial embeddings stay redacted.
   - Files: docs/developer/DATA_SHAPES.md, ASSIGNMENT_METADATA_SPEC.md, relevant Vitest suites under tests/.

## Test Coverage Requirements

### Tests Updated

- ✅ `tests/controllers/assignmentDefinitionController.test.js` — Validates dual-store writes, ensureDefinition refresh logic, topic resolution
- ✅ `tests/models/assignmentDefinition.test.js` — Validates toJSON vs toPartialJSON redaction, serialization/deserialization
- ✅ `tests/assignment/assignmentFactory.test.js` — Verified factory/fromJSON uses embedded definitions correctly
- ✅ `tests/assignment/assignmentSerialisation.test.js` — Verified toJSON/toPartialJSON serialisation forms
- ✅ `tests/controllers/abclassController.persistAssignment.test.js` — Verified dual-store persistence pattern
- ✅ `tests/controllers/abclassController.rehydrateAssignment.test.js` — Verified full definition fetching during rehydration

### Tests to Update

- ⏳ `tests/ui/slideIdsModal.test.js` — Expect saveStartAndShowProgress call to use returned `definitionKey`, not raw document ids; update mocks accordingly (pending Stage 6 UI updates).

### Tests to Add

- ⏳ `tests/controllers/assignmentDefinitionController.fullStore.test.js` — Assure named full-definition collection write/read semantics and that parsing persists full payload.
- ⏳ `tests/controllers/assignmentController.hydration.test.js` — Confirm `processSelectedAssignment` fetches full definition synchronously and uses it for parsing/processing.
- ⏳ `tests/googleDriveManager/driveManager.definitionRefresh.test.js` — Integration between `DriveManager.getFileModifiedTime` and definition refresh logic.

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

### Data Flow

1. Controller calls `ensureDefinition()` with doc IDs and metadata
2. Controller generates definitionKey via `AssignmentDefinition.buildDefinitionKey()`
3. Fetch full definition from `assdef_full_<definitionKey>`
4. Compare Drive timestamps; re-parse if stale
5. Save to both full collection and partial registry
6. Return full AssignmentDefinition instance to caller
