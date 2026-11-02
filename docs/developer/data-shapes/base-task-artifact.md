# Component Shape: BaseTaskArtifact

Artifact payload embedded in task definitions (reference/template) and in student
submission items (submission). Base class for all artifact types; subclasses override
`getType()` and `normalizeContent()`.

Backend model: `src/backend/Models/Artifacts/0_BaseTaskArtifact.js`
Subclasses: `1_TextTaskArtifact.js` (`'TEXT'`), `TableTaskArtifact` (`'TABLE'`),
`SpreadsheetTaskArtifact` (`'SPREADSHEET'`), `ImageTaskArtifact` (`'IMAGE'`)
Factory: `src/backend/Models/Artifacts/ArtifactFactory.js` → `ArtifactFactory.create()`
Frontend Zod (full): `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `BaseTaskArtifactSchema`
Frontend Zod (partial): `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `BaseTaskArtifactPartialSchema`

Sibling contracts (this shape has no independent persistence, endpoints or Zod root schema):

- [Contract: AssignmentDefinition](assignment-definition.md) — **origin**. `TaskDefinition.artifacts.{reference,template}` hold this shape; created via `TaskDefinition.createArtifact()`.
- [Contract: Assignment](assignment.md) — **consumer**. `StudentSubmissionItem.artifact` holds this shape with `role: 'submission'`.
- [Contract: Student Submission](student-submission.md) — consumer of the submission-role instance inside `StudentSubmissionItem`.
- [Transport envelope](transport-envelope.md) — this shape never forms a top-level `data` payload.

---

## Persistence

This shape participates in two parent persistence shapes via `toJSON()` and
`toPartialJSON()`. It is never persisted as a standalone document.

### `toJSON()` — full participation

| #   | Field         | Type                  | Persistence | Transport | Frontend Zod (full)                                                                                | Notes                                                              |
| --- | ------------- | --------------------- | ----------- | --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `taskId`      | `string`              | included    | unchanged | `BaseTaskArtifactFields.taskId: z.string()`                                                        | Parent task ID.                                                    |
| 2   | `role`        | `string`              | included    | unchanged | `BaseTaskArtifactFields.role: z.string()`                                                          | One of `'reference'`, `'template'`, `'submission'`.                |
| 3   | `pageId`      | `string\|null`        | included    | unchanged | `BaseTaskArtifactFields.pageId: z.string().nullable()`                                             | Source page ID. Constructor defaults to `null`.                    |
| 4   | `documentId`  | `string\|null`        | included    | unchanged | `BaseTaskArtifactFields.documentId: z.string().nullable()`                                         | Drive document ID. Constructor defaults to `null`.                 |
| 5   | `content`     | `string\|Array\|null` | included    | unchanged | Per-variant in the discriminated union — see [§ Concrete artifact types](#concrete-artifact-types) | Heavy content payload; shape depends on `type`.                    |
| 6   | `contentHash` | `string\|null`        | included    | unchanged | `BaseTaskArtifactFields.contentHash: z.string().nullable()`                                        | Hash of content for change detection.                              |
| 7   | `metadata`    | `object`              | included    | unchanged | `BaseTaskArtifactFields.metadata: z.record(z.string(), z.unknown())`                               | Arbitrary metadata key-value store.                                |
| 8   | `uid`         | `string`              | included    | unchanged | `BaseTaskArtifactFields.uid: z.string()`                                                           | Unique ID: `{taskId}-{taskIndex}-{role}-{pageId}-{artifactIndex}`. |
| 9   | `type`        | `string`              | included    | unchanged | Discriminant of `BaseTaskArtifactSchema` (`'TEXT'\|'TABLE'\|'SPREADSHEET'\|'IMAGE'\|'base'`)       | Artifact type identifier. **Not** a Drive MIME type.               |

### `toPartialJSON()` — partial participation

Same nine fields, emitted in the same order, with `content: null` and
`contentHash: null` (payload redaction for list views). `pageId` and `documentId`
are still emitted as `string | null` — redaction never removes a source ID.

| Field         | Persistence  | Transport (full parent) | Transport (partial parent) | Frontend Zod (partial)                                                       | Notes                                                       |
| ------------- | ------------ | ----------------------- | -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `taskId`      | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.taskId: z.string()`                           |                                                             |
| `role`        | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.role: z.string()`                             |                                                             |
| `pageId`      | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.pageId: z.string().nullable().optional()`     | `.optional()` is defensive tolerance only.                  |
| `documentId`  | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.documentId: z.string().nullable().optional()` | `.optional()` is defensive tolerance only.                  |
| `content`     | **redacted** | —                       | **omitted by schema**      | —                                                                            | Backend emits `null`; the partial schema has no such field. |
| `contentHash` | **redacted** | —                       | **omitted by schema**      | —                                                                            | Backend emits `null`; the partial schema has no such field. |
| `metadata`    | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.metadata: z.record(...).optional()`           |                                                             |
| `uid`         | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.uid: z.string()`                              |                                                             |
| `type`        | included     | unchanged               | unchanged                  | `BaseTaskArtifactPartialSchema.type: z.string()`                             | Partial schema does **not** discriminate on `type`.         |

Key notes:

- `content`/`contentHash` redaction is **deliberate** in every partial projection. A
  `null` there is never evidence of extraction failure.
- `toJSON()` and `toPartialJSON()` always emit both source IDs. No code path omits
  `pageId` or `documentId`.
- `toJSON()` emits `metadata` as the live object reference; `type` and `content` come
  from the subclass.

---

## Transport

This shape has no standalone endpoint. It reaches the frontend only inside parent
payloads, and the transformations differ per embedding boundary:

| Embedding boundary                                       | Parent projection                | Transformation applied to this shape                                                                     |
| -------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `getAssignment` (`Assignment.toReadJSON()`)              | `TaskDefinition.artifacts`       | Full `toJSON()` output, unchanged. Validated by `BaseTaskArtifactSchema`.                                |
| `getAssignment` (`Assignment.toReadJSON()`)              | `StudentSubmissionItem.artifact` | Full `toJSON()` output, unchanged. Validated by `BaseTaskArtifactSchema`.                                |
| `getABClass` (`ABClassResponseMapper._toReadView()`)     | `StudentSubmissionItem.artifact` | `toPartialJSON()` redaction; partial schema omits `content`/`contentHash` entirely.                      |
| `getAssignmentDefinition` / `upsertAssignmentDefinition` | `TaskDefinition.artifacts`       | **Not transported.** The definition endpoints emit lightweight task projections with no `artifacts` key. |
| `getAssignmentDefinitionPartials`                        | `TaskDefinition.artifacts`       | **Not transported.** `TaskPartialSchema` carries only `taskId`, `taskTitle`, `taskWeighting`.            |

Key contract notes:

- The definition endpoints deliberately drop `artifacts` even though both
  `TaskDefinition.toJSON()` and `toPartialJSON()` emit it. The full artifact body is
  transported only through `getAssignment`.
- No transport boundary renames, defaults or coerces any field of this shape. The
  only boundary transformation is partial redaction, which happens in the model.
- `google.script.run` prohibits `Date` values; this shape carries none.

---

## Sub-entities

### Concrete artifact types

`type` selects the runtime class and the `content` shape. The frontend
`BaseTaskArtifactSchema` is a `z.discriminatedUnion('type', [...])` — each row below
corresponds to one variant.

| `type` value    | Class                     | `normalizeContent()` behaviour                                                                                                                                                 | Frontend discriminated union content shape                                 |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `'TEXT'`        | `TextTaskArtifact`        | Returns trimmed LF-only string; null/undefined→null; non-string coerced via `String()`                                                                                         | `z.string().nullable()`                                                    |
| `'TABLE'`       | `TableTaskArtifact`       | Returns Markdown table string; null→null (logged); string→trimmed string; 2D array→padded rows→Markdown; 50×50 hard limit; throws on limit exceeded                            | `z.union([z.string(), z.null()])`                                          |
| `'SPREADSHEET'` | `SpreadsheetTaskArtifact` | Returns trimmed 2D array; null→null; string→null; fully blank/all-null grid→`[]`; formula strings canonicalised (space-stripped, uppercased); trailing empty rows/cols trimmed | `z.array(z.array(z.union([z.number(), z.string(), z.null()]))).nullable()` |
| `'IMAGE'`       | `ImageTaskArtifact`       | Returns trimmed string (data URL) or null; null→null; non-string→null; empty→null                                                                                              | `z.string().nullable()`                                                    |
| `'base'`        | `BaseTaskArtifact`        | Returns raw content as-is                                                                                                                                                      | `z.unknown()`                                                              |

Key notes:

- The `content` field shape differs per type: `TEXT` uses a string, `TABLE` uses a
  Markdown-formatted string, `SPREADSHEET` uses a 2D array of `(number|string|null)`,
  `IMAGE` uses a base64 data URL string, `base` uses `unknown`.
- `contentHash` is `string|null` on all full variants and omitted entirely from the
  partial schema.
- `ArtifactFactory.create()` dispatches on `type` (uppercased): TEXT→TextTaskArtifact,
  TABLE→TableTaskArtifact, SPREADSHEET→SpreadsheetTaskArtifact,
  IMAGE→ImageTaskArtifact, anything else→BaseTaskArtifact (fallback).
- `TextTaskArtifact` normalises CRLF/CR→LF and trims; `SpreadsheetTaskArtifact`
  canonicalises formula strings (strips non-quoted spaces, uppercases);
  `TableTaskArtifact` enforces a 50×50 size limit; `ImageTaskArtifact` provides
  `setContentFromBlob()` for binary-to-data-URL conversion.
- A successfully read blank/all-null `SPREADSHEET` grid normalises to `[]`, including
  a blank template, and therefore receives the normal hash of `[]` through
  construction, persistence and restoration. A literal `null` remains unavailable
  content, not blank content. Existing normalisation of populated formulas is unchanged.

### Availability by parent store

The same shape carries different availability guarantees depending on which parent
store holds it. The definition store is the origin; the assignment store is the
completion boundary.

| Parent store                                | Availability contract                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assignment_definitions` registry           | `content`/`contentHash` redacted by `toPartialJSON()`. A `null` here is deliberate redaction, never evidence of extraction failure.                                                                                                                                                                                                                                                                                       |
| `assdef_full_<definitionKey>` full cache    | May legitimately retain a **pending `IMAGE`** reference/template artifact with `content: null` and `contentHash: null` before an assessment run. This is the only permitted pre-run null artifact. New writes enforce the definition-write invariant; pre-existing stored definitions are not retroactively rewritten.                                                                                                    |
| New definition writes                       | Non-`IMAGE` artifacts must already have non-null content and a string hash. Valid blank `TEXT`/array templates are not rejected as empty. A pending `IMAGE` may remain null until hydration. Owned by `AssignmentDefinitionValidation.validateSharedArtifacts()`; the upsert orchestrator invokes it on final resolved tasks before persistence.                                                                          |
| Formula-free `SPREADSHEET` reference task   | Invalid shared definition, not a valid blank template. Rejected at the new-definition-write boundary before persistence. Blank templates `[]` remain valid; blank student ranges retain the current formula scores. Never a student `E`.                                                                                                                                                                                  |
| Completed full assignment (`assign_full_*`) | Required reference/template artifacts must have usable, non-null content/hash after hydration. A completed result with an unusable required shared artifact must not be persisted as complete. Enforced by the completed-write gate in [Component Shape: Assessment § Write boundary](assessment.md#write-boundary-preflight-before-any-write), which runs before marker stamping, projection or any collection mutation. |
| Run boundary                                | No run-time eligibility preflight. Shared-definition failures continue through the existing definition error/rollback surface. Required shared-image hydration failures are handled by the assignment image pipeline (`ImageManager`); see [Contract: Student Submission § Image hydration outcomes](student-submission.md#image-hydration-outcomes).                                                                     |

Rules:

- The definition store's pending-image state is **internal and pre-run**. It is not a
  terminal result and must not be converted into a student `E` or `N`. Only pending
  `IMAGE` artifacts may legitimately remain null in this store.
- At new definition writes, non-`IMAGE` artifacts must already have non-null content
  and a string hash. Valid blank `TEXT`/array templates are not rejected as empty.
  `AssignmentDefinitionValidation.validateSharedArtifacts()` owns this
  definition-write invariant; do not add separate parser/API validators or change
  definition rollback semantics.
- A spreadsheet reference task with zero assessable formulae is an invalid shared
  definition, not a valid blank template. It is rejected at the new-definition-write
  boundary; the parser normally creates no task for a formula-free reference, and the
  write validator rejects any resolved task that still carries one before persistence.
  This adds **no** run-time eligibility preflight. Blank templates canonicalised to
  `[]` remain valid, and blank student ranges retain the current formula scores
  (completeness `0`, accuracy `0`, SPaG `N`).
- The strict non-null requirement for **completed full assignments** is a
  completion-boundary requirement enforced by the completed-write gate, not by the
  definition-write validation. A definition can legitimately exist before its images
  are hydrated.
- Submission artifact placeholders and the assessment-stage `E`/null-content
  corruption rule belong to the assignment read projection, not the definition store:
  see [Contract: Student Submission § Source artefact content and hash semantics](student-submission.md#source-artefact-content-and-hash-semantics).
  The definition store never materialises reassessment `E` entries.
- Required shared-image hydration failure handling lives in the assignment image
  pipeline (`ImageManager`): a required shared reference/template image with no usable
  source URL or owning document ID, a final non-200/network download failure, or
  unusable returned hydrated content blocks the run by throwing. It is never converted
  to a student `E`, and prior saved results are preserved.
- A matched student IMAGE is valid pending internal state, not a completed result.
  `ImageManager` hydrates it or materialises extraction `IMAGE_HYDRATION_FAILED` `E`
  with null content/hash. See
  [Contract: Student Submission § Image hydration outcomes](student-submission.md#image-hydration-outcomes).
- Old definitions that cannot meet the non-`IMAGE` invariant may be reparsed through
  the existing definition workflow. A stored definition is not revalidated at run
  start; it is validated on its next definition write. No result-version marker is
  added to definitions.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` →
  `BaseTaskArtifactSchema` — full discriminated union by `type`. The shared
  `BaseTaskArtifactFields` object validates `pageId` and `documentId` as required
  nullable strings (`z.string().nullable()`): both reject a missing key and a
  non-string value, but accept the `null` source IDs the backend contract permits.
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` →
  `BaseTaskArtifactPartialSchema` — reduced shape with `taskId`, `role`, `pageId`
  (nullable optional), `documentId` (nullable optional), `metadata` (optional),
  `uid`, `type`. `content` and `contentHash` are omitted entirely.

**Backend transport validation:**

- None at the transport boundary. This shape is produced by the model and consumed
  as nested data; no `z_Api` handler validates it.

**Key domain validation rules:**

- The `BaseTaskArtifact` constructor defaults `pageId` and `documentId` to `null`;
  `toJSON()`/`toPartialJSON()` always emit them as `string | null`.
- `StudentSubmissionItem.validateCurrentRawArtifact()` enforces, at marker-1
  restoration, that the artifact carries `taskId` matching the authoritative task
  key, `role: 'submission'`, one of `base`/`TEXT`/`TABLE`/`IMAGE`/`SPREADSHEET`,
  a non-empty string `uid`, and `string|null` `documentId`/`pageId`. Full mode
  additionally requires own `content` and `contentHash` keys, both `null` or both
  present with a string hash, and type-checks the body per variant.
- No `.optional()` relaxation of full artifact `content`/`contentHash` is permitted; a
  missing required field is corruption, not legitimate null content.

**Known discrepancies:**

1. **Full `BaseTaskArtifactFields` requires `pageId`/`documentId` as nullable strings, while the partial `BaseTaskArtifactPartialSchema` accepts them as `.nullable().optional()`.**
   Backend `toJSON()` and `toPartialJSON()` always emit both source IDs as
   `string | null`; `toPartialJSON()` redacts only `content` and `contentHash`.
   The full `getAssignment` schema is the strict contract; the class-detail partial
   schema is intentionally permissive, mirroring the pre-existing optionality of the
   parent `StudentSubmissionPartialSchema.documentId`.
   **Classification: Aligned** — deliberate, scoped asymmetry. The partial path
   accepts an absent key the backend never produces; tightening it is a separate
   decision.

2. **`BaseTaskArtifactPartialSchema` omits `content` and `contentHash` entirely.**
   Backend `toPartialJSON()` emits them as `null`. The frontend partial schema simply
   omits them since null fields are not useful in partial views.
   **Classification: Aligned** — intentional reduction.

3. **`BaseTaskArtifactPartialSchema` does not discriminate on `type`.**
   The full schema is a `z.discriminatedUnion('type', ...)`; the partial schema
   declares `type: z.string()` and a single loose `content`-less shape.
   **Classification: Aligned** — the partial projection has no content to
   discriminate, so the union would add no validation power.

---

## File Index

```
Persistence models:        src/backend/Models/Artifacts/
  ├── 0_BaseTaskArtifact.js
  │     └── BaseTaskArtifact.toJSON()        — full artifact shape with content
  │     └── BaseTaskArtifact.toPartialJSON() — partial shape (content/contentHash = null)
  │     └── BaseTaskArtifact.baseFromJSON()  — deserialisation
  ├── 1_TextTaskArtifact.js                  — 'TEXT' normalisation
  ├── TableTaskArtifact.js                   — 'TABLE' normalisation (50×50 limit)
  ├── SpreadsheetTaskArtifact.js             — 'SPREADSHEET' normalisation
  ├── ImageTaskArtifact.js                   — 'IMAGE' normalisation, setContentFromBlob()
  └── ArtifactFactory.js                     — create() dispatch on type

Parent models:
  ├── src/backend/Models/TaskDefinition.js   — createArtifact(), artifacts.{reference,template}
  └── src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js
        └── StudentSubmissionItem.artifact  — role 'submission'
        └── StudentSubmissionItem.validateCurrentRawArtifact()

Definition-write validation:
  └── src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js
        └── validateSharedArtifacts()

Assignment image pipeline:
  └── src/backend/RequestHandlers/ImageManager.js

Frontend:
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
  │     → BaseTaskArtifactSchema, BaseTaskArtifactFields
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
        → BaseTaskArtifactPartialSchema
```
