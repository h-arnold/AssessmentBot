# Contract: Assignment

Root domain object for an assessed piece of coursework. Contains submissions,
assessments, and an embedded assignment definition. Persisted independently
from ABClass, with partial summaries carried inside the ABClass document.

Backend model: `src/backend/AssignmentProcessor/Assignment/index.js` (facade)
Serialisation: `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`
Read projection: `src/backend/AssignmentProcessor/Assignment/02_AssignmentReadProjection.js`
Marker-1 restoration: `src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js`
Collections: `assign_full_<courseId>_<assignmentId>` (full records only — no partial registry)
API handlers: `src/backend/z_Api/assignmentAssessment.js`
Response mapper: Transport transformations applied by `src/backend/y_controllers/ABClassController/ABClassResponseMapper._toReadView()` (for `getABClass` embedding) — not part of Assignment's own serialisation.
Frontend service: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
Frontend Zod: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (full),
`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` (partial)
Frontend read normalisation: `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` (implemented pure full/partial entry points; independent G3 review/sign-off pending and not yet consumed by the read services),
with item/source validation and corruption construction in `src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts`

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

| #   | Field                       | Type                                   | Persistence            | Transport         | Frontend Zod                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------- | -------------------------------------- | ---------------------- | ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `courseId`                  | `string`                               | included               | same              | `AssignmentFullSchema.courseId: z.string()`                                         | Google Classroom course ID. Required, never null.                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | `assignmentId`              | `string`                               | included               | same              | `AssignmentFullSchema.assignmentId: z.string()`                                     | Google Classroom coursework ID. Required, never null.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | `assignmentName`            | `string`                               | included               | same              | `AssignmentFullSchema.assignmentName: z.string()`                                   | Fetched from Google Classroom at construction via `fetchAssignmentName()`.                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | `dueDate`                   | `string\|null`                         | included               | same              | `AssignmentFullSchema.dueDate: z.string().nullable()`                               | ISO 8601 string or `null`. Currently always `null` (homework tracker not implemented).                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | `updatedAt`                 | `string\|null`                         | included               | same              | `AssignmentFullSchema.updatedAt: z.string().nullable()`                             | ISO 8601 string or `null`. Set via `touchUpdated()`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | `createdAt`                 | `string`                               | included               | same              | `AssignmentFullSchema.createdAt: z.string()`                                        | ISO 8601 string. Set from Google Classroom `creationTime` at construction.                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | `documentType`              | `string\|null`                         | included (extracted)   | same              | `AssignmentFullSchema.documentType: z.string().nullable()`                          | `'SLIDES'` \| `'SHEETS'` or `null`. Extracted from embedded `assignmentDefinition` via `_extractFullDefinitionFields()`.                                                                                                                                                                                                                                                                                                                                    |
| 8   | `referenceDocumentId`       | `string\|null`                         | included (extracted)   | same              | `AssignmentFullSchema.referenceDocumentId: z.string().nullable()`                   | Extracted from embedded `assignmentDefinition`. `null` when definition is partial.                                                                                                                                                                                                                                                                                                                                                                          |
| 9   | `templateDocumentId`        | `string\|null`                         | included (extracted)   | same              | `AssignmentFullSchema.templateDocumentId: z.string().nullable()`                    | Extracted from embedded `assignmentDefinition`. `null` when definition is partial.                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | `tasks`                     | `Record<string, TaskDefinition>\|null` | included (extracted)   | same              | `AssignmentFullSchema.tasks: z.record(z.string(), TaskDefinitionSchema).nullable()` | Extracted from embedded `assignmentDefinition`. `null` when definition is partial. Only in full shape.                                                                                                                                                                                                                                                                                                                                                      |
| 11  | `submissions`               | `StudentSubmission[]`                  | included               | same              | `AssignmentFullSchema.submissions: z.array(StudentSubmissionSchema)`                | Array of `StudentSubmission.toJSON()` objects. Empty array when no submissions.                                                                                                                                                                                                                                                                                                                                                                             |
| 12  | `assignmentDefinition`      | `AssignmentDefinition`                 | included               | same              | `AssignmentFullSchema.assignmentDefinition: AssignmentDefinitionSchema`             | Full definition object via `AssignmentDefinition.toJSON()`. Always included in full persistence.                                                                                                                                                                                                                                                                                                                                                            |
| 13  | `assessmentContractVersion` | `1\|null\|unknown (legacy)\|omitted`   | included conditionally | `1\|null` on read | `AssignmentFullSchema.assessmentContractVersion: z.union([z.literal(1), z.null()])` | Current results emit `1`. Legacy records re-emit the exact stored marker presence/value opaquely, including an absent marker or an unsupported value; ordinary persistence never certifies or rewrites it. The full read serializer emits explicit `null` after legacy reassessment projection. The full schema now requires the read-wire field; the read services are not yet wired to the pure read normaliser, so only structural validation is active. |

Key notes:

- `progressTracker` is **intentionally not serialised** (it is a singleton/session-specific runtime property).
- `_hydrationLevel` is a runtime-only flag and never persisted.
- Fields 7–10 are extracted from the embedded definition by `_extractFullDefinitionFields(definitionJson)`, which reads `documentType`, `referenceDocumentId`, `templateDocumentId`, and `tasks` from the definition's `toJSON()` output.
- The `Assignment` class is a facade (`index.js`) that delegates serialisation to `AssignmentSerialisation` (`00_AssignmentSerialisation.js`).

### Partial variant — `Assignment.toPartialJSON()`

Not independently persisted, but used for in-memory partial representations and
for embedding inside `ABClass.assignments[]`. Behaviour differs from `toJSON()`:

| #   | Field                       | Type                                 | Persistence            | Transport                             | Frontend Zod                                                                           | Notes                                                                                                                                                                                                                                                                                           |
| --- | --------------------------- | ------------------------------------ | ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `courseId`                  | `string`                             | same as full           | same                                  | stripped by `AssignmentPartialSchema`                                                  | Present in wire format; Zod `.strip()` default removes it (not included in schema).                                                                                                                                                                                                             |
| 2   | `assignmentId`              | `string`                             | same as full           | same                                  | `AssignmentPartialSchema.assignmentId: z.string()`                                     |                                                                                                                                                                                                                                                                                                 |
| 3   | `assignmentName`            | `string`                             | same as full           | same                                  | stripped by `AssignmentPartialSchema`                                                  | Present in wire format; Zod `.strip()` default removes it.                                                                                                                                                                                                                                      |
| 4   | `dueDate`                   | `string\|null`                       | same as full           | same                                  | `AssignmentPartialSchema.dueDate: z.string().nullable().optional()`                    |                                                                                                                                                                                                                                                                                                 |
| 5   | `updatedAt`                 | `string\|null`                       | same as full           | same                                  | `AssignmentPartialSchema.updatedAt: z.string().nullable()`                             |                                                                                                                                                                                                                                                                                                 |
| 6   | `createdAt`                 | `string`                             | same as full           | same                                  | `AssignmentPartialSchema.createdAt: z.string()`                                        |                                                                                                                                                                                                                                                                                                 |
| 7   | `documentType`              | `string\|null`                       | same as full           | same                                  | `AssignmentPartialSchema.documentType: z.string().nullable()`                          | Only root-level field extracted in partial shape (via `_extractPartialRootFields()`).                                                                                                                                                                                                           |
| 8   | `referenceDocumentId`       | —                                    | omitted                | omitted                               | —                                                                                      | Not extracted in partial shape.                                                                                                                                                                                                                                                                 |
| 9   | `templateDocumentId`        | —                                    | omitted                | omitted                               | —                                                                                      | Not extracted in partial shape.                                                                                                                                                                                                                                                                 |
| 10  | `tasks`                     | —                                    | omitted                | omitted                               | —                                                                                      | Not extracted in partial shape.                                                                                                                                                                                                                                                                 |
| 11  | `submissions`               | `StudentSubmissionPartial[]`         | included               | transformed                           | `AssignmentPartialSchema.submissions: z.array(StudentSubmissionPartialSchema)`         | Submissions via `StudentSubmission.toPartialJSON()` — artifact content redacted; numeric/`'N'` assessment reasoning stripped, `'E'` reasoning/cause retained.                                                                                                                                   |
| 12  | `assignmentDefinition`      | `AssignmentDefinitionPartial`        | included               | replaced by `assignmentDefinitionKey` | `AssignmentPartialSchema.assignmentDefinitionKey: z.string()`                          | See Transport section for the transformation. `getABClass` endpoint replaces this with just the key.                                                                                                                                                                                            |
| 13  | `assessmentContractVersion` | `1\|null\|unknown (legacy)\|omitted` | included conditionally | `1\|null` on class read               | `AssignmentPartialSchema.assessmentContractVersion: z.union([z.literal(1), z.null()])` | Current results emit `1`. Legacy records re-emit the exact stored marker presence/value opaquely; the class read projection emits explicit `null` beside detached reassessment `E`. The partial schema now requires the field; the read services are not yet wired to the pure read normaliser. |

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
| Response mapper  | — (`Assignment.toReadJSON()` → `AssignmentSerialisation.toReadJSON()`, then `DateUtils.deepConvertDates()` and defensive `progressTracker` strip) |
| Frontend Zod     | `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `AssignmentFullResponseSchema` (`AssignmentFullSchema.nullable()`) |
| Frontend service | `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts` → `getAssignment()`                                               |

**Request:**

| Field          | Type     | Required | Notes                                               |
| -------------- | -------- | -------- | --------------------------------------------------- |
| `courseId`     | `string` | yes      | Must be non-empty, already trimmed, no unsafe chars |
| `assignmentId` | `string` | yes      | Must be non-empty, already trimmed, no unsafe chars |

**Response:** `AssignmentFullSchema` or `null`

| Field                       | Type                                   | Required | Notes                                                                                                                                                                                                       |
| --------------------------- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `courseId`                  | `string`                               | yes      |                                                                                                                                                                                                             |
| `assignmentId`              | `string`                               | yes      |                                                                                                                                                                                                             |
| `assignmentName`            | `string`                               | yes      |                                                                                                                                                                                                             |
| `dueDate`                   | `string\|null`                         | yes      | ISO 8601 string or `null`                                                                                                                                                                                   |
| `updatedAt`                 | `string\|null`                         | yes      | ISO 8601 string or `null`                                                                                                                                                                                   |
| `createdAt`                 | `string`                               | yes      | ISO 8601 string                                                                                                                                                                                             |
| `documentType`              | `string\|null`                         | yes      | `'SLIDES'` \| `'SHEETS'` or `null`                                                                                                                                                                          |
| `referenceDocumentId`       | `string\|null`                         | yes      |                                                                                                                                                                                                             |
| `templateDocumentId`        | `string\|null`                         | yes      |                                                                                                                                                                                                             |
| `tasks`                     | `Record<string, TaskDefinition>\|null` | yes      | `null` when definition is partial                                                                                                                                                                           |
| `submissions`               | `StudentSubmission[]`                  | yes      | Full `StudentSubmission.toJSON()` array                                                                                                                                                                     |
| `assignmentDefinition`      | `AssignmentDefinition`                 | yes      | Full `AssignmentDefinition.toJSON()` object                                                                                                                                                                 |
| `assessmentContractVersion` | `1\|null`                              | yes      | `1` for a current result; explicit `null` for a legacy result after backend reassessment projection. Required by `AssignmentFullSchema`; the frontend read service is not yet wired to the pure normaliser. |

Key contract notes:

- The response is built from `Assignment.toReadJSON()`, which delegates to `AssignmentSerialisation.toReadJSON()` and then calls `AssignmentDefinition.toJSON()` on the embedded definition. The `readRehydrateAssignment` handler internally performs full hydration (resolving partial definitions via `getDefinitionByKey`), so a throw only occurs when the authoritative record is itself unresolvable or partial.
- `getAssignment_()` selects the read serializer, not the persistence serializer. A stored record with `assessmentContractVersion: 1` is restored through `AssignmentCurrentRestoration` (see [§Marker-1 CURRENT restoration](#marker-1-current-restoration-implemented)); a marker-less, `null` or unsupported record keeps an opaque legacy snapshot. The read serializer emits detached reassessment `E` submissions and `assessmentContractVersion: null` for that legacy snapshot, and `1` for a current result. Ordinary `toJSON()`/`toPartialJSON()` continue to re-emit the opaque stored body and marker unchanged.
- The backend handler/controller read-serializer wiring is implemented and the scoped API integration review is clean. `AssignmentFullSchema` now requires `assessmentContractVersion: 1 | null`; the pure frontend read normaliser is implemented but the read services are not yet wired to it, so item isolation and the marker/reassessment consistency check are not yet active at runtime. See [Known discrepancies](#known-discrepancies).
- `progressTracker` is stripped from the response at the transport boundary as defence-in-depth (already omitted by the read serialiser).
- `DateUtils.deepConvertDates()` is called on the entire response before returning, because `google.script.run` prohibits `Date` objects in return values.
- Returns `null` when no persisted assignment document exists for the given `courseId`/`assignmentId` pair (`AssignmentNotFoundError` caught at the transport boundary).

#### `getAssignment` — Partial variant via ABClass transport

When assignments are embedded inside the `getABClass` response (see [Contract: ABClass §getABClass](abclass.md#getabclass-read)), the shape differs from `Assignment.toPartialJSON()`:

> **Partial variant (ABClass transport):** Same as `Assignment.toPartialJSON()` except:
>
> - `_hydrationLevel` and `progressTracker` are stripped (defence-in-depth — already omitted by `toPartialJSON()`)
> - The embedded `assignmentDefinition` object is replaced by `assignmentDefinitionKey` (the `definitionKey` from the stored definition). The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry.
> - `courseId` and `assignmentName` are present in the wire format but stripped by Zod `.strip()` on `AssignmentPartialSchema`.
> - A current result carries `assessmentContractVersion: 1`. A legacy record's submissions are replaced with the detached partial reassessment projection and `assessmentContractVersion` is set to `null` before the definition key replacement. `AssignmentPartialSchema` now requires `assessmentContractVersion: 1 | null`; the read services are not yet wired to the pure normaliser.

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

Backend model: `src/backend/Models/StudentSubmission/index.js` (submission facade; item model in `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js`)
Frontend Zod: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `StudentSubmissionSchema`

Represents a single student's submission for an assignment, containing submission
items keyed by task ID.

`StudentSubmission.toJSON()` emits:

| Field          | Type                                    | Backend toJSON() | Frontend Zod                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | --------------------------------------- | ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studentId`    | `string`                                | Always emitted   | `z.string()`                                        | Student's unique ID from Google Classroom.                                                                                                                                                                                                                                                                                                                                                                            |
| `studentName`  | `string\|null`                          | Always emitted   | `z.string().nullable()`                             | Student's full name, or `null` per the constructor default (`studentName = null`). The full schema was aligned to the backend's nullable emission; the partial schema was already `z.string().nullable()`. See [Full submission studentName nullability alignment](#full-submission-studentname-nullability-alignment-implemented). Retain the field: historical notes calling it temporary do not authorise removal. |
| `assignmentId` | `string`                                | Always emitted   | `z.string()`                                        | The parent assignment ID.                                                                                                                                                                                                                                                                                                                                                                                             |
| `documentId`   | `string\|null`                          | Always emitted   | `z.string().nullable().optional()`                  | The Drive file ID of the student's submission document. Null for students who never opened the assignment; `.optional()` tolerates the key being omitted entirely from real payloads (see key note below).                                                                                                                                                                                                            |
| `items`        | `Record<string, StudentSubmissionItem>` | Always emitted   | `z.record(z.string(), StudentSubmissionItemSchema)` | Dictionary of submission items keyed by taskId. Empty object when no items.                                                                                                                                                                                                                                                                                                                                           |
| `createdAt`    | `string`                                | Always emitted   | `z.string()`                                        | ISO 8601 string. Set at construction.                                                                                                                                                                                                                                                                                                                                                                                 |
| `updatedAt`    | `string`                                | Always emitted   | `z.string()`                                        | ISO 8601 string with monotonic counter suffix (e.g. `"2025-09-10T12:30:00Z#2"`). Set via `touchUpdated()`.                                                                                                                                                                                                                                                                                                            |

**Partial variant** (`StudentSubmission.toPartialJSON()`): Same as `toJSON()` except:

- Items use `StudentSubmissionItem.toPartialJSON()` (artifact content/contentHash set to `null`; numeric and `'N'` assessment reasoning stripped; `'E'` entries retain `{ score, reasoning, error }`).

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
- `documentId` is `.nullable().optional()` in both the full (`StudentSubmissionSchema`) and partial (`StudentSubmissionPartialSchema`) frontend schemas. The optionality tolerates both `null` values and the key being omitted entirely from real payloads, even though both `StudentSubmission.toJSON()` and `toPartialJSON()` always emit it.

### StudentSubmissionItem

Backend model: `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js` → `StudentSubmissionItem`
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
- `assessments` uses `_stripAssessmentReasoning()`: numeric and `'N'` entries keep only `score`; an `'E'` entry with its cause is preserved intact, retaining `reasoning` and `error`.

**Frontend partial schema** (`StudentSubmissionItemPartialSchema`):

| Field         | Type                                                            | Notes                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `z.string()`                                                    |                                                                                                                                                                                 |
| `taskId`      | `z.string()`                                                    |                                                                                                                                                                                 |
| `artifact`    | `BaseTaskArtifactPartialSchema`                                 | Content and contentHash omitted.                                                                                                                                                |
| `assessments` | `z.record(z.string(), PartialAssessmentEntrySchema).optional()` | Provided entries are validated by the shared `partialAssessmentResultSchema`: numeric/`'N'` score-only, or `'E'` with `reasoning` and `error`. `.optional()` tolerates absence. |
| `feedback`    | `z.record(z.string(), z.unknown()).optional()`                  | Loose type tolerates any feedback structure.                                                                                                                                    |

Key notes:

- `setError(stage, code)` replaces all three canonical criteria with the catalogue `'E'` result for that stage/code and clears `feedback`; it is the atomic task-wide error primitive. Wiring acquisition/extraction/assessment boundaries to call it is later work.
- `_deriveId()` generates a stable hash from `taskId` + artifact UID (falling back to `contentHash`), truncated to 16 hex characters prefixed with `ssi_`.
- The `documentId` and `pageId` are intentionally omitted from `StudentSubmissionItem.toJSON()` — the parent submission holds `documentId`, and the artifact contains `pageId`.

### Assessment

Backend model: `src/backend/Models/Assessment.js`
Frontend Zod (full consumer, activated): `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `AssessmentSchema` (aliases `assessmentResultSchema`)
Frontend Zod (partial consumer, activated): `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `PartialAssessmentEntrySchema` (aliases `partialAssessmentResultSchema`)
Frontend Zod (shared result/cause owner): `src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts` → `assessmentResultSchema`, `partialAssessmentResultSchema`, `assessmentCauseSchema`

Represents the assessment result for a single criterion (e.g. `'completeness'`,
`'accuracy'`, `'spag'`). Stored as a value in the `assessments` record on
`StudentSubmissionItem`.

`Assessment.toJSON()` emits:

| Field       | Type                                     | Backend toJSON()     | Frontend Zod                                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `score`     | `number \| 'N' \| 'E'`                   | Always emitted       | Shared `assessmentResultSchema` (consumed by `AssessmentSchema`): `z.union([z.number().min(0).max(5), z.literal('N')])` for the non-E branch, `z.literal('E')` for E. Zod 4 `z.number()` already rejects NaN and `±Infinity`. | Numeric scores must be finite and inclusive 0–5; fractions are valid. `'N'` remains genuine not-attempted/not-applicable evidence. `'E'` is an explicit error result and carries a cause. NaN, `±Infinity` and out-of-range values are rejected by the constructor and `fromJSON()`. |
| `reasoning` | `string`                                 | Always emitted       | Shared `assessmentResultSchema`: `z.string()` for non-E, `z.string().refine((value) => value.trim().length > 0)` for E.                                                                                                       | Required string for every result. Numeric/`'N'` reasoning may be empty. `E` reasoning must be non-blank; the stored value is preserved verbatim, including surrounding whitespace, and is never trimmed or rewritten.                                                                |
| `error`     | `{ stage: ErrorStage; code: ErrorCode }` | Emitted only for `E` | Shared `assessmentCauseSchema`: strict discriminated union by `stage`, with the exact catalogue codes below.                                                                                                                  | Non-`E` results must omit `error`; the constructor and `fromJSON()` reject error metadata on numeric/`'N'` results. `toJSON()` emits a detached copy, not the caller's object. No history, timestamp, retry ledger or stack trace is stored.                                         |

Implemented cause catalogue (exact pairs; no raw exception interpolation):

| Stage         | Code                         | Teacher-readable reasoning                                                    |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `acquisition` | `SOURCE_UNREADABLE`          | The submitted document could not be accessed.                                 |
| `acquisition` | `UNSUPPORTED_DOCUMENT`       | The submitted attachment is not a supported document for this assignment.     |
| `extraction`  | `SOURCE_CONTENT_UNAVAILABLE` | No source content could be extracted for this task.                           |
| `extraction`  | `PARSE_FAILED`               | The submitted work could not be parsed for this task.                         |
| `extraction`  | `IMAGE_HYDRATION_FAILED`     | The submitted slide image could not be loaded.                                |
| `assessment`  | `LLM_HTTP_FAILED`            | The assessment service rejected the request.                                  |
| `assessment`  | `LLM_UNAVAILABLE`            | The assessment service could not complete the request after retries.          |
| `assessment`  | `LLM_INVALID_RESPONSE`       | The assessment service returned an invalid result.                            |
| `assessment`  | `LLM_RUN_STOPPED`            | Assessment stopped because the service credentials or endpoint were rejected. |
| `assessment`  | `ASSESSMENT_FAILED`          | The extracted work could not be assessed.                                     |
| `validation`  | `CORRUPT_RECORD`             | The stored assessment data for this task is invalid. Reassess the assignment. |
| `validation`  | `REASSESSMENT_REQUIRED`      | Reassessment required                                                         |

**Partial variant**: In `StudentSubmissionItem.toPartialJSON()`, `_stripAssessmentReasoning()` keeps numeric and `'N'` entries score-only but preserves an `'E'` entry with its `reasoning` and `error`. The shared `partialAssessmentResultSchema` validates this union.

| Assessment kind | Partial entry                      | Notes                                                                                      |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Numeric         | `{ score: number }`                | Heavy reasoning remains stripped for successful numeric results.                           |
| `N`             | `{ score: 'N' }`                   | Genuine not-attempted evidence stays score-only.                                           |
| `E`             | `{ score: 'E', reasoning, error }` | A task failure must not lose its explanation when the item is embedded in a class partial. |

Key notes:

- `new Assessment(score, reasoning, error)` and `Assessment.fromJSON(json)` validate the union. They reject NaN/`±Infinity`, numeric scores outside 0–5, `E` without a valid cause or with blank reasoning, malformed causes, non-string reasoning, and `error` metadata on numeric/`'N'` results.
- `Assessment.createError(stage, code)` constructs an `E` result using the catalogue's canonical reasoning; an unknown stage/code pair throws. A caller may also construct `E` directly with the same valid cause and its own non-blank reasoning.
- `fromJSON()` ignores unrelated extra fields but still validates `score`, `reasoning` and `error`; it never silently repairs an invalid result.
- `AssessmentSchema` now aliases `assessmentResultSchema` and `PartialAssessmentEntrySchema` aliases `partialAssessmentResultSchema`, so both read schemas enforce the finite fractional 0–5 range, the `'E'` branch and the non-blank E reasoning refinement. The read services are not yet wired to the pure read normaliser, so contextual item/source checks remain structural only; see [Known discrepancies](#known-discrepancies).

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

- Feedback objects are fully preserved in both partial and full hydration — only numeric/`'N'` assessment reasoning is stripped; `'E'` reasoning/cause is retained, and feedback is not stripped.
- The frontend `StudentSubmissionItemSchema.feedback` uses `z.looseObject` to tolerate the extra `items` property on `CellReferenceFeedback`.
- The frontend partial schema uses `z.unknown()` for the feedback value, accepting any structure.

### BaseTaskArtifact

See [Contract: AssignmentDefinition §Sub-entity BaseTaskArtifact](assignment-definition.md#sub-entity-basetaskartifact). This contract's
`StudentSubmissionItem.artifact` uses the same shape, with `role` set to `'submission'`.

The full and partial schemas on the frontend are:

- **Full** (`BaseTaskArtifactSchema` in `assignmentAssessment.zod.ts`): discriminated union by `type` — `TEXT`/`TABLE`/`IMAGE` have `content: string | null`; `SPREADSHEET` has `content: Array<Array<string | number | null>> | null`; `base` has `content: unknown`. Common fields: `taskId`, `role`, `pageId`, `documentId`, `uid`, `contentHash` (nullable), `metadata`. The shared `BaseTaskArtifactFields` object validates the two source IDs as required nullable strings (`pageId: z.string().nullable()`, `documentId: z.string().nullable()`); see the implemented alignment below. The parent submission `StudentSubmissionSchema.documentId` validator is deliberately unchanged and remains `.nullable().optional()`.
- **Partial** (`BaseTaskArtifactPartialSchema` in `classDetailService.zod.ts`): reduced shape with `taskId`, `role`, `pageId` (nullable optional), `documentId` (nullable optional), `metadata` (optional), `uid`, `type`. `content` and `contentHash` are omitted entirely (set to `null` by `toPartialJSON()`).

> **Status: Implemented (issue #19).** The full frontend `BaseTaskArtifactFields`
> object in `assignmentAssessment.zod.ts` validates `pageId` and `documentId` as
> required nullable strings (`z.string().nullable()`): both reject a missing key
> and a non-string value, but accept the `null` source IDs the backend contract
> permits. Numeric or object IDs and absent artefact fields remain invalid, and
> types continue to derive from Zod. This was a frontend-only validation
> alignment: the backend `BaseTaskArtifact` constructor already defaults
> `pageId`/`documentId` to `null` and `toJSON()`/`toPartialJSON()` always emit
> them as `string | null`
> (`src/backend/Models/Artifacts/0_BaseTaskArtifact.js`), so no backend contract
> change was required. **Parent optionality is unchanged:** the parent submission
> `StudentSubmissionSchema.documentId` remains `.nullable().optional()` — the
> optionality tolerates the key being omitted entirely from real payloads even
> though the backend always emits it (see the `StudentSubmission` key note
> above). The partial `BaseTaskArtifactPartialSchema` in `classDetailService.zod.ts`
> likewise still accepts `string | null` via `.nullable().optional()` and is
> unchanged.

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
  - `AssessmentSchema` — aliases the shared `assessmentResultSchema` (finite fractional 0–5, `'N'`, or `'E'` with non-blank reasoning and a catalogue cause).
  - `TaskDefinitionSchema` — validates full task definition shape (cross-ref to AssignmentDefinition contract).
  - `BaseTaskArtifactSchema` — discriminated union validating artifact by `type`.
  - `AssignmentDefinitionSchema` — validates full definition shape (cross-ref to AssignmentDefinition contract).

- `src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts` (implemented shared result/cause owner; consumed by both read schemas):
  - `assessmentCauseSchema` — strict stage/code catalogue union.
  - `assessmentResultSchema` — full `number | 'N' | 'E'` union with finite 0–5 numeric range, required reasoning and `E`-only cause.
  - `partialAssessmentResultSchema` — numeric/`'N'` score-only entries, plus `E` entries retaining reasoning and cause.

- `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` (implemented pure full/partial read normaliser; independent G3 review/sign-off pending; not yet consumed by the read services):
  - `normaliseAssignmentRead()` — strict full-root and shared-definition validation, per-item isolation, and the same-payload missing-task defence.
  - `normaliseClassRead()` — strict class/partial roots and per-item isolation of provided entries only.

- `src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts` (implemented adjacent pure owner):
  - `isValidFullItem()` / `isValidPartialItem()` — item, artefact-association and parent-source contextual validation.
  - `corruptItem()` / `itemErrorPath()` — canonical all-three `CORRUPT_RECORD` replacement and safe diagnostic paths.

- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `AssignmentPartialSchema` — validates partial assignment shape as embedded in `getABClass` response, including the required `assessmentContractVersion: 1 | null`.
  - `StudentSubmissionPartialSchema` — validates partial submission shape.
  - `StudentSubmissionItemPartialSchema` — validates partial submission item shape (no content; numeric/`'N'` entries score-only; `'E'` entries retain reasoning/cause through the shared schema).
  - `PartialAssessmentEntrySchema` — aliases the shared `partialAssessmentResultSchema` (score-only numeric/`'N'`, or `'E'` with reasoning and cause).
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
- `Assignment._baseFromJSON()` validates the marker-1 root and authoritative task universe before constructing models. `AssignmentCurrentRestoration` validates raw submission items before constructors, isolates invalid known items and missing known coverage as all-three `CORRUPT_RECORD` `E`, preserves healthy siblings, and restores in the explicitly propagated full or partial mode. Marker-less, `null` and unsupported-marker records are not reconstructed: their historical body and exact marker presence/value are retained as an opaque snapshot, and the read serializer materialises detached reassessment `E` entries through `AssignmentRehydration.projectReassessmentSubmissions()`.
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

3. **`StudentSubmissionSchema.documentId` and `StudentSubmissionPartialSchema.documentId` are `.nullable().optional()` but the backend always emits the field.**
   Backend `StudentSubmission.toJSON()` and `StudentSubmission.toPartialJSON()` always include `documentId` (which may be `null`). The frontend schemas tolerate both `null` and an absent field to handle cases where Google Classroom omits the Drive file reference for students who never opened an assignment.
   **Classification: Aligned** — documented in the partial-vs-full hydration pattern in [rehydration.md](../backend/rehydration.md). The Zod schemas are permissive to handle both backend and Google Classroom edge cases.

4. **`StudentSubmissionPartialSchema.studentName` is `z.string().nullable()` but backend always emits it as a nullable string.**
   Backend `StudentSubmission.toPartialJSON()` always includes `studentName` (which may be `null` per constructor default). The frontend schema expects `string | null`. Both sides aligned.
   **Classification: Aligned**.

5. **Full and partial consumer schemas now match the implemented `Assessment` range and `E` union.**
   `AssessmentSchema` aliases the shared `assessmentResultSchema` and `PartialAssessmentEntrySchema` aliases `partialAssessmentResultSchema`. Both enforce finite fractional 0–5, `'N'`, and `'E'` with non-blank reasoning plus a catalogue cause. A full or partial backend result the shared schema accepts is no longer rejected by the consumer schemas.
   **Classification: Aligned** — activated in this slice.

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

12. **Full `BaseTaskArtifactFields` requires `pageId`/`documentId` as nullable strings, while the partial `BaseTaskArtifactPartialSchema` accepts them as `.nullable().optional()`.**
    Backend `BaseTaskArtifact.toJSON()` and `BaseTaskArtifact.toPartialJSON()` always emit both source IDs
    as `pageId`/`documentId` (`string | null`); `toPartialJSON()` redacts only `content` and `contentHash`,
    so neither ID is ever omitted (`src/backend/Models/Artifacts/0_BaseTaskArtifact.js`). Issue #19
    deliberately tightened only the full `getAssignment` transport schema
    (`assignmentAssessment.zod.ts`), which now rejects a missing `pageId`/`documentId` key while still
    accepting the `null` the backend permits. The class-detail partial schema
    (`classDetailService.zod.ts`) is intentionally left permissive: its `.optional()` is defensive
    tolerance at the `getABClass` transport boundary, mirroring the pre-existing optionality of the
    parent `StudentSubmissionPartialSchema.documentId`, and is not a response to any backend omission.
    Because the backend always emits both fields, the partial schema accepts an absent key the backend
    never produces.
    **Classification: Aligned** — deliberate, scoped asymmetry. The full path is the canonical strict
    contract; the partial path is unchanged by issue #19 and remains broad pending a separate decision
    to tighten the class-detail contract.

13. **Partial projection retains `E` reasoning/cause and the partial consumer accepts it.**
    `StudentSubmissionItem.toPartialJSON()` preserves an `'E'` entry intact (`{ score: 'E', reasoning, error }`) while numeric and `'N'` entries remain `{ score }`. `PartialAssessmentEntrySchema` now aliases `partialAssessmentResultSchema`, so a class-embedded `E` validates with its explanation.
    **Classification: Aligned** — consumer activation is complete; service wiring to the normaliser remains pending (see items 14 and 16–18).

14. **The shared result/cause owner is now consumed; the read normaliser is implemented but not wired.**
    `services/assignmentAssessment/assessmentResult.zod.ts` is consumed by both `assignmentAssessment.zod.ts` and `classDetailService.zod.ts`. The pure read normaliser (`assignmentReadNormalisation.ts` plus `assignmentReadItemValidation.ts`) is implemented and awaiting independent review, but `assignmentAssessmentService.ts` and `classDetailService.ts` still call `parseApiResponse` directly. Per-item isolation and contextual source/marker checks are therefore not active at runtime.
    **Classification: Misaligned (staged service wiring)** — schema activation is complete; service consumption is deliberately staged.

15. **`assessmentContractVersion` is now required by both frontend read schemas.**
    `AssignmentFullSchema` and `AssignmentPartialSchema` both require `z.union([z.literal(1), z.null()])`. The backend persistence and read paths are implemented as described above. The read services are not yet wired to the pure normaliser, so the schemas enforce root presence/type but the contextual marker-versus-result check is not yet active.
    **Classification: Aligned for schema shape; Misaligned (staged service wiring) for the contextual check** — see item 18.

16. **Legacy records are opaque and the backend read projection is implemented; the browser normaliser is implemented but not wired.**
    `AssignmentRehydration._rehydrateSubmission()` no longer catches, reconstructs or drops non-marker-1 records: the historical body and exact marker presence/value are retained as an opaque snapshot. `AssignmentSerialisation.toJSON()` / `toPartialJSON()` re-emit that snapshot unchanged (no ordinary-save certification), while `toReadJSON()` and `ABClassResponseMapper._toReadView()` substitute detached reassessment `E` placeholders from the implemented `02_AssignmentReadProjection.js` helper. The pure browser read normaliser is implemented and awaiting independent review; the read services still call `parseApiResponse` directly, and completed-write gates remain `Not implemented`.
    **Classification: Misaligned (staged service wiring)** — the backend split and browser normaliser are implemented; service activation and completed-write gates are staged.

17. **Corruption replacements do not yet reconcile a null parent's source state (open review gap G4).**
    `corruptItem()` retains any string artefact `pageId`/`documentId` from the invalid item, even when the parent submission `documentId` is `null`. An isolated replacement can therefore still contradict the canonical null-parent rule and be re-flagged on a later pass. Replacement construction is deterministic and does not generate a hash or reconstruct content.
    **Classification: Misaligned** — replacement construction needs parent source context. Not reachable from the services until the normaliser is wired.

18. **Marker-null payloads are not yet checked against the materialised reassessment contract (open review gap G5).**
    The normaliser requires `assessmentContractVersion: 1 | null` at the root but does not yet reject a marker-null payload whose provided entries are numeric/`N` success. Valid backend-materialised reassessment `E` entries are preserved, and no legacy graph is synthesised.
    **Classification: Misaligned** — provided marker-null entries still need contextual validation. Not reachable from the services until the normaliser is wired.

19. **Non-assessment corruption diagnostics do not yet report the failing field path (open review gap G6).**
    `itemErrorPath()` reports the item or criterion path but falls back to the whole item for malformed artefact/source fields; safe-parse issue paths are not reused. Diagnostics remain value-free and identifier-bounded.
    **Classification: Misaligned (diagnostics precision)** — no payload, reasoning, source content or student name is logged.

20. **Unused duplicate partial score declarations remain in the class-detail schema (open review gap G7).**
    `classDetailService.zod.ts` still declares `MAX_ASSESSMENT_SCORE`, `PartialAssessmentScoreSchema` and `PartialAssessmentScore`, although `PartialAssessmentEntrySchema` now aliases the shared owner and no production consumer imports the duplicates.
    **Classification: Fragile** — stale duplicate contract beside the canonical owner; no runtime effect today.

21. **Adjacent schema comments still describe the pre-`E` contract (open review gap G8).**
    Comments beside `AssessmentSchema` and the class-detail partial score/entry declarations still say number/`N` only, integer scores, and reasoning stripped from every partial result, while the activated shared schemas accept fractional 0–5, `'E'`, and retained `E` reasoning/cause.
    **Classification: Fragile (documentation drift)** — the canonical contract is the activated schema, not these comments.

## Planned contract additions — explicit Assessment errors and result-format marker (Not implemented)

> **Status: backend path implemented; frontend schema activation implemented; frontend
> normaliser implemented and awaiting independent review; service wiring, completed-write
> preflight/gates, corpus regeneration, analyser `E` input and preview error states remain
> pending.** Section 1 delivered the `Assessment` result/cause primitives,
> `StudentSubmissionItem.setError()` and partial `E` retention, plus the shared frontend
> `assessmentResult.zod.ts` schemas. Section 2b delivered marker-1 CURRENT backend restoration
> (`AssignmentCurrentRestoration`) with raw validation, coverage, null-parent isolation and
> full/partial mode threading, the opaque legacy persistence snapshot, the backend legacy
> reassessment read projection (`02_AssignmentReadProjection.js`) behind the sole
> `AssignmentRehydration.projectReassessmentSubmissions()` entry, and marker emission on both
> read transports. This frontend slice activated the shared result schemas in both read schemas,
> added the required `assessmentContractVersion: 1 | null` wire field and aligned the full
> `studentName` validator, and delivered the pure read normaliser
> (`assignmentReadNormalisation.ts` + `assignmentReadItemValidation.ts`). These implemented
> pieces are recorded in [§Assessment](#assessment), [§StudentSubmissionItem](#studentsubmissionitem),
> [§Marker-1 CURRENT restoration](#marker-1-current-restoration-implemented),
> [§Legacy reassessment read projection](#legacy-reassessment-read-projection-not-implemented)
> and [§Full and partial item isolation](#full-and-partial-item-isolation-with-trustworthy-identities-not-implemented).
> The read services are **not** yet wired to the normaliser, and open review gaps G4–G8 are
> recorded in [Known discrepancies](#known-discrepancies). Planned
> companions: [Contract: AssignmentDefinition §Planned definition artefact
> nullability](assignment-definition.md#planned-contract-additions--definition-artefact-nullability-not-implemented),
> [Contract: ABClass §Planned embedded result marker and E
> projections](abclass.md#planned-contract-additions--embedded-result-marker-and-e-projections-not-implemented),
> [Frontend Data Analysis Response §Planned explicit E assessment input and preview
> errors](frontend-data-analysis-response.md#planned-contract-additions--explicit-e-assessment-input-and-preview-errors-not-implemented).
>
> `SPEC.md` now fixes the backend reassessment projection owner, preview field names,
> explicit-`E` data-point accounting, blank spreadsheet canonicalisation, definition artefact
> nullability, completed-task coverage and the completion-write preflight; the resolved
> decisions are recorded below.

### `Assessment` — result/cause primitives (Implemented)

The result union, cause catalogue and constructor/`fromJSON()` validation are implemented in
`src/backend/Models/Assessment.js` and documented in [§Assessment](#assessment). The shared
frontend schemas are implemented in `services/assignmentAssessment/assessmentResult.zod.ts`
and are now consumed by both read schemas (`AssessmentSchema` and
`PartialAssessmentEntrySchema`).

Implemented primitive:

- **Atomic task-wide failures.** `StudentSubmissionItem.setError(stage, code)` replaces all
  three canonical criteria with the catalogue `E` result and clears feedback. Wiring the
  acquisition, extraction and assessment boundaries to invoke it remains later work.

Remaining planned invariants and staged read rules:

- **Exactly the canonical criteria.** A completed task's `assessments` record contains exactly
  `completeness`, `accuracy` and `spag`. Internal in-flight items may be incomplete, but
  completed persistence must reject an incomplete or extra-key record.
- **Read-time criterion corruption is isolated per item (implemented for marker-1 CURRENT
  backend restoration).** On both full and partial marker-1 reads,
  `AssignmentCurrentRestoration` replaces an item whose criterion map is incomplete or contains
  an extra key with all three validation `CORRUPT_RECORD` `E` entries (same `stage`, `code` and
  reasoning), preserving healthy sibling items. It does not drop the item or salvage marks.
  Completed persistence rejecting such a record remains planned. The pure browser normaliser
  implements the equivalent isolation but is not yet wired into the read services.
  Legacy reads already use reassessment projection rather than current-format criterion
  isolation.
- **No `formulaComparison` entry.** `SheetsAssessor` currently writes a non-Assessment
  `assessments.formulaComparison` value. Under the planned contract it is no longer persisted
  there; transient formula-comparison results remain assessor-local, and existing
  cell-reference feedback remains in `feedback` (`CellReferenceFeedback`). This removes an
  unused non-Assessment entry; it is not a new feedback-persistence feature.
- **Definition parse failures stay outside Assessment.** Duplicate reference/template title
  tags continue to block definition parsing on the existing definition/run error surface and
  safe cause; no student-level `DUPLICATE_TAG` E is introduced under the agreed first-match
  policy.
- **Consumer schema activation (implemented).** `AssessmentSchema` now aliases
  `assessmentResultSchema` and `PartialAssessmentEntrySchema` aliases
  `partialAssessmentResultSchema`, so both enforce the finite fractional 0–5 range and the `E`
  branch. Service consumption of the pure read normaliser remains pending.

### Partial projection — retain E explanation (Implemented)

`StudentSubmissionItem.toPartialJSON()` retains `E` entries with
`{ score: 'E', reasoning, error }` while numeric/`N` entries stay score-only; see
[§Assessment](#assessment). The shared `partialAssessmentResultSchema` validates that union, and
`PartialAssessmentEntrySchema` now aliases it, so a class-embedded `E` retains its explanation.
Partial artefact `content`/`contentHash` remain redacted; their `null` values are not evidence of
extraction failure.

### Marker-1 CURRENT restoration (Implemented)

`Assignment._baseFromJSON()` routes a record whose `assessmentContractVersion` is exactly `1`
through `AssignmentCurrentRestoration._rehydrateCurrentSubmission()`; every other record is kept
as an opaque legacy snapshot and projected for reads as described under
[§Legacy reassessment read projection](#legacy-reassessment-read-projection-not-implemented).
The representation mode is threaded from `Assignment.fromJSON()` through
`Assignment._baseFromJSON()` / `_rehydrateSubmission()`, `SlidesAssignment.fromJSON()` /
`SheetsAssignment.fromJSON()` and `StudentSubmission.fromJSON()` into
`StudentSubmissionItem.fromJSON()`.

| Aspect                  | Implemented behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation              | `assessmentContractVersion === 1` only. Current records emit `1` through both persistence serialisers and the read transport. Marker-less, `null` and unsupported records are retained as an opaque legacy snapshot; the read transport emits explicit `null` after reassessment projection. Both frontend read schemas now require `1 \| null`; the read services are not yet wired to the pure normaliser. See [Known discrepancies](#known-discrepancies).                                                                             |
| Root and task universe  | Validated once, before any model constructor runs: non-blank `courseId` / `assignmentId` strings, `submissions` as an array, and a non-empty embedded `assignmentDefinition.tasks` universe. In the full task-map form every key is non-blank and equals the embedded task's canonical `id`; an optional `taskId` must match that key. In the partial summary-array form every `taskId` is a non-empty unique string. Any failure throws and fails the owned dataset.                                                                     |
| Shared identities       | The same task-universe check runs with an empty `submissions` array, so duplicate or inconsistent definition identities cannot be hidden by having no students. A submission must carry a non-blank string `studentId` and an `assignmentId` equal to the root assignment ID. Unknown stored task keys outside the authoritative universe throw; associations are never guessed.                                                                                                                                                          |
| Empty no-submission     | A submission with parent `documentId: null` and an empty item object remains an empty submission record. It is not expanded into placeholders or fabricated `N` items.                                                                                                                                                                                                                                                                                                                                                                    |
| Raw item validation     | Before construction, each item must match its authoritative task key. Its artefact must carry the same `taskId`, `role: 'submission'`, one of `base` / `TEXT` / `TABLE` / `IMAGE` / `SPREADSHEET`, a non-empty string `uid`, and `string\|null` `documentId` / `pageId`. Full mode requires own `content` and `contentHash` keys; body/hash are both `null` or both present with a string hash. Bodies are type-checked (`TEXT` / `TABLE` string or `null`, `IMAGE` image data URL or `null`, `SPREADSHEET` 2D primitive grid or `null`). |
| Completed criteria      | Exactly `completeness`, `accuracy` and `spag`, with no extra keys. Full entries must be complete `Assessment` results. Partial entries are finite 0–5 numeric or `'N'` score-only objects, or an `'E'` with non-blank `reasoning` and a catalogue `error`.                                                                                                                                                                                                                                                                                |
| Source consistency      | Full document-bearing items may carry null body/hash only when all three results are `'E'` with an `acquisition`, `extraction` or `validation` stage. Partial document-bearing records are redaction-exempt and are not checked for source presence or hashed. A null-parent item must be the canonical base placeholder: `type: 'base'`, `role: 'submission'`, null `documentId` / `pageId` / `content` / `contentHash`, empty `metadata` and `feedback`, and all three results `'E'` with an `acquisition` or `validation` stage.       |
| Isolation               | An object item failing raw validation is replaced by a canonical `CORRUPT_RECORD` placeholder on all three criteria, created through the model constructors with the known task/student association. Healthy siblings and valid acquisition/validation placeholders are preserved. A missing known task receives the same placeholder; the placeholder is never constructed from the offending raw item.                                                                                                                                  |
| Exact-once construction | Each healthy raw item is validated once and constructed at most once. An already-materialised `StudentSubmissionItem` instance is serialised in the requested mode, validated, and retained as the same instance when healthy; a serialisation or construction fault propagates unchanged, with no retry or corruption conversion.                                                                                                                                                                                                        |
| Timestamps              | Valid stored submission `createdAt` / `updatedAt` values are retained independently. Otherwise `createdAt` falls back to the assignment `createdAt`; `updatedAt` falls back to the assignment `updatedAt` when non-null, otherwise the assignment `createdAt`. An invalid assignment timestamp throws. The wall clock is never used.                                                                                                                                                                                                      |

`TABLE` artefact bodies remain supported as stored `string \| null` for document-bearing items,
consistent with the existing artefact contract; marker-1 restoration neither generates TABLE
fixtures nor introduces new TABLE feature work.

The synthetic generator, projection and strict graph validators already emit and accept marker-1
records, real PNG/raw-grid bodies, paired reference formulae and retained partial `E` details.
That is test-fixture capability only: no committed profile has been regenerated. Production
persistence and both read transports now emit the marker; the backend legacy read projection and
the pure frontend read normaliser are implemented. The read services are not yet wired to that
normaliser. Corpus regeneration, completed-write gates, analyser `E` input and preview error
states remain pending; the outstanding Section 2c/2d cut-over failures are not waived.

### Full submission `studentName` nullability alignment (Implemented)

The backend `StudentSubmission.toJSON()` and `toPartialJSON()` always emit `studentName` as
`string \| null`. Both frontend read schemas now validate that nullable emission.

| Field         | Full schema (implemented) | Partial schema          | Notes                                                                                                                                                                                                                                                           |
| ------------- | ------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studentName` | `z.string().nullable()`   | `z.string().nullable()` | Matches the backend's nullable emission. Retain the field: historical notes calling it temporary do not authorise removal. The legacy reassessment placeholder also uses `studentName: string \| null`; do not fabricate a name when only an identity is known. |

This was a frontend validator alignment only. It does not change the backend model, persistence,
transport or the legacy reassessment projection.

### Source artefact content and hash semantics (Not implemented)

> **Status: partially implemented.** The blank/all-null `SPREADSHEET` representation (`[]` with
> the normal `[]` hash) is implemented in `SpreadsheetTaskArtifact.normalizeContent()` and applies
> through construction, persistence and restoration. For marker-1 records,
> `AssignmentCurrentRestoration` already enforces the full body/hash pairing and the null-content
> consistency conversions, preserves valid acquisition/validation placeholders, and exempts partial
> redaction. Detached legacy reassessment placeholders with explicit null content/hash are
> implemented by `02_AssignmentReadProjection.js`. The extraction-boundary creation of
> `SOURCE_CONTENT_UNAVAILABLE` `E` and completed-write preflight/gates remain **`Not
implemented`**. The pure frontend read normaliser is implemented but not yet wired into the
> read services.

Planned full-artefact rules:

| Situation                                                                             | Planned `content`                   | Planned `contentHash` | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successfully read blank/all-null `SPREADSHEET` grid (blank template or student range) | `[]`                                | Normal hash of `[]`   | **Implemented** in `SpreadsheetTaskArtifact.normalizeContent()`; canonicalisation applies through construction, persistence and restoration. Literal `null` means unavailable content, not blank content. Existing populated-formula normalisation is unchanged.                                                                                                                                                                                          |
| `SPREADSHEET` content unavailable                                                     | `null`                              | `null`                | At the actual extraction boundary, confirmed unavailable content creates an extraction `SOURCE_CONTENT_UNAVAILABLE` `E`. A current-format full read that instead finds null content beside numeric/`N` marks converts all three results to validation `CORRUPT_RECORD` `E` (see the full-content consistency rule below). A `null` hash is never a usable content fingerprint and must not match another `null` hash for template-match or `N` decisions. |
| Non-blank `SPREADSHEET` grid                                                          | Existing canonicalised 2D grid      | Existing content hash | Formula canonicalisation (space stripping, uppercasing) and trailing-row/column trimming are unchanged.                                                                                                                                                                                                                                                                                                                                                   |
| Full submission artefact for an acquisition/extraction/validation `E`                 | `null` allowed                      | `null` allowed        | The placeholder uses the canonical model constructor with the known task/student association, explicit null content/hash and validated source identifiers when available.                                                                                                                                                                                                                                                                                 |
| Assessment-only `E`                                                                   | Successfully extracted content kept | Existing hash kept    | An error in marking does not imply that the source preview is unavailable.                                                                                                                                                                                                                                                                                                                                                                                |
| Assessment-stage `E` with null full content                                           | `null` stored                       | `null` stored         | Contradictory stored record. An existing assessment-stage `E` with null full content remains a validation `CORRUPT_RECORD` `E`, not an accepted assessment-only error; it is never relabelled as `SOURCE_UNREADABLE` and no historical extraction cause is inferred. Partial redaction is exempt.                                                                                                                                                         |
| Partial artefact projection                                                           | `null`                              | `null`                | Deliberate redaction. It is never evidence of extraction failure and is exempt from the full-content consistency check.                                                                                                                                                                                                                                                                                                                                   |

Planned rules:

- Canonicalising a blank student spreadsheet grid to `[]` does not change pedagogical scoring:
  blank student grids still receive the current formula scores (completeness `0`, accuracy `0`,
  SPaG `N`), not an extraction error or a new `N` rule.
- A spreadsheet reference task with zero assessable formulae is an invalid shared definition,
  not a valid blank template. It blocks the run before student marking or completed persistence
  and preserves the prior saved result; it is never a student `E`. Blank templates canonicalised
  to `[]` remain valid, and blank student ranges retain the formula scores above. See
  [Contract: AssignmentDefinition §Definition artefact nullability and pending image
  exception](assignment-definition.md#definition-artefact-nullability-and-pending-image-exception-not-implemented).
- In full results, null submission content is allowed only for acquisition/extraction/validation
  `E` placeholders. On a current-format full read, null content beside purported numeric/`N`
  marks is a contradictory stored record: replace all three results with validation
  `CORRUPT_RECORD` `E` and its catalogue reasoning. Never guess `SOURCE_UNREADABLE` or infer a
  historical extraction cause from that contradiction. An actual extraction boundary that
  confirms content is unavailable creates an extraction `SOURCE_CONTENT_UNAVAILABLE` `E`
  instead. An assessment-only `E` retains its successfully extracted content. An existing
  assessment-stage `E` whose full record carries null content remains a contradictory stored
  record and becomes validation `CORRUPT_RECORD` `E`; it is not accepted as an assessment-only
  error. Partial artefact redaction is exempt from this full-content consistency check.
- Confirmed no-submission is represented by parent `documentId: null` and an empty item map,
  not fabricated null-content `N` items (see [Completed submission coverage](#completed-submission-coverage-not-implemented)).
- No `.optional()` relaxation of full artefact `content`/`contentHash` is permitted; a missing
  required field is corruption, not legitimate null content.

### Write boundary — preflight before any write (Not implemented)

Before any collection mutation, the planned completion path validates completed results and
prepares independent full and partial payloads. It preflights all four projections together:
the full assignment payload, its embedded partial, the prospective updated full-class payload
and the prospective `abclass_partials` payload. The existing class persistence preparation owner
is reused; no projection is first attempted after the full assignment has committed, and the
prepared snapshots are preserved through each write. The authoritative full assignment write
still precedes the class save and class-partials write. There is no cross-collection
transaction; a storage failure throws, logs the failed phase and whether the full write
committed, and never reports a completed run. Do not add unconditional saving in `finally` or
claim rollback guarantees.

### Completed submission coverage (Not implemented)

> **Status: backend marker-1 CURRENT and legacy read projections implemented; browser
> normaliser implemented and awaiting independent review; completion gates and service wiring
> pending.** `AssignmentCurrentRestoration` already materialises a missing
> known task as an all-three `CORRUPT_RECORD` `E`, isolates corrupt known items and incomplete/
> extra-key criteria while preserving healthy siblings, keeps a null-parent empty item map as an
> empty submission, and isolates contradictory null-parent items. For legacy records,
> `02_AssignmentReadProjection.js` materialises one detached `REASSESSMENT_REQUIRED` `E` item per
> known task/student pair on both reads. The pure browser normaliser implements the equivalent
> provided-entry isolation and defensive full-payload coverage, but is not yet wired into the
> read services. Completed-persistence coverage rejection remains **`Not implemented`**.

Planned version 1 coverage rules:

| Submission case                                     | Planned item map                                                                                       | Planned assessment values                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identified submission with a document               | One terminal item for every task in the embedded definition, even when extraction or assessment failed | Numeric, genuine `N`, or explicit `E` per completed criteria | A missing known task becomes a `CORRUPT_RECORD` `E`, materialised by `AssignmentRehydration` during one-pass full or partial backend restoration from the embedded snapshot. Both the planned version-1 full read output from `toReadJSON()` and the planned version-1 class-partial output carry it. The browser full-read normaliser fills a task only defensively if a wire payload nonetheless lacks it, using that same payload's definition; the partial normaliser validates provided entries only. A truncated item map must not silently create `N`. |
| Confirmed no-submission (`documentId: null`)        | Empty item map                                                                                         | None                                                         | Sole confirmed no-submission omission case. Do not fabricate null-content `N` items for it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Source-acquisition error with no usable document ID | Explicit `E` items for all known tasks                                                                 | Acquisition `E` (all three canonical criteria)               | The submission is not represented as an empty map when acquisition failed but the student/task identity is known.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Other null-document, non-empty item map             | Explicit `E` items only; a contradicting item is isolated individually                                 | All-three acquisition or validation `E` only                 | A null parent document makes the submission's source state authoritative. Numeric/`N` marks, or assessment-/extraction-stage `E`, contradict that state: on full and partial reads each identifiable offending item becomes all three validation `CORRUPT_RECORD` `E`, is never dropped, and healthy siblings are preserved. Items carrying valid acquisition/validation `E` remain valid.                                                                                                                                                                    |
| Genuine no-submission                               | No observed item contributed to the analyser                                                           | Existing no-data `N` display placeholder                     | Do not insert raw `N` observations that would change existing average denominators.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Whole student absent from a direct full record      | —                                                                                                      | —                                                            | Missing students whose identity is not present in the direct full record are not invented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Coverage resolution rules:

- The backend is authoritative for completed-item coverage on both read paths.
  `AssignmentRehydration` materialises a missing known task as a `CORRUPT_RECORD` `E` during
  one-pass full **and** partial restoration, using the assignment's own embedded task snapshot.
  Both the planned version-1 full read output from `toReadJSON()` and the planned version-1
  class-partial output therefore contain coverage `E` before transport. The browser's partial-read normaliser validates only
  the entries it is given; it never infers extra coverage errors from the separately loaded,
  potentially newer definition registry. Only if a full wire payload nonetheless lacks an
  expected task does the full-read normaliser defensively produce a `CORRUPT_RECORD` `E` using
  that same payload's definition. This mandatory fallback is a post-backend-validation
  corruption defence, not the normal full coverage owner. Backend-materialised `E` entries are
  never overwritten by coverage inference. No new task-universe transport field or full fetch is
  needed.
- A known dictionary task key paired with a mismatched item `taskId` becomes a
  `CORRUPT_RECORD` `E` for that known key. A stored item referencing no task in the embedded
  definition has no safe target and fails the owned assignment dataset; do not guess a task
  association. Extraction's existing warn-and-ignore treatment for an unknown task ID remains;
  terminal coverage still applies to known tasks.
- A null parent `documentId` with a non-empty item map is valid only when every item carries a
  complete all-three acquisition or validation `E` result. An identifiable item storing
  numeric/`N` marks, or an assessment- or extraction-stage `E`, contradicts the parent
  submission's null-document source state. On both full and partial reads, isolate that item by
  replacing all three criteria with validation `CORRUPT_RECORD` `E` and its catalogue reasoning.
  Never accept or drop the offending item, and never fail the whole owned dataset for an
  identifiable item contradiction. Preserve healthy sibling items, healthy submissions and valid
  acquisition/validation `E`; the rest of the owned assignment dataset remains available. This is
  an item-scoped corruption outcome, not a re-diagnosis of the historical acquisition or
  extraction cause. Null-document items carrying valid acquisition/validation `E` remain valid
  and are not rewritten.
- Completed persistence rejects an incomplete or extra-key criterion record (see the
  [Assessment invariants](#assessment--resultcause-primitives-implemented)); coverage and
  criterion completeness are both completion gates, not transport assumptions. An already-stored
  version-1 item with such a criterion map is converted to an isolated all-three
  `CORRUPT_RECORD` `E` on both full and partial reads, as described in the assessment
  invariants.
- The no-submission omission contributes no observed item and leaves existing denominator
  semantics unchanged; it is not an `error` or `excluded` observation.
- A version-1 canonical completed fixture never contains an empty assessment map.
  Missing-criterion and empty-map cases remain local corruption probes, not realistic success
  data. See
  [Synthetic Test Data §Explicit E outcomes and richer artefact types (implemented generator and validators; corpus cut-over pending)](../testing/synthetic-test-data.md#planned-generator-extension-explicit-e-outcomes-and-richer-artefact-types-not-implemented).

### `assessmentContractVersion` result marker (Not implemented)

> **Status: backend persistence and read transport implemented; both frontend read schemas
> activated.** `AssignmentSerialisation.toJSON()` / `toPartialJSON()` emit `1`
> for current results and re-emit the exact opaque legacy marker. Both read serialisers always
> emit `1 | null`; see [Known discrepancies](#known-discrepancies). `AssignmentFullSchema` and
> `AssignmentPartialSchema` now require `z.union([z.literal(1), z.null()])`; the read services
> are not yet wired to the pure normaliser.

Backend top-level field on the full assignment record and on every class-embedded partial
assignment:

| Field                       | Type        | Persistence                                                                                                                                                                | Transport                                                                                                          | Frontend Zod                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assessmentContractVersion` | `1 \| null` | `1` on newly completed results. Legacy absence, `null` or an unsupported value is preserved verbatim with the legacy body; stored values are never certified or rewritten. | Always present. `1` for current results; explicit `null` for legacy results after backend reassessment projection. | `z.union([z.literal(1), z.null()])` | Assessment-result marker, not a definition-version marker. Storage may omit the marker, store `null`, or retain an unsupported legacy value; that stored state means the result requires reassessment. The backend read transport always emits the field, normalising stored absence/`null`/unsupported values to explicit `null` beside materialised reassessment `E`. The read-wire field is required and accepts only `1 \| null`; a missing/unsupported **wire** marker is an invalid root, never a browser compatibility path that certifies old scores or synthesises legacy `E`. |

Persistence rules (backend implemented):

- Newly completed results carry exactly `1` in both the full `assign_full_*` record and its
  embedded class partial.
- Storage may omit the marker, or retain `null`/an unsupported legacy value. The model keeps the
  legacy submission body and the original marker presence/value as an opaque snapshot; ordinary
  persistence serialisers re-emit that state unchanged rather than certifying or rewriting it
  (see [Legacy reassessment read projection](#legacy-reassessment-read-projection-not-implemented)).
- A successful reassessment replaces the full result and embedded partial with a fresh current
  result carrying version `1`; it does not carry the legacy opaque snapshot. **Implemented.**
- Read-only reassessment projections do not write repaired results back to storage; there is no
  bulk migration, deletion, reset or guessed historical cause.

Transport and frontend-validation rules (backend transport implemented; both frontend read schemas activated):

- The backend read transport always emits `assessmentContractVersion` on every full assignment
  record and every class-embedded partial assignment. It emits `1` for a current result and
  explicit `null` for a legacy result after materialising reassessment `E` entries. It never
  omits the field and never emits a raw unsupported stored value.
- Both frontend read schemas require `z.union([z.literal(1), z.null()])`.
  A wire payload that omits the field or supplies any other value is an invalid root and fails
  strict root validation.
- Invalid-root rejection is not a browser compatibility path: the frontend must not certify
  legacy scores, fabricate legacy `E` entries or build a second reassessment graph from a
  marker-less/unsupported wire payload. Legacy `E` materialisation belongs solely to the backend
  projector, whose output always carries the required marker (`1` or `null`).
- Invalid-root validation precedes per-item isolation. The defensive full-read coverage fallback
  for a missing known task applies only to a valid root carrying
  `assessmentContractVersion: 1 | null`; it is not a marker-based legacy or reassessment-graph
  path.

This clarification pins the required read-wire union now implemented in both frontend read
schemas; it does not introduce a new migration, storage rewrite or browser-side reassessment path.

### Legacy reassessment read projection (Not implemented)

> **Status: backend projection implemented; pure frontend normaliser implemented and awaiting
> independent G3 review/sign-off; service wiring pending.** The public owner
> `AssignmentRehydration.projectReassessmentSubmissions(assignment, students, form)` delegates
> to the implemented pure helper `02_AssignmentReadProjection.js`. Both
> `AssignmentSerialisation.toReadJSON()` (full) and `ABClassResponseMapper._toReadView()`
> (partial) invoke it before response validation and definition-key replacement. The browser
> normaliser validates the already-materialised entries but is not yet wired into the read
> services; it does not materialise a second reassessment graph.

Public owner: the existing
`AssignmentRehydration.projectReassessmentSubmissions(assignment, students, form)` entry. Its
pure legacy projection/snapshot mapping is implemented in same-domain
`02_AssignmentReadProjection.js`, behind that unchanged public entry; this is
a module separation, not a second materialiser. That public entry remains the sole backend
materialiser of legacy reassessment `E` entries and creates detached read snapshots, not durable
repairs. The browser does not build a second reassessment graph. It applies when a **stored** full
record or class-embedded partial is missing `assessmentContractVersion`, or carries `null`/an
unsupported value; its read output always carries `assessmentContractVersion: null`. A missing or
unsupported **wire** marker is instead an invalid root under strict frontend validation, not a
legacy-result signal for the browser. The internal `form` argument is exactly `'full' | 'partial'`:
full for `getAssignment`, partial for `getABClass`. It is not a new transport parameter.

| Read path       | Invocation                                                                                                                                                                                                                                                                                                                          | Inputs                                                                                                                                                                                                                       | Output                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `getABClass`    | `ABClassResponseMapper._toReadView()` invokes it **before** replacing the embedded definition with `assignmentDefinitionKey`                                                                                                                                                                                                        | already loaded roster and embedded task summaries                                                                                                                                                                            | partial assignment entries include explicit partial `E` items; `assessmentContractVersion: null` |
| `getAssignment` | `getAssignment_()` calls `Assignment.toReadJSON()`, which delegates to `AssignmentSerialisation.toReadJSON()`. That read projection invokes the same operation on the instance returned by `readRehydrateAssignment` (after its `_ensureFullDefinition` step), before final response validation and `DateUtils.deepConvertDates()`. | Validated stored student identities and the resolved embedded definition's tasks. A full stored snapshot is authoritative when present; the existing partial-definition fallback may resolve the registry's full definition. | Full `E` entries; `assessmentContractVersion: null`; no roster or class read                     |

The class path keeps its stored task summaries. For abnormal legacy partial-definition records,
the class read and the direct full read can therefore expose different known-task universes.
All projected entries in both reads remain reassessment `E`; neither read repairs storage nor
guesses historical task associations or causes.

Placeholder construction (one per known student/task pair):

| Aspect               | Value                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Submission           | Existing `StudentSubmission` model constructor (public entry retained by the implemented model split). `studentId` from the validated identity. `studentName` is `string \| null`, matching the backend model; do not fabricate a name when only an identity is known. `documentId` retains only a validated historical ID, otherwise explicit `null`.       |
| Item                 | Existing `StudentSubmissionItem` model constructor; known `taskId`; item ID uses the usual model derivation.                                                                                                                                                                                                                                                 |
| Artefact             | Existing model constructor with `role: 'submission'`, `type: 'base'`, explicit `content: null`, `contentHash: null` and empty `metadata` (`{}`). Its UID is deterministically derived from the assignment/student/task identities. Only validated historical document/page IDs may be retained; otherwise explicit `null`, never guessed source identifiers. |
| Assessments          | All three canonical criteria set to the validation `REASSESSMENT_REQUIRED` `E`: `reasoning: 'Reassessment required'` and `error: { stage: 'validation', code: 'REASSESSMENT_REQUIRED' }`.                                                                                                                                                                    |
| Feedback             | Empty record (`{}`).                                                                                                                                                                                                                                                                                                                                         |
| Timestamps           | Valid stored submission timestamps where available. Otherwise the detached placeholder uses the assignment's `createdAt` and its non-null `updatedAt` (or `createdAt` when no update exists). Never the wall clock and never a claim about the historical processing attempt.                                                                                |
| Transport projection | Full reads emit full `E` entries. Class reads redact artefact content/hash as usual but retain `E` reasoning and cause. Both emit `assessmentContractVersion: null`.                                                                                                                                                                                         |

The implemented `Models/StudentSubmission/` split keeps `index.js` as the public facade and
the existing item model in `00_StudentSubmissionItem.js`; both remain at most 320 lines and
preserve the constructors used above. This module separation is implemented; it is not a change
to the placeholder contract.

Format gate and persistence preservation:

- Check the legacy marker before restoring historical items. Keep the legacy submission body and
  the original marker presence/value as an opaque snapshot behind the typed `Assignment` facade
  for unchanged persistence. Runtime snapshot fields themselves are not serialised. Legacy
  persistence `toJSON()`/`toPartialJSON()` re-emit that stored submission body and the original
  marker unchanged; they never emit projected `E` placeholders.
- Do not validate or coerce historical marks into the new completed-item contract, strip stored
  content on an ordinary class save, or persist the detached `E` projection. This is a format
  gate, not historical-data repair. The read projection is detached: `_toReadView()` substitutes
  the projector output for the class wire entry, and `Assignment.toReadJSON()` (delegating to
  `AssignmentSerialisation.toReadJSON()`) does the same for a direct full read. Class
  save/preparation never receives those read placeholders.
- Historical scores/content are ignored for assessment resolution; do not attempt to reconstruct
  past failure causes. Old-format data need not gain valid historical previews, but class
  configuration, definitions and existing stored results are retained unchanged. Successful
  reassessment is the authorised transition to a current result.
- The frontend normaliser validates these already materialised entries and the required
  `assessmentContractVersion: 1 | null` read field. It does not generate a second reassessment
  graph, query a roster or infer historical outcomes. A wire payload with a missing or
  unsupported marker is an invalid root; it is not a legacy-result signal for the browser. The
  normaliser is implemented but the read services are not yet wired to it.
- An invalid root/definition or untrustworthy required identity still fails the owned dataset;
  this projection must not invent missing identities.

> **Temporary compatibility.** The legacy opaque-persistence and detached-read compatibility
> path — including the separate `Assignment.toReadJSON()` wrapper — is migration compatibility,
> not an intended permanent second serialiser. Review it on **24 April 2027** to decide whether
> legacy assessments have likely been rerun and the path can be retired. That date is a review
> checkpoint only: it does not expire, remove or change the path automatically. Retiring the path
> first requires confirming that remaining stored legacy assessments no longer need it and that
> ordinary persistence cannot be damaged. No scheduled notification, automatic migration, data
> deletion, background backfill or forced reassessment is promised or authorised.

### Full and partial item isolation with trustworthy identities (Not implemented)

> **Status: backend marker-1 CURRENT restoration and legacy read projection implemented;
> pure frontend read normaliser implemented and awaiting independent G3 review/sign-off; service
> wiring and completed-write gates pending.** The backend raw validation,
> exact-once construction, missing-task coverage, null-parent isolation, full/partial mode
> threading and detached legacy reassessment projection described here are implemented by
> `AssignmentCurrentRestoration` and `02_AssignmentReadProjection.js`; see
> [§Marker-1 CURRENT restoration](#marker-1-current-restoration-implemented) and
> [§Legacy reassessment read projection](#legacy-reassessment-read-projection-not-implemented).
> The browser read-normalisation owners (`assignmentReadNormalisation.ts` and
> `assignmentReadItemValidation.ts`) implement the pure full/partial isolation below but are not
> yet called by the read services. Open review gaps G4–G8 are listed in
> [Known discrepancies](#known-discrepancies); completed-write gates remain **`Not implemented`**.

Planned restoration/validation behaviour for both the full `getAssignment` path and the
class-embedded partial path:

- Make full versus partial restoration explicit at the owning boundary. Partial redaction must
  never trigger source-content failure detection or hash generation.
- Legacy reassessment entries are already materialised by the backend
  `AssignmentRehydration.projectReassessmentSubmissions()` owner. The frontend normaliser
  validates those entries and retains defensive per-item corruption isolation; it does not
  generate a second reassessment graph, query a roster or infer historical outcomes.
- Restore each identified submission/item once. Validate raw current-version records **before**
  coercive constructors can erase evidence of absent content/hash or malformed Assessment
  entries. Retain model-owned content normalisation; do not duplicate a second domain model at
  the API boundary.
- Validate identifiable student items independently so a malformed item, mark or error detail
  cannot discard healthy siblings. This includes an item whose null parent `documentId` is
  contradicted by numeric/`N` marks or by an assessment-/extraction-stage `E`: isolate that item
  as all-three validation `CORRUPT_RECORD` `E` under
  [Completed submission coverage](#completed-submission-coverage-not-implemented), never dropping
  it or its healthy siblings. The contradiction is item-scoped; do not fail the whole owned
  dataset for an identifiable item. Valid acquisition/validation `E` items under the same null
  parent remain valid and are preserved. Apply the equivalent isolation to full and partial reads,
  with their different content/reasoning presence rules, through the feature-domain
  read-normalisation owner; do not weaken global `parseApiResponse` semantics.
- Validate assignment/root/shared-definition structure atomically and strictly as today,
  including the required `assessmentContractVersion: 1 | null` read-wire field. After
  isolation, revalidate the canonical normalised result before returning typed data to
  consumers; a missing required key (including a missing/unsupported wire marker) is never
  accepted as a valid success.
- Replace only explicitly detected invalid records with typed `E` placeholders. A placeholder
  uses the canonical model constructors, preserves the known task/student association, and
  carries explicit `null` content/hash plus validated source identifiers when available. It is
  never passed to rendering as a malformed success-shaped object.
- In backend restoration, `AssignmentRehydration` performs the one-pass full **and** partial
  restoration. If a submission identity is valid but its item collection is corrupt, it marks
  the known definition tasks `E` from the embedded snapshot. If student/task identity or the
  shared root/definition is untrustworthy, fail the owned dataset loudly rather than guessing
  associations. On the browser partial-read path, the normaliser validates only the entries it
  is given and does not infer coverage from the separately loaded definition registry. On the
  browser full-read path, a missing task is filled only defensively from that same payload's
  definition when the wire payload nonetheless lacks it; that fallback never overwrites
  backend-materialised `E` and is not the normal full coverage owner.
- Data-corruption conversion is restricted to explicit raw-data validation failures. Do not
  catch arbitrary constructor or programming faults and turn them into `E`.
- Full artefact `content`/`contentHash` remain required in the full shape. No `.optional()`
  relaxation is permitted; a missing required field is corruption, not legitimate null content.
- Log structured field paths and available course/assignment/student/task identifiers; never
  log source content, raw LLM payloads, credentials or student names.

Owners:

| Boundary                       | Owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Responsibilities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend shared result schemas | `services/assignmentAssessment/assessmentResult.zod.ts` (implemented; consumed by both read schemas)                                                                                                                                                                                                                                                                                                                                                                                                                                            | Shared full/partial `Assessment` and error-cause schemas, so both assignment and class-detail services enforce the same score range, `E` catalogue and non-blank `E` reasoning refinement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Frontend read normalisation    | `services/assignmentAssessment/assignmentReadNormalisation.ts` and `services/assignmentAssessment/assignmentReadItemValidation.ts` (implemented pure owners; awaiting independent review; read services not yet wired)                                                                                                                                                                                                                                                                                                                          | Pure full/partial item isolation. `assignmentReadNormalisation.ts` owns the two public entry points and root/definition checks; `assignmentReadItemValidation.ts` owns item/artefact/parent-source validation, canonical corruption construction and safe diagnostic paths. They contain no React, GAS dispatch or raw-JSON parsing. The browser partial path validates provided entries only and never infers coverage from the definition registry. The browser full path fills a task only defensively when a wire payload lacks it, using that same full payload's definition, and never overwrites backend-materialised `E`; it is not the normal full coverage owner. |
| Backend raw domain validation  | `src/backend/Models/Assessment.js`, `src/backend/Models/StudentSubmission/index.js` (implemented facade), `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js` (implemented item model), `src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js` (restore/coverage facade), `src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js` (implemented marker-1 restoration), `src/backend/AssignmentProcessor/Assignment/02_AssignmentReadProjection.js` (implemented pure legacy projection) | `Assessment` validates its result/cause; the `StudentSubmission` facade and item model validate their own full/partial records; `AssignmentRehydration` owns one-pass full/partial graph traversal; `AssignmentCurrentRestoration` owns marker-1 root/task pre-validation, raw item validation, coverage, null-parent isolation and full/partial restoration; the legacy projection remains behind `AssignmentRehydration.projectReassessmentSubmissions()`, with pure projection/snapshot mapping in `02_AssignmentReadProjection.js` (implemented), not a second materialiser. Controllers select the representation explicitly.                                          |
| Transport-boundary exclusion   | `src/backend/z_Api/*` handlers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | API handlers do not introduce a second domain-validator hierarchy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Backend module separations (from the `SPEC.md` sizing table) preserve the existing
public owners and the existing File Index:

- `src/backend/Models/StudentSubmission.js` has become `Models/StudentSubmission/index.js`
  (public facade) plus `Models/StudentSubmission/00_StudentSubmissionItem.js` (item model),
  each at most 320 lines. **Implemented in Section 1**; the existing public constructors
  remain the entry points.
- `src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js` keeps its
  restore/coverage facade at most 320 lines; the pure legacy projection/snapshot mapping lives
  in same-domain `02_AssignmentReadProjection.js` at most 280 lines, behind the unchanged
  `AssignmentRehydration.projectReassessmentSubmissions()` entry. It is not a second
  materialiser. **Implemented.**

The StudentSubmission model split is implemented. The marker-1 CURRENT restoration slice and the
legacy read-projection separation/opaque persistence are implemented and documented in
[§Marker-1 CURRENT restoration](#marker-1-current-restoration-implemented) and
[§Legacy reassessment read projection](#legacy-reassessment-read-projection-not-implemented);
the pure frontend read normaliser is implemented and awaiting independent review, and read-service
activation plus completed-write gates remain pending.

### Alignment concerns (planned vs current code)

1. **`Assessment` has an `E` branch and both consumer schemas now accept it.** The backend
   `Assessment.toJSON()` emits `number | 'N' | 'E'` with an `E`-only cause, and the shared
   `assessmentResult.zod.ts` schemas validate it. `AssessmentSchema` and
   `PartialAssessmentEntrySchema` alias those shared schemas, so a full or partial `E` cause and
   retained partial reasoning validate.
2. **Full/partial score validators now match the implemented range.** The backend rejects
   NaN/`±Infinity` and values outside 0–5. Both read schemas consume the shared union:
   `z.number().min(0).max(5)` (Zod 4 rejects NaN/`±Infinity`) plus `'N'`, and the `E` branch.
   Fractional scores are accepted.
3. **Current `assessments` accepts arbitrary keys and persists `formulaComparison`.**
   `SheetsAssessor` writes `submissionItem.assessments.formulaComparison`, and both records use
   `z.record(z.string(), ...)`. The planned exact-three-criteria contract and removal of that
   entry are **Misaligned** with current persistence until implemented.
4. **Partial projection retains E reasoning and the partial consumer validates it.**
   `_stripAssessmentReasoning()` preserves an `E` entry intact while numeric/`N`
   entries stay score-only. `PartialAssessmentEntrySchema` aliases the shared
   `partialAssessmentResultSchema`, so the retained `E` details validate.
5. **Preview/read-projection field shapes are now fixed by `SPEC.md`.** The planned
   `CellPreviewData` adds the required `errors` map, and `TaskPreviewData` carries the selected
   criterion's required `error` plus `sourceState`. Current derived shapes have none of these
   fields, so the preview contract is **Misaligned** until implemented. The exact field names and
   precedence are recorded in
   [Frontend Data Analysis Response §Preview shapes](frontend-data-analysis-response.md#preview-shapes--explicit-source-and-error-state-not-implemented),
   not duplicated here.
6. **Coverage and blank spreadsheet canonicalisation are partially implemented.**
   Marker-1 CURRENT backend restoration materialises one item per known task, converts a missing
   or corrupt known item to all-three `CORRUPT_RECORD` `E`, and preserves healthy siblings on both
   full and partial reads. The legacy read projection instead materialises every known
   student/task pair as all-three `REASSESSMENT_REQUIRED` `E` without validating historical
   assessment bodies. `SpreadsheetTaskArtifact.normalizeContent()` now canonicalises a
   successfully read blank/all-null grid to `[]` with the normal `[]` hash. The pure browser
   normaliser implements provided-entry isolation and the defensive full-payload fallback, but is
   not yet wired into the read services; completed-persistence coverage rejection remains
   **Misaligned** until implemented. Existing formula scoring is unchanged.
7. **The shared result schema owner and the pure read normaliser both exist; service wiring does
   not.** `services/assignmentAssessment/assessmentResult.zod.ts` is consumed by both read
   schemas, and `services/assignmentAssessment/assignmentReadNormalisation.ts` plus
   `assignmentReadItemValidation.ts` implement pure full/partial isolation. Neither read service
   calls the normaliser yet: `assignmentAssessmentService.ts` and `classDetailService.ts` still
   pass the response straight to `parseApiResponse`. Open review gaps G4–G8 are listed in
   [Known discrepancies](#known-discrepancies).
8. **Full `StudentSubmissionSchema.studentName` now accepts `null`, matching the backend's
   `string \| null` emission.** The partial schema was already nullable. Retain the field;
   historical notes calling it temporary do not authorise removal.

**Classification of the entries above:** the `Assessment` result/cause primitives, atomic
`setError()`, partial `E` retention, both consumer schema activations, the required wire marker,
full `studentName` nullability, blank-grid canonicalisation, marker-1 CURRENT backend
restoration (read validation, coverage and null-parent isolation) and the legacy read
projection/opaque persistence are implemented. The pure frontend read normaliser is implemented
and awaiting independent review; read-service activation, open review gaps G4–G8,
completed-persistence gates and the preview slices remain pending. None is a regression in the
implemented backend result/cause, CURRENT restoration or legacy projection contracts.

---

## File Index

```
Persistence model:         src/backend/AssignmentProcessor/Assignment/index.js
  └── AssignmentSerialisation (00_AssignmentSerialisation.js)
      └── toJSON()              — full document shape (opaque legacy snapshot re-emitted unchanged)
      └── toPartialJSON()       — partial (summary) shape (opaque legacy snapshot re-emitted unchanged)
      └── toReadJSON()          — full read shape (current marker 1 / legacy marker null + reassessment E)
  └── AssignmentRehydration (02_AssignmentRehydration.js)
      └── _baseFromJSON()       — marker-1 root/task pre-validation; opaque legacy snapshot otherwise
      └── projectReassessmentSubmissions() — sole public legacy read-projection facade
  └── AssignmentReadProjection (02_AssignmentReadProjection.js)
      └── projectReassessmentSubmissions() — implemented pure detached legacy projection
  └── AssignmentCurrentRestoration (02_AssignmentCurrentRestoration.js)
      └── _rehydrateCurrentSubmission() — marker-1 full/partial restoration, coverage,
                                           null-parent isolation and corrupt-item placeholders

Sub-entity models:
  ├── src/backend/Models/StudentSubmission/
  │     ├── index.js                             — StudentSubmission facade
  │     │     └── StudentSubmission.toJSON()         — full submission shape
  │     │     └── StudentSubmission.toPartialJSON()   — partial submission shape
  │     └── 00_StudentSubmissionItem.js           — StudentSubmissionItem model
  │           └── StudentSubmissionItem.toJSON()      — full item shape
  │           └── StudentSubmissionItem.toPartialJSON() — partial item shape
  │           └── StudentSubmissionItem.setError()     — atomic all-three-criteria E replacement
  ├── src/backend/Models/Assessment.js
  │     └── Assessment.toJSON()                — full assessment shape (score/reasoning/error)
  │     └── Assessment.createError()            — catalogue E construction
  │     └── Assessment.fromJSON()               — validated result restoration
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
  ├── src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts
  │     → assessmentResultSchema, partialAssessmentResultSchema,
  │       assessmentCauseSchema (implemented shared owner; consumed by both read schemas)
  ├── src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts
  │     → normaliseAssignmentRead(), normaliseClassRead() (implemented pure full/partial
  │       read normaliser; independent review pending; read services not yet wired)
  ├── src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts
  │     → isValidFullItem(), isValidPartialItem(), corruptItem(), itemErrorPath(),
  │       isRecord(), isIdentity() (implemented adjacent pure item/source validation and
  │       canonical corruption construction)
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
  │     → AssignmentPartialSchema, StudentSubmissionPartialSchema,
  │       StudentSubmissionItemPartialSchema, PartialAssessmentEntrySchema,
  │       BaseTaskArtifactPartialSchema, ClassFullSchema, ClassFullResponseSchema
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
        → getABClass()
```
