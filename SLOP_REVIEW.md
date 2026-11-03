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
| **2**    | Dead legacy branch in `_rehydrateSubmission` (whole-submission restoration)    | Dead code, violates SPEC                            | `02_AssignmentRehydration.js:120-121`             | Inline current branch, delete legacy branch                                                          |
| **4**    | Dead `Assignment._processAttachmentForSubmission` wrapper                      | Dead code, no callers                               | `Assignment/index.js:262-271`                     | Delete wrapper; update stale doc reference — **FIXED 2026-11-02** (see Progress log)                 |
| **5**    | Unused `this.cache` in `BaseRequestManager`                                    | Dead state, unnecessary GAS service acquisition     | `BaseRequestManager.js:20`                        | Delete line 20                                                                                       |
| **5**    | Unused `this.apiKey` in `ImageManager`                                         | Dead state, defensive guard on known-internal field | `ImageManager.js:37-40`                           | Delete lines 37-40                                                                                   |
| **6**    | Dead `DummyCacheManager` with removed pre-Section-6 interface                  | Dead code, misleading names                         | `tests/helpers/modelFactories.js:205-218`         | Delete or update to generic `get`/`put` interface — **FIXED 2026-11-02 (deleted; see Progress log)** |
| **7**    | Dead `this.apiKey` in `ImageManager`                                           | Dead state, defensive guard                         | `ImageManager.js:37-40`                           | Delete lines 37-40                                                                                   |

---

## High-Priority (Material Maintenance Cost)

These issues introduce duplication, drift risk, or unnecessary complexity.

| Section | Finding                                                                            | Impact                 | Evidence                                                          | Recommended Fix                                                                                  |
| ------- | ---------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **2**   | Duplicated root-object + marker construction in `00_AssignmentSerialisation.js`    | Duplicated logic       | `toJSON()` vs `toPartialJSON()`                                   | Extract `_rootOutput` + `_applyContractMarker` helpers                                           |
| **3**   | Duplicated `DEFINITION_PARSE_FAILED` message/code/log string                       | Silent drift risk      | `AssignmentDefinitionValidation.js:151-163`                       | Reference existing `DEFINITION_PARSE_FAILED_MESSAGE`                                             |
| **4**   | Duplicated submission-outcome logic across `SlidesAssignment`/`SheetsAssignment`   | Duplicated logic       | `SlidesAssignment.js:149-203` vs `SheetsAssignment.js:72-118`     | Hoist shared helper to `05_AssignmentAssessmentBase.js`                                          |
| **5**   | Duplicated HTTP/retry classification (`BaseRequestManager` vs `LLMRequestManager`) | Silent drift risk      | `BaseRequestManager.js:101-104` vs `LLMRequestManager.js:434-438` | Expose shared `BaseRequestManager.isRetryableStatus()` — **FIXED 2026-11-02** (see Progress log) |
| **6**   | `_routedOutcomeAttempts` Map (indirection for a locally available value)           | Unnecessary complexity | `LLMRequestManager.js:30-31, 166, 210, 385-387`                   | Pass `attempts` as parameter to `_processSingleResponse`                                         |
| **7**   | Duplicated URL validation vs `Validate.js` (~45 lines)                             | Silent drift risk      | `ImageManager.js:66-105`                                          | Extract pure `Validate.isValidUrlShape()`; delegate to it                                        |

---

## Moderate-Priority (Policy Violations or Nitpicks)

These issues violate project policies but have lower maintenance cost.

| Section  | Finding                                               | Impact                                                | Evidence                              | Recommended Fix                                    |
| -------- | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| **1** ✅ | Test-only `typeof Assessment` guard                   | Defensive code, violates AGENTS.md §2                 | `04_AssignmentSubmissions.js:96`      | Call `submissionObject.touchUpdated()` directly    |
| **4**    | Test-only dual mode in `_recordAcquisitionFailure`    | Production code for tests, violates prime directive 8 | `04_AssignmentSubmissions.js:116-135` | Make `scanState` required; delete immediate branch |
| **5**    | `sendRequestWithRetries` public API with zero callers | Dead code                                             | `BaseRequestManager.js:114-118`       | Delete or document as intentional public API       |
| **6**    | `uidIndex` default set outside constructor            | Violates AGENTS.md §2.1.10                            | `LLMRequestManager.js:46`             | Initialize `this.uidIndex = {}` in constructor     |
| **7**    | Inconsistent defensive guards (`                      |                                                       | []`, `                                |                                                    | {}`) | Silent masking of missing structures | `ImageManager.js:176-181` | Drop fallbacks; fail loudly |

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

Awaiting user direction on the remaining (non-blocking) findings — Phase 1 items for
Sections 1/2/5/7, Phase 2 duplication fixes and Phase 3 policy nitpicks — and on whether
to trim the modest over-engineered process scope identified in Sections 11–12
(`.opencode/scratchpad/sections9-12-slop-scan.md`).

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
