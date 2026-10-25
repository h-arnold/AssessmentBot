# Explicit Assessment Errors — Delivery Plan (TDD-First)

## Status and read-first context

Reviewed v1.0 — independently approved for implementation orchestration.
Implementation initiation: regression baseline executed; no production/test changes
have started. The user accepted the pre-existing backend lint warnings as baseline
debt; new failures remain blocking.
Delivery objective: issues [#322](https://github.com/h-arnold/AssessmentBot/issues/322)
and [#341](https://github.com/h-arnold/AssessmentBot/issues/341).

- Product and contract authority: @SPEC.md .
- Preview layout, copy and interaction authority: @ASSESSMENT_ERROR_PREVIEW_LAYOUT.md .
- This plan sequences delivery; it does not reopen either approved document.
- Section 1 is complete; Section 2 is in progress and Sections 3–12 are **Not started**. Record actual changes,
  checks/report paths, deviations and downstream implications under each section.

### Baseline execution record

- Command: `npm run regression-checker -- assessment-errors-322-341` with
  `1200000 ms` timeout; completed 23 October 2026.
- Report: `.ts-regression-checker/reports/session-assessment-errors-322-341/baseline/baseline.txt`.
- Result: **FAILING**, seven checks passing and one failing. Backend lint has
  six pre-existing `max-lines` warnings and exits 1; no lint errors. Backend,
  frontend and builder coverage tests, complete Playwright suite, frontend/builder
  lint and TypeScript compilation pass. Zero regressions/new failures in baseline mode.
- The user explicitly accepted these six pre-existing warnings as baseline debt.
  Proceed with Section 1 and the plan's scheduled test splits; new failures remain
  blocking. No lint rule or gate has been disabled.
- Preserve the pre-existing modified agent configuration and canonical planning
  documentation. No commit, push or deployment is authorised.

## Deferred and Out-of-Scope Findings

| Finding                                                                                | Severity | Scope rationale                                                                                                                                                                                   | Evidence                                                                                                                                                  | Disposition | User decision                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corpus regeneration timing versus complete-section Red collection                      | Material | Sequencing ambiguity: Red must collect before consolidated review, but committed-fixture regeneration was scheduled in Green                                                                      | Schema suite collects zero tests; preview/oracle focused run has 13 corpus-marker failures; `.opencode/scratchpad/remaining-red-preview-oracle-tests.log` | approved    | User authorised fixture-only regeneration during Red, twice for reproducibility; finish all Red work before consolidated review; final section gates unchanged                                                    |
| Existing source-less ready browser state contradicts current null-parent contract (R3) | Material | Existing journey requires ready body and numeric/N beneath null parent; criterion 16 preserves journey intent but criteria 4/5 require corruption, while new error-preview journeys were deferred | `task-preview-source-link.states.spec.ts:38–52`; `.opencode/scratchpad/section2-consolidated-red-review.md` R3                                            | approved    | User approved reconciling this existing journey to valid acquisition E, retaining no-unsafe-link assertion and removing incompatible ready-content requirement; no new journeys/UI; report any current-UI blocker |

| Red checkpoint commit hook versus intentionally deferred E type | Material | User now requests Red checkpoint commit/push, but mandatory pre-commit typecheck fails until additive E type contract is activated | `.husky/pre-commit:62–64`; `averagingAnalyser.criterionAccumulation.ts:226` TS2345 | approved | User approved adding E to existing input type and updating adjacent comment during Red; no runtime Green fix, assertion change or hook bypass |

| Red checkpoint push destination | Material | Current worktree has detached HEAD; user authorised commit/push after clean Red but no destination branch was selected | `git branch --show-current` returns empty | approved | User selected a new dedicated assessment-error branch; create assessment-errors-322-341 or a non-conflicting suffix after clean Red, preserve unrelated work |

| Red checkpoint root authorities and interleaved feature scope | Material | Section 1 and Section 2 plan-owned hunks are interleaved; root plan/spec/layout are untracked feature authorities | Read-only ownership preflight: 157 proposed feature paths, seven in-status exclusions; no pre-Section-1 Git status baseline or section-isolated diff | approved | User approved the combined Section 1 + Section 2 feature checkpoint including ACTION_PLAN.md, SPEC.md and ASSESSMENT_ERROR_PREVIEW_LAYOUT.md; unrelated edits and runtime outputs remain excluded |

## Scope and assumptions

### User-authorised Red checkpoint commit

The user now authorises committing and pushing plan-owned changes AFTER the complete
Section 2 Red review is clean and BEFORE starting remaining Green work. This supersedes
the earlier blanket no-commit/no-push instruction for this checkpoint only. Preserve
and exclude unrelated pre-existing edits; no deployment authorised. This checkpoint
is not section completion and does not waive final Section 2 regression/Green gates.
Pre-commit hooks must pass without bypass. `.husky/pre-commit` runs `typecheck:all`,
so the planned E-score type incompatibility currently blocks the requested commit.
Ask whether to move only the additive E input type declaration into Red preparation;
runtime Green changes remain deferred. The user approved this type-only change;
it is now implemented and `typecheck:all` passes. No checkpoint commit yet: the
complete consolidated Red review must still finish cleanly. The current worktree
has detached HEAD (`git branch --show-current` is empty); ask the destination branch
before checkpoint commit/push, and do not stage unrelated pre-existing changes.

### Scope

Explicit Assessment E/reasoning/cause; full and partial result contracts; current and
legacy read projections; acquisition/extraction/image/LLM failure handling; bounded
transport retries and validated caching; prepared persistence; analysis and previews;
canonical fixture capability, tests and same-change documentation.

### Out of scope

The exclusions in SPEC remain binding: no storage redesign or transaction framework,
persistent jobs/error history, LLM-service change, criterion salvage, semantic retries,
new student-match policy, bulk migration/deletion, read-time repair, full-preview-driven
aggregate recalculation, new dashboard or application-wide error boundary.

### Assumptions and settled sequencing

1. The original production bypass causing absent transport keys is still unconfirmed.
   Tests prove the agreed defences, not a claimed reproduction of the original incident.
2. Deploy frontend and backend together only after all gates. Intermediate sections
   are implementation checkpoints, not separately deployable releases.
3. Section 1 is additive. Section 2 is one atomic read-contract/corpus cut-over because
   existing fixtures omit accuracy/the marker, contain empty result maps and strip all
   partial reasoning. Splitting activation from regeneration would invalidate existing
   schema/model round trips. Its substeps have focused checks but share one full gate.
4. No product decisions, open questions or deliberately deferred decisions remain.
   Scope exclusions are not deferrals. No deployment or commit is authorised by this plan.

## Global constraints and quality gates

### Engineering and fixture constraints

- Check `git status --short` before editing. Preserve the pre-existing planning/model
  configuration changes; do not overwrite work from another agent.
- Follow existing GAS globals, guarded exports, private API helpers, `apiHandler` and
  `callApi` boundaries. No production import of synthetic/test code or backend import
  into frontend runtime code. No new endpoint or envelope shape.
- Keep validation/error boundaries narrow. Explicit raw-data rejection is isolatable;
  programming, routing and storage faults throw. Use safe catalogue reasoning and
  structured diagnostics, never payloads, credentials or student names in logs.
- Keep defaults in constructors; preserve explicitly supplied nulls. Opportunistically
  correct imports/default placement only in touched code and without changing semantics.
- Canonical realistic graphs: `small` `transport.classesById` and
  `transport.assignmentsByKey`, selecting healthy rows; `medium` for mixed outcomes.
  Backend model inputs use `loadBackendModelInputs` from the existing adapter. Frontend
  Vitest uses the existing canonical selectors/raw imports; Playwright uses direct JSON
  imports, not Vitest `?raw` imports. Clone frozen fixtures before deliberate mutation.
- Section 2 extends the existing generator, not profiles/views or a competing realistic
  fixture family. Until that capability lands, focused contract probes may stay local
  under the recorded generator-extension exception. Invalid/boundary records, HTTP/GAS
  failures and corrupt copies remain local afterwards too.
- Migrate only tests/helpers touched by this feature. Do not turn supplied class metadata
  snapshots into calculated-average oracles or change unrelated metadata policy.
- Required contract/view-model fields also require mechanical adaptation of existing
  typed fixture literals in that field's activation section, during Red, even when
  new behavioural matrices live in companion suites. Keep existing assertion intent;
  preserve deliberately invalid probes as invalid. Do not weaken a required production
  field, use whole-object casts or add a fallback merely to preserve an old fixture.
  Additional discovered fixture owners follow the same recorded sizing/splitting gate.

### Mandatory TDD and review loop

For every implementation section: **Red** (new behavioural assertions fail for the
intended reason), **Green** (smallest production change), **Refactor** (tests remain
green), focused checks, then the full section gate. Characterisation-only moves also
retain existing tests; do not manufacture production code to make a test fail.

Delegate Vitest/backend tests to **Testing Specialist**, production work to
**Implementation**, browser tests to **Playwright**. Submit each non-trivial resulting
diff to **Code Reviewer**, return findings to Implementation/the test owner, and repeat
until clean. **Data Shapes Agent** updates implemented contracts before code-review
sign-off; **Docs** reconciles behaviour/helper documentation in the same section.
Use **De-Sloppification** for final in-scope cleanup, then re-review any changes.

Before Section 1, establish a baseline with
`npm run regression-checker -- assessment-errors-322-341`. Use that same ID at each
complete section gate and after final cleanup if it changes files; set shell timeout
to **1200000 ms**. Do not run it between Red/Green/Refactor. Record report path,
regressions and new failures. New/unaccounted failures block progression and any
later commit; never bypass hooks or disable lint rules. A checker baseline does not
waive the final `npm run run-all-checks` gate.

### Delegation mandatory reads

Every delegated phase receives the common set plus its section's named sets/additions,
as actual `@`-prefixed tokens in the prompt, not just these set names. This applies to
Testing Specialist, Implementation, Code Reviewer, Docs, Data Shapes Agent and
De-Sloppification; Playwright additionally receives the browser set. Each handoff
also names the changed files, exact red cases/findings and acceptance criteria.

| Set         | Mandatory reading                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Common      | @SPEC.md @ASSESSMENT_ERROR_PREVIEW_LAYOUT.md @ACTION_PLAN.md                                                                                                                                                                                                                               |
| Backend     | @docs/developer/backend/backend-testing.md @docs/developer/backend/backend-logging-and-error-handling.md @docs/developer/backend/AssessmentFlow.md @docs/developer/backend/rehydration.md @docs/developer/backend/backend-file-organisation.md                                             |
| Frontend    | @docs/developer/frontend/frontend-testing.md @docs/developer/frontend/frontend-architecture.md @docs/developer/frontend/frontend-logging-and-error-handling.md @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md                                               |
| Analysis/UI | @docs/developer/frontend/data-analysis-architecture.md @docs/developer/frontend/frontend-loading-and-width-standards.md @docs/developer/frontend/frontend-react-query-and-prefetch.md @docs/developer/frontend/metric-display-precision.md @docs/developer/frontend/metric-icon-display.md |
| Contracts   | @docs/developer/data-shapes/INDEX.md @docs/developer/data-shapes/assignment.md @docs/developer/data-shapes/assignment-definition.md @docs/developer/data-shapes/abclass.md @docs/developer/data-shapes/frontend-data-analysis-response.md                                                  |
| Corpus      | @docs/developer/testing/synthetic-test-data.md                                                                                                                                                                                                                                             |
| API         | @docs/developer/backend/api-layer.md                                                                                                                                                                                                                                                       |
| Builder     | @docs/developer/builder/builder-script.md                                                                                                                                                                                                                                                  |
| Browser     | @docs/developer/frontend/frontend-playwright-e2e.md                                                                                                                                                                                                                                        |

### Sizing and separation gate

Physical LOC were checked during planning. All production/generator current→projected
budgets in SPEC's **Production module sizing budget** are incorporated here; section
constraints below assign their owners. Projected **over 500** requires an explicit
domain split, rather than compressed formatting. This is the planning margin; the
canonical backend/frontend hard trigger remains 550. Standalone new test suites target
at most 300 lines; modules created by separating oversized existing suites target at
most 380. Additions to smaller existing tests target at most 500 overall. Perform a
required test split in that section's Red phase, before extending the affected suite;
no committed section may leave an over-budget intermediate file behind.
Recount before extending any additionally discovered module and record a concrete
separation if the estimate crosses 500; this is a maintenance gate, not a product deferral.

## Section 1 — Add result primitives and separate submission responsibilities

**Status: complete.** Additive result/partial primitives only. Independent full-section sign-off is **PASS** (`.opencode/scratchpad/review-section1-clean-signoff.md`, G1–G11 resolved).

### Implemented outcomes

- `Assessment` owns catalogue/result validation and error construction: it round-trips numeric fractions in [0,5], N and E; rejects NaN/infinity, out-of-range scores, missing/whitespace E reasoning, invalid stage/code pairs and error metadata on non-E; and preserves non-blank reasoning without trimming.
- The former 387-line `StudentSubmission.js` is split into `Models/StudentSubmission/00_StudentSubmissionItem.js` (item model: atomic task-error replacement, raw full/partial item validation and partial projection) and `Models/StudentSubmission/index.js` (submission entry). Both stay within the 320-line budget; public classes/methods are preserved and no obsolete source copy survives.
- Atomic task failure replaces every old criterion. Partial E retains reasoning/cause, partial success/N remains score-only, and in-flight incompleteness is still permitted. Content replacement invalidates old assessments and feedback, including reuse of an existing item; unchanged content is not reclassified. Partial restoration never hashes redacted content, and missing full keys remain detectable by raw validation.
- Generated GAS output places item support before the submission entry, and Node test setup exposes both globals in the same order.
- Import-path/global migration covers `tests/smoke.js`, `tests/helpers/modelFactories.js`, the touched model, assessor, request-handler and serialisation suites, and `tests/setupGlobals.js`. `backend-copy.spec.ts` exercises the real repository source tree and asserts both copied files, content match and relative order; there is no concatenated bundle.
- Shared frontend `services/assignmentAssessment/assessmentResult.zod.ts` (the single result/cause schema owner) and its co-located spec are added. They are **additive and unconsumed**: consumer activation, graph coverage, markers, normalisers, analyser and preview remain Section 2+ work.

### Verification and completion gates

- Backend: **2,991 tests / 213 files pass**; branch coverage **85.04% (3,280/3,857)** against the unchanged 85% gate. Frontend 2,902 tests / 299 files and builder 252 tests / 23 files pass.
- Focused additions (`Assessment.validation`, `studentSubmission.validation`, `.contentReplacement`, `.branchCoverage`, the frontend schema spec and the extended builder spec) remain within module/test budgets.
- Lint: backend exits non-zero solely for exactly six explicitly accepted pre-existing max-lines warnings, with zero errors; frontend exits 0 with its unchanged 19 baseline max-lines warnings; builder passes. Frontend `tsc -b` and builder compile pass.
- Section-completion regression gate: **zero new failures and zero regressions** (seven checks pass, including full Playwright) against the accepted baseline: `.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-23T12-05-26.865Z/comparison.txt`. Overall checker status remains FAILING solely for the six accepted unchanged backend max-lines warnings.
- Documentation/Data Shapes implemented slices are updated: `AssessmentFlow`, frontend helper register §9.29 and `assignment.md` result/partial entries. Later planned graph/marker/read slices remain `Not implemented`.
- No commits, push or deployment were performed.

### Cross-section handoff

`assessmentResult.zod.ts` is available for Section 2 to consume, but no production read consumer uses it yet. Do not assume changed wire schemas or graph-read rules are active until Section 2 lands.

## Section 2 — Atomic read-contract and canonical-corpus cut-over

### Current execution checkpoint

- **In progress, substep 2a Green.** Section 1's completed gate remains valid.
  Generator/projection changes are implemented but not yet reviewed; validators are
  in progress. Committed corpus regeneration and substeps 2b–2d have not started.
- Testing Specialist added
  `tests/synthetic-analysis/syntheticAssessmentContract.test.ts`,
  `syntheticAssessmentProjection.test.ts` and
  `syntheticAssessmentValidation.test.ts` in that same directory.
- Initial review: `.opencode/scratchpad/review-section2a-red.md` (R1–R7).
  Latest independent review:
  `.opencode/scratchpad/review-section2a-red-rereview.md` (**FAIL**, F1–F8).
- Fresh reviewer checks: synthetic lint and `npm run typecheck:all` pass.
  Synthetic coverage invocation has 37 files / 409 tests, **22 failing / 387 passing**;
  failures are confined to the three new suites. This is **not** passing coverage or
  clean Red evidence: some failures are intended missing capabilities, but invalid
  controls and contradictory assertions remain. No failure has been waived.
- Resume by repairing the tests, not by implementing production to fit invalid probes:
  F1 full source retention versus partial-only redaction; F2 raw spreadsheet grids
  rather than JSON strings; F3 array/keyed task IDs, partial-only eligibility and exact
  roster-index-2 preservation; F4 assignment/student/task-scoped full AND partial E
  lookup and exact catalogue copy; F5 valid acquisition controls and isolated mutations;
  F6 valid IMAGE baseline and scoped unavailable-source mutation; F7 independently
  valid persistence/full/partial boundary matrices without aliasing; F8 unknown/raw
  narrowing instead of broad graph assertions and pervasive `any`.
- R3 raw source-marker probes correctly distinguish copied source values from per-view
  defaults; retain them. Existing absent marker, missing generated E and missing new
  validator rules are intended Red, not reasons to delete tests.
- Next gates: specialist test repairs → clean independent Red review → Section 2a
  Green, then the remaining ordered substeps. **No full regression comparison within
  this atomic cut-over**; run it only once all Section 2 work and reviews are complete.
  No commits, pushes or deployment.
- Continuation: the user explicitly requested `opencode-go/glm-5.3-flash` for the
  Testing Specialist; subsequent testing handoffs use that verified model ID.
  Contract/projection repairs were split coherently into a null-document companion
  and raw-guard support. Validator repairs now use independent persistence/full/class
  owner contexts, raw narrowing, and separate source/rule/null-document matrices.
  Latest review: `.opencode/scratchpad/review-section2a-red-glm-rereview.md`.
  It confirms prior F1/F2/F8 core repairs and identifies remaining G1–G5.
  Specialist subsequently repaired G1–G4: submissions-array traversal, score-only
  partial numeric/N mutation, target-bearing error-rule assertions, and document-bearing
  missing-task coverage with separate legitimate no-submission acceptance. Focused
  lint/type/formatter checks pass; expected behavioural Red is retained, not waived.
  All suites/helpers remain at most 300 lines (largest matrix 290).
  G5 definition/source/cause testing produced partial new
  `syntheticAssessmentDefinitionSourceMatrices.js` and
  `syntheticAssessmentSourceStateMatrices.js` files, but the background specialist
  returned no response and the required one retry also returned no response. These
  partial edits were preserved and subsequently completed/validated after the user
  temporarily authorised the default testing model. The user then explicitly selected
  `opencode-go/glm-5.3-flash` for **both Implementation and Testing Specialist**.
  That historical model choice was superseded by the user's latest instruction:
  use the regular configured models for Implementation and Testing Specialist.
  Write handoffs in full English with explicit acceptance criteria and restraints,
  and attach narrowly relevant files only, not blanket documentation sets.
  G5/H1/H2 repairs are complete, including exact catalogue reasoning and valid blank
  templates. Final independent **CLEAN RED**:
  `.opencode/scratchpad/review-section2a-red-h1h2-final.md`.
- Green generator/projection milestone (GLM Implementation): marker set on persistence
  and copied by both whitelist owners; complete three-criterion results with accuracy;
  explicit assessment/acquisition variants; usable IMAGE/SPREADSHEET bodies; partial E
  reasoning/cause retention. Changed existing generation/projection stages plus the
  deterministic primitive helper. Focused Contract/Projection/NullDocumentVariant:
  **10 tests pass**, synthetic lint/typecheck/formatter pass. No fixtures regenerated.
  Validator owners are implemented; the initial 661-line helper was split into coherent
  assessment-entry, artefact-source, record-guard and submission-state modules before
  independent review. The eight initial Green review findings were repaired with
  targeted Red tests: valid PNG bytes, marker checks, complete paired cause catalogue,
  task identity, reference formulae, placeholder maps, null hashes and blank student grids.
  Re-review: `.opencode/scratchpad/review-section2a-green-rereview.md`.
  It confirms those repairs but identifies strict cause types/keys, explicit full
  null-parent fields/maps/discriminators, full numeric/N reasoning, and PNG oracle gaps.
  GLM Testing Specialist added **49 intended Red** rows for the three guard gaps and
  strengthened the PNG oracle with independent inflation/raster checks (green).
  GLM Implementation repaired all three guard gaps; the test owner reconciled the
  older IMAGE placeholder acceptance case to a document-bearing extraction placeholder,
  preserving strict null-parent base artefacts. Final scoped **Section 2a CLEAN**:
  `.opencode/scratchpad/review-section2a-jsdoc-final.md` (functional review:
  `.opencode/scratchpad/review-section2a-green-final.md`). Synthetic suites report
  **730 passed / 17 unresolved**; lint/type checks pass. The **17 unresolved** consumer-schema, stale-assertion
  and committed-corpus failures belong to the coordinated 2c/2d cut-over, not an
  accepted baseline. No fixture regeneration or full regression gate has run.
  Section 2b current-restoration Red is independently clean:
  `.opencode/scratchpad/review-section2b-final-registration.md` (54 tests;
  39 intended Red, 15 passing controls). Current-format implementation is in progress,
  with coverage/source/partial suites now passing (28 tests in the latest focused run).
  A current-restoration helper was extracted; initial lint and integrity repairs
  are complete. All 54 original current-restoration tests pass; the broader targeted
  model/factory run passed 210 tests. Independent review then passed the complete
  backend coverage gate (3,045 tests; 85.06% branches) but found five additional
  current-format contract gaps:
  `.opencode/scratchpad/review-section2b-current-independent.md`.
  These concern complete raw artefact validation, body/hash pairing, shared root/task
  identity, deterministic timestamps and model-instance inputs. Those gaps and three
  subsequent TABLE/canonical-task-id/blank-grid preservation findings are now repaired
  with independently reviewed regression tests. Final **CURRENT-format scoped CLEAN**:
  `.opencode/scratchpad/review-current-c1c3-final.md`; **3,101 backend tests pass**.
  Lint has zero errors and only the six accepted historical warnings. This is not
  overall Section 2b approval. Legacy projection/persistence Red tests are delegated
  in background, alongside narrow canonical data-shape status updates. The synthetic
  capability guide now records implemented generators/validators with corpus cut-over
  explicitly pending. Remaining 2b read integration and 2c/2d have not started.
  Section 2 remains incomplete; no full Section 2 regression gate has run.
- Legacy Red readiness: `.opencode/scratchpad/legacy-red-test-review.md` records
  twelve bounded test repair/addition units. The existing legacy tests are not
  accepted as complete coverage. Projector rejection/marker setup, class mapper
  fixture and marker-first opacity tests are repaired/added, and placeholder-shape
  coverage is added; timestamp/deep-detachment, identity, authority and shared-read
  suites have also been drafted but are not accepted. Some contain incomplete
  coverage or invalid assumptions, including an unapproved extra projector argument
  and remaining lifecycle fixture errors. The completed expanded-test audit is
  `.opencode/scratchpad/legacy-expanded-test-audit.md` (**FAIL, not CLEAN RED**).
  Ordinary read-save/current-replacement safety and actual registry/purity seams
  remain unresolved. No absent-method failure is treated as proof that downstream
  assertions are sound.
  The original current-restoration family is independently confirmed **54/54 green**.
  No legacy production implementation has started.

- Scope constraint (24 October): the user explicitly requires tight adherence to
  the plan and warns against excess tests. Repair existing tests first; the audit's
  suggested coverage additions are not a separate authorised expansion of the plan.
  No new test cases, suites or helpers were added in this repair pass.
  Audit A's projector signatures (excluding the separately defective authority
  suite), C's placeholder oracles and D's mapper oracles now have clean scoped
  review: `legacy-signature-repair-confirmation.md`,
  `legacy-C-repair-followup-review.md` and `d-repair-independent-review.md`
  under `.opencode/scratchpad/`. Existing scoped tests remain intentionally Red.
  Authority and persistence fixture repairs, timestamp oracles and overall legacy
  readiness remain unresolved. These scoped approvals do not authorise legacy
  production implementation or claim the Section 2 gate has passed.

- Legacy readiness (24 October follow-up): B/E/F/G/K repairs to the existing
  authority, persistence, timestamp and read-serialisation cases are complete.
  Final **CLEAN RED implementation readiness**:
  `.opencode/scratchpad/legacy-two-corrections-review.md`. No cases or suites were
  added. Optional expanded-audit H–J matrices are not implementation blockers.
  Marker-first opaque persistence implementation is now under independent review;
  the six marker/form opacity cases and three mixed persistence cases pass, as do
  the original 54 CURRENT tests. A pre-existing metadata test's invalid current
  fixture was corrected in place. Four superseded catch/reconstruct/drop/diagnostic
  cases were removed from the existing factory coverage suite, not replaced by
  another matrix: its eight retained cases plus CURRENT 54 pass (62 total).
  Shared detached projection and approved read wiring remain pending. No full
  Section 2 gate or overall Section 2b completion is claimed.

- Backend Section 2b follow-through: opaque persistence, the shared pure projector
  and model/class read wiring now have clean scoped review:
  `.opencode/scratchpad/opaque-pure-projector-jsdoc-signoff.md` and
  `.opencode/scratchpad/model-marker-typo-confirmation.md`.
  `getAssignment_` now selects `toReadJSON()` after existing full-definition
  resolution. Its review found no functional defect; final closure awaits the
  endpoint documentation reconciliation (`section2b-api-review.md`). All **3,166
  backend tests and coverage pass** (85.22% branches); six accepted historical
  lint warnings remain, with no new errors. Existing API cases were updated in
  place; no extra API matrix was added.
  Backend process docs are updated, narrow data-shape/endpoint status updates are
  in progress. Legacy compatibility is temporary and will be reviewed on **24 April
  2027**, not automatically expired. Section 2c's explicitly planned full-read
  normalisation Red spec is delegated in background with an eight-case cap; no
  frontend production activation or corpus regeneration has started. The full
  atomic Section 2 regression gate remains deferred until 2a–2d are complete.

User-requested maintenance: after each complete section passes its independent
review and regression gate, have Docs compact it to outcomes, essential handoffs
and verification evidence. Section 1 has been compacted from 141 to 25 lines.
Do not compact an incomplete section or discard unresolved findings.

Continuation checkpoint — Section 2c Red:

- **COMPLETE SECTION 2 CLEAN RED confirmed** by same whole-section final sign-off:
  `.opencode/scratchpad/section2-consolidated-red-signoff.md`. Criteria 1–16 manual
  walkthrough complete, no remaining test/fixture/comment findings; R13/N4 closed.
  Overall automated verdict remains FAIL solely for intentional runtime Red, not
  readiness: frontend nine cases/16 assertion records and backend two/four (11/20).
  These remain required Green work, not accepted technical debt. All-project types
  pass; content/parity eight tests and nonquiet scoped lint pass independently.
  Owner's claimed R13 validation log was absent; reviewer independently replaced
  evidence with `signoff-focused-tests.txt`, `signoff-focused-lint-corrected.txt`,
  `signoff-typecheck-all.txt` and `signoff-prettier.txt` in ignored scratchpad.
  Proceed with user-approved combined feature Red checkpoint on dedicated branch,
  including three root authorities, excluding all seven unrelated/runtime status
  entries. Hooks must pass normally; no runtime Green until commit and push recorded.
  This checkpoint does not complete Section 2 or trigger its final regression gate.

- R13/residual N4 repaired in the existing content spec only: canonical IMAGE and
  SPREADSHEET adoption preserves target task ID and remaps the task-derived UID
  suffix; assertions verify association and canonical non-mutation. Two comments
  now identify canonical cases truthfully. Eight focused content/parity tests,
  formatting, scoped lint, all-project types and diff checks pass; evidence in
  `.opencode/scratchpad/section2-r13-n4-validation.log`. Same full-section Red review
  resubmitted for final sign-off using completed cumulative walkthrough. No clean
  Red verdict, staging, commit/push or runtime Green yet.

- Consolidated walkthrough is now COMPLETE for criteria 1–16; remaining unread
  inventory is empty. Report: `.opencode/scratchpad/section2-consolidated-red-complete-review.md`.
  Red readiness still FAIL pending two in-scope findings in the existing lookup
  content spec: R13 canonical IMAGE/SPREADSHEET artefacts retain foreign task IDs
  when adopted by the ready task; residual N4 labels those canonical cases local
  exceptions. Test owner must preserve target associations and canonical source
  bodies without mutation, correct the two comments, then resubmit the SAME full
  section review using cumulative complete walkthrough evidence. Intentional runtime
  Red remains 11 cases/20 assertion records; types pass. No staging or Green yet.
  Carry forward Green docs correction: metric-display-precision.md must acknowledge
  supported fractional individual scores, without changing presentation precision.

- User approved inclusion of all three root feature authorities in the combined
  Section 1 + Section 2 checkpoint; do not ask this scope decision again. Latest
  consolidated reviewer invocation ended with usage-limit error and no new verdict.
  Retry once from the saved exact unread inventory and cumulative repair evidence;
  if delegation fails again, stop and ask the user. No clean Red, staging, branch,
  commit, push or runtime Green is claimed by this continuation.

- Read-only checkpoint ownership preflight returned: detached HEAD/index empty,
  `origin` remote configured, no locally known assessment-errors-322-341 collision;
  user already authorised that new branch or non-conflicting suffix (no repeat
  branch decision needed). Proposal 157 feature paths excludes four pre-existing
  agent definitions, ACTION_PLAN_TEMPLATE.md, unknown draft-scratch.md and .vitest
  runtime cache; ignored scratch/reports/dependency outputs never staged. Candidate
  counts are snapshots, not final git-add lists; final content must be audited after
  clean review. S1/S2 hunks interleaved, historical baseline ownership relies on plan
  plus actual diff review, not section-isolated Git history. Root plan/spec/layout
  inclusion and combined checkpoint scope asked before staging. No files were staged,
  branch created or push attempted; review is still active, all repair owners done.

- R11/R12/N4/N5 repair batches complete: serializer helper positives now precede
  intentional rejection; service nested task-2 artefacts independently checked/coherent;
  specified new synthetic defaults removed with explicit callers; historical test
  status wording corrected. Synthetic lint/172 targeted tests/scoped types pass;
  final `typecheck:all` passes after service fixture type errors were fixed. Backend
  targeted serializer retains one intended rejection, services two intended cases.
  SAME consolidated whole-section review has resumed its remaining source/frontend/
  transport/journey/canonical-doc walkthrough, with already-completed synthetic and
  current/legacy walks retained as continuity. No per-file approval, runtime Green,
  staging or checkpoint commit yet. Read-only candidate-ownership inventory is active.

- Third consolidated Red continuation remains **FAIL / manual inventory incomplete**:
  `.opencode/scratchpad/section2-consolidated-red-final-review.md`. Current intentional
  ledger is 11 cases / 20 assertion records (nine frontend cases/16 plus two backend
  cases/four), all-project types and affected 69 browsers pass. R1–R10/N1–N3 repairs
  are observed resolved except recorded further wording; no runtime Green performed.
  New in-scope Red repairs: R11 hard nonlegacy serializer rejection skips retained
  helper positives; R12 service task-2 definitions keep nested task-1 artefact IDs;
  N5 three newly added synthetic helpers have parameter defaults; N4 further test
  descriptions still assert pre-cut-over/missing behaviour. Repair all, then resume
  SAME whole-section review with its now-shorter exact unread checklist, not interim
  per-file reviews. All synthetic test/support families now read; remaining source,
  frontend controls/transport, journeys and canonical docs still need manual coverage.
  Green G7 ledger corrected: obsolete PartialAssessmentScoreSchema is imported by
  syntheticGraphIntegrityAndScenarios.test.ts; migrate that test to shared schema owner
  before removing export, preserving non-E assertions. No clean Red/commit/push yet.

- All continued-review repairs are complete and SAME whole-section Red review has
  resumed with previous reports' cumulative unread checklist. Final affected browser
  pattern **69/69 passes without a flaky/retry summary** after measured-header wait
  repair; log `.opencode/scratchpad/section2-red-repairs-final-browser-pattern.log`.
  Prior failed attempt retained in reliability disposition, no baseline waiver.
  Existing nonlegacy serializer coverage case now pins loud rejection of plain
  submissions without `toJSON`; valid typed-current and opaquelegacy controls pass
  (20 passing/one newly intended backend rejection failure). R10 adds another intended
  backend case with three default-mode failures and passing explicit full/partial
  controls. Do not reuse earlier backend-all-green totals as final-tree outcome.
  Approved additive E type removes old type Red; `typecheck:all` passes. No runtime
  Green fix or checkpoint commit yet. New assessment-error branch/commit/push is
  authorised only AFTER complete Red review is independently clean, with hooks intact.

- User selected a NEW dedicated assessment-error checkpoint branch; create only once
  whole Red is clean, then commit/push plan-owned changes with hooks passing before
  runtime Green. All current consolidated repair batches returned: R9 nested task
  links/preflight pass; R10 default-full mode defect now has independent valid full
  sibling and genuinely redacted partial control; R5 trailing call count executes;
  N3/N4 test defaults/headers corrected. Type-only E union approved and implemented,
  `typecheck:all` passes. Sheets source-action flake investigation found missing
  measured-header synchronisation already present in Slides; reused it, no sleeps,
  force clicks, assertion weakening or UI change. Targeted Sheets run passes first
  attempt; prior flaky attempt retained, not waived. Disposition:
  `.opencode/scratchpad/section2-source-link-reliability-disposition.md`.
  Full affected browser pattern will validate final tree serially before same
  consolidated review resumes remaining manual checklist. No clean Red/commit yet.

- Approved E input union/comment change implemented in `averagingAnalyser.types.ts`;
  focused analyser 12 tests pass and **typecheck:all passes**, removing known hook
  blocker without runtime feature fixes. R10 Red controls repaired: explicit-full and
  genuinely redacted explicit-partial pass; default raw-partial mode path alone has
  three intended assertion failures (17 pass/one failing case across two suites).
  R5 trailing count now executes; N3 explicit helper arguments and N4 backend test
  headers pass scoped checks (41 comment-only regression tests). R9 nested canonical
  artefact linkage repaired, real normaliser preflight and seven heatmap tests pass.
  Browser reliability investigation/N4 browser wording still active; no review restart
  until all findings dispositioned. Branch preflight found detached HEAD; checkpoint
  branch decision asked before committing/pushing after clean Red.

- User **approved type-only Red preparation** to unblock mandatory checkpoint hooks:
  add E to existing `averagingAnalyser.types.ts` score union and update its adjacent
  comment only. Runtime service/normaliser/mode/serializer Green fixes remain deferred.
  Include additive type in full consolidated Red review; all hook checks must pass.
  This supersedes the pending type sequencing question below, not clean-Red requirement.

- New user direction: commit and push plan-owned changes once WHOLE Section2 Red is
  independently clean, before Green. No unrelated staging/hook bypass/deployment.
  Hook blocker discovered: required `typecheck:all` fails on intentionally planned
  E-score declaration gap. Additive type-only sequencing change is asked before action.
  R10 Red fixture repair remains incomplete: latest main-current probe's sibling is
  not independently valid under full/partial controls, target mode defect still Red.
  Focused 17 pass/one failing case is NOT clean readiness; final scoped checks pending.

- Continued consolidated Red review is **FAIL / manual walkthrough still incomplete**:
  `.opencode/scratchpad/section2-consolidated-red-rereview.md`. Fresh full frontend:
  2,914 pass / nine intended failing cases / 16 assertion records. New in-scope
  findings: R9 remapped browser task definitions retain foreign nested artefact task IDs;
  R10 raw stored `representationMode` can select partial restoration on full reads
  (add Red protection now, explicit-boundary/constructor-owned mode fix in Green).
  R5's unknown-task negative executes but hard rejection still skips trailing call-count
  assertion. N3 new backend test-helper parameter defaults and N4 stale source/test
  comments recorded; production comments remain Green-quality backlog, test wording
  and defaults repaired during Red. All remain open pending consolidated verification.
  Additional authorised Green cleanup: remove obsolete NONlegacy plain-submission
  serializer fallback while preserving opaque legacy branch; covered by criterion 8.
  Broader browser pattern: 68 passed / one retry-passed flake (Sheets source-action
  activation); not accepted debt or clean first-attempt evidence. Investigate and
  disposition before final browser gate; retain failed attempt. Unread checklist is
  now the continued report's §Exact updated unread checklist; previously completed
  backend/generator walks must not be needlessly restarted. No Green/review approval.

- ALL consolidated Red repair batches have returned. R6/R7/R8 now use independent
  schema-parsed sibling oracle, offending full null-parent source IDs, and marker-null
  non-reassessment E alongside numeric/N in BOTH modes. Specs 466/500 lines; scoped
  checks pass; normaliser result six intentionally failing cases / 12 assertion records,
  five passing cases. Three service activation cases remain Red, now including executed
  independent unknown-task rejection. Do not preserve stale eight-case/13-assertion
  totals from the first review. Exact combined ledger is for reviewer verification.
  The SAME consolidated whole-section Red review has resumed with ALL repaired
  findings and the exact unread criteria/files checkpoint; no per-finding approval
  requested. Backend/generator/transport/journey/documentation manual walkthrough
  must be completed, not replaced by previous automated passes. Green remains blocked.

- Consolidated browser repair validation now complete: real normaliser preflight
  preserves R1/R2 linked full/embedded task projections, scores and paired hashes;
  R3 valid null-parent acquisition-E fixture is preserved across all affected sibling
  items. User-approved existing unavailable-source journey retains no-unsafe-link/no-
  placeholder checks and rejects stale ready body. No UI or new journey introduced.
  Parent's serialised five-spec run **45/45 passes**, log
  `.opencode/scratchpad/section2-consolidated-red-repairs-e2e.log`; this supersedes
  earlier shared-server connection-refused attempts, which remain recorded failures.
  Scoped helper lint/format pass; only planned E-score type incompatibility remains.
  Findings R1–R5/N1/N2 are applied/validated, awaiting the SAME whole-section review;
  R6–R8 repair owner still active, no interim review or Green implementation started.

- Consolidated Red repair checkpoints: R4/R5/N1/N2 applied in four authorised test
  files; exact catalogue cause oracle and independent service-probe execution now
  correct. Targeted frontend 19 pass / three intended activation-failing cases;
  restoration 11 pass; scoped lint/format/diff pass; only planned production E-type
  diagnostic. Findings await whole-section re-review, not independently closed.
  R1/R2 task/hash edits applied but normaliser preflight initially failed to load;
  browser retry hit connection-refused failures while another browser owner was
  running. No browser pass claimed. Further browser execution is serialised;
  R1/R2 owner now validates only real-normaliser preflight/lint/types until R3's
  active browser run finishes. R6–R8 and R3 remain active repair batches.

- R3 scope adjustment is **approved** by the user: reconcile the EXISTING unavailable-
  source browser case to a valid acquisition-E record, preserve no-unsafe-link coverage,
  remove the incompatible old ready-content requirement. Authorised surface expands
  to `task-preview-source-link.states.spec.ts` and its existing fixture/scenario/
  expectation helpers only as needed. No new journeys or preview UI implementation;
  if current UI cannot exercise the no-link assertion, stop/report rather than expand.
  The prior pending decision is superseded; proceed with consolidated finding repairs.

- Consolidated Red review returned **FAIL and incomplete walkthrough**:
  `.opencode/scratchpad/section2-consolidated-red-review.md`. Fresh frontend result:
  2,915 pass / eight failing cases / 13 failed assertions; failures themselves remain
  intended, but latent fixture/oracle/execution defects prevent clean Red approval.
  Cumulative consolidated findings, all open: R1 browser full task projections empty;
  R2 local TABLE full content/hash mismatch; R3 source-less ready journey contradiction
  (asked user, deferred ledger); R4 incorrect nested cause matcher; R5 service unknown-
  task probe skipped after hard failure; R6 healthy sibling oracle derived from SUT;
  R7 full G4 stimulus lacks offending source IDs; R8 marker-null non-reassessment E
  coverage missing; N1 analyser-test parameter default; N2 stale factory comments.
  No fixes start while R3 scope decision is pending. After the decision, repair ALL
  findings in bounded owner batches, then resume ONE whole-section consolidated Red
  review with its exact unread criteria/files checkpoint (§Exact remaining manual-
  review checkpoint), not per-finding reviews. Known Green-quality G7/G8, duplicate
  extraction JSDoc and touched API import alias remain on consolidated Green backlog.
  Fresh reviewer backend coverage passes 3,168 tests/85.26% branches; builder coverage
  passes 252 tests. Synthetic 749 pass; browser subset 45 pass. These do not override
  fixture defects or substitute for completion of the manual review/final gates.

- The **ONE consolidated complete Section 2 Red review is now submitted**, covering
  criteria 1–16 and the full authorised section inventory, not individual helpers.
  Evidence packet: `.opencode/scratchpad/section2-consolidated-red-packet.md`.
  Packet errata explicitly included in review: both last data-analysis stale cases
  are resolved (49 targeted tests pass); the unauthorised shared name helper was
  removed in favour of inline checks. Full builder suite now **252/252** across
  23 files (`section2-complete-red-builder-tests.log`); no actual regression checker
  ran (mocked checker messages belong to builder unit tests).
  Expected remaining Red is eight behavioural cases plus one planned E-score type
  incompatibility; final Green/coverage/build/browser/regression gates still pending.
  No new feature Green implementation starts until complete-section Red findings
  are dispositioned and all in-scope test issues resolved. No commit/push/deployment.

- Complete-section Red authoring batches have returned; consolidated evidence packet
  is being assembled before the ONE full-section Red review. Final current evidence:
  backend **3,168/3,168 tests** (233 files), synthetic **749/749** (52 files), targeted
  existing browsers **45/45** after final helper type repairs. Full frontend check
  collected all 303 files: 2,913 pass / ten fail, of which two subsequently repaired
  stale data-analysis schema tests now pass in a 49-test targeted run. Remaining
  eight expected cases map to G4/G5/G6 and three read-service activation failures;
  exact failure ledger must accompany consolidated review, not count them as debt.
  Actual app/Node/E2E and synthetic type checks now report only planned production
  E-score type incompatibility at criterion accumulation line 226 (same diagnostic
  may repeat across projects). No test/helper type errors remain.
  Final canonical lint checks: frontend exit 0 with 19 historical warnings; synthetic
  and builder exit 0 with zero warnings; backend exit 1 with zero errors/five historic
  warnings. Planned factory split removed its old sixth warning, as baseline report
  confirms; no lint waiver/new warning. Logs: scratchpad `section2-complete-red-*`,
  `section2-red-synthetic-final-verification.log`, `section2-helper-type-repair-*`.
  No code review submitted yet; no full regression checker, commit, push or deployment.

- Post-regeneration Red preflight found unexpected stale oracle/selector/local-fixture
  problems, not just intended feature Red; evidence
  `.opencode/scratchpad/section2-final-red-preflight.md`. Repairs remain unreviewed
  pending complete-phase readiness. Backend shared partial oracle now retains exact
  E reasoning/cause and redacts numeric/N; model-input tests 2 pass and embedded
  serialization tests 5 pass. Current/legacy serializer probes now express explicit
  mode intent rather than relying on corpus marker absence.
  Read-service/local summary-page setup repaired: 32 tests collect, 29 pass / three
  intended service-activation failures, no setup/collection failures or own types.
  Class service corruption probe now uses real canonical two-task supplied entries;
  no partial task-definition/registry universe is required or inferred (correcting
  preflight's earlier diagnosis). Preview selector/nullable-consumer, Playwright and
  synthetic-guard lint-only repairs are still active; no consolidated review yet.
  Guard repair is restricted to equivalent existing validation and must demonstrate
  unchanged generated bytes; current incomplete iteration has eight introduced JSDoc
  errors and no final behaviour evidence, so it remains a blocker, not accepted debt.

- User-approved Red fixture regeneration completed: existing generator ran twice
  on 24 October at 19:41:23/19:41:26 UTC, both exit 0; all 18 compact output paths
  and SHA-256 inventories match byte-for-byte between runs. Six tracked wire files
  changed (full/class records for small, medium, large-representative), no generated
  paths added/deleted; other 12 outputs unchanged. Evidence: scratchpad
  `section2-fixtures-*`. Eight regeneration/round-trip and 58 formerly corpus-blocked
  schema/metadata/bridge checks pass. No generator/production logic changed.
  Canonical round-trip suite own-type errors subsequently repaired; actual synthetic
  tsc now reports only planned criterion-accumulation E-score production type gap.
  Post-regeneration Playwright reconciliation and read-only complete-Red preflight
  are active. Preflight must distinguish intended behavioural/type Red from any
  unexpected collection/fixture/lint failures before consolidated Red review.

- User **approved canonical fixture regeneration during Red**, superseding the
  pending sequencing question below. Use the existing implemented generator; run
  `npm run fixtures:synthetic` twice and require byte-identical second output.
  No generator/production fix is authorised by this sequencing exception. Complete
  all Red tests/browser fixture reconciliation before consolidated review; retain
  the final full-section gates. Deferred-ledger disposition is now approved.

- Remaining Red sequencing question is **asked**: committed pre-cut-over corpus
  still prevents original schema-suite collection and 13 metadata-consumer tests,
  while complete-phase Red review must precede Green and regeneration was scheduled
  in Green. Asked whether to authorise generator-only canonical fixture regeneration
  during Red (no new production logic) so the complete section can collect and expose
  actual behavioural Red, or retain Green sequencing with an explicit user-approved
  corpus-blocked Red gate exception. No regeneration performed pending decision.

- Further complete-Red batch checkpoints (not review gates):
  - Normaliser G4–G6 assertions now present in existing six/five cases; focused
    result 37 pass / five intentionally failing cases. Specs 461/500 lines;
    partial has no remaining max-lines headroom. Scoped lint independently rechecked
    after a concurrent stale lint report and passed. Partial marker-null fixture's
    existing E entry must be explicitly considered in consolidated coverage review.
  - Full/class service suites now stub only `callApi`, retain real response parsing,
    and assert normalisation composition: combined 17 pass / three intended missing-
    activation failures. No dispatcher/storage coverage is inferred from transport stubs.
  - Builder copied-source ordering assertion added; five tests, scoped checks and
    builder/tooling type checks pass, including projection-before-rehydration and
    existing item-before-entry ordering.
  - Synthetic focused refresh: 16 fail / 731 pass, superseding stale 17 failures;
    evidence `.opencode/scratchpad/section2-synthetic-current-red-inventory.md`.
    Three stale assertion owners reconciled (48 focused tests pass). Bridge marker
    loss was traced to committed corpus, correcting the inventory's initial generated-
    graph suspicion; regeneration remains Green work. Two model-input controls now
    assert the approved opaque-legacy partial-definition persistence exception and pass.
  - Factory test separation preserves existing declarations/expanded cases: original
    220 lines, restoration companion 324; 41 factory/CURRENT/legacy tests pass.
    New API error suite covers real controller/storage boundary separately from existing
    mocked-controller cases; both API suites report 17 passing tests, scoped checks pass.
    Active batches: full result/marker schema-test separation and existing Playwright
    heatmap helper reconciliation. Corpus bytes remain unchanged. All batch evidence
    awaits consolidated Red review; exact current whole-section failures must still be
    inventoried before that review. No regression gate, commit, push or deployment.

- Complete-section Red inventory saved at
  `.opencode/scratchpad/section2-remaining-red-inventory.md` (read-only discovery,
  not a review or fresh regression baseline). Completed batch checkpoints:
  - Seven marker-fixture owners adapted; their focused runs passed 16 and 14 tests,
    scoped lint/formatting passed, and marker diagnostics in those files resolved.
  - Five class/page fixture owners inspected; only `classDetailSchemaFixtures.ts`
    needed literal edits (marker 1 and missing SPaG). Schema tests 48 pass and focused
    consumers 63 pass. Corpus-derived metadata refresh remains blocked, not patched.
  - Added planned `averagingAnalyser.errors.spec.ts`; new/related analyser tests
    30 pass, including E accounting and unchanged controls. Production E-score type
    widening remains Green work. Latest reported tsc has three outstanding records:
    criterion accumulation E type, metadata evidence oracle E type, preview nullable name.
    Active batches: existing normaliser-case G4–G6 assertions and real `getAssignment`
    service composition tests. No per-batch review will run. Remaining full-section
    Red coverage includes class service integration, source-schema/fixture adaptations,
    backend/synthetic/builder acceptance coverage and existing-browser reconciliation.
    No full-section Red approval, Green completion or regression gate is claimed.

- **User-directed review cadence change:** finish ALL remaining atomic Section 2
  Red work before one consolidated Red review; then finish ALL remaining Green
  implementation and documentation before one consolidated Green review. Do not
  submit further per-finding/per-helper reviews. Bounded delegations may still be
  used to fit execution budgets, with focused validation, but are not review gates.
  The interrupted G3 extraction review failed with a usage limit and has no verdict;
  it is superseded by the consolidated section review, not restarted independently.
  Prior G1/G2 approvals remain historical evidence; G3–G8 and all remaining 2c/2d
  acceptance criteria must be included in the full-section coverage inventory.
  First inventory and complete remaining Red tests/typed-fixture adaptations,
  including existing-browser reconciliation owned by Playwright. Retain intended
  Red failures and identify unrelated failures precisely. No intermediate regression
  checker, commit, push or deployment; atomic Section 2 gate remains mandatory.

- User **approved a minimal domain split** to resolve G3's persistent normaliser
  sizing/complexity blocker, superseding the earlier same-file-only constraint for
  this extraction. Authorised surface now includes one coherent validation owner
  beside `assignmentReadNormalisation.ts` in the assignment-assessment service domain;
  preserve public normaliser entry points, direct imports and all existing contracts.
  No generic framework, new dependency, lint suppression or assertion weakening is
  authorised. Reconcile the new owner in canonical helper/contracts documentation
  and re-review the complete G3 change/extraction before sign-off.
  Latest incomplete tree was 506 lines with `hasSourceContradiction` complexity 13
  (limit 7). A final parse typing adjustment remains unvalidated; previous 42 passing
  focused tests do not cover that final tree. G3 remains open; G1/G2 closure must be
  revalidated after extraction. G4–G8 and module-wide validation remain outstanding.

- G3 Red is independently **CLEAN RED**, R1 closed:
  `.opencode/scratchpad/review-section2c-g3-r1-rereview.md`. All eight root rejection
  probes execute (five full, three partial); focused result 40 pass / two intentionally
  failing cases. The partial blank owner-ID probe now synchronises supplied child IDs,
  avoiding a false-positive child-mismatch rejection. Test-owned TS18046 errors were
  repaired; an unauthorised narrowing helper was removed before review, with truthful
  local fixture typing retained. No extra cases/suites/helpers accepted. Current task:
  G3 Green in the normaliser only, enforcing owning identities and consistent supplied
  full task projections, within existing lint limits. G1/G2 closed; G3 production and
  G4–G8 remain open. Module gate and downstream consumer/corpus work remain blocked.

- G2 is independently **CLOSED**:
  `.opencode/scratchpad/review-section2c-g2-green.md`. Artefact association,
  submission role, usable UID/supported type and partial provided-key identity
  are enforced; all 42 focused tests pass. User-authorised local simplification
  (no split/compression) reduced the normaliser from 514 to 492 physical lines,
  meeting the applicable 500-line warning limit and callback complexity rule.
  Review found no new defects from that simplification. G1 stays closed;
  G3–G8 remain open. Current task is G3 Red assertions for nonblank owning
  identities and consistent supplied full task projections in existing cases.
  Module-wide verification remains blocked, with no section-gate approval.

- G2 Red is independently **CLEAN RED**:
  `.opencode/scratchpad/review-section2c-g2-r1r2-rereview.md`.
  Test-structure findings R1/R2 are closed: all four partial artefact mutations
  execute despite intentional failures, and blank-key Red no longer skips existing
  root/null controls. All eight intended G2 invocations execute; focused result
  39 pass / 3 intentionally failing cases across 42 tests. Current task is G2 Green:
  contextual submission-artefact association and provided partial task-key validation
  in the normaliser only. G1 remains closed; G2 production and G3–G8 remain open.
  Overall module gate is still blocked, not waived by bounded Red readiness.

- G1 is independently **CLOSED**:
  `.opencode/scratchpad/review-section2c-g1-green.md`. Full item schema validation
  now precedes artefact source access; missing/null containers isolate rather than
  crash, and the programming-getter sentinel still propagates. All 42 focused tests
  pass; scoped lint/formatting pass. The overall reviewer verdict remains FAIL for
  blocked module verification (15 unchanged downstream diagnostics; coverage timed
  out), not a new G1 finding. G2–G8 remain open. Current task: G2 Red assertions in
  existing full/partial cases for contextual submission-artefact association and
  provided partial dictionary-key identity. This supersedes G1-open entries below.

- Independent bounded Green review is **FAIL**:
  `.opencode/scratchpad/section2c-green-normaliser-independent-review.md`.
  All eight findings remain open; passing 42 focused tests is not sign-off.
  Cumulative repair ledger (Implementation owns fixes; Testing Specialist owns
  behavioural regression assertions; Code Reviewer verifies closure):
  - G1: missing/null full artefact crashes instead of item isolation. Resolution:
    narrow/parse before source dereference, preserving programming-error propagation.
    Existing full-spec regression repair is in progress (Red).
  - G2: validate submission artefact task/role/UID/type and partial task-key identity.
  - G3: validate owning identities and consistent supplied full task projections.
  - G4: thread parent source state into canonical corruption replacements.
  - G5: validate provided marker-null reassessment entries, never synthesize a graph.
  - G6: reuse validation issue paths plus explicit contextual diagnostic paths.
  - G7: remove unused duplicate partial score declarations.
  - G8: correct adjacent full/partial result comments.
    Affected owners remain the normaliser and two consumer schemas, with regression
    assertions in the existing full/partial specs. Findings will be repaired in bounded
    batches, tested and independently re-reviewed; none is waived. Fresh reviewer tsc
    count is 15 downstream diagnostic records (superseding the earlier reported 18).
    Broad coverage timed out and is not passing evidence. No atomic regression gate,
    corpus regeneration, commit, push or deployment has occurred.

- Section 2c bounded normaliser/schema Green is now under independent review.
  Changed owners: `assignmentReadNormalisation.ts` (485 lines),
  `assignmentAssessment.zod.ts`, `classDetailService.zod.ts`. Initial diagnostic-path,
  lint and implementation-type blockers were repaired. Focused validation reports
  42 tests passing across three files, including both approved normalisation suites;
  scoped lint (zero warnings), Prettier and diff checks pass. Evidence:
  `.opencode/scratchpad/section2c-repair-normalisation-tests-final.log`,
  `section2c-repair-eslint-final.log`, `section2c-repair-prettier-final.log` and
  `section2c-repair-tsc-final.log` in the same scratchpad directory.
  Full typecheck still has 18 downstream marker/E/name diagnostics, none in these
  three production owners. Broader schema collection is blocked by markerless
  committed corpus via `previewFixtures.ts:60`. These remain blocking planned work,
  not accepted debt. Service activation, analyser/typed-fixture milestones,
  canonical documentation status sync and corpus/browser cut-over remain pending;
  no overall Green or atomic Section 2 gate is claimed.

- Both normalisation Red milestones are now independently **PASS — CLEAN RED**.
  Partial final review: `.opencode/scratchpad/section2c-partial-red-final-review.md`;
  P1–P5 closed, five cases / 387 lines, scoped lint/formatting pass. The marker-null
  preservation oracle now compares exact assessment maps in matching representations.
  Full F1–F5 approval remains valid. Final partial review found 2,902 existing frontend
  tests passing; the two new suites intentionally fail missing-module collection,
  and typecheck reports exactly the two corresponding TS2307 imports. No behavioural
  normaliser tests have executed. Current phase: bounded Green implementation of the
  shared normaliser and full/partial schemas. Service activation, analyser/typed-fixture
  milestones, corpus/browser reconciliation and the atomic Section 2 gate remain pending.
  This supersedes older pending Red checkpoints below. No commit/push/deployment.

- Full-read normalisation Red is now independently **PASS — CLEAN RED**:
  `.opencode/scratchpad/section2c-full-red-f3-final-review.md`.
  F1–F5 are closed; six cases / 328 physical lines satisfy the user-authorised
  linter-bound sizing allowance. Scoped lint and formatting pass. The planned
  absent normaliser still prevents collection (zero behavioural tests executed)
  and produces the two expected full/partial TS2307 diagnostics. This is full-spec
  implementation readiness only, not Green or overall Section 2c approval.
  Partial P1–P5 repairs are submitted for independent re-review; their latest
  owner reports five cases / 375 lines with scoped lint/formatting passing.
  Earlier broader lint errors during concurrent partial edits are not waived;
  no complete frontend coverage or atomic Section 2 gate is claimed.

- User-authorised sizing clarification: the full-read normalisation spec may
  remain at **314 physical lines / six cases**. The user permits planned file-size
  budget overruns provided each file remains within its applicable linter limit.
  This does not waive lint, review, regression or coverage gates, and does not
  authorise additional scenarios or speculative helpers. The repaired full spec
  passes scoped lint/formatting; independent F1–F5 closure remains required.

- The initial full normalisation spec returned **VALIDATION FAILURE**, not clean
  Red: nine lint errors and invalid probe/assertion assumptions remain. Repairs
  are delegated within the same file (at most eight cases/300 lines), including
  the correct marker, flattened definition, atomic all-three replacement, genuine
  healthy siblings and fail-loud root rejection. No production normaliser exists.
- The explicitly planned partial normalisation companion is delegated separately
  (at most five cases/300 lines), covering redaction, provided-entry-only coverage
  and null-parent isolation without duplicating the full-source matrix. Both
  suites require independent clean Red review before implementation.
- Endpoint documentation now selects `toReadJSON()` and distinguishes opaque
  persistence; independent re-review is **PASS — CLEAN scoped API integration**
  (`.opencode/scratchpad/section2b-api-rereview-clean.md`). The finding is closed;
  no API implementation or test findings remain. Canonical
  data-shape status reconciliation remains pending its separate handoff.
- Backend canonical documentation reconciliation is now independently **PASS —
  CLEAN scoped backend documentation**:
  `.opencode/scratchpad/section2b-canonical-doc-rereview-clean.md`.
  Findings D1–D3 are closed: current-only corruption isolation is distinguished
  from legacy reassessment projection, stale pending legacy-read prose is removed,
  and the opaque-legacy partial-definition persistence exception is documented.
  Seven-document formatting/diff checks and 30 local references pass; unchanged
  functional evidence was reused. This supersedes the pending documentation status
  above, not the still-outstanding frontend Red reviews or atomic Section 2 gate.
- No full regression checker has run during these phases. The atomic Section 2
  gate, corpus regeneration and all later sections remain outstanding.

### Objective and constraints

Activate one-pass current reads, detached legacy E projections, strict frontend
read validation/isolation and canonical version-1 graphs together. This is the only
intentionally cross-layer section: schema consumers, generator and committed corpus
must agree before its full gate. Complete substeps 2a–2d in order; no intermediate
commit/deployment or full-regression checkpoint inside the red-to-green cut-over.

Backend budgets: Assignment facade 402→425; serialization 119→210; rehydration
185→560 unsplit, so keep restoration/coverage ≤320 and extract pure projection/snapshot
mapping to `02_AssignmentReadProjection.js` ≤280. ABClass model 440→480;
response mapper 128→170; assignment ops 279→410 total across this plan;
API assignmentAssessment 146→155. Direct full reads use `toReadJSON()` after
`_ensureFullDefinition`; class reads project before definition-key replacement.
The base artefact budget (186→210) belongs here, not Section 1: preserve explicit
null placeholder content/hash and ensure full/partial restoration cannot generate a
hash for redacted partial content. Reuse constructor normalization; no duplicate raw
artefact validator or gratuitous base-model rewrite. The placeholder/null/hash cases
in `tests/models/studentSubmission.validation.test.js` and the new current/legacy
rehydration suites exercise this boundary red-first.

Frontend budgets: assignment schema 214→235/service 47→65; class-detail schema
177→185/service 31→45; new `assignmentReadNormalisation.ts` 0→330. Analyser input
types 32→35 and criterion accumulation 235→255. No frontend file is projected >500.
Import new owners directly inside the existing assignment-assessment domain folder.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Frontend + Analysis/UI + Contracts + Corpus +
  API + Builder; source additions: @src/backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js
  @src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js
  @src/backend/AssignmentProcessor/Assignment/index.js
  @src/backend/Models/ABClass.js @src/backend/Models/Artifacts/0_BaseTaskArtifact.js
  @src/backend/y_controllers/ABClassController/index.js
  @src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js
  @src/backend/y_controllers/ABClassController/ABClassResponseMapper.js
  @src/backend/z_Api/assignmentAssessment.js
  @scripts/synthetic-test-data/generateSubmissions.js
  @scripts/synthetic-test-data/toTransportViews.js
  @scripts/synthetic-test-data/projectClassTransportViews.js
  @src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts
  @src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts .
  Playwright owns this section's existing-browser-fixture reconciliation and also
  receives Browser plus @src/frontend/e2e-tests/helpers/task-heatmap-fixtures.ts
  @src/frontend/e2e-tests/helpers/task-heatmap-class-fixtures.ts
  @src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts
  @src/frontend/e2e-tests/helpers/task-preview-source-link-fixtures.ts
  @src/frontend/e2e-tests/heatmaps.spec.ts
  @src/frontend/e2e-tests/task-preview-source-link.spec.ts
  @src/frontend/e2e-tests/task-preview-source-link.visual.spec.ts
  @src/frontend/e2e-tests/task-preview-source-link.states.spec.ts
  @src/frontend/e2e-tests/helpers/task-preview-source-link-geometry.ts .
  Attach any additional journey spec before delegating an expectation edit there;
  the listed representative journeys do not authorise editing an unread spec.
- **Shared helpers — extend:** model-owned raw validation, AssignmentRehydration
  traversal/coverage and sole `projectReassessmentSubmissions(..., form)` facade,
  AssignmentSerialisation/read delegation, existing response mapper. **New:** pure
  frontend `assignmentReadNormalisation.ts`, reused by both read services, no React,
  API dispatch or JSON decoding. **Reuse/extend:** existing generator stages, adapter
  and graph validators. Owners/status recorded `Not implemented` in rehydration,
  AssessmentFlow, frontend standards §9.29 and synthetic-data planned capability notes.
- **Data shapes:** planned marker, restoration, legacy/persistence separation and full/
  partial schema portions of `assignment.md`, `abclass.md`, `assignment-definition.md`;
  raw E analysis-input accounting in `frontend-data-analysis-response.md`. These entries
  pre-exist as `Not implemented`; update each implemented slice, not later UI slices.
- **Canonical fixtures:** extend existing `small`/`medium` and regenerate all compact
  profiles, including `large-representative`. No new profile/view. Use `small` healthy
  selections and `medium` mixed graphs for the tests below; local legacy/corruption
  probes clone those graphs. Preserve fixed seeds, entity linkage and deterministic bytes.

### Acceptance criteria / required tests (Red first)

**2a — Pin canonical contracts and independently valid graph boundaries**

1. Generated full/embedded records carry marker 1 and exactly three assessments,
   including accuracy. Explicit `ASSESSMENT_FAILED` E replaces the existing empty-map
   student variant. E reasoning/cause survives partial projection; success/N reasoning
   and source bodies/hashes remain redacted. No `formulaComparison` map key.
   Set the marker once on the persistence record in `planClassAssignments.js`, then
   explicitly emit that source field in `toTransportViews.js::toFullAssignment` and
   `projectClassTransportViews.js::toPartialAssignment`. Both use field whitelists;
   neither currently copies an added persistence field automatically. Raw projection
   tests must fail if either whitelist omits it; do not independently choose/default
   the version in each view.
   Reconcile the existing `STUDENT_INDEX_WITH_NULL_DOCUMENT` variant as an explicit
   synthetic acquisition failure: preserve its submission/task identities and item
   count, but emit all-three acquisition `SOURCE_UNREADABLE` E on each known task,
   with base placeholder artefacts, null source IDs/content/hash, empty metadata/
   feedback and deterministic IDs/UIDs. Retain its null parent document ID. This
   test-only scenario choice does not infer historical production causes. Genuine
   no-submission remains roster omissions plus local null-document/empty-map probes;
   keep existing submission-count/completion-band rules, no new profile or view.
2. Generate usable IMAGE and SPREADSHEET definition/submission bodies in existing
   builders. Current full definitions are hydrated/usable; pending IMAGE is not a
   valid completed assignment. Validators assert content, hash, cause and coverage
   parity. Existing metadata remains an independently supplied snapshot.
   In persistence and both transport validators, assert null-document non-empty maps
   contain only complete acquisition/validation E, source/cause parity is consistent
   and the generated null-document variant has the pinned SOURCE_UNREADABLE cause.
   The old populated-source/numeric null-document combination is a local corruption
   probe only; canonical generation must not rely on read-time corruption conversion.

**2b — Current restoration and legacy read/persistence separation**

3. Version-1 full and partial reads isolate missing content/hash, malformed artefacts,
   criteria/cause, incomplete or extra-key criterion maps and known task-key mismatches
   to all-three `CORRUPT_RECORD` E; healthy siblings survive. Validate raw records before
   constructors can fill keys or hashes. Restore each identified item only once.
4. Backend full AND partial restoration materialises E for missing known tasks from its
   embedded task snapshot. Null-document/empty-map no-submission stays empty; acquisition
   failure stays explicit E. Corrupt item collection with trustworthy student identity
   yields known-task E. Unknown stored task/untrustworthy student/root/definition fails
   its owned dataset. Injected constructor/wiring exceptions propagate, not E.
   Include null-document/non-empty maps with populated content and numeric/N marks,
   or with assessment/extraction-stage E: these contradict the parent submission's
   source state. For each identifiable offending item, replace all three criteria
   with validation `CORRUPT_RECORD` E; do not accept/drop it or fail healthy siblings.
   Null-document items with valid acquisition/validation E remain valid. Pin both
   full and partial cases in `tests/assignment/assignmentRehydration.current.test.js`
   and the equivalent frontend full/partial normaliser boundary tests.
5. On current full reads, null source beside numeric/N or assessment-stage E becomes
   validation `CORRUPT_RECORD`, not guessed acquisition/extraction history. Partial
   redaction never causes that check/hash generation. No-submission adds no observations.
6. Missing/null/unsupported markers produce detached reassessment E with marker null.
   Full uses stored identities/resolved embedded tasks only; class uses its loaded roster/
   stored task summaries. Test abnormal partial-definition fallback separately. Full
   snapshots remain authoritative, and a newer registry cannot alter class coverage.
7. Placeholder IDs/fields/timestamps follow SPEC: canonical base artefact, null content/
   hash, validated source IDs only, deterministic identity, nullable studentName, stored
   times or assignment-derived times, never wall clock. Test repeated reads and no writes.
8. Ordinary class saves re-emit opaque legacy submission body and original marker
   presence/value unchanged via persistence serializers. Read projections never enter
   preparation. Mixed legacy/current assignments, valid current E and reassessment
   replacement are covered. Remove catch/reconstruct/retry/drop/plain-object fallbacks.

**2c — Frontend validation and analysis contract**

9. Both services validate strict roots/shared definitions, isolate only identifiable
   invalid items, log safe field paths/IDs and revalidate the normalized result. Required
   full artefact keys remain required. Align full studentName to `string | null`.
10. Partial normalisation validates provided entries only: no full fetch, roster query,
    legacy graph synthesis or newer-definition coverage inference. Full normalisation
    defensively fills a missing wire item from that SAME payload only, never overwrites
    backend E. Test this defence separately from normal backend coverage.
11. Raw score input accepts E explicitly. A wholly errored item displays four E metrics;
    E increments no numeric/N/weight/totalDataPoints counters and adds no denominator.
    Numeric/fractional, N, zero-weight, mixed valid/error and aggregate excluded semantics
    remain unchanged. `MetricResult` gains no reasoning/history fields.
12. Not-found null, API envelopes and `callApi`/`parseApiResponse` transport semantics
    remain unchanged; strict root metadata handling is not weakened.

**2d — Integration, fixture regeneration and generated output**

13. Exercise canonical class/full graphs through model serialization. Exercise class
    graphs through the existing real-dispatcher/GAS round-trip bridge and frontend
    `getABClass`; that bridge has no `getAssignment_` seam and is not extended here.
    Exercise full wire payloads through the real `getAssignment` frontend service,
    stubbing only `callApi` to resolve canonical objects, following
    `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.spec.ts`.
    This executes its real full schema/normaliser and final `parseApiResponse`, separately
    from real backend read-controller/API tests against mocked storage. Do not invent a
    getAssignment bridge seam or claim the stubbed transport proves full dispatcher/
    controller/database integration. No read writes or roster refresh.
14. Regeneration is byte-reproducible with matching manifests/linkage across compact
    profiles. Update old blanket partial-reasoning-redaction assertions to distinguish E.
15. Generated GAS output places `02_AssignmentReadProjection.js` before
    `02_AssignmentRehydration.js` AND retains item-model-before-submission-entry order.
    Test actual copied output ordering; equal `02_` prefixes rely on lexical sorting.
16. Existing Playwright journeys remain green at this cut-over, not just in Section 10.
    Reconcile mocked healthy full/partial wire records to the new contract (marker 1,
    complete criteria, linked tasks and usable source fields), deriving supported
    realistic records/IMAGE/SPREADSHEET bodies from canonical views. Preserve deliberate
    local score/layout boundary overrides and the unsupported TABLE exception. Do not
    weaken strict root validation or treat a missing wire marker as a valid current
    result to preserve old mocks; marker-less/unsupported wire roots are local invalid
    probes, not the backend's valid marker-null, materialised legacy E output.

### Red → Green → Refactor and checks

- Red: add `tests/assignment/assignmentRehydration.current.test.js`,
  `tests/assignment/assignmentRehydration.legacy.test.js` and
  `tests/api/assignmentReadErrors.test.js`; frontend
  `assignmentReadNormalisation.full.spec.ts`/`.partial.spec.ts`, shared schema tests
  and `averagingAnalyser.errors.spec.ts`; synthetic
  `tests/synthetic-analysis/syntheticAssessmentContract.test.ts` and
  `tests/synthetic-analysis/syntheticAssessmentRoundTrip.test.ts`. Each standalone new
  suite ≤300; split by scenario
  if needed. Extend response-mapper unit tests 32→≤220 and read API tests 446→≤480.
  Extend `assignmentAssessmentService.spec.ts` 266→≤380 for the real-service/stubbed-
  callApi full-payload composition in criterion 13.
- Put serializer-level opaque legacy-body/marker-presence and mixed legacy/current
  round-trip cases in `tests/assignment/assignmentRehydration.legacy.test.js`; put
  the ABClass model's embedded-restoration/persistence-serializer cases in new
  `tests/models/abclass.assessmentContracts.test.js` (≤300). Section 8's named
  `abclassController.persistAssignment.test.js` extension separately proves the real
  storage write path preserves that legacy state and never persists read placeholders.
- Green: implement 2b/2c owners and the graph cut-over, using one explicit internal
  full/partial restoration mode. Activate new serializers in API/mapper only with the
  corresponding frontend schemas and regenerated corpus in this section.
- Generator budgets: `generateAssignmentDefinitions.js` 216→295;
  `generateSubmissions.js` 233→365; `planClassAssignments.js` 206→215;
  `toTransportViews.js` 259→275; `projectSubmissionViews.js` 140→165;
  persistence validator 281→365; transport validator
  336→430. Existing `validateAssignmentsByKeyView.js` 221→≤275,
  `projectClassTransportViews.js` 109→≤130 and model-input adapter 130→≤180 extend only
  as required by their existing projection/validation responsibilities.
- Update touched fixture helpers: `previewFixtures.ts` 287→≤340 (healthy selectors,
  real accuracy reasoning, supported IMAGE/SPREADSHEET, remove dead root-plan pointer;
  keep unsupported TABLE exception); `metadataEvidenceOracle.ts` 112→≤140 (explicit E
  non-contribution, not excluded); assignment schema fixture helper 34→≤65. These are
  test-only adaptations, not new fixture generators.
- During Red, reconcile the class-detail/ABClass and page-hook fixtures that embed
  literal assignment partials, not just the full-assignment fixtures: under
  `src/frontend/src/test/abClass/`, `classDetailSchemaFixtures.ts` 108→≤125,
  `classFullFixtureDefaults.ts` 36→≤50, `abClassMetadataTestBuilders.ts` 207→≤230 and
  `metadataRefreshFixtures.ts` 138→≤160; under `src/frontend/src/test/`,
  `taskHeatmapPageFixtures.ts` 105→≤125 and `heatmapsPageDataFixtures.ts` 208→≤230.
  Retain canonical selection for realistic records; add the required wire marker
  and valid E-branch details where applicable to existing focused builders. Any
  additionally discovered literal-partial fixture is part of this same mechanical
  Red-phase adaptation under the sizing gate, not a reason to relax the wire schema.
- Existing-test sizing: assignment schema spec 453→about 530 unsplit, so move result/
  marker cases to `assignmentAssessment.results.zod.spec.ts`, retain original ≤400;
  factory spec 519→about 550, so separate restoration into
  `tests/assignment/assignmentFactory.restoration.test.js` and keep both ≤320 when adapting current/legacy
  fixtures. `syntheticBackendModelInputs.test.ts` 433→≤480; redaction/scenario tests
  `syntheticGraphTransportContracts.test.ts` 451→≤490 and
  `syntheticGraphIntegrityAndScenarios.test.ts` 456→≤495. Put new scenario matrices in
  new focused modules, not the already large graph suites.
- Update obsolete accuracy-absent assertions in preview lookup content tests and
  affected metadata-evidence tests; do not rewrite unrelated averaging suites.
- Playwright performs only contract reconciliation of existing browser fixtures and
  affected expectations here, before the section gate; new error/legacy/refresh journeys
  remain in Section 10. Combined Section 2 + Section 10 helper budgets are
  `task-heatmap-fixtures.ts` 244→≤290, `task-heatmap-class-fixtures.ts` 240→≤280 and
  `task-heatmap-end-to-end-helpers.ts` 236→≤280. Reconcile canonical source-link helper
  `task-preview-source-link-fixtures.ts` 436→≤480 for changed corpus selectors and remove
  its resolved IMAGE-capability exception/dependency; retain TABLE's local exception.
  Use direct canonical imports in the existing owning helpers, not a new realistic
  builder or an import cycle between heatmap and source-link fixtures. Keep existing
  journey intent; change only expectations coupled to repaired fixture contracts.
- Refactor duplicate validators to the named owners, preserving narrow corruption
  handling. Add `@remarks` for opaque legacy persistence versus detached read data and
  backend versus browser coverage ownership; remove obsolete restoration fallbacks.
- Checks: targeted new/changed backend, frontend, synthetic and builder files, then
  `npm run fixtures:synthetic` twice (second output unchanged),
  `npm run test:synthetic`, `npm run test:backend`, `npm run test:frontend`,
  `npm run test:builder`, existing heatmap/preview Playwright journeys via
  `npm run test:frontend:e2e -- 'heatmap|task-preview|metric-range-filter|issue-320|navigation-screenshots'`,
  `npm run typecheck:all`, all four scoped lint checks; full gate, whose regression
  configuration also runs the complete Playwright suite. Do not postpone a cut-over
  browser regression to Section 10 or remove the e2e checker gate.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 3 — Usable shared definitions and canonical spreadsheet blanks

### Objective and constraints

Distinguish valid blank spreadsheet content from unavailable data and reject unusable
shared inputs before marking. Grid model 179→195; Sheets parser 363→400;
SheetsAssessor 388→420; definition validation 101→175, upsert orchestrator 470→490.
Reuse existing definition-error reporting/rollback; no parser/API validator hierarchy.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Contracts + Corpus;
  @src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js
  @src/backend/Assessors/SheetsAssessor.js
  @src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js .
- **Shared helpers — extend:** `SpreadsheetTaskArtifact.normalizeContent` owns blank
  grid normalization; existing definition validation owns shared artefact/formula
  eligibility, called on final resolved tasks by upsert and reused at run preflight.
  Existing SheetsAssessor keeps formula comparison transient (keep local). Planned
  `Not implemented` records: definition validation in AssessmentFlow; blank-grid
  model-rule reuse in rehydration; formulaComparison removal in canonical
  `assignment.md`. Do not invent a separate spreadsheet helper-register entry.
- **Data shapes:** planned definition-store versus completed-full artefact invariants
  in `assignment-definition.md` and assignment content/hash/completed criteria rules.
- **Canonical fixtures:** `small` SPREADSHEET tasks from Section 2; local null/all-null/
  blank and formula-free reference mutations. Touch/migrate only relevant sheet tests.

### Acceptance criteria / required tests (Red first)

1. Successfully read blank/all-null grids normalize to `[]` and the normal hash of `[]`
   through construction, serialization and restoration, for templates and submissions.
   Literal null stays unavailable; populated formula normalization remains unchanged.
2. Valid reference plus blank template/student range completes with completeness 0,
   accuracy 0 and SPaG N. Fractional formula marks and existing cell feedback survive;
   no `assessments.formulaComparison` survives completed persistence.
3. New non-IMAGE definitions reject null content/hash while permitting valid blank
   TEXT/array templates. Pending IMAGE definition-store state remains allowed.
4. Formula-free reference task blocks both new definition writes and an existing/
   externally supplied definition at run preflight, before student marking/writes;
   prior assignment remains saved. Duplicate shared tags keep existing blocking rules.

### Red → Green → Refactor and checks

- Add `tests/models/spreadsheetContentAvailability.test.js` and
  `tests/assignment/assignmentDefinitionArtifacts.validation.test.js` (each ≤300). Extend relevant
  SheetsAssessor suite 286→≤400, definition validation suite 282→≤410 and upsert
  validation suite 271→≤380; new assertions first.
- Green: reuse the normalization/validation owners, wire upsert and run checks, keep
  blank student scoring local to the existing assessor. Refactor discarded formula
  comparison persistence without changing feedback contracts.
- Checks: targeted sheets/model/definition/controller tests; `npm run test:synthetic -- tests/synthetic-analysis/syntheticDefinitionBackendValidation.test.ts`,
  `npm run lint:backend:check`; full section gate. Record `@remarks` distinguishing blank
  grids from unavailable content and pending definition images from completed artefacts.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 4 — Student acquisition and extraction outcomes

### Objective and constraints

Never infer absence from incomplete Classroom acquisition or a dropped extraction.
Assignment submissions module 147→240, SlidesAssignment 177→250, SheetsAssignment
111→165, Slides submission matcher 332→365; Sheets parser stays within Section 3 budget.
Preserve first-match/tag/type preference and ambiguity warnings.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Contracts + Corpus;
  @src/backend/AssignmentProcessor/Assignment/04_AssignmentSubmissions.js
  @src/backend/AssignmentProcessor/SlidesAssignment.js
  @src/backend/AssignmentProcessor/SheetsAssignment.js .
- **Shared helpers — extend/reuse:** existing acquisition loop, submission extraction
  owners and Section 1 atomic error creation; keep scope-local error conversion, no
  failure registry/new matching policy. Planned references: AssessmentFlow/rehydration.
- **Data shapes:** implement acquisition/extraction causes and terminal coverage
  portions of planned `assignment.md`; no additional transport fields.
- **Canonical fixtures:** healthy `small` student/task identities and artefacts; mock
  Classroom/Slides/Sheets calls locally for acquisition/parse failure boundaries.

### Acceptance criteria / required tests (Red first)

1. Follow every `StudentSubmissions.list` nextPageToken before confirming no attachment.
   A later-page attachment is found; a later-page list failure blocks the run and
   preserves prior storage rather than manufacturing no-submission/N.
2. Genuine no-submission retains null document ID/empty items. Unsupported or unreadable
   submitted document produces the agreed acquisition E for all known student tasks.
3. Missing match, failed text/table/range extraction and task-specific parsing become
   task E with exact catalogue cause/reasoning; actual unavailable extraction is
   `SOURCE_CONTENT_UNAVAILABLE`. Healthy siblings and safe source IDs survive.
4. Successful blank/template-matching work retains existing N/formula semantics. Null
   hashes cannot confirm template equality. Unknown extraction task IDs still warn/
   ignore; expected known tasks end terminal. Ambiguous first match is a warning, not E.
5. Expected document-open failures have student scope, task failures task scope;
   unexpected internal errors escape. Existing shared duplicate-tag rejection remains.

### Red → Green → Refactor and checks

- Add `tests/assignment/assignmentAcquisition.outcomes.test.js` and
  `tests/assignment/assignmentExtraction.outcomes.test.js` (≤300 each); extend
  `slidesSheetsAssignmentCoverage.test.js` 417→≤490 only for directly affected assertions.
- Green: establish source acquisition before classification and materialise terminal
  failures at their known identity boundary. Refactor log-and-drop paths, not matching.
- Checks: new suites plus assignment subclass and parser/matcher regressions;
  `npm run lint:backend:check`; full gate. Add `@remarks` on pagination-before-absence
  and expected source exceptions versus implementation faults.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 5 — One bounded transport owner

### Objective and constraints

Make BaseRequestManager the sole HTTP retry owner (224→310). Retain fetchAll initial
batches and sequential per-member fetch retries. Both current callers must be adapted
to its identity-tagged outcomes/per-batch consumption in this section; no duplicate
transport or run-wide response accumulation. LLM semantic result replacement/cache
and scoped image materialisation are completed in Sections 6/7 respectively.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Corpus;
  @src/backend/RequestHandlers/BaseRequestManager.js
  @src/backend/RequestHandlers/LLMRequestManager.js @src/backend/RequestHandlers/ImageManager.js .
- **Shared helpers — extend:** existing base sender takes explicit caller batch size,
  accepted success statuses and stop-status policy, and delivers final identity-tagged
  outcomes to a per-batch consumer before another batch dispatches. Each outcome retains
  final response OR final network failure plus attempts; never an obsolete response.
  Configuration/default retry parameters live in the constructor. Planned register:
  AssessmentFlow transport entry (`Not implemented`). No new scheduler/module.
- **Data shapes:** no new public API, persistence or LLM request/response body schema;
  these outcomes are internal GAS runtime objects, not a new stored status hierarchy.
- **Canonical fixtures:** HTTP, exception and backoff probes stay local; no realistic
  analysis graph is needed for the transport unit policy.

### Acceptance criteria / required tests (Red first)

1. LLM success is only 200/201, image success only 200. Retry only network, 429 and
   500–599. Permanent statuses/other success-like statuses do not consume a retry.
2. Total dispatches ≤3 including initial fetchAll, waits exactly 5000/7500 ms where
   attempts 2/3 occur, no post-exhaustion sleep. A thrown batch call consumes attempt
   one for every member; retries remain sequential, not re-batched.
3. Classify ALL received responses before retrying. LLM 401/403/404 prevents every
   subsequent retry/batch while retaining same-batch successes, regardless of order.
   Caller policy prevents a student-image 403 from becoming an LLM-wide stop.
4. Each final outcome retains its request identity; a final network failure never
   returns the earlier 429/5xx response. Unknown/duplicate identities and callback/
   routing/programming failures propagate, not network retries.
5. Callbacks apply completed batch outcomes before any later batch; explicit assessor
   and Slides-fetch sizes are honoured, with no nested unintended assessor-size batches.

### Red → Green → Refactor and checks

- Existing `baseRequestManager.test.js` 451→about 650 unsplit: separate policy/retry
  cases into `tests/requestHandlers/baseRequestManager.policy.test.js` and batching into
  `tests/requestHandlers/baseRequestManager.batching.test.js`, retaining remaining
  regressions in the original file as a third suite; keep all three ≤300. Shared
  global installation/teardown stays in existing
  `tests/helpers/globalMockManager.js::withGlobalMocks`; each suite has only its small
  local fetch/config stubs. Do not import one test suite from another or drop regressions.
- Green: replace the redundant dispatch/classification paths; adapt both callers in
  the same section and test the seam. Refactor raw-response logging and broad fetch
  catches to the canonical safe policy; do not add compatibility retry budgets.
- Checks: `npm run test:backend -- tests/requestHandlers`, focused assignment subclass
  integration, `npm run lint:backend:check`; full gate. Add `@remarks` for initial-attempt
  accounting and batch-wide classification-before-retry ordering.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 6 — Atomic LLM completion and validated cache reuse

### Objective and constraints

Make every eligible LLM task terminal, including service-wide stop, without semantic
retries. LLMRequestManager 470→470 after removing recursive validation retries,
duplicated parse paths and unused controls/aliases; CacheManager 116→about 75 after
removing orphaned assessment-specific wrappers. Its generic get/put behaviour is unchanged.
Do not add another cache module or put LLM schemas in generic cache operations.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Contracts + Corpus;
  @src/backend/RequestHandlers/LLMRequestManager.js @src/backend/RequestHandlers/CacheManager.js
  @docs/developer/security/README.md @docs/developer/security/data-handling.md .
- **Shared helpers — extend/reuse:** LLM manager's one successful-result validator
  delegates numeric Assessment constraints, reused for live and cached results;
  domain atomic error creation; generic `CacheManager.get/put`. Assessment-specific
  versioned key/retained request identity stays beside request generation. Planned
  entries: AssessmentFlow result/cache/transport register (`Not implemented`).
  Remove `CacheManager.generateCacheKey`, `getCachedAssessment` and
  `setCachedAssessment` once their sole production caller has moved to generic get/put;
  do not retain dead wrappers for their tests. The shared six-hour TTL constant remains
  owned/exposed by `CacheManager.CACHE_EXPIRY_SECONDS`; LLM writeback passes that value
  explicitly to put, as other cache users already do. No duplicate TTL/default.
- **Data shapes:** planned `assignment.md` result causes/terminal item constraints;
  LLM service body/envelope unchanged. No persisted run-status field.
- **Canonical fixtures:** `small` valid non-spreadsheet tasks, `medium` mixed tasks;
  local HTTP/invalid JSON/cache mutations. Migrate touched Phase 3 tests only.

### Acceptance criteria / required tests (Red first)

1. Only usable student/template hashes establish template N; known prior E bypasses
   LLM dispatch, successfully extracted blank work keeps N, spreadsheets stay local.
2. Parse/validate a successful response once. All three numeric criterion objects
   with string reasoning are required; null/missing/extra criteria, non-finite/range
   errors and invalid JSON immediately make all three `LLM_INVALID_RESPONSE` E. No
   extra HTTP request or partial criterion salvage occurs.
3. Permanent per-request HTTP failure → `LLM_HTTP_FAILED`; retry exhaustion/network →
   `LLM_UNAVAILABLE`; LLM 401/403/404 → `LLM_RUN_STOPPED` on affected/remaining eligible
   tasks. Already completed same/earlier-batch, cached and N results survive. Every
   eligible item ends terminal and retains successfully extracted content.
4. Cache key is versioned and sensitive to task type plus reference/template/student
   hashes; retain it through writeback. Old keys miss. Malformed hits log safely and
   re-request. Validate cache hits identically to live numeric results, never cache E.
   Cache-service failure remains a logged miss/best-effort write, not assessment E.
5. Unknown/duplicate UID fails before arbitrary routing; assignment/mutation/cache
   wiring errors are not inside decode catches. Ordinary expected assessment failure
   gets `ASSESSMENT_FAILED` only at its actual known boundary, not by blanket catch.

### Red → Green → Refactor and checks

- Extend `assignmentPhase3.test.js` 222→≤350 for existing routes; add
  `tests/requestHandlers/llmRequestManager.outcomes.test.js` and
  `tests/requestHandlers/llmRequestManager.cache.test.js` (≤300 each). Update the generic
  `tests/requestHandlers/CacheManager.test.js` suite (369→about 220): retain generic
  get/put, malformed-cache/best-effort and shared-TTL coverage; move relevant key and
  assessment-cache behaviour assertions to the LLM cache suite before deleting the
  obsolete wrapper-specific tests. Other cache users must remain regression-green.
- Docs updates the in-scope cache call-chain narrative in AssessmentFlow and the
  assessment-cache subsection of `docs/developer/security/data-handling.md` in this
  section: versioned LLM-owned keys, generic get/put, unchanged shared TTL and
  best-effort behaviour. Do not change authentication-cache semantics.
- Green: wire Section 5 outcomes into one parse/validate/assign path; replace all
  criteria atomically on failure. Refactor away validation recursion, component-build
  controls, taskDef alias and silent unknown-UID returns.
- Checks: all request-handler suites and relevant assignment integration;
  `npm run lint:backend:check`; full gate. `@remarks`: semantic invalidity is terminal,
  key versioning is not a purge/migration and cache cannot define authoritative success.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 7 — Scoped image failures and hydration invariants

### Objective and constraints

Use the shared transport budget and retain document round-robin image scheduling.
ImageManager 221→285. Required shared image failure blocks; student image failure
becomes that task's E and never reaches the LLM. Do not alter image URL/source-link policy.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Contracts + Corpus;
  @src/backend/RequestHandlers/ImageManager.js .
- **Shared helpers — extend/reuse:** existing image collection/fetch/writeback owners,
  base transport and Assessment error creation; no second retry or hydration manager.
  Planned register: AssessmentFlow/rehydration (`Not implemented`).
- **Data shapes:** planned IMAGE pending/completed semantics in `assignment-definition.md`
  and `assignment.md`; no new artefact error field.
- **Canonical fixtures:** Section 2 `small` IMAGE bodies/IDs and `medium` mixed results;
  local missing-URL, response/blob/decode failures, not another realistic image graph.

### Acceptance criteria / required tests (Red first)

1. Round-robin by document persists; Slides-fetch batch size and three-total-attempt
   budget are honoured. Images require HTTP 200, not 201. No retry scheduler nesting.
2. Failed download/known unreadable blob, absent required source URL or unusable hydrated
   content becomes student-task `IMAGE_HYDRATION_FAILED` E with null content/hash, or
   shared-input run failure by scope. Healthy siblings survive; old results are not
   replaced after a shared-input failure.
3. Expected blob/content decode failures are narrow; unmatched/duplicate UID or missing
   model method is a wiring fault that throws. Successful writeback updates hash and
   invalidates stale item results/feedback as needed; no broad catch-and-warn fallback.

### Red → Green → Refactor and checks

- `imageManagerCoverage.test.js` 482→about 640 unsplit: move collection and writeback
  responsibilities to `tests/requestHandlers/imageManager.collection.test.js` and
  `tests/requestHandlers/imageManager.writeBack.test.js`, keeping existing remainder
  and new `tests/requestHandlers/imageManager.failures.test.js` each ≤300. Preserve
  `tests/requestHandlers/imageManagerPhase5.test.js` (162 lines: collection scopes and
  blob/hash writeback) and the empty-input/configuration-acquisition cases in the existing
  coverage suite's fetching block. Reuse existing mocks; do not rely on old plan numbering.
- Green: assign scoped final failures using Section 5 outcomes. Refactor log-only
  omissions/duplicate image batching while retaining useful scheduling.
- Checks: image suites plus Slides pipeline and LLM skip-E integration;
  `npm run lint:backend:check`; full gate. `@remarks`: image HTTP failure scope differs
  from LLM-wide stop scope; pending images are not completed null successes.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 8 — Prepared persistence and truthful run completion

### Objective and constraints

Validate completed terminal results, stamp marker 1, prepare four independent payloads
before the first mutation, then write in existing order. Assignment controller 425→470;
ABClass facade 490→490; assignment ops 279→410; persistence 223→275. Keep facades thin.
No transaction, rollback claim, unconditional finally-save or read repair.

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Contracts + Corpus + API;
  @src/backend/y_controllers/AssignmentController.js
  @src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js
  @src/backend/y_controllers/ABClassController/ABClassPersistence.js .
- **Shared helpers — extend/reuse:** existing run controller and assignment ops;
  `ABClassPersistence._prepareClassAndPartial`/`_prepareClassPartial` prepare prospective
  class projections. Its existing write-through owner must consume those exact prepared
  snapshots without reserializing after the full assignment commit. Ordinary class saves
  keep the same preparation path, not a competing writer. Planned owners/status:
  AssessmentFlow prepared-projections and rehydration entries (`Not implemented`).
- **Data shapes:** planned completed-write/marker and legacy serializer rules in
  `assignment.md`/`abclass.md`; retained collections/metadata contract unchanged.
- **Canonical fixtures:** `small` complete full/class models and `medium` mixed E;
  local injected projection/storage errors. Do not treat hand-built mocks with empty
  assessments as completed version-1 successes.

### Acceptance criteria / required tests (Red first)

1. Reject incomplete/extra-criterion results and unusable shared inputs before ANY
   insert/replace/save. Require all known submitted tasks terminal. Legitimate empty
   no-submission remains valid. Stamp full and partial marker 1 only for completed runs.
2. Prepare full assignment, embedded partial, prospective full class and class-partials
   before mutation. No serialise→restore→serialise solely for validation; no new
   projection runs after full commit. Prepared snapshots do not alias/mutate each other.
3. Write full assignment, then class collection, then `abclass_partials`. Inject failure
   in each projection and each write/save phase; errors propagate, diagnostics include
   failed phase/full-commit state, and no false completion or implicit read repair occurs.
4. Handled student/LLM E persists beside successes, including earlier/same-batch successes
   on LLM stop. Final message is `Assessment run completed with errors.` and failed task
   count counts each item once, not criteria. Healthy run keeps normal success feedback.
5. Shared-definition/image failure, list-page failure, unexpected wiring and storage
   failures do not call completed-run persistence/success. Trigger admission/locks/API
   envelope stay unchanged. Successful reassessment replaces only the selected result.
6. Mixed legacy/current class save preserves opaque legacy bodies/marker values; a read
   E projection never becomes write input. Existing supplied metadata semantics persist.

### Red → Green → Refactor and checks

- Extend persistence unit tests 40→≤250, assignment-ops unit tests 100→≤300 and
  `abclassController.persistAssignment.test.js` 386→≤480; add
  `tests/controllers/assignmentRunCompletion.test.js` (≤300). Run existing real-controller tests as well.
- Touched `assignmentController.hydration.test.js` 653→about 700 unsplit: retain process/
  pipeline hydration in that file and move definition-input/startProcessing cases into
  `tests/controllers/assignmentController.definitionInputs.test.js`, each ≤380. Keep test setup reusable
  within existing testing conventions. `runAssignmentPipeline` suite 407→≤480.
- Green: preflight prospective class update before writes, thread prepared projections
  through existing owners, then finalize progress only after the final successful save.
  Refactor obsolete reconstruction/projection work, not unrelated metadata/recovery.
- Checks: all assignment/ABClass controller and API assessment suites;
  `npm run lint:backend:check`, `npm run test:synthetic`; full gate. `@remarks`: explicit
  non-transactional write ordering and why completed-with-errors is not a storage success.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 9 — Error-aware preview assembly and local source states

### Objective and constraints

Apply approved preview precedence without changing class analysis from a full preview
fetch. Keep the existing card/popover, source action and query owners. Budgets:
lookup 251→340; task assembly 141→195; merged assembly 195→255; preview content 128→185;
preview cell 309→335; card 280→330; page 392→435; data hook 394→445; columns 403→455;
preview queries 100→155. The cell passes derived states through its existing controlled
popover/focus owner; it does not become a second query or error-resolution owner.
No new generic fallback helper, navigation, retry button or broad null coercion.

### Delegation and planning blocks

- Mandatory reads: Common + Frontend + Analysis/UI + Contracts + Corpus;
  @src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts
  @src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts
  @src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts
  @src/frontend/src/features/taskHeatmap/heatmapsPreviewQueries.ts
  @src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx
  @src/frontend/src/features/taskHeatmap/TaskMetricPreviewContent.tsx
  @src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx
  @src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx
  @src/frontend/src/features/taskHeatmap/TaskHeatmapPage.tsx
  @src/frontend/src/features/taskHeatmap/useHeatmapsPageData.ts .
- **Shared helpers — extend/reuse:** lookup and task/merged assemblers retain source
  selection/URLs; query composition supplies pending/failed states and class-partial E
  by actual assignment/student/task/criterion. Card/content render the derived state;
  columns/page/hook pass it through. All owners recorded `Not implemented` in frontend
  standards §9.29; no shared service depending on React/heatmap components.
- **Data shapes:** implement planned `CellPreviewData.errors`, selected `error`,
  `sourceState` and retained reasoning in `frontend-data-analysis-response.md`.
  These are in-memory view models, not backend artefact or MetricResult fields.
- **Canonical fixtures:** `small` valid TEXT/IMAGE/SPREADSHEET and `medium` mixed E;
  local stale query, unavailable/invalid full item and legacy mutations. Reuse and
  opportunistically migrate touched preview fixtures, not unrelated browser helpers.

### Acceptance criteria / required tests (Red first)

1. Precedence: full-record validation E, class-partial E, selected full-item E, analyser
   metric. Errors/reasoning follow existing first-selected merged source, never another
   assignment sharing its definition/task key. Missing lookup cannot erase known E.
2. Known E + pending full fetch shows card/E/reasoning now, source-only skeleton; terminal
   fetch failure/null switches source to unavailable/local Alert, never perpetual loading.
   No known result preserves current whole-preview loading/blocking-query treatment.
3. Assessment-only E with valid content renders response normally and safe source action.
   Known E with null IMAGE/SPREADSHEET uses `artifactContent: ''`/unavailable without
   invoking throwing coercion; unexpected non-E null bypassing validation still throws.
4. Genuine no-submission shows ready N, `sourceState: 'available'`, empty content/null
   error/null source URL, no Alert. Legacy shows safe reassessment copy/local Alert.
5. Full-fetch-only corruption overrides preview and shows exact scores-unchanged notice;
   class query cache, heatmap scores, averages, filters and metadata persistence are
   unchanged. Separately, E already in class input affects normal analysis.
6. Cover every layout state/copy, non-dismissible fail-closed source Alert, safe source
   link omission/retention, focus-once/Escape/return/untrapped Tab, no focus theft on
   source arrival. Label source skeleton with busy output, not redundant status role.
   Background refetch eligibility alone does not discard usable content.

### Red → Green → Refactor and checks

- Add `heatmapsPreviewQueries.spec.ts` and scenario-focused
  `assembleTaskPreviewData.errors.spec.ts`, `assembleMergedPreviewData.errors.spec.ts`,
  `TaskPreviewCard.errors.spec.tsx`, and
  `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.errors.spec.ts`
  (≤300 each). The lookup companion pins per-criterion error/reasoning maps, full-record
  validation-error derivation and safe source state; query/assembly companions pin
  precedence and missing-lookup known-E fallback. Extend content spec 212→≤340, source-link
  spec 238→≤300 and hook preview spec 392→≤480. Existing assertion matrices stay in
  place, but required typed-fixture fields must be adapted during Red: assembly spec
  437→≤470, merged assembly spec 311→≤340, lookup specs (main 173→≤200, content
  192→≤220, indexing 289→≤320), and
  `src/frontend/src/test/taskHeatmap/previewSourceActionTestHelpers.ts` 316→≤350.
  Add `errors` maps and `error`/`sourceState` fields as appropriate; healthy fixtures
  use explicit null causes and ready source state, error probes use their valid
  cause/state. Keep the merged-table spec's assertion matrix unchanged, allowing
  only this mechanical fixture repair (478→≤495). Other discovered typed literals
  receive the same required-field adaptation under the sizing gate. New behavioural
  matrices belong in the focused companion suites, not these existing large specs.
- Green: extend view-model maps, propagate instance-scoped partial fallback through
  existing query composition and render source states. Refactor no-data fallback only
  where it currently conceals known E. Consult official Ant Design Card/Alert/Popover/
  Skeleton docs again before editing components; preserve the approved layout.
- Update stale removed-layout pointers in touched card/CSS and focus/source-link specs
  to the approved layout companion. In the touched lookup module, replace its stale
  `ABClassResponseMapper.js:88` comment pointer with the stable `_toReadView` owner
  reference, not a new brittle line number. Do not introduce spacing/width constants.
- Checks: `npm run test:frontend -- src/features/taskHeatmap`, analyser E suite,
  `npm run lint:frontend:check`, `npm run typecheck:all`; full section gate.
  `@remarks`: preview-only corruption intentionally does not rewrite class analysis,
  merged source identity, and ready no-submission versus unavailable error source.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 10 — Browser journeys across both heatmap entry points

### Objective and constraints

Prove usable mixed healthy/E previews end to end in embedded and standalone/merged
surfaces. Delegate to Playwright, not Testing Specialist. Preserve existing keyboard,
narrow viewport, reduced motion and refresh behaviour; no live Google/LLM calls.

### Delegation and planning blocks

- Mandatory reads for Playwright, Implementation (if fixes), Code Reviewer and Docs:
  Common + Frontend + Analysis/UI + Contracts + Corpus + Browser;
  @src/frontend/e2e-tests/heatmaps.spec.ts
  @src/frontend/e2e-tests/helpers/task-heatmap-fixtures.ts
  @src/frontend/e2e-tests/helpers/task-heatmap-class-fixtures.ts
  @src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts .
- **Shared helpers — reuse/keep local:** existing API interception/navigation helpers;
  scenario overrides stay test-local. Combined Section 2 + Section 10 helper budgets:
  fixture helper 244→≤290, class helper 240→≤280, journey helper 236→≤280. Section 2
  already reconciles existing wire fixtures; this section adds new journeys. No new realistic fixture builder or
  production helper. Canonical fixture policy/status is recorded in synthetic-data notes.
- **Data shapes:** no new shapes; exercise Section 9 view models via contracted APIs.
- **Canonical fixtures:** direct JSON imports of `small`/`medium` named views; derive
  shared-definition assignment instances from actual profile records, with local
  controlled response corruption/delay/failure. Migrate only helpers/tests changed here.

### Acceptance criteria / required tests (Red first)

1. Embedded heatmap: healthy sibling plus assessment E with valid source; E without
   source; known partial E remains readable during delayed and failed/null full fetch;
   card opens without app unmount and preserves safe source-link keyboard behaviour.
2. Standalone merged view: two instances sharing a definition, only first-selected
   source has partial E; no second-instance reasoning/content leakage. Test healthy
   sibling, missing full entry and stale cross-query precedence explicitly.
3. Preview-only corruption retains class cell/summary values and shows exact notice.
   Legacy reassessment preview has correct copy and an unaffected current sibling.
4. Refresh replaces E with newly valid content/results using current query ownership;
   focus is transferred once, Escape returns focus, Tab is untrapped. Long reasoning/
   Alert copy wraps inside narrow viewport; error is not conveyed solely by colour.

### Red → Green → Refactor and checks

- Add `assessment-error-previews.spec.ts` and
  `assessment-error-merged-previews.spec.ts` (≤280 each), reusing runner-neutral helpers.
  Assert semantic state/content/association, not screenshot-only success.
- Green: add route-controlled responses and fix only genuine in-scope failures through
  Implementation/review. Refactor duplicated scenario setup into existing test owners
  only when reuse is demonstrated; no Vitest-only imports in browser chains.
- Repoint obsolete layout references if touching
  `src/frontend/e2e-tests/task-preview-source-link.visual.spec.ts` (412→≤430),
  `src/frontend/e2e-tests/task-preview-source-link.states.spec.ts` (55→≤70) or
  `src/frontend/e2e-tests/helpers/task-preview-source-link-geometry.ts` (440→≤455),
  as well as the Section 9 card/focus pointers. Do not expand their scenario scope
  merely to replace a documentation link.
- Checks: `npm run test:frontend:e2e -- assessment-error`, then existing heatmap/preview
  source-link journeys; `npm run typecheck:all`, `npm run lint:frontend:check`; full gate.
  `@remarks`: test-only query timing probes may document deterministic intent; no new
  production remarks beyond Section 9.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 11 — Regression and contract hardening

### Objective and constraints

Verify the complete pipeline and detect residual duplicate retry/restoration paths.
No unrelated cleanup or weakened assertions/coverage thresholds. Add any missing
boundary regression before fixing the exposed code (Red → Green → Refactor).

### Delegation and planning blocks

- Mandatory reads: Common + Backend + Frontend + Analysis/UI + Contracts + Corpus +
  API + Builder; Browser for browser work. Code Reviewer/De-Sloppification review only
  this feature's diff; Docs/Data Shapes Agent receive the same changed-owner references.
- **Shared helpers:** reuse delivered owners; no additional planned extraction.
- **Data shapes:** check all four canonical contracts against runtime/frontend and
  fixture outputs; no new contract decision belongs here.
- **Canonical fixtures:** `small` cross-layer and `medium` mixed full/partial graphs;
  local faults for boundary/error cases. No broad historical test migration.

### Acceptance criteria / required tests (Red first)

1. Contract regression combines no-submission/blank work, extraction E, image E, invalid
   LLM response, transient exhaustion and run-stop with healthy/cached results. Every
   persisted submitted task has exactly three terminal criteria and matching marker.
2. Real mocked-store controller/API reads of both projections survive identifiable
   corruption; root/identity faults fail loudly. Repeat reads are mutation-free. Ordinary
   class save preserves legacy state; reassessment alone replaces the selected result.
3. Projection/save fault matrix proves write order and no false success; exact dispatch/
   sleep assertions prove no surviving semantic retry path or doubled image batching.
4. Numeric/fraction/N/zero-weight/excluded/mixed-E averages and metadata evidence remain
   contract-correct; preview-only full corruption cannot trigger class metadata writes.
5. Both generated GAS output-order assertions and static public-entrypoint guards pass.
   Touched file sizes honour the budgets/splits, with no line-condensing workaround.

### Red → Green → Refactor and checks

- Add missing cross-boundary cases in focused companion tests (≤300), not oversized
  averaging rows/metric-resolution or graph suites. Run narrow suites before broad gates.
- Run `npm run lint:check`, `npm run test:backend`, `npm run test:frontend`,
  `npm run test:builder`, `npm run test:synthetic`, required preview/heatmap Playwright
  suites, `npm run typecheck:all`, and finally `npm run run-all-checks` (coverage + build).
- Verify two regenerations produce no further fixture changes; inspect generated GAS
  runtime file list and successful production build. Run the full section regression
  comparison with the stable ID and require zero new/unaccounted failures.
- Obtain clean Code Reviewer sign-off after Data Shapes Agent reconciliation; apply
  De-Sloppification findings only in scope, re-review/retest any resulting edits.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Section 12 — Documentation and coordinated rollout handoff

### Objective and constraints

Finish same-change canonical documentation and a reproducible release-validation
handoff, without deploying or claiming the original production cause is established.
Documentation is also updated as each earlier section lands; this is the final audit.

### Delegation and planning blocks

- Mandatory reads for Docs/Data Shapes Agent/Code Reviewer: Common + Contracts + Corpus +
  API and relevant Backend/Frontend/Analysis/UI sets; @docs/pedagogy/data-analysis-scoring.md
  @docs/developer/security/data-handling.md .
- **Shared helpers:** reconcile AssessmentFlow, rehydration and frontend standards §9.29
  against actual owners/callers. Remove `Not implemented` only for delivered entries;
  no stale pending entries for completed in-scope functionality.
- **Data shapes:** Data Shapes Agent reconciles assignment, definition, class and
  analysis-response docs; preserve historical/current distinctions until replaced by
  accurate implemented descriptions. No invented endpoint or persisted status graph.
- **Canonical fixtures:** synthetic capability/policy documentation reflects actual
  E/accuracy/IMAGE/SPREADSHEET support and selected views; invalid probes remain local.
  Documentation-only work adds no fixture or production module.

### Acceptance criteria / required checks (Red first)

1. Audit stale paths/retry budgets/whole-submission retry/drop/formulaComparison claims
   before edits. Docs accurately describe bounded retries, scope, E reasoning/cause,
   partial retention, markers, raw validation, read/persistence separation, no repairs,
   prepared writes, partial-write diagnostics and preview-only corruption limitation.
2. API docs retain the same method/envelope inventory and explain changed response
   projection, not a new endpoint. Scoring/analysis docs distinguish E from N and
   preserve average/denominator rules. Test docs describe canonical capability/commands.
3. Preserve useful `@remarks` from earlier sections for non-obvious boundaries. Repoint
   only touched obsolete preview-layout references. Record final tests/reviewer reports,
   projected-versus-actual file sizes, deviations and any deployment validation limits.
4. Rollout instructions require one coordinated frontend/backend build. Existing data,
   definitions and class configuration remain; legacy reads become reassessment E,
   reassessment creates marker-1 results, old cache keys miss. No bulk reset/purge.
5. Manual validation checklist: mixed healthy/E class and standalone previews, safe source
   links, legacy reassessment then selected rerun/refresh, shared-input blocking preserves
   prior results, and safe completion-with-errors feedback. Do not publish synthetic
   fixtures or trigger live failure scenarios without a separately authorised deployment.

### Red → Green → Refactor and checks

- Red: identify outdated in-scope statements against delivered tests/source; add a
  regression before fixing any behavioural discrepancy found by the audit.
- Green: delegate canonical prose updates to Docs and contract updates to Data Shapes
  Agent. Refactor duplicated policy to links to its canonical owner, not a docs rewrite.
- Run targeted Prettier checks on changed docs and `git diff --check`; require clean
  final review and the stable-ID regression comparison after cleanup/documentation
  changes. If final cleanup changes nothing, record that and reuse the preceding clean
  comparison per regression-checker policy. No unverified production-test claims.
- Execution record: Not started; changes/checks/deviations/downstream implications pending.

## Implementation order and final readiness

Execute Sections **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12**.
Section 2's four substeps are one atomic cut-over, not independent deployments.
Later work uses that valid canonical contract; final persistence orchestration follows
all terminal-outcome producers, and previews follow both read contracts and analysis.

Implementation starts only after independent Planner Reviewer approval of this plan.
Completion requires all section records filled, clean code review, reconciled canonical
docs, passing full gates and no unresolved questions. Deploying/committing requires its
own user/orchestrator authorisation; this plan does not perform either operation.
