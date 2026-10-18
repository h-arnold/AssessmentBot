# ABClass Metadata Contract Support — Delivery Plan (TDD-First)

## Status and read-first context

Planning is complete with independent clean review; the user subsequently requested implementation and authorised commits/pushes. Sections 1–8 and their explicitly authorised dropdown/E2E companions are committed and pushed. Section 8's final combined comparison has zero regressions/new failures and all 303 E2E tests pass without flakes; earlier failed gates/diagnostics remain preserved. Completed-history condensation is independently reviewed clean. Sections 9–11 have not started. No deployment has occurred.

### Implementation start-up — 15 October 2026

- The user requested implementation of this plan; the worktree was clean at start-up on branch `docs/abclass-metadata-plan`, HEAD `6fc46be`. The user explicitly authorised this `nimble-otter` worktree in place of the historical, now absent `/home/developer/AssessmentBot-metadata-planning`; this override changes no feature contract.
- **Current section:** Section 8 is delivered, source commits `a87605b`/`423abec` pushed on `docs/abclass-metadata-plan`; this plan-only delivery record precedes Section 9 RED. Final combined comparison `2026-10-18T10:17:33.136Z` is baseline-or-better: zero regressions/new failures, six fixes, 303 first-attempt E2E passes. Earlier failures and historical Cohort uncertainty remain preserved. Next is the approved Teacher output correction and factual collection/deletion documentation, not issue #332's deferred code fix. Unrelated reviewer/configuration edits remain excluded; no new baseline or deployment.
- **Stable checker identity:** `abclass-metadata-contract`, original baseline `2026-10-15T20:45:28.439Z`, report `.ts-regression-checker/reports/session-abclass-metadata-contract/baseline/baseline.txt`. Never reset the baseline or change the identity. Command: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms timeout). The baseline ran exit 1 / overall `FAILING`, seven of eight checks passing, zero regressions and zero new failures; backend lint reported zero errors plus the planning-time max-lines warnings recorded below. Correction after inspecting the saved manifest: despite its `backend-test-coverage-check` name, the checker runs `test:backend` without coverage, so the baseline did not establish backend coverage thresholds.
- Commit authority resolved on 16 October 2026: the user authorised commits and pushes as part of delivery, superseding this plan's historical implementation-commit exclusion. All hook/review/regression gates and the deployment exclusion remain. Never push a commit that bypasses the pre-commit hooks.
- Regression cadence override on 16 October 2026: the user requested running the checker only at the end of each full section, not between red/green/refactor phases. Use focused tests between phases while preserving independent review and the end-of-section regression gate. An in-flight or mixed-phase run is never section-completion evidence.
- At the user's request, Docs reconciled `.opencode/agents/action-plan-implementer.md` and `.opencode/skills/regression-checker/SKILL.md` with that cadence, preserving the initial baseline and section-end gates, including a blocking readiness/documentation-commit requirement. Re-review is clean: `.opencode/scratchpad/regression-cadence-signoff.md`. These authorised delivery-instruction changes are distinct from the excluded user-owned reviewer configuration edits.

The clean-reviewed metadata [specification](docs/plans/SPEC.md), including the subsequently user-approved companion-cleanup addendum, is authoritative. Keep it at its existing path; do not create a duplicate root specification or reopen its product decisions. No layout specification is required: this work changes backend contracts and test infrastructure, not frontend structure or workflow.

Read before delivery:

- @docs/plans/SPEC.md
- @docs/developer/data-shapes/abclass.md
- @docs/developer/backend/api-layer.md
- @docs/developer/backend/backend-testing.md
- @docs/developer/backend/backend-logging-and-error-handling.md
- @docs/developer/testing/synthetic-test-data.md

## Scope and assumptions

### Scope

Strict shared metadata validation; ABClass construction/restoration/serialisation; full and partial persistence; field-scoped roster persistence; existing class reads and mutations; typed request-error adaptation; canonical synthetic profiles and focused backend/contract tests. The user also approved always-present `Teacher.toJSON().teacherName` and corrections to the collection-name/delete-not-found documentation; these are bounded companion changes, not a wider discrepancy clean-up.

### Out of scope

Calculation or automatic refresh of snapshots; frontend source, schemas, services or tests; new endpoints; live identifier/timestamp verification; repair of corrupt stored metadata; eager migration/backfill; transactions, rollback or retries; deployment and implementation commits. These are exclusions, not deferred decisions.

### Confirmed assumptions and prerequisites

1. The user explicitly authorised using the current `nimble-otter` worktree instead of the historical, now absent `/home/developer/AssessmentBot-metadata-planning` directory named in the spec. This override changes no feature contract.
2. The checked source baseline is `d89b41f`. Recheck `git status` before every edit; never overwrite another agent's changes.
3. `abclass.md`, `api-layer.md`, `backend-testing.md` and `synthetic-test-data.md` already contain the reviewed contract/helper targets marked `Not implemented`, added during this planning pass because this checkout lacked them. These are planning prerequisites, not work postponed to rollout. Preserve their implemented contracts until the relevant section reconciles them.
4. The user explicitly approved the three companion corrections via the question tool. The metadata contract and other four intentional known-discrepancy contracts are unchanged. There are no unresolved product questions. One fix is explicitly authorised for a separate round: honour the vendor's boolean full-collection drop result and add faithful regression coverage, tracked in [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332). This cycle documents the existing quirk and must not fix it. Metadata calculation/refresh/frontend work remains excluded scope, not further deferrals.
5. After clean review, the user expressly authorised committing and pushing this planning-only change. Later implementation delivery still leaves changes uncommitted unless separately instructed; regenerated fixture files are ordinary working-tree updates verified by comparison tests, not an implicit request to commit or deploy.

## Global constraints and quality gates

### Engineering constraints

- Keep the five domain validation routines in `Models/ABClassMetadata.js`; extend generic `Validate` only with the canonical UTC predicate. Share validation rather than reproduce nested rules in controllers or transport helpers.
- Defaults belong in constructors. Route actual absence through the metadata-domain constructor; reject explicitly supplied `undefined`. Do not broaden unrelated legacy-field normalisation.
- Validate request metadata before record reads, roster refresh or database mutation. Only that invocation marks typed failures as request-originated. Stored/model/response corruption remains an internal integrity failure, including when replacement/null was requested.
- Validate and prepare complete metadata-bearing projections before the first full-store mutation. Retain full-first/partial-second saves and real I/O partial-success risk; do not add rollback or retry.
- Existing-partial roster updates are the explicit exception: patch only owned roster fields without using, validating, copying or projecting their stored metadata. Missing partials require a complete, validated creation payload prepared before the full-store mutation.
- Preserve endpoint names, public controller signatures, assignment redaction, tri-state `active`, authorisation, admission/completion tracking and envelope shape. No dispatcher production change is required.
- GAS remains plain JavaScript with runtime global references. No production Node/synthetic imports, top-level forward dependency evaluation, changed stable prefixes or test-driven runtime compatibility code.
- Reuse existing owner/array serialisers, immutable fixture loader and global-mock restoration helpers. British English; meaningful boundary logging; no swallowed/reclassified unrelated exceptions.
- New backend suites import/require backend source through the existing `#backend/*` package map. Opportunistically migrate non-compliant two-parent source imports only in existing files already touched, preserving import semantics. Keep nearby helpers relative; use the new `#synthetic-data/*` map for script-owned ESM fixture tooling. Do not expand into a wholesale import migration.

### TDD and delegation — applies to every section

1. **Red:** delegate tests to `Testing Specialist`; run focused tests and record a failure caused by the missing behaviour, not missing harness wiring. For behaviour-preserving extraction, keep behaviour characterisations green and demonstrate the new domain-delegation boundary is absent before extracting it.
2. **Green:** delegate the smallest production/test-infrastructure implementation to `Implementation`.
3. **Refactor:** preserve domain boundaries and the file-separation budget; rerun affected tests.
4. Delegate canonical contract reconciliation to `Data Shapes Agent` and other documentation reconciliation to `Docs` as each behaviour lands, not solely at the final audit.
5. Delegate the diff to `Code Reviewer`; return findings to `Implementation` (test fixes via `Testing Specialist`) and repeat until clean. Contract docs must be reconciled before code-review sign-off. Do not advance with outstanding findings.
6. Every handoff includes a **Mandatory Reading** block with `@`-prefixed paths: the common reads above plus the section-specific reads below, and the exact affected source/test paths. `Testing Specialist`, `Implementation` and `Code Reviewer` all receive these reads; `Docs`/`Data Shapes Agent` receive the affected canonical docs and changed source. Do not attach agent definitions or AGENTS files.
7. Record actual changes, red/green commands, review outcome, LOC, checker report and any non-contract implementation deviation in the section's delivery record. Stop for user clarification if an unforeseen core decision is needed; do not silently defer it.

### Verification policy

- Verify-only lint: `npm run lint:backend:check` and `npm run lint:synthetic:check`. Do not use fix-mode commands as checks or weaken lint/coverage/configuration.
- The planning-time `lint:backend:check` run at `d89b41f` exits 1 with **0 errors and 10 pre-existing max-lines warnings**. Two are in scope: the 581-line controller facade and 540-line readClass suite, to be cleared in Sections 4/6. The eight untouched warnings are listed below. Per-section lint acceptance means zero warnings/errors in changed files and no new diagnostics relative to this recorded baseline, not pretending the whole pre-existing gate is green. Run the unchanged full command and record its real exit/status; never suppress the warnings or split unrelated files to make it pass.
- Focused backend: `npm run test:backend -- <test-path>`; focused synthetic: `npm run test:synthetic -- <test-path>`.
- Before signing off every production-backend section (1 and 3–9), run the **full** `npm run test:backend:coverage` gate and record its existing 85% line/function/statement/branch thresholds plus coverage of the new/changed owners. Do not apply the full repository coverage include-set to only a focused test selection, which would falsely mark unrelated modules uncovered. Section 2 runs `npm run test:synthetic:coverage` and its node-project adapter smoke. Retain all existing coverage includes/thresholds; close uncovered acceptance paths in the same section rather than discover them only in Section 10.
- Establish a regression baseline before implementation and compare after each completed section: load the `regression-checker` skill and run `npm run regression-checker -- abclass-metadata-contract` with a 1,200,000 ms shell timeout and the same identity throughout. Record pre-existing failures separately; no new regressions may be accepted. This existing checker includes unchanged frontend/browser checks; it does not authorise frontend edits.
- Finish with `npm run run-all-checks`, explicit synthetic lint/tests, fixture reproducibility and the opt-in `npm run test:synthetic:stress` gate specified below. Run the production bundle build locally, not a deployment.
- If the known unchanged lint warnings short-circuit `run-all-checks`, record that failure and run `npm run test:coverage`, `npm run typecheck:all` and `npm run build:production` separately so no downstream gate is silently skipped. A remaining baseline failure is reported explicitly, not waived or called green. Commits and hook bypasses remain unauthorised.

## Checked module sizing and separation budget

Counts are physical source lines at the baseline; projections are delivery budgets, not permission to compress code or JSDoc. Any materially changed module projected above 500 lines needs explicit separation; a touched non-API backend source above 550 must actually be decomposed in this change under backend §11. Frontend service grouping rules were checked and are inapplicable because no frontend module is changed.

For touched backend JavaScript/tests, the binding delivery ceiling is **500 lines**: ESLint warns above 500 and `lint:backend:check` uses `--max-warnings 0`. The separate 550-line backend decomposition rule is not permission to leave a touched file at 501–550. The facade must actually land at or below 500 with public JSDoc preserved, as must each new/split suite.

### Materially changed runtime and test-infrastructure modules

Paths below are relative to the repository root; `controller/` abbreviates `src/backend/y_controllers/ABClassController/`, and `synthetic/` abbreviates `scripts/synthetic-test-data/`.

| Module                                                           | Checked LOC | Projected change / final LOC                                    | Separation / section                                                                                                                                                        |
| ---------------------------------------------------------------- | ----------: | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backend/Models/ABClass.js`                                  |         375 | +55–100 / 430–475                                               | Metadata routines stay in dedicated owner; Section 3.                                                                                                                       |
| `src/backend/Models/ABClassMetadata.js`                          |           0 | +250–350 / 250–350                                              | New model-domain owner; Section 1.                                                                                                                                          |
| `src/backend/Utils/Validate.js`                                  |         298 | +30–50 / 328–348                                                | Generic predicate only; Section 1.                                                                                                                                          |
| `src/backend/Utils/ErrorTypes/ABClassMetadataValidationError.js` |           0 | +35–65 / 35–65                                                  | Dedicated error type; Section 1.                                                                                                                                            |
| `controller/index.js`                                            |         581 | Unseparated: above 600; after extraction: approximately 480–500 | Mandatory actual decomposition: mutation bodies → `ABClassMutationOps.js`; save-input checks → existing `ABClassValidation.js`. Preserve facade delegates/JSDoc; Section 4. |
| `controller/ABClassMutationOps.js`                               |           0 | +220–320 / 220–320                                              | Injected mutation orchestration and prepared editable writes, including later metadata support; Sections 4/5/7.                                                             |
| `controller/ABClassValidation.js`                                |         132 | +80–120 / 212–252                                               | Extract existing save checks, add request gate/editable metadata handling; Sections 4/7.                                                                                    |
| `controller/ABClassPersistence.js`                               |          88 | +100–180 / 188–268                                              | Prepared full/partial writes and registry roster prepare/write helpers; Section 5.                                                                                          |
| `controller/ABClassRoster.js`                                    |         235 | +20–55 / 255–290                                                | Existing `_persistRoster` orchestrates prepared scoped registry write; Section 5.                                                                                           |
| `controller/ABClassResponseMapper.js`                            |         103 | +20–40 / 123–143                                                | Two explicit projections, single partial gate; Section 6.                                                                                                                   |
| `src/backend/z_Api/abclass/abclassMutations.js`                  |         137 | +25–55 / 162–192                                                | Private typed-error adaptation only; Section 8.                                                                                                                             |
| `tests/setupGlobals.js`                                          |         433 | +5–15 / 438–448                                                 | Install new domain/error and mutation sub-class globals; Sections 1/4.                                                                                                      |
| `synthetic/generateSyntheticAnalysisGraph.js`                    |          98 | +5–15 / 103–113                                                 | Thin stage composition; Section 2.                                                                                                                                          |
| `synthetic/projectClassTransportViews.js`                        |         105 | +5–15 / 110–120                                                 | Raw metadata copy in existing class projection; Section 2.                                                                                                                  |
| `synthetic/validateSyntheticAnalysisGraph.js`                    |          81 | +5–15 / 86–96                                                   | Thin integration of new integrity helper; Section 2.                                                                                                                        |
| `synthetic/generateClassMetadata.js`                             |           0 | +100–180 / 100–180                                              | Dedicated index/template stage; Section 2.                                                                                                                                  |
| `synthetic/validateClassMetadata.js`                             |           0 | +200–350 / 200–350                                              | Dedicated generator raw-shape/linkage/parity checks; Section 2.                                                                                                             |
| `synthetic/toBackendModelInputs.js`                              |           0 | +150–300 / 150–300                                              | Test-only canonical adapter; Section 2.                                                                                                                                     |

The spec's historical counts (ABClass 370, Validate 299) are superseded by these checked counts, without changing its decisions. `ABClassAssignmentOps.js` (279), `abclassRead.js` (104), `abclassValidation.js` (26), `z_apiHandler.js` (455), `toTransportViews.js` (259) and the fixture CLI/writer/loader are regression/read context, not planned production extensions. Assignment snapshot preservation should require tests, not new averaging/lifecycle logic.

Companion-cleanup sizing (Section 9): `src/backend/Models/Teacher.js` is 111 lines, projected +0–15 / 111–126; `tests/models/teacher.test.js` is 180, projected +50–90 / 230–270; `tests/models/teacherStudentSubmissionCoverage.test.js` is 281, projected +10–30 / 291–311. New `tests/models/abclassTeacherSerialisation.test.js` starts at 0, projected 150–250. No separation is needed for these files; keep Student/StudentSubmission cases in the mixed coverage suite unchanged.

Node fixture-enablement sizing (Section 2): root `package.json` is 85 lines, projected +1 / 86 for the test-script import alias; new `tests/syntheticModelInputs.node.test.js` is 0, projected 60–120 for the node-project ESM smoke. No TypeScript, ESLint or Vitest configuration changes are planned.

### Existing tests and separation decisions

- New focused suites named in the sections start at 0; budget 150–400 lines each (no more than 450), separating domain shape/time/order/ownership, persistence failures and dispatcher reads/writes/errors into companions rather than one large suite.
- Existing model suites: `abclass.test.js` 161, `abclass.partial.test.js` 168, `abclass.assignment.test.js` 428, `abclassCoverage.test.js` 283. Expected field/fixture adjustments: +0–30 each, projected at most 458. Add metadata scenarios to the new companions, not the 428-line assignment suite.
- Facade model suites: `tests/models/abclassManager.saveClass.test.js` 106 (+0–30 / at most 136), `abclassManager.loadClass.test.js` 187 (+40–90 / at most 277), and `abclassManager.initialise.test.js` 165 (+0–30 / at most 195). Sections 4/5 explicitly run them. The load suite currently always returns a missing partial and has no registry replacement assertion: retain/strengthen that complete-insert scenario, and add an existing-row scenario with stored `_id`, a vendor-faithful no-op `updateOne` result and exact field-scoped payload assertions.
- Existing controller suites: upsert/update 399, loadClass 332, roster-sync 177, partials-read 250, controller-partials 221, delete 196, persistAssignment 386. Expected adjustment budget +0–40 each (maximum 439). Exact paths are listed in the section commands below; retain unchanged behaviour coverage and migrate only touched realistic inputs. Intentionally rewrite roster-sync's existing second-save `replaceOne` expectation: it must become an exact stored-`_id` filter / three-field `$set` / matched-count assertion with no row replacement. Its no-duplicate/missing-row insertion scenario remains covered; the old write mechanism is not preserved.
- In `tests/controllers/abclass-loadClass.test.js`, the existing-class and ensureDefinitionFromInputs cases currently return registry rows without `_id` (current lines 205/223), and `createMockCollection` provides an undefined `updateOne` result. Supply stored `_id` and vendor-faithful matched/no-op results in those touched mocks; these are fixture corrections, not reasons to add a production classId fallback.
- `tests/controllers/abclassController.readClass.test.js` is 540 and would project to 550–580 when adjusted. **Section 6 explicitly separates** pure-read/loading cases (retain original path, about 250–350) from assignment projection/redaction/integrity cases (`abclassController.readClass.assignments.test.js`, about 250–350). Use the canonical adapter rather than extract another realistic fixture factory. Preserve assertions and replace stale plan-labelled scaffolding only in touched code.
- Existing API suites: `abclassMutations.test.js` 301, `abclassRead.test.js` 336, `deepDateSerialisation.test.js` 433. Expected compatibility adjustments +0–30, maximum 463. New metadata dispatcher companions avoid extending `tests/api/apiHandler/shared.js` (630), which is unchanged; reuse its external seams only as appropriate.
- Additional transport unit coverage: `tests/backend-api/abclassMutations.unit.test.js` 297 (+0–35 / at most 332) directly exercises the modified wrappers; run it in Sections 7/8 as well as the `tests/api` suites. `tests/backend-api/abclassValidation.unit.test.js` is 116 lines and remains unchanged read/regression context for the unchanged parameters-object validator.
- Checked unchanged controller surface context: `tests/controllers/ABClassController/` units for Validation (54), ResponseMapper (32), Persistence (40), Roster (90) and AssignmentOps (100) assert preserved surface/initialisation behaviour; run the directory with affected sections and retain it unchanged unless an actual assertion needs migration. `tests/controllers/abclassController.readRehydrateAssignment.test.js` and `tests/api/assignmentReadApi.test.js` are read-only/stubbed assignment-read context, not materially extended files; Section 10 runs them unchanged.
- Existing synthetic suites close to 500 (`syntheticToolingCommands` 497, `syntheticCorpusConventions` 475, `syntheticGraphShapeCoverage` 462 and integrity/contract suites 449–456) are run unchanged. Add dedicated metadata suites. `syntheticCommittedFixtureRegeneration.test.ts` (229) already compares generated views and is run, not extended.
- Recount before implementation and after each section. If actual work would exceed a budget or cross 500, keep the named domain separation rather than inline more logic; record an explicit coherent companion-module split before proceeding. Do not use line/JSDoc compression. Any actual touched non-API backend source above 550 must be decomposed in the same change.
- The facade's 480–500 estimate is a target to measure after extraction, not a guaranteed count or a reason to compress documentation. It must land at or below 500 for the changed-file lint gate. If the initial extraction leaves it above 500, move raw registry retrieval/error logging into `ABClassPersistence.readClassPartials()` and leave facade `getAllClassPartials()` as retrieval-plus-mapping delegation; retain the single mapper metadata gate and all public JSDoc. This defined fallback removes another coherent database-access body without changing read semantics or introducing a new domain. Any source still above 550 must also satisfy mandatory backend decomposition before section sign-off.

### Untouched planning-time lint baseline

At the planning-time baseline (`d89b41f`), `lint:backend:check` exited 1 with zero errors and ten pre-existing `max-lines` warnings: the 581-line controller facade and 540-line readClass suite (both in scope, cleared in Sections 4/6) plus eight untouched files.

**User-authorised scope amendment (16 October 2026):** after Section 2's first checker, the user explicitly requested decomposition of `tests/api/apiHandler/shared.js` (629) and `tests/controllers/referenceDataController.test.js` (726), followed by a renewed checker comparison and permission to proceed on a baseline-or-better result. This supersedes their untouched exclusion only for those two test-infrastructure files and their necessary companions/imports/documentation, preserving all existing tests/assertions, public helper exports, mock/global restoration and default behaviour, with no production behaviour, configuration, threshold, baseline or checker change. They were split into coherent ≤500-line owners (`sharedFixtures.js`, `vmHelpers.js`, `authTestContext.js`; `referenceDataController.yearGroups/.assignmentTopics/.transportResponses.test.js` plus local `referenceDataTestSupport.js`). The preservation gate is independently clean: `.opencode/scratchpad/section2-decomposition-red-signoff.md` (34 reference-data tests plus combined 13 files/185 tests) and `.opencode/scratchpad/section2-decomposition-green-signoff.md` (all R1–R13/RR1–RR2/G1–G7/D1–D2/O1–O3/H1 closed; AST comparison confirms all 34 test bodies/assertions unchanged).

The first Section 2 comparison at `2026-10-16T19:02:30.527Z` is genuinely raw `FAILING`: seven of eight checks pass, ten backend lint warnings, two reported regressions, zero new failures, four fixes (`.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T19-02-30.527Z/comparison.txt`). `.opencode/scratchpad/section2-checker-lint-classification.md` proves both reported regressions are exact-message fingerprint changes caused by the external `83edd48` alias migration reducing the two files by one line (630→629, 727→726); all ten underlying diagnostics match the original baseline by rule/file/location/severity. No checker/baseline data was changed and no raw-clean result was claimed; the decomposition removed the two underlying warnings rather than requiring a diagnostic-identity waiver. Baseline identity `abclass-metadata-contract` is preserved.

**Current baseline debt:** after the Sections 2/4/6 splits, `lint:backend:check` reports **six** pre-existing `max-lines` warnings and zero errors in untouched test files (`assignmentFactory`, `assignmentDefinitionPartials.unit`, `assignmentController.hydration`, `dbManager`, `classroomApiClient`, `batchUpdateUtility`); frontend lint exits 0 with 24 pre-existing warnings. Do not touch these files merely to clear the full command, suppress warnings, change thresholds or claim a false aggregate-clean result. Report every remaining aggregate failure honestly.

## Section 1 — Authoritative metadata domain and timestamp primitive

### Objective

Introduce the shared strict domain boundary, typed integrity error and constructor-owned null normalisation before dependent model/controller work.

### Constraints

- New `Models/ABClassMetadata.js` owns all five routines named in the spec, validation/copying of snapshots and its null default. A local record/required-own-field/allowed-key helper is reused by its shapes; `validateClassAverages` extracts its four scores before invoking `validateAverageScores`.
- Pin the boundary API once: `new ABClassMetadata()` owns the absence → null default; `new ABClassMetadata(value)` validates and copies an explicitly supplied value (including rejecting explicit undefined). Its `toJSON()` validates/copies its owned value and returns a plain snapshot or null; the five named validators are static domain routines. `ABClass.metadata` stores the plain snapshot/null, not a domain-instance wrapper. Add `ABClass.setMetadata(value)` as the single explicit replacement entry point; it always treats its argument as supplied and uses the domain constructor/serialiser. Construction, restoration and mappers distinguish own-property absence before invoking this same domain boundary. No other owner introduces a default or retains a domain-wrapper instance in a persistence/transport shape.
- `Utils/ErrorTypes/ABClassMetadataValidationError.js` extends `Error`, carries a field path and defaults to non-request provenance. It must not inherit from or throw `ApiValidationError`.
- `Validate.isCanonicalUtcDateTime(value)` is a predicate for the exact reviewed UTC/calendar contract. Leave offset-accepting `isIsoDateTimeString_` unchanged.
- Add the error and metadata owner to the Node bootstrap after the existing `Validate` installation and before any ABClass-dependent module can load. Do not move test wiring into production.
- Forward references from ABClass to the metadata owner, and from that owner to later utilities/error definitions, must remain in runtime constructors/methods, never top-level evaluation.

### Delegation mandatory reads

All section agents: common reads plus @src/backend/Utils/Validate.js and @tests/setupGlobals.js. `Docs` and `Data Shapes Agent` reconcile only the delivered domain/helper parts of the planned entries; leave persistence/API behaviour marked `Not implemented`.

### Shared-helper plan

- **New:** `ABClassMetadata` constructor/`toJSON()` boundary and five static validators; one local shape-check helper, not a second generic validation library. Owner: `src/backend/Models/ABClassMetadata.js`. Reused by model, controller and mappers; Section 3 adds the model's `setMetadata(value)` replacement entry point.
- **Extend:** `Validate` with `isCanonicalUtcDateTime`; reuse suitable existing primitives. Owner: `src/backend/Utils/Validate.js`.
- **New:** typed domain error at the path above, reused by request provenance/error adaptation later.
- Canonical records: `abclass.md` **Planned validation** and `api-layer.md` **Planned ABClass metadata helpers**, all initially `Not implemented`.

### Data-shape plan

Implement the score/record/timestamp/ordering contract in `docs/developer/data-shapes/abclass.md` **Planned target contract**, without changing requests or persisted records yet. No frontend `MetricResult` mapping or schema changes.

### Canonical-fixture note

The current corpus has no class-level metadata; its unrelated task-artifact metadata is unchanged. Section 2 explicitly extends its existing profiles/stage/views before realistic model/controller tests. Primitive validators may use local minimal valid/invalid boundary records here; do not introduce a competing realistic class graph. After Section 2, add raw canonical metadata acceptance to the integration suites.

### Acceptance criteria and required tests (Red first)

1. Direct tests of all five routines: numbers `0`, `5` and fractions, each exact marker, and mixed collections accepted; negative/out-of-range/non-finite numbers, numeric strings, booleans and other marker spellings rejected without coercion or rounding.
2. Complete own fields required at every level; inherited-only/missing fields, misplaced nulls, nested `undefined`, extra own keys and `lastAssessedAt` rejected with actionable paths. Ordinary and null-prototype records accepted; arrays, Dates and class instances rejected where records are required.
3. Canonical UTC millisecond timestamps, real leap dates and time-component boundaries accepted; impossible dates/times, date-only strings, offsets, live Dates, missing/extra precision and counter suffixes rejected. No timestamp stamping or repair.
4. Recent arrays of length 0–3 accepted; length 4, sparse slots, undefined/incomplete entries, duplicate assignment IDs, blank/untrimmed/non-string IDs and ascending timestamps rejected. Repeated definition keys and equal timestamps accepted without reordering. No class/entry timestamp relationship or live-entity lookup enforced.
5. Constructor absence becomes null; explicit invalid/undefined values do not. Validation/copying preserves values without shared nested aliases; internal mutation is checked on metadata-bearing serialisation.
6. Error tests prove correct type/path and non-request default. Bootstrap tests load ABClass directly without bespoke suite globals. A GAS-style evaluation test loads relevant runtime definitions in established order without Node imports and exercises them only after all definitions exist.

### Red → Green → Refactor

Add `tests/utils/validateCanonicalUtcDateTime.test.js`, focused `tests/models/abclassMetadata*.test.js` suites and `tests/utils/errorTypes/ABClassMetadataValidationError.test.js`; demonstrate the missing boundary. Implement the primitive/error/domain and minimal bootstrap wiring, then factor the repeated domain record checks while tests remain green.

### Section checks

- `npm run test:backend -- tests/utils/validateCanonicalUtcDateTime.test.js tests/utils/errorTypes/ABClassMetadataValidationError.test.js tests/models/abclassMetadata`
- `npm run lint:backend:check`; bootstrap/direct-import and GAS evaluation coverage green; review/doc gates and regression comparison recorded.

### JSDoc follow-through

Document the constructor-only absence default, plain-snapshot boundary API, strict canonical timestamp contract, field-path/provenance semantics and runtime-only forward references.

### Delivery record

Final RED sign-off `.opencode/scratchpad/section1-red-signoff.md` (R1–R9, N1 closed, all six acceptance criteria covered). Final GREEN sign-off `.opencode/scratchpad/section1-green-signoff.md` (R1–R9, N1 and G1 closed; no outstanding findings). G1 replaced caller-controlled `Array.prototype.map` copying with indexed plain-array/record copies that do not invoke caller methods or species.

- Actual LOC: domain 260, typed error 21, `Validate` 358, bootstrap 436; six test suites 366/226/201/216/60/28 (1,097 total, maximum 366). Focused six suites/124 tests pass; full backend 184 suites/2,699 tests pass.
- Coverage: the full command exits 1 solely on accepted pre-existing branch debt — 83.70% versus original accepted baseline 83.68%, threshold 85% unchanged; statements 90.40%, functions 89.96%, lines 91.08%. Domain 98.76/96.77/100/98.66%; `Validate` 93.54/86.23/95.23/93.75%; error 100/75/100/100%.
- Backend lint exits 1 with zero errors and only the baseline max-lines warnings; formatting/whitespace clean.
- Section-end checker: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms), report `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T05-45-41.102Z/comparison.txt`; exit 1 / overall FAILING solely on the recorded backend lint warnings, seven of eight checks pass, **zero regressions, zero new failures, two fixes**. Backend tests, frontend/builder coverage and lint, frontend E2E and all-project TypeScript pass. The backend coverage debt is tracked separately because the checker runs backend tests without coverage.
- **User authorisation:** via the question tool the user explicitly accepted the original 83.68% backend branch shortfall as baseline technical debt — no coverage regression, the 85% threshold and hooks preserved, no unrelated coverage work authorised. Trusted baseline: a `git archive` mirror of untouched HEAD `6fc46be` reproduced 178 suites/2,575 tests and 83.68% branches (`.opencode/scratchpad/section1-original-baseline/`, log `section1-original-baseline-coverage.log`).

Commit/push evidence on `docs/abclass-metadata-plan`:

- `bffd2c0532382ec7fded8492cfca0d22580bb0c5` — `docs: run plan regressions at section completion` (separately reviewed user-requested instruction change).
- `5f411cf76f6391da8a2040826d22e175fce00964` — `feat: add strict ABClass metadata domain validation` (source/tests/canonical documentation and progress record).
- Both commits passed the real pre-commit hooks (Prettier unchanged, staged backend lint and all-project TypeScript clean); no bypass. `git push` advanced `6fc46be..5f411cf`. User-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` remain unstaged and excluded. No deployment.

## Section 2 — Canonical supplied snapshots and backend model-input adaptation

### Objective

Extend the existing canonical corpus before adding realistic metadata model/controller tests; provide one test-only adaptation boundary for actual backend model inputs.

### Constraints

- Add `scripts/synthetic-test-data/generateClassMetadata.js` after assignments exist in the logical graph. Extend the existing transport projection; do not add a profile, persisted view, production data source or frontend adapter.
- Select snapshots by profile/class/assignment indices and fixed score templates. Reuse exact generated assignment timestamps and real assignment/definition identifiers. Do not consume Faker or the current clock, alter existing seeds/counts/timestamp conventions, or calculate submission averages.
- Add generator-owned raw contract/integrity checks in `scripts/synthetic-test-data/validateClassMetadata.js`; frontend schema parsing is not metadata validation because those schemas strip the field. Backend-domain validation is independently exercised in tests, not imported into GAS from the generator.
- Add `scripts/synthetic-test-data/toBackendModelInputs.js` for test-only conversion of canonical transport into backend ABClass/Assignment/definition inputs. Resolve the matching definition, adapt its shape to existing backend requirements, and preserve IDs, timestamps and partial/full redaction/hydration semantics. Do not feed frontend assignment partials directly to `Assignment.fromJSON()` or substitute full submissions into a partial class.
- Its export is `loadBackendModelInputs(profileName)`, returning independently cloned `{ classPartials, classesById, assignmentsByKey }` backend inputs. Internally call `loadSyntheticAnalysisProfile(profileName, viewName)` for each of `classPartials`, `classesById`, `assignmentsByKey`, `editableDefinitions` and `assignmentDefinitionPartials`, resolving definitions before model restoration. The fifth existing view is explicitly user-approved to resolve partial-only assignments without inventing definitions or dropping class assignments. Keep partial definitions partial; use appropriate partial serialisation rather than pretending they support full serialisation. Each loader call returns one frozen view, not a graph/`transport` wrapper: partials are an array, classes are keyed by `classId`. Outputs include roster JSON for ABClass inputs; retain plain restored teachers rather than invent array hydration. Pass `'small'` or `'medium'` explicitly, never add a hidden profile default.
- Use the existing immutable loader and clone before mutation. Service/auth/database failures remain local mocks, not corpus features.
- Node-project `.test.js` consumers use ESM named imports, not `require()` of script-owned ESM. Reuse the root `package.json` import mapping `"#synthetic-data/*": "./scripts/synthetic-test-data/*"` supplied by merged commit `83edd48`; import the adapter/loader as `#synthetic-data/toBackendModelInputs.js` and `#synthetic-data/loadSyntheticAnalysisProfile.js`. This test-tooling alias is distinct from the existing committed-JSON `#synthetic/*` alias and prevents new two-parent relative imports. Add the node-project smoke before downstream sections rely on this mechanism; no GAS imports or runtime fallbacks are added.

### Delegation mandatory reads

All section agents: common reads plus @scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js, @scripts/synthetic-test-data/projectClassTransportViews.js, @scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js, @scripts/synthetic-test-data/profileDefinitions.js, @scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js, @package.json, @vitest.config.js and @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md. Adapter work also reads @src/backend/Models/ABClass.js, @src/backend/Models/AssignmentDefinition.js, @src/backend/AssignmentProcessor/Assignment/index.js and @src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js. `Docs` reconciles the delivered generator/adapter entries and the existing configuration-hierarchy alias paragraph after the alias lands.

### Shared-helper and data-shape plan

- **New:** metadata generation stage and generator-owned shape/relational validation helper at the paths above. **Extend:** existing graph/projection/validation entrypoints; keep heavy new logic out of the orchestrators.
- **New:** shared backend-model input adapter at the path above; **reuse:** immutable loader and existing global/mock restoration seams rather than grow `mockFactories.js` or `modelFactories.js` with another realistic graph.
- **Reuse (supplied by merged `83edd48`):** root Node package-import map with `#synthetic-data/*`, owned by `package.json`; use ESM named imports in backend JavaScript tests. No additional alias/configuration edit is needed. This is test-infrastructure wiring, not a new loader or fixture source. Keep the adapter capability pending while reconciling the already implemented alias status in `backend-testing.md` **Test infrastructure reuse**.
- Canonical records: `synthetic-test-data.md` **ABClass metadata generator capability** and `backend-testing.md` **ABClass canonical model-input adaptation** now describe the implemented Section 2 test-only capability. These entries were initially planned-only; production model/store/API behaviour and later boundary probes remain pending.
- When reconciling the configuration-hierarchy alias paragraph, describe `#backend/*` as the supported required convention for new/touched backend tests, acknowledging legacy relative imports still exist; do not claim all existing tests already use it. Document `#synthetic-data/*` separately from committed-JSON `#synthetic/*`.
- Shape target: `abclass.md` **Planned target contract**. Logical persistence and raw `classPartials`/`classesById` gain identical nullable metadata; existing view names/manifests/entity counts remain unchanged. Reconcile the fixture capability, not undelivered production persistence.

### Canonical-fixture selection and extension matrix

Use the following deterministic compact coverage matrix (entry count; score variant). For each non-null case use its fixed template for both class averages and **every recent entry's averages**, adding timestamps only at their respective containing records. The ordered template family is numeric `{ completeness: 4, accuracy: 3.5, spag: 4.5, overall: 3.9 }`, all-four `N`, all-four `E`, all-four `excluded`, and mixed `{ completeness: 4, accuracy: 3, spag: 'N', overall: 3.5 }`. Thus committed recent entries explicitly cover each all-marker and mixed collection as well as numbers/fractions; these are fixed supplied snapshots, not computed averages. Entries use newest-first source assignments. Every non-null variant, including zero-entry snapshots, uses its class's newest generated assignment `updatedAt` as `classAverages.updatedAt`; this is a deterministic fixture choice, not a new production timestamp relationship.

| Profile                | Class-index cases                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `small`                | 0: null; 1: zero entries/numeric fractions; 2: one entry/all four `N`                                                                                                                                                         |
| `medium`               | 0: two entries/all four `E`; 1: three entries/all four `excluded`; 2: one entry/mixed numeric and markers; 3: zero entries/numeric fractions                                                                                  |
| `large-representative` | 0: null; 1: three entries/numeric fractions; 2: two entries/mixed; 3: one entry/numeric fractions                                                                                                                             |
| `large-full`           | Select null/zero/one/two/three recent entries by class index modulo five; select the ordered score-template family by `Math.floor(classIndex / 5) % 5`. Use the same generation stage, not a second full-mode implementation. |

The matrix is a fixture implementation choice, not a new backend contract. Equal timestamp acceptance remains a local clone-based boundary probe; canonical source timestamp linkage must stay exact. Later sections use `small` raw views by default and `medium` for two/three-entry and marker variants. Only touched existing suites migrate opportunistically.

### Acceptance criteria and required tests (Red first)

1. Every logical/full/partial class has metadata, with raw cross-view value parity and independent nested ownership. Each raw non-null snapshot passes the real backend domain validator.
2. The compact profiles together cover every matrix variant; all non-null objects are complete. Every recent assignment belongs to its class, its reusable definition key matches the generated assignment, and its timestamp is exactly the source `updatedAt`.
3. Generator integrity checks reject local corruptions: missing/invalid shape, wrong class/assignment/definition linkage, changed timestamp, wrong order, too many entries and cross-view drift. Domain edge probes remain local rather than pollute canonical output.
4. Repeated generation is byte-identical; existing non-metadata graph data, seeds, counts and timestamp conventions remain unchanged. Explicit seed-sensitivity tests retain their existing behaviour.
5. Adapter tests resolve real canonical definitions and round-trip existing backend model fields without losing IDs/timestamps/redaction; metadata is preserved on the adapted raw input, with model round-trip assertions for the new field added in Section 3. Loaded views remain frozen/unmodified; output mutations cannot alter canonical data or another adapted instance.
6. Committed regeneration tests compare all affected views. The same metadata stage and integrity checks cover the on-demand large-full graph; no stress output is committed.
7. Existing synthetic/frontend consumers pass unchanged with extra fields; no frontend edits are needed.
8. `tests/syntheticModelInputs.node.test.js`, selected by the existing `node` project, imports both the loader and `loadBackendModelInputs` through the new alias with ESM `import`. It proves canonical class/roster/definition/metadata inputs load and clone correctly under `setupGlobals` without Node `require()` interop shims or configuration relaxations. This gate passes before Sections 3–9 depend on the adapter.

### Red → Green → Refactor

Add `syntheticClassMetadataViews.test.ts`, `syntheticClassMetadataValidation.test.ts` and `syntheticBackendModelInputs.test.ts` under `tests/synthetic-analysis/`, the node-project smoke above, and a focused metadata stress companion under `tests/synthetic-analysis-stress/`; demonstrate missing raw metadata/adapter capability. Wire generation between `generateAssignments()` and `toTransportViews()`, add independently copied metadata on each `toClassPartial()` projection in `projectClassTransportViews.js`, and call the generator-owned integrity helper from `validateSyntheticAnalysisGraph()` after context construction. Never share the newly added metadata graph between persistence, partial and full views. Keep `toTransportViews.js` and the existing larger validators unchanged unless a concrete integration need arises. Regenerate compact files only via `npm run fixtures:synthetic`. Refactor repeated projection/validation concerns into the domain helpers, not a competing fixture system.

### Section checks

- `npm run fixtures:synthetic`; `npm run test:synthetic`; `npm run test:synthetic:coverage`; `npm run test:backend -- tests/syntheticModelInputs.node.test.js`; `npm run lint:backend:check`; `npm run lint:synthetic:check`; `npm run typecheck:all`.
- Run the existing committed-fixture comparison and unchanged consumer round-trip tests. Review regenerated diffs: only intended metadata-dependent views change; no hand-edited JSON or full-stress files.
- Run `npm run test:synthetic:stress` for full-graph metadata coverage before this capability is signed off; repeat at final regression if subsequent generator changes occur.
- Record actual helper LOC, documentation reconciliation, clean review and regression comparison.

### JSDoc follow-through and delivery record

Supplied-snapshot/no-Faker/index determinism, source-exact timestamps and transport-to-model adaptation/redaction are implemented and documented; the generator/raw-view/integrity work and the adapter/Node smoke are delivered.

- Final RED sign-off `.opencode/scratchpad/section2-red-signoff.md` (R1–R13 closed; 65 new tests = 60 inventoried intentional capability reds + five characterisation passes). Final GREEN sign-off `.opencode/scratchpad/section2-green-signoff.md` (R1–R13/RR1–RR2/G1–G7 closed, no outstanding findings; all eight acceptance criteria satisfied).
- Delivered owners: generator stage/integrity 121/256 lines, adapter 130; thin graph/projection/validator integration 100/109/83; nine suites plus the local `backendModelInputAssertions.js` helper total 1,696 lines (largest suite 433). Full synthetic coverage 31 files/371 tests at 94.98/88.40/99.06/95.34%; full stress three files/15 tests; Node smoke one test; synthetic lint and all-project TypeScript pass; all six fixture hashes unchanged.
- CLI regeneration changed only `classPartials.json` and `classesById.json` for small, medium and large-representative; repeat hashes matched and parsed HEAD equality held after removing only each root class-level metadata field. No other fixture or task-artifact data changed.
- Backend lint remained an actual failed aggregate command with the ten accepted warnings (later reduced to eight after the authorised decompositions); recorded backend branch coverage was accepted debt at 83.81% versus original 83.68%, threshold 85% unchanged. No production model/controller/API capability or deployment is claimed.
- **User authorisations/deviations preserved:** the fifth existing `assignmentDefinitionPartials` view for the adapter (user-approved via the question tool; every embedded assignment retained, no fabricated full definitions); the two authorised Section 2 test-infrastructure decompositions (see the lint-baseline section); the adapter retained the cloned full nested canonical definition (keyed tasks and freshness fields) rather than substituting the editable lightweight summary; raw canonical `assignmentWeighting: null` remains as supplied while restored weighting is the constructor-owned `1`; genuinely null canonical class owners stay null.
- Separately merged commits preserved alongside the feature: `83edd48` (import-depth ESLint rule with `#synthetic-data/*` and `#test-helpers/*`), `36c3698` (`@path` injection plugin) and `41c3661` (backend agent-documentation reorganisation). None are Section 2 feature edits.
- No production data source, frontend adapter, competing fixture system, alias/configuration duplication, checker/baseline change or mid-section checker run was introduced.

### Section 2 final regression and delivery gate

- Final independent green sign-off including companion decompositions: `.opencode/scratchpad/section2-decomposition-green-signoff.md`; all R/RR/G/D/O/H findings closed, all eight metadata criteria and preservation matrices pass.
- Renewed checker command: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms timeout). Saved comparison: `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T19-47-42.138Z/comparison.txt`. Original baseline `2026-10-15T20:45:28.439Z` retained unchanged; comparison timestamp `2026-10-16T19:47:42.138Z`.
- Raw command exit 1 / overall **FAILING**, seven of eight checks passing, **zero regressions, zero new failures, four fixes**. The only failed command is backend lint, with zero errors and eight existing max-lines warnings (down from ten). The two authorised decomposition warnings are removed; other warnings are unchanged baseline debt. Backend tests, frontend/builder coverage, frontend E2E, frontend/builder lint and all-project TypeScript pass. Explicit backend coverage debt remains separately recorded because the checker runs backend tests without coverage.
- The user's condition to proceed on baseline-or-better results is satisfied; the regression gate is passed against accepted debt, not a claim of clean aggregate lint. No new failure, lint suppression, threshold change, baseline rewrite or checker change is accepted. Hook-respecting commit and push are now required; record SHA/message/branch/push below before starting Section 3. Preserve unrelated user-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` edits unstaged.

### Section 2 commit and push evidence

- Commit: `3586db4d90e00a1eef415acecbf953dec5cc39e6`.
- Exact message: `feat: add canonical class metadata fixtures and model adapter`.
- Branch: `docs/abclass-metadata-plan`.
- Normal pre-commit hooks passed: all 36 staged files were formatter-stable, staged backend ESLint and all-project TypeScript passed. Byte comparison of the saved pre-commit reviewed diff and actual committed diff succeeded; hooks introduced no unreviewed changes. No hook bypass was used.
- `git push origin docs/abclass-metadata-plan` succeeded, advancing `41c3661..3586db4`. Only unrelated user-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` changes remain outside the commit.
- Section 2 is complete against accepted baseline debt. This separate delivery-record documentation commit records the evidence before starting Section 3; its own SHA/push confirmation will be recorded in the delivery handoff rather than recursively embedding its hash. No deployment occurred.

## Section 3 — ABClass construction, restoration and serialisation

### Objective

Carry validated, defensively owned metadata through the full model and partial projection, including constructor-bypassing legacy restoration.

### Constraints

- Change only metadata-related model boundaries. `fromJSON()` still uses its existing restoration approach for other fields; explicitly invoke the metadata-domain constructor for this new field.
- Omitted metadata normalises through the constructor-owned null default; present values are validated, never defaulted or accepted unchecked. Do not add a restoration-only fallback.
- `ABClass.metadata` is plain snapshot/null as fixed in Section 1. `setMetadata(value)` validates and copies explicit replacement. `toJSON()` and `toPartialJSON()` both emit equal plain metadata values, revalidate mutable state through the same domain constructor/serialiser and return independently copied nested objects.
- Keep roster refresh, assignments, active state, owner serialisation and all unrelated legacy behaviour intact. No assessment calculation, timestamp stamping or automatic refresh.

### Delegation mandatory reads

All section agents: common reads plus @src/backend/Models/ABClass.js, the new metadata domain/error, the new canonical adapter and current ABClass model tests. `Data Shapes Agent` reconciles the delivered model/persistence-shape parts of `abclass.md`; API/persistence-operation entries remain pending.

### Shared-helper / data-shape plan

- **Reuse:** metadata-domain constructor, validation and defensive copying; existing `ABClass.serialiseOwner()` and `ArrayUtils.serialiseArray()` remain authoritative for their fields. No second validator/copy implementation in ABClass.
- Canonical helper entries: `api-layer.md` **Planned ABClass metadata helpers**; data-shape target: `abclass.md` **Planned sub-entity**, **Planned persistence and lifecycle**, **Planned validation** (`Not implemented` until delivered).

### Canonical-fixture note

Use cloned `small` `classesById` through `toBackendModelInputs.js` for realistic classes/rosters/assignments; use `medium` for two/three-entry marker variants. Remove metadata or corrupt cloned fields for local legacy/integrity/boundary probes. Do not hand-build a realistic class/assignment graph.

### Acceptance criteria and required tests (Red first)

1. Constructor, `fromJSON()`, full/partial round trips and explicit replacement accept null and all canonical non-null variants; restored instances always own metadata, including legacy absence → null.
2. Invalid present metadata, including own undefined, fails construction/restoration/replacement; null/valid replacement does not legitimise a corrupt stored full record later in the controller path.
3. Mutating constructor/replacement/restoration input cannot alter model state. Mutating full output cannot alter model/partial output, and vice versa, at every nested object/array level.
4. Invalid direct mutation of model metadata is rejected by both serializers; valid mutation serialises without silently reordering, recalculating, rounding or restamping values.
5. Existing assignment hydration/redaction and class configuration/active state remain unchanged. Direct ABClass imports work with the normal bootstrap, without per-suite compatibility shims.

### Red → Green → Refactor and section checks

Add focused `tests/models/abclassMetadataIntegration.test.js` rather than grow an oversized existing model suite. Update touched old assertions for the new always-emitted field and migrate only their realistic fixtures. Implement model integration, then remove any duplicated metadata boundary logic.

- `npm run test:backend -- tests/models/abclass`; `npm run test:synthetic -- tests/synthetic-analysis/syntheticBackendModelInputs.test.ts`.
- `npm run lint:backend:check`; sizing/doc/review gates and regression comparison.

### JSDoc follow-through and delivery record

Document legacy absence versus invalid presence, constructor-only null ownership and output isolation.

- Final RED sign-off `.opencode/scratchpad/section3-red-signoff.md` (R1–R7 closed; nine focused test cases, 294 lines, eight intentional missing-model-capability reds and one meaningful characterisation pass). Final GREEN sign-off `.opencode/scratchpad/section3-green-review.md` (all five criteria satisfied, R1–R7 retained closed, no remaining in-scope findings).
- Delivered model boundaries: ABClass construction/restoration route absence through the metadata-domain constructor, explicit replacement validates/copies before assignment, and both serializers validate/copy current metadata. No nested validator, calculation, refresh, Node runtime wiring or unrelated model-field change.
- Actual LOC: `ABClass.js` 414, integration suite 294, touched upsert/update suite 418. Full backend 190 files/2,727 tests pass; synthetic adapter two tests; all-project typecheck, scoped ESLint, formatting and whitespace pass.
- Coverage: the full command exits 1 solely on accepted branch debt at 83.96% versus prior 83.81% and original 83.68%, threshold 85% unchanged; statements/functions/lines 90.44/89.97/91.11%. Changed ABClass coverage 85.04/77.95/95.65/93.61%; metadata domain 98.76/96.77/100/98.66%.
- Backend lint exits 1 with zero errors/new-file diagnostics and eight accepted max-lines warnings; all six source/test/doc files formatter-stable and whitespace clean.
- Canonical reconciliation in `abclass.md`, `api-layer.md` and `backend-testing.md` (`section3-data-shapes.md`, `section3-docs.md`) distinguishes delivered model boundaries/order probes from pending operation/request/persistence/mapper/API/Teacher behaviour. Comment-only JSDoc corrections reused the still-applicable executable checks rather than claiming reruns.

### Section 3 final regression and delivery gate

- Stable-identity command: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms timeout), using the unchanged original baseline `2026-10-15T20:45:28.439Z`.
- Comparison: `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T20-25-06.474Z/comparison.txt`.
- Raw exit 1 / overall **FAILING**, seven of eight checks pass, **zero regressions, zero new failures, four fixes**. Backend lint alone fails on the same eight accepted max-lines warnings, zero errors or new diagnostics. Backend tests, frontend/builder coverage, frontend E2E, frontend/builder lint and all-project TypeScript pass. Explicit backend coverage debt remains the separately recorded 83.96% branch result because this checker invokes backend tests without coverage.
- Section regression gate is passed against accepted baseline debt, not a clean aggregate lint/coverage claim. Clean red/green review and same-change canonical documentation gates are satisfied. Commit/push and recorded delivery evidence are next; do not begin Section 4 before completion. Exclude unrelated user-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` changes.

### Section 3 commit and push evidence

- Commit: `895bdf645323d395c9a5ab56da6e1bcaa474e196`.
- Exact message: `feat: carry metadata through ABClass model boundaries`.
- Branch: `docs/abclass-metadata-plan`.
- Normal pre-commit hooks passed: all seven staged files were formatter-stable, staged backend ESLint and all-project TypeScript passed. Saved pre-commit reviewed diff and committed diff match byte-for-byte; no unreviewed hook auto-fixes or hook bypass occurred.
- `git push origin docs/abclass-metadata-plan` succeeded, advancing `e0cbccb..895bdf6`. Only unrelated user-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` edits remain outside the commit.
- Section 3 is complete against accepted baseline lint/coverage debt. This separate delivery-record documentation commit records evidence before starting Section 4; its own SHA/push confirmation is recorded in the delivery handoff rather than recursively embedding its hash. No deployment occurred.

## Section 4 — Decompose the oversized controller facade

### Objective

Satisfy the existing facade's hard decomposition trigger at a real domain boundary before extending its mutation orchestration.

### Constraints

- `ABClassController/index.js` is already 581 lines. Extract upsert/update/delete orchestration into `ABClassController/ABClassMutationOps.js` within the existing domain folder. Also extract `saveClass`'s existing argument checks into `ABClassValidation._validateClassForSave(abClass)` so the projected facade is about 480–500 lines without condensing its JSDoc. Do not relocate the controller or expand unrelated assignment/ref-data work.
- Preserve every public/private facade method/signature, the no-argument facade constructor, existing sub-classes and direct operations used by callers. Instantiate the new sub-class in that constructor; its dependencies use a single options object, like the other sub-classes. Keep the facade as delegation/composition. `saveClass` validates through the extracted helper then still calls its existing `_persistClassAndPartial` delegator and returns `true`.
- Inject `{ dbManager, validation, persistence, roster, responseMapper }` into `ABClassMutationOps`. Its upsert calls the shared `validation._validateClassForSave(abClass)` followed by `persistence.persistClassAndPartial(abClass)`, preserving the save-input/persistence sequence without calling back to the facade. The facade's separate `saveClass` entry point uses the same validation helper and its existing persistence delegator; introduce no facade → mutation owner → facade cycle.
- Retain existing public-method JSDoc on the facade and replace each extracted body with a one-line delegation. The mutation owner's methods/new private helpers have their own implementation-oriented JSDoc; do not remove, condense or mechanically duplicate the facade's public documentation to meet a line budget.
- Keep validation in `ABClassValidation`, persistence in `ABClassPersistence` and mapping in `ABClassResponseMapper`. The new owner orchestrates them, not duplicates them. Preserve existing roster refresh/read paths, errors, logging and full/partial ordering during extraction.
- Load sub-classes before `index.js` in GAS/Node setup; do not rename stable prefixes. Use constructor/method-only cross-references to later files.

### Delegation mandatory reads

All section agents: common reads plus @src/backend/y_controllers/ABClassController/index.js, @src/backend/y_controllers/ABClassController/ABClassValidation.js, @src/backend/y_controllers/ABClassController/ABClassPersistence.js, @src/backend/y_controllers/ABClassController/ABClassResponseMapper.js and @tests/setupGlobals.js. Include the existing mutation/deletion controller suites for signature compatibility.

### Shared-helper / data-shape plan

- **New:** injected `ABClassMutationOps` at the path above, justified by the existing 550-line breach. **Extract:** existing save-input checks into `ABClassValidation._validateClassForSave(abClass)` with identical accepted inputs/error messages; do not tighten the existing model-or-plain-object save contract. **Reuse:** existing validation/persistence/mapper sub-classes and public/private facade contracts. **Conditional extraction:** if required for the binding 500-line lint ceiling, `ABClassPersistence.readClassPartials()` owns raw registry retrieval/error logging, with mapping retained on the facade; this helper is recorded as planned-only in `api-layer.md`.
- Canonical planned helper: `api-layer.md` **Planned ABClass metadata helpers**, `Not implemented` until extraction lands. No data-shape change in this section.

### Canonical-fixture note

Use `small` canonical class/partial views and the backend adapter for characterisation inputs; reuse local Classroom/DbManager mocks. New delegation tests may use narrow injected spies. Migrate only fixtures in the mutation/controller cases actually touched.

### Acceptance criteria and required tests (Red first)

1. Characterise create/existing upsert, editable-field update, not-found update, idempotent deletion and errors with canonical data before extraction; all existing signatures/outcomes stay green. Run the existing `abclassManager.saveClass` suite as the exact accepted-input/error-message characterisation before extracting those checks, plus the initialise facade suite.
2. Add red tests for options-object dependency injection into the new mutation owner and facade delegation, including propagation of return values/errors and unchanged dependencies/context. Preserve `saveClass`'s model/plain-object acceptance, errors, `_persistClassAndPartial` delegation and `true` result. This tests the required decomposition rather than inventing changed behaviour for a refactor.
   Assert the extracted upsert invokes the shared save-input validation before persistence, using injected dependencies with no callback through the facade.
3. Verify GAS-style sub-class/facade evaluation and normal `setupGlobals` loading; no missing-global fallbacks or production imports.
4. After extraction the facade and new owner stay within their explicit LOC budgets below; JSDoc/logging is preserved, not deleted to reach the target.

### Red → Green → Refactor and section checks

Keep behaviour characterisations green, demonstrate the absent injected delegation, extract the domain orchestration, then remove only the superseded facade bodies.

- `npm run test:backend -- tests/controllers/abclass-upsert-update.test.js tests/controllers/abclass-delete.test.js tests/controllers/abclass-controller-partials.test.js tests/controllers/abclassMutationDelegation.test.js tests/controllers/ABClassController/ tests/models/abclassManager.saveClass.test.js tests/models/abclassManager.initialise.test.js`.
- `npm run lint:backend:check`; check actual LOC and runtime load order; reconcile helper docs and obtain clean review/regression comparison before adding metadata mutation behaviour.

### JSDoc follow-through and delivery record

Explain the facade/mutation-owner boundary and options-object injection.

- Final RED sign-off `.opencode/scratchpad/section4-red-signoff.md` (R1–R6 closed; 12 files/90 tests = 80 characterisations + ten planned missing-owner/delegation/shared-save-validation reds; delegation/runtime/delete suites 183/48/211 lines). Final GREEN sign-off `.opencode/scratchpad/section4-green-review.md` (all four criteria satisfied, R1–R6 closed including the reopened R2 green repair, no new findings).
- Delivered extraction: facade 484, `ABClassMutationOps` 135, `ABClassValidation` 164, bootstrap 437; delegation/runtime/delete suites 197/48/211 — all within 500. Registry-read fallback extraction was unnecessary; no data-shape contract changed; the facade's 581-line lint warning is resolved.
- Full backend 192 files/2,740 tests pass; the full coverage command exits 1 only on accepted branch debt at 84.06% versus prior 83.96% and original 83.68%, threshold 85% unchanged (statements/functions/lines 90.63/89.74/91.30%). MutationOps 100/81.25/100/100%; validation 100/98.07/100/100%; broader facade 56.79/56.52/30.30/55.12%. Backend lint exits 1 with seven accepted max-lines warnings and zero errors/new diagnostics; scoped lint, all-project types, formatting and whitespace pass.
- Docs registered the implemented injection/save-validation/test boundaries while preserving later metadata-operation/request/persistence/mapper/API markers.
- **Initial E2E flake and authorised retry (both preserved):** the first section-end comparison `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T20-56-16.506Z/comparison.txt` was BLOCKED at six of eight checks with one regression and one new failure — unchanged frontend visual test `task-preview-source-link.visual.spec.ts` (narrow 390x844 light standalone Heatmaps) exited 0 in Playwright but parsed failing. Diagnosis `.opencode/scratchpad/section4-e2e-diagnosis.md` found a genuine first-attempt failure during dependent assignment selection followed by a passing configured retry (classified flaky; the parser records the first failed result, not the later pass). No checker/framework/baseline change was made, the backend facade is not invoked by that journey, and focused reruns are not substitute completion evidence. The user explicitly selected **Retry full checker** on the unchanged reviewed executable tree and to proceed only on a baseline-or-better comparison.

### Section 4 final regression and delivery gate

- User-authorised retry command: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms timeout); original baseline `2026-10-15T20:45:28.439Z` retained unchanged.
- Final comparison: `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T21-26-00.240Z/comparison.txt`.
- Raw exit 1 / overall **FAILING**, seven of eight checks pass, **zero regressions, zero new failures, five fixes**. Only backend lint fails, with seven unchanged accepted max-lines warnings and zero errors/new diagnostics. The facade warning is removed. Backend tests, frontend/builder coverage, frontend E2E, frontend/builder lint and all-project TypeScript pass. Separate explicit backend coverage remains 84.06% branches against unchanged 85%, accepted pre-existing debt rather than a passing aggregate gate.
- This completed final-tree run supersedes the first failed section comparison for completion evidence; the real initial E2E flake, diagnostic limitations and targeted retry results remain recorded above. No frontend/checker/baseline/configuration/snapshot change or new failure waiver was made. Section regression gate is satisfied against accepted baseline debt; clean red/green reviews and same-change helper documentation are complete. Commit/push and recorded evidence are required before Section 5.

### Section 4 commit and push evidence

- Commit: `7488657b196500f11a799eb90c97b18f1637ba42`.
- Exact message: `refactor: extract ABClass mutation orchestration`.
- Branch: `docs/abclass-metadata-plan`.
- Normal pre-commit hooks passed: all ten staged files were formatter-stable, staged backend ESLint and all-project TypeScript passed. Saved pre-commit reviewed diff and committed diff match byte-for-byte; hooks introduced no unreviewed changes and no hook bypass occurred.
- `git push origin docs/abclass-metadata-plan` succeeded, advancing `26f5d51..7488657`. Only unrelated user-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` edits remain outside the commit.
- Section 4 is complete against accepted baseline lint/coverage debt, with the initial E2E flake and clean full comparison retry both preserved above. This separate delivery-record documentation commit records evidence before Section 5; its own SHA/push confirmation is recorded in the delivery handoff rather than recursively embedding its hash. No deployment occurred.

## Section 5 — Prepared dual-store writes and field-scoped roster persistence

### Objective

Prevent avoidable validation-induced split writes and stop roster-only updates from replacing unrelated partial-registry state.

### Constraints

- Prepare metadata-bearing full/partial payloads before the first full-store mutation. Existing whole-class saves/editable-field writes retain complete partial writes from the same loaded ABClass.
- Update the extracted `ABClassMutationOps.updateABClass()` in this section to prepare its complete partial before `collection.updateOne()`/`save()`, then persist that prepared payload. Its selective full-store `$set` stays selective; do not turn unrelated updates into whole-class rewrites. Preserve the model/plain-object save contract while validating and preparing metadata at whole-write boundaries.
- For supported plain-object `saveClass` inputs, actual metadata absence is normalised through `new ABClassMetadata()` when preparing the full/partial write, just as for legacy model input; explicit own undefined/invalid values still fail. Keep the existing accepted input/required-method contract and make the prepared full/partial metadata equal without a new fallback default or requiring the caller to become an ABClass instance.
- Prepare the full document from `abClass.toJSON()` when that supported method is present, otherwise from the existing plain-object input; copy it rather than mutate the caller. Derive the authoritative normalised metadata from the caller's own field/actual absence through the domain constructor. Validate any present metadata emitted by `toPartialJSON()` and reject an invalid or differing snapshot before writes; a legacy plain-object projection may omit the field. Set metadata on defensive full/partial payload copies from the same validated source snapshot, using independent nested metadata copies. This preserves legacy minimal `toPartialJSON()` stubs while ensuring whole writes include equal metadata without shared aliases or caller mutation.
- For roster persistence, determine partial existence first. An existing row gets only `$set: { className, classOwner, teachers }`, with owner/teachers serialised through the existing model/array helpers and existing class-name/null semantics. Do not call complete `toPartialJSON()` to obtain roster fields.
- Use the existing registry row's stored `_id`, obtained from that permitted lookup, as the **sole** patch filter (`{ _id: existingPartial._id }`), not `{ classId }`. The vendored query-filter result counts a matched-but-unmodified row as zero, whereas its `_id`-only result reports the match correctly. Database mocks must include realistic stored `_id` values; do not introduce a classId fallback that falsely rejects an idempotent roster patch.
- Full roster `$set` remains exactly `className`, `classOwner`, `teachers`, `students`, retaining existing forms. Do not narrow the upstream refresh responsibilities.
- An existing partial's metadata and other unrelated fields must never be used, validated, copied or rewritten by this patch, including when metadata differs from the full record, is null/absent or is malformed. Existence lookup is allowed.
- Missing partial: prepare a complete validated partial from the loaded model before full-store mutation, then insert it after the full save. Never insert a roster fragment. If an intended existing-row update cannot match, fail; no retry/upsert fallback or concurrent recovery.
- Preserve full-first/partial-second save ordering, existing logged failure propagation and I/O partial-success risk. No transaction emulation.

### Delegation mandatory reads

All section agents: common reads plus @src/backend/y_controllers/ABClassController/ABClassPersistence.js, @src/backend/y_controllers/ABClassController/ABClassRoster.js, @src/backend/y_controllers/ABClassController/ABClassMutationOps.js, @src/backend/Models/ABClass.js, @src/backend/Utils/00_ArrayUtils.js, @src/backend/DbManager/DbManager.js, @scripts/builder/vendor/jsondbapp/src/04_core/Collection/02_CollectionWriteOperations.js and @scripts/builder/vendor/jsondbapp/src/02_components/DocumentOperations.js. Include existing persistence/roster mocks and tests. The vendor returns `{ matchedCount, modifiedCount, acknowledged }`; zero matches do not throw. Query-filter `matchedCount` depends on modification, but an `_id`-only filter preserves a match when `$set` is a no-op. The existing partial-row roster branch must therefore use the stored `_id` and check `matchedCount`, accepting matched-but-unmodified data and rejecting zero matches.

### Shared-helper / data-shape plan

- **Extend:** `ABClassPersistence.persistClassAndPartial()` (the facade calls it through `_persistClassAndPartial`) and `_upsertClassPartial()`; add private preparation/write helpers so a complete partial is built once before full mutation and persisted afterwards. Retain existing direct method signatures. `ABClassRoster._persistRoster()` remains the roster orchestrator, calling dedicated registry-roster preparation/write helpers on its existing persistence dependency rather than the whole-row upsert.
- **Reuse:** `ABClass.serialiseOwner()` and `ArrayUtils.serialiseArray()` for registry roster values. **Keep local:** exact roster patch/missing-row creation preparation in `ABClassPersistence`, returning only the necessary identity/patch/prepared creation state, never a copied metadata snapshot for an existing row. Share domain validation for complete payloads; do not create another validator.
- Canonical records: `api-layer.md` **Planned ABClass metadata helpers**; `abclass.md` **Planned persistence and lifecycle / Planned field-scoped roster persistence**, initially `Not implemented`. This section changes persistence operations, not the payload/envelope contract.

### Canonical-fixture note

Use `small` class/partial/roster data through the adapter and `medium` for alternate valid snapshots. Local clones cover missing partials, legacy absence, corrupt metadata, differing full/partial snapshots and write failures. Keep service/DB mocks local and faithful to actual vendor result values.

### Acceptance criteria and required tests (Red first)

1. Whole saves and metadata-bearing editable writes produce identical full/partial metadata; invalid mutable metadata or partial projection failure causes **zero** full/partial insert/update/save operations.
2. Existing-row roster tests assert both exact `$set` payloads and serialised owner/teacher values. No full-row partial replace/upsert, metadata-bearing projection or unrelated fields are present. Name/owner/teachers/students refresh remains intact.
3. Persisted partial metadata is unchanged when it differs from loaded-full metadata, and for null, absent and malformed values. A metadata accessor/projection spy must prove the roster branch does not inspect/copy/validate that value beyond the permitted existence lookup.
4. Missing partial creates a complete partial containing configuration, active state and validated metadata/null; invalid creation payload rejects before either store is mutated. Existing-row patches use only stored `_id` as filter. A vendor-faithful matched-but-unmodified `_id` patch succeeds; a zero-match patch fails loudly instead of silently succeeding.
5. Assert full mutation/save precedes partial mutation/save. Full-save failure prevents partial mutation; partial-save failure propagates with existing diagnostics and without rollback/retry. Also cover a partial patch/insert throwing.
6. Legacy existing-row roster patches leave metadata absence untouched in both stores; later whole saves include the field. General editable-field patches may retain full-store absence while rebuilding partial metadata as null.
7. Plain-object save tests cover legacy absence and valid/null/invalid explicit metadata with the existing minimal partial-projection contract: caller/full/partial nested values are independent, the caller receives no new or mutated metadata field, and legacy projection omission is populated only on prepared payload copies. Present invalid/different projection metadata fails before either write.

### Red → Green → Refactor and section checks

Add focused `tests/controllers/abclassMetadataPersistence.test.js` and `abclassRosterPersistence.test.js` (split failure cases into a companion if needed). Rewrite the old roster-sync `replaceOne` assertion for the approved field-scoped update and add the existing-row/no-op load-suite scenario identified in the inventory, while retaining its missing-row complete insert. Implement prepared writes and the field-scoped roster branch; then refactor only duplicated preparation/persistence logic within the owner.

- `npm run test:backend -- tests/controllers/abclassMetadataPersistence.test.js tests/controllers/abclassRosterPersistence.test.js tests/controllers/abclass-roster-sync.test.js tests/controllers/abclass-loadClass.test.js tests/controllers/abclass-controller-partials.test.js tests/controllers/abclassController.persistAssignment.test.js tests/models/abclassManager.loadClass.test.js tests/models/abclassManager.saveClass.test.js tests/models/abclassManager.initialise.test.js`.
- `npm run lint:backend:check`; exact payload, prevalidation, vendor match result, ordering/error-log tests green; actual LOC/doc/review/regression gates recorded.

### JSDoc follow-through and delivery record

Explain why roster patches deliberately avoid stored metadata, missing-row preparation timing and non-transactional failure risk.

- Final RED sign-off `.opencode/scratchpad/section5-red-signoff.md` (R1–R15 closed, R16 preserved; 28 intentional missing-preparation/scoped-roster assertion failures and 54 passing characterisations). Final GREEN sign-off `.opencode/scratchpad/section5-green-signoff.md` (all R1–R15/C1/I1/ER1/GT1/GT2/G1–G3 closed, R16 preserved, no remaining findings; all seven criteria and the approved model amendment verified).
- Actual LOC: `ABClass`/persistence/roster/mutation 440/225/238/136; new suites model/workflow/whole/editable/roster 159/112/422/157/297 — all within 500. Full backend 197 files/2,789 tests pass; synthetic 31 files/371 tests; all-project types and scoped lint/formatting/whitespace pass. Backend lint exits 1 on seven unchanged accepted warnings/zero errors.
- Coverage: the full command exits 1 solely on accepted branch debt at 84.11%, above prior Section 4 84.06% and original 83.68%, below the unchanged 85% threshold. A mid-section drop to 82.49% was causally isolated to a test-wiring identity problem (`.opencode/scratchpad/section5-coverage-diagnosis.md`, `section5-coverage-isolation.md`, `section5-coverage-isolation/section5-coverage-cause.md`): static ESM backend imports resolved to distinct constructors from the bootstrap CommonJS `require()`. It was resolved by complete-tree evidence, not waived — S5-GT2 normalises backend CommonJS owner imports in the three persistence suites to the bootstrap-compatible `#backend` require route while retaining the static named ESM synthetic-tooling imports; byte comparison confirms all test bodies/setup/assertions unchanged. No threshold, include-set, test-exclusion, runtime, configuration, provider or baseline change.
- Canonical reconciliation: Data Shapes updates only `abclass.md` (`section5-data-shapes.md`); Docs updates `SPEC.md`, `api-layer.md` and `backend-testing.md` (`section5-docs.md`) — the dated model amendment, helper ownership, prepared whole/plain/selective writes, field-scoped roster no-read semantics and bounded test-module identity guidance. Request/provenance/response/API integration and Teacher/deletion companions stay pending. Generator and committed fixtures unchanged.
- **User waiver (explicit exception) and E2E flake:** Section 5's completed section-end checker `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-17T06-33-31.219Z/comparison.txt` reported one frontend E2E regression/new failure. Playwright diagnosis `.opencode/scratchpad/section5-e2e-diagnosis.md` found an initial failed modal assertion followed by a passing configured retry, then four clean focused reruns; the journey uses local frontend runtime mocks, not the changed backend, and the precise missed callback/debounce/render mechanism is **unproven**. The user identified this as persistently flaky and explicitly waived the Section 5 regression gate, authorising commit/push and proceeding to Section 6 **without rerunning the checker**. This is an explicit exception, not a clean zero-regression comparison; the failed result and its artifacts are retained and revisited only if it recurs after Section 6. No frontend/checker/config/baseline change was made.

### Approved serialisation amendment — 17 October 2026

The user explicitly approved the proposed bounded `ABClass.toJSON()` correction: embedded partial assignments use their existing `toPartialJSON()`, while genuinely full assignments retain full serialisation. Standalone full `Assignment`/`AssignmentDefinition.toJSON()` remains strict; no catch-and-fallback, definition fabrication, assignment removal, automatic hydration/fetch or workflow restructuring is authorised. This brings missing Section 3 integration work into Section 5 so the prepared full class document includes its actual non-empty assignment population and validated metadata. A second persistence-specific class serializer is not required. Preserve full/partial assignment IDs, dates, task summary/weighting/definition keys, submissions/scores/feedback and existing partial redaction; preserve all full fields where the assignment is genuinely full.

The existing synthetic generator already emits class-embedded partial summaries and separate full keyed-task assignment records. There is no established generator deficiency: use existing canonical small/medium adapted populations for supplemental model round trips, mixed full/partial serialisation and real assignment-run persistence tests. Metadata-only empty-assignment tests may remain narrow unit probes but must no longer be the sole whole-class integration coverage. Do not regenerate or change fixtures merely to hide the production conflict; report any actual corpus gap before broadening generator scope.

Current required sequence: Testing Specialist adds supplemental canonical non-empty model/workflow reds and corrects the two stale plain-object payload expectations; independent reviewer checks the **full Section 5 context** and amendment before any further production edit. Then Implementation applies only the approved model correction and any necessary in-scope persistence repairs, all affected/focused/full backend gates run, Data Shapes Agent reconciles the model/storage contract, and Docs reconciles the approved spec/helper/testing wording. All R1–R15 closures from the original red loop are retained unless a substantive new issue reopens one. Sections 6–11, Teacher correction, frontend, standalone full-definition relaxation, baseline/checker changes and deployment remain excluded. The blocker above is resolved by this explicit authorisation, not an accepted failure; all final gates still apply.

### Section 5 commit and push evidence

- Commit `d7e5c47245ade98ecca212a67df07ce0d177c600` — `feat: add prepared dual-store writes and scoped roster persistence` on `docs/abclass-metadata-plan`.
- Normal hooks passed staged Prettier (unchanged), backend lint and all-project TypeScript; no hook bypass. Push succeeded, advancing `4472a23..d7e5c47`; remote-tracking branch matches the full SHA. Unrelated reviewer/configuration edits remain excluded.
- Original failed regression result and the user's explicit instruction to proceed without rerunning are preserved above; this is not a zero-regression comparison claim. No deployment occurred.

## Section 6 — Full and registry-only response mapping

### Objective

Expose metadata consistently on existing reads and mutation summaries without making list reads heavy or normalising corruption away.

### Constraints and mandatory reads

Use the common reads plus @src/backend/y_controllers/ABClassController/ABClassResponseMapper.js, @src/backend/y_controllers/ABClassController/index.js and @src/backend/z_Api/abclass/abclassRead.js for all delegated phases.

- `_normaliseClassPartial()` is the sole stored-partial metadata gate; route actual absence through the metadata constructor, validate present values and copy outputs. `_buildClassSummary()` already reuses this gate. Do not duplicate it in `getAllClassPartials()`.
- `_toReadView()` explicitly includes validated/copied metadata. Preserve assignment redaction/definition-key projection and existing full-read `DateUtils` handling.
- Partial/mutation metadata timestamps are already canonical strings; add no Date conversion there. Preserve top-level not-found null and empty partial-list behaviour; do not backfill on reads.

### Shared-helper / data-shape plan

**Extend** the two explicit mappers; **reuse** the metadata owner and existing summary gate. References: `api-layer.md` **Planned ABClass metadata helpers**, `abclass.md` **Planned transport**, initially `Not implemented`. Reconcile read contracts now; mutation write semantics remain pending.

### Canonical-fixture note

Use raw `small.classPartials` for registry tests and adapted `small.classesById` for model/full reads; `medium` supplies marker/three-entry variants. Invalid stored/legacy records are local clones. Read real mapper/controller paths, not stubbed metadata responses.

### Acceptance criteria and required tests (Red first)

1. Every partial/full/summary response contains metadata, including null for legacy absence; exact non-null values are equal across representations, detached from input/model/other outputs.
2. Invalid stored partial or full metadata fails rather than dropping a row, repairing it or fetching another representation. No writes occur on reads.
3. `getAllClassPartials()` accesses only `abclass_partials`: assert no full collection load, assignment hydration, definition lookup or Classroom API call; empty list remains `[]`.
4. Missing full class remains top-level null through its handler; existing class with null metadata remains an object. Existing `_id` stripping, students/assignment treatment and definition-key projection remain correct; responses are JSON-safe.

### Red → Green → Refactor and section checks

Add `tests/controllers/abclassMetadataResponses.test.js`; split the 540-line existing read suite as specified in the sizing inventory, preserving its assertions and migrating only touched realistic inputs to canonical adaptation. Implement explicit fields in the existing mappers, then ensure there is one stored-partial gate rather than an additional list-level metadata pass.

- `npm run test:backend -- tests/controllers/abclassMetadataResponses.test.js tests/controllers/abclass-partials-read.test.js tests/controllers/abclassController.readClass tests/api/abclassRead.test.js`; `npm run lint:backend:check`.
- Confirm no additional Date conversion, extra reads or read-time writes; record actual LOC, contract reconciliation, clean review and regression comparison.

### JSDoc follow-through and delivery record

Explain nullable legacy reads, the single partial gate and string timestamps.

- Final RED sign-off `.opencode/scratchpad/section6-red-review.md` (PASS, no in-scope findings; five files/33 tests = 28 characterisations + five intentional missing-mapper reds). Final GREEN sign-off `.opencode/scratchpad/section6-green-review.md` (PASS, all four criteria satisfied, no Critical/Improvement/Nitpick findings).
- Delivered mapper: `ABClassResponseMapper` 109 lines (+6) adds shared-domain metadata validation/copying to the existing single partial gate and the full read projection; the summary continues reusing that gate. No list-level gate duplication, read-time writes, extra date conversion or assignment-projection change.
- Focused six files/40 tests and full backend 199 files/2,794 tests pass; coverage exits 1 only on accepted branch debt at 84.23% (above prior 84.11% and original 83.68%, below the unchanged 85% threshold); statements/functions/lines 90.68/89.74/91.35%; mapper 88.23/83.33/100/88.23%. Suite sizes metadata/partial/read/assignment/upsert 172/253/307/466/419. Backend lint exits 1 on six unchanged warnings (down from seven after the read-suite split) with zero changed-file diagnostics.
- Canonical reconciliation: `section6-data-shapes.md` records delivered read/partial/summary contracts in `abclass.md`; `section6-docs.md` records helper/testing guidance in `api-layer.md` and `backend-testing.md`; `section6-jsdoc.md` records source JSDoc for shared validation/copying, typed integrity failures, storage-only fields versus public metadata and unchanged full-read date conversion (AST proof: no executable change since the full run). Request acceptance/provenance, transport adaptation and Teacher/deletion companions stay pending in Sections 7–9.

### Separately authorised frontend companion — immediate Add new commands

After the read-only report `.opencode/scratchpad/dropdown-state-investigation.md` (and the user's follow-up request for a read-only Playwright investigation into persistent dropdown flakiness and suspected state-handling anti-patterns), the user explicitly approved the bounded frontend fix alongside Section 6. It supersedes the frontend exclusion **only** for `SelectWithAddNew` modal-open dispatch, the obsolete `debounceMs` call-site/type removal and directly associated component/owner/Playwright tests and documentation; it does not authorise changes to the shared `useDebounce` hook, modal open/close UX or focus behaviour, service mutations, data contracts, framework/configuration, retry/timeouts, snapshots or checker/baseline.

The source-level issue is an unnecessary 300 ms deferred command with possible unmount cancellation; its causal link to the original flake remains **unproven** (the failed snapshot retains an expanded dropdown and there is no failed-attempt callback trace). Do not claim a confirmed root-cause fix. Chosen correction: dispatch `onAddNew` immediately for the sentinel, preserve normal `onChange` forwarding and sentinel interception, and retain parent-controlled idempotent modal state; no global locks, second state owner or generic debounce rework.

- **Authorised extension:** via the question tool the user selected **Fix selection state (Recommended)** and approved the bounded selected-value ownership extension — a controlled `value` prop (presence includes explicit `undefined`) stays authoritative and is passed to Ant Design as `null`, an uncontrolled selection is seeded from `defaultValue`, and normal selection, clear and `labelInValue` payloads keep their shape; command selection never becomes a displayed value and dispatches immediately.
- Final RED sign-off `.opencode/scratchpad/dropdown-value-boundary-red-signoff.md` (F-R1–F-R5 closed; 30 tests = 22 characterisations + eight inventoried capability/state-boundary reds). Final GREEN sign-off `.opencode/scratchpad/dropdown-green-review.md` (PASS, no outstanding findings; F-R1–F-R5 and E2E-A1 resolved).
- Delivered source: `SelectWithAddNew.tsx` (160 lines; the final JSDoc-only edit preserves all 454 non-comment TypeScript tokens with before/after SHA proof) plus the mechanical `debounceMs` removal in `BulkSetSelectModal.tsx`. Shared hook and caller-owned modal state, services, schema, configuration, retries and baseline unchanged.
- Tests: focused five specs/42 tests pass (authoritative count; the review's prose figure of 54 is not additional tests). Full frontend 253 files/2,504 tests pass at 95.29/90.91/94.89/95.88% coverage (all ≥85%); component owner 96/91.66/100/95.83%. Frontend lint exits 0 with 24 unchanged warnings; all-project types, formatting and whitespace pass.
- **Browser proof (real runtime):** the complete affected Chromium spec passed **8/8** and the targeted year-group/keyboard/cohort+year-group repeat matrix **12/12**, all first-attempt/no retries. E2E-A1 was corrected so new-cohort auto-selection is proven **before any manual selection**. The creation `useForm` connection warning is recorded, not suppressed. Passing browser evidence does not retrospectively prove the historical flake's mechanism.
- Docs `.opencode/scratchpad/dropdown-docs.md` records the explicit bounded authorisation (not frontend metadata support), registers immediate command/value ownership and superseded modal debounce in the shared-helper guidance, and records the two installed Ant Design test-only limitations in the frontend testing guide. The unrelated optional dead switch-arm cleanup stayed out of scope.

### Section 6 and frontend companion final regression gate

- Command: `npm run regression-checker -- abclass-metadata-contract`, 1,200,000 ms timeout. Original baseline `2026-10-15T20:45:28.439Z` unchanged; final reviewed combined-tree comparison `2026-10-17T08:38:23.244Z`.
- Report: `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-17T08-38-23.244Z/comparison.txt`.
- Raw exit 1 / overall **FAILING**, seven of eight checks passing, **zero regressions, zero new failures, six fixes**. Only backend lint fails, with six unchanged accepted max-lines warnings/zero errors. Backend tests, frontend/builder coverage, frontend E2E, frontend/builder lint and all-project types pass. Section 6's original oversized read-suite warning is resolved.
- Separate explicit backend coverage still reports 84.23% branches below unchanged 85%, above original accepted 83.68%; the checker invokes backend tests without coverage, so its passing backend check is not a threshold claim. Frontend full coverage passes all thresholds.
- Pre-gate formatting of all twenty owned source/test/canonical-document paths plus this plan and whitespace checks passed. No executable source/test/configuration changes occurred during the checker. Original Section 5 flake, intermediate test-construction failures, corrected auto-selection proof and their artifacts remain preserved. Passing browser evidence does not retrospectively prove the historical flake's mechanism.
- Regression gate is satisfied against accepted baseline debt. Both workstreams' clean RED/GREEN review and canonical documentation gates are complete. Separate hook-respecting frontend/backend commits and successful push evidence are next; no Section 7 before completion. Exclude user-owned `.opencode/agents/code-reviewer.md` and `opencode.jsonc` edits.

### Section 6 and frontend companion commit/push evidence

- Frontend: `2199bc5cff0f889d7ca2bb2157cc1c3adfbedb56` — `fix: dispatch add-new commands without changing selection`.
- Backend Section 6: `a70a33da330bccd32ca958fbc1fc25f0aa9c1cbe` — `feat: expose validated class metadata in read responses`.
- Branch: `docs/abclass-metadata-plan`. Both normal pre-commit hooks passed staged lint and all-project types; applicable staged formatter checks were unchanged. Explicit pre-gate formatting already covered every changed frontend/backend source/test/doc. No hook bypass or unreviewed auto-fix: saved reviewed staged patches and actual committed patches match byte-for-byte for both commits.
- `git push origin docs/abclass-metadata-plan` succeeded, advancing `d7e5c47..a70a33d` including both commits. Only unrelated user-owned reviewer/configuration changes remain outside them.
- Section 6 and its explicitly authorised companion are complete against recorded baseline lint/coverage debt. This separate documentation commit records delivery before Section 7; its own SHA/push confirmation belongs in the handoff rather than recursively embedding its hash. No deployment occurred; the historical flake's cause and existing `useForm` warning are not represented as resolved.

## Section 7 — Atomic request rejection and metadata mutation semantics

### Objective

Add optional metadata to existing upsert/update controllers with complete replacement, preserved omission and correctly scoped request-error provenance.

### Constraints and mandatory reads

All section agents: common reads plus @src/backend/y_controllers/ABClassController/ABClassValidation.js, the new `ABClassMutationOps.js`, @src/backend/y_controllers/ABClassController/ABClassPersistence.js and the new metadata domain/error. Include facade compatibility tests.

- Pass the original parameters object to `_validateRequestMetadata(parameters)` at the start of upsert/update, before any record read/roster/write. Test own-property presence, not destructured `undefined` equivalence.
- The helper calls shared domain validation and tags only that invocation's `ABClassMetadataValidationError` as `inputSource: 'request'`. Do not wrap the entire mutation in request provenance or translate transport errors in the domain.
- Omission preserves existing metadata/new class null; explicit null clears; complete objects replace. Add metadata to editable-field selection without nested merging. Validate a mixed request before applying any of its fields.
- Always restore/validate stored full metadata first when loading an existing class, even if the caller supplies null or a valid replacement. No repair bypass.
- Upsert still refreshes name/owner/teachers/students, preserves assignments/active state and then performs its normal whole-class save. Update adds no roster refresh. Existing missing-class/protected-field/delete semantics remain unchanged.

### Shared-helper / data-shape plan

**Extend** `ABClassValidation._validateRequestMetadata`, mutation-owner orchestration and editable-field preparation; **reuse** model replacement/serialization, persistence preparation and response mapping. Canonical entries: `api-layer.md` **Planned ABClass metadata helpers**, `abclass.md` **Planned provenance and error rules / Planned transport / Planned persistence and lifecycle**, initially `Not implemented`. Do not grow nested validation in the facade or transport.

### Canonical-fixture note

Use adapted `small` full/partial class and assignment data; `medium` metadata for complete replacements and marker variants. Clone for own-undefined, missing/invalid legacy fields, invalid mixed patches and corrupt stored records. Existing external-service mocks remain local.

### Acceptance criteria and required tests (Red first)

1. Parameterise new/existing upsert and existing update over omission/null/complete replacement; assert full/partial persisted values, returned summary and caller/model/output alias isolation. Preserve assignments, active state and unrelated configuration.
2. All representative invalid/own-undefined metadata is rejected before **any record read**, Classroom fetch, in-memory patch application, insert/update or save. A mixed invalid metadata/configuration patch applies none of its fields.
3. Request failures carry the typed error/path and request provenance. Identical failures on restoration/projection/serialization do not. Corrupt stored full metadata fails even with valid replacement/null; no write occurs.
4. Unrelated updates, roster refresh followed by upsert's whole-class save and assignment persistence retain the last supplied snapshot. Assessment-run persistence does not calculate, stamp, clear or otherwise refresh metadata.
5. Existing upsert roster calls and update no-roster behaviour are unchanged; missing update still fails as before. Protected fields remain protected; deletion response flags/store removals remain unchanged and contain no metadata.

### Red → Green → Refactor and section checks

Add focused `tests/controllers/abclassMetadataMutations.test.js` and `abclassMetadataLifecycle.test.js`. Implement the early validation gate and model-backed replacement, then reuse existing preparation/summary helpers instead of adding parallel paths.

- `npm run test:backend -- tests/controllers/abclassMetadataMutations.test.js tests/controllers/abclassMetadataLifecycle.test.js tests/controllers/abclass-upsert-update.test.js tests/controllers/abclass-delete.test.js tests/controllers/abclassController.persistAssignment.test.js tests/backend-api/abclassMutations.unit.test.js`; `npm run lint:backend:check`.
- Verify side-effect spies include reads and roster calls, not just saves. Record facade/mutation-owner LOC, contract reconciliation, clean review and regression comparison.

### JSDoc follow-through and delivery record

Document omission/null/replacement, narrow request provenance, no stored-data repair and intentionally stale snapshots. Next phase: RED tests from pushed Section 6, with no production changes yet. Split into coherent test milestones before full-section RED review: A, canonical new/existing upsert and update omission/null/replacement plus early no-read/no-roster/no-write request rejection and narrow typed provenance; B, corrupt stored-record no-repair, lifecycle preservation through unrelated updates/roster/assignment persistence and existing protected/not-found/delete compatibility. Use real controller/domain/model/persistence/mapping paths with local faithful external mocks and non-empty canonical populations. Record all five criteria, actual failure inventory and focused checks; no GREEN source until the complete RED loop is independently clean. Retain original baseline/accepted debt; no mid-phase checker.

Milestone A is owner-complete as a **partial RED checkpoint**, `.opencode/scratchpad/section7-red-mutations.md`: new `abclassMetadataMutations.test.js` is 350 lines, with canonical omission/null/replacement and invalid-request gate/provenance probes. Focused selection reports 100 tests/85 passes/15 preliminary missing-capability failures, and all four existing suites pass; the report's separate “85/85 existing” statement is inconsistent with the new suite's passing controls and must be reconciled from the actual log, not repeated as an extra 85 tests. Types, file-scoped lint, formatting and whitespace pass; aggregate backend lint retains only six existing warnings. Milestone B now adds real stored-corruption/no-repair, unrelated/roster/whole-save/assignment lifecycle and compatibility evidence before the full Section 7 independent RED review. No source changes or checker run.

Milestone B is owner-complete pending full independent RED review, `section7-red-lifecycle.md`: new lifecycle suite 307 lines/11 passing characterisations; A remains unchanged at 350 lines. Complete six-file selection collects **111 tests: 96 pass, 15 preliminary missing request-gate/replacement failures**, all in A. This supersedes A's misleading separate existing-suite count. B uses real non-empty canonical populations, a same-class standalone full assignment with separately routed storage, stored-corruption no-repair (valid replacement/null on upsert/update), narrow non-request integrity provenance, snapshot preservation across edit/roster/whole-save/assignment persistence and explicit compatibility evidence. No helper extraction or runtime change. Types, scoped lint, formatting and whitespace pass; aggregate backend lint still fails only on six accepted warnings. Current phase: full Section 7 RED independent review of all five criteria, intentional failure inventory and fixture/mock/ownership passability; no GREEN source or checker yet.

First full Section 7 RED review is **FAIL**, `section7-red-review.md`. C-01 (numeric no-read counters passed to spy matchers), C-02/I-05 (clone-on-read mocks manufacture detachment), C-03 (rewritten class ID leaves canonical assignment membership incoherent), I-01 (helper parameter defaults outside constructors), I-02 (mixed invalid patch lacks complete no-write/unchanged metadata assertions), I-03 (request-side ownership not tested), I-04 (lifecycle actual payload ownership), N-01 (unused binding), N-02 (implicit argument-count request helper), N-03 (irrelevant find counter assertion), N-04 (empty-array ownership clarification) and N-05 (insert-result fidelity) are OPEN, owned by Testing Specialist. Consolidate duplicate C-02/I-05; handle actual payload/request/model ownership as its own complex milestone after the structural/fixture/no-read repairs. For I-04, existing-row roster updates must **not** carry/project metadata: prove metadata absence from actual patches rather than requiring illegal metadata copies; whole-save/assignment payloads still need genuine ownership checks. N-05's return-value description is imprecise (`rows.push` returns a number, not undefined); choose the actual vendor `{ insertedId, acknowledged }` contract, not the report's incompatible insertedCount comparison. Preserve value assertions and all five criteria, with explicit intentional assertion failures separated from the current matcher TypeError. No production edits or checker until the complete RED review is clean.

RED construction repair milestone is owner-complete, pending review: `section7-red-construction-repair.md`. C-01/C-03/I-01/I-02/N-01/N-02/N-03/N-05 are owner-fixed; mutations/lifecycle suites are 368/324 lines, lifecycle remains 11/11 and complete six-file run remains 96 passes/15 capability assertion failures, now with **no matcher TypeError or fixture/setup/import failure**. Types, scoped lint, formatting and whitespace pass. Canonical identity/membership and all previous value assertions are retained. Remaining complex ownership milestone C-02/I-03/I-04/I-05/N-04 now captures actual request/model/write/summary references, not clone-on-read outputs, respecting no-op update and metadata-free roster patch exceptions. It may add a small local assertion helper or companion only if required by the 500-line ceiling, with complete inventory and validation before full RED re-review. No production source change or checker run.

Actual ownership repair is owner-complete, `section7-red-ownership-repair.md`: mutations/lifecycle are 408/366 lines, no shared helper or companion extraction. C-02/I-03/I-04/I-05/N-04 now use actual metadata-bearing write-call arguments, real restored model/summary and original request references; clone-on-read values are equality-only. Existing upsert's earlier roster patches are distinguished from later metadata-bearing whole writes; omitted no-op updates require no invented write, and roster patches assert exact metadata-free fields. Canonical zero-entry arrays and non-empty nested entries are checked without entry-zero errors. Six files/111 tests retain 96 passes/15 intended capability failures with no matcher/dereference/setup errors; types, scoped lint, formatting and whitespace pass. All review findings are **owner-fixed pending independent verification**, including milestone 1 (the owner's “closed” report shorthand is not independent closure). Current phase: full Section 7 RED re-review; no production edit, coverage or checker yet.

Full RED re-review remains **FAIL**, `section7-red-signoff.md`; the original construction/ownership findings are independently verified repaired, but C-R1 (update's partial-store capture only searches `updateOne` although partial writes use replace/insert) must be corrected so ownership cannot silently skip after GREEN. I-R1 requests precise empty-array wording. I-R2's claim that the throwing assertion is hard is factually inconsistent with the source's `expect.soft`; do **not** follow its option to skip later no-side-effect checks or stop early, which would undermine the required atomic-rejection proof. Chosen local resolution: if reducing noisy duplicate assertion reports, aggregate the complete named collection/roster/store counters into a structured zero-side-effect comparison that still evaluates after rejection fails, retaining unchanged metadata/active checks. No assertion or covered write method may be removed. All three local resolutions return to Testing Specialist and full re-review; no runtime edits or checker.

Residual RED repairs are owner-complete, `section7-red-final-repair.md`: C-R1 now captures actual insert/replace/selective-update metadata payloads independently of public operation and asserts required write presence; omission no-op remains permitted. I-R1 precisely documents root/averages/array identities without entries for zero-entry snapshots. I-R2 groups the complete side-effect counter inventory while retaining rejection/provenance and unchanged state checks, never skipping assertions to hide REDs. Lifecycle tests unchanged. Complete selection remains 111 tests/96 passes/15 capability reds; scoped lint/types/formatting/whitespace pass. Current phase: final full RED re-review with all prior verified closures retained; no production implementation or checker yet.

Full Section 7 RED final review is independently **PASS**, `section7-red-final-signoff.md`: original C/I/N findings and residual C-R1/I-R1/I-R2 all CLOSED; no in-scope construction, fixture, matcher, setup, type or lint defects. Mutations/lifecycle suites are 440/366 lines. All five criteria are mapped, with 111 tests/96 passing characterisations/15 inventoried intentional missing request-gate/application failures; these are GREEN acceptance work, not accepted debt. Types, scoped lint, formatting and whitespace pass; aggregate backend lint retains six unchanged warnings. Current phase: implement only early shared request validation/provenance and model-backed omission/null/replacement in existing validation/mutation owners, preserving selective/prepared writes, non-empty assignment data, response mapper reuse and corrupt-storage rejection. Distinguish “no metadata write when omitted” from inventing an unrelated no-operation optimisation; retain existing selective operation semantics. No Section 8 transport adaptation, frontend change, checker or commit before complete GREEN validation/review.

Section 7 GREEN source is implemented but final validation is **blocked on stale test collaborators**, `section7-green.md`. Existing validation/mutation owners now gate request metadata before reads/roster/writes, tag only that shared-domain invocation's typed failures, apply replacement/null through the model setter and preserve selective prepared writes; facade JSDoc is 490 lines. Exact six-file/111-test Section 7 selection passes. First full backend coverage attempt collects 201 files/2,826 tests with 2,824 passes/two failures, both direct-owner upsert tests whose injected validation collaborator lacks `_validateRequestMetadata`. Do not mask missing wiring with optional-method fallbacks. Testing Specialist owns the narrow collaborator migration and final focused/full coverage plus actual all-project typecheck (Implementation's recorded type check was frontend-only, not the required all-project gate). Canonical Data Shapes/Docs reconciliation proceeds on the delivered focused-tested behavior, retaining Section 8 transport-error adaptation as pending. No final green review/checker/commit claim until full validation and documentation are complete.

Collaborator migration is owner-complete, `section7-green-test-final.md`: the two direct-owner upsert mocks now expose and assert the real early request-gate collaboration without weakening production wiring. Seventeen focused files/198 tests and full backend **201 files/2,826 tests pass**. Actual full coverage still exits 1 only on accepted branch debt at **84.29%**, above original 83.68% and prior 84.23% against unchanged 85%; all-project types, scoped lint, formatting and whitespace pass. Aggregate backend lint retains six unchanged warnings/zero errors. Orchestrator source verification identifies local O-01 before final review: update currently calls the complete `abClass.toPartialJSON()` merely to obtain a detached full-store metadata value, then prepares another full partial. Chosen minimal refinement is reuse of existing persistence `_metadataCopy(abClass)` (shared domain copy only), preserving one complete partial preparation, independent ownership and all provenance/order semantics. Reconcile private mutation JSDoc at the same time; no facade growth or new helper/API. Revalidate affected/focused/full backend source after this small executable refinement; earlier coverage is not final-tree evidence. Canonical data-contract reconciliation is unchanged by the helper reuse.

O-01 is owner-fixed pending independent review, `section7-green-refinement.md`: update reuses existing `_metadataCopy(abClass)` for full `$set` metadata and still prepares its complete partial once before mutation. Private mutation JSDoc reflects metadata semantics; no helper/signature/contract change or additional source owner. Final executable tree passes seventeen focused files/198 tests and full backend **201 files/2,826 tests**; branch coverage remains **84.29%** below unchanged 85% but above prior 84.23%/original 83.68%. All-project types, scoped lint, formatting and whitespace pass; aggregate backend lint remains six old warnings/zero errors. These final-tree results supersede the pre-refinement coverage evidence. Canonical docs are still awaiting agent handoffs before full Section 7 GREEN review; no checker/commit yet.

API/helper/testing documentation is reconciled, `section7-docs.md`: controller request gate/provenance and omission/null/replacement are implemented; transport helpers already forward original requests, but typed request→`ApiValidationError`/`INVALID_REQUEST` remains explicitly pending Section 8 (current invalid metadata follows `INTERNAL_ERROR`). New real mutation/lifecycle suites and migrated direct-owner collaborator are registered; actual-payload ownership and metadata-free roster exceptions remain clear. Docs' earlier coverage/double-projection notes are superseded by final test/refinement evidence, not outstanding blockers.

Final source JSDoc reconciliation is complete, `section7-jsdoc.md`: private validation/mutation and existing transport wrapper documentation now accurately includes metadata semantics and typed propagation, with no Section 8 logic added. Acorn parse/token proof confirms no executable changes; formatting, scoped lint and whitespace pass. Final refined backend coverage/test evidence therefore remains applicable, not claimed freshly rerun for comments. Canonical `abclass.md` reconciliation still awaits its Data Shapes handoff before full Section 7 GREEN review; no checker/commit yet.

Canonical data-shape reconciliation is complete, `section7-data-shapes.md`: `abclass.md` now records optional request metadata and the delivered omission/null/replacement/no-repair/request-provenance matrix. Old “writes ignore metadata” claims are removed; constructor/field/storage/read shapes are unchanged. Request-only transport adaptation remains explicitly pending Section 8, with current typed request failures following `INTERNAL_ERROR`; frontend stripping and Section 9 companions remain correctly distinguished. O-01 double projection is already fixed in final source; existing private metadata-copy reuse is left for source review, not canonised as a new API. Docs formatting/whitespace pass. Current phase: full Section 7 GREEN independent review of all source/test/canonical-doc changes, final executable evidence and prior repairs; no checker/commit yet.

Full Section 7 independent GREEN review is **PASS**, `section7-green-review.md`: all five criteria delivered, all original/residual RED findings and O-01 independently verified closed, no in-scope Critical/Improvement/Nitpick findings. Reviewer reconfirms full backend **201 files/2,826 tests**, synthetic **31 files/371 tests**, all-project types and scoped formatting/lint/whitespace. Full coverage still exits 1 solely on accepted global branch debt **84.29%** versus prior 84.23%/original 83.68%, unchanged 85%; changed validation/mutation statement/function/line coverage is 100%, branches 96.66%/86.36%. Aggregate backend lint remains six unchanged warnings/zero errors. Actual source LOC validation/mutation/facade/transport is 195/147/490/141; new mutation/lifecycle tests 440/366, delegation206, all within 500. Canonical documentation and helper inventories align, with Section 8 adaptation/dispatcher proof and Sections 9–11 companions/hardening/audit still pending (the review's shorthand “only Sections 8/9 remain” does not waive later plan gates). Current phase: stable-identity section-end regression comparison, then normal-hook commit/push; no Section 8 work before those gates complete.

### Section 7 regression blocker and authorised investigation

- Completed final-tree checker: `npm run regression-checker -- abclass-metadata-contract`; original baseline `2026-10-15T20:45:28.439Z` retained. Report `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-17T09-30-32.241Z/comparison.txt`: raw exit 1 / **FAILING**, six of eight checks passing, **one regression, one new failure, six fixes**. Backend lint's six old warnings are accepted debt; the new E2E failure is not.
- Exact fingerprint: `select-with-add-new-workflow.spec.ts` → `SelectWithAddNew Workflow` → `Clicking Add new year group opens Manage Year Groups modal`. First attempt fails the manager-dialog visibility assertion after 14,988 ms; retry 1 passes after 8,980 ms. CLI exit 0 is not clean first-attempt evidence. First-attempt context and passing-retry trace are preserved with hashes under `.opencode/scratchpad/section7-e2e-diagnosis/preserved/`; no failing-attempt screenshot or trace exists.
- Read-only diagnosis (`section7-e2e-diagnosis.md`) and one passing focused probe establish no root cause. User-approved temporary event instrumentation (`section7-e2e-instrumented.md`) passes the affected eight-case spec and six two-worker repetitions, observing successful sentinel/onChange/callback/open-state paths only. Instrumented source/spec/config were restored byte-for-byte. These passes do not clear the gate; timing/resource effects remain hypotheses, and no evidence connects the browser-mocked journey to Section 7 backend changes. The earlier frontend fix was never a proven historical root-cause correction.
- The user explicitly authorises one full browser-suite diagnostic with first-attempt tracing and temporary observation-only instrumentation, and requests Playwright use this orchestrator's model, resolved as `openai/gpt-6.1-sol`. That run is complete, `.opencode/scratchpad/section7-e2e-full-trace.md`: 39 files/303 tests, 302 first-attempt passes/one timeout, one passing retry, zero final failures/skips. All 304 per-attempt traces and machine-readable reports are preserved under `section7-e2e-full-trace/`. The original Year Groups target and all eight workflow cases pass first attempt; this does not establish its historical cause or clear the gate.
- The captured new flake is `assignment-definition-stale-recovery.spec.ts` → `converted in-modal create path: choice, parse, review and auto-assessment`: ordinary assignment selection appears not to take effect, leaving Start Assessment disabled (45,424 ms timeout; 6,285 ms retry pass). Its trace shows document scrolling 181px and popup inset shifting 181px around the click; passing target also scrolls/repositions. This is a concrete alignment/timing lead, **not proof** of a stale coordinate or the historical target's cause. The unrelated failed attempt has no DOM instrumentation, so its exact event target is unknown. Preserve it as unresolved, not accepted debt.
- All temporary frontend source/spec edits are restored byte-for-byte; config unchanged, frontend diff empty, lint/types pass (24 existing warnings/zero errors). Full-suite tracing/target observations ran without the checker's concurrent coverage workload and can alter timing; no controlled resource-causality conclusion follows. MCP trace-viewer browser was unavailable, but saved JSON/DOM streams and selected frames were inspected directly; no visual/zoom gate is claimed. Current authorised continuation is read-only analysis of saved traces and installed app/library source using the same explicit model; no further browser run, production correction, full-checker rerun or gate waiver. No commit/push or Section 8 progression while blocked.

Latest read-only trace/source analysis: `.opencode/scratchpad/section7-popup-race-analysis.md` (explicit model `openai/gpt-6.1-sol`, resumed after one usage-limit failure). Installed runner source and saved action logs show three stability failures advancing the internal action retry to native `scrollIntoView({block:'start'})`; both dropdowns are absolute body portals outside the fixed modal scroll context. This strongly explains document scroll and later popup compensation, **not the missed click**. Failed snapshots bracket the gesture without down/up/click targets; the passing target's measured popup movement occurs after click bubbling, disproving numerical scroll/inset equality as sufficient causal proof. The user now explicitly selects **Capture events (Recommended)** for one bounded diagnostic: the two exact journeys, three repetitions each/two workers, unchanged retries/timeouts, passive window-level gesture/scroll/mutation observations plus actual selection/state boundaries. GPT-6.1 Sol is running that batch and must stop after it regardless of outcome, restoring all temporary observations; expected report `section7-gesture-boundary.md`. No production correction, extra browser batch or checker rerun is authorised. Gate and both flaky findings remain unresolved.

User-approved corrective scope — 18 October 2026: `section7-gesture-boundary.md` captures the SAME Year Groups first-attempt failure with actual event evidence: popup compensates 28px between down/up, up lands on the preceding option, native click lands on their common listbox ancestor, and no selection/sentinel/parent callback fires. Six primary attempts yield five passes/one failure plus one passing retry; all instrumentation is restored byte-for-byte. This establishes the missed-click mechanism for that attempt, not the untraced historical attempts or the older ordinary-selection flake. The user explicitly says **“Please implement that fix”**, authorising a narrow E2E-only popup-readiness correction before normal option clicks, followed by independent review, affected-spec validation and the final regression gate. Preserve production code, assertions, titles/fingerprints, queues/fixtures, retries/timeouts and ordinary pointer/keyboard behaviour; no arbitrary sleeps, force/extra clicks, global animation disable or popup-container product change. Independent RED review **PASS**, `section7-readiness-red-review.md`, after the expired-key invocation was explicitly retried at the user's request. Current phase: Playwright GREEN with requested `openai/gpt-6.1-sol`, scoped to the two affected selection seams and one small E2E helper if required. The review's mistaken BulkCreateModal ownership description is corrected here: ClassesManagementPanel owns manager state; no ownership change is authorised. Backend Section 7 remains reviewed but uncommitted and blocked until corrected combined-tree gates pass.

Readiness GREEN is owner-complete, `section7-readiness-green.md`: one 113-line `waitForSelectPopupReady(option)` E2E utility and two scoped call sites (workflow 311 lines; stale-recovery helper 459) wait for visible/enabled real popup/option, inactive current rc-motion/Web Animations and unchanged popup/row/target geometry over four animation frames under the existing assertion timeout. Normal clicks/actionability, keyboard navigation and every existing assertion/title/queue/fixture are unchanged; production/config and global `selectVisibleOption`/500-line shared helper stay untouched. Both complete affected specs **15/15** and bounded exact-case matrix **6/6** pass first attempt with no retries/flakes; saved traces show all 18 readiness-protected clicks have no stability retries. All-project types, scoped lint, formatting and whitespace pass; aggregate frontend lint retains 24 existing warnings. Two pre-browser implementation lint/type repairs are recorded, with no browser rerun. This is observed removal of the demonstrated timing exposure, not a guarantee or proof of untraced historical causes. Canonical helper documentation is in progress, followed by full independent GREEN review and the required final combined regression gate; no Section 7 completion/commit/push yet.

Readiness canonical documentation is complete, `section7-readiness-docs.md`, registering the helper and exactly two call sites in the frontend Playwright guide without broadening global selection policy. Independent full GREEN review **PASS**, `section7-readiness-green-review.md`: no in-scope findings/nits; helper 113 lines, call sites 311/459 and guide 541 lines, no production/config/fixture/assertion changes. Reviewer reconfirms both full specs **15/15 first-attempt** and still-applicable bounded repeats **6/6 first-attempt**, actual all-project types, scoped lint and frontend lint (24 existing warnings/zero errors), formatting/whitespace. All RED/correction findings closed. Current phase: final combined section-end checker, required after the cause-supported correction and clean reviews; retain original baseline/debt and every first-failure/retry artifact. No Section 7 completion or commit/push before it is baseline-or-better.

Final combined Section 7/readiness regression gate: `npm run regression-checker -- abclass-metadata-contract`, completed with 1,200,000 ms timeout against original baseline `2026-10-15T20:45:28.439Z`. Report `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-18T06-42-38.606Z/comparison.txt`: raw exit 1 / overall **FAILING**, seven of eight checks pass, **zero regressions, zero new failures, six fixes**. Only backend lint's six unchanged accepted max-lines warnings fail. Direct E2E JSON confirms **303 expected, zero flaky/unexpected/skipped**. Backend/frontend/builder tests, frontend/builder lint and all-project types pass; separate explicit backend branch coverage remains accepted 84.29% below unchanged 85% and above original 83.68% (the checker runs backend tests without coverage). Final six-file/111-test backend focused check, owned-file formatting and whitespace pass before the checker. No executable edits occurred during/after it. Earlier failed reports, retries and all diagnostic traces remain preserved; the clean run does not retroactively prove untraced historical causes. Regression gate is satisfied against accepted baseline debt; commit/push next, excluding unrelated user reviewer/configuration changes.

### Section 7/readiness commit and push evidence

- `c8a2caa24ccae0f93355afc9e3b46797e18e4069` — `fix: wait for select popup readiness before E2E clicks` (helper, two call sites and canonical Playwright guidance).
- `8743b4295f4ece85668be07a1a8cbdfcc9648dda` — `feat: support atomic class metadata mutations` (reviewed source/tests and canonical backend/data-shape documentation).
- Branch `docs/abclass-metadata-plan`; both normal pre-commit hooks passed staged formatting/lint and all-project types, with formatter output unchanged. Byte-for-byte comparison of saved reviewed staged patches against actual committed patches confirms no hook-induced or unreviewed change.
- `git push origin docs/abclass-metadata-plan` succeeded, advancing `e285bb5..8743b42` with both commits. Only the plan and unrelated user-owned reviewer/configuration edits remain outside them; the latter are excluded. This separate documentation commit includes reviewed condensation and records delivery; its own SHA/push confirmation belongs in the handoff rather than recursively embedding its hash. No deployment or historical-cause overclaim.

### Completed-history condensation — reviewed

User-requested Docs condensation reduces the plan from 223,088 to 146,659 characters (34.3%) and 25,635 to 16,550 words (35.5%) before the subsequently added diagnostic/delivery records; completed Sections 1–6 are reduced by 49.7% in characters. `.opencode/scratchpad/action-plan-condensation.md` retains the before-copy and preservation matrix. Independent review **PASS**, `.opencode/scratchpad/action-plan-condensation-review.md`: all headings, immutable scope/constraints/budgets and then-current Sections 7–11 are preserved, with final reviews/checker outcomes, authorisations, baseline/debt and recorded commit/push evidence retained. Later orchestration records above document the actual failure, approved correction and clean final gate; condensation itself is not gate evidence. This plan-only commit records the now-delivered Section 7 and correction alongside that reviewed condensation.

## Section 8 — Transport error adaptation and real-dispatcher contracts

### Objective

Expose the agreed read/write behaviour through existing transport envelopes without widening the dispatcher or misclassifying internal failures.

### Constraints and mandatory reads

All section agents: common reads plus @src/backend/z_Api/abclass/abclassMutations.js, @src/backend/z_Api/abclass/abclassValidation.js, @src/backend/z_Api/abclass/abclassRead.js, @src/backend/z_Api/z_apiHandler.js, @tests/helpers/apiHandlerTestUtils.js and @docs/developer/data-shapes/transport-envelope.md.

- Share a narrow trailing-underscore error adapter within the ABClass mutation transport domain: translate only `ABClassMetadataValidationError` with `inputSource: 'request'` into `ApiValidationError`, preserving its path-bearing message. Rethrow every other exception unchanged.
- Do not reproduce nested metadata rules in transport validators, add error payload fields, alter the dispatcher/allowlist/auth/tracking, or add metadata to deletion results.
- Real-dispatcher tests must install the real ABClass handlers **and controller** with only external DB/Classroom/auth/tracking seams mocked. The existing synthetic bridge returns prebuilt transport data and is useful for consumer compatibility, but is not proof of real mutation/controller validation.
- `setupApiHandlerTestContext`/the default shared dispatcher setup unconditionally stub both the controller and transport helpers. After using that setup for external seams, restore the **real** `ABClassController` global and the real exports of `abclassMutations.js` and `abclassRead.js` onto `globalThis` before invoking the real dispatcher, following `dispatcher-integration.test.js`'s real-handler installation pattern. Assert the real domain/controller path was exercised and restore every overridden global afterwards. Do not mistake the default harness or synthetic bridge for that path; no broad shared-harness refactor is needed.
- The bootstrap supplies real controller sub-classes and `Assignment`, but not the `ABClassController`, `ABClass` or `Teacher` globals: require their real modules and install them explicitly, retaining the real `Assignment` and Section 1 metadata/error globals. Only DbManager/Classroom/auth/tracking are mocked. Budget the richer model wiring rather than copy only the precedent's single-handler stub, and restore all replaced model/facade/handler globals.

### Shared-helper / data-shape plan

**New/keep local:** one narrow private transport error adaptation helper in `abclassMutations.js`, reused by upsert/update; **reuse:** `ApiValidationError`, request-structure validators, normal dispatcher mapping and global-mock restoration helpers. Reference `api-layer.md` **Planned ABClass metadata helpers** (`Not implemented` until delivered). Data target: `abclass.md` **Planned transport / Planned provenance and error rules**; envelope itself is unchanged, so do not introduce a planned envelope-shape change.

### Canonical-fixture note

Use cloned `small` raw class/partial/definition/assignment views via the backend adapter and `medium` replacement metadata. Keep local auth, request-store, Classroom and DB mocks; derive invalid persisted/request probes from these inputs. Retain existing synthetic consumer tests unchanged.

### Acceptance criteria and required tests (Red first)

1. Direct transport tests verify metadata omission/null/object forwarding intact and only typed request-originated failures become `ApiValidationError`; integrity errors, untagged/same-message errors, persistence/upstream/wiring exceptions propagate unchanged.
2. Real `apiHandler` success envelopes for list/full/upsert/update include exact raw metadata; top-level missing-class null, empty list and unchanged deletion flags remain correct. Assert plain JSON-safe output, including timestamps as strings.
3. Invalid request metadata produces `INVALID_REQUEST`, `isRetriable: false`, an actionable field path in `error.message`, and no new `fieldName`/`details` fields. Stored full/partial corruption and internal mutable/projection failures produce existing generic `INTERNAL_ERROR`, not caller validation errors.
4. Stored-corruption tests cover valid replacement and null requests; rejected mixed patches have no side effects. Dispatcher paths do not bypass the domain/controller with hand-shaped success data.
5. Auth denial, request IDs, admission/completion records, allowlisted delegation and failure diagnostics retain existing behaviour. Existing global-exposure tests see no new public top-level functions; canonical private helpers use trailing underscores.

### Red → Green → Refactor and section checks

Add `tests/api/abclassMetadataApi.test.js` for wrappers and focused companions under `tests/api/apiHandler/` for real read/write and error envelopes. Keep each suite below 500 lines; do not grow the 630-line shared dispatcher harness or concentrate new scenarios in existing near-limit suites. Implement only the transport adapter; refactor duplicate catches into it without broad exception handling.

- `npm run test:backend -- tests/api/abclassMetadataApi.test.js tests/api/apiHandler/abclassMetadata tests/api/abclassMutations.test.js tests/api/abclassRead.test.js tests/backend-api/abclassMutations.unit.test.js tests/backend-api/abclassValidation.unit.test.js tests/api/apiHandler/globalExposure.test.js`; `npm run lint:backend:check`. Name the new dispatcher companion files with the `abclassMetadata` prefix so this filter runs them all.
- No dispatcher production diff is expected. Verify unchanged envelope keys/auth/tracking; reconcile API/helper docs, obtain clean review and record regression comparison.

### JSDoc follow-through and delivery record

Explain the typed request-provenance-only catch and intentional internal-error propagation. RED started after explicit continuation: milestone A covers direct wrappers plus the real-dispatcher harness/read/write success paths; milestone B covers real request/integrity/internal failures, no-side-effect rejection and auth/tracking diagnostics. Use coherent ≤500-line suites/local support only if necessary, real model/controller/transport globals with exact restoration and canonical non-empty inputs. Full RED independent review follows both milestones; no source implementation or checker between phases.

Milestone A is owner-complete pending full RED review, `.opencode/scratchpad/section8-red-a.md`: four files (direct wrapper 99, dispatcher reads 68, writes 92, local real-path context 94 lines), 107 focused tests/105 passing/two intentional request-error adaptation reds. Read/write dispatcher pair is 9/9 passing through real handlers/controller/models and external-only seams; types, scoped lint, formatting and whitespace pass. Aggregate backend lint retains six accepted warnings. Initial missing DB-drop seam and canonical required-configuration selection were test-construction repairs, now closed by the owner; no runtime change. Milestone B now closes real request/integrity/internal error mapping, atomic rejection and auth/tracking/logging coverage before independent full RED sign-off.

Milestone B is owner-complete pending full independent RED review, `.opencode/scratchpad/section8-red-b.md`: five files (direct wrappers 112, reads 68, writes 92, errors/security 364, context 104 lines), complete focused selection **121 tests/115 passes/six intentional assertion reds** (two wrapper adaptations plus four dispatcher request-code expectations). Stored/internal failures, mixed-patch atomicity, real domain call-through, auth denial, tracking and real logger output characterisations pass. New test construction refinements are recorded, not product fixes. Scoped lint/format/whitespace and all-project types are reported passing; reviewer must clarify the report's final-tree typecheck wording. Aggregate backend lint remains only six accepted warnings. Current phase: full Section 8 RED independent review; production, fixture/config/baseline, dispatcher and common harness remain unchanged.

Full RED review **FAIL**, `section8-red-review.md`: all five criteria and the exact six intentional reds are confirmed; reviewer reran actual all-project types on the final tree (PASS), resolving B's wording ambiguity. Sole finding **S8-R1 OPEN**, Testing Specialist: new local context has function-parameter defaults and implicit registry-row fallback outside a constructor. Chosen resolution is required, explicitly supplied collection rows/options/class selection at every caller, also removing the same helper's implicit canonical-class fallback; do not move defaults into a function body or invent a constructor framework. Preserve every assertion, canonical non-empty population, stored `_id` and real-path/restoration contract. Revalidate then return the full section to independent RED review before production implementation.

RED repair and full independent sign-off **PASS**, `section8-red-repair.md` / `section8-red-signoff.md`: S8-R1 CLOSED; all five acceptance criteria verified, **121 tests/115 passing characterisations/six inventoried adapter reds**, with sound setup/fixtures/matchers/types/lint and no extra failure. Required explicit context inputs preserve canonical populations and empty/corrupt registry probes; no production change or harness refactor. Current phase: GREEN narrow trailing-underscore adapter shared by upsert/update only, preserving error identity except typed request-provenance translation and retaining dispatcher/envelope/auth/tracking/deletion behaviour. Canonical Data Shapes/Docs reconciliation and full independent GREEN review follow owner validation; checker remains section-end only.

GREEN is owner-complete pending documentation/review, `section8-green.md`: only `abclassMutations.js` changes (174 lines), adding private `adaptMetadataRequestError_` shared by upsert/update. It logs raw failures with method/class context, converts only typed request-provenance metadata failures to `ApiValidationError` with the same path-bearing message, and rethrows other objects unchanged; original parameters and dispatcher remain untouched. All **121 focused and 2,860 full backend tests pass**. Full coverage exits 1 solely on accepted global branch debt **84.31%**, above prior 84.29%/original 83.68%, unchanged 85% threshold; changed owner coverage is 100/95.65/100/100%. Actual all-project types, scoped lint, formatting and whitespace pass; aggregate backend lint remains six accepted warnings/zero errors. Data Shapes owns `abclass.md`, Docs owns API/testing guides concurrently with disjoint edits; independent full GREEN review follows their reconciliation. No checker or commit yet.

Full independent GREEN review **PASS**, `section8-green-review.md`, with no findings/nits and S8-R1 retained CLOSED. `section8-data-shapes.md` and `section8-docs.md` reconcile all delivered transport/error/helper/test contracts in the three canonical guides; Section 9 companions and Section 10 ordering probes remain honestly pending. All five criteria, real-controller/dispatcher paths, original exception identity, private helper exposure, atomicity, privacy, auth/tracking/logging and exact fixture/global restoration are verified. Reviewer reconfirms **121/121 focused tests**, all-project types, scoped lint/format/whitespace; aggregate lint is baseline-only. Current phase: stable-identity final section regression comparison, then hook-respecting commit/push and delivery record before Section 9.

Section 8 completed regression comparison is **BLOCKED**: `npm run regression-checker -- abclass-metadata-contract`, 1,200,000 ms timeout, report `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-18T08-14-46.608Z/comparison.txt`. Original baseline unchanged; raw exit 1 / overall FAILING, six/eight checks pass, **one regression, one new failure, six fixes**. Exact new fingerprint: `classes-crud-bulk-progress.spec.ts` → `bulk progress modal` → `bulk create shows progress modal with correct initial count`; frontend E2E CLI exit 0 is not clean first-attempt evidence. All other non-lint checks pass; six old backend max-lines warnings remain accepted debt only. Read-only Playwright diagnosis/preservation is delegated to `.opencode/scratchpad/section8-e2e-diagnosis.md`; determine actual assertion/attempt/artifacts before proposing next steps. Do not assume the prior two-seam readiness correction explains this different test, rerun to hunt a pass, extend frontend scope, waive failure or commit/proceed before clarification/resolution.

Read-only diagnosis complete, `section8-e2e-diagnosis.md`: full browser suite **302 first-attempt passes, one failure, one passing retry**. Failure precedes progress assertions: Create ABClass stays open with missing Cohort selection and “Please select a cohort.” The earlier option click was attempted but its actual events/value commit/reset are unrecorded; precise mechanism is unproven. Passing retry confirms progress only for that retry. All 14 available artifacts are copied with verified hashes under `section8-e2e-diagnosis/preserved/`; no failed-attempt trace/screenshot exists. This local runtime-mocked journey does not invoke the changed backend adapter; source separation does not establish a timing cause. No tracked edits or browser/checker rerun. Stop for user authorisation of one bounded three-primary-repetition/two-worker diagnostic of this exact test with first-attempt traces and passive pointer/selection/Form observations, unchanged retries/timeouts, full artifact preservation and byte-identical restoration. Do not extend readiness or confirmation helpers without evidence/authority; gate remains blocked.

User explicitly selected **Capture events (Recommended)** via the question tool. Authorised diagnostic is now delegated to Playwright with requested `openai/gpt-6.1-sol`: exactly this one test, three primary repetitions/two workers, configured retries/timeouts unchanged, passive gesture and real selection/Form value observations, first-attempt traces/all-attempt preservation and byte-for-byte restoration. Expected report `section8-gesture-boundary.md`. Stop after that batch regardless of outcome; no permanent correction, second browser batch, full checker retry or gate waiver is authorised by this choice.

Authorised diagnostic complete, `section8-gesture-boundary.md`: **two primary passes, one primary timeout, one passing configured retry**. The same journey loses **Year group**, not Cohort: trusted down targets the same connected Year 11 option at y283, the row moves +25px before up (root scroll unchanged), up hits the underlying Select and native click hits BODY; no Year group callback/Form commit follows. Cohort commits and stays selected, so historical missing-Cohort mechanism remains unproven. Four traces/screenshots/journals and actual failed-attempt target/geometry evidence are preserved; popup inset/native-call stack limits and instrumentation timing effects are explicit. All temporary edits restored byte-identically; scoped lint/all-project types pass. Independent read-only RED evidence review is next (`section8-readiness-red-review.md`), then ask user for any local readiness reuse at this spec's two option seams. No permanent fix or additional browser/checker run authorised; Section 8 remains blocked/uncommitted.

Independent readiness RED review **PASS**, `section8-readiness-red-review.md`, no in-scope findings. Factual terminology clarification: captured native click hits **BODY**, the common ancestor of portal-popup/Select branches, not a listbox (the review's two loose descriptions are superseded here). Only Year group has direct current missed-gesture evidence; historical Cohort mechanism remains unproven. User explicitly selected **Fix both seams (Recommended)**, authorising existing-helper reuse before the two local option clicks in `startBulkCreateWithDeferredUpserts`, complete-spec/bounded-repeat validation, independent GREEN review and final combined checker. Cohort inclusion is precautionary, not retrospective causal proof. Playwright GREEN (`openai/gpt-6.1-sol`) is active; production, assertions/titles, fixtures/queues, helper algorithm, global/shared selection and confirmation retries/configuration remain unchanged. No Section 9 or commit until gates pass.

Readiness GREEN is owner-complete, `section8-readiness-green.md`: only the bulk-progress spec grows **406→409 lines** (one import, two local waits using the unchanged 113-line helper); stripping those lines restores every original action/assertion byte. Complete six-case spec **6/6** and bounded exact initial-count repeats **3/3** pass first attempt, zero retries/flakes; nine traces retained, all 14 protected clicks wait through motion then show zero stability retries. Actual all-project types, scoped frontend lint, formatting/whitespace pass. Production/configuration, 500-line shared module, confirmation scaffold, fixtures/queues and existing helper callers stay byte-identical. Canonical guide reconciliation `section8-readiness-docs.md` registers this third caller and preserves prior owners without widening policy or claiming the historical Cohort cause. Independent full GREEN review is active; final combined regression gate/commit/push remain required.

Independent readiness GREEN review **PASS**, `section8-readiness-green-review.md`, no findings/nits: minimal authorised two-seam change, unchanged original actions/assertions/config/production, complete **6/6** and repeat **3/3** first-attempt evidence, helper/third-caller register, scoped lint/all-project types and formatting/whitespace are verified. Both Section 8 workstreams now have clean RED/GREEN reviews and same-change documentation. Run the explicitly authorised final combined stable-identity checker next; retained first failures and Cohort causal uncertainty remain recorded, not retrospectively erased.

### Section 8 final regression and delivery gate

- Final combined comparison `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-18T10-17-33.136Z/comparison.txt`, command `npm run regression-checker -- abclass-metadata-contract` with 1,200,000 ms timeout. Original baseline `2026-10-15T20:45:28.439Z` unchanged; no executable edits during/after the check.
- Raw exit 1 / overall FAILING, seven/eight checks pass, **zero regressions, zero new failures, six fixes**. Only six accepted backend max-lines warnings remain. E2E raw JSON confirms **303 expected, zero flaky/unexpected/skipped**. Backend/frontend/builder tests, frontend/builder lint and all-project types pass. Explicit backend coverage remains separately recorded at 84.31% branches versus unchanged 85%; the checker runs backend tests without coverage.
- Earlier failed checker/diagnostic attempts and the precautionary Cohort qualification remain preserved. Both clean RED/GREEN review loops and same-change canonical docs are complete; regression gate is satisfied against accepted baseline debt, not an aggregate-clean claim. Commit/push next; unrelated user reviewer/configuration edits excluded.

### Section 8 commit/push evidence

- `a87605b580d2fd9391e5bd3ab387f0e2868c20db` — `fix: await popup readiness in bulk progress E2E setup`.
- `423abecf199c4ae4ad07262140edd75cea576bc2` — `feat: adapt class metadata request errors at transport boundary`.
- Branch `docs/abclass-metadata-plan`; both normal hooks passed unchanged staged formatting, applicable staged lint and all-project types. Saved reviewed staged and committed patches match byte-for-byte; no hook bypass or unreviewed fix.
- `git push origin docs/abclass-metadata-plan` succeeded, advancing `4ea22f7..423abec` with both commits. User reviewer/configuration edits remain excluded. This separate plan-only commit records completed gates before Section 9; its SHA/push confirmation is recorded in the handoff rather than recursively embedding its hash. No deployment.

## Section 9 — Approved Teacher output correction and factual documentation

### Objective

Resolve the single genuine Teacher conditional-output discrepancy and correct the two documented facts, without changing the four intentional contracts or deletion behaviour.

### Constraints and delegation mandatory reads

All section agents: common reads plus @src/backend/Models/Teacher.js, @src/backend/Models/ABClass.js, @src/backend/Utils/00_ArrayUtils.js, @tests/models/teacher.test.js, @tests/models/teacherStudentSubmissionCoverage.test.js and @scripts/synthetic-test-data/toBackendModelInputs.js. This section depends on the adapter delivered in Section 2. `Docs`/`Data Shapes Agent` also receive the spec's approved companion addendum and the exact implemented Teacher/collection/delete passages in both canonical contract/API docs.

- `Teacher.toJSON()` emits `teacherName: this.teacherName` for valid Teacher instances, using the constructor's existing null state. Do not add a serialisation-time default or change construction, setters, `fromJSON()` or accepted legacy input.
- This affects every real Teacher-serialiser use, including normal new writes and refreshed rosters. Legacy plain-object teacher-array entries remain plain and pass through unchanged; do not add array hydration, raw-registry rewrites or eager migration.
- No frontend source/schema/test changes. Optional/nullable schemas remain intentionally compatible with both legacy absence and explicit null.
- Do not fix deletion flags. Document that a non-throwing vendor false drop currently still yields `hasDeletedFullClass: true`; a normal repeated delete therefore reports true for that flag. Its fix and vendor-faithful regression coverage are explicitly deferred by the user to [issue #332](https://github.com/h-arnold/AssessmentBot/issues/332).

### Shared-helper plan

**Extend** the existing `Teacher.toJSON()` contract; **reuse** its constructor-null state, `Teacher.fromJSON()`, `ABClass.serialiseOwner()`, `ArrayUtils.serialiseArray()` and `loadBackendModelInputs()`. No new helper is needed. Canonical planned target: `abclass.md` **Planned companion cleanup — Teacher serialisation and documentation corrections**, marked `Not implemented`; API-doc companion reconciliation is recorded under **Planned ABClass metadata helpers**.

### Data-shape plan

Teacher-instance output gains always-present nullable `teacherName` in existing serialisation/persistence/transport uses. Frontend schemas, legacy input acceptance, plain-object pass-through and deletion behaviour are unchanged. Reconcile the implemented Teacher field table/key notes, remove the resolved fragile Teacher entry (currently known discrepancy 1) and renumber the four unchanged intentional entries. Correct the per-class collection header/heading and every inaccurate delete error/flag/idempotency statement in `abclass.md`, plus the corresponding `api-layer.md` idempotency note; preserve the recorded quirk and issue link rather than claim the future fix is implemented.

### Canonical-fixture note

For named Teacher unit cases call `loadSyntheticAnalysisProfile('small', 'classPartials')` (frozen array). For ABClass cases use `loadBackendModelInputs('small').classesById[classId]`, originating from the frozen `classesById` keyed view and adapted definitions. Clone before boundary mutations. Explicitly materialise canonical teacher-array inputs with `Teacher.fromJSON()` when composing an ABClass case that must exercise the real serialiser; `ABClass.fromJSON()` does not itself hydrate plain teacher-array entries. Null/missing-name cases remain local clones; no generator stage/profile/view extension or additional fixture regeneration is needed for this cleanup. Migrate only touched named-Teacher cases, not untouched Student/Submission tests.

### Acceptance criteria and required tests (Red first)

1. Flip the existing nameless round-trip equality and explicit omission assertions in `teacher.test.js`, and the nameless `toJSON()` equality in `teacherStudentSubmissionCoverage.test.js`, to require an **own** `teacherName: null`. These red failures express the approved correction, not regressions to mask.
2. Named output stays exact; constructor-unset, explicitly null and cleared-name instances emit null. Legacy JSON with the name key removed restores via the unchanged constructor default and then emits null; named/null round trips preserve values. Email/userId behaviour is unchanged.
3. Real ABClass owner and Teacher-instance array serialisation through both full/partial helpers emits the property with null when unnamed. Existing plain-object legacy teacher rows may still omit it; prove the cleanup does not coerce them or trigger writes/backfill.
4. Normal refreshed/written Teacher instances carry explicit null where appropriate, without touching metadata values, roster `$set` field sets or write order. Compatibility is grounded in both unchanged Teacher schemas' nullable/optional acceptance plus the backend output assertions; unchanged frontend specs provide regression context, not a live backend-output round trip.
5. Documentation accurately describes per-class collections; absent deletion is successful; the actual full-drop flag quirk is retained and issue #332 is linked. Other four known-discrepancy contracts remain unchanged.

### Red → Green → Refactor and section checks

Update the three old expectations and add focused null/legacy/ABClass serialisation cases first. Change only the Teacher output field and its JSDoc; reuse real serialisation helpers. Reconcile the specific contract/API prose with `Data Shapes Agent`/`Docs`, then review the bounded diff. Do not add deletion-fix assertions expecting a false flag on the vendor false-return path in this cycle.

- `npm run test:backend -- tests/models/teacher.test.js tests/models/teacherStudentSubmissionCoverage.test.js tests/models/abclassTeacherSerialisation.test.js tests/models/abclass tests/controllers/abclass-delete.test.js`.
- `npm run test:frontend -- src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts src/services/googleClassrooms/classPartialsService.spec.ts` (unchanged-consumer regression smoke only, not proof of the backend serialiser change); `npm run lint:backend:check` against the recorded baseline.
- Verify actual LOC, unchanged frontend/deletion source, reconciled Teacher table/key notes/discrepancy and both collection/deletion-doc corrections. Obtain clean code review and record regression comparison.

### JSDoc follow-through and delivery record

Add a `Teacher.toJSON()` remark stating own-property output and constructor-null semantics; do not weaken existing documentation. Not started; record red/green evidence, actual counts, doc reconciliation and reviewer/checker outcome during delivery.

## Section 10 — Regression and contract hardening

### Objective

Prove the complete lifecycle and canonical fixture contracts hold together, including runtime wiring and unchanged consumers.

### Constraints and delegation mandatory reads

All test/implementation/review agents: common reads plus all changed suites, @tests/setupGlobals.js, @docs/developer/builder/builder-script.md and @docs/developer/data-shapes/transport-envelope.md. Prefer focused checks before aggregate gates; add no speculative features, test-only production code or configuration relaxations.

### Shared-helper / data-shape / canonical-fixture note

No new helper or contract is planned; reuse the delivered owners/adapter. Use `small` raw class/assignment views, `medium` variants and `large-representative` parity/coverage; full-large remains on-demand. Invalid/equal-timestamp/legacy/I/O probes remain local clones/mocks. No new frontend tests or source changes; run existing consumers.

### Acceptance criteria and required tests (Red first)

1. End-to-end backend lifecycle: supplied snapshot → successful upsert → unrelated update → roster refresh → assignment persistence → list/full reads → explicit replacement/null → delete. Assert no unintended score/timestamp changes and the roster-vs-whole-save partial semantics at each boundary.
2. Cross-boundary integrity tests prove mutable invalid state cannot escape serialisation/projection or cause avoidable split-store writes, while existing-row roster patches remain independent of stored partial metadata. Request and stored-data error provenance stay distinct through real dispatch.
3. New files load in GAS-style order; ordinary direct-import tests pass under `setupGlobals`; no top-level forward-reference failure, duplicate protected global or exposed helper. Local production build contains the new domain/error/sub-class files.
4. Compact raw metadata, relational linkage, exact source timestamps, deterministic variants and regeneration are independently checked. All existing synthetic frontend/service/analysis consumers remain green unchanged.
5. Changed files have zero lint diagnostics; full lint is compared with the explicitly recorded pre-existing baseline. Coverage, all TypeScript projects and production bundle build pass (or pre-existing baseline failures are reported without scope expansion), with no new regression-checker failures and no weakened gates. Never call the aggregate gate green while untouched baseline warnings still fail it.

### Red → Green → Refactor

Before closing any uncovered scenario, add a failing focused contract assertion to the appropriate new suite, apply a minimal fix through the implementation/review loop, then remove duplicate coverage/setup only if equivalent assertions remain. Do not manufacture new behaviour to produce a red result for already covered scenarios.

### Section checks

- `npm run test:backend`; `npm run test:synthetic`; `npm run lint:backend:check`; `npm run lint:synthetic:check`.
- `npm run fixtures:synthetic` followed by `syntheticCommittedFixtureRegeneration.test.ts`; a second regeneration must produce no additional diff. Changes relative to baseline remain limited to intended generated class views.
- `npm run test:synthetic:stress` (Section 2's recorded full run can be reused if no generator/validation change followed); full output remains ignored.
- `npm run run-all-checks` (includes unchanged frontend tests, coverage, type checks and production build); existing global-exposure/load-order coverage; final stable-identity regression comparison with a 20-minute timeout.
- If the recorded lint baseline blocks the aggregate before downstream commands, separately run `npm run test:coverage`, `npm run typecheck:all` and `npm run build:production` and record each real result; do not change warnings/configuration or bypass hooks.
- Inspect `git diff --check`, actual LOC/separation, generated changes and review outcome. Record infrastructure failures explicitly rather than claim unrun checks passed; do not expand into unrelated fixes without authorisation.

### JSDoc follow-through and delivery record

Capture any newly discovered non-obvious boundary interaction in its owner, not solely in this disposable plan. Not started; record commands/results and final reviewer/checker report during delivery.

## Section 11 — Documentation and delivery handoff

### Objective

Finish reconciliation of the planned-only records with the delivered behaviour and leave an accurate, non-deployed implementation handoff.

### Constraints and delegation mandatory reads

`Docs`, `Data Shapes Agent` and `Code Reviewer`: @docs/plans/SPEC.md, @docs/developer/data-shapes/abclass.md, @docs/developer/backend/api-layer.md, @docs/developer/backend/backend-testing.md, @docs/developer/testing/synthetic-test-data.md and all changed owner JSDoc. Preserve the spec's reviewed metadata decisions and user-approved companion addendum/deferral. Reconciliation already accompanies Sections 1–9 before their review sign-offs; this section is an audit, not permission to postpone those updates.

### Shared-helper / data-shape / canonical-fixture note

Reconcile the existing four planned records, remove `Not implemented` only for delivered behaviour and retain pending markers honestly if delivery stops. Do not create a new canonical contract or fixture source. No new runtime tests/fixtures are required for prose-only changes.

### Acceptance criteria and required checks (Red first)

1. **Red:** compare every planned entry and touched JSDoc with actual tested code; record mismatches or stale implemented prose before editing. **Green:** `Data Shapes Agent` reconciles `abclass.md`; `Docs` reconciles API/testing/synthetic helper records and behavioural guidance. **Refactor:** remove superseded duplicate planned text only when the canonical implemented contract fully replaces it, then independently review.
2. Explain optional-write versus always-present nullable-read metadata; omission/null/replacement; field-scoped roster patches and complete missing-row creation; full-first/non-transactional failures; snapshot staleness; compact literal `excluded`; no corrupt-data API repair path.
3. In the implemented `getABClassPartials` key notes, replace “timestamps are not part of the partial shape” with the distinction that metadata timestamps are validated strings, not live Dates, so no extra deep Date conversion is needed. Preserve full-read date conversion for other fields.
4. In touched prose call `cohortKey`, `yearGroupKey` and `courseLength` configuration/reference fields; distinguish assessment-summary metadata from task-artifact metadata. Update facade/helper file indices and test/bootstrap/adapter/profiles guidance to actual paths.
5. Audit the Teacher field-table/key-note/discrepancy reconciliation and every implemented collection/deletion statement, including the API-layer idempotency note. Keep the actual deletion-flag quirk explicit and linked to issue #332, not described as already fixed.
6. Hand off changed files, all section records, real checks/coverage/regression results and remaining operational caveats. There are no open contract questions. The sole deliberate deferral is the deletion-flag fix explicitly authorised via the question tool and tracked in issue #332. No migration, deployment or commits occur without separate authorisation.

### Section checks

- Inspect the four canonical docs and owner JSDoc against each tested acceptance criterion; verify links/file indices and no delivered helper is still incorrectly labelled pending.
- `npx prettier --check ACTION_PLAN.md docs/plans/SPEC.md docs/developer/data-shapes/abclass.md docs/developer/backend/api-layer.md docs/developer/backend/backend-testing.md docs/developer/testing/synthetic-test-data.md`; `git diff --check`.
- Obtain final clean review; record whether all mandatory delivery gates actually ran. Planning completion alone does not claim implementation readiness has been verified by running tests.

### Delivery record

Not started. Record reconciled documentation, reviewer outcome and implementation handoff here during delivery.

## Suggested implementation order

Execute Sections 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11, with a clean implementation/review cycle and same-change documentation for each section. The early fixture extension enables canonical data for downstream tests; model/domain support precedes persistence and orchestration; request provenance precedes transport adaptation; the Teacher cleanup uses the already delivered adapter. Do not begin production implementation under this planning request. Issue #332 is a separately authorised future implementation round, not a section to implement here.
