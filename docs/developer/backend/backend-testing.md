# Backend Testing Structure and Guidelines

## Overview

AssessmentBot uses **Vitest** as the testing framework for unit and integration tests. Tests focus on logic, serialisation, state management, and behaviour in an isolated environment that mimics (but never invokes) Google Apps Script (GAS) services. External GAS / network calls are always mocked.

Backend production code still runs as concatenated GAS script files, not as a Node module graph. Tests must adapt to that runtime model rather than forcing production files to behave like normal Node modules.

Backend currently exposes API-style entry files under `src/backend/z_Api`. Tests should target the files that actually exist in the current runtime path and avoid stale `src/backend/Api` references unless and until the codebase actually moves there.

These API functions should be tested as thin wrappers around controller delegation and error propagation.

Backend configuration transport is now covered by the dedicated suite in `tests/api/backendConfigApi.test.js`. Keep broader dispatcher and allowlist coverage in `tests/api/apiHandler/` (directory with multiple dispatcher test files).

## Canonical synthetic fixtures

Use the deterministic synthetic analysis corpus when a test needs realistic analysis-domain data.

**Canonical-fixture directive:**

- All new or changed tests must use an appropriate canonical synthetic fixture when the synthetic fixture system provides data for the scenario.
- If the required realistic data is not yet supported, the test may use a local realistic fixture only when the owning feature work records a generator-extension plan (which profile, view, or generator stage to add and where).
- Deliberately invalid or boundary fixtures remain local.
- Migrate a touched existing test to a canonical fixture opportunistically; do not perform a wholesale migration.

This policy is intentionally broader than the analysis graph and applies automatically as later domains are added.

Backend tests load a committed profile view synchronously and immutably, then supply the generated transport view through the dispatcher seams described below. For the corpus topology, profile/view selection, commands, failure behaviour, and the full exception and extension path, see the canonical guide: [Synthetic Test Data](../testing/synthetic-test-data.md).

## Backend metadata bootstrap installation

> **Status: `Implemented`.** `tests/setupGlobals.js` installs the ABClass metadata domain and
> its typed error global as part of the backend ABClass `metadata` contract-support cycle. The
> canonical model-input adapter, generator integrity and real-domain-acceptance probes, ABClass
> model construction/restoration/serialization probes, mutation-owner bootstrap/delegation
> probes, read/mutation-summary response-mapping probes, the Section 7 controller request-gate
> and mutation-lifecycle probes, the Section 8 transport-adaptation and real-dispatcher
> request/error-envelope probes, the Section 9 Teacher always-own-null serialisation and real
> ABClass/roster probes, and the Section 10 combined-lifecycle and controller/API ordering
> probes are delivered. See "Canonical metadata probes" below.

- `tests/setupGlobals.js` installs the metadata domain and typed error globals after the
  existing `Validate` installation and before any ABClass-dependent module loads, including
  suites that directly `require()` `Models/ABClass.js`: `ABClassMetadataValidationError` from
  `src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js`, then `ABClassMetadata`
  from `src/backend/Models/ABClassMetadata.js`.
- In GAS runtime, the corresponding references stay inside runtime constructor/method bodies.
  Do not add production Node imports or change stable numeric prefixes to support tests.
- `tests/setupGlobals.js` registers `ABClassMutationOps` with the other controller
  sub-classes before the facade is loaded. The GAS-style evaluation and delegation contract is
  covered by `tests/controllers/abclassMutationRuntime.test.js` and
  `tests/controllers/abclassMutationDelegation.test.js`.

## ABClass canonical model-input adaptation

> **Status: `Implemented` (test-only adapter).**
> `scripts/synthetic-test-data/toBackendModelInputs.js` is delivered for the backend ABClass
> `metadata` contract-support cycle. It is test-only infrastructure: production `src/backend`
> source never imports it, and it changes no production contract. The delivered Section 2
> generator integrity and real-domain-acceptance probes are listed under "Canonical metadata
> probes" below. Cross-reference:
> `docs/developer/testing/synthetic-test-data.md` §ABClass metadata generator capability.

### `toBackendModelInputs.js` (`Implemented`)

Location: `scripts/synthetic-test-data/toBackendModelInputs.js`.

- Test-only adapter shared by backend model, controller and persistence tests. It adds no
  production dependency and must never be imported by GAS runtime source.
- Export `loadBackendModelInputs(profileName)`; require an explicit profile name. Call
  `loadSyntheticAnalysisProfile(profileName, viewName)` once per view with view names
  `classPartials`, `classesById`, `assignmentsByKey`, `editableDefinitions` and
  `assignmentDefinitionPartials`. The fifth view resolves the partial-only assignments'
  definitions, which are absent from `assignmentsByKey` and `editableDefinitions`. For the
  default test selection call it with `'small'`; use `'medium'` for wider variants.
  Each loader result is deeply frozen, not a `transport` wrapper. `classPartials` is an
  array; `classesById` is keyed by `classId`. Clone before adaptation/mutation. Reserve
  `transport.*` notation for the in-memory generator graph only.
- Return `{ classPartials, classesById, assignmentsByKey }` as three independently cloned
  outputs, retaining every canonical class assignment. The adapter resolves
  `editableDefinitions` and `assignmentDefinitionPartials` internally; each output owns its
  mutable nodes, with no shared aliases between outputs, the frozen loader views, or a second
  adaptation.
- Class-embedded assignments keep the raw root `assignmentDefinitionKey` and stay redacted
  partials. The adapter resolves each assignment's definition from `editableDefinitions` when
  it is a full definition, and from `assignmentDefinitionPartials` when it is partial-only,
  then attaches a cloned `assignmentDefinition` whose `tasks` are the lightweight
  array-of-summaries shape (`taskId`, `taskTitle`, `taskWeighting`) that
  `AssignmentDefinition.fromJSON()` accepts.
- Standalone `assignmentsByKey` records already carry their full keyed-task definitions and
  freshness fields. The adapter validates that each resolves to a full canonical definition
  but leaves the embedded definition in place, so `Assignment.toJSON()` still treats the
  record as full; it never replaces the full definition with an editable summary.
- Genuine partial-only definitions stay partial and serialise through the partial path; the
  adapter never promotes them to full definitions and never drops their assignments.
- Inputs preserve canonical raw values: a raw `null` `assignmentWeighting` stays `null` in the
  adapted inputs, and any restoration-time normalisation (for example to `1`) remains the
  model constructor's responsibility.
- Outputs include ABClass roster JSON (`classOwner`, `teachers`, `students`) derived from the
  `classesById` view, suitable for real model restoration and owner/teacher-array
  serialisation coverage. Keep legacy plain teacher entries: `ABClass.fromJSON()` copies
  `teachers[]` through unchanged and does not hydrate its entries. Wrap restoration in
  `withTemporaryGlobals({ Teacher: () => Teacher }, () => ABClass.fromJSON(...))` to install
  the real global for `classOwner` restoration. When a test must exercise the shared
  teacher-array `Teacher.toJSON()` serialiser, explicitly materialise the canonical plain
  entries with `Teacher.fromJSON()` while composing that ABClass; the scoped global install
  alone does not hydrate `teachers[]`. Do not add production teacher-array hydration.
- Never feed a frontend assignment partial directly to `Assignment.fromJSON()`, and never
  mutate the frozen loader output in place. All adaptation happens on local clones.
- Backend model-input assertions live in the tests-only
  `tests/synthetic-analysis/backendModelInputAssertions.js` helper, shared across the suites
  that need it: the adapter suite imports it as `./backendModelInputAssertions.js`, and the
  model, controller and stress suites import it as
  `../synthetic-analysis/backendModelInputAssertions.js`. It is not a runtime dependency and is
  not reachable through the `#test-helpers/*` alias, which maps only to `tests/helpers/*`.
- The helper exports the submission assertions (`expectFullSubmissionPreserved`,
  `expectPartialSubmissionRedacted`, `expectPartialSubmissionMatchesRedactedSource`) and the
  ownership assertion `expectMetadataNodesDetached(snapshots)`, which checks pairwise `toBe`
  identity across populated metadata snapshots at the root, `classAverages`,
  `recentAssignments[]` and each entry's `averages`, skipping null snapshots.
- `expectMetadataNodesDetached` is used by the controller metadata persistence suite
  (`tests/controllers/abclassMetadataPersistence.test.js`), the model metadata integration
  suite (`tests/models/abclassMetadataIntegration.test.js`) and the opt-in stress suite
  (`tests/synthetic-analysis-stress/syntheticClassMetadataFullLarge.test.ts`), so the
  ownership-isolation contract cannot drift between cloned copies.

### Test infrastructure reuse

> **Status: `Implemented`.** The adapter, the import mappings, the existing-row roster-mock
> guidance and the dispatcher-integration bullet below are delivered. The dispatcher-integration
> guidance is backed by the delivered Section 8 real-dispatcher suites
> (`tests/api/apiHandler/abclassMetadata*`), and it stays contract-sensitive because default
> harness stubs and prebuilt synthetic responses are not evidence of real domain validation.

- The root `package.json` `imports` map provides `"#synthetic-data/*": "./scripts/synthetic-test-data/*"`.
  Backend `.test.js` suites use ESM named imports from
  `#synthetic-data/toBackendModelInputs.js` and `#synthetic-data/loadSyntheticAnalysisProfile.js`,
  not `require()` of these ESM script modules. Existing `#synthetic/*` continues to mean
  committed JSON views; there is no second loader or production import.
- Shared test helpers are reachable as `#test-helpers/*` (`tests/helpers/*`).
- `#backend/*` is the supported, required convention for backend source in new and touched
  suites. The import-path depth rule (see `TypeScriptAndLintConfigHierarchy.md`) enforces the
  alias convention repo-wide: relative imports may traverse at most one parent, and two or
  more parents must use a configured alias. Legacy relative paths still exist in untouched
  suites (for example non-literal `require.resolve('../../src/backend/...')` module paths) and
  must not be copied into new work. Nearby helpers reached as `../helpers/...` remain relative.
- Reuse `globalMockManager` and `apiHandlerTestUtils`, plus local external-service mocks, for
  the wider class graph. Do not invent realistic class graphs in tests; derive them from
  canonical data.
- For real ABClass dispatcher contracts, the default dispatcher setup replaces both the
  controller and transport globals. After shared setup, reinstall the real `ABClassController`
  and real ABClass mutation/read handlers before dispatch, following the existing
  `dispatcher-integration.test.js` real-handler pattern; restore all globals afterwards.
  Prebuilt synthetic responses and default handler/controller stubs are not evidence of
  real domain validation. No shared-harness refactor is planned.
- Existing-row roster mocks provide stored `_id` and `updateOne` with vendor-faithful
  results: `_id`-only matched/no-op patches return a match; query-filter no-op results
  do not. Include the facade `abclassManager.saveClass`, `loadClass` and `initialise`
  suites when changing extracted save checks or roster persistence.
- The API-handler test facade remains at `tests/api/apiHandler/shared.js`; dispatcher
  fixtures, VM helpers and auth lifecycle live in sibling `sharedFixtures.js`,
  `vmHelpers.js` and `authTestContext.js`. Reference-data controller cases stay in
  responsibility-focused suites: `referenceDataController.test.js` (cohorts),
  `referenceDataController.yearGroups.test.js`,
  `referenceDataController.assignmentTopics.test.js` and
  `referenceDataController.transportResponses.test.js`. Their isolated setup and
  restoration helpers are in `referenceDataTestSupport.js`. Run both groups with
  `npm run test:backend -- 'tests/controllers/referenceDataController*.test.js' tests/api/apiHandler`.

### Canonical metadata probes

**Generator integrity and domain acceptance (`Implemented`).** These Section 2 probes are delivered:

- `tests/synthetic-analysis/syntheticClassMetadataValidation.test.ts` rejects isolated raw
  corruptions inside the compact graphs through the generator-owned `validateClassMetadata.js`
  helper, and checks a metadata corruption through the public
  `validateSyntheticAnalysisGraph()` boundary.
- `tests/synthetic-analysis/syntheticClassMetadataDomainAcceptance.test.ts` validates every
  raw persistence, `classPartials` and `classesById` snapshot through the real
  `ABClassMetadata.validateMetadata()` domain owner, pinning each profile's non-null and
  marker variants.

**Model round trips and integrity (`Implemented`).** Section 3 adds
`tests/models/abclassMetadataIntegration.test.js` to exercise canonical null and non-null
variants through ABClass construction, restoration, replacement, and full/partial
serialization. Metadata-only full JSON round trips use an empty assignments array because
class-embedded assignment definitions are partial-shaped; a separate characterization keeps
the complete canonical assignment population for existing hydration/redaction behaviour. The
direct-mutation test also uses a cloned canonical `medium` snapshot to verify that equal
timestamps and repeated definition keys are accepted and that supplied entry order is retained.
These tests cover model boundaries only, not controller or API operations.

**Controller decomposition (`Implemented`).** Section 4's
`tests/controllers/abclassMutationDelegation.test.js` verifies options-object dependency
injection, facade delegation, shared save validation before persistence, and preservation of
the validated class instance through persistence and summary mapping. Its direct-owner upsert
cases were migrated in Section 7 to supply `_validateRequestMetadata` on the injected validation
collaborator (a no-op spy for the legacy no-metadata inputs) and assert it is invoked once with
the request parameters before persistence; production wiring is not weakened with optional-method
fallbacks. `tests/controllers/abclassMutationRuntime.test.js` verifies bootstrap registration and
GAS-style evaluation order. These are behaviour-preserving decomposition probes; they do not
exercise metadata request validation on the real controller path or persistence lifecycle
behaviour.

**Prepared whole/partial writes and field-scoped roster persistence (`Implemented`).**
Section 5 adds the persistence/roster suites and the supplemental model/workflow coverage:

- `tests/controllers/abclassMetadataPersistence.test.js` covers whole-write and plain-object
  preparation: detached equal metadata copies across canonical null/numeric/marker/mixed
  variants, caller and projection isolation, own-undefined/invalid rejection with zero
  mutations, throwing or differing partial projections, full-first ordering, and exact
  full-save/partial-save failure propagation with the existing logged diagnostics.
- `tests/controllers/abclassMetadataEditablePersistence.test.js` covers selective editable
  preparation: the complete partial is prepared before the selective full-store `$set`, a legacy
  full document keeps metadata absence while the rebuilt partial carries `null`, and a failed
  projection or malformed restored snapshot writes neither store.
- `tests/controllers/abclassRosterPersistence.test.js` covers field-scoped roster persistence:
  the exact registry `$set` for `className`/`classOwner`/`teachers`, the stored `_id` filter, no
  metadata accessor read or `toPartialJSON()` call on an existing row, complete missing-row
  insertion prepared before the full-store write, vendor-faithful `matchedCount` (a
  matched-but-unmodified `_id` patch succeeds and a true zero-match patch fails without
  fallback), and full-first ordering with no partial write after a failed full save.
- `tests/models/abclassEmbeddedAssignmentSerialisation.test.js` and
  `tests/controllers/abclassEmbeddedAssignmentPersistence.test.js` add the supplemental
  canonical non-empty/mixed model round trips and the real `persistAssignmentRun()` workflow.
  They prove the actual partial/full embedded-assignment population survives whole-class
  serialisation and reaches both stores with equal detached metadata. Metadata-only
  `assignments: []` probes remain valid narrow unit coverage but are no longer the sole
  whole-class integration evidence.
- Load/save fixture migrations accompany the new behaviour:
  `tests/models/abclassManager.saveClass.test.js` asserts the prepared full/partial payload
  copies (including `metadata: null`) instead of caller identity, and
  `tests/models/abclassManager.loadClass.test.js`, `tests/controllers/abclass-loadClass.test.js`
  and `tests/controllers/abclass-roster-sync.test.js` carry the stored `_id`/vendor-faithful
  `updateOne` corrections and the field-scoped roster assertion.
- Non-transactional I/O risk stays explicit: the suites assert full-first ordering and existing
  failure propagation, and do not emulate transactions, rollback or retry.

**Backend CommonJS import identity (`Implemented`).** Suites that consume the bootstrap globals
resolve their backend CommonJS owners — `ABClass`, `ABClassMetadata`, `ABClassValidation`,
`ABClassPersistence`, `ABClassRoster` and `ABClassMutationOps` for the persistence suites, and
`ABClass`, `Teacher`, `ABClassController`, `abclassMutations.js`, `abclassRead.js` and
`z_apiHandler.js` for the Section 8 transport suites — through the same `#backend/*` `require()`
route, so they share the constructors installed by `tests/setupGlobals.js`. Mixing static ESM
backend imports with those bootstrap CommonJS globals creates duplicate module identities that
silently split coverage counters; the `#backend` require route keeps one identity. Static named ESM
imports remain required for the script-owned synthetic adapter and loader
(`#synthetic-data/*`), which are ESM-only. This is scoped guidance for suites that consume
bootstrap globals, not a blanket ban on ESM imports and not a configuration-policy change.

**Response mapping and registry-only reads (`Implemented`).** Section 6 delivers validated,
nullable `metadata` on existing read and mutation-summary responses and splits the oversized
read suite:

- `tests/controllers/abclassMetadataResponses.test.js` exercises the real
  `ABClassResponseMapper`, controller and `getABClass_` handler: equal, detached metadata across
  the registry (`_normaliseClassPartial`), full-read (`_toReadView`) and mutation-summary
  (`_buildClassSummary`) projections; legacy partial/full absence and explicit `metadata: null`;
  typed rejection of invalid stored metadata with no read-time insert, save, update or replace;
  registry-only list reads (no full-collection load, assignment hydration, definition lookup or
  Classroom call); and preserved not-found `null`.
- `tests/controllers/abclassController.readClass.test.js` retains the pure-read/loading
  characterisations (method presence, not-found, read view, no roster refresh/persist), and
  `tests/controllers/abclassController.readClass.assignments.test.js` retains the assignment
  projection/redaction/integrity cases, including the real-`Assignment.toPartialJSON()`
  regression that keeps the `assignmentDefinitionKey` projection and strips the embedded
  definition. The split preserves the original assertions and changes no data-shape contract.
  These are read/projection probes only; they do not cover request metadata acceptance or the
  transport error adapter.
- Run the metadata response suite with the registry-partial read suite, both split read suites
  and the API read suite:
  `npm run test:backend -- tests/controllers/abclassMetadataResponses.test.js tests/controllers/abclass-partials-read.test.js 'tests/controllers/abclassController.readClass' tests/api/abclassRead.test.js`.
- Existing exact registry and mutation-summary output expectations gained the always-emitted
  `metadata: null` for legacy absence (for example `tests/controllers/abclass-partials-read.test.js`
  and `tests/controllers/abclass-upsert-update.test.js`). This is an output-shape migration for
  the new field, not new request metadata acceptance.

**Controller request gate and mutation lifecycle (`Implemented`).** Section 7 adds
`tests/controllers/abclassMetadataMutations.test.js` and
`tests/controllers/abclassMetadataLifecycle.test.js`. Both drive the real
`ABClassController`/`ABClassMutationOps` path with the real `ABClass`/`ABClassMetadata` model
boundary and per-store collection mocks, asserting against actual write-call arguments, restored
model instances and returned summaries rather than clone-on-read values:

- `abclassMetadataMutations.test.js` covers the new/existing upsert and update
  omission/null/replacement matrix over canonical `small`/`medium` snapshots: persisted full and
  partial values, the returned mutation summary, and nested isolation between caller request,
  restored model, full write payload, partial write payload and summary. Update omission stays a
  true selective no-write of `metadata` (no fabricated `$set`); upsert omission preserves the
  restored snapshot or the new-class `null`. It also proves the request gate rejects own
  `undefined`, malformed metrics, unexpected keys, sparse/oversized recent arrays, non-canonical
  timestamps and partial nested averages before **any** `getCollection` access, read, Classroom
  roster call or store write, and that an invalid mixed `active`/`metadata` patch applies none of
  its fields (collection, roster and per-store write counters aggregated into one expected-zero
  assertion).
- `abclassMetadataLifecycle.test.js` covers corrupt stored metadata as a non-request integrity
  failure that is not repaired by a valid replacement or `null` (no read, roster call or write
  after the failing restore), propagation of upstream Classroom exceptions and persistence
  failures without request provenance, preservation of the last supplied snapshot across an
  unrelated editable update and a `loadClass` roster refresh followed by a whole-class upsert,
  and assessment persistence into the separate `assign_full_<courseId>_<assignmentId>` store
  with embedded partial/full assignments and redaction retained. It pins the metadata-free roster
  exception — the full-store roster `$set` is exactly
  `className`/`classOwner`/`students`/`teachers` and the registry `$set` exactly
  `className`/`classOwner`/`teachers`, with no `metadata` in either — and characterises the
  canonical zero-entry snapshot by root/`classAverages`/array identity without inventing entries.
  Existing missing-update, protected-field and deletion-flag behaviour (including the vendor
  `false`-return flag quirk) is retained.
- Both suites keep canonical `small`/`medium` class, assignment and definition identities and
  membership, and clone only for invalid/corrupt/boundary probes. The assertion helpers
  (`createCollection`, `writeMetadataPayload`, `expectSnapshotDetached`, `collection`, `harness`,
  `expectOwnedSnapshots`, `expectCanonicalAssignments`) stay local to each suite; no shared helper
  module was introduced. Snapshot staleness, no-repair and request-only provenance are asserted
  rather than repaired.
- Run the Section 7 request/lifecycle suites with the existing upsert/update, delete,
  assignment-persistence and backend API mutation units:
  `npm run test:backend -- tests/controllers/abclassMetadataMutations.test.js tests/controllers/abclassMetadataLifecycle.test.js tests/controllers/abclass-upsert-update.test.js tests/controllers/abclass-delete.test.js tests/controllers/abclassController.persistAssignment.test.js tests/backend-api/abclassMutations.unit.test.js`.

**Transport adaptation and real-dispatcher probes (`Implemented`).** Section 8 delivers the
transport request-error adapter and the real-dispatcher request/error-envelope contracts.

- `tests/api/abclassMetadataApi.test.js` exercises the mutation transport wrappers directly:
  `upsertABClass_`/`updateABClass_` forward omitted/`null`/object/own-`undefined` metadata with the
  original parameters object identity; only a typed `ABClassMetadataValidationError` with
  `inputSource: 'request'` becomes an `ApiValidationError` with the same path-bearing message; and
  model-typed, same-message-but-untagged, request-tagged generic/wrong-typed, persistence, upstream
  and wiring failures are rethrown unchanged.
- `tests/api/apiHandler/abclassMetadataReads.test.js` and `abclassMetadataWrites.test.js` dispatch
  through the real allowlisted `apiHandler`, real handlers, `ABClassController`, `ABClass`,
  `Teacher`, persistence and response mapping: registry and full reads expose raw metadata
  (JSON-safe, timestamp strings, storage-only `_id` stripped); a missing full class stays top-level
  `null`; an empty registry stays `[]`; update/upsert persist and summarise metadata for
  omission/`null`/replacement; an omitted update preserves the stored snapshot; and deletion
  results stay metadata-free.
- `tests/api/apiHandler/abclassMetadataErrors.test.js` proves caller-versus-internal separation:
  invalid request metadata (invalid metric, own `undefined`) returns `INVALID_REQUEST`
  (`isRetriable: false`, path-bearing message, exactly `code`/`isRetriable`/`message` keys, no raw
  stack) with **zero** DbManager/Classroom side effects and no store writes; corrupt stored full,
  corrupt registry and mutable model/projection corruption stay generic `INTERNAL_ERROR` without
  writes or full-read fallback; auth denial, request-ID tracking (`started` → `success`) and
  boundary-before-completion diagnostic ordering keep their existing behaviour.
- `tests/api/apiHandler/abclassMetadataTestContext.js` is the local real-path context. It runs the
  shared dispatcher setup first (which stubs `ABClassController` and the ABClass transport
  helpers), then reinstalls the **real** `ABClassController`, `ABClass`, `Teacher`, the real
  `abclassMutations.js`/`abclassRead.js` exports and the real `apiHandler` module, keeping the real
  bootstrap `Assignment` and Section 1 metadata/error globals. Only DbManager collections and
  `ClassroomApiClient` are external mocks; auth and request tracking are exercised through the
  existing dispatcher auth and `LockService` seams. Every overridden global is restored through
  `globalMockManager` plus the shared dispatcher teardown, so prebuilt synthetic responses and the
  default controller/handler stubs are never presented as the real domain path.
- The context requires its inputs explicitly — collection `rows`, `classId` and `partialRows` at
  every call site — with no default parameters, in-body partial-row fallback or implicit
  canonical-class selection. This mirrors the project's constructor-only-defaults rule for test
  helpers and closes the RED finding S8-R1.
- Real-path suites reach backend CommonJS owners through `#backend/*` (see "Backend CommonJS import
  identity" above) so they share the bootstrap's single module identity; script-owned synthetic
  data and helpers stay on static ESM `#synthetic-data/*` and `#test-helpers/*`. Canonical
  non-empty class/assignment populations are preserved, with invalid, corrupt and boundary cases
  cloned.
- Global exposure is unchanged: `adaptMetadataRequestError_` is a private trailing-underscore
  helper and is not exported, and the static global-exposure guard suite stays green.
- Run the Section 8 suites with the existing ABClass API and backend mutation/validation units:
  `npm run test:backend -- tests/api/abclassMetadataApi.test.js tests/api/apiHandler/abclassMetadataReads.test.js tests/api/apiHandler/abclassMetadataWrites.test.js tests/api/apiHandler/abclassMetadataErrors.test.js tests/api/abclassMutations.test.js tests/api/abclassRead.test.js tests/backend-api/abclassMutations.unit.test.js tests/backend-api/abclassValidation.unit.test.js tests/api/apiHandler/globalExposure.test.js`.

**Node dispatcher metadata round trip (`Implemented`, independently review-clean).** The
synthetic dispatcher bridge now composes class-partial reads and metadata mutation
seams so the real `apiHandler` can be exercised end to end from the frontend
transport:

- `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js` clones the frozen
  `classesById` and `classPartials` views, serves class-partial reads through the
  existing `ABClassController` test seam, and supplies `upsertABClass_`/`updateABClass_`
  seams that replace metadata on its isolated records. An omitted `metadata` key
  leaves the stored value unchanged and `null` clears it.
- `tests/helpers/apiHandlerTestUtils.js` forwards an `abClassControllerBehaviour`
  option through `setupApiHandlerTestContext`; it remains a test seam, not a
  production contract.
- `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts` (**188**
  physical lines / **5** tests) covers full/partial read retention, queued
  update/upsert omission/null/replacement, own-undefined rejection before dispatch,
  `INVALID_REQUEST` versus `INTERNAL_ERROR`, two-bridge isolation and per-call seam
  restoration with caller-owned spies preserved.
- Run it with
  `npm run test:synthetic -- tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts`.
  This is test-only seam composition: it does **not** replace the real-controller,
  persistence, auth, envelope or global-exposure suites, and it adds no production
  backend change.

**Teacher always-own-null serialisation and its roster path (`Implemented`).** Section 9
delivers the approved `Teacher.toJSON()` correction with model, ABClass and roster coverage:

- `tests/models/teacher.test.js` and `tests/models/teacherStudentSubmissionCoverage.test.js`
  replace the former omission assertions with an **own** `teacherName: null` requirement, and
  cover constructor-unset, explicit-null, cleared-name, legacy canonical rows with the name key
  deleted, and named round trips. Named cases load the frozen
  `loadSyntheticAnalysisProfile('small', 'classPartials')` rows. Student and StudentSubmission
  cases in the mixed suite are unchanged.
- `tests/models/abclassTeacherSerialisation.test.js` drives the real ABClass full/partial
  serializers with a non-empty adapted canonical class from
  `loadBackendModelInputs('small').classesById`: a real `Teacher` owner and materialised
  `Teacher` instances emit their own `teacherName` (`null` when unnamed), while legacy
  plain-object teacher rows pass through unchanged. Array cases materialise `Teacher.fromJSON()`
  inputs inside the test; ABClass restoration still does not hydrate plain entries.
- `tests/controllers/abclassRosterPersistence.test.js` adds the normal roster-refresh case:
  the exact four-field full `$set`, the three-field registry `$set`, full-first ordering
  (partial `findOne` → full `$set`/`save` → partial write) and explicit null names in the
  serialised owner/teachers, while the existing row's stored metadata is left untouched.
- The unchanged frontend compatibility smoke
  (`classDetailService.zod.full.spec.ts`, `classPartialsService.spec.ts`) confirms the
  optional/nullable Teacher schemas accept both legacy absence and explicit null. It is
  schema-compatibility context only, not a live backend output round trip.
- Deletion behaviour is unchanged and no false-drop-flag expectation is added; the documented
  quirk and its deferred fix remain with
  [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332).

**Combined lifecycle and controller/API ordering hardening (`Implemented`).** Section 10 extends
the existing real-dispatcher metadata suites; no new shared helper module is introduced:

- `tests/api/apiHandler/abclassMetadataWrites.test.js` runs one connected real path — dispatcher
  upsert → unrelated editable update → real `loadClass` roster refresh → real `persistAssignmentRun`
  into a distinct `assign_full_<classId>_<assignmentId>` store → list/full reads → whole
  replacement → `null` clear → delete — asserting the supplied snapshot is unchanged in both stores
  and the read responses, the roster `$set` payloads stay metadata-free, and the full store is
  written before the registry. The same suite drives both `upsertABClass` and `updateABClass` with
  a locally cloned canonical `medium` snapshot whose two newest entry timestamps are made equal
  and whose definition keys repeat, proving both mutation APIs preserve caller-supplied entry
  order in the returned summary, the full-store value and the partial-store value.
- `tests/api/apiHandler/abclassMetadataErrors.test.js` reverses a cloned canonical request snapshot
  and proves the real dispatcher rejects descending `recentAssignments` timestamps as
  `INVALID_REQUEST` before any collection access or store write.
- `tests/api/apiHandler/abclassMetadataTestContext.js`, the local real-path context, gains isolated
  `assign_full_*` collection routing and vendor-faithful stored-`_id` retention on whole-record
  replacement; its existing `setupApiHandlerTestContext` global save/restore teardown is unchanged.

The Section 3 model-boundary equal-timestamp and repeated-definition-key checks remain an
independent layer: they prove the shared domain validator and serialisers accept and preserve that
shape without invoking the controller or transport. Neither layer verifies live assignment
identifier existence or equality against a stored Assignment timestamp, and the equal-timestamp
input stays a local clone-based boundary probe rather than canonical corpus content. Generated
source assignments keep distinct timestamps, so the canonical exact-timestamp linkage is not
weakened to manufacture equal timestamps.

## Backend logging test expectations

When backend logging behaviour or error boundaries change, include explicit logging-focused regression coverage in backend tests.

Rules:

1. Add regression tests for critical logging boundaries when behaviour changes.
2. For execution-log fidelity, prefer assertions at the logger-output seam (`ABLogger` -> console) rather than only mocked logger invocation checks.
3. Ensure failure-path tests verify both:
   - transport or control-flow outcome
   - developer-log preservation expectations
4. When touching `apiHandler` failure paths, include coverage that downstream logs remain visible and boundary logs are emitted according to policy without widening frontend error envelopes.

## Production/Test Boundary

### Core rule

Production backend code should stay GAS-first. The default and preferred Node test-enablement pattern inside production backend files is:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    myFunction,
    MyClass,
  };
}
```

Use that block only at the end of the file.

### What belongs in tests

Put Node-only compatibility in the test harness, usually in `tests/setupGlobals.js` or a test helper:

- attach globals expected by GAS files
- load prerequisite files in the same order GAS would see them
- point tests at the real current file paths
- create mocks for GAS services and internal singletons

Example:

```javascript
const g = globalThis;

g.RuntimeConstants = require('../src/backend/00_RuntimeConstants.js').RuntimeConstants;
g.Validate = require('../src/backend/Utils/Validate.js').Validate;
g.ArrayUtils = require('../src/backend/Utils/00_ArrayUtils.js');
```

### What should not go into production files

Avoid adding Node-specific compatibility code to runtime files just to make tests pass.

Anti-pattern:

```javascript
let runtimeConstantsRef = globalThis.RuntimeConstants;

if (typeof module !== 'undefined' && module.exports && !runtimeConstantsRef) {
  runtimeConstantsRef = require('../00_RuntimeConstants.js').RuntimeConstants;
}
```

Preferred:

```javascript
const STALE_REQUEST_AGE_MS =
  ACTIVE_REQUEST_STALE_MINUTES *
  RuntimeConstants.SECONDS_PER_MINUTE *
  RuntimeConstants.MS_PER_SECOND;
```

and provide `RuntimeConstants` from `tests/setupGlobals.js`.

## GAS Load Order and File Naming

Because backend files are concatenated into one GAS script, file order is part of runtime behaviour.

Common ordering conventions in this codebase:

- `00_*`: foundational runtime primitives/constants loaded very early
- `01_*`, `02_*`, `03_*`: ordered support files used by later files
- `98_*`: main implementation file for a concern
- `99_*`: globals or thin entry helpers loaded after the main implementation
- `y_*`: controller layer
- `z_*`: API/entry layer that should come after controllers and shared runtime code

Rules:

- Do not rename numbered files casually.
- Do not change numeric prefixes unless you are intentionally changing load order.
- In tests, load or expose prerequisites before loading dependent files.
- When updating test imports, follow the real current file layout instead of stale alias paths.

## Shared helper patterns for transport-refactor test work

The transport-layer refactor helper patterns are now implemented in `tests/helpers/apiHandlerTestUtils.js`.

> **Note:** For general global mock management, use the `globalMockManager` helper (`tests/helpers/globalMockManager.js`) which provides a consistent pattern for saving and restoring global mocks. This prevents test pollution where cleanup from one test affects other tests.

### `installControllerMocks` / `restoreControllerMocks`

> **Implemented**

Location: `tests/helpers/apiHandlerTestUtils.js`

Purpose:

- install per-test constructor mocks for `ScriptAppManager`, `ABClassController`, and
  `ReferenceDataController`
- expose the mocked instances alongside the constructors so dispatcher tests can assert controller
  delegation after trivial wrapper removal without adding Node-specific fallbacks to production files

### `installTransportHelperMocks` / `restoreTransportHelperMocks`

> **Implemented**

Location: `tests/helpers/apiHandlerTestUtils.js`

Purpose:

- install per-test stubs for trailing-underscore private transport helpers such as
  `globalThis.getGoogleClassrooms_`, `globalThis.upsertABClass_`, `globalThis.updateABClass_`,
  `globalThis.deleteABClass_`, `globalThis.getAssignmentDefinitionPartials_`, and
  `globalThis.deleteAssignmentDefinition_`
- let dispatcher tests override non-trivial transport-helper behaviour without reinstating public
  global handler functions
- keep `getBackendConfig_` / `setBackendConfig_` out of this helper because `z_apiHandler.js` wires
  those through its own guarded Node bridge

### Synthetic analysis corpus and dispatcher bridge

> **Implemented**

Locations: `scripts/synthetic-test-data/` (deterministic corpus, validators, immutable loader, and Node-side dispatcher bridge) and `tests/__mocks__/data/synthetic-analysis/` (committed compact profiles and manifests).

Purpose:

- provide schema-valid, deterministic analysis-domain fixture graphs without adding a test-data dependency to GAS runtime source;
- supply an explicit generated **transport** view through the existing `apiHandlerTestUtils.js` handler seams, then dispatch through the actual `apiHandler`;
- compose with the frontend's existing `googleScriptRunHarness` through its thin frontend test adapter, rather than recreating API envelopes or GAS callback behaviour;
- retain `apiHandlerTestUtils.js` and `mockFactories.js` as composition-only dependencies: synthetic graph, fixture, and bridge code remain in the dedicated synthetic-test-data domain.

Backend tests load a committed profile view with `loadSyntheticAnalysisProfile(profileName, viewName)` from `scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js`, then use `createApiHandlerRoundTripBridge({ vi, profileName })` from `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js` to install the seams and dispatch the real `apiHandler`. The bridge now also serves class-partial reads and metadata upsert/update seams for the Node round-trip suite. Each instance clones its class views before mutation, and the bridge restores every seam after each call so overlapping requests stay isolated.

For the corpus topology, profile and view selection, mutation isolation, and the full command list, see the canonical guide: [Synthetic Test Data](../testing/synthetic-test-data.md).

### Global Mock Management with `globalMockManager`

> **Recommended for new tests**

Location: `tests/helpers/globalMockManager.js`

For tests that need to mock multiple globals (like `DbManager`, `CacheManager`, `BaseRequestManager`, `BatchUpdateUtility`, `TriggerController` tests), use the `globalMockManager` helper instead of manually saving/deleting globals. This ensures proper cleanup and prevents test pollution.

See the [Global Mock Manager](#global-mock-manager-testshelpersglobalmockmanagerjs) section for complete documentation.

**Migration pattern from manual cleanup:**

Before (problematic):

```javascript
beforeEach(() => {
  global.ProgressTracker = { getInstance: () => mockTracker };
});

afterEach(() => {
  delete global.ProgressTracker; // Causes test pollution!
});
```

After (using `globalMockManager`):

```javascript
import { withGlobalMocks } from '../helpers/globalMockManager.js';

let restoreGlobals;

beforeEach(() => {
  const mockContext = withGlobalMocks({
    ProgressTracker: () => ({ getInstance: () => mockTracker }),
  });
  restoreGlobals = mockContext.restore;
});

afterEach(() => {
  restoreGlobals(); // Restores original values safely
});
```

## Anti-Patterns Seen In This Repository

The following problems caused backend test failures and should be treated as regressions if reintroduced:

### 1. Tests importing stale paths

Anti-patterns:

- `../../src/backend/Api/apiHandler.js` when the current file is under `src/backend/z_Api`
- `../../src/backend/ConfigurationManager/validators.js` when the current file is [03_validators.js](/workspaces/googleSlidesAssessor/src/backend/ConfigurationManager/03_validators.js)
- `../../src/backend/ConfigurationManager/ConfigurationManagerClass.js` when the current file is [98_ConfigurationManagerClass.js](/workspaces/googleSlidesAssessor/src/backend/ConfigurationManager/98_ConfigurationManagerClass.js)
- `../../src/backend/ConfigurationManager/99_globals.js` for configuration transport after that legacy surface has been removed

Preferred:

- update the tests to the real current path
- or add an intentional test-side alias/wrapper if a stable alias is required
- for backend configuration transport, use `tests/api/backendConfigApi.test.js` as the primary suite instead of rebuilding coverage around removed `globals.js` entry points

### 2. Putting test fallbacks into production runtime code

Anti-pattern:

- adding guarded `require(...)` logic near the top of a GAS runtime file just to backfill globals in Node

Preferred:

- attach the missing global in `tests/setupGlobals.js`
- keep production files GAS-style except for the guarded end-of-file `module.exports` block

### 3. Breaking numbered-file references

Anti-pattern:

```javascript
require('./1_configKeysAndSchema');
```

when the actual file is `01_configKeysAndSchema.js`.

Preferred:

- match the real numbered filename exactly
- treat numeric prefixes as part of the dependency contract, not cosmetic naming

### 4. Naming tests after action-plan sections

Anti-patterns:

- `describe('Section 1 transport', ...)`
- `const SECTION_1_API_METHOD_NAMES = [...]`
- test names that only refer to plan sections instead of the behaviour under test

Preferred:

- name tests after the behaviour, method, or class they verify
- use helper names that describe the transport or domain concept, not a temporary planning document
- when a feature migrates from `globals.js` to `apiHandler`, replace legacy-surface tests with new transport tests rather than preserving both naming schemes
- treat existing `SECTION_*` constants or "Section N ..." describe titles in the test suite as legacy names and rename them to behaviour-focused names when you next touch those tests, rather than copying the old pattern
- apply this rule consistently to backend configuration transport tests; do not recreate action-plan-number labels in `tests/api/backendConfigApi.test.js` or related helpers

### 5. Deleting globals without saving and restoring

Anti-pattern:

```javascript
beforeEach(() => {
  global.ProgressTracker = { getInstance: () => mockTracker };
  global.ConfigurationManager = { getInstance: () => mockConfigManager };
});

afterEach(() => {
  delete global.ProgressTracker;
  delete global.ConfigurationManager;
  // Other tests may depend on these globals!
});
```

**Problem:** When tests delete global properties directly in `afterEach`, they cause **test pollution**. If another test file (or a concurrent test run) expects those globals to exist from `setupGlobals.js`, deleting them will cause failures with messages like "X is not defined" or "Cannot read property 'getInstance' of undefined".

This was the root cause of Vitest teardown errors in the codebase before `globalMockManager` was introduced.

Preferred:

Use the `globalMockManager` helper to save original values before replacing them and restore them after tests:

```javascript
import { withGlobalMocks } from '../helpers/globalMockManager.js';

let restoreGlobals;

beforeEach(() => {
  const mockContext = withGlobalMocks({
    ProgressTracker: () => ({ getInstance: () => mockTracker }),
    ConfigurationManager: () => ({ getInstance: () => mockConfigManager }),
  });
  restoreGlobals = mockContext.restore;
});

afterEach(() => {
  restoreGlobals(); // Restores original values safely
});
```

Or use `mockGlobals` for automatic beforeEach/afterEach management:

```javascript
const { mockGlobals } = require('../helpers/globalMockManager.js');

const { beforeEach: setupMocks, afterEach: teardownMocks } = mockGlobals({
  ProgressTracker: () => ({ getInstance: () => mockTracker }),
  ConfigurationManager: () => ({ getInstance: () => mockConfigManager }),
});

describe('MyTest', () => {
  beforeEach(setupMocks);
  afterEach(teardownMocks);
  // tests...
});
```

**Rule:** Never use bare `delete global.X` in test cleanup. Always save the original value first and restore it.

## Test Framework

- **Framework**: Vitest v4.0.18 (see `package.json`)
- **Environment**: Node.js
- **Configuration**: `vitest.config.js` (loads `tests/setupGlobals.js`)
- **Test Runner (one-off)**: `npm test`
- **Watch Mode**: `npm run test:backend:watch`
- **Module System**: Test files must use ESM `import` syntax for vitest (production code uses CommonJS `require`)

## Directory Structure

```text
tests/
├── __mocks__/                 # Shared mock implementations
│   └── googleAppsScript.js    # Mock GAS globals (PropertiesService, SpreadsheetApp, etc.)
├── mocks/                     # Domain-specific mocks (e.g. ProgressTracker shim)
│   └── ProgressTracker.js
├── helpers/                   # Reusable test utilities & factories
│   ├── mockFactories.js       # GAS & service mock factories
│   ├── modelFactories.js      # Domain model factory helpers
│   ├── singletonTestSetup.js  # Singleton test harness helpers
│   └── testUtils.js           # Generic helpers (repeat, simpleHash, etc.)
├── setupGlobals.js            # Global test setup (loaded via vitest.config.js)
├── smoke.js                   # High-level smoke test (basic environment sanity)
├── assignment/                # Assignment-related tests
├── configurationManager/      # ConfigurationManager tests
├── models/                    # Domain model tests
├── parsers/                   # Document parser tests
├── requestHandlers/           # API request handler tests
├── singletons/                # Singleton behaviour, lifecycle & performance tests
│   ├── PerformanceMeasurement.js  # Test-only performance utility (not production code)
│   └── performanceMeasurement.test.js
└── utils/                     # Utility function tests
```

## Running Tests

```bash
# Run all tests (backend, frontend, builder) — single run
npm test

# Run only the backend suite
npm run test:backend

# Run backend tests in watch mode
npm run test:backend:watch

# Run a specific test file
npm test -- tests/models/abclass.test.js

# Run tests matching a folder/pattern
npm test -- tests/models/

# Run tests filtering by test name (-t passes through to Vitest)
npm test -- -t "serialise"
```

## Coverage gate

`npm run test:backend:coverage` enforces the global thresholds of 85% for statements, branches, functions, and lines.

At the time of writing (HEAD `4a0a3418`, 21 October 2026), all 209 backend test files and 2,888 tests pass, but branch coverage is **84.35% (3,165/3,752)** against the 85% gate. Statements are 90.77%, functions 89.89%, and lines 91.43%. A pristine `git archive` snapshot of that commit reproduces the same totals, so this is a pre-existing baseline failure, not a regression from current work. Do not waive, suppress, or lower the threshold to make the aggregate green.

`npm run test:coverage` chains the project coverage scripts and stops at the first failing scope. Run each project's coverage script explicitly to record results after an earlier scope fails.

The regression checker is **not** a coverage gate. Its `backend-test-coverage-check` runs `npm run test:backend` without coverage, so it can report that check as passing while `npm run test:coverage` still fails at the backend branch threshold. Use the `:coverage` scripts for coverage evidence, and do not change the checker configuration to hide the gap.

## Test Categories

### 1. Model Tests (`tests/models/`)

Test domain models including serialisation, validation, and business logic:

- **ABClass**: Class entity with students, teachers, assignments
- **Student**: Student entity with validation
- **Teacher**: Teacher entity with email/userId validation
- **TaskDefinition**: Task specifications with artifacts
- **StudentSubmission**: Submission tracking and hashing
- **Artifacts**: Various artifact types (TEXT, TABLE, IMAGE, etc.)

**Key patterns**:

- Test `toJSON()` / `fromJSON()` round-trip serialisation
- Validate hash stability and change detection
- Test business logic (e.g., setters, getters, validation)
- Use factory functions from `modelFactories.js`

### 2. Singleton Tests (`tests/singletons/`)

Verify singleton pattern implementation, lifecycle, and (optionally) performance:

- **baselineBehavior**: Lazy initialisation & instance stability
- **idempotency**: `getInstance()` repeatability (same object each call)
- **forbiddenGlobals**: Ensures no accidental global pollution
- **progressTrackerLazyInit**: ProgressTracker lazy behaviour
- **configurationManagerLazyInit**: ConfigurationManager lazy-init and heuristic validation
- **performanceMeasurement**: Uses `PerformanceMeasurement.js` helper to compare timings (test-only utility)

**Key patterns**:

- Use `SingletonTestHarness` to control GAS mocks
- Ensure singletons don't initialise until first `getInstance()`
- Verify `getInstance()` idempotency (stable reference)
- Isolate module cache between tests (clear `require.cache` as needed)
- (Optional) Capture performance deltas with `PerformanceMeasurement`

### 3. Parser Tests (`tests/parsers/`)

Test document parsing logic for Slides and Sheets:

- Extraction of text, tables, images from documents
- Normalisation of content
- Artifact creation from parsed content

**Key patterns**:

- Mock document structure (slides, sheets, ranges)
- Verify artifact types and content
- Test edge cases (empty content, malformed data)

### 4. Request Handler Tests (`tests/requestHandlers/`)

Test API interactions and caching:

- **assignmentPhase3**: LLM request generation and processing
- **imageManagerPhase5**: Image upload and management

**Key patterns**:

- Mock external APIs (LLM, Drive)
- Test caching behaviour
- Verify batch processing

### 5. Assignment Tests (`tests/assignment/`)

Test assignment-related functionality:

- Assignment state tracking
- Last updated timestamp logic
- Assignment persistence
- Factory pattern for polymorphic assignment creation
- Assignment serialisation (full and partial)

**Key patterns**:

- Test `Assignment.create()` factory method for correct subclass instantiation
- Test `Assignment.fromJSON()` polymorphic deserialisation
- Verify `toPartialJSON()` redacts heavy fields while preserving identifiers
- Test round-trip serialisation preserves types and data

### 6. Controller Tests (`tests/controllers/`)

Test controller logic for managing domain entities and coordinating persistence:

- **ABClassController**: Loading, saving, and managing ABClass instances
- **Assignment Persistence**: Full and partial assignment storage workflows
- **Assignment Rehydration**: Restoring full assignments from partial summaries

Note: `tests/controllers/initController.test.js` remains excluded as
deprecated legacy UI/init coverage. `tests/controllers/createDefinitionFromWizardInputs.test.js`
has been deleted (the `createDefinitionFromWizardInputs` method was removed).

**Key patterns**:

- Mock DbManager and collections with `vi.fn()` for database operations
- Mock ABLogger singleton for logging verification
- Test both success and error paths with appropriate error handling
- Verify method existence before testing (for RED phase tests)
- Use factory functions to create test data
- Test edge cases (null inputs, missing data, corrupt data)
- Verify logging calls for all significant operations

### 6.1 API Layer Tests (`src/backend/z_Api`)

Test API-layer functions as boundary wrappers:

- Delegation to the correct controller method
- Required parameter behaviour
- Error propagation (fail-fast semantics)

Do not duplicate deep business-logic tests at API wrapper level; cover those in controller/service suites.

**Example controller test structure**:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let ControllerClass, mockDbManager, mockABLogger;

beforeEach(() => {
  // Setup mocks
  mockDbManager = {
    getCollection: vi.fn().mockReturnValue({
      insertOne: vi.fn(),
      findOne: vi.fn(),
      // ... other collection methods
    }),
  };

  globalThis.DbManager = class {
    static getInstance() {
      return mockDbManager;
    }
  };

  mockABLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  globalThis.ABLogger = class {
    static getInstance() {
      return mockABLogger;
    }
  };

  // Load controller after mocks
  delete require.cache[require.resolve('../../src/.../Controller.js')];
  ControllerClass = require('../../src/.../Controller.js');
});

afterEach(() => {
  delete globalThis.DbManager;
  delete globalThis.ABLogger;
  vi.restoreAllMocks();
});

it('performs expected operation', () => {
  const controller = new ControllerClass();

  // Test implementation
  controller.someMethod();

  expect(mockDbManager.getCollection).toHaveBeenCalled();
  expect(mockABLogger.info).toHaveBeenCalled();
});
```

### 7. Configuration Tests (`tests/configurationManager/`)

Test configuration management:

- Loading/saving configuration
- Property serialisation/deserialisation
- Default value handling

### 8. Utility Tests (`tests/utils/`)

Test utility functions:

- **ABLogger**: Logging functionality
- **Validate**: Email and userId validation

Test utility functions:

- **ABLogger**: Logging functionality
- **Validate**: Email and userId validation

## Testing Helpers

### Mock Factories (`tests/helpers/mockFactories.js`)

Provides factory functions for creating reusable mocks:

```javascript
const {
  createMockPropertiesService,
  createMockUtils,
  createMockSpreadsheetApp,
  createMockClassroomApiClient,
  setupGlobalGASMocks,
} = require('../helpers/mockFactories.js');

// Create individual mocks
const mockProps = createMockPropertiesService(vi);
const mockUtils = createMockUtils(vi);
const mockClassroom = createMockClassroomApiClient();

// Setup all common GAS mocks at once
const mocks = setupGlobalGASMocks(vi, { mockConsole: true });
```

**Available factories**:

- `createMockPropertiesService(vi)` - PropertiesService with script/document properties
- `createMockUtils(vi)` - Utils with hash generation
- `createMockDriveApp(vi)` - DriveApp for file operations
- `createMockSpreadsheetApp(vi, options)` - SpreadsheetApp with sheets
- `createMockClassroomApiClient()` - read-only ClassroomApiClient mock for `fetchCourse`, `fetchTeachers`, and `fetchAllStudents`
- `createMockMimeType()` - Google MIME type constants
- `createMockCollection(vi, options)` - Mock database collection with optional overrides
- `createMockSlidesParser(options)` - Mock SlidesParser class for testing document parsing
- `setupDualCollectionGetFunction(vi)` - Helper for creating dual-collection database patterns (registry + full storage)
- `setupGlobalGASMocks(vi, options)` - Setup all common GAS mocks
- `setupControllerTestMocks(vi)` - Setup controller-specific mocks (DbManager, ABLogger, etc.)

**New AssignmentDefinitionController-specific helpers**:

The `setupDualCollectionGetFunction` helper reduces duplication when testing controllers that use dual-store patterns (registry + full storage collections):

```javascript
import { setupDualCollectionGetFunction } from '../helpers/mockFactories.js';

beforeEach(() => {
  // Creates getCollectionFn that handles both 'assignment_definitions' and 'assdef_full_*' collections
  const { getCollectionFn, registryCollection, fullCollection } =
    setupDualCollectionGetFunction(vi);

  const mockDbManager = {
    getCollection: getCollectionFn,
  };
  DbManager.getInstance.mockReturnValue(mockDbManager);
});
```

The `createMockCollection` helper with options allows customisation:

```javascript
import { createMockCollection } from '../helpers/mockFactories.js';

// Create a basic mock collection
const mockCollection = createMockCollection(vi);

// Create with method overrides
const customCollection = createMockCollection(vi, {
  overrides: {
    findOne: vi.fn().mockReturnValue({ id: 'test' }),
  },
});
```

### Model Factories (`tests/helpers/modelFactories.js`)

Provides factory functions for creating test model instances:

```javascript
const {
  createTaskDefinition,
  createTextTask,
  createStudentSubmission,
  createSlidesAssignment,
  createSheetsAssignment,
  createDummyProgressTracker,
} = require('../helpers/modelFactories.js');

// Create a task definition with sensible defaults
const task = createTaskDefinition({
  index: 0,
  title: 'Task 1',
  refContent: 'Reference content',
  refType: 'TEXT',
});

// Create a text task (convenience wrapper)
const textTask = createTextTask(0, 'Reference text', 'Template text');

// Create a student submission
const submission = createStudentSubmission({
  studentId: 'student1',
  assignmentId: 'assignment1',
  documentId: 'doc1',
});

// Create assignments (both use fromJSON internally to avoid GAS service calls)
const slidesAssignment = createSlidesAssignment({
  courseId: 'course1',
  assignmentId: 'a1',
  assignmentName: 'Slides Task',
});

const sheetsAssignment = createSheetsAssignment({
  courseId: 'course1',
  assignmentId: 'a2',
  assignmentName: 'Sheets Task',
});
```

**Assignment creation consolidation**:

To eliminate code duplication, `createSlidesAssignment` and `createSheetsAssignment` both call a common internal factory `createAssignmentWithType(documentType, props)`. This ensures consistent defaults and prevents maintenance issues when assignment creation logic changes.

### Test Utils (`tests/helpers/testUtils.js`)

General utility functions for tests:

```javascript
const { repeat, noop, assert, delay, simpleHash } = require('../helpers/testUtils.js');

// Repeat a function n times
repeat(5, (i) => console.log(`Iteration ${i}`));

// Simple deterministic hash for testing
const hash = simpleHash('some content');
```

### Singleton Test Setup (`tests/helpers/singletonTestSetup.js`)

Helpers for singleton-specific test setup:

```javascript
const {
  createSingletonTestContext,
  loadSingletonsWithMocks,
} = require('../helpers/singletonTestSetup.js');

// Create a test harness
const context = createSingletonTestContext();

// Load specific singletons with mocks
const singletons = loadSingletonsWithMocks(context.harness, {
  loadConfigurationManager: true,
  loadProgressTracker: true,
});
```

### Global Mock Manager (`tests/helpers/globalMockManager.js`)

The `globalMockManager` helper provides a consistent pattern for saving and restoring global mocks in tests. This prevents **test pollution** where one test's cleanup deletes globals that other tests depend on, which was causing Vitest teardown errors.

**Location:** `tests/helpers/globalMockManager.js`

**Purpose:**

- Save original global values before replacing them with mocks
- Restore original global values after tests complete
- Prevent test pollution between concurrent or sequential test runs
- Provide multiple usage patterns for different testing scenarios

**Available functions:**

#### `saveGlobals(globalNames)`

Saves the current values of specified global properties.

- **Parameters:**
  - `globalNames` (string[]): Array of global property names to save
- **Returns:** (Object) Map of global names to their original values

```javascript
const { saveGlobals, restoreGlobals } = require('../helpers/globalMockManager.js');

const saved = saveGlobals(['ProgressTracker', 'ConfigurationManager']);
// ... modify globals ...
restoreGlobals(saved); // Restores original values
```

#### `restoreGlobals(savedGlobals)`

Restores saved global values. If a global was `undefined` when saved, it will be deleted. If it had a value, that value will be restored.

- **Parameters:**
  - `savedGlobals` (Object): Map of global names to their saved values (from `saveGlobals`)

#### `withGlobalMocks(mocks)`

Creates a mock context for specified globals. Saves original values and provides a restore function.

- **Parameters:**
  - `mocks` (Object): Map of global names to mock factories or values. Factory functions are called to produce the mock value.
- **Returns:** (Object) Context with `restore()` function and `savedGlobals`

```javascript
const { withGlobalMocks } = require('../helpers/globalMockManager.js');

const mockContext = withGlobalMocks({
  ProgressTracker: () => ({ getInstance: () => mockTracker }),
  ConfigurationManager: () => ({ getInstance: () => mockConfigManager }),
});

// Use in afterEach
afterEach(() => {
  mockContext.restore();
});
```

#### `mockGlobals(mocks)`

Creates a `beforeEach`/`afterEach` pair that automatically manages global mocks. This is the **recommended pattern** for most test suites.

- **Parameters:**
  - `mocks` (Object): Map of global names to mock factories or values
- **Returns:** (Object) Object with `beforeEach`, `afterEach`, `setup`, and `teardown` functions

```javascript
const { mockGlobals } = require('../helpers/globalMockManager.js');

const { beforeEach: setupMocks, afterEach: teardownMocks } = mockGlobals({
  ProgressTracker: () => ({ getInstance: () => mockTracker }),
  ConfigurationManager: () => mockConfigManager,
});

describe('MyTest', () => {
  beforeEach(setupMocks);
  afterEach(teardownMocks);

  it('should work with mocked globals', () => {
    // globals are mocked
  });
});
```

#### `withTemporaryGlobals(mocks, fn)`

Temporarily replaces specified globals with mocks, then restores them after the function completes. Useful for one-off mocking in a single test or test block.

- **Parameters:**
  - `mocks` (Object): Map of global names to mock factories or values
  - `fn` (Function): Test function to run with mocked globals
- **Returns:** The return value of `fn`

```javascript
const { withTemporaryGlobals } = require('../helpers/globalMockManager.js');

it('should work with temporary mocks', () => {
  const result = withTemporaryGlobals(
    {
      ProgressTracker: () => mockTracker,
      ConfigurationManager: () => mockConfigManager,
    },
    () => {
      // Code that needs the mocked globals
      return someFunction();
    }
  );

  expect(result).toBe('expected');
  // Original globals are restored here
});
```

#### `resetGlobal(globalName)`

Resets a specific global to its original value from `setupGlobals`. This is a simpler alternative when you only need to reset one global. Note: this is a best-effort reset by deletion; for reliable restoration, use `saveGlobals`/`restoreGlobals` pattern.

- **Parameters:**
  - `globalName` (string): Name of the global to reset

```javascript
const { resetGlobal } = require('../helpers/globalMockManager.js');

afterEach(() => {
  resetGlobal('SomeSpecificGlobal');
});
```

**Usage pattern comparison:**

| Pattern                        | Best for                                    | Automatic cleanup                       |
| ------------------------------ | ------------------------------------------- | --------------------------------------- |
| `withGlobalMocks`              | Single describe block with manual afterEach | No - call `restore()` manually          |
| `mockGlobals`                  | Recommended for most test suites            | Yes - use returned beforeEach/afterEach |
| `withTemporaryGlobals`         | One-off mocking in a test                   | Yes - automatic in finally block        |
| `saveGlobals`/`restoreGlobals` | Custom control over save/restore timing     | No - manual control                     |

**Complete example with `withGlobalMocks`:**

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

let restoreGlobals;

const mockProgressTracker = {
  logError: vi.fn(),
  logAndThrowError: vi.fn(),
};

const mockConfigurationManager = {
  getInstance: vi.fn(() => mockConfigurationManager),
  getSomeConfig: vi.fn().mockReturnValue('config-value'),
};

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup global mocks - saves originals and installs mocks
    const mockContext = withGlobalMocks({
      ProgressTracker: () => ({ getInstance: () => mockProgressTracker }),
      ConfigurationManager: () => mockConfigurationManager,
    });
    restoreGlobals = mockContext.restore;

    // Reset all Vitest mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('should use mocked globals', () => {
    // Load module after mocks are in place
    const MyComponent = require('../../src/backend/MyComponent.js');

    const component = new MyComponent();
    component.doSomething();

    expect(mockProgressTracker.logError).toHaveBeenCalled();
  });
});
```

## Global Test Setup

### setupGlobals.js

This file runs before all tests and sets up the global environment:

1. Loads `BaseSingleton` (canonical singleton base class)
2. Mocks core GAS-like globals: `Utils`, `Utilities`, `Logger`
3. Provides lightweight `ProgressTracker` mock
4. Exposes `ArtifactFactory` (required by `TaskDefinition` tests)
5. Provides a basic `ClassroomManager` shim (student fetching where required)

### Common Global Mocks

Available in all tests via `setupGlobals.js`:

- `global.Utils.generateHash(str)` - Simple hash generation
- `global.Utilities.base64Encode(bytes)` - Base64 encoding
- `global.Logger.log(...)` - Logging
- `global.ProgressTracker.getInstance()` - Lightweight progress tracking
- `global.ArtifactFactory` - Artifact creation

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ComponentName', () => {
  let component;

  beforeEach(() => {
    // Setup: create mocks, instantiate component
    global.SomeDependency = mockDependency;
    component = new Component();
  });

  afterEach(() => {
    // Cleanup: remove globals, clear caches
    delete global.SomeDependency;
  });

  it('should perform expected behaviour', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = component.process(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

**Note**: Use ESM `import` for vitest and test helpers. Production code (CommonJS modules) can still be loaded with `require()` if needed.

### Testing Serialisation

Models should implement `toJSON()` and `fromJSON()` for persistence:

```javascript
it('should serialise and deserialise correctly', () => {
  const original = new MyModel({ name: 'Test', value: 42 });

  // Serialise to JSON
  const json = original.toJSON();
  expect(json).toEqual({
    name: 'Test',
    value: 42,
  });

  // Deserialise back to instance
  const restored = MyModel.fromJSON(json);
  expect(restored.name).toBe('Test');
  expect(restored.value).toBe(42);

  // Should be equivalent but not same instance
  expect(restored).not.toBe(original);
});
```

### Testing Hash Stability

Hashes should be stable and change when content changes:

```javascript
it('should generate stable hashes', () => {
  const obj1 = new MyModel({ content: 'test' });
  const obj2 = new MyModel({ content: 'test' });

  const hash1 = obj1.generateHash();
  const hash2 = obj2.generateHash();

  // Same content = same hash
  expect(hash1).toBe(hash2);
  expect(hash1).toBeTruthy();
});

it('should change hash when content changes', () => {
  const obj = new MyModel({ content: 'original' });
  const originalHash = obj.generateHash();

  obj.content = 'modified';
  const newHash = obj.generateHash();

  expect(newHash).not.toBe(originalHash);
});
```

### Testing Singletons

```javascript
it('getInstance returns same instance across calls', () => {
  const instance1 = MySingleton.getInstance();
  const instance2 = MySingleton.getInstance();

  expect(instance1).toBe(instance2);
  expect(instance1).toBeTruthy();
});

it('should not initialise until first use (lazy)', () => {
  // Load the module but don't call getInstance
  delete require.cache[require.resolve('../path/to/MySingleton.js')];
  require('../path/to/MySingleton.js');

  // Verify no initialisation happened
  expect(global.SomeService.init).not.toHaveBeenCalled();

  // Now call getInstance
  MySingleton.getInstance();

  // Should be initialised now
  expect(global.SomeService.init).toHaveBeenCalled();
});
```

### Mocking Google Apps Script APIs

#### Mocking Classroom API

```javascript
beforeEach(() => {
  // Setup domain models globally
  global.Student = Student;
  global.Teacher = Teacher;

  // Mock Classroom API
  global.Classroom = {
    Courses: {
      get: (courseId) => ({
        id: courseId,
        name: 'Test Course',
        ownerId: 'teacher1',
      }),
      Teachers: {
        list: (courseId) => ({
          teachers: [
            {
              profile: {
                name: { fullName: 'Teacher One' },
                emailAddress: 'teacher@school.edu',
                id: 't1',
              },
            },
          ],
        }),
      },
      Students: {
        list: (courseId) => ({
          students: [
            {
              profile: {
                name: { fullName: 'Student One' },
                emailAddress: 'student@school.edu',
                id: 's1',
              },
            },
          ],
        }),
      },
    },
  };

  // Use the centralized mock wrapper
  const { createMockClassroomApiClient } = require('../helpers/mockFactories.js');
  global.ClassroomApiClient = createMockClassroomApiClient();
});
```

#### Mocking DbManager

```javascript
beforeEach(() => {
  global.DbManager = class MockDbManager {
    static getInstance() {
      return {
        getCollection: () => ({
          insertOne: vi.fn(),
          save: vi.fn(),
          updateOne: vi.fn(),
          removeMany: vi.fn(),
          clear: vi.fn(),
        }),
        readAll: vi.fn().mockReturnValue([]),
        saveCollection: vi.fn(),
      };
    }
  };
});
```

#### Mocking SpreadsheetApp

```javascript
import { vi } from 'vitest';
const { createMockSpreadsheetApp } = require('../helpers/mockFactories.js');

beforeEach(() => {
  global.SpreadsheetApp = createMockSpreadsheetApp(vi, {
    mockActiveSpreadsheet: true,
    sheetsConfig: [
      { name: 'Sheet1', id: 's1' },
      { name: 'Sheet2', id: 's2' },
    ],
  });
});
```

### Module Cache Management

When testing modules that maintain state, clear the require cache:

```javascript
beforeEach(() => {
  // Clear module cache to get fresh instance
  delete require.cache[require.resolve('../../src/path/to/Module.js')];

  // Setup mocks before requiring
  global.SomeDependency = mockDependency;

  // Now require the module
  MyModule = require('../../src/path/to/Module.js');
});

afterEach(() => {
  // Clean up
  delete require.cache[require.resolve('../../src/path/to/Module.js')];
  delete global.SomeDependency;
});
```

## Best Practices

### 1. Test Logic, Not GAS Services

**Do test**:

- Serialisation (`toJSON`/`fromJSON`)
- Hash generation and stability
- Business logic and validation
- State management
- Edge cases (null, empty, large data)

**Don't test**:

- Apps Script services (SpreadsheetApp, DriveApp, etc.)
- Network calls
- Timers tied to GAS runtime
- UI rendering

### 2. Use Factory Functions

Prefer factory functions over inline object creation:

```javascript
// Good
const task = createTaskDefinition({ index: 0, refContent: 'test' });

// Avoid (unless testing specific edge case)
const task = new TaskDefinition({
  taskTitle: 'Task 0',
  pageId: 'p0',
  index: 0,
  taskMetadata: {},
});
task.addReferenceArtifact({ type: 'TEXT', content: 'test' });
```

### 3. Centralize Mocks

Add reusable mocks to `mockFactories.js`:

```javascript
// In mockFactories.js
function createMockMyService(vi) {
  return {
    fetch: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

module.exports = {
  // ... other exports
  createMockMyService,
};

// In tests
const { createMockMyService } = require('../helpers/mockFactories.js');
global.MyService = createMockMyService(vi);
```

### 4. Clean Up Globals

Always clean up global mocks in `afterEach`:

```javascript
afterEach(() => {
  delete global.MyMock;
  delete global.AnotherMock;
  delete require.cache[require.resolve('../../src/Module.js')];
});
```

### 5. Test Isolation

Each test should be independent:

- Don't rely on test execution order
- Reset mocks in `beforeEach`
- Clear state in `afterEach`
- Don't share mutable state between tests

### 6. Meaningful Assertions

Write clear, specific assertions:

```javascript
// Good
expect(result.name).toBe('Expected Name');
expect(result.items).toHaveLength(3);
expect(result.hash).toBeTruthy();

// Avoid vague assertions
expect(result).toBeTruthy();
expect(result.items.length > 0).toBe(true);
```

### 7. Test Edge Cases

Consider testing:

- Empty inputs (`''`, `[]`, `{}`, `null`, `undefined`)
- Large inputs (many items, long strings)
- Invalid inputs (malformed data, wrong types)
- Boundary conditions (0, -1, max values)

## Debugging Tests

### Running Single Test

```bash
# Run specific test file
npm test -- tests/models/abclass.test.js

# Run specific test by name pattern
npm test -- -t "should serialise correctly"
```

### Avoid Console Output In Tests

```javascript
it('returns the expected value', () => {
  expect(myValue).toBe(expected);
});
```

Prefer assertions, spies, and targeted mock inspection over temporary `console.*` statements. If local debugging output is briefly necessary while diagnosing a failure, remove it before handing tests back.

<!-- Vitest UI section removed: @vitest/ui not currently installed; add back if tooling added. -->

## Common Patterns

### Testing Error Handling

```javascript
it('should throw on invalid input', () => {
  expect(() => {
    component.process(null);
  }).toThrow('Expected error message');
});
```

### Spying on Methods

```javascript
import { vi } from 'vitest';

it('should call dependency method', () => {
  const spy = vi.fn();
  global.Dependency = { method: spy };

  component.execute();

  expect(spy).toHaveBeenCalledWith('expected', 'args');
  expect(spy).toHaveBeenCalledTimes(1);
});
```

### Testing Module Exports

```javascript
// For production modules (CommonJS): use require
const ConfigurationManager = require('../../src/backend/ConfigurationManager/98_ConfigurationManagerClass.js');

// For test helpers (may be CommonJS or ESM): use import
import { setupGlobalGASMocks } from '../helpers/mockFactories.js';

// For modules that might have default or named exports
const MyClassExport = require('../../src/path/to/Module.js');
const MyClass = MyClassExport.MyClass || MyClassExport;
```

## Troubleshooting

### "Module not found" errors

- Check the require path is correct
- Ensure the file exists in `src/`
- Check `setupGlobals.js` is loading required dependencies

### "X is not defined" errors

- Add the global mock in `beforeEach`
- Check if `setupGlobals.js` should provide it
- Verify module cache is cleared between tests

### Tests passing locally but failing in CI

- Check for test interdependencies
- Verify all mocks are properly cleaned up
- Look for timing issues (use `await` for async)
- Check for hardcoded file paths

### Singleton state leaking between tests

- Clear `require.cache` in `afterEach`
- Use singleton `resetForTests()` if available
- Ensure globals are deleted in `afterEach`

## Frontend test commands

The new React frontend under `src/frontend` has its own Vitest and Playwright configuration:

- `npm run test:frontend` runs frontend unit tests.
- `npm run test:frontend:e2e` runs Playwright browser tests against the Vite dev server.
- `npm run test:frontend:watch` runs frontend Vitest in watch mode.

Backend tests remain under `tests/` and should continue to avoid GAS runtime calls.
