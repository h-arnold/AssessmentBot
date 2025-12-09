# Assignment Definition Action Plan

## Sequenced Tasks

1. **Model Definition**: Create `AssignmentDefinition` class.
   - Fields: `primaryTitle`, `primaryTopic`, `yearGroup`, `alternateTitles`, `alternateTopics`, doc IDs, timestamps, weighting, `tasks`.
   - Methods: `toJSON`, `fromJSON`, `toPartialJSON` (redacts artifact `content` field).
   - Validation: Ensure title, topic, yearGroup, docIDs, and documentType are present.
   - Location: `src/AdminSheet/Models/AssignmentDefinition.js`

2. **Controller**: Create `AssignmentDefinitionController`.
   - **Responsibility:** CRUD for `AssignmentDefinition` and migration orchestration.
   - **Dependencies:** `DbManager` (for `assignment_definitions` collection), Classroom API (for topic enrichment).
   - **Methods:**
     - `saveDefinition(def)`
     - `getDefinition(title, topic, yearGroup)`
     - `ensureDefinition(title, topic, yearGroup, legacyProps?)`: Core logic for lazy migration and enrichment.
   - **Key Generation:** `${primaryTitle}_${primaryTopic}_${yearGroup}`
   - Location: `src/AdminSheet/y_controllers/AssignmentDefinitionController.js`

3. **Assignment Refactor**: Update `Assignment` class and subclasses.
   - Add `assignmentDefinition` property (embedded copy).
   - **Remove** `tasks` property entirely—all code must access via `assignmentDefinition.tasks`.
   - Remove `assignmentWeighting` property—access via `assignmentDefinition.assignmentWeighting`.
   - Remove `documentType` property—access via `assignmentDefinition.documentType`.
   - Update `toJSON`/`fromJSON` to handle embedded definition.
   - Update `_baseFromJSON()` to reconstruct `assignmentDefinition` field.
   - **Subclass Updates:**
     - Remove `referenceDocumentId`, `templateDocumentId`, `documentType` from `SlidesAssignment` and `SheetsAssignment`.
     - Access these via `assignmentDefinition.referenceDocumentId`, etc.
     - Update subclass `toJSON()`/`fromJSON()` methods accordingly.

4. **Legacy Migration & Enrichment Logic**:
   - Implement the logic within `AssignmentDefinitionController.ensureDefinition()`.
   - Logic:
     - Try fetch Definition from DB using composite key `${title}_${topic}_${yearGroup}`.
     - If missing, check `ScriptProperties` for legacy `assignment_{Title}` key.
     - If Legacy exists:
       - Create new `AssignmentDefinition`.
       - Populate doc IDs from legacy property.
       - Enrich `primaryTopic` by fetching topic name from Classroom API using assignment's `topicId`.
       - Set `yearGroup` to `null` (requires manual enrichment via future UI).
       - Save to `JsonDbApp`.
       - **Do not delete** legacy ScriptProperties key (data loss prevention).
     - If neither exists: Create fresh Definition by parsing reference/template documents.

5. **Controller & Manager Updates**:
   - **DriveManager**: Add `getFileModifiedTime(fileId)` static method:
     - Returns ISO 8601 string of file's last modified timestamp.
     - Use retry logic (3 attempts, exponential backoff) matching `getParentFolderId()` pattern.
     - Try `DriveApp.getFileById(fileId).getLastUpdated()` first.
     - Fallback to Advanced Drive API (`Drive.Files.get(fileId, {supportsAllDrives: true, fields: 'modifiedTime'})`).
   - **AssignmentController.saveStartAndShowProgress()**:
     - Replace `AssignmentPropertiesManager.saveDocumentIdsForAssignment()` with `AssignmentDefinitionController.ensureDefinition()`.
     - Store definition key (`${title}_${topic}_${yearGroup}`) in `DocumentProperties` instead of individual doc IDs.
   - **AssignmentController.createAssignmentInstance()**:
     - Before creating `Assignment`, fetch/create definition via `AssignmentDefinitionController.ensureDefinition()`.
     - Retrieve `yearGroup` from `ABClass.yearGroup`.
     - Fetch topic name from Classroom API.
     - Pass or attach definition to `Assignment` instance.
   - **AssignmentController.runAssignmentPipeline()**:
     - Before calling `assignment.populateTasks()`, implement lazy-load check:
       1. Get definition from `assignment.assignmentDefinition`.
       2. Use `DriveManager.getFileModifiedTime()` to check reference and template doc timestamps.
       3. Compare against `definition.referenceLastModified` and `definition.templateLastModified`.
       4. If stale, call `populateTasks()` to re-parse and update definition.
       5. If fresh, skip parsing (use cached tasks from definition).
   - **AssignmentController.processSelectedAssignment()**:
     - Retrieve definition key from `DocumentProperties`.
     - Fetch definition from DB and attach to assignment during construction.
   - **UIManager.saveDocumentIdsForAssignment()**:
     - Replace direct `AssignmentPropertiesManager` call with `AssignmentDefinitionController.ensureDefinition()`.

6. **Properties Manager Retirement**:
   - Deprecate/Remove `AssignmentPropertiesManager` writes.
   - Keep reads only for the migration fallback logic.

7. **Tests**:
   - **Model Tests**:
     - `AssignmentDefinition` serialisation, validation, `toPartialJSON()`.
     - Composite key generation with yearGroup.
   - **Integration Tests**:
     - `Assignment` accessing `assignmentDefinition.tasks` (verify `assignment.tasks` removed).
     - `SlidesAssignment`/`SheetsAssignment` serialization without duplicate properties.
     - `Assignment.fromJSON()` correctly reconstructs embedded definition.
   - **Controller Tests**:
     - `AssignmentDefinitionController.ensureDefinition()` lazy migration flow.
     - YearGroup defaults to `null` during legacy migration.
   - **DriveManager Tests**:
     - `getFileModifiedTime()` with mocked `DriveApp` and Advanced Drive API.
     - Retry logic and Shared Drive fallback scenarios.
   - **Persistence Tests**:
     - Composite key storage and retrieval with yearGroup.

8. **Docs**:
   - Update `DATA_SHAPES.md`.

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
  - All code referencing `assignment.tasks` must change to `assignment.assignmentDefinition.tasks`
  - All code referencing `assignment.documentType` must change to `assignment.assignmentDefinition.documentType`

- **Deprecated (Read-Only)**:
  - `src/AdminSheet/Utils/AssignmentPropertiesManager.js` (keep for legacy migration reads only)

### Global Code Search Required

Before implementation, search codebase for:

- `assignment.tasks` → update to `assignment.assignmentDefinition.tasks`
- `assignment.documentType` → update to `assignment.assignmentDefinition.documentType`
- `assignment.assignmentWeighting` → update to `assignment.assignmentDefinition.assignmentWeighting`
- `.referenceDocumentId` on `SlidesAssignment`/`SheetsAssignment` → update to `assignment.assignmentDefinition.referenceDocumentId`
- `.templateDocumentId` on `SlidesAssignment`/`SheetsAssignment` → update to `assignment.assignmentDefinition.templateDocumentId`

## Risks & Mitigations

- **Topic/Title Changes**: If a teacher renames a Topic or Assignment in Classroom, the composite key will not match existing definitions.
  - _Mitigation:_ Use `alternateTitles`/`alternateTopics` for manual linking (future UI). Creating a new definition is acceptable—history separation may be desired.
- **YearGroup Null for Migrated Data**: Legacy assignments will have `yearGroup: null` until manually enriched.
  - _Mitigation:_ Document this in release notes. Provide future UI for enrichment.
- **Widespread Code Changes**: Removing `assignment.tasks` requires updating many call sites.
  - _Mitigation:_ Comprehensive grep search before implementation. Thorough testing.

## Future Enhancements

- **Definition Update Propagation**: Mechanism to update existing assignments when their definition changes.
- **Fuzzy Matching**: Automatic matching of slight title/topic variations.
- **UI for Definition Management**: Teacher interface for linking, creating, and enriching definitions.
