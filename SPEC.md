# Explicit Assessment Errors and Targeted Pipeline Simplification

## Status

Reviewed v1.1 — approved for action-plan preparation after independent review;
planning only, no production changes. Addresses AssessmentBot issues
[#322](https://github.com/h-arnold/AssessmentBot/issues/322) and
[#341](https://github.com/h-arnold/AssessmentBot/issues/341).

## Purpose

Make an assessment failure an explicit result with useful reasoning, rather than
an inference from missing marks or source content. Preserve healthy students and
tasks when an identifiable student record fails, and simplify the paths that
currently obscure the cause.

This is not a storage-platform redesign, a persistent retry/job framework, an
LLM-service API redesign, or an application-wide React error-boundary project.

## Agreed product decisions

1. Reuse `Assessment`: `E` is an explicit error result with required `reasoning`
   and a structured cause. Do not introduce a parallel persisted outcome hierarchy.
2. `N` remains genuine not-attempted/not-applicable evidence. Failed acquisition,
   extraction, image hydration, assessment or data validation must not manufacture N.
3. LLM results are atomic across completeness, accuracy and SPaG. An invalid
   successful response makes all three criteria E; do not salvage individual marks.
4. Retry transport failures only, with at most three HTTP attempts per request,
   including its initial batch attempt. No separate invalid-response retry budget.
5. LLM-wide credential/endpoint failures stop further dispatch. Save completed
   results and E for affected/unprocessed LLM tasks, with completion-with-errors
   feedback. Unexpected programming faults and persistence failures still throw.
6. Keep student first-match behaviour and existing tag/type preference. Ambiguity
   remains a warning, not a new E condition. Duplicate reference/template title tags
   continue to block definition parsing; do not fabricate student E for that failure.
7. Keep existing shared-definition and required reference/template image failure
   handling: an invalid definition rejected by the existing definition workflow, or
   failed hydration of a required shared image, blocks the run and preserves the prior
   saved assignment. This does not require a new run-time eligibility preflight.
8. Keep full assignments, lightweight class-embedded assignment summaries and the
   class-partials registry. Simplify affected ownership/reconstruction, not collections.
9. Reassessment is acceptable. Old-format results read as E with reasoning
   `Reassessment required`; no bulk migration, deletion or guessed historical cause.
10. Corruption discovered only by a full-content preview fetch affects that preview
    only. Do not recompute previously analysed class scores/averages from that fetch.
    This limitation was explicitly selected by the user; it is not an unresolved choice.
11. Errors already represented in the class-summary assessment input do affect normal
    analysis: show E, exclude erroneous evidence from averages, and retain healthy data.
12. Preserve source content for an LLM error when extraction succeeded. An error in
    marking does not imply that the source preview is unavailable.

## Existing system constraints and investigation findings

### Persistence and restoration ownership

| Boundary             | Current owner and representations                                                                                                                   | Decision                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Assignment results   | `ABClassAssignmentOps.persistAssignmentRun`: full `assign_full_<courseId>_<assignmentId>` record, then class-embedded partial                       | Retain; prepare both projections before any write                               |
| Class storage        | `ABClassController.persistAssignmentRun` then `saveClass`; `ABClassPersistence` writes class collection named by `classId`, then `abclass_partials` | Retain order and explicit non-transactional failure semantics                   |
| Definitions          | `AssignmentDefinitionPersistence`: `assdef_full_*` and `assignment_definitions`, with existing rollback                                             | Retain; no rewrite of definition recovery/persistence                           |
| Typed restoration    | `Assignment.fromJSON`, `AssignmentDefinition.fromJSON`, `StudentSubmission.fromJSON`, `StudentSubmissionItem.fromJSON`, `ArtifactFactory.fromJSON`  | One partial-aware restoration path; no whole-submission retry and item dropping |
| Full assignment read | `readRehydrateAssignment` loads the dedicated full record and resolves a partial definition if necessary                                            | Remains read-only; no roster refresh or write-back repair                       |
| Class read           | `ABClass.fromJSON` restores embedded partials; `ABClassResponseMapper` replaces the embedded definition with its key for transport                  | No eager full-assignment reads to classify outcomes                             |
| Assessment cache     | `CacheManager`, ScriptCache, six-hour TTL                                                                                                           | Best-effort optimisation, never the authority for error/success                 |

The current full/partial split avoids loading heavy source content during analysis.
It is not, by itself, evidence of over-engineering. The following complexity is
directly relevant and must be removed or corrected:

- `AssignmentRehydration._rehydrateSubmission` tries whole-submission restoration,
  retries each item on failure, and drops corrupt items/submissions. Dropping loses
  the evidence that distinguishes error from not attempted.
- `persistAssignmentRun` writes the full result before constructing the partial,
  so a projection error can occur after the first durable write.
- LLM initial and retry responses have duplicated parse/validate/assign paths;
  HTTP and recursive validation budgets can yield eight attempts for one item.
- Terminal request failures log but do not record an Assessment. Later progress
  completion can report success despite unassessed tasks.
- Null student/template hashes compare equal and can produce N. Null is not a
  usable content fingerprint.
- The base batch sender retries permanent errors before classifying them, returns
  an earlier response after exhausted retries, and collects all batches before
  assigning results. Later aborts can therefore discard earlier successful work.
- `ImageManager` has meaningful document round-robin scheduling but passes a batch
  size argument the base sender ignores, resulting in unintended assessor-size batching.
- Cache hits are not validated, and assessment keys omit template/type context.
- `SheetsAssessor` stores non-Assessment formula-comparison data inside the
  `assessments` map, although no production consumer reads that stored entry.

Normal assessment runs create a fresh assignment; they do not rehydrate and mutate
the old saved result. Reused model instances can nevertheless retain assessments
when content changes, so model invalidation still needs a defined rule.

The normal full-record read reconstructs missing artefact content/hash through
constructor defaults. The original production source of missing transport keys
in #341 remains unconfirmed; do not claim it has been reproduced or diagnosed.

### Runtime constraints

- GAS plain JavaScript, concatenated load order and private entrypoints remain.
- `apiHandler` and frontend `callApi` remain the sole transport boundaries.
- No changes to authorisation, trigger admission, API envelopes or deployment scopes.
- Generic `CacheManager` is also used outside assessment; do not introduce
  assessment-specific validation into its generic get/put operations.
- Partial artefact content is deliberately redacted. Null/absent content in that
  representation cannot be used as evidence of extraction failure.

## Domain contract

Contract notation below does not require backend TypeScript. Canonical planned
contracts belong in `docs/developer/data-shapes/`, marked `Not implemented`.

### Assessment

```ts
type Assessment =
  | { score: number | 'N'; reasoning: string }
  | {
      score: 'E';
      reasoning: string;
      error: { stage: ErrorStage; code: ErrorCode };
    };

type ErrorStage = 'acquisition' | 'extraction' | 'assessment' | 'validation';
```

- Numeric scores must be finite and in inclusive range 0–5. Fractions are valid:
  the spreadsheet assessor already produces fractional scores.
- `reasoning` is required and non-blank for E. Error `stage`/`code` must be a valid
  pair from the table below. Non-E results must not contain `error`.
- A completed task has exactly the three canonical criterion entries. Internal
  in-flight items may be incomplete, but completed persistence must reject them.
- Task-wide failures replace all three entries atomically with the same cause and
  reasoning; stale numeric/N results cannot survive beside the current failure.
- A version-1 item whose criterion map is incomplete or contains an extra key is
  explicitly corrupt on both full and partial reads. Replace that item with all
  three validation `CORRUPT_RECORD` E entries; do not drop it or salvage marks.
- Do not retain `assessments.formulaComparison`: retain existing cell-reference
  feedback in `feedback`, while transient comparison results remain assessor-local.
  This removes an unused non-Assessment entry, not a new feedback persistence feature.
- No error history, timestamps, retry ledger or stack traces are added to Assessment.

### Error catalogue and reasoning

| Stage       | Code                         | Teacher-readable reasoning                                                    |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------- |
| acquisition | `SOURCE_UNREADABLE`          | The submitted document could not be accessed.                                 |
| acquisition | `UNSUPPORTED_DOCUMENT`       | The submitted attachment is not a supported document for this assignment.     |
| extraction  | `SOURCE_CONTENT_UNAVAILABLE` | No source content could be extracted for this task.                           |
| extraction  | `PARSE_FAILED`               | The submitted work could not be parsed for this task.                         |
| extraction  | `IMAGE_HYDRATION_FAILED`     | The submitted slide image could not be loaded.                                |
| assessment  | `LLM_HTTP_FAILED`            | The assessment service rejected the request.                                  |
| assessment  | `LLM_UNAVAILABLE`            | The assessment service could not complete the request after retries.          |
| assessment  | `LLM_INVALID_RESPONSE`       | The assessment service returned an invalid result.                            |
| assessment  | `LLM_RUN_STOPPED`            | Assessment stopped because the service credentials or endpoint were rejected. |
| assessment  | `ASSESSMENT_FAILED`          | The extracted work could not be assessed.                                     |
| validation  | `CORRUPT_RECORD`             | The stored assessment data for this task is invalid. Reassess the assignment. |
| validation  | `REASSESSMENT_REQUIRED`      | Reassessment required                                                         |

These are the canonical initial safe messages, not raw exception interpolation.
The creator of an E result selects its code and reasoning together. Definition
parse failures retain their existing definition/run error surface and safe cause;
there is no new student `DUPLICATE_TAG` result under the agreed first-match policy.

### Full and partial projections

- Full Assessment transports/persistence carry the complete union above.
- Partial success/N entries remain `{ score }`. Partial E entries retain
  `{ score: 'E', reasoning, error }`; do not strip the explanation with LLM reasoning.
- Frontend types derive from adjacent Zod schemas. Full and partial validators
  enforce the same score range and E cause catalogue.
- No `.optional()` relaxation of full artefact `content`/`contentHash` is allowed.
  Missing required fields are corruption, not legitimate null content.
- Error placeholders use canonical model constructors. Where an artefact cannot
  be restored, its placeholder has the known task/student association, explicit
  null content/hash and validated source identifiers when available. It is not
  passed to rendering as a malformed success-shaped object.
- In full results, null submission content is allowed for acquisition/extraction/
  validation E placeholders. Confirmed no-submission is represented by parent
  `documentId: null` and an empty item map, not fabricated null-content N items.
  On a current-format full read, null content beside purported numeric/N marks is
  a contradictory stored record: replace all three results with validation
  `CORRUPT_RECORD` E and its catalogue reasoning, without guessing whether past
  acquisition or extraction failed. At the actual extraction boundary, confirmed
  unavailable content instead creates extraction `SOURCE_CONTENT_UNAVAILABLE` E.
  An assessment-stage E with null content is also a contradictory stored record
  and becomes validation `CORRUPT_RECORD` E, not an accepted assessment-only error.
  Partial redaction is exempt from this full-content consistency check.

### Completed submission coverage

- For version 1, each identified submission with a document must contain one
  terminal item for every task in its embedded definition, even when extraction
  or assessment failed. Missing known tasks become `CORRUPT_RECORD` E on full and
  partial reads; a truncated item map must not silently create N.
- A submission with null document ID and an empty item map is the sole confirmed
  no-submission omission case. A source-acquisition error with no usable document
  ID instead contains explicit E items for all known tasks. Other null-document
  non-empty maps must contain only such acquisition/validation E results.
- Genuine no-submission continues to contribute no observed item to the analyser;
  its display remains the existing no-data N placeholder. Do not insert raw N
  observations that would change existing average denominators. Missing whole
  students whose identity is not present in a direct full record are not invented.
- The backend is authoritative for completed-item coverage on both read paths:
  `AssignmentRehydration` materialises missing-task E entries during the one-pass
  full or partial restoration, using the assignment's embedded task snapshot.
  Thus both planned version-1 full output from `toReadJSON()` and planned version-1
  class-partial output contain coverage E before transport. The browser's
  partial-read normaliser validates provided entries only; it must not infer extra
  coverage errors from the separately loaded, potentially newer definition registry.
  Only if a full wire payload nevertheless lacks an expected item, the full-read
  normaliser must defensively produce `CORRUPT_RECORD` E using that same payload's
  definition. This is a post-backend-validation corruption defence, not the normal
  coverage owner; test that fallback separately from backend full/partial coverage.
  Backend-materialised E is never overwritten. No new task-universe field or full
  fetch is needed for partial-read coverage.
- A known dictionary task key paired with a mismatched item `taskId` becomes
  `CORRUPT_RECORD` E for that known key. A stored item referencing no task in the
  embedded definition has no safe target and fails the owned assignment dataset;
  do not guess a task association. Extraction's existing warn-and-ignore treatment
  for an unknown task ID remains; terminal coverage still applies to known tasks.

### Result-format marker and reassessment

- Add `assessmentContractVersion`, exactly `1` for newly completed results, to
  full assignments and their embedded partials. It is an assessment-result marker,
  not a definition-version marker. Keep the marker through transport.
- Absence/null or an unsupported marker means the result requires reassessment;
  it must not be interpreted as current success. Transport represents this as
  `assessmentContractVersion: null`, with explicit reassessment E entries.
  Storage may therefore omit the marker, but the read-wire field is required and
  accepts only `1 | null`. A missing/unsupported wire marker is an invalid root,
  not a browser compatibility path that certifies old scores or synthesises legacy E.
- For a legacy class-embedded assignment, use the already loaded roster and its
  embedded task summaries to expose all known roster/task pairs as reassessment E.
  For a direct full read, use its stored student identities and definition tasks;
  do not fetch a roster or invent students. Ignore historical scores/content for
  assessment resolution; do not try to reconstruct past failure causes.
- Preserve the legacy marker in model/persistence state: a normal class save must
  not accidentally certify an old result as current. Read-only E projections do
  not write repaired results back to storage. Successful reassessment replaces the
  full result and embedded partial with version 1.
- Old-format data need not gain valid historical previews. Retain class configuration,
  definitions and existing stored results; there is no deletion/reset operation.
- Existing class metadata remains a supplied historical snapshot. Normal current
  class analysis uses the reassessment E projection, not historical result scores;
  existing post-analysis metadata refresh behaviour is otherwise unchanged.

### Backend reassessment projection boundary

The **backend**, not the browser, materialises legacy E entries. Extend the
existing `AssignmentRehydration` owner with one pure
`projectReassessmentSubmissions(assignment, students, form)` operation, reused by
the two read paths below. It creates detached read snapshots, not durable repairs.
`form` is exactly `'full' | 'partial'`: full for `getAssignment`, partial for
`getABClass`. It is an internal projection mode, not a new transport parameter.

- For `getABClass`, `ABClassResponseMapper._toReadView` invokes it with the already
  loaded roster and embedded task summaries **before** replacing the definition
  with `assignmentDefinitionKey`. The wire includes the explicit partial E items.
- For `getAssignment`, `Assignment.toReadJSON()` delegates to the existing
  `AssignmentSerialisation` owner's new `toReadJSON()` read-projection operation.
  That operation invokes the shared reassessment projector where needed, leaving
  `getAssignment_` to select the read serializer and handle transport conversion.
  It operates
  on the instance returned by `readRehydrateAssignment`, after `_ensureFullDefinition`,
  with validated stored student identities and the resolved embedded definition's
  tasks, before final response validation/date conversion. A full stored snapshot
  remains authoritative; the existing partial-definition fallback may resolve the
  registry's full definition. The class path still uses its stored task summaries,
  so abnormal legacy partial-definition records can expose different task universes
  between the two reads; both remain reassessment E and neither rewrites history.
  There is no roster/class read on the direct full path.
- Check the legacy marker before restoring historical items. Keep the legacy
  submission body and original marker presence/value as an opaque snapshot behind
  the typed Assignment facade for unchanged persistence. Do not validate or coerce
  historical marks into the new completed-item contract, strip stored content on an
  ordinary class save, or persist the detached E projection. Runtime snapshot fields
  themselves are not serialised. This is a format gate, not historical-data repair.
- For legacy records, persistence `toJSON()`/`toPartialJSON()` re-emit the stored
  submission body and original marker unchanged. They never emit reassessment E
  placeholders. `_toReadView` builds the legacy wire entry by substituting the
  detached projector output, and `toReadJSON()` does the same for a direct full
  read. Class persistence preparation/writes never receive those read placeholders;
  current-version serializers retain their normal full/partial semantics.
- The frontend normaliser validates these already materialised entries and retains
  defensive per-item corruption isolation. It does **not** generate a second
  reassessment graph, query a roster, or infer historical outcomes.

Each projected student/task pair uses the existing submission/item/artefact model
constructors: `role: 'submission'`, `type: 'base'`, explicit null content/hash,
empty metadata/feedback, and all three Assessments set to the canonical validation
`REASSESSMENT_REQUIRED` E. Its artefact UID is deterministically derived from the
assignment/student/task identities; the item ID uses the usual model derivation.
Only validated historical document/page IDs may be retained; otherwise they are
explicit null, never guessed source identifiers. Full and partial submission
`studentName` accept `string | null`, matching the backend model; do not fabricate
a name when only an identity is known.

Use valid stored submission timestamps where available. Otherwise the detached
placeholder uses the assignment's `createdAt` and its non-null `updatedAt` (or
`createdAt` when no update exists), not the wall clock and not a claim about the
historical processing attempt. Full reads emit full E entries; class reads redact
artefact content/hash as usual but retain E reasoning/cause. Both emit the marker
as null. An invalid root/definition or untrustworthy required identity still fails
the owned dataset; this projection must not invent missing identities.

## Processing and state rules

### Acquisition and extraction

1. Establish submitted-document acquisition before classifying a task. Confirmed
   absence of a submitted attachment remains genuine no-submission/N evidence.
   Acquire every `StudentSubmissions.list` page by following `nextPageToken` before
   confirming absence. A failed page must fail the run, not appear to confirm absence.
2. A known student's unreadable/unsupported submitted document creates E for their
   known tasks. Preserve valid attachment-selection behaviour; no new multi-file UI.
3. Successful extraction of blank work or a usable hash matching the valid template
   retains current N rules. For spreadsheet formula tasks retain current numeric
   formula scoring and SPaG N semantics; do not change pedagogical scoring rules.
   Canonicalise a successfully read blank/all-null spreadsheet grid to `[]`, not
   null, and give it the normal hash of `[]`. This applies to blank templates and
   blank student ranges through construction, persistence and restoration. Literal
   null means unavailable spreadsheet content. Existing normalisation of populated
   formulas is unchanged; blank student grids still receive the current formula
   scores (completeness 0, accuracy 0, SPaG N), not an extraction error or new N rule.
   The owning normaliser is `SpreadsheetTaskArtifact.normalizeContent` in
   `Models/Artifacts/3_SpreadsheetTaskArtifact.js`; parsers and restoration reuse
   that model rule rather than adding competing blank-grid coercion.
4. Null source content after required extraction/hydration is E. For image artefacts,
   null before hydration is a valid internal pending state, not a terminal result.
5. A document-open failure affects that student's tasks. A task-specific parse/read
   failure affects that task only. Convert expected source failures where student/task
   identity is known; unexpected implementation faults propagate.
6. Missing matches and failed spreadsheet range reads must produce explicit task E,
   not dropped items. Retain source-matching preference and first-match warnings.
7. Existing handling of required shared reference/template content is retained:
   unusable shared content detected by the existing definition-write validation or
   shared-image hydration paths blocks the run, so completed results are not persisted;
   do not add a new run-time eligibility preflight. Definitions may legitimately store
   pending image artefacts before an assessment run; do not forbid that existing
   definition-store state. Strict non-null definition artefacts apply to completed
   full assignments.
   At new definition writes, non-IMAGE artefacts must already have non-null content
   and a string hash; valid blank TEXT/array templates are not rejected as empty.
   Old definitions may be reparsed through the existing definition workflow if
   they cannot meet these invariants; no result-version marker is added to definitions.
   A spreadsheet reference task with zero assessable formulae is an unusable shared
   definition, not a valid blank template. Reject it at the existing
   parser/definition-write boundary: the parser normally creates no task for a
   formula-free reference, and definition-write validation rejects any such task
   before persistence. Blank templates `[]` remain valid, and blank student ranges
   retain the formula scores defined above. `AssignmentDefinitionValidation` owns
   this definition-write invariant; the existing
   `AssignmentDefinitionUpsertOrchestrator` invokes it on final resolved tasks before
   persistence, using existing definition-failure reporting. Do not add separate
   parser/API validators or change definition rollback semantics.
8. Image failures are assigned by scope: student image failure becomes task E;
   shared-input failure blocks the run. Known failed items never reach the LLM.
9. Changing content on a reused item invalidates its old assessments/feedback.
   A terminal result must be re-established before completed persistence.

### LLM requests, retries and completion

- Keep `fetchAll` batching and image round-robin ordering. Batch size is an explicit
  caller choice: assessor batch size for LLM calls, Slides-fetch size for images.
- Retain per-member sequential `UrlFetchApp.fetch` retries after classifying the
  initial `fetchAll` batch. Do not re-batch retries or introduce another scheduler;
  each member retains its initial-attempt count and the shared backoff budget.
- The transport owner classifies the initial response before any retry. Network
  exceptions, HTTP 429 and HTTP 500–599 may retry; other statuses do not retry.
- Exactly 200/201 are supported HTTP success statuses for the LLM; image downloads
  require 200. Other responses are failures, not implicit success.
- At most three dispatches per request, including its initial `fetchAll` attempt;
  wait 5 seconds before a second attempt and 7.5 seconds before a third. No sleep
  after exhaustion. A thrown batch network call counts as an attempt for each member.
  Image downloads inherit this same budget; exhaustion becomes student-task
  `IMAGE_HYDRATION_FAILED` E or a blocking shared-image failure according to scope.
- Transport returns each final response/failure with request identity. It must not
  substitute an earlier HTTP response after a later network failure. Process completed
  batches before sending later batches; no run-wide deferred response accumulation.
  Classify all received responses in a batch before dispatching retries, so a
  run-stopping response prevents further calls while received successes are retained.
- Parse and validate successful LLM responses once. Require all three numeric
  criteria and string reasoning, reject missing/null/extra criterion entries and
  out-of-range/non-finite scores. Invalid JSON and invalid structure both produce
  `LLM_INVALID_RESPONSE` immediately; no semantic re-request.
- HTTP 401/403/404 on an LLM request stop future dispatch/retry for that run. Honour
  successful responses already received in the same batch. Remaining eligible tasks
  become `LLM_RUN_STOPPED`, including unprocessed tasks; completed cached/N results
  remain unchanged. No extra call is made to confirm a permanent failure.
- HTTP 400/413 and other permanent per-request failures become `LLM_HTTP_FAILED`;
  exhausted retryable/network failures become `LLM_UNAVAILABLE`.
- Decode/validation catches must not wrap assignment, caching or model mutation.
  Wiring/routing faults propagate rather than being relabelled as invalid LLM output.
- Remove recursive validation retry handlers, unused component-build controls and
  redundant routing aliases/state. Do not add a persistent queue or failure manager.

### Caching

- `LLMRequestManager` owns assessment-specific key derivation and cache-hit result
  validation beside request generation. Reuse generic `CacheManager.get/put` for
  storage; do not create a second cache module or put LLM schemas in generic cache
  operations. Record this reuse/extension in the backend shared-helper register.
- Use one versioned assessment cache identity derived from task type, reference hash,
  template hash and student-content hash. Retain that identity with the request through
  writeback. Old key-space entries are misses; no cache purge is required.
- Validate cache hits with the same successful-result validator as live LLM output.
  A malformed cached result is logged and treated as a miss, then assessed normally.
- Cache only validated numeric LLM results. Do not cache E or transport failures.
- Keep generic cache-service failures as logged misses/best-effort writes. They do
  not turn a successful assessment into E. No request-coalescing feature is added.
- Reject duplicate request identities before dispatch; never route a response to an
  arbitrary last UID-index entry.

## Persistence, rehydration and transport

### Write boundary

- Validate completed results and prepare independent full and partial payloads
  before the first collection mutation. Partial projection must not require an
  unnecessary serialise → restore → serialise round-trip solely for validation.
  Preflight the prospective updated full-class and class-partials payloads as well
  as the full assignment and its embedded partial; reuse the existing class
  persistence preparation owner. No projection is first attempted after the full
  assignment has already committed. Preserve prepared snapshots through each write.
- The authoritative full write precedes the class save and class-partials write.
  There is no cross-collection transaction. A storage failure throws, never reports
  a completed run, and logs the failed phase plus whether the full write committed.
  Do not implement unconditional saving in `finally` or claim rollback guarantees.
- For handled student/LLM failures, persist valid E results alongside successes.
  Final feedback is `Assessment run completed with errors.` with failed task count,
  not unconditional success. A task is counted once, not once per criterion.
- Persistence failures are run failures, not student Assessment errors. Reads do not
  silently repair an inconsistent multi-store save.

### One restoration path

- Make full versus partial restoration explicit at the owning boundary. Partial
  redaction must never trigger source-content failure detection or hash generation.
- Validate raw current-version records before coercive constructors erase evidence
  of absent content/hash or malformed Assessment entries. Retain model-owned content
  normalisation; do not duplicate a second domain model at the API boundary.
- Restore each identified submission/item once. Replace only explicitly detected
  invalid records with typed E placeholders, preserving healthy siblings. Remove the
  whole-submission catch/reconstruct/retry/drop flow and plain-object serialisation fallback.
- If a submission identity is valid but its item collection is corrupt, mark its
  known definition tasks E. If student/task identity or the shared root/definition is
  untrustworthy, fail the owned dataset loudly rather than guessing associations.
- Data-corruption conversion is restricted to explicit raw-data validation failures.
  Do not catch arbitrary constructor/programming exceptions and turn them into E.

### Frontend validation defence

- Planned frontend owners are `services/assignmentAssessment/assessmentResult.zod.ts`
  for shared full/partial Assessment and error-cause schemas, and
  `services/assignmentAssessment/assignmentReadNormalisation.ts` for pure full/partial
  item isolation. Both assignment and class-detail services use those owners; they
  contain no React, GAS dispatch or raw-JSON parsing.
- Validate assignment/root/shared-definition structure atomically and strictly as
  today. Validate identifiable student items independently so malformed item content,
  marks or error details cannot discard healthy siblings.
- Apply equivalent item isolation to full assignment and class-embedded partial reads,
  with their different content/reasoning presence rules. Reuse one feature-domain
  validation/normalisation owner; do not weaken global `parseApiResponse` semantics.
- Log structured field paths and available course/assignment/student/task identifiers;
  never log source content, raw LLM payloads, credentials or student names.
- A missing required key is never accepted as a valid success. After isolation,
  revalidate the canonical normalised result before returning typed data to consumers.
- Backend raw domain validation belongs to the existing model restoration owners:
  Assessment validates its result/cause; StudentSubmissionItem and StudentSubmission
  validate their own full/partial records; AssignmentRehydration owns graph traversal
  and contextual error isolation. Controllers select the representation explicitly;
  API handlers do not introduce a second domain-validator hierarchy.

## Analysis and user-facing behaviour

- Extend the analyser's raw Assessment score input to include E explicitly. Do not
  rely on null source content, absent assessments or a lack of numeric contributions
  to detect known errors. Its existing class input retains partial E reasoning/cause
  for preview UI; numeric accumulation consumes the score only. The public
  `MetricResult` output gains no error-history or reasoning fields.
- A wholly errored task resolves all its display metrics to E. Existing successful
  numeric, genuine N, zero-weight and aggregate `excluded` semantics are unchanged.
  E contributes neither a numeric zero nor denominator weight to averages.
- Explicit E increments no numeric/N evidence, `totalDataPoints` or weight counter,
  matching the existing missing-assessment error accounting. A lone E display has
  zero applicable/total data points and zero weight. Existing aggregate resolution
  and retained metadata remain unchanged; no new coverage counter is introduced.
- Preserve existing treatment of mixed valid/error observations at aggregate scopes;
  this change does not redesign coverage counts, weighting or ranking algorithms.
- The existing preview card shows E and its Reasoning. With an assessment-only error,
  show the valid student response and source action. With unavailable/corrupt source,
  suppress the response renderer and show an inline error explanation; retain a source
  action only when its existing safe URL derivation succeeds.
- A full-read-only corruption overrides the affected preview's score/reasoning with
  E, even if the class-derived heatmap cell still shows a historic numeric value.
  State `Source preview unavailable. Displayed scores are unchanged; reassess the
assignment to refresh them.` Do not mutate class-query data or persist read repairs.
- Never reinterpret a missing lookup entry as N when an explicit E is available from
  class-summary data. A failed/unavailable full query cannot hide known E reasoning.
- A valid no-submission case retains N. No malformed record is silently dropped to
  create the same no-submission state.
- No new page, modal, retry control or error-management dashboard. Existing refresh
  and reassessment controls remain the recovery mechanisms.

### Preview contract additions

Use the existing per-criterion `reasoning` map in `CellPreviewData` and add a required
`errors: Record<HeatmapMetricKey, { stage: ErrorStage; code: ErrorCode } | null>` map.
Every canonical criterion has an entry; non-E entries are null. Add required
`sourceState: 'loading' | 'available' | 'unavailable'` to the preview view model.
These fields are derived in memory, never added to backend artefacts or persistence.

`TaskPreviewData` carries the selected criterion's cause as required `error` (cause
or null), the existing `reasoning` string, and `sourceState`. Existing metric output
shapes do not change. `available` permits normal rendering; `unavailable` suppresses
the source renderer; `loading` permits a source-region skeleton while known E
reasoning stays visible. Full-read builders only yield available/unavailable; the
existing query/preview composition supplies loading for known partial E fallback
only while the full fetch is pending. A terminal failure or null/not-found result
sets that fallback's sourceState to unavailable and renders the local Alert.
When a known E carries null IMAGE/SPREADSHEET full content, assembly produces the
view-model representation `artifactContent: ''` with `sourceState: 'unavailable'`
instead of invoking the current throwing coercion. This is not a successful blank
extraction. Non-E unexpected null content that bypasses read validation still fails
loudly as an internal invariant violation; do not broaden a silent null fallback.
For confirmed no-submission (`cellData === null` with no known E), retain the normal
N placeholder with `artifactContent: ''`, `error: null`, `sourceUrl: null` and
`sourceState: 'available'`. Here available means the normal source region is ready
to render its legitimate no-submission placeholder, not that a document exists;
it must not produce an error Alert or a perpetual loading state.

Precedence in an opened preview is: explicit full-record validation error first,
then the class-partial E for that criterion, then the selected full item's E, then
the existing analyser metric. Keep existing merged-source selection; do not merge
or invent new reasoning from multiple assignment instances. Error fields travel
through that same selected source, with class-partial fallback keyed by the actual
assignment/student/task/criterion, not a definition-scoped aggregate alone.

### Loading, refresh and accessibility

Retain existing local skeletons and background-refresh busy treatment. Known-invalid
source regions are fail-closed while healthy surrounding previews remain usable.
Use accessible inline error/status text, not colour alone; preserve popover keyboard
behaviour and source-action focus. No new navigation or motion is introduced.

A focused frontend layout companion is required because error/ready preview regions
and status precedence change, despite retaining the existing card/popover structure.
It must use the official Ant Design documentation and existing preview conventions.
`ASSESSMENT_ERROR_PREVIEW_LAYOUT.md` owns presentation copy and exact component
state treatment; the error catalogue above owns recorded Assessment reasoning.

## Diagnostics and simplification guardrails

- Record safe stable error codes/reasoning on results; log raw errors separately via
  ABLogger with stage, attempt count and known opaque identities.
- Make failure boundaries narrow. Logs must distinguish acquisition, extraction,
  transport exhaustion, invalid response, corrupted stored data and failed persistence.
- Do not add catch-and-ignore guards, duplicate validation at every layer, generic
  status frameworks, fallback source selection, or automatic durable repairs.
- Preserve useful factories and facade decomposition. Remove accidental retry and
  restoration duplication; do not flatten GAS modules merely to reduce file count.
- Leave unrelated class metadata validation, reference-data CRUD, deletion flags,
  auth-cache semantics and definition recovery algorithms unchanged.

## Testing expectations

Use red-first tests for each implementation section in the subsequent action plan.

1. Full/partial Assessment E round-trip, required reasoning/cause, valid stage/code
   pairs, score range/fractions, and rejection of malformed success/E records.
2. No-submission, blank work, blank spreadsheet templates/student ranges through
   construction/persistence/restoration, valid template match, null hashes, missing
   tag, unreadable document, failed table/range extraction and image failures.
   Include a submitted attachment on a later Classroom page and a later-page failure.
   A formula-free reference task is rejected at the parser/definition-write
   boundary; a valid reference with blank template/student ranges still completes
   with terminal marks.
3. Current first-match ambiguity warning and blocking definition duplicates remain.
4. Exact total dispatch counts/backoff: transient exhaustion, batch exceptions, permanent
   4xx, invalid JSON/structure, 401/403/404 stop, earlier/same-batch success retention.
5. Cache validation/miss recovery, versioned identity sensitivity, best-effort cache
   failure, and no cached E. Unknown/duplicate request identity fails loudly.
6. Full and class-partial corruption isolation, missing known task coverage,
   no-submission omission without new denominator contributions, preserved E rather
   than omission, no conversion of programming faults, strict root/definition failure.
7. Prepared projections before writes, unchanged write order, partial-write failure
   diagnostics, no false success, and no read-time storage mutations.
8. Legacy reassessment projection/version retention, unaffected modern assignments,
   repeated reads without writes, and reassessment replacement without data deletion.
9. Analysis/summary preservation for numeric/N/zero-weight/Excluded; explicit E
   exclusion; known E reasoning without full content; source-only preview override
   leaves class metrics unchanged as expressly selected.
10. Browser tests across embedded and standalone/merged heatmaps: mixed healthy/E
    tasks, safe source access, unavailable content, refresh, and no app unmount.
    Include two assignments sharing a definition where only the first selected
    source has a partial E, and a legacy reassessment preview journey.

Canonical fixtures: select `small` `transport.classesById` and
`transport.assignmentsByKey` for healthy cross-layer graphs, with `medium` for mixed
outcomes. Extend the existing generator to emit the new marker and realistic explicit
E outcomes in both views. Add IMAGE/SPREADSHEET support to the existing artefact and
submission generation stages, rather than building a competing realistic fixture.
The concrete stages are `generateAssignmentDefinitions.js::buildDefinitionArtifact`,
`generateSubmissions.js::buildSubmissionItem`/`buildAssessments`, assignment record
construction in `planClassAssignments.js`, and `projectSubmissionViews.js` for
partial E reasoning retention. Explicitly emit the stored marker in both field-
whitelist projections: `toTransportViews.js::toFullAssignment` and
`projectClassTransportViews.js::toPartialAssignment`; setting the persistence field
alone does not update either wire view. Emit all three criteria, including currently absent
accuracy; extend graph validators for content types and result/cause consistency.
Replace the generator's existing `STUDENT_INDEX_WITHOUT_ASSESSMENTS` empty-result
variant with explicit `ASSESSMENT_FAILED` E on all three criteria. A version-1
canonical completed fixture must never contain an empty assessment map. Missing-
criterion/empty-map tests remain local corruption probes, not realistic success data.
Reconcile `STUDENT_INDEX_WITH_NULL_DOCUMENT` as a synthetic acquisition failure:
retain its identified submission and known-task items, but give each item all three
acquisition `SOURCE_UNREADABLE` E results with null source content/hash and canonical
base placeholder fields. Do not emit contradictory numeric/N source-less items in
the corpus. This is test-only realism selection, not an inference about historical
production records. Genuine no-submission remains covered by roster omissions and
local null-document/empty-map boundary probes; do not change completion-band rules.
Spreadsheet fixtures may reuse existing cell-reference feedback but do not need
new formula-comparison persistence or new feedback types.
Update `src/frontend/src/test/taskHeatmap/previewFixtures.ts`'s capability-exception
comment when IMAGE/SPREADSHEET become canonical: remove those resolved exceptions
and the dead root-plan reference, retaining only genuinely unsupported cases such
as TABLE and pointing to the canonical synthetic-data capability notes instead.
Corrupt records, HTTP responses, GAS failures and numeric boundaries remain local
targeted probes. Migrate only existing tests touched by this work opportunistically.

## Documentation and planning handoff

- Record planned contracts in `assignment.md`, `assignment-definition.md`,
  `abclass.md` and `frontend-data-analysis-response.md` under
  `docs/developer/data-shapes/`, marked `Not implemented` before implementation.
- Record planned helper reuse/extraction in `AssessmentFlow.md`, `rehydration.md`
  and frontend shared-helper standards. The Assessment/error catalogue owns domain
  result creation; the existing base request owner owns transport retries; a
  feature-domain frontend normaliser owns per-item read isolation.
- Reconcile canonical flow/rehydration/API/testing/scoring docs in the same delivery.
  The investigation found stale narrative paths in flow docs; update only the
  portions relevant to this agreed change, not an unrelated documentation rewrite.
- Before delivery planning, record current/projected LOC for materially affected
  modules. Plan explicit separation above 500 projected lines, respecting backend
  facade/load-order and frontend domain-folder rules. This is a planning margin
  below the repository's unchanged 550-line hard decomposition trigger, not a
  change to that runtime-source policy. In particular review the
  470-line LLM manager, 490-line ABClass controller facade and 387-line submission
  model; simplification is preferred to indiscriminate helper proliferation.
- Deployment is coordinated frontend/backend because raw E and the marker change
  both read contracts. Reassessment is the authorised transition; no bulk migration
  or reset is authorised. Old cache keys become misses.
- Production incident verification still needs deployed logs or the offending
  payload/build; static investigation cannot establish the original bypass path.

### Production module sizing budget

Physical current counts were checked with `wc -l`. Projections are approximate
planning budgets after the agreed simplification, not implemented counts. Paths
below are relative to `src/backend/`, `src/frontend/src/` or
`scripts/synthetic-test-data/` as indicated. Files not expected to grow past 500
stay in their existing domain. The action-plan author must carry these budgets
into its section constraints and size the concrete test modules it selects there;
an over-budget touched test must be split by scenario/domain before extending it.

| Backend module                                                                 | Current | Projected before separation | Separation / target                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------: | --------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Models/Assessment.js`                                                         |      43 |                         170 | Existing result/cause owner                                                                                                                                                                                                             |
| `Models/Artifacts/0_BaseTaskArtifact.js`                                       |     186 |                         210 | Existing artefact owner                                                                                                                                                                                                                 |
| `Models/Artifacts/3_SpreadsheetTaskArtifact.js`                                |     179 |                         195 | Existing grid normaliser                                                                                                                                                                                                                |
| `Models/StudentSubmission.js`                                                  |     387 |                         550 | Separate the existing item model and submission model under `Models/StudentSubmission/`; retain an `index.js` entry/facade and `00_StudentSubmissionItem.js`, each at most 320                                                          |
| `Models/ABClass.js`                                                            |     440 |                         480 | Existing class restoration/serialization                                                                                                                                                                                                |
| `AssignmentProcessor/Assignment/index.js`                                      |     402 |                         425 | Existing facade/read-serializer delegation                                                                                                                                                                                              |
| `AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`                 |     119 |                         210 | Existing full/partial/read serialization owner                                                                                                                                                                                          |
| `AssignmentProcessor/Assignment/02_AssignmentRehydration.js`                   |     185 |                         560 | Keep restore/coverage facade at most 320; extract pure legacy projection/snapshot mapping to same-domain `02_AssignmentReadProjection.js` at most 280, behind the existing `AssignmentRehydration.projectReassessmentSubmissions` entry |
| `AssignmentProcessor/Assignment/04_AssignmentSubmissions.js`                   |     147 |                         240 | Existing acquisition/pagination owner                                                                                                                                                                                                   |
| `AssignmentProcessor/SlidesAssignment.js`                                      |     177 |                         250 | Existing student-stage orchestration                                                                                                                                                                                                    |
| `AssignmentProcessor/SheetsAssignment.js`                                      |     111 |                         165 | Existing student-stage orchestration                                                                                                                                                                                                    |
| `Assessors/SheetsAssessor.js`                                                  |     388 |                         420 | Existing formula assessor                                                                                                                                                                                                               |
| `DocumentParsers/SheetsParser.js`                                              |     363 |                         400 | Existing extraction owner                                                                                                                                                                                                               |
| `DocumentParsers/SlidesParser/01_SlidesParserSubmissionMatcher.js`             |     332 |                         365 | Existing matching/extraction owner                                                                                                                                                                                                      |
| `RequestHandlers/BaseRequestManager.js`                                        |     224 |                         310 | One retry/dispatch owner                                                                                                                                                                                                                |
| `RequestHandlers/LLMRequestManager.js`                                         |     470 |                         470 | Remove duplicated retry/completion paths; reuse Assessment validation rather than add another schema owner                                                                                                                              |
| `RequestHandlers/CacheManager.js`                                              |     116 |                          75 | Generic get/put and shared TTL unchanged; remove orphaned assessment-specific wrappers after moving their sole caller; no LLM validation added                                                                                          |
| `RequestHandlers/ImageManager.js`                                              |     221 |                         285 | Existing scoped image outcomes                                                                                                                                                                                                          |
| `y_controllers/AssignmentController.js`                                        |     425 |                         470 | Existing run completion/preflight orchestration                                                                                                                                                                                         |
| `y_controllers/ABClassController/index.js`                                     |     490 |                         490 | Keep facade thin; preparation belongs to injected existing owners                                                                                                                                                                       |
| `y_controllers/ABClassController/ABClassAssignmentOps.js`                      |     279 |                         410 | Existing write/read orchestration                                                                                                                                                                                                       |
| `y_controllers/ABClassController/ABClassPersistence.js`                        |     223 |                         275 | Reuse prepared class writes                                                                                                                                                                                                             |
| `y_controllers/ABClassController/ABClassResponseMapper.js`                     |     128 |                         170 | Existing read projection owner                                                                                                                                                                                                          |
| `y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`         |     101 |                         175 | Existing definition domain validation                                                                                                                                                                                                   |
| `y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js` |     470 |                         490 | Delegate invariant check, no new orchestration layer                                                                                                                                                                                    |
| `z_Api/assignmentAssessment.js`                                                |     146 |                         155 | Select read serializer only                                                                                                                                                                                                             |

The two planned separations preserve public class/namespace APIs and guarded test
exports. Follow backend facade/domain-folder rules and GAS load order: the item
model loads before its submission facade; the pure read-projection support loads
before its restoration facade. Update test globals/imports accordingly. The
legacy projector is still one operation behind the existing owner, not a second
materialiser. No unrelated model or controller decomposition is authorised.
The action plan must include a generated-bundle order assertion that
`02_AssignmentReadProjection.js` precedes `02_AssignmentRehydration.js`. Their
shared numeric prefix relies on the builder's lexicographic filename ordering;
retain these names and test the actual order rather than assuming a numeric tie.
The same generated-bundle checks must assert that
`Models/StudentSubmission/00_StudentSubmissionItem.js` precedes
`Models/StudentSubmission/index.js`, covering both planned separations.

| Frontend module                                                              | Current | Projected |
| ---------------------------------------------------------------------------- | ------: | --------: |
| `services/assignmentAssessment/assessmentResult.zod.ts`                      | 0 (new) |       130 |
| `services/assignmentAssessment/assignmentReadNormalisation.ts`               | 0 (new) |       330 |
| `services/assignmentAssessment/assignmentAssessment.zod.ts`                  |     214 |       235 |
| `services/assignmentAssessment/assignmentAssessmentService.ts`               |      47 |        65 |
| `services/googleClassrooms/classDetail/classDetailService.zod.ts`            |     177 |       185 |
| `services/googleClassrooms/classDetail/classDetailService.ts`                |      31 |        45 |
| `services/dataAnalysis/analysers/averagingAnalyser.types.ts`                 |      32 |        35 |
| `services/dataAnalysis/analysers/averagingAnalyser.criterionAccumulation.ts` |     235 |       255 |
| `features/taskHeatmap/TaskHeatmapPage.tsx`                                   |     392 |       435 |
| `features/taskHeatmap/useHeatmapsPageData.ts`                                |     394 |       445 |
| `features/taskHeatmap/buildCellPreviewLookup.ts`                             |     251 |       340 |
| `features/taskHeatmap/assembleTaskPreviewData.ts`                            |     141 |       195 |
| `features/taskHeatmap/assembleMergedPreviewData.ts`                          |     195 |       255 |
| `features/taskHeatmap/TaskMetricPreviewContent.tsx`                          |     128 |       185 |
| `features/taskHeatmap/TaskMetricPreviewCell.tsx`                             |     309 |       335 |
| `features/taskHeatmap/TaskPreviewCard.tsx`                                   |     280 |       330 |
| `features/taskHeatmap/taskHeatmapTableColumns.tsx`                           |     403 |       455 |
| `features/taskHeatmap/heatmapsPreviewQueries.ts`                             |     100 |       155 |

No frontend file is currently projected over 500. Keep the two new service owners
in the existing assignment-assessment domain folder and import their actual owners
directly, following frontend architecture rules; do not introduce a barrel/facade.

| Synthetic generator module         | Current | Projected |
| ---------------------------------- | ------: | --------: |
| `generateAssignmentDefinitions.js` |     216 |       295 |
| `generateSubmissions.js`           |     233 |       365 |
| `planClassAssignments.js`          |     206 |       215 |
| `toTransportViews.js`              |     259 |       275 |
| `projectSubmissionViews.js`        |     140 |       165 |
| `validatePersistenceGraph.js`      |     281 |       365 |
| `validateTransportGraph.js`        |     336 |       430 |

The same early-separation planning margin applies if these estimates grow during
action-plan preparation. Do not hide projected growth by condensing documentation.

## V1 scope boundaries

Include explicit E/reasoning, error propagation through both result projections,
targeted request/restoration/persistence simplification, preview resilience, legacy
reassessment treatment and the associated fixtures/tests/documentation.

Exclude storage redesign/transactions, per-criterion LLM salvage, semantic retries,
changes to duplicate student-match policy, persistent error history, new dashboards,
automatic read repairs, full-fetch-driven aggregate recomputation, unrelated error
boundaries, a new coverage-metric schema, and changes to the separate LLM service.

No core product decisions are left open. Exclusions above are settled scope choices,
not implementation-stage deferrals.
