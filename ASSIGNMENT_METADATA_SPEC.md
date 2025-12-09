# Assignment Definition Spec (JsonDbApp Hard Migration)

## Goals

- Decouple reusable lesson data from specific Classroom instances using a Copy-on-Construct pattern.
- Introduce `AssignmentDefinition` to store reusable metadata (doc IDs, task definitions, weighting, titles, topics, yearGroup).
  - **Relationship:** One `AssignmentDefinition` (Lesson) : Many `Assignment` instances (Classroom coursework).
  - **Embedded Pattern:** `Assignment` embeds a copy of `AssignmentDefinition` at creation time. Updates to a definition do not automatically propagate to existing assignments (see Future Enhancements).
- Store definitions in `JsonDbApp` instead of Script Properties.
- Enable lazy reload of reference/template artefacts by comparing Drive file modified timestamps against stored definitions.
- Migrate legacy `ScriptProperties` data lazily upon first access (Enrichment), rather than a one-off script.

## Scope

- New `AssignmentDefinition` model (class) encapsulating reusable lesson properties.
- Update `Assignment` to embed `AssignmentDefinition` and remove the `tasks` property entirely. All code must access tasks via `assignment.assignmentDefinition.tasks`.
- `JsonDbApp` collection for definitions keyed by composite `${primaryTitle}_${primaryTopic}_${yearGroup}`.
- Update controllers/parsers to consume definitions via `JsonDbApp`.
- Lazy migration logic: Convert legacy `ScriptProperties` to `AssignmentDefinition` on demand.
- Add `DriveManager.getFileModifiedTime()` to support lazy reloading of reference/template documents.

## Data Model: AssignmentDefinition

- **Concept:** Represents a "Lesson Plan" or "Master Assignment" reusable across years/classes.
- **Fields:**
  - `primaryTitle` (string, required) – Canonical title.
  - `primaryTopic` (string, required) – Canonical topic.
  - `yearGroup` (number, required) – Year group for which this definition is intended.
  - `alternateTitles` (string[], optional) – Known variations of the title.
  - `alternateTopics` (string[], optional) – Known variations of the topic.
  - `documentType` ("SLIDES" | "SHEETS", required)
  - `referenceDocumentId` (string, required)
  - `templateDocumentId` (string, required)
  - `referenceLastModified` (string ISO, optional) – Drive modifiedTime snapshot when parsed.
  - `templateLastModified` (string ISO, optional)
  - `assignmentWeighting` (number|null)
  - `tasks` (Record<taskId, TaskDefinition>) – Full definitions including artifacts.
  - `createdAt` / `updatedAt` (ISO strings).
- **Behaviour:**
  - `toJSON()` / `fromJSON()`: Standard serialisation.
  - `toPartialJSON()`: Redacts artifact `content` field while preserving structure and identifiers.
  - Validation: Throws on missing required fields (title, topic, yearGroup, docIDs, documentType).

## Persistence (JsonDbApp)

- **Collection:** `assignment_definitions`.
- **Key Strategy:** Composite key `${primaryTitle}_${primaryTopic}_${yearGroup}`.
  - _Constraint:_ Titles must be unique within a Topic and YearGroup combination.
  - _Rationale:_ Topics may be reused across year groups; yearGroup distinguishes them.
- **Controller (`AssignmentDefinitionController`):**
  - Manages persistence and retrieval of `AssignmentDefinition` entities.
  - Uses `DbManager` to access the `assignment_definitions` collection.
  - **Methods:**
    - `saveDefinition(def: AssignmentDefinition): AssignmentDefinition`
    - `getDefinition(title, topic, yearGroup): AssignmentDefinition|null`
    - `findDefinitionByFuzzyMatch(title, topic, yearGroup): AssignmentDefinition|null` (Future).
    - `ensureDefinition(title, topic, yearGroup, legacyProps?): AssignmentDefinition` (Handles migration/enrichment).

## Assignment Integration

- `Assignment` (the instance) embeds an `assignmentDefinition` property (copy, not reference).
- **Property Removal:**
  - Remove `assignment.tasks` property entirely.
  - Remove `assignment.assignmentWeighting` property (access via definition).
  - Remove `assignment.documentType` property (access via definition).
  - All code must access these via `assignment.assignmentDefinition.tasks`, `assignment.assignmentDefinition.assignmentWeighting`, etc.
- **Subclass Property Removal:**
  - Remove `referenceDocumentId`, `templateDocumentId`, `documentType` from `SlidesAssignment` and `SheetsAssignment`.
  - Access these via `assignment.assignmentDefinition.referenceDocumentId`, etc.
- **Serialisation:**
  - `Assignment.toJSON()` includes the full embedded `assignmentDefinition`.
  - `Assignment.toPartialJSON()` uses `assignmentDefinition.toPartialJSON()`.
  - **Note:** This creates duplication (tasks stored in both definition and dedicated assignment collections), but optimises for read performance by avoiding separate Drive API calls.

## Lazy Loading & Migration Strategy

### Lazy Loading (Parsing)

- Store `referenceLastModified` / `templateLastModified` in `AssignmentDefinition`.
- When loading an assignment:
  1. Fetch `AssignmentDefinition` from DB.
  2. Use `DriveManager.getFileModifiedTime(fileId)` to check Drive file `modifiedTime` for both reference and template documents.
  3. If either file's `modifiedTime` > stored `lastModified`, re-parse docs and update `AssignmentDefinition`.
  4. If unchanged, use stored `tasks`.

### Lazy Migration (Legacy Data)

- **Trigger:** When `Assignment` is initialized/loaded and no `AssignmentDefinition` exists in `JsonDbApp`.
- **Action:**
  1. Check `ScriptProperties` for legacy `assignment_{Title}` key.
  2. If found:
     - Create new `AssignmentDefinition`.
     - Populate doc IDs from legacy property.
     - Populate `primaryTitle` from legacy key.
     - Populate `primaryTopic` by fetching topic name from Classroom API using assignment's `topicId` (Enrichment).
     - Set `yearGroup` to `null` (requires manual enrichment via future UI).
     - Save to `JsonDbApp`.
     - **Note:** Legacy keys are not deleted to avoid data loss in case of migration failures. Worst-case scenario: teachers must re-input reference/template document IDs.
  3. If not found: Proceed as new assignment (parse fresh).

### DriveManager Extension

- Add `DriveManager.getFileModifiedTime(fileId)` static method:
  - Returns ISO 8601 string of file's last modified timestamp.
  - Uses retry logic (3 attempts with exponential backoff) like `getParentFolderId()`.
  - Attempts `DriveApp.getFileById(fileId).getLastUpdated()` first.
  - Falls back to Advanced Drive API (`Drive.Files.get(fileId, {supportsAllDrives: true, fields: 'modifiedTime'})`) for Shared Drives.
  - Throws error if all attempts fail.

## Testing

- **Model Tests:**
  - `AssignmentDefinition` serialisation, validation, partial JSON.
  - Composite key generation with yearGroup.
- **Integration Tests:**
  - `Assignment` accessing `assignmentDefinition.tasks` (not `assignment.tasks`).
  - Subclass serialisation/deserialization without duplicate doc ID properties.
- **Migration Tests:**
  - Mock `ScriptProperties` and verify migration to `AssignmentDefinition`.
  - Verify yearGroup defaults to `null` during migration.
- **Persistence Tests:**
  - Verify composite key generation and retrieval with yearGroup.
  - Test `ensureDefinition()` lazy migration flow.
- **DriveManager Tests:**
  - Mock `DriveApp` and Advanced Drive API for `getFileModifiedTime()`.
  - Verify retry logic and Shared Drive fallback.

## Controller Orchestration

### AssignmentController Updates

- **`saveStartAndShowProgress()`**:
  - Replace `AssignmentPropertiesManager.saveDocumentIdsForAssignment()` with `AssignmentDefinitionController` logic.
  - Store definition key in `DocumentProperties` instead of individual doc IDs.

- **`createAssignmentInstance()`**:
  - Before creating `Assignment`, fetch/create `AssignmentDefinition` via `AssignmentDefinitionController.ensureDefinition()`.
  - Retrieve yearGroup from `ABClass.yearGroup`.
  - Fetch topic name from Classroom API using assignment's `topicId`.
  - Pass definition to `Assignment` constructor or set post-construction.

- **`runAssignmentPipeline()`**:
  - Orchestrate lazy-load check before `populateTasks()`:
    1. Get definition from assignment.
    2. Use `DriveManager.getFileModifiedTime()` to check if reference/template docs changed.
    3. If stale, call `populateTasks()` to re-parse and update definition.
    4. If fresh, skip parsing.

- **`processSelectedAssignment()`**:
  - Update to retrieve definition key from `DocumentProperties` (format: `${title}_${topic}_${yearGroup}`).
  - Fetch definition from DB and attach to assignment during instantiation.

### UIManager Updates

- **`saveDocumentIdsForAssignment()`**: Replace direct call to `AssignmentPropertiesManager` with `AssignmentDefinitionController.ensureDefinition()`.

## Documentation

- Update `docs/developer/DATA_SHAPES.md` to reflect:
  - `AssignmentDefinition` structure with yearGroup.
  - Removal of `assignment.tasks` property.
  - Copy-on-Construct embedding pattern (not Flyweight).
  - 1:N relationship (one definition, many assignment instances).

## Future Enhancements

- **Definition Update Propagation**: Implement mechanism to update existing assignments when their linked definition changes (e.g., task weighting adjustments). This would enable retrospective cohort analysis adjustments.
- **Fuzzy Matching**: Implement `findDefinitionByFuzzyMatch()` to handle title/topic variations automatically.
- **UI for Definition Management**: Teacher-facing interface to:
  - Link assignments to existing definitions.
  - Create new definitions.
  - Enrich migrated definitions (set missing yearGroup).
  - Update `alternateTitles` and `alternateTopics`.
