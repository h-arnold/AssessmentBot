# Pre-PR Review — docs/taskheatmap-extraction-spec

- **Base branch:** main
- **Generated:** 2026-08-24T21:30:00Z
- **Regression gate:** PASS — 0 regressions, 0 new failures, **4 fixes** vs a freshly captured sequential-fingerprint baseline from `main`. The only failing check (`backend-lint-check`, 14 `max-lines` warnings) fails identically on `main` and is excluded by owner decision.
- **Changed files:** 41 (+1229 / −241)

```text
 .opencode/agents/agent-orchestrator.md             |   2 +-
 .opencode/agents/data-shapes-agent.md              |   4 +-
 .opencode/agents/docs.md                           |   4 +-
 .opencode/agents/implementation.md                 |   4 +-
 .opencode/agents/planner.md                        |   2 +-
 .opencode/agents/testing-specialist.md             |   4 +-
 ACTION_PLAN.md                                     | 520 +++++++++++++++++
 SPEC.md                                            | 221 ++++++++
 ...end-shared-helpers-and-abstraction-standards.md |  64 +--
 .../developer/frontend/metric-display-precision.md |   4 +-
 .../frontend/navigation-consistency-status.md      |   6 +-
 src/frontend/AGENTS.md                             |   1 +
 .../src/features/classPage/ClassPage.spec.tsx      |   2 +-
 .../features/classPage/ClassPageContent.spec.tsx   |   2 +-
 .../src/features/classPage/ClassPageContent.tsx    |   2 +-
 .../src/features/classPage/classPageAdapter.ts     |   3 +-
 .../src/features/classPage/classPageModel.spec.ts  |  90 +---
 .../src/features/classPage/classPageModel.ts       |  84 +---
 .../classPage/studentAveragesTableColumns.tsx      |   2 +-
 .../TaskHeatmapPage.spec.tsx                       |   0
 .../{classPage => taskHeatmap}/TaskHeatmapPage.tsx |   3 +-
 .../TaskHeatmapTable.spec.tsx                      |   3 +-
 .../TaskHeatmapTable.tsx                           |   9 +-
 .../TaskPreviewCard.spec.tsx                       |   0
 .../{classPage => taskHeatmap}/TaskPreviewCard.tsx |   0
 .../assembleTaskPreviewData.spec.ts                |   0
 .../assembleTaskPreviewData.ts                     |   0
 .../buildCellPreviewLookup.spec.ts                 |   0
 .../buildCellPreviewLookup.ts                      |   0
 .../spreadsheetToMarkdownTable.spec.ts             |   0
 .../spreadsheetToMarkdownTable.ts                  |   0
 .../features/taskHeatmap/taskHeatmapModel.spec.ts  |  58 ++
 .../src/features/taskHeatmap/taskHeatmapModel.ts   |  31 +
 .../dataAnalysis/compareStudentNames.spec.ts       | 132 +++
 .../services/dataAnalysis/compareStudentNames.ts   |  34 +
 .../metricDisplay/metricStateRank.spec.ts          |  90 ++
 .../dataAnalysis/metricDisplay/metricStateRank.ts  |  45 +
 (plus, in later commits:)
 e2e-tests/classes-page.spec.ts                     |  25 ++++---
 e2e-tests/settings-backend.spec.ts                 |   9 +
 e2e-tests/task-preview-card.spec.ts                |   8 +--
 .ts-regression-checker/regression.config.json      |   2 +-
```

## Verdict

**Needs Improvement** — no focus reported a Critical; four focuses returned small branch-introduced Improvements/Nitpicks (documentation numbering integrity, a stale header comment, orphaned tracked PNGs, two test-assertion refinements) that should be resolved or consciously accepted before merge.

---

## Focus areas

### Repo rule compliance

Verdict per reviewer: FAIL (one documentation-consistency nitpick introduced by this branch); extraction code itself clean and fully rule-compliant.

- Dependency-direction rule holds: `features/taskHeatmap/**` has **zero** `features/classPage/**` imports; classPage's only import is the `ClassPageContent.tsx:43` composition edge. (`vi.mock` path updates in `ClassPage.spec.tsx:129` and `ClassPageContent.spec.tsx:55` are the required red-phase strings.)
- All relocated comparators resolve to their new homes; no stale `classPageModel` imports; `classPageModel.spec.ts` lost both moved describe blocks plus the orphaned `HeatmapRow` import.
- `compareHeatmapStudentName` delegates cast-free to `compareStudentNames`; `METRIC_STATE_RANK_DESC` is consumed internally by `getMetricStateRank` (not dead).
- No `console.*`, no empty catches; British English; `export function` declarations (AGENTS §2); all files ≤ 500 lines; `src/frontend/AGENTS.md` §3.3 updated; flat/`metricDisplay` placement correct.
- **[Nitpick] `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md:571`** — §9.18 reclassification removed the `#### 9.18.10` heading and its `14.` item, but the next entry's helper item is still numbered `15.`, leaving a visible `13 → 15` numbering gap with no `14.`. Cosmetic only (no stale `§9.18.10` cross-references remain), but it is branch-introduced.
- Full review: `.opencode/scratchpad/pre-pr-review/repo-rule-compliance-review.md`

#### Incidental (triage)

- E2E auth-fixture semantics change; settings tab-order repair (verified production `Authentication options` field exists); screenshot redirect to `outputDir` (good hygiene); `regression.config.json` parallel→false (consider adding a comment); bundled agent-model admin changes mixed into the branch (scope observation); acknowledged pre-existing §9.18.2 "in Section 4" stale reference.

### KISS & DRY

Verdict: PASS — zero findings for this focus. The extraction centralises student-name ordering and metric-state ranking into exactly one source of truth each in the services layer; no duplicated comparison logic survives; new modules are single-responsibility and thin.

- Key evidence: `compareStudentNames` defined once at `services/dataAnalysis/compareStudentNames.ts:25`; `compareHeatmapStudentName` (`taskHeatmapModel.ts:27`) is pure delegation (line 30). Rank maps defined once at `metricStateRank.ts:17,24,42`. All consumers repointed; spec relocation is clean.
- Full review: `.opencode/scratchpad/code-review-kiss-solid-dry-taskheatmap.md`

#### Incidental (triage)

- Conceptual duplication of metric-comparator _composition_ between `TaskHeatmapTable.tsx:134-151` and `classPageModel.ts:40-62` (rank → value → id tie-break repeated) — intentional per SPEC scope; candidate for a future shared `metricDisplay` helper.
- `compareHeatmapStudentName` is redundant under structural typing but SPEC-mandated.
- Analyser layer has its own case-sensitive name ordering (`averagingAnalyser.rows.ts:107-109`) — separate domain, out of scope.

### De-Sloppification

Verdict: Needs Improvement. No Critical findings; one cluster of branch-introduced stale artefacts around the screenshot redirection plus low-severity test-noise items.

- **[Improvement] `src/frontend/e2e-tests/task-preview-card.spec.ts:6-7`** — Stale header comment: still claims screenshots are captured "into task-preview-card.spec.ts-snapshots/", but this branch redirected all four screenshot calls (`:113-115`, `:140-142`, `:163-165`, `:192-194`) to `test.info().outputDir`. Update to describe the untracked output dir.
- **[Improvement] `src/frontend/e2e-tests/task-preview-card.spec.ts-snapshots/`** — Four tracked PNGs (`image-completeness-hover.png`, `text-accuracy-hover.png`, `table-spag-hover.png`, `completeness-pinned.png`) are manual `page.screenshot({ path })` outputs, not visual-comparison snapshots; after the redirection no test produces them. Dead tracked binaries that historically caused recurring churn — recommend `git rm` of all four (and the directory), keeping only `navigation-screenshots.spec.ts-snapshots/`.
- **[Improvement] `src/frontend/src/services/dataAnalysis/compareStudentNames.spec.ts:26-27, 97-99`** — Over-defensive arity assertion (`COMPARATOR_DECLARED_PARAMETERS = 2` + `.toHaveLength(2)`): tests an implementation detail, brittle against future optional parameters, redundant with the behavioural operand-swap/inversion assertions at `:108-115`. Recommend dropping it.
- **[Improvement] `src/frontend/src/features/taskHeatmap/taskHeatmapModel.ts:27-31`** — Single-caller pass-through wrapper (consumed only at `TaskHeatmapTable.tsx:393, 423`). Explicitly SPEC-mandated and acknowledged in ACTION_PLAN — recorded as a standing simplification opportunity, not a blocker.
- **[Nitpick] `taskHeatmapModel.ts:28-29`** — Redundant inline comment narrating the removed cast; JSDoc already covers it.
- **[Nitpick] `metricStateRank.ts:24`** — `METRIC_STATE_RANK_DESC` exported with no production consumer (SPEC-mandated symmetry).
- **[Nitpick] `metricStateRank.ts:44`** — Unreachable-in-practice `?? 0` fallback for unknown states (closed union); inherited verbatim per SPEC, spec test must cast to reach the branch.
- **[Nitpick] `.ts-regression-checker/regression.config.json:4-5`** — `maxWorkers: 1` inert once `enabled: false`; pre-existing field made semantically dead by the flip.
- **[Nitpick] `TaskHeatmapPage.tsx:9`, `TaskHeatmapTable.tsx:15`, `TaskHeatmapTable.spec.tsx:9`** — Bare `@see SPEC.md` pointers carry no target (trim was SPEC line 204-authorised).

#### Incidental (triage)

- Stale phase narration/dead anchors in `task-preview-card.spec.ts:2,9-11,13-14` ("RED phase", `ACTION_PLAN.md §8`, "Task Preview Card contract") — file not covered by SPEC's moved-file header-refresh authorisation but was edited by this branch; tidy in follow-up.
- Commit `93eb112` changes sub-agent `model:` lines — unrelated to the extraction; consider isolating config/admin changes into their own PR.

### Performance (Big-O)

Verdict: PASS — no algorithmic-complexity regression versus `main`; every relocated routine has a byte-identical computational body.

- `compareStudentNames` (`compareStudentNames.ts:25-33`): O(L_name + L_id) per call; byte-identical to `main:classPageModel.ts:126-132`. `localeCompare(b.studentName, undefined, …)` reuses V8's cached default collator — no repeated locale instantiation.
- `getMetricStateRank` O(1); rank maps constructed once at module load; sort integrations remain O(n log n · L), unchanged.
- Full review: `.opencode/scratchpad/pre-pr-review/perf-bigo-review.md`

#### Incidental (triage)

- `localeCompare` comparator dominates for large classes; shared `Intl.Collator` could optimise — unchanged by this PR.
- `sortedRows` sorts the full row set rather than the 50-row pagination window (`TaskHeatmapTable.tsx:392-395`) — pre-existing.

### Logging rules compliance

Verdict: PASS — zero findings. Extraction preserves heatmap logging/error behaviour verbatim: no `console.*` in any changed code; every `logFrontendError`/`logFrontendEvent` retains the `'TaskHeatmapPage'` context (`TaskHeatmapPage.tsx:174-176,179-187,192-196,200-205`); no double-logging; relocated helpers are logging-free/throw-free.
Full review: `.opencode/scratchpad/pre-pr-review/review-logging-taskheatmap.md`

### Frontend layout / design / accessibility

Verdict: PASS — zero findings. Spacing tokens (`APP_GAP_MD`, `APP_GAP_XS`, `APP_COL_WIDTH_*`), skeleton semantics (`aria-busy="true"`/labels), popover trigger roles, and motion conventions are byte-identical. E2E tab journeys verified against real DOM order (`apiKey → backendUrl → authGroupEmail → authMode → backendAssessorBatchSize` in `BackendSettingsPanel.tsx`) — journeys match exactly.
Full review: `.opencode/scratchpad/review-focus-layout-a11y.md`

#### Incidental (triage)

- `TaskHeatmapTable.tsx:190-193` — skeleton relies on `<output>`'s implicit `status` role rather than explicit `role="status"`; functionally acceptable, possible future hardening.

### Frontend data shape / schema consistency

Verdict: PASS — zero findings. All preserved surfaces share the minimal structural `{ studentName: string; studentId: string }` via structural typing; the previous `as unknown as StudentAverageRowModel` cast is gone (zero matches across `src/frontend`); no lossy/narrowed types introduced; `TaskHeatmapPage` call site preserves the exact 6-prop contract with no drift.
Full review: `.opencode/scratchpad/taskheatmap-viewmodel-review.md`

### Security & secrets

Verdict: PASS — zero findings. No hardcoded credentials/secrets; markdown-render surfaces are content-identical renames with sanitisation posture verified intact (`MarkdownRenderer` omits `rehype-raw`; react-markdown default URL transform strips unsafe schemes; pipes escaped at `spreadsheetToMarkdownTable.ts:21`); E2E auth mocks confined to the Playwright browser context; regression config contains nothing secret-bearing.
Full review: `.opencode/scratchpad/pre-pr-review/security-review-taskheatmap.md`

### Test-coverage gaps

Verdict per reviewer: FAIL (two coverage-quality gaps).

- **[Improvement] `src/frontend/src/features/taskHeatmap/taskHeatmapModel.spec.ts:21-28`** — Delegation equivalence between `compareHeatmapStudentName` and canonical `compareStudentNames` is asserted for only ONE input pair. The case-insensitive (`:49-57`) and tie-break (`:39-47`) tests assert the wrapper's own sign but not equivalence to the canonical comparator, so a future divergence would stay green — under-pins the SPEC's "exactly one source of truth" contract.
- **[Nitpick]** Neither `compareStudentNames.spec.ts` nor `taskHeatmapModel.spec.ts` asserts the identical-input (`name`+`studentId` equal) → `0` branch (`compareStudentNames.ts:29-33`). Untested, though trivial.
- Positive verifications: rank-map coverage stricter than prior state; auth-fixture change asserted through `AppAuthGate` gating (`AppAuthGate.auth.spec.tsx:222-238`) so shell-visible assertions genuinely test post-auth render; no edge-case coverage lost in transit (only a vacuous RED-phase `typeof === 'function'` test dropped, superseded by real fixtures).
- Full review: `.opencode/scratchpad/review-test-coverage-taskheatmap.md`

#### Incidental (triage)

- `settings-backend.spec.ts` Authentication-options focus assertions are real and meaningful; `snapshotDir → outputDir` is harness correctness, not coverage change; pending-auth negative path already covered by `AppAuthGate.auth.spec.tsx`.

### Error-handling robustness

Verdict: PASS — zero findings. All error-handling code moved verbatim (title-unavailable Alert, generic-error log-toast-back with `useLogOnce`-guarded single `onBack`, query error/not-found guards, popover error handling); no broad swallow, missing rethrow, weakened guard, or toast-semantics drift.
Full review: `.opencode/scratchpad/review-error-handling-taskheatmap-extraction.md`

#### Incidental (triage)

- `assembleTaskPreviewData.ts:98-106,120-135` throw `TypeError` on null/invalid artifact content while `CellPreviewData.artifactContent` types permit `null` (`buildCellPreviewLookup.ts:25-29`), so a contract-valid payload could throw during popover render with no local catch/error boundary. Recommended for a future non-extraction cycle: make `assembleTaskPreviewData` total or wrap the popover in an error boundary.

### Data-shape docs consistency

Verdict per reviewer: FAIL (documentation-integrity defect in the canonical helper registry; no data-shape contract contradicted).

- **[Improvement] `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md:547-733`** — `§9.18.11` is physically mispositioned (sits between `§9.18.1` at L551 and `§9.18.2` at L582 instead of after `§9.18.9`/before `§9.18.12`). This is the root cause of the `13 → 15` item-numbering gap noted by the repo-rule review, and contradicts the plan's "§9.18 numbering stable" claim.
- **[Nitpick] same file (~L571)** — Orphaned helper-item counter `15.` and missing `14` in the global §9.18 sequence (reads `1, 15, 2…13, 16`). Renumber when relocating I-1.
- **[Nitpick] same file (~L594)** — Pre-existing dangling "in Section 4" reference retained in the §9.18.2 bullet; acknowledged in `ACTION_PLAN.md:640` as a future-docs-pass follow-up.
- Tasks verified clean: diff touches no `docs/developer/data-shapes/` file; comparator re-typing is frontend-internal TS structural typing, not a wire/persistence/transport shape; owning paths/signatures/delegation targets in helper docs match actual code; `metric-display-precision.md` line references verified accurate; `src/frontend/AGENTS.md:61` entry present.
- Full review: `.opencode/scratchpad/pre-pr-review/data-shape-consistency-review.md`

### Backend data shape / schema consistency

_(not in scope for this diff — no backend files changed)_

---

## Regression gate detail

| Run                                     | Config           | Result                                                                                |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| Baseline (22 Aug, original)             | parallel lanes   | e2e FAILING (4 known settings-backend failures), 222 tests reported                   |
| Branch sign-off run (22 Aug 12:27)      | parallel lanes   | 0 regressions / 0 new failures                                                        |
| Tonight run 1 (23:51 UTC)               | parallel lanes   | 146 regressions / 141 new failures — **contention noise**, disproved by isolated runs |
| Fresh baseline from `main` (sequential) | sequential lanes | e2e FAILING with exactly the 4 settings-backend tests (218 passed)                    |
| **Final compare (branch + fixes)**      | sequential lanes | **e2e PASSING — 0 regressions / 0 new failures / 4 fixes**                            |

Root cause of tonight's noise: the checker scheduler runs the Playwright lane concurrently with lint/vitest lanes (`runners/index.ts:43,240-243`); on a 4-core host, E2E workers (config `workers: 2`, `retries: 2`, 45s timeout) get starved, producing wildly varying mass timeouts. Sequential execution (`parallel.enabled: false`) yields reproducible results and is committed in `f57fbb8`.

---

## Decisions

Recorded from the post-review decision pass (21 findings walked through one at a time with the owner). Remediation was implemented by delegated agents (Playwright / Testing Specialist / Implementation / Docs), submitted to Code Reviewer until a clean PASS was returned on the second pass, and verified with `npm run lint:frontend`, `tsc -b src/frontend/tsconfig.json`, and the full frontend unit suite (147 files / 1797 tests green).

### Improvements

- **[1] §9.18.11 mispositioned + `13 → 15` numbering gap** (`frontend-shared-helpers-and-abstraction-standards.md`) — Decision: **Fix now**. Approach: Docs agent relocated §9.18.11 to its correct ordinal position (after §9.18.9, before §9.18.12) and renumbered the helper-item counters to a contiguous sequence; reviewer confirmed heading order and counter integrity.
- **[2] Stale screenshot header** (`task-preview-card.spec.ts:6-7`) — Decision: **Fix now**. Approach: Playwright agent rewrote the header to describe popover rendering/pinning coverage and the untracked `test.info().outputDir` screenshot destination; dead § anchors dropped. Verified comment-only via review.
- **[3] Orphaned tracked PNGs** (`task-preview-card.spec.ts-snapshots/`) — Decision: **Fix now**. Approach: `git rm` all four debug screenshots and the now-empty directory; genuine visual snapshots under `navigation-screenshots.spec.ts-snapshots/` untouched.
- **[4] Brittle arity assertion** (`compareStudentNames.spec.ts:26-27,97-99`) — Decision: **Fix now**. Approach: removed `COMPARATOR_DECLARED_PARAMETERS` and the `.toHaveLength(2)` assertion; behavioural operand-swap/inversion assertions retained as the contract lock.
- **[5] One-pair delegation-equivalence coverage** (`taskHeatmapModel.spec.ts`) — Decision: **Fix now**. Approach: case-insensitivity and tie-break tests extended to assert `compareHeatmapStudentName(a,b)` equals canonical `compareStudentNames(a,b)`, guarding SPEC decision 4's single-source-of-truth contract against future divergence.

### Nitpicks

- **[6] Redundant inline comment** (`taskHeatmapModel.ts:28-29`) — Decision: **Fix now**. Deleted; module JSDoc already documents the cast-free delegation.
- **[7] Inert `maxWorkers` field** (`regression.config.json`) — Decision: **Fix now**. Removed; `"enabled": false` retained unambiguously.
- **[8] Bare `@see SPEC.md` pointers** (three moved files) — Decision: **Wontfix**. The trim was explicitly authorised by SPEC line 204; restoring § anchors would rot as SPEC evolves.
- **[9] Identical-input → 0 branch untested** (`compareStudentNames.ts:29-33`) — Decision: **Fix now**. New spec test asserts exactly zero for identical name+id.
- **[10] Single-caller wrapper indirection** (`taskHeatmapModel.ts:27-31`) — Decision: **Wontfix**. SPEC decision 4 mandates keeping `HeatmapRow` typing at the heatmap call site; revisit only if SPEC is re-litigated.
- **[11] Consumer-less `METRIC_STATE_RANK_DESC` export** (`metricStateRank.ts:24`) — Decision: **Wontfix**. SPEC-authorised export symmetry with `_ASC`; candidate to privatise if the future embeddable surface never consumes it.
- **[12] Unreachable `?? 0` fallback** (`metricStateRank.ts:44`) — Decision: **Wontfix**. Relocated verbatim under SPEC's behaviour-preservation rule; removal would amend the move.

### Incidental triage

- **[13] Stale RED-phase narration/dead anchors** (`task-preview-card.spec.ts` header) — Decision: **Fix now** (owner overrode fix-later recommendation). Resolved together with item [2].
- **[14] Unrelated admin commit `93eb112` bundled in branch** — Decision: **Wontfix**. Self-contained `.opencode/agents/*.md` model-line change with no code impact; accepted.
- **[15] Duplicated metric-comparator composition across features** — Decision: **Fix now** (owner-directed scope amendment beyond SPEC's organisational-only cycle). Approach: Implementation agent extracted shared `compareMetricsByStateRank(...)` into `services/dataAnalysis/metricDisplay/metricComparator.ts`; both consumers delegate; co-located spec added; helper registry gained §9.17 entry 7. Reviewer adjudicated the deliberate edge-case unification (heatmap rows with exactly equal computed values now tie-break by `studentId` ascending, fulfilling the old comparator's own documented but unhonoured contract) as SOUND with no guard needed.
- **[16] Shared `Intl.Collator` optimisation** (`compareStudentNames.ts`) — Decision: **Fix later**. Deferred to a future performance cycle; behaviour-preservation makes comparator micro-optimisation a poor fit here.
- **[17] Full row-set sort vs pagination window** (`TaskHeatmapTable.tsx:392-395`) — Decision: **Fix later**. Pre-existing on `main`; future optimisation candidate.
- **[18] Explicit `role="status"` on skeleton `<output>`** — Decision: **REVERTED after review**. Owner initially chose Fix now; Code Reviewer then identified that §9.16a of the shared-helpers standard deliberately documents this exact pattern WITHOUT the explicit attribute (`<output>`'s implicit status role suffices; the explicit role was previously removed as a SonarCloud `S6822` redundancy smell). Owner resolved the contradiction by reverting the attribute; final disposition aligns with the written standard. No doc amendment made.
- **[19] `assembleTaskPreviewData` throw on contract-valid null payloads** — Decision: **Wontfix**. Owner accepts current throw behaviour; recorded so future reviewers do not re-raise.
- **[20] Dangling "in Section 4" reference** (§9.18.2 bullet) — Decision: **Fix now**. Repaired in the same docs pass as item [1]; note the stale pointer's ACTION_PLAN location is L507 (not :640 as first cited).
- **[21] Commit `PR_REVIEW.md` with decisions** — Decision: **Approved**. This document is committed to the branch once the remediation batch lands.

### Follow-ups surfaced during remediation (not blocking)

> **Status: all four RESOLVED** in the follow-up remediation batch (owner-directed), reviewed clean by Code Reviewer and verified with lint/tsc/full unit suite (zero warnings) plus a full regression-checker run in which every check exited 0 (the sole failing check remains the owner-acknowledged backend-lint max-lines warnings; formal regression counts were unavailable on that run solely because removing the inert `maxWorkers` field changed the config fingerprint — raw per-check results were uniformly green).

- ~~`eslint.config.js:247` still lists the pre-extraction path~~ **RESOLVED** — override repointed to `src/features/taskHeatmap/TaskHeatmapTable.tsx`; reviewer confirmed the triage comment matches the file's bracket-access pattern and no other config references the stale path.
- ~~Pre-existing explicit `role="status"` attributes on `<div>` elements may warrant an accessibility-consistency pass~~ **RESOLVED via documentation** — new §8.1 of `frontend-loading-and-width-standards.md` records the canonical rule: `<output>` relies on its implicit status role (never add explicit `role="status"`); generic containers such as `<div>` REQUIRE explicit `role="status"`. Both existing patterns comply; no production churn.
- ~~Vitest hoisting warnings from `src/hooks/usePageDataset.spec.ts`~~ **RESOLVED** — the nested `vi.hoisted(...)` block and three `vi.mock(...)` factories moved to module top level (source position now matches actual execution order); zero warnings, semantics unchanged.
- ~~§9.18.12 prose claims "`buildHeatmapTableColumns` is internal"~~ **RESOLVED** — entry rewritten to match code reality (`useMemo` assembly with `buildTaskMetricSubColumns`, positional `cells[taskIndex]` access via `getCellMetric`, corrected pagination and 17-test inventory).

Remaining (future cycles, owner-deferred): shared `Intl.Collator` optimisation; pagination-window sorting; `ReferenceDataInitialLoadingState.tsx:27` optional-`role` prop watch item.
