# Assignment Rehydration Strategy

> **See also:** Canonical shape definitions for partial and full assignment records
> live in [`docs/developer/data-shapes/`](../data-shapes/INDEX.md).
> This doc describes the _process_ of hydration; the data-shape docs define the
> _structure_ at each hydration level.

This document describes how _full_ assignment hydration works when starting from the
lightweight (partially hydrated) assignment objects embedded inside an `ABClass`
instance that was loaded from JsonDbApp.

## Legacy read preparation

`AssignmentLegacyRead` in
`src/backend/AssignmentProcessor/Assignment/02_AssignmentLegacyRead.js` prepares an independent read
result for a restored legacy assignment. It is a stateless class: every call constructs a fresh
instance, and the class holds no instance or module-level state. The `AssignmentRehydration` facade
exposes it as `prepareLegacyReadSubmissions(assignment, form)`.

**Status: not wired.** No read caller uses this helper yet. `AssignmentSerialisation.toReadJSON()`
and `ABClassResponseMapper._toReadView()` still call
`AssignmentRehydration.projectReassessmentSubmissions()`, so the reassessment projection described
under [Legacy records](#legacy-records) remains the active read path. Wiring both serialisers and
removing the projector is the read-activation change.

### API

| Item      | Behaviour                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepare` | Returns prepared submissions in the requested form, or `null` when the submissions root is present but not an array.                              |
| `form`    | `'full'` or `'partial'`; selects output serialisation only. Any other value throws.                                                               |
| Throws    | Untrustworthy submission identity, unknown task association, missing embedded definition, invalid timestamps, and any injected restoration fault. |
| Never     | Fetches a roster, reads storage, writes back, or mutates the restored assignment or its saved submissions.                                        |

### Validation mode and output form

Validation mode follows the embedded definition representation, matching current-format restoration:
a summary task array selects partial validation, and a keyed task map selects full validation. The
`form` argument controls output serialisation only, so a partial output form never weakens the
validator. A redacted body stored under a full definition is therefore checked as full and its
contradictory null source becomes `CORRUPT_RECORD` E.

### Preparation rules

Preparation reuses `AssignmentCurrentRestoration._rehydrateCurrentSubmission()` on an isolated
receiver, so item validation, missing-item coverage, null-parent isolation and timestamp
preparation are the current-format rules rather than a second validator.

- Each stored submission is copied with its `items` deep-copied before validation. A non-record
  `items` value (null, missing, array or other non-object) is passed as absent, so the existing
  owner yields one `CORRUPT_RECORD` E per embedded task.
- Valid items keep their score, reasoning, content, hash, source IDs and feedback. Invalid items and
  missing known tasks become `CORRUPT_RECORD` E for that task; healthy siblings and neighbouring
  submissions are unchanged.
- A genuinely empty null-parent submission stays the no-submission representation.
- Output uses the model serialisers: `toJSON()` for `full` and `toPartialJSON()` for `partial`.
- The receiver is constructed with the saved name, timestamps and definition, and is never stamped
  completed or current to enter validation. The restored assignment keeps its legacy marker state
  and raw submissions, so later persistence output is unchanged.

A present non-array `submissions` root bypasses preparation entirely and returns `null`; the caller
emits the preserved value for existing frontend root rejection. This is the only `null` return.

### Load order

The module sorts between `AssignmentCurrentRestoration.js` and `02_AssignmentRehydration.js`:
CurrentRestoration → LegacyRead → Rehydration. All three share the `02_` prefix, so the
generated-bundle order depends on the builder's lexicographic filename sort.
`scripts/builder/src/steps/backend-copy.spec.ts` asserts that order against the real backend tree,
and `tests/setupGlobals.js` registers the same global order for Node tests.

## Goals

- Keep `ABClassController.loadClass()` fast (only summary / partial assignments)
- Hydrate **only when explicitly requested** (e.g. re‑running an assessment, export, audit)
- Avoid subtle stale-reference bugs in JavaScript
- Maintain a single, stable schema (partial vs full differ only in payload weight)
- Fail loudly (throw) if the authoritative full assignment collection is missing or corrupt

## Terminology

| Term               | Meaning                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Partial Assignment | Assignment object inside `ABClass.assignments[]` with heavy fields elided (e.g. `artifact.content === null`).               |
| Full Assignment    | Same shape, but every field populated (artifacts contain `content`, metadata complete, feedback/assessments fully present). |
| Hydration          | Replacing a partial assignment with its authoritative full version.                                                         |

## Responsibilities

| Component              | Responsibility                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ABClassController`    | Owns persistence access (JsonDbApp collections) and provides a `readRehydrateAssignment` read-only method.   |
| Assignment Model       | Pure data + business logic. It does **not** know how to talk to storage.                                     |
| `AssignmentController` | Rehydrates only the assignment currently being processed so the rest of the class payload stays lightweight. |

### Transient runtime fields

Assignments may expose a `students` array while an assessment run is active so
controllers can reuse the hydrated class roster without re-fetching it. Treat
this property as ephemeral: it exists only during processing and **must not be
persisted** back into JsonDbApp. Persisting it would append duplicate roster
entries every time an assignment is rehydrated.

Similarly, `_hydrationLevel` is a transient marker (`'partial'` or `'full'`) that
controllers use to understand whether an assignment instance represents a full
payload. It is never persisted; callers set it when they rehydrate or when they
store partial summaries.

`_legacyMarkerPresent` is also transient. `_baseFromJSON()` sets it on a legacy record to
record whether the stored document had an `assessmentContractVersion` field, so serialisation
can re-emit the marker only when it was actually stored. It is never serialised itself.

## Collection Naming Convention

Full (authoritative) assignment documents are stored in a per-assignment collection distinct from the class collection. Recommended pattern:

```
assign_full_<courseId>_<assignmentId>
```

Rationale:

- Clear prefix (`assign_full_`) avoids collisions
- Easy to grep/debug
- Stable and deterministic

(If your environment already enforces namespacing, adapt the prefix accordingly.)

## Factory Pattern & Polymorphism

We use a **Factory Pattern** to handle polymorphic assignment types (`SlidesAssignment`, `SheetsAssignment`) during creation and rehydration.

### Creation

Use `Assignment.create()` instead of `new Assignment()`:

```javascript
const definition = new AssignmentDefinition({
  documentType: 'SLIDES',
  referenceDocumentId: refDocId,
  templateDocumentId: templateDocId,
  primaryTitle: 'Essay 1',
  primaryTopic: 'English',
  yearGroupKey: '10',
});
const assignment = Assignment.create(definition, courseId, assignmentId);
```

### Rehydration / Deserialization

Use `Assignment.fromJSON()` which routes to the correct subclass based on the `documentType` field:

```javascript
const assignment = Assignment.fromJSON(jsonPayload);
// Returns instance of SlidesAssignment or SheetsAssignment
```

**Note**: The factory pattern centralizes type discrimination but does not eliminate all conditionals. Controllers may still need to branch logic based on type (e.g., different processing pipelines for Slides vs Sheets), but the _instantiation_ and _deserialization_ logic is encapsulated.

Restoration constructs an `Assignment` with the saved assignment name and creation time
supplied as constructor metadata, so it does not fetch Classroom data. Supplying that
metadata selects restoration, but its saved name must be a string: a missing, `null` or
non-string `assignmentName` throws a `TypeError` before any fetch and is not caught or
recovered. Valid strings, including a blank string, are preserved. The same optional
metadata owns the `full`/`partial` restoration mode (defaulting to `full` only in the
constructor), and an invalid mode throws. The transient `_restorationMode` is never
serialised, and a stored field cannot overwrite it. Ordinary three-argument creation still
fetches Classroom metadata; the fetch requires a `creationTime` and a string title, and
there is no generated `Assignment <id>` name fallback. Restoration does not restore the
transient `_hydrationLevel` marker.

## Persistence Workflow

We use a **Split Persistence Model**:

1.  **Full Persistence**: The complete assignment object (with all artifacts and content) is serialized via `toJSON()` and written to the dedicated `assign_full_...` collection.
2.  **Partial Summary**: A lightweight summary is generated via `toPartialJSON()` and stored in the `ABClass.assignments` array.

This ensures `ABClass` remains small and fast to load, while the full data is preserved safely in a separate document.

### End-to-end hydration/dehydration sequence (strict model)

Classes and primary methods (in call order):

1. **AssignmentDefinitionController.upsertDefinition()** — validates, resolves the topic, re-parses on source change and persists full then registry. See [Contract: AssignmentDefinition](../data-shapes/assignment-definition.md).

2. **ABClassController.persistAssignmentRun()** — writes the full assignment, then the updated class with the embedded partial, then the partials registry. See [Contract: Assignment](../data-shapes/assignment.md).

3. **ABClassController.loadClass()** (not changed)
   - Returns the lightweight `ABClass` with only partial assignments (heavy fields already stripped).

4. **AssignmentController.processSelectedAssignment()**
   - Creates a fresh `Assignment` instance from the definition, runs the assessment pipeline, then persists via `ABClassController.persistAssignmentRun()`. Does not rehydrate from the full collection — the full document is written anew on each run.

5. **ABClassController.readRehydrateAssignment(courseId, assignmentId)**
   - Read-only operation: loads the full document from `assign_full_<courseId>_<assignmentId>` without refreshing roster data or mutating ABClass.
   - Reconstructs the typed instance via `Assignment.fromJSON()`; this cascades into `AssignmentDefinition.fromJSON()`, which in turn strictly hydrates tasks (`_hydrateTasks` requires `taskTitle` and instantiates `TaskDefinition`, whose artifacts are materialised via `ArtifactFactory.fromJSON`).
   - Resolves partial definitions via `AssignmentDefinitionController.getDefinitionByKey(definitionKey, { form: 'full' })`.
   - Marks `_hydrationLevel = 'full'` on the returned instance.
   - For a marker-1 record, restores submissions in one validated pass. For a legacy record (marker missing, `null`, or unsupported), restores the stored submissions into `submissions` and the marker into instance state, and does not rehydrate historical items.

6. **Assignment runtime**
   - Processing pipelines operate on the full instance; transient fields (`students`, `_hydrationLevel`) remain runtime-only and must never be persisted.

### Strictness notes

- Task payloads must include `taskTitle`; `_hydrateTasks` now fails fast via `ProgressTracker.logAndThrowError` if a task is missing it.
- Parser outputs are normalised back into `TaskDefinition` instances before persistence to guarantee `toPartialJSON()` is available and consistent.
- Artifact redaction now relies on artifact classes’ `toPartialJSON()`; legacy plain-object fallbacks have been removed.

## Rehydration Algorithm (Read-Only)

The read-only rehydration path uses `readRehydrateAssignment` which loads and hydrates an assignment without requiring an ABClass instance or triggering a roster refresh.

```javascript
readRehydrateAssignment(courseId, assignmentId) {
  // 1. Validate inputs
  if (typeof courseId !== 'string' || !courseId.trim()) throw new TypeError(...);
  if (typeof assignmentId !== 'string' || !assignmentId.trim()) throw new TypeError(...);

  // 2. Read full document from dedicated collection
  const document = this._loadFullAssignmentDocument(courseId, assignmentId);

  // 3. Validate document structure
  this._validateAssignmentDocument(document);

  // 4. Reconstruct typed instance
  const hydratedAssignment = Assignment.fromJSON(document);

  // 5. Resolve partial definition if needed
  this._ensureFullDefinition(hydratedAssignment);

  // 6. Mark as full
  hydratedAssignment._hydrationLevel = 'full';

  return hydratedAssignment;
}
```

`getAssignment_` serialises the returned instance with `Assignment.toReadJSON()`, not
`toJSON()`. A marker-1 record keeps its serialised submissions and marker; a legacy record receives
the detached reassessment projection and a `null` marker described below.

### Restoration modes

`Assignment._baseFromJSON()` selects the restoration path from the stored `assessmentContractVersion`
marker:

| Stored state                              | Behaviour                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1`                                       | One validated pass per identified submission and item, using the requested `full` or `partial` mode.                                                                                                                                                                                          |
| Missing, `null`, or any unsupported value | Legacy history: submissions are **not** item-rehydrated. A present `submissions` value is kept as stored, whether an array, `null` or an object; only an absent property keeps the constructor's empty array. The marker value plus whether the field was present are kept as instance state. |

The representation mode is caller-owned: `_baseFromJSON()` passes the requested mode to the
constructor, which owns the `full` default. A stored `representationMode` field is never read as the
restoration mode.

### Current-format restoration

Current-format restoration lives in
`src/backend/AssignmentProcessor/Assignment/02_AssignmentCurrentRestoration.js` behind the
`AssignmentRehydration` facade.

- The submission must match its parent `assignmentId` and carry a non-blank `studentId`.
- The embedded definition must supply a non-empty, duplicate-free task universe. A keyed task must have `id === key` and no conflicting `taskId`; an item keyed outside that universe fails the owned dataset.
- Each item is validated before `StudentSubmission.fromJSON()` can coerce it. Invalid items and known tasks with no item become `CORRUPT_RECORD` E placeholders with the deterministic UID `<taskId>-<studentId>-na-0`, null content/hash and empty metadata. Healthy siblings are retained. A submission with no document and no items restores as an empty submission rather than a set of placeholders.
- A full record must not combine null `content`/`contentHash` with numeric or `'N'` marks. That contradictory stored record becomes `CORRUPT_RECORD` E for all three criteria. Partial redaction is exempt because its source body is intentionally absent.
- An untrustworthy submission identity, task universe or timestamp set throws; it is not converted to a placeholder.

There is no whole-submission catch/reconstruct/retry flow, per-item drop or plain-object fallback.

### Legacy records

For a non-marker-1 record, `_baseFromJSON()` restores the stored submissions into
`inst.submissions` and records the marker as ordinary instance state:
`inst.assessmentContractVersion` holds the stored value, and `inst._legacyMarkerPresent`
records whether the stored document actually had the field.

A present `submissions` value is preserved exactly as stored: an array, `null` and an object
all survive restoration unchanged, and only an absent property keeps the constructor's empty
array (`Object.hasOwn` guard). Persistence (`toJSON()`/`toPartialJSON()`) serialises that state
directly, so an ordinary save cannot validate, rewrite or re-certify the historical result.
An array body maps through the submission serialiser; any other present value, including
`null`, is emitted through `_plainSubmissionJSON()` and is never replaced with `[]`. Class save
and reload preserve the same value.

Reads derive a detached projection through
`AssignmentRehydration.projectReassessmentSubmissions(assignment, students, form)`:

- `full` form uses the stored submission identities from `inst.submissions` and reads no roster.
- `partial` form uses the loaded class roster and treats stored summaries as source metadata only.
- Each student/task pair becomes a `StudentSubmission` with one `BaseTaskArtifact`
  (`role: 'submission'`, `type: 'base'`, null content/hash, empty metadata, deterministic
  `reassessment-<hash>` UID) and all three criteria set to validation `REASSESSMENT_REQUIRED` E.
- Source IDs are retained only when identifier-shaped; timestamps use valid stored values, otherwise
  the assignment's `createdAt` plus its `updatedAt` (or `createdAt`).
- Both read paths emit `assessmentContractVersion: null`.

The projection is derived per read and is never persisted.

### Stored-read Date revival

JsonDbApp's reader revives any ISO-looking string as a `Date`. Two consequences matter when you
read or re-save stored documents:

- **Stored metadata.** `ABClassResponseMapper._normaliseClassPartial()` and
  `ABClass.fromJSON()` pass stored metadata through `DateUtils.deepConvertDates()` before
  `new ABClassMetadata(...)`, which otherwise rejects a `Date` as not a canonical UTC datetime.
  See [api-layer.md § Response mapper reuse](api-layer.md#response-mapper-reuse-implemented).
- **Legacy submissions.** `AssignmentSerialisation._submissionJSON()` prefers a model
  `toJSON()`/`toPartialJSON()`. A stored record without that serialiser, and any present
  non-array submission body, falls back to `_plainSubmissionJSON()`, which converts each field
  through `DateUtils.deepConvertDates()`. Copying a revived `Date` key by key would otherwise
  produce `{}` and persist that over the stored timestamps. Every emit path therefore serialises
  live `Date` values to ISO strings.

This conversion prevents new corruption. It does not repair documents already stored with `{}`
values; those stay corrupted until rewritten from a correct source.

## Restoration and projection ownership

**Status:** the backend legacy persistence/read slice, the current-format restoration path, the
frontend read-normalisation activation and the regenerated canonical corpus are implemented in
`02_AssignmentRehydration.js`, `02_AssignmentCurrentRestoration.js`,
`02_AssignmentReadProjection.js`, `00_AssignmentSerialisation.js` and both frontend read services.
Generated-bundle load order is asserted by
`scripts/builder/src/steps/backend-copy.spec.ts`. The definition-write artefact invariant and the
existing blank-grid model rule are documented below. The acquisition/extraction boundary producers
are recorded in [Component Shape: Student Submission § Acquisition and extraction outcomes](../data-shapes/student-submission.md#acquisition-and-extraction-outcomes); read restoration
preserves their valid `E` placeholders rather than re-diagnosing the cause. The `ImageManager`
hydration boundary is summarised below, as are the prepared write projections.

- **Single restoration pass.** `AssignmentRehydration._baseFromJSON()` and
  `AssignmentRehydration._rehydrateSubmission()` (delegating to `AssignmentCurrentRestoration`)
  restore each identified marker-1 submission and item once with an explicit full/partial mode.
  The whole-submission catch/retry flow, per-item drop and plain-object
  fallback are removed; explicitly invalid records become typed E placeholders and healthy siblings
  are preserved.
- **Submission model domain split.** `StudentSubmissionItem` lives in
  `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js`, and `StudentSubmission`
  remains the entry/facade in `src/backend/Models/StudentSubmission/index.js`. The public
  class/namespace API and guarded test exports are preserved; GAS load order loads the item model
  before its submission facade. `scripts/builder/src/steps/backend-copy.spec.ts` asserts that order
  against the real backend tree, including that `02_AssignmentReadProjection.js` precedes
  `02_AssignmentRehydration.js`; `tests/setupGlobals.js` mirrors the item/submission order. Each
  file stays within the ≤320-line target.
- **Completed-item coverage materialisation.** The backend is authoritative for completed-item
  coverage on marker-1 reads. `AssignmentCurrentRestoration._rehydrateCurrentSubmission()`
  materialises a terminal `CORRUPT_RECORD` E item for every known task missing from an identified
  submission, using the assignment's own embedded task snapshot before that snapshot is stripped
  from class transport. A known task key paired with a mismatched item `taskId` becomes
  `CORRUPT_RECORD` E for that key; an item referencing no task in the embedded definition fails the
  owned dataset. Backend-materialised E entries are never overwritten by later coverage inference.
  The browser partial-read normaliser validates only the entries it is given and does not infer
  extra coverage errors from the separately loaded, potentially newer definition registry. The
  browser full-read normaliser provides a defensive same-payload fallback: only if a full wire
  payload nevertheless lacks an expected item does it produce `CORRUPT_RECORD` E using that same
  payload's definition; it never overwrites backend-materialised E. This fallback is a
  post-backend-validation corruption defence, not the normal coverage owner. No new task-universe
  transport field or full fetch is needed.
- **Model-owned raw validation.** Raw current-version validation belongs to the existing model
  restoration owners: `Assessment` validates its own result/cause, `StudentSubmissionItem` and
  `StudentSubmission` validate their own full/partial records, and `AssignmentCurrentRestoration`
  owns graph traversal and contextual error isolation. Validation happens before coercive
  `fromJSON`/constructor normalisation can erase missing `content`/`contentHash` or malformed
  assessment entries. Conversion to E is limited to explicit raw-data validation failures;
  arbitrary constructor or programming faults still throw. The API boundary does not add a second
  domain-validator hierarchy.
- **Read-time cause selection.** `AssignmentCurrentRestoration._hasConsistentCurrentSource()` treats
  null submission content beside numeric/N marks on a current-format full read as a contradictory
  stored record, not evidence of a past failure: all three results become validation
  `CORRUPT_RECORD` E with its catalogue reasoning. Confirmed unavailability at the actual extraction
  boundary instead creates extraction `SOURCE_CONTENT_UNAVAILABLE` E. See
  [Component Shape: Student Submission § Acquisition and extraction outcomes](../data-shapes/student-submission.md#acquisition-and-extraction-outcomes).
  Partial redaction is exempt from this full-content consistency check.
- **Image hydration boundary.** `src/backend/RequestHandlers/ImageManager.js` owns the scoped IMAGE hydration boundary and reuses the shared transport budget plus the existing Slides document round-robin scheduling. Pending IMAGE content before hydration is valid internal state, never a terminal or completed result: a Slides IMAGE is pending only when it has a matched student page and parser-generated `metadata.sourceUrl`, and a missing IMAGE match is extraction `SOURCE_CONTENT_UNAVAILABLE` E. A student image with no admissible source URL, a final non-200/network outcome or unusable returned content becomes the atomic extraction `IMAGE_HYDRATION_FAILED` E with null content/hash on that task, while an item already carrying an upstream all-three terminal `E` is preserved verbatim and an already-hydrated artefact with no admissible source is skipped. A required shared reference/template image with no usable source or owning document, a final download failure or unusable returned content blocks the run by throwing (an already-hydrated shared artefact with no usable source is skipped); prior saved results are preserved because no completed persistence occurs, not because in-memory state is rolled back. Successful writeback writes data-URL content and the model hash, invalidating stale assessments/feedback only when content changed. Unmatched or duplicate UIDs, missing model methods or structures and other wiring faults throw; they are not hydration failures. Completion gating, pending-image rejection and marker stamping are owned by the completed-run gate (see [Restoration and projection ownership](#restoration-and-projection-ownership)). The full outcome table is recorded in [Component Shape: Student Submission § Image hydration outcomes](../data-shapes/student-submission.md#image-hydration-outcomes).
- **Identity failure.** A valid submission with corrupt items yields E for its known definition tasks. If student/task identity or the shared root/definition is untrustworthy, the owned dataset fails loudly instead of guessing associations.
- **Definition-write artefact invariant.** `AssignmentDefinitionValidation.validateSharedArtifacts()` in `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js` owns the definition-write invariant, invoked by `AssignmentDefinitionUpsertOrchestrator` on the final resolved tasks after weighting and before constructing or persisting the definition. At new definition writes, non-IMAGE artefacts must already have non-null content and a string hash; valid blank TEXT/array templates are not rejected as empty. Pending IMAGE artefacts remain allowed before an assessment run; this is distinct from the stricter completed-full-assignment artefact gate, which is implemented in `ABClassAssignmentValidation._validateCompletedSharedArtefacts()` and requires usable content and a non-empty string hash on every shared reference/template artefact of the known tasks. A formula-free spreadsheet reference task is an unusable shared definition and is rejected at the definition-write boundary. Expected content rejections log bounded `{ taskId }` context and throw `ApiValidationError` with the existing safe `DEFINITION_PARSE_FAILED` message and code; missing structure and other wiring faults propagate unchanged. Blank `[]` templates remain valid. Existing definition rollback semantics are unchanged, no separate parser/API validators are added, and no run-time eligibility preflight is introduced.
- **Blank spreadsheet grids (existing model rule; reused).** The blank-grid owner is `SpreadsheetTaskArtifact.normalizeContent` in `src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js`. It canonicalises a successfully read blank/all-null grid to `[]` with the normal hash of `[]`, for blank templates and blank student ranges through construction, persistence and restoration. Parsers and restoration reuse that model rule instead of adding competing blank-grid coercion. Literal `null` means unavailable spreadsheet content, not blank content. The extraction boundary materialises extraction `SOURCE_CONTENT_UNAVAILABLE` E for known tasks whose content is unavailable; read restoration still converts only contradictory stored records to validation `CORRUPT_RECORD` E. Existing populated-formula normalisation and blank-range formula scores are unchanged.
- **Legacy reassessment projection (active read path).** `AssignmentRehydration.projectReassessmentSubmissions()`
  delegates to the pure `AssignmentReadProjection` in
  `src/backend/AssignmentProcessor/Assignment/02_AssignmentReadProjection.js`; the facade keeps one
  operation, not a second materialiser. `ABClassResponseMapper._toReadView` invokes it with the
  loaded roster before definition-key replacement, and `AssignmentSerialisation.toReadJSON()` invokes
  it for a direct full read with stored identities after `_ensureFullDefinition`. The class path
  keeps its own stored task summaries, so abnormal legacy partial-definition records can expose
  different task universes between the two reads. Neither path repairs or rewrites history. Load
  order requires `02_AssignmentReadProjection.js` before `02_AssignmentRehydration.js`; both share
  the `02_` prefix, so the generated-bundle order depends on the builder's lexicographic filename
  sort. `scripts/builder/src/steps/backend-copy.spec.ts` asserts that copied order.
  `AssignmentLegacyRead` is implemented beside it but has no caller yet; see
  [Legacy read preparation](#legacy-read-preparation).
- **Legacy instance state.** `_baseFromJSON()` stores the legacy submission body in
  `submissions` and the original marker in `assessmentContractVersion`, with
  `_legacyMarkerPresent` recording whether the stored field existed. A present body keeps its
  stored shape; only an absent property keeps the constructor's empty array.
  `_legacyMarkerPresent` is never serialised itself. Placeholder timestamps and source-ID rules
  are in [Legacy records](#legacy-records).
- **Legacy persistence versus read projection.** Persistence `toJSON()`/`toPartialJSON()`
  serialise the legacy submission body and re-emit the marker only when `_legacyMarkerPresent`
  records its presence; they never emit reassessment E placeholders. An array body is serialised
  per submission; a present non-array body (`null` or an object) is emitted through
  `_plainSubmissionJSON()`, never as `[]`. Both read paths emit the
  marker as null. Class persistence preparation and writes never receive read placeholders;
  current-version serialisers retain their normal full/partial semantics. A freshly restored
  marker-1 partial instance carries no legacy marker, so replacing a class assignment after a run
  does not resurrect legacy history. An ordinary class save must not validate historical marks
  against the completed-item contract, strip stored content or certify the old result as current.
- **Browser boundary.** Both frontend read services run the normaliser over these already materialised entries and keep defensive per-item corruption isolation. It does not generate a second reassessment graph, query a roster or infer historical outcomes.
- **Projection preparation before write.** `ABClassAssignmentOps.persistAssignmentRun()` (`src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`) validates the completed result through `ABClassAssignmentValidation` and prepares four payloads before the first collection mutation: the full assignment and its embedded partial (from `Assignment.toJSON()`/`toPartialJSON()`), plus the prospective updated full-class and class-partials documents. The class projections reuse the existing preparation owner — `ABClassPersistence._prepareFullClass()`/`_prepareClassPartial()` in `src/backend/y_controllers/ABClassController/ABClassPersistence.js` — rather than adding a second preparation path. Read projections are never inputs to this preparation; it serialises the authoritative assignment's own current-version or legacy instance state. The assignment and class payloads are plain serializer output, not deep-detached clones of the model. The write order (full record, then `ABClass`/partials) and its non-transactional failure semantics are unchanged; prepared payloads are retained through each write, and a storage failure throws and logs the failed phase plus whether the full write committed.
- **Read paths stay read-only.** `readRehydrateAssignment` and class reads do not refresh rosters, repair records or write back. Reassessment E projections are derived per read, not persisted, and legacy read preparation runs on an independent receiver so saved state and later persistence output stay untouched.

## Error Handling

| Situation                                         | Action                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| Full collection missing                           | Throw `Error` (message includes collection name) |
| Empty collection                                  | Throw (treated same as missing)                  |
| Corrupt doc (missing `assignmentId` / mismatch)   | Throw                                            |
| Assignment absent in `assign_full_...` collection | Throw `AssignmentNotFoundError`                  |

## Testing Guidelines (Vitest)

| Test                                  | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| Hydrates successfully                 | Replaces partial with full; sets `_hydrationLevel` |
| Throws on missing full collection     | Ensures error path                                 |
| Throws when assignment not in ABClass | Guard condition                                    |
| Replacement returns new instance      | Ensures immutability contract                      |
| Old reference remains partial         | Validates caller must adopt new reference          |

## Future Extensions (Deferred)

- Artifact-level selective hydration (per `artifact.uid`)
- Background prefetch queue (hydrate last opened N assignments)
- Staleness comparison using `updatedAt` revision suffix
- Metrics: count hydration events / average ms

## Controller Integration Notes

- `readRehydrateAssignment()` is a read-only path used by the `getAssignment_()` API
  handler. It loads and hydrates an assignment from its dedicated collection
  without an ABClass instance, roster refresh, or persistence write.
- `getAssignment_()` serialises the result with `Assignment.toReadJSON()`, which
  delegates to `AssignmentSerialisation.toReadJSON()` and keeps the existing
  transport conversion (`progressTracker` strip and `DateUtils.deepConvertDates()`).
- `processSelectedAssignment()` (the write path) creates a new `Assignment` instance
  from the definition and persists via `persistAssignmentRun()`. It does not call
  `readRehydrateAssignment()` — the full document is written from scratch on each run.
- Other assignments remain partially hydrated inside `abClass.assignments`, so
  list and cohort views stay light even while one assignment is being processed.
  `ABClassResponseMapper._toReadView()` projects legacy stored submissions with the
  loaded roster before replacing the embedded definition with its key.
