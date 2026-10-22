# Pre-PR Review — feat/frontend-abclass-metadata

- **Base branch:** main (merged latest `origin/main` cleanly before review)
- **Generated:** 2026-10-21T07:37:19+00:00
- **Regression gate:** CONDITIONAL PASS — 7/8 checks pass; `backend-lint-check` fails only on six pre-existing `max-lines` warnings in backend test files, explicitly accepted by the user as not-new regressions. First baseline run: zero recorded regressions and zero new failures.
- **Changed files:** 154 (+17,102 / −5,979). Diff and file list: `.opencode/scratchpad/pre-pr-review/{branch.diff,diff-stat.txt,changed-files.txt}`.
- **Delegation note:** four focuses (KISS & DRY, Logging, Layout/A11y, Coverage) were first attempted with review agents whose default model ran conflicting mandatory checks; they were completed statically with model `opencode-go/glm-5.3-flash` after the user requested a rerun specifying the model. Full agent reports are under `.opencode/scratchpad/pre-pr-review/` unless noted.

## Verdict

**Fail** — two Critical findings (post-analysis feedback can be silently suppressed, and it can also be silently dropped when the notification host lacks `warning`). No Critical from an automated check; all suites and the regression gate pass apart from the accepted pre-existing lint warnings.

---

## Focus areas

### Repo rule compliance

- **[Critical] RRC-1 — `src/frontend/src/hooks/postAnalysisFeedback.ts:57-58`: a missing notification provider is silently accepted.** `show()` explicitly permits a missing `host.warning` and returns without reporting the configuration error. `usePostAnalysisTasks.ts:171` obtains the host from `App.useApp()`; antd's installed default context (`node_modules/antd/es/app/context.js`) supplies an empty notification object outside an `<App>` provider. A mounted metadata failure can then lose its required warning with no indication that the App boundary is missing. Violates the fail-loudly rule (`src/frontend/AGENTS.md` §2 / root AGENTS.md 2.1.2). Remedy: require the real host; provide it in the test harness instead of making this production dependency optional.
- **[Improvement] RRC-2 — `tests/synthetic-analysis/syntheticABClassMetadataRoundTrip.test.ts:28-31,42-44`: the suite overwrites `globalThis.google` and then unconditionally deletes it,** losing any original value/property rather than restoring it. This is the explicitly prohibited cleanup pattern in `docs/developer/backend/backend-testing.md:694-754` and `docs/developer/frontend/frontend-testing.md:656-679`. Remedy: install with `vi.stubGlobal` and restore with `vi.unstubAllGlobals`, retaining the existing shared transport harness.

Incidental: none.

### KISS & DRY

- **[Improvement] D1 — `createPostAnalysisContext` plus the whole post-analysis wiring block duplicated verbatim across two features.** `src/frontend/src/features/classPage/useClassPageData.ts:108-130,424-436` vs `src/frontend/src/features/taskHeatmap/useHeatmapsPageData.ts:130-153,367-379` (~40 lines; same guard, registry construction, status alias, memo, `usePostAnalysisTasks` call). Contract evolution requires lockstep edits; drift is caught only late, by the runtime schema parse inside `attach`. Remedy: one shared hook (e.g. `usePagePostAnalysisTasks`) in `src/frontend/src/hooks/`, outside `features/classPage` so the `taskHeatmap → classPage` import ban is respected.
- **[Improvement] D2 — "Newest canonical assignment + ID tiebreak" ordering reimplemented in diagnostics.** `postAnalysisDiagnostics.ts:20-30` vs the real refresh-target selection at `metadataProjection.ts:41-47` (identical comparator, but filtering vs parsing is a genuine behavioural difference). If the rule changes in one place, diagnostics misattribute the failed refresh target. Remedy: export the comparator once from `metadataProjection.ts`; keep the validity filters separate.
- **[Improvement] D3 — The `'refreshABClassMetadata'` task-ID literal is spread across four production modules:** `postAnalysisTasks.ts:17` (definition), `postAnalysisDiagnostics.ts:19`, `postAnalysisFeedback.ts:82`, `postAnalysisInvalidation.ts:22`. It is the routing key for feedback, invalidation and diagnostics; a missed site fails silently. Remedy: export a single `REFRESH_AB_CLASS_METADATA_TASK_ID` constant from `postAnalysisTasks.ts`.
- **[Nitpick] K-N1 — Source-version signature mapping duplicated** between `postAnalysisTasks.ts:45,50` and the unkeyed feedback fallback at `usePostAnalysisTasks.ts:142-146`. Low impact today (single keyed task in production). Remedy: one `sourceVersionSignature(assignments)` helper.
- **[Nitpick] K-N2 — Unreachable null guard in `mergeClassMetadata`** (`metadataProjection.ts:145`) — parsing an always-object literal through `z.union([z.null(), …])` can never take the null branch; the check exists only to satisfy the return type. Parse with the non-nullable inner schema or comment the line as a narrowing guard.
- **[Nitpick] K-N3 — `PostAnalysisTaskRegistry` is a single-field class whose name over-promises** (`postAnalysisTasks.ts:8-24`): both callers construct it and immediately take `.tasks`. Remedy: plain factory `createPostAnalysisTaskDescriptors(now)`; can ride along with D3.
- **[Nitpick] K-N4 — `updateABClass` transport chain written twice** (`abClassMutationService.ts:40-45` queued vs `abClassMetadataService.ts:63-70` non-queued). Deliberate deadlock-avoidance duplication, five lines, documented both sides. Optional single non-queued helper only if those modules are touched anyway.

Explicitly reviewed and accepted (no finding): queue entry generalisation; double `getMetadataRefreshDecision` evaluation (freshness-motivated); `.extend` reuse in the outcome schema; task-list double validation; the abClass fixture-layer split.

Incidental (pre-existing, out of PR scope): two hand-rolled preview-truncation implementations in `apiService.ts:93-99,122-131`; test-accommodation factory `createAnalysisService` in `useClassPageData.ts:211-225`.

### De-Sloppification

- **[Critical] S-C1 — Post-analysis wiring block + `createPostAnalysisContext` cloned verbatim across two features.** Same discovery as KISS & DRY D1 (above); considered the eligibility gate for persistence-authorising work, so any change must be made twice. _(Decision will be taken jointly with D1.)_
- **[Improvement] S-I1 — `MetadataRefreshContext` clones `PostAnalysisContext` and declares `averagingResult` the function never reads** (`refreshABClassMetadata.ts:10-14,26`). The sole caller passes a full `PostAnalysisContext`; the type implies the refresh consumes the display averaging result, which its own `@remarks` forbids. Remedy: type the parameter as `PostAnalysisContext` and delete `MetadataRefreshContext`.
- **[Improvement] S-I2 — "Newest canonical assignment" selection implemented three times:** `metadataProjection.ts:38-47`, `postAnalysisDiagnostics.ts:18-29`, `postAnalysisTasks.ts:37-41`. Writer and failure diagnostic can disagree about which assignment a failed refresh targeted. _(Decision will be taken jointly with D2.)_
- **[Improvement] S-I3 — `classesBulkMutation` lane name duplicated as unlinked literals:** `abClassMutationService.ts:11` (`JOB_NAME`) vs `abClassMetadataService.ts:39` (`runApiQueuedTask('classesBulkMutation', …)`). The reserved-slot contract's safety property is that both parties enqueue on the same lane string; a rename in one file silently forks the lane and re-opens the serialisation race. No import cycle exists. Remedy: export the lane constant and import it.
- **[Improvement] S-I4 — Unreachable null guard in `mergeClassMetadata`** — same as K-N2. (**Joint with K-N2.**)
- **[Improvement] S-I5 — Provably redundant conjunct in `isExactRecord`:** `abClassMetadata.zod.ts:127-134` — line 128 (`ownKeys.length === keys.length`) plus line 132 (every required key is own) already force identical key sets, so line 133's `ownKeys.every((key) => typeof key === 'string' && keys.includes(key))` can never fail. Remedy: drop line 133; keep the plain-prototype and non-array checks.
- **[Nitpick] S-N1 — Skip-reason union duplicated with a runtime drift consequence:** `postAnalysis.zod.ts:27` re-enumerates `z.enum(['noAssignments','unchanged','staleSource'])` declared as a manual union at `metadataProjection.ts:20`; a fourth reason would fail `PostAnalysisTaskResultSchema.parse` and convert a legitimate no-op into a spurious "Class summary not saved" warning. Remedy: pin with `satisfies readonly MetadataRefreshSkipped['reason'][]`.
- **[Nitpick] S-N2 — Speculative `!host.warning` guard** (`postAnalysisFeedback.ts:58`) — same site as RRC-1. (**Joint with RRC-1.**)
- **[Nitpick] S-N3 — Assignment-version serialisation near-duplicate:** `postAnalysisTasks.ts:43-52` vs `usePostAnalysisTasks.ts:142-147` — same as K-N1. (**Joint with K-N1.**)
- **[Nitpick] S-N4 — e2e constant hygiene in `post-analysis-metadata.persistence.spec.ts`:** `MAX_EXPECTED_CLASS_READS` (line 15) and `EXPECTED_CLASS_READ_COUNT` (line 18) are two names for the same cap; test 3 mixes a bare literal (`.toBe(1)`, line 108); `expect(POST_ANALYSIS_CLASS_ID).toBe('class-2')` asserts a fixture constant against a literal (lines 42, 70).
- **[Nitpick] S-N5 — Stale log context after extraction:** `useClassPageAssignmentPrefetch.ts:65` still logs `'useClassPageData.prefetch'`. Same as logging N-1. (**Joint with L-N1.**)

Incidental (pre-existing, policy-sanctioned or untouched by this diff): `getQueueState` exported per the shared-helpers doc; `createAnalysisService` test-accommodation factory; section-6 duplicate comment block in `useHeatmapsPageData.ts`; `apiService.ts` extraction otherwise clean; `classDetailService.zod.ts`/`classPartials.zod.ts` additions clean.
Explicitly clean: the double-validation boundary hardening in the ABClass Zod schemas; the reachable `confirmedPersistence: z.literal(true).optional()` on the `failed` branch; the `useClassPageAssignmentPrefetch.ts` and `heatmapsPreviewQueries.ts` extractions.

### Performance (Big-O)

**No findings.** Complexity observations for the record (A = assignments, D = definition partials; bounded timestamp/ID comparisons treated as O(1)):

- `getMetadataRefreshDecision`: O(A log A) time, O(A) storage (`metadataProjection.ts:36-48`); linear max-selection possible but no evidence of a bottleneck — no micro-optimisation raised.
- `requireDefinitionCoverage`: O(D + A) expected, O(D) storage, Set-based (`abClassMetadataService.ts:80-90`).
- `mergeClassMetadata`: O(1) w.r.t. class size (history capped at three entries).
- `refreshABClassMetadataInQueue`: full-class + target-only analysis each run once — linear in analyses, not A × full-class (`abClassMetadataService.ts:47-58`); authoritative no-op precedes both.
- `PostAnalysisOwner.attach` Map-based attempt reuse; the generic O(T²) outcome-array copying is bounded (one production descriptor) — not a meaningful hot path.

Incidental: the agent's own verification attempts hit infrastructure contention (timeouts, coverage-directory lock); no performance regression is claimed. Full report: `.opencode/scratchpad/review-performance-frontend-abclass-metadata.md`.

### Logging rules compliance

**Clean overall.** Verified: no `console.*` in production code (only the `apiQueue.ts:166` JSDoc example and policy-sanctioned test spies); transport/service boundaries conformant; single-emission diagnostics with attempt-cache dedup; rethrow-at-boundary discipline holds; bounded scalar-only diagnostics metadata; context-aware `App.useApp()` feedback with user-safe fixed copy.

- **[Improvement] L-I1 — Invalidation-phase failure diagnostics are indistinguishable from save-phase failure diagnostics.** `completePostAnalysisInvalidation` logs post-save refresh failures through the same `logPostAnalysisFailure` call with an identical metadata shape (`postAnalysisInvalidation.ts:38`, `postAnalysisDiagnostics.ts:33-39`); no bounded indicator separates "save failed" from "save confirmed, refresh failed", the two classes the branch's own policy §4 table separates for UI copy. Remedy: extend `logPostAnalysisFailure` with an optional bounded outcome field (no payload expansion).
- **[Nitpick] L-N1 — Stale log context `'useClassPageData.prefetch'`** (`useClassPageAssignmentPrefetch.ts:65`) — deliberate, documented in-branch for log continuity (`frontend-react-query-and-prefetch.md:113`); naming debt, rename context + doc together in a future change.
- **[Nitpick] L-N2 — Silent skip when the host lacks `warning`** (`postAnalysisFeedback.ts:58`) — documented test seam; diagnostics still logged; same site as RRC-1. (**Joint with RRC-1.**)
- **[Nitpick] L-N3 — `void complete()` has no rejection boundary** (`usePostAnalysisTasks.ts:122`): currently unreachable (all rejections handled internally), but a throw from a subscriber/showFeedback/host escapes as an unhandled rejection bypassing `logFrontendError`. A trailing `.catch` mapping to `logFrontendError` would make the boundary explicit.
- **[Nitpick] L-N4 — JSDoc `@example` uses `console.log`** (`apiQueue.ts:164-167`, moved verbatim from `apiService.ts`).

Incidental: **Inc-1** — the branch's new §4 policy section carries transient review-status narrative ("review-clean (5C)", "303-test browser run") into the canonical doc (`frontend-logging-and-error-handling.md:131-141`); behaviour accurate, narrative will decay. **Inc-2** — `cancelApiQueued` rejects with bare `{ reason: 'CANCELLED' }` (pre-existing contract, moved); would log as `[object Object]` if ever routed to `logFrontendError`; no live defect.

### Frontend layout / design / accessibility

**No Critical or Improvement findings.** Scope verified: no production `.tsx`/`.css` changed; the only user-visible surface is the antd notification, which sets `role: 'status'` (implicit `aria-live="polite"`), `duration: 0`, `closable: true` with a real keyboard-activatable close button; spacing/width/motion untouched; the silent background metadata task is out of the loading standards' scope by design.

- **[Nitpick] A-N1 — Stacked duplicate JSDoc on `selectHeatmapInputs`** (`post-analysis-metadata.feedback.spec.ts:46-56`): the first block is a stale copy of `openHeatmaps`' contract. Delete the first block.

Incidental: `as unknown as UseQueryOptions<T, Error>` widening carried verbatim into `heatmapsPreviewQueries.ts:35-40` (pre-existing pattern); redundant `postAnalysisStatus` alias in both orchestrator hooks (`useHeatmapsPageData.ts:367`, `useClassPageData.ts:429`) — folded into D1's extraction.

### Frontend data shape / schema consistency

**No diff findings.** Compared metadata/request/read schemas, mutation service adoption, projection, lifecycle shapes and consumer context construction against spec, parity and round-trip suites; no mismatch found.

Incidental: **[Improvement] F-INC1 — nullable submission names disagree with analyser runtime requirements (pre-existing, documented).** `classDetailService.zod.ts:102` accepts `studentName: null` and `dataAnalysis.zod.ts:203` permits a nullable output name, but `averagingAnalyser.rows.ts:84-86` throws on a null accumulated name; demonstrated by `abClassMetadataService.failure.spec.ts:25-55` (full-class analysis succeeds; newest-assignment-in-isolation rejects, so metadata is not written). Already acknowledged at `data-analysis-architecture.md:291-294`; separate follow-up, not a widening of this PR.

### Backend data shape / schema consistency

_(not in scope for this diff — no files under `src/backend/` are changed)_

### Security & secrets

**No findings.** New metadata writes reuse the existing transport; the GAS dispatcher applies its server-side auth gate before handler lookup; deployed manifest scopes unchanged; mutation handlers validate identifiers and delegate to controller-owned validation; the client-calculated aggregates are not treated as authorisation; no new executable HTML sink, external transport destination or hardcoded credential in added lines; failure notifications use fixed safe copy. Full report: `.opencode/scratchpad/pre-pr-review/security-secrets-focus-review.md`.

### Test-coverage gaps

**No Critical findings.** All deleted/refactored suites retained their full assertion surface 1:1 (47 apiService tests → 7 focused suites; classesPageTestHelpers 37 exports → facade modules; classesPageModel 11 titles → 3 suite files; classDetailService.zod 50 titles → 4 suite files + 13 new; ClassesPage split verified; classes-crud.shared.ts moves verbatim).

- **[Improvement] T-I1 — `getMetadataAttemptKey` invalid-timestamp raw-signature branch is untested** (`postAnalysisTasks.ts:38-47`): the JSDoc-promised dedup of failed attempts on invalid-source classes (raw ID/time signature) is never exercised; invalid-timestamp fixtures exist only at the service layer, bypassing the key. If the guard were removed, key computation would throw and metadata-only cache refreshes would silently re-run failed work. Missing scenario: context with `updatedAt: null` assignment → `getAttemptKey` returns the raw signature; at hook level, metadata-only cache refresh does not re-run the failed attempt.
- **[Nitpick] T-N1 — `showFeedback` non-string-key source derivation is executed but never asserted** (`usePostAnalysisTasks.ts:137-146`): content and dismissal-memory identity unasserted.
- **[Nitpick] T-N2 — `PostAnalysisFeedback.show`'s `!host.warning` guard is load-bearing (antd default context has no `warning`) but only incidentally exercised** (`postAnalysisFeedback.ts:58`): a one-test pin ("failed metadata work under a non-App owner shows no notification and does not throw") would make the contract explicit. (**Decision will ride with RRC-1.**)
- **[Nitpick] T-N3 — `refreshABClassMetadataInQueue` missing-result invariant untested** (`abClassMetadataService.ts:54` "Missing averaging result").
- **[Nitpick] T-N4 — Confirmed-save refresh-failure feedback is browser-covered on Heatmaps only;** the Class-page surface lacks that journey (unit-level copy already proven). Cheap to add via `post-analysis-metadata-scenarios.ts` (`surface: 'class'`). Related to the error-handling Critical; resolution should follow that decision.

Incidental: bridge `writeClassMetadata` duplicate `find` + unreachable error branch (test-only scaffolding, `apiHandlerRoundTripBridge.js:88-107`); prefetch null-`updatedAt` fail-fast moved verbatim and remains untested as before (`useClassPageAssignmentPrefetch.ts:45-51`, unreachable by construction).

### Error-handling robustness

- **[Critical] EH-1 — Required refresh failures can suppress the persistent confirmed-save warning.** `usePostAnalysisTasks.ts:116-124` discards feedback after effect detachment (`if (!isAttached) continue;`), while `:70-75` treats a null context as owner departure (`feedback.navigate(null)` destroys owned notices). Both production consumers pass `null` when their surface becomes blocking (`useClassPageData.ts:120-126`; `useHeatmapsPageData.ts:143-150`), and a detail-query refetch error makes the surface blocking even with retained query data (`useClassPageData.helpers.ts:63-65`; `heatmapsSurfaceState.ts:165-168`) — while the metadata attempt waits for **both** detail and list invalidations (`postAnalysisInvalidation.ts:27-33`).

  Reproduction: open either production averaging surface with active detail/list queries; let the metadata update succeed; reject the required detail refetch; keep the list refetch pending until React commits the blocking state; then settle the list refetch. The null-context effect has already detached the pending attempt, so the warning never appears despite `confirmedPersistence: true`; if published earlier, `navigate(null)` destroys it (`postAnalysisFeedback.ts:43-45,86-88`). No navigation/unmount needed. The teacher loses the promised persistent "saved but refresh failed" explanation. Remedy direction: keep feedback ownership tied to the still-selected class independently of analysis readiness, preserving fail-closed query presentation and genuine navigation/unmount suppression.

  Coverage gap within this finding: the real-query test keeps a fixed `[context]` owner through detail failure (`usePostAnalysisTasks.activeQueries.spec.tsx:61-93`), so production context becoming null is unexercised; a consumer-level delayed-list-refresh case is needed.

### Data-shape docs consistency

**No diff-introduced contract mismatches.** Shared metadata/mutation schemas, class-read adoption, reserved-slot writer/projection and local lifecycle schemas match the canonical ABClass and frontend-analysis contracts; round-trip and parity evidence align.

Incidental (both pre-existing on `origin/main`):

- **[Nitpick] DS-INC1 — `docs/developer/data-shapes/abclass.md:1024` says metadata-_bearing_ legacy records project as null;** actually `ABClassResponseMapper.js:31-44` validates and retains present metadata; only own-property absence projects null. Replace "metadata-bearing" with "metadata-absent".
- **[Nitpick] DS-INC2 — `docs/developer/data-shapes/abclass.md:559` overstated plain-record validation:** `ABClassResponseMapper.js:22-29` rejects only null/non-objects and non-array `teachers`; there is no prototype/array document check. Document the actual guard.

Incidental verdicts: frontend layout/a11y — no Critical/Improvement; logging — clean.

## Remediation progress

The historical findings and decisions below remain the audit record. The table tracks remediation separately; a batch is complete only after clean review, no regression against the original baseline, and a successful commit and push. Deferred issues #337/#338 and Wontfix decisions remain outside implementation scope.

Baseline consulted: `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/baseline/baseline.txt` — seven checks pass; backend lint has the six accepted pre-existing warnings. No baseline reset or lint-policy change is permitted.

| Batch | Scope and finding references                                                                      | Execution | Review                                          | Regression                                       | Commit/push        |
| ----- | ------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------- | ------------------------------------------------ | ------------------ |
| 1     | Feedback ownership/required host: EH-1, RRC-1, S-N2, L-N2, T-N2, L-N3, L-I1, T-N4                 | Complete  | PASS — CLEAN (including gate repair)            | Zero regressions/new failures (16:47 comparison) | Pushed: `9f1f7f8c` |
| 2     | Shared orchestration/identity: D1/S-C1, D2/S-I2, D3, K-N3, K-N1/S-N3/T-N1, redundant status alias | Complete  | PASS — CLEAN                                    | Zero regressions/new failures (18:28 comparison) | Pushed: `218ab2dd` |
| 3     | Metadata contracts/coverage: S-I1, S-I3, S-I4/K-N2, S-I5, S-N1, T-I1                              | Complete  | PASS — CLEAN                                    | Zero regressions/new failures (03:20 comparison) | Pushed: `9d18e19b` |
| 4     | Query/prefetch and synthetic cleanup: S-N5/L-N1, Layout Inc-1, Coverage Inc-1/Inc-2, RRC-2, L-N4  | Complete  | PASS — CLEAN (including gate repair)            | Zero regressions/new failures (04:48 comparison) | Pushed: `6d4e7c33` |
| 5     | Remaining documentation/E2E hygiene: DS-INC1/2, Logging Inc-1, S-N4, A-N1                         | Complete  | Clean in scope; existing coverage debt accepted | Zero regressions/new failures (05:25 comparison) | Pushed: `3ddf5720` |

Each batch includes its own directly affected tests and same-change canonical documentation updates, even where the final batch contains the remaining documentation-only corrections.

### Batch 1 — implementation and verification

- Implementation changed six production files to pass explicit selected-class ownership, retain same-class feedback through readiness-null, remove the missing-host fallback, add the asynchronous completion diagnostic boundary, and annotate confirmed-save refresh diagnostics.
- Testing Specialist updated both shared harnesses and consumer mock-call assertions. Targeted post-analysis validation passed eight suites / 48 tests, repository type checks, and targeted test lint. A subsequent pass added the explicit missing-host completion-diagnostic case (eight tests in that targeted feedback suite passed). These results do not certify the later E2E edits.
- Historical blocker (resolved): the initial browser repair milestone exhausted its bounded attempts on fixture/navigation setup failures, not the intended behaviour assertions. Direct diagnosis established the deferred initial list and missing class navigation. After user authorisation of the new repair plan, Playwright corrected the setup; the focused case and all eight feedback tests passed. Targeted spec lint is now zero-error/zero-warning.
- Evidence: `.opencode/scratchpad/batch-1-production/`, `.opencode/scratchpad/batch-1-tests/`, `.opencode/scratchpad/batch-1-playwright/`, and focused browser failure artefacts under `src/frontend/test-results/`.
- Cross-repository comparison: `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-21T12-48-56.194Z/comparison.txt` — seven checks pass; zero regressions and zero new failures; only the original six backend lint warnings remain.
- Independent review (`.opencode/scratchpad/batch-1-review.md`) verified the functional fixes and passed 2,855 frontend unit tests and all 314 browser tests. Three minor findings concerned stale verification wording, historical browser-evidence attribution, and a duplicate test import. All have been corrected. Independent rereview (`.opencode/scratchpad/batch-1-rereview.md`) returned **PASS — CLEAN**, with no outstanding findings, and freshly passed frontend lint, TypeScript, 2,855 unit tests and all 314 browser tests.
- Final comparison at `2026-10-21T16-13-08.736Z` detected one retry-passed browser regression in the previously unchanged cohort workflow. Playwright repaired the missing popup-stability wait without changing assertions; focused repetitions passed 10/10, the affected spec passed 8/8, and lint/types passed. Independent review returned **PASS — CLEAN**, including a fresh 314-test browser pass (`.opencode/scratchpad/batch-1-cohort-regression/review.md`). This small gate-repair deviation is included in batch 1; the regression baseline remains unchanged. Final comparison must be rerun before committing.
- Final comparison `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-21T16-47-18.416Z/comparison.txt` passed the no-regression gate: seven checks passing, zero regressions, zero new failures, unchanged six accepted backend lint warnings. No baseline reset or policy suppression was used.
- `npm run build:production` and pre-commit hooks passed after the gate repair. Commit `9f1f7f8c07c3e3e08ac9aa6b0bcb3cedb34b6c62` (`fix(frontend): preserve post-analysis feedback through readiness changes`) was pushed successfully to `origin/feat/frontend-abclass-metadata`.
- Agents: Implementation, Testing Specialist, Playwright, Docs, Data Shapes Agent and Code Reviewer. User-owned reviewer configuration and `.vitest/` were excluded from batch 1; at the user's subsequent request they were committed and pushed separately as `988e9ffe`.

### Batch 2 — implementation and verification

- Implementation extracted `usePagePostAnalysisTasks`, replaced the single-field registry class with `createPostAnalysisTaskDescriptors`, shared the newest-first comparator and source-version signature, and centralised the metadata task ID. Both consumers retain explicit selected-class feedback ownership and no longer duplicate eligibility/context/task wiring or keep the redundant status alias.
- Testing Specialist migrated factory consumers and added shared-hook eligibility/identity tests plus the approved unkeyed-feedback source-signature/non-reopening regression. Targeted validation passed seven files / 48 tests, zero-warning changed-file lint, and repository-wide TypeScript checks.
- Docs and Data Shapes Agent aligned canonical API/ownership references; persistence and transport shapes are unchanged. Review identified nullable raw-signature handling, diagnostic canonical filtering, an incomplete source-identity assertion and documentation/formatting nits. All were corrected and covered; the nullable-source regression coverage also fulfils batch 3's T-I1 requirement.
- Independent sign-off (`.opencode/scratchpad/batch-2-signoff.md`) returned **PASS — CLEAN** after fresh frontend lint, TypeScript, 2,869 unit tests with coverage and all 314 browser tests. The production build passed.
- Final comparison `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-21T18-28-58.351Z/comparison.txt`: seven checks pass, zero regressions/new failures, only the unchanged six accepted backend warnings. An earlier comparison timed out under duplicate reviewer-chain contention; those task-owned duplicate chains were stopped before the successful isolated run. No baseline or policy changes were made. Hooks passed; commit `218ab2ddad6cea34ffdb1c3bc3ac62c58cb9f1fe` (`refactor(frontend): share post-analysis orchestration and source identity`) was pushed to `origin/feat/frontend-abclass-metadata`.
- Evidence: `.opencode/scratchpad/batch-2-implementation/`, `.opencode/scratchpad/batch-2-tests/`; original baseline remains unchanged.

### Batch 3 — implementation and verification

- Implementation removed the cloned refresh context and unreachable merge null guard, exported the non-nullable metadata schema and shared mutation-lane symbol, removed the redundant exact-record conjunct and pinned skip reasons. Queued/non-queued write separation and runtime data shapes remain unchanged.
- Testing Specialist migrated lifecycle fixtures to the shared full context and passed 11 suites / 132 tests, changed-file lint and all TypeScript checks. Existing batch 2 regressions fulfil T-I1; no unreachable invariant tests were added. Docs and Data Shapes Agent updated canonical ownership/API references.
- Independent review (`.opencode/scratchpad/batch-3-review.md`) returned **PASS — CLEAN**: fresh frontend lint, TypeScript, 298 suites / 2,869 tests with coverage and all 314 browser tests passed; only existing warnings remain. The production build passed.
- Initial final comparison at `2026-10-22T02-59-48.179Z` flagged a retry-passed stale-recovery browser case. Playwright preserved the evidence and passed a retries-disabled focused run, ten repetitions and the seven-case affected spec without reproducing a defect; no speculative test or production change was made (`.opencode/scratchpad/batch-3-browser-repair/diagnosis.md`).
- Final comparison `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-22T03-20-18.130Z/comparison.txt`: seven checks pass, zero regressions/new failures, only the original six accepted backend warnings. Baseline and policy are unchanged. Hooks passed; commit `9d18e19b87e5808842a3cb84c976cf8458901993` (`refactor(frontend): tighten metadata task contracts and mutation ownership`) was pushed to `origin/feat/frontend-abclass-metadata`.
- Evidence: `.opencode/scratchpad/batch-3-implementation/` and `.opencode/scratchpad/batch-3-tests/`.

### Batch 4 — implementation and verification

- Implementation corrected prefetch log attribution, removed the unreachable timestamp guard, replaced disabled-query double casting with checked typing and cleaned the queue JSDoc example. Testing Specialist hoisted the bridge lookup, removed its unreachable error and restored synthetic-test globals through Vitest stubbing in both related suites.
- Focused synthetic validation passed 18 tests; full synthetic coverage passed 34 files / 384 tests and thresholds. Targeted frontend query validation passed 18 tests, relevant lint and all TypeScript checks passed. Docs aligned the prefetch contract and labelled the older plan attribution as historical. No data shapes changed.
- Independent review (`.opencode/scratchpad/batch-4-review.md`) returned **PASS — CLEAN**, including 2,869 frontend tests, 384 synthetic tests, all 314 browser tests, lint and TypeScript checks; only existing warnings remain.
- Initial comparison at `2026-10-22T04-13-37.706Z` flagged a retry-passed bulk-create case. The snapshot showed Year group remained unselected. Playwright added the established popup-readiness wait before Cohort/Year group option clicks, without changing assertions; ten repetitions and all 16 cases in the affected spec passed. Independent repair review returned **PASS — CLEAN**, including all 314 browser tests (`.opencode/scratchpad/batch-4-browser-repair/review.md`). This small gate-repair deviation is included in batch 4.
- Production build passed. Final comparison `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-22T04-48-11.000Z/comparison.txt`: seven checks pass, zero regressions/new failures, unchanged six accepted backend warnings. Hooks passed; commit `6d4e7c334cadf0cfe62adf925bb6df5d6022f950` (`refactor: simplify prefetch queries and synthetic test scaffolding`) was pushed to `origin/feat/frontend-abclass-metadata`.
- Evidence: `.opencode/scratchpad/batch-4-implementation/` and `.opencode/scratchpad/batch-4-tests/`.

### Batch 5 — implementation and verification

- Docs corrected legacy metadata-absence projection and the mapper's actual validation guards, aligned its JSDoc without executable changes, and replaced transient logging-policy review narrative with the standing contract.
- Playwright unified persistence-test count constants, removed tautological fixture assertions and the duplicate feedback-helper JSDoc. Both affected specs passed 11 tests; focused lint, Prettier, all TypeScript checks and diff whitespace checks passed.
- Independent review (`.opencode/scratchpad/batch-5-review.md`) found no code, documentation or test issues. Fresh checks passed 2,869 frontend tests with coverage, all 314 browser tests with retries disabled, TypeScript and formatting. All 2,888 backend tests passed, but standalone backend coverage remains at the pre-existing 84.35% branch coverage against 85%; this is not a new regression and is retained under the user's acceptance of existing failures, without threshold or baseline changes. This resolves the review's sole gate objection; the standalone coverage command is not claimed to pass.
- The production build passed. Final comparison `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-22T05-25-07.273Z/comparison.txt`: seven checks pass, zero regressions/new failures, only the unchanged six accepted backend lint warnings. The user confirmed that a second review is unnecessary because reviewed source/docs/tests did not change before this final gate. All five approved batches are now complete. Browser evidence: `.opencode/scratchpad/batch-5-playwright/`. Deferred #337/#338 and Wontfix decisions remain unchanged.
- Commit `3ddf57206e0db59d3c121e3631b07f66dac0fc07` (`docs: reconcile metadata contracts and tidy browser regression tests`) was pushed to `origin/feat/frontend-abclass-metadata`.
- Docs-only closeout: at the user's explicit request, the completed branch-specific planning artefacts `docs/plans/frontend-abclass-metadata/SPEC.md`, `ACTION_PLAN.md` and `POST_ANALYSIS_FEEDBACK_LAYOUT.md` were removed. `docs/plans/SPEC.md`, the issue-305 plans, canonical developer documentation and this audit were preserved; no tracked documentation or navigation entry linked to the removed files. No executable, test or configuration changes were made, and no re-review or regression run was performed because the reviewed sources are unchanged — the 05:25 gate remains zero regressions with the same accepted pre-existing failures. The historical findings and decisions below remain intact as the audit record.

### PR 339 Sonar follow-up — verified

- Four original Sonar findings: three `typescript:S9382` awaited-in-loop sites (`usePostAnalysisTasks.ts:132`, `apiQueue.ts:114`, `runPostAnalysisTasks.ts:53`) and one `typescript:S7503` unnecessary-async arrow (`postAnalysisFeedbackTestSupport.tsx:40`).
- Remediation replaced each loop with a minimal serial recursive continuation, preserving queue FIFO/admission/cancellation, ordered task execution, per-task failure isolation and post-analysis feedback ownership. No work was parallelised and no generic orchestration was introduced. The test-support change removed only the inner React `act` callback's unnecessary `async`; the helper still awaits `act` and observes a real leave transition.
- Regression coverage added 20,000-synchronous-failure tests against the real queue and ordered-runner imports, asserting original-`Error` identity, observed callback FIFO including the success sentinel, ordered outcomes, final success and one diagnostic per failure.
- Independent review returned **PASS — CLEAN** with no outstanding findings. Reviewer verification: frontend lint and TypeScript passed; 2,871 frontend tests in 298 files passed with coverage above thresholds; `git diff --check` was clean.
- No contractual, persistence, transport, schema or user-facing behaviour changed, so canonical developer and data-shape documentation is unaffected. This documentation pass changed only this audit; it edited no source, test, configuration or planning files.
- Gate status: per the user, the existing regression baseline was reused; the redundant initial comparison was cancelled at 05:49. The production build passed and the single completed final comparison (`.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-22T07-05-06.288Z/comparison.txt`) reports seven checks passing, zero regressions and zero new failures, with only the same six accepted backend `max-lines` warnings. Existing standalone backend coverage debt and all thresholds/baselines are unchanged. The verified changes are ready for commit/push; remote Sonar resolution is not claimed until a new analysis runs on the pushed revision.
- Batch 1–5 history above, deferred issues #337/#338 and Wontfix decisions are unchanged.

### PR 339 Ant Design CI remediation — verified

- Failing frontend CI after `87bce06c`: all 2,871 tests passed, but two unhandled delayed-timer `ReferenceError: window is not defined` exceptions failed the job. The stack reaches `@rc-component/util` `useDelayState` after environment teardown, not an assertion in the attributed modal suite.
- Root cause is external: util `1.13.0` schedules a timeout/RAF update without unmount cleanup ([react-component/util#805](https://github.com/react-component/util/issues/805), fixed by #806). Ant Design `6.6.7` requires util `^1.14.0` and notification `~2.1.1`, so the 6.6.5 → 6.6.7 patch upgrade supplies the fix. Neither release documents a breaking change.
- Diff scope is two files: `src/frontend/package.json` and `src/frontend/package-lock.json` (exact pin updated; lock changes limited to antd, util `1.13.0` → `1.14.0` and the required notification `2.0.9` → `2.1.1`). No overrides, direct transitive pins, test suppressions or workarounds.
- Independent review returned **PASS — CLEAN**: registry tarball URLs, integrity values and SHA512 hashes match the lock; an isolated `npm ci` reproduces the lock byte-identically; the installed patched cleanup is present on both CJS and ESM paths reached from Ant Design Form's `useDebounce`.
- Verification: the exact non-coverage CI command passes 298 files / 2,871 tests with no unhandled errors; the coverage variant passes the same 2,871 tests above thresholds; focused modal/notification-feedback suites pass 24 tests; frontend lint has 0 errors with the same 19 pre-existing `max-lines` warnings; all TypeScript checks pass.
- Final gate: the production build passed. The comparison at `.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-22T09-27-31.339Z/comparison.txt` reports seven checks passing, zero regressions and zero new failures against the unchanged original baseline; only the same six accepted backend `max-lines` warnings remain. Existing standalone backend coverage debt and all thresholds remain unchanged.
- Orchestrator-owned closeout: per the user, commit and push the verified upgrade, wait five minutes, then check CI on the pushed revision.
- No API, schema, persistence, transport or user-facing contract changed, so no canonical developer or data-shape documentation update is required and no new plans were created.
- Historical record unchanged: Sonar remediation `87bce06c` is already pushed with clean remote Sonar and passing E2E. History, deferred #337/#338 and Wontfix decisions must not be reopened. This audit pass edited only `PR_REVIEW.md` — no executable, test, configuration, planning or canonical documentation changes, no expensive checks, and no commits, pushes or further subagent delegation.

## Decisions

Decision pass completed 2026-10-21; all §-references below are to this document's Focus areas. "Fix now" items are to be applied via the standard Implementation → Code Review loop before merge; several were explicitly grouped into shared work bundles (noted per item).

### Repo rule compliance

- **[Critical] RRC-1** (`postAnalysisFeedback.ts:57-58`) — **Decision: Fix now.** Approach: make the notification host required and fail loudly when absent; provide a real or stub host in the test harness (`postAnalysisHookTestSupport.tsx` and affected specs) so the guard's test-seam purpose disappears from production code. The same-site nitpicks S-N2 (de-slop), L-N2 (logging) and T-N2 (coverage) are resolved by this change; T-N2's explicit one-test pin of the non-App behaviour can be added cheaply while the harness is touched.
- **[Improvement] RRC-2** (`syntheticABClassMetadataRoundTrip.test.ts:28-31,42-44`) — **Decision: Fix now.** Approach: install `globalThis.google` via `vi.stubGlobal` and restore via `vi.unstubAllGlobals`, per the canonical testing-policy cleanup pattern; re-run the synthetic Node suite to confirm.

### KISS & DRY

- **[Improvement] D1 / [Critical] S-C1** — **Decision: Fix now.** Approach: extract one shared hook (e.g. `usePagePostAnalysisTasks`) under `src/frontend/src/hooks/` encapsulating the guard, `createPostAnalysisContext`, registry instance, context memo and `usePostAnalysisTasks` call; delete both verbatim blocks. The redundant `postAnalysisStatus` alias (layout incidental) is dropped in the same extraction.
- **[Improvement] D2 / S-I2** — **Decision: Fix now.** Approach: export the newest-first comparator (`compareAssignmentNewestFirst`) from `metadataProjection.ts` and reuse it in `postAnalysisDiagnostics.ts` and the attempt-key scan; validity _filters_ deliberately remain separate (non-throwing diagnostics vs throwing parser).
- **[Improvement] D3** — **Decision: Fix now.** Approach: export `REFRESH_AB_CLASS_METADATA_TASK_ID` from `postAnalysisTasks.ts` and consume it in `postAnalysisDiagnostics.ts`, `postAnalysisFeedback.ts` and `postAnalysisInvalidation.ts`.
- **[Nitpick] K-N1 / S-N3 / T-N1** — **Decision: Fix now.** Approach: co-locate a `sourceVersionSignature(assignments)` helper with the attempt-key builder and reuse it in `showFeedback`'s context-object fallback; additionally add the small test asserting the fallback's derived source identity and non-reopening on equal-source rerender.
- **[Nitpick] K-N2 / S-I4** — **Decision: Fix now.** Approach: parse the merge-path input with the non-nullable inner `metadataSchema` so the return type narrows naturally and the dead throw is removed.
- **[Nitpick] K-N3** (`PostAnalysisTaskRegistry`) — **Decision: Fix now.** Approach: replace the single-field class with a plain exported factory `createPostAnalysisTaskDescriptors(now)`; rides with the D1/D3 work bundle (same files touched).
- **[Nitpick] K-N4** (`updateABClass` chain ×2) — **Decision: Wontfix.** Rationale: the duplication is deliberate deadlock avoidance, documented on both sides (`abClassMutationService.ts:35-38`, `abClassMetadataService.ts:32-38`); the two chains must remain compositionally distinct (queued vs reserved-slot non-queued), and a shared helper would obscure exactly the distinction the design relies on. Recorded so a future reviewer does not re-raise it.

### De-Sloppification

(Items settled jointly with the KISS & DRY / logging / coverage sections above: S-C1→D1, S-I2→D2, S-I4→K-N2, S-N2→RRC-1, S-N3→K-N1, S-N5→logging N-1.)

- **[Improvement] S-I1** (`MetadataRefreshContext`) — **Decision: Fix now.** Approach: type `refreshABClassMetadata`'s parameter directly as `PostAnalysisContext`; delete the unused interface that over-promises an `averagingResult` input the function never reads.
- **[Improvement] S-I3** (`classesBulkMutation` lane literal ×2) — **Decision: Fix now.** Approach: export the lane constant from `abClassMutationService.ts` and import it in `abClassMetadataService.ts` so the reserved-slot serialisation property is enforced by a shared symbol rather than two strings.
- **[Improvement] S-I5** — **Decision: Fix now.** Approach: remove the provably redundant conjunct at `abClassMetadata.zod.ts:133`; strict-schema specs confirm unchanged behaviour.
- **[Nitpick] S-N1** — **Decision: Fix now.** Approach: pin the skip-reason tuple with `satisfies readonly MetadataRefreshSkipped['reason'][]` so drift fails at compile time.
- **[Nitpick] S-N4** — **Decision: Fix now.** Approach: unify `MAX_EXPECTED_CLASS_READS`/`EXPECTED_CLASS_READ_COUNT` into one constant, replace the bare `.toBe(1)` literal, and remove the tautological fixture-vs-literal assertions.
- **[Nitpick] S-N5 / L-N1** — **Decision: Fix now (rename).** Approach: rename the log context to reflect the owning module (`useClassPageAssignmentPrefetch`), updating the doc line at `frontend-react-query-and-prefetch.md:113` in the same change; log-attribution discontinuity accepted now while the branch is fresh, per the user's instruction to "rename now".

### Performance (Big-O)

- No findings; nothing to decide. The agent's complexity observations are recorded above for future reference.

### Logging rules compliance

- **[Improvement] L-I1** — **Decision: Fix now.** Approach: extend `logPostAnalysisFailure` with an optional bounded scalar field (e.g. `confirmedPersistence`) populated on the invalidation path so "save failed" and "save confirmed, refresh failed" are separable in structured logs; extend the scalar-bounds assertion in `usePostAnalysisTasks.feedback.spec.tsx`.
- **[Nitpick] L-N3** — **Decision: Fix now, riding with the EH-1 Implementation pass** (same file/loop; a trailing `.catch` maps to `logFrontendError`, making the rejection boundary explicit per policy §8.5).
- **[Nitpick] L-N4** — **Decision: Fix now.** Approach: rewrite the `cancelApiQueued` JSDoc example without `console.log` (comment-only change).
- **[Nitpick, incidental] Logging Inc-1** — **Decision: Fix now, riding with the docs work bundle.** Approach: trim the §4 review-status narrative ("review-clean (5C)", "303-test browser run", "Section 6") to the standing behavioural contract, delegated to the Docs agent alongside DS-INC1/2.
- **[Nitpick, incidental] Logging Inc-2** (`{ reason: 'CANCELLED' }` non-Error rejection) — **Decision: Defer (GitHub Issue [#338](https://github.com/h-arnold/AssessmentBot/issues/338)).** Rationale: no live defect today (consumers map the shape without logging), but the user wants the cancellation rejection contract made Error-based as part of the wider error-handling review; raised as a sub-issue of the user's existing broader error-handling Issue [#328](https://github.com/h-arnold/AssessmentBot/issues/328) as requested.

### Frontend layout / design / accessibility

- **[Nitpick] A-N1** — **Decision: Fix now.** Approach: delete the stale first JSDoc block above `selectHeatmapInputs`.
- **[Nitpick, incidental] Layout Inc-1** (`as unknown as UseQueryOptions` cast) — **Decision: Fix now.** Approach: type `buildDisabledQueryOptions` properly and drop the double cast; re-run frontend type-check.
- **[Nitpick, incidental] Layout Inc-2** (redundant `postAnalysisStatus` alias) — **Decision: resolved via D1's shared-hook extraction** (alias dropped).

### Frontend data shape / schema consistency

- **[Improvement, incidental] F-INC1** (nullable `studentName`) — **Decision: Defer (GitHub Issue [#337](https://github.com/h-arnold/AssessmentBot/issues/337)).** Approach per the user: `studentName` should **not** be nullable — Google Classroom always provides it — so the resolution recorded in the Issue is to tighten the schema to non-nullable across `classDetailService.zod.ts`, the analysis output schema, and the analyser contract, rather than widening the analyser to accept nulls. GitHub Issue created (including the demonstrated newest-assignment-in-isolation failure at `abClassMetadataService.failure.spec.ts:25-55`).

### Backend data shape / schema consistency

- Not in scope for this diff; nothing to decide.

### Security & secrets

- No findings; nothing to decide.

### Test-coverage gaps

- **[Improvement] T-I1** — **Decision: Fix now.** Approach: add the invalid-timestamp scenario — a `PostAnalysisContext` with an assignment `updatedAt: null`, asserting `getAttemptKey` returns the raw signature and (hook level) that metadata-only cache refreshes do not re-run the failed attempt. Vitest work delegates to Testing Specialist.
- **[Nitpick] T-N3** (`Missing averaging result` invariant) — **Decision: Wontfix.** Rationale: the branch is unreachable through real data paths (every scoped analysis populates index 0) and the exact-error pin adds maintenance cost without guarding a reachable failure; recorded so it is not re-raised.
- **[Nitpick] T-N4** — **Decision: Fix now, riding with the EH-1 Implementation pass.** Approach: add the Class-page (`surface: 'class'`) confirmed-save refresh-failure E2E journey via the existing scenario helper, doubling as browser-level verification of the EH-1 fix; E2E work delegates to the Playwright agent.

### Error-handling robustness

- **[Critical] EH-1** — **Decision: Fix now.** Approach: keep feedback ownership tied to the still-selected class independently of analysis readiness — distinguish a readiness-driven (temporarily blocking) null context from genuine owner departure — and publish a settled outcome's feedback while mount and class are unchanged, preserving fail-closed query presentation and genuine navigation/unmount suppression. Includes L-N3's explicit `.catch` boundary (same loop) and the consumer-level delayed-list-refresh test (production context becoming null while a list refetch settles), plus T-N4's Class-page E2E journey. Delegated to Implementation with this finding as the spec.

### Data-shape docs consistency

- **[Nitpick, incidental] DS-INC1 / DS-INC2** — **Decision: Fix now.** Approach: correct both wording claims in `docs/developer/data-shapes/abclass.md` (metadata-absent projection semantics; documented actual validation guards instead of plain-record enforcement). Delegated to the Docs agent in the same docs work bundle as Logging Inc-1.

### Test-support incidentals

- **[Nitpick, incidental] Coverage Inc-1** (bridge scaffolding) — **Decision: Fix now.** Approach: hoist the duplicated `classPartials.find(...)` and delete the unreachable `'partial not found'` branch in `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js` (test-only change; synthetic suites confirm).
- **[Nitpick, incidental] Coverage Inc-2** (relocated null-`updatedAt` fail-fast) — **Decision: Fix now — remove the code.** Rationale per the user: unreachable code should be removed, not test-covered. Approach: delete the by-construction-unreachable defensive throw from `useClassPageAssignmentPrefetch.ts` (the adapter's trust validation at `:42-44` already guarantees `updatedAt` validity before `surfaceState` becomes ready) and confirm no doc references the removed branch.
