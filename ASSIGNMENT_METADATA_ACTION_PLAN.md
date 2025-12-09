# Assignment Definition Action Plan

## Sequenced Tasks

1. **Model Definition**: Create `AssignmentDefinition` class.

- Fields: `primaryTitle`, `primaryTopic`, `yearGroup` (nullable), `alternateTitles`, `alternateTopics`, document type, doc IDs, Drive timestamp snapshots, weighting, `tasks`, and created/updated timestamps.
- Methods: `toJSON`, `fromJSON`, `toPartialJSON` (redacts artifact `content` field), plus helpers for composite-key generation and timestamp updates.
- Validation: Ensure title, topic, documentType, and doc IDs are present. Validate `yearGroup` only when provided (null is acceptable for fresh definitions).
- Location: `src/AdminSheet/Models/AssignmentDefinition.js`

2. **Controller**: Create `AssignmentDefinitionController`.

- **Responsibility:** CRUD for `AssignmentDefinition`, topic-name enrichment, and Drive timestamp reconciliation (no legacy migration path).
- **Dependencies:** `DbManager` (for `assignment_definitions` collection), Classroom API (`ClassroomApiClient`) for topic enrichment, `DriveManager` for timestamp helpers.
- **Methods:**
  - `ensureDefinition({ primaryTitle, primaryTopic, topicId, yearGroup, documentType, referenceDocumentId, templateDocumentId })`: Sole entry point for fetching or constructing definitions; generates the composite key internally so callers never duplicate key logic.
  - `getDefinitionByKey(definitionKey)`
  - `saveDefinition(def)`
- **Key Generation:** `${primaryTitle}_${primaryTopic}_${yearGroup || 'null'}` (use the class yearGroup whenever available; only fall back to literal `null` when no yearGroup data exists)
- Location: `src/AdminSheet/y_controllers/AssignmentDefinitionController.js`

3. **Assignment Refactor**: Update `Assignment` class, subclasses, and every consumer.
   - Add `assignmentDefinition` property (embedded copy) and treat it as the single source of truth for tasks, doc IDs, weighting, and document type.
   - Remove `assignment.tasks`, `assignment.assignmentWeighting`, and `assignment.documentType`; reroute all internal helpers to reference `assignment.assignmentDefinition`.
   - Update `toJSON`/`toPartialJSON`/`fromJSON`/`_baseFromJSON()` to serialise and hydrate the embedded definition, ensuring backwards compatibility is not required (hard cut-over).
   - **Subclass Updates:**
     - Remove `referenceDocumentId`, `templateDocumentId`, and `documentType` storage from `SlidesAssignment`/`SheetsAssignment`; delegate to the definition.
     - Update subclass `populateTasks`, `fetchSubmittedDocuments`, `processAllSubmissions`, and serialisation helpers to expect the definition fields.
   - **Consumer Updates (non-exhaustive but mandatory):**
     - `AnalysisSheetManager`, `LLMRequestManager`, `ImageManager`, `SheetsFeedback`, `AssignmentController`, `ABClassController` (serialization flows), and any other module/tests referencing `assignment.tasks`, doc IDs, or document type must be updated to dereference `assignment.assignmentDefinition`.

4. **Definition Lifecycle & Topic Enrichment**:
   - Implement definition orchestration inside `AssignmentDefinitionController.ensureDefinition()`.
   - Logic:
     - Generate the composite key using the canonical title/topic/yearGroup triple, defaulting to the `ABClass.yearGroup` when present (topic name fetched via Classroom API when only `topicId` is available). Only use `null` for yearGroup when the class metadata is absent.
     - Attempt to read from the `assignment_definitions` collection; if found, verify Drive timestamps before returning.
     - If missing or stale, parse the reference/template documents, update `tasks`, `referenceLastModified`, `templateLastModified`, and immediately persist the shared definition (mutating the canonical stored record).
     - Every mutation triggered by parsing must call `saveDefinition` straight away so all subsequent assignments read the refreshed data.
     - No ScriptProperties or legacy fallbacks are required; this is a greenfield definition store.

5. **Controller, Manager & API Updates**:
   - **ClassroomApiClient**:
     - Add helpers to fetch topic metadata (`fetchTopicName` or similar) via `Classroom.Courses.Topics.list/get`.
     - Ensure required scopes/config are documented and that failures surface meaningful errors via `ProgressTracker.logError` (no silent fallbacks to IDs or optional chaining guards around singletons).
   - **DriveManager**: Add `getFileModifiedTime(fileId)` static method:
     - Returns ISO 8601 string of file's last modified timestamp.
     - Use retry logic (3 attempts, exponential backoff) matching `getParentFolderId()` pattern.
     - Try `DriveApp.getFileById(fileId).getLastUpdated()` first.
     - Fallback to Advanced Drive API (`Drive.Files.get(fileId, {supportsAllDrives: true, fields: 'modifiedTime'})`).
     - On repeated failures, surface errors through `ProgressTracker.logError` before throwing so users see actionable context.
   - **AssignmentController.saveStartAndShowProgress()** (and the GAS globals / Assessment Record menu shims):
     - Accept only the assignment identifiers and doc IDs from the UI, then internally resolve course/topic/year group context before invoking `AssignmentDefinitionController.ensureDefinition()`.
     - Persist only the definition key (plus assignment/course identifiers) in `DocumentProperties`; drop individual doc-ID storage entirely.
   - **AssignmentController.createAssignmentInstance()**:
     - Resolve `ABClass` context (for `yearGroup`), fetch the Classroom topic name, guarantee document type, and call `AssignmentDefinitionController.ensureDefinition()` before instantiating the assignment.
     - Pass the hydrated `assignmentDefinition` into the constructor/factory.
   - **AssignmentController.runAssignmentPipeline()**:
     - Before calling `assignment.populateTasks()`, implement lazy-load check:
       1. Get definition from `assignment.assignmentDefinition`.
       2. Use `DriveManager.getFileModifiedTime()` to check reference and template doc timestamps.
       3. Compare against `definition.referenceLastModified` and `definition.templateLastModified`.
       4. If stale, call `populateTasks()` to re-parse and update definition.
       5. If fresh, skip parsing (use cached tasks from definition).

- **AssignmentController.processSelectedAssignment()**:
  - Retrieve the stored definition key, fetch the definition via the controller, attach it to the assignment, and re-save updates after any re-parse.
- **UIManager.saveDocumentIdsForAssignment()**:
- Call into the controller (or a lightweight GAS server function) that performs the same resolution used by `AssignmentController`; Script Properties are no longer touched.
- **AssignmentProcessor globals & AssessmentRecordTemplate menus**:
  - Update `saveStartAndShowProgress`/`startProcessing` wrappers and associated tests to reflect the new parameter contract (definition key only stored, no legacy IDs).

6. **Properties Manager Retirement**:

- Remove `AssignmentPropertiesManager` entirely (no writes or reads). Any legacy helpers referencing it should be deleted or replaced with definition-aware logic.

7. **Tests**:
   - **Model Tests**:
     - `AssignmentDefinition` serialisation, validation (with nullable yearGroup), `toPartialJSON()`, composite key generation helper.
   - **Assignment & Consumer Tests**:
     - `Assignment` serialisation/deserialisation with embedded definitions and without legacy properties.
     - `SlidesAssignment`/`SheetsAssignment` pipelines proving they consume `assignmentDefinition` for doc IDs/tasks.
     - `Assignment.fromJSON()` reconstructing embedded definitions for persisted runs.
     - `AnalysisSheetManager`, `LLMRequestManager`, and `ImageManager` unit tests updated to read through the embedded definition.
   - **Controller Tests**:
     - `AssignmentDefinitionController.ensureDefinition()` covering: existing definition retrieval, Drive timestamp-triggered re-parse/upsert, topic-name enrichment via the new Classroom API helper, and mutation of shared definitions.
     - `AssignmentController` happy-path orchestration using definition keys in DocProperties.
   - **DriveManager Tests**:
     - `getFileModifiedTime()` with mocked `DriveApp` and Advanced Drive API.
     - Retry logic and Shared Drive fallback scenarios.
   - **Persistence Tests**:
     - Composite key storage/retrieval (including `null` year groups) and definition upserts after re-parse.

8. **Docs**:

- Update `docs/developer/DATA_SHAPES.md` for the new structures and embedding rules.
- Refresh `setup/settingUpAssessmentRecords.md`, `setup/settingUpOverviewSheet.md`, and any UI how-tos so they describe supplying doc IDs once and persisting only the definition key.
- Amend UI/menu documentation (e.g. `docs/howTos/` and Assessment Record template README) to explain the new save flow and removal of Script Properties.

## Dependencies

- Step 1 & 2 (Model/Controller) are prerequisites.
- Step 3 (Assignment refactor) depends on 1.
- Step 4 (Migration) depends on 1, 2, 3.
- Step 5 (Controller updates) depends on 1, 2, 3, 4.
- Step 5 (DriveManager) can be developed in parallel with 1-4.

## Code Impact Analysis

### Files Requiring Updates

- **New Files**:
  - `src/AdminSheet/Models/AssignmentDefinition.js`
  - `src/AdminSheet/y_controllers/AssignmentDefinitionController.js`

- **Modified Files**:
  - `src/AdminSheet/AssignmentProcessor/Assignment.js` (remove `tasks`, add `assignmentDefinition`)
  - `src/AdminSheet/AssignmentProcessor/SlidesAssignment.js` (remove duplicate properties)
  - `src/AdminSheet/AssignmentProcessor/SheetsAssignment.js` (remove duplicate properties)
  - `src/AdminSheet/y_controllers/AssignmentController.js` (orchestration updates)
  - `src/AdminSheet/GoogleDriveManager/DriveManager.js` (add `getFileModifiedTime()`)
  - `src/AdminSheet/UI/UIManager.js` (replace `AssignmentPropertiesManager` usage)
  - `src/AdminSheet/RequestHandlers/LLMRequestManager.js`, `src/AdminSheet/RequestHandlers/ImageManager.js`, `src/AdminSheet/Sheets/AnalysisSheetManager.js`, `src/AdminSheet/FeedbackPopulators/SheetsFeedback.js`, and any other consumer referencing `assignment.tasks`/doc IDs/document type.
  - `src/AdminSheet/GoogleClassroom/ClassroomApiClient.js` (topic helpers)
  - `src/AdminSheet/AssignmentProcessor/globals.js` & `src/AssessmentRecordTemplate/menus/assignment.js` (new flow contract)
  - `tests/**` suites listed above.

- **Removed**:
  - `src/AdminSheet/Utils/AssignmentPropertiesManager.js`

### Global Code Search Required

Before implementation, search codebase for:

- `assignment.tasks` → update to `assignment.assignmentDefinition.tasks`
- `assignment.documentType` → update to `assignment.assignmentDefinition.documentType`
- `assignment.assignmentWeighting` → update to `assignment.assignmentDefinition.assignmentWeighting`
- `.referenceDocumentId` on `SlidesAssignment`/`SheetsAssignment` → update to `assignment.assignmentDefinition.referenceDocumentId`
- `.templateDocumentId` on `SlidesAssignment`/`SheetsAssignment` → update to `assignment.assignmentDefinition.templateDocumentId`
- `AssignmentPropertiesManager` references → remove entirely
- DocProperties read/write helpers expecting `referenceDocumentId`/`templateDocumentId`
- UI tests/assertions marshalling old parameter lists

## Risks & Mitigations

- **Topic/Title Changes**: If a teacher renames a Topic or Assignment in Classroom, the composite key will not match existing definitions.
  - _Mitigation:_ Use `alternateTitles`/`alternateTopics` for manual linking (future UI). Creating a new definition is acceptable—history separation may be desired.
- **Widespread Code Changes**: Removing `assignment.tasks` requires updating many call sites.
  - _Mitigation:_ Comprehensive grep search before implementation. Thorough testing.
- **Topic API availability**: Classroom Topics API failures will block enrichment.
  - _Mitigation_: Fail fast with clear logging; surface fallback messaging in UI and add retries where sensible.

## Future Enhancements

- **Definition Update Propagation**: Mechanism to update existing assignments when their definition changes.
- **Fuzzy Matching**: Automatic matching of slight title/topic variations.
- **UI for Definition Management**: Teacher interface for linking, creating, and enriching definitions.
