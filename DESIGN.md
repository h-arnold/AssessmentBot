# Task and Submission Architecture Design

Refined design for decoupling Task definition from student submissions. Aligns with existing workflow (Slides/Sheets parsers, image pipeline, LLM assessment) while tightening identities, hashing, and type behaviour.

## Goals

- Single source of truth for task identity and metadata.
- Typed artifacts encapsulate normalisation/validation/hashing.
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
 - Note: content encoding is canonical per artifact subclass and is not stored as a separate persisted field (e.g. Text -> 'text', Table/Spreadsheet -> 'table').
   For Image artifacts the canonical binary payload (base64) is stored in the artifact's `content` field (or written via the provided setter); a single fetch URL is kept as `metadata.sourceUrl` during extraction.
- ValidationStatus: 'ok' | 'empty' | 'invalid'
- Utils: generateHash(str), deepStableStringify(obj), normalizeUrls(urls), nowIso()
 - TaskType: 'text' | 'table' | 'spreadsheet' | 'image' (derived from the artifact subclass)

## Core classes

### TaskDefinition

Fields:
- id: string (stable; persisted). Default: hash(taskTitle + '-' + pageId)
- taskTitle: string (display/UI)
- pageId?: string
- index?: number (position of this task in the source document; parsers should set this sequentially to preserve document order)
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
- contentHash?: string (computed on normalised content)
- metadata: object
 - uid: string (stable identity for pipelines; default pattern uses the task and artifact position to ensure uniqueness: `${taskId}-${taskIndex||'0'}-${role}-${pageId||'na'}-${artifactIndex}`)
   - `taskIndex` is the `TaskDefinition.index` (parsers should set this when populating tasks sequentially).
   - `artifactIndex` is the position of the artifact within the task's artifact array (assigned by the TaskDefinition when adding/creating artifacts).
   Callers may provide an explicit `uid` to override the default if a different identity scheme is needed.

Shared methods:
- constructor({ taskId, role, pageId?, content?, contentHash?, metadata?, uid? })
- normalizeContent(content): any (type-specific)
- validate(): { status: ValidationStatus, errors?: string[] }
- ensureHash(): string (hash of normalised content via deepStableStringify)
- getUid(): string
 - getType(): TaskType (derived from the concrete subclass)
- toJSON() / static fromJSON(json)

Typed subclasses:
 - TextTaskArtifact
  - content: string
  - normalise: trim, normalise newlines; null if empty
- TableTaskArtifact
  - content: Array<Array<string|number|null>> | null; canonical encoding: 'table' (computed by the subclass)
  - normalise: coerce to array-of-arrays of strings, trim cells, strip empty trailing rows/cols
  - important: Parsers must NOT pass platform-specific objects (for example, Google Apps Script Table/PageElement objects) into the artifact. Parsers should extract plain JavaScript primitives (Array<Array<string|number|null>>) and hand those to the `TableTaskArtifact` which will perform normalisation, escaping, markdown generation and hashing.
- SpreadsheetTaskArtifact (extends Table)
  - metadata: { range?: string, sheetName?: string, bbox?: { r1,c1,r2,c2 }, ... }
  - normalisation: owns canonicalisation of spreadsheet content (e.g. uppercase outside quotes, preserve quoted strings, trim irrelevant whitespace). Parsers should not implement canonical, persistent normalisation.
 - ImageTaskArtifact
  - metadata: { sourceUrl: string } (single slide page URL used to fetch the image)
  - content: base64 | null (artifact stores the base64 binary payload in `content`. Implementations should provide a setter `setContentFromBlob(blob: Blob|Buffer|Uint8Array)` which converts the blob to base64, writes it to `content`, and computes `contentHash` from the base64 payload.)
  - behaviour: provide `setContentFromBlob(blob)` which:
    1. accepts a binary blob (or platform equivalent),
    2. converts it to a base64 string,
    3. sets `this.content` to that base64 value,
  4. computes and sets `this.contentHash` from the normalised base64 via `ensureHash()` / `deepStableStringify`.


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
 - (no per-item timestamps; submission-level `updatedAt` is authoritative)

Methods:
- constructor({ taskId, taskType, documentId?, pageId?, artifact })
- addAssessment(criterion: string, assessment: Assessment)
- getAssessment(criterion?: string): AssessmentJSON | object | null
- addFeedback(type: string, feedback: Feedback)
- getFeedback(type?: string): FeedbackJSON | object | null
- markAssessed(): void (set lastAssessedHash, update timestamp)
- getType(): TaskType
- toJSON() / static fromJSON(json)
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
- Parsers provide minimal normalisation; artifacts finalise normalisation and hashing.
   - Important: parsers should extract primitive data from platform APIs and pass only primitives to artifacts. For example, when the parser encounters a Slides table it should read cell text and produce an Array<Array<string|number|null>>; it should not pass the GAS Table object into the artifact.

    Example (parser-side):

    - const raw = this.extractTableAsCells(gasTable); // Array<Array<string|number|null>>
    - const tableArtifact = TableTaskArtifact.fromRawCells(raw);
    - const md = tableArtifact.toMarkdown();

  - For text content specifically: parsers should extract a plain string and avoid performing final normalisation.
    The parser's job is to convert the platform object (for example, a Slides Shape) into a primitive value
    (e.g. `const raw = this.extractTextFromShape(shape); // string`). The `TextTaskArtifact` is responsible
    for canonical text normalisation (trim, newline normalisation, collapse/expose whitespace rules, and
    converting empty strings to `null`) and for computing the `contentHash`.

    Example (parser → artifact for text):

    - const raw = this.extractTextFromShape(gasShape); // string
    - const textArtifact = TextTaskArtifact.fromRawText(raw);
  - // textArtifact.normalizeContent() and textArtifact.ensureHash() are artifact responsibilities


  This keeps artifact classes pure, testable, and free of environment-specific APIs while preserving the parser's responsibility for interacting with platform objects.

  - Important rule: all content hashing is the responsibility of the `TaskArtifact` classes. Parsers,
    `TaskDefinition` constructors, `TaskSheet` helpers, ImageManager fetchers, and other layers must NOT
    compute or persist `contentHash` values themselves. Instead, parsers supply primitive `content` and
    `metadata` and the artifact must compute its canonical normalised representation and hash (for example
  via `artifact.normalizeContent(); artifact.ensureHash()` or helper constructors like
    `TextTaskArtifact.fromRawText(...)`). This preserves a single, testable hashing implementation and
    avoids divergence between parser-side heuristics and artifact identity.

    - For spreadsheet/task-sheet extraction: parsers (and any `TaskSheet` helpers) must convert GAS objects
      into plain, serialisable primitives (for example an array of formula strings plus [row,col] locations or
      an Array<Array<string|null>> of cell contents). Parsers should NOT hand GAS `Sheet`/`Range`/`Table`
      objects or TaskSheet instances into artifact constructors.

  The parser is allowed to perform minimal, local normalisation that simplifies diff-detection
  (for example trimming irrelevant whitespace when comparing reference ↔ template). However, any
  canonical formula/cell normalisation that affects persistent identity or hashing (for example the
  quote-handling and case-normalisation currently implemented in `_normaliseFormulaCase`) must live
      on the `SpreadsheetTaskArtifact` (or a helper in the artifacts module). That ensures:

  - hashing is stable and testable outside GAS,
      - parsers focus on mapping positions/metadata (bounding boxes, sheet names, locations), and
      - different parser implementations produce the same canonical artifact representation.

      Example (parser-side for sheets):

      - const rawCells = this.extractFormulaCellsFromRange(gasRange); // Array<Array<string|null>>
      - const metadata = { sheetName, bbox } // bounding box, ranges etc.
      - const ssArtifact = SpreadsheetTaskArtifact.fromRawCells(rawCells, { metadata });
      - // ssArtifact.normalizeContent() and ssArtifact.ensureHash() compute canonical formula text and hash

      Note: parsers should still compute bounding boxes, `referenceLocationsMap` and other positional
      metadata since these are document-structure concerns. Artifacts consume the primitive cell/formula
      data and own canonicalisation, markdown/serialization and content hashing.

## Assessment engines and routing

To keep artifacts pure (normalisation/validation/hashing only) and make assessment strategies pluggable, assessment is routed by task type:

- AssessmentEngineRouter
  - spreadsheet → SheetsAssessorEngine (rule-based, non-LLM)
  - text | table | image → LLMRequestManager (LLM-based)

- SheetsAssessorEngine contract
  - Inputs: the primary reference `SpreadsheetTaskArtifact` from `TaskDefinition` and the student's `SpreadsheetTaskArtifact` (role='submission') from `StudentSubmissionItem`.
  - Uses `taskDefinition.taskMetadata` (e.g., `bbox`, `referenceLocationsMap`, `sheetName`) for positional context.
  - Compares canonicalised formulas from artifacts; writes assessments and feedback back to the `StudentSubmissionItem` via its API.
  - Caching is optional; typical usage does not require LLM or cache.

- LLMRequestManager
  - Continues to handle non-spreadsheet tasks. Request generation and processing remain as specified below.
  - Implementations should skip spreadsheet items when building LLM requests.

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
 - processImages (Slides): batch-fetch image binaries for Image artifacts by `uid` and call each artifact's `setContentFromBlob(blob)` to write base64 into `content` and compute/update `contentHash`.

## LLMRequestManager contract

- generateRequestObjects(assignment):
  - For each StudentSubmissionItem that requires assessment (implementation-specific check):
    - Collect reference/template artifacts (primary) and submission artifact
    - Include task context (taskNotes, pageId, taskId) and student/assignment info
    - Produce minimal, typed payload
  - Not-attempted detection for non-spreadsheet tasks: if the submission artifact's `contentHash` equals the template artifact's `contentHash`, mark as not attempted and skip LLM.
- processStudentResponses(requests, assignment):
  - Handle batching/limits; write assessments to items; call markAssessed()

## ImageManager expectations

- collectAllImageArtifacts(assignment): Array<{ uid, url: string, documentId: string, scope: 'reference'|'template'|'submission', taskId, itemId? }>
  - One URL per image artifact, read from `artifact.metadata.sourceUrl`.
  - Include the related `documentId` (e.g., reference/template doc for definition artifacts; submission doc for student items).
- fetchImagesAsBlobs(entries, batchSize): Array<{ uid, blob: Blob|Buffer|Uint8Array }>
  - Fetch the raw image binary data using the single URL provided per entry.
  - Interleave batches by `documentId` (round-robin across documents) to minimise per-document throttling; otherwise keep batching logic simple and close to existing behaviour.
  - The ImageManager should hand each blob to `artifact.setContentFromBlob` to persist base64 and compute hashes.
- writeBackContent(assignment, results): helper to apply blobs/base64 back to the appropriate artifacts or items (but primary write should happen via the artifact setter).
- Image hashing: artifacts compute `contentHash` from the base64 payload. Different fetch URLs that resolve to the same binary image will yield identical base64 and therefore identical hashes.

## Identity and hashing

- TaskDefinition.id is stable and persisted (default hash(taskTitle + '-' + pageId)).
- Artifacts compute contentHash from normalised content via deepStableStringify.
- Image artifacts compute `contentHash` from the base64 image payload. The URL is only used to fetch the image; different URLs that resolve to the same image should result in the same `contentHash` once the binary is converted to base64 and set on the artifact via `setContentFromBlob`.
 - No legacy hash compatibility is required. All hashing is centralised in artifacts over canonical, normalised content.

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

1. Add a subclass of BaseTaskArtifact with type-specific normalisation/validation.
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
3. Extract submission artifacts via parser; upsert items; artifacts normalise and hash.
4. Generate LLM requests for items that need reassessment; process responses; write assessments; mark assessed.
5. Optionally fetch base64 for images for presentation; keep hashes based on URLs.

---

This design keeps identity and metadata with TaskDefinition, typed content with TaskArtifacts, and per-student state in StudentSubmission, matching your current workflow while improving stability and maintainability.
