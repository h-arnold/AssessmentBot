# Assignment Rehydration Strategy

> **See also:** Canonical shape definitions for partial and full assignment records
> live in [`docs/developer/data-shapes/`](../data-shapes/INDEX.md).
> This doc describes the _process_ of hydration; the data-shape docs define the
> _structure_ at each hydration level.

This document describes how _full_ assignment hydration works when starting from the
lightweight (partially hydrated) assignment objects embedded inside an `ABClass`
instance that was loaded from JsonDbApp.

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

## Persistence Workflow

We use a **Split Persistence Model**:

1.  **Full Persistence**: The complete assignment object (with all artifacts and content) is serialized via `toJSON()` and written to the dedicated `assign_full_...` collection.
2.  **Partial Summary**: A lightweight summary is generated via `toPartialJSON()` and stored in the `ABClass.assignments` array.

This ensures `ABClass` remains small and fast to load, while the full data is preserved safely in a separate document.

### End-to-end hydration/dehydration sequence (strict model)

Classes and primary methods (in call order):

1. **AssignmentDefinitionController.upsertDefinition()**

- Validates inputs, resolves topic, and checks staleness.
- Parses tasks via `_parseSlidesTasks`/`_parseSheetsTasks`, which now always rehydrate into `TaskDefinition` instances (`TaskDefinition.fromJSON(td.toJSON())`).
- Persists both forms: `_persistDefinitionWithRollback` → full collection (`toJSON()`), partial registry (`toPartialJSON()`).

2. **ABClassController.persistAssignmentRun()**

- Persists full assignment to `assign_full_<courseId>_<assignmentId>` using `Assignment.toJSON()` (includes fully hydrated `AssignmentDefinition`, `TaskDefinition`, and `BaseTaskArtifact` subclasses with content).
- Builds and stores partial summary via `Assignment.toPartialJSON()` (submissions/artifacts redacted) back into the owning `ABClass` document.

3. **ABClassController.loadClass()** (not changed)

- Returns the lightweight `ABClass` with only partial assignments (heavy fields already stripped).

4. **AssignmentController.processSelectedAssignment()**

- Creates a fresh `Assignment` instance from the definition, runs the assessment pipeline, then persists via `ABClassController.persistAssignmentRun()`. Does not rehydrate from the full collection — the full document is written anew on each run.

5. **ABClassController.readRehydrateAssignment(courseId, assignmentId)**

- Read-only operation: loads the full document from `assign_full_<courseId>_<assignmentId>` without refreshing roster data or mutating ABClass.
- Reconstructs the typed instance via `Assignment.fromJSON()`; this cascades into `AssignmentDefinition.fromJSON()`, which in turn strictly hydrates tasks (`_hydrateTasks` requires `taskTitle` and instantiates `TaskDefinition`, whose artifacts are materialised via `ArtifactFactory.fromJSON`).
- Resolves partial definitions via `AssignmentDefinitionController.getDefinitionByKey(definitionKey, { form: 'full' })`.
- Marks `_hydrationLevel = 'full'` on the returned instance.
- For a marker-1 record, restores submissions in one validated pass. For a legacy record (marker missing, `null`, or unsupported), keeps the stored submissions opaque and does not rehydrate historical items.

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

| Stored state                              | Behaviour                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1`                                       | One validated pass per identified submission and item, using the requested `full` or `partial` mode.                                                                                 |
| Missing, `null`, or any unsupported value | Opaque legacy history: submissions are **not** item-rehydrated. The stored submission body, marker presence and exact marker value are kept as a deep, independently owned snapshot. |

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

For a non-marker-1 record, `_baseFromJSON()` leaves `inst.submissions` empty. Persistence
(`toJSON()`/`toPartialJSON()`) copies the opaque snapshot and the original marker, so an ordinary
save cannot validate, rewrite or re-certify the historical result.

Reads derive a detached projection through
`AssignmentRehydration.projectReassessmentSubmissions(assignment, students, form)`:

- `full` form uses the stored submission identities from the opaque snapshot and reads no roster.
- `partial` form uses the loaded class roster and treats stored summaries as source metadata only.
- Each student/task pair becomes a `StudentSubmission` with one `BaseTaskArtifact`
  (`role: 'submission'`, `type: 'base'`, null content/hash, empty metadata, deterministic
  `reassessment-<hash>` UID) and all three criteria set to validation `REASSESSMENT_REQUIRED` E.
- Source IDs are retained only when identifier-shaped; timestamps use valid stored values, otherwise
  the assignment's `createdAt` plus its `updatedAt` (or `createdAt`).
- Both read paths emit `assessmentContractVersion: null`.

The projection is derived per read and is never persisted.

## Section 2 restoration and projection ownership

**Backend status:** the Section 2b backend legacy persistence and read slice is implemented in
`02_AssignmentRehydration.js`, `02_AssignmentCurrentRestoration.js`, `02_AssignmentReadProjection.js`
and `00_AssignmentSerialisation.js`. The frontend normaliser/consumer activation, synthetic corpus
regeneration, the 17 known synthetic cutover failures, the Section 3 gate and later UI work remain
pending, as do the `ImageManager` hydration boundary, definition-write artefact invariant and
prepared write projections below. This does not assert that the atomic Section 2 regression gate has
passed or that Section 2 is complete.

- **Single restoration pass.** `AssignmentRehydration._baseFromJSON()` and
  `AssignmentCurrentRestoration` restore each identified marker-1 submission and item once with an
  explicit full/partial mode. The whole-submission catch/retry flow, per-item drop and plain-object
  fallback are removed; explicitly invalid records become typed E placeholders and healthy siblings
  are preserved.
- **Submission model domain split.** `StudentSubmissionItem` now lives in
  `src/backend/Models/StudentSubmission/00_StudentSubmissionItem.js`, and `StudentSubmission`
  remains the entry/facade in `src/backend/Models/StudentSubmission/index.js`. The public
  class/namespace API and guarded test exports are preserved; GAS load order loads the item model
  before its submission facade. `scripts/builder/src/steps/backend-copy.spec.ts` asserts that order
  against the real backend tree, and `tests/setupGlobals.js` mirrors it. Each file stays within the
  ≤320-line target. The generated-bundle assertion for the `02_` read-projection/restoration order
  remains pending.
- **Completed-item coverage materialisation.** The backend is authoritative for completed-item
  coverage on marker-1 reads. `AssignmentCurrentRestoration._rehydrateCurrentSubmission()`
  materialises a terminal `CORRUPT_RECORD` E item for every known task missing from an identified
  submission, using the assignment's own embedded task snapshot before that snapshot is stripped
  from class transport. A known task key paired with a mismatched item `taskId` becomes
  `CORRUPT_RECORD` E for that key; an item referencing no task in the embedded definition fails the
  owned dataset. Backend-materialised E entries are never overwritten by later coverage inference.
  The browser partial-read normaliser will validate only the entries it is given and must not infer
  extra coverage errors from the separately loaded, potentially newer definition registry. The
  browser full-read normaliser has a mandatory defensive same-payload fallback: only if a full wire
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
  boundary instead creates extraction `SOURCE_CONTENT_UNAVAILABLE` E. Partial redaction is exempt
  from this full-content consistency check.
- **Image hydration boundary.** Pending IMAGE content before hydration is valid internal state, never a terminal or completed result. Reuse the planned `ImageManager` scope rules in [AssessmentFlow.md](AssessmentFlow.md): a student image failure becomes that task's `IMAGE_HYDRATION_FAILED` E, while a required shared reference/template image failure blocks the run and leaves the prior saved assignment in place. Successful hydration writeback updates the artefact hash and invalidates stale assessments/feedback on a reused item. Unmatched or duplicate UIDs, missing model methods and other wiring faults throw; they are not hydration failures.
- **Identity failure.** A valid submission with corrupt items yields E for its known definition tasks. If student/task identity or the shared root/definition is untrustworthy, the owned dataset fails loudly instead of guessing associations.
- **Definition-write artefact invariant.** `AssignmentDefinitionValidation` (`src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`) will own the new invariant for definition writes. At new definition writes, non-IMAGE artefacts must already have non-null content and a string hash; valid blank TEXT/array templates are not rejected as empty. Pending IMAGE artefacts remain allowed before an assessment run. A formula-free spreadsheet reference task is an unusable shared definition: the same validation owner will reject it at the definition-write boundary, before marking and completed-result persistence, so the run blocks without replacing the prior result, and a stored or externally supplied task must not bypass the check. Blank `[]` templates will remain valid. The existing `AssignmentDefinitionUpsertOrchestrator` will invoke this validation on the final resolved tasks before persistence, using the existing definition-failure reporting. Do not add separate parser or API validators, and do not change definition rollback semantics.
- **Blank spreadsheet grids.** The blank-grid owner is `SpreadsheetTaskArtifact.normalizeContent` in `src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js`. It canonicalises a successfully read blank/all-null grid to `[]` with the normal hash of `[]`, for blank templates and blank student ranges through construction, persistence and restoration. Parsers and restoration reuse that model rule instead of adding competing blank-grid coercion. Literal `null` means unavailable spreadsheet content. Existing populated-formula normalisation and blank-range formula scores are unchanged.
- **Legacy reassessment projection.** `AssignmentRehydration.projectReassessmentSubmissions()`
  delegates to the pure `AssignmentReadProjection` in
  `src/backend/AssignmentProcessor/Assignment/02_AssignmentReadProjection.js`; the facade keeps one
  operation, not a second materialiser. `ABClassResponseMapper._toReadView` invokes it with the
  loaded roster before definition-key replacement, and `AssignmentSerialisation.toReadJSON()` invokes
  it for a direct full read with stored identities after `_ensureFullDefinition`. The class path
  keeps its own stored task summaries, so abnormal legacy partial-definition records can expose
  different task universes between the two reads. Neither path repairs or rewrites history. Load
  order requires `02_AssignmentReadProjection.js` before `02_AssignmentRehydration.js`; both share
  the `02_` prefix, so the generated-bundle order depends on the builder's lexicographic filename
  sort. The generated-bundle order assertion remains pending.
- **Safe placeholders and opaque legacy state.** `_baseFromJSON()` keeps the legacy submission body
  plus the original marker presence/value as a deep, independently owned JSON snapshot behind the
  typed `Assignment` facade; runtime snapshot fields are not serialised themselves. Placeholder
  timestamps and source-ID rules are in [Legacy records](#legacy-records).
- **Legacy persistence versus read projection.** Persistence `toJSON()`/`toPartialJSON()` re-emit
  the opaque body and the original marker presence/value unchanged and never emit reassessment E
  placeholders. Both read paths emit the marker as null. Class persistence preparation and writes
  never receive read placeholders; current-version serialisers retain their normal full/partial
  semantics. A freshly restored marker-1 partial instance has no legacy snapshot, so replacing a
  class assignment after a run does not resurrect opaque history. An ordinary class save must not
  validate historical marks against the completed-item contract, strip stored content or certify the
  old result as current.
- **Browser boundary.** The frontend normaliser will validate these already materialised entries and keep defensive per-item corruption isolation. It will not generate a second reassessment graph, query a roster or infer historical outcomes. Frontend activation remains pending.
- **Projection preparation before write.** Extend `ABClassAssignmentOps.persistAssignmentRun()` (`src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`) to validate the completed result and prepare four independent payloads before the first collection mutation: the full assignment and its embedded partial (from `Assignment.toJSON()`/`toPartialJSON()`), plus the prospective updated full-class and class-partials documents. Reuse the existing preparation owner for the class projections — `ABClassPersistence._prepareClassAndPartial()`/`_prepareClassPartial()` in `src/backend/y_controllers/ABClassController/ABClassPersistence.js` — rather than adding a second preparation path. Read projections are never inputs to this preparation; it serialises the authoritative assignment's own current-version or opaque legacy state. The current order (full record, then `ABClass`/partials) and its non-transactional failure semantics stay; prepared snapshots are retained through each write, and a storage failure throws and logs the failed phase plus whether the full write committed.
- **Read paths stay read-only.** `readRehydrateAssignment` and class reads do not refresh rosters, repair records or write back. Reassessment E projections are derived per read, not persisted.

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
