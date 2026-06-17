# `getABClass` API Endpoint Specification

## Status

- Draft v1.3
- Updated after third `Planner Reviewer` pass: controller method renamed to leading
  underscore (`_toReadView`) per `ABClassController` convention; "imports" language
  replaced with "references as a global" for shared validation (GAS concatenation
  model); `module.exports` of private controller method removed (test through
  `readClass` instead); `abclassValidation.js` added to ESLint relaxed-rule list;
  `abclassRead.js` exports aligned with `assignmentAssessment.js` precedent (export
  only `{ getABClass_ }`, not the file-local `validateIdentifier_` wrapper);
  `api-layer.md` placement clarified to "immediately after `getABClassPartials`";
  corrupt-document test case added to the controller test expectations; GAS
  load-order note added (function calls are lazy, no numeric prefixes needed).
  Awaiting fourth review (or sign-off).

## Purpose

This document defines the intended behaviour for a new backend API endpoint that returns a single
fully-populated `ABClass` instance by class identifier, for class-detail views in the React
frontend.

The endpoint will be used to:

- load the complete class envelope (metadata, owner, teachers, students, and assignment summaries)
  for a class-detail page in a single call
- enable the frontend to decide per-assignment hydration (full payload via the existing
  `getAssignment` endpoint, partial via the embedded data) without an N+1 round trip for the
  common fields
- provide enough information for the frontend to display per-assignment definition staleness
  using the embedded `definitionKey`, `primaryTopicKey`, and the partial metadata, without
  requiring a separate call to `getAssignmentDefinitionPartials`

This endpoint is **not** intended to:

- return a collection of classes — the existing `getABClassPartials` endpoint already covers the
  list view
- refresh the teacher/student roster from Google Classroom — `ABClassController.loadClass` keeps
  that write-effect behaviour for the assessment-run path; this endpoint is a pure read of
  stored data
- rehydrate any single assignment to its full payload — the existing `getAssignment` endpoint
  is the canonical path for that
- modify any stored data — this is a read endpoint with no storage side effects
- replace the existing `getABClassPartials`, `upsertABClass`, `updateABClass`, or `deleteABClass`
  endpoints

## Agreed product decisions

1. **Method name**: `getABClass` (singular). Takes `{ classId }` and returns one full
   `ABClass` document.
2. **Internal delegation**: a new controller method `ABClassController.readClass(classId)` —
   a pure-read counterpart to the existing `loadClass(classId)`. The new method reads the
   stored document, deserialises it via `ABClass.fromJSON`, applies the private
   `_toReadView` transformation, and returns a transport-ready plain object (not a model
   instance). It does **not** call `_refreshRoster` and does **not** call `_persistRoster`. It
   does **not** perform any Google Classroom API calls.
3. **Response shape**: returns the full class envelope as a plain object: `classId, className,
cohortKey, courseLength, yearGroupKey, classOwner, teachers, students, active` (these come
   from `ABClass.toJSON()`), plus `assignments[]` (which does **not** come straight from
   `ABClass.toJSON()` — see decision 4). Date fields in the embedded `assignments[]` and
   `submissions[]` are ISO 8601 strings (the model layer already serialises them this way;
   no boundary date normalisation is needed at the response root because the root shape
   carries no `Date` fields).
4. **Assignment shape and controller-owned transformation**: `ABClass.toJSON()` serialises each
   assignment via `Assignment.toJSON()` (the **full** shape — `referenceDocumentId`,
   `templateDocumentId`, full `tasks`, full `submissions`). The new endpoint must instead
   return the partial shape (`Assignment.toPartialJSON()` — `documentType` at root, embedded
   `assignmentDefinition` with `tasks: null` and `referenceLastModified` /
   `templateLastModified` omitted, `submissions[]` as `StudentSubmissionItem` partials with
   `artifact.content` and `artifact.contentHash` set to `null` and `assessments[].reasoning`
   stripped). The transformation lives in the **controller** as a private
   `ABClassController._toReadView(abClass)` method, following the
   `getAllClassPartials` controller-level normalisation precedent. The controller's
   `readClass` method returns the transport-ready plain object directly. The transport
   handler is then a thin pass-through: validation, controller call, error catch. The
   controller also performs the defence-in-depth `delete _hydrationLevel` and
   `delete progressTracker` strip on each embedded assignment (currently a no-op because
   neither field is in `Assignment.toPartialJSON()` output, but kept as defence-in-depth
   against a future model change). Full per-assignment payload (artifact content,
   assessment reasoning) is fetched on demand via the existing `getAssignment` endpoint,
   parallelising per-assignment calls in the frontend following the precedent set by
   `SPEC.md` agreed decision 5.
5. **No roster refresh / no storage mutation**: the new endpoint is a pure read. It does not
   re-fetch teacher/student lists from the Classroom API and does not write back to the
   `abclass_partials` registry or the per-class collection. Roster data is whatever was last
   persisted by `loadClass` (called by `AssignmentController.processSelectedAssignment` and
   `startAssessmentRun`) or by `upsertABClass`.
6. **Not-found behaviour**: returns `null` when no persisted class document exists for the
   given `classId`. The handler catches the typed `ClassNotFoundError` thrown by the new
   `ABClassController.readClass` and returns `null`, mirroring the existing `getAssignment`
   and `getAssignmentDefinition` handlers. No new error code is introduced. The handler must
   catch the typed error explicitly because the `apiHandler` dispatcher has no special
   mapping for `ClassNotFoundError` — unmapped errors fall through to `INTERNAL_ERROR`
   (see `src/backend/z_Api/z_apiHandler.js` lines 15–21 and 406–451). Any future endpoint
   that wants the same `null` contract must catch the typed error explicitly too.
7. **Transient field strip**: defence-in-depth `delete` calls remove `_hydrationLevel` and
   `progressTracker` from each embedded assignment in the response. Both fields are
   currently absent from `Assignment.toJSON()` and `Assignment.toPartialJSON()` output (the
   `Assignment.toJSON()` JSDoc says "progressTracker is intentionally not serialised",
   and `_hydrationLevel` is set on the instance by `ABClass.fromJSON` reconstruction but
   not included in the returned object). The strip is therefore a documented no-op today
   and is kept only as defence-in-depth against a future model change that might
   re-introduce these fields — mirroring the `getAssignment` precedent at
   `assignmentAssessment.js` lines 130–134. The strip lives in the controller's
   `_toReadView` method (which owns the wire shape); the transport handler is a thin
   pass-through. Stripping `_hydrationLevel` goes beyond the `getAssignment_` precedent
   (which only strips `progressTracker`), but is added here because
   `ABClass.fromJSON` sets `_hydrationLevel: 'partial'` on each reconstructed
   assignment — so a future change to `Assignment.toPartialJSON()` that included this
   field would otherwise leak into the response.
8. **Method placement**: the new files live in a new `abclass/` domain folder:
   - `src/backend/z_Api/abclass/abclassMutations.js` (moved from `z_Api/abclassMutations.js`,
     existing file unchanged in content, only its location moves)
   - `src/backend/z_Api/abclass/abclassRead.js` (new)
   - `src/backend/z_Api/abclass/abclassValidation.js` (new — shared validation
     primitives for the `abclass/` domain folder, following the
     `assignmentDefinitionValidation.js` precedent)
     The folder structure follows the `AssignmentDefinition/` precedent and is required by
     backend AGENTS §11 ("Create a domain folder when at least 2 files share a common domain
     prefix"). The two `abclass*` files now share the `abclass` prefix, so the rule triggers.
     The new handler is `getABClass_` with thin file-local validation helpers. The existing
     `abclassMutations.js` keeps its current trailing-underscore pattern.

## Existing system constraints

### Backend or API constraints already in place

- `apiHandler` in `z_Api/z_apiHandler.js` is the sole transport entry point. The new method
  must be registered in `ALLOWLISTED_METHOD_HANDLERS` and must follow the
  trailing-underscore private helper pattern.
- All functions callable via `google.script.run` must use the trailing-underscore pattern to
  prevent GAS global exposure. The handler `getABClass_` and the file-local helpers
  (`validateParametersObject_`, `validateIdentifier_`) all use the trailing-underscore
  convention. The `validateParametersObject_` primitive is shared with
  `abclassMutations.js` via the new `abclass/abclassValidation.js` file (see
  §Validation recommendation).
- `Date` objects are prohibited in `google.script.run` return values. The new endpoint's
  response root has no `Date` fields (it emits `classId, className, cohortKey,
courseLength, yearGroupKey, classOwner, teachers, students, active`), so a
  `DateUtils.normaliseDateFields` call at the root would be a vacuous no-op and is
  therefore not used. Nested date fields inside `assignments[]` and `submissions[]`
  rely on the corresponding `toJSON()` implementations (which already emit ISO
  strings). This is a deliberate difference from the `getAssignment_` precedent
  (whose root shape **does** include `Date` fields from `Assignment.toJSON()` and
  therefore does need the normalisation call).
- Transport-boundary validation belongs in the API-layer trailing-underscore helper. Domain
  invariants (non-empty `classId`, integer range checks) belong in the controller.
- `ClassNotFoundError` (`src/backend/Utils/ErrorTypes/ClassNotFoundError.js`) is the typed
  not-found error already in use. The `apiHandler` dispatcher has **no** special mapping
  for it — unmapped errors fall through to `INTERNAL_ERROR` per
  `_mapErrorToFailureEnvelope` (`src/backend/z_Api/z_apiHandler.js` lines 406–451). The
  new `getABClass` handler catches the typed error explicitly and returns `null`. The
  JSDoc on `ClassNotFoundError` should be updated to clarify this contract (see
  §Documentation and rollout notes).
- `ABClassController.loadClass(classId)` already calls `_refreshRoster` (Google Classroom
  fetch) and `_persistRoster` (storage write). The new `readClass` method must not inherit
  either behaviour; it is a pure read.

### Current data-shape constraints

- `ABClass.toJSON()` (lines 272–285 of `src/backend/Models/ABClass.js`) emits the canonical
  full class shape — but the new endpoint does **not** return this directly. The
  `assignments` field of `ABClass.toJSON()` is serialised via `ArrayUtils.serialiseArray`
  which calls `Assignment.toJSON()` (the full shape with `referenceDocumentId`,
  `templateDocumentId`, full `tasks`, and full `submissions`). The new endpoint
  transforms the response in the controller's private `_toReadView` method to replace
  each assignment with its `Assignment.toPartialJSON()` output. See decision 4 for the
  full rationale.
- `Assignment.toPartialJSON()` (lines 116–134 of `src/backend/AssignmentProcessor/Assignment.js`)
  is what the new endpoint will return for each assignment. The redactions
  (`tasks: null`, omitted `referenceLastModified` / `templateLastModified`, redacted
  artifact content and assessment reasoning) are documented in
  `docs/developer/backend/DATA_SHAPES.md` and the `rehydration.md` how-to. They are
  load-bearing and not an oversight.
- `ABClass.fromJSON` (lines 320–364) reconstructs the class from a stored document and rebuilds
  each `assignments[]` entry as a typed `Assignment` instance with `_hydrationLevel: 'partial'`.
  The new `readClass` method should reuse `ABClass.fromJSON` for deserialisation, not roll
  its own.

### Frontend or consumer architecture constraints

- All frontend-to-backend calls must route through `src/frontend/src/services/apiService.ts`
  (`callApi`). The new endpoint is wrapped in a frontend service module
  (`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` and
  the matching Zod schema in `classDetailService.zod.ts`).
- Zod is the validation framework for all new frontend validation logic. The Zod schema is
  defined first, and the TypeScript type is derived from it via `z.infer<typeof ...>`.
- The frontend service follows the existing pattern in
  `src/frontend/src/services/googleClassrooms/classPartialsService.ts`:
  - export a typed async function that calls `callApi(methodName)`
  - validate the parsed envelope `data` through a Zod response schema
  - re-export types via `export type { ... } from './<schema-file>'`
- The class detail query (when added) integrates with the existing
  `src/frontend/src/query/sharedQueries.ts` factory pattern via `queryOptions` and the shared
  `queryKeys` factory.
- The frontend service is added to a new `classDetail/` subfolder:
  - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` (new)
  - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` (new)
  - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`
    (new — Zod schema tests, following the `classPartials.zod.spec.ts` precedent)
  - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts`
    (new — service tests)
    The folder structure follows the `assignmentDefinition/` precedent and is required by
    frontend AGENTS §12 ("Create a subfolder when at least 2 files share a common domain
    prefix"). The new `classDetail*` files share the `classDetail` prefix, so the rule
    triggers. The pre-existing `classPartials*` files in `services/googleClassrooms/` also
    qualify for the rule (3 files sharing the `classPartials` prefix) and should be
    reorganised into a `services/googleClassrooms/classPartials/` subfolder in a follow-up
    delivery — out of scope for this round.

## Domain and contract recommendations

### Why this approach is preferable

- **Pure-read separation of concerns.** A read endpoint should not mutate storage. The
  existing `loadClass` is a write-effect read by design (it keeps the assessment-run path
  self-healing against classroom roster drift), but a frontend class-detail page that opens
  once per navigation should not trigger a Classroom API round trip or a partial-registry
  rewrite on every render. Splitting the read into a new controller method lets each caller
  pick the right behaviour.
- **Consistency with `getAssignment` and `getAssignmentDefinition`.** The new endpoint
  returns `null` on not-found via the same `instanceof` typed-error catch pattern, and uses
  the same `delete transient field` boundary defence pattern (currently a no-op for both
  fields, but kept for consistency with the precedent). A frontend developer reading one
  handler can read the others without context-switching. The `DateUtils.normaliseDateFields`
  call from the precedent is **not** used here because the new endpoint's response root
  has no `Date` fields (unlike `getAssignment` whose root does).
- **Partial assignment shape keeps payload bounded.** `assignments[]` in the response uses
  the partial shape (`Assignment.toPartialJSON()`), so the class envelope stays bounded
  regardless of how many assignments the class has. The controller's private
  `_toReadView` method produces this shape; the transport layer is a thin pass-through
  that does not own the wire shape (it only validates params, calls the controller,
  and catches `ClassNotFoundError`).

### Recommended data shapes

#### `ClassFull` (new frontend type, derived from new Zod schema)

```ts
{
  classId: string,
  className: string | null,
  cohortKey: string | null,
  courseLength: number,
  yearGroupKey: string | null,
  classOwner: TeacherSummary | null,
  teachers: TeacherSummary[],
  students: StudentSummary[],
  assignments: AssignmentPartial[],   // each entry is Assignment.toPartialJSON() shape
  active: boolean | null
}
```

Where `TeacherSummary`, `StudentSummary`, and `AssignmentPartial` are derived from Zod
schemas co-located in
`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`.
`TeacherSummary` matches the existing `classPartials.zod.ts` `TeacherSummarySchema`
(`userId`, `email`, `teacherName`, all nullable). `AssignmentPartial` mirrors
`Assignment.toPartialJSON()` output exactly (lines 116–134 of
`src/backend/AssignmentProcessor/Assignment.js`):

```ts
{
  courseId: string,
  assignmentId: string,
  assignmentName: string,
  dueDate: string | null,             // ISO 8601
  lastUpdated: string | null,          // ISO 8601
  createdAt: string,                   // ISO 8601 (required)
  documentType: 'SLIDES' | 'SHEETS' | null,
  submissions: StudentSubmissionPartial[],   // redacted artifact + stripped assessment reasoning
  assignmentDefinition: AssignmentDefinitionPartial  // partial: tasks: null, no *LastModified
}
```

The Zod schema must match this shape exactly. The canonical reference for the partial
shape is `Assignment.toPartialJSON()` (not `ClassFull` wishful thinking); any drift
between the spec's TypeScript example and the actual backend response is a bug in either
the spec or the implementation and must be reconciled before merge.

### Naming recommendation

Prefer:

- Backend method: `getABClass`
- Backend transport handler: `getABClass_` (trailing underscore)
- Backend controller method: `readClass` (decided — read-only counterpart to `loadClass`)
- Frontend service file: `classDetailService.ts` (in `services/googleClassrooms/classDetail/`)
- Frontend service function: `getABClass({ classId })`
- Frontend Zod schema: `ClassFullSchema`, `ClassFullResponseSchema = ClassFullSchema.nullable()`
  (per frontend AGENTS §8: void-response / null-result schemas must use `.nullable()` because
  the backend `_success()` coerces `undefined → null`)
- Frontend Zod spec test: `classDetailService.zod.spec.ts` co-located with the schema file
  in the new subfolder, following the `classPartials.zod.spec.ts` precedent
- Frontend query key: `['abClass', classId]` (added via `queryKeys.abClass(classId)`)

Avoid:

- `getFullABClass` — verbose, and the existing `getAssignment` precedent is "method name
  describes the entity, not the hydration level"
- `loadClass` for the new controller method — collides with the existing write-effect read
  and would invite callers to assume the same side effects
- `classService.ts` as the new file name — would be too generic and ambiguous within
  `services/googleClassrooms/` (where `classPartialsService.ts` already exists). The chosen
  name `classDetailService.ts` in the new `classDetail/` subfolder makes the domain
  (class-detail) explicit.

### Validation recommendation

#### Frontend

- The frontend service passes `classId` to `callApi` as a non-empty string. The backend
  transport layer is the authoritative validator for transport-level safety (non-empty,
  trimmed, no path characters). The frontend does not duplicate the backend validation; it
  relies on the transport envelope to surface `INVALID_REQUEST` for malformed input.

#### Backend

- The transport helper `getABClass_` enforces:
  - `params` is a plain object (not array, not null/undefined) — shared
    `validateParametersObject_` primitive from the new
    `src/backend/z_Api/abclass/abclassValidation.js` file (the same primitive used by
    `abclassMutations.js` after the file move, so the logic is no longer duplicated
    within the `abclass/` domain folder)
  - `params.classId` is a non-empty, already-trimmed string with no path-traversal
    characters (`..`, `/`, `\`) and no ASCII control characters (code points 0–31 and 127) — reuses `validateSafeTrimmedIdentifier_` from `assignmentDefinitionValidation.js`
    (line 118), exactly the same primitive used by `getAssignment_` via
    `validateIdentifier_` in `assignmentAssessment.js` line 52. A file-local
    `validateIdentifier_(value, fieldName)` wrapper in `abclassRead.js` calls
    `validateSafeTrimmedIdentifier_` with the same `throwValidationError` and error
    message template used in `getAssignment_` (so the wire-level error contract is
    identical). The file-local wrapper exists for GAS-hiding and Node-test access; the
    underlying logic is shared, not duplicated.
- The new `ABClassController.readClass` enforces:
  - `classId` is a non-empty string
  - existence of the stored class collection and the single document within
  - throws `ClassNotFoundError` on miss with the **same message format** as `loadClass`
    (`"loadClass: no stored class found for classId=<classId>"` with structured
    `courseId: <classId>` metadata), matching `loadClass` lines 875–886 exactly. The
    no-distinction contract between missing-collection and missing-document is
    intentional and matches the existing behaviour.
- Corrupt document handling matches `loadClass` precedent — `ABClass.fromJSON` is
  permissive (returns a partial instance for partial input); `readClass` does not add
  additional validation. A class document that exists but is corrupt (e.g. missing
  `classId`) will surface as an `INTERNAL_ERROR` from `ABClass.fromJSON` /
  `_toReadView` rather than as `null` — this is consistent with how `loadClass` behaves
  today.

### Display-resolution recommendation

- `cohortLabel` and `yearGroupLabel` are intentionally **not** in the response, consistent
  with the existing class-partial contract (`docs/developer/backend/DATA_SHAPES.md`). Labels
  are resolved in the frontend view-model from the reference-data queries
  (`getCohortsQueryOptions`, `getYearGroupsQueryOptions`).
- `primaryTopicLabel` (the resolved display label for the assignment's `primaryTopicKey`)
  is also not in the response; the frontend resolves it from the
  `getAssignmentTopicsQueryOptions` data.

## Feature architecture

### Placement

- Backend handler: `src/backend/z_Api/abclass/abclassRead.js` (new file inside the new
  `abclass/` domain folder; thin pass-through — validation, controller call, error catch)
- Backend shared validation file: `src/backend/z_Api/abclass/abclassValidation.js` (new;
  contains the shared `validateParametersObject_` primitive used by both
  `abclassMutations.js` and `abclassRead.js`, following the
  `assignmentDefinitionValidation.js` precedent)
- Backend controller method: `src/backend/y_controllers/ABClassController.js`, new method
  `readClass(classId)` added alongside the existing `loadClass`. `readClass` returns the
  transport-ready plain object via a private `_toReadView(abClass)` method that owns the
  response shape (transformation to partial assignments + defence-in-depth strip).
- Backend allowlist entry: `src/backend/z_Api/z_apiHandler.js`, new entry in
  `ALLOWLISTED_METHOD_HANDLERS`:
  ```js
  getABClass: (parameters) => getABClass_(parameters),
  ```
  with the matching
  `globalThis.getABClass_ = require('./abclass/abclassRead.js').getABClass_;` line in
  the `module.exports` branch (and the existing `abclassMutations_` require path updated
  to `'./abclass/abclassMutations.js'`).
- Frontend service: `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts`
  (new, inside the new `classDetail/` subfolder)
- Frontend Zod schema: `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
  (new)
- Frontend query integration: new factory function `getABClassQueryOptions(classId)` in
  `src/frontend/src/query/sharedQueries.ts` and a new `queryKeys.abClass(classId)` entry in
  `src/frontend/src/query/queryKeys.ts`
- The `ABClassController` decomposition (over 1000 lines, per
  `ABClassControllerRefactor_SPEC.md` v1.0) is a separate concern from the
  endpoint surface but is bundled in this delivery; see the refactor spec
  for details.

### Proposed high-level tree

```text
src/backend/
├── z_Api/
│   ├── abclass/                         (new domain folder per backend AGENTS §11)
│   │   ├── abclassMutations.js          (moved from z_Api/, content unchanged)
│   │   ├── abclassRead.js               (new — getABClass_ handler, thin pass-through)
│   │   └── abclassValidation.js         (new — shared validateParametersObject_)
│   └── z_apiHandler.js                  (modified — new ALLOWLISTED_METHOD_HANDLERS entry
│                                          and updated require path for abclassMutations_)
└── y_controllers/
    └── ABClassController/                 (new folder — decomposed per ABClassControllerRefactor_SPEC.md)
        ├── index.js                       (facade — re-exports ABClassController class)
        ├── ABClassValidation.js           (validation helpers)
        ├── ABClassRoster.js               (Classroom API + refresh/persist roster)
        ├── ABClassAssignmentOps.js        (assignment run persistence + rehydration)
        ├── ABClassPersistence.js          (persistClassAndPartial, upsertClassPartial)
        └── ABClassResponseMapper.js       (normaliseClassPartial, buildClassSummary, _toReadView)

src/frontend/src/
├── services/googleClassrooms/
│   ├── classDetail/                     (new domain subfolder per frontend AGENTS §12)
│   │   ├── classDetailService.ts        (new — getABClass({ classId }))
│   │   ├── classDetailService.zod.ts    (new — ClassFullSchema, response schema)
│   │   ├── classDetailService.zod.spec.ts (new — Zod schema tests)
│   │   └── classDetailService.spec.ts   (new — service tests)
│   ├── classPartialsService.ts          (unchanged — pre-existing rule deviation noted
│                                          in §Planning handoff notes)
│   ├── classPartials.zod.ts             (unchanged)
│   ├── classPartials.zod.spec.ts        (unchanged)
│   └── ... (other googleClassrooms files unchanged)
└── query/
    ├── queryKeys.ts                     (modified — add abClass(classId))
    └── sharedQueries.ts                 (modified — add getABClassQueryOptions)
```

### Out of scope for this surface

- Per-assignment full rehydration — use the existing `getAssignment` endpoint
- Roster refresh from Google Classroom — use the assessment-run path (`startAssessmentRun`)
  or the existing `upsertABClass` flow, not this endpoint
- Re-fetching assignment definitions to check staleness — the embedded partial already
  carries `definitionKey`; the frontend can use the existing `getAssignmentDefinition` on
  demand
- Any visible layout / page changes — the new endpoint is infrastructure for a future
  class-detail page that will get its own layout spec

## Data loading and orchestration

### Required datasets or dependencies

- The single ABClass document stored in the JsonDbApp collection named after the classId
  (i.e. `dbManager.getCollection(classId).findOne({ classId })`)
- No Classroom API calls
- No other collection reads or writes

### Prefetch or initialisation policy

#### Startup

- The new endpoint is not part of the startup warm-up. Class detail is per-route, and the
  frontend's existing `getClassPartialsQueryOptions` already covers the lightweight list
  view at startup.

#### Feature entry

- The class-detail page (when built) calls `getABClassQueryOptions(classId)` lazily on
  navigation. The query factory follows the existing pattern in `sharedQueries.ts` and uses
  the shared `queryKeys.abClass(classId)` factory so per-class cache invalidation works
  consistently with the rest of the app.

#### Manual refresh

- React Query's standard invalidation handles manual refresh. The standard
  `invalidateQueries({ queryKey: queryKeys.abClass(classId) })` pattern works
  without any additional helper.

### Query or transport additions

- New backend transport method: `getABClass` (registered in `ALLOWLISTED_METHOD_HANDLERS`).
- New frontend service function: `getABClass({ classId })` in
  `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts`.
- New frontend query options factory: `getABClassQueryOptions(classId)` in
  `src/frontend/src/query/sharedQueries.ts`.
- New query key factory: `queryKeys.abClass(classId)` in
  `src/frontend/src/query/queryKeys.ts`.
- No new query invalidation infrastructure is needed; React Query's standard
  `invalidateQueries({ queryKey: queryKeys.abClass(classId) })` pattern works.

## Core view model or behavioural model

Not strictly applicable — the response is a single shape derived from the controller's
`ABClass` instance via the controller's private `_toReadView` method. There is no
derived or merged view-model on the frontend in this round (the future class-detail page
will have its own view-model layer).

## Main user-facing surface specification

This is a backend-primary surface. The frontend consumer is a service module + Zod schema +
query factory, with no visible layout changes in this round (the future class-detail page
will get its own layout spec).

### Recommended frontend service interface

```ts
// src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts
export async function getABClass(params: { classId: string }): Promise<ClassFull | null> {
  return ClassFullResponseSchema.parse(await callApi('getABClass', params));
}
```

### Fields, columns, or visible sections

Not applicable for this round — no visible sections are added.

## Workflow specification

Not applicable — this is a single read flow. No multi-step user workflows.

## Error, loading, and empty-state rules

### Blocking failure

- Transport validation failure (non-object `params`, missing `classId`, unsafe characters):
  `INVALID_REQUEST` envelope from `apiHandler`. Frontend surfaces this via the standard
  `apiService` error mapping.
- `ClassNotFoundError` (no stored class for the given `classId`): handler catches the typed
  error and returns `null`; `apiHandler` wraps it in a success envelope with `data: null`.
  Frontend branches on `data === null` (and on `error.code === 'INTERNAL_ERROR'` for
  genuinely unexpected errors). Mirrors `getAssignment` and `getAssignmentDefinition`.
- Other unexpected errors (e.g. corrupt stored document, JsonDbApp collection missing):
  `INTERNAL_ERROR` envelope from `apiHandler`.

### Partial-load or partial-success failure

Not applicable — single read.

### Empty states

- `data: null` from the new endpoint means "class not found". The frontend (in the future
  class-detail page) renders a not-found state and offers a "create class" action.

## Accessibility and usability notes

Not applicable for this round — no visible UI changes.

## Backend changes required

List only the backend changes required by the agreed product contract.

1. **Move existing transport file** (`src/backend/z_Api/abclassMutations.js` →
   `src/backend/z_Api/abclass/abclassMutations.js`):
   - File content is **not fully unchanged**: the file-local `validateParametersObject_`
     helper is removed (replaced with a global reference to the shared primitive in
     the new `abclassValidation.js`, per step 4). The remaining content (handler
     functions, mutation-specific validators, `module.exports` block) is unchanged.
   - The require path in `z_apiHandler.js`'s `module.exports` branch is updated to
     `'./abclass/abclassMutations.js'`.
   - The allowlist entry `upsertABClass: (parameters) => upsertABClass_(parameters),`
     is unchanged (the closure is registered in `ALLOWLISTED_METHOD_HANDLERS` and does
     not require any path change).
   - The path entry in `eslint.config.js` line 209 (the relaxed-rule file list) is
     updated from `'src/backend/z_Api/abclassMutations.js'` to
     `'src/backend/z_Api/abclass/abclassMutations.js'`. Without this update, the moved
     file would lose the relaxed `security/detect-object-injection` rule, and existing
     test fixtures using indexed property access would start failing lint.
2. **New controller method** (`src/backend/y_controllers/ABClassController.js`):
   - Add `readClass(classId)` — pure-read counterpart to `loadClass`. Returns the
     transport-ready plain object (not a model instance).
   - Reads the stored document via `dbManager.getCollection(classId).findOne({ classId })`.
   - Throws `ClassNotFoundError` on missing collection or missing document, mirroring
     `loadClass` lines 875–886 exactly (same message format, same `courseId` metadata).
   - Deserialises via `ABClass.fromJSON(document)` and applies the private
     `_toReadView(abClass)` method.
   - Does **not** call `_refreshRoster`. Does **not** call `_persistRoster`. Does **not**
     make any Google Classroom API calls.
   - Mandatory JSDoc on the new method includes an `@remarks` block stating: _"Pure read
     — does not call `_refreshRoster`, `_persistRoster`, or any Classroom API. Use
     `loadClass` when roster freshness is required. Returns a plain object with
     `assignments[]` as `Assignment.toPartialJSON()` output; the partial shape is
     produced by the private `_toReadView` method."_ This explicit boundary makes the
     semantic difference from `loadClass` discoverable from the type / IDE / docstring
     rather than from reading the method body.
3. **New private controller method `_toReadView(abClass)`** (same file as step 2):
   - Calls `abClass.toJSON()` to get the root shape.
   - Replaces `response.assignments` with each assignment's
     `Assignment.toPartialJSON()` output.
   - Strips `_hydrationLevel` and `progressTracker` from each embedded assignment
     (defence-in-depth; currently a no-op because neither field is in
     `Assignment.toPartialJSON()` output, but kept as defence-in-depth against a
     future model regression).
   - Returns the plain object.
   - Marked as private by **leading underscore** (per the `ABClassController`
     convention — controller private methods all use leading underscore:
     `_applyCourseMetadata`, `_applyTeachers`, `_applyStudents`,
     `_normaliseClassPartial`, `_buildClassSummary`, etc.). The trailing-underscore
     convention is reserved for top-level `z_Api` functions to prevent
     `google.script.run` exposure; it is not appropriate for controller class members.
   - **Not** exported via `module.exports`. Existing controllers (`ABClassController`,
     `AssignmentController`, `AssignmentDefinitionController`,
     `AssignmentDefinitionResponseMapper`) all export only the class itself (e.g.
     `module.exports = ABClassController;`), not individual private methods. The
     transformation is tested through the public `readClass` method: tests construct
     an `ABClass` instance (or set up the collection mock to return a document
     that `ABClass.fromJSON` produces), call `readClass`, and verify the result
     against the expected `Assignment.toPartialJSON()` shape. Direct unit testing
     of the transformation is achieved through the public method, not via separate
     export of the private method.
4. **New shared validation file** (`src/backend/z_Api/abclass/abclassValidation.js`):
   - Defines `validateParametersObject_(parameters, methodName)` (moved from
     `abclassMutations.js` line 18; the moved file references this as a global
     instead of defining its own). Trailing-underscore pattern (it's a top-level
     `z_Api` function). `module.exports` block at the end (for Node test access).
   - In the GAS concatenation model, `abclassValidation.js` is loaded as part of
     the global scope; `abclassMutations.js` and `abclassRead.js` reference
     `validateParametersObject_` via a `/* global validateParametersObject_ */`
     JSDoc hint at the top of the file. The function calls are all inside function
     bodies (lazy), so the concatenation order doesn't affect runtime correctness
     — same pattern as the existing `assignmentDefinitionValidation.js` /
     `assignmentDefinitionTransport.js` pair.
   - Follows the `assignmentDefinitionValidation.js` precedent — shared validation
     primitives for a domain folder.
5. **New transport file** (`src/backend/z_Api/abclass/abclassRead.js`):
   - Add `getABClass_(parameters)` handler as a thin pass-through.
   - References `validateParametersObject_` from `abclassValidation.js` as a global
     (via `/* global validateParametersObject_ */`). Does **not** use `require` or
     `import` — backend AGENTS §1.1 forbids Node wiring in production backend files.
   - Has a file-local `validateIdentifier_(value, fieldName)` wrapper that calls
     `validateSafeTrimmedIdentifier_` from `assignmentDefinitionValidation.js`
     (line 118) with the same `throwValidationError` and error message template used
     in `getAssignment_` (`assignmentAssessment.js` line 52), so the wire-level error
     contract is identical.
   - Calls `new ABClassController().readClass(parameters.classId)` and returns the
     result. The controller owns the response shape (per step 2 + step 3).
   - Catches `ClassNotFoundError` via `instanceof` and returns `null`.
   - Does **not** call `DateUtils.normaliseDateFields` at the response root — the root
     shape has no `Date` fields by inspection (`classId, className, cohortKey,
courseLength, yearGroupKey, classOwner, teachers, students, active` are all strings,
     numbers, arrays, or null), so a normalisation call would be a vacuous no-op. Nested
     date fields inside `assignments[]` and `submissions[]` are already ISO strings from
     the corresponding `toJSON()` / `toPartialJSON()` implementations.
   - Logs `info` on successful read, `warn` on not-found, `error` on other failures —
     mirroring the `getAssignment_` log levels at `assignmentAssessment.js` lines 122,
     147, 150.
   - Exports the handler via a guarded `if (typeof module !== 'undefined' &&
module.exports)` block. Exports: `{ getABClass_ }` only. This aligns with the
     `assignmentAssessment.js` precedent (which exports only
     `{ startAssessmentRun_, getAssignment_ }` — not the file-local `validateIdentifier_`
     wrapper). The file-local `validateIdentifier_` is a thin wrapper around
     `validateSafeTrimmedIdentifier_` (which is already exported and tested via
     `assignmentDefinitionValidation.js`); it doesn't need a separate export. Tests
     exercise the validation through `getABClass_` (the integration is the test
     target).
6. **Allowlist entry** (`src/backend/z_Api/z_apiHandler.js`):
   - Add `getABClass: (parameters) => getABClass_(parameters),` to
     `ALLOWLISTED_METHOD_HANDLERS`.
   - Add `globalThis.getABClass_ = require('./abclass/abclassRead.js').getABClass_;` to
     the `module.exports` branch (the test-harness wiring block).
   - Update the existing `abclassMutations_` require path in the same `module.exports`
     branch from `'./abclassMutations.js'` to `'./abclass/abclassMutations.js'`. This
     path change is part of the file move in step 1.
7. **ESLint config update** (`eslint.config.js`):
   - The relaxed-rule file list at lines 192–212 (the array currently containing
     `'src/backend/z_Api/abclassMutations.js'`, `'src/backend/z_Api/z_apiHandler.js'`,
     and others) is updated:
     - Change the existing entry `'src/backend/z_Api/abclassMutations.js'` to
       `'src/backend/z_Api/abclass/abclassMutations.js'` (per step 1's file move).
     - Add the new entry `'src/backend/z_Api/abclass/abclassRead.js'` to the same
       array. The new transport file uses the same mock-fixture pattern (mock
       controller instances, indexed property access in test assertions) and needs
       the same relaxed `security/detect-object-injection` rule.
     - Add the new entry `'src/backend/z_Api/abclass/abclassValidation.js'` to the
       same array. The new shared validation file uses the same mock-fixture pattern
       (mock error params, indexed property access on the test fixtures) and needs
       the same relaxed rule.
   - Without these updates, the moved file and the new files would lose the
     relaxed rule and existing test fixtures using indexed property access would
     start failing lint.
8. **Documentation update** (`src/backend/Utils/ErrorTypes/ClassNotFoundError.js`):
   - Update the JSDoc to clarify that the `apiHandler` dispatcher has **no** special
     mapping for `ClassNotFoundError` — unmapped errors fall through to
     `INTERNAL_ERROR` per `_mapErrorToFailureEnvelope` (see
     `src/backend/z_Api/z_apiHandler.js` lines 406–451). The new `getABClass` handler
     catches the typed error explicitly and returns `null`; any future endpoint that
     wants the same `null` contract must do the same. Replace the existing "maps to
     `INTERNAL_ERROR` at the transport boundary (via the dispatcher's fallback path)
     since `loadClass` is not directly callable from the frontend" sentence with this
     clearer wording.

## Planning handoff notes

Use this section only for constraints that the later action plan must respect.

- The new `z_Api/abclass/` domain folder is created as part of this delivery. The
  `abclassMutations.js` file is moved into the folder; its content is unchanged (except
  the `validateParametersObject_` helper is removed and replaced with an import from
  the new `abclassValidation.js`). The `abclassRead.js` and `abclassValidation.js`
  files are new. Per backend AGENTS §11 the domain folder is required because two
  files now share the `abclass` prefix.
- The new `ABClassController.readClass` method sits alongside `loadClass` in the same
  file initially. The `ABClassController` decomposition (per
  `ABClassControllerRefactor_SPEC.md` v1.0) is bundled in this delivery;
  `readClass` and `_toReadView` land in the new structure from day one
  (`readClass` on the facade, `_toReadView` on `ABClassResponseMapper`).
- The response shape is owned by the controller. `readClass` returns a transport-ready
  plain object via the private `_toReadView(abClass)` method. The transport handler is
  a thin pass-through (validation, controller call, `ClassNotFoundError` catch). This
  follows the `getAllClassPartials` controller-level normalisation precedent and the
  `getAssignmentDefinition_` pattern of calling a controller method that returns the
  shaped response.
- The frontend Zod schema is the source of truth for the response shape; the schema is
  written first and the TypeScript type is derived via `z.infer<typeof ...>` per frontend
  AGENTS §8. The Zod schema must match `Assignment.toPartialJSON()` output exactly
  (lines 116–134 of `src/backend/AssignmentProcessor/Assignment.js`); any drift between
  the spec's TypeScript example and the actual backend response is a bug in either the
  spec or the implementation and must be reconciled before merge.
- The response schema uses `.nullable()` on the outer schema (per frontend AGENTS §8: void
  / null-result response schemas must use `.nullable()` to accept `null` from the backend
  envelope).
- The query factory pattern uses `queryOptions` and the shared `queryKeys` factory per
  frontend AGENTS §2.2. The new entry follows the existing
  `queryKeys.assignmentDefinitionByKey(definitionKey) → ['assignmentDefinition',
definitionKey]` shape:
  ```ts
  queryKeys.abClass: (classId: string) => ['abClass', classId]
  ```
  And the new query options factory follows the existing
  `getAssignmentDefinitionQueryOptions(definitionKey)` pattern:
  ```ts
  export function getABClassQueryOptions(classId: string) {
    return queryOptions({
      queryKey: queryKeys.abClass(classId),
      queryFn: () => getABClass({ classId }),
    });
  }
  ```
- The new frontend service is added to a new
  `src/frontend/src/services/googleClassrooms/classDetail/` subfolder. The pre-existing
  `classPartials*` files in `services/googleClassrooms/` also qualify for the
  subfolder rule (3 files sharing the `classPartials` prefix) and should be reorganised
  into a `services/googleClassrooms/classPartials/` subfolder in a follow-up delivery —
  out of scope for this round. This is a pre-existing rule deviation that this delivery
  does not fix.
- The shared `validateSafeTrimmedIdentifier_` helper is reused. The file-local
  `validateIdentifier_` wrapper in `abclassRead.js` exists for GAS-hiding
  (trailing-underscore pattern); the underlying identifier validation logic is
  shared, not duplicated. The wrapper is **not** exported (per step 5); it is
  exercised through `getABClass_` in tests.
- The `validateParametersObject_` primitive is shared between `abclassMutations.js` and
  `abclassRead.js` via the new `abclassValidation.js` file (following the
  `assignmentDefinitionValidation.js` precedent). Both files reference the
  shared function as a global (via `/* global validateParametersObject_ */`
  JSDoc hint at the top of each file), not via `require` / `import` — backend
  AGENTS §1.1 forbids Node wiring in production backend files. Neither file
  defines its own copy. This avoids per-domain duplication per backend AGENTS
  §0.2 rule 3.
- **GAS load-order note**: the GAS concatenation model merges all backend files
  into a single global scope. The function calls across the new `abclass/`
  folder files (`abclassValidation.js`, `abclassMutations.js`, `abclassRead.js`)
  are all inside function bodies (lazy), so concatenation order does not affect
  runtime correctness — same pattern as the existing
  `assignmentDefinitionValidation.js` / `assignmentDefinitionTransport.js`
  pair (alphabetically the transport file loads before the validation file, yet
  the transport file's `upsertAssignmentDefinition_` calls
  `validateUpsertParameters_` from the validation file at runtime without
  issue). No numeric prefixes are required for the new `abclass/` folder; the
  builder's `localeCompare`-based alphabetical ordering is sufficient. Numeric
  prefixes are a defensive measure documented in backend AGENTS §1.2 for cases
  where the dependency is eager (top-level call), which is not our case.
- The new `readClass` method's corrupt-document behaviour follows `loadClass` precedent:
  `ABClass.fromJSON` is permissive; corrupt documents surface as `INTERNAL_ERROR`, not
  as `null`. The implementation should not add extra validation that would change this.

## Testing expectations

- Backend model tests (controller layer):
  - `tests/controllers/abclassController.readClass.test.js` — new test file covering:
    - RED: `readClass` does not exist yet (exported as `undefined`)
    - GREEN: `readClass` returns the transport-shaped plain object (not a model
      instance) for a stored class document
    - `readClass` throws `ClassNotFoundError` when the collection is missing
    - `readClass` throws `ClassNotFoundError` when the document is missing
    - `readClass` does **not** call `ClassroomApiClient.fetchCourse`, `fetchTeachers`, or
      `fetchAllStudents` (no Classroom API round trip)
    - `readClass` does **not** call `dbManager.getCollection(...).insertOne`, `replaceOne`,
      `updateOne`, or `save` (no storage mutation)
    - `readClass` throws `ClassNotFoundError` with the same message format and
      `courseId` metadata as `loadClass` for both missing-collection and
      missing-document cases (no distinction between the two)
    - `readClass`'s returned plain object has `assignments[]` as `Assignment.toPartialJSON()`
      output (not full `toJSON()` output) — this verifies the `_toReadView` transformation
      is wired correctly
    - The returned plain object has `_hydrationLevel` and `progressTracker` stripped from
      each embedded assignment (defence-in-depth; documents that the strip is a no-op
      today because neither field is in the serialised output of
      `Assignment.toPartialJSON()`)
    - `readClass` surfaces corrupt documents as `INTERNAL_ERROR` rather than as
      `null`. Test case: stored document exists but is corrupt (e.g. missing
      `classId`, malformed `assignments` array that causes `Assignment.fromJSON` →
      `toPartialJSON()` to throw). The error surfaces inside `_toReadView` (not
      `ABClass.fromJSON`, which is permissive and returns a partial instance for
      partial input). The behaviour matches `loadClass` — corrupt documents are
      not converted to `null`; they surface as errors. This test case locks the
      contract so a future change to `_toReadView` or `toPartialJSON` cannot
      silently alter the error surface.
  - `tests/controllers/abclassController.toReadView.test.js` (or merged into the
    `readClass` test file) — covers the `_toReadView` transformation in isolation
    against a representative `ABClass` instance, verifying that the partial assignment
    shape, the defence-in-depth strip, and the root fields are all correct.
- Backend shared validation tests:
  - `tests/backend-api/abclassValidation.unit.test.js` (or extended into the existing
    `abclassMutations.unit.test.js`) — covers the shared `validateParametersObject_`
    primitive, including the cases the existing per-file tests already cover.
- Backend API tests (transport layer):
  - `tests/api/abclassRead.test.js` — new test file covering:
    - `getABClass_` is exported in Node test runtime (only `getABClass_` is
      exported, matching the `assignmentAssessment.js` precedent)
    - `getABClass_` rejects non-object, `null`, and `undefined` `params` with
      `ApiValidationError`
    - `getABClass_` rejects missing `classId` with `ApiValidationError`
    - `getABClass_` rejects untrimmed `classId` with `ApiValidationError`
    - `getABClass_` rejects `classId` with path-traversal characters (`..`, `/`, `\`) with
      `ApiValidationError`
    - `getABClass_` rejects `classId` with ASCII control characters (code points 0–31 and 127) with `ApiValidationError`
    - `getABClass_` returns the controller's shaped response on success (the transport
      is a pass-through, so the test verifies identity / deep equality, not
      transformation)
    - `getABClass_` returns `null` when the controller throws `ClassNotFoundError`
    - `getABClass_` re-throws other controller errors loudly (no defensive catch-and-ignore)
    - The handler does **not** call `DateUtils.normaliseDateFields` at the response root
      (the response root has no `Date` fields; documenting this is part of the contract)
- Backend API test for the moved `abclassMutations.js` and shared validation refactor:
  - The existing `tests/api/abclassMutations.test.js` is updated to require from the
    new path `'../../src/backend/z_Api/abclass/abclassMutations.js'`. No assertion
    changes; only the require path moves.
  - The same path move is applied to `tests/api/apiHandler/shared.js` (line 15) and
    `tests/backend-api/abclassMutations.unit.test.js` (lines 2 and 8). Confirmed by
    `grep -rn "z_Api/abclassMutations.js" tests/`; these are the only three matches.
- Frontend service tests:
  - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts` —
    new test file covering:
    - `getABClass` delegates to `callApi` with the `getABClass` method name and the
      supplied `{ classId }`
    - `getABClass` parses the response through `ClassFullResponseSchema` and returns a
      typed `ClassFull`
    - `getABClass` returns `null` when the backend returns `data: null`
    - `getABClass` propagates Zod parse errors loudly
- Frontend Zod schema tests:
  - `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts` —
    new test file covering the schema validation in isolation (happy path, missing
    required field, wrong type, null-result shape accepts `null`).
- Frontend query tests:
  - The new `getABClassQueryOptions` factory is covered by the existing
    `src/frontend/src/query/sharedQueries.query.spec.tsx` patterns, following the
    precedent set for `getAssignmentDefinitionQueryOptions`.
- Backend sub-class unit tests (refactor, per `ABClassControllerRefactor_SPEC.md`):
  - `tests/controllers/ABClassController/ABClassValidation.unit.test.js`
  - `tests/controllers/ABClassController/ABClassRoster.unit.test.js`
  - `tests/controllers/ABClassController/ABClassAssignmentOps.unit.test.js`
  - `tests/controllers/ABClassController/ABClassPersistence.unit.test.js`
  - `tests/controllers/ABClassController/ABClassResponseMapper.unit.test.js`
    These 5 new test files cover each sub-class in isolation, following the
    `AssignmentDefinition/` precedent. The existing controller test suite (14+ files)
    serves as the regression net — no assertion changes are required.
- No Playwright E2E tests are added in this round (no visible UI changes).

## Documentation and rollout notes

- `docs/developer/backend/api-layer.md` — add a new bullet to the "Current migrated
  endpoints" section, **immediately after** the existing `getABClassPartials` entry.
  (Avoid "after X and before Y" wording when X and Y are not adjacent in the
  current file — other entries sit between them today, and the spec instruction
  should not depend on those intermediate entries. The new entry goes in the
  `getABClass*` cluster.) Mirror the `getABClassPartials` format: source file path,
  controller delegation, validation rules, response shape, not-found behaviour, and
  frontend wrapper reference. Include the explicit note that the response shape is
  produced by the controller's private `_toReadView` method, which calls
  `ABClass.toJSON()` and replaces each assignment with `Assignment.toPartialJSON()`
  output (so the doc explains why the response shape differs from a raw
  `ABClass.toJSON()`). Do **not** include hardcoded line numbers in the new entry;
  reference the existing entries by name so the placement instruction remains valid
  as the file evolves.
- `docs/developer/backend/DATA_SHAPES.md` — add a new section after the existing
  "ABClassPartials" section titled "ABClass full-read (`getABClass` response)".
  Document the response shape with the same depth as the existing class-partial section.
  Include the explicit note that `assignments[]` uses `Assignment.toPartialJSON()`
  output (same as the embedded definition in `abclass_partials`), and that the
  redactions documented in `docs/howTos/rehydration.md` apply. The canonical reference
  for the partial assignment shape is `Assignment.toPartialJSON()` (lines 116–134 of
  `src/backend/AssignmentProcessor/Assignment.js`).
- `src/backend/Utils/ErrorTypes/ClassNotFoundError.js` — replace the JSDoc paragraph that
  currently says _"This error maps to INTERNAL_ERROR at the transport boundary (via the
  dispatcher's fallback path) since loadClass is not directly callable from the frontend"_
  with a clearer paragraph that:
  - notes the `apiHandler` dispatcher has **no** special mapping for `ClassNotFoundError`
    (see `_mapErrorToFailureEnvelope` in `src/backend/z_Api/z_apiHandler.js` lines
    406–451) — unmapped errors fall through to `INTERNAL_ERROR`
  - states that the new `getABClass` handler in
    `src/backend/z_Api/abclass/abclassRead.js` catches the typed error explicitly and
    returns `null` (so the structured `courseId` metadata is available in execution logs
    for developer diagnostics but is not exposed to the frontend as an error code)
  - notes that any future endpoint wanting the same `null`-on-not-found contract must
    catch the typed error explicitly
- No migration is required. The new endpoint is additive; existing endpoints are
  unchanged. The `abclassMutations.js` file move is a location-only change; its content
  and the wire-level error contract for `upsertABClass`/`updateABClass`/`deleteABClass`
  are unchanged (the `validateParametersObject_` helper moves from
  `abclassMutations.js` to `abclassValidation.js` but the validation contract is
  identical).
- The `ABClassController` decomposition (from ~996 lines to a facade + 5
  sub-classes per `ABClassControllerRefactor_SPEC.md` v1.0) is bundled in
  this delivery. The `readClass` and `_toReadView` methods added by this
  spec land in the new structure from day one (`readClass` on the facade,
  `_toReadView` on `ABClassResponseMapper`). The decomposition's only
  externally visible change is the file path of the controller module;
  the public API is preserved.

## V1 scope recommendation

### Include in v1

- Backend: new `ABClassController.readClass` method (with mandatory `@remarks` block
  making the pure-read intent explicit) plus a private `_toReadView` helper that
  owns the response shape (assignments as `toPartialJSON()` + defence-in-depth strip)
- Backend: move `abclassMutations.js` into a new `z_Api/abclass/` domain folder
  (removing the file-local `validateParametersObject_` and referencing it as a global
  defined in the new shared `abclassValidation.js`)
- Backend: new `src/backend/z_Api/abclass/abclassRead.js` (thin pass-through — references
  the shared `validateParametersObject_` global from `abclassValidation.js`; has a
  file-local `validateIdentifier_` wrapper that reuses `validateSafeTrimmedIdentifier_`
  from `assignmentDefinitionValidation.js`)
- Backend: new `src/backend/z_Api/abclass/abclassValidation.js` (shared validation
  primitive for the `abclass/` domain folder)
- Backend: `ALLOWLISTED_METHOD_HANDLERS` entry + test-harness wiring (with updated
  require path for `abclassMutations_`)
- Backend: `eslint.config.js` path update for the moved and new files
- Backend: tests for the new controller method, the `_toReadView` transformation,
  the shared `validateParametersObject_`, and the transport handler
- Frontend: new
  `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.ts` and
  matching Zod schema and spec file
- Frontend: new `getABClassQueryOptions` factory in `sharedQueries.ts` + `queryKeys.abClass`
- Frontend: tests for the new service module and Zod schema
- Documentation: api-layer.md entry, DATA_SHAPES.md section, ClassNotFoundError JSDoc
  update
- Backend: `ABClassController` decomposition into a facade + 5 sub-classes
  (per `ABClassControllerRefactor_SPEC.md` v1.0; the `readClass` and
  `_toReadView` methods land in the new structure from day one)

### Defer from v1

- Per-assignment full rehydration — use existing `getAssignment` endpoint
- Roster refresh on read — use the assessment-run path or `upsertABClass`
- Reorganising the pre-existing `classPartials*` files into a subfolder (out of scope;
  follow-up delivery)
- Any visible class-detail page (out of scope for this round; will get its own layout spec)

## Open questions

1. **Decided**: controller method name is `readClass` (rationale: pure-read counterpart to
   `loadClass`; mandatory `@remarks` block makes the semantic difference explicit). No
   blocker.
2. **Decided**: Zod spec test file is `classDetailService.zod.spec.ts`, co-located with
   the schema file in the new subfolder. No blocker.
3. **Decided**: the new query key is **not** part of the `startupWarmup` set; the new
   query is per-class, not a global list. No blocker.
4. **Decided**: the response uses `Assignment.toPartialJSON()` for each assignment via a
   private `ABClassController._toReadView(abClass)` helper. The controller owns the
   response shape (following the `getAllClassPartials` controller-level normalisation
   precedent); the transport handler is a thin pass-through. Recorded as decision 4
   in the agreed product decisions above.
