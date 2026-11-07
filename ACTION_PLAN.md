# Display Legacy Assignment Results — TDD-First Plan

## Read-first context

Product behaviour: @SPEC.md . UI: @LEGACY_ASSIGNMENT_READ_LAYOUT.md . This document sequences delivery; it does not override either specification. Planning only: no production implementation has started.

Planning artefacts reviewed; ready for implementation orchestration.

## Scope and assumptions

- Show valid legacy results and include their scores in analysis; invalid assessment items become E. Preserve saved bodies and fix the empty-array regression.
- Use required read version `1` or `'legacy'`, with a task-heatmap-only status tag. No recent-card model changes.
- Include the contract-coupled legacy preview browser journey and the requested plain-language cleanup.
- Corrupted/missing student IDs are explicitly out of scope. No migration, identity recovery, scoring change or completed-write change.
- Non-1 stored versions share legacy read behaviour. Backend/frontend ship together. Existing no-submission, weighting and explicit-error rules remain.
- No open product decisions or authorised deferrals.

## Global constraints and gates

1. Check `git status` before editing. The worktree already contains unrelated changes to classes-page/settings-backend E2E files, `endToEndRuntimeMocks.ts`, `runtimeMockScenarios.ts`, `runtimeMockTypes.ts` and deleted harness helpers. Do not modify, revert, stage or commit that work. The legacy preview files named below were clean at planning time. If ownership changes, coordinate before editing; do not overwrite another agent's changes.
2. Establish a regression baseline before implementation using `npm run regression-checker`, keeping the same branch/session identity. Run again at each completed section and after final cleanup; tool timeout 1200000ms. Record baseline failures separately; do not call them new regressions or bypass hooks. Do not run this expensive checker between Red/Green/Refactor.
3. Each section: **Red → Green → Refactor → focused checks → docs/shape sync → independent Code Reviewer loop until clean → section regression check**. Record actual checks and deviations under its implementation notes. Compact completed sections only after preserving decisions needed by later sections.
4. Delegate backend/Vitest test work to Testing Specialist, code implementation to Implementation, E2E to Playwright, ordinary docs to Docs, and contract reconciliation to Data Shapes Agent. The user requested that this plan be written by the parent planner; that does not change implementation routing.
5. Do not add catch-all recovery, missing-value coercions or alternate validators. Defaults remain constructor-owned. Read preparation is independent from saved state. Use GAS globals with only existing guarded Node-test exports.
6. Before code-review sign-off on shape changes, reconcile relevant planned entries with Data Shapes Agent. Do not remove unrelated planned attempt-baseline entries in shared docs.
7. British English; short comments describing fields and behaviour. No invented terms, certification rationale or filler.

### Baseline record

- Branch `legacy-assignment-results` created at HEAD `a8cfa890abdcf735f6e62dc77d827ab2144ad076`. Unrelated worktree changes to classes-page/settings-backend E2E files, runtime mocks and deleted harness helpers are present and left untouched, per global constraint 1.
- Baseline run: session identity `legacy-assignment-results`, report at `.ts-regression-checker/reports/session-legacy-assignment-results/baseline/baseline.txt` (2026-11-06T06:23Z). Overall status FAILING: 7 of 8 checks passing.
- Accepted pre-existing baseline debt: `backend-lint-check` fails with 4 `max-lines` warnings in unrelated pre-existing backend test files — `tests/backend-api/assignmentDefinitionPartials.unit.test.js`, `tests/dbManager/dbManager.test.js`, `tests/googleClassroom/classroomApiClient.test.js`, `tests/utils/batchUpdateUtility.test.js`. Not caused by this plan; section gates must show zero regressions and zero new failures against this baseline. Do not fix these files within this plan (out of scope).

### Mandatory reading by delegated phase

Every handoff includes @SPEC.md and its current plan section, plus these phase-specific reads and the exact relevant source/test files listed in that section:

- Testing Specialist: @docs/developer/testing/synthetic-test-data.md and @docs/developer/backend/backend-testing.md for backend tests, or @docs/developer/frontend/frontend-testing.md for frontend tests.
- Implementation and Code Reviewer: @docs/developer/backend/rehydration.md for backend read sections; @docs/developer/frontend/frontend-architecture.md for frontend changes; @LEGACY_ASSIGNMENT_READ_LAYOUT.md for UI; @docs/developer/backend/api-layer.md for wire activation.
- Playwright: @LEGACY_ASSIGNMENT_READ_LAYOUT.md and @docs/developer/frontend/frontend-playwright-e2e.md and @docs/developer/testing/synthetic-test-data.md .
- Docs: @SPEC.md and the precise documentation targets in the section.
- Data Shapes Agent: @docs/developer/data-shapes/INDEX.md and the shape docs named in the section.
- De-Sloppification: @SPEC.md and @LEGACY_ASSIGNMENT_READ_LAYOUT.md plus changed files; no unrelated refactors.

### File-size assessment

Counts are physical lines observed during planning; projections are estimates, not targets to reach. Recount before editing. Plan separation above 500 lines, following @docs/developer/backend/backend-file-organisation.md and @docs/developer/frontend/frontend-architecture.md ; their 550-line hard rules also apply. Do not shorten formatting/comments merely to evade a split.

| Module                                                                    | Current → projected LOC     | Plan                                                                                   |
| ------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Backend `Assignment/00_AssignmentSerialisation.js`                        | 186 → 210                   | Keep persistence/read concerns in existing owner                                       |
| `Assignment/02_AssignmentRehydration.js`                                  | 141 → 145                   | Preserve raw state; thin preparation facade                                            |
| `Assignment/02_AssignmentCurrentRestoration.js`                           | 260 → 260                   | Reuse logic; only local comment cleanup if touched                                     |
| New `Assignment/02_AssignmentLegacyRead.js`                               | 0 → 130                     | Separate read preparation, no duplicate item validator                                 |
| Removed `Assignment/02_AssignmentReadProjection.js`                       | 228 → 0                     | Delete after callers/tests migrate                                                     |
| `ABClassController/ABClassResponseMapper.js`                              | 136 → 130                   | Prepare before definition stripping                                                    |
| `tests/setupGlobals.js`                                                   | 447 → 448                   | Replace old helper registration in place                                               |
| Builder `steps/backend-copy.spec.ts`                                      | 142 → 155                   | Update helper/order assertions                                                         |
| Frontend `assignmentReadNormalisation.ts`                                 | 364 → 330                   | Remove legacy placeholder gate; no new recovery hierarchy                              |
| `assignmentAssessment.zod.ts` / `classDetailService.zod.ts`               | 211 / 163 → unchanged       | Version union only                                                                     |
| `TaskHeatmapPage.tsx`                                                     | 399 → 430                   | Tag in existing normal navigation                                                      |
| `components/PageHeader/PageHeader.tsx`                                    | 116 → 130                   | Opt-in wrapping                                                                        |
| New synthetic legacy derivation module                                    | 0 → 130                     | Runner-neutral test-only scenario derivation                                           |
| Full/partial normaliser specs                                             | 479 / 500 → about 410 each  | Move legacy cases into new `.legacyFull.spec.ts` / `.legacyPartial.spec.ts`, each ≤300 |
| Existing legacy backend suites                                            | 85–213 each → ≤300 each     | Re-home behavioural coverage; focused files, no oversized suite                        |
| `ABClassPersistence.unit.test.js` / `abclass.assessmentContracts.test.js` | 315 / 157 → 360 / 220       | Focused persistence/class-read regressions                                             |
| New backend preparation / API round-trip specs                            | 0 → ≤300 each               | Split preparation cases from cross-layer transport                                     |
| `PageHeader.spec.tsx` / `TaskHeatmapPage.legacy.spec.tsx`                 | 86 / 0 → 130 / ≤220         | Separate shared prop contract from feature status                                      |
| E2E preview specs, embedded / merged                                      | 473 / 496 → about 430 / 496 | Move embedded legacy journey to dedicated spec ≤300; merged suite unchanged            |
| E2E preview fixtures / journey helper                                     | 367 / 226 → 350 / 230       | Replace legacy variants; reuse existing harness                                        |

The controller seam suites `abclassLegacyAssessmentPersistence.test.js` and `abclassReadCorruptionProjections.test.js` are 238 and 300 lines respectively; projected 280 and 300 (the latter is an unchanged regression run).

No production file is projected above 500. Any additional materially changed file must be counted before extension; split by responsibility rather than leaving a new over-limit module.

## Section 1 — Derive linked legacy fixtures

### Objective and constraints

Provide realistic legacy fixtures from existing generated data, not a second dataset. Select canonical `small` for healthy records and `medium` for mixed healthy/E. Base corpus/version-1 validators remain unchanged.

### Required tests — Red

1. New `tests/synthetic-analysis/syntheticLegacyScenarios.test.ts`: derive full and class-embedded legacy forms of the same selected assignment, retaining linked student/task IDs, scores, artefacts, feedback and timestamps.
2. Stored scenario omits the marker; read scenario carries `'legacy'` on both forms. Current sibling assignments remain unchanged.
3. Deterministic output, independent copies and no mutation of frozen canonical input. Invalid selection fails clearly rather than choosing another assignment.

### Green and Refactor

- Add `scripts/synthetic-test-data/deriveLegacyAssignmentScenario.js`: pure test-only derivation from supplied canonical transport views and/or existing `toBackendModelInputs` output. Keep loader/filesystem operations in the existing loaders, not this helper.
- Expose explicit stored/read variants; no default profile or implicit version selection. Existing model-input adapter is reused, not duplicated.
- Reuse this derivation in subsequent Node-side tests. Frontend Vitest/Playwright keep existing typed helpers that clone committed canonical JSON and change only the linked assignment markers. No scripts-JavaScript imports into frontend projects, `allowJs` changes, new aliases or root-directory changes. Invalid maps/nulls/scores stay local overrides.

### Helper and data-shape plan

- **New test-only derivation**, owner above, recorded as implemented in @docs/developer/testing/synthetic-test-data.md ("Legacy scenario derivation"). No production contract change in this section. Do not introduce a new committed profile or regenerate unchanged corpora.

### Acceptance criteria and checks

- Valid legacy test data shares the existing profile's real content and relationships; input remains unchanged.
- `npm run test:synthetic -- tests/synthetic-analysis/syntheticLegacyScenarios.test.ts`
- `npm run lint:synthetic:check`; `npm run typecheck:all`.
- Documentation records the actual helper API and profile/view selection.

### Outcome

Delivered `scripts/synthetic-test-data/deriveLegacyAssignmentScenario.js` (pure test-only helper) and `tests/synthetic-analysis/syntheticLegacyScenarios.test.ts`. Red, green and both reviews passed with no findings; no refactor was needed.

### Implementation notes / deviations / follow-up

Complete. Recorded contract for later sections:

- **Call:** `deriveLegacyAssignmentScenario({ profileName, assignmentId, variant, sources: { classesById, assignmentsByKey } })` → `{ classId, classView, assignmentsByKey, full, classEmbedded }`.
- **Variants:** `'stored'` deletes the marker property; `'read'` sets `'legacy'`. No default profile or implicit version selection; invalid variant or unknown assignment throws naming the selection.
- **Caller-supplied views:** the helper takes already-loaded, deep-frozen canonical views and never loads from disk. Callers own loading (for example `loadSyntheticAnalysisProfile`).
- **Guarantees:** deep-cloned output is deterministic and independently owned; sibling assignments, IDs, scores, artefacts, feedback and timestamps are unchanged; inputs are never mutated.
- **Canonical selections:** `small` `class-0`/`assignment-0-1` (healthy primary); `medium` `class-0`/`assignment-0-2` (mixed healthy/E). Reuses the existing `#synthetic-data/*` package-import alias; no new alias or config.
- **Frontend boundary:** Vitest and Playwright keep their typed canonical-clone marker-only helpers; they must not import this scripts JavaScript.
- **Docs (sync outcome):** reconciled `docs/developer/testing/synthetic-test-data.md` — "Planned legacy scenario derivation (Not implemented)" became "Legacy scenario derivation" with the implemented record (API, variant semantics, caller-supplied frozen views, canonical selections, frontend boundary). One-line sync to the Synthetic Test Data entry in `.opencode/agents/code-reviewer.md`'s doc-reference list. No pages created. Section 2+ planned data-shape contract entries remain **Not implemented**; this section changed no production contract.
- **Section regression gate (§2.6):** PASSED — compare mode, session `legacy-assignment-results`, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-06T06-58-28.981Z/comparison.txt` (2026-11-06T06:58Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing. The only failing check is `backend-lint-check` with exactly the 4 pre-existing unrelated `max-lines` warnings recorded as baseline debt.
- **Commit gate (§2.7):** commit `cf9cfac4` "test(synthetic): derive linked legacy assignment scenarios (Section 1)" on branch `legacy-assignment-results`; pushed to `origin/legacy-assignment-results` (new remote branch, tracking set). Worktree clean after push.

## Section 2 — Preserve saved legacy submissions

### Objective and constraints

Fix the PR #346 data-loss regression without activating the new read contract yet. Preserve original version presence/value. Marker-1 restoration and the completed-write gate stay unchanged.

### Required tests — Red

1. Legacy `submissions` array, explicit null, object, and absent property through restore, `toJSON()` and `toPartialJSON()`. Absent retains constructor state; present non-array values are not replaced by `[]`.
2. Ordinary class load/save with non-array legacy submissions preserves the value. Assert the stored write payload, not just the restored instance.
3. Live nested Dates emit ISO strings, never `{}`; returned persistence payloads are independent of saved state.
4. Marker-1 invalid root still rejects; valid marker-1 round trips are unchanged.

### Green and Refactor

- Edit `02_AssignmentRehydration.js` legacy branch: preserve present values, do not add a new fallback outside the constructor.
- Edit both persistence paths in `00_AssignmentSerialisation.js`: reuse `_submissionJSON()` / `_plainSubmissionJSON()` for arrays; preserve/date-convert non-array legacy values instead of applying `.map` or truthiness fallback.
- Tests: extend `assignmentRehydration.legacy.test.js`, `.legacySnapshotIsolation.test.js` persistence cases, and `tests/controllers/ABClassController/ABClassPersistence.unit.test.js`; use focused companions if needed.

### Helper, data-shape and fixture plan

- **Reuse** existing date conversion and submission serialisers; no new generic clone helper.
- Planned contracts: @docs/developer/data-shapes/assignment.md and @docs/developer/data-shapes/assessment.md , preservation items marked **Not implemented**. Reconciled as implemented by the Data Shapes Agent (see outcome); future read changes remain planned.
- Fixtures: Section 1 canonical `small` stored scenario; null/object/absence/Date probes local. Only touched tests migrate.

### Acceptance criteria and checks

- No ordinary save can silently replace a present legacy submissions value with an empty array.
- `npm run test:backend -- tests/assignment/assignmentRehydration.legacy tests/controllers/ABClassController/ABClassPersistence.unit.test.js`
- `npm run lint:backend:check`; contract/persistence reviewer checks exact written payloads.

### Outcome

Preservation fix delivered in `02_AssignmentRehydration.js` (legacy branch) and `00_AssignmentSerialisation.js` (both persistence paths), with additive test extensions in `assignmentRehydration.legacy.test.js`, `assignmentRehydration.legacySnapshotIsolation.test.js` and `ABClassPersistence.unit.test.js`. Red and green reviews passed with zero findings; no refactor was needed. Checks: targeted 3 suites 51/51; `npm run test:backend -- tests/assignment tests/controllers` 920/920; `npm run lint:backend:check` exit 1 only from the 4 baseline-debt `max-lines` warnings.

### Implementation notes / deviations / follow-up

Complete. This section restores preservation only; legacy read activation comes later. Contract for later sections:

- **Preservation rule:** absence is decided by `Object.hasOwn(data, 'submissions')`; only an absent property keeps the constructor's `[]`. A present array, `null` or object is preserved exactly through restore and through both persistence serialisers.
- **Serialisation:** `toJSON()` and `toPartialJSON()` route present non-array values through `AssignmentSerialisation._plainSubmissionJSON()` (date-normalised, independently copied); array bodies keep `_submissionJSON()`. No new clone helper and no new fallback outside the constructor.
- **Marker-1 unchanged:** marker-1 roots validate the submissions array, so no version check was added to the preservation path. Later sections touching read paths or replacing the projector must keep this fact.
- **Persistence/read separation:** read activation is still pending, so persistence must not gain read-time marker or `E` behaviour here.
- **Fixtures:** Section 1 canonical `small` stored scenario via the Section 1 helper or `loadBackendModelInputs`; null/object/Date probes stay local overrides on clones.
- **Deferred finding:** the present-but-`undefined` probe nitpick is recorded as disregarded in `.opencode/scratchpad/legacy-assignment-results-deferred-findings.md`; it is outside the acceptance contract.
- **Pending evidence:** commit `f0b1960a` "fix(backend): preserve saved legacy submissions bodies (Section 2)", pushed to `origin/legacy-assignment-results` (cf9cfac4 → f0b1960a). Worktree clean after push.
- **Docs sync (outcome):** `docs/developer/backend/rehydration.md` updated (+25/−15, four passages) for the preservation rule. Data Shapes Agent reconciled `assignment.md` ("### Legacy submissions persistence" preservation implemented; planned list narrowed to read-time items 1–3), `assessment.md` (preservation record implemented; planned items renumbered 1–6, all still **Not implemented**) and `INDEX.md` (status line updated). A fragile planned-vs-delivered reading — "Non-array transport roots retain existing frontend rejection" is unreachable while the current projector throws server-side — is recorded as Known discrepancy 8 in `assignment.md` pending Sections 3–4. No pages created.
- **Section regression gate (§2.6):** PASSED — compare mode, session `legacy-assignment-results`, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-06T07-37-27.167Z/comparison.txt` (2026-11-06T07:37Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check`.

## Section 3 — Prepare legacy read results with existing validation

### Objective and constraints

Prepare independent legacy read submissions that keep valid data and isolate invalid assessment data as E. Do not switch callers or delete the old projector until Section 4, keeping existing integration tests coherent during this enabling section.

### Required tests — Red

New focused `tests/assignment/assignmentLegacyReadPreparation*.test.js` suites:

1. Healthy numeric/N items preserve score, reasoning, content/hash, feedback and source IDs; explicit valid E stays E.
2. One null/malformed assessment map, missing criterion, invalid score, artefact or inconsistent source becomes CORRUPT_RECORD E for that task only. Healthy siblings and students remain unchanged.
3. Null/missing/array/non-record item maps yield E per embedded task on both output forms. Missing known tasks, non-empty null-parent maps and genuinely empty no-submission maps follow existing restoration rules.
4. Validate by embedded definition representation (array: partial, keyed: full), independent of output form. A contradictory redacted body under a full definition is E. Full output uses a resolved full definition.
5. Timestamp preparation uses valid saved/assignment times, never the clock. Input and later persistence output stay unchanged after preparation and after mutating returned read data.
6. Non-array submissions root bypasses preparation and is emitted preserved/date-normalised. No roster expansion, fetch or write occurs.
7. Existing identity/unknown-task association rejection remains; arbitrary injected constructor faults propagate rather than being caught as assessment errors. No new student-ID recovery tests or machinery.

### Green and Refactor

- Add `02_AssignmentLegacyRead.js` and `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, form)`.
- Reuse `AssignmentCurrentRestoration` root/task validation, `_rehydrateCurrentSubmission()` item isolation/coverage and timestamp preparation on independent serializer output. Implement the new owner as a small `AssignmentLegacyRead` class, whose constructor owns any accumulator/default state, not a namespace with module-level defaults. Do not stamp the original or temporary assignment as completed/current merely to enter validation.
- Reuse existing model serialisers for full/partial output. Do not add another assessment/schema validator or blanket E materialiser. Keep saved raw legacy records separate from restored read models.
- Register new GAS global in `tests/setupGlobals.js`; assert new module before the facade in `scripts/builder/src/steps/backend-copy.spec.ts`. Keep old registration until Section 4 removes its consumers.

### Helper, data-shape and fixture plan

- **New read-preparation owner, reuse existing validation**: implemented entry "## Legacy read preparation" in @docs/developer/backend/rehydration.md (owner, API table, validation mode, bypass convention, load order; unwired status explicit).
- Contracts: @docs/developer/data-shapes/assessment.md @docs/developer/data-shapes/student-submission.md @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/abclass.md . Keep public wire activation pending until Section 4.
- Fixtures: Section 1 `small`/`medium` stored forms; local corruption probes. No competing realistic fixture.

### Acceptance criteria and checks

- Valid legacy results survive; assessment corruption does not block healthy submissions; both read forms use the same existing validation rules.
- `npm run test:backend -- tests/assignment/assignmentLegacyReadPreparation`
- `npm run test:builder -- src/steps/backend-copy.spec.ts`
- `npm run lint:backend:check`; `npm run lint:builder:check`.

### Outcome

Delivered `02_AssignmentLegacyRead.js` (stateless `AssignmentLegacyRead` class) and the thin `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, form)` facade, with the GAS global registered in `tests/setupGlobals.js` and load order pinned in `scripts/builder/src/steps/backend-copy.spec.ts`. New focused suites: `tests/assignment/assignmentLegacyReadPreparation{Support,.healthy,.corruption,.validationMode}`. Red and green reviews passed with zero findings; no refactor was needed. Checks: preparation suites 35/35; `tests/assignment` 425/425; cross-suite (assignment + controllers + models) 1496/1496; `npm run test:builder` 252/252 including the new ordering assertion; `npm run lint:backend:check` exit 1 only from the 4 baseline-debt `max-lines` warnings; `npm run lint:builder:check` clean; `npm run typecheck:all` exit 0.

### Implementation notes / deviations / follow-up

Complete for the enabling helper only; Section 4 activates both wire ends together. Contract for later sections:

- **API:** `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, form)` constructs `new AssignmentLegacyRead()` per call and delegates to `prepare(assignment, form)`. The class holds no instance or module state; all work is per call.
- **`form` selects output serialisation only:** `'full'` or `'partial'`; any other value throws `Invalid legacy read preparation form: <value>`. It never weakens validation.
- **Validation mode is definition-representation driven:** an array task list selects partial validation, a keyed task map selects full validation, independent of `form`. Full output uses the resolved full definition.
- **Reuse, not a second validator:** the owner calls `AssignmentCurrentRestoration._rehydrateCurrentSubmission` on isolated raw copies (a shallow record copy whose `items` are deep-copied per key). Receivers are constructed with the assignment's true legacy marker state and are never stamped `1`; there is no blanket E materialiser and no second validator.
- **Non-array root bypass:** a present non-array `submissions` value returns `null`; Section 4's caller emits the preserved, date-normalised value.
- **Timestamps:** prepared via `_prepareCurrentTimestamps` with ISO-string assignment fallbacks; never a clock.
- **Error propagation:** identity and unknown-task errors, and injected constructor faults, propagate unchanged; they are never relabelled `E`.
- **Unwired state:** `toReadJSON()`, `ABClassResponseMapper` and the projector are unchanged. Section 4 owns wire activation, projector deletion and shape-doc reconciliation.
- **Red-test adjustment (justified):** in `assignmentLegacyReadPreparation.corruption.test.js` the original snapshot was taken before the local mutate probe and then compared against the record, which was unsatisfiable because the probe itself mutates the record. The snapshot now happens after the mutation. No production surface changed.
- **Process deviation:** the Implementation agent initially authored this section's outcome/notes in `ACTION_PLAN.md` without authorisation. The orchestrator reverted that text and composed this authoritative record. No later section is affected.
- **Shape-doc reconciliation:** deliberately deferred to Section 4; this section left the shape docs' Not-implemented entries untouched.
- **Section regression gate (§2.6):** PASSED — compare mode, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-06T08-47-07.428Z/comparison.txt` (2026-11-06T08:47Z). 0 regressions, 0 new failures; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check`.
- **Commit gate (§2.7):** commit `74a3ed82` "feat(backend): add legacy read preparation owner (Section 3)", pushed to `origin/legacy-assignment-results` (bd5363d6 → 74a3ed82). Worktree clean after push.
- **Docs sync (outcome):** `docs/developer/backend/rehydration.md` replaced the "Planned legacy-read helper (Not implemented)" section with the implemented "Legacy read preparation" record (owner/API table, validation mode, preparation rules, `null` bypass, load order, unwired status), plus ownership-section reconciliation; the stale "userId fallback" clause was folded away. No pages created. Shape docs deliberately untouched (Section 4 targets, reported by Docs). **Section 6 follow-up:** `02_AssignmentLegacyRead.js` still uses "task universe" in a throw message and one comment — the Section 6 plain-language pass must replace it with "tasks"/"task IDs".

## Section 4 — Activate the legacy wire version end to end

Red, green and re-review complete and clean; docs sync, Data Shapes reconciliation, the section regression gate and the commit record are recorded under Implementation notes below.

### Outcome

Both read serialisers call `AssignmentRehydration.prepareLegacyReadSubmissions(assignment, 'full' | 'partial')` for non-marker-1 records and emit the `'legacy'` wire marker beside the prepared submissions: `AssignmentSerialisation.toReadJSON()` and `ABClassResponseMapper._toReadView()` (before definition-key replacement). Valid marks are retained and corruption is isolated as per-task `CORRUPT_RECORD` `E`; a present non-array root bypasses preparation and keeps the preserved, date-normalised body. The projector `02_AssignmentReadProjection.js` and `projectReassessmentSubmissions()` are deleted, with its GAS registration removed and the builder assertion inverted. Frontend Zod unions accept `1 | 'legacy'`; the read normalisers reject malformed entries with owned `TypeError`s. Suites were reworked or added across backend, frontend, synthetic and E2E.

### Retained for later sections

- **Contracts and interfaces.** `prepareLegacyReadSubmissions(assignment, form)` API, validation mode and `null` bypass are as recorded in Section 3. Read marker maps stored `1` → `1` and every other stored marker → `'legacy'` on read output only; stored instances are never rewritten. `REASSESSMENT_REQUIRED` remains an accepted stored-error cause with its preview branch; the tag comes from `'legacy'`, not that code.
- **Files.** New `tests/assignment/assignmentRehydration.legacyReadWireMatrix.test.js`, `.legacyReadNonArrayRoot.test.js`, `tests/controllers/abclassLegacyReadSeam.test.js`, `tests/synthetic-analysis/syntheticLegacyAssessmentRoundTrip.test.ts`, `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.legacy{Full,Partial}.spec.ts`, `src/frontend/src/services/dataAnalysis/legacyAssessmentParity.spec.ts` (with `src/frontend/src/test/dataAnalysis/legacyAssessmentParity{Expectations,Oracle}.ts`) and `src/frontend/e2e-tests/legacy-assignment-results.spec.ts`. Reworked: the seven `assignmentRehydration.legacy*.test.js` projector suites, `abclassLegacyAssessmentPersistence.test.js`, `abclass.assessmentContracts.test.js`, both Zod schema files, both normaliser specs, the preview fixtures/journeys, and `assessment-error-previews.spec.ts` (legacy case moved out). `abclassReadCorruptionProjections.test.js` is unchanged and run as the marker-1 isolation regression.
- **Commands.** Section checks: `npm run test:backend -- tests/assignment tests/models/abclass.assessmentContracts.test.js tests/controllers tests/api/apiHandler`; `npm run test:frontend -- src/services/assignmentAssessment src/services/googleClassrooms/classDetail src/services/dataAnalysis`; `npm run test:synthetic`; `npm run test:builder -- src/steps/backend-copy.spec.ts`; `npm run test:frontend:e2e -- e2e-tests/assessment-error-previews.spec.ts e2e-tests/assessment-error-merged-previews.spec.ts e2e-tests/legacy-assignment-results.spec.ts`; scoped `lint:*:check` and `npm run typecheck:all`.
- **Constraints.** No frontend submission reconstruction; `addMissingFullTasks()` stays marker-1-only; no second validator or analyser helper; no corpus version-1 validator or cause-catalogue change; shared classes/settings runtime files untouched. Section 5 owns the UI tag; version rollout is a single backend/frontend release.
- **Line-count waiver.** `tests/synthetic-analysis/syntheticLegacyAssessmentRoundTrip.test.ts` landed at 328 lines. The ≤300 suite projection is waived to ≤328 by user decision ("Don't waste time over three lines over budget"); the companion-suite split was declined to keep the validated green suite intact. Do not re-flag or re-split it.
- **Model routing deviation.** Free-tier quota was exhausted mid-loop. The user manages `.opencode/agents/*.md` routing and may reassign models mid-plan (currently committed at `869837a4`: implementation, testing-specialist, docs, playwright, data-shapes → `mistral/zai-glm-5-3-flash`; code-reviewer → `mistral/mistral-large-4#high`). Standing rule: resumed sessions stay pinned to their original model, so fresh sessions without an explicit model parameter are required for reassignments to apply.
- **Review evidence.** `.opencode/scratchpad/review-section4-green-fe.md` (frontend green), `section4-be-milestone-review.md` (backend milestone), `review-section4-greenBE-rereview.md` (backend docblock re-review) and `review-section4-green-final-rereview.md` (final re-review, PASS with all five prior findings resolved).
- **Accepted-as-KISS.** The one-branch marker mapping (`stored !== 1 → 'legacy'`) is duplicated at the two read callers instead of being extracted.
- **E2E stability.** `legacy-assignment-results.spec.ts` 4/4 across three consecutive runs; previews 6/6; merged 6/6. First-run-after-restart E2E failures can be cold-boot artefacts; re-run before treating them as regressions.
- **Baseline lint debt (do not re-flag).** `lint:backend:check` reports 4 `max-lines` warnings and `lint:frontend:check` reports 17, all in pre-existing unrelated files.

### Implementation notes / deviations / follow-up

Complete and clean through the final re-review. Appended below: docs sync, Data Shapes reconciliation, section regression gate and commit record.

- **Green fix batch (post-review):** five in-scope findings resolved in a six-file delta — `isRecord(candidate)` guard in `normaliseClassRead` (`assignmentReadNormalisation.ts:260`, `isRecord` excludes arrays), doubly-invalid parse-order probe (`assignmentReadNormalisation.legacyPartial.spec.ts:285`), `vi.resetAllMocks()` hook fix (`classDetailService.spec.ts:92`), invalid-form rejection row (`assignmentRehydration.legacyProjection.test.js:57`), stale red-narration headers rewritten (wire matrix + controller seam; synthetic docblock already PASS). Final re-review PASS: `.opencode/scratchpad/review-section4-green-final-rereview.md`.
- **Docs sync (outcome):** seven files updated, no pages created — `rehydration.md` ("Status: active on both read paths"; legacy-records/ownership/load-order/active-path/persistence-vs-read sections reconciled), `api-layer.md` (getAssignment L685 + getABClass L627 legacy clauses), `frontend-testing.md` (L100–101 alert branch keys on stored error code; legacy journey inventory), `frontend-playwright-e2e.md` (L587 real fixture exports), `frontend-shared-helpers-and-abstraction-standards.md` (L311 prepared read entries), `frontend-logging-and-error-handling.md` (L130), and one plan-owned line in `.opencode/agents/code-reviewer.md`'s doc-reference list (that file stays uncommitted with the user's routing edits per user decision). No residual retired-path reference in backend/frontend docs.
- **Data Shapes reconciliation (outcome):** all five shape docs + `INDEX.md` reconciled — read-wire union `1 | 'legacy'` throughout, prepared-submissions prose replaces projector prose, `### Legacy read preparation` sections added (assignment.md, assessment.md), planned blocks merged to "None for this contract", file indexes name live components. Known discrepancy 8 closed in place (retitled Aligned; numbering preserved; cross-references swept). Storage-side semantics (`1|null|unknown|omitted`, opaque preservation) untouched. Opportunistic fix accepted: dangling `item 22` → `item 7` cross-reference (nitpick log updated).
- **Section 6 hand-offs (recorded, not fixed here):** `rehydration.md` "task universe" (L265, L268) and "certify" (L404–405); `backend-testing.md:185` "prepared-projection" wording (could trip the "no active reference to the removed projector API" criterion); `abclass.md` ~L756 metadata "legacy projection" wording; `assessment.md` `### Legacy submissions preservation` heading sits under the (now empty) planned section — relocation would change anchors linked from `assignment.md`/`INDEX.md`; `assessment.md` ~L438 parenthetical naming the removed projector (labelled retirement statement — trim candidate only); `frontend-data-analysis-response.md` ~L1114 "Legacy assignment display (Not implemented)" spans backend score inclusion (now true) and the Section 5 heatmap tag (pending) — reconcile after Section 5. The Section 6 inventory bullets for `frontend-testing.md`/`frontend-playwright-e2e.md` are already satisfied by this section's docs sync (verify-only there).
- **Section regression gate (§2.6):** PASSED — compare mode, session `legacy-assignment-results`, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-07T10-38-55.105Z/comparison.txt` (2026-11-07T10:38Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check` (4 pre-existing `max-lines` warnings). E2E, all coverage suites, builder checks and typecheck passed.
- **Commit gate (§2.7):** commit `aaeab04d` "feat(assignment): activate the legacy read wire version end to end (Section 4)" (50 files, +3424/−1852; projector deleted; 10 new suites/specs) on branch `legacy-assignment-results`; pushed to `origin/legacy-assignment-results` (`869837a4..aaeab04d`). Pre-commit hooks passed (Prettier, staged lint, `typecheck:all`). The user committed the agent-routing reassignments as `869837a4` immediately before this commit; `opencode.jsonc` remains uncommitted user-managed config. Worktree clean after push apart from that file.

## Section 5 — Task-heatmap reassessment tag

Red and green complete and all reviews clean; the docs sync, section regression gate and commit record are appended to the Implementation notes below.

### Outcome

Delivered the task-heatmap reassessment tag and the opt-in `wrapActions` prop on `PageNavCard` as planned. All suites green: scoped frontend 39/39, full frontend coverage 3033/3033, E2E 11/11, `lint:frontend:check` 0 errors (17 baseline warnings), `typecheck:all` exit 0. The red loop took three review rounds (initial FAIL: four structurally-unpassable journeys/tests and one missing planned case; repairs validated by measured mock-lifecycle evidence); the green loop took two (one antd-DOM reality fix, one comment-rationale nitpick).

### Retained for later sections

- **Tag contract:** exact text "Reassessment required"; `<Tag color="warning" style={{ margin: 0 }}>`; static (no close/click/keyboard/tooltip/live region); immediately before Re-run Assessment (before Refresh without callback); sourced ONLY from the selected assignment's `'legacy'` marker in the loaded `classFull.assignments` (never preview errors or the fetched full result); title-error Back-only; no tag on other surfaces; tag removal only via successful rerun + existing class refresh (no optimistic removal, no query invalidation).
- **`wrapActions` contract:** opt-in on `PageNavCard`; true → outer Flex `APP_GAP_SM` wrap + action Space wrap retaining `APP_SPACE_SIZE_TIGHT`; omitted/false byte-identical; enabled only on TaskHeatmapPage's normal nav card.
- **Kebab-case `toHaveStyle` constraint:** the test `getComputedStyle` mock (`src/frontend/src/test/setup.ts:137-211`) resolves kebab-case keys only (camelCase accessors only fontSize/fontWeight/opacity), and antd v6 Space emits wrap as inline style, never a class — future specs asserting computed styles must use kebab-case keys; documented in-code at `PageHeader.spec.tsx:208`.
- **Narrow-viewport (390px) contract:** the shell pre-exists overflow at 390px (documented; 450≡450 before/after); the tag pins page-level containment (right edge ≤ scrollWidth, no hidden/clip ancestor truncation, wrapped DOM order, row-start) — card-box containment is desktop-only; the layout spec rules out AppShell/card production changes ("keep the existing width/scroll policy").
- **Files:** production `TaskHeatmapPage.tsx` + `PageHeader.tsx`; tests `TaskHeatmapPage.legacy.spec.tsx` (274 lines), `PageHeader.spec.tsx` (277), `legacy-assignment-results.spec.ts` (362); helpers `src/frontend/e2e-tests/helpers/legacy-reassessment-tag-layout.ts` (~408) + `legacy-assignment-results-journeys.ts` (237); 11 E2E journeys (9 legacy + 2 marker-1).
- **Deviations:** line-count projections exceeded (274 vs ≤220; 277 vs 130; journeys helper created by the 550-line decomposition rule; layout helper grew for the wrap-aware/contrast work) — projections are estimates, hard limits respected; theme journeys merged (8→7 planned journeys, one toggle journey covers light/dark); antd warning contrast ≈1.83:1 makes a 4.5:1 contrast pin unachievable, so readability pins theme-toggle colour change instead.
- **Review citations:** `.opencode/scratchpad/review-section5-red.md`, `review-section5-red-rereview.md`, `review-section5-red-final.md`, `review-section5-green.md`, `review-section5-green-rereview.md`.
- **Baseline lint debt:** unchanged (4 backend / 17 frontend pre-existing warnings) — do not re-flag.

### Implementation notes / deviations / follow-up

Complete and clean through the final re-review. Appended after compaction: docs sync, section regression gate (§2.6) and commit record (§2.7).

- **Docs sync (outcome):** two files updated, no pages created — `navigation-consistency-status.md` (+34/−27: diagram, tag paragraph, `wrapActions` prop-table + design-choice entries, §2 test counts 10→15, §4 tag/wrapping bullets, file inventory 132/277 lines, Vitest total 43) and `frontend-shared-helpers-and-abstraction-standards.md` (§3.5 planned entry → Implemented, body review-verified verbatim). JSDoc in both production files verified accurate. Section 6 hand-off update: the legacy browser-journey inventories in `frontend-testing.md` / `frontend-playwright-e2e.md` must now record Section 5's final state (11 journeys — 9 legacy + 2 marker-1 — plus the two new helpers), superseding the earlier verify-only note; `frontend-data-analysis-response.md` ~L1114 reconciliation (score inclusion + tag now both delivered) also lands in Section 6.
- **Section regression gate (§2.6):** PASSED — compare mode, session `legacy-assignment-results`, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-07T14-30-40.595Z/comparison.txt` (2026-11-07T14:30Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check` (4 pre-existing `max-lines` warnings). E2E, all coverage suites, builder checks and typecheck passed.
- **Commit gate (§2.7):** commit `91e520c0` "feat(frontend): add task-heatmap reassessment tag and wrapActions (Section 5)" (10 files, +1431/−181; two production files, three specs/helpers, two docs, compacted plan) on branch `legacy-assignment-results`; pushed to `origin/legacy-assignment-results` (`fcfb673d..91e520c0`). Pre-commit hooks passed (Prettier, staged lint, `typecheck:all`). `opencode.jsonc` remains uncommitted user-managed config; worktree clean after push apart from that file.

## Section 6 — Regression hardening and plain-language documentation

### Objective and constraints

Finish the requested documentation/comment cleanup and verify the whole change. Earlier sections already reconcile behaviour/shape entries; this is the final consistency and language pass, not permission to postpone those updates.

### Outcome

Red audit confirmed all five planned contract-regression areas were already pinned, with zero test rows added and red discipline held (no manufactured failures):

- Ordinary save after legacy reads and no input mutation — `tests/controllers/abclassLegacyAssessmentPersistence.test.js` (4/4).
- Real score inclusion — `src/frontend/src/services/dataAnalysis/legacyAssessmentParity.spec.ts`.
- Shape mismatches — `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.legacyPartial.spec.ts`.
- Full/partial parity and validation mode — `tests/assignment/assignmentLegacyReadPreparation.validationMode.test.js`.
- No write on read / no read-time persistence state — `tests/synthetic-analysis/syntheticLegacyAssessmentRoundTrip.test.ts` (5/5).

Green delivered the plain-language pass: `02_AssignmentLegacyRead.js` now throws `'Legacy read preparation requires embedded tasks'` (JSDoc line updated; pinning regex `/embedded tasks/` at `assignmentRehydration.legacyIdentity.test.js:84`); “task universe” replaced by “task list”/“set of tasks” across the changed docs; certification framing removed (7 passages → 0 grep hits, constraints kept verbatim); journey inventories synced to 11 journeys + 2 helpers; `frontend-data-analysis-response.md` “Legacy assignment display” flipped to delivered; synthetic-docs round-trip consumer entry added.

All suites green: backend scoped 422/422, `legacyIdentity` 9/9, frontend coverage 3033/3033, E2E 11/11, lint baselines 4 backend / 17 frontend, `typecheck:all` exit 0.

### Retained for later passes

Not authorised by this plan; left for the plan-level §5.1 de-sloppification and §5.2 final documentation passes:

- **Plain-language boundary:** “task universe” remains only in untouched files — `02_AssignmentCurrentRestoration.js` and `ABClassAssignmentValidation.js` (throw messages + JSDoc) and their pinning tests (`assignmentRehydration.current.restorationIntegrity.test.js:154`, `ABClassAssignmentOps.completionGate.test.js:111,124,131`, `abclassReadCorruptionProjections.test.js:289`, `assignmentRehydrationCurrentSupport.js:10`, `legacyIdentity.test.js:94–96`); `backend-testing.md:185` (“prepared-projection”) is verified unrelated live completion-gate wording, not the removed projector API. A future whole-codebase sweep may address them.
- **`ImageManager.js:382`:** the code comment “retained old content never certifies hydration” is in an untouched file (future sweep candidate); the touched shape-doc passages were reworded to “treats retained old content as hydrated/valid” instead.
- **Retirement statements kept, explicitly labelled historical:** `assignment.md:147`, `assessment.md:438` (trimmed), `rehydration.md:23–24`, and the builder spec's inverted `not.toContain` guard.
- **Baseline lint debt:** unchanged (4 backend / 17 frontend pre-existing warnings) — do not re-flag.

### Review citations

- `.opencode/scratchpad/review-section6-final.md` — final section review; single Improvement (residual certification framing in five shape-doc passages), cleared by the re-review.
- `.opencode/scratchpad/review-section6-final-rereview.md` — re-review PASS; per-passage verification of the seven rewordings, technical accuracy of the hydration-sense adaptations, delta confirmation.
- Red-audit coverage map: the five areas' pinning suites are named in the Outcome above, as recorded in the pre-compaction backup.

### Implementation notes / deviations / follow-up

Section checks passed (suite results under Outcome). The section regression gate (§2.6) and commit record (§2.7) are appended below after this compaction.

- **Docs sync (§2.4):** delivered in-phase — the section's green work IS the docs rewrite (the plan's §6 Green assigns the doc rewrites to the section itself), so no separate post-review pass was needed. Scope delivered: `rehydration.md` plain-language + framing removal, both journey inventories, `frontend-data-analysis-response.md` flip, synthetic-docs consumer entry, normaliser JSDoc, shape-doc residuals (Data Shapes). The §6 acceptance criterion "no active doc reference to the removed projector API" verified by sweep: only labelled retirement statements remain.
- **Section regression gate (§2.6):** PASSED — compare mode, session `legacy-assignment-results`, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-07T15-25-59.677Z/comparison.txt` (2026-11-07T15:25Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check` (4 pre-existing `max-lines` warnings). E2E, all coverage suites, builder checks and typecheck passed.
- **Commit gate (§2.7):** commit `391eb709` "refactor(assignment): plain-language pass and doc reconciliation (Section 6)" (13 files, +81/−74: the LegacyRead message + JSDoc, the pinning regex, seven docs incl. the five shape docs) on branch `legacy-assignment-results`; pushed to `origin/legacy-assignment-results` (`2d2c6a05..391eb709`). Pre-commit hooks passed (Prettier, staged lint, `typecheck:all`). `opencode.jsonc` remains uncommitted user-managed config; worktree clean after push apart from that file.

## Plan-level passes (post-Section-6)

- **De-sloppification (§5.1):** PASS with 6 findings (2 Improvements, 4 Nitpicks), all fixed and re-reviewed clean (`.opencode/scratchpad/review-deslop-cleanup.md`): LegacyRead fails loudly on a null assignment (wiring fault, not the data bypass); one `selectedAssignment` lookup in `TaskHeatmapPage`; the duplicated backend fixture helpers consolidated into `assignmentLegacyReadPreparationSupport.js` (assertions byte-identical, net −68 lines); stale red-narration/history-narrating comments trimmed. Commit `11ea633a` "refactor: apply de-sloppification fixes (plan-level pass)" (13 files, +153/−221), pushed (`a53e3544..11ea633a`). Report-only boundaries (untouched-file "task universe" occurrences, `ImageManager.js:382` comment) remain recorded under Section 6's Retained bullets.
- **Final regression comparison (blocking):** CLEAN — report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-07T16-03-14.728Z/comparison.txt` (2026-11-07T16:03Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check`. The branch is ready for the final documentation sync.

## Section 7 — Deferred-finding cleanup (user-authorised at close-out)

### Objective and constraints

Fix the outstanding deferred findings the user approved at plan close-out: the "task universe" plain-language sweep in the previously-untouched backend files and their pins, `backend-testing.md:185`'s "prepared-projection" wording, the two stale comments (`ImageManager.js:382`, `TaskPreviewCard.tsx:176`), and the three "when next touched" items (vacuous `.markdown` negatives → `responseRenderer()`, the wire-type helper extraction for the four normaliser specs, the class-level root-check pin). No behaviour change beyond the sweep's message texts (fail-loud wording only); assertions keep their meaning; the attempt-baseline planned entry stays.

### Checks

`npm run test:backend -- tests/assignment tests/controllers`; `npm run test:frontend -- src/services/assignmentAssessment`; `npm run test:frontend:e2e -- e2e-tests/assessment-error-previews.spec.ts e2e-tests/assessment-error-merged-previews.spec.ts`; lint checks at baseline; `npm run typecheck:all`; regression gate once at completion.

### Implementation notes / deviations / follow-up

Approved by the user ("Please fix those outstanding findings") after the §5.2 final documentation pass. Delivered in four batches (sweep + pins, comments, "when next touched" items, doc lines) and reviewed clean (`.opencode/scratchpad/review-section7-cleanup.md`, PASS, zero findings).

- **Sweep result:** `grep -rni "universe" src/ tests/` → 0 hits (the private identifier renamed to `_validateCompletedTaskList` by user direction — "The whole term is bullshit!"); `docs/` → 0 hits; the only surviving occurrence in the repo is root `SPEC.md:20` (the SPEC's own instruction text quoting the term it bans). One swept find beyond the listed pins: `currentReviewCompanions.test.js` hyphenated title. The regenerable `src/frontend/node_modules/.vitest-cache/` stale cache was deleted (gitignored, untracked).
- **"When next touched" items:** 5 vacuous `.markdown` negatives → `responseRenderer()` (strictly stronger, behaviour-verified); new 118-line `src/frontend/src/test/assignmentAssessment/assignmentReadNormalisation.fixtures.ts` (only genuine duplicates extracted; spec-specific probes left local; −157 spec lines); the class-level root check pinned in `legacyPartial.spec.ts` (passes immediately — coverage-gap fix, not red-driven).
- **Section regression gate (§2.6):** PASSED — compare mode, session `legacy-assignment-results`, report `.ts-regression-checker/reports/session-legacy-assignment-results/runs/2026-11-07T17-38-11.223Z/comparison.txt` (2026-11-07T17:38Z). 0 regressions, 0 new failures, 0 fixes; 7/8 checks passing, the only failing check being the identical baseline-debt `backend-lint-check`. Note: the first gate attempt (17:13) reported a `classes-crud-mutation-summary.spec.ts` E2E regression that failed to reproduce — the spec passes in isolation (2/2) and the full E2E suite passes standalone (337/337, 9.9m); it is a flake in the checker's parallel run of the user's checkpointed in-flight harness work, not caused by this section (whose delta touches nothing that spec uses). The clean re-run supersedes it.
- **Out of scope, still open (not authorised):** the 328-line waiver stands; `SPEC.md:20` is the SPEC's own text. `opencode.jsonc` remains uncommitted user-managed config.
- **Commit gate (§2.7):** commit `2ee7178b` "refactor: sweep the invented term and clear deferred findings (Section 7)" (20 files, +218/−237: the sweep across 4 production files + 6 pin files, the two comments, the fixtures helper + 4 normaliser specs, the 2 preview-spec migrations, 2 doc lines, the plan) on branch `legacy-assignment-results`; pushed to `origin/legacy-assignment-results` (`c884128a..2ee7178b`). Pre-commit hooks passed (Prettier, staged lint, `typecheck:all`). Worktree clean after push apart from `opencode.jsonc`.
- **Close-out state:** the invented term is gone from the entire source and test tree (`grep -rni universe src/ tests/` → 0 hits) and from all developer docs; the only repo occurrence is root `SPEC.md:20` (the SPEC's own instruction quoting the term it bans). All deferred findings the user approved are fixed; the deferred-findings log is fully dispositioned with no open rows.

## Deferred and out-of-scope findings

No authorised deferrals or unresolved questions. Corrupted student IDs are an explicit scope exclusion, not a planned recovery feature. Unrelated worktree E2E edits are not part of this delivery.

| Finding | Severity | Scope rationale | Evidence | Disposition | User decision |
| ------- | -------- | --------------- | -------- | ----------- | ------------- |
| None    | —        | —               | —        | —           | —             |
