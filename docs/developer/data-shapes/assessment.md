# Component Shape: Assessment

A single criterion result (`completeness`, `accuracy`, `spag`) attached to a
`StudentSubmissionItem`, plus the assessment-stage discipline that produces and
validates those results. Embedded inside the Assignment contract; never persisted or
transported independently.

Backend model: `src/backend/Models/Assessment.js`
Assessment-stage producer: `src/backend/RequestHandlers/LLMRequestManager.js` (terminal outcomes, shared live/cache numeric validation, internal cache identity)
Generic cache: `src/backend/RequestHandlers/CacheManager.js` (generic best-effort `get`/`put` and the shared `CACHE_EXPIRY_SECONDS`)
Completed-write gate: `src/backend/y_controllers/ABClassController/ABClassAssignmentValidation.js`
Current-format restoration: `src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js`
Collections: none — embedded in `assign_full_<courseId>_<assignmentId>` only
API handlers: none — no standalone endpoints
Frontend Zod (full consumer): `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` → `AssessmentSchema` (aliases `assessmentResultSchema`)
Frontend Zod (partial consumer): `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` → `PartialAssessmentEntrySchema` (aliases `partialAssessmentResultSchema`)
Frontend Zod (shared owner): `src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts` → `assessmentResultSchema`, `partialAssessmentResultSchema`, `assessmentCauseSchema`

Sibling contracts:

- [Contract: Assignment](assignment.md) — **origin**. `StudentSubmissionItem.assessments` holds this shape; the `assessmentContractVersion` marker, write boundary and legacy read preparation live there.
- [Contract: Student Submission](student-submission.md) — owns `StudentSubmissionItem`, whose `setError()` is the atomic all-three-criteria failure primitive this shape's catalogue feeds.
- [Contract: BaseTaskArtifact](base-task-artifact.md) — supplies the `contentHash` this shape's cache identity and template-match `N` decisions depend on.
- [Contract: ABClass](abclass.md) — embeds the partial assessment entry inside class-embedded assignment partials.
- [Transport envelope](transport-envelope.md) — this shape never forms a top-level `data` payload.

---

## Persistence

Participates in the `assign_full_<courseId>_<assignmentId>` document through
`StudentSubmissionItem.toJSON()` / `toPartialJSON()`. There is no collection of its own.

`Assessment.toJSON()` emits:

| #   | Field       | Type                                     | Persistence        | Transport | Frontend Zod                                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                |
| --- | ----------- | ---------------------------------------- | ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `score`     | `number \| 'N' \| 'E'`                   | included           | unchanged | Shared `assessmentResultSchema` (consumed by `AssessmentSchema`): `z.union([z.number().min(0).max(5), z.literal('N')])` for the non-E branch, `z.literal('E')` for E. Zod 4 `z.number()` already rejects NaN and `±Infinity`. | Numeric scores must be finite and inclusive 0–5; fractions are valid. `'N'` remains genuine not-attempted/not-applicable evidence. `'E'` is an explicit error result and carries a cause. NaN, `±Infinity` and out-of-range values are rejected by the constructor and `fromJSON()`. |
| 2   | `reasoning` | `string`                                 | included           | unchanged | Shared `assessmentResultSchema`: `z.string()` for non-E, `z.string().refine((value) => value.trim().length > 0)` for E.                                                                                                       | Required string for every result. Numeric/`'N'` reasoning may be empty. `E` reasoning must be non-blank; the stored value is preserved verbatim, including surrounding whitespace, and is never trimmed or rewritten.                                                                |
| 3   | `error`     | `{ stage: ErrorStage; code: ErrorCode }` | emitted only for E | unchanged | Shared `assessmentCauseSchema`: strict discriminated union by `stage`, with the exact catalogue codes below.                                                                                                                  | Non-`E` results must omit `error`; the constructor and `fromJSON()` reject error metadata on numeric/`'N'` results. `toJSON()` emits a detached copy, not the caller's object. No history, timestamp, retry ledger or stack trace is stored.                                         |

Cause catalogue (exact pairs; no raw exception interpolation):

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

`PARSE_FAILED` is a reserved catalogue code with no forced producer.

### Partial variant

In `StudentSubmissionItem.toPartialJSON()`, `_stripAssessmentReasoning()` keeps numeric
and `'N'` entries score-only but preserves an `'E'` entry with its `reasoning` and
`error`. The shared `partialAssessmentResultSchema` validates this union.

| Assessment kind | Partial entry                      | Notes                                                                                      |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Numeric         | `{ score: number }`                | Heavy reasoning remains stripped for successful numeric results.                           |
| `N`             | `{ score: 'N' }`                   | Genuine not-attempted evidence stays score-only.                                           |
| `E`             | `{ score: 'E', reasoning, error }` | A task failure must not lose its explanation when the item is embedded in a class partial. |

Key notes:

- `new Assessment(score, reasoning, error)` and `Assessment.fromJSON(json)` validate the
  union. They reject NaN/`±Infinity`, numeric scores outside 0–5, `E` without a valid
  cause or with blank reasoning, malformed causes, non-string reasoning, and `error`
  metadata on numeric/`'N'` results.
- `Assessment.createError(stage, code)` constructs an `E` result using the catalogue's
  canonical reasoning; an unknown stage/code pair throws. A caller may also construct
  `E` directly with the same valid cause and its own non-blank reasoning.
- `fromJSON()` ignores unrelated extra fields but still validates `score`, `reasoning`
  and `error`; it never silently repairs an invalid result.
- `SheetsAssessor` writes no non-Assessment `assessments.formulaComparison` value.
  Transient formula-comparison results remain assessor-local, and existing
  cell-reference feedback remains in `feedback` (`CellReferenceFeedback`).
- Definition parse failures stay outside Assessment: duplicate reference/template title
  tags continue to block definition parsing on the existing definition error surface and
  safe cause; no student-level `DUPLICATE_TAG` `E` is introduced under the first-match
  policy.

### Legacy `submissions` preservation

Implemented. A legacy (non-marker-1) record's present `submissions` value keeps its stored
shape through restoration, `toJSON()`, `toPartialJSON()` and an ordinary class save: an array
is preserved as stored, explicit `null` stays `null` (never `[]`), a plain object is emitted
as an independently owned date-normalised copy (never `[]`), and only an absent property keeps
the constructor's `[]`. The original stored `assessmentContractVersion` presence/value is
preserved alongside it. Marker-1 records are unchanged: their root still requires an array.
The full rule table lives in
[Contract: Assignment § Legacy `submissions` preservation](assignment.md#legacy-submissions-preservation).

---

## Transport

This shape has no standalone endpoint. It is transported only inside the two Assignment
read payloads:

| Embedding boundary                                   | Projection                              | Transformation applied                                                                                             |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `getAssignment` (`Assignment.toReadJSON()`)          | `StudentSubmissionItem.toJSON()`        | None. Validated by `AssessmentSchema`.                                                                             |
| `getABClass` (`ABClassResponseMapper._toReadView()`) | `StudentSubmissionItem.toPartialJSON()` | Numeric/`'N'` reasoning stripped; `'E'` reasoning and cause retained. Validated by `PartialAssessmentEntrySchema`. |

Key contract notes:

- `AssessmentSchema` aliases `assessmentResultSchema` and `PartialAssessmentEntrySchema`
  aliases `partialAssessmentResultSchema`, so both read schemas enforce the finite
  fractional 0–5 range, the `'E'` branch and the non-blank E reasoning refinement. Both
  read services run the read normaliser, so the contextual item/source checks are active
  at runtime; see [Known discrepancies](#validation).
- The transport never renames or defaults an assessment field. Partial reasoning
  stripping happens in the model, not at the boundary.

---

## Sub-entities

None. This shape embeds no other shape; `error` is an inline `{ stage, code }` object.

---

## Validation

**Frontend Zod:**

- `src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts` (shared
  result/cause owner; consumed by both read schemas):
  - `assessmentCauseSchema` — strict stage/code catalogue union.
  - `assessmentResultSchema` — full `number | 'N' | 'E'` union with finite 0–5 numeric
    range, required reasoning and `E`-only cause.
  - `partialAssessmentResultSchema` — numeric/`'N'` score-only entries, plus `E` entries
    retaining reasoning and cause.
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts` →
  `AssessmentSchema` aliases `assessmentResultSchema`.
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts` →
  `PartialAssessmentEntrySchema` aliases `partialAssessmentResultSchema`.
  `classDetailService.zod.ts` declares no `MAX_ASSESSMENT_SCORE`,
  `PartialAssessmentScoreSchema` or `PartialAssessmentScore`; the shared owner is the
  single declaration.

**Backend validation:**

- `Assessment` constructor and `Assessment.fromJSON()` — the union above. The constructor
  builds the candidate entry and delegates to `Assessment.isValidRawResult()`; it holds no
  separate validation logic, so the accept/reject rules have one owner.
- `Assessment.isValidCause()` — strict two-key `{ stage, code }` object present in the
  catalogue.
- `Assessment.isValidRawScore()` / `isValidRawResult()` — raw-entry validation used by the
  constructor, the LLM response validator and marker-1 restoration.
- `Assessment.CRITERIA` — the canonical criteria list (`completeness`, `accuracy`, `spag`),
  assigned after the class definition. It is the single owner of criterion identities:
  `StudentSubmissionItem.setError()`, the LLM response and cache validators, the image
  terminal-error check, the completed-write gate and marker-1 restoration all read it
  rather than declaring their own list. `ABClassMetadata` derives a superset at call time
  (`[...Assessment.CRITERIA, 'overall']`) because that file sorts before
  `Models/Assessment.js` in the concatenated script, so a module-level copy would read the
  class before it is defined.
- `ABClassAssignmentValidation._validateCompletedAssignmentRun()` — completed-write
  gate requiring exactly the three canonical criteria as valid complete results.

**Key domain validation rules:**

- `setError(stage, code)` on `StudentSubmissionItem` is the atomic task-wide failure
  primitive: it writes the catalogue `E` result for every entry in `Assessment.CRITERIA`
  and clears feedback. An incomplete or extra-key criterion map is a read-time isolation
  case (below) and a completed-write rejection.
- Read-time criterion corruption is isolated per item on both full and partial marker-1
  reads: `AssignmentCurrentRestoration` replaces an item whose criterion map is
  incomplete or contains an extra key with all three validation `CORRUPT_RECORD` `E`
  entries (same `stage`, `code` and reasoning), preserving healthy sibling items. It
  does not drop the item or salvage marks. Completed persistence rejects such a record
  at the write boundary. The browser normaliser implements the equivalent isolation and
  is invoked by both read services. Legacy reads use the same current-format criterion
  isolation through read preparation rather than a separate placeholder rule.
- Assessment-stage `E` results retain the successfully extracted source content; a
  marking failure does not imply unavailable source content. See
  [Contract: Student Submission § Source artefact content and hash semantics](student-submission.md#source-artefact-content-and-hash-semantics).

**Known discrepancies:**

1. **Full and partial consumer schemas match the implemented `Assessment` range and `E` union.**
   `AssessmentSchema` aliases the shared `assessmentResultSchema` and
   `PartialAssessmentEntrySchema` aliases `partialAssessmentResultSchema`. Both enforce
   finite fractional 0–5, `'N'`, and `'E'` with non-blank reasoning plus a catalogue
   cause. A full or partial backend result the shared schema accepts is not rejected by
   the consumer schemas.
   **Classification: Aligned**.

2. **Partial projection retains `E` reasoning/cause and the partial consumer accepts it.**
   `StudentSubmissionItem.toPartialJSON()` preserves an `'E'` entry intact
   (`{ score: 'E', reasoning, error }`) while numeric and `'N'` entries remain
   `{ score }`. `PartialAssessmentEntrySchema` aliases `partialAssessmentResultSchema`,
   so a class-embedded `E` validates with its explanation.
   **Classification: Aligned**.

3. **The shared result/cause owner is consumed by both read schemas and both read services run the normaliser.**
   `assessmentResult.zod.ts` is consumed by `assignmentAssessment.zod.ts` and
   `classDetailService.zod.ts`. `assignmentAssessmentService.getAssignment()` calls
   `normaliseAssignmentRead()` and `classDetailService.getABClass()` calls
   `normaliseClassRead()` before their final `parseApiResponse` call, each preceded by a
   root-only parse. Per-item isolation and contextual source/marker checks are active at
   runtime.
   **Classification: Aligned**.

4. **Duplicate partial score declarations are absent.**
   `classDetailService.zod.ts` declares no `MAX_ASSESSMENT_SCORE`,
   `PartialAssessmentScoreSchema` or `PartialAssessmentScore`;
   `PartialAssessmentEntrySchema` aliases the shared result owner. The one cross-module
   consumer, `tests/synthetic-analysis/syntheticGraphIntegrityAndScenarios.test.ts`,
   uses `assessmentScoreSchema` and retains its non-`E` assertions.
   **Classification: Aligned** — a single result-schema owner remains.

5. **Adjacent schema comments describe the activated contract.**
   Comments beside `AssessmentSchema` and the class-detail partial entry declarations
   state the fractional 0–5 range, the `'E'` branch and retained partial `E`
   reasoning/cause.
   **Classification: Aligned**.

6. **`ASSESSMENT_FAILED` has no producer.**
   The catalogue entry exists in `Assessment.js` and is accepted by the frontend cause
   schema, but no backend boundary currently emits it: the assessment-stage owner has no
   separate ordinary assessment-failure boundary.
   **Classification: Aligned** — the entry is reserved for a real boundary rather than
   being manufactured. Do not add a blanket catch to give it a producer.

---

### LLM assessment outcomes and validated cache reuse

Implemented in `src/backend/RequestHandlers/LLMRequestManager.js` (terminal outcomes,
shared live/cache validation and internal cache identity) and
`src/backend/RequestHandlers/CacheManager.js` (generic best-effort `get`/`put`). This
slice adds no persisted field, no transport field, no service-envelope change, no
run-status document and no schema-version change. It wires the existing assessment-stage
catalogue into the existing atomic `StudentSubmissionItem.setError()` primitive; the LLM
service request payload and response body are unchanged.

| Situation                                                                                                                                | Scope         | Recorded result                                                                      | Source artefact                      | Notes                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful LLM response (HTTP 200/201) with exactly three criteria, each a finite 0–5 number and string reasoning                        | task          | three numeric `Assessment` results; reasoning preserved (empty allowed)              | content/hash retained                | Body read, parsed and validated once. No retry and no partial salvage. The validated numeric result is cached under the retained identity with the shared TTL.                                                                                                                                                                                                            |
| Invalid JSON body                                                                                                                        | task          | `assessment` / `LLM_INVALID_RESPONSE` on all three criteria                          | content/hash retained                | One bounded diagnostic (opaque UID plus structural detail, never payload); no extra HTTP and no cache write. Only `JSON.parse` is caught; the native body read is outside the catch.                                                                                                                                                                                      |
| Raw root or criterion keys not admissible before normalisation: non-object/array root, unknown raw key, or colliding case variants       | task          | `assessment` / `LLM_INVALID_RESPONSE` on all three criteria                          | content/hash retained                | The raw root is rejected before key normalisation can erase inherited-key, extra-key or case-collision evidence. No extra HTTP and no cache write.                                                                                                                                                                                                                        |
| Structurally invalid successful body: missing/null/extra criterion, non-number or non-finite/out-of-range score, or non-string reasoning | task          | `assessment` / `LLM_INVALID_RESPONSE` on all three criteria                          | content/hash retained                | The shared validator requires exactly the three own canonical keys `completeness`, `accuracy` and `spag` (inherited or extra keys are rejected) and delegates each entry to `Assessment.isValidRawResult`, additionally requiring `typeof score === 'number'`. No semantic re-request and no partial criterion salvage.                                                   |
| Permanent per-request HTTP failure (for example 400/413/422)                                                                             | task          | `assessment` / `LLM_HTTP_FAILED` on all three criteria                               | content/hash retained                | The shared transport does not retry non-retryable statuses; no body read and no cache write.                                                                                                                                                                                                                                                                              |
| Exhausted retryable HTTP (429/500–599) or network/transport exhaustion                                                                   | task          | `assessment` / `LLM_UNAVAILABLE` on all three criteria                               | content/hash retained                | Only a genuinely spent budget (`attempts === maxAttempts`) is exhaustion. The shared transport budget is already spent; the LLM caller adds no dispatch, sleep or semantic retry.                                                                                                                                                                                         |
| LLM 401/403/404                                                                                                                          | task, and run | `assessment` / `LLM_RUN_STOPPED` on the affected item; later dispatch is latched off | content/hash retained                | No abort toast or throw for an expected stop. Same-batch and earlier-batch completed numeric results, cached results and genuine `N` results survive unchanged. A retryable/network outcome whose pending retries were cancelled by a same-batch stop is `LLM_RUN_STOPPED`, not `LLM_UNAVAILABLE`.                                                                        |
| Eligible item never dispatched after a run stop                                                                                          | task          | `assessment` / `LLM_RUN_STOPPED` on all three criteria                               | content/hash retained                | Terminalised by the stop sweep after the sender returns, with no further HTTP.                                                                                                                                                                                                                                                                                            |
| Routed non-accepted outcome with missing or invalid attempt provenance                                                                   | run/wiring    | none — not an `Assessment` result                                                    | unchanged                            | The outcome must carry a safe integer `attempts` in `1..maxAttempts`. Missing, `undefined`/`null`, numeric-string, fractional, non-finite, unsafe-integer or out-of-budget provenance throws a contextual internal `Error` naming the UID and attempt provenance before `setError`/catalogue mapping. Broken wiring therefore produces no service `E` and no cache write. |
| Prior all-three `E` result on the item                                                                                                   | task          | preserved verbatim; no dispatch and no overwrite                                     | content/hash retained                | The bypass runs before the hash invariant, cache lookup and dispatch. It recognises three `'E'` scores and relies on prior validation of their cause/reasoning rather than re-validating them here.                                                                                                                                                                       |
| Genuine blank work (`content === ''`) or a usable-hash match with the template                                                           | task          | `N` / `'Task not attempted'` on all three criteria                                   | content/hash retained                | Requires usable hashes; a null or empty hash never establishes template `N`.                                                                                                                                                                                                                                                                                              |
| Stored reference, template or student content without a usable non-empty string `contentHash`                                            | run/wiring    | none — not an `Assessment` result                                                    | content retained, no hash generation | `LLMRequestManager` throws an internal invariant `Error` naming the offending role and `taskId` before cache lookup or dispatch. It is not a cache miss, live fallback, new `E` or false `N`.                                                                                                                                                                             |
| SPREADSHEET task                                                                                                                         | task          | none — not dispatched by the LLM                                                     | unchanged                            | Handled locally by `SheetsAssessor`.                                                                                                                                                                                                                                                                                                                                      |
| Valid cache hit                                                                                                                          | task          | numeric `Assessment` results                                                         | content/hash retained                | Validated by the same successful-result validator as live output, then assigned without HTTP.                                                                                                                                                                                                                                                                             |
| Malformed, `N` or `E` cache hit                                                                                                          | task          | logged miss, then the live outcome                                                   | content/hash retained                | Only validated numeric results are accepted from cache; the live validated result is written back at the retained key and shared TTL.                                                                                                                                                                                                                                     |
| Cache-service read or write outage                                                                                                       | run           | logged best-effort miss or write failure; assessment result unaffected               | unchanged                            | Generic `CacheManager` behaviour is unchanged. Actual wiring, model-mutation and serialisation faults propagate with their original identity.                                                                                                                                                                                                                             |
| Unknown or duplicate request UID                                                                                                         | run           | none — fail loudly                                                                   | —                                    | Rejected before arbitrary routing or mutation; duplicate input UIDs are rejected before dispatch.                                                                                                                                                                                                                                                                         |

**Cache identity (internal, not a persisted or wire shape):**

- The assessment cache key is derived inside `LLMRequestManager._buildCacheKey()` as a
  hash of the literal version tag `v1`, the task type, and the reference, template and
  student content hashes. It is computed once during request generation and retained on
  the request entry through writeback, so later fingerprint changes do not recompute it.
- Reads and writes use generic `CacheManager.get()` / `put()`; writeback passes
  `CacheManager.CACHE_EXPIRY_SECONDS` explicitly. That constant remains the single shared
  six-hour TTL owner. Old key spaces are misses; there is no purge or migration.
- The key, the retained identity and the run-stop latch are runtime state only. None is
  stored in `assign_full_*`, transported, or represented as a schema version or persisted
  run status.

Rules:

- LLM outcomes are task-atomic: a failure replaces all three criteria together through
  `setError()`, so stale numeric or `N` marks cannot survive beside the current failure.
- A successfully extracted source is retained for assessment-stage `E`; a marking failure
  does not imply unavailable source content.
- Only validated numeric results are cached. `E` results and transport failures are never
  cached.
- There is no semantic retry: an invalid successful body is terminal, and no recursive
  validation retry or second invalid-response budget remains.
- The decode catch contains only `JSON.parse`. The native body read (`getContentText()`),
  raw-root/criterion-key admission, key normalisation, shared validation, UID routing,
  model mutation, cache wiring and serialisation all run outside it, so reader, wiring
  and programming faults propagate with their original identity.
- The batch callback records each routed outcome's attempt count in an invocation-local
  map before processing. Non-accepted outcomes consume that provenance through
  `_terminalCodeFor`: stop statuses map to `LLM_RUN_STOPPED`, permanent statuses to
  `LLM_HTTP_FAILED`, and retryable/network outcomes distinguish a genuinely spent budget
  (`attempts === maxAttempts`, `LLM_UNAVAILABLE`) from stop-cancelled pending retries
  (`LLM_RUN_STOPPED`). The map holds numbers only and is reset per public invocation.
- A missing or invalid provenance value is a wiring fault, not a service result: a value
  that is not a safe integer in `1..maxAttempts` (including `undefined`, `null`, numeric
  strings, fractions, `NaN`, infinities and unsafe integers) throws a contextual `Error`
  before `setError` and before any catalogue mutation. No default attempt count, new
  cause or retry is introduced.
- No `ASSESSMENT_FAILED` producer exists. The current owner has no separate ordinary
  assessment-failure boundary, and no blanket catch was introduced; the catalogue entry
  remains available for a real boundary rather than being manufactured.
- Completion persistence, completion-time marker stamping and completion-with-errors
  feedback are enforced at the write boundary; handled errors persist beside healthy
  results and the marker is stamped only after completed-result validation succeeds.

Proof boundary: these outcomes are established by hermetic native HTTP/cache mocks with
real domain models and the real shared transport. They do not prove live GAS/LLM/network
behaviour, deployed execution-log fidelity, cache expiry or eviction, durable
persistence, completion-time stamping or the original production incident.

### Write boundary — preflight before any write

Before any collection mutation, `ABClassAssignmentOps.persistAssignmentRun()` validates
completed results and prepares independent full and partial payloads. It preflights all
four projections together: the full assignment payload, its embedded partial, the
prospective updated full-class payload and the prospective `abclass_partials` payload.
The existing class persistence preparation owner is reused; no projection is first
attempted after the full assignment has committed, and the prepared snapshots are
preserved through each write. The authoritative full assignment write still precedes the
class save and class-partials write. There is no cross-collection transaction; a storage
failure throws, logs the failed phase and whether the full write committed, and never
reports a completed run. Do not add unconditional saving in `finally` or claim rollback
guarantees.

The completed-write gate (`ABClassAssignmentValidation._validateCompletedAssignmentRun()`)
rejects, before marker stamping, serialisation or any collection mutation:

- missing task coverage (every known task must have a terminal item);
- malformed or incomplete criterion maps (exactly `completeness`, `accuracy` and `spag`);
- null submission content paired with anything other than permitted all-three
  acquisition/extraction/validation `E`;
- present content without a usable hash;
- a still-pending student IMAGE (successful hydration or its scoped
  `IMAGE_HYDRATION_FAILED` `E` is terminal);
- missing or unusable required shared reference/template artefacts
  (`ABClassAssignmentValidation._validateCompletedSharedArtefacts()`).

Only after that validation succeeds does `persistAssignmentRun()` set
`assignment.assessmentContractVersion = 1`, then serialise detached full and partial
assignment payloads and prepare the prospective full class and partial-registry payloads.
Both assignment serializers consequently emit marker `1` on newly completed/reassessed
results. Legacy records are untouched by this write path: their stored body and exact
marker presence/value are re-emitted from ordinary instance state, and read-time
preparation never enters persistence. Genuine no-submission (null parent document and empty item map) remains
valid. Storage writes keep the existing full-assignment → class → `abclass_partials`
order and are non-transactional.

### `assessmentContractVersion` result marker

Backend top-level field on the full assignment record and on every class-embedded
partial assignment. It is an assessment-result marker, not a definition-version marker.

| Field                       | Type        | Persistence                                                                                                                                                                                                                                                               | Transport                                                                                                       | Frontend Zod                                   | Notes                                                                                                                                                                                                                                                   |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assessmentContractVersion` | `1 \| null` | Newly completed results are validated then stamped `1` before serialization. Legacy absence, `null` or unsupported values are preserved verbatim with the legacy body, including a present non-array `submissions` value; stored values are never validated or rewritten. | Always present. `1` for current results; `'legacy'` for every other stored marker, set on the read output only. | `z.union([z.literal(1), z.literal('legacy')])` | Storage may omit the marker, store `null`, or retain an unsupported legacy value; that stored state means the result requires reassessment. The backend read transport maps every non-`1` stored marker to `'legacy'` beside prepared read submissions. |

Persistence rules:

- Newly completed/reassessed assignments are validated then stamped with
  `assessmentContractVersion = 1` before either full or partial serialization. Both
  persisted projections therefore carry `1`. See
  [§ Write boundary — preflight before any write](#write-boundary-preflight-before-any-write).
- Storage may omit the marker, or retain `null`/an unsupported legacy value. Restoration
  keeps the legacy submission body in ordinary instance state alongside the original marker
  value and its presence (`_legacyMarkerPresent`); ordinary persistence serialisers re-emit
  that state unchanged, without validating or rewriting it (see
  [§ Legacy read preparation](#legacy-read-preparation)). A present
  non-array `submissions` body is preserved by the same path; see
  [§ Legacy `submissions` preservation](#legacy-submissions-preservation).
- A successful reassessment replaces the full result and embedded partial with a fresh
  current result carrying version `1`; it does not carry the legacy state.
- Read-time preparation does not write repaired results back to storage; there
  is no bulk migration, deletion, reset or guessed historical cause.
- `AssignmentSerialisation._applyContractMarker()` writes the marker only when the instance
  carries `1`, or when the restored record had the marker present (then the stored value is
  re-emitted); an absent marker stays absent in persistence.

Transport and frontend-validation rules:

- The backend read transport always emits `assessmentContractVersion` on every full
  assignment record and every class-embedded partial assignment. It emits `1` for a
  current result and `'legacy'` for every other stored marker, beside prepared read
  submissions. It never omits the field and never emits a raw unsupported stored value.
- Both frontend read schemas require `z.union([z.literal(1), z.literal('legacy')])`. A wire
  payload that omits the field or supplies any other value is an invalid root and fails
  strict root validation.
- Invalid-root rejection is not a browser compatibility path: the frontend must not
  fabricate legacy `E` entries or build a second reassessment graph from a
  marker-less/unsupported wire payload. Legacy preparation belongs solely to the backend,
  whose output always carries the required marker (`1` or `'legacy'`).
- Invalid-root validation precedes per-item isolation. The defensive full-read coverage
  fallback for a missing known task applies only to a valid root carrying
  `assessmentContractVersion: 1`; it is not a legacy path.

### Legacy read preparation

> **Status: active on both read paths.** The public owner
> `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, form)` delegates to
> `AssignmentLegacyRead.prepare()` in `02_AssignmentLegacyRead.js`. Both
> `AssignmentSerialisation.toReadJSON()` (full) and `ABClassResponseMapper._toReadView()`
> (partial) invoke it before response validation and definition-key replacement. Both
> read services then validate the prepared entries; the browser does not prepare a second
> legacy graph.

That public entry is the sole backend owner of legacy read preparation. It applies when a
**stored** full record or class-embedded partial carries any `assessmentContractVersion`
other than `1` (absent, `null` or unsupported); its read output always carries
`assessmentContractVersion: 'legacy'`. A missing or unsupported **wire** marker is instead an
invalid root under strict frontend validation, not a legacy-result signal for the browser.
The internal `form` argument is exactly `'full' | 'partial'`: full for `getAssignment`,
partial for `getABClass`. It selects output serialisation only, never a weaker validator, and
is not a new transport parameter.

| Read path       | Invocation                                                                                                                                                                                                                                                                                                                    | Inputs                                                                                                                                                                                        | Output                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `getABClass`    | `ABClassResponseMapper._toReadView()` invokes it **before** replacing the embedded definition with `assignmentDefinitionKey`                                                                                                                                                                                                  | embedded task summaries and the stored submission body                                                                                                                                        | prepared partial submissions; `assessmentContractVersion: 'legacy'`                       |
| `getAssignment` | `getAssignment_()` calls `Assignment.toReadJSON()`, which delegates to `AssignmentSerialisation.toReadJSON()`. That read path invokes the same operation on the instance returned by `readRehydrateAssignment` (after its `_ensureFullDefinition` step), before final response validation and `DateUtils.deepConvertDates()`. | The resolved embedded definition's tasks. The full stored submission body is authoritative when present; the existing partial-definition fallback may resolve the registry's full definition. | prepared full submissions; `assessmentContractVersion: 'legacy'`; no roster or class read |

The class path keeps its stored task summaries. For abnormal legacy partial-definition
records, the class read and the direct full read can therefore validate against different
task lists. Neither read repairs storage nor guesses historical task associations or causes.

Preparation rules:

| Aspect              | Behaviour                                                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation owner    | `AssignmentCurrentRestoration._rehydrateCurrentSubmission()` runs on isolated copies of the stored items. There is no second assessment validator and no blanket `E` materialiser.                                                                                                                       |
| Validation mode     | Follows the embedded definition representation, not `form`: a task-summary array selects partial validation, a keyed task map selects full validation. Full output uses the resolved full definition.                                                                                                    |
| Valid item          | Scores, reasoning, feedback, artefact type/content and source identities are retained and serialised in the requested form.                                                                                                                                                                              |
| Invalid item        | A null/malformed assessment map, missing criterion, invalid score, invalid artefact or contradictory source state becomes all-three validation `CORRUPT_RECORD` `E` for that task; healthy siblings are kept.                                                                                            |
| Malformed item map  | A null, missing, array or non-record `items` value yields one `CORRUPT_RECORD` `E` per task in the saved embedded definition, on both output forms.                                                                                                                                                      |
| Missing known task  | Same missing-item `E` behaviour as current-format restoration, including non-empty null-parent submissions.                                                                                                                                                                                              |
| Empty no-submission | Null parent document with an empty item map stays the existing no-submission representation; no attempt or score is manufactured.                                                                                                                                                                        |
| Timestamps          | Valid saved values are retained; otherwise the assignment's `createdAt` and non-null `updatedAt` (or `createdAt`) are used. Never the wall clock.                                                                                                                                                        |
| Non-array root      | A present non-array `submissions` value returns `null` from the facade; a read transport then throws a contextual error naming the assignment. Persistence keeps preserving the stored, date-normalised body from `toJSON()`/`toPartialJSON()`, and the frontend root check remains as defence-in-depth. |
| Error propagation   | Identity failures, unknown-task associations and injected constructor faults propagate unchanged; they are never relabelled `E`.                                                                                                                                                                         |
| Mutation            | The restored instance, its saved raw submissions and later persistence output are unchanged.                                                                                                                                                                                                             |

Stored explicit `REASSESSMENT_REQUIRED` errors remain supported: they are served as stored on
both read paths and are not regenerated. The all-results placeholder producer has been
removed; the catalogue entry remains accepted for previously stored errors.

Format gate and persistence preservation:

- Check the legacy marker before restoring historical items. Keep the legacy submission
  body in `inst.submissions` and the original marker value/presence in
  `inst.assessmentContractVersion` / `inst._legacyMarkerPresent` for unchanged
  persistence. `_legacyMarkerPresent` itself is not serialised. Legacy persistence
  `toJSON()`/`toPartialJSON()` re-emit that stored submission body and the original
  marker unchanged; they never emit prepared read submissions or `'legacy'`.
- Do not persist the read result. The prepared submissions are detached: `_toReadView()`
  substitutes them for the class wire entry, and `Assignment.toReadJSON()` (delegating to
  `AssignmentSerialisation.toReadJSON()`) does the same for a direct full read. Class
  save/preparation never receives those read values.
- Class configuration, definitions and existing stored results are retained unchanged.
  Successful reassessment is the authorised transition to a current result.
- The frontend normaliser validates the prepared entries and the required
  `assessmentContractVersion: 1 | 'legacy'` read field. It does not generate a second
  legacy graph, query a roster or infer historical outcomes. Both read services invoke the
  normaliser before their final parse.
- An invalid root/definition or untrustworthy required identity still fails the owned
  dataset; preparation must not invent missing identities.

> **Temporary compatibility.** The legacy persistence and read-preparation
> compatibility path — including the separate `Assignment.toReadJSON()` wrapper — is
> migration compatibility, not an intended permanent second serialiser. Review it on
> **24 April 2027** to decide whether legacy assessments have likely been rerun and the
> path can be retired. That date is a review checkpoint only: it does not expire, remove
> or change the path automatically. Retiring the path first requires confirming that
> remaining stored legacy assessments no longer need it and that ordinary persistence
> cannot be damaged. No scheduled notification, automatic migration, data deletion,
> background backfill or forced reassessment is promised or authorised.

### Marker-1 CURRENT restoration

`Assignment._baseFromJSON()` routes a record whose `assessmentContractVersion` is
exactly `1` through `AssignmentCurrentRestoration._rehydrateCurrentSubmission()`; every
other record is kept as ordinary instance state (stored submissions, marker value and
marker presence) and prepared for reads as described under
[§ Legacy read preparation](#legacy-read-preparation).
The representation mode is threaded from `Assignment.fromJSON()` through
`Assignment._baseFromJSON()` / `AssignmentRehydration._rehydrateSubmission()` and
`AssignmentCurrentRestoration._rehydrateCurrentSubmission()`, then through
`SlidesAssignment.fromJSON()` / `SheetsAssignment.fromJSON()` and
`StudentSubmission.fromJSON()` into `StudentSubmissionItem.fromJSON()`.

| Aspect                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation              | `assessmentContractVersion === 1` only. Newly completed runs are validated and stamped before both persistence serialisers emit the marker. Marker-less, `null` and unsupported records are retained as ordinary instance state without reconstruction; the read transport emits `'legacy'` after read preparation. Both frontend read schemas require `1 \| 'legacy'` and both read services run the normaliser before their final parse. See [Known discrepancies](#validation).                                                        |
| Root and task list      | Validated once, before any model constructor runs: non-blank `courseId` / `assignmentId` strings, `submissions` as an array, and a non-empty embedded `assignmentDefinition.tasks`. In the full task-map form every key is non-blank and equals the embedded task's canonical `id`; an optional `taskId` must match that key. In the partial summary-array form every `taskId` is a non-empty unique string. Any failure throws and fails the owned dataset.                                                                              |
| Shared identities       | The same task-list check runs with an empty `submissions` array, so duplicate or inconsistent definition identities cannot be hidden by having no students. A submission must carry a non-blank string `studentId` and an `assignmentId` equal to the root assignment ID. Unknown stored task keys outside the authoritative task list throw; associations are never guessed.                                                                                                                                                             |
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

The synthetic generator, projection and strict graph validators emit and accept marker-1
records, real PNG/raw-grid bodies, paired reference formulae and retained partial `E`
details. The committed canonical corpus is byte-reproducible across two runs. Production
persistence and both read transports emit the marker; the backend legacy read preparation
and the frontend read normaliser are active in both read services. The analyser accepts
explicit `E` input. The completed-write gates (including pending-image rejection and
completion-time marker stamping) are enforced at the write boundary; preview error states
remain unimplemented (see
[Frontend Data Analysis Response § Planned contract changes](frontend-data-analysis-response.md#planned-contract-changes-not-implemented)).

---

## Status

The marker, write gate and marker-1 restoration rules above are the current contract, as is
legacy read preparation on both read paths.

## Planned contract changes (Not implemented)

None for this contract. The read version union `1 | 'legacy'`, legacy read preparation, the
removal of the all-results `REASSESSMENT_REQUIRED` placeholder producer and the frontend
normaliser change are implemented and documented above
([§ `assessmentContractVersion` result marker](#assessmentcontractversion-result-marker),
[§ Legacy read preparation](#legacy-read-preparation)). The `REASSESSMENT_REQUIRED` cause
code remains accepted for previously stored errors; no catalogue deletion is planned.
Corrupted student IDs remain out of scope by user decision: identity/unknown-task rejection
is unchanged and no recovery is planned.

---

## File Index

```
Assessment model:          src/backend/Models/Assessment.js
  └── Assessment.toJSON()                — full assessment shape (score/reasoning/error)
  └── Assessment.createError()           — catalogue E construction
  └── Assessment.fromJSON()              — validated result restoration
  └── Assessment.isValidCause/isValidRawScore/isValidRawResult

Assessment-stage LLM:      src/backend/RequestHandlers/
  ├── LLMRequestManager.js               — terminal assessment outcomes, run-stop
  │                                        terminalisation, shared live/cache numeric
  │                                        validation and versioned internal cache
  │                                        identity retained through writeback
  └── CacheManager.js                    — generic best-effort get/put and shared
                                           CACHE_EXPIRY_SECONDS

Assignment serialisation:  src/backend/AssignmentProcessor/Assignment/
  ├── 00_AssignmentSerialisation.js      — toJSON()/toPartialJSON()/toReadJSON() marker emission
  ├── 02_AssignmentRehydration.js        — marker routing, one-pass restore facade and
  │                                        prepareLegacyReadSubmissions()
  ├── 02_AssignmentLegacyRead.js         — independent legacy read preparation; per-task
  │                                        CORRUPT_RECORD isolation; non-array root bypass
  ├── 02_AssignmentCurrentRestoration.js — marker-1 root/task/item validation, coverage,
  │                                        null-parent isolation

Completed-write gate:      src/backend/y_controllers/ABClassController/
  ├── ABClassAssignmentOps.js            — persistAssignmentRun() (gate → stamp → projections → writes)
  └── ABClassAssignmentValidation.js     — _validateCompletedAssignmentRun(),
                                           _validateCompletedSharedArtefacts()

Frontend:
  ├── src/frontend/src/services/assignmentAssessment/assessmentResult.zod.ts
  │     → assessmentResultSchema, partialAssessmentResultSchema,
  │       assessmentCauseSchema (shared owner; consumed by both read schemas)
  ├── src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
  │     → AssessmentSchema (alias of assessmentResultSchema)
  └── src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts
        → PartialAssessmentEntrySchema (alias of partialAssessmentResultSchema)
```
