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
- Section 1 is complete; Section 2 is complete; Sections 3–12 are **Not started**. Record actual changes,
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
