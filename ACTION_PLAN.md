# ABClass Metadata Contract Support — Delivery Plan (TDD-First)

## Status and read-first context

Planning complete with independent clean review. No production implementation, fixture regeneration or deployment has been performed. The user subsequently authorised committing and pushing these completed planning artefacts only; implementation remains a separate request.

### Implementation start-up — 15 October 2026

- The user requested implementation of this plan. The worktree was clean at start-up on branch `docs/abclass-metadata-plan`, HEAD `6fc46be`.
- Current section: Section 1, commit/push gate. Red and green reviews are clean; section-end checker reports zero regressions and zero new failures.
- Baseline command: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms timeout). Baseline created at `2026-10-15T20:45:28.439Z`; exit 1, overall `FAILING`, seven of eight checks passing, zero regressions and zero new failures. Backend lint reports zero errors and the ten pre-existing max-lines warnings documented below; these remain recorded baseline technical debt, not a clean aggregate gate. Backend tests, frontend/builder coverage, frontend E2E, frontend/builder lint and TypeScript checks passed. Correction after inspecting the saved manifest: despite its `backend-test-coverage-check` name, the checker runs `test:backend` without coverage, so this baseline did not establish backend coverage thresholds.
- Baseline report: `.ts-regression-checker/reports/session-abclass-metadata-contract/baseline/baseline.txt`. Retain the same checker identity throughout delivery.
- Commit authority resolved on 16 October 2026: the user explicitly authorised commits and pushes as part of delivery. This supersedes this plan's historical implementation-commit exclusion; retain all hook/review/regression gates and the deployment exclusion. No commits, pushes or deployment have occurred during implementation start-up.
- Regression frequency override on 16 October 2026: the user explicitly requested running the regression checker only at the end of each full section, not between red/green/refactor phases. Use focused tests between phases, preserving independent review and end-of-section regression gates. The already-started post-red run remains backgrounded (`sh_1432453be001HfM8WST1q4r2oO`); continue delivery without waiting or polling, and do not treat an in-flight or mixed-phase result as section-completion evidence.
- At the user's request, Docs reconciled `.opencode/agents/action-plan-implementer.md` and `.opencode/skills/regression-checker/SKILL.md` with that cadence, preserving the initial baseline and section-end gates. Independent review initially found I1 (final post-cleanup failure gate insufficiently explicit); Docs added the blocking readiness/documentation-commit requirement and matching skill guidance. Re-review is clean, all instruction findings closed: `.opencode/scratchpad/regression-cadence-signoff.md`. Both files pass Prettier and scoped whitespace checks. These are authorised delivery-instruction changes, distinct from the excluded user-owned reviewer configuration edits; not a Section 1 runtime sign-off.

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

These eight `max-lines` warnings are existing out-of-scope conditions, not new feature deferrals: `tests/api/apiHandler/shared.js` (630), `tests/assignment/assignmentFactory.test.js` (519), `tests/backend-api/assignmentDefinitionPartials.unit.test.js` (2776), `tests/controllers/assignmentController.hydration.test.js` (653), `tests/controllers/referenceDataController.test.js` (727), `tests/dbManager/dbManager.test.js` (665), `tests/googleClassroom/classroomApiClient.test.js` (550) and `tests/utils/batchUpdateUtility.test.js` (615). Do not touch them merely to clear the full lint command. Expect the baseline to shrink from 10 to 8 as the two in-scope splits land; report any remaining aggregate failure honestly.

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

Red tests added on 16 October 2026; production implementation not started. Testing Specialist added `tests/utils/validateCanonicalUtcDateTime.test.js` (37 lines), `tests/utils/errorTypes/ABClassMetadataValidationError.test.js` (28), `tests/models/abclassMetadataValidation.test.js` (169) and `tests/models/abclassMetadataBoundary.test.js` (121), totalling 355 lines. The specialist reports coverage of all six acceptance criteria and a collected focused run of 62 tests: 60 intentional missing-capability assertion failures and two passes. Scoped lint, Prettier and diff whitespace checks passed; full backend lint retained the ten documented warnings with zero errors. This is preliminary red evidence, not reviewed sign-off.

The initial reviewer spawn failed because its configured model was unavailable. After the user's retry request, independent red review ran successfully and returned nine in-scope findings, not clean sign-off. Full cumulative ledger and evidence: `.opencode/scratchpad/section1-red-review.md`. R1 (incorrect validator table), R2 (VM lexical binding), R3 (forward-reference/bootstrap coverage), R4 (direct/exact-record matrix), R5 (timestamp edges/domain enforcement), R6 (recent-array invariants), R7 (copy isolation), R8 (typed domain failures) and R9 (actual legacy predicate preservation) are open, owned by Testing Specialist. Chosen resolution: implement each review's explicit minimal test correction; do not alter production to accommodate defective tests. First repair batch: R1/R2/R3/R9; second: R4/R5/R6/R8; final ownership repair: R7. Return full section for re-review after repairs. The reviewer confirmed collection is sound and full backend coverage run had 60 intentional failures in new suites, with 178 existing suites passing; no coverage threshold sign-off was emitted during red.

User-owned reviewer configuration edits in `.opencode/agents/code-reviewer.md` and `opencode.jsonc` appeared during capability restoration. Do not modify, stage or include them in feature commits. The post-red regression gate awaits clean red review; the start-up baseline remains the latest checker report. No production edits, commits or pushes have occurred.

Red repairs completed in three batches: R1/R2/R3/R9, then R4/R5/R6/R8, then R7 plus serialisation-corruption typing. All nine findings are addressed pending independent re-review. Added `tests/models/abclassMetadataTimestampAndOrdering.test.js`; current suite LOC are Boundary 191, TimestampAndOrdering 200, Validation 412, timestamp utility 42 and error type 28 (873 total). Latest focused run collected 103 tests: 102 expected missing-capability failures and one passing legacy-predicate preservation test, with no collection errors. Scoped lint/Prettier/diff checks passed; last full backend lint still reports only the ten baseline warnings. Detailed second-batch matrix/evidence: `.opencode/scratchpad/section1-red-repair-batch2-evidence.md`. No findings may be closed until re-review verifies all repairs.

First re-review (`.opencode/scratchpad/section1-red-rereview.md`) closed R2/R7/R9, retaining R1/R3/R4/R5/R6/R8 and adding duplicate-loop N1. Two further repair batches corrected context/casing/prototype precedence, local ABClass import, year-zero leap-day acceptance and direct-entry context; completed per-record/per-metric matrices; switched no-repair snapshots to structural clones; pinned serialisation path/message/provenance; and removed the duplicate loop. Added `tests/models/abclassMetadataRecordBoundaries.test.js` as a coherent companion to keep suites below 450 lines. Final repair evidence and full coverage/LOC matrix: `.opencode/scratchpad/section1-red-repair-final.md`. Six suites total 962 lines; 107 tests collect, 106 expected missing-capability failures and one preservation pass. No new lint diagnostics. Remaining findings are repaired pending second re-review, not yet signed off.

Second re-review found only R4's missing matrices had been lost during the split; these were restored additively in RecordBoundaries (216 lines). Independent final red review is clean: `.opencode/scratchpad/section1-red-signoff.md`, all R1–R9 and N1 closed, all six acceptance criteria covered. Current total 1,046 test lines across six suites, maximum 366. Full backend red evidence: 184 suites, 178 legacy suites passing; 110 new tests collect, 109 intentional assertion failures due to missing domain/error/predicate/bootstrap capability and one passing legacy ISO predicate test. These intentional red failures are acceptance work, not accepted technical debt; collection and new-file lint remain sound. No intentional type errors. Phase advanced to green implementation under the user's section-end-only regression override.

Green implementation checkpoint: domain (257 lines), typed error (21), Validate (358) and bootstrap (436) implemented; focused six suites/123 tests pass and full backend 184 suites/2,698 tests pass. Full coverage gate fails branches at 83.70% (3,093/3,695; required 85%), while statements/functions/lines pass and domain branch coverage is 96.77%. This failure is not accepted debt and section progression remains blocked pending trusted untouched-HEAD coverage diagnosis by Testing Specialist. Implementation's bounded additional timestamp probes are subject to specialist/reviewer verification. Evidence: `.opencode/scratchpad/section1-green-implementation.md`. Validate exceeds its projected size by ten lines due explicit Gregorian constants/JSDoc, remains below the binding 500-line ceiling; no feature deviation. Canonical domain/helper documentation reconciliation is in progress, without claiming model/persistence/API integration. No commit or push yet.

Trusted baseline diagnosis complete: Testing Specialist ran the exact `npm run test:backend:coverage` against a `git archive` mirror of untouched HEAD `6fc46be90b6e65cd9338c591adacee207b7d566b`, using linked existing dependencies and no main-worktree mutations. Original 178 suites/2,575 tests pass; branch coverage already fails at 83.68% (3,022/3,611), with statements 90.35%, functions 89.82% and lines 91.05%. Current aggregate branch coverage is slightly higher at 83.70%, but the 85% threshold is still not met. Saved log: `.opencode/scratchpad/section1-original-baseline-coverage.log`; mirror: `.opencode/scratchpad/section1-original-baseline/`. No specialist test edits were needed. Delivery is paused for explicit user direction on this newly established pre-existing coverage failure; do not silently accept it as technical debt, lower thresholds or expand into unrelated coverage work.

Coverage decision resolved via question tool: the user explicitly accepted the original 83.68% backend branch shortfall as baseline technical debt and authorised continuing with no coverage regression and all other gates enforced. Preserve the 85% threshold, run and report the actual gate, and do not bypass hooks. Current 83.70% is above the trusted baseline but remains a failed aggregate coverage gate, not a pass. Resume Section 1 green review after documentation reconciliation. This acceptance does not authorise unrelated coverage fixes or checker/configuration changes.

The historical post-red checker completed: `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T05-16-57.356Z/comparison.txt`, overall FAILING, 99 reported regression identities, zero new failures, two reported fixes. Investigation of saved backend `raw.json` confirms exactly the reviewed 109 intentional red assertions: Boundary 6, RecordBoundaries 7, TimestampAndOrdering 36, Validation 39, timestamp utility 19 and typed error 2; 2,576 tests passed and no legacy-suite failures appear. Its backend execution captured missing domain/error/predicate state (2,685 total tests), not the subsequently passing green tree (2,698 total tests). These are accounted-for red failures, not accepted debt or final regressions; do not reset the baseline or modify checker identity/classification. Other checks passed except the unchanged ten backend lint warnings. This historical run is not section-completion evidence. Run the normal stable-identity section-end comparison only after green review is clean.

Domain/helper and bootstrap canonical documentation is reconciled in `abclass.md`, `api-layer.md` and `backend-testing.md`, keeping downstream integration pending. First full green review (`.opencode/scratchpad/section1-green-review.md`) accepted all architecture/docs and prior red fixes, but found G1 OPEN: an accepted dense Array subclass can override inherited `map()` to return itself, defeating constructor/output defensive copying. Owner: Testing Specialist for a failing local ownership regression, then Implementation for an indexed ordinary-array copy that does not invoke caller methods/species. No blanket rejection of valid arrays or new testing API. Re-review the full section after this single-issue repair. Coverage/lint accepted baseline debt is unchanged and remains reported as failed aggregate commands.

G1 repair complete: Specialist added the failing ownership regression; independent red-repair review found no test findings (`.opencode/scratchpad/section1-g1-red-review.md`). Implementation replaced caller-controlled `map` with indexed plain-array/record copies. Full independent green re-review is clean: `.opencode/scratchpad/section1-green-signoff.md`; R1–R9, N1 and G1 all closed, no outstanding findings, all six criteria and documentation reconciliations satisfied. Current LOC: domain 260, error 21, Validate 358, bootstrap 436; test suites 366/226/201/216/60/28 (1,097 total, maximum 366). Focused 6 suites/124 tests pass; full backend 184 suites/2,699 tests pass. Actual full coverage command still exits 1 solely on accepted baseline branch debt: 83.70% versus original 83.68%, threshold 85% unchanged; statements 90.40%, functions 89.96%, lines 91.08%. Domain coverage statements/branches/functions/lines 98.76/96.77/100/98.66%; Validate 93.54/86.23/95.23/93.75%; error 100/75/100/100%. Full backend lint exits 1 with zero errors and only the ten accepted warnings; formatting/whitespace clean. Section-end stable-identity regression comparison and commit/push evidence remain pending; no Section 2 work has started.

Section-end comparison complete: `npm run regression-checker -- abclass-metadata-contract` (1,200,000 ms timeout), report `.ts-regression-checker/reports/session-abclass-metadata-contract/runs/2026-10-16T05-45-41.102Z/comparison.txt`. Seven of eight checks pass; overall FAILING solely on the ten recorded backend lint warnings; zero regressions, zero new failures, two reported fixes. Backend tests, frontend/builder coverage, frontend E2E, frontend/builder lint and all-project TypeScript pass. The explicit backend coverage debt above is tracked separately because the checker runs backend tests without coverage. Section regression gate is satisfied against accepted baseline debt, not a claim of a clean aggregate lint/coverage gate. Commit and push evidence is next; do not begin Section 2 before that gate completes.

## Section 2 — Canonical supplied snapshots and backend model-input adaptation

### Objective

Extend the existing canonical corpus before adding realistic metadata model/controller tests; provide one test-only adaptation boundary for actual backend model inputs.

### Constraints

- Add `scripts/synthetic-test-data/generateClassMetadata.js` after assignments exist in the logical graph. Extend the existing transport projection; do not add a profile, persisted view, production data source or frontend adapter.
- Select snapshots by profile/class/assignment indices and fixed score templates. Reuse exact generated assignment timestamps and real assignment/definition identifiers. Do not consume Faker or the current clock, alter existing seeds/counts/timestamp conventions, or calculate submission averages.
- Add generator-owned raw contract/integrity checks in `scripts/synthetic-test-data/validateClassMetadata.js`; frontend schema parsing is not metadata validation because those schemas strip the field. Backend-domain validation is independently exercised in tests, not imported into GAS from the generator.
- Add `scripts/synthetic-test-data/toBackendModelInputs.js` for test-only conversion of canonical transport into backend ABClass/Assignment/definition inputs. Resolve the matching definition, adapt its shape to existing backend requirements, and preserve IDs, timestamps and partial/full redaction/hydration semantics. Do not feed frontend assignment partials directly to `Assignment.fromJSON()` or substitute full submissions into a partial class.
- Its export is `loadBackendModelInputs(profileName)`, returning independently cloned `{ classPartials, classesById, assignmentsByKey }` backend inputs. Internally call `loadSyntheticAnalysisProfile(profileName, viewName)` for each of `classPartials`, `classesById`, `assignmentsByKey` and `editableDefinitions`, resolving definitions before model restoration. Each loader call returns one frozen view, not a graph/`transport` wrapper: partials are an array, classes are keyed by `classId`. Outputs include roster JSON for ABClass inputs; retain plain restored teachers rather than invent array hydration. Pass `'small'` or `'medium'` explicitly, never add a hidden profile default.
- Use the existing immutable loader and clone before mutation. Service/auth/database failures remain local mocks, not corpus features.
- Node-project `.test.js` consumers use ESM named imports, not `require()` of script-owned ESM. Add root `package.json` import mapping `"#synthetic-data/*": "./scripts/synthetic-test-data/*"`; import the adapter/loader as `#synthetic-data/toBackendModelInputs.js` and `#synthetic-data/loadSyntheticAnalysisProfile.js`. This test-tooling alias is distinct from the existing committed-JSON `#synthetic/*` alias and prevents new two-parent relative imports. Add the node-project smoke before downstream sections rely on this mechanism; no GAS imports or runtime fallbacks are added.

### Delegation mandatory reads

All section agents: common reads plus @scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js, @scripts/synthetic-test-data/projectClassTransportViews.js, @scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js, @scripts/synthetic-test-data/profileDefinitions.js, @scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js, @package.json, @vitest.config.js and @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md. Adapter work also reads @src/backend/Models/ABClass.js, @src/backend/Models/AssignmentDefinition.js, @src/backend/AssignmentProcessor/Assignment/index.js and @src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js. `Docs` reconciles the delivered generator/adapter entries and the existing configuration-hierarchy alias paragraph after the alias lands.

### Shared-helper and data-shape plan

- **New:** metadata generation stage and generator-owned shape/relational validation helper at the paths above. **Extend:** existing graph/projection/validation entrypoints; keep heavy new logic out of the orchestrators.
- **New:** shared backend-model input adapter at the path above; **reuse:** immutable loader and existing global/mock restoration seams rather than grow `mockFactories.js` or `modelFactories.js` with another realistic graph.
- **Extend:** root Node package-import map with `#synthetic-data/*`, owned by `package.json`; use ESM named imports in backend JavaScript tests. This is test-infrastructure wiring, not a new loader or fixture source. Canonical planned entry: `backend-testing.md` **Test infrastructure reuse** (`Not implemented`).
- Canonical records: `synthetic-test-data.md` **Planned ABClass metadata generator capability**, `backend-testing.md` **Planned ABClass canonical model-input adaptation**; initially `Not implemented`.
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

Explain supplied snapshots versus calculated averages, no-Faker/index determinism and transport-to-model adaptation/redaction. Not started; record commands, regenerated paths and review outcome during delivery.

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

Document legacy absence versus invalid presence, constructor-only null ownership and output isolation. Not started; record evidence and actual LOC during delivery.

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

Explain the facade/mutation-owner boundary and options-object injection. Not started; record preserved methods, counts and test/review evidence during delivery.

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

Explain why roster patches deliberately avoid stored metadata, missing-row preparation timing and non-transactional failure risk. Not started; record evidence during delivery.

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

Explain nullable legacy reads, the single partial gate and string timestamps. Not started; record evidence during delivery.

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

Document omission/null/replacement, narrow request provenance, no stored-data repair and intentionally stale snapshots. Not started; record evidence during delivery.

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

Explain the typed request-provenance-only catch and intentional internal-error propagation. Not started; record evidence during delivery.

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
