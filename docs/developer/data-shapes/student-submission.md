# Component Shape: Student Submission

A single student's submission for an assignment, plus its per-task submission items.
Embedded inside the Assignment contract; never persisted or transported independently.

Backend model: `src/backend/Models/StudentSubmission/index.js` (submission facade),
`src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js` (item model)
Acquisition/extraction producer: `src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js`,
`src/backend/AssignmentProcessor/SlidesAssignment.js`, `src/backend/AssignmentProcessor/SheetsAssignment.js`
Image hydration producer: `src/backend/RequestHandlers/ImageManager.js`
Current-format restoration: `src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js`
Legacy read projection: `src/backend/AssignmentProcessor/Assignment/02_AssignmentReadProjection.js`
Collections: none — embedded in `assign_full_<courseId>_<assignmentId>` only
API handlers: none — no standalone endpoints
Frontend Zod (full): `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `StudentSubmissionSchema`, `StudentSubmissionItemSchema`
Frontend Zod (partial): `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `StudentSubmissionPartialSchema`, `StudentSubmissionItemPartialSchema`

Sibling contracts:

- [Contract: Assignment](assignment.md) — **origin**. `Assignment.submissions[]` embeds this shape; its `toJSON()`/`toPartialJSON()`/`toReadJSON()` drive both persistence and transport.
- [Contract: Assessment](assessment.md) — each `StudentSubmissionItem.assessments` entry is an `Assessment`; the atomic `setError()` primitive lives on the item.
- [Contract: BaseTaskArtifact](base-task-artifact.md) — `StudentSubmissionItem.artifact` uses that shape with `role: 'submission'`.
- [Contract: ABClass](abclass.md) — embeds the partial submission shape inside class-embedded assignment partials.
- [Transport envelope](transport-envelope.md) — this shape never forms a top-level `data` payload.

---

## Persistence

Participates in the `assign_full_<courseId>_<assignmentId>` document through the parent
Assignment serialisers. There is no collection of its own.

### `StudentSubmission.toJSON()`

| #   | Field          | Type                                    | Persistence | Transport | Frontend Zod (full)                                                                | Notes                                                                                                                                                                                                                |
| --- | -------------- | --------------------------------------- | ----------- | --------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `studentId`    | `string`                                | included    | unchanged | `StudentSubmissionSchema.studentId: z.string()`                                    | Student's unique ID from Google Classroom.                                                                                                                                                                           |
| 2   | `studentName`  | `string\|null`                          | included    | unchanged | `StudentSubmissionSchema.studentName: z.string().nullable()`                       | Constructor default is `null`. Both full and partial schemas validate the nullable emission. The legacy reassessment placeholder also uses `string \| null`; do not fabricate a name when only an identity is known. |
| 3   | `assignmentId` | `string`                                | included    | unchanged | `StudentSubmissionSchema.assignmentId: z.string()`                                 | The parent assignment ID.                                                                                                                                                                                            |
| 4   | `documentId`   | `string\|null`                          | included    | unchanged | `StudentSubmissionSchema.documentId: z.string().nullable().optional()`             | Drive file ID of the student's submission document. `null` for students who never opened the assignment.                                                                                                             |
| 5   | `items`        | `Record<string, StudentSubmissionItem>` | included    | unchanged | `StudentSubmissionSchema.items: z.record(z.string(), StudentSubmissionItemSchema)` | Dictionary keyed by taskId. Empty object when no items.                                                                                                                                                              |
| 6   | `createdAt`    | `string`                                | included    | unchanged | `StudentSubmissionSchema.createdAt: z.string()`                                    | ISO 8601 string. Set at construction.                                                                                                                                                                                |
| 7   | `updatedAt`    | `string`                                | included    | unchanged | `StudentSubmissionSchema.updatedAt: z.string()`                                    | ISO 8601 string with monotonic counter suffix (e.g. `"2025-09-10T12:30:00Z#2"`). Set via `touchUpdated()`.                                                                                                           |

### `StudentSubmission.toPartialJSON()`

Same seven fields. `items` is mapped through `StudentSubmissionItem.toPartialJSON()`
(artifact content/hash redacted; numeric and `'N'` assessment reasoning stripped;
`'E'` entries retain `{ score, reasoning, error }`).

| Field          | Persistence | Transport (class partial) | Frontend Zod (partial)                                                                           | Notes                       |
| -------------- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------- |
| `studentId`    | included    | unchanged                 | `StudentSubmissionPartialSchema.studentId: z.string()`                                           |                             |
| `studentName`  | included    | unchanged                 | `StudentSubmissionPartialSchema.studentName: z.string().nullable()`                              |                             |
| `assignmentId` | included    | unchanged                 | `StudentSubmissionPartialSchema.assignmentId: z.string()`                                        |                             |
| `documentId`   | included    | unchanged                 | `StudentSubmissionPartialSchema.documentId: z.string().nullable().optional()`                    | Tolerates absent or `null`. |
| `items`        | included    | unchanged                 | `StudentSubmissionPartialSchema.items: z.record(z.string(), StudentSubmissionItemPartialSchema)` |                             |
| `createdAt`    | included    | unchanged                 | `StudentSubmissionPartialSchema.createdAt: z.string()`                                           |                             |
| `updatedAt`    | included    | unchanged                 | `StudentSubmissionPartialSchema.updatedAt: z.string()`                                           |                             |

Key notes:

- The `updatedAt` monotonic counter suffix (`...Z#2`) is a valid `z.string()` match;
  Zod enforces only the string type, not ISO format.
- `documentId` is `.nullable().optional()` in both frontend schemas. The optionality
  tolerates both `null` and the key being omitted entirely from real payloads, even
  though both serialisers always emit it.
- Legacy records are **not** re-serialised from this shape: the opaque legacy snapshot
  is re-emitted verbatim by the parent serialiser. See
  [Component Shape: Assessment § Legacy reassessment read projection](assessment.md#legacy-reassessment-read-projection).

### `StudentSubmissionItem.toJSON()`

| #   | Field         | Type                         | Persistence | Transport | Frontend Zod (full)                                                                                                      | Notes                                                                                                                                                                                                       |
| --- | ------------- | ---------------------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `id`          | `string`                     | included    | unchanged | `StudentSubmissionItemSchema.id: z.string()`                                                                             | Derived stable UID prefixed with `ssi_`.                                                                                                                                                                    |
| 2   | `taskId`      | `string`                     | included    | unchanged | `StudentSubmissionItemSchema.taskId: z.string()`                                                                         | References the task definition ID.                                                                                                                                                                          |
| 3   | `artifact`    | `BaseTaskArtifact`           | included    | unchanged | `StudentSubmissionItemSchema.artifact: BaseTaskArtifactSchema`                                                           | The submission artifact (`role: 'submission'`). See [Contract: BaseTaskArtifact](base-task-artifact.md).                                                                                                    |
| 4   | `assessments` | `Record<string, Assessment>` | included    | unchanged | `StudentSubmissionItemSchema.assessments: z.record(z.string(), AssessmentSchema)`                                        | Record keyed by criterion. Current producers write only `completeness`, `accuracy` and `spag`; `SheetsAssessor` does not persist a `formulaComparison` entry (cell-reference feedback stays in `feedback`). |
| 5   | `feedback`    | `Record<string, Feedback>`   | included    | unchanged | `StudentSubmissionItemSchema.feedback: z.record(z.string(), z.looseObject({ type: z.string(), createdAt: z.string() }))` | Record keyed by feedback type. Empty object when no feedback. `Feedback` is documented inline in [Contract: Assignment § Feedback](assignment.md#feedback).                                                 |

### `StudentSubmissionItem.toPartialJSON()`

Same five fields, with:

- `artifact` via `artifact.toPartialJSON()` (content/contentHash redacted).
- `assessments` via `_stripAssessmentReasoning()`: numeric and `'N'` entries keep only
  `score`; an `'E'` entry with its cause is preserved intact, retaining `reasoning`
  and `error`.

| Field         | Persistence | Transport (class partial) | Frontend Zod (partial)                                                                                          | Notes                                                                                            |
| ------------- | ----------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`          | included    | unchanged                 | `StudentSubmissionItemPartialSchema.id: z.string()`                                                             |                                                                                                  |
| `taskId`      | included    | unchanged                 | `StudentSubmissionItemPartialSchema.taskId: z.string()`                                                         |                                                                                                  |
| `artifact`    | included    | redacted                  | `StudentSubmissionItemPartialSchema.artifact: BaseTaskArtifactPartialSchema`                                    | Content and contentHash omitted by the schema.                                                   |
| `assessments` | included    | reasoning stripped        | `StudentSubmissionItemPartialSchema.assessments: z.record(z.string(), PartialAssessmentEntrySchema).optional()` | Provided entries validated by the shared partial result schema. `.optional()` tolerates absence. |
| `feedback`    | included    | unchanged                 | `StudentSubmissionItemPartialSchema.feedback: z.record(z.string(), z.unknown()).optional()`                     | Loose type tolerates any feedback structure.                                                     |

Key notes:

- `documentId` and `pageId` are intentionally omitted from
  `StudentSubmissionItem.toJSON()` — the parent submission holds `documentId`, and the
  artifact holds `pageId`.
- `_deriveId()` generates a stable hash from `taskId` + artifact UID (falling back to
  `contentHash`), truncated to 16 hex characters prefixed with `ssi_`.
- `setError(stage, code)` replaces every criterion in `Assessment.CRITERIA` with the
  catalogue `'E'` result for that stage/code and clears `feedback`; it is the atomic
  task-wide error primitive. See [§ Acquisition and extraction outcomes](#acquisition-and-extraction-outcomes)
  and [§ Image hydration outcomes](#image-hydration-outcomes).

### Representation mode

`StudentSubmission.fromJSON(json, mode)` and `StudentSubmissionItem.fromJSON(json, mode)`
take an explicit `'full' | 'partial'` mode. Partial redaction must never trigger
source-content failure detection or hash generation.

When the caller omits the mode, both methods fall back to the module-level constant
`DEFAULT_REPRESENTATION_MODE = 'full'` in `00_StudentSubmissionItem.js`. It is a GAS
script-scope constant, exported for Node tests through the guarded `module.exports`
block and attached in `tests/setupGlobals.js`.

Neither model stores a representation-mode field: `StudentSubmission` has no
`representationMode` property, and no mode value is serialised.

---

## Transport

This shape has no standalone endpoint. It is transported only inside the two
Assignment read payloads:

| Embedding boundary                                   | Projection                          | Transformation applied                                                                                                          |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `getAssignment` (`Assignment.toReadJSON()`)          | `StudentSubmission.toJSON()`        | None beyond the parent read projection (marker-1 restoration or legacy reassessment projection). Validated by the full schemas. |
| `getABClass` (`ABClassResponseMapper._toReadView()`) | `StudentSubmission.toPartialJSON()` | Artifact redaction and assessment-reasoning stripping as above. Validated by the partial schemas.                               |

Key contract notes:

- The **representation mode is threaded explicitly** from `Assignment.fromJSON()`
  through `Assignment._baseFromJSON()` / `_rehydrateSubmission()` and
  `AssignmentRehydration._rehydrateCurrentSubmission()` /
  `AssignmentCurrentRestoration._rehydrateCurrentSubmission()`, then through
  `SlidesAssignment.fromJSON()` / `SheetsAssignment.fromJSON()` and
  `StudentSubmission.fromJSON()` into `StudentSubmissionItem.fromJSON()`. It is not
  inferred from payload contents.
- On the legacy path, both reads substitute detached reassessment `E` submissions
  produced by the backend projector; the frontend never materialises a second
  reassessment graph. See
  [Component Shape: Assessment § Legacy reassessment read projection](assessment.md#legacy-reassessment-read-projection).
- `progressTracker` is never part of this shape (it is an Assignment-level runtime
  property).
- `DateUtils.deepConvertDates()` runs on the whole response at the transport boundary
  because `google.script.run` prohibits `Date` values.

---

## Sub-entities

This shape embeds [Contract: BaseTaskArtifact](base-task-artifact.md) and
[Contract: Assessment](assessment.md). Both are documented in their own component files.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` →
  `StudentSubmissionSchema`, `StudentSubmissionItemSchema` — full shapes.
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` →
  `StudentSubmissionPartialSchema`, `StudentSubmissionItemPartialSchema` — partial
  shapes (no content; numeric/`'N'` entries score-only; `'E'` entries retain
  reasoning/cause through the shared schema).
- `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` →
  `normaliseAssignmentRead()`, `normaliseClassRead()` — pure full/partial read
  normalisers invoked by both read services before their final parse.
- `src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts` →
  `isValidFullItem()`, `isValidPartialItem()`, `corruptItem()`, `itemErrorPath()` —
  item, artefact-association and parent-source contextual validation plus canonical
  corruption construction.

**Backend validation:**

- `StudentSubmission.validateRaw(json, mode)` — submission record shape; every item
  must be a `StudentSubmissionItem` instance or pass `StudentSubmissionItem.validateRaw`.
- `StudentSubmissionItem.validateRaw(json, mode)` — requires `artifact`, a non-empty
  `taskId`, and (full mode) own `content`/`contentHash` keys that are not `undefined`.
- `StudentSubmissionItem.validateCurrentRawArtifact(json, knownTaskId, mode)` —
  artifact identity, task association and per-type body/hash consistency.
- `AssignmentCurrentRestoration._validateCurrentAssignment()` — marker-1 root and
  authoritative task universe, validated once before any model constructor runs.
- `ABClassAssignmentValidation._validateCompletedAssignmentRun()` — completed-write
  gate; see [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write).

**Key domain validation rules:**

- `StudentSubmissionItem.setError(stage, code)` remains the sole atomic task-wide error
  primitive: it replaces every criterion in `Assessment.CRITERIA` and clears feedback.
- `upsertItemFromExtraction()` preserves an explicitly supplied `pageId: null` when the
  parent submission document is known; an omitted/`undefined` page ID falls back to the
  task definition's page ID, and an explicit student page ID is retained. An explicit
  `pageId: null` is never replaced by the reference task page. The artefact document ID
  comes from the extraction when supplied, otherwise from the parent submission.
- `_mergeExtractedContent()` clears `assessments` and `feedback` when normalised
  content changes, and sets `contentHash` to `null` for null content.

**Known discrepancies:**

1. **`StudentSubmissionSchema.documentId` and `StudentSubmissionPartialSchema.documentId` are `.nullable().optional()` but the backend always emits the field.**
   Both serialisers always include `documentId` (which may be `null`). The frontend
   schemas tolerate both `null` and an absent field to handle Google Classroom edge
   cases where the Drive reference is omitted for students who never opened the
   assignment.
   **Classification: Aligned** — permissive-by-design at the transport boundary.

2. **`StudentSubmissionPartialSchema.studentName` is `z.string().nullable()` and the backend always emits it as a nullable string.**
   Both sides aligned.
   **Classification: Aligned**.

3. **`StudentSubmissionItemPartialSchema.assessments` is `.optional()` but `toPartialJSON()` always emits it.**
   The backend always includes `assessments` (even if empty `{}`). The `.optional()`
   only matters if the key is missing due to an unexpected code path.
   **Classification: Aligned** — defensive tolerance.

4. **`StudentSubmission.updatedAt` uses a monotonic counter suffix (e.g. `"2025-09-10T12:30:00Z#2"`).**
   Not standard ISO 8601. The frontend uses `z.string()`, so it passes validation;
   downstream code that parses it as ISO 8601 would fail on the `#N` suffix.
   **Classification: Aligned** — the schema is intentionally loose; the counter is
   documented in `../backend/rehydration.md` (§Hydration Guidelines).

5. **`StudentSubmissionItemSchema.feedback` uses `z.looseObject` while `StudentSubmissionItemPartialSchema.feedback` uses `z.unknown()`.**
   The full schema validates `type` and `createdAt` as strings but tolerates extra
   fields (such as `items` for `CellReferenceFeedback`); the partial schema accepts any
   feedback structure.
   **Classification: Aligned** — intentional per feedback-type complexity.

6. **`BaseTaskArtifactPartialSchema` accepts `pageId`/`documentId` as `.nullable().optional()` while the full `BaseTaskArtifactFields` requires them.**
   See [Contract: BaseTaskArtifact § Known discrepancies](base-task-artifact.md#validation).
   **Classification: Aligned** — deliberate, scoped asymmetry.

7. **The source code comment on `StudentSubmission.studentName` still reads "Temporary addition for V0.7.2 - will be removed later", but the field is contractual.**
   Both read schemas validate `studentName: string | null` and the legacy reassessment
   placeholder depends on it. The comment is stale relative to the contract.
   **Classification: Fragile** — the comment invites removal of a field the transport
   contract requires. Removing it would break both read schemas and the placeholder
   shape. Recommended follow-up: delete or correct the comment in
   `src/backend/Models/StudentSubmission/index.js`.

---

### Acquisition and extraction outcomes

The student-stage producers establish acquisition before classification and materialise
terminal task failures at the known identity boundary. Successfully extracted items are
not completed results: they stay in flight with an empty assessment map until the later
assessment stage. This slice adds no collection, transport field, persisted scan state or
Assessment-code change; it wires the existing catalogue into the existing
`StudentSubmissionItem.setError()` primitive.

| Situation                                                                     | Scope                    | Recorded result                                                   | Source artefact                                                                                         | Notes                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StudentSubmissions.list` returns further `nextPageToken`                     | run                      | —                                                                 | —                                                                                                       | Every page is followed before absence is concluded.                                                                                                                                                                                      |
| A later `StudentSubmissions.list` page fails                                  | run                      | —                                                                 | —                                                                                                       | The original error is logged and rethrown unchanged; completed-run persistence is never reached and prior stored results are preserved.                                                                                                  |
| No submitted attachment for a roster student                                  | student                  | none                                                              | parent `documentId: null`, empty item map                                                               | Genuine no-submission evidence; no fabricated `N` items.                                                                                                                                                                                 |
| Attachment lacks a Drive file ID (non-Drive)                                  | student                  | none                                                              | unchanged; parent `documentId` stays `null`                                                             | Ignored by the settled admission policy and records no failure. Genuine no-submission only when no supported source and no recorded acquisition failure exist; ignored candidates do not erase a failure recorded for a Drive candidate. |
| Submitted Drive attachment is unreadable (expected `DriveApp` access failure) | student, all known tasks | `acquisition` / `SOURCE_UNREADABLE` on all three criteria         | canonical base placeholder: null `pageId`/`documentId`/`content`/`contentHash`, empty metadata/feedback | One original native diagnostic with the opaque file ID; atomic `setError()` replacement using the exact catalogue cause and reasoning.                                                                                                   |
| Submitted attachment MIME type is not the assignment document type            | student, all known tasks | `acquisition` / `UNSUPPORTED_DOCUMENT` on all three criteria      | canonical base placeholder                                                                              | Same atomic replacement using the exact catalogue cause and reasoning; no document is admitted.                                                                                                                                          |
| All supported-admission candidates rejected (ignored candidates may coexist)  | student, all known tasks | first observed acquisition cause on all three criteria            | canonical base placeholder                                                                              | The scan records the first failure only when no supported source was admitted; ignored non-Drive/missing-ID candidates record nothing and do not erase it. Order across attachment arrays and duplicate records is preserved.            |
| Rejected attachment alongside an accepted supported attachment                | student                  | no acquisition `E`                                                | accepted typed extraction artefact with student source IDs                                              | Failure materialisation is deferred until the complete scan ends; the accepted source suppresses rejected-candidate `E` and is not contaminated by it.                                                                                   |
| Multiple supported attachments or duplicate Classroom records                 | student                  | no acquisition `E`                                                | last supported source                                                                                   | The existing scan keeps the last supported attachment across attachment arrays and duplicate Classroom records. No persisted scan state or new upsert semantics are introduced.                                                          |
| Submitted document cannot be opened by the Slides/Sheets parser               | student, all known tasks | `acquisition` / `SOURCE_UNREADABLE` on all three criteria         | `content: null`, `contentHash: null`; explicit `pageId: null` and parent/artefact document ID retained  | Parser returns a failed-open null sentinel distinct from a successful empty array; `SlidesAssignment.processAllSubmissions` / `SheetsAssignment.processAllSubmissions` isolate the student.                                              |
| Slides task match is missing (TEXT/TABLE)                                     | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | `content: null`, `contentHash: null`; parent document ID retained; explicit `pageId: null`              | Parser emits a canonical placeholder and the assignment materialises `E`.                                                                                                                                                                |
| Slides IMAGE task has no actual match/source evidence                         | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | `type: 'IMAGE'`, null `pageId`/`content`/`contentHash`, empty metadata, parent document ID              | A missing IMAGE match is unavailable extraction, not pending hydration.                                                                                                                                                                  |
| Slides IMAGE task matched to a student page                                   | task                     | none                                                              | `type: 'IMAGE'`, matched student `pageId`, `metadata.sourceUrl`, null `content`/`contentHash`           | Valid pending internal state, not a completed result and not extraction `E`. `ImageManager` hydrates it or materialises `IMAGE_HYDRATION_FAILED` on failure (see [§ Image hydration outcomes](#image-hydration-outcomes)).               |
| Slides matched TEXT/TABLE content read fails                                  | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | `content: null`, `contentHash: null`; matched student `pageId` and document ID retained                 | `SlidesParserTableContent` converts only ordinary native read failures; one contextual diagnostic, never a duplicate matcher/model warning.                                                                                              |
| Student `getCell` returns literal `null`                                      | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | whole TABLE content `null`; no hashable partial or blank fallback                                       | The first failing cell aborts the whole table. An actually thrown `TypeError`/`ReferenceError`/non-Error still escapes, and shared-definition reads still throw.                                                                         |
| Sheets range read fails                                                       | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | `content: null`, `contentHash: null`; task `pageId` and student document ID retained                    | Only the immediate native `getRange(...)`/`getFormulas()` read converts; internal parsing and mutation faults escape.                                                                                                                    |
| Extracted non-`IMAGE` artefact has null content                               | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | `content: null`, `contentHash: null`                                                                    | Final assignment pass materialises `E`; a matched pending IMAGE is excluded from this conversion.                                                                                                                                        |
| Known task absent from the extracted artefact set                             | task                     | `extraction` / `SOURCE_CONTENT_UNAVAILABLE` on all three criteria | `content: null`, `contentHash: null`; parent document ID retained                                       | Final pass materialises a failure item for each known task with no extraction outcome; successfully extracted items remain in flight.                                                                                                    |
| Extraction artefact references an unknown task ID                             | —                        | warning and ignore                                                | —                                                                                                       | Existing behaviour retained; known-task failure materialisation is unaffected.                                                                                                                                                           |
| Ambiguous first match                                                         | —                        | warning                                                           | matched content                                                                                         | Warning, not `E`. Existing tag/type preference and first-match order are retained.                                                                                                                                                       |
| Successfully extracted blank content (`''`, `[]`)                             | task                     | no error                                                          | normalised content/hash                                                                                 | Blank work/template matching and formula scoring are unchanged; the item stays in flight until assessment.                                                                                                                               |
| `PARSE_FAILED`                                                                | —                        | catalogue code reserved                                           | —                                                                                                       | No distinct task-parse producer exists; the catalogue entry remains without a producer.                                                                                                                                                  |

Rules:

- `StudentSubmissionItem.setError(stage, code)` is the sole atomic task-wide error
  primitive (see [§ Validation](#validation)).
- Acquisition materialisation is scan-local. One `Map`/`Set` accumulator spans every
  attachment array and duplicate Classroom record for a student. The existing scan
  keeps the **last** supported attachment. A failure is recorded only while no
  supported source has been admitted, and only the first such failure is materialised
  after the complete scan; any accepted source clears the recorded failure. Ignored
  non-Drive/missing-ID candidates record nothing and do not erase a failure recorded
  for a Drive candidate. Genuine no-submission therefore requires both no supported
  source and no recorded acquisition failure. This adds no persisted scan state, retry
  state or new upsert semantics.
- The acquisition/extraction producers materialise terminal failure items for known
  tasks whose extraction failed; they do not mark healthy extracted work terminal.
  Completed-persistence _rejection_ of incomplete coverage is enforced at the write
  boundary; read-time coverage remains backend-owned as described under
  [§ Completed submission coverage](#completed-submission-coverage).
- Source conversion is placed at the immediate native operation only: Drive file/MIME
  access, document open, native range/formula reads and native text/dimension/cell/merge
  reads. An ordinary `Error` from those native operations becomes the scoped
  acquisition/extraction `E`; an actually thrown `TypeError`, `ReferenceError` or
  non-`Error` value propagates by identity. Internal matching, facade dispatch,
  bookkeeping, normalisation and mutation run outside the converting catches, so their
  ordinary failures propagate rather than being relabelled. There is no platform-error
  predicate, typed wrapper or exception hierarchy (see
  [Known discrepancies](#validation) item 8).
- An attachment without a Drive file ID is ignored by the settled admission policy and
  records no failure. The student keeps the genuine no-submission representation only
  when no supported source was admitted and no acquisition failure was recorded; ignored
  candidates do not erase a failure recorded for a Drive candidate. See
  [Known discrepancies](#validation) item 9.
- A matched IMAGE artefact (student page ID plus `metadata.sourceUrl`) is valid pending
  internal state, not a completed result, and is not converted to extraction `E` here.
  `ImageManager` hydrates it or materialises extraction `IMAGE_HYDRATION_FAILED` on
  failure; a matched pending image is never persisted as a completed null success (see
  [§ Image hydration outcomes](#image-hydration-outcomes)). An IMAGE task with no actual
  match or source evidence is unavailable extraction and receives all three
  `SOURCE_CONTENT_UNAVAILABLE` results; IMAGE is not unconditionally pending.
- Each owned native read failure emits one contextual diagnostic retaining the original
  error object and only opaque identifiers (studentId/documentId/taskId/page
  ID/coordinates). Handled paths never log `studentName`, source content or raw
  payloads, and never replace the original error with a synthetic one. Downstream model
  and progress duplicates are suppressed.
- Proof boundary: these outcomes are established by hermetic producer, model and
  caller/store-restoration tests with native services mocked and an explicit test-only
  marker where needed. They do not prove API transport, live GAS behaviour, image
  hydration or completion stamping.

### Image hydration outcomes

`src/backend/RequestHandlers/ImageManager.js` owns the scoped IMAGE hydration boundary.
It reuses the shared transport budget and the existing Slides document round-robin
scheduling. It adds no retry scheduler, second hydration manager, public `entry.item`
property, persisted status or transport field. A student image failure materialises the
atomic extraction `IMAGE_HYDRATION_FAILED` `E` with null content/hash; a required shared
reference/template failure blocks the run. Healthy siblings and successfully extracted
items are not converted to a scoped failure.

| Situation                                                                                                                                                                                       | Scope      | Recorded result                                      | Source artefact                                                                                                                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student item already carrying an upstream all-three terminal `E`                                                                                                                                | task       | preserved verbatim; no hydration attempt             | unchanged                                                                                                                                          | `collectAllImageArtifacts()` returns before scheduling or overwriting, so an acquisition `SOURCE_UNREADABLE` or extraction `SOURCE_CONTENT_UNAVAILABLE` item is never relabelled or downloaded. No hydration warning is emitted.                                                                                                                                                                                        |
| Matched student IMAGE with an admissible source URL                                                                                                                                             | task       | none yet; scheduled for hydration                    | `type: 'IMAGE'`, matched student `pageId`, `metadata.sourceUrl`; null `content`/`contentHash` while pending, existing values when already hydrated | Collected with its owning submission item retained privately; entry shape gains no public item property. An already-hydrated artefact with an admissible source is still scheduled; unchanged returned content preserves its results/feedback and changed content invalidates them.                                                                                                                                     |
| Matched student IMAGE with absent/invalid source URL                                                                                                                                            | task       | `extraction` / `IMAGE_HYDRATION_FAILED` on all three | `content: null`, `contentHash: null`                                                                                                               | Applies only when no upstream all-three terminal `E` is already established. An already-hydrated artefact is skipped; a pending one is materialised at collection. One bounded diagnostic with opaque identifiers.                                                                                                                                                                                                      |
| Final image download non-200 (including 201), permanent 4xx or network/transport exhaustion                                                                                                     | task       | `extraction` / `IMAGE_HYDRATION_FAILED` on all three | `content: null`, `contentHash: null`                                                                                                               | Images accept only HTTP 200 and declare no stop statuses, so a student-image 403 is local and never an LLM-wide stop. The shared three-total-attempt budget applies; no image-specific retry or semantic retry exists.                                                                                                                                                                                                  |
| Returned blob/content/hash unusable on a student item (null/empty bytes, null blob, reader-less blob, unusable stored hash)                                                                     | task       | `extraction` / `IMAGE_HYDRATION_FAILED` on all three | `content: null`, `contentHash: null`                                                                                                               | Applies only to non-throwing unusable returned data and never lets retained old content certify hydration, even on an already-hydrated item. A thrown native read, base64, hash or writer fault propagates by original identity with no `E` and no manager warning.                                                                                                                                                     |
| Required shared reference/template IMAGE with absent/invalid source URL or missing owning document ID                                                                                           | run        | none — not a student `E`                             | unchanged (no writeback)                                                                                                                           | Collection blocks the run by throwing. When no admissible source is available, an already-hydrated shared artefact is skipped; a pending one blocks the run.                                                                                                                                                                                                                                                            |
| Required shared reference/template IMAGE final download failure                                                                                                                                 | run        | none — not a student `E`                             | unchanged (no writeback)                                                                                                                           | The run blocks by throwing; prior saved results are preserved and no completed result is persisted.                                                                                                                                                                                                                                                                                                                     |
| Required shared reference/template IMAGE unusable returned content                                                                                                                              | run        | none — not a student `E`                             | not rolled back; `content` may already be assigned                                                                                                 | The run blocks by throwing; prior saved results are preserved and no completed result is persisted. Reader-less or unusable returned data on an already-hydrated shared artefact blocks rather than certifying retained content. Model conversion assigns `content` before hashing, so a shared write whose hash step fails can leave the new content and a null/old hash in memory. No in-memory rollback is promised. |
| Successfully hydrated IMAGE                                                                                                                                                                     | task       | no `E`                                               | data-URL `content` plus model-generated `contentHash`                                                                                              | Changed non-null hydrated content clears stale assessments/feedback; unchanged content preserves the complete snapshots. Source `metadata.sourceUrl` is retained.                                                                                                                                                                                                                                                       |
| Unknown/duplicate input or outcome UID, missing owning item, missing submissions/items structures, missing model methods, duplicate model artefact UIDs, unmatched/duplicate writeback blob UID | run/wiring | none — not an `Assessment` result                    | unchanged for the affected artefact; earlier applied blobs are not rolled back                                                                     | These are wiring faults and throw before the affected artefact's conversion or instead of a scoped result; a missing `setContentFromBlob` writer is a `TypeError` raised before any returned-data classification, so unusable data cannot hide it. Earlier blobs already applied in the same `writeBackBlobs()` call are not rolled back. They are not hydration failures.                                              |
| Actually thrown native read, base64, hash or writer fault                                                                                                                                       | run/wiring | none — not an `Assessment` result                    | not rolled back; `content` may already be assigned before a hash or writer fault                                                                   | The original value escapes by reference identity. No converting catch, no catalogue `E`, no manager diagnostic. A thrown hash or writer fault can occur after `content` is assigned, leaving changed in-memory content with a null/old hash.                                                                                                                                                                            |

Rules:

- URL admission delegates to the shared `Validate.isValidUrlShape` policy (HTTPS, DNS
  hostname only, no IP address, no localhost, no port, hostname label limits). That
  predicate emits no diagnostics, so a rejected source URL never reaches a log channel.
  `Validate.isValidUrl` shares the same hostname/label rules but keeps its
  progress-tracking error for HTTPS-prefix failures only.
- Scheduling and transport: one full-list `sendRequestsInBatches()` call carries the
  configured Slides-fetch batch size, accepted statuses `[200]` and no stop statuses.
  Document round-robin order and UID association are preserved, and final 200 blobs are
  read before the next batch. At most three total dispatches per request, including its
  initial batch attempt; retries are the shared transport's sequential member retries,
  never a nested scheduler.
- A matched pending IMAGE is valid internal state, never a completed result or a null
  success. The image stage must resolve each collected image to usable content/hash or
  its scoped `E` or shared failure before completion. Completed-persistence gates reject
  a still-pending image at the write boundary (see
  [Known discrepancies](#validation) item 10).
- Scope split: a student image failure is task-scoped `E` and never reaches the LLM; a
  required shared-image failure is run-blocking, fabricates no student `E` and never
  replaces prior saved results. Healthy sibling items, including same-submission
  siblings, are not converted to `E`; a shared failure does not roll back blobs already
  applied earlier in the same writeback call.
- Successful writeback validates hydrated content and a usable non-empty hash before the
  write stands. The manager reads the native bytes once and passes an owner-local
  adapter to `ImageTaskArtifact.setContentFromBlob()`, so data-URL/hash conversion
  remains model-owned without a second native read. Changed non-null content invalidates
  the reused item's stale assessments and feedback; unchanged content preserves them.
  The invalidation rule is applied owner-locally because `StudentSubmissionItem` exposes
  no callable invalidation primitive (see
  [Known discrepancies](#validation) item 11).
- No in-memory rollback is promised. `ImageTaskArtifact.setContentFromBlob()` assigns
  `content` before hashing, so a shared write whose hash step returns null or throws can
  leave the new content and a null/old hash on the in-memory artefact before the
  run-blocking throw. Prior saved records are preserved only because no completion
  persistence occurs; that is not rollback.
- Diagnostics are one bounded `ABLogger` warn per converted failure with opaque `uid`,
  `taskId` and `scope` (plus `attempts`/`responseCode` for transport failures). Source
  URLs, payloads, student names and raw error text are never logged; propagated faults
  emit no manager warning.
- Proof boundary: hermetic native HTTP/blob stubs, real models, memory collections and
  logger observers prove the manager/model/caller boundary only. They do not prove live
  GAS/network behaviour, deployed logging fidelity, durable persistence or
  completion-marker/prepared-write guarantees. The connected controller/store regression
  stubs extraction and assessment and is not production persistence evidence.

### Source artefact content and hash semantics

Full-artefact rules:

| Situation                                                                             | `content`                           | `contentHash`             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successfully read blank/all-null `SPREADSHEET` grid (blank template or student range) | `[]`                                | Normal hash of `[]`       | Canonicalised in `SpreadsheetTaskArtifact.normalizeContent()`; applies through construction, persistence and restoration. Literal `null` means unavailable content, not blank content. Existing populated-formula normalisation is unchanged.                                                                                                                                                                                                             |
| `SPREADSHEET` content unavailable                                                     | `null`                              | `null`                    | At the actual extraction boundary, confirmed unavailable content creates an extraction `SOURCE_CONTENT_UNAVAILABLE` `E`. A current-format full read that instead finds null content beside numeric/`N` marks converts all three results to validation `CORRUPT_RECORD` `E` (see the full-content consistency rule below). A `null` hash is never a usable content fingerprint and must not match another `null` hash for template-match or `N` decisions. |
| Non-blank `SPREADSHEET` grid                                                          | Existing canonicalised 2D grid      | Existing content hash     | Formula canonicalisation (space stripping, uppercasing) and trailing-row/column trimming are unchanged.                                                                                                                                                                                                                                                                                                                                                   |
| Matched student IMAGE pending hydration                                               | `null`                              | `null`                    | Valid internal state only (matched student `pageId` plus `metadata.sourceUrl`), never a completed result. `ImageManager` hydrates it or materialises extraction `IMAGE_HYDRATION_FAILED` `E` on failure.                                                                                                                                                                                                                                                  |
| IMAGE hydration failure (student scope)                                               | `null`                              | `null`                    | The atomic all-three extraction `IMAGE_HYDRATION_FAILED` `E` replaces stale marks/feedback; the artefact body/hash are cleared.                                                                                                                                                                                                                                                                                                                           |
| Successfully hydrated IMAGE                                                           | `string` (data URL)                 | Model-generated hash      | Written through `ImageTaskArtifact.setContentFromBlob()`; changed non-null content invalidates stale assessments/feedback, unchanged content preserves them.                                                                                                                                                                                                                                                                                              |
| Required shared IMAGE hydration failure                                               | — (no completed result)             | — (no completed result)   | Run-blocking failure: the pipeline throws, prior saved results are preserved and no completed result is persisted. Never a student `E`. No in-memory rollback is promised: model conversion assigns `content` before hashing, so a shared write whose hash step fails can leave the new content and a null/old hash on the in-memory artefact.                                                                                                            |
| Full submission artefact for an acquisition/extraction/validation `E`                 | `null` allowed                      | `null` allowed            | The placeholder uses the canonical model constructor with the known task/student association, explicit null content/hash and validated source identifiers when available.                                                                                                                                                                                                                                                                                 |
| Assessment-only `E`                                                                   | Successfully extracted content kept | Existing hash kept        | An error in marking does not imply that the source preview is unavailable.                                                                                                                                                                                                                                                                                                                                                                                |
| Stored reference/template/student content offered to the LLM                          | required by role                    | required non-empty string | `LLMRequestManager` treats a null or empty hash as an internal invariant fault before cache lookup or dispatch; it is not an assessment `E`, a cache miss, a live fallback or a template-match `N` (see [Contract: Assessment § LLM assessment outcomes and validated cache reuse](assessment.md#llm-assessment-outcomes-and-validated-cache-reuse)).                                                                                                     |
| Assessment-stage `E` with null full content                                           | `null` stored                       | `null` stored             | Contradictory stored record. An existing assessment-stage `E` with null full content remains a validation `CORRUPT_RECORD` `E`, not an accepted assessment-only error; it is never relabelled as `SOURCE_UNREADABLE` and no historical extraction cause is inferred. Partial redaction is exempt.                                                                                                                                                         |
| Partial artefact projection                                                           | `null`                              | `null`                    | Deliberate redaction. It is never evidence of extraction failure and is exempt from the full-content consistency check.                                                                                                                                                                                                                                                                                                                                   |

Rules:

- Canonicalising a blank student spreadsheet grid to `[]` does not change pedagogical
  scoring: blank student grids still receive the current formula scores (completeness
  `0`, accuracy `0`, SPaG `N`), not an extraction error or a new `N` rule.
- A spreadsheet reference task with zero assessable formulae is an invalid shared
  definition, not a valid blank template. It is rejected at the new-definition-write
  boundary by `AssignmentDefinitionValidation.validateSharedArtifacts()`; it is never a
  student `E`, and this contract adds no run-time eligibility preflight. Blank templates
  canonicalised to `[]` remain valid, and blank student ranges retain the formula scores
  above. See
  [Contract: BaseTaskArtifact § Availability by parent store](base-task-artifact.md#availability-by-parent-store).
- In completed full results, null submission content is allowed only for
  acquisition/extraction/validation `E` placeholders. On a current-format full read, null
  content beside purported numeric/`N` marks is a contradictory stored record: replace
  all three results with validation `CORRUPT_RECORD` `E` and its catalogue reasoning.
  Never guess `SOURCE_UNREADABLE` or infer a historical extraction cause from that
  contradiction. An actual extraction boundary that confirms content is unavailable
  creates an extraction `SOURCE_CONTENT_UNAVAILABLE` `E` instead. An assessment-only `E`
  retains its successfully extracted content. An existing assessment-stage `E` whose
  full record carries null content remains a contradictory stored record and becomes
  validation `CORRUPT_RECORD` `E`; it is not accepted as an assessment-only error.
  Partial artefact redaction is exempt from this full-content consistency check.
- IMAGE is the only artefact type with a valid pre-hydration null state. A matched
  student IMAGE (student `pageId` plus `metadata.sourceUrl`) remains pending with null
  content/hash until `ImageManager` resolves it. A student download/content/hash failure
  becomes the atomic extraction `IMAGE_HYDRATION_FAILED` `E` with null content/hash; a
  required shared reference/template failure blocks the run and preserves prior saved
  results. A pending image is never a completed null success, and completed persistence
  must not accept one (see
  [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write)).
  See [§ Image hydration outcomes](#image-hydration-outcomes).
- Any stored reference, template or student content offered to the LLM must carry a
  usable non-empty string `contentHash`. A null or empty hash is an internal invariant
  fault, thrown before cache lookup or dispatch; it is not an assessment `E`, a cache
  miss, a live fallback or a template-match `N`. Prior all-three `E` results still bypass
  this check. See
  [Contract: Assessment § LLM assessment outcomes and validated cache reuse](assessment.md#llm-assessment-outcomes-and-validated-cache-reuse).
- Confirmed no-submission is represented by parent `documentId: null` and an empty item
  map, not fabricated null-content `N` items (see
  [§ Completed submission coverage](#completed-submission-coverage)).
- Acquisition/extraction placeholders are consistent with these rules. A
  document-bearing extraction failure carries its matched/student document ID and page
  ID where available, null body/hash and all three extraction `E` results. A null-parent
  acquisition failure is the canonical base placeholder (null
  page/document/content/hash, empty metadata/feedback) described under
  [§ Acquisition and extraction outcomes](#acquisition-and-extraction-outcomes); it
  satisfies the marker-1 null-parent read invariant rather than being converted to
  `CORRUPT_RECORD`.
- No `.optional()` relaxation of full artefact `content`/`contentHash` is permitted; a
  missing required field is corruption, not legitimate null content.

### Completed submission coverage

> **Status: read coverage is active on both representations; acquisition/extraction
> producers materialise terminal failure items for known tasks; completed-persistence
> coverage rejection is enforced at the write boundary.** `AssignmentCurrentRestoration`
> materialises a missing known task as an all-three `CORRUPT_RECORD` `E`, isolates
> corrupt known items and incomplete/extra-key criteria while preserving healthy
> siblings, keeps a null-parent empty item map as an empty submission, and isolates
> contradictory null-parent items. For legacy records,
> `02_AssignmentReadProjection.js` materialises one detached `REASSESSMENT_REQUIRED` `E`
> item per known task/student pair on both reads. The browser normaliser implements the
> equivalent provided-entry isolation and defensive full-payload coverage and is invoked
> by both read services. Acquisition/extraction producers also materialise a failure item
> for every known task whose extraction failed; successfully extracted items remain in
> flight until assessment (see [§ Acquisition and extraction outcomes](#acquisition-and-extraction-outcomes)).

Version 1 coverage rules:

| Submission case                                     | Item map                                                                                               | Assessment values                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identified submission with a document               | One terminal item for every task in the embedded definition, even when extraction or assessment failed | Numeric, genuine `N`, or explicit `E` per completed criteria | A missing known task becomes a `CORRUPT_RECORD` `E`, materialised by `AssignmentRehydration` during one-pass full or partial backend restoration from the embedded snapshot. Both the current version-1 full read output from `toReadJSON()` and the class-partial output carry it. The browser full-read normaliser fills a task only defensively if a wire payload nonetheless lacks it, using that same payload's definition; the partial normaliser validates provided entries only. A truncated item map must not silently create `N`. |
| Confirmed no-submission (`documentId: null`)        | Empty item map                                                                                         | None                                                         | Sole confirmed no-submission omission case. Do not fabricate null-content `N` items for it.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Source-acquisition error with no usable document ID | Explicit `E` items for all known tasks                                                                 | Acquisition `E` (all three canonical criteria)               | The submission is not represented as an empty map when acquisition failed but the student/task identity is known.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Other null-document, non-empty item map             | Explicit `E` items only; a contradicting item is isolated individually                                 | All-three acquisition or validation `E` only                 | A null parent document makes the submission's source state authoritative. Numeric/`N` marks, or assessment-/extraction-stage `E`, contradict that state: on full and partial reads each identifiable offending item becomes all three validation `CORRUPT_RECORD` `E`, is never dropped, and healthy siblings are preserved. Items carrying valid acquisition/validation `E` remain valid.                                                                                                                                                  |
| Genuine no-submission                               | No observed item contributed to the analyser                                                           | Existing no-data `N` display placeholder                     | Do not insert raw `N` observations that would change existing average denominators.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Whole student absent from a direct full record      | —                                                                                                      | —                                                            | Missing students whose identity is not present in the direct full record are not invented.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Coverage resolution rules:

- The backend is authoritative for completed-item coverage on both read paths.
  `AssignmentRehydration` materialises a missing known task as a `CORRUPT_RECORD` `E`
  during one-pass full **and** partial restoration, using the assignment's own embedded
  task snapshot. Both the current version-1 full read output from `toReadJSON()` and the
  class-partial output therefore contain coverage `E` before transport. The browser's
  partial-read normaliser validates only the entries it is given; it never infers extra
  coverage errors from the separately loaded, potentially newer definition registry.
  Only if a full wire payload nonetheless lacks an expected task does the full-read
  normaliser defensively produce a `CORRUPT_RECORD` `E` using that same payload's
  definition. This mandatory fallback is a post-backend-validation corruption defence,
  not the normal full coverage owner. Backend-materialised `E` entries are never
  overwritten by coverage inference. No new task-universe transport field or full fetch
  is needed.
- A known dictionary task key paired with a mismatched item `taskId` becomes a
  `CORRUPT_RECORD` `E` for that known key. A stored item referencing no task in the
  embedded definition has no safe target and fails the owned assignment dataset; do not
  guess a task association. Extraction's existing warn-and-ignore treatment for an
  unknown task ID remains; known-task failure materialisation is unaffected.
- A null parent `documentId` with a non-empty item map is valid only when every item
  carries a complete all-three acquisition or validation `E` result. An identifiable
  item storing numeric/`N` marks, or an assessment- or extraction-stage `E`, contradicts
  the parent submission's null-document source state. On both full and partial reads,
  isolate that item by replacing all three criteria with validation `CORRUPT_RECORD` `E`
  and its catalogue reasoning. Never accept or drop the offending item, and never fail
  the whole owned dataset for an identifiable item contradiction. Preserve healthy
  sibling items, healthy submissions and valid acquisition/validation `E`; the rest of
  the owned assignment dataset remains available. This is an item-scoped corruption
  outcome, not a re-diagnosis of the historical acquisition or extraction cause.
  Null-document items carrying valid acquisition/validation `E` remain valid and are not
  rewritten.
- A matched pending IMAGE is in-flight, not terminal. The image stage hydrates it or
  materialises extraction `IMAGE_HYDRATION_FAILED` `E`; a still-pending image at the
  completion boundary is invalid and is rejected by the completed-persistence gate. Read
  restoration does not treat pending null content as a completed null success. See
  [§ Image hydration outcomes](#image-hydration-outcomes).
- Completed persistence rejects an incomplete or extra-key criterion record (see
  [Component Shape: Assessment § Persistence](assessment.md#persistence)); coverage and criterion
  completeness are both completion gates, not transport assumptions. An already-stored
  version-1 item with such a criterion map is converted to an isolated all-three
  `CORRUPT_RECORD` `E` on both full and partial reads, as described in the assessment
  invariants.
- The no-submission omission contributes no observed item and leaves existing
  denominator semantics unchanged; it is not an `error` or `excluded` observation.
- A version-1 canonical completed fixture never contains an empty assessment map.
  Missing-criterion and empty-map cases remain local corruption probes, not realistic
  success data. See
  [Synthetic Test Data § Explicit E outcomes and richer artefact types](../testing/synthetic-test-data.md#planned-generator-extension-explicit-e-outcomes-and-richer-artefact-types-not-implemented).

### Full and partial item isolation with trustworthy identities

Restoration/validation behaviour for both the full `getAssignment` path and the
class-embedded partial path:

- Make full versus partial restoration explicit at the owning boundary. Partial
  redaction must never trigger source-content failure detection or hash generation.
- Legacy reassessment entries are already materialised by the backend
  `AssignmentRehydration.projectReassessmentSubmissions()` owner. The frontend normaliser
  validates those entries and retains defensive per-item corruption isolation; it does
  not generate a second reassessment graph, query a roster or infer historical outcomes.
- Restore each identified submission/item once. Validate raw current-version records
  **before** coercive constructors can erase evidence of absent content/hash or
  malformed Assessment entries. Retain model-owned content normalisation; do not
  duplicate a second domain model at the API boundary.
- Validate identifiable student items independently so a malformed item, mark or error
  detail cannot discard healthy siblings. This includes an item whose null parent
  `documentId` is contradicted by numeric/`N` marks or by an assessment-/extraction-stage
  `E`: isolate that item as all-three validation `CORRUPT_RECORD` `E` under
  [§ Completed submission coverage](#completed-submission-coverage), never dropping it
  or its healthy siblings. The contradiction is item-scoped; do not fail the whole owned
  dataset for an identifiable item. Valid acquisition/validation `E` items under the
  same null parent remain valid and are preserved. Apply the equivalent isolation to
  full and partial reads, with their different content/reasoning presence rules, through
  the feature-domain read-normalisation owner; do not weaken global `parseApiResponse`
  semantics.
- Validate assignment/root/shared-definition structure atomically and strictly as today,
  including the required `assessmentContractVersion: 1 | null` read-wire field. After
  isolation, revalidate the canonical normalised result before returning typed data to
  consumers; a missing required key (including a missing/unsupported wire marker) is
  never accepted as a valid success.
- Replace only explicitly detected invalid records with typed `E` placeholders. A
  placeholder uses the canonical model constructors, preserves the known task/student
  association, and carries explicit `null` content/hash plus validated source identifiers
  when available. It is never passed to rendering as a malformed success-shaped object.
- In backend restoration, `AssignmentRehydration` performs the one-pass full **and**
  partial restoration. If a submission identity is valid but its item collection is
  corrupt, it marks the known definition tasks `E` from the embedded snapshot. If
  student/task identity or the shared root/definition is untrustworthy, fail the owned
  dataset loudly rather than guessing associations. On the browser partial-read path,
  the normaliser validates only the entries it is given and does not infer coverage from
  the separately loaded definition registry. On the browser full-read path, a missing
  task is filled only defensively from that same payload's definition when the wire
  payload nonetheless lacks it; that fallback never overwrites backend-materialised `E`
  and is not the normal full coverage owner.
- Data-corruption conversion is restricted to explicit raw-data validation failures. Do
  not catch arbitrary constructor or programming faults and turn them into `E`.
- Full artefact `content`/`contentHash` remain required in the full shape. No
  `.optional()` relaxation is permitted; a missing required field is corruption, not
  legitimate null content.
- Log structured field paths and available course/assignment/student/task identifiers;
  never log source content, raw LLM payloads, credentials or student names.

Owners:

| Boundary                       | Owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Responsibilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend shared result schemas | `services/assignmentAssessment/assessmentResult.zod.ts` (consumed by both read schemas)                                                                                                                                                                                                                                                                                                                                                                                                         | Shared full/partial `Assessment` and error-cause schemas, so both assignment and class-detail services enforce the same score range, `E` catalogue and non-blank `E` reasoning refinement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Frontend read normalisation    | `services/assignmentAssessment/assignmentReadNormalisation.ts` and `services/assignmentAssessment/assignmentReadItemValidation.ts` (pure owners; invoked by both read services before their final parse)                                                                                                                                                                                                                                                                                        | Pure full/partial item isolation. `assignmentReadNormalisation.ts` owns the two public entry points and root/definition checks; `assignmentReadItemValidation.ts` owns item/artefact/parent-source validation, canonical corruption construction and safe diagnostic paths. They contain no React, GAS dispatch or raw-JSON parsing. The browser partial path validates provided entries only and never infers coverage from the definition registry. The browser full path fills a task only defensively when a wire payload lacks it, using that same full payload's definition, and never overwrites backend-materialised `E`; it is not the normal full coverage owner. |
| Backend raw domain validation  | `src/backend/Models/Assessment.js`, `src/backend/Models/StudentSubmission/index.js` (facade), `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js` (item model), `src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js` (restore/coverage facade), `src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js` (marker-1 restoration), `src/backend/AssignmentProcessor/Assignment/02_AssignmentReadProjection.js` (pure legacy projection) | `Assessment` validates its result/cause; the `StudentSubmission` facade and item model validate their own full/partial records; `AssignmentRehydration` owns one-pass full/partial graph traversal; `AssignmentCurrentRestoration` owns marker-1 root/task pre-validation, raw item validation, coverage, null-parent isolation and full/partial restoration; the legacy projection remains behind `AssignmentRehydration.projectReassessmentSubmissions()`, with pure projection/snapshot mapping in `02_AssignmentReadProjection.js`, not a second materialiser. Controllers select the representation explicitly.                                                        |
| Transport-boundary exclusion   | `src/backend/z_Api/*` handlers                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | API handlers do not introduce a second domain-validator hierarchy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Backend module separations preserve the existing public owners and the existing File
Index:

- `src/backend/Models/StudentSubmission.js` has become `Models/StudentSubmission/index.js`
  (public facade) plus `Models/StudentSubmission/00_StudentSubmissionItem.js` (item
  model), each at most 320 lines; the existing public constructors remain the entry
  points.
- `src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js` keeps its
  restore/coverage facade at most 320 lines; the pure legacy projection/snapshot mapping
  lives in same-domain `02_AssignmentReadProjection.js` at most 280 lines, behind the
  unchanged `AssignmentRehydration.projectReassessmentSubmissions()` entry. It is not a
  second materialiser.

### Marker-1 item restoration rules

`AssignmentCurrentRestoration._rehydrateCurrentSubmission()` restores a marker-1
submission and its complete task-item universe. Item-level rules:

| Aspect                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty no-submission     | A submission with parent `documentId: null` and an empty item object remains an empty submission record. It is not expanded into placeholders or fabricated `N` items.                                                                                                                                                                                                                                                                                                                                                                    |
| Raw item validation     | Before construction, each item must match its authoritative task key. Its artefact must carry the same `taskId`, `role: 'submission'`, one of `base` / `TEXT` / `TABLE` / `IMAGE` / `SPREADSHEET`, a non-empty string `uid`, and `string\|null` `documentId` / `pageId`. Full mode requires own `content` and `contentHash` keys; body/hash are both `null` or both present with a string hash. Bodies are type-checked (`TEXT` / `TABLE` string or `null`, `IMAGE` image data URL or `null`, `SPREADSHEET` 2D primitive grid or `null`). |
| Completed criteria      | Exactly `completeness`, `accuracy` and `spag`, with no extra keys. Full entries must be complete `Assessment` results. Partial entries are finite 0–5 numeric or `'N'` score-only objects, or an `'E'` with non-blank `reasoning` and a catalogue `error`.                                                                                                                                                                                                                                                                                |
| Source consistency      | Full document-bearing items may carry null body/hash only when all three results are `'E'` with an `acquisition`, `extraction` or `validation` stage. Partial document-bearing records are redaction-exempt and are not checked for source presence or hashed. A null-parent item must be the canonical base placeholder: `type: 'base'`, `role: 'submission'`, null `documentId` / `pageId` / `content` / `contentHash`, empty `metadata` and `feedback`, and all three results `'E'` with an `acquisition` or `validation` stage.       |
| Isolation               | An object item failing raw validation is replaced by a canonical `CORRUPT_RECORD` placeholder on all three criteria, created through the model constructors with the known task/student association. Healthy siblings and valid acquisition/validation placeholders are preserved. A missing known task receives the same placeholder; the placeholder is never constructed from the offending raw item.                                                                                                                                  |
| Exact-once construction | Each healthy raw item is validated once and constructed at most once. An already-materialised `StudentSubmissionItem` instance is serialised in the requested mode, validated, and retained as the same instance when healthy; a serialisation or construction fault propagates unchanged, with no retry or corruption conversion.                                                                                                                                                                                                        |
| Timestamps              | Valid stored submission `createdAt` / `updatedAt` values are retained independently. Otherwise `createdAt` falls back to the assignment `createdAt`; `updatedAt` falls back to the assignment `updatedAt` when non-null, otherwise the assignment `createdAt`. An invalid assignment timestamp throws. The wall clock is never used.                                                                                                                                                                                                      |

`TABLE` artefact bodies remain supported as stored `string \| null` for document-bearing
items, consistent with the existing artefact contract; marker-1 restoration neither
generates TABLE fixtures nor introduces new TABLE feature work.

---

## Status

No planned contract changes for this shape. The acquisition, extraction, image-hydration
and coverage rules above are the current contract; preview error states and the
attempt-baseline analysis mode are frontend analysis concerns, tracked in
[Frontend Data Analysis Response](frontend-data-analysis-response.md#planned-contract-changes-not-implemented).

---

## File Index

```
Sub-entity models:
  ├── src/backend/Models/StudentSubmission/
  │     ├── index.js                             — StudentSubmission facade
  │     │     └── StudentSubmission.toJSON()         — full submission shape
  │     │     └── StudentSubmission.toPartialJSON()   — partial submission shape
  │     │     └── StudentSubmission.fromJSON()        — mode-threaded restoration
  │     │     └── StudentSubmission.validateRaw()     — raw record shape
  │     │     └── StudentSubmission.upsertItemFromExtraction()
  │     │     └── StudentSubmission._mergeExtractedContent()
  │     └── 00_StudentSubmissionItem.js           — StudentSubmissionItem model
  │           └── StudentSubmissionItem.toJSON()      — full item shape
  │           └── StudentSubmissionItem.toPartialJSON() — partial item shape
  │           └── StudentSubmissionItem.setError()     — atomic all-three-criteria E replacement
  │           └── StudentSubmissionItem.validateRaw()  — raw item shape
  │           └── StudentSubmissionItem.validateCurrentRawArtifact() — marker-1 artefact validation

Student stage:             src/backend/AssignmentProcessor/
  ├── Assignment/04_AssignmentSubmissions.js    — paginated Classroom acquisition, scan-local
  │                                               deferred failure materialisation and
  │                                               acquisition E placeholders
  ├── SlidesAssignment.js                       — Slides student-stage extraction outcomes
  └── SheetsAssignment.js                       — Sheets student-stage extraction outcomes

Document parsers:          src/backend/DocumentParsers/
  ├── SlidesParser/
  │     ├── index.js                            — Slides parser facade
  │     ├── 00_SlidesParserTableContent.js      — native text/table read conversion,
  │     │                                          whole-TABLE null on first failure
  │     └── 01_SlidesParserSubmissionMatcher.js — failed-open sentinel, missing-match
  │                                                placeholder and matched pending IMAGE
  └── SheetsParser.js                           — failed-open sentinel and unavailable
                                                  range-read artefact

Image hydration:           src/backend/RequestHandlers/ImageManager.js
  ├── collectAllImageArtifacts()               — `Validate.isValidUrlShape` URL admission,
  │                                               scoped shared blocking and student
  │                                               IMAGE_HYDRATION_FAILED materialisation
  ├── fetchImagesAsBlobs()                     — one full-list sender call, 200-only, no stop
  │                                               statuses, document round-robin and scoped
  │                                               final outcomes
  └── writeBackBlobs()                         — UID-checked writeback, unusable-content scope
                                                  rules, content/hash validation and
                                                  changed-content invalidation

Restoration / projection:  src/backend/AssignmentProcessor/Assignment/
  ├── 02_AssignmentRehydration.js               — one-pass full/partial restore facade
  ├── 02_AssignmentCurrentRestoration.js        — marker-1 item validation, coverage and
  │                                               null-parent isolation
  └── 02_AssignmentReadProjection.js            — pure detached legacy reassessment projection

Frontend:
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
  │     → StudentSubmissionSchema, StudentSubmissionItemSchema
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
  │     → StudentSubmissionPartialSchema, StudentSubmissionItemPartialSchema
  ├── src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts
  │     → normaliseAssignmentRead(), normaliseClassRead()
  └── src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts
        → isValidFullItem(), isValidPartialItem(), corruptItem(), itemErrorPath()
```
