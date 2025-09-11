# Task and Submission Architecture Design

Refined design for decoupling Task definition from student submissions. Aligns with existing workflow (Slides/Sheets parsers, image pipeline, LLM assessment) while tightening identities, hashing, and type behavior.

## Goals

- Single source of truth for task identity and metadata.
- Typed artifacts encapsulate normalization/validation/hashing.
- Stable `taskId` and consistent hashing for caching/change detection.
- Reference/template artifacts live on the definition; submissions are per-student.
- Extensible for new task types without touching the core.

## Terminology

- TaskDefinition: describes the task and owns reference/template artifacts.
- TaskArtifact: typed content instance for a role: reference | template | submission.
- StudentSubmissionItem: per-task wrapper for a student’s submission plus assessments/feedback.
- StudentSubmission: per-student aggregate for an assignment.

## High-level model

```
TaskDefinition (id, taskTitle, pageId?, metadata)
  ├─ artifacts.reference[] : TaskArtifact<Text|Table|Spreadsheet|Image>
  └─ artifacts.template[]  : TaskArtifact<Text|Table|Spreadsheet|Image>

StudentSubmission (studentId, assignmentId, documentId?)
  └─ items[taskId] : StudentSubmissionItem
       ├─ artifact (role='submission', typed)
       ├─ assessments { criterion -> Assessment }
       └─ feedback { type -> Feedback }
```

Definition owns reference/template artifacts (can be multiple per role). Submissions hold per-student state only.

## Enums and shared helpers

- ArtifactRole: 'reference' | 'template' | 'submission'
- Note: content encoding is canonical per artifact subclass and is not stored as a separate persisted field (e.g. Text -> 'text', Table/Spreadsheet -> 'table', Image -> 'url'). Base64 image payloads are kept in metadata.
- ValidationStatus: 'ok' | 'empty' | 'invalid'
- Utils: generateHash(str), deepStableStringify(obj), normalizeUrls(urls), nowIso()

## Core classes

### TaskDefinition

Fields:
- id: string (stable; persisted). Default: hash(taskTitle + '-' + pageId)
- taskTitle: string (display/UI)
- pageId?: string
- taskNotes?: string | null
- taskMetadata: object (free-form; e.g., ranges, bounding boxes)
- artifacts: { reference: TaskArtifact[], template: TaskArtifact[] }

Methods:
- constructor({ id?, taskTitle, pageId?, taskNotes?, taskMetadata? })
- getId(): string
- addReferenceArtifact(params): TaskArtifact
- addTemplateArtifact(params): TaskArtifact
- createArtifact(role, params): TaskArtifact
- getPrimaryReference(): TaskArtifact | null
- getPrimaryTemplate(): TaskArtifact | null
- toJSON() / static fromJSON(json)

Validation:
- Ensure at least one reference and one template artifact exist.

Notes:
- Persist `id`; do not re-derive when titles/pages change.
- Merge reference/template by `id` (not title) when populating from docs.

### TaskArtifact hierarchy

Shared fields (BaseTaskArtifact):
- taskId: string
- role: ArtifactRole
- documentId?: string
- pageId?: string
- contentHash?: string (computed on normalized content)
- metadata: object
- uid: string (stable identity for pipelines; default `${taskId}-${role}-${pageId||'na'}-${index}`)

Shared methods:
- constructor({ taskId, role, pageId?, content?, contentHash?, metadata?, uid? })
- normalizeContent(content): any (type-specific)
- validate(): { status: ValidationStatus, errors?: string[] }
- ensureHash(): string (hash of normalized content via deepStableStringify)
- getUid(): string
- toJSON() / static fromJSON(json)

Typed subclasses:
 - TextTaskArtifact
  - content: string
  - normalize: trim, normalize newlines; null if empty
- TableTaskArtifact
  - content: Array<Array<string|number|null>> | null; canonical encoding: 'table' (computed by the subclass)
  - normalize: coerce to array-of-arrays of strings, trim cells, strip empty trailing rows/cols
- SpreadsheetTaskArtifact (extends Table)
  - metadata: { range?: string, sheetName?: string, bbox?: { r1,c1,r2,c2 }, ... }
- ImageTaskArtifact
  - slideUrl: string (single slide page URL; artifact holds one URL which is converted to a png)
  - content: base64 (artifact stores base64 in content/metadata; contentHash is computed from the base64 payload)


Important: Artifacts do NOT store assessments/feedback. Those live only on StudentSubmissionItem.

### StudentSubmission

Fields:
- studentId: string (Google Classroom userId)
- assignmentId: string
- documentId?: string | null
- items: { [taskId: string]: StudentSubmissionItem }
- createdAt: string (ISO)
- updatedAt: string (ISO) (computed from the last modified property of the Google Drive document the submission is extracted from.)

Methods:
- constructor(studentId, assignmentId, documentId?)
- upsertItemFromExtraction(taskDef, { pageId?, content?, metadata?, contentHash? }): StudentSubmissionItem
- getItem(taskId): StudentSubmissionItem | undefined
- toJSON() / static fromJSON(json)

### StudentSubmissionItem

Fields:
- id: string (hash of assignmentId + student.id + taskId)
- taskId: string
- documentId?: string | null
- pageId?: string | null
- artifact: TaskArtifact (role='submission')
- assessments: { [criterion: string]: AssessmentJSON }
- feedback: { [type: string]: FeedbackJSON }

Methods:
- constructor({ taskId, taskType, documentId?, pageId?, artifact })
- addAssessment(criterion: string, assessment: Assessment)
- getAssessment(criterion?: string): AssessmentJSON | object | null
- addFeedback(type: string, feedback: Feedback)
- getFeedback(type?: string): FeedbackJSON | object | null
- markAssessed(): void (set lastAssessedHash, update timestamp)
- getType(): TaskType
- toJSON() / static fromJSON(json)

## Parsers (Slides/Sheets)

Unified interface:
- extractTaskDefinitions(referenceId, templateId?): TaskDefinition[]
- extractSubmissionArtifacts(documentId, taskDefs: TaskDefinition[]): Array<{
  taskId: string, pageId?: string, content: any, metadata?: object
}>

Notes:
- Parsers map titles/pages to `taskId` internally and output stable `taskId` keys.
- Parsers provide minimal normalization; artifacts finalize normalization and hashing.

## Assignment layer integration

Assignment (base):
- Fields: courseId, assignmentId, assignmentName, tasks: { [taskId]: TaskDefinition }, submissions: StudentSubmission[], progressTracker
- Methods:
  - addStudent(student): StudentSubmission
  - fetchSubmittedDocumentsByMimeType(mimeType): sets submission.documentId
  - populateTasks(): abstract → produces TaskDefinition[] (keyed by taskId)
  - processAllSubmissions(): abstract → fills submissions via parser.extractSubmissionArtifacts
  - generateLLMRequests(): request objects for items that need (re)assessment
  - assessResponses(): batches requests, writes results into items, marks assessed

SlidesAssignment/SheetsAssignment:
- populateTasks: use respective parser.extractTaskDefinitions and map by `id`
- processAllSubmissions: for each submission with documentId → extractSubmissionArtifacts → upsert items
- processImages (Slides): batch-fetch base64 for Image artifacts by `uid` and write to `metadata.base64` (do not affect hashes)

## LLMRequestManager contract

- generateRequestObjects(assignment):
  - For each StudentSubmissionItem that requires assessment (implementation-specific check):
    - Collect reference/template artifacts (primary) and submission artifact
    - Include task context (taskNotes, pageId, taskId) and student/assignment info
    - Produce minimal, typed payload
- processStudentResponses(requests, assignment):
  - Handle batching/limits; write assessments to items; call markAssessed()

## ImageManager expectations

- collectAllImageArtifacts(assignment): Array<{ uid, urls: string[], scope: 'reference'|'template'|'submission', taskId, itemId? }>
- fetchImagesAsBase64(entries, batchSize): Array<{ uid, base64: string[] }>
- writeBackBase64(assignment, results): store under artifact.metadata.base64 or item.artifact.metadata.base64
- Image hashing: artifacts compute `contentHash` from the base64 payload. The ImageManager may request different URLs for the same artifact, but identical base64 results should yield identical hashes.

## Identity and hashing

- TaskDefinition.id is stable and persisted (default hash(taskTitle + pageId)).
- Artifacts compute contentHash from normalized content via deepStableStringify.
- Image artifacts compute `contentHash` from the base64 image payload. URLs are only used to fetch the image; different URLs that resolve to the same image should result in the same `contentHash`.

## JSON shapes (examples)

TaskDefinition JSON (simplified):

```json
{
  "id": "t_abc123",
  "taskTitle": "Task 1 - Word Bank",
  "pageId": "gSlide123",
  "taskNotes": null,
  "taskMetadata": {},
  "artifacts": {
    "reference": [{
  "taskId": "t_abc123",
  "role": "reference",
  "pageId": "gSlide123",
  "content": "dog, cat",
  // canonical encoding is implied by `taskType` / artifact subclass and not stored here
      "contentHash": "...",
      "metadata": {},
      "uid": "t_abc123-reference-gSlide123-0"
    }],
    "template": [{
  "taskId": "t_abc123",
  "role": "template",
  "pageId": "gSlide123",
  "content": "",
  // canonical encoding is implied by `taskType` / artifact subclass and not stored here
      "contentHash": "...",
      "metadata": {},
      "uid": "t_abc123-template-gSlide123-0"
    }]
  }
}
```

StudentSubmission JSON (simplified):

```json
{
  "studentId": "s_123",
  "assignmentId": "a_123",
  "documentId": "doc_123",
  "items": {
    "t_abc123": {
      "id": "ssi_abc",
      "taskId": "t_abc123",
      "documentId": "doc_123",
      "pageId": "gSlide123",
      "artifact": {
        "taskId": "t_abc123",
        "role": "submission",
        "pageId": "gSlide123",
        "content": "dog, cat",
        "contentHash": "...",
        "metadata": {},
        "uid": "t_abc123-submission-gSlide123-0"
      },
      "assessments": { "accuracy": { "score": 4, "reasoning": "..." } },
      "feedback": {},
      "lastAssessedHash": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Error handling and edge cases

- Missing `documentId` on submission: log and skip extraction.
- Parser returns unknown `taskId`: warn and skip.
- No submission for a task: create an item with null-content artifact.
- Validation fails: record status/errors on item or artifact metadata.
- Title/page changes: persist `id` externally to avoid drift.

## Extending with new task types

1. Add a subclass of BaseTaskArtifact with type-specific normalization/validation.
2. Extend ArtifactFactory.create switch.
3. Ensure parsers can output content for the new type.
4. Define any type-specific metadata conventions.

## Suggested file structure

- `src/AdminSheet/Models/TaskDefinition.js` – TaskDefinition class.
- `src/AdminSheet/Models/Artifacts.js` – BaseTaskArtifact + typed subclasses + ArtifactFactory.
- `src/AdminSheet/Models/StudentSubmission.js` – StudentSubmission and StudentSubmissionItem.
- `src/AdminSheet/Models/Assessment.js` – existing; reused.

## Public API summary

TaskDefinition
- `constructor({ taskTitle, pageId?, taskNotes?, taskMetadata?, id? })`
`createArtifact(role, { pageId?, content?, metadata?, contentHash? })`
- `addReferenceArtifact(params)` / `addTemplateArtifact(params)`
- `getPrimaryReference()` / `getPrimaryTemplate()`
- `toJSON()` / `fromJSON(json)`

ArtifactFactory
`create({ taskId, role, pageId?, content?, metadata?, contentHash?, uid? })`

BaseTaskArtifact (and subclasses)
- `normalizeContent(content)` / `validate()`
- `ensureHash()` / `getUid()`
- `toJSON()` / `fromJSON(json)`

StudentSubmissionItem
- `addAssessment(criterion, Assessment)` / `getAssessment(criterion?)`
- `addFeedback(type, Feedback)` / `getFeedback(type?)`
- `markAssessed()`
- `toJSON()` / `fromJSON(json)`

StudentSubmission
`upsertItemFromExtraction(taskDef, { pageId?, content?, metadata?, contentHash? })`
- `getItem(taskId)`
- `toJSON()` / `fromJSON(json)`

## Example sequence (Slides)

1. Build TaskDefinitions; attach reference/template artifacts.
2. Create StudentSubmission per student; set documentId when available.
3. Extract submission artifacts via parser; upsert items; artifacts normalize and hash.
4. Generate LLM requests for items that need reassessment; process responses; write assessments; mark assessed.
5. Optionally fetch base64 for images for presentation; keep hashes based on URLs.

---

This design keeps identity and metadata with TaskDefinition, typed content with TaskArtifacts, and per-student state in StudentSubmission, matching your current workflow while improving stability and maintainability.
