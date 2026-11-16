# Contract: Assignment

Root domain object for an assessed piece of coursework. Contains submissions,
assessments, and an embedded assignment definition. Persisted independently
from ABClass, with partial summaries carried inside the ABClass document.

Backend model: `src/backend/AssignmentProcessor/Assignment/index.js` (facade)
Serialisation: `src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`
Legacy read preparation: `src/backend/AssignmentProcessor/Assignment/02_AssignmentLegacyRead.js` (via `AssignmentRehydration.prepareLegacyReadSubmissions()`)
Marker-1 restoration: `src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js`
Assessment-stage producer: `src/backend/RequestHandlers/LLMRequestManager.js` (LLM terminal outcomes, shared live/cache numeric validation and internal cache identity)
Image hydration producer: `src/backend/RequestHandlers/ImageManager.js` (scoped student `IMAGE_HYDRATION_FAILED` materialisation, shared-image run blocking and hydration writeback invalidation)
Generic cache: `src/backend/RequestHandlers/CacheManager.js` (generic best-effort `get`/`put` and the shared `CACHE_EXPIRY_SECONDS`)
Collections: `assign_full_<courseId>_<assignmentId>` (full records only — no partial registry)
API handlers: `src/backend/z_Api/assignmentAssessment.js`
Response mapper: Transport transformations applied by `src/backend/y_controllers/ABClassController/ABClassResponseMapper._toReadView()` (for `getABClass` embedding) — not part of Assignment's own serialisation.
Frontend service: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
Frontend Zod: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` (full),
`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` (partial)
Frontend read normalisation: `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` (pure full/partial entry points, invoked by both read services before their final response parse),
with item/source validation and corruption construction in `src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts`

Sibling contracts:

- [Contract: ABClass](abclass.md) — ABClass embeds Assignment partials (with `assignmentDefinitionKey` instead of `assignmentDefinition` as a transport transformation).
- [Contract: AssignmentDefinition](assignment-definition.md) — AssignmentDefinition is embedded inside Assignment as a full or partial definition.
- [Component Shape: Student Submission](student-submission.md) — Assignment embeds `StudentSubmission[]`, each holding `StudentSubmissionItem`s.
- [Component Shape: Assessment](assessment.md) — each submission item holds `Assessment` results; the marker, write gate and legacy read preparation belong to that file.
- [Component Shape: BaseTaskArtifact](base-task-artifact.md) — each submission item holds a submission-role artifact.
- [Contract: BackendConfig](backend-config.md) — No direct relationship.
- [Contract: Reference Data](reference-data.md) — No direct relationship.
- [Transport envelope](transport-envelope.md) — Assignment API payloads use the shared `apiHandler` envelope, which leaves the backend as a JSON string; this contract documents only the inner payload.

---

## Persistence

Assignment uses a single persistence model: full records stored under dedicated
collections. There is no partial registry for Assignment (unlike ABClass, which
has `abclass_partials`). Partial summaries are carried inside the ABClass document
but are not independently persisted.

### Collection: `assign_full_<courseId>_<assignmentId>`

Stored via `Assignment.toJSON()` in `00_AssignmentSerialisation.js`.

| #   | Field                       | Type                                   | Persistence            | Transport             | Frontend Zod                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------- | -------------------------------------- | ---------------------- | --------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `courseId`                  | `string`                               | included               | same                  | `AssignmentFullSchema.courseId: z.string()`                                                    | Google Classroom course ID. Required, never null.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | `assignmentId`              | `string`                               | included               | same                  | `AssignmentFullSchema.assignmentId: z.string()`                                                | Google Classroom coursework ID. Required, never null.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | `assignmentName`            | `string`                               | included               | same                  | `AssignmentFullSchema.assignmentName: z.string()`                                              | Fetched from Google Classroom at construction via `fetchAssignmentName()` for a newly created assignment. Typed restoration supplies the saved value instead and skips that fetch (see [§ Restoration construction and representation mode](#restoration-construction-and-representation-mode)).                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | `dueDate`                   | `string\|null`                         | included               | same                  | `AssignmentFullSchema.dueDate: z.string().nullable()`                                          | ISO 8601 string or `null`. Currently always `null` (homework tracker not implemented).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | `updatedAt`                 | `string\|null`                         | included               | same                  | `AssignmentFullSchema.updatedAt: z.string().nullable()`                                        | ISO 8601 string or `null`. Set via `touchUpdated()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | `createdAt`                 | `string`                               | included               | same                  | `AssignmentFullSchema.createdAt: z.string()`                                                   | ISO 8601 string. Set from Google Classroom `creationTime` at construction for a new assignment, or from the saved metadata during typed restoration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | `documentType`              | `string\|null`                         | included (extracted)   | same                  | `AssignmentFullSchema.documentType: z.string().nullable()`                                     | `'SLIDES'` \| `'SHEETS'` or `null`. Extracted from embedded `assignmentDefinition` via `_extractFullDefinitionFields()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `referenceDocumentId`       | `string\|null`                         | included (extracted)   | same                  | `AssignmentFullSchema.referenceDocumentId: z.string().nullable()`                              | Extracted from embedded `assignmentDefinition`. `null` when definition is partial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9   | `templateDocumentId`        | `string\|null`                         | included (extracted)   | same                  | `AssignmentFullSchema.templateDocumentId: z.string().nullable()`                               | Extracted from embedded `assignmentDefinition`. `null` when definition is partial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 10  | `tasks`                     | `Record<string, TaskDefinition>\|null` | included (extracted)   | same                  | `AssignmentFullSchema.tasks: z.record(z.string(), TaskDefinitionSchema).nullable()`            | Extracted from embedded `assignmentDefinition`. `null` when definition is partial. Only in full shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | `submissions`               | `StudentSubmission[]`                  | included               | same                  | `AssignmentFullSchema.submissions: z.array(StudentSubmissionSchema)`                           | Array of `StudentSubmission.toJSON()` objects. Empty array when no submissions. A legacy record re-emits whatever `submissions` value was stored, whatever its shape (see [§ Legacy `submissions` preservation](#legacy-submissions-preservation)); the frontend array schema applies to the read wire only.                                                                                                                                                                                                                                                                                                                                                                            |
| 12  | `assignmentDefinition`      | `AssignmentDefinition`                 | included               | same                  | `AssignmentFullSchema.assignmentDefinition: AssignmentDefinitionSchema`                        | Full definition object via `AssignmentDefinition.toJSON()`. Always included in full persistence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 13  | `assessmentContractVersion` | `1\|null\|unknown (legacy)\|omitted`   | included conditionally | `1\|'legacy'` on read | `AssignmentFullSchema.assessmentContractVersion: z.union([z.literal(1), z.literal('legacy')])` | New completed results are validated and stamped `1` at the completed-write boundary (see [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write)). Legacy records re-emit the exact stored marker presence/value opaquely, including an absent marker or an unsupported value; ordinary persistence never validates or rewrites it. The full read serializer emits `'legacy'` on the read output only, beside prepared read submissions (see [§ Legacy read preparation](#legacy-read-preparation)). The full read schema requires the read-wire field and the `getAssignment` service runs the read normaliser before its final parse. |

Key notes:

- `Assignment` serialisation converts its own live `Date` values to ISO strings: `dueDate`,
  `updatedAt` and `createdAt` through `.toISOString()`. The embedded definition is not converted:
  `AssignmentDefinition.toJSON()`/`toPartialJSON()` re-emit its stored date values unchanged, so
  a revived `Date` there stays a `Date` in the payload (see
  [Contract: AssignmentDefinition § Persistence](assignment-definition.md#persistence)).
- A legacy (non-marker-1) record is restored into ordinary instance state rather than a
  separate copy: `AssignmentRehydration._baseFromJSON()` keeps the stored submission records in
  `inst.submissions`, the exact stored marker value in `inst.assessmentContractVersion` and its
  presence in `inst._legacyMarkerPresent`. `toJSON()`/`toPartialJSON()` therefore re-emit that
  state through the same paths as a current record. A stored submission record without a model
  serialiser is copied by `AssignmentSerialisation._plainSubmissionJSON()`, which passes each
  value through `DateUtils.deepConvertDates()` so a live `Date` (for example one JsonDbApp
  revived from a stored ISO string) becomes its ISO string instead of `{}`. Historical values are
  otherwise not normalised.
- `progressTracker` is **intentionally not serialised** (it is a singleton/session-specific runtime property).
- `_hydrationLevel` is a runtime-only flag and never persisted.
- Fields 7–10 are extracted from the embedded definition by `_extractFullDefinitionFields(definitionJson)`, which reads `documentType`, `referenceDocumentId`, `templateDocumentId`, and `tasks` from the definition's `toJSON()` output.
- The `Assignment` class is a facade (`index.js`) that delegates serialisation to `AssignmentSerialisation` (`00_AssignmentSerialisation.js`).
- Legacy persistence is unchanged by read: a record whose `assessmentContractVersion` is absent, `null` or unsupported keeps its stored submission body and exact marker presence/value, and `toJSON()`/`toPartialJSON()` re-emit that state unchanged. They never emit prepared read submissions or the read-only `'legacy'` marker. See [Component Shape: Assessment § Legacy read preparation](assessment.md#legacy-read-preparation).

### Legacy `submissions` preservation

A legacy (non-marker-1) record's `submissions` value is preserved as stored through
restoration, both persistence serialisers and an ordinary class save. The rule is the
same on every path:

| Stored value         | Restored instance state          | `toJSON()` / `toPartialJSON()` output                  | Ordinary class save (`ABClass.toJSON()` → `ABClassPersistence`) |
| -------------------- | -------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Present array        | the stored array, as stored      | per-record serialisation, as for a current record      | the same serialised array                                       |
| Explicit `null`      | `null`                           | `null` — never `[]`                                    | `null`                                                          |
| Present plain object | the stored object, as stored     | independently owned, date-normalised copy — never `[]` | the same date-normalised copy                                   |
| Absent property      | constructor's empty array (`[]`) | `[]`                                                   | `[]`                                                            |

A class save serialises each embedded assignment through `ABClass.toJSON()`, which calls
`Assignment.toJSON()` for a keyed full definition and `Assignment.toPartialJSON()` for a
task-summary array, so both serialisers feed the same stored value.

Key notes:

- Absence is decided by `Object.hasOwn(data, 'submissions')` in the legacy branch of
  `AssignmentRehydration._baseFromJSON()`; an explicit `null` is a present value, not
  absence. Only an absent property keeps the constructor's `[]`.
- Both persistence serialisers branch on `Array.isArray(this._assignment.submissions)`.
  An array body maps through `AssignmentSerialisation._submissionJSON()`; any other
  present value goes through `_plainSubmissionJSON()`, which copies each value through
  `DateUtils.deepConvertDates()`. The copy is independently owned, so mutating a returned
  payload cannot change the restored instance or the saved record.
- Nested `Date` values anywhere in a preserved non-array body (including inside arrays
  and nested objects) are emitted as ISO strings, never `{}`.
- The original stored `assessmentContractVersion` presence/value is preserved on the same
  paths and is independent of the `submissions` value: `_applyContractMarker()` emits the
  stored value only when the marker was present, and an absent marker stays absent.
- Marker-1 records are unaffected: `AssignmentCurrentRestoration._validateCurrentAssignment()`
  still requires `submissions` to be an array, so an invalid marker-1 root throws as before.
- Read paths prepare submissions only for an array body. `AssignmentSerialisation.toReadJSON()`
  and `ABClassResponseMapper._toReadView()` call
  `AssignmentRehydration.prepareLegacyReadSubmissions()`; a present non-array root returns
  `null` from that facade and the read transport then throws a contextual error naming the
  assignment. Persistence keeps preserving the stored body, and the frontend root rejection
  remains as defence-in-depth; see [§ Legacy read preparation](#legacy-read-preparation).

### Legacy read preparation

Both read paths prepare an independent read result for a legacy record before the frontend
sees it. The owner is `AssignmentLegacyRead` in `02_AssignmentLegacyRead.js`, exposed through
`AssignmentRehydration.prepareLegacyReadSubmissions(assignment, form)`.

| Aspect                  | Behaviour                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger                 | Any stored `assessmentContractVersion` other than `1` (absent, `null` or unsupported). Marker-1 records keep the restoration path described in [Component Shape: Assessment § Marker-1 CURRENT restoration](assessment.md#marker-1-current-restoration).              |
| `form` argument         | Exactly `'full'` or `'partial'`; any other value throws. It selects output serialisation only and never weakens validation.                                                                                                                                           |
| Validation mode         | Derived from the embedded definition representation, not from `form`: a task-summary array selects partial validation, a keyed task map selects full validation. Full output uses the resolved full definition.                                                       |
| Reuse                   | `AssignmentCurrentRestoration._rehydrateCurrentSubmission()` runs on isolated copies of the stored items, so valid scores, reasoning, feedback, artefact content and identities are retained through the current-format rules.                                        |
| Corruption isolation    | A malformed item, criterion map, artefact or contradictory source state becomes all-three validation `CORRUPT_RECORD` `E` for that task. Null/missing/array/non-record item maps yield one `E` per saved task on both forms. Healthy siblings and submissions remain. |
| Coverage and timestamps | Missing known-task items, the genuine no-submission case and timestamp preparation follow the current-format rules, using the saved embedded task list.                                                                                                               |
| Non-array root          | A present non-array `submissions` value bypasses preparation: the facade returns `null` and a read transport then throws a contextual error naming the assignment; persistence keeps the preserved, date-normalised body from `toJSON()`/`toPartialJSON()`.           |
| Error propagation       | Identity failures, unknown-task associations and injected constructor faults propagate unchanged; they are never relabelled `E`.                                                                                                                                      |
| No mutation             | The restored instance, its saved raw submissions and later persistence output are unchanged by preparation.                                                                                                                                                           |
| Read marker             | The read output carries `assessmentContractVersion: 'legacy'`; the stored instance keeps its original marker presence/value.                                                                                                                                          |

Stored explicit `REASSESSMENT_REQUIRED` errors remain supported: they are served as stored on
both read paths and are not regenerated. There is no all-criteria placeholder producer.

### Partial variant — `Assignment.toPartialJSON()`

Not independently persisted, but used for in-memory partial representations and
for embedding inside `ABClass.assignments[]`. Behaviour differs from `toJSON()`:

| #   | Field                       | Type                                 | Persistence            | Transport                             | Frontend Zod                                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------- | ------------------------------------ | ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `courseId`                  | `string`                             | same as full           | same                                  | stripped by `AssignmentPartialSchema`                                                             | Present in wire format; Zod `.strip()` default removes it (not included in schema).                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | `assignmentId`              | `string`                             | same as full           | same                                  | `AssignmentPartialSchema.assignmentId: z.string()`                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | `assignmentName`            | `string`                             | same as full           | same                                  | stripped by `AssignmentPartialSchema`                                                             | Present in wire format; Zod `.strip()` default removes it.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 4   | `dueDate`                   | `string\|null`                       | same as full           | same                                  | `AssignmentPartialSchema.dueDate: z.string().nullable().optional()`                               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | `updatedAt`                 | `string\|null`                       | same as full           | same                                  | `AssignmentPartialSchema.updatedAt: z.string().nullable()`                                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6   | `createdAt`                 | `string`                             | same as full           | same                                  | `AssignmentPartialSchema.createdAt: z.string()`                                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7   | `documentType`              | `string\|null`                       | same as full           | same                                  | `AssignmentPartialSchema.documentType: z.string().nullable()`                                     | Only root-level field extracted in partial shape (via `_extractPartialRootFields()`).                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `referenceDocumentId`       | —                                    | omitted                | omitted                               | —                                                                                                 | Not extracted in partial shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9   | `templateDocumentId`        | —                                    | omitted                | omitted                               | —                                                                                                 | Not extracted in partial shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 10  | `tasks`                     | —                                    | omitted                | omitted                               | —                                                                                                 | Not extracted in partial shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | `submissions`               | `StudentSubmissionPartial[]`         | included               | transformed                           | `AssignmentPartialSchema.submissions: z.array(StudentSubmissionPartialSchema)`                    | Submissions via `StudentSubmission.toPartialJSON()` — artifact content redacted; numeric/`'N'` assessment reasoning stripped, `'E'` reasoning/cause retained. A legacy record re-emits a present non-array stored value through `_plainSubmissionJSON()` exactly as `toJSON()` does; see [§ Legacy `submissions` preservation](#legacy-submissions-preservation).                                                                                                                                    |
| 12  | `assignmentDefinition`      | `AssignmentDefinitionPartial`        | included               | replaced by `assignmentDefinitionKey` | `AssignmentPartialSchema.assignmentDefinitionKey: z.string()`                                     | See Transport section for the transformation. `getABClass` endpoint replaces this with just the key.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 13  | `assessmentContractVersion` | `1\|null\|unknown (legacy)\|omitted` | included conditionally | `1\|'legacy'` on class read           | `AssignmentPartialSchema.assessmentContractVersion: z.union([z.literal(1), z.literal('legacy')])` | New completed results are validated and stamped `1` at the completed-write boundary (see [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write)). Legacy records re-emit the exact stored marker presence/value opaquely; the class read mapper emits `'legacy'` on the wire entry only, beside prepared read submissions. The partial read schema requires the field and the `getABClass` service runs the read normaliser before its final parse. |

### Restoration construction and representation mode

Typed restoration constructs an `Assignment` through its real constructor rather than
`Object.create(Assignment.prototype)`. The constructor takes an optional fourth argument:

```ts
new Assignment(courseId, assignmentId, assignmentDefinition, {
  assignmentName: string,
  createdAt: Date,
  representationMode?: 'full' | 'partial',
});
```

| Aspect                       | Behaviour                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved metadata               | `_baseFromJSON()` passes the stored `assignmentName` and `createdAt`, so restoration never calls Google Classroom. The presence of the `restoration` object (not the truthiness of the name) selects this path; a new three-argument construction still fetches the Classroom name/creation time.                                                                      |
| Saved name validity          | The saved `assignmentName` must be a string. A `null`, `undefined` or other non-string saved name throws `TypeError` from the constructor before any Classroom access; there is no generated fallback and the exception propagates unhandled. Valid strings, including a blank string, are preserved verbatim. See [Known discrepancies](#known-discrepancies) item 7. |
| Representation mode          | `_restorationMode` is a constructor-owned transient. It defaults to `'full'` when the caller omits it, accepts only explicit `'full'`/`'partial'`, and throws `TypeError` for any other value. Callers own it: `readRehydrateAssignment()` passes `'full'`, and `ABClass.fromJSON()` passes `'partial'` for a task-summary-array definition and `'full'` otherwise.    |
| Stored mode isolation        | `_restorationMode` is listed in `_baseFromJSON()`'s `knownFields`, so a raw stored `_restorationMode` cannot overwrite the caller-owned value, and it is never emitted by `toJSON()`, `toPartialJSON()` or `toReadJSON()`.                                                                                                                                             |
| Hydration marker             | Restoration leaves the transient `_hydrationLevel` unset (`undefined`); it is not a persisted hydration claim. `ABClass.fromJSON()` sets the in-memory partial marker on class-embedded instances itself.                                                                                                                                                              |
| Persistence/transport effect | None beyond the saved `assignmentName`/`createdAt` values already in the record. No new wire field is added, and the full/partial/legacy persistence contracts below are unchanged.                                                                                                                                                                                    |

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

| Field                       | Type                                   | Required | Notes                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `courseId`                  | `string`                               | yes      |                                                                                                                                                                                                                                 |
| `assignmentId`              | `string`                               | yes      |                                                                                                                                                                                                                                 |
| `assignmentName`            | `string`                               | yes      |                                                                                                                                                                                                                                 |
| `dueDate`                   | `string\|null`                         | yes      | ISO 8601 string or `null`                                                                                                                                                                                                       |
| `updatedAt`                 | `string\|null`                         | yes      | ISO 8601 string or `null`                                                                                                                                                                                                       |
| `createdAt`                 | `string`                               | yes      | ISO 8601 string                                                                                                                                                                                                                 |
| `documentType`              | `string\|null`                         | yes      | `'SLIDES'` \| `'SHEETS'` or `null`                                                                                                                                                                                              |
| `referenceDocumentId`       | `string\|null`                         | yes      |                                                                                                                                                                                                                                 |
| `templateDocumentId`        | `string\|null`                         | yes      |                                                                                                                                                                                                                                 |
| `tasks`                     | `Record<string, TaskDefinition>\|null` | yes      | `null` when definition is partial                                                                                                                                                                                               |
| `submissions`               | `StudentSubmission[]`                  | yes      | Full `StudentSubmission.toJSON()` array                                                                                                                                                                                         |
| `assignmentDefinition`      | `AssignmentDefinition`                 | yes      | Full `AssignmentDefinition.toJSON()` object                                                                                                                                                                                     |
| `assessmentContractVersion` | `1\|'legacy'`                          | yes      | `1` for a current result; `'legacy'` for every other stored marker, emitted on the read output only. Required by `AssignmentFullSchema`, and enforced at runtime by the `getAssignment` read normaliser before its final parse. |

Key contract notes:

- The response is built from `Assignment.toReadJSON()`, which delegates to `AssignmentSerialisation.toReadJSON()` and then calls `AssignmentDefinition.toJSON()` on the embedded definition. The `readRehydrateAssignment` handler internally performs full hydration (resolving partial definitions via `getDefinitionByKey`), so a throw only occurs when the authoritative record is itself unresolvable or partial.
- `getAssignment_()` selects the read serializer, not the persistence serializer. A stored record with `assessmentContractVersion: 1` is restored through `AssignmentCurrentRestoration` (see [Component Shape: Assessment § Marker-1 CURRENT restoration](assessment.md#marker-1-current-restoration)); a marker-less, `null` or unsupported record is restored into ordinary instance state (stored submissions, marker value and marker presence) without reconstruction. `AssignmentSerialisation.toReadJSON()` then prepares read submissions for that legacy state (see [§ Legacy read preparation](#legacy-read-preparation)) and sets `assessmentContractVersion: 'legacy'` on the output, while a current result keeps `1`. Ordinary `toJSON()`/`toPartialJSON()` continue to re-emit the stored body and marker unchanged.
- `AssignmentFullSchema` requires `assessmentContractVersion: 1 | 'legacy'`, and `getAssignment()` runs `normaliseAssignmentRead()` before its final response parse, so item isolation and the defensive same-payload coverage fallback are active at runtime. See [Known discrepancies](#known-discrepancies).
- `progressTracker` is stripped from the response at the transport boundary as defence-in-depth (already omitted by the read serialiser).
- `DateUtils.deepConvertDates()` is called on the entire response before returning, because
  `google.script.run` prohibits `Date` objects in return values. This is also what converts the
  embedded definition's date values, which its own serialiser re-emits unchanged. The response is
  then serialised to a JSON string by `apiHandler()`; see
  [Transport envelope](transport-envelope.md#key-contract-notes).
- Returns `null` when no persisted assignment document exists for the given `courseId`/`assignmentId` pair (`AssignmentNotFoundError` caught at the transport boundary).

#### `getAssignment` — Partial variant via ABClass transport

When assignments are embedded inside the `getABClass` response (see [Contract: ABClass § getABClass](abclass.md#getabclass-read)), the shape differs from `Assignment.toPartialJSON()`:

> **Partial variant (ABClass transport):** Same as `Assignment.toPartialJSON()` except:
>
> - `_hydrationLevel` and `progressTracker` are stripped (defence-in-depth — already omitted by `toPartialJSON()`)
> - The embedded `assignmentDefinition` object is replaced by `assignmentDefinitionKey` (the `definitionKey` from the stored definition). The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry.
> - `courseId` and `assignmentName` are present in the wire format but stripped by Zod `.strip()` on `AssignmentPartialSchema`.
> - A current result carries `assessmentContractVersion: 1`. A legacy record's submissions are replaced with the prepared partial read submissions and `assessmentContractVersion` is set to `'legacy'` on the wire entry only, before the definition key replacement. `AssignmentPartialSchema` requires `assessmentContractVersion: 1 | 'legacy'`, and `getABClass()` runs `normaliseClassRead()` before its final response parse.

This transformation is performed by `ABClassResponseMapper._toReadView()` — it is NOT part of `AssignmentSerialisation` and does not affect the `assign_full_*` persistence shape. The full class-read behaviour, including coverage and null-parent isolation, is documented in [Contract: ABClass § getABClass](abclass.md#getabclass-read).

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

This contract embeds three component shapes, each documented in its own file. The
`Feedback` record is small enough to stay inline here.

### StudentSubmission

See [Component Shape: Student Submission](student-submission.md). That file owns the
`StudentSubmission` and `StudentSubmissionItem` field tables, the partial redaction
rules, the acquisition/extraction and image-hydration outcomes, completed submission
coverage, the trustworthy-identity/item-isolation rules and the marker-1 item
restoration rules.

### StudentSubmissionItem

See [Component Shape: Student Submission § Persistence](student-submission.md#persistence).
The item model, its partial projection and its `setError()` primitive are documented
there.

### Assessment

See [Component Shape: Assessment](assessment.md). That file owns the `Assessment` field
table, the cause catalogue, the LLM assessment outcomes and validated cache reuse, the
completed-write gate, the `assessmentContractVersion` marker, the legacy read preparation
and marker-1 CURRENT restoration.

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

See [Component Shape: BaseTaskArtifact](base-task-artifact.md). That file owns the
artifact field table, the concrete artifact types, the partial redaction rules and the
availability split between the definition store and a completed assignment. This
contract's `StudentSubmissionItem.artifact` uses the same shape with `role` set to
`'submission'`.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`:
  - `AssignmentFullSchema` (`.strict()`) — validates the full assignment response shape. Extra top-level keys cause Zod errors.
  - `AssignmentFullResponseSchema` — `AssignmentFullSchema.nullable()`, handles not-found.
  - `GetAssignmentRequestSchema` (`.strict()`) — validates `getAssignment` request parameters.
  - `StartAssessmentRunRequestSchema` (`.strict()`) — validates `startAssessmentRun` request parameters.
  - `StartAssessmentRunResponseSchema` — `z.void().nullable()`, accepts `null` from backend envelope.
  - `AssignmentDefinitionSchema` — validates full definition shape (cross-ref to AssignmentDefinition contract).
  - `TaskDefinitionSchema` — validates full task definition shape (cross-ref to AssignmentDefinition contract).
  - `StudentSubmissionSchema`, `StudentSubmissionItemSchema`, `AssessmentSchema` and `BaseTaskArtifactSchema` are re-exported/consumed here; their authoritative documentation lives in the component-shape files.

- `src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts` (shared result/cause owner; consumed by both read schemas):
  - `assessmentCauseSchema` — strict stage/code catalogue union.
  - `assessmentResultSchema` — full `number | 'N' | 'E'` union with finite 0–5 numeric range, required reasoning and `E`-only cause.
  - `partialAssessmentResultSchema` — numeric/`'N'` score-only entries, plus `E` entries retaining reasoning and cause.

- `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` (pure full/partial read normaliser; invoked by both read services):
  - `normaliseAssignmentRead()` — strict full-root and shared-definition validation, per-item isolation, and the same-payload missing-task defence.
  - `normaliseClassRead()` — strict class/partial roots and per-item isolation of provided entries only.

- `src/frontend/src/services/assignmentAssessment/assignmentReadItemValidation.ts` (adjacent pure owner):
  - `isValidFullItem()` / `isValidPartialItem()` — item, artefact-association and parent-source contextual validation.
  - `corruptItem()` / `itemErrorPath()` — canonical all-three `CORRUPT_RECORD` replacement and safe diagnostic paths.

- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`:
  - `AssignmentPartialSchema` — validates partial assignment shape as embedded in `getABClass` response, including the required `assessmentContractVersion: 1 | 'legacy'`.
  - `ClassFullSchema`, `ClassFullResponseSchema` — class-level shapes.
  - `StudentSubmissionPartialSchema`, `StudentSubmissionItemPartialSchema`, `PartialAssessmentEntrySchema` and `BaseTaskArtifactPartialSchema` are consumed here; their authoritative documentation lives in the component-shape files.

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
- `Assignment._baseFromJSON()` validates the marker-1 root and authoritative task list before constructing models. `AssignmentCurrentRestoration` validates raw submission items before constructors, isolates invalid known items and missing known coverage as all-three `CORRUPT_RECORD` `E`, preserves healthy siblings, and restores in the explicitly propagated full or partial mode. Marker-less, `null` and unsupported-marker records are not reconstructed: their stored submission records, exact marker value and marker presence are kept as ordinary instance state, and both read paths prepare read submissions through `AssignmentRehydration.prepareLegacyReadSubmissions()` (see [§ Legacy read preparation](#legacy-read-preparation)). A present legacy `submissions` value keeps its stored shape; see [§ Legacy `submissions` preservation](#legacy-submissions-preservation).
- `AssignmentController.startAssessmentRun()` validates definition freshness: compares Drive modification timestamps for reference and template documents against stored `referenceLastModified`/`templateLastModified`. Throws `DefinitionStaleError` on mismatch.
- `Assignment._requireImplementation()` enforces subclass implementation of document-type-specific methods.
- Student acquisition follows every `StudentSubmissions.list` page before concluding absence; a later-page list failure propagates unchanged. Expected acquisition/extraction source failures become atomic task `E` at the student/task boundary, unknown extraction task IDs warn and are ignored, and known tasks whose extraction failed receive terminal failure items while healthy extracted items remain in flight. See [Component Shape: Student Submission § Acquisition and extraction outcomes](student-submission.md#acquisition-and-extraction-outcomes).
- A newly created `Assignment` (three-argument construction) makes one Google Classroom coursework call: it throws if `creationTime` is missing, then throws `TypeError` if the fetched title is not a string. No generated name fallback remains. Typed restoration supplies the saved name/creation time and does not fetch; a saved name that is `null`, `undefined` or otherwise not a string throws `TypeError` before any Classroom access, and the exception propagates unhandled. See [§ Restoration construction and representation mode](#restoration-construction-and-representation-mode).
- `AssignmentDefinition.toJSON()` throws `TypeError` when `tasks` is an array (partial shape) — callers must ensure full hydration before serialisation.
- The completed-write gate (`ABClassAssignmentOps.persistAssignmentRun()`) rejects missing task coverage, malformed/incomplete criterion maps, contradictory null-content records, present content without a usable hash, still-pending student IMAGEs and missing/unusable required shared artefacts before marker stamping, serialisation or any collection mutation. See [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write).

### Known discrepancies

1. **`Assignment.toPartialJSON()` emits `courseId` and `assignmentName` but frontend `AssignmentPartialSchema` strips them.**
   Frontend `AssignmentPartialSchema` does not include `courseId` or `assignmentName`. Zod's default `.strip()` mode silently removes them. The ABClass transport includes them in the wire format but the frontend resolves assignment context from other sources.

2. **`AssignmentPartialSchema` uses `assignmentDefinitionKey` instead of `assignmentDefinition`.**
   The ABClassResponseMapper._toReadView() replaces the embedded `assignmentDefinition` object with a `assignmentDefinitionKey` string at the transport boundary. This is **not** part of `Assignment.toPartialJSON()` — it is a transport transformation specific to the `getABClass` endpoint. The frontend resolves definition details from its own `AssignmentDefinitionPartials` registry.

3. **`AssignmentFullResponseSchema` is `AssignmentFullSchema.nullable()`.**
   Backend `getAssignment_()` returns `null` when no persisted document exists. The frontend schema expects this.

4. **`startAssessmentRun` returns `null` and the frontend schema uses `z.void().nullable()`.**
   Backend returns `null` (no payload on success). The frontend `StartAssessmentRunResponseSchema` is `z.void().nullable()` which accepts both `undefined` (from the envelope's `data ?? null` coercion) and `null`.

5. **`assessmentContractVersion` is required by both frontend read schemas.**
   `AssignmentFullSchema` and `AssignmentPartialSchema` both require `z.union([z.literal(1), z.literal('legacy')])`. The backend emits `1` for a stored marker of `1` and `'legacy'` for every other stored marker, so the read-wire union matches both read paths.

6. **Legacy records are retained as ordinary instance state and both read paths prepare them at read time.**
   `Assignment._baseFromJSON()` does not catch, reconstruct or drop non-marker-1 records: it keeps the stored submission records in `inst.submissions`, the exact stored marker value in `inst.assessmentContractVersion` and its presence in `inst._legacyMarkerPresent`, and does not run the marker-1 submission rehydration. `AssignmentRehydration._rehydrateSubmission()` handles marker-1 records only — it delegates each one to `AssignmentCurrentRestoration._rehydrateCurrentSubmission()` — so non-marker-1 records never reach it. `AssignmentSerialisation.toJSON()` / `toPartialJSON()` re-emit that state through their normal paths (an ordinary save never marks a stored result as current), while `toReadJSON()` and `ABClassResponseMapper._toReadView()` prepare read submissions through `AssignmentRehydration.prepareLegacyReadSubmissions()` and emit `'legacy'` on the wire entry. Both read services validate the resulting entries. Completed-write preflight/gates are enforced at the write boundary.
   See [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write).

7. **A restored `assignmentName` must be a string; there is no generated fallback.**
   The constructor's restoration branch requires `typeof restoration.assignmentName === 'string'` and throws `TypeError` before any Classroom access otherwise, so a stored `null`, `undefined` or other non-string fails loudly and propagates unhandled. There is no generated `Assignment <assignmentId>` fallback, including on the fetched-title path, where `fetchAssignmentName()` throws `TypeError` when the Classroom title is not a string after its single coursework call. Valid strings — including a blank string — and the saved `createdAt` are preserved verbatim, so the normal construction and restoration paths cannot produce a `null` name and `AssignmentFullSchema.assignmentName: z.string()` remains the correct, unwidened contract. The
   strict-name rule (no schema widening, no recovery fetch, no fallback) is deliberate: an invalid
   saved name fails before it can reach persistence or transport.

8. **A present non-array legacy `submissions` value is preserved in persistence and fails read transports contextually.**
   Restoration and both persistence serialisers preserve a present `null` or plain-object `submissions` value and re-emit it unchanged, while `AssignmentFullSchema.submissions` and `AssignmentPartialSchema.submissions` require an array. On both read transports preparation is skipped for a non-array root: `AssignmentRehydration.prepareLegacyReadSubmissions()` returns `null`, and the read transport turns that `null` into a contextual error naming the assignment, so `getAssignment` fails for that assignment and `getABClass` fails for that class before any payload is served.
   The persistence and read contracts deliberately differ: a save must not destroy stored data,
   and a read must not serve a non-array root. The rejection comes from the backend read transport,
   with the frontend root check retained as defence-in-depth.

---

## File Index

```
Persistence model:         src/backend/AssignmentProcessor/Assignment/index.js
  └── AssignmentSerialisation (00_AssignmentSerialisation.js)
      └── toJSON()              — full document shape (legacy state re-emitted unchanged)
      └── toPartialJSON()       — partial (summary) shape (legacy state re-emitted unchanged)
      └── toReadJSON()          — read shape in the requested form (default 'full'; current marker 1 /
                                   legacy marker 'legacy' + prepared read submissions)
      └── _rootOutput()         — root fields shared by the full and partial payloads
      └── _applyContractMarker() — stamps the current marker or re-emits the stored legacy marker
      └── _submissionsJSON()    — submissions payload shared by both persistence emits: an array body
                                   maps through _submissionJSON(), a non-array body is preserved
      └── _submissionJSON() / _plainSubmissionJSON() — per-submission serialisation; plain stored
                                                       records and present non-array legacy bodies
                                                       copied through DateUtils.deepConvertDates()
  └── AssignmentRehydration (02_AssignmentRehydration.js)
      └── _baseFromJSON()       — marker-1 root/task pre-validation; legacy records kept as instance state
      └── _rehydrateSubmission() — marker-1 only; delegates to AssignmentCurrentRestoration._rehydrateCurrentSubmission()
      └── prepareLegacyReadSubmissions() — public legacy read-preparation facade
  └── AssignmentLegacyRead (02_AssignmentLegacyRead.js)
      └── prepare()             — independent legacy read result; per-task CORRUPT_RECORD isolation;
                                   null for a present non-array submissions root
  └── AssignmentCurrentRestoration (02_AssignmentCurrentRestoration.js)
      └── _rehydrateCurrentSubmission() — marker-1 full/partial restoration, coverage,
                                           null-parent isolation and corrupt-item placeholders

Embedded component shapes (documented separately):
  ├── StudentSubmission / StudentSubmissionItem → student-submission.md
  ├── Assessment                                 → assessment.md
  └── BaseTaskArtifact                           → base-task-artifact.md

Inline sub-entity models:
  ├── src/backend/Models/Feedback/0_Feedback.js
  │     └── Feedback.toJSON()                  — base feedback shape
  └── src/backend/Models/Feedback/1_CellReferenceFeedback.js
        └── CellReferenceFeedback.toJSON()     — cell reference feedback shape

Controller:                src/backend/y_controllers/
  ├── AssignmentController.js                   — startAssessmentRun, processSelectedAssignment
  └── ABClassController/
        └── index.js                            — loadClass, readRehydrateAssignment
        └── ABClassAssignmentOps.js             — readRehydrateAssignment, _loadFullAssignmentDocument,
                                                  _validateAssignmentDocument, _ensureFullDefinition,
                                                  _getFullAssignmentCollectionName, persistAssignmentRun
                                                  (completed-write gate, marker stamping, prepared payloads)
        └── ABClassAssignmentValidation.js      — _validateCompletedAssignmentRun(),
                                                  _validateCompletedSharedArtefacts()
        └── ABClassResponseMapper.js            — _toReadView() transport transformation
                                                  (legacy read preparation and definition-key replacement)

API handlers:              src/backend/z_Api/assignmentAssessment.js
  ├── getAssignment_()                         — full assignment fetch
  └── startAssessmentRun_()                    — assessment run trigger

Transport envelope:        src/backend/z_Api/z_apiHandler.js
  └── apiHandler(), ApiDispatcher, ALLOWLISTED_METHOD_HANDLERS

Frontend:
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
  │     → AssignmentFullSchema, AssignmentFullResponseSchema,
  │       GetAssignmentRequestSchema, StartAssessmentRunRequestSchema,
  │       StartAssessmentRunResponseSchema, AssignmentDefinitionSchema,
  │       TaskDefinitionSchema (re-exports the component shapes below)
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts
  │     → getAssignment(), startAssessmentRun()
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
        → AssignmentPartialSchema, ClassFullSchema, ClassFullResponseSchema
```
