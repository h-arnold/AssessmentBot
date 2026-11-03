# AssessmentBot Over-Engineering Review (Sections 1–7)

## Summary

This document synthesizes the de-sloppification reviews for **Sections 1–7** of the AssessmentBot implementation. The reviews identified **critical dead code, duplicated logic, and unnecessary abstractions** that violate core project principles (KISS, fail-fast, no dead code).

Key findings:

- **9 blocking issues** (dead code, write-only abstractions, policy violations).
- **6 high-priority duplication/drift risks** (silent divergence, unnecessary complexity).
- **5 moderate-priority policy violations** (defensive guards, magic numbers).

No behavioural changes are required—these are pure refactors to align with project principles.

---

## Critical (Blocking) Over-Engineering

These issues violate core principles and must be addressed immediately.

| Section  | Finding                                                                        | Impact                                              | Evidence                                          | Recommended Fix                                                                                      |
| -------- | ------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **1** ✅ | `StudentSubmissionRepresentationConfig` (class + singleton + write-only field) | Dead state, violates KISS                           | `00_StudentSubmissionItem.js:3-24`, `index.js:27` | Replace with `'full'` constant; delete write-only `this.representationMode`                          |
| **1** ✅ | Canonical criteria list hardcoded in `setError` (5th copy)                     | Silent drift risk                                   | `00_StudentSubmissionItem.js:107`                 | Add `Assessment.CRITERIA` and use it in `setError`                                                   |
| **1** ✅ | `Assessment` constructor duplicates `isValidRawResult` validation              | Duplicated logic, violates DRY                      | `Assessment.js:37-59` vs `85-111`                 | Delegate constructor to `isValidRawResult`                                                           |
| **2** ✅ | Dead legacy branch in `_rehydrateSubmission` (whole-submission restoration)    | Dead code, violates SPEC                            | `02_AssignmentRehydration.js:120-121`             | Inline current branch, delete legacy branch                                                          |
| **4**    | Dead `Assignment._processAttachmentForSubmission` wrapper                      | Dead code, no callers                               | `Assignment/index.js:262-271`                     | Delete wrapper; update stale doc reference — **FIXED 2026-11-02** (see Progress log)                 |
| **5**    | Unused `this.cache` in `BaseRequestManager`                                    | Dead state, unnecessary GAS service acquisition     | `BaseRequestManager.js:20`                        | Delete line 20                                                                                       |
| **5**    | Unused `this.apiKey` in `ImageManager`                                         | Dead state, defensive guard on known-internal field | `ImageManager.js:37-40`                           | Delete lines 37-40                                                                                   |
| **6**    | Dead `DummyCacheManager` with removed pre-Section-6 interface                  | Dead code, misleading names                         | `tests/helpers/modelFactories.js:205-218`         | Delete or update to generic `get`/`put` interface — **FIXED 2026-11-02 (deleted; see Progress log)** |
| **7**    | Dead `this.apiKey` in `ImageManager`                                           | Dead state, defensive guard                         | `ImageManager.js:37-40`                           | Delete lines 37-40                                                                                   |

---

## High-Priority (Material Maintenance Cost)

These issues introduce duplication, drift risk, or unnecessary complexity.

| Section  | Finding                                                                            | Impact                 | Evidence                                                          | Recommended Fix                                                                                  |
| -------- | ---------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **2** ✅ | Duplicated root-object + marker construction in `00_AssignmentSerialisation.js`    | Duplicated logic       | `toJSON()` vs `toPartialJSON()`                                   | Extract `_rootOutput` + `_applyContractMarker` helpers                                           |
| **3** ✅ | Duplicated `DEFINITION_PARSE_FAILED` message/code/log string                       | Silent drift risk      | `AssignmentDefinitionValidation.js:151-163`                       | Reference existing `DEFINITION_PARSE_FAILED_MESSAGE`                                             |
| **4** ✅ | Duplicated submission-outcome logic across `SlidesAssignment`/`SheetsAssignment`   | Duplicated logic       | `SlidesAssignment.js:149-203` vs `SheetsAssignment.js:72-118`     | Hoist shared helper to `05_AssignmentAssessmentBase.js`                                          |
| **5** ✅ | Duplicated HTTP/retry classification (`BaseRequestManager` vs `LLMRequestManager`) | Silent drift risk      | `BaseRequestManager.js:101-104` vs `LLMRequestManager.js:434-438` | Expose shared `BaseRequestManager.isRetryableStatus()` — **FIXED 2026-11-02** (see Progress log) |
| **6** ✅ | `_routedOutcomeAttempts` Map (indirection for a locally available value)           | Unnecessary complexity | `LLMRequestManager.js:30-31, 166, 210, 385-387`                   | Pass `attempts` as parameter to `_processSingleResponse`                                         |
| **7** ✅ | Duplicated URL validation vs `Validate.js` (~45 lines)                             | Silent drift risk      | `ImageManager.js:66-105`                                          | Extract pure `Validate.isValidUrlShape()`; delegate to it                                        |

---

## Moderate-Priority (Policy Violations or Nitpicks)

These issues violate project policies but have lower maintenance cost.

| Section  | Finding                                               | Impact                                                | Evidence                              | Recommended Fix                                    |
| -------- | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| **1** ✅ | Test-only `typeof Assessment` guard                   | Defensive code, violates AGENTS.md §2                 | `04_AssignmentSubmissions.js:96`      | Call `submissionObject.touchUpdated()` directly    |
| **4** ✅ | Test-only dual mode in `_recordAcquisitionFailure`    | Production code for tests, violates prime directive 8 | `04_AssignmentSubmissions.js:116-135` | Make `scanState` required; delete immediate branch |
| **5** ✅ | `sendRequestWithRetries` public API with zero callers | Dead code                                             | `BaseRequestManager.js:114-118`       | Delete or document as intentional public API       |
| **6** ✅ | `uidIndex` default set outside constructor            | Violates AGENTS.md §2.1.10                            | `LLMRequestManager.js:46`             | Initialize `this.uidIndex = {}` in constructor     |
| **7** ✅ | Inconsistent defensive guards (`                      |                                                       | []`, `                                |                                                    | {}`) | Silent masking of missing structures | `ImageManager.js:176-181` | Drop fallbacks; fail loudly |

---

## Proposed Cleanup Plan

### Phase 1: Critical Dead Code Removal (Blocking)

**Goal**: Remove all confirmed dead code and write-only abstractions.
**Files**: Sections 1, 2, 4, 5, 6, 7.
**Validation**: Re-run affected test suites after each change.

#### Tasks

1. **Section 1**: Replace `StudentSubmissionRepresentationConfig` with a `'full'` constant; delete write-only `this.representationMode`.
2. **Section 2**: Delete dead legacy branch in `_rehydrateSubmission`.
3. **Section 4**: Delete dead `Assignment._processAttachmentForSubmission` wrapper.
4. **Section 5**: Delete `this.cache` in `BaseRequestManager` and `this.apiKey` in `ImageManager`.
5. **Section 6**: Delete `DummyCacheManager` or update to generic `get`/`put`.
6. **Section 7**: Delete `this.apiKey` in `ImageManager`.

### Phase 2: High-Priority Duplication and Drift Risk

**Goal**: Consolidate duplicated logic and reduce drift risk.
**Files**: Sections 2, 3, 4, 5, 6, 7.

#### Tasks

1. **Section 2**: Extract `_rootOutput` + `_applyContractMarker` helpers in `00_AssignmentSerialisation.js`.
2. **Section 3**: Reference existing `DEFINITION_PARSE_FAILED_MESSAGE` in `AssignmentDefinitionValidation`.
3. **Section 4**: Hoist shared submission-outcome logic to `05_AssignmentAssessmentBase.js`.
4. **Section 5**: Expose shared `BaseRequestManager.isRetryableStatus()`.
5. **Section 6**: Replace `_routedOutcomeAttempts` Map with a parameter.
6. **Section 7**: Extract pure `Validate.isValidUrlShape()`; delegate to it.

### Phase 3: Policy Violations and Nitpicks

**Goal**: Align code with project policies (no defensive guards, no magic numbers).
**Files**: Sections 1, 4, 5, 6, 7.

#### Tasks

1. **Section 1**: Remove `typeof Assessment` guard; call `touchUpdated()` directly.
2. **Section 4**: Make `scanState` required in `_recordAcquisitionFailure`.
3. **Section 5**: Delete `sendRequestWithRetries` or document as intentional public API.
4. **Section 6**: Initialize `this.uidIndex = {}` in constructor.
5. **Section 7**: Drop defensive fallbacks (`|| []`, `|| {}`); fail loudly.

---

## Progress log — blocking fixes delivered (2 November 2026)

The user authorised delegating fixes for the **three blocking items only** (the Section 4
dead wrapper, the Section 5 duplicated retry classification, and the Section 6 stale
`DummyCacheManager`). All three are implemented in the worktree on branch
`assessment-errors-322-341` and were **not committed or pushed**.

1. **Section 4 wrapper — FIXED.** `Assignment._processAttachmentForSubmission` deleted
   from `src/backend/AssignmentProcessor/Assignment/index.js`;
   `docs/developer/backend/AssessmentFlow.md` (~line 1245) now points to the real owner
   `AssignmentSubmissions._processAttachmentForSubmission()`. Repo-wide grep confirms no
   remaining facade references; all test references call the `AssignmentSubmissions`
   owner directly.
2. **Section 5 duplicated classification — FIXED.** New
   `static BaseRequestManager.isRetryableStatus(status)` (429 or 500–599) is the single
   owner; `_classifyResponse` and `LLMRequestManager._terminalCodeFor` both delegate to
   it. `LLM_TOO_MANY_REQUESTS` / `LLM_RETRYABLE_SERVER_MIN` / `LLM_RETRYABLE_SERVER_MAX`
   deleted; `LLM_ACCEPTED_STATUSES = [200, 201]` kept. Retry semantics, terminal-code
   mapping and stop statuses unchanged.
3. **Section 6 stale dummy — FIXED (deleted).** `DummyCacheManager`,
   `createDummyCacheManager()`, its `setupGlobalDummyClasses` branch and exports removed
   from `tests/helpers/modelFactories.js`; zero callers existed repo-wide, and the real
   `CacheManager` is already registered globally by `tests/setupGlobals.js`.

Validation: scoped backend suites pass (assignment 367, requestHandlers 306, combined
673, modelFactories importers 442 tests); full backend coverage 260 files / 3,634 tests
PASS, branches 86.3% (>85% gate); `lint:backend:check` zero errors with only the four
accepted historical `max-lines` warnings; `git diff --check` and Prettier clean.
Independent Code Reviewer verdict **PASS with zero findings**
(`.opencode/scratchpad/review-deslop-fixes-322-341.md`). The stable-ID regression
comparison (`assessment-errors-322-341`) was in progress when this log was written; its
result is recorded in `ACTION_PLAN.md` Section 8 (de-sloppification pass subsection).

All other findings in this document remain **deferred, not authorised**: the user
approved only the three blocking fixes. Progress is recorded in `ACTION_PLAN.md`
(Section 8 subsection and the deferred ledger).

## Next Steps

All Sections 1–7 are delivered (see the progress logs above). The remaining recorded
follow-ups are out-of-scope findings tracked in
`.opencode/scratchpad/assessment-errors-322-341-out-of-scope-fix-plan.md`
(OOS-1 criteria-list consolidation onto `Assessment.CRITERIA`; OOS-2 the dead
`Assignment._rehydrateSubmission` facade), to be executed as their own change units
now that the final clean regression compare is recorded. The Sections 11–12
process-scope question is closed — the user approved the trim on 2 November 2026
and Sections 9–12 are complete (Section 12 closed 3 November 2026; see the
`ACTION_PLAN.md` status block), so no decision remains there. The two deferred
Material rows (LLM and image defect groups, owned by the delivered `ACTION_PLAN.md`
Sections 6/7) were authorised for verify-and-fix on 3 November 2026; the verification
pass returned 9/9 RESOLVED with zero stragglers
(`.opencode/scratchpad/material-rows-verification.md`), so both rows are closed with no
fix unit required. The ledgered nitpicks (several already verified resolved by the
delivered sections' own docs syncs — see
`.opencode/scratchpad/nits-verification-sweep.md`) are authorised for a final tidy unit
after OOS-2.

---

## Progress log — Section 1 desloppification (3 November 2026)

The user authorised addressing all remaining findings, so the Section 1 items were
delivered under the full implement/review loop on branch `assessment-errors-322-341`.

1. **Config class/singleton + write-only field — FIXED.** `StudentSubmissionRepresentationConfig`,
   `STUDENT_SUBMISSION_REPRESENTATION` and `getDefaultRepresentationMode()` deleted from
   `00_StudentSubmissionItem.js`; the default mode is now the module-level
   `DEFAULT_REPRESENTATION_MODE = 'full'` constant (GAS script scope, guarded export,
   attached to `globalThis` in `tests/setupGlobals.js`). The write-only
   `this.representationMode` field was removed from the `StudentSubmission` constructor.
2. **`Assessment.CRITERIA` — FIXED.** Added as a post-class assignment on `Assessment`
   (Apps Script parser rejects static field declarations); `StudentSubmissionItem.setError`
   now iterates it instead of a hardcoded array.
3. **Constructor duplication — FIXED.** The `Assessment` constructor now builds the raw
   entry and delegates to `Assessment.isValidRawResult`; accept/reject parity proven over
   a 29-case edge matrix, same `'Invalid assessment result'` message.
4. **`typeof touchUpdated` guard — FIXED.** `04_AssignmentSubmissions.js` now calls
   `submissionObject.touchUpdated()` directly; the paired test was strengthened to assert
   the wiring fault propagates (`TypeError`).

Docs sync: `docs/developer/data-shapes/student-submission.md` (stale `representationMode`
sentence rewritten), `docs/developer/data-shapes/assessment.md` and
`docs/developer/backend/AssessmentFlow.md` (constructor delegation + `Assessment.CRITERIA`
ownership) updated; no new pages.

Validation: scoped Vitest PASS (137 files / 1,743 tests; full backend coverage 263 files /
3,665 tests, branches 85.99% > 85% gate); `lint:backend:check` 0 errors with only the four
accepted historical `max-lines` warnings; `git diff --check` clean. Independent Code
Reviewer verdict **PASS, zero findings** after re-review
(`.opencode/scratchpad/review-section1-desloppification-rereview.md`). Regression-compare
against the `assessment-errors-322-341` baseline (3 November 2026): **7/8 checks passing,
0 regressions, 0 new failures**; the only failing check remains `backend-lint-check` with
the accepted historical `max-lines` test-file warnings (two earlier warnings now fixed,
none introduced). Baseline not degraded.

Deferred follow-up (out of scope for Section 1 by design): the other literal copies of the
criteria list (`LLM_CRITERIA`, `ABCLASS_METADATA_METRICS`, the inline arrays in
`ImageManager.js`, `02_AssignmentCurrentRestoration.js`, `ABClassAssignmentValidation.js`)
still exist; consolidating them onto `Assessment.CRITERIA` is recorded as a follow-up.
**Delivered 3 November 2026** as OOS-1 after Sections 1–7 completed (see
`.opencode/scratchpad/assessment-errors-322-341-out-of-scope-fix-plan.md` §1 and its
review record `review-oos1-criteria-consolidation.md`).

---

## Progress log — Section 2 desloppification (3 November 2026)

The Section 2 items were delivered under the full implement/review loop on branch
`assessment-errors-322-341`, committed together with this report update.

1. **Dead legacy branch in `_rehydrateSubmission` — FIXED.** Repo-wide caller audit
   confirmed the only production caller is `_baseFromJSON` (which calls it only when
   `assessmentContractVersion === 1`), so the whole-submission
   `StudentSubmission.fromJSON` restoration branch was unreachable. The branch is
   deleted; `_rehydrateSubmission` now unconditionally delegates to
   `_rehydrateCurrentSubmission` (the delegation seam is kept, matching the file's
   existing style). Legacy records stay opaque in `_legacyPersistenceSnapshot`; the
   `assignmentRehydration.legacy*` suites pass untouched.
2. **Duplicated root-object + marker construction — FIXED.** New private helpers
   `_rootOutput(definitionRootFields, submissions, assignmentDefinition)` and
   `_applyContractMarker(output)` on `AssignmentSerialisation`; `toJSON()` and
   `toPartialJSON()` both call them. Byte-identical output proven over an eight-case
   harness (marker-1, legacy markers `null`/`2`/`'old'`, marker-absent, tasks-array
   definition branch, null-definition fallback) — key order preserved, marker appended
   last.
3. **Test re-point.** `rehydrates valid submissions directly` (the only test exercising
   the dead branch) rewritten as `delegates every submission to current restoration
without Classroom recovery`, spying on
   `globalThis.AssignmentCurrentRestoration._rehydrateCurrentSubmission` with exact
   call-argument assertions and the no-Classroom-fetch guard retained. No assertion
   weakened; no production code added for tests.

Docs sync: `docs/developer/data-shapes/assignment.md` (opaque non-marker-1 retention
re-attributed to `_baseFromJSON`; `_rehydrateSubmission` documented as marker-1-only
delegation; File Index updated), `docs/developer/data-shapes/student-submission.md`
and `docs/developer/data-shapes/assessment.md` (representation-mode chains now name the
`_rehydrateCurrentSubmission` / `AssignmentCurrentRestoration._rehydrateCurrentSubmission`
seam); no new pages.

Validation: scoped `tests/assignment` 32 files / 367 tests PASS; full backend coverage
263 files / 3,665 tests PASS, branches 85.95% > 85% gate; `lint:backend:check` 0 errors
with only the four accepted historical `max-lines` warnings; `git diff --check` clean.
Independent Code Reviewer verdict **PASS, zero findings** after docs sync
(`.opencode/scratchpad/review-section2-desloppification.md`,
`.opencode/scratchpad/rereview-section2-desloppification.md`). Regression-compare
against the `assessment-errors-322-341` baseline (3 November 2026): **7/8 checks
passing, 0 regressions, 0 new failures**; only `backend-lint-check` fails, with the
same four accepted historical `max-lines` warnings. Baseline not degraded.

Deferred follow-ups recorded out of scope for Section 2 (tracked in
`.opencode/scratchpad/assessment-errors-322-341-out-of-scope-fix-plan.md`): the
zero-caller `Assignment._rehydrateSubmission` static facade in
`Assignment/index.js:114-129` (OOS-2, noted); header note omission of
`AssignmentReadProjection` and doc-inventory omissions of the new private helpers
(OOS-3/OOS-4, disregarded nitpicks).

---

## Progress log — Section 3 desloppification (3 November 2026)

The Section 3 item was delivered under the full implement/review loop on branch
`assessment-errors-322-341`, committed together with this report update.

1. **Duplicated `DEFINITION_PARSE_FAILED` message — FIXED.** `_rejectDefinitionContent`
   in `AssignmentDefinitionValidation.js` now throws
   `ApiValidationError(DEFINITION_PARSE_FAILED_MESSAGE, …)`, referencing the existing
   const from `AssignmentDefinitionRecoveryRules.js`; the thrown text,
   `code: 'DEFINITION_PARSE_FAILED'` and `method: 'upsertAssignmentDefinition'` are
   byte-identical. The const was added to RecoveryRules' guarded `module.exports` so the
   existing `Object.assign(g, require(…))` wiring in `tests/setupGlobals.js` exposes it
   to Node (`setupGlobals.js` itself unchanged); GAS visibility is guaranteed by bundle
   order (`AssignmentDefinitionRecoveryRules.js` sorts before
   `AssignmentDefinitionValidation.js`). The `ABLogger` log string stays verbatim and no
   const was introduced for the `DEFINITION_PARSE_FAILED` code string, both per the
   scoped fix. No test files changed; the literal-asserting suites pass unchanged.

Docs sync: skipped — the thrown message, code, method and log output are byte-identical,
so no documented behaviour, public API, data shape or command changed; the
`transport-envelope.md` example quote remains accurate.

Validation: affected suites 5 files / 73 tests PASS; full backend coverage 263 files /
3,665 tests PASS, branches 85.95% > 85% gate; `lint:backend:check` 0 errors with only
the four accepted historical `max-lines` warnings; `git diff --check` clean. Independent
Code Reviewer verdict **PASS, zero findings**
(`.opencode/scratchpad/review-section3-desloppification.md`). Regression-compare
against the `assessment-errors-322-341` baseline (3 November 2026): **7/8 checks
passing, 0 regressions, 0 new failures**; only `backend-lint-check` fails, with the
same four accepted historical `max-lines` warnings. Baseline not degraded.

---

## Progress log — Section 4 desloppification (3 November 2026)

The Section 4 items were delivered under the full implement/review loop on branch
`assessment-errors-322-341`, committed together with this report update.

1. **Duplicated submission-outcome logic — FIXED.** New private helper
   `_applyExtractedArtifacts(submission, artifacts, taskDefinitions, handlers)` on
   `AssignmentAssessmentBase`, reached from both runners through a single new
   `Assignment._applyExtractedArtifacts` forwarder (the established delegation
   pattern; no new exports). `SlidesAssignment.processAllSubmissions` and
   `SheetsAssignment.processAllSubmissions` keep their own preambles (parser,
   progress message and ordering, missing-document warning) and pass per-subclass
   handlers: `onUnknownTask` preserves each runner's warning text and metadata
   (including the asserted `workflow: 'SlidesAssignment.processAllSubmissions'`
   metadata), and `isPendingArtifact` parameterises the final-sweep IMAGE nuance
   without unifying it (Slides: a matched pending IMAGE with `pageId != null` and
   truthy `metadata.sourceUrl`; Sheets: every IMAGE artifact). The null-sentinel
   sweep, upsert payload, unmatched-task sweep, error codes and stages are identical.
2. **Test-only dual mode in `_recordAcquisitionFailure` — FIXED.** `scanState` is
   now a required parameter of `_processAttachmentForSubmission`,
   `_recordAcquisitionFailure` and `_recordSupportedAttachment`; the `!scanState`
   immediate-materialisation branch and the dead `if (!scanState) return;` guard are
   deleted, and the JSDoc states the required-parameter contract.
   `_materialiseAcquisitionOutcome` is retained (still called at scan end), and
   production behaviour is unchanged — `fetchSubmittedDocumentsByMimeType` already
   always created and passed `scanState`.
3. **Test re-points.** Direct `_processAttachmentForSubmission` calls now pass a
   `scanState` accumulator and assert its effects (first-failure recording,
   supported-set membership) instead of the deleted immediate-materialisation path;
   log assertions retained. No assertion weakened; no production code added for
   tests.

Docs sync: `docs/developer/backend/AssessmentFlow.md` Stage 4 now names the shared
`_applyExtractedArtifacts` helper, its location and forwarder, and documents the
per-runner `isPendingArtifact` difference; no new pages.

Validation: 7 affected suites PASS (7 files / 87 tests); `tests/assignment` full run
PASS (32 files / 367 tests); full backend coverage 263 files / 3,665 tests PASS,
branches 85.9% > 85% gate; `lint:backend:check` 0 errors with only the four accepted
historical `max-lines` warnings; `git diff --check` clean. Independent Code Reviewer
verdict **PASS, zero findings**
(`.opencode/scratchpad/review-section4-desloppification.md`). Regression-compare
against the `assessment-errors-322-341` baseline (3 November 2026): **7/8 checks
passing, 0 regressions, 0 new failures**; only `backend-lint-check` fails, with the
same four accepted historical `max-lines` warnings. Baseline not degraded.

---

## Progress log — Section 5 desloppification (3 November 2026)

The remaining Section 5 items were delivered under the full implement/review loop on
branch `assessment-errors-322-341`, committed together with this report update. The
High-Priority duplicated-classification item was already fixed on 2 November.

1. **Write-only `this.cache` — FIXED (deleted).** The `BaseRequestManager`
   constructor no longer acquires `CacheService.getScriptCache()`; the field had no
   reads anywhere and was that file's only `CacheService` reference.
2. **Write-only `this.apiKey` — FIXED (deleted).** The `ImageManager` constructor no
   longer assigns `this.apiKey`; the field had no reads anywhere and its defensive
   existence/type guard violated fail-loudly.
3. **`sendRequestWithRetries` — FIXED (documented as intentional public API).** The
   review offered delete-or-document; documented: the existing `@remarks` now states
   the method is retained as the class's single-dispatch entry sharing the retry
   engine with `sendRequestsInBatches`, that production dispatches only through the
   batch sender, and that the policy suites exercise it directly as the retry
   engine's single-dispatch specification. No executable code changed: deleting the
   method would have orphaned the policy suites' coverage of the live
   `_runRetryEngine`, and `ACTION_PLAN.md` already documents its return shape as
   part of the transport contract.

Docs sync: skipped — comment-only JSDoc plus removal of never-read fields changes no
documented behaviour, public API, data shape or command.

Validation: 8 request-handler suites PASS (8 files / 102 tests); full backend
coverage 263 files / 3,665 tests PASS, branches 85.89% > 85% gate;
`lint:backend:check` 0 errors with only the four accepted historical `max-lines`
warnings; `git diff --check` clean. Independent Code Reviewer verdict **PASS, zero
findings** (`.opencode/scratchpad/review-section5-desloppification.md`).
Regression-compare against the `assessment-errors-322-341` baseline (3 November
2026): **7/8 checks passing, 0 regressions, 0 new failures**; only
`backend-lint-check` fails, with the same four accepted historical `max-lines`
warnings. Baseline not degraded.

---

## Progress log — Section 6 desloppification (3 November 2026)

The Section 6 items were delivered under the full implement/review loop on branch
`assessment-errors-322-341`, committed together with this report update. The Phase 1
`DummyCacheManager` deletion was already delivered with the blocking fixes on
2 November.

1. **`_routedOutcomeAttempts` Map — FIXED (removed).** The Map was pure indirection:
   the batch callback set `outcome.attempts` immediately before the sole production
   call to `_processSingleResponse`, which read it back by UID. The method now takes
   `attempts` as its third parameter (JSDoc `@param` added); the call site passes
   `outcome.attempts` directly. The existing safe-integer validation and the
   `_terminalCodeFor(code, attempts)` argument are unchanged; the Map is fully gone
   (zero references in `src/` and `tests/`).
2. **`uidIndex` default outside constructor — FIXED.** `this.uidIndex = {}` is now
   constructor-initialised with a `@type` JSDoc (GAS parser-safe). The per-generation
   reset in `generateRequestObjects`, the fail-loudly `if (!this.uidIndex)` guard
   (test-backed via explicit deletion/nulling) and the optional-chain reads are
   deliberately retained — a per-run reset is a re-initialisation, not a default.
3. **Test re-points.** `assignmentPhase3.transport.test.js`'s exact-arity assertion now
   includes the attempts value (`…, 1` — provable from the fixture: the plain-array
   `fetchAll` response takes `_consumeBatch`'s non-retry branch, which sets
   `attempts: 1`); the two spy mocks' third parameter renamed `model` → `attempts`
   (positional forward unchanged). No assertion weakened.

Docs sync: skipped — internal indirection removal plus constructor field initialisation
changes no documented behaviour, public API, data shape or command; the governing
`ACTION_PLAN.md` transport-design line was updated in the same commit (plan
maintenance).

Validation: 5 named suites PASS (5 files / 105 tests); requestHandlers +
`llmRunStopHarness` consumers PASS (23 files / 319 tests); full backend coverage 263
files / 3,665 tests PASS, branches 85.89% > 85% gate; `lint:backend:check` 0 errors
with only the four accepted historical `max-lines` warnings; `git diff --check` clean.
Independent Code Reviewer verdict **PASS, zero findings**
(`.opencode/scratchpad/review-section6-desloppification.md`). Regression-compare
against the `assessment-errors-322-341` baseline (3 November 2026): **7/8 checks
passing, 0 regressions, 0 new failures**; only `backend-lint-check` fails, with the
same four accepted historical `max-lines` warnings. Baseline not degraded.

---

## Progress log — Section 7 desloppification (3 November 2026)

The Section 7 items were delivered under the full implement/review loop on branch
`assessment-errors-322-341`, committed together with this report update.

1. **Duplicated URL validation — FIXED.** New pure `Validate.isValidUrlShape(url)`
   owns the shared HTTPS/DNS-hostname shape policy (never logs); a shared private
   `_isValidHostnameShape` tail serves both it and `isValidUrl`, and the HTTPS regex
   literal exists once (`HTTPS_URL_PREFIX_PATTERN`).
   `ImageManager._isAdmissibleImageUrl` now delegates to the shared predicate; the
   duplicated `_isIPv4Hostname` and the four `IMAGE_*` limit constants (253/2/63/255,
   value-identical to Validate's) are deleted. `isValidUrl`'s diagnostic trigger set
   is preserved exactly: the ProgressTracker error (ABLogger warn fallback) fires
   only on prefix-regex failure; hostname/label rejections stay silent, and
   image-source admission never logs.
2. **Inconsistent defensive guards — FIXED (cited range).** `assignment.submissions`
   and `sub.items` are consumed directly without `|| []`/`|| {}` fallbacks; missing
   structures now fail loudly through the subsequent `forEach`/`Object.values`
   instead of silently producing no work. `item.getAssessment?.() || {}` (outside
   the cited range) is untouched.
3. **Test additions.** `tests/utils/validateCoverage.test.js` gains an
   `isValidUrlShape` accept/reject matrix, a no-diagnostics assertion and an
   11-candidate parity test against `isValidUrl`. No existing fixture needed
   re-pointing; no assertion weakened.

Docs sync: `docs/developer/backend/AssessmentFlow.md` and
`docs/developer/data-shapes/student-submission.md` now describe URL admission as
delegating to the shared `Validate.isValidUrlShape` policy (previously
"owner-local … mirrors"), and
`docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`'s example names
`_isAdmissibleImageUrl`/the shared predicate accurately; no new pages.
`ACTION_PLAN.md`'s ImageManager helper inventory and URL-policy lines were updated
in the same commit (plan maintenance).

Validation: 6 named suites PASS (6 files / 80 tests); requestHandlers +
slidesSheets + tests/utils PASS (42 files / 676 tests); full backend coverage 263
files / 3,667 tests PASS, branches 85.97% > 85% gate; `lint:backend:check` 0 errors
with only the four accepted historical `max-lines` warnings; `git diff --check`
clean. Independent Code Reviewer verdict **PASS, zero findings**
(`.opencode/scratchpad/review-section7-desloppification.md`). Regression-compare
against the `assessment-errors-322-341` baseline (3 November 2026): **7/8 checks
passing, 0 regressions, 0 new failures**; only `backend-lint-check` fails, with the
same four accepted historical `max-lines` warnings. Baseline not degraded. All
Sections 1–7 are now delivered; the final clean regression compare required by the
out-of-scope fix plan's execution trigger is this run (only report updates landed
after it).
