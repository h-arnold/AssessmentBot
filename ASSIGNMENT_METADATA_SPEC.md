# Assignment Definition Spec (JsonDbApp Definition Store)

## Goals

- Decouple reusable lesson data from specific Classroom instances using a Copy-on-Construct pattern.
- Introduce `AssignmentDefinition` to store reusable metadata (doc IDs, task definitions, weighting, titles, topics, yearGroup).
  - **Relationship:** One `AssignmentDefinition` (Lesson) : Many `Assignment` instances (Classroom coursework).
  - **Embedded Pattern:** `Assignment` embeds a copy of `AssignmentDefinition` at creation time. Updates to a definition do not automatically propagate to existing assignments (see Future Enhancements).
- Store definitions in `JsonDbApp` instead of Script Properties (hard cut-over).
- Enable lazy reload of reference/template artefacts by comparing Drive file modified timestamps against stored definitions.

## Scope

- New `AssignmentDefinition` model (class) encapsulating reusable lesson properties.
- Update `Assignment` to embed `AssignmentDefinition` and remove the `tasks` property entirely. All code must access tasks via `assignment.assignmentDefinition.tasks`.
- `JsonDbApp` collection for definitions keyed by composite `${primaryTitle}_${primaryTopic}_${yearGroup || 'null'}` (populate `yearGroup` from the owning `ABClass` whenever available; only fall back to literal `null` when class metadata is missing).
- Update controllers/parsers to consume definitions via `JsonDbApp` and mutate the shared definition when Drive content changes.
- No Script Properties or migration logic is required (greenfield rollout).
- Add `DriveManager.getFileModifiedTime()` to support lazy reloading of reference/template documents.
- Extend `ClassroomApiClient` to expose topic-name lookups for enrichment.

## Data Model: AssignmentDefinition

- **Concept:** Represents a "Lesson Plan" or "Master Assignment" reusable across years/classes.
- **Fields:**
  - `primaryTitle` (string, required) – Canonical title.
  - `primaryTopic` (string, required) – Canonical topic.
  - `yearGroup` (number|null) – Intended year group. Null is acceptable until enriched.
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
  - Validation: Throws on missing required fields (title, topic, docIDs, documentType). Validate yearGroup only when non-null.
  - Provide helper(s) to generate the composite key (injecting `ABClass.yearGroup` when present, literal `null` only when absent) and to update modified timestamps.

## Persistence (JsonDbApp)

- **Collection:** `assignment_definitions`.
- **Key Strategy:** Composite key `${primaryTitle}_${primaryTopic}_${yearGroup || 'null'}`.
  - _Constraint:_ Titles must be unique within a Topic and YearGroup combination.
  - _Rationale:_ Topics may be reused across year groups; yearGroup distinguishes them.
- **Controller (`AssignmentDefinitionController`):**
  - Manages persistence and retrieval of `AssignmentDefinition` entities.
  - Uses `DbManager` to access the `assignment_definitions` collection and mutates shared definitions when Drive content changes.
  - **Methods (initial scope):**
    - `ensureDefinition({ primaryTitle, primaryTopic, topicId, yearGroup, documentType, referenceDocumentId, templateDocumentId }): AssignmentDefinition`
    - `getDefinitionByKey(definitionKey): AssignmentDefinition|null`
    - `saveDefinition(def: AssignmentDefinition): AssignmentDefinition`
    - (Future) `findDefinitionByFuzzyMatch`
  - `ensureDefinition` is responsible for topic-name enrichment via `ClassroomApiClient`, Drive timestamp comparisons, and re-parsing reference/template documents when stale.

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
- When loading or preparing an assignment run:
  1. Fetch `AssignmentDefinition` from DB via controller.
  2. Use `DriveManager.getFileModifiedTime(fileId)` to check Drive file `modifiedTime` for both reference and template documents.
  3. If either file's `modifiedTime` > stored `lastModified`, re-parse docs, mutate the shared definition (including `tasks`), and persist immediately.
  4. If unchanged, use stored `tasks`.

### Topic Enrichment

- Use `ClassroomApiClient` helpers to resolve topic names for a course/assignment when only `topicId` is provided.
- Topic lookup failures must surface via `ProgressTracker.logError` so teachers can intervene.

### DriveManager Extension

- Add `DriveManager.getFileModifiedTime(fileId)` static method:
  - Returns ISO 8601 string of file's last modified timestamp.
  - Uses retry logic (3 attempts with exponential backoff) like `getParentFolderId()`.
  - Attempts `DriveApp.getFileById(fileId).getLastUpdated()` first.
  - Falls back to Advanced Drive API (`Drive.Files.get(fileId, {supportsAllDrives: true, fields: 'modifiedTime'})`) for Shared Drives.
  - Throws error if all attempts fail.

## Testing

- **Model Tests:**
  - `AssignmentDefinition` serialisation, validation (nullable yearGroup), partial JSON, and composite key helper.
- **Assignment/Subclass Tests:**
  - `Assignment` serialisation/deserialisation using embedded definitions only.
  - `SlidesAssignment`/`SheetsAssignment` pipelines referencing `assignmentDefinition` for doc IDs/tasks.
- **Controller Tests:**
  - `AssignmentDefinitionController.ensureDefinition()` covering: hits vs misses, Drive timestamp refreshes, topic-name enrichment, and shared-definition mutation.
  - `AssignmentController` orchestration from DocProperties definition key through to persistence.
- **Persistence Tests:**
  - Composite key storage/retrieval with `null` year groups and post-refresh writes.
- **DriveManager Tests:**
  - Mock `DriveApp` and Advanced Drive API for `getFileModifiedTime()`, including retry/backoff behaviour.

## Controller Orchestration

### AssignmentController Updates

- **`saveStartAndShowProgress()`**:
  - Replace `AssignmentPropertiesManager.saveDocumentIdsForAssignment()` with controller-backed logic that resolves topic name/year group and writes only the definition key (plus assignment/course identifiers) to `DocumentProperties`.

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
  - Update to retrieve definition key from `DocumentProperties`, fetch the definition from DB, attach it to the assignment during instantiation, and persist any re-parse back to JsonDb.

### UIManager Updates

- **`saveDocumentIdsForAssignment()`**: Replace Script Properties writes entirely; this becomes a thin wrapper over the controller logic so all definition creation happens through a single pathway.

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
  - Enrich definitions (set missing yearGroup, add alternates).
  - Update `alternateTitles` and `alternateTopics`.
