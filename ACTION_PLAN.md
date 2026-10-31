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
- Sections 1–6 are complete (Section 4 gate has an explicit user-accepted flaky-debt exception); Section 7 is **regression gate passed — commit/push pending**; Sections 8–12 are **Not started**. Record actual changes,
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

| Finding                                                     | Severity | Scope rationale                                                              | Evidence                                                                                                    | Disposition | User decision                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 7 Red test capacity and connected blocking evidence | Material | Required review matrices exceed planned writeback/failure companion capacity | `section7-red-review.md` R1–R8; writeBack 300 lines, failures 291; `section7-red-evidence.md` R3 checkpoint | approved    | User approves test-only `imageManager.identity.test.js`, `imageManager.invalidation.test.js`, and `imageManager.integration.test.js` under `tests/requestHandlers/`, each ≤300 lines; reuse existing canonical fixtures/harnesses, no production helper or Section 8 implementation |

| Finding                                       | Severity | Scope rationale                                                 | Evidence                                               | Disposition | User decision                                                                                                                                                                                                         |
| --------------------------------------------- | -------- | --------------------------------------------------------------- | ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing-hash LLM cache admission/write policy | Material | Explicit handling of present content with missing hash required | `section6-remaining-red.md`178–184; user clarification | approved    | Final decision supersedes interim existing-error-path answer: stored content requires usable contentHash; fail loudly as internal invariant fault before cache lookup/LLM dispatch, no live fallback/new assessment E |

| Finding                                  | Severity | Scope rationale                                                                        | Evidence                                                                              | Disposition | User decision                                                                                                                                                                                             |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 6 cache-validation test capacity | Material | Cache suite497 lines; focused validation companion preserves precise coverage below500 | `.opencode/scratchpad/section6-cache-validation-red.md`; parent seed/diagnostic audit | approved    | User approves test-only `tests/requestHandlers/llmRequestManager.cacheValidation.test.js`; reuse approved harness, preserve all85 cases and repair masking/diagnostic assertions, no production expansion |

| Finding                                                          | Severity | Scope rationale                                                                                      | Evidence                                                    | Disposition | User decision                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 6 run-stop test/harness capacity after smaller preflight | Material | Healthy canonical preflight passes, but harness494/failures440 need a focused split before stop rows | `.opencode/scratchpad/section6-run-stop-small-preflight.md` | approved    | User approves test-only `tests/helpers/llmRunStopHarness.js` and `tests/requestHandlers/llmRequestManager.runStop.test.js`; preserve every case and all acceptance criteria, every file below500; no production or corpus expansion |

| Finding                                             | Severity | Scope rationale                                                                                     | Evidence                                                                                                         | Disposition | User decision                                                                                                                                                                                                                                                |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Section 6 mixed run-stop canonical fixture capacity | Material | Seven-item numeric-healthy TEXT setup unavailable; coverage can use smaller complementary scenarios | `.opencode/scratchpad/section6-run-stop-preflight.md`: three numeric TEXT pairs plus one type-matched 0/0/N pair | approved    | User approves three healthy canonical TEXT items plus existing type-matched item for a genuine template-copy N control; separate same-batch and earlier-batch arrangements preserve all acceptance coverage. No generator extension or type-match relaxation |

| Finding                                                  | Severity | Scope rationale                                                        | Evidence                                                                                                  | Disposition | User decision                                                                                                                                                                                                           |
| -------------------------------------------------------- | -------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 6 outcomes test capacity and shared test harness | Material | Current outcomes suite is 499 lines before remaining required coverage | `tests/requestHandlers/llmRequestManager.outcomes.test.js`; first Red review R3/R5 and pending milestones | approved    | User approves test-only `llmRequestManager.eligibility.test.js`, `llmRequestManager.failures.test.js` and `tests/helpers/llmRequestManagerHarness.js`; preserve all cases, every file below500, no production expansion |

| Finding                                                                                       | Severity | Scope rationale                                                                                                             | Evidence                                                                   | Disposition | User decision                                                      |
| --------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| Existing LLM semantic retry, null-hash, cache/live validation and semantic diagnostics issues | Material | Later Section 6 owns these pre-existing defects, outside Section 5 transport; no proven incident or privacy breach asserted | `.opencode/scratchpad/section5-transport-final-green-review.md`; Section 6 | noted       | Not requested; implement only under Section 6's authorised surface |
| Existing image collection diagnostics, scoped failures and write-back catch behaviour         | Material | Later Section 7 owns these pre-existing defects, outside Section 5 transport                                                | `.opencode/scratchpad/section5-transport-final-green-review.md`; Section 7 | noted       | Not requested; implement only under Section 7's authorised surface |

| Finding                                            | Severity | Scope rationale                                                                                    | Evidence                                                        | Disposition | User decision                                                                                                                                                         |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 5 caller-boundary regression test capacity | Material | Required Green-review stop/validation/UID regressions need test space; existing LLM suite478 lines | `.opencode/scratchpad/section5-transport-green-review.md` G1–G4 | approved    | User chooses test-only split of existing caller suite before adding regressions; preserve all cases, keep each below500, no new production module or Section6/7 scope |

| Finding                                       | Severity | Scope rationale                                                        | Evidence                                                                           | Disposition | User decision                                                                                                                                                                                         |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 5 ImageManager consumer test capacity | Material | Required connected-consumer reconciliation exceeds the below-500 limit | `section5-consumer-reconciliation-green.md`: existing482 lines; trial534, reverted | approved    | User authorises moving write-back describe block into existing imageManagerPhase5.test.js and reconciling coverage mocks; no new file or production scope; preserve assertions and keep both below500 |

Deferred-findings log: `.opencode/scratchpad/assessment-errors-322-341-deferred-findings.md`.

| Finding                                                | Severity | Scope rationale                                                                             | Evidence                                                                                                          | Disposition | User decision                                                                                                                                 |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings authentication-mode E2E retry-recovered flake | Material | Unchanged frontend journey outside Section 4 backend/docs surface; no causal link evidenced | `.opencode/scratchpad/section4-regression-e2e-investigation.md`; regression comparison `2026-10-28T06-48-49.500Z` | noted       | User explicitly selected “Accept as flaky debt”; accept this identified gate exception, no frontend fix or baseline/checker change authorised |

User sizing clarification: files below500 physical lines may exceed earlier predicted
or section-specific estimated sizes without further approval. Apply this allowance to
the in-scope test/owner files; no formatting condensation or assertion loss is needed
to meet earlier predictions. Scope/behaviour constraints and reviews remain unchanged.
In particular G2 recovery companion may exceed its former300-line estimate provided
it stays below500; the interrupted372-line checkpoint still needs fixture/expectation
repairs and validation, but size alone is no longer a blocker.

Slides bounded Green PASS:
`.opencode/scratchpad/section4-slides-boundaries-final-review.md`.
SB1/SB2/SB3 CLOSED; Slides G3/G7 accepted alongside Sheets. Fresh3306backendtests
PASS, branches85.01%(3665/4311);13consumerPASS, no new lint findings (five accepted
historical warnings only). G2/G4/G6/G8 remain OPEN. Begin G2 recovery Red in approved
<=300-line test-only companion; preserve first-failure-if-none-supported and existing
last-supported-source selection. No Section4 completion regression run yet.

Slides SB1 and SB2 CLOSED by independent re-review
`.opencode/scratchpad/section4-slides-boundaries-green-clean.md`.
Fresh3304backendtestsPASS, branches85.01%; focused145PASS. SB3 remains OPEN:
multi-cell matrix currently throws only, despite earlier handoff's literal-null claim;
extend same matrix for literal-null at both coordinates and strict original Error
reference identity. No runtime defect observed. Test owner; consumer473/500.

SB2 JSDoc repair delivered, independent re-review pending:
`.opencode/scratchpad/section4-slides-sb2-jsdoc.md`. Comments-only validation passed;
no canonical G8 docs changed. Parent verified current physical LOC content325,
facade458, matcher351; these supersede earlier handoff counts (reported two-line
pre-edit sizing discrepancy has no runtime consequence). SB1 coverage repair remains
in flight; SB3 test additions also await independent re-review.

Slides bounded Green review SB1–SB3 OPEN, all in scope:
`.opencode/scratchpad/section4-slides-boundaries-green-review.md`.
SB1 backend3295testsPASS but branch coverage84.92%(3661/4311)<85%; blocking new
coverage failure, not accepted debt. SB2 changed-owner nullable/definition/native-guard
JSDoc needs reconciliation. SB3 persistent multi-cell first-failure, ordinary table
dimension conversion and ordinary-open single-original-diagnostic assertions needed.
Runtime probes passed; regression-proof gap, not observed traversal defect. Owners:
Testing Specialist SB1/SB3, Docs SB2. No threshold/config/runtime policy change.

Null-cell supplemental Red independently PASS:
`.opencode/scratchpad/section4-slides-null-cell-red-review.md`.
Current focused5PASS/4 accounted-for failures (two null-cell outcomes and two existing
model warnings); backend3291PASS/4FAIL, no unexpected failures. Required control
groups retained; historical12-case claim is not attributable evidence. Resume bounded
Green: null-cell conversion and approved owner-local complexity split, then remaining
assignment/matcher diagnostics. Complexity40/15 remains an in-flight defect, not debt.
G8 must reconcile canonical docs with approved student null-return policy.

| Finding                                   | Severity | Scope rationale                                                                          | Evidence                                            | Disposition | User decision                                                                                                                      |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 connected null-cell test sizing | Material | Approved null-cell outcome needs real assignment coverage beyond original300-line budget | section4-slides-null-cell-red.md; expected310 lines | approved    | User approves existing assignmentExtraction.parserFailures.test.js up to320 lines; tests only, no new file/helper/production owner |

| Finding                                           | Severity | Scope rationale                                         | Evidence                                                                    | Disposition | User decision                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | -------- | ------------------------------------------------------- | --------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 Slides table complexity repair surface  | Material | Native policies exceed lint complexity                  | Latest content checkpoint: extractTableCells complexity40/15                | approved    | User approves small Slides-specific methods within existing content owner; no new module, generic exception wrapper, hierarchy or lint suppression; catches stay at native reads                                                                                                                      |
| Section 4 malformed null-cell diagnostic contract | Material | Previous throw-only contract required explicit decision | slidesParserTableFailureConsumer.test.js:90–129; latest focused82PASS/1FAIL | approved    | User explicitly requires student null-cell results to become extraction SOURCE_CONTENT_UNAVAILABLE. Reconcile former throw-only test under reviewed Red/Green workflow; shared-definition failures still throw and genuinely thrown native TypeError/ReferenceError/non-Error guards remain unchanged |

| Finding                                                | Severity | Scope rationale                                                            | Evidence                                    | Disposition | User decision                                                                                                             |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------------- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Section 4 mixed acquisition failure cause priority     | Material | Multiple failed attachments with no accepted source need agreed precedence | Read-only G2 exploration                    | approved    | User chooses first failure; adds that AssessmentBot supports one attachment per student submission for now                |
| Section 4 accepted source alongside failed attachments | Material | Combined-source outcome needed clarification                               | Read-only G2 exploration                    | approved    | User confirms selected supported source suppresses acquisition E from rejected attachments                                |
| Section 4 acquisition recovery test capacity           | Material | Existing suites lack space                                                 | Read-only G2 exploration                    | approved    | User approves tests/assignment/assignmentAcquisitionRecovery.test.js <=300 lines, tests only; no new runtime owner/helper |
| Section 4 single-attachment selection interpretation   | Material | One-attachment statement required clarification against existing selection | User clarification following G2 exploration | approved    | Preserve existing scan: last supported attachment wins; first failure is recorded only if no supported source is found    |

Section 4 active in-scope review ledger: Slides supplemental Red SC1 and SC2 CLOSED
by `.opencode/scratchpad/section4-slides-content-red-rereview.md`.
Actual focused30PASS/28 intentional RED, no fixture defects. SC3 CLOSED after
prose-only correction and independent re-review:
`.opencode/scratchpad/section4-slides-content-red-approved.md`.
Bounded content Red readiness PASS; no checks rerun for prose-only correction.
The28 failures remain intentional implementation requirements, not baseline debt.
Separate document-open/internal-parser/single-diagnostic Red work is in flight;
Slides G3/G7 and Section4 remain open. No production edits yet.

Slides opening/diagnostics Red review: OD1 and OD2 OPEN (test owner). OD1 must
permit authorised taskId context while retaining single diagnostic, source/row/column
and exact raw-error identity assertions. OD2 must correct assertion-reach prose;
no-items/no-log checks after failed identity are not executed evidence. Report:
`.opencode/scratchpad/section4-slides-open-diagnostics-red-review.md`.
Focused16PASS/5 intentional RED; backend3261PASS/33 intentional RED, zero unexpected
failures. These are reviewed Red requirements, not regression-gate evidence or debt.

OD1/OD2 now CLOSED for bounded Red readiness:
`.opencode/scratchpad/section4-slides-open-diagnostics-red-approved.md`.
Both Slides supplemental Red loops are approved;33 intentional Reds are inventoried
(28 content/context/native guards plus5 opening/diagnostic assertions), no unexpected
backend failures. Begin Slides G3/G7 Green in four approved existing owners only;
tests stay unchanged. G2/G4/G6/G8 remain separate open milestones.

Slides Green first attempt INCOMPLETE: partial edits in assignment/matcher/content
owner, facade untouched; focused4suites25FAIL/50PASS, no formatter/report delivered.
Parent audit confirms unfinished native guards/context forwarding; not accepted or
section-gate evidence. Recovery split: first finish existing content owner+facade,
then reconcile assignment/matcher diagnostic ownership; tests remain unchanged.
Five historical lint warnings remain accepted, not newly introduced by this attempt.

| Finding                                           | Severity | Scope rationale                                                                                                                  | Evidence                                                                                                                               | Disposition | User decision                                                                                                                                                                                                  |
| ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 Slides boundary regression test surface | Material | Approved suites lack room for content-internal fault escape, facade context threading and explicit shared-definition throw locks | Read-only Slides G3/G7 exploration: facadeDispatch107 lines, definitionExtraction207 lines; documentOpen280/300, parserFailures292/300 | approved    | User approves extending tests/parsers/slidesParserFacadeDispatch.test.js and tests/parsers/slidesParserDefinitionExtraction.test.js for these focused cases, each <=500 lines; no new file or production owner |

| Finding                                   | Severity | Scope rationale                               | Evidence                                                       | Disposition | User decision                                                                                                                                                                                       |
| ----------------------------------------- | -------- | --------------------------------------------- | -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 native Sheets guard test sizing | Material | SG1 guard matrix overran existing test budget | section4-sheets-green-review.md SG1; prior parser test 538/500 | approved    | User approves test-only split into tests/parsers/sheetsParserSourceBoundaries.test.js <=300, existing suite <=500. Preserve assertions/global restoration; no production helper or behaviour change |

| Finding                                               | Severity | Scope rationale                                                                                                                   | Evidence                                                                                                  | Disposition | User decision                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Section 4 immediate native-read owner surface         | Material | G3/G7 require narrow native-read conversion in existing parser/content owners                                                     | section4-green-review.md G3/G7; `DocumentParsers/SlidesParser/index.js`, `00_SlidesParserTableContent.js` | approved    | User approves proceeding after call-path discussion: native open/read catches only; matching, normalisation and mutation faults escape. Preserve shared-definition throws, single diagnostic owner; no new module/error hierarchy/pipeline guard |
| Section 4 obsolete Sheets dropped-range consumer      | Material | Directly affected existing test expects dropped failure rather than unavailable task                                              | `tests/parsers/sheetsParserInternalCoverage.test.js:290–315`; section4-green-review.md G5                 | approved    | User approves native student range read and directly affected test reconciliation; retain task/source/null-content/logging contracts                                                                                                             |
| Section 4 absent TaskSheet student range collaborator | Material | Existing internal collaborator has no production implementation in repository; cannot establish immediate native-read catch there | SheetsParser.js student extraction; read-only call-path exploration                                       | approved    | User approves replacing student extraction range call with native Sheet.getRange(...).getFormulas() and adapting directly affected tests. Preserve bbox/blank semantics; no definition parsing change or new helper/framework                    |

| Finding                                           | Severity | Scope rationale                                             | Evidence                                                                      | Disposition | User decision                                                                                                                                                   |
| ------------------------------------------------- | -------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 attachment without Drive file ID        | Material | User clarified the existing admission policy                | `04_AssignmentSubmissions.js:57–63`; data-shapes assignment.md discrepancy 25 | approved    | Retain existing ignore behaviour for non-Drive/missing-ID attachments; if nothing supported is acquired, retain no-submission representation. No runtime change |
| Completion-time marker stamping not yet delivered | Material | Explicitly owned by later Section 8, not a Section 4 repair | data-shapes assignment.md discrepancy 26; Section 8 criterion 1               | noted       | Implement and verify in Section 8; intermediate checkpoints are not deployable                                                                                  |

| Finding                                        | Severity | Scope rationale                                                                        | Evidence                                                       | Disposition | User decision                                                                                                                             |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 obsolete table RPC throw expectation | Material | Existing parser consumer test expected raw RPC throw contrary to approved task outcome | `tests/parsers/slidesParserTableFailureConsumer.test.js:31–73` | approved    | User authorises minimal unavailable-task payload/model invariant reconciliation; separate malformed-null-cell TypeError coverage retained |

| Finding                                           | Severity | Scope rationale                                                           | Evidence                                                                                           | Disposition | User decision                                                                                              |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Section 4 obsolete swallowed-Classroom regression | Material | Existing test expected swallowed failure contrary to approved propagation | `tests/assignment/assignmentSubclassesCoverage.test.js:340–362`; section4-page-id-red-review.md P1 | approved    | User authorises minimal original-error propagation assertion, retaining logger assertion; no other changes |

| Finding                                       | Severity | Scope rationale                                                                         | Evidence                                                                            | Disposition | User decision                                                                                                                                                                                                         |
| --------------------------------------------- | -------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 explicit-null source page ownership | Material | Safe source IDs required; model previously substituted reference page for explicit null | `Models/StudentSubmission/index.js:96`; reviewed missing-match null-page assertions | approved    | User confirms explicit null stays null with known student document retained; omitted-page behaviour unchanged. Minimal model fix and focused regression coverage authorised; frontend fallback read-only verification |

| Finding                                  | Severity | Scope rationale                                            | Evidence                                                          | Disposition | User decision                                                                               |
| ---------------------------------------- | -------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Section 4 document-open scope test space | Material | Existing-suite budgets insufficient for complete R4 matrix | R4 in section4-red-review.md; document-open test-owner checkpoint | approved    | User authorises one <=300-line test-only document-open companion, no runtime layers/helpers |

| Finding                                   | Severity | Scope rationale                                                     | Evidence                                                                                          | Disposition | User decision                                                                                                                                        |
| ----------------------------------------- | -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 4 PARSE_FAILED producer undefined | Material | No distinct current task parse operation separate from source reads | Slides matcher scanSubmissionBuckets → extractDefinitionContent; task-parse test-owner checkpoint | approved    | User reserves PARSE_FAILED catalogue code; no forced Section 4 producer/test. Failed reads use SOURCE_CONTENT_UNAVAILABLE; programming faults escape |

| Finding                                             | Severity | Scope rationale                                                                           | Evidence                                                | Disposition | User decision                                                                                         |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| Section 4 extraction parser-boundary coverage space | Material | Existing suite 261/300 lines; remaining required parser-boundary scenarios need companion | Extraction test-owner checkpoint; required criteria 3/5 | approved    | User authorises one <=300-line parser-boundary companion suite, tests only; no runtime layers/helpers |

| Finding                                                 | Severity | Scope rationale                                                                                                       | Evidence                                                                                | Disposition | User decision                                                                                 |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Section 4 acquisition failure preservation test surface | Material | Criterion 1 requires prior storage preserved after later-page list failure; acquisition owner has no persistence seam | New assignmentAcquisition.outcomes suite; acquisition test-owner checkpoint             | approved    | User authorises focused existing caller/persistence integration test, no new runtime guard    |
| Section 4 null-hash equality ownership                  | Material | Actual template equality decision belongs to Section 6 LLMRequestManager                                              | `src/backend/RequestHandlers/LLMRequestManager.js:70`; extraction test-owner checkpoint | approved    | User moves null-hash template comparison test/fix to Section 6; no Section 4 LLM owner change |

| Finding                                                         | Severity | Scope rationale                                                               | Evidence                                                                            | Disposition | User decision                                                                                                                                    |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Broad shared-definition failure wording after preflight removal | Material | Specific run-preflight requirement removed; broad wording needs clarification | SPEC.md agreed decision 7 and processing rule 7 opening; Docs reconciliation report | approved    | User confirms retain existing shared-definition failure blocking/preservation semantics only, explicitly no new run-preflight eligibility checks |

| Finding                                              | Severity | Scope rationale                                                 | Evidence                                              | Disposition | User decision                                                                                                                                  |
| ---------------------------------------------------- | -------- | --------------------------------------------------------------- | ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 3 persistence-preservation test seam blocker | Material | Pipeline does not persist; prior test evidence was disconnected | New preflight suite; caller processSelectedAssignment | noted       | Closed by user decision to remove run-preflight and prior-result preservation requirements; do not add integration coverage or pipeline guards |

| Finding                                                | Severity | Scope rationale                                                                             | Evidence                                                                                                         | Disposition | User decision                                                                                                                                                    |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 3 run-preflight test surface (R3)              | Material | Former criterion 4 required run-boundary coverage                                           | `.opencode/scratchpad/section3-red-review.md` R3                                                                 | noted       | Earlier approval superseded: user removes requirement and new suite; unsuitable definitions belong at parser/definition boundary, not additional pipeline guards |
| Section 3 obsolete comparison coverage dependency (R5) | Material | Existing untouched suite requires stored formulaComparison, outside enumerated test surface | `tests/assessors/spreadsheetAssessorsCoverage.test.js:232–243`; `.opencode/scratchpad/section3-red-review.md` R5 | approved    | User authorises minimal reconciliation preserving formula/feedback coverage                                                                                      |

| Finding                                            | Severity | Scope rationale                                                                                                                             | Evidence                                                                                                                                      | Disposition | User decision                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manage Year Groups retry-recovered gate regression | Material | Delivery gate blocks, but unrelated unchanged year-group interaction is outside Section2 authorised change surface; causal link unsupported | section2-gate-browser-diagnosis.md; first attempt Edit dialog absent, retry passed; baseline first-attempt pass; focused unchanged run passed | approved    | User explicitly authorises accepting this single flaky-test exception without repair, waiving the otherwise non-waivable regression gate for Section 2 completion. Cause unknown; baseline passed first attempt; focused unchanged run also passed first attempt. Follow-up: monitor and stabilise in a later section if recurrence; no checker policy change, no hook bypass, no repair authorised for this section |

| Finding                                                                                | Severity | Scope rationale                                                                                                                                                                                   | Evidence                                                                                                                                                  | Disposition | User decision                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corpus regeneration timing versus complete-section Red collection                      | Material | Sequencing ambiguity: Red must collect before consolidated review, but committed-fixture regeneration was scheduled in Green                                                                      | Schema suite collects zero tests; preview/oracle focused run has 13 corpus-marker failures; `.opencode/scratchpad/remaining-red-preview-oracle-tests.log` | approved    | User authorised fixture-only regeneration during Red, twice for reproducibility; finish all Red work before consolidated review; final section gates unchanged                                                    |
| Existing source-less ready browser state contradicts current null-parent contract (R3) | Material | Existing journey requires ready body and numeric/N beneath null parent; criterion 16 preserves journey intent but criteria 4/5 require corruption, while new error-preview journeys were deferred | `task-preview-source-link.states.spec.ts:38–52`; `.opencode/scratchpad/section2-consolidated-red-review.md` R3                                            | approved    | User approved reconciling this existing journey to valid acquisition E, retaining no-unsafe-link assertion and removing incompatible ready-content requirement; no new journeys/UI; report any current-UI blocker |

| Red checkpoint commit hook versus intentionally deferred E type | Material | User now requests Red checkpoint commit/push, but mandatory pre-commit typecheck fails until additive E type contract is activated | `.husky/pre-commit:62–64`; `averagingAnalyser.criterionAccumulation.ts:226` TS2345 | approved | User approved adding E to existing input type and updating adjacent comment during Red; no runtime Green fix, assertion change or hook bypass |

| Red checkpoint push destination | Material | Current worktree has detached HEAD; user authorised commit/push after clean Red but no destination branch was selected | `git branch --show-current` returns empty | approved | User selected a new dedicated assessment-error branch; create assessment-errors-322-341 or a non-conflicting suffix after clean Red, preserve unrelated work |

| Red checkpoint root authorities and interleaved feature scope | Material | Section 1 and Section 2 plan-owned hunks are interleaved; root plan/spec/layout are untracked feature authorities | Read-only ownership preflight: 157 proposed feature paths, seven in-status exclusions; no pre-Section-1 Git status baseline or section-isolated diff | approved | User approved the combined Section 1 + Section 2 feature checkpoint including ACTION_PLAN.md, SPEC.md and ASSESSMENT_ERROR_PREVIEW_LAYOUT.md; unrelated edits and runtime outputs remain excluded |
| Restoration-mode default ownership | Material | Green requires omitted mode to mean full, defaults are constructor-only, and restoration previously bypassed construction | Assignment constructor fetched Classroom metadata; `_baseFromJSON` used `Object.create(Assignment.prototype)` | approved | User authorises constructor-based restoration with supplied saved metadata skipping unnecessary Classroom calls, preserving saved name/creation time and constructor-owned defaults; new assignment creation retains its fetch |
| Saved null assignment name versus strict read contract | Material | Constructor extension preserved explicit null while full assignment read schema requires a string | Data Shapes audit: assignment.md discrepancy 22; constructor saved-metadata branch; AssignmentFullSchema.assignmentName z.string() | approved | User directs deleting the generated assignment-name fallback entirely; null/missing names must fail with an unhandled exception, no recovery fetch or schema widening. This supersedes earlier undefined-only fallback and nullable-name restoration notes |

| Generator writer versus hook JSON formatting | Material | Byte-reproducibility is required; hook changed three assignment JSON files to Prettier formatting while synchronous writer uses JSON.stringify | Synthetic 748 pass/one byte-regeneration failure; all 18 parsed structures equal; parent Prettier API check reproduces committed bytes for all three profiles | approved | User approves existing fixtureWriter reconciliation using installed Prettier plus necessary async caller/test plumbing; preserve atomic writes and byte assertions, no hook bypass/new dependency/schema change |

| Full-profile writer stress verification exhausted heap | Material | Existing opt-in stress test directly calls the newly asynchronous writer; compact gates pass, but no successful full-profile validation or attribution to baseline exists | Two attempts exhausted Node heap (default and NODE_OPTIONS=--max-old-space-size=4096); no assertion result. Synthetic compact suite 750 pass, all18 regenerated outputs match twice | approved | User approves bounded read-only diagnosis and baseline comparison where feasible, not larger-heap reruns, performance refactoring or waiving validation. Diagnosis active; check remains unverified |

| Unattributed optional full-profile stress limitation after diagnosis | Material | Compact required gates pass; opt-in full-profile check is not a required regression gate but writer path remains unverified at full scale | Two heap failures; bounded diagnosis found no crash trace/baseline run, attribution unknown; section2-full-profile-memory-diagnosis.md | approved | User approves proceeding with consolidated Green review and all required gates while deferring optional full-profile stress as an accepted validation limitation/follow-up. Do not claim stress passes or attribute it to baseline |

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

**Status: complete.** User-authorised completion with one recorded flaky-test exception
(deferred ledger, disposition approved); no checker policy change, hook bypass or
assertion weakening.

**Section checks:** backend **3,181** tests; frontend **2,923**; builder **252**;
synthetic **750** with coverage thresholds; `typecheck:all`; production build; plugin
coverage; fresh **69/69** affected browser tests. Required compact synthetic coverage
passes with finite local budgets (15 s regeneration, 20 s rollback). Lint has zero
errors; backend exits non-zero solely for five accepted historical `max-lines` warnings.
Optional full-profile stress is **not** counted as passing (see Implementation notes).

**Regression comparison:** session `assessment-errors-322-341`; baseline
`2026-10-23T05:20:43.034Z`; current `2026-10-25T17:06:01.503Z`; report
`.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-25T17-06-01.503Z/comparison.json`.
One retry-recovered Manage Year Groups case is accepted under the recorded exception;
five historical backend warnings unchanged; one former factory warning fixed.

### Outcome (compacted)

One atomic 2a–2d cut-over: version-1 marker-1 canonical corpus; constructor-based
`Assignment` restoration with strict names; raw-validation/current-restoration and
opaque legacy persistence; one detached reassessment projector; shared frontend read
normalisation activated in both read services; explicit E analysis input;
formatter-stable deterministic fixture writer. Contract tests and canonical docs were
reconciled in the same change.

### Retained for later sections

**Backend restoration and reads**

- `Assignment` accepts an optional fourth constructor argument `restoration` carrying
  saved `assignmentName` (string), `createdAt` and caller `representationMode`.
  Presence of that object skips Classroom `CourseWork.get`; normal three-argument
  creation still fetches exactly once. The constructor owns transient
  `_restorationMode` (default `full` only there), validates explicit `full`/`partial`,
  throws on invalid values, and excludes the field from persistence/read JSON.
  Stored/raw `_restorationMode` cannot override it. Restored objects carry no
  hydration marker.
- Strict assignment names: **no generated fallback**. Saved `null`/missing/non-string
  names throw unhandled without a fetch; a fetched `null`/missing/non-string title
  throws after one fetch. Valid strings, including blank, and saved `createdAt` are
  preserved. The assignment-name read schema remains `z.string()`; no widening or
  recovery fetch.
- Direct full reads use `Assignment.toReadJSON()` after `_ensureFullDefinition`; class
  reads invoke the projector before replacing the embedded definition with
  `assignmentDefinitionKey`.
- Caller owns restoration mode (`full`/`partial`); never use stored
  `representationMode`. The non-legacy plain-object serializer fallback is removed;
  current submissions must supply `toJSON`.
- Current-format restoration (`02_AssignmentCurrentRestoration.js`) validates raw
  records before typed construction. Identifiable invalid items become all-three
  `CORRUPT_RECORD` E with healthy siblings preserved; missing known tasks are
  materialised from the embedded snapshot. Unknown stored task, untrustworthy
  student/root/definition and constructor/wiring faults fail the owned dataset rather
  than becoming E.
- Full-read null source beside numeric/N or assessment-stage E becomes
  `CORRUPT_RECORD`; partial redaction never triggers that check or hash generation.
  Null-document/empty-map is the only confirmed no-submission omission.
- Sole projector: `AssignmentRehydration.projectReassessmentSubmissions(assignment, students, form)`
  with `form` exactly `'full' | 'partial'`. It emits detached placeholders through
  model constructors: deterministic identity/times, validated
  source IDs only, nullable `studentName`, marker `null`, and all three validation
  `REASSESSMENT_REQUIRED` E. No roster/fetch on the full path; the class path uses its
  loaded roster and stored task summaries. Projected entries never enter persistence
  preparation.
- Opaque legacy submission body and original marker presence/value are re-emitted
  unchanged by `toJSON()`/`toPartialJSON()` on ordinary class saves. Read projections
  never become write input. Legacy compatibility is reviewed **24 April 2027**; it
  does not auto-expire.
- Integration evidence boundary: class graphs use the existing real dispatcher/GAS
  bridge and `getABClass`; full wire payloads use the real `getAssignment` service
  with only `callApi` stubbed. Do not claim dispatcher/controller/database proof from
  the stubbed transport, invent a full-assignment bridge seam, or introduce read
  writes/roster refresh.

**Frontend read and analysis contracts**

- `assignmentReadNormalisation.ts` (pure; no React, API dispatch or JSON decoding) is
  active in both `assignmentAssessmentService` and `classDetailService`;
  `assignmentReadItemValidation.ts` is the approved adjacent extraction. Final
  `parseApiResponse`, not-found null, envelopes and transport semantics are unchanged.
- Full normalisation validates strict roots/shared definitions, isolates only
  identifiable items, logs bounded field paths/IDs (never payloads, names or arbitrary
  keys), and revalidates the normalised result. Full `studentName` is `string | null`.
- Partial normalisation validates provided entries only: no full fetch, roster query,
  registry coverage inference or legacy graph synthesis. G5 marker-null entries require
  exact provided reassessment maps.
- G4 null-parent canonical corruption replacement is identity/idempotent in both
  services. G6 safe paths collapse arbitrary unexpected criterion keys to the
  assessments map (only known `formulaComparison` gets a bounded path); omitted partial
  hash is valid and no longer masks assessment diagnostics; full hash diagnostics are
  unchanged.
- Full missing-wire-item defence uses the same payload only and never overwrites
  backend E; test it separately from normal coverage.
- E is an explicit analyser input. E increments no numeric/N/`totalDataPoints`/weight
  counter and adds no denominator; wholly errored items resolve all four metrics to E.
  Numeric, fractional, N, zero-weight, mixed and aggregate `excluded` semantics are
  unchanged. `MetricResult` gains no reasoning/history. Individual fractional scores
  are supported; presentation remains 0 dp.

**Canonical corpus and generator**

- Canonical profiles `small`, `medium` and `large-representative` are regenerated
  (18 compact outputs). Full/embedded records carry `assessmentContractVersion: 1`
  and exactly three assessments including accuracy; no `formulaComparison` map key.
  `STUDENT_INDEX_WITH_NULL_DOCUMENT` is an acquisition `SOURCE_UNREADABLE` E scenario;
  genuine no-submission remains roster omission/local probes. IMAGE and SPREADSHEET
  bodies are usable; pending IMAGE is not a completed assignment. Sections 3–4 may
  reuse these bodies and local corruption probes; do not add a competing realistic
  fixture family.
- The marker is set once on the persistence record and explicitly copied by both
  whitelist projections (`toTransportViews.js::toFullAssignment`,
  `projectClassTransportViews.js::toPartialAssignment`).
- `fixtureWriter` formats with the installed Prettier using the canonical repository
  filepath/config, including staging/scratch output roots. Format/stage/write/
  generation/CLI are async and awaited; `commitStagedProfiles` (no Promise) and cleanup
  are synchronous; every profile is staged before atomic replacement/rollback. Two runs
  reproduce all 18 committed outputs byte-for-byte with hash parity.
- Synthetic guard owners: `artefactSourceGuards.js`, `assessmentEntryGuards.js`,
  `validationRecordGuards.js`, `validateAssessmentState.js`; single
  `assessmentScoreSchema` (duplicate partial export removed; cross-module consumer
  migrated).
- Generated GAS order: `02_AssignmentReadProjection.js` before
  `02_AssignmentRehydration.js`, and `StudentSubmission/00_StudentSubmissionItem.js`
  before `index.js`; covered by copied-output assertions.
- Existing Playwright journeys were reconciled to the new wire contract. Deliberate
  local score/layout overrides and the local unsupported TABLE exception remain.
  Marker-less/unsupported wire roots are local invalid probes, not valid current
  results; new error/legacy/refresh journeys belong to Section 10.

**Helper and documentation register**

- Section 2 shared-helper slices are **implemented**: model raw validation;
  rehydration traversal/coverage; `projectReassessmentSubmissions`;
  `AssignmentSerialisation` read delegation; response mapper; frontend normaliser and
  item validation; existing generator stages/validators.
- Canonical docs reconciled with no new pages: `AssessmentFlow`, `rehydration`,
  `api-layer`, frontend shared-helper §9.29, `metric-display-precision`,
  synthetic-test-data, and data shapes `assignment`, `abclass`,
  `assignment-definition`, `frontend-data-analysis-response`. Delivered `@remarks`
  cover opaque legacy persistence versus detached read data, backend versus browser
  coverage ownership, and constructor restoration. Sections 3–12 helper entries remain
  `Not implemented`/planned.
- Section 9 owns preview view-model fields and layout pointers; Section 10 owns new
  browser journeys.

**Checks and commands**

- `npm run fixtures:synthetic` (twice; second output unchanged),
  `npm run test:synthetic`, `test:backend`, `test:frontend`, `test:builder`,
  `typecheck:all`, four scoped lint checks, production build, plugin coverage, and the
  affected Playwright pattern
  (`heatmap|task-preview|metric-range-filter|issue-320|navigation-screenshots`) form
  the Section 2 gate. Compact synthetic tests use finite local budgets: 15 s
  regeneration, 20 s rollback.

### Implementation notes / deviations / follow-ups

Authoritative for this section; keep in sync when later sections touch these owners.

- **Docs sync:** all canonical non-shape and data-shape docs reconciled; no new pages;
  JSDoc/comment corrections applied (constructor restoration/lazy getter,
  `AssessmentSchema` alias, IMAGE/SPREADSHEET versus local TABLE capability, remaining
  planned preview phrase).
- **Regression:** report path above; the stable-ID comparison is the Section 2 gate
  record. Five historical backend `max-lines` warnings remain accepted pre-existing
  debt (`assignmentDefinitionPartials.unit`, `assignmentController.hydration`,
  `dbManager`, `classroomApiClient`, `batchUpdateUtility`); no suppression or refactor
  is authorised. The former `assignmentFactory.test.js` warning was fixed by the
  planned split.
- **Flaky-test exception:** Manage Year Groups background-refresh case failed first
  attempt at Edit-dialog opening, passed configured retry; baseline and one focused
  unchanged run passed first attempt. Cause unknown; accepted without repair under the
  deferred-ledger approval. Follow-up: monitor/stabilise if it recurs; no checker
  policy change.
- **Full-profile stress:** opt-in and **unverified** after two heap failures (default
  and 4 GB); attribution unknown. Not a required gate and not counted as passing. Do
  not claim it passes or attribute it to baseline. Diagnosis:
  `.opencode/scratchpad/section2-full-profile-memory-diagnosis.md`.
- **Deferred minor:** pre-existing broken `DEFINITION_PARSE_FAILED` anchor; stale
  Section 9 preview/source layout pointers (Section 9 owns); unrelated five
  agent/template edits, `draft-scratch.md` and `.vitest/` excluded from feature commits.
- **Plan maintenance:** after each complete section passes its independent review and
  regression gate, compact it to outcomes, essential handoffs and verification
  evidence; do not compact an incomplete section or discard unresolved findings.
  Section 1 was compacted from 141 to 25 lines; this pass compacts Section 2.
- **Commit record:** clean Red checkpoint `e71e309f` with message `feat(assessment): checkpoint explicit error contracts and section 2 red coverage`, pushed to `origin/assessment-errors-322-341`; checkpoint evidence `69d95fca` with message `docs(plan): record clean red checkpoint commit and push`. Final Section 2 completion commit `2a438a02` with message `feat(assessment): complete section 2 explicit error read contracts and activation`, pushed to `origin/assessment-errors-322-341` (push confirmed: `69d95fca..2a438a02`). Branch: `assessment-errors-322-341`. Pre-commit hook passed (lint-staged + typecheck:all); 42 files committed. Flaky-test exception recorded as approved deferred row.

## Section 3 — Usable shared definitions and canonical spreadsheet blanks

**Status: Complete. Green/review/docs/compaction/regression/commit/push gates satisfied.**

### Outcome (compacted)

- Successfully read blank/all-null `SPREADSHEET` grids canonicalise to `[]` with the normal
  `[]` hash through construction, serialisation and restoration, for templates and student
  ranges. Literal `null` stays unavailable content; populated-formula normalisation is
  unchanged.
- A usable reference with a blank template/student range completes with completeness `0`,
  accuracy `0` and SPaG `N`; fractional formula marks and existing cell-reference feedback
  survive. `SheetsAssessor` keeps comparison transient: only the three assessments and
  `cellReference` feedback persist, so no `assessments.formulaComparison` entry survives.
- New non-IMAGE definition writes reject null content/hash while accepting valid blank
  TEXT/array templates; a pending IMAGE artefact remains valid definition-store state.
  A formula-free SPREADSHEET reference is rejected as an unusable shared definition.
  Duplicate shared tags keep their existing blocking behaviour.

### Retained for later sections

- **Helper ownership.** `SpreadsheetTaskArtifact.normalizeContent` owns blank-grid
  canonicalisation as the existing model rule, reused by parsers and restoration rather than
  duplicated; no separate spreadsheet helper-register entry exists.
  `AssignmentDefinitionValidation.validateSharedArtifacts` owns the definition-write
  artefact/formula invariant; `AssignmentDefinitionUpsertOrchestrator.upsert()` invokes it on
  final resolved tasks after weighting and before definition construction or persistence,
  reusing existing failure reporting and rollback. Expected content rejections log bounded
  `{ taskId }` context and throw `ApiValidationError` with the established safe
  `DEFINITION_PARSE_FAILED` message/code; missing structure, serializer faults and other
  wiring errors propagate unchanged. `@remarks` distinguish blank grids from unavailable
  content and pending definition images from completed artefacts.
- **Boundary split.** Pending IMAGE is permitted only in the definition store; the stricter
  completed-full-assignment gate and completed-write preflight remain Section 8 work. No
  run-preflight eligibility check, extra pipeline error-handling layer or parser/API
  validator hierarchy exists.
- **Delivered surface.** Definition-write validation, upsert wiring and `SheetsAssessor`
  comparison removal; blank-grid canonicalisation was reused unchanged and `SheetsParser`
  needed no change (it stays within its SPEC 400-line budget). New suites
  `tests/models/spreadsheetContentAvailability.test.js` and
  `tests/assignment/assignmentDefinitionArtifacts.validation.test.js`; extended
  `sheetsAssessor`, `assignmentDefinitionValidation`,
  `assignmentDefinitionController.upsert.validation` and `spreadsheetAssessorsCoverage`
  (obsolete comparison-persistence assertions reconciled, formula/feedback coverage kept).
- **Documentation and fixtures.** Four existing canonical pages reconciled, no new pages:
  `AssessmentFlow`, `rehydration`, `assignment-definition`, `assignment`; JSDoc/comment
  corrections in the touched owners. Their Section 3 helper entries now read as implemented
  (blank-grid rule reuse, definition-write validation, `formulaComparison` removal).
  Acquisition/extraction E creation, completed-write gates, image hydration scope and preview
  error states remain `Not implemented`/planned. Fixtures use `small` SPREADSHEET tasks from
  Section 2 plus local null/all-null/blank and formula-free reference mutations; no competing
  realistic fixture family.

### Implementation notes / deviations / follow-up

Authoritative for this section.

- **User decision (binding): run-preflight validation and prior-result preservation
  integration coverage were removed from scope** — this feature records assessment errors, not
  additional pipeline error-handling layers. The new run-preflight companion suite was
  deleted, superseding its earlier R3 authorisation; existing parser/definition-write
  eligibility coverage is retained, and no integration coverage or pipeline guards are to be
  added. SPEC.md now states this explicitly (user confirmed), Section 8
  persistence-preparation checks are unchanged, and stale run-start/bypass wording in
  `assignment-definition.md` was reconciled to the retained definition-write boundary.
- **Checks (passing).** `npm run test:backend:coverage`: 235 files / **3,206 tests**, branches
  **85.02% (3,570/4,199)**; synthetic definition-backend validation 1 file / **2 tests**;
  `npm run lint:backend:check` exits 1 solely for the five accepted historical `max-lines`
  warnings, zero errors/new warnings; `git diff --check` clean. Evidence:
  `.opencode/scratchpad/section3-clean-{coverage,lint,outcomes}.txt`,
  `section3-signoff-synthetic.txt`.
- **Review and coverage.** `.opencode/scratchpad/section3-green-clean-review.md`: PASS, no
  critical/improvement/nitpick findings; G1–G4 and F1–F2 closed. F1 was duplicate
  ESM/CommonJS identity in the new direct suite, not baseline debt: loading the shared
  CommonJS owner from `tests/setupGlobals.js` raised owner branches 43.75% → 89.58% (100%
  functions) and aggregate branches 84.49% → 85.02% (+22 covered) with the test count
  unchanged; no threshold, config or production change. Evidence:
  `.opencode/scratchpad/section3-coverage-attribution.md`,
  `section3-green-coverage-signoff.md`.
- **Docs sync complete.** Updated existing `docs/developer/backend/AssessmentFlow.md`,
  `docs/developer/backend/rehydration.md`, `docs/developer/data-shapes/assignment.md`
  and `docs/developer/data-shapes/assignment-definition.md`, plus JSDoc in the three
  changed production owners. No pages created; helper registers agree with delivery.
- **Compaction verification.** Only Section 3 changed; all other sections and the
  deferred ledger preserved. Detail gaps resolved from final review/current files:
  source LOC assessor 374, validator 169, orchestrator 476; test LOC availability 96,
  artefact validation 113, assessor 302, definition validation 300, upsert 366,
  coverage 294. Deleted suite was
  `tests/controllers/assignmentController/assignmentController.runPreflightDefinition.test.js`.
  Normaliser/parser source unchanged.
- **Section regression gate:** completed 25 October 2026 using stable session
  `assessment-errors-322-341`; zero regressions, zero new failures, one baseline fix.
  Seven checks pass (including all coverage, browser E2E and type checks); checker
  overall `FAILING`/exit 1 solely for the five expressly accepted historical backend
  `max-lines` warnings, no new lint failure. Gate accepted under baseline-debt rule,
  not a new waiver. Report:
  `.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-25T18-36-52.169Z/comparison.txt`.
- **Commit/push:** `9f5dca8aeb97fcc36b78cbb7e79fbb9afe7171a6` —
  `feat: validate shared definition artefacts and keep sheet comparisons transient`;
  branch `assessment-errors-322-341`; `git push origin assessment-errors-322-341`
  succeeded (`a53c1afe..9f5dca8a`). Normal formatting/staged-lint/all-TypeScript hooks
  passed; no bypass. Subsequent plan-only recording commit uses message
  `docs: record Section 3 completion and push evidence` on the same branch:
  `8e273a821093ff2fdf82e8e27254b15c477ea946`; push succeeded
  (`9f5dca8a..8e273a82`), normal hooks passed.

## Section 4 — Student acquisition and extraction outcomes

**Status: Green PASS; G1–G8, FG1–FG3, RR1/RR2/GR1, SG1/SG2, SC1–SC3, OD1/OD2,
SB1–SB3, G6-R1–R4 and C1 closed. Documentation sync PASS. Section 4 complete:
the regression checker is FAILING with one frontend E2E regression/new failure that
the user explicitly accepted as flaky debt, so gate progression is an explicit
exception, not a clean checker PASS. Compaction and implementation commit/push are
complete; normal hooks passed. No deployment authorised.**
Green review authority: `.opencode/scratchpad/section4-final-green-clean.md`;
docs-sync authority: `.opencode/scratchpad/section4-docs-sync-final.md`.

### Outcome (compacted)

Section 4 makes incomplete Classroom acquisition and dropped extraction impossible to
mistake for absence. Paginated `StudentSubmissions.list` scans complete before absence
is concluded; a later-page failure escapes unchanged, so the run is not completed as
no-submission/N and prior stored results are preserved. Acquisition and extraction
failures materialise canonical E for known student tasks while healthy siblings and
safe source identifiers survive; genuine no-submission retains the null-document/empty
items representation.

Full-section independent review is PASS with zero Critical, Improvement or Nitpick
findings (`section4-final-green-clean.md`): G1–G8, FG1–FG3, RR1/RR2/GR1, SG1/SG2,
SC1–SC3, OD1/OD2, SB1–SB3, G6-R1–R4 and C1 closed; no closed item reopened. Fresh
evidence: 3,327 backend tests (242 files), 230 focused tests (15 suites), branches
85.05% (3,676/4,322). Delivered owners are `04_AssignmentSubmissions`,
`SlidesAssignment`, `SheetsAssignment`, the Slides facade/matcher/table-content owners,
`SheetsParser` and `StudentSubmission`; canonical docs register the delivered slices
and keep later slices planned.

### Retained for later sections

- **Delivered interfaces.** `04_AssignmentSubmissions` owns
  `_recordAcquisitionFailure(studentId, code, scanState)`,
  `_recordSupportedAttachment(studentId, scanState)` and
  `_materialiseAcquisitionOutcome(studentId, code)`; `SlidesAssignment` and
  `SheetsAssignment` `processAllSubmissions()` treat parser `null` as acquisition
  `SOURCE_UNREADABLE`, materialise extraction `SOURCE_CONTENT_UNAVAILABLE` per known
  task, warn/ignore unknown task IDs and pass `missingContentLogged` to suppress
  duplicate model warnings. The Slides facade/matcher expose failed-open `null`, an
  array otherwise, the canonical missing-match placeholder and the matched pending
  IMAGE payload; `SheetsParser` exposes the native range read, failed-open `null` and
  the unavailable range artefact.
- **Source identity and selection.** The scan is scan-local (`Map`/`Set`) across
  attachment arrays and duplicate Classroom records: last supported source wins; the
  first failure is materialised only when no source is supported; an accepted source
  suppresses/clears rejected-attachment E.
- **Scope and matching.** A document-open failure affects that student's tasks; a
  task-specific parse/read failure affects that task only. Unknown extraction task IDs
  warn/ignore while expected known tasks end terminal. First-match/tag/type preference
  and ambiguity warnings are unchanged; ambiguity is a warning, not E. Shared
  duplicate-tag rejection still blocks. Successfully read blank/template-matching work
  retains existing N/formula semantics.
- **Canonical base producer.** Acquisition placeholders are constructed directly as
  `BaseTaskArtifact`/`StudentSubmissionItem` over dictionary task IDs with null
  source/body/hash and atomic all-three catalogue acquisition E, satisfying the
  null-parent marker-1 read invariant. Do not reintroduce the
  `upsertItemFromExtraction()` round-trip for this path.
- **Null page and source.** Explicit `pageId: null` stays null with the known student
  document retained; omitted/`undefined` keeps the task-definition fallback. The
  existing frontend document-root fallback (`buildCellPreviewLookup.resolveSourceUrl`)
  was verified read-only and needs no change.
- **Native boundaries.** Conversion happens only at immediate native reads. Actually
  thrown `TypeError`, `ReferenceError` and non-`Error` values propagate by identity;
  ordinary internal faults escape. A literal `null` returned by a student `getCell`
  read is unavailable content (whole TABLE, `SOURCE_CONTENT_UNAVAILABLE`), not a thrown
  value. Shared-definition reads still throw. Native Sheets student extraction calls
  `Sheet.getRange(...).getFormulas()` directly; the absent `TaskSheet` collaborator is
  not restored.
- **TABLE and IMAGE states.** The first TABLE failure makes the whole table
  unavailable, aborts at the first failing coordinate, discards any prefix and leaves a
  null hash; never a blank or partial table. Missing IMAGE match becomes extraction
  `SOURCE_CONTENT_UNAVAILABLE`; a matched student page with parser `sourceUrl` remains
  pending hydration with null content/hash. Do not claim hydration completion.
- **Unhashability and diagnostics.** Failed/unavailable content is not hashable and
  carries null content/hash. One original contextual diagnostic per owned failure with
  opaque IDs and no student names; no matcher/model/progress duplicate.
- **Private helpers and `@remarks`.** The six table-content helpers
  `_readTableDimensions`, `_readTableRow`, `_readTableCell`, `_readCellText`,
  `_isConvertibleSubmissionRead` and `_logTableReadFailure` are owner-local `@private`
  methods; no generic wrapper, shared utility, exception hierarchy or lint suppression.
  `@remarks` record pagination-before-absence, deferred materialisation, expected source
  exceptions versus implementation faults, and the native-null policy.
- **Non-Drive attachments.** Existing ignore behaviour is retained (no
  `UNSUPPORTED_DOCUMENT` admission change). No supported source and no recorded failure
  (absent or ignored-only candidates) retains no-submission; ignored candidates do not
  erase a recorded Drive-candidate failure.
- **Later ownership.** Transport retry ownership is Section 5; null-hash template
  comparison is Section 6; image hydration is Section 7; completion-marker stamping and
  completed-write preflight are Section 8; preview view models are Section 9; new
  browser journeys are Section 10. Intermediate checkpoints are not deployable.

### Checks record (final full-section Green)

- `npm run test:backend:coverage`: 242 files / 3,327 tests PASS; statements 90.52%
  (5,503/6,079), branches 85.05% (3,676/4,322), functions 89.34%, lines 91.2%.
- Focused inventory: 15 suites / 230 tests PASS. Acquisition owner 100%
  statements/functions/lines and 98% branches; both subclasses and table content 100%
  statements/functions/lines.
- Final source LOC: submissions owner 240, `SheetsAssignment` 142,
  `SlidesAssignment` 209, `SheetsParser` 400, table content 331, matcher 351, Slides
  facade 458, `StudentSubmission` 265. All 23 source/test inventory paths are below 500
  lines (total 7,557).
- `npm run lint:backend:check`: exit 1 with zero errors and exactly five accepted
  historical `max-lines` warnings (`assignmentDefinitionPartials.unit` 2776,
  `assignmentController.hydration` 653, `dbManager` 665, `classroomApiClient` 550,
  `batchUpdateUtility` 615); no new warning. Prettier over the 23 inventory paths plus
  four canonical docs PASS; scoped ESLint PASS; `git diff --check` clean. Evidence
  prefix `.opencode/scratchpad/section4-final-clean-`; summary
  `section4-final-clean-outcomes.txt`.
- **Regression gate (user-accepted debt exception, not a clean pass).** Stable session
  `assessment-errors-322-341` (baseline `2026-10-23T05:20:43.034Z`); compare run
  `2026-10-28T06-48-49.500Z`; overall FAILING with 6 of 8 checks passing, 1 regression
  and 1 new failure. Report:
  `.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-28T06-48-49.500Z/comparison.txt`.
  The regression/new failure is `frontend-e2e-check` (Playwright):
  `issue-320-layout.spec.ts` › `responsive page layout contracts` ›
  `keeps the authentication provider-to-save gap at 24px in both modes and saves`.
  The E2E runner exited 0 but the checker recorded the test as failed. Investigation
  found an initial authentication-mode transition timeout, retry 1 PASS, and a targeted
  rerun PASS on its first attempt; no causal link to Section 4 was evidenced. Evidence:
  `.opencode/scratchpad/section4-regression-e2e-investigation.md`; deferred ledger:
  `.opencode/scratchpad/assessment-errors-322-341-deferred-findings.md`. The user
  explicitly selected “Accept as flaky debt”, so this identified regression is accepted
  as an explicit gate-progression exception. The checker itself remains FAILING; it is
  never a zero-regression or clean PASS. No frontend, baseline or checker edit was made.
  Passing checks: backend, frontend and builder coverage tests; frontend and builder
  lint; TypeScript compilation. `backend-lint-check` still fails only for the five
  accepted historical `max-lines` warnings (one baseline fix recorded); no new lint
  finding.
- **Docs sync: PASS.** One factual correction in `AssessmentFlow.md` (Stage 4 progress
  wording: Slides reports ordinal position, Sheets names the student); no new page and
  no contract drift. Delivered shared-helper entries read as implemented; later slices
  stay planned. Evidence: `.opencode/scratchpad/section4-docs-sync-final.md`.
- **Commit/push:** `96153d8dd7173ebb8139310b37d2b08c1d94ea85` —
  `feat: record explicit student acquisition and extraction errors`, branch
  `assessment-errors-322-341`. Normal Prettier, staged lint and `typecheck:all` hooks
  passed without bypass. `git push origin assessment-errors-322-341` succeeded
  (`67d08df5..96153d8d`). This plan-only completion record follows in a separate
  bookkeeping commit `c47b3feba455642b260ee7787b2b6c10eca5f85d` —
  `docs: record Section 4 completion and accepted flaky debt`; its normal hooks and
  push also succeeded (`96153d8d..c47b3feb`). No deployment performed.

### Implementation notes / deviations / follow-up

Authoritative for this section; keep in sync when later sections touch these owners.

- **Student literal `getCell` null.** A literal `null` returned to a student read is
  treated as unavailable content and becomes `SOURCE_CONTENT_UNAVAILABLE` for the whole
  TABLE; it is not treated as an actually thrown value. Genuinely thrown `TypeError`,
  `ReferenceError` and non-`Error` values propagate by identity. Shared-definition reads
  still throw. This is the approved user decision, not an observed native guarantee.
- **Slides helper placement.** The six table-content helpers are approved owner-local
  private methods; do not replace them with a generic wrapper, shared utility,
  exception hierarchy or lint suppression.
- **Native Sheets student range.** Student extraction calls
  `Sheet.getRange(...).getFormulas()` directly; the absent `TaskSheet` collaborator is
  not restored. Definition parsing and bbox/blank-grid behaviour are unchanged.
- **Non-Drive attachments.** Existing ignore behaviour is retained: no
  `UNSUPPORTED_DOCUMENT` admission change. No supported source and no recorded failure
  (absent or ignored-only candidates) retains the no-submission representation; ignored
  candidates do not erase a recorded Drive-candidate failure.
- **Selection policy.** Preserve the existing scan exactly: last supported source wins
  across arrays/duplicate records; first failure is materialised only if no source is
  supported; an accepted source suppresses/clears rejected-attachment E.
- **Explicit-null page ID.** An explicit null stays null with the known student document
  retained; omitted/`undefined` keeps the task-definition fallback. The frontend
  document-root fallback was verified read-only.
- **IMAGE states.** Missing IMAGE match → extraction `SOURCE_CONTENT_UNAVAILABLE`; actual
  matched page plus parser `sourceUrl` → pending hydration with null content/hash. Do
  not claim hydration completion.
- **Canonical base producer.** Acquisition placeholders are constructed directly (not
  through `upsertItemFromExtraction()`) so they satisfy the null-parent marker-1 read
  invariant. Do not reintroduce the model-task round-trip for this path.
- **`PARSE_FAILED`.** Reserved in the catalogue; no forced Section 4 producer or test.
- **Proof limits.** G1 proves actual caller/store plus real full/partial
  `Assignment.fromJSON()` restoration with a test-only marker and stubbed
  extraction/assessment; it is not API-transport, production completion-stamping or
  live-GAS evidence. Hermetic native mocks do not prove live GAS behaviour or
  execution-log fidelity.
- **Diagnostics.** One original contextual diagnostic per owned failure with opaque IDs
  and no student names; immediate native ordinary-`Error` conversion; internal ordinary
  faults escape.
- **TABLE failure.** The first TABLE failure makes the whole table unavailable; never a
  blank or partial table.
- **Sizing.** The user's below-500-line allowance applies to these in-scope test/owner
  files; final LOC are recorded in the checks record. Test suites remain within their
  authorised budgets.
- **Docs sync.** G8 and FG2/FG3 reconciled the four canonical pages; formal sync is PASS
  in `.opencode/scratchpad/section4-docs-sync-final.md`. Final sync made one factual
  progress-description correction in `AssessmentFlow.md`; no new page or source change.
  Shared-helper registers agree with delivered acquisition/extraction and retain later
  slices as planned. Minor documentation follow-ups are disregarded in the Nitpicks
  table of `.opencode/scratchpad/assessment-errors-322-341-deferred-findings.md`.
- **Compaction.** Section 4 was restored in full after the failed gate, then recompacted
  after the user explicitly accepted the identified flaky debt. This pass replaces the
  historical Red/Green step log with outcomes, handoffs and verification evidence; every
  byte outside Section 4, including the entire deferred ledger, is unchanged.
- **Gate exception (user accepted).** One frontend E2E regression/new failure
  (`issue-320-layout.spec.ts` › `responsive page layout contracts` ›
  `keeps the authentication provider-to-save gap at 24px in both modes and saves`) was
  investigated: initial authentication-mode transition timeout, retry 1 PASS, targeted
  rerun first-attempt PASS. The user explicitly accepted this as flaky debt. Evidence:
  `.opencode/scratchpad/section4-regression-e2e-investigation.md` and the comparison
  report recorded above. Gate progression is accepted by this exception; the checker
  itself remains FAILING, not a clean PASS. No source, test, baseline or checker change
  was made. Five historical lint warnings remain accepted separately. Commit-hook
  validation and implementation commit/push are complete, recorded above; no deployment authorised.

## Section 5 — One bounded transport owner

### Status

Runtime/test Green **PASS**, authority
`.opencode/scratchpad/section5-transport-final-green-review.md`: G1–G4 CLOSED, no
outstanding in-scope Critical, Improvement or Nitpick finding. Section 5 is **complete**.
Formal Docs sync, plan compaction, the stable-ID regression comparison and implementation
commit/push are **complete**. No deployment is authorised. Five historical backend `max-lines`
warnings are accepted baseline debt only; the identified Settings E2E flake is Section 4
accepted debt, not a prospective Section 5 regression waiver.

### Outcome (compacted)

`src/backend/RequestHandlers/BaseRequestManager.js` is the sole HTTP retry owner;
`LLMRequestManager.js` and `ImageManager.js` were the two adapted callers. One private
`_runRetryEngine` serves single dispatches and sequential member retries after the
initial `fetchAll`. Duplicate dispatch/classification paths were replaced, attempts
bounded, and per-batch consumption preserved without run-wide response accumulation.
LLM semantic result replacement/cache and scoped image materialisation remain Sections 6/7.

### Retained for later sections

**Transport contracts**

- Constructor owns `maxAttempts` (3 total including the initial `fetchAll`), 5000 ms
  initial delay, 1.5 multiplier and native request defaults. Waits are exactly 5000/7500
  ms only before actual attempts 2/3, never after exhaustion; retries are sequential and
  never re-batched. A thrown batch call consumes attempt one for every member.
- `sendRequestWithRetries(request, policy)` returns one final
  `{ uid, response, error, attempts }`. `sendRequestsInBatches(requests, options)`
  returns void with batch-local outcomes only; `options` carries `batchSize`,
  `acceptedStatuses`, `stopStatuses` and `onBatchComplete`, which receives each completed
  batch before any later dispatch. Returning exactly boolean `false` stops this sender;
  `undefined`, numbers (including `Array.push()`), zero and `null` continue. This internal
  stop feedback is not a public or persisted shape.
- A final outcome retains its UID and final response OR final original network error plus
  attempts; a later network failure never returns an earlier 429/5xx response.
  Unknown/duplicate input UIDs, response-count mismatch and callback/routing/programming
  faults throw, not network retry.
- Classify every received response before retrying. LLM accepts only 200/201 and stops on
  401/403/404; image accepts only 200 with no stop statuses, so a student-image 403 never
  becomes an LLM-wide stop. Retry only network exceptions, 429 and 500–599. Valid
  same-batch results survive any stop origin (initial batch, base retry or
  validation-triggered single request) regardless of order.
- LLM caller uses one full-list sender invocation with the explicit assessor batch size.
  `runStopped` is constructor-initialised, reset each new public invocation, latched from
  a validation retry's single outcome before another validation dispatch, and its
  callback returns `false` to guard additional dispatch. Image caller uses one full
  round-robin list with the explicit Slides batch size, document round-robin order and
  UID association, reading blobs incrementally before the next dispatch. No nested
  assessor-size image batches.
- Public required-input validation runs before effects; empty `[]` keeps its existing
  early return. UID unknown/duplicate and response-count mismatches are rejected before
  arbitrary processing. Logging carries safe UID/status/attempt metadata only. Catches
  are narrow native `fetch`/`fetchAll` catches; internal errors propagate with original
  identity. Projection preserves explicit `false`/`null`/empty caller defaults and an
  explicit marker distinguishes falsy thrown batch failures.
- `@remarks` document initial-attempt accounting, classify-before-retry ordering,
  exact-false cancellation and callback-before-later-batch consumption. No new module,
  hierarchy, budget, API/envelope, stored body, config, dependency or corpus.

**Tests and ownership**

- User-approved test-only split: `baseRequestManager.test.js` (218),
  `.policy.test.js` (461) and `.batching.test.js` (374); all 17 original behaviour cases
  are represented under the tagged contract with no compatibility branch.
  `assignmentPhase3.transport.test.js` (499) carries three moved transport controls;
  `assignmentPhase3.test.js` (389) preserves the original six controls plus healthy/UID
  guard coverage. Four original image write-back cases moved intact from
  `imageManagerCoverage.test.js` (475) to existing `imageManagerPhase5.test.js` (469);
  collection/round-robin/large-input coverage remains and no new image suite exists.
- `tests/helpers/globalMockManager.js::withGlobalMocks` stays the shared global
  installation/teardown owner (182 lines, unchanged); suites keep small local
  fetch/config stubs and do not import one another. All eleven inventory paths are below
  500 lines (total 4108); actual Base 317, LLM 496 and Image 228 supersede earlier
  estimates under the user's below-500 allowance; the comment-only docs-sync follow-up
  brings LLMRequestManager to 498 lines. No formatting condensation or
  assertion loss.

**Later ownership** — unchanged and unimplemented: Section 6 semantic retry removal,
cache/result replacement and null-hash equality; Section 7 scoped image hydration and
write-back catch handling; Section 8 prepared writes and marker stamping; Section 9
preview. Existing 401/403 progress aborts do not yet materialise completed task E.

### Checks record (runtime/test Green)

- `npm run test:backend:coverage`: **245 files / 3396 tests PASS**, all thresholds pass;
  statements **91.23% (5621/6161)**, branches **85.88% (3765/4384)**, functions
  **89.89% (1076/1197)**, lines **91.95% (5382/5853)**. Evidence:
  `.opencode/scratchpad/s5-final-coverage.txt`.
- `npm run test:backend -- tests/requestHandlers tests/assignment`: **40 files / 502
  tests PASS**, including the seven authorised transport/caller suites and nine
  stop-origin rows (`.opencode/scratchpad/s5-final-focused.txt`).
- `npm run lint:backend:check`: exit 1, zero errors, exactly the five accepted historical
  `max-lines` warnings (`assignmentDefinitionPartials.unit` 2776,
  `assignmentController.hydration` 653, `dbManager` 665, `classroomApiClient` 550,
  `batchUpdateUtility` 615), no new warning. Prettier over all eleven inventory paths,
  scoped ESLint and `git diff --check` pass. Inline real-Base callback probe passes
  (exact `false` stops after one dispatch; other values continue; sender returns
  undefined) and is not in suite totals. Evidence:
  `s5-final-{lint,format,scoped-lint,callback-probe}.txt`.
- No regression checker, full-section gate, frontend/builder/browser check, commit, push
  or deployment ran in this checkpoint.

### Implementation notes / deviations / follow-up

Authoritative for this section; parent adds pending gate records after return.

- **Docs sync PASS.** `AssessmentFlow.md` transport register/narrative and
  `backend-testing.md` suite inventory updated; no new pages. A comment-only
  `handleValidationFailure()` JSDoc follow-up documents stop early-return/latching;
  source Prettier/scoped ESLint/diff checks pass, LLM owner 498 lines. Evidence:
  `.opencode/scratchpad/section5-docs-sync.md`. Parent verified register agreement:
  transport implemented, later cache/scoped-image/prepared-write/preview slices planned.
- **Compaction verified.** Backup:
  `.opencode/scratchpad/assessment-errors-322-341-section-5-pre-compaction.md`.
  Parent byte comparison confirmed no other section or deferred ledger changed during
  compaction. The 84-to-128-line rewrite retains delivered contracts and proof limits;
  no future-relevant gap found. Report: `.opencode/scratchpad/section5-plan-compaction.md`.
- **Deferred follow-ups.** Later Section 6/7 findings are noted in the deferred ledger;
  minor documentation drift is disregarded in the Nitpicks table of
  `.opencode/scratchpad/assessment-errors-322-341-deferred-findings.md`.
- **Regression gate satisfied with accepted baseline debt.** Command:
  `npm run regression-checker -- assessment-errors-322-341`. Report:
  `.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-29T07-11-53.069Z/comparison.txt`.
  Compare mode, original baseline retained; **zero regressions, zero new failures,
  one baseline fix**. Seven of eight checks pass, including all backend/frontend/builder
  coverage tests, Playwright, frontend/builder lint and TypeScript compilation. Overall
  checker status remains **FAILING** solely for the five explicitly accepted historical
  backend `max-lines` warnings listed above. No new waiver or flaky outcome is used.
- **Commit/push complete.** Branch `assessment-errors-322-341`; implementation commit
  `bfdc1d07ca8fc8f32cc031c29c24a25ff66ea91d`, exact message
  `feat: centralise bounded transport retries and caller stop handling`.
  Normal hooks passed (Prettier unchanged, scoped ESLint and `typecheck:all`);
  `git push origin assessment-errors-322-341` succeeded
  (`c47b3feb..bfdc1d07`). Unrelated untracked work preserved. This completion record
  is committed separately as `docs: record Section 5 completion and regression evidence`.
  Completion-record commit `0161f7f499395c925094497c0440fa015c77625d` passed normal
  hooks and pushed successfully (`bfdc1d07..0161f7f4`) to the same branch.
  No deployment authorised.
- **Deviation.** G1 added exact-false callback stop feedback after the validation-origin
  stop was found; it is internal only and changes no public or persisted shape.
- **Proof limits.** Hermetic native HTTP mocks and models prove the owned transport/caller
  boundary, not live GAS/LLM/network behaviour, deployed logging fidelity, cache
  identity, hydration, atomic writes or original-incident diagnosis. Local invalid
  `{}`/HTTP/fault probes are boundary fixtures, not a realistic analysis corpus. No Data
  Shapes update is required for these internal synchronous outcomes.

## Section 6 — Atomic LLM completion and validated cache reuse

### Status

Runtime/test Green **PASS**, authority
`.opencode/scratchpad/section6-green-approved.md`: G1–G6 CLOSED, every prior finding
closed, no outstanding in-scope Critical, Improvement or Nitpick finding. Red authority:
`.opencode/scratchpad/section6-consolidated-red-final.md`. Canonical data-shape slice
reconciled (`section6-data-shapes-sync.md`). Documentation reconciliation is PASS
(`section6-docs-approved.md`); plan compaction is verified. Section 6 is **complete**:
the stable-ID regression gate and implementation commit/push are satisfied;
no deployment authorised. Five historical backend `max-lines`
warnings are accepted baseline debt only.

### Outcome (compacted)

LLM assessment results are atomic and terminal, including service-wide stop, without
semantic retries. `src/backend/RequestHandlers/LLMRequestManager.js` (499 lines) and
generic `src/backend/RequestHandlers/CacheManager.js` (74 lines) are the only production
owners; no new module, dependency, config or public/persisted shape. One
read → parse → raw-key admission → normalise → shared validation → assign/cache path
replaces duplicated decode/validation and component-build controls. Orphaned assessment
cache wrappers, recursive validation retries, the `taskDef` alias and silent
unknown-UID returns are removed.

### Retained for later sections

**Eligibility and the stored-content hash invariant**

- Stored reference/template/student content must carry a non-empty string
  `contentHash` before any cache lookup or LLM dispatch (`_requireUsableHashes`, role
  named). Null/empty is a loud internal invariant fault — never a cache miss with live
  fallback, a new assessment E or a false template N. Paired null/empty hashes never
  establish template N.
- Known prior all-three E is preserved verbatim without dispatch or overwrite
  (`_hasTerminalError`; relies on the validated-domain cause/reasoning invariant).
  Successfully extracted blank work keeps N; canonical SPREADSHEET tasks stay local.
  Non-empty matching student/template hashes remain the template-N rule.

**Successful-result validation**

- One validator serves live and cached results: exactly the three own canonical
  criterion keys, no extra/inherited keys, each entry delegating to
  `Assessment.isValidRawResult` restricted to a numeric score. Raw root keys are
  admitted case-insensitively (canonical, non-colliding) **before** the Utils
  normaliser, so inherited/`__proto__`/case-collision evidence is not erased; supported
  mixed capitalisation stays valid.
- Only `JSON.parse` is caught; invalid roots/structures are rejected atomically via
  `_rejectInvalidResponse` (all-three `LLM_INVALID_RESPONSE`, no extra dispatch, no
  partial salvage). Body-reader, normaliser, mutation, routing, cache-wiring and
  serialisation faults propagate with original identity. No blanket decode catch and no
  ordinary `ASSESSMENT_FAILED` producer exists.

**Terminal outcomes and run stop**

- Catalogue mapping is terminal: permanent per-request HTTP → `LLM_HTTP_FAILED`;
  retryable HTTP/network budget exhaustion → `LLM_UNAVAILABLE`; 401/403/404 →
  `LLM_RUN_STOPPED`; invalid success → `LLM_INVALID_RESPONSE`. Successfully extracted
  content/hash and completed healthy, cached and genuine-N results survive.
- `_routedOutcomeAttempts` is constructor-initialised and replaced on every public
  `processStudentResponses` call before the empty-input return; each batch callback
  records the actual outcome's `attempts` before processing. `_terminalCodeFor`
  separates stop-cancelled retryable work from genuine exhaustion by the real spent
  budget (no default, no Base policy change, no new cause). Non-success/null outcomes
  require a safe-integer `attempts` in `[1, maxAttempts]` and throw a contextual
  `Error` before `setError` when provenance is missing/invalid.
- Never-dispatched eligible items are terminalised `LLM_RUN_STOPPED` after a stop.
  Missing generated route map/entry/item (`_terminaliseUnprocessedItems`), missing
  routed item (`assignAssessmentToStudentTask`) and missing retained cache key
  (`_assignAndCacheAssessment`) fail loudly. No rollback is promised after a valid
  assignment followed by a wiring failure.

**Cache identity and generic reuse**

- `LLMRequestManager` owns the versioned identity: literal `v1`, task type,
  reference/template/student hashes. The generation-time key is retained on the routed
  entry and reused verbatim for writeback; old key spaces are misses (no
  purge/migration). Cache hits run the same validator; malformed/N/E hits are logged
  misses and re-requested. Only validated numeric results are cached — never E or
  transport failures.
- Storage uses generic `CacheManager.get`/`put` with an explicit
  `CacheManager.CACHE_EXPIRY_SECONDS` TTL; native get/parse/put failures stay logged
  best-effort and never become assessment E. Generic `get`/`put` behaviour and the
  shared TTL are unchanged; authentication-cache semantics are untouched.
- Do not reintroduce `generateCacheKey`, `getCachedAssessment`,
  `setCachedAssessment`, recursive validation retries, component-build controls or the
  `taskDef` alias, or add a second cache module.

**Contracts, shared-helper register and ownership**

- No persisted, transport or envelope change: the existing `Assessment` result union
  and catalogue gain assessment-stage producers; the LLM request/response body is
  unchanged; attempts, latch and key are internal runtime state.
  `assessmentContractVersion` marker stamping and completed-write preflight remain
  Section 8.
- Delivered shared-helper entries: LLM single successful numeric validator
  (live/cached), Assessment domain validation and `setError` atomic error creation,
  LLM-owned versioned/retained request identity, and generic `CacheManager.get`/`put`
  with explicit shared TTL. No helper remains `Not implemented` for this section; later
  sections' entries are untouched.
- Data Shapes reconciled `docs/developer/data-shapes/assignment.md` only
  (`section6-data-shapes-sync.md`): LLM assessment-stage producers, internal versioned
  cache identity, the stored-content hash invariant and the remaining Section 8 write
  gap. No new contract or page.
- Delivered Docs pass: activated the AssessmentFlow LLM
  result/cache helper register and call-chain (versioned key, generic get/put, explicit
  shared TTL, parse-only catch, provenance boundary), update the assessment-cache
  subsection of `docs/developer/security/data-handling.md`, and registered all seven
  focused suites plus two helpers in `backend-testing.md`. `@remarks` commitments:
  semantic invalidity is terminal; key versioning is not a purge/migration; cache
  cannot define authoritative success; parse-only catch with original reader-fault
  propagation; attempt provenance validated before catalogue mutation.

**Scope and fixtures**

- Local HTTP/invalid-JSON/cache/fault probes only; no new realistic corpus family.
  Section 2 `small`/`medium` canonical models are cloned/restored. The approved
  run-stop fixture uses three numeric-healthy TEXT items plus one genuine
  template-copy N item (no generator extension, no type-match relaxation).
- Test surface is seven focused LLM suites plus two test-only harnesses, all below 500
  lines, preserving every approved case; no production expansion. Later Section 7
  image hydration and Section 8 persistence/marker/completion feedback remain pending.

### Checks record (final full-section Green)

- `npm run test:backend:coverage`: **252 files / 3,511 tests PASS**; statements
  **91.46%**, branches **86.1%**, functions **89.99%**, lines **92.16%**.
- Focused 21-file command: **330 tests PASS** (seven LLM suites, both Phase 3 suites,
  generic cache, Base suites, image Phase 5, auth and trigger consumers). Exact
  commands and partition are in `section6-green-approved.md`.
- `npm run lint:backend:check`: exit 1 with zero errors and exactly the five accepted
  historical `max-lines` warnings (`assignmentDefinitionPartials.unit`,
  `assignmentController.hydration`, `dbManager`, `classroomApiClient`,
  `batchUpdateUtility`); **not a clean lint PASS**. Scoped ESLint, Prettier and
  `git diff --check` pass.
- Inventory: all 14 source/test/helper paths below 500 lines (total 5,954); source
  499/74; no new production owner.
- Proof limits: hermetic real-owner/native-stub coverage, not live GAS/LLM/network,
  deployed logging, cache expiry, durable persistence or original-incident cause.

### Implementation notes / deviations / follow-up

- **Full Green PASS:** `.opencode/scratchpad/section6-green-approved.md` independently
  closes G6 and preserves G1–G5 closures; no outstanding in-scope findings. Fresh
  backend coverage3511PASS and focused330PASS; only five accepted historical lint
  warnings remain. Parent verified completed report and current reviewed LLM SHA256
  `502ebb49aa7237c7cf94171536b37e3deef425a62cd9a2e0688d13c3ed886390`.
- **Current phase:** Section6 complete; all exit gates satisfied with accepted
  pre-existing lint debt. Sections7–12 remain not started.
- **Commit/push:** branch `assessment-errors-322-341`; implementation commit
  `242d778fb9b0b396a126fb753e68e17f25c7424f`, exact message
  `feat: make LLM outcomes terminal and validate cached assessments`.
  Normal hooks passed: Prettier unchanged, staged backend lint, `typecheck:all`.
  Approved source/test hashes still match after hooks. Push succeeded via
  `git push origin assessment-errors-322-341` (`0161f7f4..242d778f`). All19 feature
  files committed; unrelated `.vitest/`, `draft-scratch.md`, `src/frontend/.opencode/`
  preserved and excluded. This completion evidence is recorded in a plan-only
  bookkeeping commit with message `docs: record Section 6 completion and regression evidence`.
- **Section regression gate:** stable session `assessment-errors-322-341`, original
  baseline `2026-10-23T05:20:43.034Z` unchanged; completed comparison
  `2026-10-30T15:35:55.002Z`, zero regressions, zero new failures, one baseline fix.
  Seven checks pass (all backend/frontend/builder coverage, frontend/builder lint,
  Playwright and TypeScript). Overall checker remains FAILING/exit1 solely for the
  five accepted historical backend max-lines warnings, not a new waiver. Report:
  `.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-30T15-35-55.002Z/comparison.txt`.
- **Docs sync PASS:** `.opencode/scratchpad/section6-docs-approved.md` closes D1–D3
  (suite-proof attribution, conditional sweep, provenance predicate). Updated existing
  `AssessmentFlow.md`, `backend-testing.md`, `security/data-handling.md` and
  `data-shapes/assignment.md`; no new pages, source or test edits. Helper registers
  agree with delivered Section6; later slices remain planned. Historical documentation
  nitpicks remain in the linked deferred log, no new finding or accepted debt.
- **Compaction verified:** `.opencode/scratchpad/section6-plan-compaction.md` records
  691→156 lines. Parent compared backup
  `.opencode/scratchpad/assessment-errors-322-341-section-6-pre-compaction.md`: every
  byte outside Section6 and authoritative notes unchanged at compaction; required
  contracts/decisions retained, no detail gap. Subsequent parent notes record gates.
- **Approved sizing deviations:** seven focused LLM suites and two test-only harnesses
  preserve all coverage below500; the user approved the provenance companion when
  existing capacity was exhausted. No production module or behaviour expansion.
- **Proof limits:** hermetic real-owner/native-stub coverage is not live GAS/LLM,
  deployed logging, expiry, durable persistence or original-incident-cause proof.
  No deployment authorised. Sections7–12 remain not started.

## Section 7 — Scoped image failures and hydration invariants

**Status: runtime/test/shape Green PASS; section not complete.** Independent authority
`.opencode/scratchpad/section7-green-approved.md` closes R1–R8, SR1 and G1–G6 with zero
outstanding in-scope Critical, Improvement or Nitpick finding. Docs sync and section
compaction and the stable-ID regression gate are complete; commit and push remain pending; no deployment
is authorised.

### Outcome (compacted)

`src/backend/RequestHandlers/ImageManager.js` (499 lines) is the sole production owner and
now materialises scoped image failures over the unchanged Section 5 transport owner. A
student image failure becomes that task's atomic extraction `IMAGE_HYDRATION_FAILED` E
with null content/hash and never reaches the LLM; a required shared reference/template
failure blocks the run and preserves prior saved results. No new module, helper,
dependency, configuration, URL policy or retry scheduler was added.

### Retained for later sections

- **Interfaces and source path.** `ImageManager.collectAllImageArtifacts()`,
  `fetchImagesAsBlobs()` and `writeBackBlobs()` remain the public surface. Owner-local
  `@private` helpers are `_isAdmissibleImageUrl`, `_isIPv4Hostname`,
  `_materialiseHydrationFailure`, `_assertKnownOutcomeUids`, `_assignFinalImageFailure`,
  `_collectWriteBackTargets`, `_applyHydratedBlob`, `_assignUnusableReturnedContent` and
  `_hasUsableHydratedContent`.
- **Private routing.** Collected entries carry `uid`, `url`, `documentId`, `scope`,
  `taskId` and optional `itemId`; the owning submission item is resolved through the
  private `_submissionItemByUid` map keyed by artefact UID. Routing does not expose a
  public `entry.item`.
- **Unchanged URL policy.** Admission is owner-local and mirrors the shared `Validate`
  acceptance policy (HTTPS, DNS hostname only, no IP address, no localhost, no port)
  without its progress diagnostics, so rejected raw URLs never reach a log channel. No
  `Validate`-wide rewrite and no image URL/source-link policy change.
- **One-read conversion.** Each blob is read once through a native `getBytes()`; those
  bytes are exposed to the model writer as `{ getBytes: () => bytes }`, keeping data-URL
  and hash generation model-owned. No second native read or second converter.
- **Strict wiring.** A missing `setContentFromBlob` writer throws before returned-data
  classification; required `submissions`/`items` structures are consumed directly without
  fallbacks. Unknown/duplicate outcome UIDs, duplicate input UIDs, unmatched/duplicate
  blob UIDs, duplicate model UIDs and scope-less failures throw rather than warn-and-continue.
- **No broad catch or rollback.** No catch converts thrown native-read, base64, hash or
  writer faults: they escape by original identity without setting E and without a manager
  warning. Conversion assigns content before hashing; neither manager nor model promises
  in-memory rollback after a thrown fault or earlier applied blobs.
- **Upstream terminal-E bypass.** An item whose three criteria are already E from upstream
  acquisition/extraction is preserved verbatim and never collected or overwritten (G1).
- **Changed versus unchanged snapshots.** Usable hydration requires non-empty string
  content and a non-empty hash. Changed content (null to content, or different content)
  invalidates stale assessments/feedback; identical valid content preserves full snapshots.
- **Transport policy.** Downloads accept only HTTP 200, so 201 is a final failure and is
  never retried; no stop statuses mean an image 403 is local and never an LLM-wide stop.
  One full round-robin list is sent at the explicit Slides batch size, successful blobs are
  consumed before the next batch, and the three total attempts with 5000/7500 ms waits come
  from the unchanged `BaseRequestManager`.
- **Tests and canonical fixtures.** Eight suites (collection 299, failures 287, identity
  299, integration 300, invalidation 300, writeBack 300, coverage remainder 298, Phase5
  499 lines) preserve every approved matrix below the 500-line limit. They use `small`/
  `medium` canonical IMAGE models through `loadBackendModelInputs` plus local missing-URL,
  HTTP, blob, decode and fault probes; no competing realistic image graph.
- **`@remarks` commitments.** Image HTTP failure scope differs from LLM-wide stop scope;
  a matched pending IMAGE is valid internal state, never a completed null success; upstream
  terminal-E survives collection; no in-memory rollback is claimed.
- **Later boundaries.** Section 8 owns pending-image completion rejection, marker stamping
  and prepared writes; Section 9 owns previews. Direct result/feedback invalidation matches
  `StudentSubmission._mergeExtractedContent` but has no callable model hook (canonical
  discrepancy 28).
- **Shared-helper register.** Delivered Section 7 entries are **implemented**: the existing
  image collection/fetch/writeback owner was extended, reusing base transport and
  Assessment error creation, with no second retry or hydration manager and no new module.
  Later-section entries remain `Not implemented`.

### Checks record (passed)

- `npm run test:backend:coverage`: **258 files / 3,567 tests PASS**; statements **91.53%
  (5,699/6,226)**, branches **86.31% (3,853/4,464)**, functions **90.04% (1,095/1,216)**,
  lines **92.18% (5,449/5,911)**. ImageManager: 96.75% statements, 93.22% branches.
- Focused composition covers **110 tests** (81 image plus 29 caller/eligibility controls)
  and is subsumed by the fresh backend run.
- `npm run lint:backend:check`: exit 1 with **zero errors** and exactly the five accepted
  historical `max-lines` warnings (`assignmentDefinitionPartials.unit` 2776,
  `assignmentController.hydration` 653, `dbManager` 665, `classroomApiClient` 550,
  `batchUpdateUtility` 615); no new warning. Prettier, scoped ESLint and `git diff --check`
  pass. Evidence: `s7-approved-green-{lint,coverage,format,hashes}.txt`.
- Source SHA256 `8cf42c3115b714d4b5a7dd23bddeed1941794f8db5cde2e103dcff8f16d1bbc6`;
  source and all eight test files remain below 500 lines (source 499, tests 2,582).
- Section regression comparison passed with accepted baseline debt (record below);
  commit/push remain pending. No deployment has run for Section 7.

### Implementation notes / deviations / follow-up

- Section7 runtime/test/shape review is PASS; no deployment authorised. Hermetic
  real-owner/native-stub/memory-store evidence does not prove live GAS/network,
  deployed logging, durable persistence, expiry or original-incident causation.
- Approved test-only companions preserve all assertions within their ≤300-line
  budgets; Phase5 and ImageManager remain499physical lines. No source split,
  model refactor, URL policy change or retry redesign introduced.
- Direct image result/feedback invalidation matches the model rule but has no
  callable model hook; canonical discrepancy28 records the future drift risk.
  Pending-image completion rejection and marker stamping remain Section8 work;
  saved-record preservation is not in-memory rollback.
- Docs D1/D2 CLOSED by `.opencode/scratchpad/section7-docs-final-approved.md`:
  suite-level proof attribution and scope-less failure wording corrected. Docs sync
  updated existing AssessmentFlow.md, rehydration.md and backend-testing.md; no new
  pages or source edits. Shape contracts were reconciled before Green sign-off.
- Compaction 139→99 lines retained future contracts and authoritative notes;
  outside-section isolation verified against the saved pre-compaction copy. Canonical
  helper registers agree: existing ImageManager extension implemented, Section 8
  prepared projections remain planned. Fresh post-docs backend checks: 3,567 PASS,
  branches 86.31%, exactly five accepted historical lint warnings, no new failures.
- Reported historical documentation nits retain their existing dispositions; the
  pre-existing ImageManager Processors/Parsers placement quirk is Minor, disregarded
  in `.opencode/scratchpad/assessment-errors-322-341-deferred-findings.md` (Nitpicks).
- Section regression gate: `npm run regression-checker -- assessment-errors-322-341`
  (1200000 ms), comparison against unchanged baseline 2026-10-23T05:20:43.034Z.
  Report `.ts-regression-checker/reports/session-assessment-errors-322-341/runs/2026-10-31T07-04-38.200Z/comparison.txt`.
  Zero regressions / zero new failures / one baseline fix; seven checks pass.
  Overall FAILING solely for five accepted historical backend max-lines warnings;
  backend/frontend/builder coverage, E2E, frontend/builder lint and all type checks pass.

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
