# Contract: ABClass

Root domain object for all data about a single Google Classroom course.
Contains class configuration, assessment-summary metadata, students, teachers and embedded
assignments.

Backend model: `src/backend/Models/ABClass.js`
Metadata domain owner: `src/backend/Models/ABClassMetadata.js`
Collections: per-class collections named by `classId` (main documents), `abclass_partials` (fixed registry, keyed by `classId`)
API handlers: `src/backend/z_Api/abclass/abclassRead.js`, `src/backend/z_Api/abclass/abclassMutations.js`
Response mapper: `src/backend/y_controllers/ABClassController/ABClassResponseMapper.js`
Frontend service: `src/frontend/src/services/googleClassrooms/classPartialsService.ts`, `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts`, `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — Assignment definitions are embedded inside ABClass's `assignments` array (as `assignmentDefinitionKey` in transport) and referenced for resolution.
- [Contract: Assignment](assignment.md) — Assignment partials are embedded inside ABClass's `assignments` array.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — ABClass references `cohortKey` and `yearGroupKey` which resolve to Cohorts and YearGroups respectively.
- [Transport envelope](transport-envelope.md) — ABClass API payloads use the shared `apiHandler` envelope; this contract documents only the inner payload.

---

## Persistence

ABClass uses a split persistence model: a main document stored in a per-class collection
named by `classId` and written via `ABClass.toJSON()`, plus a lightweight fixed registry
`abclass_partials` written via `ABClass.toPartialJSON()`.

### Collection: per-class, named by `classId` (main document)

Stored via `ABClass.toJSON()`.

| #   | Field          | Type              | Persistence                      | Transport   | Frontend Zod                                                    | Notes                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------- | ----------------- | -------------------------------- | ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`          | included                         | unchanged   | `ClassFullSchema.classId: z.string()`                           | Google Classroom course ID. Required, never null.                                                                                                                                                                                                                                                                                         |
| 2   | `className`    | `string\|null`    | included                         | unchanged   | `ClassFullSchema.className: z.string().nullable()`              | Derived from Google Classroom on write path. Null when unset.                                                                                                                                                                                                                                                                             |
| 3   | `cohortKey`    | `string\|null`    | included                         | unchanged   | `ClassFullSchema.cohortKey: z.string().nullable()`              | User-managed. `null` when unset.                                                                                                                                                                                                                                                                                                          |
| 4   | `courseLength` | `number`          | included                         | unchanged   | `ClassFullSchema.courseLength: z.number()`                      | Integer ≥ 1. Default 1 in constructor.                                                                                                                                                                                                                                                                                                    |
| 5   | `yearGroupKey` | `string\|null`    | included                         | unchanged   | `ClassFullSchema.yearGroupKey: z.string().nullable()`           | User-managed. `null` when unset.                                                                                                                                                                                                                                                                                                          |
| 6   | `classOwner`   | `Object\|null`    | included                         | unchanged   | `ClassFullSchema.classOwner: TeacherSummarySchema.nullable()`   | Teacher summary object (see [§ Sub-entities Teacher](#sub-entity-teacher)). Null when unset.                                                                                                                                                                                                                                              |
| 7   | `teachers`     | `Array`           | included                         | unchanged   | `ClassFullSchema.teachers: z.array(TeacherSummarySchema)`       | Array of Teacher summary objects. Empty array when no teachers.                                                                                                                                                                                                                                                                           |
| 8   | `students`     | `Array`           | included                         | unchanged   | `ClassFullSchema.students: z.array(StudentSummarySchema)`       | Array of Student objects (see [§ Sub-entities Student](#sub-entity-student)). Empty array when no students.                                                                                                                                                                                                                               |
| 9   | `assignments`  | `Array`           | included                         | transformed | `ClassFullSchema.assignments: z.array(AssignmentPartialSchema)` | Embedded assignments (see [§ Transport getABClass](#getabclass-read)). `toJSON()` serialises each by its existing definition representation: a partial definition (task-summary array) serialises via `toPartialJSON()`, a genuine full definition keeps full `toJSON()`. Non-empty in normal persisted classes; not a fixed empty array. |
| 10  | `active`       | `boolean\|null`   | included (`this.active ?? null`) | unchanged   | `ClassFullSchema.active: z.boolean().nullable()`                | Tri-state: `true` (active), `false` (inactive), `null` (unknown/unset).                                                                                                                                                                                                                                                                   |
| 11  | `metadata`     | `ABClassMetadata` | included by `toJSON()`           | included    | —                                                               | Whole-class and selective editable persistence prepare detached copies before writing (Section 5); the full read view emits validated, detached metadata (Section 6). Upsert/update requests validate and replace it wholly, and only a request-provenance typed failure becomes `INVALID_REQUEST` at the transport (Sections 7–8).       |

Key notes:

- `students` and `assignments` arrays are fully stored in this collection but are heavy,
  so the partials registry exists for list-view performance.
- `assignments` serialisation is representation-aware
  (`ABClass._serialiseAssignmentsForClass()`): an embedded assignment whose definition carries a
  task-summary array (partial definition) keeps its redacted `toPartialJSON()` output, while a
  genuine full assignment keeps full `toJSON()` output and its serializer errors propagate
  unchanged. Standalone `Assignment`/`AssignmentDefinition.toJSON()` remains strict (partial
  definitions still throw). The class serializer performs no fetch, definition fabrication or
  assignment removal, adds no second serializer and uses no catch-and-fallback.
- Class-embedded assignments are normally partial-hydration instances; fully hydrated records live
  in separate `assign_full_*` collections. Whatever representation the model currently holds is
  what `toJSON()` writes.
- `progressTracker` and `_hydrationLevel` are runtime-only flags and never persisted.
- `active` default: `null` (tri-state). Only creation flows explicitly set it.

### Collection: `abclass_partials` (registry)

Stored via `ABClass.toPartialJSON()`.

| #   | Field          | Type              | Persistence                      | Transport | Frontend Zod                                                     | Notes                                                                                                                                                                                                                                                                                                                         |
| --- | -------------- | ----------------- | -------------------------------- | --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`      | `string`          | included                         | unchanged | `ClassPartialSchema.classId: z.string()`                         | Google Classroom course ID.                                                                                                                                                                                                                                                                                                   |
| 2   | `className`    | `string\|null`    | included                         | unchanged | `ClassPartialSchema.className: z.string().nullable()`            | Null when unset.                                                                                                                                                                                                                                                                                                              |
| 3   | `cohortKey`    | `string\|null`    | included                         | unchanged | `ClassPartialSchema.cohortKey: z.string().nullable()`            | Null when unset.                                                                                                                                                                                                                                                                                                              |
| 4   | `courseLength` | `number`          | included                         | unchanged | `ClassPartialSchema.courseLength: z.number()`                    | Integer ≥ 1.                                                                                                                                                                                                                                                                                                                  |
| 5   | `yearGroupKey` | `string\|null`    | included                         | unchanged | `ClassPartialSchema.yearGroupKey: z.string().nullable()`         | Null when unset.                                                                                                                                                                                                                                                                                                              |
| 6   | `classOwner`   | `Object\|null`    | included                         | unchanged | `ClassPartialSchema.classOwner: TeacherSummarySchema.nullable()` | Teacher summary. Null when unset.                                                                                                                                                                                                                                                                                             |
| 7   | `teachers`     | `Array`           | included                         | unchanged | `ClassPartialSchema.teachers: z.array(TeacherSummarySchema)`     | Teacher summary objects.                                                                                                                                                                                                                                                                                                      |
| 8   | `active`       | `boolean\|null`   | included (`this.active ?? null`) | unchanged | `ClassPartialSchema.active: z.boolean().nullable()`              | Tri-state.                                                                                                                                                                                                                                                                                                                    |
| 9   | `metadata`     | `ABClassMetadata` | included by `toPartialJSON()`    | included  | —                                                                | Whole-class writes prepare a detached partial copy before the full-store mutation; a field-scoped roster patch never touches stored metadata (Section 5). Reads emit it (Section 6); upsert/update requests replace it wholly, with request-provenance failures adapted to `INVALID_REQUEST` at the transport (Sections 7–8). |

Key notes:

- `students` and `assignments` are **intentionally excluded** from the partial shape.
  This is the defining difference between the main document and the registry.
- Derived display fields such as `cohortLabel` and `yearGroupLabel` are intentionally
  excluded from backend transport; frontend view-models derive them from reference-data
  maps.
- `active` preserves tri-state semantics: `true` (active), `false` (inactive), `null`
  (unknown/unset).
- Storage-only fields (such as `_id` from the database) are stripped by the response
  mapper during normalisation.

---

## Transport

### `getABClassPartials` (read)

Returns the array of normalised class partials for the class-list UI.

| Aspect           | Detail                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassRead.js`                                                                                        |
| Controller       | `ABClassController.getAllClassPartials()`                                                                                         |
| Response mapper  | `ABClassResponseMapper._normaliseClassPartial()` (per-row), `_buildClassSummary()`                                                |
| Frontend Zod     | `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` → `ClassPartialsResponseSchema` (`z.array(ClassPartialSchema)`) |
| Frontend service | `src/frontend/src/services/googleClassrooms/classPartialsService.ts` → `getABClassPartials()`                                     |

**Request:** No parameters.

**Response:** `ClassPartialSchema[]`

| Field          | Type                    | Required | Notes                            |
| -------------- | ----------------------- | -------- | -------------------------------- |
| `classId`      | `string`                | yes      |                                  |
| `className`    | `string\|null`          | yes      | `null` when unset                |
| `cohortKey`    | `string\|null`          | yes      | `null` when unset                |
| `courseLength` | `number`                | yes      | Integer ≥ 1                      |
| `yearGroupKey` | `string\|null`          | yes      | `null` when unset                |
| `classOwner`   | `TeacherSummary\|null`  | yes      | Teacher summary object or `null` |
| `teachers`     | `TeacherSummary[]`      | yes      | May be empty array               |
| `active`       | `boolean\|null`         | yes      | Tri-state                        |
| `metadata`     | `ABClassMetadata\|null` | yes      | Validated; `null` when absent    |

Key contract notes:

- The response is built by `ABClassController.getAllClassPartials()`, which reads only
  `abclass_partials` and normalises each stored row through `_normaliseClassPartial()`.
- `_normaliseClassPartial()` is the normalisation gate: it strips any storage-only
  fields (e.g. `_id`) and ensures `className`, `cohortKey`, `yearGroupKey`,
  `classOwner`, and `active` use `?? null` defaulting.
- `_normaliseClassPartial()` is also the single stored-partial metadata gate. It
  distinguishes actual `metadata` absence (normalised to `null` through
  `ABClassMetadata`) from a present value, which it validates and defensively copies.
  Present invalid metadata fails the request as an integrity error rather than dropping
  the row or falling back to a full-class read. Its reuse by `_buildClassSummary()`
  covers mutation summaries, so `getAllClassPartials()` adds no duplicate metadata pass.
- Returns an empty array when no partial documents exist.
- This endpoint does **not** pass through `DateUtils.deepConvertDates()`. `metadata`
  timestamps are validated canonical strings, not live `Date` objects, so no additional
  conversion is required, and `ABClass.toPartialJSON()` otherwise contains no Date objects.
- Reads never write and never backfill; a legacy row without the field is projected as
  explicit `null`.

### `getABClass` (read)

Returns the full class document with assignments as partial summaries.

| Aspect           | Detail                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassRead.js` → `getABClass_()`                                                                                  |
| Controller       | `ABClassController.readClass()`                                                                                                               |
| Response mapper  | `ABClassResponseMapper._toReadView()`                                                                                                         |
| Frontend Zod     | `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `ClassFullResponseSchema` (`ClassFullSchema.nullable()`) |
| Frontend service | `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` → `getABClass()`                                               |

**Request:**

| Field     | Type     | Required | Notes                                               |
| --------- | -------- | -------- | --------------------------------------------------- |
| `classId` | `string` | yes      | Must be non-empty, already trimmed, no unsafe chars |

**Response:** `ClassFullSchema` or `null`

| Field          | Type                    | Required | Notes                                                             |
| -------------- | ----------------------- | -------- | ----------------------------------------------------------------- |
| `classId`      | `string`                | yes      |                                                                   |
| `className`    | `string\|null`          | yes      |                                                                   |
| `cohortKey`    | `string\|null`          | yes      |                                                                   |
| `courseLength` | `number`                | yes      |                                                                   |
| `yearGroupKey` | `string\|null`          | yes      |                                                                   |
| `classOwner`   | `TeacherSummary\|null`  | yes      |                                                                   |
| `teachers`     | `TeacherSummary[]`      | yes      |                                                                   |
| `students`     | `StudentSummary[]`      | yes      | Plain objects: `{ name, email, id }`                              |
| `assignments`  | `AssignmentPartial[]`   | yes      | Array of partial assignment summaries (see assignment view below) |
| `active`       | `boolean\|null`         | yes      | Tri-state                                                         |
| `metadata`     | `ABClassMetadata\|null` | yes      | Validated; `null` when absent                                     |

**`assignments[]` entry (AssignmentPartial shape):**

| Field                     | Type                         | Required                                | Notes                                                                                                                                           |
| ------------------------- | ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `courseId`                | `string`                     | yes (backend) / stripped (frontend Zod) | Present in wire format but stripped by `ClassFullSchema` (Zod `.strip()` default).                                                              |
| `assignmentId`            | `string`                     | yes                                     |                                                                                                                                                 |
| `assignmentName`          | `string`                     | yes (backend) / stripped (frontend Zod) | Present in wire format but stripped by `ClassFullSchema`.                                                                                       |
| `dueDate`                 | `string\|null`               | no (optional)                           | ISO 8601 string or `null`. Zod: `.nullable().optional()`                                                                                        |
| `updatedAt`               | `string\|null`               | yes                                     | ISO 8601 string or `null`.                                                                                                                      |
| `createdAt`               | `string`                     | yes                                     | ISO 8601 string.                                                                                                                                |
| `documentType`            | `string\|null`               | yes                                     | `'SLIDES'` \| `'SHEETS'` or `null`.                                                                                                             |
| `submissions`             | `StudentSubmissionPartial[]` | yes                                     | Array of partial submission objects (see [Contract: Assignment](assignment.md) for full shape).                                                 |
| `assignmentDefinitionKey` | `string`                     | yes                                     | Replaces embedded `assignmentDefinition` object. The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry. |

Key contract notes:

- The response is built by `ABClassResponseMapper._toReadView()`, which:
  1. Calls `assignment.toPartialJSON()` on each assignment to get the lightweight shape.
  2. Strips `_hydrationLevel` and `progressTracker` as defence-in-depth.
  3. Replaces the embedded `assignmentDefinition` object with `assignmentDefinitionKey`
     (extracted from `definitionKey` of the stored definition). This prevents serialisation
     failures when the stored definition is partial (tasks stored as an array).
- `_toReadView()` includes `metadata` by revalidating and defensively copying the mutable
  model state through `ABClassMetadata`. Present invalid stored metadata fails the read as
  an integrity error — it is not dropped, repaired or replaced — while absent or legacy
  `null` metadata becomes explicit `null`. Reads perform no writes.
- All assignments in the response carry partial-hydration data (artifact `content` is `null`,
  assessment `reasoning` is stripped).
- `DateUtils.deepConvertDates()` is called on the entire response before returning from
  the handler. This is required because `google.script.run` prohibits `Date` objects in
  return values (including nested objects). `metadata` timestamps are already canonical
  strings, so this conversion only affects the other ABClass fields.
- Returns `null` when no persisted class document exists for the given `classId`
  (`ClassNotFoundError` caught at the transport boundary).

### `upsertABClass` (write)

Creates a new class or updates an existing one. Always refreshes Google-derived roster data.

| Aspect           | Detail                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `upsertABClass_()` |
| Controller       | `ABClassController.upsertABClass()`                                  |
| Response mapper  | `ABClassResponseMapper._buildClassSummary()`                         |
| Frontend Zod     | `ClassPartialSchema` (response validated via class partials flow)    |
| Frontend service | (Called via generic `callApi` in class management flows)             |

**Request:**

| Field          | Type                    | Required | Notes                                       |
| -------------- | ----------------------- | -------- | ------------------------------------------- |
| `classId`      | `string`                | yes      | No unsafe path characters (`..`, `/`, `\\`) |
| `cohortKey`    | `string`                | yes      |                                             |
| `yearGroupKey` | `string`                | yes      |                                             |
| `courseLength` | `number`                | yes      | Must be integer ≥ 1                         |
| `metadata`     | `ABClassMetadata\|null` | no       | Optional whole-snapshot replacement         |

**Response:** `ClassPartialSchema` (partial class summary — no students or assignments)

Key contract notes:

- The controller hydrates `classOwner`, `teachers`, and `students` from Google Classroom
  before persisting. `students` is persisted in the main document only (not returned).
- When the class already exists, the controller preserves existing `assignments` while
  refreshing roster data.
- New-class upsert paths set `active` to `true`.
- The response is the partial class summary (no `students` or `assignments`). It now
  includes validated, detached `metadata` from `_buildClassSummary()`.
- `metadata` is an optional whole-value replacement: true omission preserves an existing
  snapshot (and initialises `null` for a new class), explicit `null` clears it, and a
  complete object replaces it entirely. A supplied own `undefined` or any invalid value is
  rejected before any record read, roster refresh or write. Nested partial objects are
  invalid, not patches.
- Only a request-provenance metadata failure adapts to a non-retriable `INVALID_REQUEST`
  envelope with the field path in `error.message`; no `fieldName`/`details` field is added
  (Section 8). Stored/model corruption and unrelated exceptions stay generic
  `INTERNAL_ERROR`.

### `updateABClass` (write)

Patches editable fields on an existing class. Does **not** refresh Google-derived roster data.

| Aspect           | Detail                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `updateABClass_()` |
| Controller       | `ABClassController.updateABClass()`                                  |
| Response mapper  | `ABClassResponseMapper._buildClassSummary()`                         |
| Frontend Zod     | `ClassPartialSchema`                                                 |
| Frontend service | (Called via generic `callApi` in class management flows)             |

**Request:**

| Field          | Type                    | Required | Notes                                              |
| -------------- | ----------------------- | -------- | -------------------------------------------------- |
| `classId`      | `string`                | yes      | No unsafe path characters                          |
| `cohortKey`    | `string`                | no       | Optional patch field                               |
| `yearGroupKey` | `string`                | no       | Optional patch field                               |
| `courseLength` | `number`                | no       | Must be integer ≥ 1 if supplied                    |
| `active`       | `boolean\|null`         | no       | Optional patch field. `null` is an explicit value. |
| `metadata`     | `ABClassMetadata\|null` | no       | Optional whole-snapshot replacement; `null` clears |

**Forbidden request fields:** `classOwner`, `teachers`, `students`, `assignments` —
all cause `ApiValidationError` with `INVALID_REQUEST`.

**Response:** `ClassPartialSchema`

Key contract notes:

- Only supplied patch fields are updated. Omitted fields retain their stored values.
- `metadata` is an additional optional editable field: true omission preserves the stored
  snapshot, explicit `null` clears it, and a complete object replaces it entirely. Nested
  partial objects are invalid, not patches. An invalid mixed patch is rejected before any
  field is applied, and the request-origin failure adapts to the same non-retriable
  `INVALID_REQUEST` envelope as `upsertABClass` (Section 8).
- The returned summary includes validated, detached `metadata`.
- Throws `RangeError` (maps to `INTERNAL_ERROR`) when the class does not exist — this
  is **not** an upsert path.

### `deleteABClass` (write)

Removes both the main class document and the partial registry entry.

| Aspect           | Detail                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Backend handler  | `src/backend/z_Api/abclass/abclassMutations.js` → `deleteABClass_()` |
| Controller       | `ABClassController.deleteABClass()`                                  |
| Response mapper  | — (controller returns plain object)                                  |
| Frontend Zod     | —                                                                    |
| Frontend service | (Called via generic `callApi`)                                       |

**Request:**

| Field     | Type     | Required | Notes                     |
| --------- | -------- | -------- | ------------------------- |
| `classId` | `string` | yes      | No unsafe path characters |

**Error states:**

| Error              | Code              | Notes                                                                                                             |
| ------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Absent stores      | — (success)       | Deleting a class whose full collection and/or registry row are already absent still succeeds; it is not an error. |
| Parameters invalid | `INVALID_REQUEST` | Missing/wrong type `classId`.                                                                                     |

**Response:**

| Field                    | Type      | Required | Notes                                                                                                                                               |
| ------------------------ | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classId`                | `string`  | yes      |                                                                                                                                                     |
| `hasDeletedFullClass`    | `boolean` | yes      | `true` after any non-throwing `dropCollection(classId)`, including the vendor's `false` return for an absent collection (see the flag quirk below). |
| `hasDeletedClassPartial` | `boolean` | yes      | `true` only when a registry row existed and was removed; `false` when it was already absent.                                                        |

Key contract notes:

- Both persistence layers are removed: the per-class full collection via `dropCollection(classId)`
  and the `abclass_partials` registry row via `deleteOne({ classId })`.
- Repeated deletes are idempotent and always succeed. Deleting stores that do not exist never
  produces a class-not-found error; there is no absent-record failure path.
- A missing registry row yields `hasDeletedClassPartial: false`.
- **Full-flag quirk (current behaviour, deliberately not fixed here):** `deleteABClass` sets
  `hasDeletedFullClass: true` after any non-throwing `dropCollection(classId)` call. The flag is
  only left `false` on the recognised missing-collection exception (`code === 'COLLECTION_NOT_FOUND'`),
  but the vendor's ordinary absent-collection path returns `false` rather than throwing. Every
  non-throwing delete therefore reports `hasDeletedFullClass: true`, including a nominal repeated
  delete of an already-absent collection, so the flag does not prove a collection was removed.
  Correcting this to honour the vendor's boolean return is an explicitly deferred future change
  tracked in [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332); this cycle
  documents the quirk and does not change deletion behaviour.
- The response does not use `ClassPartialSchema`; it is a plain `{ classId, hasDeletedFullClass, hasDeletedClassPartial }` object.

---

## Sub-entities

### Sub-entity: Teacher

Backend model: `src/backend/Models/Teacher.js`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classPartials.zod.ts` → `TeacherSummarySchema`

`Teacher.toJSON()` emits:

| Field         | Type           | Backend toJSON()              | Frontend Zod                                                          | Notes                                                                                                                                                                                             |
| ------------- | -------------- | ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`       | `string\|null` | Always emitted                | `z.string().nullable()`                                               | Null when email is unset on the model.                                                                                                                                                            |
| `userId`      | `string\|null` | Always emitted                | `z.string().nullable()`                                               | Google userId. Null when unset.                                                                                                                                                                   |
| `teacherName` | `string\|null` | Always emitted (own property) | `z.string().nullable().optional().transform((value = null) => value)` | Always present, including explicit `null` when unset; uses the constructor-owned `null` state. The frontend schema remains `.optional()`/nullable and also accepts legacy rows that omit the key. |

Key notes:

- `Teacher.toJSON()` always emits its own `teacherName` property; an unset name uses the
  constructor-owned `null` value, never a serialiser-time default. This applies to every `Teacher`
  instance serialised through this helper, including ABClass `classOwner`, `teachers[]` entries and
  roster refreshes.
- The always-present guarantee attaches to `Teacher` instances. Legacy plain-object `teachers[]`
  entries are neither hydrated nor migrated: they pass through `ABClass.serialiseOwner()` /
  `ArrayUtils.serialiseArray()` unchanged until actually replaced by a `Teacher` instance, so a raw
  legacy row may still omit the key.
- `Teacher.fromJSON()`, the constructor and the setters are unchanged. It detects `teacherName` in
  the JSON via `'teacherName' in json` and only sets it when present, so legacy input with no
  `teacherName` restores with the constructor-owned `null` value and then serialises with an
  explicit `teacherName: null`.
- `TeacherSummarySchema` is unchanged and remains `.nullable().optional().transform(...)`, so it
  accepts both legacy absence and the new explicit `null`. No second default, raw-registry rewrite
  or eager migration is introduced.

### Sub-entity: Student

Backend model: `src/backend/Models/Student.js`
Frontend Zod: `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `StudentSummarySchema`

`Student.toJSON()` emits:

| Field   | Type     | Backend toJSON() | Frontend Zod | Notes                                      |
| ------- | -------- | ---------------- | ------------ | ------------------------------------------ |
| `name`  | `string` | Always emitted   | `z.string()` | Student's full name.                       |
| `email` | `string` | Always emitted   | `z.string()` | Student's email address.                   |
| `id`    | `string` | Always emitted   | `z.string()` | Student's unique ID from Google Classroom. |

Key notes:

- Student fields are all required and never null. The constructor does not accept null
  values for any field.

### Sub-entity: AssignmentPartial (embedded via transport)

The ABClass transport embeds partial assignment objects (see `AssignmentPartialSchema`
in the [getABClass transport](#getabclass-read) section above). The full contract
for Assignment is documented in [Contract: Assignment](assignment.md).

### Sub-entity: StudentSubmissionPartial (embedded via transport)

Partial submission objects appear inside `assignments[].submissions`. The full
contract for StudentSubmission is documented in [Contract: Assignment](assignment.md).

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/googleClassrooms/classPartials.zod.ts`:
  - `ClassPartialSchema` — validates the `getABClassPartials` response array entries.
  - `ClassPartialsResponseSchema` — `z.array(ClassPartialSchema)`.
  - `TeacherSummarySchema` — validates teacher summary objects (classOwner, teachers entries).
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `ClassFullSchema` — validates the `getABClass` response.
  - `ClassFullResponseSchema` — `ClassFullSchema.nullable()` (handles null for not-found).
  - `StudentSummarySchema` — validates student objects.
  - `AssignmentPartialSchema` — validates each assignment entry.
  - `TeacherSummarySchema` — duplicated from `classPartials.zod.ts` for self-contained validation.
  - **Cross-reference:** `ClassFullSchema` is consumed by
    `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (`AveragingAnalyserInputSchema`)
    where pre-fetched full class documents serve as the primary data source for analysis.

**Backend transport validation:**

- `src/backend/z_Api/abclass/abclassRead.js`:
  - `validateParametersObject_(parameters, 'getABClass')` — validates parameters is a plain object.
  - `validateIdentifier_(classId, 'classId')` — validates classId is a non-empty string, already trimmed, and contains no unsafe characters.
- `src/backend/z_Api/abclass/abclassValidation.js`:
  - `validateParametersObject_()` — shared primitive for all abclass endpoints.
- `src/backend/z_Api/abclass/abclassMutations.js`:
  - `validateMutationClassId_(classId, methodName)` — checks for unsafe path characters (`..`, `/`, `\\`).
  - `validateUpsertABClassParameters_()` — validates parameters object and classId.
  - `validateUpdateABClassParameters_()` — validates parameters object, classId, and forbids protected fields (`classOwner`, `teachers`, `students`, `assignments`).
  - `validateDeleteABClassParameters_()` — validates parameters object and classId.

**Key domain validation rules:**

- `cohortKey` and `yearGroupKey` must be present on upsertABClass requests.
- `courseLength` must be a positive safe integer on validated upsertABClass and updateABClass writes (`1` through `Number.MAX_SAFE_INTEGER`). Unsafe numeric values are rejected rather than accepted after precision has been lost.
- Constructor and `fromJSON` normalisation retain the existing course-length fallback of `1`; roster initialisation retains its existing current-value fallback. `_parseNullableInt` checks both numeric input magnitudes and parsed results for safety. Existing prefix parsing of safe values is unchanged (for example, `'3years'` becomes `3` and the string `'1e21'` becomes `1`); an unsafe numeric `1e21` takes the fallback before parsing.
- On updateABClass, `active` must be a boolean or null.
- `classOwner`, `teachers`, `students`, `assignments` are forbidden in updateABClass requests.
- The response mapper (`_normaliseClassPartial`) throws `TypeError` if a partial document is not a plain object or lacks an array `teachers` field.
- ABClass model construction, restoration, explicit metadata replacement and both serializers enforce the shared strict metadata-domain contract. The response mappers (`_normaliseClassPartial()`, `_buildClassSummary()`, `_toReadView()`) project validated, detached `metadata` on partial-list, mutation-summary and full-read responses (Section 6). `ABClassValidation._validateRequestMetadata()` now validates explicitly supplied request `metadata` before any read/roster/write and tags only those failures with request provenance (Section 7). The transport boundary (`abclassMutations.js` → `adaptMetadataRequestError_`) adapts only a request-provenance typed metadata failure to `ApiValidationError`/`INVALID_REQUEST`; stored/model, projection, persistence, upstream and wiring failures remain generic `INTERNAL_ERROR` (Section 8).

### Known discrepancies

1. **`getABClass` transport includes `courseId` and `assignmentName` on each assignment.**
   Frontend `AssignmentPartialSchema` does not include these fields (Zod `.strip()` mode
   silently removes them). The frontend resolves assignment context (courseId, name)
   from other sources.
   **Classification: Aligned** — Zod's default `.strip()` behaviour means extra fields
   are tolerated, and the stripped data is unused by the frontend. No risk of breakage.

2. **`ClassFullResponseSchema` is `ClassFullSchema.nullable()`**
   The backend returns `null` when the class document does not exist. The frontend
   schema expects this and handles it.
   **Classification: Aligned** — documented contract.

3. **`ClassPartialSchema` and `ClassFullSchema` both redundantly declare `TeacherSummarySchema`.**
   The schema is duplicated in both `classPartials.zod.ts` and `classDetailService.zod.ts`.
   **Classification: Aligned** — intentional to keep each Zod file self-contained and
   avoid cross-file import coupling for a simple schema.

4. **`deleteABClass` response shape (`{ classId, hasDeletedFullClass, hasDeletedClassPartial }`) has no frontend Zod schema.**
   The response is consumed by generic `callApi` without `parseApiResponse` validation.
   **Classification: Aligned** — the delete flow does not require typed validation at
   the transport boundary; the caller receives raw `unknown` and destructures as needed.

These four entries are intentional contracts, not implementation deferrals. The former
`Teacher.toJSON()` conditional-omission discrepancy is resolved: `teacherName` is now always
emitted with an explicit `null` (see [§ Sub-entity Teacher](#sub-entity-teacher)).

---

## File Index

```
Persistence model:         src/backend/Models/ABClass.js
  └── ABClass.toJSON()          — full document shape; representation-aware embedded assignments
  └── ABClass.toPartialJSON()   — partial registry shape
  └── ABClass.serialiseOwner()  — owner serialisation helper
  └── ABClass._serialiseAssignmentsForClass() — partial defs via toPartialJSON(), full assignments via toJSON()

Teacher model:              src/backend/Models/Teacher.js
  └── Teacher.toJSON()          — teacher summary shape

Student model:              src/backend/Models/Student.js
  └── Student.toJSON()          — student shape

Metadata domain owner:      src/backend/Models/ABClassMetadata.js   (delivered; used by ABClass model boundaries)
  └── new ABClassMetadata()/toJSON()  — constructor-owned null default + defensive plain-snapshot boundary
  └── validateMetadata()              — top-level shape, dense 0–3 array, unique IDs, newest-first order
  └── validateClassAverages()         — five-field class summary (four scores + updatedAt)
  └── validateRecentAssignment()      — complete recent entry
  └── validateAverageScores()         — four metric fields
  └── validateAverageScore()          — single 0–5 score or exact N/E/excluded marker

Metadata error type:        src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js
  └── fieldPath + default inputSource 'model' (extends Error, not ApiValidationError)

Canonical UTC predicate:    src/backend/Utils/Validate.js
  └── Validate.isCanonicalUtcDateTime()  — exact YYYY-MM-DDTHH:mm:ss.sssZ real-calendar predicate

Controller:                 src/backend/y_controllers/ABClassController/
  ├── index.js                          — ABClassController facade
  ├── ABClassResponseMapper.js          — _toReadView(), _normaliseClassPartial(), _buildClassSummary()
  ├── ABClassPersistence.js             — persistClassAndPartial() prepared full/partial writes + field-scoped roster helpers
  ├── ABClassRoster.js                  — roster refresh and _persistRoster() field-scoped registry patch
  ├── ABClassMutationOps.js             — upsert/update/delete orchestration; request metadata gate; prepared selective editable partial
  └── ABClassAssignmentOps.js           — assignment mutation operations

API handlers:               src/backend/z_Api/abclass/
  ├── abclassRead.js                    — getABClass_()
  ├── abclassMutations.js               — upsertABClass_(), updateABClass_(), deleteABClass_(), adaptMetadataRequestError_()
  └── abclassValidation.js              — validateParametersObject_()

Transport envelope:         src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/googleClassrooms/classPartials.zod.ts
  │     → TeacherSummarySchema, ClassPartialSchema, ClassPartialsResponseSchema
  ├── src/frontend/src/services/googleClassrooms/classPartialsService.ts
  │     → getABClassPartials()
  ├── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
  │     → TeacherSummarySchema, StudentSummarySchema, AssignmentPartialSchema,
  │       StudentSubmissionPartialSchema, StudentSubmissionItemPartialSchema,
  │       BaseTaskArtifactPartialSchema, PartialAssessmentEntrySchema, ClassFullSchema,
  │       ClassFullResponseSchema
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
        → getABClass()
```

---

## ABClass `metadata` contract — domain, model, prepared persistence, response mapping, controller request replacement and transport adaptation delivered

> **Status: delivered.** Section 1 delivered the metadata **domain validation capability**,
> Section 2 the **test-only canonical fixture capability**, Section 3 the model boundary,
> Section 5 the **prepared whole-class/editable writes, the field-scoped roster patch and the
> approved partial-aware `ABClass.toJSON()` correction**, Section 6 the
> **read/partial/summary response projection**, Section 7 the **controller request gate and
> whole-value omission/null/replacement semantics**, and Section 8 the **transport error
> adaptation** (`adaptMetadataRequestError_()` in `abclassMutations.js`). Frontend metadata
> consumption remains excluded scope; see
> [§Frontend position](#frontend-position-excluded-scope).
>
> - `src/backend/Models/ABClassMetadata.js` — the dedicated metadata-domain owner, holding the
>   five static validation routines, the constructor/`toJSON()` snapshot boundary and its
>   defensive-copy helpers.
> - `src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js` — the typed domain error
>   carrying `fieldPath` and a default non-request `inputSource` (`'model'`).
> - `Validate.isCanonicalUtcDateTime()` in `src/backend/Utils/Validate.js` — the exact
>   canonical-UTC timestamp predicate.
> - `scripts/synthetic-test-data/generateClassMetadata.js`,
>   `scripts/synthetic-test-data/validateClassMetadata.js` and the test-only
>   `scripts/synthetic-test-data/toBackendModelInputs.js` adapter — generated raw supplied
>   snapshots, generator-owned raw integrity checks and backend model-input adaptation,
>   exercised by focused synthetic suites (see
>   [§Delivered test-only synthetic capability](#delivered-test-only-synthetic-capability-implemented)
>   below). This capability remains test-only.
>
> `ABClass` owns a plain metadata snapshot or `null`, normalises
> actual absence through the metadata constructor, rejects explicitly supplied `undefined` or
> invalid values, and validates/copies metadata during `toJSON()` and `toPartialJSON()`.
> Whole-class and selective editable writes prepare detached, equal full/partial metadata
> copies before the first full-store mutation; an existing registry roster row is patched with
> three serialised fields only and never reads or rewrites its stored metadata.
> `_normaliseClassPartial()` (reused by `_buildClassSummary()`) and `_toReadView()` emit
> validated, detached metadata on partial-list, mutation-summary and full-read responses.
> `upsertABClass`/`updateABClass` validate supplied request `metadata` before any record
> read/roster/write, replace it wholly, and surface a request-origin typed failure as a
> non-retriable `INVALID_REQUEST` through the transport adapter. Published behaviour is a
> supplied snapshot only: nothing calculates, refreshes, migrates or backfills it, so a
> previously supplied snapshot may become stale.

| Boundary                                             | Status      | Delivered behaviour                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ABClass model construction/restoration               | Implemented | Actual omission normalises to `null`; explicitly present `undefined` and invalid values fail validation.                                                                                                                                                   |
| Explicit replacement                                 | Implemented | `setMetadata(value)` validates/copies the complete value before replacing; `null` clears and `undefined` is invalid.                                                                                                                                       |
| Model serialisation                                  | Implemented | `toJSON()` and `toPartialJSON()` always emit independently copied, revalidated `metadata`.                                                                                                                                                                 |
| Whole-class and selective editable write preparation | Implemented | Payloads are prepared before the first full-store mutation; the partial projection is validated against the caller snapshot and rejects with zero writes on invalid/differing values.                                                                      |
| Field-scoped roster persistence                      | Implemented | An existing registry row is patched with exactly `className`, `classOwner`, `teachers` (stored `_id` filter); its stored metadata is never read, validated, copied or rewritten.                                                                           |
| Controller request validation                        | Implemented | `ABClassValidation._validateRequestMetadata()` validates explicitly supplied metadata before any record read/roster/write and tags only that invocation's typed failure with request provenance (Section 7).                                               |
| Response mapping (partial/summary/full reads)        | Implemented | `_normaliseClassPartial()`, `_buildClassSummary()` and `_toReadView()` emit validated, detached `metadata`; absent becomes `null`, present invalid fails as an integrity error.                                                                            |
| Transport error adaptation                           | Implemented | Only a request-provenance `ABClassMetadataValidationError` adapts to `ApiValidationError`/`INVALID_REQUEST` (path-bearing `message`, `isRetriable: false`, no added envelope fields); every other failure keeps its identity and generic `INTERNAL_ERROR`. |
| Frontend consumption                                 | Excluded    | Frontend Zod schemas strip the field by explicit backend-only scope; no frontend work is pending or promised.                                                                                                                                              |

The delivered contract adds one compact assessment-summary field, `metadata`, to both the full
ABClass document and the `abclass_partials` registry. The ABClass model's full and partial
serialisers emit it, and Section 5's prepared writes persist equal, detached copies of the
caller's snapshot. It is a
**supplied snapshot**: the backend does not calculate averages, refresh it after assessments,
backfill it, reconcile it between stores beyond an explicit write, or repair corrupt stored
values. In this contract,
`cohortKey`, `yearGroupKey` and `courseLength` are class configuration/reference fields,
distinct from the literal `metadata` assessment-summary property, which is in turn distinct
from the unrelated task-artifact `metadata`.

### Sub-entity: ABClassMetadata — delivered domain, model, prepared writes, read projection, request gate and transport adaptation

Backend model: `src/backend/Models/ABClassMetadata.js` (the dedicated metadata-domain owner,
delivered in Section 1; deliberately **not** part of `Models/ABClass.js` or the generic
`Validate`). The shape rules below are enforced by that owner and are wired into the ABClass
model boundary, the Section 5 prepared writes and the Section 7 controller request gate. Both
`ABClass.toJSON()` and `ABClass.toPartialJSON()` include the field; whole-class/editable writes
persist detached, equal copies, and the field-scoped roster patch leaves stored metadata
untouched. The Section 6 response mappers expose it on partial-list, summary and full reads,
and the Section 7 gate validates and replaces explicitly supplied request values before any
read/roster/write; the Section 8 transport adapter maps only a request-provenance typed
failure to `INVALID_REQUEST`.

Target notation (contract notation only, not a backend TypeScript requirement):

```ts
type AverageScore = number | 'N' | 'E' | 'excluded';

type AverageScores = {
  completeness: AverageScore;
  accuracy: AverageScore;
  spag: AverageScore;
  overall: AverageScore;
};

type ClassAverages = AverageScores & { updatedAt: string };

type RecentAssignment = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  averages: AverageScores;
  updatedAt: string;
};

type ABClassMetadata = {
  classAverages: ClassAverages;
  recentAssignments: RecentAssignment[];
} | null;
```

| Field                                                  | Type                 | Shape rules (enforced by `ABClassMetadata`)                                                                                | Notes                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`                                             | `object\|null`       | Optional on write; nullable as a whole on read                                                                             | Constructor-owned null normalisation via `new ABClassMetadata()`; an **own** `undefined` is invalid (only true omission triggers preserve/new-class-null). `new ABClassMetadata(value)` validates/copies; `toJSON()` returns an independently owned plain snapshot/`null`. |
| `metadata.classAverages`                               | `object`             | Required and complete when `metadata` is non-null; never `null`                                                            | Five own fields: four scores plus `updatedAt`.                                                                                                                                                                                                                             |
| `metadata.classAverages.completeness`                  | `AverageScore`       | Finite number in the inclusive range 0–5, or exactly `'N'`, `'E'`, `'excluded'`                                            | Independent field; no cross-metric inference.                                                                                                                                                                                                                              |
| `metadata.classAverages.accuracy`                      | `AverageScore`       | As above                                                                                                                   |                                                                                                                                                                                                                                                                            |
| `metadata.classAverages.spag`                          | `AverageScore`       | As above                                                                                                                   |                                                                                                                                                                                                                                                                            |
| `metadata.classAverages.overall`                       | `AverageScore`       | As above                                                                                                                   | Retains existing weighted-scoring meaning; **not** a separate arithmetic mean.                                                                                                                                                                                             |
| `metadata.classAverages.updatedAt`                     | `string`             | Exact canonical UTC datetime (see Validation); never `null`                                                                | Records when the supplied class summary was updated.                                                                                                                                                                                                                       |
| `metadata.recentAssignments`                           | `RecentAssignment[]` | Dense array of zero to three complete entries; sparse slots, `undefined` entries and incomplete entries are invalid        | Ordered by non-increasing `updatedAt`; equal timestamps keep caller order.                                                                                                                                                                                                 |
| `metadata.recentAssignments[].assignmentId`            | `string`             | Non-empty, already-trimmed, unique within the list; opaque (no numeric coercion, no UUID-only or fixed-length restriction) | Identifies a distinct Google Classroom assignment.                                                                                                                                                                                                                         |
| `metadata.recentAssignments[].assignmentDefinitionKey` | `string`             | Non-empty, already-trimmed; need **not** be unique within the list (definitions are reusable)                              |                                                                                                                                                                                                                                                                            |
| `metadata.recentAssignments[].averages`                | `AverageScores`      | Required and complete; the four score fields exactly, with no nesting and no timestamp                                     | A nested partial object is invalid, not a patch.                                                                                                                                                                                                                           |
| `metadata.recentAssignments[].updatedAt`               | `string`             | Exact canonical UTC datetime; supplied as the corresponding Assignment's existing `updatedAt`, not independently generated | Not compared by the API against the stored Assignment timestamp.                                                                                                                                                                                                           |

`excluded` is stored as the literal string `'excluded'`. This is a compact supplied-snapshot
value and is **not** the frontend `MetricResult` union (which represents exclusion as
`state: 'excluded'` with `value: null`); future consumers must map explicitly between the two
representations. The marker values `N`, `E` and `excluded` are exact, case-sensitive strings
that stay distinct and are never converted to zero (any other spelling, including lower case,
is rejected).

### Model construction, restoration, replacement and serialisation (delivered)

- `new ABClass(options)` distinguishes an absent own `metadata` property from a present value. Absence is normalised by `new ABClassMetadata()` to `null`; present values, including own `undefined`, are passed explicitly to the domain constructor and validated.
- `ABClass.fromJSON(json)` applies the same own-property distinction despite using `Object.create()` for restoration. Legacy full or partial JSON without an own `metadata` field therefore restores as an own `metadata: null`; explicitly present invalid data is rejected, not repaired.
- `ABClass.setMetadata(value)` replaces the whole snapshot or clears it with `null`. Its argument is always explicit, so `undefined` is invalid. Validation/copying completes before assignment, leaving existing state intact on failure.
- `toJSON()` and `toPartialJSON()` always emit `metadata`; each revalidates mutable model state through `ABClassMetadata` and returns an independently owned plain snapshot (or `null`). Input, full output, partial output and model state do not share nested metadata objects or arrays.
- A caller that deletes `model.metadata` or assigns `undefined` has corrupted model state; serialisation rejects it rather than invoking the absence default. Unrelated legacy-field restoration and serialization behaviour remains unchanged.
- These model serialization contracts are complemented by the delivered prepared writes below: whole-class and selective editable writes prepare equal, detached metadata payloads before the first full-store mutation, and the field-scoped roster patch leaves an existing row's stored metadata untouched. Actual I/O failures still retain the existing partial-success risk (full store persisted, partial store not), with no rollback or retry.

### Persistence-operation and lifecycle contract

> **Delivered (Sections 5–8):** prepared whole-class and selective editable writes, the
> field-scoped roster patch, the approved partial-aware `ABClass.toJSON()` correction for embedded
> assignments, the read/partial/summary response projection, the controller request gate with
> whole-value omission/null/replacement (`upsertABClass` / `updateABClass`), and the transport
> request-provenance error adaptation proved through real-dispatcher read/write/error suites.

Supplied-snapshot semantics:

- Both `ABClass.toJSON()` and the partial registry projection `ABClass.toPartialJSON()` include
  `metadata`; whole-class and selective editable writes persist equal, independently owned
  copies of the caller's snapshot.
- There is no separate `ABClassPartials` JavaScript model; `ABClass.toPartialJSON()` owns the
  partial representation.
- Assessment runs do not calculate, refresh or clear metadata, so a previously supplied
  snapshot may become stale. The contract does not claim otherwise. Assignment persistence
  preserves the class's existing snapshot.

Delivered prepared writes (`ABClassPersistence`, Section 5):

- `persistClassAndPartial(abClass)` prepares the full and partial payloads **before** the first
  full-store mutation, so a validation failure cannot cause a split-store write. The full payload
  is `abClass.toJSON()` when that method is present, otherwise the supported plain-object input;
  the caller object is never mutated. A complete partial is derived from
  `abClass.toPartialJSON()`.
- Authoritative metadata comes from the caller's own `metadata` property: actual own-property
  absence normalises through `new ABClassMetadata()` to `null`, while a present `undefined` or an
  invalid value is rejected. When the full or partial projection emits `metadata`, that value
  must validate and equal the caller snapshot; an invalid or differing projection rejects with
  **zero** insert/update/save operations. A legacy projection that omits the field is accepted,
  and only the prepared copies gain the equal, independently owned snapshot.
- `ABClassMutationOps.updateABClass()` prepares its complete partial projection before the
  selective full-store `collection.updateOne()`/`save()`, then persists that prepared partial
  afterwards. Its full `$set` stays selective (only the supplied editable fields); it is not a
  whole-class rewrite. A legacy full document may keep metadata absence while the rebuilt partial
  carries `metadata: null`. When `metadata` is supplied, the full `$set` value must be an
  independently owned copy of the validated replacement, equal to the prepared partial payload's
  metadata; the request, model state and both write payloads never share nested metadata objects.

> **Source-review note (projection anti-pattern recorded, not canonised).** The contract
> requires only that the `$set` metadata be an independently owned copy of the validated
> replacement, equal to the prepared partial payload's metadata. An earlier revision of the
> delivered `updateABClass()` produced that copy via `abClass.toPartialJSON().metadata`, i.e. by
> building a complete class projection — including unrelated `className`/`classOwner`/`teachers`
> serialisation — purely to read one field. The current source replaces that with a direct
> defensive metadata copy through the persistence owner's metadata-copy helper. Recorded here so
> the projection is not treated as intended design; either mechanism satisfies the unchanged
> persisted, transport and validation contract.

- A metadata-bearing legacy record is projected as `null` with no read-time write. A whole-class
  save includes the field; a selective editable-field patch may leave absence in the full
  document while rebuilding the partial with `null`; a field-scoped roster patch changes neither
  store's metadata. Absence and `null` stay semantically equivalent until the next explicit
  metadata or whole-class write.
- Full-store persistence precedes partial-registry persistence. Actual I/O failures retain the
  existing partial-success risk: a full-store failure prevents the partial write, while a
  partial-store failure propagates after the full store has been written. The contract adds no
  transaction emulation, rollback, automatic retry, backfill or concurrent-write recovery.
- Constructor-owned `null` normalisation: the metadata-domain constructor owns the nullable
  field's `null` default. ABClass construction, restoration and legacy partial projection route
  actual absence through it (the `Object.create` restoration path does not inherit constructor
  defaults automatically). Present values are validated at these boundaries, not defaulted, and
  malformed supplied non-null values never become `null` silently.

Controller request replacement semantics (delivered, Section 7) —
`ABClassValidation._validateRequestMetadata(parameters)`:

| Request metadata        | New class                  | Existing class                |
| ----------------------- | -------------------------- | ----------------------------- |
| Omitted                 | Initialise `null`          | Preserve existing metadata    |
| Explicit `null`         | Store `null`               | Clear metadata                |
| Complete valid object   | Store supplied snapshot    | Replace entire metadata value |
| Invalid / own undefined | Reject before side effects | Reject before side effects    |

- The gate is invoked by both mutations immediately after the legacy required-parameter checks
  and **before any record read, roster refresh, patch application or write**. It tests own-property
  presence (`Object.hasOwn(parameters, 'metadata')`), so true omission is distinct from an
  explicitly supplied value. A supplied own `undefined` or any invalid value is rejected.
- Only explicit presence invokes the shared domain validator. The gate catches only a typed
  `ABClassMetadataValidationError` and tags **that same object** with `inputSource: 'request'`; all
  other exceptions propagate unchanged. Model restoration, stored-value validation, serialisation
  and projection never acquire the request tag.
- Upsert new-class omission uses the constructor-owned `null` default; existing-class omission
  preserves the stored snapshot. Explicit `null` clears; a complete object replaces the whole
  value. Update mirrors this through `setMetadata`; nested partial objects are invalid, not patches.
- Existing records are restored and validated **before** any replacement is applied. Corruption in
  stored metadata therefore fails as a non-request integrity error even when the request supplies a
  valid replacement or `null`; there is no API repair path that bypasses stored-data integrity.
- An invalid mixed update applies none of its other fields: rejection precedes every read, roster
  call, in-memory patch and store write, so no partial configuration change is observed.
- Upsert preserves existing assignments and `active`, retains its whole-class save and roster
  refresh; update introduces no roster refresh. Metadata is a supplied snapshot and remains stale
  until an explicit replacement or whole-class write; no calculation, stamping, refresh or entity
  validation is performed.

#### Field-scoped roster persistence (delivered)

The roster refresh keeps its full refresh responsibilities (class name, owner, teachers and
students); it is not narrowed to students-only behaviour. `ABClassRoster._persistRoster()`
patches only the fields it owns in each store:

| Store                 | Delivered existing-document update                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full class collection | `$set` only `className`, `classOwner`, `teachers` and `students`, in the existing forms.                                                                             |
| `abclass_partials`    | `$set` only `className`, `classOwner` and `teachers`. Never includes `students`, `assignments`, `metadata`, `cohortKey`, `yearGroupKey`, `courseLength` or `active`. |

- Registry patch values match the serialised forms produced by `ABClass.toPartialJSON()`:
  `classOwner` through `ABClass.serialiseOwner()` and each teacher through
  `ArrayUtils.serialiseArray()`, retaining the class-name/`null` representation. Only these
  roster fields are built; the metadata-bearing partial projection is not called merely to
  obtain them. The full-store roster payload retains its existing forms and behaviour.
- An existing partial keeps its own metadata exactly as stored, including `null` or field
  absence, and it is never read, validated, copied or rewritten by this patch even when it
  differs from the loaded full class's metadata. Other unrelated fields are also unchanged. The
  permitted `findOne({ classId })` existence lookup is used only to establish existence and the
  row's stored `_id`.
- When the partial row is missing, a complete normal partial is prepared from the already loaded
  ABClass, including validated metadata/`null`, and inserted after the full store is saved. No
  roster-only fragment is written. This is write-through creation, not a general repair or
  backfill mechanism.
- Whether creation is needed, and the creation payload, are determined and prepared before the
  full store is written, preserving write order and logged failure propagation. If an existing
  row cannot match, the write fails rather than silently completing with an unsynchronised
  roster; no retry or concurrent-write recovery is introduced.
- An existing registry row is patched using its stored `_id` as the sole filter, obtained from
  the permitted lookup. A stored row without an `_id` fails loudly rather than falling back to a
  classId filter. The vendor's `matchedCount` is checked: an `_id`-only operator update
  correctly reports a matched-but-unmodified row (`matchedCount === 1` is accepted), unlike the
  vendor's query-filter no-op result. A zero-match result fails loudly; there is no classId-query
  or upsert fallback.
- Existing roster-only patches no longer call the whole-row partial upsert path. Whole-class
  saves and explicit metadata writes retain that path and its identical full/partial metadata
  contract. Direct controller operations used by the facade retain their signatures; no separate
  public roster API and no change to upsert/read workflows is introduced beyond this persistence
  boundary.

### Transport integration — read projection, controller request replacement and transport error adaptation delivered

> **Delivered (Sections 6–8):** `getABClassPartials` and `getABClass` return validated, detached
> `metadata`, with explicit `null` for legacy absence; mutation summaries inherit the same
> projection through `_buildClassSummary()`; the controller mutations validate and replace
> supplied request `metadata` before any read/roster/write; and `abclassMutations.js` adapts only
> the request-provenance typed failure to `ApiValidationError`/`INVALID_REQUEST`. The shared
> `apiHandler` envelope is unchanged ([Transport envelope](transport-envelope.md)); frontend class
> Zod schemas strip the field by explicit scope exclusion (see
> [§Frontend position](#frontend-position-excluded-scope)).

Metadata contains timestamp **strings** only, so it requires no additional
`DateUtils.deepConvertDates()` conversion in the partial-list or mutation-summary responses.
The existing full-read date-conversion behaviour for the other ABClass fields is preserved.

The transport contract is proved by real-dispatcher suites (`tests/api/apiHandler/abclassMetadata*`)
that install the real ABClass handlers and controller globals and mock only external seams
(DbManager collections, Classroom, auth, tracking); the wrapper suite is
`tests/api/abclassMetadataApi.test.js`. The synthetic bridge, which returns prebuilt transport
data, is consumer-compatibility coverage only and is **not** evidence of real
mutation/controller validation.

#### `getABClassPartials` (delivered)

- Returns `metadata` on every row, including explicit `null` for legacy absence.
- The registry-only read path and the existing empty-list behaviour are preserved: metadata
  introduces no full-class reads, assignment hydration, definition lookups or upstream API
  calls on this path.
- Invalid stored metadata fails the request; the row is not dropped and there is no fallback to
  a full-class fetch.
- `ABClassResponseMapper._normaliseClassPartial()` is the single stored-partial metadata
  normalisation/validation gate: it routes legacy absence through the metadata-domain
  constructor and rejects present invalid metadata as an integrity failure. Its reuse by
  `_buildClassSummary()` covers mutation summaries; `getAllClassPartials()` adds no duplicate
  metadata pass.
- Reads do not backfill: a legacy row without the field is projected as explicit `null`.

#### `getABClass` (delivered)

- Returns `metadata` in the full read view using the same shape and validation
  (`_toReadView()` revalidates and copies the mutable model state).
- An absent class still returns top-level `null`, which is distinct from an existing class
  with `metadata: null`.
- Existing assignment redaction and definition-key projection are preserved.

#### `upsertABClass` (delivered)

- Existing required fields and roster-refresh behaviour remain unchanged.
- The request now accepts and validates `metadata`: true omission preserves an existing snapshot
  (and initialises `null` for a new class), explicit `null` clears it, and a complete object
  replaces it. Validation runs before any record read, roster refresh or write.
- The returned partial summary contains validated, detached `metadata`.
- Existing assignment and active-state preservation rules remain unchanged.
- `abclassMutations.js` forwards the original parameters unchanged and adapts only a
  request-provenance typed metadata failure into `ApiValidationError`, which the dispatcher
  reports as a non-retriable `INVALID_REQUEST` (Section 8).

#### `updateABClass` (delivered)

- Metadata is an additional optional editable field: true omission preserves it; explicit `null`
  clears it; a complete object replaces it; nested partial objects are invalid, not patches.
- An invalid mixed patch applies none of its other fields: rejection precedes every read, roster
  call, patch and write.
- No roster refresh is introduced. The returned partial summary contains validated, detached
  `metadata`.
- Existing missing-class and protected-field behaviour remains unchanged.
- Transport error adaptation is delivered (Section 8), as for `upsertABClass`.

#### `deleteABClass` (unchanged)

- The existing deletion flags and removal of both stores remain unchanged. No metadata field
  is added to this response and no metadata-specific endpoint is introduced.

#### Optional write versus always-nullable read

- On read (delivered, Section 6), `metadata` is always emitted by `getABClassPartials`,
  `getABClass` and mutation summaries, and is nullable as a whole. Legacy absence is normalised
  to explicit `null`; no other field in the metadata shape may be `null`.
- On write (delivered, Sections 7–8), `metadata` is optional: true omission
  of the own property invokes preserve/new-class-null behaviour, while supplying the property with
  value `undefined` (or any other invalid value) is rejected. The optional request contract does
  **not** relax the always-present nullable read contract.

### Validation — domain/model, prepared writes, response projection, controller request gate and transport error adaptation delivered

> **Status: delivered.** The five routines below exist as static methods on
> `src/backend/Models/ABClassMetadata.js` and are exercised directly by focused backend tests.
> ABClass model construction, restoration, explicit replacement and both serializers use the
> domain boundary, the Section 6 response mappers project validated, detached metadata on reads,
> the Section 7 `ABClassValidation._validateRequestMetadata()` gate validates explicitly
> supplied request metadata before mutation side effects, and the Section 8 transport adapter
> narrows only the request-provenance typed failure into `ApiValidationError`/`INVALID_REQUEST`.

One shared domain implementation owns the metadata rules:

| Routine                                    | Delivered behaviour (static on `ABClassMetadata`)                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `validateAverageScore(value, context)`     | Enforce the exact finite 0–5 / `'N'` / `'E'` / `'excluded'` union.                                                           |
| `validateAverageScores(scores, context)`   | Require all four own metric fields and validate each; reject unexpected fields.                                              |
| `validateClassAverages(value, context)`    | Require exactly the four scores plus valid `updatedAt`; reuse score validation without rejecting the permitted timestamp.    |
| `validateRecentAssignment(value, context)` | Require exactly both identifiers, complete `averages` and valid `updatedAt`.                                                 |
| `validateMetadata(value, context)`         | Accept `null`; otherwise enforce complete shape, dense zero-to-three array, unique assignment IDs and newest-first ordering. |

Ownership and strictness rules:

- **Owner:** `src/backend/Models/ABClassMetadata.js`, shared by the ABClass model, the controller
  request gate and the response mappers (now used by `ABClassResponseMapper`). The five routines
  are kept out of the existing ABClass model and out of the generic `Validate`; the domain
  implementation must not be duplicated in transport helpers.
- `validateClassAverages` checks its own exact five-field record, passes an extracted
  four-field score record to `validateAverageScores`, and validates its timestamp separately.
- All metadata routines reuse one local domain record/required-field/allowed-key check rather
  than duplicating those checks per shape. Reuse `Validate` primitives where suitable.
- **Delivered boundary API:** `new ABClassMetadata()` owns the absent-value `null` default;
  `new ABClassMetadata(value)` validates/copies explicit input and rejects explicit
  `undefined`. `toJSON()` revalidates its owned value and returns an independently owned plain
  snapshot/`null`; the five named validators are static routines. Internal checks are
  centralised in the private `_checkRecord`, `_validateScoreFields`, `_validateTimestamp` and
  `_copyMetadata` helpers.
- **Delivered:** ABClass construction/restoration, `setMetadata(value)`, `toJSON()` and
  `toPartialJSON()` use the domain boundary as described under Model construction, restoration,
  replacement and serialisation.
- **Delivered:** the controller request gate `ABClassValidation._validateRequestMetadata(parameters)`
  distinguishes actual own-property presence before invoking the shared domain validator, and tags
  only that invocation's typed failure with request provenance (Section 7). The response-mapper
  boundary is also delivered (Section 6): it distinguishes own-property absence in
  `_normaliseClassPartial()` and revalidates model state in `_toReadView()`.
- **Delivered:** transport error adaptation (Section 8) — `adaptMetadataRequestError_()` in
  `abclassMutations.js` translates only the typed request-provenance failure into
  `ApiValidationError`/`INVALID_REQUEST` (message unchanged, no envelope field added) and
  rethrows every other exception unchanged.

The following strictness rules are enforced by the delivered domain owner:

- Every listed property of a non-null metadata object is required and must be an **own**
  property. Only the top-level `metadata` value may be `null`; no metric, `classAverages`,
  entry, `averages`, identifier or timestamp may be `null`.
- Nested objects must be ordinary data records (`Object.prototype` or a null prototype
  accepted); arrays, `Date` objects, class instances and values requiring coercion are
  rejected.
- Unexpected own fields in metadata or its nested objects are rejected, including
  misspellings and `lastAssessedAt`. This does **not** introduce an unrelated blanket
  unknown-key rule for existing ABClass requests.
- The recent array is dense: sparse slots, `undefined` entries and incomplete entries are
  invalid.
- Scores: numeric zero and fractions are valid; no coercion, truncation, rounding or
  percentage conversion is performed. Each field is validated independently; this cycle does
  not derive `overall`, inspect weightings or infer cross-metric relationships.
- Ordering: entries must be ordered by non-increasing `updatedAt`. Equal timestamps are valid
  and retain caller-supplied order; no additional tie-break or sorting is imposed.
  `assignmentId` is unique within the list; `assignmentDefinitionKey` need not be. Both
  identifiers are non-empty strings already trimmed and opaque. There is no enforced
  relationship between the class-summary timestamp and the entry timestamps.

#### Canonical timestamp predicate — delivered (`Validate.isCanonicalUtcDateTime`)

- **Owner (delivered):** the generic predicate `isCanonicalUtcDateTime(value)` in
  `src/backend/Utils/Validate.js`, reused by the metadata-domain validator through its private
  `ABClassMetadata._validateTimestamp(value, context)` helper.
- **Exact contract:** a metadata timestamp must be an exact canonical UTC ISO datetime of
  the form `YYYY-MM-DDTHH:mm:ss.sssZ`, with a real calendar date (Gregorian leap-year rules,
  including the century/non-quadricentennial exceptions, are enforced) and valid time
  components. Live `Date` objects, date-only strings, timezone offsets, non-canonical precision
  and counter-suffixed submission timestamps are rejected.
- **Distinction from the existing helper:** `isIsoDateTimeString_` in
  `src/backend/z_Api/assignmentDefinition/assignmentDefinitionPartialRowValidation.js`
  is **not** the target contract. It accepts timezone offsets and is owned by the later
  transport layer, which model-domain validation must not depend on. Leave that existing
  helper and its broader contract unchanged; record this distinction and cross-reference the
  new predicate in the `api-layer.md` helper entry.

#### Provenance and error rules — request tagging and transport adaptation delivered

- **Delivered:** the domain validator reports failures through
  `ABClassMetadataValidationError`
  (`src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js`), which carries a
  `fieldPath`, appends it to the message as `"<message> (<fieldPath>)"`, and defaults to
  non-request provenance via `inputSource = 'model'`. It extends `Error` and does **not**
  inherit from `ApiValidationError` (and never throws one). Model restoration, stored-partial
  validation, serialisation and projection therefore never acquire the request tag; only an
  explicit request-time tagging step sets `inputSource: 'request'`.
- **Delivered:** supplied request metadata is fully validated **before the first mutation side
  effect**, including roster refresh or any database write.
- **Delivered:** `ABClassValidation._validateRequestMetadata(parameters)` checks own-property
  presence and invokes the shared domain validator for explicitly supplied metadata at the start
  of each controller mutation — after the legacy required-parameter checks but before any record
  read, roster refresh or write. It is the only caller that tags failures with
  `inputSource: 'request'`, and it does so by mutating **that same typed error object**; non-typed
  exceptions propagate unchanged.
- **Delivered:** the mutation transport helper `adaptMetadataRequestError_()` in
  `abclassMutations.js` catches the controller delegation, logs the original thrown value with
  `method`/`classId` through `ABLogger`, translates only this error type with request provenance
  into `ApiValidationError` (`{ method }`, message unchanged), and rethrows every other exception
  unchanged.
- Invalid caller-supplied metadata returns the existing `INVALID_REQUEST` envelope
  (`isRetriable: false`), with an actionable field path included in `error.message`. No new
  `fieldName`, `details` payload or other envelope-shape change is added. Invalid persisted/model
  metadata is an internal integrity failure and returns the existing generic `INTERNAL_ERROR`
  treatment, not `INVALID_REQUEST`, and cannot be repaired or bypassed by supplying a valid
  replacement or `null`.
- Reproduced request failures carry `inputSource: 'request'`; the same validation failure at
  restoration, projection, serialisation or persistence keeps `inputSource: 'model'` and its
  original error identity. Only that narrow tagging step distinguishes the two.
- Exceptions from persistence, upstream services and internal wiring are not caught and
  reclassified as caller validation errors. The domain layer never throws transport errors
  and the transport layer never evaluates nested domain rules; no exception to the canonical
  validation-ownership policy or dispatcher change is needed.

#### Validation scope limits — domain/model, prepared writes, response projection, request gate and transport error boundary delivered

> **Status: delivered.** The domain owner and ABClass model enforce structural
> validation and defensive copying at construction, restoration, replacement and
> serialization; the Section 5 prepared writes validate/copy metadata before the first
> full-store mutation; the Section 6 response mappers validate/copy it on reads; the
> Section 7 controller request gate validates supplied request metadata before side effects;
> and the Section 8 transport adapter narrows only the request-provenance typed failure to
> `INVALID_REQUEST`, leaving every other failure as generic `INTERNAL_ERROR`.

- Validation must not repair metadata, silently remove entries, reorder it, calculate scores,
  stamp dates or fetch referenced entities.
- This is **structural** contract validation only. The API does not verify identifier
  existence, class membership, equality to a stored Assignment timestamp, mathematical
  consistency, or that the entries are the actual three most recently assessed assignments.
  Supplied snapshot accuracy remains the writer's responsibility.
- Neither the model nor its outputs retain shared mutable aliases that let caller, request or
  returned-object mutation change another representation; values are preserved by defensive
  copying at ownership boundaries.
- Invalid metadata fails ABClass restoration even if later code intends to replace it; no
  restoration bypass is provided. The delivered Section 7 request ordering restores and validates
  stored metadata before applying a supplied replacement or `null`, so corrupt stored metadata
  cannot be repaired through a request.
- Constructors/restoration, explicit metadata replacement and metadata-bearing serialization
  use the same authoritative rules; mutable metadata cannot bypass validation at those model
  boundaries. Whole-object write preparation (Section 5), response mapping (Section 6), the
  write request gate (Section 7) and the transport error adaptation (Section 8) are delivered.
- A field-scoped roster patch of an existing partial is **not** a metadata-bearing write. It
  must not use, validate, copy or rewrite the stored metadata value; the existence lookup
  required by the missing-partial path is unaffected.

### Frontend position (excluded scope)

- Frontend metadata consumption is an explicit scope exclusion, not a pending implementation
  promise. This cycle is backend-only, including its test infrastructure; no frontend source,
  schema, service or test change is planned, and no frontend reporting/layout work is authorised.
- The existing frontend Zod schemas (`ClassFullSchema`, `ClassPartialSchema`) use Zod's
  default `.strip()` behaviour, so they silently strip the delivered `metadata` field from
  responses. Backend read/write/transport support is complete regardless; the stripped field is
  simply unused by the frontend. Existing frontend synthetic consumers therefore continue to work
  with the extra field, and parse success is not sufficient evidence of metadata correctness (see
  the synthetic fixture capability in `docs/developer/testing/synthetic-test-data.md`).

### Exclusions (out of scope)

- No calculation of averages or automatic refresh of metadata after assessments.
- No eager migration, backfill or repair job for absent or corrupt stored metadata.
- No new metadata-specific endpoint; `deleteABClass` gains no metadata field.
- No transaction emulation, rollback, automatic retry or concurrent-write recovery.
- No layout specification: no frontend surface or workflow changes.

### Delivered test-only synthetic capability (Implemented)

> **Status: `Implemented`, test-only** (Section 2). The canonical corpus generates and
> validates raw class `metadata` supplied snapshots and adapts canonical views into backend
> model inputs. This is generator/test infrastructure only: it does **not** make production
> metadata accepted by write requests. Section 3 subsequently wired the domain into ABClass
> model construction/restoration and serialization; Section 5 delivered prepared
> whole-class/editable writes and the field-scoped roster patch; Section 6 delivered the
> read/partial/summary response projection; Section 7 delivered the controller request gate and
> whole-value request replacement, and Section 8 delivered the transport error adaptation. Corpus policy,
> profile matrix and commands live in
> [Synthetic Test Data](../testing/synthetic-test-data.md); this subsection records only the
> capability's contribution to this contract and must not duplicate that guide.

Supplied snapshots (no calculation):

- `generateClassMetadata.js` runs once in `generateSyntheticAnalysisGraph()` after assignment
  generation and before transport projection, assigning `metadata` in place on each
  persistence class. It reads no clock and consumes no Faker values, so seeds, entity counts,
  assignment timestamps and byte reproducibility are unchanged.
- Compact profiles use a fixed per-class-index matrix of profile, template and entry count:
  `small` is `null`, numeric/0 entries, `N`/1 entry; `medium` is `E`/2, `excluded`/3,
  `mixed`/1 and numeric/0; and `large-representative` is `null`, numeric/3, `mixed`/2 and
  numeric/1. Every entry's `averages` copies the same fixed four-field template as its
  `classAverages`, drawn from the numeric, all-`N`, all-`E`, all-`excluded` and mixed
  templates.
- `large-full` uses a modulo-five index cycle: `index % 5 === 0` is `null`, otherwise the
  recent count is `(index % 5) - 1` and the template index is `Math.floor(index / 5) % 5`.
- Every non-null snapshot sets `classAverages.updatedAt` to the class's newest generated
  assignment `updatedAt`, including zero-entry variants. Recent entries take their
  `assignmentId`, `assignmentDefinitionKey` and `updatedAt` exactly from real generated
  assignments of that class, newest first. These are supplied snapshot values: no averaging
  is performed and no cross-metric relationship is derived.

Raw views, parity and independent validation:

- `projectClassTransportViews.toClassPartial()` adds an independently cloned `metadata` value
  to both `transport.classPartials` and `transport.classesById` whenever the persistence class
  owns the field, so pre-metadata stage compositions never acquire an own
  `metadata: undefined`.
- `validateClassMetadata.js` checks raw shape, exact keys and score union, canonical timestamp,
  dense zero-to-three entries, unique assignment IDs, newest-first ordering,
  assignment/class/definition linkage, exact source timestamps and three-way
  persistence/partial/full parity, and is invoked by `validateSyntheticAnalysisGraph()`.
- The focused synthetic suites validate every raw snapshot view through the real
  `ABClassMetadata.validateMetadata` domain owner, because frontend schema parsing strips
  `metadata`. This is structural contract validation only: no identifier existence, class
  membership, stored-Assignment timestamp equality or "three most recent" claim is verified
  live.

Test-only backend model-input adapter:

- `loadBackendModelInputs(profileName)` clones the committed views (including the fifth
  `assignmentDefinitionPartials` view) and adapts them to backend model JSON. It retains all
  partial-only assignments and definitions, resolves class-embedded definitions to partial
  summaries, and leaves standalone full definitions with their keyed tasks and freshness
  fields intact; class-embedded submissions stay redacted. Raw `metadata` is independently
  cloned, and no returned representation shares mutable nodes.
- The adapter is test-only: production `src/backend` source never imports it.

### File index additions — delivered domain primitives and integration

Delivered in Section 1 (domain validation capability; subsequently wired into ABClass model
construction/restoration and serialization in Section 3):

```
Metadata domain owner (delivered): src/backend/Models/ABClassMetadata.js       — five static validators, constructor/`toJSON()` snapshot boundary, _checkRecord/_copyMetadata helpers, constructor-owned null default
Error type (delivered):            src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js — fieldPath + default inputSource 'model'; extends Error, not ApiValidationError
Utility (delivered):               src/backend/Utils/Validate.js               — isCanonicalUtcDateTime()
```

Delivered in Section 2 (test-only synthetic capability; generated fixtures and a test-only
adapter, not production storage or transport):

```
Generator stage (delivered):   scripts/synthetic-test-data/generateClassMetadata.js — index/template supplied-snapshot stage; no clock or Faker
Integrity helper (delivered):  scripts/synthetic-test-data/validateClassMetadata.js — raw shape/linkage/parity checks; invoked by validateSyntheticAnalysisGraph.js
Stage integration (delivered): scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js, projectClassTransportViews.js, validateSyntheticAnalysisGraph.js — thin composition/projection/validation wiring
Test-only adapter (delivered): scripts/synthetic-test-data/toBackendModelInputs.js — loadBackendModelInputs(profileName); canonical views → backend model inputs
Focused suites (delivered):    tests/synthetic-analysis/syntheticClassMetadata{Views,Validation,DomainAcceptance,Preservation}.test.ts, tests/synthetic-analysis/syntheticBackendModelInputs.test.ts, tests/synthetic-analysis/backendModelInputAssertions.js, tests/syntheticModelInputs.node.test.js, tests/synthetic-analysis-stress/syntheticClassMetadataFullLarge.test.ts
```

Delivered in Section 5 (prepared writes, field-scoped roster patch and the approved
partial-aware class serialisation; production storage behaviour, not transport):

```
Whole-write preparation (delivered):  src/backend/y_controllers/ABClassController/ABClassPersistence.js — persistClassAndPartial(); _prepareClassAndPartial(), _prepareClassPartial(), _metadataCopy(), _validatePreparedMetadata(), _writePreparedClassPartial(), _prepareRosterPartial(), _writePreparedRosterPartial()
Selective editable write (delivered): src/backend/y_controllers/ABClassController/ABClassMutationOps.js — updateABClass() prepares the complete partial before the selective full $set/save
Roster orchestration (delivered):      src/backend/y_controllers/ABClassController/ABClassRoster.js — _persistRoster() prepares the registry operation before the full roster write
Embedded assignment serialisation (delivered): src/backend/Models/ABClass.js — _serialiseAssignmentsForClass(): partial definitions via toPartialJSON(), genuine full assignments via toJSON()
Focused suites (delivered):    tests/models/abclassEmbeddedAssignmentSerialisation.test.js, tests/controllers/abclassEmbeddedAssignmentPersistence.test.js, tests/controllers/abclassMetadataPersistence.test.js, tests/controllers/abclassMetadataEditablePersistence.test.js, tests/controllers/abclassRosterPersistence.test.js
```

Delivered in Section 6 (read/partial/summary response projection; transport read
behaviour, not request acceptance):

```
Response projection (delivered): src/backend/y_controllers/ABClassController/ABClassResponseMapper.js — _normaliseClassPartial() (single stored-partial metadata gate, reused by _buildClassSummary()) and _toReadView() project validated, detached metadata with explicit null for legacy absence
Focused suite (delivered):       tests/controllers/abclassMetadataResponses.test.js
```

Delivered in Section 7 (controller request gate and whole-value request replacement;
production controller behaviour, not transport):

```
Request gate (delivered):         src/backend/y_controllers/ABClassController/ABClassValidation.js — _validateRequestMetadata(parameters) (own-property presence, shared domain validation, request-only tagging); _buildUpdatePatch()/_applyPatchToClass() carry metadata through setMetadata
Request replacement (delivered):  src/backend/y_controllers/ABClassController/ABClassMutationOps.js — upsertABClass()/updateABClass() invoke the gate before any read/roster/write and apply omission/null/whole replacement after restoring stored metadata
Focused suites (delivered):       tests/controllers/abclassMetadataMutations.test.js, tests/controllers/abclassMetadataLifecycle.test.js
```

Delivered in Section 8 (transport error adaptation and real-dispatcher contract validation;
transport behaviour, not storage):

```
Transport adapter (delivered):     src/backend/z_Api/abclass/abclassMutations.js — adaptMetadataRequestError_(): request-provenance-only adaptation to ApiValidationError/INVALID_REQUEST; logs method/classId and rethrows every other failure unchanged
Real-dispatcher suites (delivered): tests/api/abclassMetadataApi.test.js (wrapper forwarding/adaptation); tests/api/apiHandler/abclassMetadataReads.test.js + abclassMetadataWrites.test.js (real read/write envelopes); tests/api/apiHandler/abclassMetadataErrors.test.js (request vs internal errors, atomicity, auth/tracking/diagnostics); tests/api/apiHandler/abclassMetadataTestContext.js (real handler/controller installation with external-only mocks)
```

---

## Companion cleanup — Teacher serialisation and documentation corrections (delivered)

> **Status: delivered, except the deferred deletion-flag fix.** This bounded companion cleanup
> was approved during action planning (see `docs/plans/SPEC.md` → "Agreed companion cleanup —
> Teacher serialisation and documentation"). The one-field `Teacher.toJSON()` correction and the
> two factual documentation corrections are applied to the implemented sections above. The
> deletion full-flag correction remains an explicitly deferred future change tracked in
> [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332); deletion code and flags are
> unchanged in this cycle.

| Item                                                            | Status                            | Delivered behaviour / contract                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Teacher.toJSON()` always emits own `teacherName`               | Delivered                         | See [§ Sub-entity Teacher](#sub-entity-teacher). It emits `teacherName: this.teacherName`, using the constructor-owned `null` when unset (no serialiser-time default). Construction, `fromJSON()` and setters are unchanged; the guarantee attaches to `Teacher` instances only, so legacy plain-object rows still pass through uncorrupted. No second default, raw-registry rewrite or eager migration. |
| Full class storage named by `classId`                           | Delivered (documentation)         | Applied to the `Collections:` header, the main-collection heading and the persistence prose above. `abclass_partials` remains the fixed registry name.                                                                                                                                                                                                                                                   |
| `deleteABClass` absent-success and flag facts                   | Delivered (documentation)         | Applied to the delete error/response tables and key notes above: absent stores delete successfully (no class-not-found error), a missing registry row reports `hasDeletedClassPartial: false`, and any non-throwing drop currently reports `hasDeletedFullClass: true`.                                                                                                                                  |
| Honour the vendor `false` drop result for `hasDeletedFullClass` | Not implemented — deferred (#332) | The current quirk is documented in the delete section but not corrected; deletion behaviour and flags are unchanged in this cycle.                                                                                                                                                                                                                                                                       |
