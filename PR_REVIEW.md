# Pre-PR Review — docs/issue-19-task-preview-source-link

- **Base branch:** main
- **Generated:** 2026-10-03T07:42:15+00:00
- **Regression gate:** PASS (no regressions) — see note below
- **Changed files:** 74 (+13,924 / −6,021)

> **Regression gate note (recorded honestly).** The `npm run regression-checker` run exceeded the
> 10-minute tool timeout before writing a `comparison.txt`. Evidence used instead:
> (a) the latest _completed_ comparison for this branch
> (`.ts-regression-checker/reports/session-docs-issue-19-task-preview-source-link/runs/2026-10-03T05-51-22.769Z/comparison.txt`)
> reports `Overall Status: FAILING`, `Regressions Count: 0`, `New Failures Count: 0`, `Fixes Count: 2`;
> (b) the current tree's persisted `backend-lint-check/raw.json` from the timed-out run contains the
> **identical 10 pre-existing `max-lines` failures** as the branch baseline
> (`baseline/checks/backend-lint-check/raw.json`) — byte-for-byte the same rule, file and line list;
> (c) every other check that completed in the timed-out run passed
> (`frontend-lint-check`, `builder-lint-check`, `backend-test-coverage-check`, `frontend-e2e-check`).
> The user has confirmed these 10 `max-lines` findings are accepted technical debt. **There are zero
> regressions and zero new failures versus baseline**, so the review proceeds.

> **Full focus reviews** (written by the review agents) are in `.opencode/scratchpad/`:
> `issue19-kiss-dry-review.md`, `issue19-datashape-consistency-review.md`,
> `review-error-handling-issue-19.md`, `review-issue19-logging-error-handling.md`,
> `review-issue19-task-preview-layout-a11y.md`, `review-issue19-test-coverage.md`,
> `review-perf-task-preview-source-link.md`, `security-secrets-review-issue19.md`.
> The De-Sloppification and Repo-rule-compliance agents returned their findings inline (no scratchpad file).

## Layers touched

As reviewed (`git diff main...HEAD`):

- **Frontend:** yes (41 files under `src/frontend/`)
- **Backend:** no (`src/backend/**` untouched in the reviewed diff)
- **Builder:** no (`scripts/builder/**` untouched)

Optional focuses **not** in scope: Backend data shape / schema consistency.

> **Note:** [Batch 1](#batch-1--backend-pageid-contract-tightening) _adds_ a backend change to this PR (the
> `TaskDefinition.pageId` tightening), so this section will no longer be accurate once that batch lands. The
> backend data-shape focus was correctly out of scope for the reviewed diff; Batch 1 requires the Data Shapes
> Agent per root `AGENTS.md` §6.

## Verdict

**Fail** — seven Critical findings, all confined to the test/support and planning-artefact layers: the
canonical fixture-selection pipeline is built three times (once inside the production source tree), the
keyboard focus/interaction matrix is pinned twice at roughly 1,000 redundant lines, dead exports ship in
the E2E geometry helper, and `ACTION_PLAN.md` records a final review and regression evidence that the
artefacts do not support.

### Direct answer to the "is this over-engineered?" concern

Three independent focuses reached the same conclusion, so this is well evidenced rather than a
matter of taste:

| Layer                                                | Size                                  | Verdict                                                         |
| ---------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Production feature code                              | ≈767–900 lines                        | **Proportionate. Nothing production-side is removable.**        |
| New test/support code                                | ≈6,020–7,300 lines (≈7–8× production) | **The over-engineering lives here.**                            |
| Mechanical JSON fixture regeneration                 | 5,384 of the 13,924 insertions        | Byte-reproducible generator output; inflates the headline only. |
| Unrelated agent/workflow config riding on the branch | ≈700 lines                            | Belongs in a separate PR.                                       |

- **KISS & DRY:** "The **production delta (≈767 lines)** is not the problem: a ~72-line URL resolver
  (`buildCellPreviewLookup.ts:92-144`), one header action (`TaskPreviewCard.tsx:178-202`), a 16-line CSS
  containment fix, and a keyboard-focus session whose complexity is mandated line-by-line by
  `SPEC.md:60`. The `TaskMetricPreviewContent` split is **not** a premature split of
  `TaskPreviewCard` — it's the relocation of the pre-existing `buildPopoverContent`, planned in
  `SPEC.md:74-77`, and lands on a real seam. **Load-bearing; nothing production-side is removable.**
  … Removable with zero coverage loss: **≈400–500 lines + 1 file.**"
- **De-Sloppification:** "The production feature itself (~900 lines) is proportionate and mostly clean —
  the user's suspicion of 'massive overcomplication' is wrong about the _product code_ but right about
  _everything wrapped around it_: ~7,300 lines of new test/support code for a ~900-line feature (an ~8:1
  ratio), the same focus-session matrix pinned scenario-for-scenario at two layers, fixture primitives
  copy-pasted between the unit and E2E worlds, unused exports, and comment/JSDoc narration occupying
  ~50% of the largest new files."
- **Repo rule compliance** (independent focus): "the implementation is disciplined, SPEC-conformant and
  overwhelmingly clean" on code; its only Criticals are planning-artefact truthfulness.

**Bottom line:** the feature itself is not over-engineered. The review effort around it is. Trimming the
duplicated E2E focus matrix (De-Sloppification C1), the triplicate fixture pipeline (KISS C1) and the
journeys/geometry dead weight would remove roughly 1,500–2,000 lines with no loss of product coverage.

## Action plan — batched

### Execution outcomes

**Remediation status:** all six recorded batches have passed clean review and their final regression gates. Original findings and verdict below are retained as review-history evidence; the outcomes here describe the delivered remediation. Deferred/Wontfix decisions remain unchanged.

**Delivery record:** Batch 1 `75876fd` + formatter follow-up `891771e`; Batch 2 `ec05a07`; Batch 3 `f1b4e32`; Batch 4 `a612a5f`; Batch 5 `08db14c`. All pushed to `docs/issue-19-task-preview-source-link` before the next batch began. Batch 6 is delivered with this outcome record.

**Cumulative cleanup measurement (Batches 2–6):** scc against `891771e`, counting the same union of old/new TS/TSX/JS/CSS paths and all replacement helpers/tests: code 6,482 → 6,255 (**−227**), comments 3,570 → 3,236 (**−334**), blanks 1,069 → 963 (**−106**), total 11,121 → 10,454 (**−667**). This includes Batch 5's expressly requested additional coverage; it excludes Markdown documentation and mechanical JSON fixtures. Evidence: `.opencode/scratchpad/loc-counter/cleanup-final-cumulative/report.json`. Actual reduction is smaller than the original estimate; no claimed reduction relies on file relocation or hidden replacement code.

#### Batch 6 — complete (2026-10-07)

- Implementation, Testing Specialist and Playwright removed stale development/review narration and corrected the key-handler, mouse-delay and layout comments. Docs single-sourced the microtask/`flushSync` rationale in §9.26 and reconciled the final testing map. Data Shapes Agent recorded the deliberate partial/full artefact-ID schema asymmetry, corrected full-response artefact presence and aligned the registry row.
- No executable behaviour changed: Code Reviewer independently verified byte-identical comment-free transpilation for all 14 TS/TSX files and comment-stripped CSS equality. Clean sign-off: `.opencode/scratchpad/review-batch6-retry/REVIEW.md`.
- Independent scc delta against `08db14c`: **0 code / −114 comment / −114 total lines**, with no blank-line compression. Report: `.opencode/scratchpad/loc-counter/batch6-review-retry/report.json`. Feature docs also shed duplicated prose; data-contract corrections add only the required explanations.
- Relevant unit/E2E, TypeScript and formatter checks pass. Final full regression comparison `runs/2026-10-07T17-24-29.917Z/comparison.txt`: seven checks passing, unchanged ten accepted backend lint findings, zero regressions/new failures. User-owned agent configuration edits remain excluded and unstaged.

#### Batch 5 — complete (2026-10-07)

- Implementation applied the listed trigger accessibility/focus-ring, memoisation, URL format deduplication, dead-guard removal, existing diagnostic-dedupe reuse and anchor-type/casing fixes. The existing preview wrapper is a named non-modal dialog matching `aria-haspopup="dialog"`; ordinary Tab navigation remains unchanged. Memoisation stays in the existing content component, without a new forwarding wrapper.
- Testing Specialist covered already-open Enter/Space re-arming, the open-change callback's focus re-decision, Sheets root/encoded-fragment URLs and memo reuse/invalidation. The branch-specific callback test is isolated from the real-portal integration cases; no production test seam was added. Step 8's throw-message correction was superseded by deleting that unreachable guard in step 4.
- All review findings addressed, including stale contract remarks and unnecessary test ceremony. Code/test sign-off: `.opencode/scratchpad/re-review-batch5-final-clean.md`; documentation sign-off: `re-review-batch5-docs-final-rereview-signoff.md`. Docs qualify the diagnostic helper as standalone-Heatmaps-local, not cross-feature policy.
- Frontend: 236 files / 2,452 tests passing; TypeScript, frontend lint and formatter checks pass with no new findings. Full regression `runs/2026-10-07T15-33-42.213Z/comparison.txt`: seven checks passing, unchanged ten accepted backend lint findings, zero regressions/new failures.
- Measured scc delta against `a612a5f`: **+209 code / +228 total lines**, predominantly the expressly requested new coverage and accessibility/memo behaviour. No reduction is claimed for this feature-and-coverage batch; guard/lookup cleanup itself is net-negative and no new production helper/module/wrapper was introduced. Report: `.opencode/scratchpad/loc-counter/batch5-clean-review/report.json`.
- User-owned changes to three `.opencode/agents/` files were excluded from this batch and left unstaged. No Wontfix/deferred work was attempted.

#### Batch 4 — complete (2026-10-07)

- Testing Specialist replaced the two corpus-convention suites with `tests/synthetic-analysis/syntheticCorpusConventions.test.ts`: parametrised committed-view assertions plus one generator-determinism probe. Both timestamp conventions and 21-digit student identifiers retain their cross-profile/cross-view coverage; Docs corrected the retired filenames in the canonical testing document and one generator JSDoc pointer, without changing generator behaviour.
- Code Reviewer mapped the deleted assertions to retained/subsuming coverage, required two accurate JSDoc summaries and returned clean final sign-off: `.opencode/scratchpad/re-review-batch4-final-signoff.md`.
- Independent scc measurement against `f1b4e32`: **−232 code / −386 total lines**. The suites themselves went from 861 to 475 total lines; the generator comment edit is line-neutral. Report: `.opencode/scratchpad/loc-counter/batch4-final-review/report.json`.
- New suite: 24 tests passing; full synthetic project: 24 files / 262 tests passing. Synthetic lint and formatter checks pass. Full regression comparison `runs/2026-10-07T07-32-57.201Z/comparison.txt`: seven checks passing, unchanged ten accepted backend lint findings, zero regressions/new failures.

#### Batch 3 — complete (2026-10-07)

- Implementation replaced the balance-span class hook with a test ID. Playwright removed the duplicated focus matrix, merged journeys into helpers, reduced representative visual checks, simplified geometry tracking, pruned dead support and added named queue capacities/tail sentinels. Docs reconciled the coverage split, layout evidence and merged helper ownership.
- Review corrected an inaccurate deletion premise: the Space twin also contained browser-only Enter-on-link navigation. That half remains in one focused real-browser test (including the focus tooltip); the unit-owned matrix stays removed. Other findings addressed: orphaned failure/deferred queue arms, stale journey ownership and identical normal/focused screenshots. Final clean review: `.opencode/scratchpad/re-review-batch3-final-clean.md`.
- Independent scc comparison against `ec05a07`: code 1,594 → 1,392 (**−202**); total 3,260 → 2,885 (**−375**), including the merged helper and retained navigation coverage. Report: `.opencode/scratchpad/loc-counter/batch3-final-review/report.json`.
- Relevant E2E: 7 interaction/state + 20 visual tests passing; focused navigation repeat 5/5 and narrow capture repeat 3/3 pass. The representative desktop/narrow, light/dark, both-entry-point matrix retains seven measurements and TEXT/TABLE/IMAGE samples. Normal/focused card captures are genuinely distinct; hover captures are desktop-only, disclosed in the layout document. Screenshot artifacts are generated under `src/frontend/test-results/`.
- An overlapping validation run suffered a V8 coverage-file collision and two unrelated retry flakes. Isolated revalidation and the final full regression run at `runs/2026-10-07T06-56-38.627Z/comparison.txt` passed with zero regressions/new failures: seven checks passing, unchanged ten accepted backend lint findings. No unrelated tests or configuration were changed.

#### Batch 2 — complete (2026-10-07)

- Implementation exported the existing metric-label formatter and preview contract labels. Testing Specialist consolidated shared fixture primitives, moved schema fixtures into `src/test/assignmentAssessment`, reused the canonical Slides selection and pinned each fixed label once. Playwright migrated the E2E consumers without removing either independent URL oracle. Docs reconciled §9.26.
- Code Reviewer returned fully clean sign-off after a fixture-provenance pointer was corrected to name its test: `.opencode/scratchpad/re-review-batch2-final-signoff.md`.
- Independent `loc-counter`/scc measurement against `891771e`, including new/deleted/moved paths: code 3,924 → 3,922 (**−2**); total lines 6,757 → 6,737 (**−20**). Report: `.opencode/scratchpad/loc-counter/batch2-final-review/report.json`. This is a modest real reduction, not the larger estimate in the original review; Vite raw loading and Node direct JSON loading remain separate.
- Frontend: 2,443 unit tests passing; relevant source-link E2E tests passing; TypeScript and frontend lint pass with no new findings. All changed files are formatter-stable. Full regression comparison `runs/2026-10-07T04-21-16.802Z/comparison.txt` in the branch session: seven checks passing, unchanged ten accepted backend lint findings, zero regressions/new failures.
- No scope expansion: deferred schema/runtime issues and later-batch coverage reduction were not attempted. Tooling was prepared only in ignored scratchpad; no agent/config changes were made.

#### Batch 1 — complete (2026-10-03)

- Delivery: `75876fd` (`fix: require task definition page IDs`) pushed to `docs/issue-19-task-preview-source-link`. Its successful commit hook reformatted the compact hydration fixtures, increasing the existing line-count finding again. Before starting Batch 2, a formatter-stable follow-up removed four lines of redundant local comment narration; Code Reviewer signed it off clean (`.opencode/scratchpad/re-review-batch1-fu2-formatter-stable-followup.md`). The full post-format regression comparison at `runs/2026-10-03T15-11-15.626Z/comparison.txt` in the same session reports zero regressions/new failures, seven passing checks and the unchanged ten accepted backend lint findings. This supersedes the pre-hook comparison below.

- Implementation tightened `TaskDefinition.pageId`, removed its ID fallback and simplified only the task-page comparison. Testing Specialist updated the affected constructor/rehydration fixtures and added four fail-fast cases; Data Shapes Agent corrected the task-page contract and nullable backend `studentName` description.
- Code Reviewer returned clean sign-off after the documentation/comment findings were addressed, then confirmed the final hydration-fixture correction remained clean. Review evidence: `.opencode/scratchpad/re-review-batch1-signoff.md` and `review-batch1-followup-hydration-fold.md`.
- Backend: 177 files, 2,562 tests passing. Full regression comparison: seven checks passing; backend lint retains exactly the ten accepted baseline `max-lines` findings. Zero regressions and zero new failures. Report: `.ts-regression-checker/reports/session-docs-issue-19-task-preview-source-link/runs/2026-10-03T12-17-32.155Z/comparison.txt`.
- An intermediate hydration-fixture edit increased its existing `max-lines` finding by two lines; the fixture properties were folded into their existing literal lines and the full regression gate rerun successfully before delivery.
- Required test-fixture updates extended beyond the predicted sites because stored task literals also hydrate through `fromJSON`; no unrelated behaviour changed. This contract-tightening batch is not a deduplication batch and has no LOC-reduction target.
- Prerequisite trace: backend `studentName` genuinely permits null, so no runtime/schema tightening was made. Full frontend `studentName: z.string()` remains a reported, out-of-scope divergence.
- Report-only Sheets trace reaches `TaskSheet.sheetId`, but `TaskSheet` is absent from tracked production source; numeric API provenance for that definition path could not be fully confirmed. No extraction change was made.
- The accepted legacy consequence is pinned: missing/null task `pageId` now fails loudly on construction and `fromJSON`.

Everything in this section is a recorded **Fix now** decision. Wontfix, deferred and no-action items are at the
**bottom** of this document. Evidence for every finding is in [Focus areas](#focus-areas); full rationale per
decision is in [Decisions](#decisions).

**Six batches.** Each owns a disjoint set of files so they can be reviewed independently; only Batch 2 → Batch 3
is order-dependent. Batches 1, 4 and 6 touch no shared files with each other and can run in parallel.

| #   | Batch                                                                                                            | Why it is its own batch                                                  | Depends on |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| 1   | [Backend `pageId` contract tightening](#batch-1--backend-pageid-contract-tightening)                             | Different stack; adds a new fail-fast throw; needs the Data Shapes Agent | —          |
| 2   | [Fixture consolidation and literal single-sourcing](#batch-2--fixture-consolidation-and-literal-single-sourcing) | File moves out of the production tree and across the lint boundary       | —          |
| 3   | [E2E layer reduction](#batch-3--e2e-layer-reduction)                                                             | Largest deletion (~1,000 lines) plus a support-module restructure        | Batch 2    |
| 4   | [Corpus meta-test reduction](#batch-4--corpus-meta-test-reduction)                                               | Different tree (`tests/synthetic-analysis/**`); fully parallel           | —          |
| 5   | [Feature production code and coverage](#batch-5--feature-production-code-and-coverage)                           | Touches shipped modules and the unit specs the new tests extend          | —          |
| 6   | [Documentation and stale-comment sweep](#batch-6--documentation-and-stale-comment-sweep)                         | Must run last — every earlier batch edits files it comments on           | 1–5        |

---

### Batch 1 — Backend `pageId` contract tightening

**The only batch that changes runtime backend behaviour.** It replaces a silent `null` default with a fail-fast
throw, so it carries the highest blast radius of the six. Requires `src/backend/AGENTS.md` and the full root
`AGENTS.md` §6 loop (Implementation → Code Reviewer → Docs → **Data Shapes Agent** — mandatory here, because the
data-shape contract changes).

**Gate before starting:** verify `StudentSubmission.studentName` the same way `pageId` was verified (below). It
has the identical shape and may be tightenable in the same change. Do not assume — trace it.

**Findings addressed:** checklist 15, 18.

| Step | File                                                                                                                                                                                         | Change                                                                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | —                                                                                                                                                                                            | Verify whether `studentName` can ever be null: `assignmentAssessment.zod.ts:117` vs `src/backend/Models/StudentSubmission.js:188,337`                                                 |
| 2    | `src/backend/Models/TaskDefinition.js`                                                                                                                                                       | Remove `pageId = null` default (`:26`); add fail-fast guard beside the existing `taskTitle` guard (`:29`); update JSDoc at `:18` and `:50`                                            |
| 3    | same                                                                                                                                                                                         | Remove the dead `pageId \|\| ''` branch in `_deriveId` (`:55`)                                                                                                                        |
| 4    | `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js`                                                                                                      | Simplify **only** line 43 to a direct comparison. **Keep `absentToNull_`** — it has 7 call sites including nullable `taskNotes` and genuinely-nullable artefact `pageId`/`documentId` |
| 5    | `tests/backend-api/assignmentDefinitionPartials.unit.test.js:1914`, `tests/controllers/abclassController.readClass.test.js:477`, `tests/models/assignmentDefinition.test.js:195,196,241,247` | Add `pageId` to constructions that omit it                                                                                                                                            |
| 6    | `tests/helpers/modelFactories.js:39`, `tests/parsers/documentParserPhase2.test.js:55`, `tests/models/assignmentDefinition.test.js:226`                                                       | Check whether `pageId` is already supplied                                                                                                                                            |
| 7    | `docs/developer/data-shapes/assignment-definition.md:505`                                                                                                                                    | Correct to "required string, always populated by both parsers"                                                                                                                        |
| 8    | `docs/developer/data-shapes/assignment.md:189`                                                                                                                                               | Correct only if step 1 warrants it                                                                                                                                                    |

**Also confirm while the parser is open:** `String(sheetData.sheetId)` (`SheetsParser.js:251`) is safe from null
but not from garbage — `String(undefined)` yields the literal `"undefined"`, which would pass `z.string()`, pass
`trimStoredId` (non-blank), and produce a broken `#gid=undefined` Sheets URL. Trace `sheetId`'s origin; it
should come from the Sheets API's numeric `getSheetId()`. **Not a change to make in this batch** — report only.

**Accepted consequence:** `fromJSON()` (`:180`) passes `json.pageId` straight through, so a legacy stored
definition persisted without `pageId` will now throw instead of defaulting to null. Confirmed as intended.

**Background:** see [Verification §1](#1-taskdefinitionpageid-nullability--finding-inverted-backend-change-required).
Note the original review finding here was **inverted** — it proposed loosening the frontend schema, when in fact
the backend default was the thing that was wrong.

---

### Batch 2 — Fixture consolidation and literal single-sourcing

The same canonical-fixture pipeline is currently built **three times**, one copy of which sits in the production
source tree (`src/services/`), breaching root `AGENTS.md` §8. This batch collapses it to one shared home and
applies the agreed literal split. Structurally the most disruptive batch after Batch 1, because it moves files
across a lint boundary — reviewers need to see the moves in isolation.

**Findings addressed:** checklist 1, 8, 10.

Destinations are fixed by existing convention, not judgement:

- `src/test/shared/` already exists for cross-domain test helpers (`testDeferredPromise.ts`, `sharedQueriesTestHelpers.ts`).
- `src/test/` already uses domain subfolders (`assignmentDefinition/`, `auth/`, `classes/`, `dataAnalysis/`, `taskHeatmap/`).
- **E2E already imports from `src/test/`** — `settings-topics-crud.spec.ts:14`, `helpers/classes-page-end-to-end-helpers.ts:11`.
- `assignmentAssessment.zod.fixtures.ts` is read only by 3 co-located specs, no production code, so moving it breaks nothing.

| Step | Change                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Add shared `deepFreeze` / `requireRecord` / `requireTextArtifactContent` primitives to `src/test/shared/`                                                                                                                                                                                                                            |
| 2    | Move `src/services/assignmentAssessment/assignmentAssessment.zod.fixtures.ts` → `src/test/assignmentAssessment/`; update the 3 importing specs                                                                                                                                                                                       |
| 3    | Point `src/test/taskHeatmap/previewFixtures.ts` and the E2E fixture/expectation helpers at the shared primitives; keep only the record-loading layer-specific (Vite `?raw` vs direct JSON import — a real constraint, documented at `task-preview-source-link-fixtures.ts:7-9`)                                                      |
| 4    | **Literal split:** export the metric-cell label formatter from `taskHeatmapTableColumns.tsx:139-146` and import it in the 3 test files that rebuild that template                                                                                                                                                                    |
| 5    | **Literal split:** pin the spec-fixed accessible name / loading label / error text in exactly **one** verbatim assertion each (`SPEC.md:54` pins the accessible name as a WCAG-facing contract, so one deliberate assertion is warranted); import them everywhere else. Production already exports `CARD_MAX_WIDTH` for this purpose |
| 6    | Rename `SOURCE_DOCUMENT_ACTION_LABEL` → `SOURCE_ACTION_LABEL` to match the unit-layer name                                                                                                                                                                                                                                           |
| 7    | **Keep both URL-derivation oracles.** `deriveEditorSourceUrl` is used at `task-preview-source-link-expectations.ts:250` and `buildExpectedSourceUrl` has 18 call sites; an assertion must not validate the resolver against itself. The review finding that called `deriveEditorSourceUrl` "an unused export" was **wrong**          |
| 8    | Update §9.26 of `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` — the recorded rationale justifies the `previewFixtures` ↔ `zod.fixtures` duplication via a lint boundary that does **not** extend to the E2E pair                                                                                    |
| 9    | Document the artefact/parent ID coincidence hazard on `BASE_ARTIFACT_FIELDS`, pointing at the non-coincidence pattern in `buildCellPreviewLookup.sourceLink.spec.ts:150-152`                                                                                                                                                         |
| 10   | Name the winning ID source in the `previewSourceActionTestHelpers.ts:64-93` JSDoc; cross-reference the null-`cellData` invariant on `TaskPreviewData.sourceUrl`                                                                                                                                                                      |

---

### Batch 3 — E2E layer reduction

The largest single reduction in the plan. The unit suites render the **real** `TaskMetricPreviewCell` → real antd
portal → real `TaskPreviewCard`, so they are not a mocked stand-in and the E2E twins are genuine redundancy. This
is also the highest-review-risk batch, because it removes coverage.

**Findings addressed:** checklist 2, 3, 4, 6.

**All 10 twins are deletable.** Verified: `focus.spec.tsx:157-172` is commented _"Escape pressed while focus sits
on the action inside the portal overlay"_ and locates the action via `findSourceAction()`, a document-level portal
query — so the unit layer already exercises real-portal Escape. **Keep** `spec.ts:121-133` (real tooltip, real
new-tab navigation), which are genuinely browser-only.

| Step | Change                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Delete the mirrored twins: `states.spec.ts:87-107, 142-167, 169-193, 195-214, 222-248, 250-282` and `spec.ts:171-184, 186-204, 206-222, 224-242`                                                                                                                                                                                                                                                                                              |
| 2    | Document the resulting unit-vs-E2E layer split in `docs/developer/frontend/frontend-testing.md`                                                                                                                                                                                                                                                                                                                                               |
| 3    | Merge `task-preview-source-link-journeys.ts` (123 lines) into `helpers.ts` — combined floor ≈470 lines, under the 550-line trigger. It has only two callers and `visual.spec.ts:172-194, 380-391` bypasses it entirely                                                                                                                                                                                                                        |
| 4    | Reuse the exported `taskMetricCells` locator in `visual.spec.ts:286` instead of rebuilding it inline                                                                                                                                                                                                                                                                                                                                          |
| 5    | Un-export the six dead constants in `task-preview-source-link-geometry.ts:51-55, 58-67`; un-consume the other single-consumer geometry/region exports. Verified zero external references                                                                                                                                                                                                                                                      |
| 6    | Simplify `GeometryStabilityTracker` (≈35 → ≈15 lines)                                                                                                                                                                                                                                                                                                                                                                                         |
| 7    | Replace the FIFO queue magic numbers in `task-preview-source-link-scenarios.ts:37-50` (4, 10, 14, 8, 2, 2) with named values, and add a tail sentinel so under-sizing fails with a named message rather than a stray envelope mismatch                                                                                                                                                                                                        |
| 8    | Reduce `task-preview-source-link.visual.spec.ts` to the representative inspection required by `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:66,68`: 1440×900 and 390×844, light and dark, both entry points, text/table/image card examples, card-level screenshots (normal, hovered, keyboard-focused), and the 7 numbered measurements. Fold or drop the label/state matrix (`:306-364`) and body matrix (`:370-408`), which the doc does not require |
| 9    | Update `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md` to match the reduced spec                                                                                                                                                                                                                                                                                                                                                                         |
| 10   | Replace the `HEADER_BALANCE_CLASS` production test hook (`TaskPreviewCard.tsx:121-132`, `header-regions.ts:46`) with a `data-testid`, following the existing precedent at `ReferenceDataManagementModalScaffold.tsx:157` which four specs assert by name                                                                                                                                                                                      |
| 11   | Move the import-time corpus throw (`task-preview-source-link-fixtures.ts:113-119`) into scenario construction so corpus drift fails with better locality                                                                                                                                                                                                                                                                                      |
| 12   | Drop the redundant `as unknown as` cast (`task-preview-source-link-fixtures.ts:276-277`)                                                                                                                                                                                                                                                                                                                                                      |

**Sequence step 10 with Batch 5 step 4** — both touch the balance-span assertion.

---

### Batch 4 — Corpus meta-test reduction

861 lines of root-level backend tests pin two conventions. Self-contained and fully parallel — no shared files
with any other batch.

**Finding addressed:** checklist 5.

| Step | File                                                                                                                 | Change                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `tests/synthetic-analysis/syntheticAssignmentTimestamps.test.ts` (483) + `syntheticStudentIdentifiers.test.ts` (378) | Collapse to one parametrised suite over the committed views plus one generator-determinism probe, still pinning `updatedAt = createdAt + 3 min` and 21-digit student IDs |

Context: these exist so `class-2` survives the class page's fail-closed adapter and roster selection stays
deterministic (`SPEC.md:76-78`).

---

### Batch 5 — Feature production code and coverage

Small, independent fixes to the shipped feature modules, plus the two new coverage tests. Grouped so the specs
the new tests extend are not edited twice.

**Findings addressed:** checklist 11, 12, 13, 16, 17, and the code-bearing parts of 9.

| Step | File                                                                      | Change                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx:296-304` | Add `aria-expanded` / `aria-haspopup` to the trigger; the component already owns `isPreviewOpen` (`:128`, `:268`)                                                                                                                                                  |
| 2    | `TaskMetricPreviewCell.module.css`                                        | Apply the themed `:focus-visible` ring from `src/frontend/src/index.css:187-189` instead of the UA default                                                                                                                                                         |
| 3    | `TaskMetricPreviewContent.tsx:118-120`                                    | Memoise `assembleTaskPreviewData` so open-popover re-renders do not re-run the O(R×K) spreadsheet conversion. The "defer until the popover opens" remark (`:10-15`, `:72-74`) currently holds only for the first open                                              |
| 4    | `buildCellPreviewLookup.ts:213-218`                                       | Delete the unreachable `definitionKey` guard — the transport schema already requires both fields (`:145`, `:183`) and the module's own remarks concede it                                                                                                          |
| 5    | `buildCellPreviewLookup.ts:92-100, 141-143`                               | De-duplicate the format decision shared by `buildEditorBaseUrl` and `resolveSourceUrl` (have the former return the fragment form alongside the base URL)                                                                                                           |
| 6    | `assembleTaskPreviewData.ts:110-112`                                      | Delete the dead `!Array.isArray` guard                                                                                                                                                                                                                             |
| 7    | `buildCellPreviewLookup.ts:129-130`                                       | Use one spelling of the "unusable" test across the two adjacent lines                                                                                                                                                                                              |
| 8    | `buildCellPreviewLookup.ts:215-217`                                       | Correct the throw message, which misdescribes one branch of its own guard                                                                                                                                                                                          |
| 9    | `useHeatmapsPageData.ts:392`                                              | Add the memo-recomputation dedupe, matching `heatmapsPipeline.ts:88-108`                                                                                                                                                                                           |
| 10   | `TaskPreviewCard.tsx:60-69`                                               | Simplify the `SourceActionElement` union — the action always carries an `href`, so the `HTMLButtonElement` arm exists only to avoid a cast                                                                                                                         |
| 11   | `TaskPreviewCard.tsx:65,126,151,152,155,157`                              | Correct `ant Design` → `Ant Design`                                                                                                                                                                                                                                |
| 12   | **New coverage** — `TaskMetricPreviewCell.focus.spec.tsx`                 | Cover the already-open Enter/Space re-arm (`:230-243`, `:240`) and open-branch re-decision (`:184-188`). Every `{Enter}`/`{ }` press today starts from a closed state, so dropping line 240 breaks the pointer-open→keyboard-activate journey with all tests green |
| 13   | **New coverage** — `buildCellPreviewLookup.sourceLink.spec.ts`            | Cover the fragment-less Sheets `/edit` URL (`buildCellPreviewLookup.ts:141-143`) and Sheets fragment-encoding. All root-fallback cases are Slides-only today, so a `#gid=undefined` leak would ship silently                                                       |

**Do not** add `mouseEnterDelay`/`mouseLeaveDelay` — Wontfix, see [below](#no-action-wontfix-and-deferred).

---

### Batch 6 — Documentation and stale-comment sweep

Lowest risk — no behavioural change. **Runs last** because every earlier batch edits files this batch comments
on, so one pass over the final state avoids conflicting edits. Each earlier batch is responsible for the comments
in the files it owns; this batch covers the remainder.

**Findings addressed:** checklist 7, the comment-bearing parts of 9 and 10, Layout N2, and the outstanding
data-shape doc corrections.

| Step | Change                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Correct the three **factually false** comments claiming review is pending: `task-preview-source-link.visual.spec.ts:32`, `task-preview-source-link.spec.ts:30`, `.states.spec.ts:38-40` — all contradicted by `ACTION_PLAN.md:299-300`     |
| 2    | Strip development-timeline narration ("red-first provenance", section-ordering notes) from the six affected files; keep one behavioural contract statement per module                                                                      |
| 3    | Reduce the `TaskPreviewCard.tsx:121-159` JSDoc to a pointer at the layout doc, removing the duplicated narrow-viewport geometry numbers already held in `TaskMetricPreviewCell.module.css:6-8` and `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:58` |
| 4    | Collapse the triple-stated `flushSync`/`queueMicrotask` rationale (`TaskMetricPreviewCell.tsx:50-58`, §9.26 entry 3, `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:57`)                                                                              |
| 5    | Correct `TaskMetricPreviewCell.spec.tsx:8` — "Enter/Space click synthesis" no longer describes the delivered handler (`:230-243`)                                                                                                          |
| 6    | Correct `TaskHeatmapTable.preview.spec.tsx:115` — implies a configured `mouseEnterDelay` that has **never** existed                                                                                                                        |
| 7    | Add a Known-discrepancy entry to `docs/developer/data-shapes/assignment.md:394-438` explaining why the _partial_ artefact schema stays `.nullable().optional()` while the full one is required-nullable                                    |
| 8    | Reconcile the blanket claim at `docs/developer/data-shapes/assignment-definition.md:510` (`TaskDefinition.artifacts` also appears in `getAssignment` responses)                                                                            |
| 9    | Bring the `docs/developer/data-shapes/INDEX.md:30` registry row into line with the contracts' own file index                                                                                                                               |

**Note:** `ACTION_PLAN.md` is deleted before merge, so do not spend effort on its record accuracy.

---

---

## Verification and revised findings

Two findings were re-examined during the decision pass and their conclusions changed. Both are recorded here
so the reasoning survives independently of this conversation.

### 1. `TaskDefinition.pageId` nullability — finding inverted, backend change required

**Original finding (Frontend data shape, incidental 1):** `TaskDefinitionSchema.pageId: z.string()` is
stricter than the backend, which "emits `pageId` as `string | null`"; any future task with a null `pageId`
would fail `AssignmentFullSchema`. Proposed remedy: loosen the frontend schema to nullable.

**Investigation result:** the original claim was **wrong**, because it compared an _extracted value_ against
a _constructor default_.

- Slides: `processSlidesForDefinitions` (`src/backend/DocumentParsers/SlidesParser/index.js:81`) takes
  `getPageId(slide)` → `slide.getObjectId()`
  (`src/backend/DocumentParsers/SlidesParser/00_SlidesParserTableContent.js:54-56`) — a platform-guaranteed
  non-empty string — which flows unbroken into `new TaskDefinition({ taskTitle, pageId })`
  (`SlidesParser/index.js:193-197`). No fallback anywhere.
- Sheets: `extractTaskDefinitions` passes `pageId: String(sheetData.sheetId)`
  (`src/backend/DocumentParsers/SheetsParser.js:251`), and `String(...)` never returns null.
- The `null` originates solely from the constructor default `pageId = null`
  (`src/backend/Models/TaskDefinition.js:26`), which fires only when `pageId` is `undefined`. That happens on
  exactly one path: `fromJSON()` (`:177-185`) reconstructing a **legacy stored** definition whose persisted
  JSON omits `pageId`. This also explains the defensive `pageId || ''` in `_deriveId` (`:55`).

**Critical distinction — two different `pageId` fields:**

| Field                                         | Reality                                                                                                                                                                                                                                  | Frontend schema         | Verdict                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------- |
| Artefact `pageId` (`BaseTaskArtifactFields`)  | **Genuinely nullable** — the submission matcher explicitly emits `pageId: null` for unmatched entries (`01_SlidesParserSubmissionMatcher.js:67`); table content uses `context.pageId ?? null` (`00_SlidesParserTableContent.js:103,114`) | `z.string().nullable()` | **Correct** — this is exactly the alignment this PR performed |
| `TaskDefinition.pageId` (the task's own page) | **Always a non-empty string** from both parsers                                                                                                                                                                                          | `z.string()`            | **Correct as-is**                                             |

So this PR's nullable-ID change was right, and the untouched `TaskDefinitionSchema.pageId` is also right. What
was actually wrong is the documentation: `docs/developer/data-shapes/assignment-definition.md:505` records the
task `pageId` as `string | null` "Omitted from both frontend schemas", describing the constructor signature
rather than actual data. That misdescription is what misled the review focus.

**Decision — backend tightening, included in this PR.** Per the user's judgement that there is no point
allowing a nullable prop that can never be null, the fix is applied to the **backend** to match the frontend
rather than loosening the frontend:

1. `src/backend/Models/TaskDefinition.js` — remove the `pageId = null` default (`:26`), add a fail-fast
   guard alongside the existing `if (!taskTitle) throw new Error('TaskDefinition requires taskTitle')` (`:29`),
   e.g. `if (!pageId) throw new Error('TaskDefinition requires pageId')`, and update the JSDoc types at `:18`
   and `:50` from `string` / `string|null` to required `string`. No backend Zod exists (GAS is plain JS), so
   the constructor guard plus JSDoc annotations are the validation surface.
2. Remove the now-dead `pageId || ''` defensive branch in `_deriveId` (`:55`).
3. Update the ~8 test construction sites that omit `pageId`, verified to include
   `tests/backend-api/assignmentDefinitionPartials.unit.test.js:1914`,
   `tests/controllers/abclassController.readClass.test.js:477`, and
   `tests/models/assignmentDefinition.test.js:195,196,241,247`; also check
   `tests/helpers/modelFactories.js:39`, `tests/parsers/documentParserPhase2.test.js:55` and
   `tests/models/assignmentDefinition.test.js:226`.
4. In `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js`, simplify **only
   line 43** to a direct `previousTask.pageId !== reparsedTask.pageId` comparison — that call site's
   normalisation exists only to tolerate an absent `pageId`. **Keep the `absentToNull_` helper itself:** it has
   7 call sites, including nullable `taskNotes` (`:51`) and the genuinely-nullable artefact `pageId`,
   `documentId` and `content` (`:148-152`), so removing it would be wrong.
5. Docs — correct `docs/developer/data-shapes/assignment-definition.md:505` to record `TaskDefinition.pageId`
   as a required string always populated by both parsers, noting the legacy-`fromJSON` consideration.

**Accepted consequence to note at review:** `fromJSON()` (`:180`) passes `json.pageId` straight through, so a
legacy stored definition persisted without `pageId` will now **throw** at construction rather than silently
defaulting to null. The user is content to fail loudly in that case rather than tolerate it; extraction
always sets the field, so such records are not expected to exist.

**Adjacent risk surfaced, not yet decided:** `String(sheetData.sheetId)` (`SheetsParser.js:251`) is safe from
null but not from garbage — `String(undefined)` yields the literal string `"undefined"`, which would pass
`z.string()`, pass `trimStoredId` (non-blank) and produce a broken `#gid=undefined` Sheets URL. The origin of
`sheetId` was not traced far enough to confirm whether it can be undefined; it should originate from the
Sheets API's numeric `getSheetId()`. Worth confirming while the parser is open, since issue #19 builds Sheets
URLs directly from this value.

### 2. Schema-valid `content: null` crashing the app — boundary relocated

**Original finding (Error-handling, incidental Critical):** `BaseTaskArtifactSchema` permits `content: null`
for IMAGE/SPREADSHEET, but `assembleTaskPreviewData.ts:106-114,138-140` throws `TypeError` on those states
inside an unprotected render; with no error boundary in `src/frontend/src`, React unmounts the root.

**Revised understanding supplied by the user:** null `content`/`contentHash` on a **studentSubmission** is a
legitimate domain state meaning "nothing extractable", which the data-analysis service should surface as
metric `'E'`. Reference and template task artefacts should **never** have null `content`/`contentHash`.

**Consequences:**

- **The shared schema cannot express that invariant.** `BaseTaskArtifactSchema` serves both
  `TaskDefinitionSchema.artifacts.reference` / `.template` (`assignmentAssessment.zod.ts:88-89`, should never
  be null) and `StudentSubmissionItemSchema.artifact` (`:100`, legitimately nullable). Both inherit
  `content: z.string().nullable()` and `contentHash: z.string().nullable()` (`:63`, `:45`) from
  `BaseTaskArtifactFields`. The rule is currently unrepresentable in validation, which is why a runtime throw
  downstream felt necessary.
- **The destination state already exists.** `'E'` is a modelled outcome, not an error condition:
  `dataAnalysis.zod.ts:143` defines `value: z.literal('E')` on the error variant, and
  `averagingAnalyser.metricResolution.ts:77-83` already returns `state: 'error', value: 'E'` when there is no
  usable display evidence. However, the analysers are **entirely assessment-driven** — nothing in
  `src/frontend/src/services/dataAnalysis/analysers/` reads `artifact.content`; `averagingAnalyser.rows.ts`
  and `averagingAnalyser.metricResolution.ts` consume only accumulators built from `assessments`. A null-content
  submission with no assessments therefore lands on `'E'` only **incidentally**, while a null-content
  submission carrying stale assessments would display a computed score over an empty body. Enforcing
  "null content ⇒ `'E'` if empty" needs an explicit input to the analysis stage that does not exist today.
- **The boundary does not belong at the render layer.** The `TypeError`s at `assembleTaskPreviewData.ts:107-109`
  and `:138-140` are misplaced fail-fast, defending against a valid modelled state. The correct behaviour is
  the blocking-state treatment the card already renders (`role="alert"` via
  `TaskMetricPreviewContent.tsx:115`), per the frontend AGENTS rule that degraded data "fails closed by
  default: suppress normal content and show the blocking-state treatment for that owned region".
- **Correction to the original recommendation:** an app-level React error boundary is **not** the fix. An
  error boundary handles unexpected faults; "this student has no extractable submission content" is a
  business state and belongs in business UI (the `'E'` cell plus the error Alert). Adding a boundary here
  would mask the modelling defect by converting a visible `'E'` into a blank page. The missing boundary
  remains a genuine pre-existing resilience gap, but as a separate concern.
- **The boundary belongs in two places:** (a) the **contract/schema boundary** — split the shared artefact
  schema so reference/template nullability is rejected at validation time while submissions retain theirs;
  and (b) the **analysis boundary** — the analysis service deliberately classifies a null/empty-content
  submission as errored so `'E'` is produced by design. With both in place, `coerceArtifactContent` needs no
  throw and the render layer only receives states it can render.

**Decision: Defer ([Issue #322](https://github.com/h-arnold/AssessmentBot/issues/322)).** This is materially larger than a guard fix — a schema split, an
analysis-engine change, render-throw removal and data-shape doc updates — and is unrelated to issue #19. The
render-layer throws are pre-existing, so this PR is neutral on them and does not make the situation worse.

---

## Focus areas

### Repo rule compliance

Full findings inline from the `code-reviewer` agent (focus: root + `src/frontend/AGENTS.md`, SPEC.md
decisions 1–8 and contracts, layout doc, mandated workflow artefacts).

**Agent verdict: FAIL** — "the implementation is disciplined, SPEC-conformant and overwhelmingly clean
(one genuine Critical near-miss), but it fails on recorded truthfulness of the plan artefacts and a
procedure-mandated sign-off artefact that is missing outright."

#### Critical

**C1 — `ACTION_PLAN.md` records a "zero findings" final focused review that never ran as a review, and this
review must be the final focused pass under the approved reduced finish line.**
Evidence:

- `ACTION_PLAN.md:17` — the reduced finish line still mandates "one final focused Code Reviewer pass … and
  one final regression run". The plan's own execution notes (`ACTION_PLAN.md:261` "Final review and
  regression passed; ready for the coherent feature commit/push") claim this pass has already happened
  _before_ the feature commit `cd2c54e` but the review that gate requires is **this** one; the commit and
  push went ahead first (`ACTION_PLAN.md` "Branch `docs/issue-19-task-preview-source-link`", final feature
  commit at `cd2c54e` "feat: open student source documents from task previews"). Root `AGENTS.md` §6
  mandates implementation → **code review → docs → data shapes**, i.e. the reviewer pass precedes the
  feature commit.
- The scratchpad contains many per-phase review files (`section*-review.md`), but no _final_,
  post-Section-4/5 review artefact exists: `ls .opencode/scratchpad` shows `section1-red-review.md`,
  `section1-green-final-review.md`, `section2-green-final-rereview.md`, `section4-red-final-review.md`,
  `issue19-final-focused-review.md`, `section1-green-review.md`, `section2-red-review.md`,
  `section3-red-review.md` etc., and `section4-lint-check.log`/`section4-red-final-validation.log` — but the
  plan's final `section5`/"Section 5 regression results, final review" bullet (`ACTION_PLAN.md:295`) ends
  mid-sentence with no review record.
  Severity: **Critical, process**. The plan document asserts a clean review that the artefacts do not
  evidence, and the feature commit has already landed.

**C2 — `ACTION_PLAN.md` `Section 5 regression results, final review, documentation reconciliation:` bullet
remains an empty heading.**
Evidence: `ACTION_PLAN.md:295-296` — the bullet "`- Section 5 regression results, final review,
documentation reconciliation:`" is followed immediately by "`- Deviations and reasons (no unapproved
product/contract changes):`" which itself lists _nothing_ before the "## Execution order" heading. Two
mandated record sections (Section 5 regression results, deviations) are empty headings with zero content,
while a _later_ 2026-10-03 evidence line at `ACTION_PLAN.md:287` ("`npm run regression-checker` comparison …
zero regressions … Frontend unit tests 2443/2443; full E2E has 290 passing final outcomes …") exists but is
attributed to _Section 4_ under a bullet heading that says Section 5. This is a truthfulness defect in a
mandated artefact, not merely a doc nit.

> The above are process/artefact findings but they violate a hard gate of the approved finish line
> (mandatory "final focused review" evidence must be truthful), so they meet the Critical bar. All
> code-level findings below are Improvement or Nitpick severity; the agent "could find no code-side rule
> violation that the automated checks would have missed and that re-running lint/type/tests would not have
> caught."

#### Improvement

**I1 — `TaskPreviewCard.tsx` mixes a decorative-icon constant, a layout-reporting class and a hard-coded
incident-overflow comment in one block; the incident-overflow narrative belongs in the layout document, not
in production source.**
Evidence: `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx:121-159` — the `HEADER_BALANCE_CLASS`
JSDoc cites `e2e-tests/helpers/task-preview-header-regions.ts` for geometry, then the file's
`SOURCE_ICON_STROKE_WIDTH` doc references `docs/developer/frontend/metric-icon-display.md` §4 (line 144), and
meanwhile the actual "narrow-viewport 4px arrow" incident narrative lives in
`TaskMetricPreviewCell.module.css:1-11` and at `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:54-58`. Its _why_ is
duplicated in three places. Root `AGENTS.md` §5.1 asks that detailed policy live in a dedicated doc with
AGENTS files as signposts only. Production JSDoc should point at the layout doc's narrow-viewport section
rather than restate the geometry numbers (`spills 4px past the right viewport edge`, `grows the page's
horizontal scroll width from 390 to 394`) that already live in `TaskMetricPreviewCell.module.css:6-8` and
`TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:58`. Duplicating them in production source invites drift when the layout
doc is updated by a future tuning cycle.

**I2 — `assembleTaskPreviewData.ts` documents `sourceUrl` as "never re-derived here" but the module's JSDoc
contract for `cellData === null` does not state _why_ the null branch's `NOT_ATTEMPTED_METRIC` override still
ships `sourceUrl: null`.**
Evidence: `src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts:8-17` says the metric override is
the "one exception" and that `sourceUrl` is `null`; the `@remarks` block (line 14-17) states it, but the
`TaskPreviewData` interface (`TaskPreviewCard.tsx:49-57`) carries only the `sourceUrl` half of that contract.
`assembleTaskPreviewData.ts:35-45` returns `metric: NOT_ATTEMPTED_METRIC, sourceUrl: null` — the invariant
"null cellData ⇒ null sourceUrl _and_ notAttempted metric" is a single behavioural decision split across two
files, and the data-shape doc (`docs/developer/data-shapes/frontend-data-analysis-response.md`, `TaskPreviewData`
field table rows 6 and 7, lines ~537-557) records them separately. Low-cost fix: cross-reference the invariant
in the `TaskPreviewData` `sourceUrl` `@remarks` at `TaskPreviewCard.tsx:53-56`.

**I3 — `buildCellPreviewLookupTestFixtures.ts` exports `BASE_ARTIFACT_FIELDS` including
`documentId: 'doc-1', pageId: 'pg-1'` while `createAssignment` never enforces that its supplied
`submission.documentId` is consistent with the artefact's.**
Evidence: `src/frontend/src/test/taskHeatmap/buildCellPreviewLookupTestFixtures.ts:22-29`. Nothing is wrong
per se, but the fixture contract silently permits an artefact ID and a parent ID that resolve to the same cell
URL, and no spec in the lookup family pins the "artefact and parent IDs differ → artefact wins unambiguously"
case with a _canonical non-coincidence_ guard. In `buildCellPreviewLookup.indexing.spec.ts:108` the
submission's `documentId: null` makes the case clean, but the positive duplicate-ID coincidence case has no
explicit "parent ID deliberately different and asserted against" like the one
`buildCellPreviewLookup.sourceLink.spec.ts:150-152` carefully builds ("so an artefact-first resolution cannot
coincide with a parent-based URL"). Suggested improvement: document the coincidence hazard on
`BASE_ARTIFACT_FIELDS` and direct authors to `sourceLink.spec.ts`'s non-coincidence pattern.

**I4 — `previewSourceActionTestHelpers.ts` derives `CANONICAL_SOURCE_URL` from the production lookup at module
load, but its JSDoc does not pin which ID wins.**
Evidence: `src/frontend/src/test/taskHeatmap/previewSourceActionTestHelpers.ts:64-93`. The failure message
asserts "the canonical Slides ready cell must derive an editor source URL", but the corpus's canonical record
provides a parent submission document ID (`submission-document-assignment-2-1-100000000020000000000`) that is
_artefact-different_ on the very first item (`artifact-document-…task-0-0`). Verified against the committed
fixture (`tests/__mocks__/data/synthetic-analysis/small/assignmentsByKey.json`): the parent `documentId` is
distinct from every artefact `documentId`, so the canonical helper produces a URL whose _provenance_ (artefact
vs parent) is not pinned by the helper's JSDoc, which claims "derived from the canonical synthetic `small`
record" without naming which ID wins. Duplicates the intent of I3 at a second fixture surface; a one-line
comment naming the winning source (`item.artifact.documentId`, not the parent) would keep the first reader from
having to trace `resolveSourceUrl`.

**I5 — `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md` commits to recording "final values, measurements, screenshot
paths, viewport/theme, review verdict and any tuning rationale in the implementation notes of
`ACTION_PLAN.md`" (line 80), but the plan records none of it.**
Evidence: `ACTION_PLAN.md:289` records 477-line visual spec / helper sizes and acceptance verdicts in prose,
and `:292` records the checker report, but nowhere does the plan record (a) the actual screenshot paths,
(b) the measured 16/24/1.5 geometry values against the tolerances (`SIZE_TOLERANCE_PX = 1`,
`CENTRE_TOLERANCE_PX = 2`, `EDGE_TOLERANCE_PX = 1`,
`src/frontend/e2e-tests/helpers/task-preview-source-link-geometry.ts:58-64`), or (c) the review verdict wording
the layout doc requires. Same family as C2 — a mandated-record gap in a delivery-plan gate.

#### Nitpick

**N1 — `buildCellPreviewLookup.ts:129` uses `?? ` on `trimStoredId(artifactDocumentId) ?? trimStoredId(parentDocumentId)`,
but `trimStoredId` returns `string | null`, so `??` here is a nullish coalesce on a null-coalesced null — fine,
though `??` and `== null` sit three lines apart on 129-130 (`documentId == null ? null : …`) meaning the same
"unusable" test is spelled two ways in consecutive lines.** Evidence:
`src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts:129-130`. Purely stylistic; pick one
(`=== null` on the first, `== null` on the second) for consistency.

**N2 — `TaskMetricPreviewCell.tsx:206` says "The transfer-time active-element check alone forgets the journey"
— the phrase is idiomatic but the surrounding file introduces a precise vocabulary ("intent", "session",
"spend") that this sentence does not reuse, so the same rule is stated twice in slightly different languages
(lines 197-213 vs 203-217).** Evidence:
`src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx:203-217`. Purely editorial; one vocabulary would
shave a few lines of JSDoc without loss.

**N3 — `TaskPreviewCard.tsx:126` — "by no ant Design region class" should be "by no Ant Design region class".**
Evidence: `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx:126` and `:151`, `:157` vs
`TaskMetricPreviewCell.tsx:269` ("Ant Design keeps everything it owned before"), `:274` ("Ant Design's own
overlay handle"). Repo-wide casing is "Ant Design"; `ant Design` at line 126 is an outlier. Cosmetic, zero
behavioural impact.

**N4 — `TaskMetricPreviewCell.tsx` follows the repo's "export functions as functions" convention, but the
near-identical shape of `queueMicrotask`-armed intent plus `pendingSourceFocus` ref could be expressed as a tiny
`useRef`-based helper; raised _not_ as a recommendation to extract (that would be over-abstraction and would
trip the one-caller rule) but to record that the current 43-line intent block
(`TaskMetricPreviewCell.tsx:135-169`) is justified inline and no cleaner decomposition that stays KISS was
found.** No action required; recorded for the de-slop ledger.

**N5 — `previewFixtures.ts:22-23` import raw JSON with a `?raw` suffix; the same convention is used by
`assignmentAssessment.zod.fixtures.ts`. Both are consistent with the repo. No action.**

#### Incidental (triage)

- **Generator reproducibility confirmed.** While reading `scripts/synthetic-test-data/generateClassRosters.js`
  for the ID-length credit, confirmed the branch's 21-digit change does **not** touch
  `STUDENT_ID_SEGMENT_LENGTH` interaction with any other consumer: the generators used for the compact profiles
  all regenerate byte-reproducibly. Recorded as confirmation, not a finding.
- **`assembleMergedPreviewData.ts:148-149`'s throw on a missing `inputById` entry is the kind of fail-fast
  guard the repo wants** — positive incidental evidence that the merge pipeline the feature extends already
  meets the fail-fast bar (no action).
- **Testbed regression patterns referenced in the plan (`Classes CRUD` flake, checker-reporting limitation)
  are unrelated to this diff**; confirmed the review-scope files (`src/frontend/src/**`, `e2e-tests/**`)
  contain no instance of the Classes CRUD retry pattern. Incidental.

#### Compliance confirmation (what was checked and found clean)

- **Root/frontend `AGENTS.md` checklist** — British English (swept all diff-added production/comment lines
  plus targeted `rg --pcre2` sweeps: no `behavior`, `color` (except `color:` code), `favorit`, `organiz`,
  `recogniz`, `analyze`); KISS (no speculative abstractions; the single feature-local `SourceAction`
  sub-component and the `Deep-Freezing`/`fixture` helpers are each multi-caller or justified-inline per
  `frontend-shared-helpers-and-abstraction-standards.md` §9.26, recorded at
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md:223-241`); fail fast (all
  `require*` helpers throw with recorded reasons; no empty catch; no silent swallow — swept repo-wide with
  `rg catch|as any|eslint-disable|@ts-ignore`, only prose hits); no defaults introduced outside constructors
  (the two `= {}` parameter defaults in `previewSourceActionTestHelpers.ts:208` and card/content spec factories
  match the established repo-wide `overrides: Partial<…> = {}` convention on `main`:
  `src/test/taskHeatmapTableTestHelpers.ts:150`, `src/test/dataAnalysis/heatmapFixtures.ts:27`,
  `src/test/heatmapBuilderSurfaceTestHelpers.ts:124`, `src/test/classes/bulkFlowTestHelpers.ts:31` —
  pre-existing, unchanged, not new defaults); minimal, localised changes confirmed by reading every diff hunk.
- **Frontend module checklist** — no `src/backend` imports, no GAS globals, no `console.*`, no v5-patch, no
  CDN assets, no arrow-constant exports, functions exported as `function` declarations everywhere in new code,
  English casing (`Colour`-style spellings confirmed in `task-preview-source-link-helpers.ts:38,316`), no
  oversized file anywhere in scope (largest touched production file 390 lines; largest spec 481, all ≤ 550).
- **`SPEC.md` decisions 1–8 and contracts** — each verified against code, with the evidence trace:
  icon-in-header (`TaskPreviewCard.tsx:283-284`, `LucideIcon` reuse at `:192-197`); SLIDES/SHEETS-only
  (`buildCellPreviewLookup.ts:92-100`); existing-metadata-only with no reference/template substitution
  (tests: `buildCellPreviewLookup.sourceLink.spec.ts:285-322`); native `target="_blank"` +
  `rel="noopener noreferrer"` anchor (`TaskPreviewCard.tsx:187-189`); artefact-then-parent ID preference and
  explicit no-op rules (`buildCellPreviewLookup.ts:129-133`, tests `sourceLink.spec.ts:145-197`);
  format-from-root (`buildCellPreviewLookup.ts:92-99`, tests `:252-277`); merged first-wins content/URL identity
  pinned (`assembleMergedPreviewData.spec.ts:135-180`); centring preserved via balance space
  (`TaskPreviewCard.tsx:286-309`, geometry assertions `task-preview-source-link-geometry.ts:326-392`,
  `SIZE/CENTRE/EDGE_TOLERANCE` 1/2/1 px matching `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:70-78`). Nullable-ID
  alignment exactly as contracted — required, nullable (`assignmentAssessment.zod.ts:42-43`), parent validator
  unchanged (`.nullable().optional()`, `assignmentAssessment.zod.ts:121`), no new wire fields. `SPEC`'s
  Non-goals respected: wizard `buildCanonicalUrl` untouched (confined to
  `features/assignmentWizard/assignmentWizardFormState.ts:40,67-68`), no backend/builder edits on the branch
  (`git log` sweep of `src/backend`/`scripts/builder` vs `main`: empty), no Google Docs/Sheets-range/picker scope.
- **`TASK_PREVIEW_SOURCE_LINK_LAYOUT.md` vs implementation** — Card `extra` slot, 16px/1.5/24px retained,
  aria-label + hover/focus Tooltip + `aria-hidden` decorative icon (`TaskPreviewCard.tsx:183-199`), matching
  inert balance span (`:292-297`), `aria-label`-named action and no focusable fallback (`:119`, `:283`), and the
  ≤390px arrow treatment exactly as authorised (`TaskMetricPreviewCell.module.css:12-15`, scoped
  `.previewPopover :global(.ant-popover-arrow)`).
- **Mandated workflow artefacts** — Sections 1–4 review artefacts exist in `.opencode/scratchpad/`
  (`section1-green-final-review.md` through `issue19-final-focused-review.md` and friends); per-phase
  red/green/regression evidence is recorded exhaustively (`ACTION_PLAN.md:266-292`). The gaps are confined to
  C1/C2/I5 above.

**Finding counts:** Critical 2 · Improvement 5 · Nitpick 5 (N4/N5 no-action) · Incidental 3.

---

### KISS & DRY

Full review in `.opencode/scratchpad/issue19-kiss-dry-review.md`. Run with an explicit instruction to treat
"did this need to be this big/complex?" as the primary question.

**Agent verdict: FAIL** — "the production core is proportionate, but the test-support system contains one
Critical standards violation and several genuine over-engineering layers that must be resolved."

#### Answer to the primary question — "did this need to be this big?"

> The **production delta (≈767 lines)** is not the problem: a ~72-line URL resolver
> (`buildCellPreviewLookup.ts:92-144`), one header action (`TaskPreviewCard.tsx:178-202`), a 16-line CSS
> containment fix, and a keyboard-focus session whose complexity is mandated line-by-line by `SPEC.md:60`. The
> `TaskMetricPreviewContent` split is **not** a premature split of `TaskPreviewCard` — it's the relocation of
> the pre-existing `buildPopoverContent`, planned in `SPEC.md:74-77`, and lands on a real seam.
> **Load-bearing; nothing production-side is removable.**
>
> The mass lives in the test system (≈6,020 lines ≈ 7.8× production) and in ≈5,500 lines of cross-workstream
> corpus regeneration + planning/agent docs riding in a "docs/…" branch. Removable with zero coverage loss:
> **≈400–500 lines + 1 file.**

#### Critical

**C1 — The canonical fixture-selection pipeline is built three times in one PR.**
Evidence:

- `src/frontend/src/test/taskHeatmap/previewFixtures.ts:56-104` — the PR's own _designated_ shared home per
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md:232` and
  `docs/developer/frontend/frontend-testing.md:157`.
- A verbatim `deepFreeze`/`requireRecord`/canonical-trio copy in
  `src/frontend/e2e-tests/helpers/task-preview-source-link-fixtures.ts:156-232`.
- A third copy in **`src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.fixtures.ts:52-78`
  — a shared test helper placed in the production tree, breaching AGENTS §8** (test code in production source).

Impact: ≈80–100 lines + 1 relocation.

#### Improvement

**I1 — `task-preview-source-link-journeys.ts` (123 lines) is a thin wrapper layer with only two spec callers —
and the visual spec bypasses it entirely**, re-composing the same entry steps locally
(`src/frontend/e2e-tests/task-preview-source-link.visual.spec.ts:172-194, 380-391`), which refutes its stated
purpose. Merge into `helpers.ts` (floor ≈470 lines, under the gate). ≈100 lines + 1 file.

**I2 — URL-resolution contract hand-written three times**: production; E2E `deriveEditorSourceUrl`
(`task-preview-source-link-expectations.ts:77-101`); unit `buildExpectedSourceUrl`
(`src/frontend/src/test/taskHeatmap/buildCellPreviewLookupTestFixtures.ts:138-156`). The per-layer independence
is a defensible WET choice (an assertion should not validate the resolver against itself), but the two _test-side_
copies are redundant with each other; also `deriveEditorSourceUrl` is an unused export.

**I3 — Accessible-label format restated 4×**: `src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx:139-146`,
`src/frontend/src/test/taskHeatmap/previewSourceActionTestHelpers.ts:64`,
`src/frontend/e2e-tests/helpers/task-preview-source-link-expectations.ts:248`,
`src/frontend/e2e-tests/task-preview-source-link.visual.spec.ts:313`.

**I4 — `'Open source document…'` / `'Loading task preview'` / error title literals each copied across 3–4 layers
with per-copy "single source of truth" JSDoc** — production already exports `CARD_MAX_WIDTH` for exactly this
purpose (`src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx`).

**I5 / I6 — Single-consumer exports in geometry/regions; the `GeometryStabilityTracker` two-method object +
`HALF_LENGTH_DIVISOR = 2` ceremony ≈35 lines → 15.**

#### Nitpick

`withArtifactBody` duplicating the `withSourceLocationOverride` spine (~20 lines); the 99-line spec testing the
test fixtures (`buildCellPreviewLookupTestFixtures.spec.ts`); duplicated wait helpers; one-caller
`dispatchCancelableKeydown`; the seven-helper selection pyramid in `previewFixtures.ts`; five magic repeat
constants in `task-preview-source-link-scenarios.ts`.

#### Incidental (triage)

- **Inc1 — ≈5,500 lines of cross-workstream corpus churn in the same PR** (the `tests/__mocks__/data/synthetic-analysis/**`
  JSON regeneration).
- **Inc2 — pre-existing `getCellMetric` switch verbosity.**
- **Inc3 — a committed comment citing an ephemeral scratchpad path.**

---

### De-Sloppification

Full findings inline from the `de-sloppification` agent (full slop hunt per its own workflow).

**Agent verdict: Needs Improvement** — "The production feature itself (~900 lines: nullable-ID alignment,
`sourceUrl` derivation, card action, focus session) is proportionate and mostly clean — the user's suspicion of
'massive overcomplication' is wrong about the _product code_ but right about _everything wrapped around it_:
~7,300 lines of new test/support code for a ~900-line feature (an ~8:1 ratio), the same focus-session matrix
pinned scenario-for-scenario at two layers, fixture primitives copy-pasted between the unit and E2E worlds,
unused exports, and comment/JSDoc narration occupying ~50% of the largest new files. 5,384 of the 13,924
insertions are mechanical JSON fixture regeneration and inflate the headline."

#### Critical

**C1 — The keyboard focus/interaction matrix is pinned twice, scenario-for-scenario, at the unit and E2E layers
(≈1,000 redundant lines).**

The unit suites render the _real_ `TaskMetricPreviewCell` → real antd `Popover`/portal → real
`TaskPreviewCard` (via `renderPreviewCell`, `src/frontend/src/test/taskHeatmap/previewSourceActionTestHelpers.ts:207-241`),
so they are not a mocked stand-in that E2E needs to re-prove. Yet the browser layer re-runs the same scenarios 1:1:

| Unit scenario                                                                               | E2E twin                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `TaskMetricPreviewCell.focus.spec.tsx:61-76` (Enter opens + focuses once)                   | `task-preview-source-link.spec.ts:171-184`        |
| `TaskMetricPreviewCell.focus.spec.tsx:78-92` (Space)                                        | `task-preview-source-link.spec.ts:186-204`        |
| `TaskMetricPreviewCell.focus.spec.tsx:158-174` (Escape restores trigger)                    | `task-preview-source-link.spec.ts:206-222`        |
| `TaskMetricPreviewCell.focus.spec.tsx:176-185` (Tab untrapped)                              | `task-preview-source-link.spec.ts:224-242`        |
| `TaskMetricPreviewCell.focusSession.spec.tsx:99-116` (late-ready transfers once)            | `task-preview-source-link.states.spec.ts:142-167` |
| `TaskMetricPreviewCell.focusSession.spec.tsx:138-160` (user left before readiness)          | `task-preview-source-link.states.spec.ts:169-193` |
| `TaskMetricPreviewCell.focusSession.spec.tsx:118-136` (closed before readiness)             | `task-preview-source-link.states.spec.ts:195-214` |
| `TaskMetricPreviewCell.focusSession.spec.tsx:187-201` (failed preview keeps focus + Escape) | `task-preview-source-link.states.spec.ts:222-248` |
| `TaskMetricPreviewCell.focusSession.spec.tsx:203-214` (no-source keeps focus)               | `task-preview-source-link.states.spec.ts:250-282` |
| `TaskMetricPreviewContent.spec.tsx:155-168` (no action while loading/failed)                | `task-preview-source-link.states.spec.ts:87-107`  |

That is ≈10 duplicated scenario pairs (≈950 lines across `focus.spec.tsx` + `focusSession.spec.tsx` +
`states.spec.ts`). Both suites even share the same fixture lineage (canonical `small` records).

**Why it matters:** every contract tweak now costs two synchronized edits in two paradigms, and the
"red-first provenance" narrated in both files shows the duplication was planned, not accidental.

**Fix:** keep the genuinely browser-only cases at E2E (real portal Escape, real tooltip, real new-tab
navigation — `task-preview-source-link.spec.ts:121-133`) and the DOM-level contract at unit level; delete the
mirrored twins rather than maintaining both. **If the team insists on belt-and-braces for a11y-critical focus
behaviour, that policy should be recorded as a deliberate exception, not grown silently.**

**C2 — Dead exports in `task-preview-source-link-geometry.ts`.**
`SOURCE_ICON_SIDE_PX`, `SOURCE_ACTION_SIDE_PX` (`:51-55`), `SIZE_TOLERANCE_PX`, `CENTRE_TOLERANCE_PX`,
`EDGE_TOLERANCE_PX`, `REQUIRED_STABLE_READS` (`:58-67`) are all `export`ed but referenced nowhere outside the
module (grep over `src/frontend` returns zero external uses; the visual spec imports only
`assertReadyPreviewGeometry`/`readClosedPageOverflowWidth`/`rebaselineClosedPageOverflow` at
`task-preview-source-link.visual.spec.ts:80-84`, the interaction spec only `measureStablePreviewHeader` at
`:70`). Confirmed dead API surface. **Fix:** un-export; keep them module-private.

**C3 — `deepFreeze` / `requireRecord` / `requireTextArtifactContent` copy-pasted between the unit fixture module
and the E2E fixture module — and the duplication is unforced.**

- `deepFreeze`: `src/frontend/src/test/taskHeatmap/previewFixtures.ts:56-64` ≡ `src/frontend/e2e-tests/helpers/task-preview-source-link-fixtures.ts:156-164` (identical bodies, near-identical JSDoc).
- `requireRecord`: `previewFixtures.ts:74-82` ≡ `task-preview-source-link-fixtures.ts:174-182` (identical except error-string prefix).
- `requireTextArtifactContent`: `previewFixtures.ts:225-232` ≡ `task-preview-source-link-expectations.ts:183-190`.

The shared-helpers doc records a _deliberate_ `deepFreeze` duplication — but between `previewFixtures.ts` and
`assignmentAssessment.zod.fixtures.ts`, justified by the lint boundary blocking `**/test/**` imports from
non-spec `src/**` (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.26 entry 5;
`src/frontend/eslint.config.js:84-99`). **That rationale does _not_ cover the E2E pair:** `e2e-tests/**` is
outside the `src/**` lint scope and already imports from `src/services` and `src/pages`
(`task-preview-source-link-fixtures.ts:27-39`, `task-preview-source-link-helpers.ts:18-19`), so it could import
shared primitives. Only the _record loading_ genuinely differs (Vite `?raw` vs direct JSON import — a real
constraint, documented at `task-preview-source-link-fixtures.ts:7-9`); the ≈40 duplicated generic lines do not.
**Fix:** one shared selection/freeze util for the E2E side (e.g. under `e2e-tests/shared/`), or reuse
`src/test` helpers directly; update §9.26 accordingly.

#### Improvement

**I1 — Process-narration comments are ≈50% of the biggest new files and are already rotting.**
Measured comment-ish line share: `TaskMetricPreviewCell.tsx` 155/309, `task-preview-source-link-geometry.ts`
207/454, `task-preview-source-link-fixtures.ts` 202/468, `task-preview-source-link.visual.spec.ts` 187/481. Much
of it narrates the _development timeline_ ("red-first provenance", "Section 4 was authored before Section 3
delivered…") in at least six files (`TaskMetricPreviewCell.focus.spec.tsx:14-23`,
`focusSession.spec.tsx:14-27`, `TaskPreviewCard.sourceLink.spec.tsx:12-17`,
`task-preview-source-link.spec.ts:25-30`, `.states.spec.ts:34-40`, `.visual.spec.ts:26-33`).
**Worse, three of these now state falsehoods: "final review and regression remain pending"**
(`task-preview-source-link.visual.spec.ts:32`, `task-preview-source-link.spec.ts:30`,
`.states.spec.ts:38-40`) **while `ACTION_PLAN.md:299-300` and §9.26 record the review as complete and accepted.**
The same `flushSync`/`queueMicrotask` rationale is told three times (`TaskMetricPreviewCell.tsx:50-58`, §9.26
entry 3, `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:57`). **Fix:** strip provenance narration; keep one behavioural
contract statement per module; reconcile the three stale "pending" claims.

**I2 — Synthetic-corpus meta-tests are disproportionate to their trigger.**
`tests/synthetic-analysis/syntheticAssignmentTimestamps.test.ts` (483 lines) +
`tests/synthetic-analysis/syntheticStudentIdentifiers.test.ts` (378 lines) = 861 lines of machinery to pin
"`updatedAt = createdAt + 3 min`" and "21-digit student IDs" in fixture JSON — needed only so `class-2` survives
the class page's fail-closed adapter and roster selection stays deterministic (`SPEC.md:76-78`;
`ACTION_PLAN.md:284`). Both files re-run the full generator per profile. A fraction of this (one parametrised
suite over committed views + one generator determinism probe) would pin the same convention. Not blocking — the
corpus conventions are now canonical doc — but it is the clearest example of the test layer growing a freight
elevator where a staircase would do.

**I3 — Visual spec still implements the exhaustive matrix the approved reduced finish line waived.**
`ACTION_PLAN.md:15` removes "exhaustive visual-matrix/repeat requirements"; `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:64,68`
replaces the matrix with one representative inspection. The delivered
`task-preview-source-link.visual.spec.ts` nevertheless runs the full 2 viewports × 2 schemes × 2 entry points
geometry matrix (`:125-128, :246-272`) plus label/state (`:306-364`) and body (`:370-408`) matrices — 15 tests
re-asserting the same ≈30 invariants. Defensible as insurance, but it contradicts the agreed scope the same PR
records; either re-authorise the matrix in the layout doc or acknowledge it as surplus.

**I4 — Shared user-facing copy restated three more times.**
`LOADING_PREVIEW_LABEL` / `PREVIEW_ERROR_TEXT` exist in `task-preview-source-link.states.spec.ts:77-80` and again
verbatim in `TaskMetricPreviewCell.focusSession.spec.tsx:59-62` (production source:
`src/frontend/src/features/taskHeatmap/TaskMetricPreviewContent.tsx:92,115`). The focusSession suite already
imports from `previewSourceActionTestHelpers.ts` — host the two constants there once. Similarly
`SOURCE_ACTION_LABEL` is tripled: production `TaskPreviewCard.tsx:119`, unit
`previewSourceActionTestHelpers.ts:53`, E2E `task-preview-source-link-fixtures.ts:132` — oracle copies are a
defensible policy (§9.26 entry 6 justifies it for URLs), but then the naming should match; see N2.

**I5 — FIFO queue "generous sizing" magic numbers.**
`task-preview-source-link-scenarios.ts:37-50` pads queues with trial-and-error repeats (4, 10, 14, 8, 2, 2). The
comments admit it ("sized generously", "Extra entries are never consumed"). This is brittle scaffolding
inherited from the FIFO runtime mock; at minimum record the observed per-page call counts next to each number,
or add a tail sentinel so under-sizing fails with a named message rather than a stray envelope mismatch.

**I6 — Locator duplication in the visual spec.**
`taskMetricCellLabels` rebuilds the `[role="button"][aria-label^="…"]` locator inline
(`task-preview-source-link.visual.spec.ts:286`) that `taskMetricCells` already exports
(`task-preview-source-link-journeys.ts:118-122`). Reuse it.

#### Nitpick

- **N1 — Named constants for self-evident literals** — generated-code tells: `HALF_LENGTH_DIVISOR = 2` with a
  three-line JSDoc (`task-preview-source-link-geometry.ts:72-76`), `TWO_SESSION_FOCUS_TRANSFERS = 2`
  (`TaskMetricPreviewCell.focusSession.spec.tsx:64-68`), `LAST_ROSTER_OFFSET = -1`
  (`src/frontend/src/test/taskHeatmap/previewFixtures.ts:45-46`), `ACCESSIBLE_LABEL_SCORE_SEPARATOR = ': '`
  (`task-preview-source-link.visual.spec.ts:146`). `2` and `-1` are clearer inline.
- **N2 — Same string, two constant names.** `SOURCE_ACTION_LABEL` (unit) vs `SOURCE_DOCUMENT_ACTION_LABEL` (E2E)
  for the identical accessible name invites conflation in cross-layer greps; pick one name.
- **N3 — Production test-hook class.** `HEADER_BALANCE_CLASS = 'task-preview-header-balance'` exists in the DOM
  solely so E2E can find the inert balance span (`TaskPreviewCard.tsx:121-132`,
  `task-preview-header-regions.ts:46`), and the string is stated twice. It skirts `AGENTS.md` principle 8 ("do
  not add production code purely to satisfy tests"); a `data-testid`-style convention or matching on
  `span[aria-hidden]` inside the title would keep production markup cleaner. Given the span is genuinely needed
  for centring, low stakes.
- **N4 — `SourceActionElement` union over-generality.** The action always carries `href`, so it is always an
  anchor (`TaskPreviewCard.tsx:60-69` admits this); the `HTMLButtonElement` arm exists only to satisfy antd's
  ref type without a cast. Harmless, but the five-line JSDoc defending it is more ceremony than the union saves.
- **N5 — Double cast.** `CANONICAL_DEFINITION_PARTIALS` casts
  `definitionPartials as unknown as ReadonlyArray<Record<string, unknown>>`
  (`task-preview-source-link-fixtures.ts:276-277`); the source type (a type alias, not an interface) is already
  assignable to `Record<string, unknown>` without the detour.
- **N6 — Import-time throw guard.** `task-preview-source-link-fixtures.ts:113-119` throws at module import if
  the corpus ever ships `assignment-2-3`. Fail-fast is the right instinct, but an import-time crash is a poor UX
  for a corpus drift; a guard inside scenario construction would fail the same tests with better locality.

#### Incidental (triage)

- **X1 — Scope hygiene: unrelated workflow/agent changes ride on the feature branch.** The branch carries ≈700
  lines unrelated to issue #19: `.opencode/agents/*.md` rewrites (incl. 179 lines in `playwright.md`), new
  plugin `.opencode/plugins/no-task-resume.ts` (58 lines), `.opencode/skills/pre-pr-review/SKILL.md`,
  `AGENTS.md`, `docs/developer/ACTION_PLAN_TEMPLATE.md`, `.github/agents/code-reviewer.agent.md` (commits
  `e328a1a`, `1ec3f6c`, `78db79f`, `acbca15`). Note the internal contradiction: `ACTION_PLAN.md:287,300` twice
  states the agent-configuration edits are "excluded from commits", yet HEAD commit `acbca15` commits exactly
  those files. Either the plan text or the branch contents are wrong; worth reconciling before PR.
- **X2 — Pre-existing named-constant ceremony** in `src/frontend/src/test/taskHeatmapTableTestHelpers.ts:33-42`
  (`METRIC_COLUMNS_PER_TASK = 3`, `TASK_GROUP_COUNT = 2`, `RANGE_SLIDER_HANDLE_COUNT = 2`) — same pattern as N1,
  untouched by this diff (only 5 lines added there). Listed because the new files repeat it.
- **X3 — `DeferredPopoverContent.tsx`** (17 lines) is a one-caller indirection retained from the
  pre-extraction design; now that `TaskMetricPreviewCell` owns the overlay boundary it could be inlined, but it
  predates this branch and is documented — no action needed in this PR.
- **Not slop, for calibration:** the 5,384-line JSON fixture diff is byte-reproducible generator output
  (ID/timestamp realism), verified by `syntheticGraphShapeCoverage.test.ts` and recorded in
  `docs/developer/testing/synthetic-test-data.md`; and the triple implementation of the URL-derivation contract
  (production `resolveSourceUrl`, unit oracle `buildExpectedSourceUrl`, E2E oracle `deriveEditorSourceUrl`) is
  the documented, correct test-oracle policy (§9.26 entry 6) — an assertion should not validate the resolver
  against itself.

#### Agent's completion notes

- **Confirmed slop blocking a clean bill:** C1 (duplicated focus matrix), C2 (dead exports), C3 (copy-pasted
  fixture primitives), plus the stale "pending review" claims in I1. All are confined to the test/docs layer;
  production code has no blocking findings.
- **Cleanup performed:** none — review-only task; no files modified (worktree untouched, `git status` clean).
- **Not verified:** runtime behaviour of the E2E journeys (no browser run);
  `buildCellPreviewLookup.content.spec.ts` / `buildCellPreviewLookup.spec.ts` read only in part
  (pattern-consistent with the reviewed siblings); the regenerated JSON bodies were sampled, not exhaustively
  diffed; the large-full profile was not examined (documented as stress-run-only).

---

### Performance (Big-O)

Full review in `.opencode/scratchpad/review-perf-task-preview-source-link.md`.

**Agent verdict: FAIL** — "no Critical issues and no asymptotic (Big-O-class) regressions introduced by this
diff, but one in-diff Improvement and one in-diff Nitpick remain outstanding."

#### Routine ledger (evidence-backed)

| Routine                                                                                                                                                                | Frequency                                                                                                                                          | Cost                                                                                                                                      | Verdict                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildCellPreviewLookup` (`buildCellPreviewLookup.ts:212-252`)                                                                                                         | Embedded: memoised on `assignmentQuery.data` (`TaskHeatmapPage.tsx:183-186`); merged: inside assembly `useMemo` (`useHeatmapsPageData.ts:376-395`) | O(A·P·T) single pass                                                                                                                      | **Not on the render path** — the "runs on every heatmap render" fear is unfounded; TanStack v5.90.21 `combine` applies `replaceEqualDeep` (verified in query-core `queriesObserver.js`), so deep-equal refetch noise reuses the old reference |
| `resolveSourceUrl` (`buildCellPreviewLookup.ts:123-144`)                                                                                                               | Once per distinct (student, taskKey) inside the first-wins guard (`:229-235`)                                                                      | O(1); ≤2 trims (short-circuited at `:129`), ≤2 encodes                                                                                    | Cold, trivial                                                                                                                                                                                                                                 |
| `buildTaskMetricSubColumns` (`taskHeatmapTableColumns.tsx:253-323`)                                                                                                    | Inside table `columns` `useMemo` (`TaskHeatmapTable.tsx:127-182`, deps `:174-182`)                                                                 | O(3T) defs + closures per rebuild                                                                                                         | Pre-existing shape; diff swaps inline Popover tree for `<TaskMetricPreviewCell>` — same element order, no worsening                                                                                                                           |
| Per-cell `render` + `TaskMetricPreviewCell`                                                                                                                            | Per cell per row render                                                                                                                            | O(1): two `Map.get` (`taskHeatmapTableColumns.tsx:304`), all five `useCallback` chains stable (`TaskMetricPreviewCell.tsx:139-261`)       | Bounded constant; not flagged                                                                                                                                                                                                                 |
| Focus session (`TaskMetricPreviewCell.tsx`)                                                                                                                            | Per interaction                                                                                                                                    | `document.activeElement`/`Node.contains`/single `focus()` (`:147,150,194,215`) — **no geometry reads**, no rAF/timer loops; ≤2 microtasks | No layout thrash                                                                                                                                                                                                                              |
| Zod `pageId`/`documentId` → `.nullable()` (`assignmentAssessment.zod.ts:42-43`)                                                                                        | Per artefact at transport parse                                                                                                                    | O(1) short-circuit, key presence still required                                                                                           | **No validation widening**                                                                                                                                                                                                                    |
| `assembleTaskPreviewData` → `spreadsheetToMarkdownTable` (`TaskMetricPreviewContent.tsx:119`; `assembleTaskPreviewData.ts:113`; `spreadsheetToMarkdownTable.ts:52-63`) | Per popover body mount **and every body re-render**                                                                                                | O(1) text / **O(R×K)** spreadsheet                                                                                                        | See Improvement 1                                                                                                                                                                                                                             |

#### Improvement

**I1 — `TaskMetricPreviewContent.tsx:118-120` — while a popover is open, every re-render of the body re-runs
`assembleTaskPreviewData` from scratch;** for SPREADSHEET artefacts that re-executes the O(R×K) markdown
conversion per re-render (sort/filter/sibling-cell changes re-render the open body). The "expensive is deferred"
remark (`:10-15, :72-74`) only holds for the first open. Three-line `useMemo` fix. Severity low (cold-ish path;
corpus artefacts are TEXT-only today per `scripts/synthetic-test-data/generateSubmissions.js:88`), but it is the
only place this feature's per-render cost grows with artefact size.

#### Nitpick

`buildCellPreviewLookup.ts:129` — parent `documentId` re-trim/re-encode per item; a per-submission base-URL memo
would save S-1 constant calls in an already one-off memoised O(A·P·T) pass. Also: the requested "per-document map"
hoist was **considered and rejected** — distinct-ID density is one ID per artefact
(`scripts/synthetic-test-data/generateSubmissions.js:83`), so a cache would save only the parent-fallback fraction
while adding invalidation surface to a single-pass build; net-negative complexity at observed scale.

#### Incidental (triage)

- `src/frontend/src/hooks/useHeatmapsPageData.ts:202-214, 376-395` — merged path rebuilds all per-assignment
  lookups on any query-status transition (pending→success, isFetching flips); steady-state renders are covered
  by structural sharing, but each fetch-state transition re-runs O(A·P·T) builds. Pre-existing, file untouched
  by this branch; this diff only adds a per-item constant.
- `src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx:292-306` — `onCell` and `render` both
  compute `formatMetricDisplayText` + the accessible label per cell per render (duplication visible at
  `:294-300` vs `:303-306`); pre-dates the branch, not worsened, trivially fixable later.
- No per-frame `getBoundingClientRect` in loops anywhere in shipped feature code — geometry helpers exist only
  under `src/frontend/e2e-tests/helpers/task-preview-*.ts` (test-only).

---

### Logging rules compliance

Full review in `.opencode/scratchpad/review-issue19-logging-error-handling.md`.

**Agent verdict: PASS** — "logging- and error-handling-policy compliance of the
`docs/issue-19-task-preview-source-link` diff is clean. No Critical, Improvement, or Nitpick findings on the
changed hunks themselves."

Key outcomes on the exact points asked:

1. **No `console.*`** — zero matches across all 43 changed frontend files (source, spec, e2e); frontend lint
   (0 errors) independently enforces the logger-module boundary.
2. **Log boundaries** — no logging was added anywhere in the diff; the per-cell/per-render paths
   (`buildTaskMetricSubColumns` render at `taskHeatmapTableColumns.tsx:302-320`, the per-item lookup at
   `buildCellPreviewLookup.ts:223-249`) are properly log-free, and logging stays at the hook/boundary layer.
3. **No double-logging** — nothing new to double-log; existing `useLogOnce` / `logPipelineError` dedupe
   boundaries untouched.
4. **No swallowing** — zero `catch` blocks introduced; all surfacing continues through the existing hook
   boundaries.
5. **Silent `null` fallback judgement — correct, and no logging is needed:** `resolveSourceUrl`
   (`buildCellPreviewLookup.ts:123-144`) returns `null` only for contract-valid states the schema itself admits
   (`assignmentAssessment.zod.ts:42-43, 121, 178`) and `SPEC.md:18` explicitly decided ("no link, not a disabled
   icon or blocking error"). Genuinely unexpected failures are _not_ conflated into it — the invariant throw
   (`buildCellPreviewLookup.ts:214-217`) and transport schema failures still fail fast/loudly.

#### Incidental (triage)

- (Improvement) No app-level error boundary exists anywhere, so render-path fail-fast throws on the embedded
  surface (`src/frontend/src/pages/TaskHeatmapPage.tsx:183-186`) would blank the app unlogged — contrast the
  merged path, which catches, logs, and surfaces (`useHeatmapsPageData.ts:376-395`).
- (Improvement) The standalone assembly-error log (`useHeatmapsPageData.ts:392`) lacks the
  memo-recomputation dedupe the pipeline boundary deliberately applies
  (`src/frontend/src/services/heatmapsPipeline.ts:88-108`).
- (Nitpick) The throw message at `buildCellPreviewLookup.ts:215-217` slightly misdescribes one branch of its own
  guard.

---

### Frontend layout / design / accessibility

Full review in `.opencode/scratchpad/review-issue19-task-preview-layout-a11y.md`.

**Agent verdict: FAIL** — "the layout/spacing/motion and keyboard focus-session work is well executed and
evidence-backed, but 2 Improvements and 2 Nitpicks remain (no Critical findings)."

**Critical:** none.

#### Improvement

**I1 (A11y) — the metric-cell trigger exposes no popover state — no `aria-expanded` / `aria-haspopup`
(`src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx:296-304`), despite the module already owning
`isPreviewOpen` (`:128`, `:268`), so the wiring is a one-attribute change** (gap carried over from the
pre-extraction trigger, but this new module owns the state now).

**I2 (Hover intent) — no `mouseEnterDelay`/`mouseLeaveDelay` is configured
(`src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx:264-270`); the antd 0.1s default is provably
too short during the `zoom-big` entrance** — the suite itself records the close-before-tooltip hazard it works
around (`src/frontend/e2e-tests/task-preview-source-link.spec.ts:108-112`), while the layout doc fixes usable
pointer traversal (`TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:56`).

> **Decision: Wontfix — finding overstated.** Reproduced verbatim above, but it does not survive inspection.
> The cited comment describes an animation/pointer _race_ (the `zoom-big` transform moves the action under
> the cursor mid-transition), which a longer grace period cannot fix, and the delivered remedy
> (`measureStablePreviewHeader`) is what `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:57` explicitly mandates over
> timing compensation. The pointer-traversal requirement is already asserted and passing. Full reasoning in
> "Decisions → Frontend layout / design / accessibility".

#### Nitpick

- **N1 — trigger relies on the UA default focus ring instead of the themed `:focus-visible` convention used for
  the sibling heatmap keyboard target** (`src/frontend/src/index.css:187-189`).
- **N2 — stale characterisation docstring** — "Enter/Space click synthesis"
  (`src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.spec.tsx:8`) no longer describes the delivered
  handler (`TaskMetricPreviewCell.tsx:230-243`).

#### Checks verified compliant

8px-grid compliance of all new spacing/size values; width ownership unchanged (`CARD_MAX_WIDTH` exported from the
card, imported — not duplicated — by the content module); `<output>`/`aria-busy` loading semantics per §8.1 and
`role="alert"` error state; source action a sibling outside the metric's `role="status"` live region; Esc close +
focus restore verified through library source (`@rc-component/portal` → `@rc-component/trigger` → `onOpenChange`);
no focus trap; native anchor with `_blank`/`noopener noreferrer`, `aria-hidden` icon, hover/focus Tooltip; 24×24
target size; geometry, containment and no-new-overflow invariants; no new motion or hard-coded theme tokens;
automated checks confirmed from the recorded regression-gate outputs (lint 0 errors, 2443 unit tests passed, E2E
43/43) — nothing re-run, per constraints.

#### Incidental (triage)

Skeleton fixed-400px vs content-shrunk ready card width; duplicate `<td>`/trigger `aria-label`; metric centring
coupled to antd's 12px `headerPaddingSM` (guarded by E2E invariants); unnecessary grid-exemption comment on
`CARD_BODY_MAX_HEIGHT`; documented hover-out closing of a keyboard-opened preview; and the deliberate cross-layer
duplication of the accessible-name/balance-class literals.

---

### Frontend data shape / schema consistency

Full findings inline from the `code-reviewer` agent.

**Agent verdict: PASS** — "the in-scope diff is internally consistent with the two data-shape documents and
contains no defects of any severity."

**Critical:** none found in scope. **Improvement:** none found in scope.

#### In-scope verification (each requested check, with evidence)

**1. Zod change — required nullable, correct derived type, rejections intact.**
`src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts:42-43` — `pageId: z.string().nullable()`
and `documentId: z.string().nullable()` on the shared `BaseTaskArtifactFields` object: required keys (no
`.optional()`), nullable values; an absent key is still invalid, as is a non-string value (comment at
`:38-43` states this contract explicitly). Derived typing is still schema-derived: `BaseTaskArtifactSchema` is a
`z.discriminatedUnion` whose every member `.extend()`s the base fields (`:60-73`), so `z.infer` yields
`pageId: string | null` and `documentId: string | null` as required (non-optional) fields on all five variants.
Numeric/object IDs and absent keys remain rejected per the boundary tests:
`assignmentAssessment.artifacts.zod.spec.ts:162-190` (missing `pageId`/`documentId` rejected), `:192-196`
(numeric `pageId: 42` rejected), `:198-205` (object `documentId` rejected), and `:129-160` (null IDs accepted
across all five types, plus a whole-payload all-nulls parse). Matches the doc record at
`docs/developer/data-shapes/assignment.md:328-344` and the spec contract at `SPEC.md:35`.

**2. `.nullable().optional()` vs `.nullable()` — internally consistent and intentional.**
Artefact IDs are required-nullable because the backend `BaseTaskArtifact` always emits both
(`docs/developer/data-shapes/assignment-definition.md:544-545`; restated in `assignment.md:328-338`). The parent
submission `documentId` stays `.nullable().optional()` (`assignmentAssessment.zod.ts:115-125`, comment at
`:119-121`), tolerating key absence for never-opened submissions — documented as Known discrepancy 3
(`assignment.md:404-406`) and now covering the full schema too (`assignment.md:191`, `:215`). No drift: the
parent validator was deliberately left unchanged (`assignment.md:325,339-341`).

**3. `sourceUrl` — correctly typed, required, single origin, carried, never transported.**

- `readonly sourceUrl: string | null` required in every member of the mapped union:
  `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts:39-52` (field at `:50`), matching the doc
  snippet verbatim (`docs/developer/data-shapes/frontend-data-analysis-response.md:459-467`).
- Required (not optional) on `TaskPreviewData`: `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx:41-58`
  (field at `:57`), matching `frontend-data-analysis-response.md:488-497`.
- Derived only in the lookup: `resolveSourceUrl` and its helpers are module-private
  (`buildCellPreviewLookup.ts:73-144`); a repo grep found no other production importer of them.
- Carried unchanged by assembly: `assembleTaskPreviewData.ts:43` (`sourceUrl: null`) and `:58`
  (`sourceUrl: cellData.sourceUrl`), with the "never re-derived here" remark at `:13-17`.
- Carried unchanged by merge: `assembleMergedPreviewData.ts:67-71` merges whole `CellPreviewData` objects
  first-wins; the first-wins URL pinning tests confirm content and URL come from the same winning item,
  including a null-URL winner (`assembleMergedPreviewData.spec.ts:135-186`), matching the doc claim
  (`frontend-data-analysis-response.md:499-507,613-615`).
- Never persisted / never in an API response: greps found `sourceUrl` in no frontend service, no API payload
  construction, and zero occurrences in any committed synthetic fixture; the identity-projection mapper makes
  response leakage structurally impossible for re-serialised payloads validated under the derived
  `AssignmentFull` (comment `assignmentAssessment.zod.ts:164-168`). Explicitly distinguished from the unrelated
  image-export `artifact.metadata.sourceUrl` (`frontend-data-analysis-response.md:509-522`; the lookup never
  reads `artifact.metadata` — only a comment references it at `buildCellPreviewLookup.ts:114`, with the
  negative test at `buildCellPreviewLookup.sourceLink.spec.ts:298-302`). The E2E helpers likewise never inject
  a derived `sourceUrl` into a mocked payload
  (`src/frontend/e2e-tests/helpers/task-preview-source-link-expectations.ts:14,26-27`).

**4. Committed JSON fixtures and fixture builders.**
Statically inspected all three committed profiles
(`tests/__mocks__/data/synthetic-analysis/{small,medium,large-representative}/assignmentsByKey.json`): every
submission artifact (48 / 256 / 112) and every definition artifact (36 / 80 / 64) carries both required keys, all
as strings, no nulls, no missing keys — valid under the tightened schema. Parent-side realism is present:
`documentId: null` submissions exist (3 / 16 / 8 records), including student `…002` in the canonical
`assignment-2-1` whose artifact document ID is non-null (small profile), exercising the parent-fallback branch;
class-embedded partial artifacts in `classesById.json` all carry both keys (valid under the unchanged partial
schema). The generator already emitted both keys as `string | null`
(`scripts/synthetic-test-data/generateSubmissions.js:82-83`), and the generator was not changed for artifact IDs.
Fixture builders are sound: `validFullAssignment` is now parsed through `AssignmentFullSchema` at module init
(`assignmentAssessment.zod.fixtures.ts:23-29,75-77`), so fixture validity is enforced rather than assumed;
`previewFixtures.ts` derives cells via the production lookup (`:25-30,329-338`);
`buildCellPreviewLookupTestFixtures.ts:22-29` supplies both IDs (valid, required keys present), its spec
exercises a null parent ID (`buildCellPreviewLookupTestFixtures.spec.ts:35`), and its expected-URL helper is
honestly typed `string | null` and fails loudly on unusable IDs (`buildCellPreviewLookupTestFixtures.ts:100-156`).

**5. Doc/code drift — none found in scope.**
`assignment.md:325` and `frontend-data-analysis-response.md:437-443,459-507,666-670` match code exactly,
including the corrected full-submission table row (`assignment.md:191`, `:215`) and the unchanged parent
(`:339-343`) and partial (`:342-344`) statements. The `assignment-definition.md` backend-side table (`:544-545`)
still supports the required-nullable choice.

**6. Definitely-string reads after the change — none unsound.**
A full grep of non-test frontend source found the only artifact-ID reads in production code at
`buildCellPreviewLookup.ts:232-234`, all correctly null-typed: `resolveSourceUrl` declares `string | null` for
artefact IDs (`:124-128`), `string | null | undefined` for the parent (`:127` — sound because the parent is
`.nullable().optional()`, inferred `string | null | undefined`), and the queriedID result is re-tested before
the fragment (`:130,136`). The one other derived-URL reader, the E2E expectation helper, guards both IDs with
its own `trimStoredId` (`task-preview-source-link-expectations.ts:62-92`). No unsound non-null assumptions or
missing null handling.

#### Nitpick

**Nitpick (documentation) — `docs/developer/data-shapes/assignment.md:342-344` records that
`BaseTaskArtifactPartialSchema` (`src/frontend/src/services/classDetail/classDetail.zod.ts:66-67`) remains
`.nullable().optional()` while the full schema is required-nullable, but no entry in that document's
Known-discrepancies list (`assignment.md:394-438`) states _why_ the partial artefact schema tolerates key
omission when backend `toPartialJSON()` always emits both IDs.** Recording the reason (partial trust boundary /
defensive tolerance, as done for the parent at `:404-406`) would prevent a future reader from "fixing" the
asymmetry in either direction.

#### Incidental (triage)

1. **Required non-nullable `pageId` on the embedded definition task contradicts the backend contract.**
   `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts:82` —
   `TaskDefinitionSchema.pageId: z.string()` (required, non-nullable). The same backend `TaskDefinition.toJSON()`
   emits `pageId` as `string | null` and the constructor defaults it to `null`
   (`src/backend/Models/TaskDefinition.js:26,146`), and
   `docs/developer/data-shapes/assignment-definition.md:505` records the task `pageId` as `string | null`
   "Omitted from both frontend schemas" — yet this assignment-embedded frontend schema _does_ include it,
   stricter than the backend. Any future task with a null `pageId` would fail `AssignmentFullSchema`. This
   predates the diff (confirmed unchanged on `main`) and is adjacent to the issue-19 nullable-ID alignment work;
   it deserves its own reconciliation pass.
2. `createCellPreviewData` closes with a cast `} as CellPreviewData;` (`buildCellPreviewLookup.ts:172`) because
   the generic mapped-union cannot verify the `unknown` `artifactContent` narrowing. The input is derived from
   schema-validated payloads where content shape is bound to `type` by the discriminated union, so the cast is
   sound; a per-type construction signature could remove it. Unchanged by this diff (verified against `main`'s
   blob of the same section).
3. The E2E expectation helper re-implements `trimStoredId` and URL derivation independently
   (`task-preview-source-link-expectations.ts:62-92`) rather than importing production code. The header comment
   records the rationale (`:11-14`): the assertion pins the rendered link against an independent re-derivation,
   so duplication is deliberate verification design, not a DRY violation.
4. The committed `classesById.json` partial payloads still contain `content`/`contentHash` keys (e.g. small
   profile, all 66 embedded artifacts carry them). Unchanged `main` behaviour in the class-partial view (not the
   component-preview view), so out of scope here but worth including in any future partial-view reconciliation.

---

### Security & secrets

Full review in `.opencode/scratchpad/security-secrets-review-issue19.md`.

**Agent verdict: PASS** — "no security or secrets findings of any severity in this focus area."

**Critical:** none. **Improvement:** none. **Nitpick:** none.

Explicit checks, each with evidence:

- **URL construction** — Host is a fixed literal `https://docs.google.com` and paths are fixed per format branch
  (`src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts:94,97`); `documentType` is only ever compared
  against the `'SLIDES'`/`'SHEETS'` literals (`:93,96,141`) so no attacker-controlled host/scheme/path is
  possible. `resolveSourceUrl` reads only `documentType`, `item.artifact.documentId`, `item.artifact.pageId`,
  and `submission.documentId` (`:230-234`) — `metadata.sourceUrl` is never consulted, and a dedicated negative
  test pins non-substitution of the image-export URL while `ImageRenderer` fails closed on anything not starting
  `data:image` (`src/frontend/src/components/ImageRenderer.tsx:37-39`). The only `href` in the entire diff is the
  derived `sourceUrl` (`TaskPreviewCard.tsx:187`).
- **Encoding/trimming** — both IDs trimmed via `trimStoredId` (`buildCellPreviewLookup.ts:73-79,129,135`) and
  `encodeURIComponent`-encoded (`:94,97,140`); payloads containing `#`, `&`, `?`, `/`, or `javascript:` are
  percent-encoded inside a literal-host template and cannot escape the fragment or alter scheme/authority.
- **`rel` attribute** — `target="_blank"` + `rel="noopener noreferrer"` present (`TaskPreviewCard.tsx:188-189`);
  no imperative `window.open`.
- **Injection sinks** — zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`,
  `document.write`, or dynamic unvalidated hrefs in the entire diff.
- **Secrets/PII** — no key/token/password patterns anywhere in the diff; all fixture emails are
  `student-X-Y@example.test` (RFC 2606 reserved TLD); names are Faker-generated fiction; student IDs are
  synthetic 21-digit strings (`scripts/synthetic-test-data/generateClassRosters.js` `buildStudentId`); no
  real-looking Google document IDs; no secrets in `.opencode/` (the new `no-task-resume.ts` plugin is local-only
  tooling) or docs changes.

Incidental findings: none — three positive incidental observations recorded (`ImageRenderer` fail-closed,
`MarkdownRenderer`'s deliberate `rehype-raw` omission escaping student HTML, E2E route interception preventing
real Google navigation).

---

### Test-coverage gaps

Full review in `.opencode/scratchpad/review-issue19-test-coverage.md`.

**Agent verdict: FAIL** — "no Critical findings, but three Improvements and several Nitpicks (test-coverage gaps
only, no tests written, no automated checks run per constraint)."

**Critical:** none.

#### Improvement

**I1 — Already-open Enter/Space re-arm untested.**
`src/frontend/src/features/taskHeatmap/TaskMetricPreviewCell.tsx:230-243` (arm + `scheduleSourceFocusTransfer`
at `:240` for an already-open preview) and `:184-188` (open-branch re-decision onto an already-mounted body) have
no assertion anywhere: every `{Enter}`/`{ }` press in the unit suites and E2E happens from a closed state. **A
regression dropping the line-240 schedule passes every suite while breaking the
pointer-open→keyboard-activate journey.**

**I2 — Merged entry point parity is assumed, not asserted.**
All keyboard focus-session and loading/error/no-source journeys in
`src/frontend/e2e-tests/task-preview-source-link.states.spec.ts` enter via `enterEmbeddedJourney` only
(`:145,172,198,225,260`); `enterMergedJourney` appears only in pointer/URL and geometry tests. `SPEC.md:86`
requires keyboard navigation through both heatmaps; the merged keyboard journey (Enter→focus, Escape restore,
deferred readiness) is never walked in a browser.

**I3 — Sheets root fallback untested at every layer.**
Root-fallback cases are Slides-only
(`src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.sourceLink.spec.ts:177-188,205-223`; E2E
`task-preview-source-link.spec.ts:249-265`), so the fragment-less Sheets `/edit` URL
(`buildCellPreviewLookup.ts:141-143`) — e.g. a `#gid=undefined` leak — has no assertion; Sheets fragment-encoding
is likewise untested.

#### Nitpick

Reopened-session focus identity asserted by accessible name only (`TaskMetricPreviewCell.focusSession.spec.tsx:239-240`);
focus-once after a second post-ready re-render untested (`:113-115`); negative-key guard untested
(`TaskMetricPreviewCell.tsx:232-234`); within-submission duplicate-item first-wins `sourceUrl` indistinguishable
(`buildCellPreviewLookup.indexing.spec.ts:102-155`); parent-ID trim/encode + absent-key (`undefined`) parent
untested; balance-span absence unasserted; duplicated accessible-name assertion
(`TaskPreviewCard.sourceLink.spec.tsx:118-123`); local URL literal instead of the canonical derived value
(`assembleTaskPreviewData.sourceUrl.spec.ts:21`); generator segment composition not directly pinned.

#### Incidental (triage)

Triple mirror of the URL resolver; whole-object `as AssignmentFull` cast in the fixture builder
(`src/frontend/src/test/taskHeatmap/buildCellPreviewLookupTestFixtures.ts:83`); label literal restated three ways;
pre-existing uncovered `resolveColumnPreviewStatus` seam; dismissal heuristic accepting a lingering inert overlay.

#### Confirmed covered (no findings)

Focus-session main branches and both named negative cases (unit + E2E); merged first-wins source/content
correspondence; the bulk of the `SPEC` URL matrix; schema nullability alignment; and both synthetic generator
changes (`syntheticStudentIdentifiers.test.ts`, `syntheticAssignmentTimestamps.test.ts`).

---

### Error-handling robustness

Full review in `.opencode/scratchpad/review-error-handling-issue-19.md`.

**Agent verdict: FAIL** — "the branch's own new code (focus session, URL derivation, schema loosening) is clean
on error-handling robustness, but the review surface contains one incidental Critical in a diff-touched file
plus smaller findings, and any finding blocks a pass."

#### Critical (incidental — pre-existing on `main`, but the file is modified by this branch)

**Schema-valid transport payloads crash the whole app at popover open.**
`BaseTaskArtifactSchema` permits `content: null` for IMAGE/SPREADSHEET
(`src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts:63,67`; backend contract
`docs/developer/data-shapes/assignment-definition.md:546,572` confirms null is a legitimate emitted state), yet
`src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts:106-114,138-140` throws `TypeError` on exactly
those states, fired inside the unprotected render at `TaskMetricPreviewContent.tsx:119`. With no error boundary
anywhere in `src/frontend/src` (policy §8.3 prescribes one), React unmounts the entire root — answering the
focus question: the popover does not stick open, but the session ends in a blank page and the failure bypasses
both designed error surfaces.

#### Improvement (incidental — pre-existing)

**`buildCellPreviewLookup.ts:213-218` guards on `assignmentDefinition?.definitionKey == null` — unreachable after
Zod parsing** (schema requires both, `assignmentAssessment.zod.ts:145,183`); the module's own remarks concede
the transport schema forbids the omission. Dead guard duplicating the single boundary check; delete it.

#### Nitpick

Dead `!Array.isArray` guard (`src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts:110-112`); format
decision duplicated between `buildEditorBaseUrl` and `resolveSourceUrl` (`buildCellPreviewLookup.ts:92-100` vs
`:141-143`); "Ant Design"/"ant Design" casing inconsistency in new prose (`TaskPreviewCard.tsx:65` vs `:126,152,155`).

#### Checks passed with evidence

Zero `catch` blocks in any touched file (nothing swallowed); errors thrown loudly with context at every E2E helper
boundary; Zod parse failures surfaced via canonical `parseApiResponse`
(`src/frontend/src/services/apiService.ts:168-191`) and distinguishable from valid-null-source payloads (error Alert
vs ready card without action), pinned by `task-preview-source-link.states.spec.ts:96-133`; focus session has no
strand or stuck-open path (spend-before-focus + activeElement re-check at `TaskMetricPreviewCell.tsx:139-151`,
intent cleared before teardown at `:191-199`, Escape routed through one boundary at `:180-199`).

---

### Data-shape docs consistency

Full review in `.opencode/scratchpad/issue19-datashape-consistency-review.md`.

**Agent verdict: PASS** — "the diff is clean for this focus."

Verified against the code (all confirmed):

1. **Docs were genuinely updated for this change** —
   `docs/developer/data-shapes/assignment.md:328-344` carries the "Status: Implemented (issue #19)" blockquote
   (`BaseTaskArtifactFields` required-nullable `pageId`/`documentId`, parent submission deliberately unchanged),
   and `docs/developer/data-shapes/frontend-data-analysis-response.md:436-522` documents the whole "Task preview
   derived shapes" section. Root `AGENTS.md` §6 gate satisfied.
2. **No unreconciled `Not implemented` markers** — both contract status blocks read Implemented, helper doc §9.26
   entries reconciled; the only surviving string is the unrelated homework-tracker note (`assignment.md:41`). No
   overstatement: every "Implemented" claim traced to code.
3. **Derived `sourceUrl`** — documented as derived-in-lookup, never persisted, never in an API response,
   required-but-nullable on both `CellPreviewData` (`buildCellPreviewLookup.ts:50`) and `TaskPreviewData`
   (`TaskPreviewCard.tsx:57`); transport-breadth grep confirms no wire field anywhere; the never-substitution rules
   (parent `documentId` fallback, root fallback, format gating, image-export `metadata.sourceUrl` distinction) all
   match `resolveSourceUrl`.
4. **Nullable `documentId`/`pageId`** — docs state required `string|null`, code is exactly `z.string().nullable()`
   (`assignmentAssessment.zod.ts:42-43`), partial schema unchanged (`.nullable().optional()`), parent
   `.nullable().optional()` reconciled per `SPEC` direction, backend emitter verified as always-emitting `string|null`.
5. **No undocumented new behaviour** — the two validation relaxations, derived shapes, and the synthetic-fixture
   generator changes (21-digit IDs, non-null `updatedAt`) are all documented in-contract in the same diff.

#### Incidental (triage)

- (Improvement) Full-schema `StudentSubmission.studentName` is `z.string()` while the backend constructor defaults
  to `null` — undocumented full-path nullability gap (`docs/developer/data-shapes/assignment.md:189` vs
  `src/backend/Models/StudentSubmission.js:188,337`).
- (Improvement) `docs/developer/data-shapes/assignment-definition.md:510` — "only present in full backend
  persistence" for `TaskDefinition.artifacts` reads as a blanket claim, contradicted by the Assignment contract's
  `TaskDefinitionSchema.artifacts` in `getAssignment` responses.
- (Nitpick) `assignment.md:41` contains the literal phrase "not implemented" (homework tracker — could confuse a
  marker audit); `docs/developer/data-shapes/INDEX.md:30` registry row trails the contract's own file index.

---

### Backend data shape / schema consistency

_(not in scope for this diff — no `src/backend/**` files changed)_

---

---

## Consolidated Critical register

| #   | Focus                     | Severity              | Location                                                                                                                       | One-line issue                                                                                                                                     |
| --- | ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Repo rule compliance      | Critical              | `ACTION_PLAN.md:17,261,295`                                                                                                    | Plan records a final focused review + regression pass that the artefacts do not evidence; feature commit `cd2c54e` landed first                    |
| 2   | Repo rule compliance      | Critical              | `ACTION_PLAN.md:295-296`                                                                                                       | "Section 5 regression results, final review, documentation reconciliation" and "Deviations and reasons" are empty headings                         |
| 3   | KISS & DRY                | Critical              | `previewFixtures.ts:56-104`; `task-preview-source-link-fixtures.ts:156-232`; `assignmentAssessment.zod.fixtures.ts:52-78`      | Canonical fixture-selection pipeline built three times; one copy sits in the production source tree (AGENTS §8 breach)                             |
| 4   | De-Sloppification         | Critical              | `focus.spec.tsx` + `focusSession.spec.tsx` vs `task-preview-source-link.spec.ts` + `.states.spec.ts`                           | Keyboard focus/interaction matrix pinned twice, ≈1,000 redundant lines across 10 scenario pairs                                                    |
| 5   | De-Sloppification         | Critical              | `task-preview-source-link-geometry.ts:51-55,58-67`                                                                             | Six dead exports with zero external references                                                                                                     |
| 6   | De-Sloppification         | Critical              | `previewFixtures.ts:56-64,74-82,225-232` vs `task-preview-source-link-fixtures.ts:156-164,174-182` + `expectations.ts:183-190` | `deepFreeze`/`requireRecord`/`requireTextArtifactContent` copy-pasted unit↔E2E; the documented lint-boundary rationale does not cover the E2E pair |
| 7   | Error-handling robustness | Critical (incidental) | `assignmentAssessment.zod.ts:63,67` + `assembleTaskPreviewData.ts:106-114,138-140` + `TaskMetricPreviewContent.tsx:119`        | Schema-valid `content: null` artefacts throw `TypeError` inside an unprotected render; no error boundary exists, so the whole app unmounts         |

## Summary of counts

| Focus                                    | Verdict           | Critical       | Improvement    | Nitpick  |
| ---------------------------------------- | ----------------- | -------------- | -------------- | -------- |
| Repo rule compliance                     | FAIL              | 2              | 5              | 5        |
| KISS & DRY                               | FAIL              | 1              | 6              | 6 groups |
| De-Sloppification                        | Needs Improvement | 3              | 6              | 6        |
| Performance (Big-O)                      | FAIL              | 0              | 1              | 1        |
| Logging rules compliance                 | PASS              | 0              | 0              | 0        |
| Frontend layout / design / accessibility | FAIL              | 0              | 2              | 2        |
| Frontend data shape / schema consistency | PASS              | 0              | 0              | 1        |
| Security & secrets                       | PASS              | 0              | 0              | 0        |
| Test-coverage gaps                       | FAIL              | 0              | 3              | 9        |
| Error-handling robustness                | FAIL              | 1 (incidental) | 1 (incidental) | 3        |
| Data-shape docs consistency              | PASS              | 0              | 0              | 0        |

**Production code has no blocking findings.** Every Critical except #7 is confined to the test/support layer or
planning artefacts. #7 is pre-existing on `main` but sits in a file this branch modifies.

---

## Decisions

This section is the **rationale** for each decision. The **executable form** — which files to touch, in what
order, and which batch owns them — is [Action plan — batched](#action-plan--batched) at the top of this document.
Entries below marked **Fix now** or **Apply the split** are implemented by those batches; entries marked
**Wontfix**, **Defer**, **No action** or **Keep on this branch** are collected in
[No action, Wontfix, and deferred](#no-action-wontfix-and-deferred) at the bottom and need no work before merge.

Entries annotated **Audit resolution** / **Audit correction** were amended after a second pass over the codebase
that resolved an ambiguity in the original decision text or overturned part of the underlying finding. Where an
audit changed the fix, the original wording is retained above the annotation so the change is traceable.

Captured during the decision pass on 2026-10-03. **Note on `ACTION_PLAN.md`:** the user confirmed
`ACTION_PLAN.md` will be deleted before merge, which is the rationale for the two wontfix decisions below
and renders Repo-rule I5 moot (no issue raised for it).

### Repo rule compliance

- **[Critical] `ACTION_PLAN.md:17,261,295` — Decision: Wontfix.** Rationale: the user confirmed
  `ACTION_PLAN.md` is a temporary working artefact that will be deleted before merge, so its internal
  record accuracy does not justify a change. The underlying observation (the plan pre-declared a final
  review pass that had not yet run) is accepted as immaterial given the document's fate. No issue.
- **[Critical] `ACTION_PLAN.md:295-296` (empty Section 5 / Deviations headings) — Decision: Wontfix.**
  Same rationale: the document is deleted before merge, so populating two empty template headings has no
  lasting value. The regression evidence the Section 5 heading was meant to hold already exists at
  `ACTION_PLAN.md:287`. No issue.
- **[Improvement] I5 `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:80` (screenshot paths / measured geometry /
  verdict not recorded in `ACTION_PLAN.md`) — Decision: Wontfix (moot).** Rendered moot by the deletion of
  `ACTION_PLAN.md` before merge. No separate issue; the layout doc's own acceptance section remains the
  record.
- **[Improvement] I2 `assembleTaskPreviewData.ts:35-45` + `TaskPreviewCard.tsx:49-57` — Decision: Fix now.**
  Add the invariant cross-reference to the `TaskPreviewData.sourceUrl` `@remarks`, stating that null
  `cellData` implies **both** a null `sourceUrl` **and** the `NOT_ATTEMPTED_METRIC` override, so the single
  behavioural decision is documented in one place rather than split across two files and two rows of the
  data-shape doc.
- **[Improvement] I3 `buildCellPreviewLookupTestFixtures.ts:22-29` — Decision: Fix now.** Document the
  artefact/parent ID coincidence hazard on `BASE_ARTIFACT_FIELDS` and direct authors to the
  non-coincidence pattern already demonstrated at `buildCellPreviewLookup.sourceLink.spec.ts:150-152`
  ("so an artefact-first resolution cannot coincide with a parent-based URL"). Rationale: a test can
  currently supply matching IDs and pass for the wrong reason, and nothing warns the next author.
- **[Improvement] I4 `previewSourceActionTestHelpers.ts:64-93` — Decision: Fix now.** Name the winning ID
  source in the JSDoc. Verified during the decision pass: the committed canonical `small` fixture has a
  parent `documentId` distinct from every artefact `documentId`, so the derived URL's provenance (artefact,
  not parent) is currently unpinned. Comment-only change.
- **Nitpick N1 `buildCellPreviewLookup.ts:129-130` — Decision: Fix now** (part of the Cluster H sweep):
  use one spelling of the "unusable" test across the two adjacent lines.
- **Nitpick N2 `TaskMetricPreviewCell.tsx:203-217` — Decision: Fix now** (Cluster B narration strip):
  converge on one vocabulary so the same rule is stated once.
- **Nitpick N3 `TaskPreviewCard.tsx:126,151,157` — Decision: Fix now** (Cluster H): correct `ant Design`
  to `Ant Design`, matching `:65,152,155` and repo-wide usage.
- **Nitpick N4 `TaskMetricPreviewCell.tsx:135-169` — Decision: No action.** The agent explicitly
  recommended _against_ extraction here (one-caller helper would be over-abstraction). Recorded so a future
  de-slop pass does not re-raise it.
- **Nitpick N5 `previewFixtures.ts:22-23` — Decision: No action.** The `?raw` convention matches
  `assignmentAssessment.zod.fixtures.ts` and existing repo practice.

### KISS & DRY

- **[Critical] C1 `previewFixtures.ts:56-104` / `task-preview-source-link-fixtures.ts:156-232` /
  `assignmentAssessment.zod.fixtures.ts:52-78` — Decision: Fix now.** Consolidate to a single shared
  fixture-selection and freeze utility. Specifically: (a) **move `assignmentAssessment.zod.fixtures.ts` out
  of `src/frontend/src/services/`** into the test tree, resolving the `AGENTS.md` §8 breach where test code
  was placed in the production source tree; (b) have the E2E side import the shared `deepFreeze` /
  `requireRecord` primitives rather than copying them. Retain only the genuinely layer-specific
  record-loading difference (Vite `?raw` vs direct JSON import, documented at
  `task-preview-source-link-fixtures.ts:7-9`). Combined with De-Sloppification C6 below.

  **Audit resolution — destinations fixed by convention, not judgement.** The original text said "a single
  shared utility" without naming paths. Resolved as: shared `deepFreeze`/`requireRecord`/
  `requireTextArtifactContent` → **`src/frontend/src/test/shared/`**, which already exists for cross-domain test
  helpers (`testDeferredPromise.ts`, `sharedQueriesTestHelpers.ts`); `assignmentAssessment.zod.fixtures.ts` →
  **`src/frontend/src/test/assignmentAssessment/`**, matching the existing domain-subfolder convention
  (`assignmentDefinition/`, `auth/`, `classes/`, `dataAnalysis/`, `taskHeatmap/`); the E2E side imports that
  shared module, following the existing precedent at `e2e-tests/settings-topics-crud.spec.ts:14` and
  `e2e-tests/helpers/classes-page-end-to-end-helpers.ts:11`. The move is safe because
  `assignmentAssessment.zod.fixtures.ts` is read only by three co-located specs
  (`assignmentAssessment.zod.spec.ts:13`, `assignmentAssessment.zod.regression.spec.ts:22`,
  `assignmentAssessment.artifacts.zod.spec.ts:23`) and no production code.

- **[Improvement] I1 `task-preview-source-link-journeys.ts` (123 lines) — Decision: Fix now** (Cluster A
  sweep). Merge into `helpers.ts` (combined floor ≈470 lines, under the 550-line decomposition trigger).
  Rationale: only two spec callers, and `visual.spec.ts:172-194, 380-391` bypasses the module entirely and
  re-composes the entry steps locally, which refutes its stated purpose. Recovers ≈100 lines and one file.
- **[Improvement] I2 triplicate URL contract — Decision: Fix now, narrowed to the E2E/unit overlap only
  (Cluster A).** **Audit correction:** the original decision text said to "delete the unused
  `deriveEditorSourceUrl` export" and to remove a redundant test-side copy. Both were wrong.
  `deriveEditorSourceUrl` **is used**, at `task-preview-source-link-expectations.ts:250`, and
  `buildExpectedSourceUrl` has 18 call sites across 4 specs. Independent oracles are correct verification
  design — an assertion must not validate the resolver against itself. **Retain all three:** the production
  resolver, the E2E oracle and the unit oracle. The only valid consolidation is the shared _fixture plumbing_
  in Critical C1 above, never the URL derivation.
- **[Improvement] I3 / I4 restated label and user-facing literals — Decision: Apply the split** (Cluster C).
  Per the three-case analysis recorded in the decision pass:
  1. **Import** the metric-cell accessible-label formatter (`taskHeatmapTableColumns.tsx:139-146`) in the
     three test files that rebuild it — it is a pure computation used as an addressing mechanism, so no
     verification power is lost.
  2. **Keep** the URL-derivation oracle independent in both test layers.
  3. **Pin once, import elsewhere** for the spec-fixed phrases: retain exactly one verbatim assertion of
     the source-action accessible name, the loading label and the error text (the accessible name is pinned
     by `SPEC.md:54` and is a WCAG-facing contract, so one deliberate assertion is warranted), and import
     those constants in all other test and production sites. Production already exports `CARD_MAX_WIDTH`
     for exactly this purpose, so the precedent exists.
     Recovers roughly 3 restatements while losing no assertion.
- **[Improvement] I5 / I6 single-consumer exports and `GeometryStabilityTracker` ceremony — Decision: Fix
  now** (Cluster A). Reduce the tracker plus `HALF_LENGTH_DIVISOR` ceremony from ≈35 lines to ≈15 and
  un-consume the single-consumer geometry/region exports.
- **Nitpicks (Cluster A sweep) — Decision: Fix now.** Remove the `withArtifactBody` duplication of the
  `withSourceLocationOverride` spine (≈20 lines); reduce the 99-line spec that tests the test fixtures;
  de-duplicate the wait helpers; inline the one-caller `dispatchCancelableKeydown`; collapse the seven-helper
  selection pyramid in `previewFixtures.ts`; replace the five magic repeat constants in
  `task-preview-source-link-scenarios.ts` with named/derived values.
- **Incidental Inc1 (≈5,500 lines of corpus regeneration) — Decision: No action.** Byte-reproducible
  generator output, required for the 21-digit IDs and non-null `updatedAt`; retained on this branch (see
  De-Sloppification X1 below).
- **Incidental Inc2 (`getCellMetric` switch verbosity) — Decision: No action.** Pre-existing, untouched.
- **Incidental Inc3 (comment citing an ephemeral scratchpad path) — Decision: Fix now** under Cluster B.

### De-Sloppification

- **[Critical] C1 duplicated keyboard focus/interaction matrix (≈1,000 lines) — Decision: Fix now.** Delete
  **all 10** mirrored E2E twins: `states.spec.ts:87-107, 142-167, 169-193, 195-214, 222-248, 250-282` and
  `spec.ts:171-184, 186-204, 206-222, 224-242`, which duplicate `content.spec.tsx:155-168`,
  `focus.spec.tsx:61-92, 158-185` and `focusSession.spec.tsx:99-214`. Retain only
  `task-preview-source-link.spec.ts:121-133` (real tooltip, real new-tab navigation), which are genuinely
  browser-only. Rationale: the unit suites render the real `TaskMetricPreviewCell` → real antd portal → real
  `TaskPreviewCard` via `renderPreviewCell`, so they are not a mocked stand-in. Every focus-contract tweak
  currently costs two synchronised edits in two paradigms. **Record the resulting layer split in
  `docs/developer/frontend/frontend-testing.md`.**

  **Audit resolution — real-portal Escape is _not_ an exception.** The original decision text kept "real portal
  Escape" at E2E. That was wrong: `focus.spec.tsx:157-172` is commented _"Escape pressed while focus sits on the
  action inside the portal overlay"_ and locates the action via `findSourceAction()`, a document-level portal
  query — so the unit layer already exercises real-portal Escape end to end. Hence `spec.ts:206-222` is
  deletable and the E2E matrix reduces to `spec.ts:121-133`. Note that deleting these twins does **not** remove
  merged keyboard coverage, because none exists at either layer today (see the deferred Test-coverage I2).

- **[Critical] C2 six dead exports in `task-preview-source-link-geometry.ts:51-55,58-67` — Decision: Fix
  now.** Un-export `SOURCE_ICON_SIDE_PX`, `SOURCE_ACTION_SIDE_PX`, `SIZE_TOLERANCE_PX`,
  `CENTRE_TOLERANCE_PX`, `EDGE_TOLERANCE_PX` and `REQUIRED_STABLE_READS`, keeping them module-private.
  Verified zero external references: the visual spec imports only `assertReadyPreviewGeometry`,
  `readClosedPageOverflowWidth`, `rebaselineClosedPageOverflow` (`visual.spec.ts:80-84`) and the interaction
  spec only `measureStablePreviewHeader` (`:70`). Behaviour-neutral.
- **[Critical] C3 copy-pasted `deepFreeze` / `requireRecord` / `requireTextArtifactContent` — Decision: Fix
  now**, folded into KISS C1 above. Also fold in `requireTextArtifactContent`
  (`previewFixtures.ts:225-232` ≡ `task-preview-source-link-expectations.ts:183-190`) so only record
  loading stays layer-specific. **Update §9.26 of
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`** to correct the recorded
  rationale: the existing entry justifies `previewFixtures` ↔ `zod.fixtures` duplication via the
  `**/test/**` lint boundary, which does **not** extend to the E2E pair (`e2e-tests/**` sits outside the
  `src/**` lint scope and already imports from `src/services` and `src/pages`).
- **[Improvement] I1 process-narration comments, incl. three false "review remains pending" claims — Decision:
  Fix now.** Correct `task-preview-source-link.visual.spec.ts:32`, `task-preview-source-link.spec.ts:30`
  and `.states.spec.ts:38-40`, which state the review is pending while `ACTION_PLAN.md:299-300` records it
  complete; strip development-timeline narration ("red-first provenance", section-ordering notes) from the
  six affected files; keep one behavioural contract statement per module; and reduce the `TaskPreviewCard`
  JSDoc (`TaskPreviewCard.tsx:121-159`) to a pointer at the layout doc, removing the duplicated
  narrow-viewport geometry numbers (`spills 4px past the right viewport edge`, `390 to 394`) already held in
  `TaskMetricPreviewCell.module.css:6-8` and `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:58`. Also collapse the
  triple-stated `flushSync`/`queueMicrotask` rationale (`TaskMetricPreviewCell.tsx:50-58`, §9.26 entry 3,
  `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:57`).
- **[Improvement] I2 synthetic-corpus meta-tests (861 lines) — Decision: Fix now** (Cluster D). Collapse
  `tests/synthetic-analysis/syntheticAssignmentTimestamps.test.ts` (483) and
  `syntheticStudentIdentifiers.test.ts` (378) to one parametrised suite over the committed views plus one
  generator-determinism probe, pinning the same two conventions (`updatedAt = createdAt + 3 min`, 21-digit
  student IDs).
- **[Improvement] I3 visual spec exceeds the agreed reduced finish line — Decision: Fix now** (Cluster D).
  Reduce `task-preview-source-link.visual.spec.ts` to the single representative inspection agreed at
  `ACTION_PLAN.md:15` and `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:64,68`, removing the 2 viewports × 2 schemes ×
  2 entry points geometry matrix (`:125-128, 246-272`), the label/state matrices (`:306-364`) and the body
  matrix (`:370-408`). **Update `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md` to match the reduced scope** so the
  document and the spec agree again. Note this overlaps the deletion in Critical C1 above; sequence them
  together.
- **[Improvement] I4 shared user-facing copy — Decision: Addressed under KISS I3/I4** (Cluster C split);
  additionally rename `SOURCE_DOCUMENT_ACTION_LABEL` (E2E) to match `SOURCE_ACTION_LABEL` (unit).
- **[Improvement] I5 FIFO queue magic numbers (`task-preview-source-link-scenarios.ts:37-50`) — Decision: Fix
  now** (Cluster A). Replace the trial-and-error repeat counts (4, 10, 14, 8, 2, 2) with named values, and
  add a tail sentinel so under-sizing fails with a named message rather than a stray envelope mismatch.
- **[Improvement] I6 locator duplication — Decision: Fix now** (Cluster A). Reuse the exported
  `taskMetricCells` locator (`task-preview-source-link-journeys.ts:118-122`) instead of rebuilding it inline
  at `visual.spec.ts:286`.
- **Nitpicks N1–N6 — Decision: Fix now** as one sweep (Cluster H): inline the self-evident named constants
  (`HALF_LENGTH_DIVISOR`, `TWO_SESSION_FOCUS_TRANSFERS`, `LAST_ROSTER_OFFSET`,
  `ACCESSIBLE_LABEL_SCORE_SEPARATOR`); replace the `HEADER_BALANCE_CLASS` production test hook
  (`TaskPreviewCard.tsx:121-132`, `task-preview-header-regions.ts:46`) with a **`data-testid`** — see audit
  resolution below; simplify the `SourceActionElement` union to reflect that the action always
  carries an `href` (`TaskPreviewCard.tsx:60-69`); drop the redundant `as unknown as` cast
  (`task-preview-source-link-fixtures.ts:276-277`); move the import-time corpus throw
  (`task-preview-source-link-fixtures.ts:113-119`) into scenario construction so corpus drift fails with
  better locality. **Note the interaction:** replacing `HEADER_BALANCE_CLASS` changes the balance-span
  assertion, so apply it before or alongside the coverage items in the follow-up issue.

  **Audit resolution — use `data-testid`, not a structural selector.** The original decision text offered two
  options ("a `data-testid`-style convention **or** a structural `span[aria-hidden]` selector"). The repo has
  already settled it: `ReferenceDataManagementModalScaffold.tsx:157` puts
  `data-testid="reference-data-create-action-icon"` on a production element, and four specs assert it by that
  name. Follow that precedent.

- **Incidental X1 (≈700 lines of unrelated agent/workflow config on the branch) — Decision: Keep on this
  branch.** The user chose not to split it, and explicitly declined to update the `ACTION_PLAN.md` statement
  that called those edits "excluded from commits", since that document will be deleted before merge. No
  issue. The corpus-regeneration component of this finding (Inc1 above) is likewise retained.
- **Incidental X2 / X3 — Decision: No action.** `DeferredPopoverContent.tsx`'s 17-line one-caller indirection
  and `taskHeatmapTableTestHelpers.ts:33-42`'s pre-existing constant ceremony both predate this branch; the
  latter is the same pattern the Cluster H sweep removes from the new files.

### Performance (Big-O)

- **[Improvement] I1 `TaskMetricPreviewContent.tsx:118-120` — Decision: Fix now** (Cluster F). Memoise the
  `assembleTaskPreviewData` call so an open popover's body re-renders do not re-execute the O(R×K) spreadsheet
  markdown conversion. Low severity — the "defer the expensive call until the popover opens" remark
  (`:10-15, :72-74`) currently holds only for the first open. Note the corpus is TEXT-only today
  (`scripts/synthetic-test-data/generateSubmissions.js:88`), so this is latent rather than active.
- **Nitpick (parent `documentId` re-trim per item, `buildCellPreviewLookup.ts:129`) — Decision: No action.**
  The agent investigated and **recommended against** the suggested per-document map hoist: distinct-ID
  density is one ID per artefact, so a cache would save only the parent-fallback fraction while adding
  invalidation surface to an already single-pass memoised O(A·P·T) build. Net-negative at observed scale.
- **Incidental findings (`useHeatmapsPageData.ts:202-214,376-395`; `taskHeatmapTableColumns.tsx:292-306`) —
  Decision: No action** except the dedupe below. Both pre-date this branch and are not worsened by it.

### Logging rules compliance

- No in-scope findings. All three incidental items are routed elsewhere: the missing app-level error boundary
  is folded into the deferred Critical below; the throw-message wording (`buildCellPreviewLookup.ts:215-217`)
  is in the Cluster H sweep; and the assembly-error-log dedupe is Fix now below.

### Frontend layout / design / accessibility

- **[Improvement] I1 `TaskMetricPreviewCell.tsx:296-304` — Decision: Fix now** (Cluster F). Add
  `aria-expanded` / `aria-haspopup` to the metric-cell trigger; the component already owns `isPreviewOpen`
  (`:128`, `:268`), so this is a one-attribute change. Rationale: screen-reader users currently cannot tell
  whether the preview is open. The agent ranked this as Improvement only because the gap was inherited from
  the pre-extraction trigger, but the new module now owns the state.
- **[Improvement] I2 `TaskMetricPreviewCell.tsx:264-270` — Decision: Wontfix, with corrected reasoning
  (the original finding was overstated).** The finding claimed "the antd 0.1s default is provably too short
  during the `zoom-big` entrance", citing `task-preview-source-link.spec.ts:108-112`. On inspection that
  comment describes a **different problem**: _"the Popover's `zoom-big` entrance transform otherwise moves the
  action under the cursor mid-transition, the pointer never settles on it, and rc-trigger hides the preview
  before any tooltip can open."_ That is a race between the entrance animation and pointer position — the
  element moves out from under the cursor, so hit-testing fails. A longer grace period would not fix it,
  because the fault is _where the pointer sits relative to a moving box_, not how long the user waits. The
  delivered fix is `measureStablePreviewHeader` (wait for settled geometry before moving the pointer), which
  is what `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:57` explicitly mandates: _"No new motion. Existing reduced-motion
  behaviour must remain intact; geometry checks wait for stable layout rather than measuring an
  entrance-animation frame."_ The project has already made a deliberate, documented decision against
  compensating with timing.

  The pointer-traversal requirement the finding also leaned on (`TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:56`) is
  **already asserted and passing** at `task-preview-source-link.spec.ts:117-121`: `action.hover()` →
  popover visible → tooltip shows `SOURCE_DOCUMENT_ACTION_LABEL` → `expect(action).not.toBeFocused()`.
  `handleOpenChange` (`TaskMetricPreviewCell.tsx:180-198`) further guarantees a pointer dismissal moves focus
  nowhere, since a pointer never holds focus inside the body.

  **Verified separately:** no `mouseEnterDelay`/`mouseLeaveDelay` has ever been set in this repo, so antd
  defaults of 0.1s each apply. `git log -S "mouseEnterDelay" -- src/frontend` returns three commits
  (`79b7c6d`, `d148fda`, `2125508`), all of which touch only a _comment_, never a prop value. The stale
  comment at `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.preview.spec.tsx:115` ("Popover should
  appear after mouseEnterDelay") implies a configured delay that has never existed — it is folded into the
  Cluster B comment sweep below. No test demonstrates a failure, and no product requirement is unmet.

- **Nitpick N1 `TaskMetricPreviewCell` trigger focus ring — Decision: Fix now** (Cluster H): use the themed
  `:focus-visible` convention from `src/frontend/src/index.css:187-189` rather than the UA default.
- **Nitpick N2 `TaskMetricPreviewCell.spec.tsx:8` — Decision: Fix now** (Cluster B): the "Enter/Space click
  synthesis" docstring no longer describes the delivered handler (`TaskMetricPreviewCell.tsx:230-243`).
- **Incidental items — Decision: No action.** Skeleton fixed-400px vs content-shrunk width, duplicate
  `<td>`/`aria-label`, antd `headerPaddingSM` coupling (guarded by E2E invariants), the unnecessary
  grid-exemption comment on `CARD_BODY_MAX_HEIGHT`, and documented hover-out closing of a keyboard-opened
  preview.

### Frontend data shape / schema consistency

- **Nitpick (docs) `docs/developer/data-shapes/assignment.md:342-344` — Decision: Fix now** (Cluster H). Add
  a Known-discrepancy entry explaining why `BaseTaskArtifactPartialSchema`
  (`src/frontend/src/services/classDetail/classDetail.zod.ts:66-67`) tolerates key omission while the full
  schema is required-nullable, so a future reader does not "fix" the asymmetry in either direction. Fold into
  the data-shape doc edits already required by the `pageId` work below.
- **Incidental 2–4 — Decision: No action.** The sound `as CellPreviewData` cast
  (`buildCellPreviewLookup.ts:172`) is unchanged from `main`; the E2E independent re-derivation is deliberate
  verification design; the `classesById.json` `content`/`contentHash` keys are unchanged `main` behaviour.
- **Incidental 1 (`TaskDefinitionSchema.pageId`) — Decision: Fix now; see the Verification section below.**
  The decision pass established this finding was **inverted** and has been redirected into a backend change.

### Security & secrets

- No findings at any severity. No action.

### Test-coverage gaps

- **[Improvement] I1 already-open Enter/Space re-arm — Decision: Fix now.** Add coverage at the unit layer for
  `TaskMetricPreviewCell.tsx:230-243` (the arm and its `scheduleSourceFocusTransfer` at `:240`) and
  `:184-188`. Rationale: every `{Enter}`/`{ }` press in both suites currently starts from a closed state, so
  dropping line 240 breaks the pointer-open→keyboard-activate journey with all tests still green.
- **[Improvement] I2 merged-heatmap keyboard parity — Decision: Defer ([Issue #323](https://github.com/h-arnold/AssessmentBot/issues/323)).** `states.spec.ts`
  exercises keyboard journeys only through `enterEmbeddedJourney` (`:145,172,198,225,260`), while
  `SPEC.md:86` requires keyboard navigation through **both** heatmaps. Needs a merged keyboard journey
  (Enter→focus, Escape restore, deferred readiness). This is arguably SPEC non-compliance rather than a
  coverage gap. Combined into a single follow-up issue with the nine polish items below.
- **[Improvement] I3 Sheets root fallback — Decision: Fix now.** Add coverage at the unit layer for the
  fragment-less Sheets `/edit` URL (`buildCellPreviewLookup.ts:141-143`) and for Sheets fragment-encoding.
  Rationale: all root-fallback cases are currently Slides-only
  (`buildCellPreviewLookup.sourceLink.spec.ts:177-188,205-223`), so a `#gid=undefined` leak would ship
  silently. Small addition to the existing suite.
  **User context:** the user noted they will not be viewing spreadsheet tasks for a while and would handle
  any such bug later; E3 was still chosen for fixing now as it is a small addition to an existing suite. If
  that changes, move E3 to the follow-up issue.
- **Nine nitpicks — Decision: No action this PR** at the user's direction; recorded in
  [Issue #323](https://github.com/h-arnold/AssessmentBot/issues/323) so they are not lost. Noted there:
  reopened-session focus identity asserted by accessible name only (`focusSession.spec.tsx:239-240`);
  focus-once after a second post-ready re-render (`:113-115`); the negative-key guard
  (`TaskMetricPreviewCell.tsx:232-234`); within-submission duplicate-item first-wins indistinguishable
  (`buildCellPreviewLookup.indexing.spec.ts:102-155`); parent-ID trim/encode and absent-key (`undefined`)
  parent; balance-span absence unasserted (changes with the Cluster H `HEADER_BALANCE_CLASS` replacement);
  a duplicated accessible-name assertion (`TaskPreviewCard.sourceLink.spec.tsx:118-123`); a local URL literal
  where the canonical derived value belongs (`assembleTaskPreviewData.sourceUrl.spec.ts:21`); generator
  segment composition not directly pinned.
- **Incidental (triple URL-resolver mirror, `as AssignmentFull` cast at
  `buildCellPreviewLookupTestFixtures.ts:83`, label literal restated three ways) — Decision: covered by the
  KISS C1 / I2 and Cluster C decisions.** Pre-existing uncovered `resolveColumnPreviewStatus` seam and the
  dismissal heuristic accepting a lingering inert overlay: no action.

### Error-handling robustness

- **[Critical, incidental] `assignmentAssessment.zod.ts:63,67` + `assembleTaskPreviewData.ts:106-114,138-140` +
  `TaskMetricPreviewContent.tsx:119` — Decision: Defer ([Issue #322](https://github.com/h-arnold/AssessmentBot/issues/322)), with a corrected
  understanding recorded below.** This finding was re-examined during the decision pass and the framing materially
  changed; see "Verification and revised findings" for the corrected boundary reasoning before acting.
- **[Improvement] `buildCellPreviewLookup.ts:213-218` dead guard — Decision: Fix now** (Cluster F). Delete
  the `assignmentDefinition?.definitionKey == null` throw: unreachable after Zod parsing
  (`assignmentAssessment.zod.ts:145,183`), and the module's own remarks concede the transport schema forbids
  the omission.
- **Nitpicks — Decision: Fix now** (Cluster H): remove the dead `!Array.isArray` guard
  (`assembleTaskPreviewData.ts:110-112`); de-duplicate the format decision shared between
  `buildEditorBaseUrl` and `resolveSourceUrl` (`:92-100` vs `:141-143`); correct the throw-message wording
  (`:215-217`); and apply the `Ant Design` casing fix.

### Data-shape docs consistency

- No in-scope findings. The docs were genuinely updated for this change and no `Not implemented` markers were
  left unreconciled.
- **Incidental items — Decision: Fix now** as part of the `pageId` doc work below and the Cluster H
  Known-discrepancy entry: correct `assignment-definition.md:505` (see Verification), add the missing
  rationale for the partial-schema asymmetry (`assignment.md:394-438` Known-discrepancies list), reconcile
  the blanket claim at `assignment-definition.md:510` regarding `TaskDefinition.artifacts` in `getAssignment`
  responses, correct the undocumented `StudentSubmission.studentName` full-path nullability gap
  (`assignment.md:189` vs `src/backend/Models/StudentSubmission.js:188,337`) subject to the verification
  below, and bring the `docs/developer/data-shapes/INDEX.md:30` registry row into line with the contracts'
  own file index. `assignment.md:41`'s literal "not implemented" belongs to the unrelated homework tracker —
  no action.

---

## No action, Wontfix, and deferred

Nothing in this section needs action before this PR merges. Recorded so findings are not silently re-raised.

### Wontfix

| Finding                                                                                | Location                                         | Rationale                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Layout I2 — no hover-intent delay configured**                                       | `TaskMetricPreviewCell.tsx:264-270`              | **Finding overstated; see reasoning below.**                                                       |
| Repo rule C1 — `ACTION_PLAN.md` records a final review pass that had not run           | `ACTION_PLAN.md:17,261,295`                      | The document is deleted before merge; internal record accuracy has no lasting value                |
| Repo rule C2 — empty "Section 5" and "Deviations" headings                             | `ACTION_PLAN.md:295-296`                         | Same — the regression evidence they would hold already exists at `:287`                            |
| Repo rule I5 — screenshot paths / measured geometry / verdict not recorded in the plan | `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:80`          | Moot: `ACTION_PLAN.md` is deleted before merge                                                     |
| De-slop X1 — ≈700 lines of unrelated agent/workflow config on the branch               | `.opencode/**`, `AGENTS.md`, `.github/agents/**` | User chose to keep it on this branch; the contradicting plan statement is moot for the same reason |

**Why Layout I2 is Wontfix.** The finding claimed "the antd 0.1s default is provably too short during the
`zoom-big` entrance", citing `task-preview-source-link.spec.ts:108-112`. That comment describes a **different
problem**: _"the Popover's `zoom-big` entrance transform otherwise moves the action under the cursor
mid-transition, the pointer never settles on it, and rc-trigger hides the preview before any tooltip can open."_
That is a race between the entrance animation and pointer position — the element moves out from under the cursor,
so hit-testing fails. **A longer grace period cannot fix it**; the fault is _where the pointer sits relative to a
moving box_, not how long the user waits. The delivered remedy is `measureStablePreviewHeader` (wait for settled
geometry before moving the pointer), which is precisely what `TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:57` mandates:
_"No new motion. Existing reduced-motion behaviour must remain intact; geometry checks wait for stable layout
rather than measuring an entrance-animation frame."_ The project has already made a deliberate, documented
decision against compensating with timing.

The pointer-traversal requirement the finding also leaned on (`TASK_PREVIEW_SOURCE_LINK_LAYOUT.md:56`) is **already
asserted and passing** at `task-preview-source-link.spec.ts:117-121` — `action.hover()` → popover visible →
tooltip shows `SOURCE_DOCUMENT_ACTION_LABEL` → `expect(action).not.toBeFocused()`. `handleOpenChange`
(`TaskMetricPreviewCell.tsx:180-198`) further guarantees a pointer dismissal moves focus nowhere, since a pointer
never holds focus inside the body.

Verified separately: **no `mouseEnterDelay`/`mouseLeaveDelay` has ever been set in this repo**, so antd defaults
of 0.1s each apply. `git log -S "mouseEnterDelay" -- src/frontend` returns three commits (`79b7c6d`, `d148fda`,
`2125508`), all of which touch only a _comment_, never a prop value. The stale comment is fixed in Batch 6 step 6.

### Deferred — GitHub Issues

| Issue                                                                                                                                              | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[#322](https://github.com/h-arnold/AssessmentBot/issues/322)** — Classify null-artefact-content submissions as `'E'` instead of crashing the app | Split the shared artefact schema so reference/template nullability is enforceable at validation; add the analysis-stage `'E'` classification; remove the misplaced render-layer `TypeError`s at `assembleTaskPreviewData.ts:107-109` and `:138-140`. **Do not add an app-level React error boundary as the fix** — that would mask the defect by converting a visible `'E'` into a blank page. Full corrected boundary reasoning in [Verification §2](#2-schema-valid-content-null-crashing-the-app--boundary-relocated). |
| **[#323](https://github.com/h-arnold/AssessmentBot/issues/323)** — Cover the merged-heatmap keyboard journey plus nine coverage polish items       | Merged-surface keyboard parity (`SPEC.md:86` requires both entry points; `states.spec.ts` exercises only `enterEmbeddedJourney`). Plus: reopened-session focus identity, focus-once after a second post-ready re-render, negative-key guard, within-submission duplicate-item first-wins, parent-ID trim/encode and absent-key parent, balance-span absence, duplicated accessible-name assertion, local URL literal, generator segment composition.                                                                      |

The substantive deferral reasoning — that a schema-valid `content: null` is a **business state** that belongs in
business UI rather than a crash handler — is recorded in full in [Verification §2](#2-schema-valid-content-null-crashing-the-app--boundary-relocated).

### No action — agent-flagged, rejected

| Finding                                                                                                                                                                            | Why no action                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| KISS 4c — remove the "redundant" test-side URL oracle                                                                                                                              | **Finding was wrong.** `deriveEditorSourceUrl` is used at `task-preview-source-link-expectations.ts:250`, and `buildExpectedSourceUrl` has 18 call sites. Independent oracles are correct verification design                                          |
| Perf N1 — hoist a per-document base-URL map                                                                                                                                        | Agent investigated and **recommended against** it: distinct-ID density is one ID per artefact (`generateSubmissions.js:83`), so a cache would save only the parent-fallback fraction while adding invalidation surface to a single-pass memoised build |
| Repo rule N4 — extract the 43-line focus-intent block                                                                                                                              | Agent explicitly recommended **against** extraction; a one-caller helper would be over-abstraction                                                                                                                                                     |
| Repo rule N5 — `?raw` JSON import convention                                                                                                                                       | Consistent with `assignmentAssessment.zod.fixtures.ts` and existing repo practice                                                                                                                                                                      |
| De-slop X2 — pre-existing constant ceremony in `taskHeatmapTableTestHelpers.ts:33-42`                                                                                              | Predates this branch; same pattern Batch 3 removes from the new files                                                                                                                                                                                  |
| De-slop X3 — `DeferredPopoverContent.tsx` 17-line indirection                                                                                                                      | Predates this branch and is documented                                                                                                                                                                                                                 |
| KISS Inc1 / De-slop X1 corpus churn — ≈5,500 lines of JSON regeneration                                                                                                            | Byte-reproducible generator output; required for the 21-digit IDs and non-null `updatedAt`; retained on this branch                                                                                                                                    |
| KISS Inc2 — `getCellMetric` switch verbosity                                                                                                                                       | Pre-existing, untouched                                                                                                                                                                                                                                |
| KISS Inc3 — comment citing an ephemeral scratchpad path                                                                                                                            | Folded into Batch 6 step 2                                                                                                                                                                                                                             |
| Layout incidental — skeleton width, duplicate `<td>`/`aria-label`, antd `headerPaddingSM` coupling, `CARD_BODY_MAX_HEIGHT` comment, hover-out closing of a keyboard-opened preview | All pre-existing or already guarded by E2E invariants                                                                                                                                                                                                  |
| Frontend data shape incidental 2–4 — sound `as CellPreviewData` cast, E2E independent re-derivation, `classesById.json` `content`/`contentHash` keys                               | Unchanged from `main`; the E2E re-derivation is deliberate design                                                                                                                                                                                      |
| Perf incidental — `useHeatmapsPageData.ts:202-214` rebuilding on query-status transitions; `taskHeatmapTableColumns.tsx:292-306` duplicate label computation                       | Pre-date this branch and are not worsened by it                                                                                                                                                                                                        |
| Logging incidental — throw-message wording                                                                                                                                         | Folded into Batch 5 step 8                                                                                                                                                                                                                             |
| Data-shape docs incidental — `assignment.md:41` literal "not implemented"                                                                                                          | Unrelated homework tracker; no action                                                                                                                                                                                                                  |

---

## Deferred findings — GitHub Issues

- **[Issue #322](https://github.com/h-arnold/AssessmentBot/issues/322)** — Classify null-artefact-content

---

## Appendix — diff stat

`git diff main...HEAD --stat` — **74 files changed, 13,924 insertions(+), 6,021 deletions(-)**, of which **5,384 insertions are mechanical JSON fixture regeneration** and ≈700 are unrelated agent/workflow config (see [No action](#no-action-wontfix-and-deferred)).

```
 .github/agents/code-reviewer.agent.md              |    2 +-
 .opencode/agents/action-plan-implementer.md        |   27 +-
 .opencode/agents/agent-orchestrator.md             |    6 +-
 .opencode/agents/code-reviewer.md                  |   17 +-
 .opencode/agents/data-shapes-agent.md              |    1 -
 .opencode/agents/de-sloppification.md              |    1 -
 .opencode/agents/docs.md                           |    1 -
 .opencode/agents/implementation.md                 |    2 +-
 .opencode/agents/playwright.md                     |  179 +-
 .opencode/agents/testing-specialist.md             |    2 +-
 .opencode/plugins/no-task-resume.ts                |   58 +
 .opencode/skills/pre-pr-review/SKILL.md            |   59 +-
 ACTION_PLAN.md                                     |  306 ++
 AGENTS.md                                          |    6 +-
 SPEC.md                                            |   90 +
 TASK_PREVIEW_SOURCE_LINK_LAYOUT.md                 |   82 +
 docs/developer/ACTION_PLAN_TEMPLATE.md             |   13 +-
 docs/developer/data-shapes/assignment.md           |   46 +-
 .../data-shapes/frontend-data-analysis-response.md |   94 +
 ...end-shared-helpers-and-abstraction-standards.md |   19 +-
 docs/developer/frontend/frontend-testing.md        |    2 +
 docs/developer/testing/synthetic-test-data.md      |   35 +
 .../synthetic-test-data/generateClassRosters.js    |   37 +-
 .../synthetic-test-data/planClassAssignments.js    |    5 +-
 .../e2e-tests/helpers/task-heatmap-fixtures.ts     |   19 +
 .../helpers/task-preview-header-regions.ts         |  320 ++
 .../task-preview-source-link-expectations.ts       |  380 +++
 .../helpers/task-preview-source-link-fixtures.ts   |  468 +++
 .../helpers/task-preview-source-link-geometry.ts   |  454 +++
 .../helpers/task-preview-source-link-helpers.ts    |  346 +++
 .../helpers/task-preview-source-link-journeys.ts   |  123 +++
 .../helpers/task-preview-source-link-scenarios.ts  |  199 +++
 .../e2e-tests/task-preview-source-link.spec.ts     |  301 ++
 .../task-preview-source-link.states.spec.ts        |  283 ++
 .../task-preview-source-link.visual.spec.ts        |  481 +++
 .../TaskMetricPreviewCell.focus.spec.tsx           |  207 ++
 .../TaskMetricPreviewCell.focusSession.spec.tsx    |  242 ++
 .../taskHeatmap/TaskMetricPreviewCell.module.css   |   16 +
 .../taskHeatmap/TaskMetricPreviewCell.spec.tsx     |  170 ++
 .../features/taskHeatmap/TaskMetricPreviewCell.tsx |  309 ++
 .../taskHeatmap/TaskMetricPreviewContent.spec.tsx  |  169 ++
 .../taskHeatmap/TaskMetricPreviewContent.tsx       |  121 +
 .../TaskPreviewCard.sourceLink.spec.tsx            |  246 ++
 .../features/taskHeatmap/TaskPreviewCard.spec.tsx  |   28 +-
 .../taskHeatmap/TaskPreviewCard.status.spec.ts    |    1 +
 .../src/features/taskHeatmap/TaskPreviewCard.tsx   |  195 +-
 .../taskHeatmap/assembleMergedPreviewData.spec.ts  |   60 +-
 .../assembleTaskPreviewData.sourceUrl.spec.ts      |  143 +
 .../taskHeatmap/assembleTaskPreviewData.spec.ts    |   64 +-
 .../taskHeatmap/assembleTaskPreviewData.ts         |   12 +-
 .../buildCellPreviewLookup.content.spec.ts         |  192 ++
 .../buildCellPreviewLookup.indexing.spec.ts        |  289 ++
 .../buildCellPreviewLookup.sourceLink.spec.ts      |  324 +++
 .../taskHeatmap/buildCellPreviewLookup.spec.ts     | 865 +-----
 .../features/taskHeatmap/buildCellPreviewLookup.ts |  104 +-
 .../taskHeatmap/taskHeatmapTableColumns.tsx        |  142 +-
 .../assignmentAssessment.artifacts.zod.spec.ts     |  232 ++
 .../assignmentAssessment.zod.fixtures.ts           |  169 +-
 .../assignmentAssessment.zod.spec.ts               |  209 --
 .../assignmentAssessment.zod.ts                    |    8 +-
 .../buildCellPreviewLookupTestFixtures.spec.ts     |   99 +
 .../buildCellPreviewLookupTestFixtures.ts          |  156 +
 .../src/test/taskHeatmap/previewFixtures.ts        |  338 ++
 .../taskHeatmap/previewSourceActionTestHelpers.ts  |  308 ++
 .../src/test/taskHeatmapTableTestHelpers.ts        |    5 +
 .../large-representative/assignmentsByKey.json     | 1336 ++++-----
 .../large-representative/classesById.json          | 1048 +++----
 .../medium/assignmentsByKey.json                   | 3048 ++++++++++----------
 .../synthetic-analysis/medium/classesById.json     | 2584 ++++++++---------
 .../synthetic-analysis/small/assignmentsByKey.json |  576 ++--
 .../data/synthetic-analysis/small/classesById.json |  588 ++--
 .../syntheticAssignmentTimestamps.test.ts          |  483 ++++
 .../syntheticGraphShapeCoverage.test.ts            |   17 +-
 .../syntheticStudentIdentifiers.test.ts            |  378 ++++
 74 files changed, 13924 insertions(+), 6021 deletions(-)
```

```

```
