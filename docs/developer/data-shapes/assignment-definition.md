# Contract: AssignmentDefinition

Reusable assignment/lesson definition with reference and template documents.
Supports two hydration levels: **full** (keyed task objects with all artifacts) and
**partial** (tasks as an array of lightweight summaries, stored in the registry).
Can be shared across classes and year groups.

Backend model: `src/backend/Models/AssignmentDefinition.js`
Collections: `assignment_definitions` (registry, partial shape), `assdef_full_<definitionKey>` (full cache)
API handlers: `src/backend/z_Api/assignmentDefinitionTransport.js`, `src/backend/z_Api/assignmentDefinitionValidation.js`
Response mapper: `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionResponseMapper.js`
Frontend service: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts`, `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts`
Frontend Zod: `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`, `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`, `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`

Sibling contracts:

- [Contract: ABClass](abclass.md) — ABClass embeds assignment partials that reference this contract's `definitionKey`.
- [Contract: Assignment](assignment.md) — Assignment embeds a full or partial `AssignmentDefinition` (copy-on-construct).
- [Contract: Reference Data](reference-data.md) — `primaryTopicKey` references AssignmentTopics; `yearGroupKey` references YearGroups.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.

---

## Persistence

AssignmentDefinition uses a split persistence model: a lightweight registry for list-view
access and a full cache for per-definition operations (parsing, assessment).

### Collection: `assignment_definitions` (registry)

Stored via `AssignmentDefinition.toPartialJSON()`. Always uses the partial shape
(tasks as an array of lightweight summaries). Each document is keyed by `definitionKey` within
a single JsonDbApp collection.

| #   | Field                 | Type                                        | Persistence | Transport | Frontend Zod                                                                         | Notes                                                                                |
| --- | --------------------- | ------------------------------------------- | ----------- | --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | `primaryTitle`        | `string`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.primaryTitle: z.string()`                         | Canonical assignment title. Always present.                                          |
| 2   | `primaryTopic`        | `string`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.primaryTopic: z.string()`                         | Resolved topic display label.                                                        |
| 3   | `primaryTopicKey`     | `string`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.primaryTopicKey: TrimmedNonEmptyStringSchema`     | Authoritative keyed reference to `assignment_topics`. Never null.                    |
| 4   | `yearGroupKey`        | `string`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.yearGroupKey: TrimmedNonEmptyStringSchema`        | Authoritative year-group key. Never null (controller guarantees).                    |
| 5   | `yearGroupLabel`      | `string\|null`                              | included    | unchanged | `AssignmentDefinitionPartialSchema.yearGroupLabel: TrimmedNonEmptyStringSchema`      | Resolved display label. Controller sets from reference data. `null` when unresolved. |
| 6   | `alternateTitles`     | `string[]`                                  | included    | unchanged | `AssignmentDefinitionPartialSchema.alternateTitles: z.array(z.string())`             | Known title variants. Empty array when none.                                         |
| 7   | `alternateTopics`     | `string[]`                                  | included    | unchanged | `AssignmentDefinitionPartialSchema.alternateTopics: z.array(z.string())`             | Known topic variants. Empty array when none.                                         |
| 8   | `documentType`        | `string`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.documentType: z.string()`                         | `'SLIDES'` \| `'SHEETS'`. Required — used for polymorphic routing.                   |
| 9   | `referenceDocumentId` | `string\|null`                              | included    | unchanged | `AssignmentDefinitionPartialSchema.referenceDocumentId: z.string().nullable()`       | Reference document ID. Nullable because partial definitions may not have doc IDs.    |
| 10  | `templateDocumentId`  | `string\|null`                              | included    | unchanged | `AssignmentDefinitionPartialSchema.templateDocumentId: z.string().nullable()`        | Template document ID. Nullable for the same reason.                                  |
| 11  | `assignmentWeighting` | `number`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.assignmentWeighting: z.number().nullable()`       | Weighting value 0–10. Defaults to 1 in constructor. Nullable on partial schema.      |
| 12  | `definitionKey`       | `string`                                    | included    | unchanged | `AssignmentDefinitionPartialSchema.definitionKey: TrimmedNonEmptyStringSchema`       | Stable opaque identifier. Generated from metadata tuple if not provided.             |
| 13  | `tasks`               | `Array<{taskId, taskWeighting, taskTitle}>` | included    | unchanged | `AssignmentDefinitionPartialSchema.tasks: z.array(TaskPartialSchema)`                | Array of lightweight task summaries. Empty array when no tasks.                      |
| 14  | `createdAt`           | `string\|null`                              | included    | unchanged | `AssignmentDefinitionPartialSchema.createdAt: NullableIsoDateTimeWithTimezoneSchema` | ISO datetime string. Overridden to now when null.                                    |
| 15  | `updatedAt`           | `string\|null`                              | included    | unchanged | `AssignmentDefinitionPartialSchema.updatedAt: NullableIsoDateTimeWithTimezoneSchema` | ISO datetime string. Defaults to `createdAt` if unset.                               |

Key notes:

- `referenceLastModified` and `templateLastModified` are **intentionally omitted** from the
  partial shape. They are only stored on full definitions.
- `tasks` is always an array in this collection. Full definitions stored in the full cache
  have `tasks` as a keyed object.
- The `PARTIAL_REQUIRED_FIELDS` constant in `assignmentDefinitionValidation.js` lists 18
  required fields — including `referenceLastModified`/`templateLastModified` which the
  transport row validation accepts but `toPartialJSON()` does not emit. Transport validation
  is stricter than emission (defence-in-depth).
- Backward compatibility: `fromJSON()` coerces `tasks: null` (legacy persisted partials) to `[]`.

### Collection: `assdef_full_<definitionKey>` (full cache)

Stored via `AssignmentDefinition.toJSON()`. Keyed by `definitionKey` as a dedicated collection.

| #   | Field                   | Type                             | Persistence | Transport       | Frontend Zod                                                                                                          | Notes                                                                                     |
| --- | ----------------------- | -------------------------------- | ----------- | --------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `primaryTitle`          | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.primaryTitle: TrimmedNonEmptyStringSchema`                                                |                                                                                           |
| 2   | `primaryTopic`          | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.primaryTopic: TrimmedNonEmptyStringSchema`                                                |                                                                                           |
| 3   | `primaryTopicKey`       | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.primaryTopicKey: TrimmedNonEmptyStringSchema`                                             |                                                                                           |
| 4   | `yearGroupKey`          | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.yearGroupKey: TrimmedNonEmptyStringSchema`                                                |                                                                                           |
| 5   | `yearGroupLabel`        | `string\|null`                   | included    | unchanged       | `AssignmentDefinitionSchema.yearGroupLabel: TrimmedNonEmptyStringSchema`                                              |                                                                                           |
| 6   | `alternateTitles`       | `string[]`                       | included    | unchanged       | `AssignmentDefinitionSchema.alternateTitles: z.array(TrimmedNonEmptyStringSchema)`                                    |                                                                                           |
| 7   | `alternateTopics`       | `string[]`                       | included    | unchanged       | `AssignmentDefinitionSchema.alternateTopics: z.array(TrimmedNonEmptyStringSchema)`                                    |                                                                                           |
| 8   | `documentType`          | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.documentType: DocumentTypeSchema` (`z.enum(['SLIDES', 'SHEETS'])`)                        |                                                                                           |
| 9   | `referenceDocumentId`   | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.referenceDocumentId: TrimmedNonEmptyStringSchema`                                         | Required on full definitions (validated by `_validateFull()`).                            |
| 10  | `templateDocumentId`    | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.templateDocumentId: TrimmedNonEmptyStringSchema`                                          | Required on full definitions.                                                             |
| 11  | `referenceLastModified` | `string\|null`                   | included    | **omitted**     | —                                                                                                                     | Stored in full cache for lazy-refresh decisions. Not included in transport response.      |
| 12  | `templateLastModified`  | `string\|null`                   | included    | **omitted**     | —                                                                                                                     | Same as above.                                                                            |
| 13  | `assignmentWeighting`   | `number`                         | included    | unchanged       | `AssignmentDefinitionSchema.assignmentWeighting: WeightingSchema.nullable()` (`z.number().min(0).max(10).nullable()`) | Defaults to 1 in constructor.                                                             |
| 14  | `definitionKey`         | `string`                         | included    | unchanged       | `AssignmentDefinitionSchema.definitionKey: TrimmedNonEmptyStringSchema`                                               |                                                                                           |
| 15  | `tasks`                 | `Record<string, TaskDefinition>` | included    | **transformed** | `AssignmentDefinitionSchema.tasks: z.array(AssignmentDefinitionTaskSchema)`                                           | Persisted as keyed object. Transport transforms to lightweight array via response mapper. |
| 16  | `createdAt`             | `string\|null`                   | included    | unchanged       | `AssignmentDefinitionSchema.createdAt: NullableIsoDateTimeWithTimezoneSchema`                                         |                                                                                           |
| 17  | `updatedAt`             | `string\|null`                   | included    | unchanged       | `AssignmentDefinitionSchema.updatedAt: NullableIsoDateTimeWithTimezoneSchema`                                         |                                                                                           |

Key notes:

- `referenceLastModified` and `templateLastModified` are persisted but **stripped at the
  transport boundary** — the response mapper (`_getFullAssignmentDefinition`) does not include them.
- `tasks` is stored as a `Record<string, TaskDefinition>` keyed object but arrives at
  the frontend as a `Array<{taskId, taskTitle, taskWeighting}>` lightweight array after
  response-mapper transformation.
- `toJSON()` throws `TypeError` if called on a partial instance (where `tasks` is an array).
- The `assignment_definitions` registry row is re-written on every upsert to keep it in sync.

---

## Transport

All endpoints use the shared transport envelope documented in
[`transport-envelope.md`](transport-envelope.md).

### `getAssignmentDefinitionPartials` (read)

Returns the array of assignment-definition partial rows for the definition-list UI.
No parameters required.

| Aspect           | Detail                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/assignmentDefinitionTransport.js` → `getAssignmentDefinitionPartials_()`                                                                                        |
| Controller       | `AssignmentDefinitionController.getAllPartialDefinitions()`                                                                                                                        |
| Response mapper  | `toTransportPartialRow_()` (per-row serialisation)                                                                                                                                 |
| Frontend Zod     | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts` → `AssignmentDefinitionPartialsResponseSchema` (`z.array(AssignmentDefinitionPartialSchema)`) |
| Frontend service | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` → `getAssignmentDefinitionPartials()`                                                      |

**Request:** No parameters.

**Response:** `AssignmentDefinitionPartialSchema[]`

| Field                 | Type            | Required | Notes                                       |
| --------------------- | --------------- | -------- | ------------------------------------------- |
| `primaryTitle`        | `string`        | yes      |                                             |
| `primaryTopic`        | `string`        | yes      | Resolved topic display label.               |
| `primaryTopicKey`     | `string`        | yes      | Authoritative keyed reference.              |
| `yearGroupKey`        | `string`        | yes      |                                             |
| `yearGroupLabel`      | `string`        | yes      |                                             |
| `alternateTitles`     | `string[]`      | yes      |                                             |
| `alternateTopics`     | `string[]`      | yes      |                                             |
| `documentType`        | `string`        | yes      | `'SLIDES'` \| `'SHEETS'`.                   |
| `referenceDocumentId` | `string\|null`  | yes      | Null for partial definitions.               |
| `templateDocumentId`  | `string\|null`  | yes      | Null for partial definitions.               |
| `assignmentWeighting` | `number\|null`  | yes      |                                             |
| `definitionKey`       | `string`        | yes      |                                             |
| `tasks`               | `TaskPartial[]` | yes      | Always an array. Empty array when no tasks. |
| `createdAt`           | `string\|null`  | yes      | ISO datetime string with timezone.          |
| `updatedAt`           | `string\|null`  | yes      | ISO datetime string with timezone.          |

Key contract notes:

- The response is built by calling `toTransportPartialRow_()` on each definition, which calls
  `AssignmentDefinition.toPartialJSON()` then normalises date fields and strips `yearGroup`.
- Transport validation (`validatePartialRow_()`) enforces strict contract: all 18 required
  fields must be present, `definitionKey` and `primaryTopicKey` must be non-empty already-trimmed
  strings, `yearGroupKey`/`yearGroupLabel` must be non-empty strings, `tasks` must be an array,
  and `createdAt`/`updatedAt` must be null or strict ISO datetime strings with timezone info.
- Returns an empty array when no registry documents exist.
- `referenceLastModified` and `templateLastModified` are omitted from the partial transport.
- `DateUtils.normaliseDateFields()` is called on each row to convert `Date` objects to ISO strings
  (required because `google.script.run` prohibits `Date` in return values).

### `getAssignmentDefinition` (read)

Returns one full assignment definition by key, or `null` if not found.

| Aspect           | Detail                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/assignmentDefinitionTransport.js` → `getAssignmentDefinition_()`                                                                     |
| Controller       | `AssignmentDefinitionController.getDefinitionByKey()` → `AssignmentDefinitionController.getFullAssignmentDefinition()`                                  |
| Response mapper  | `AssignmentDefinitionResponseMapper._getFullAssignmentDefinition()`                                                                                     |
| Frontend Zod     | `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts` → `GetAssignmentDefinitionResponseSchema` (= `AssignmentDefinitionSchema`) |
| Frontend service | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts` → `getAssignmentDefinition()`                                           |

**Request:**

| Field           | Type     | Required | Notes                                                                                     |
| --------------- | -------- | -------- | ----------------------------------------------------------------------------------------- |
| `definitionKey` | `string` | yes      | Must be non-empty, already trimmed, no unsafe characters (path traversal, control chars). |

**Response:** `AssignmentDefinitionSchema` or `null`

| Field                 | Type                                        | Required | Notes                                |
| --------------------- | ------------------------------------------- | -------- | ------------------------------------ |
| `definitionKey`       | `string`                                    | yes      |                                      |
| `primaryTitle`        | `string`                                    | yes      |                                      |
| `primaryTopicKey`     | `string`                                    | yes      |                                      |
| `primaryTopic`        | `string`                                    | yes      |                                      |
| `yearGroupKey`        | `string`                                    | yes      |                                      |
| `yearGroupLabel`      | `string`                                    | yes      |                                      |
| `alternateTitles`     | `string[]`                                  | yes      |                                      |
| `alternateTopics`     | `string[]`                                  | yes      |                                      |
| `documentType`        | `'SLIDES'\|'SHEETS'`                        | yes      |                                      |
| `referenceDocumentId` | `string`                                    | yes      |                                      |
| `templateDocumentId`  | `string`                                    | yes      |                                      |
| `assignmentWeighting` | `number\|null`                              | yes      | 0–10 range.                          |
| `tasks`               | `Array<{taskId, taskTitle, taskWeighting}>` | yes      | Lightweight array — see notes below. |
| `createdAt`           | `string\|null`                              | yes      | ISO datetime with timezone.          |
| `updatedAt`           | `string\|null`                              | yes      | ISO datetime with timezone.          |

**Key transformation notes — `tasks` in response:**

The response mapper (`_getFullAssignmentDefinition`) performs the following transformations
on the raw persisted shape:

1. Calls `definition.toJSON()` (if model instance) to get the full persisted shape with
   `tasks` as a `Record<string, TaskDefinition>`.
2. Resolves `yearGroupLabel` from reference data by looking up `yearGroupKey`.
3. Transforms `tasks` from keyed object to lightweight array:
   ```
   tasks: Object.entries(source.tasks)
     .filter(([, task]) => task?.taskWeighting !== null && task?.taskWeighting !== undefined)
     .map(([taskId, task]) => ({
       taskId,
       taskTitle: task.taskTitle,
       taskWeighting: task.taskWeighting,
     }))
   ```
4. Filters out tasks where `taskWeighting` is null or undefined.
5. **Omits** `referenceLastModified` and `templateLastModified` (persisted but not transported).
6. Validates all required fields are non-undefined; throws on missing fields.

Key contract notes:

- The response shape is shared with `upsertAssignmentDefinition` — both read and write
  transports use the same canonical editable entity contract (`AssignmentDefinitionSchema`).
- Returns `null` when no persisted definition exists for the given `definitionKey`.
- `DateUtils.normaliseDateFields()` is called on the response before returning from the handler.

### `upsertAssignmentDefinition` (write)

Creates a new assignment definition or updates an existing one. Supports two mutually
exclusive transport shapes: **URL-shape** (wizard: `referenceDocumentUrl` + `templateDocumentUrl`)
and **ID-shape** (link flow: `referenceDocumentId` + `templateDocumentId` + `documentType`).

| Aspect           | Detail                                                                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/assignmentDefinitionTransport.js` → `upsertAssignmentDefinition_()`                                                                                                                                     |
| Controller       | `AssignmentDefinitionController.upsertDefinition()` → `getFullAssignmentDefinition()`                                                                                                                                      |
| Response mapper  | `AssignmentDefinitionResponseMapper._getFullAssignmentDefinition()`                                                                                                                                                        |
| Frontend Zod     | `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts` → `UpsertAssignmentDefinitionRequestSchema` (request), `UpsertAssignmentDefinitionResponseSchema` (= `AssignmentDefinitionSchema`) (response) |
| Frontend service | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts` → `upsertAssignmentDefinition()`                                                                                                           |

**Request:**

| Field                  | Type                             | Required  | Notes                                                                                                         |
| ---------------------- | -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `definitionKey`        | `string`                         | no        | Absent/null on create. Must be already trimmed on update.                                                     |
| `primaryTitle`         | `string`                         | yes       |                                                                                                               |
| `primaryTopicKey`      | `string`                         | yes       | Must be non-empty, already trimmed, no unsafe characters.                                                     |
| `yearGroupKey`         | `string`                         | yes       | Must be non-null, non-empty, already trimmed, no unsafe characters.                                           |
| `referenceDocumentUrl` | `string`                         | URL-shape | Must be valid `docs.google.com` URL (wizard). Mutually exclusive with ID fields.                              |
| `templateDocumentUrl`  | `string`                         | URL-shape | Must be valid `docs.google.com` URL (wizard). Mutually exclusive with ID fields.                              |
| `referenceDocumentId`  | `string`                         | ID-shape  | Must be a string (link flow). Mutually exclusive with URL fields.                                             |
| `templateDocumentId`   | `string`                         | ID-shape  | Must be a string (link flow). Mutually exclusive with URL fields.                                             |
| `documentType`         | `'SLIDES'\|'SHEETS'`             | ID-shape  | Mutually exclusive with URL fields.                                                                           |
| `alternateTitles`      | `string[]`                       | no        | Array of trimmed non-empty strings. Preserves stored value on update if omitted.                              |
| `alternateTopics`      | `string[]`                       | no        | Same semantics as `alternateTitles`.                                                                          |
| `assignmentWeighting`  | `number\|null`                   | no        | 0–10 range.                                                                                                   |
| `taskWeightings`       | `Array<{taskId, taskWeighting}>` | no        | Array of `{taskId, taskWeighting}` objects. Both fields required per entry. `taskId` must be safe identifier. |

**Forbidden request fields:** None — the request schema is flexible and controller-owned
validation handles business rules (duplicate detection, document-ID mismatch, unknown task IDs).

**Response:** `AssignmentDefinitionSchema` — the same canonical full-definition shape
returned by `getAssignmentDefinition`. Includes resolved `primaryTopic`, stable `definitionKey`,
full `tasks` lightweight array, and all metadata.

Key contract notes:

- URL-to-ID translation: the backend handler calls `extractSupportedDocumentDescriptor_()`
  to parse `referenceDocumentUrl`/`templateDocumentUrl`, producing `documentId` and `documentType`.
  The two URLs must point to different documents of the same type.
- The frontend `UpsertAssignmentDefinitionRequestSchema` enforces a `superRefine` mutual-exclusion
  rule between URL-shape and ID-shape fields. Payloads that include neither, only partial URL fields,
  or only partial ID fields are rejected before reaching the backend.
- Create upserts generate a stable metadata-derived `definitionKey` from
  `(primaryTitle, primaryTopic, yearGroupKey)`.
- Update upserts preserve the existing `definitionKey` even when business metadata changes.
- `documentType` is required by the controller for create upserts; updates may omit it and
  reuse the stored `documentType`.
- `taskWeightings` shape is validated at the transport boundary; numeric weighting semantics
  (range 0–10, defaulting, matching task IDs) are controller-owned domain checks.

**Error states:**

| Error                       | Code              | Notes                                                                                  |
| --------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| Missing required fields     | `INVALID_REQUEST` | Transport validation failure                                                           |
| URL/ID shape violation      | `INVALID_REQUEST` | Mix of URL and ID fields                                                               |
| Same document for both URLs | `INVALID_REQUEST` | `referenceDocumentUrl` and `templateDocumentUrl` must be different                     |
| Mismatched document types   | `INVALID_REQUEST` | Both URLs must resolve to same type                                                    |
| Duplicate business tuple    | `INVALID_REQUEST` | Controller detects duplicate `(primaryTitle, primaryTopicKey, yearGroupKey)` on create |

### `deleteAssignmentDefinition` (write)

Removes both the full cache collection and the registry row for the given definition key.

| Aspect           | Detail                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/assignmentDefinitionTransport.js` → `deleteAssignmentDefinition_()`                                                                                                                                    |
| Controller       | `AssignmentDefinitionController.deleteDefinitionByKey()`                                                                                                                                                                  |
| Response mapper  | — (handler returns void/null)                                                                                                                                                                                             |
| Frontend Zod     | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts` → `DeleteAssignmentDefinitionRequestSchema` (request), `DeleteAssignmentDefinitionResponseSchema` (`z.void().nullable()`) (response) |
| Frontend service | `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts` → `deleteAssignmentDefinition()`                                                                                                  |

**Request:**

| Field           | Type     | Required | Notes                                                                                              |
| --------------- | -------- | -------- | -------------------------------------------------------------------------------------------------- |
| `definitionKey` | `string` | yes      | Must be non-empty, already trimmed, no path-traversal characters (`/`, `\\`, `..`, control chars). |

**Response:** `null` (the frontend schema accepts `z.void().nullable()`, meaning the
envelope data can be `null`).

Key contract notes:

- Both persistence layers are removed: the full collection via `dropCollection(definitionKey)`
  and the registry row via `deleteOne({ definitionKey })`.
- The controller returns a `{ fullDeleted, partialDeleted }` result object, but the handler
  does not return it — `deleteAssignmentDefinition_()` calls the controller and returns
  `undefined`, which the `apiHandler` converts to `null` via `data ?? null`.
- The frontend `DeleteAssignmentDefinitionResponseSchema` is `z.void().nullable()` to match
  this contract.

---

## Sub-entities

### Sub-entity: TaskDefinition

Backend model: `src/backend/Models/TaskDefinition.js`
Frontend Zod:

- Full: `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts` → `AssignmentDefinitionTaskSchema`
- Partial: `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` → `TaskPartialSchema`

`TaskDefinition.toJSON()` emits:

| Field           | Type           | Backend toJSON() | Frontend Zod (full)                                                                           | Frontend Zod (partial)                               | Notes                                                                                                                                                  |
| --------------- | -------------- | ---------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | `string`       | Always emitted   | `AssignmentDefinitionTaskSchema.taskId: TrimmedNonEmptyStringSchema`                          | `TaskPartialSchema.taskId: z.string().min(1)`        | Stable ID derived from `taskTitle`+`pageId` hash (`t_`-prefixed).                                                                                      |
| `taskTitle`     | `string`       | Always emitted   | `AssignmentDefinitionTaskSchema.taskTitle: TrimmedNonEmptyStringSchema`                       | `TaskPartialSchema.taskTitle: z.string().nullable()` | Task title. Nullable in partial shape for legacy/missing titles.                                                                                       |
| `pageId`        | `string\|null` | Always emitted   | — (not in transport schema)                                                                   | —                                                    | Source page ID for the task. Omitted from both frontend schemas.                                                                                       |
| `taskNotes`     | `string\|null` | Always emitted   | —                                                                                             | —                                                    | Optional task notes. Omitted from frontend transport schemas.                                                                                          |
| `taskMetadata`  | `object`       | Always emitted   | —                                                                                             | —                                                    | Optional metadata object. Omitted from frontend transport schemas.                                                                                     |
| `taskWeighting` | `number`       | Always emitted   | `AssignmentDefinitionTaskSchema.taskWeighting: WeightingSchema` (`z.number().min(0).max(10)`) | `TaskPartialSchema.taskWeighting: z.number()`        | Defaults to 1 in constructor. Full schema enforces 0–10 range. Partial schema expects `number` — `null` from legacy records would be rejected.         |
| `index`         | `number\|null` | Always emitted   | —                                                                                             | —                                                    | Positional index. Omitted from frontend transport schemas.                                                                                             |
| `artifacts`     | `Object`       | Always emitted   | —                                                                                             | —                                                    | `{ reference: BaseTaskArtifact[], template: BaseTaskArtifact[] }`. Omitted from frontend transport schemas — only present in full backend persistence. |

`TaskDefinition.toPartialJSON()` emits the same shape as `toJSON()` but with
`artifacts.reference` and `artifacts.template` mapped through `BaseTaskArtifact.toPartialJSON()`
(which redacts `content` and `contentHash` to null).

Key notes:

- The full frontend schema (`AssignmentDefinitionTaskSchema`) is used inside
  `AssignmentDefinitionSchema.tasks` (the array returned by the response mapper).
- The partial frontend schema (`TaskPartialSchema`) is used inside
  `AssignmentDefinitionPartialSchema.tasks` (the registry transport).
- `taskTitle` is nullable in `TaskPartialSchema` to carry legacy or missing titles through
  to the heatmap column (where the table header falls back to `taskId` for display).
- `taskWeighting` is nullable in `TaskPartialSchema` because the backend
  `_computePartialTasks()` may emit `null` when a TaskDefinition has null weighting
  (see [Known discrepancies](#known-discrepancies-between-backend-and-frontend)).

### Sub-entity: BaseTaskArtifact

Backend model: `src/backend/Models/Artifacts/0_BaseTaskArtifact.js`
Subclass: `src/backend/Models/Artifacts/1_TextTaskArtifact.js` (type: `'TEXT'`)
Frontend Zod: — (no independent Zod schema; consumed as nested objects inside assignment schemas)

Base class for all task artifacts. Subclasses override `getType()` and `normalizeContent()`.

`BaseTaskArtifact.toJSON()` emits:

| Field         | Type                  | Backend toJSON() | Notes                                                                          |
| ------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `taskId`      | `string`              | Always emitted   | Parent task ID.                                                                |
| `role`        | `string`              | Always emitted   | One of `'reference'`, `'template'`, `'submission'`.                            |
| `pageId`      | `string\|null`        | Always emitted   | Source page ID.                                                                |
| `documentId`  | `string\|null`        | Always emitted   | Drive document ID.                                                             |
| `content`     | `string\|Array\|null` | Always emitted   | Heavy content payload. Redacted to null in partial.                            |
| `contentHash` | `string\|null`        | Always emitted   | Hash of content for change detection. Redacted to null in partial.             |
| `metadata`    | `object`              | Always emitted   | Arbitrary metadata key-value store.                                            |
| `uid`         | `string`              | Always emitted   | Unique ID: `{taskId}-{taskIndex}-{role}-{pageId}-{artifactIndex}`.             |
| `type`        | `string`              | Always emitted   | Artifact type identifier (e.g. `'TEXT'`, `'base'`). **Not** a Drive MIME type. |

`BaseTaskArtifact.toPartialJSON()` returns the same shape but with `content: null`
and `contentHash: null` (payload redaction for list views).

Key notes:

- BaseTaskArtifact **originates** in the AssignmentDefinition contract (created via
  `TaskDefinition.createArtifact()` and stored in `TaskDefinition.artifacts.{reference,template}`).
- It is **cross-referenced** from the [Contract: Assignment](assignment.md) contract where
  `StudentSubmissionItem.artifact` uses the same shape (with `role: 'submission'`).
- The `type` field identifies the runtime artifact class, not a Drive MIME type. See
  [§ Concrete artifact types](#concrete-artifact-types) below for the full list of known values.
- `content` can be a string, array, or null depending on the artifact type. TextTaskArtifact
  normalises content to a trimmed LF-only string.

#### Concrete artifact types

| `type` value    | Class                     | `normalizeContent()` behaviour                                                                                                                      | Frontend discriminated union content shape                                 |
| --------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `'TEXT'`        | `TextTaskArtifact`        | Returns trimmed LF-only string; null/undefined→null; non-string coerced via `String()`                                                              | `z.string().nullable()`                                                    |
| `'TABLE'`       | `TableTaskArtifact`       | Returns Markdown table string; null→null (logged); string→trimmed string; 2D array→padded rows→Markdown; 50×50 hard limit; throws on limit exceeded | `z.union([z.string(), z.null()])`                                          |
| `'SPREADSHEET'` | `SpreadsheetTaskArtifact` | Returns trimmed 2D array; null→null; string→null; formula strings canonicalised (space-stripped, uppercased); trailing empty rows/cols trimmed      | `z.array(z.array(z.union([z.number(), z.string(), z.null()]))).nullable()` |
| `'IMAGE'`       | `ImageTaskArtifact`       | Returns trimmed string (data URL) or null; null→null; non-string→null; empty→null                                                                   | `z.string().nullable()`                                                    |
| `'base'`        | `BaseTaskArtifact`        | Returns raw content as-is                                                                                                                           | `z.unknown()`                                                              |

Key notes:

- The frontend `BaseTaskArtifactSchema` in `assignmentAssessment.zod.ts` is a `z.discriminatedUnion('type', [...])` — each row above corresponds to one variant in the union.
- The `content` field shape differs per type: `TEXT` uses string, `TABLE` uses a Markdown-formatted string, `SPREADSHEET` uses a 2D array of `(number|string|null)`, `IMAGE` uses a base64 data URL string, `base` uses `unknown`.
- `contentHash` is `string|null` on all full variants and omitted entirely from the partial schema.
- The `ArtifactFactory.create()` dispatches on `type` (uppercased): TEXT→TextTaskArtifact, TABLE→TableTaskArtifact, SPREADSHEET→SpreadsheetTaskArtifact, IMAGE→ImageTaskArtifact, anything else→BaseTaskArtifact (fallback).
- TextTaskArtifact normalises CRLF/CR→LF and trims; SpreadsheetTaskArtifact canonicalises formula strings (strips non-quoted spaces, uppercases); TableTaskArtifact enforces a 50×50 size limit; ImageTaskArtifact provides `setContentFromBlob()` for binary-to-data-URL conversion.
- The partial variant (`BaseTaskArtifactPartialSchema` in `classDetailService.zod.ts`) omits `content` and `contentHash` entirely regardless of type.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts`:
  - `AssignmentDefinitionSchema` — validates the full-definition transport response (`getAssignmentDefinition`, `upsertAssignmentDefinition`).
  - `UpsertAssignmentDefinitionRequestSchema` — validates upsert request payloads with URL-shape vs ID-shape mutual-exclusion `superRefine`.
  - `GetAssignmentDefinitionRequestSchema` — validates `getAssignmentDefinition` request with `TrimmedNonEmptyStringSchema` for `definitionKey`.
  - `AssignmentDefinitionTaskSchema` — validates each task entry in the tasks array (`taskId`, `taskTitle`, `taskWeighting` with 0–10 range).
  - `TaskWeightingInputSchema` — validates `taskWeightings` entries in upsert requests.
- `src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts`:
  - `AssignmentDefinitionPartialSchema` — validates each partial row in `getAssignmentDefinitionPartials` response. Uses `TrimmedNonEmptyStringSchema` for `primaryTopicKey`, `yearGroupKey`, `yearGroupLabel`, `definitionKey`. Expects `referenceDocumentId`/`templateDocumentId` as `z.string().nullable()`.
  - `AssignmentDefinitionPartialsResponseSchema` — `z.array(AssignmentDefinitionPartialSchema)`.
  - `DeleteAssignmentDefinitionRequestSchema` — validates delete request with `SafeDeleteDefinitionKeySchema` (safe key without path traversal/control chars).
  - `DeleteAssignmentDefinitionResponseSchema` — `z.void().nullable()`.
  - **Cross-reference:** `AssignmentDefinitionPartialsResponseSchema` is consumed by
    `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (`AveragingAnalyserInputSchema`)
    where pre-fetched assignment-definition partials serve as cross-reference data for analysis.
- `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts`:
  - `TaskPartialSchema` — validates lightweight task entries in partial transport (`taskId: z.string().min(1)`, `taskWeighting: z.number()`, `taskTitle: z.string().nullable()`).
- `src/frontend/src/services/assignmentDefinition/assignmentTopics.zod.ts`:
  - `AssignmentTopicSchema` — validates topic reference data entries (`key: TrimmedNonEmptyStringSchema`, `name: TrimmedNonEmptyStringSchema`). Note: this schema does **not** include `yearGroupKeys`; see Reference Data contract for the authoritative 3-field schema.

**Backend transport validation:**

- `src/backend/z_Api/assignmentDefinitionValidation.js`:
  - `validateUpsertParameters_()` — validates upsert request: `params` is object, required fields present, `primaryTitle` is string, `primaryTopicKey` is safe trimmed identifier, `referenceDocumentId`/`templateDocumentId` are strings (ID-shape) or URL-shape via `validateWizardUpsertParameters_()`, `definitionKey` is safe trimmed identifier if provided, `taskWeightings` shape validated, `yearGroupKey` validated.
  - `validateWizardUpsertParameters_()` — validates URL-shape upsert: required URL fields, mutual exclusion, URL parsing via `extractSupportedDocumentDescriptor_()`, same-document and same-type checks.
  - `validateReadParameters_()` — validates `getAssignmentDefinition` request: params object, `definitionKey` is safe trimmed identifier.
  - `validateDeleteParameters_()` — validates `deleteAssignmentDefinition` request: params object, `definitionKey` is safe trimmed identifier.
  - `validatePartialRow_()` — validates each partial row in `getAssignmentDefinitionPartials` response: 18 required fields present, `definitionKey`/`primaryTopicKey` validated, `yearGroupKey`/`yearGroupLabel` validated, `createdAt`/`updatedAt` are null or strict ISO datetime strings with timezone, `tasks` is array.
  - `validateRequiredYearGroupKey_()` — validates `yearGroupKey` is present, non-null, safe trimmed identifier.

**Key domain validation rules** (controller-level business logic not visible from schemas):

- `assignmentWeighting` must be a number between 0 and 10 inclusive (model-level enforcement in constructor; defaults to 1 if null/undefined).
- `yearGroupKey` must be a string (model-level enforcement; controller guarantees non-null).
- Duplicate detection: the orchestrator checks for existing definitions with matching `(primaryTitle, primaryTopicKey, yearGroupKey)` tuple on create upserts.
- Document-ID mismatch: the orchestrator validates that `referenceDocumentId` and `templateDocumentId` refer to existing Drive files.
- Unknown task IDs in `taskWeightings` are controller-owned validation: the orchestrator validates that each `taskId` in `taskWeightings` exists in the parsed task map.
- The response mapper throws if `yearGroupKey` cannot be resolved to a valid year-group label.
- The response mapper throws if any required field is `undefined` in the canonical response.
- `deleteAssignmentDefinition` is idempotent: repeated deletes for the same key still succeed.
- The `_validateFull()` method in the model enforces `referenceDocumentId` and `templateDocumentId` are truthy for full definitions (create path). Partial definitions do not require doc IDs.

### Known discrepancies between backend and frontend

1. **`toPartialJSON()` may emit `taskWeighting: null` but `TaskPartialSchema` expects `z.number()`.**
   Backend `AssignmentDefinition._computePartialTasks()` returns `taskWeighting: task.taskWeighting`
   for each task, which can be `null` if a stored TaskDefinition has a null weighting (possible
   from legacy records or `fromJSON` deserialisation). Frontend `TaskPartialSchema` declares
   `taskWeighting: z.number()` which rejects `null`.
   **Classification: Fragile** — currently works because all newly created TaskDefinitions
   default weighting to 1, but legacy records with null weighting would cause a Zod parse error
   in `getAssignmentDefinitionPartials`. The response mapper `_getFullAssignmentDefinition()`
   (used by `getAssignmentDefinition` and `upsertAssignmentDefinition`) filters out null-weighting
   tasks, so the full-definition path is safe. Only the partial path is affected.

2. **`referenceLastModified` and `templateLastModified` exist in persistence but are omitted from transport.**
   Both `toJSON()` and the full cache store these timestamps for lazy-refresh decisions, but
   the response mapper `_getFullAssignmentDefinition()` does not include them. There is no
   frontend Zod field for them.
   **Classification: Aligned** — deliberate design. These fields are internal to the backend
   refresh logic and are not needed on the frontend.

3. **`tasks` is a keyed object in persistence but an array in transport.**
   Backend `toJSON()` returns `tasks` as `Record<string, TaskDefinition>` (keyed object).
   The response mapper `_getFullAssignmentDefinition()` transforms it to a lightweight
   `Array<{taskId, taskTitle, taskWeighting}>`. The frontend `AssignmentDefinitionSchema`
   expects `z.array(AssignmentDefinitionTaskSchema)`.
   Additionally, the transform filters out tasks with null/undefined `taskWeighting`.
   **Classification: Aligned** — the response mapper is the canonical transport-boundary
   transformation. Both sides handle the array shape deliberately.

4. **`DeleteAssignmentDefinitionResponseSchema` is `z.void().nullable()` but backend handler returns `undefined`.**
   The backend handler `deleteAssignmentDefinition_()` calls the controller and returns
   `undefined`. The `apiHandler` converts this to `null` via `data ?? null`. The frontend
   schema accepts both `void` and `null`.
   **Classification: Aligned** — documented contract via the transport envelope.

5. **`primaryTitle` uses `z.string()` in partial schema but `TrimmedNonEmptyStringSchema` in full schema.**
   `AssignmentDefinitionPartialSchema` uses `z.string()` for `primaryTitle`, `primaryTopic`,
   `alternateTitles`, `alternateTopics`, and `documentType`, while the full
   `AssignmentDefinitionSchema` uses `TrimmedNonEmptyStringSchema` for `primaryTitle`,
   `primaryTopic`, and `DocumentTypeSchema` for `documentType`.
   **Classification: Aligned** — both accept the backend output; the partial schema is
   deliberately more permissive to tolerate registry data.

6. **`AssignmentDefinitionPartialSchema` uses `z.array(z.string())` for `alternateTitles`/`alternateTopics` while full schema uses `z.array(TrimmedNonEmptyStringSchema)`.**
   Same pattern as above: partial is more permissive.
   **Classification: Aligned** — no risk of breakage.

---

## File Index

```
Persistence model:         src/backend/Models/AssignmentDefinition.js
  └── AssignmentDefinition.toJSON()          — full definition shape (tasks as keyed object)
  └── AssignmentDefinition.toPartialJSON()   — partial registry shape (tasks as array)
  └── AssignmentDefinition.fromJSON()        — deserialisation (coerces tasks: null → [])
  └── AssignmentDefinition.buildDefinitionKey() — metadata-derived key generation
  └── AssignmentDefinition._computePartialTasks() — partial tasks array computation

TaskDefinition model:      src/backend/Models/TaskDefinition.js
  └── TaskDefinition.toJSON()               — full task shape with artifacts
  └── TaskDefinition.toPartialJSON()        — partial task shape with redacted artifacts
  └── TaskDefinition.fromJSON()             — deserialisation
  └── TaskDefinition.createArtifact()       — artifact creation delegating to ArtifactFactory

BaseTaskArtifact model:    src/backend/Models/Artifacts/0_BaseTaskArtifact.js
  └── BaseTaskArtifact.toJSON()             — full artifact shape with content
  └── BaseTaskArtifact.toPartialJSON()      — partial artifact shape (content/contentHash = null)
  └── BaseTaskArtifact.baseFromJSON()       — deserialisation

TextTaskArtifact model:    src/backend/Models/Artifacts/1_TextTaskArtifact.js
  └── TextTaskArtifact.getType()            — returns 'TEXT'
  └── TextTaskArtifact.normalizeContent()   — LF-only, trimmed string

Controller:                src/backend/y_controllers/AssignmentDefinition/
  ├── index.js                              — AssignmentDefinitionController facade
  ├── AssignmentDefinitionValidation.js      — Domain validation
  ├── AssignmentDefinitionReferenceData.js   — Reference data resolution
  ├── AssignmentDefinitionTaskParser.js      — Task document parsing
  ├── AssignmentDefinitionTaskWeighting.js   — Task weighting logic
  ├── AssignmentDefinitionPersistence.js     — Database read/write
  ├── AssignmentDefinitionUpsertOrchestrator.js — Upsert orchestration
  └── AssignmentDefinitionResponseMapper.js  — _getFullAssignmentDefinition()

API handlers:              src/backend/z_Api/
  ├── assignmentDefinitionTransport.js       — getAssignmentDefinitionPartials_(),
  │                                             getAssignmentDefinition_(),
  │                                             upsertAssignmentDefinition_(),
  │                                             deleteAssignmentDefinition_()
  └── assignmentDefinitionValidation.js      — validateUpsertParameters_(),
                                                validateReadParameters_(),
                                                validateDeleteParameters_(),
                                                validatePartialRow_(),
                                                toTransportPartialRow_()

Transport envelope:        src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts
  │     → AssignmentDefinitionSchema, AssignmentDefinitionTaskSchema,
  │       TaskWeightingInputSchema, UpsertAssignmentDefinitionRequestSchema,
  │       UpsertAssignmentDefinitionResponseSchema, GetAssignmentDefinitionRequestSchema,
  │       GetAssignmentDefinitionResponseSchema
  ├── src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts
  │     → getAssignmentDefinition(), upsertAssignmentDefinition()
  ├── src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts
  │     → AssignmentDefinitionPartialSchema, AssignmentDefinitionPartialsResponseSchema,
  │       DeleteAssignmentDefinitionRequestSchema, DeleteAssignmentDefinitionResponseSchema,
  │       NullableIsoDateTimeWithTimezoneSchema, IsoDateTimeWithTimezoneSchema
  ├── src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartialsService.ts
  │     → getAssignmentDefinitionPartials(), deleteAssignmentDefinition()
  ├── src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts
  │     → TaskPartialSchema
  └── src/frontend/src/services/assignmentDefinition/assignmentTopics.zod.ts
        → AssignmentTopicSchema, AssignmentTopicsResponseSchema
```
