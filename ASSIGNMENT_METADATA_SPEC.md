# Assignment Metadata Spec (JsonDbApp Hard Migration)

## Goals

- Store full assignment metadata (doc IDs, task definitions, weighting, titles, topics, last-modified markers) in JsonDbApp instead of Script Properties.
  - This decouples assignment metadata from the `Assignment` model, allowing cleaner separation of concerns. The split effectively means that assignment data that persists across multiple google classroom assignments, such as topic, reference and template tasks and weightings, from the `Assignment` model which focuses on assessing the students' submissions for a single Google Classroom assignment.
- Enable lazy reload of reference/template artefacts by comparing Drive file modified timestamps against stored metadata.
- Remove reliance on PropertiesService; provide one-off migration to JsonDbApp.
- Preserve existing Assignment serialisation semantics while introducing a dedicated `AssignmentMetadata` model.

## Scope

- New `AssignmentMetadata` model (class) encapsulating persisted assignment properties.
- Update `Assignment` to delegate metadata (doc IDs, titles, topics, weighting, tasks, doc lastModified markers) to `AssignmentMetadata` while keeping submissions separate.
- JsonDbApp collection for metadata keyed by `primaryTitle` (plus course/assignment IDs for disambiguation).
- Hard migration script to read legacy Script Properties and populate JsonDbApp with metadata records.
- Update controllers/parsers to consume metadata via JsonDbApp, removing Script Properties dependency.
- Tests and docs updated to new shapes.

## Data Model: AssignmentMetadata

- Fields:
  - `courseId` (string, required)
  - `assignmentId` (string, required)
  - `primaryTitle` (string, required) – canonical title used as collection key.
  - `alternateTitles` (string[], optional) – other Classroom titles / misspellings.
  - `primaryTopic` (string, required) – main topic/category.
  - `alternateTopics` (string[], optional) - other topics or variations on topic name
  - `documentType` ("SLIDES" | "SHEETS", required)
  - `referenceDocumentId` (string, required)
  - `templateDocumentId` (string, required)
  - `referenceLastModified` (string ISO, optional) – Drive modifiedTime snapshot when parsed.
  - `templateLastModified` (string ISO, optional)
  - `assignmentWeighting` (number|null)
  - `tasks` (Record<taskId, TaskDefinition>) – full definitions including artifacts.
  - `createdAt` / `updatedAt` (ISO strings) for auditing (optional, set on persist).
- Behaviour:
  - `toJSON()` returns plain object; TaskDefinitions serialise via their `toJSON`.
  - `fromJSON()` rebuilds tasks via `TaskDefinition.fromJSON`, preserves arrays/strings.
  - `toPartialJSON()` redacts artifact content/hashes (mirrors Assignment partial behaviour) for lightweight reads.
  - Validation: throws on missing `courseId`, `assignmentId`, `primaryTitle`, `documentType`, `referenceDocumentId`, `templateDocumentId`.

## Persistence (JsonDbApp)

- New collection: `assignment_metadata`.
- Document key: `primaryTitle` + `primaryTopic`
- Access helpers in `DbManager` (e.g., `AssignmentDbManager`):
  - `saveMetadata(metadata: AssignmentMetadata): AssignmentMetadata` – upsert by `primaryTitle` (and optionally assert matching course/assignment IDs to avoid accidental overwrite).
  - `getMetadataByTitle(primaryTitle): AssignmentMetadata|null` – fetch latest.
  - `getMetadataByCourseAndId(courseId, assignmentId): AssignmentMetadata|null` – scan/index if needed.

## Assignment Integration

- `Assignment` holds `assignmentMetadata` instance; `assignmentName` becomes `primaryTitle` with `alternateTitles` support.
- `tasks` property in `Assignment` proxies to `assignmentMetadata.tasks` for backwards compatibility (getter/setter or migration in constructor/fromJSON).
- `assignmentWeighting` mirrors metadata field (either proxied or set from metadata).
- `documentType`, `referenceDocumentId`, `templateDocumentId` read from metadata (subclasses no longer store directly; keep read-only accessors for compatibility).
- `toJSON()` / `fromJSON()` include `assignmentMetadata` payload (full) and continue to exclude transient `students` / `progressTracker`.
- `toPartialJSON()` uses `assignmentMetadata.toPartialJSON()` to redact artifacts.

## Lazy Loading Strategy

- Store `referenceLastModified` / `templateLastModified` when parsing docs.
- Before re-parsing, fetch Drive file modifiedTime; if unchanged vs metadata, skip parsing and reuse stored TaskDefinitions.
- Controllers that previously grabbed doc IDs from Script Properties now fetch metadata and decide whether to parse.

## Migration (Hard Cut)

- One-off script (Apps Script runnable) to:
  - Iterate existing `PropertiesService.getScriptProperties().getKeys()` for `assignment_*` entries.
  - For each key, parse legacy value; derive `referenceDocumentId`, `templateDocumentId`, `documentType` (default SLIDES), and infer `primaryTitle` from key suffix.
  - Fetch Classroom coursework (if available) to populate titles/topic; else use primaryTitle only.
  - Build `AssignmentMetadata` with empty tasks (or optionally parse reference/template immediately) and weighting=null; set `alternateTitles`/`topicNames` if available.
  - Persist into `assignment_metadata` via JsonDbApp.
  - Optionally delete legacy property after successful write (hard migration; no dual writes afterward).
- Logging: use `ProgressTracker.logInfo/logError` per migration outcome; fail fast on parse errors with `logAndThrowError`.

## Controllers/Workflow Updates

- `AssignmentPropertiesManager`: replace PropertiesService reads/writes with JsonDbApp-backed metadata access; keep helper for MIME validation using DriveApp when needed.
- `initController` / `abclassController` / `AssignmentProcessor` routes: obtain reference/template IDs via metadata service; pass into parsing/assessment flows.
- Ensure trigger setup writes metadata into JsonDbApp instead of DocumentProperties.

## Testing

- Update serialisation tests (`tests/assignment/assignmentSerialisation.test.js`, etc.) to include `assignmentMetadata` round-trip (full and partial), ensuring tasks survive and transient fields excluded.
- Add tests for metadata persistence helpers (mock JsonDbApp) and migration script logic (mock PropertiesService).
- Ensure redaction leaves IDs/titles intact but strips artifact content.

## Documentation

- Update `docs/developer/DATA_SHAPES.md` to reflect new `assignmentMetadata` structure and collection naming.
- Add migration how-to note in `docs/howTos` or release notes.
