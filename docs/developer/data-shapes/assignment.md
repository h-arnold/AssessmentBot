# Contract: Assignment

Root domain object for an assessed piece of coursework. Contains submissions,
assessments, and an embedded assignment definition. Persisted independently
from ABClass, with partial summaries carried inside the ABClass document.

Backend model: `src/backend/AssignmentProcessor/Assignment/index.js` (facade)
Serialisation: `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`
Collections: `assign_full_<courseId>_<assignmentId>` (full records only — no partial registry)
API handlers: `src/backend/z_Api/assignmentAssessment.js`
Response mapper: Transport transformations applied by `src/backend/y_controllers/ABClassController/ABClassResponseMapper._toReadView()` (for `getABClass` embedding) — not part of Assignment's own serialisation.
Frontend service: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
Frontend Zod: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (full),
`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` (partial)

Sibling contracts:

- [Contract: ABClass](abclass.md) — ABClass embeds Assignment partials (with `assignmentDefinitionKey` instead of `assignmentDefinition` as a transport transformation).
- [Contract: AssignmentDefinition](assignment-definition.md) — AssignmentDefinition is embedded inside Assignment as a full or partial definition.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — No direct relationship.

---

## Persistence

Assignment uses a single persistence model: full records stored under dedicated
collections. There is no partial registry for Assignment (unlike ABClass, which
has `abclass_partials`). Partial summaries are carried inside the ABClass document
but are not independently persisted.

### Collection: `assign_full_<courseId>_<assignmentId>`

Stored via `Assignment.toJSON()` in `00_AssignmentSerialisation.js`.

| #   | Field                  | Type                                   | Persistence          | Transport | Frontend Zod                                                                        | Notes                                                                                                                    |
| --- | ---------------------- | -------------------------------------- | -------------------- | --------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `courseId`             | `string`                               | included             | same      | `AssignmentFullSchema.courseId: z.string()`                                         | Google Classroom course ID. Required, never null.                                                                        |
| 2   | `assignmentId`         | `string`                               | included             | same      | `AssignmentFullSchema.assignmentId: z.string()`                                     | Google Classroom coursework ID. Required, never null.                                                                    |
| 3   | `assignmentName`       | `string`                               | included             | same      | `AssignmentFullSchema.assignmentName: z.string()`                                   | Fetched from Google Classroom at construction via `fetchAssignmentName()`.                                               |
| 4   | `dueDate`              | `string\|null`                         | included             | same      | `AssignmentFullSchema.dueDate: z.string().nullable()`                               | ISO 8601 string or `null`. Currently always `null` (homework tracker not implemented).                                   |
| 5   | `updatedAt`            | `string\|null`                         | included             | same      | `AssignmentFullSchema.updatedAt: z.string().nullable()`                             | ISO 8601 string or `null`. Set via `touchUpdated()`.                                                                     |
| 6   | `createdAt`            | `string`                               | included             | same      | `AssignmentFullSchema.createdAt: z.string()`                                        | ISO 8601 string. Set from Google Classroom `creationTime` at construction.                                               |
| 7   | `documentType`         | `string\|null`                         | included (extracted) | same      | `AssignmentFullSchema.documentType: z.string().nullable()`                          | `'SLIDES'` \| `'SHEETS'` or `null`. Extracted from embedded `assignmentDefinition` via `_extractFullDefinitionFields()`. |
| 8   | `referenceDocumentId`  | `string\|null`                         | included (extracted) | same      | `AssignmentFullSchema.referenceDocumentId: z.string().nullable()`                   | Extracted from embedded `assignmentDefinition`. `null` when definition is partial.                                       |
| 9   | `templateDocumentId`   | `string\|null`                         | included (extracted) | same      | `AssignmentFullSchema.templateDocumentId: z.string().nullable()`                    | Extracted from embedded `assignmentDefinition`. `null` when definition is partial.                                       |
| 10  | `tasks`                | `Record<string, TaskDefinition>\|null` | included (extracted) | same      | `AssignmentFullSchema.tasks: z.record(z.string(), TaskDefinitionSchema).nullable()` | Extracted from embedded `assignmentDefinition`. `null` when definition is partial. Only in full shape.                   |
| 11  | `submissions`          | `StudentSubmission[]`                  | included             | same      | `AssignmentFullSchema.submissions: z.array(StudentSubmissionSchema)`                | Array of `StudentSubmission.toJSON()` objects. Empty array when no submissions.                                          |
| 12  | `assignmentDefinition` | `AssignmentDefinition`                 | included             | same      | `AssignmentFullSchema.assignmentDefinition: AssignmentDefinitionSchema`             | Full definition object via `AssignmentDefinition.toJSON()`. Always included in full persistence.                         |

Key notes:

- `progressTracker` is **intentionally not serialised** (it is a singleton/session-specific runtime property).
- `_hydrationLevel` is a runtime-only flag and never persisted.
- Fields 7–10 are extracted from the embedded definition by `_extractFullDefinitionFields(definitionJson)`, which reads `documentType`, `referenceDocumentId`, `templateDocumentId`, and `tasks` from the definition's `toJSON()` output.
- The `Assignment` class is a facade (`index.js`) that delegates serialisation to `AssignmentSerialisation` (`00_AssignmentSerialisation.js`).

### Partial variant — `Assignment.toPartialJSON()`

Not independently persisted, but used for in-memory partial representations and
for embedding inside `ABClass.assignments[]`. Behaviour differs from `toJSON()`:

| #   | Field                  | Type                          | Persistence  | Transport                             | Frontend Zod                                                                   | Notes                                                                                                |
| --- | ---------------------- | ----------------------------- | ------------ | ------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | `courseId`             | `string`                      | same as full | same                                  | stripped by `AssignmentPartialSchema`                                          | Present in wire format; Zod `.strip()` default removes it (not included in schema).                  |
| 2   | `assignmentId`         | `string`                      | same as full | same                                  | `AssignmentPartialSchema.assignmentId: z.string()`                             |                                                                                                      |
| 3   | `assignmentName`       | `string`                      | same as full | same                                  | stripped by `AssignmentPartialSchema`                                          | Present in wire format; Zod `.strip()` default removes it.                                           |
| 4   | `dueDate`              | `string\|null`                | same as full | same                                  | `AssignmentPartialSchema.dueDate: z.string().nullable().optional()`            |                                                                                                      |
| 5   | `updatedAt`            | `string\|null`                | same as full | same                                  | `AssignmentPartialSchema.updatedAt: z.string().nullable()`                     |                                                                                                      |
| 6   | `createdAt`            | `string`                      | same as full | same                                  | `AssignmentPartialSchema.createdAt: z.string()`                                |                                                                                                      |
| 7   | `documentType`         | `string\|null`                | same as full | same                                  | `AssignmentPartialSchema.documentType: z.string().nullable()`                  | Only root-level field extracted in partial shape (via `_extractPartialRootFields()`).                |
| 8   | `referenceDocumentId`  | —                             | omitted      | omitted                               | —                                                                              | Not extracted in partial shape.                                                                      |
| 9   | `templateDocumentId`   | —                             | omitted      | omitted                               | —                                                                              | Not extracted in partial shape.                                                                      |
| 10  | `tasks`                | —                             | omitted      | omitted                               | —                                                                              | Not extracted in partial shape.                                                                      |
| 11  | `submissions`          | `StudentSubmissionPartial[]`  | included     | transformed                           | `AssignmentPartialSchema.submissions: z.array(StudentSubmissionPartialSchema)` | Submissions via `StudentSubmission.toPartialJSON()` — artifact content redacted, reasoning stripped. |
| 12  | `assignmentDefinition` | `AssignmentDefinitionPartial` | included     | replaced by `assignmentDefinitionKey` | `AssignmentPartialSchema.assignmentDefinitionKey: z.string()`                  | See Transport section for the transformation. `getABClass` endpoint replaces this with just the key. |

---

## Transport

All API endpoints documented here return their `data` payload inside the shared
[transport envelope](transport-envelope.md). Only the inner payload is documented below.

### `getAssignment` (read)

Returns the full, rehydrated assignment object for a single assignment, or `null`
when no persisted document exists.

| Aspect           | Detail                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/assignmentAssessment.js` → `getAssignment_()`                                                                                  |
| Controller       | `ABClassController.readRehydrateAssignment()`                                                                                                     |
| Response mapper  | — (returns `Assignment.toJSON()` directly with `DateUtils.deepConvertDates()` and defensive `progressTracker` strip)                              |
| Frontend Zod     | `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `AssignmentFullResponseSchema` (`AssignmentFullSchema.nullable()`) |
| Frontend service | `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` → `getAssignment()`                                               |

**Request:**

| Field          | Type     | Required | Notes                                               |
| -------------- | -------- | -------- | --------------------------------------------------- |
| `courseId`     | `string` | yes      | Must be non-empty, already trimmed, no unsafe chars |
| `assignmentId` | `string` | yes      | Must be non-empty, already trimmed, no unsafe chars |

**Response:** `AssignmentFullSchema` or `null`

| Field                  | Type                                   | Required | Notes                                       |
| ---------------------- | -------------------------------------- | -------- | ------------------------------------------- |
| `courseId`             | `string`                               | yes      |                                             |
| `assignmentId`         | `string`                               | yes      |                                             |
| `assignmentName`       | `string`                               | yes      |                                             |
| `dueDate`              | `string\|null`                         | yes      | ISO 8601 string or `null`                   |
| `updatedAt`            | `string\|null`                         | yes      | ISO 8601 string or `null`                   |
| `createdAt`            | `string`                               | yes      | ISO 8601 string                             |
| `documentType`         | `string\|null`                         | yes      | `'SLIDES'` \| `'SHEETS'` or `null`          |
| `referenceDocumentId`  | `string\|null`                         | yes      |                                             |
| `templateDocumentId`   | `string\|null`                         | yes      |                                             |
| `tasks`                | `Record<string, TaskDefinition>\|null` | yes      | `null` when definition is partial           |
| `submissions`          | `StudentSubmission[]`                  | yes      | Full `StudentSubmission.toJSON()` array     |
| `assignmentDefinition` | `AssignmentDefinition`                 | yes      | Full `AssignmentDefinition.toJSON()` object |

Key contract notes:

- The response is built from `Assignment.toJSON()`, which calls `AssignmentDefinition.toJSON()` on the embedded definition. The `readRehydrateAssignment` handler internally performs full hydration (resolving partial definitions via `getDefinitionByKey`), so a throw only occurs when the authoritative record is itself unresolvable or partial.
- `progressTracker` is stripped from the response at the transport boundary as defence-in-depth (already omitted by `toJSON()` per JSDoc).
- `DateUtils.deepConvertDates()` is called on the entire response before returning, because `google.script.run` prohibits `Date` objects in return values.
- Returns `null` when no persisted assignment document exists for the given `courseId`/`assignmentId` pair (`AssignmentNotFoundError` caught at the transport boundary).

#### `getAssignment` — Partial variant via ABClass transport

When assignments are embedded inside the `getABClass` response (see [Contract: ABClass §getABClass](abclass.md#getabclass-read)), the shape differs from `Assignment.toPartialJSON()`:

> **Partial variant (ABClass transport):** Same as `Assignment.toPartialJSON()` except:
>
> - `_hydrationLevel` and `progressTracker` are stripped (defence-in-depth — already omitted by `toPartialJSON()`)
> - The embedded `assignmentDefinition` object is replaced by `assignmentDefinitionKey` (the `definitionKey` from the stored definition). The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry.
> - `courseId` and `assignmentName` are present in the wire format but stripped by Zod `.strip()` on `AssignmentPartialSchema`.

This transformation is performed by `ABClassResponseMapper._toReadView()` — it is NOT part of `AssignmentSerialisation` and does not affect the `assign_full_*` persistence shape.

### `startAssessmentRun` (write)

Initiates the assessment workflow for a given assignment and definition
by creating a time-based trigger.

| Aspect           | Detail                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/assignmentAssessment.js` → `startAssessmentRun_()`                                                                     |
| Controller       | `AssignmentController.startAssessmentRun()`                                                                                               |
| Response mapper  | — (returns `null`)                                                                                                                        |
| Frontend Zod     | `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `StartAssessmentRunResponseSchema` (`z.void().nullable()`) |
| Frontend service | `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` → `startAssessmentRun()`                                  |

**Request:**

| Field           | Type     | Required | Notes                    |
| --------------- | -------- | -------- | ------------------------ |
| `definitionKey` | `string` | yes      | Must be non-empty string |
| `assignmentId`  | `string` | yes      | Must be non-empty string |
| `courseId`      | `string` | yes      | Must be non-empty string |

**Response:** `null`

Key contract notes:

- The handler validates the parameters object shape, then delegates to `AssignmentController.startAssessmentRun()`.
- The controller fetches the full definition via `AssignmentDefinitionController.getDefinitionByKey()`, validates definition freshness (reference and template documents checked against Drive timestamps), then creates a time-based trigger via `TriggerController`.
- If the definition is stale (reference or template documents modified since definition was created), throws `DefinitionStaleError` — see [transport envelope](transport-envelope.md#error-envelope) for the `DEFINITION_STALE` error shape with details.
- The method returns `null` (no payload) on success.
- Frontend schema uses `z.void().nullable()` to accept the `undefined → null` coercion in the envelope.

---

## Sub-entities

### StudentSubmission

Backend model: `src/backend/Models/StudentSubmission.js`
Frontend Zod: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `StudentSubmissionSchema`

Represents a single student's submission for an assignment, containing submission
items keyed by task ID.

`StudentSubmission.toJSON()` emits:

| Field          | Type                                    | Backend toJSON() | Frontend Zod                                        | Notes                                                                                                      |
| -------------- | --------------------------------------- | ---------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `studentId`    | `string`                                | Always emitted   | `z.string()`                                        | Student's unique ID from Google Classroom.                                                                 |
| `studentName`  | `string`                                | Always emitted   | `z.string()`                                        | Student's full name. Set at construction; will be removed in a future version (temporary for V0.7.2).      |
| `assignmentId` | `string`                                | Always emitted   | `z.string()`                                        | The parent assignment ID.                                                                                  |
| `documentId`   | `string\|null`                          | Always emitted   | `z.string().nullable()`                             | The Drive file ID of the student's submission document. Null for students who never opened the assignment. |
| `items`        | `Record<string, StudentSubmissionItem>` | Always emitted   | `z.record(z.string(), StudentSubmissionItemSchema)` | Dictionary of submission items keyed by taskId. Empty object when no items.                                |
| `createdAt`    | `string`                                | Always emitted   | `z.string()`                                        | ISO 8601 string. Set at construction.                                                                      |
| `updatedAt`    | `string`                                | Always emitted   | `z.string()`                                        | ISO 8601 string with monotonic counter suffix (e.g. `"2025-09-10T12:30:00Z#2"`). Set via `touchUpdated()`. |

**Partial variant** (`StudentSubmission.toPartialJSON()`): Same as `toJSON()` except:

- Items use `StudentSubmissionItem.toPartialJSON()` (artifact content/contentHash set to `null`, assessment reasoning stripped).

**Frontend partial schema** (`StudentSubmissionPartialSchema` in `classDetailService.zod.ts`):

| Field          | Type                                                       | Notes                                                                                                                   |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `studentId`    | `z.string()`                                               |                                                                                                                         |
| `studentName`  | `z.string().nullable()`                                    |                                                                                                                         |
| `assignmentId` | `z.string()`                                               |                                                                                                                         |
| `documentId`   | `z.string().nullable().optional()`                         | Tolerates absent or `null` — Google Classroom may omit the Drive reference for students who never opened an assignment. |
| `items`        | `z.record(z.string(), StudentSubmissionItemPartialSchema)` |                                                                                                                         |
| `createdAt`    | `z.string()`                                               |                                                                                                                         |
| `updatedAt`    | `z.string()`                                               |                                                                                                                         |

Key notes:

- The `updatedAt` monotonic counter suffix (e.g., `...Z#2`) is a valid `z.string()` match; Zod does not enforce ISO format, only the string type.
- `documentId` in the partial frontend schema is `.nullable().optional()` to handle both `null` values and missing fields from Google Classroom, but the backend always emits it.

### StudentSubmissionItem

Backend model: `src/backend/Models/StudentSubmission.js` → `StudentSubmissionItem`
Frontend Zod (full): `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `StudentSubmissionItemSchema`
Frontend Zod (partial): `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `StudentSubmissionItemPartialSchema`

Represents a single task's submission within a student submission. Contains the
submitted artifact, assessments, and feedback.

`StudentSubmissionItem.toJSON()` emits:

| Field         | Type                         | Backend toJSON()                     | Frontend Zod (full)                                                                | Notes                                                                                            |
| ------------- | ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`          | `string`                     | Always emitted                       | `z.string()`                                                                       | Derived stable UID prefixed with `ssi_`.                                                         |
| `taskId`      | `string`                     | Always emitted                       | `z.string()`                                                                       | References the task definition ID.                                                               |
| `artifact`    | `BaseTaskArtifact`           | Always emitted (`artifact.toJSON()`) | `BaseTaskArtifactSchema`                                                           | The submission artifact (role=`'submission'`).                                                   |
| `assessments` | `Record<string, Assessment>` | Always emitted                       | `z.record(z.string(), AssessmentSchema)`                                           | Array-valued in legacy model; now a record keyed by criterion. Empty object when no assessments. |
| `feedback`    | `Record<string, Feedback>`   | Always emitted                       | `z.record(z.string(), z.looseObject({ type: z.string(), createdAt: z.string() }))` | Record keyed by feedback type. Empty object when no feedback.                                    |

**Partial variant** (`StudentSubmissionItem.toPartialJSON()`): Same as `toJSON()` except:

- `artifact` uses `artifact.toPartialJSON()` (content/contentHash set to `null`).
- `assessments` uses `_stripAssessmentReasoning()` which removes the `reasoning` field from each assessment entry, keeping only `score`.

**Frontend partial schema** (`StudentSubmissionItemPartialSchema`):

| Field         | Type                                                            | Notes                                                                    |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `id`          | `z.string()`                                                    |                                                                          |
| `taskId`      | `z.string()`                                                    |                                                                          |
| `artifact`    | `BaseTaskArtifactPartialSchema`                                 | Content and contentHash omitted.                                         |
| `assessments` | `z.record(z.string(), PartialAssessmentEntrySchema).optional()` | Score-only entries; reasoning stripped. `.optional()` tolerates absence. |
| `feedback`    | `z.record(z.string(), z.unknown()).optional()`                  | Loose type tolerates any feedback structure.                             |

Key notes:

- `_deriveId()` generates a stable hash from `taskId` + artifact UID (falling back to `contentHash`), truncated to 16 hex characters prefixed with `ssi_`.
- The `documentId` and `pageId` are intentionally omitted from `StudentSubmissionItem.toJSON()` — the parent submission holds `documentId`, and the artifact contains `pageId`.

### Assessment

Backend model: `src/backend/Models/Assessment.js`
Frontend Zod (full): `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `AssessmentSchema`
Frontend Zod (partial): `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `PartialAssessmentEntrySchema`

Represents the assessment result for a single criterion (e.g. `'completeness'`,
`'accuracy'`, `'spag'`). Stored as a value in the `assessments` record on
`StudentSubmissionItem`.

`Assessment.toJSON()` emits:

| Field       | Type     | Backend toJSON() | Frontend Zod (full) | Notes                                                                                                                          |
| ----------- | -------- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `score`     | `number` | Always emitted   | `z.number()`        | Integer 0–5, or `'N'` for non-applicable (Zod: `z.union([z.number().int().min(0).max(5), z.literal('N')])` in partial schema). |
| `reasoning` | `string` | Always emitted   | `z.string()`        | The LLM's explanation for the score.                                                                                           |

**Partial variant**: In `StudentSubmissionItem.toPartialJSON()`, `_stripAssessmentReasoning()` removes the `reasoning` field entirely. The frontend `PartialAssessmentEntrySchema` validates only `{ score }`.

| Field   | Type          | Frontend Zod (partial)                                                                          | Notes                 |
| ------- | ------------- | ----------------------------------------------------------------------------------------------- | --------------------- |
| `score` | `number\|'N'` | `PartialAssessmentEntrySchema.score: z.union([z.number().int().min(0).max(5), z.literal('N')])` | Integer 0–5 or `'N'`. |

Key notes:

- The full `AssessmentSchema` (`score + reasoning`) matches `Assessment.toJSON()`.
- The partial `PartialAssessmentEntrySchema` (`score` only) matches the transport after `_stripAssessmentReasoning()`.
- Score range validation (0–5 or `'N'`) is enforced by the frontend partial schema only. The full `AssessmentSchema` uses `z.number()` without range enforcement.

### Feedback

Backend model: `src/backend/Models/Feedback/0_Feedback.js` (base),
`src/backend/Models/Feedback/1_CellReferenceFeedback.js` (concrete)
Frontend Zod (full): `StudentSubmissionItemSchema.feedback` uses `z.record(z.string(), z.looseObject({ type: z.string(), createdAt: z.string() }))`
Frontend Zod (partial): `StudentSubmissionItemPartialSchema.feedback` uses `z.record(z.string(), z.unknown()).optional()`

Feedback is stored as a map keyed by feedback type on `StudentSubmissionItem`.
Currently, only CellReferenceFeedback is implemented.

**Base `Feedback.toJSON()`:**

| Field       | Type     | Backend toJSON() | Notes                                                        |
| ----------- | -------- | ---------------- | ------------------------------------------------------------ |
| `type`      | `string` | Always emitted   | Feedback type identifier (e.g. `'cellReference'`).           |
| `createdAt` | `string` | Always emitted   | ISO 8601 string. Converted from `Date` via `.toISOString()`. |

**CellReferenceFeedback (`CellReferenceFeedback.toJSON()`):**

Extends base Feedback with `items` array:

| Field       | Type                                                 | Backend toJSON()              | Notes                                                                                                                                             |
| ----------- | ---------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | `string`                                             | `'cellReference'` (from base) |                                                                                                                                                   |
| `createdAt` | `string`                                             | ISO string (from base)        |                                                                                                                                                   |
| `items`     | `Array<{ location: Array<number>, status: string }>` | Always emitted                | Array of cell feedback objects. `location` is zero-based `[rowIndex, columnIndex]`. `status` is `'correct'` \| `'incorrect'` \| `'notAttempted'`. |

Key notes:

- Feedback objects are fully preserved in both partial and full hydration — only assessment reasoning is stripped, not feedback.
- The frontend `StudentSubmissionItemSchema.feedback` uses `z.looseObject` to tolerate the extra `items` property on `CellReferenceFeedback`.
- The frontend partial schema uses `z.unknown()` for the feedback value, accepting any structure.

### BaseTaskArtifact

See [Contract: AssignmentDefinition §Sub-entity BaseTaskArtifact](assignment-definition.md#sub-entity-basetaskartifact). This contract's
`StudentSubmissionItem.artifact` uses the same shape, with `role` set to `'submission'`.

The full and partial schemas on the frontend are:

- **Full** (`BaseTaskArtifactSchema` in `assignmentAssessment.zod.ts`): discriminated union by `type` — `TEXT`/`TABLE`/`IMAGE` have `content: string | null`; `SPREADSHEET` has `content: Array<Array<string | number | null>> | null`; `base` has `content: unknown`. Common fields: `taskId`, `role`, `pageId`, `documentId`, `uid`, `contentHash` (nullable), `metadata`.
- **Partial** (`BaseTaskArtifactPartialSchema` in `classDetailService.zod.ts`): reduced shape with `taskId`, `role`, `pageId` (nullable optional), `documentId` (nullable optional), `metadata` (optional), `uid`, `type`. `content` and `contentHash` are omitted entirely (set to `null` by `toPartialJSON()`).

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`:
  - `AssignmentFullSchema` (`.strict()`) — validates the full assignment response shape. Extra top-level keys cause Zod errors.
  - `AssignmentFullResponseSchema` — `AssignmentFullSchema.nullable()`, handles not-found.
  - `GetAssignmentRequestSchema` (`.strict()`) — validates `getAssignment` request parameters.
  - `StartAssessmentRunRequestSchema` (`.strict()`) — validates `startAssessmentRun` request parameters.
  - `StartAssessmentRunResponseSchema` — `z.void().nullable()`, accepts `null` from backend envelope.
  - `StudentSubmissionSchema` — validates full submission shape.
  - `StudentSubmissionItemSchema` — validates full submission item shape.
  - `AssessmentSchema` — validates full assessment shape (`score` + `reasoning`).
  - `TaskDefinitionSchema` — validates full task definition shape (cross-ref to AssignmentDefinition contract).
  - `BaseTaskArtifactSchema` — discriminated union validating artifact by `type`.
  - `AssignmentDefinitionSchema` — validates full definition shape (cross-ref to AssignmentDefinition contract).

- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `AssignmentPartialSchema` — validates partial assignment shape as embedded in `getABClass` response.
  - `StudentSubmissionPartialSchema` — validates partial submission shape.
  - `StudentSubmissionItemPartialSchema` — validates partial submission item shape (no content, no reasoning).
  - `PartialAssessmentEntrySchema` — validates score-only assessment entries.
  - `BaseTaskArtifactPartialSchema` — validates partial artifact shape (content/contentHash omitted).

**Backend transport validation:**

- `src/backend/z_Api/assignmentAssessment.js`:
  - `getAssignment_()`:
    - Validates parameters is a plain object (non-array, non-null).
    - `validateIdentifier_(courseId, 'courseId')` — non-empty string, already trimmed, no unsafe characters.
    - `validateIdentifier_(assignmentId, 'assignmentId')` — non-empty string, already trimmed, no unsafe characters.
    - Catches `AssignmentNotFoundError` and returns `null`.
  - `startAssessmentRun_()`:
    - Validates parameters is a plain object.
    - `Validate.requireParams({ definitionKey, assignmentId, courseId }, 'startAssessmentRun')` — all required.
    - `Validate.validateNonEmptyString(...)` for each field.
  - `throwAssignmentValidationError_()` — shared error factory for assignment validation failures.

**Key domain validation rules** (controller-level business logic not visible from schemas):

- `ABClassAssignmentOps.readRehydrateAssignment()` ensures the assignment's embedded definition is fully hydrated before returning. It resolves partial definitions (where `tasks` is an array) via `AssignmentDefinitionController.getDefinitionByKey(definitionKey, { form: 'full' })` and throws only when the authoritative record is itself a partial (tasks is still an array after resolution).
- `AssignmentController.startAssessmentRun()` validates definition freshness: compares Drive modification timestamps for reference and template documents against stored `referenceLastModified`/`templateLastModified`. Throws `DefinitionStaleError` on mismatch.
- `Assignment._requireImplementation()` enforces subclass implementation of document-type-specific methods.
- The `Assignment` constructor fetches `assignmentName` from Google Classroom and throws if `creationTime` is missing.
- `AssignmentDefinition.toJSON()` throws `TypeError` when `tasks` is an array (partial shape) — callers must ensure full hydration before serialisation.

### Known discrepancies

1. **`Assignment.toPartialJSON()` emits `courseId` and `assignmentName` but frontend `AssignmentPartialSchema` strips them.**
   Frontend `AssignmentPartialSchema` does not include `courseId` or `assignmentName`. Zod's default `.strip()` mode silently removes them. The ABClass transport includes them in the wire format but the frontend resolves assignment context from other sources.
   **Classification: Aligned** — Zod's default `.strip()` behaviour tolerates the extra fields; the stripped data is unused by the frontend.

2. **`AssignmentPartialSchema` uses `assignmentDefinitionKey` instead of `assignmentDefinition`.**
   The ABClassResponseMapper._toReadView() replaces the embedded `assignmentDefinition` object with a `assignmentDefinitionKey` string at the transport boundary. This is **not** part of `Assignment.toPartialJSON()` — it is a transport transformation specific to the `getABClass` endpoint. The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry.
   **Classification: Aligned** — intentional transport-boundary transformation documented in ABClassResponseMapper.

3. **`StudentSubmissionPartialSchema.documentId` is `.nullable().optional()` but backend `toPartialJSON()` always emits it.**
   Backend `StudentSubmission.toPartialJSON()` always includes `documentId` (which may be `null`). The frontend schema tolerates both `null` and an absent field to handle cases where Google Classroom omits the Drive file reference for students who never opened an assignment.
   **Classification: Aligned** — documented in the partial-vs-full hydration pattern in [rehydration.md](../backend/rehydration.md). The Zod schema is permissive to handle both backend and Google Classroom edge cases.

4. **`StudentSubmissionPartialSchema.studentName` is `z.string().nullable()` but backend always emits it as a nullable string.**
   Backend `StudentSubmission.toPartialJSON()` always includes `studentName` (which may be `null` per constructor default). The frontend schema expects `string | null`. Both sides aligned.
   **Classification: Aligned**.

5. **Full `AssessmentSchema` uses `z.number()` without range validation.**
   Backend `Assessment` constructor accepts any number (conceptually 0–5). The frontend full schema uses `z.number()` with no range enforcement. However, the partial `PartialAssessmentEntrySchema` enforces `z.union([z.number().int().min(0).max(5), z.literal('N')])`. This means the full schema is less strict than the partial schema for scores.
   **Classification: Aligned** — the full schema trusts the backend's domain logic, while the partial schema is stricter because it crosses a different trust boundary (class detail service).

6. **`StudentSubmissionItemPartialSchema.assessments` is `.optional()` but backend `toPartialJSON()` always emits it.**
   Backend `StudentSubmissionItem.toPartialJSON()` always includes `assessments` (even if empty `{}`). The frontend partial schema makes it `.optional()`, allowing the key to be absent. Since the backend always emits it, this only matters if the field is missing due to an unexpected code path.
   **Classification: Aligned** — defensive tolerance.

7. **`BaseTaskArtifactPartialSchema` omits `content` and `contentHash` entirely.**
   Backend `BaseTaskArtifact.toPartialJSON()` emits them as `null`. The frontend partial schema simply omits them since null fields are not useful in partial views.
   **Classification: Aligned** — intentional reduction.

8. **`AssignmentFullResponseSchema` is `AssignmentFullSchema.nullable()`.**
   Backend `getAssignment_()` returns `null` when no persisted document exists. The frontend schema expects this.
   **Classification: Aligned** — documented contract.

9. **`StudentSubmissionItemSchema.feedback` uses `z.looseObject` while `StudentSubmissionItemPartialSchema.feedback` uses `z.unknown()`.**
   The full schema validates `type` and `createdAt` as strings, but tolerates extra fields (like `items` for CellReferenceFeedback). The partial schema uses `z.unknown()` for the entire value, accepting any feedback structure.
   **Classification: Aligned** — intentional per feedback type complexity.

10. **`StudentSubmission.updatedAt` uses a monotonic counter suffix (e.g. `"2025-09-10T12:30:00Z#2"`).**
    This is not a standard ISO 8601 format. The frontend `StudentSubmissionSchema` uses `z.string()`, which accepts any string, so this passes validation. However, any downstream code that parses this as ISO 8601 will fail on the `#N` suffix.
    **Classification: Aligned** — the Zod schema is intentionally loose (string), and consuming code is expected to handle the suffix. The monotonic counter is documented in [rehydration.md](../backend/rehydration.md) (§Hydration Guidelines).

11. **`startAssessmentRun` returns `null` and the frontend schema uses `z.void().nullable()`.**
    Backend returns `null` (no payload on success). The frontend `StartAssessmentRunResponseSchema` is `z.void().nullable()` which accepts both `undefined` (from the envelope's `data ?? null` coercion) and `null`.
    **Classification: Aligned** — standard pattern for void-response endpoints.

---

## File Index

```
Persistence model:         src/backend/AssignmentProcessor/Assignment/index.js
  └── AssignmentSerialisation (00_AssignmentSerialisation.js)
      └── toJSON()              — full document shape
      └── toPartialJSON()       — partial (summary) shape

Sub-entity models:
  ├── src/backend/Models/StudentSubmission.js
  │     └── StudentSubmission.toJSON()         — full submission shape
  │     └── StudentSubmission.toPartialJSON()   — partial submission shape
  │     └── StudentSubmissionItem.toJSON()      — full item shape
  │     └── StudentSubmissionItem.toPartialJSON() — partial item shape
  ├── src/backend/Models/Assessment.js
  │     └── Assessment.toJSON()                — full assessment shape
  ├── src/backend/Models/Feedback/0_Feedback.js
  │     └── Feedback.toJSON()                  — base feedback shape
  ├── src/backend/Models/Feedback/1_CellReferenceFeedback.js
  │     └── CellReferenceFeedback.toJSON()     — cell reference feedback shape
  └── src/backend/Models/Artifacts/0_BaseTaskArtifact.js
        └── BaseTaskArtifact.toJSON()          — full artifact shape
        └── BaseTaskArtifact.toPartialJSON()   — partial artifact shape

Controller:                src/backend/y_controllers/
  ├── AssignmentController.js                   — startAssessmentRun, processSelectedAssignment
  └── ABClassController/
        └── index.js                            — loadClass, readRehydrateAssignment
        └── ABClassAssignmentOps.js             — readRehydrateAssignment, _loadFullAssignmentDocument,
                                                  _validateAssignmentDocument, _ensureFullDefinition,
                                                  _getFullAssignmentCollectionName, persistAssignmentRun
        └── ABClassResponseMapper.js            — _toReadView() transport transformation

API handlers:              src/backend/z_Api/assignmentAssessment.js
  ├── getAssignment_()                         — full assignment fetch
  └── startAssessmentRun_()                    — assessment run trigger

Transport envelope:        src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
  │     → AssignmentFullSchema, AssignmentFullResponseSchema,
  │       GetAssignmentRequestSchema, StartAssessmentRunRequestSchema,
  │       StartAssessmentRunResponseSchema, StudentSubmissionSchema,
  │       StudentSubmissionItemSchema, AssessmentSchema, TaskDefinitionSchema,
  │       BaseTaskArtifactSchema, AssignmentDefinitionSchema
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts
  │     → getAssignment(), startAssessmentRun()
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
  │     → AssignmentPartialSchema, StudentSubmissionPartialSchema,
  │       StudentSubmissionItemPartialSchema, PartialAssessmentEntrySchema,
  │       BaseTaskArtifactPartialSchema, ClassFullSchema, ClassFullResponseSchema
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
        → getABClass()
```
