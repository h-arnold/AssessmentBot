# SonarQube PR #256 De-sloppification Plan

**Source PR:** #256 — `feat: getAssignment API endpoint, typed errors, review fixes, and coverage improvements`
**Sonar project key:** `h-arnold_AssessmentBot`
**Sonar quality gate:** OK (bugs 0, vulns 0, code smells 0; new-code dup density 1.0% against 3% threshold; overall dup density 2.4%).
**Plan status:** Approved for execution.

This plan addresses three test-file duplication hotspots flagged by SonarQube on PR #256.
It is opportunistic de-sloppification (the quality gate is green) and is therefore constrained
to test code plus the existing `tests/helpers/controllerTestHelpers.js` extension surface.

## 0. Baseline state (snapshot from `regression-checker`, run 2026-06-20T08:34:04Z, branch `opencode/curious-cabin`)

- Mode: **compare** (no fresh baseline created)
- **Regressions: 0**, **New failures: 0**, **Fixes: 0**
- 6/8 checks passing; 2 pre-existing failures (NOT introduced by this work):
  1. `backend-lint-check` — 16 pre-existing `max-lines` warnings, all warnings treated as failures by `--max-warnings 0`. **One of these warnings is on `tests/parsers/parserMatchingAndDocumentIds.test.js` (624 lines, max 500) — a target file for this refactor, so reducing its line count is a bonus fix.**
  2. `backend-test-coverage-check` — vitest coverage below 85% threshold on `src/backend/**/*.js`. Test-file refactors should not change production coverage as long as no test case is removed.
- Vitest coverage thresholds (from `vitest.config.js`): lines 85, functions 85, statements 85, branches 85. Applies only to `src/backend/**/*.js`.

### Acceptance criterion (added during execution)

The refactor MUST:

- Keep `Regressions Count == 0` and `New Failures Count == 0` vs the saved baseline.
- Not add any new `max-lines` warnings.
- Preserve all test cases that exercise distinct production code branches (in particular: the `unknown` vs `''` status in `sheetsFeedback.test.js` must both hit their respective branch — verify with `test:backend:coverage` before/after).
- Ideally reduce `tests/parsers/parserMatchingAndDocumentIds.test.js` below 500 lines (bonus fix for the existing lint warning).

| File                                                              | Current density | Target | Reason                                                                                                                                        |
| ----------------------------------------------------------------- | --------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/controllers/abclassController.rehydrateAssignment.test.js` | 22.7%           | < 5%   | Per-test `controller + fixture + scenario + assertMethodExists + call` boilerplate repeated ~10 times; shares skeleton with the persist test. |
| `tests/feedbackPopulators/sheetsFeedback.test.js`                 | 8.1%            | < 2%   | Two near-identical 11-line "returns white background for `<status>`" cases.                                                                   |
| `tests/parsers/parserMatchingAndDocumentIds.test.js`              | 4.5%            | < 2%   | Two near-identical 14-line `createSlide` + mocked `SlidesApp.openById` + `new SlidesParser().extractTaskDefinitions` setups.                  |

## 2. Files in scope (read/write)

- `tests/helpers/controllerTestHelpers.js` — extend only. Add two new exports (`runRehydrateScenario`, `runPersistScenario`). Do not rename or remove any existing export.
- `tests/controllers/abclassController.rehydrateAssignment.test.js` — refactor using the new helper and parametrise where appropriate.
- `tests/controllers/abclassController.persistAssignment.test.js` — opportunistic refactor to share the new `runPersistScenario` helper. Leave cases that diverge (multi-assignment replacement, error-injection, edge cases) using lower-level helpers.
- `tests/feedbackPopulators/sheetsFeedback.test.js` — parametrise the two duplicate `getFormatForStatus` white-background cases via `it.each([['unknown'], ['']])`.
- `tests/parsers/parserMatchingAndDocumentIds.test.js` — extract a local `buildSlidesParserHarness(refSlide, tplSlide)` helper and reuse it in both cases.

## 3. Explicitly out of scope

- Production code under `src/backend/**` and `src/frontend/**`.
- New test directories or new helper modules beyond extending `controllerTestHelpers.js`.
- `SPEC.md` / `ACTION_PLAN.md` (none exist in the workspace; AGENTS.md §6 threshold is not met).
- Lint rule changes; coverage threshold changes; pre-commit hook changes.

## 4. New helper contracts (in `controllerTestHelpers.js`)

### `runRehydrateScenario(options)`

```js
/**
 * Higher-order helper that performs the standard rehydrate-test setup and call.
 * Returns the rehydrated assignment and the controller/abClass/assignment instances
 * so tests can layer specific assertions on top.
 *
 * @param {Object} options
 * @param {Function} options.ABClass         - ABClass constructor
 * @param {Function} options.Assignment      - Assignment constructor/factory
 * @param {string}   options.courseId
 * @param {string}   options.assignmentId
 * @param {string}   [options.documentType='SLIDES']
 * @param {Object}   options.mockCollection  - vi mock for the assignment collection
 * @returns {{ controller: ABClassController, abClass, assignment, rehydrated }}
 */
```

Internally calls `createTestFixture` + `setupRehydrationScenario` + `assertMethodExists(controller, 'rehydrateAssignment')` + `controller.rehydrateAssignment(abClass, assignmentId)`.

### `runPersistScenario(options)`

```js
/**
 * Higher-order helper that performs the standard persist-test setup up to (but not
 * including) the `controller.persistAssignmentRun` call. The call is left to the
 * test because many cases vary the arguments or expect throws.
 *
 * @param {Object} options
 * @param {Function} options.ABClass
 * @param {string}   options.courseId
 * @param {string}   options.assignmentId
 * @param {string}   [options.documentType='SLIDES']
 * @param {boolean}  [options.includeTask=false]
 * @param {boolean}  [options.includeSubmission=false]
 * @returns {{ controller: ABClassController, abClass, assignment }}
 */
```

Internally calls `createTestFixture` + `assertMethodExists(controller, 'persistAssignmentRun')`.

## 5. Parametrisation rules

- For `sheetsFeedback.test.js`, use `it.each([['unknown'], ['']])` for the duplicate cases. If coverage tooling flags a branch loss, fall back to a single assertion with a JSDoc justification.
- For `parserMatchingAndDocumentIds.test.js`, parametrise only via a local helper, not `it.each` — the tests assert different downstream state (`documentId set` vs `no task definitions`).
- For the rehydrate test, the two SLIDES/SHEETS subclass cases may become `it.each([['SLIDES'], ['SHEETS']])`; the two `_hydrationLevel === 'full'` cases must be reviewed individually — keep separate if asserting different paths.

## 6. Workflow (non-trivial change loop)

1. Establish regression baseline via `regression-checker` skill.
2. Delegate the entire refactor to the **Testing Specialist** sub-agent in a single batch with the contracts above and the full `Mandatory Reading` list.
3. Run lint (`npm run lint:backend && npm run lint:frontend && npm run lint:builder`) and the affected Vitest suites (`tests/controllers`, `tests/feedbackPopulators`, `tests/parsers`).
4. Submit the diff to **Code Reviewer**; iterate on findings until clean.
5. Re-run `regression-checker` and confirm no regressions vs baseline.
6. If `controllerTestHelpers.js` grew new exports, delegate a tiny **Docs** touch-up to add a "Test helpers" paragraph to `docs/developer/backend/backend-testing.md` (or its "Test helpers" section if it exists).
7. Commit on a feature branch with a clear message.
8. Report results: changed files, review outcome, regression-check result, commit SHA.

## 7. Acceptance gate (must all pass)

- `npm run lint:backend && npm run lint:frontend && npm run lint:builder` exits 0.
- `npm run test -- tests/controllers tests/feedbackPopulators tests/parsers` exits 0.
- `npm run regression-checker` shows zero regressions vs the saved baseline.
- The three target file densities in SonarQube drop below their target thresholds.
- No behavioural assertion removed or weakened; branch coverage on the three files does not drop.
- No production code touched.

## 8. Risks and mitigations

- **Parametrisation drops a branch.** Mitigation: snapshot per-file coverage before and after via the project's coverage script; revert the parametrise step if any branch loses hits.
- **`runRehydrateScenario` hides intent for tests that assert on `assertMethodExists` failure.** Mitigation: the helper performs the assertion inside; tests that assert _no_ method exists keep using direct access.
- **Shared helper drifts between rehydrate and persist.** Mitigation: keep the two helpers narrow and named for their call shape, not for a generic "controller scenario" abstraction.

## 9. Constraint reminders (from `AGENTS.md`)

- KISS; no new abstractions beyond extending `controllerTestHelpers.js`.
- British English in all new comments, JSDoc, and docs.
- No `console.*` calls in backend code (n/a — this is test code).
- Do not disable lint rules.
- Never push commits that fail pre-commit hooks.

## 10. Final results

**Reviewer verdict:** CLEAN (Code Reviewer, second pass).

**Regression-checker vs saved baseline:**

- Regressions Count: 0
- New Failures Count: 0
- Fixes Count: 1 — `tests/parsers/parserMatchingAndDocumentIds.test.js` `max-lines` warning removed (624 → 496 lines).

**Lint:** 15 warnings (down from 16 baseline). The `parserMatchingAndDocumentIds.test.js` warning is gone. All other warnings are pre-existing on files outside this refactor's scope.

**Tests:** 1871/1871 backend tests pass (29 test files in the three target directories plus the rest of the backend suite; 30/30 in the parser test).

**Line count changes:**

| File                                                              | Before | After |                                      Delta |
| ----------------------------------------------------------------- | -----: | ----: | -----------------------------------------: |
| `tests/helpers/controllerTestHelpers.js`                          |    233 |   325 |                      +92 (two new exports) |
| `tests/controllers/abclassController.rehydrateAssignment.test.js` |    475 |   425 |                                        −50 |
| `tests/controllers/abclassController.persistAssignment.test.js`   |    403 |   386 |                                        −17 |
| `tests/feedbackPopulators/sheetsFeedback.test.js`                 |    245 |   236 |                                         −9 |
| `tests/parsers/parserMatchingAndDocumentIds.test.js`              |    624 |   496 | **−128 (fixes pre-existing lint warning)** |
| **Net**                                                           |   1980 |  1868 |                **−112 lines of test code** |

**Test-case merges (preserving every behavioural assertion):**

- `sheetsFeedback.test.js`: two `it` cases for white-background status merged into one `it.each([['unknown'], ['']])` (both status values hit the same `else` branch in `getFormatForStatus`).
- `abclassController.rehydrateAssignment.test.js`: two `it` cases for SLIDES/SHEETS subclass rehydration merged into one `it.each([['SLIDES'], ['SHEETS']])`.
- `parserMatchingAndDocumentIds.test.js`: two `it` cases for reference/template documentId set merged into one; three `it` cases for null-input handling parametrised via `it.each`.

**Helper additions:**

- `tests/helpers/controllerTestHelpers.js`: `runRehydrateScenario`, `runPersistScenario` (both British-English JSDoc, both use `assertMethodExists` internally so the redundant "RED: Method doesn't exist yet" comments were correctly removed in callers).
- `tests/parsers/parserMatchingAndDocumentIds.test.js`: local `buildSlidesParserHarness(slidesByDocId)` (N-way routing, supports static arrays and lazy callbacks) and local `buildSheetsParserHarness()`.

**Production code touched:** none. `src/backend/**` and `src/frontend/**` are untouched.

**No new files** (excluding the plan file itself, which lives at the repo root and is untracked until the orchestrator stages it).
