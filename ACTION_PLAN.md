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
- Planned contracts: @docs/developer/data-shapes/assignment.md and @docs/developer/data-shapes/assessment.md , preservation items marked **Not implemented**. Reconcile these items when implemented, leaving future read changes pending.
- Fixtures: Section 1 canonical `small` stored scenario; null/object/absence/Date probes local. Only touched tests migrate.

### Acceptance criteria and checks

- No ordinary save can silently replace a present legacy submissions value with an empty array.
- `npm run test:backend -- tests/assignment/assignmentRehydration.legacy tests/controllers/ABClassController/ABClassPersistence.unit.test.js`
- `npm run lint:backend:check`; contract/persistence reviewer checks exact written payloads.

### Implementation notes / deviations / follow-up

Not started. This section restores preservation only; legacy read activation comes later.

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

- **New read-preparation owner, reuse existing validation**: planned **Not implemented** entry in @docs/developer/backend/rehydration.md . Record actual API and load order there.
- Contracts: @docs/developer/data-shapes/assessment.md @docs/developer/data-shapes/student-submission.md @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/abclass.md . Keep public wire activation pending until Section 4.
- Fixtures: Section 1 `small`/`medium` stored forms; local corruption probes. No competing realistic fixture.

### Acceptance criteria and checks

- Valid legacy results survive; assessment corruption does not block healthy submissions; both read forms use the same existing validation rules.
- `npm run test:backend -- tests/assignment/assignmentLegacyReadPreparation`
- `npm run test:builder -- src/steps/backend-copy.spec.ts`
- `npm run lint:backend:check`; `npm run lint:builder:check`.

### Implementation notes / deviations / follow-up

Not started. Only the enabling helper is added here; Section 4 activates both wire ends together.

## Section 4 — Activate the legacy wire version end to end

### Objective and constraints

Change producers and consumers together. The small cross-layer coupling is necessary: backend `'legacy'` responses cannot be consumed by the old Zod union. Keep endpoint/envelope, identity checks, completed writes and analyser calculations unchanged.

### Required tests — Red

1. Full and class read version matrix: stored 1 → 1; missing/null/unsupported → `'legacy'`. Valid legacy data retained; malformed assessment items/maps become E on both reads; non-array roots reach existing frontend root rejection.
2. Zod requires `1` or `'legacy'`; version null/absent/unsupported rejected. Root not-found null remains accepted.
3. Both frontend normalisers accept healthy legacy numeric/N and explicit E without `isReassessmentItem()`. Per-item corruption isolation remains; browser `addMissingFullTasks()` stays marker-1-only.
4. Real dispatcher + GAS harness + frontend service round trip in new `tests/synthetic-analysis/syntheticLegacyAssessmentRoundTrip.test.ts`; prove no read writes, original stored marker/body unchanged, and later ordinary saves do not persist read E or `'legacy'`.
5. Mixed current/legacy data has the same task heatmap and weighted class/student/assignment averages as equivalent all-current data; assert actual expected scores/contributions, not just non-empty outputs. E/N/zero-weight semantics unchanged.
6. Existing legacy-preview browser scenario now receives real legacy scores/content. Current sibling and stored explicit reassessment-error support remain.
7. Exercise `tests/controllers/abclassLegacyAssessmentPersistence.test.js` against the new full/class read seam and original marker/body preservation. Retain `tests/controllers/abclassReadCorruptionProjections.test.js` as a marker-1 read-isolation regression. Update expectations only where the specified contract changes.

### Green and Refactor

- Wire the helper into `AssignmentSerialisation.toReadJSON()` and `ABClassResponseMapper._toReadView()` before definition-key replacement. Non-array roots pass through; set `'legacy'` on read output only.
- Delete `02_AssignmentReadProjection.js` and `projectReassessmentSubmissions()`; remove its GAS test registration and update builder assertions. Do not delete the accepted REASSESSMENT_REQUIRED cause or its stored-error preview branch.
- Update `assignmentAssessment.zod.ts`, `classDetailService.zod.ts`, and `assignmentReadNormalisation.ts`; remove only the marker-based placeholder requirement and dead arguments/helpers. Do not add frontend submission reconstruction.
- Rework `assignmentRehydration.legacy{Projection,PlaceholderShape,Authority,Identity,ReadSerialisation,SnapshotIsolation,FullDefinitionClassRead}.test.js` coverage for the new helper/callers. Preserve useful separation, rejection and ownership assertions. Update `tests/models/abclass.assessmentContracts.test.js`, `tests/controllers/abclassLegacyAssessmentPersistence.test.js`, and affected controller/API expectations. Explicitly run `abclassReadCorruptionProjections.test.js` for unchanged marker-1 isolation; the checked controller/API directories are the complete test scope, not just these named examples.
- Split legacy cases from near-limit normaliser suites into `assignmentReadNormalisation.legacyFull.spec.ts` and `.legacyPartial.spec.ts` before adding tests. Update relevant schema/service specs; place new analysis checks in focused legacy suites beside averaging/heatmap adapters.
- Update `assessment-error-preview-fixtures.ts` and `assessment-error-preview-journeys.ts` exports. Move the embedded preview spec's legacy case from `assessment-error-previews.spec.ts` to new `legacy-assignment-results.spec.ts`; run `assessment-error-merged-previews.spec.ts` unchanged as a regression. Use existing typed canonical-JSON clone helpers and change only linked full/class assignment markers; Section 1's scripts-JavaScript helper is Node-side only. Do not edit shared classes/settings runtime files.

### Helper, data-shape and fixture plan

- **Reuse** Section 3 preparation, existing frontend full/partial item checks and `corruptItem()`; no new validator or analyser helper.
- Contracts: all legacy **Not implemented** entries in @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/assessment.md @docs/developer/data-shapes/student-submission.md @docs/developer/data-shapes/abclass.md @docs/developer/data-shapes/frontend-data-analysis-response.md and @docs/developer/data-shapes/INDEX.md . Reconcile implemented read/validation rules, not unrelated planned work.
- Canonical fixtures: `small` full/class views and stored model inputs; `medium` mixed outcomes; shared legacy derivation for Node tests, existing typed canonical-clone marker flips for frontend tests; local invalid probes. Migrate only touched tests. Corpus version-1 validators and cause catalogues do not change.

### Acceptance criteria and checks

- Both wire ends agree; real legacy numeric results reach analysis and previews; no data loss or blanket replacement.
- `npm run test:backend -- tests/assignment tests/models/abclass.assessmentContracts.test.js tests/controllers tests/api/apiHandler`
- `npm run test:frontend -- src/services/assignmentAssessment src/services/googleClassrooms/classDetail src/services/dataAnalysis`
- `npm run test:synthetic`; `npm run test:builder -- src/steps/backend-copy.spec.ts`
- Playwright owns `npm run test:frontend:e2e -- e2e-tests/assessment-error-previews.spec.ts e2e-tests/assessment-error-merged-previews.spec.ts e2e-tests/legacy-assignment-results.spec.ts` (tag checks land next).
- Scoped lint `:check` commands and `npm run typecheck:all`.

### Implementation notes / deviations / follow-up

Not started. Version rollout is a single backend/frontend release; no new UI tag until Section 5.

## Section 5 — Task-heatmap reassessment tag

### Objective and constraints

Implement the reviewed layout, task heatmap only. No recent-card, metadata, standalone heatmap-builder or rerun-flow changes. Tag is read from the selected assignment in the loaded class; no new query.

### Required tests — Red

1. New `TaskHeatmapPage.legacy.spec.tsx`: legacy/current selection, tag only in normal navigation, no callback, full-preview loading/error, and title-error branch remains Back-only without tag. Scope text assertions to the navigation card because stored error reasoning can share the same text.
2. `PageHeader.spec.tsx`: `wrapActions` omitted/false preserves current DOM/layout contract; true wraps both groups with outer `APP_GAP_SM` and tight action spacing. Existing button order and callback arguments stay unchanged.
3. Playwright `legacy-assignment-results.spec.ts`: visible real score/content alongside corrupt E; no tag on recent cards/current siblings; tag before rerun/Refresh; no clipping/overlap at 1440×900 and 390×844; light/dark readability and keyboard order.
4. Add rerun-with-legacy cases to the new `legacy-assignment-results.spec.ts`, reusing existing rerun journey helpers: no optimistic tag removal; failed rerun preserves tag/results; successful rerun followed by the existing class refresh yields marker 1 and removes tag. Do not add query invalidation behaviour to the rerun flow merely for this feature.

### Green and Refactor

- Add non-dismissible warning Tag in `TaskHeatmapPage.renderNavActions()` immediately before Re-run Assessment, or before Refresh without callback. Match existing feature tags with `style={{ margin: 0 }}` so the only horizontal gap is Space's 8px spacing.
- Extend `PageNavCard` in `components/PageHeader/PageHeader.tsx` with optional `wrapActions?: boolean`; enable only on normal TaskHeatmapPage navigation. Keep title-error branch and other callers unchanged.
- Use outer `APP_GAP_SM` (8px) when opted in and existing Space spacing, with left-aligned wrapped rows. No extra wrapper component, tag helper, tooltip or live region.

### Helper, data-shape and fixture plan

- **Extend** existing PageNavCard; planned **Not implemented** entry in @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md . Follow @LEGACY_ASSIGNMENT_READ_LAYOUT.md .
- No new persisted/wire/card-model fields. Section 4 version is the only transport dependency.
- Fixtures: same linked `small`/`medium` canonical JSON views with typed local marker-only legacy derivation; local error-state variants. Reuse existing query/mock/provider/rerun helpers, without importing script-owned JavaScript or editing unrelated dirty harness files.

### Acceptance criteria and checks

- Status tag appears only at the agreed surface; scores/previews/actions work normally; current/error states and other header callers do not regress.
- `npm run test:frontend -- src/features/taskHeatmap/TaskHeatmapPage src/components/PageHeader`
- `npm run test:frontend:e2e -- e2e-tests/legacy-assignment-results.spec.ts`
- `npm run lint:frontend:check`; `npm run typecheck:all`.

### Implementation notes / deviations / follow-up

Not started. No new rerun orchestration is authorised.

## Section 6 — Regression hardening and plain-language documentation

### Objective and constraints

Finish the requested documentation/comment cleanup and verify the whole change. Earlier sections already reconcile behaviour/shape entries; this is the final consistency and language pass, not permission to postpone those updates.

### Red, Green, Refactor

1. **Red:** add any missing contract regression identified in focused review: ordinary save after legacy reads, real score inclusion, shape mismatches, full/partial parity or no-input-mutation. Use local invalid fixtures, not identity recovery or new realistic data builders. Document any check that already passes rather than inventing production code to make it fail.
2. **Green:** close gaps in scope; Docs rewrites affected legacy sections of `backend/rehydration.md`, `backend/api-layer.md`, `backend/AssessmentFlow.md`, the five shape docs and their INDEX. Update `frontend/navigation-consistency-status.md` (PageNavCard props and task-heatmap actions, preserving Back-only title-error state), and the synthetic capability/helper entries. Replace old projector references and null-marker instructions; retain accepted stored error support.
   Also update only the legacy browser-journey inventories in `frontend/frontend-testing.md` (“Playwright owns the browser journeys”) and `frontend/frontend-playwright-e2e.md` (“Assessment-error preview journeys”): record `legacy-assignment-results.spec.ts`, retained-score marker-only fixtures and the changed preview expectations. This is an inventory/behaviour sync, not broad prose cleanup. Do not edit `backend-testing.md`.
3. **Refactor:** De-Sloppification reviews changed docs/comments for filler and duplicate explanations. Replace “task universe” with “task IDs”/“tasks”; remove certification and honesty framing. Keep useful security terminology and constraints. Do not rename public APIs or change algorithms for prose cleanup. Resubmit any code change for review.

### Helper, data-shape and fixture plan

- No new helper or schema. Reconcile implemented entries in @docs/developer/backend/rehydration.md @docs/developer/testing/synthetic-test-data.md @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md and the planned shape entries listed in Section 4. Unrelated Not implemented work stays.
- Additional tests use the Section 1 canonical selection; only local invalid probes or touched-test migration.

### Acceptance criteria and checks

- No active code/test/doc reference to the removed projector API. No documented legacy wire `null`/blanket E policy remains, except explicitly labelled historical material outside this change.
- Data Shapes Agent reconciles target entries with real serialisers and schemas; Docs removes stale superseded paragraphs instead of adding another explanation beside them.
- Tests demonstrate healthy legacy scores/content and corrupt task E; no read-time storage mutation or completed-write change.
- `npm run lint:check`; `npm run typecheck:all`; `npm run test:backend`; `npm run test:frontend`; `npm run test:synthetic`; `npm run test:builder`; full `npm run test:frontend:e2e`.
- Final `npm run run-all-checks` and same-identity regression comparison. Record any pre-existing failures with baseline evidence; fix new failures without bypassing hooks.
- `git diff --check` and inspect changed files/ownership. Final clean Code Reviewer pass after Docs/Data Shapes reconciliation.

### Rollout and JSDoc

- Release backend and frontend together. No deployment or data migration is part of this plan. Existing sessions with old frontend schemas may need a reload after release.
- Preserve at most a short comment explaining the non-obvious separation: saved raw legacy bodies are not mutated by read validation. Explain validation mode vs output form only at its owner. No repeated philosophical rationale.
- Handoff includes checks run, baseline/final comparison paths, reviewed files, and confirmation that no unrelated E2E work was changed.

### Implementation notes / deviations / follow-up

Not started. Implementation must record actual evidence; this plan does not claim tests or deployment have run.

## Deferred and out-of-scope findings

No authorised deferrals or unresolved questions. Corrupted student IDs are an explicit scope exclusion, not a planned recovery feature. Unrelated worktree E2E edits are not part of this delivery.

| Finding | Severity | Scope rationale | Evidence | Disposition | User decision |
| ------- | -------- | --------------- | -------- | ----------- | ------------- |
| None    | —        | —               | —        | —           | —             |
