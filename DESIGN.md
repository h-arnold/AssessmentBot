# Task and Submission Architecture Design

This document defines the Task and Submission model refactor. It replaces overlapping Task/StudentTask logic with a clean separation between Task definitions and typed content artifacts, and introduces a robust StudentSubmission model.

## Goals

- Single source of truth for “what the task is.”
- Typed artifacts encapsulate content-specific behavior (normalize, validate, hash, assess helper).
- Stable keys and consistent hashing for caching/change detection.
- Clean separation of reference/template artifacts (definition-owned) vs. per-student submission artifacts.
- Extensible: add a new task type with minimal changes.

## Terminology

- TaskDefinition: describes the task (identity, metadata) and owns reference/template artifacts.
- TaskArtifact: a typed content instance for a task in a specific role: reference | template | submission.
- StudentSubmissionItem: a student’s per-task wrapper that holds the submission artifact plus grouped assessments/feedback.
- StudentSubmission: aggregates all StudentSubmissionItem for a student and assignment.

## High-level model

```
TaskDefinition (id, title, type, metadata)
  ├─ artifacts.reference[] : TaskArtifact<Text|Table|Spreadsheet|Image>
  └─ artifacts.template[]  : TaskArtifact<Text|Table|Spreadsheet|Image>

StudentSubmission (student, assignmentId, documentId)
  └─ items[taskId] : StudentSubmissionItem
        ├─ artifact (role='submission', typed)
        ├─ assessments { criterion -> Assessment }
        └─ feedback { type -> Feedback }
```

- Definition owns reference/template artifacts (can be multiple variants per role).
- Submissions live outside the definition to avoid mixing per-student state.

## Core classes and responsibilities

### TaskDefinition

- Identity: `id`, `taskTitle`, `taskType`, `pageId?`, `imageCategory?`.
- Metadata: `taskNotes?`, `taskMetadata?` (free-form map).
- Owns artifacts: `artifacts.reference[]`, `artifacts.template[]`.
- Factory helpers:
  - `createArtifact(role, { pageId?, content?, contentHash?, metadata? })` → typed `TaskArtifact`, calls `ensureHash`.
  - `addReferenceArtifact(params)` / `addTemplateArtifact(params)`.
- JSON: serializes intrinsic fields and artifacts.
- ID strategy: `id = hash(taskTitle + '-' + pageId)` by default; prefer persisting this id rather than re-deriving when titles/pages change.

### TaskArtifact hierarchy

All artifacts share:
- Fields: `taskId`, `role` ('reference' | 'template' | 'submission'), `pageId?`, `content`, `contentHash?`, `metadata`, `assessments?`, `feedback?`, `uid`.
- Behavior:
  - `normalizeContent(content)` – type-specific normalization.
  - `validateContent(content)` – type-specific sanity checks.
  - `ensureHash(hashFn)` – compute hash from normalized content if absent.
  - `assessAgainst(definition, { criteria })` – optional per-type assessment helper (can be a no-op; assessment can also be handled by a separate engine).

Typed subclasses:
- TextTaskArtifact – trims strings; validates string or null.
- TableTaskArtifact – normalizes to array-of-arrays where possible; validates array or null.
- SpreadsheetTaskArtifact – extends Table; spreadsheet-specific metadata lives in `metadata` (e.g., ranges, bounding boxes).
- ImageTaskArtifact – normalizes to a sorted list of URLs for stable hashing; validates array or null.

ArtifactFactory:
- `create({ taskId, role, taskType, pageId?, content?, contentHash?, metadata?, assessments?, feedback? })` → correct subclass.

### StudentSubmissionItem

- Metadata: `id` (stable per attempt), `student`, `assignmentId`, `taskId`, `taskType`, `documentId`.
- Contains: `artifact` (typed, role='submission'), `assessments`, `feedback`, timestamps.
- Methods:
  - `addAssessment(criterion, Assessment)`.
  - `getAssessment(criterion?)`.
  - `addFeedback(feedback)` / `getFeedback(type?)`.
  - `assessWith(taskDef, { criteria })` – runs type-aware assessment if implemented.
  - `toJSON()` / `fromJSON()`.

### StudentSubmission

- Aggregates `StudentSubmissionItem` by `taskId` for a student’s assignment.
- Methods:
  - `upsertItemFromExtraction(taskDef, { pageId?, content?, contentHash?, metadata? })` – constructs the typed submission artifact via factory and ensures hash.
  - `getItem(taskId)`.
  - `addAssessment(taskId, criterion, Assessment)` / `addFeedback(taskId, feedback)`.
  - `extract(parser, taskDefs)` – see Parser contract below.
  - `toJSON()` / `fromJSON()`.

## Parser contract

Parsers for Slides/Sheets/Docs should implement a unified method:

- `extractSubmissionArtifacts(documentId, taskDefs) -> Array<{ taskId, pageId?, content, contentHash?, metadata? }>`

Notes:
- Parsers can internally map titles/pages to `taskId`, but must output stable `taskId` keys.
- Parsers do not worry about hashing; submissions call `ensureHash`.
- `metadata` may include extraction hints (ranges, bounding boxes, OCR flags, etc.).

## Assessment flow

- `Assessment` class (existing) represents a single criterion result.
- Recommended storage: group by `StudentSubmissionItem.assessments[criterion] = Assessment JSON`.
- Where to compute:
  - Either implement per-type `artifact.assessAgainst(taskDef, { criteria })`.
  - Or have a separate criteria engine that consumes `(taskDef.reference/template, submission.artifact)`.
- Keep `contentHash` to short-circuit re-assessment when nothing changed.

## Identity and hashing

- TaskDefinition `id` should be stable and persisted. Default derives from `taskTitle + pageId` and `Utils.generateHash`.
- Artifacts compute `contentHash` via normalization; consistent across roles and types.
- For Image artifacts, sort URLs before hashing to avoid order sensitivity.

## JSON shapes (examples)

TaskDefinition JSON (simplified):

```json
{
  "id": "t_abc123",
  "taskTitle": "Task 1 - Word Bank",
  "taskType": "Text",
  "pageId": "gSlide123",
  "imageCategory": null,
  "taskNotes": null,
  "taskMetadata": {},
  "artifacts": {
    "reference": [{ "taskId": "t_abc123", "role": "reference", "pageId": "gSlide123", "content": "dog, cat", "contentHash": "...", "metadata": {"taskType": "Text"} }],
    "template":  [{ "taskId": "t_abc123", "role": "template",  "pageId": "gSlide123", "content": "",         "contentHash": "...", "metadata": {"taskType": "Text"} }]
  }
}
```

StudentSubmission JSON (simplified):

```json
{
  "student": { /* Student JSON */ },
  "assignmentId": "a_123",
  "documentId": "doc_123",
  "items": {
    "t_abc123": {
      "id": "ssi_1",
      "student": { /* Student JSON */ },
      "assignmentId": "a_123",
      "taskId": "t_abc123",
      "taskType": "Text",
      "documentId": "doc_123",
      "artifact": { "taskId": "t_abc123", "role": "submission", "pageId": "gSlide123", "content": "dog, cat", "contentHash": "...", "metadata": {"taskType": "Text"} },
      "assessments": { "accuracy": { "score": 4, "reasoning": "..." } },
      "feedback": { /* type -> Feedback JSON */ },
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

## Error handling and edge cases

- Missing `documentId` in `StudentSubmission.extract`: log and skip extraction.
- Parser returns unknown `taskId`: warn and skip.
- No submission for a task: create an empty `StudentSubmissionItem` with a null-content artifact.
- Type validation fails: record a validation error (consider adding a `status`/`errors[]` on artifacts or items).
- Title/page changes: if `id` is re-derived, mismatches can occur. Persist `id` to your sheet/data store to prevent drift.

## Extending with new task types

1. Add `class AudioTaskArtifact extends BaseTaskArtifact` (or other type) with appropriate normalization/validation and optional `assessAgainst`.
2. Extend `ArtifactFactory.create` switch.
3. Parsers: ensure they can output `content` for the new type.
4. Optional: type-specific metadata conventions (e.g., waveform ranges) stored in `artifact.metadata`.

## Suggested file structure

- `src/AdminSheet/Models/TaskDefinition.js` – TaskDefinition class.
- `src/AdminSheet/Models/Artifacts.js` – BaseTaskArtifact + typed subclasses + ArtifactFactory.
- `src/AdminSheet/Models/StudentSubmission.js` – StudentSubmission and StudentSubmissionItem.
- `src/AdminSheet/Models/Assessment.js` – existing; reused.

You can keep a temporary alias:
- `StudentTask` → `StudentSubmission` (class alias) to ease the rename. Remove once callers are migrated.

## Public API summary (minimal contract)

- TaskDefinition
  - `constructor({ taskTitle, taskType, pageId?, imageCategory?, taskNotes?, taskMetadata?, id? })`
  - `createArtifact(role, { pageId?, content?, contentHash?, metadata? })`
  - `addReferenceArtifact(params)` / `addTemplateArtifact(params)`
  - `getPrimaryReference()` / `getPrimaryTemplate()`
  - `toJSON()` / `fromJSON(json)`

- ArtifactFactory
  - `create({ taskId, role, taskType, pageId?, content?, contentHash?, metadata?, assessments?, feedback? })`

- BaseTaskArtifact (and subclasses)
  - `normalizeContent(content)` / `validateContent(content)`
  - `ensureHash(hashFn)`
  - `addAssessment(criterion, Assessment)` / `addFeedback(feedback)`
  - `assessAgainst(definition, { criteria })` (optional)
  - `toJSON()` / `fromJSON(json)`

- StudentSubmissionItem
  - `addAssessment(criterion, Assessment)` / `getAssessment(criterion?)`
  - `addFeedback(feedback)` / `getFeedback(type?)`
  - `assessWith(taskDef, { criteria })`
  - `toJSON()` / `fromJSON(json)`

- StudentSubmission
  - `upsertItemFromExtraction(taskDef, { pageId?, content?, contentHash?, metadata? })`
  - `getItem(taskId)`
  - `addAssessment(taskId, criterion, Assessment)` / `addFeedback(taskId, feedback)`
  - `extract(parser, taskDefs)`
  - `toJSON()` / `fromJSON(json)`

## Implementation notes

- Keep Assessment objects simple and serializable; use the provided `Assessment` class.
- Use `Utils.generateHash` for id and contentHash; keep normalization per type.
- Avoid branching on doc type inside submission logic—push extraction variation into parsers and type logic into artifact subclasses.

## Clean-break migration plan

1. Introduce new classes/files alongside existing ones.
2. Update creation flow to build `TaskDefinition` and add reference/template artifacts.
3. Update parsers to implement `extractSubmissionArtifacts(...)` and key by `taskId`.
4. Replace `StudentTask` usages with `StudentSubmission` and `StudentSubmissionItem`.
5. Remove legacy fields (`taskReference`, `templateContent`, scattered `contentHash`) once all callers read artifacts.

## Open questions

- Do we want versioned TaskDefinitions per assignment iteration? If yes, add a `version` field and include it in ids.
- Do we support multiple template variants at once? Current design supports arrays; add selection logic if needed.
- Where do we centralize criteria logic (LLM prompts, rubrics)? Option A: per-type `assessAgainst`; Option B: dedicated assessment engine module.

## Example sequence (Slides)

1. Build `TaskDefinition` for each slide task; attach reference/template artifacts.
2. For each student, create `StudentSubmission(student, assignmentId, documentId)`.
3. Run `extract(parser, taskDefs)`; items are created with typed submission artifacts and hashed.
4. Run assessment per item: `item.assessWith(taskDef, { criteria })` or via an external engine using `taskDef.getPrimaryReference()`, `taskDef.getPrimaryTemplate()`, and `item.artifact`.
5. Persist `StudentSubmission.toJSON()` and updated `TaskDefinition.toJSON()`.

---

This architecture keeps identity and metadata with the TaskDefinition, content behavior with typed artifacts, and per-student state in StudentSubmission, enabling clear, type-safe, and extensible task handling.
