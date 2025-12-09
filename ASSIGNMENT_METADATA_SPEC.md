# Assignment Definition Spec (JsonDbApp Hard Migration)

## Goals

- Decouple reusable lesson data from specific Classroom instances using a Flyweight pattern.
- Introduce `AssignmentDefinition` to store reusable metadata (doc IDs, task definitions, weighting, titles, topics).
  - **Relationship:** One `AssignmentDefinition` (Lesson) : Many `Assignment` instances (Classroom coursework).
  - **Shared State:** Changes to an `AssignmentDefinition` (e.g., task weightings) intentionally propagate to all linked Assignments to enable consistent cohort analysis.
- Store definitions in `JsonDbApp` instead of Script Properties.
- Enable lazy reload of reference/template artefacts by comparing Drive file modified timestamps against stored definitions.
- Migrate legacy `ScriptProperties` data lazily upon first access (Enrichment), rather than a one-off script.

## Scope

- New `AssignmentDefinition` model (class) encapsulating reusable lesson properties.
- Update `Assignment` to delegate definition data (doc IDs, titles, topics, weighting, tasks) to `AssignmentDefinition`.
- `JsonDbApp` collection for definitions keyed by composite `${primaryTitle}_${primaryTopic}`.
- Update controllers/parsers to consume definitions via `JsonDbApp`.
- Lazy migration logic: Convert legacy `ScriptProperties` to `AssignmentDefinition` on demand.

## Data Model: AssignmentDefinition

- **Concept:** Represents a "Lesson Plan" or "Master Assignment" reusable across years/classes.
- **Fields:**
  - `primaryTitle` (string, required) – Canonical title.
  - `primaryTopic` (string, required) – Canonical topic.
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
  - `toPartialJSON()`: Redacts artifact content for lightweight reads.
  - Validation: Throws on missing required fields.

## Persistence (JsonDbApp)

- **Collection:** `assignment_definitions`.
- **Key Strategy:** Composite key `${primaryTitle}_${primaryTopic}`.
  - _Constraint:_ Titles must be unique within a Topic.
- **Controller (`AssignmentDefinitionController`):**
  - Manages persistence and retrieval of `AssignmentDefinition` entities.
  - Uses `DbManager` to access the `assignment_definitions` collection.
  - **Methods:**
    - `saveDefinition(def: AssignmentDefinition): AssignmentDefinition`
    - `getDefinition(title, topic): AssignmentDefinition|null`
    - `findDefinitionByFuzzyMatch(title, topic): AssignmentDefinition|null` (Future).
    - `ensureDefinition(title, topic, legacyProps?): AssignmentDefinition` (Handles migration/enrichment).

## Assignment Integration

- `Assignment` (the instance) holds an `assignmentDefinition` property.
- **Delegation:**
  - `Assignment.tasks` -> proxies to `assignmentDefinition.tasks`.
  - `Assignment.assignmentWeighting` -> proxies to `assignmentDefinition.assignmentWeighting`.
  - `Assignment.documentType` -> proxies to `assignmentDefinition.documentType`.
- **Serialisation:**
  - `Assignment.toJSON()` includes the full `assignmentDefinition`. This will result in slightly larger 'full fat' assignment JSONs but will simplify and speed up loading as we'll only need to do one google drive fetch per assignment.
  - `Assignment.toPartialJSON()` uses `assignmentDefinition.toPartialJSON()`.

## Lazy Loading & Migration Strategy

### Lazy Loading (Parsing)

- Store `referenceLastModified` / `templateLastModified` in `AssignmentDefinition`.
- When loading an assignment:
  1. Fetch `AssignmentDefinition` from DB.
  2. Check Drive file `modifiedTime`.
  3. If changed > `lastModified`, re-parse docs and update `AssignmentDefinition`.
  4. If unchanged, use stored `tasks`.

### Lazy Migration (Legacy Data)

- **Trigger:** When `Assignment` is initialized/loaded and no `AssignmentDefinition` exists in `JsonDbApp`.
- **Action:**
  1. Check `ScriptProperties` for legacy `assignment_{Title}` key.
  2. If found:
     - Create new `AssignmentDefinition`.
     - Populate doc IDs from legacy property.
     - Populate `primaryTitle` from legacy key.
     - Populate `primaryTopic` from current Classroom data (Enrichment).
     - Save to `JsonDbApp`.
     - (Optional) Delete legacy key.
  3. If not found: Proceed as new assignment (parse fresh).

## Testing

- **Model Tests:** `AssignmentDefinition` serialisation, validation, partial JSON.
- **Integration Tests:** `Assignment` delegating correctly to `AssignmentDefinition`.
- **Migration Tests:** Mock `ScriptProperties` and verify `Assignment` constructor/loader correctly migrates legacy data into a new `AssignmentDefinition`.
- **Persistence Tests:** Verify composite key generation and retrieval.

## Documentation

- Update `docs/developer/DATA_SHAPES.md` to reflect `AssignmentDefinition` and the 1:N relationship.
