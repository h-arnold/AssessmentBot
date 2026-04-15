# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the replacement maintenance `SPEC.md` for this CODE_REVIEW_EVAL follow-through work.
2. No frontend layout spec is required for this work because the scope is builder/backend/docs/process only.
3. Treat `SPEC.md` as the source of truth for the JsonDbApp contract, builder reliability rules, and bounded repo hygiene scope.
4. Use this action plan to sequence delivery and testing; do not reopen settled builder-contract decisions here.

## Scope and assumptions

### Scope

- Align the active `scripts/builder` runtime contract with the agreed vendored JsonDbApp `v0.1.1` builder subset.
- Replace placeholder JsonDbApp vendored files, synchronise `builder.config.json` so `jsonDbApp.sourceFiles` enumerates the exact committed subset for this pass, and update Stage 6 resolution behaviour accordingly.
- Update `package.json` and `package-lock.json` to add the direct `zod` dependency required for builder config validation, including the resulting dependency-installation and lockfile-validation follow-through.
- Harden builder portability and diagnostics for Windows path normalisation, shared file walking, and backend copy stage errors.
- Complete the agreed follow-through items for the Sonar helper timeout, root lint/pre-commit hygiene, docs anchor, deprecated AdminSheet JSDoc cleanup, and request-store test wording.
- Update only the builder docs and planning docs needed to keep the final contract truthful.

### Out of scope

- Any not-agreed or de-prioritised comments from `CODE_REVIEW_EVAL.md`.
- Frontend code, frontend tests, or frontend layout changes.
- New automation for refreshing the vendored JsonDbApp snapshot beyond this maintenance pass.
- Broad deprecated AdminSheet refactors or lint enablement.
- TypeScript or ESLint shared-config policy changes.

### Assumptions

1. The committed `scripts/builder/vendor/jsondbapp` snapshot becomes the canonical runtime JsonDbApp input for both inlining and manifest merge.
2. The vendored JsonDbApp subset for this pass is sourced from upstream tag `v0.1.1` and consists of the real upstream `appsscript.json` plus the real upstream files explicitly enumerated in the updated `jsonDbApp.sourceFiles` list in `builder.config.json`; no implicit transitive-closure or runtime-discovery rule applies.
3. `jsonDbApp.sourceFiles` remains the authoritative inclusion list for that exact committed subset, while Stage 7 continues to inline in deterministic lexicographic relative-path order rather than config-array order.
4. The upstream `v0.1.1` public exports required by AssessmentBot remain `loadDatabase` and `createAndInitialiseDatabase`.
5. The real upstream `v0.1.1` manifest adds `timeZone`, `exceptionLogging`, and `runtimeVersion`, but the backend manifest already owns those fields, so Stage 8 merge semantics remain unchanged in this pass.
6. No dedicated automated harness will be added for Markdown anchors, deprecated-file JSDoc wording, Sonar timeout behaviour, or Husky hook exit-code propagation unless implementation finds an already-local lightweight pattern.

---

## Global constraints and quality gates

### Engineering constraints

- Keep scope strictly to the agreed review comments.
- Treat `scripts/builder` as active: prefer contract-correct, tested fixes over doc-only drift workarounds.
- Treat `src/AdminSheet` as deprecated: limit changes there to minimal documentation-quality cleanup.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Use only existing repository commands for automated validation.
- For docs-only or wording-only items, explicitly record when red-first automated tests are skipped and why.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria where an existing automated harness already exists.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands and record any intentionally manual-only checks.

### Validation commands hierarchy

- Builder lint: `npm run builder:lint`
- Builder tests: `npm run builder:test -- <target>`
- Builder compile: `npm run builder:compile`
- Full builder regression: `npm run builder:ci`
- Root lint: `npm run lint`
- Root lint autofix command used by Husky: `npm run lint:fix`
- Root backend tests: `npm test -- <target>`

---

## Section 1 — JsonDbApp contract alignment and config validation

**Status:** Complete

**Checklist**

- Red tests added: Complete
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Make the builder contract truthful by committing the real JsonDbApp `v0.1.1` builder subset, synchronising the config allowlist to that subset, and converting Stage 6 into local validation-only behaviour backed by a Zod schema module.

### Constraints

- `builder.config.json` remains the authoritative runtime source for `jsonDbApp.sourceFiles` and `jsonDbApp.publicExports`, and its updated `sourceFiles` list must enumerate the exact committed subset for this pass.
- The committed vendor snapshot, not a downloaded archive, must be the runtime input for both Stage 6 and later JsonDbApp-consuming stages.
- `package.json` and `package-lock.json` must be updated for the direct `zod` dependency required by schema-based config validation, with dependency-installation and lockfile-validation follow-through kept within the existing repository workflow.
- Preserve `BuildStageError` stage context and keep Stage 7 lexicographic ordering semantics.
- Do not introduce new refresh automation or a new builder entrypoint.

### Acceptance criteria

- `scripts/builder/vendor/jsondbapp` contains the real upstream `v0.1.1` builder subset required by the updated config, replacing the current placeholder files.
- `scripts/builder/builder.config.json` is updated so `jsonDbApp.sourceFiles` enumerates the exact committed upstream subset for this pass and remains the authoritative inclusion list.
- `package.json` and `package-lock.json` are updated to own the direct `zod` dependency for builder config validation, and Section 1 validation is run against the installed dependency tree reflected by that lockfile change.
- Builder config validation moves to an adjacent Zod schema module with inferred config types; empty, duplicate, invalid, or out-of-root JsonDbApp arrays/paths fail early with `preflight-clean` stage context.
- `scripts/builder/src/steps/resolve-jsondb-source.ts` validates and normalises the configured vendored snapshot only; it no longer fetches, shells out to `curl` or `tar`, scans for replacement files, repoints `BuilderPaths` to a workdir snapshot, or leaves placeholder-content rejection to Stage 7.
- Stage 6 becomes the canonical blocking owner for placeholder vendored-content rejection before Stage 7, and downstream inlining may assume validated real source.
- `docs/developer/builder/builder-script.md` is updated so its JsonDbApp configuration example, public-export example, Stage 6 narrative, and retained provenance note match the final committed-vendor contract.
- Stage 8 merge behaviour stays unchanged, and regression coverage proves the real vendored manifest does not force broader merge semantics in this pass.

### Required test cases (Red first)

Builder config tests:

1. Update `scripts/builder/src/config.spec.ts` so invalid JsonDbApp arrays (empty or duplicate entries), invalid relative paths, and malformed config fail through the new Zod-backed contract.
2. Add or update a config test proving Windows-style configured source-file separators are normalised before downstream use.
3. Confirm the Section 1 red-first change set covers the package-manifest follow-through for direct `zod` adoption, including the resulting lockfile update and validation against the refreshed installed dependency tree.

Builder stage tests:

1. Replace the current download/archive-centred `scripts/builder/src/steps/resolve-jsondb-source.spec.ts` coverage with vendored-snapshot fixture coverage that fails until Stage 6 validates the committed snapshot and exact configured file list locally.
2. Add a Stage 6 regression proving missing configured vendored files fail rather than being auto-discovered.
3. Add a Stage 6 regression proving resolved `BuilderPaths` no longer repoint to `build/work` and instead remain pointed at the configured vendored snapshot paths.
4. Add a Stage 6 regression proving placeholder vendored content is rejected there, before Stage 7 inlining is reached.
5. Add or update `scripts/builder/src/steps/jsondb-inline-namespace.spec.ts` coverage so downstream inlining operates on already-validated real source and the refreshed `jsonDbApp.publicExports` contract still passes against the real vendored subset.
6. Add or update `scripts/builder/src/steps/merge-manifest.spec.ts` coverage proving backend-owned top-level manifest fields remain intact while scopes/services are merged from the real vendored manifest.

### Section checks

- `npm run builder:test -- scripts/builder/src/config.spec.ts`
- `npm run builder:test -- scripts/builder/src/steps/resolve-jsondb-source.spec.ts`
- `npm run builder:test -- scripts/builder/src/steps/jsondb-inline-namespace.spec.ts`
- `npm run builder:test -- scripts/builder/src/steps/merge-manifest.spec.ts`
- `npm run builder:lint`
- `npm run builder:compile`
- Re-run the Section 1 builder checks after refreshing the installed dependency tree reflected in the updated `package-lock.json` if the local environment needed a dependency install for direct `zod` adoption.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the final Stage 6 or schema-module code needs a short note explaining why runtime download/tooling was intentionally removed and why config-owned JsonDbApp lists remain authoritative.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Red phase started: Section 1 builder-contract coverage is in progress; update tests and test fixtures only, with no production/package changes in this phase.
  - Red phase completed: added builder red coverage in scripts/builder/src/config.spec.ts, scripts/builder/src/steps/resolve-jsondb-source.spec.ts, scripts/builder/src/steps/jsondb-inline-namespace.spec.ts, and scripts/builder/src/steps/merge-manifest.spec.ts.
  - Red review follow-up: relaxed the config red test so direct `zod` ownership is accepted from either `dependencies` or `devDependencies`, plus the lockfile root direct-dependency surface, avoiding an unnecessary production-only constraint on the later green implementation.
  - Red review follow-up: split the combined JsonDbApp `sourceFiles` and `publicExports` empty-array/duplicate-entry coverage into field-specific tests so partial validation cannot satisfy the contract.
  - Red review follow-up: added Stage 7 coverage proving JsonDbApp inlining keeps lexicographic relative-path ordering rather than config-array order.
  - Red check status (post-review): `npm run builder:test -- scripts/builder/src/config.spec.ts` still fails for the expected missing direct-`zod`/Zod-schema contract gaps and Windows separator normalisation gap; `npm run builder:test -- scripts/builder/src/steps/resolve-jsondb-source.spec.ts` still fails for the expected legacy Stage 6 behaviour; `npm run builder:test -- scripts/builder/src/steps/jsondb-inline-namespace.spec.ts`, `npm run builder:test -- scripts/builder/src/steps/merge-manifest.spec.ts`, and `npm run builder:lint` pass. Section 1 red phase remains intentionally failing only on the old-vs-new contract gaps and is ready for re-review.
  - Green phase started: replacing the placeholder JsonDbApp vendor snapshot with the committed upstream `v0.1.1` subset, moving builder config validation into an adjacent Zod schema module, and converting Stage 6 to vendored-snapshot validation only.
  - Green phase completed: committed the real upstream JsonDbApp builder subset listed in `scripts/builder/builder.config.json`, added the direct root `zod` dependency, removed Stage 6 runtime download/archive behaviour, moved placeholder rejection to Stage 6, and updated the builder documentation to match the final committed-vendor contract.
  - Green validation completed: `npm run builder:test -- scripts/builder/src/config.spec.ts`, `npm run builder:test -- scripts/builder/src/steps/resolve-jsondb-source.spec.ts`, `npm run builder:test -- scripts/builder/src/steps/jsondb-inline-namespace.spec.ts`, `npm run builder:test -- scripts/builder/src/steps/merge-manifest.spec.ts`, `npm run builder:lint`, `npm run builder:compile`, `npm run builder:test`, and `npm run build` all pass against the refreshed dependency tree with direct `zod` ownership.
  - Green review follow-up: `scripts/builder/src/steps/merge-manifest.spec.ts` now exercises Stage 8 against the committed vendored manifest at `scripts/builder/vendor/jsondbapp/appsscript.json` instead of a synthetic JsonDbApp manifest fixture, and the Section 1 builder checks were re-run after that fix.
  - Green review follow-up: restored the upstream-style `console.error`, `console.warn`, and `console.log` calls in the committed vendored JsonDbApp logger (`scripts/builder/vendor/jsondbapp/src/01_utils/JDbLogger.js`) and documented the user-approved narrow exception for upstream/runtime parity, then re-ran the Section 1 builder checks.
- **Delivery evidence:**
  - Branch: `chore/apihandler-gas-log-preservation-spec`.
  - Section 1 delivery commit: `4d90c78cc05aafc308bd16c3eef0e98bde1bf5dc` — `feat: complete section 1 JsonDbApp contract alignment`.
  - Push confirmation: `git push origin chore/apihandler-gas-log-preservation-spec` succeeded (`feb3fbd..4d90c78` on `origin/chore/apihandler-gas-log-preservation-spec`).
  - Forward-only ACTION_PLAN evidence follow-up commit message: `docs: record section 1 commit evidence`.
- **Deviations from plan:** User-approved narrow exception: the vendored upstream JsonDbApp logger keeps its `console.*` calls for upstream/runtime parity; this is documented as a file-specific deviation only and does not broaden active-project logging policy.
- **Follow-up implications for later sections:** Section 1 is complete; later sections remain untouched in this pass.

---

## Section 2 — Builder portability and stage-diagnostic hardening

**Status:** Complete

**Checklist**

- Red tests added: Complete
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Remove the agreed portability and observability defects in active builder file handling without changing the final GAS layout contract.

### Constraints

- Keep required output artefacts and forbidden-leakage rules unchanged in meaning.
- Reuse `scripts/builder/src/lib/fs.ts` as the canonical recursive walker once its path-join issue is fixed.
- Preserve existing stage IDs and fail through `BuildStageError` rather than raw Node errors.

### Acceptance criteria

- The Windows path-normalisation bug is corrected in every agreed builder surface that emits or validates relative paths.
- `scripts/builder/src/lib/fs.ts` uses path-safe joins and becomes the shared walker used by `materialise-output` where the helper contract fits.
- `scripts/builder/src/steps/backend-copy.ts` wraps per-file `mkdir` and `copyFile` failures with `backend-copy` stage context and file-path detail.
- Existing output validation semantics remain unchanged apart from corrected portability and clearer diagnostics.

### Required test cases (Red first)

Builder stage tests:

1. Add or update `scripts/builder/src/steps/materialise-output.spec.ts` so Windows-style relative paths are asserted in forward-slash form and the shared walker integration is covered.
2. Add or update `scripts/builder/src/steps/validate-output.spec.ts` so required-file and duplicate-global validation still operate on correctly normalised forward-slash paths.
3. Add a `scripts/builder/src/steps/backend-copy.spec.ts` failure-path test that proves `mkdir` or `copyFile` errors are rethrown as `BuildStageError` with `backend-copy` stage context instead of raw Node errors.
4. Add or update shared-helper tests only if a new `lib/fs` spec is the smallest practical way to protect the path-join fix.

### Section checks

- `npm run builder:test -- scripts/builder/src/steps/materialise-output.spec.ts`
- `npm run builder:test -- scripts/builder/src/steps/validate-output.spec.ts`
- `npm run builder:test -- scripts/builder/src/steps/backend-copy.spec.ts`
- `npm run builder:test -- scripts/builder/src/lib/fs.spec.ts`
- `npm run builder:lint`
- `npm run builder:compile`
- `npm run builder:test`

### Optional `@remarks` JSDoc follow-through

- Consider `@remarks` only if the shared walker or backend-copy error wrapper needs a short non-obvious portability/diagnostics note.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Red phase started: Section 2 portability and diagnostic coverage was kept test-only while the agreed failures were documented in the plan.
  - Red phase completed: added failing coverage in `scripts/builder/src/steps/materialise-output.spec.ts`, `scripts/builder/src/steps/validate-output.spec.ts`, `scripts/builder/src/steps/backend-copy.spec.ts`, and `scripts/builder/src/lib/fs.spec.ts`.
  - Red review completed: Section 2 red coverage is review-clean with no remaining test-only follow-up before green implementation.
  - Green phase started: fixed the shared file walker first, then wired `materialise-output` onto it, corrected forward-slash normalisation in the agreed output-validation surfaces, and wrapped per-file backend copy failures with stage-aware diagnostics.
  - Green phase completed: `scripts/builder/src/lib/fs.ts` now uses path-safe joins while preserving Windows path style during recursive traversal, `materialise-output` reuses the shared walker, `validate-output` emits forward-slash relative paths for required-file and duplicate-global checks, and `backend-copy` rethrows per-file `mkdir` and `copyFile` failures as `BuildStageError` with path detail.
  - Green validation follow-up: adjusted the Windows-style `fs.readdir(...)` mock casts in `scripts/builder/src/lib/fs.spec.ts` so `npm run builder:compile` passes without changing the test intent.
  - Green validation completed: `npm run builder:test -- scripts/builder/src/steps/materialise-output.spec.ts`, `npm run builder:test -- scripts/builder/src/steps/validate-output.spec.ts`, `npm run builder:test -- scripts/builder/src/steps/backend-copy.spec.ts`, `npm run builder:test -- scripts/builder/src/lib/fs.spec.ts`, `npm run builder:lint`, `npm run builder:compile`, `npm run builder:test`, and `npm run build` all pass.
  - Green review completed: Section 2 is review-clean after the portability fixes, shared-walker reuse, and backend-copy diagnostic hardening outcomes were verified together.
  - Outcome summary: Section 2 now keeps relative-path diagnostics portable across Windows and POSIX surfaces without changing the GAS layout contract, while backend copy failures retain actionable `backend-copy` stage context.
- **Delivery evidence:**
  - Branch: `chore/apihandler-gas-log-preservation-spec`.
  - Section 2 delivery commit: `b5e95dc3d4617d2af7ebb1e916f3574807138598` — `feat: complete section 2 builder portability hardening`.
  - Push confirmation: `git push origin chore/apihandler-gas-log-preservation-spec` succeeded (`736b000..b5e95dc` on `origin/chore/apihandler-gas-log-preservation-spec`).
  - Forward-only ACTION_PLAN evidence follow-up commit message: `docs: record section 2 commit evidence`.
- **Deviations from plan:** None beyond the explicit red-phase addition of `scripts/builder/src/lib/fs.spec.ts`, which remained the smallest practical place to pin the shared walker path-join defect.
- **Follow-up implications for later sections:** Section 2 is complete; later sections remain unchanged in this pass.

---

## Section 3 — Repo quality-gate and hygiene follow-through

**Status:** Complete

**Checklist**

- Red tests added / explicitly skipped by plan: Complete (the requestStore rename and manual-only surfaces were explicitly skipped by plan)
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete (command exits 0; existing unrelated Cohort.js lint warning unchanged)
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Land the remaining agreed non-builder fixes without expanding into unrelated repo cleanup.

### Constraints

- Keep each change local to the explicitly agreed files.
- Do not expand deprecated AdminSheet work beyond minimal JSDoc quality cleanup.
- Do not invent new automated harnesses for docs-only or wording-only fixes unless implementation finds a very small existing pattern.
- Record manual validation explicitly where no automated harness exists.

### Acceptance criteria

- `.codex/skills/sonar-pr-duplication/scripts/sonar_pr_duplication_report.py` uses an explicit finite network timeout and keeps timeout failures diagnosable.
- `.husky/pre-commit` no longer swallows `npm run lint:fix` failure; lint failure blocks the commit path.
- The unused `console` import is removed from `eslint.config.js`.
- The broken anchor in `docs/setup/configOptions.md` is fixed.
- Empty or placeholder JSDoc blocks in the three listed deprecated AdminSheet files are replaced with concise meaningful descriptions or removed.
- The mismatched test title in `tests/api/requestStore.test.js` accurately describes the assertion.

### Required test cases (Red first)

Root/backend tests:

1. Red automated test work is not required for `tests/api/requestStore.test.js` because the change is title-only wording; run the existing targeted test after the rename to confirm no behavioural regression.

Manual-only checks (red phase intentionally skipped because no existing harness exists for these surfaces):

1. Inspect the Sonar helper change to confirm the HTTP call now passes an explicit timeout argument and preserves actionable failure context.
2. Inspect `docs/setup/configOptions.md` and the listed deprecated AdminSheet files to confirm the agreed wording-only cleanup remains bounded.
3. Run a manual Husky smoke test and record the observed outcome, confirming `.husky/pre-commit` now returns non-zero when `npm run lint:fix` fails instead of swallowing the failure.

### Section checks

- `npm test -- tests/api/requestStore.test.js`
- `npm run lint`
- `npm run lint:fix`

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Red phase started: Section 3 repo quality-gate follow-through began by updating the plan first and keeping scope limited to the agreed non-builder files.
  - Red phase completed: automated red tests were intentionally skipped by plan for the requestStore title-only wording change and for the manual-only Sonar timeout, docs anchor, deprecated AdminSheet JSDoc cleanup, and Husky hook surfaces because no existing automated harness was identified for those items.
  - Red review completed: Section 3 red-phase scope is review-clean with the planned test skips preserved.
  - Green phase completed: added a 15-second explicit timeout plus timeout-specific `ScriptError` context for Sonar API fetches, made `.husky/pre-commit` fail fast on `npm run lint:fix`, removed the unused `console` import from `eslint.config.js`, fixed the broken Markdown anchor, replaced the targeted placeholder JSDoc blocks in the three deprecated AdminSheet files, and renamed the mismatched requestStore test title to match its assertion.
  - Validation completed: `npm test -- tests/api/requestStore.test.js` passed (23 tests). `npm run lint` and `npm run lint:fix` both exited 0 and still report the pre-existing unrelated `no-magic-numbers` warning in `src/backend/Models/Cohort.js`.
  - Manual verification completed: a Python smoke check that monkeypatched `urlopen` to raise `URLError(socket.timeout(...))` produced `Timed out after 15s fetching Sonar API JSON from https://sonarcloud.io/api/test`; a Bash smoke check sourcing `.husky/pre-commit` with a simulated failing `npm` function returned `husky_exit=42`; docs inspection confirmed the fixed `(#-json-db-lock-timeout-ms)` anchor is present and the broken variant is absent; a placeholder-count check reported zero empty placeholder JSDoc blocks remaining in `ABLogger.js`, `ScriptAppManager.js`, and `SheetsAssessor.js`.
  - Green review completed: Section 3 is review-clean after the Sonar timeout hardening, Husky exit preservation, docs/AdminSheet cleanup, and requestStore title alignment were checked together.
  - Outcome summary: Section 3 now preserves actionable Sonar timeout logging, keeps pre-commit failures blocking, and records the bounded manual-only follow-through without widening scope.
- **Delivery evidence:**
  - Branch: `chore/apihandler-gas-log-preservation-spec`.
  - Section 3 delivery commit: `bca2e067209d41006adcb933e946ee4e484cfc40` — `chore: complete section 3 repo quality-gate follow-through`.
  - Push confirmation: `git push origin chore/apihandler-gas-log-preservation-spec` succeeded (`60a59f2..bca2e06` on `origin/chore/apihandler-gas-log-preservation-spec`).
  - Forward-only ACTION_PLAN evidence follow-up commit message: `docs: record section 3 commit evidence`.
- **Deviations from plan:** None beyond recording the existing unrelated lint warning instead of broadening Section 3 scope to fix `src/backend/Models/Cohort.js`.
- **Follow-up implications for later sections:** Preserve the manual-verification notes and the unchanged unrelated lint warning context in the regression and rollout sections.

---

## Regression and contract hardening

**Status:** Complete

**Checklist**

- Red tests added / explicitly skipped by plan: Complete (automated red test creation was intentionally skipped because this section is validation-only and adds no new behaviour or acceptance criteria)
- Red review clean: Complete
- Green implementation complete: Complete
- Green review clean: Complete
- Checks passed: Complete (`npm run builder:ci`, `npm run lint`, `npm test -- tests/api/requestStore.test.js`, Sonar timeout smoke check, Husky blocking-behaviour smoke check, docs anchor reconfirmation, deprecated JSDoc cleanup reconfirmation)
- Action plan updated: Complete
- Commit created: Complete
- Push completed: Complete

### Objective

- Prove the builder contract, repo quality gates, and touched regression surfaces all hold together after the maintenance pass.

### Constraints

- Prefer the existing full builder command as the final builder gate.
- Do not widen regression runs beyond the touched surfaces unless a section discovers additional coupling.
- Keep this section validation-only: do not add behaviour, acceptance tests, or early regression-command runs during the red phase.

### Acceptance criteria

- The full builder pipeline runs green against the committed vendored JsonDbApp subset.
- Touched builder tests, root lint, and the touched root Vitest surface all pass.
- Manual validation notes for Sonar timeout behaviour, pre-commit blocking behaviour, docs anchor, and deprecated JSDoc cleanup are recorded before the plan is retired.

### Required test cases/checks

- [x] Run `npm run builder:ci`.
- [x] Run `npm run lint`.
- [x] Run `npm test -- tests/api/requestStore.test.js`.
- [x] Reconfirm the manual checks recorded in Section 3.
- [x] Record that red automated test creation is intentionally skipped because this section is a regression/verification gate with no new behaviour to drive.

### Section checks

- `npm run builder:ci`
- `npm run lint`
- `npm test -- tests/api/requestStore.test.js`

### Implementation notes / deviations / follow-up

- **Implementation notes:**
  - Red phase started: Section 4 regression and contract hardening began as a validation-only gate, so this phase was limited to planning/status updates and explicitly deferred the final regression commands.
  - Red phase completed: automated red test creation was intentionally skipped because this section only reruns existing regression commands and manual reconfirmation steps; it introduces no new behaviour, implementation surface, or acceptance criteria to drive with failing tests.
  - Red review completed: Section 4 red-phase scope remained review-clean with the validation-only plan and explicit test-skip rationale preserved.
  - Green phase completed: this validation-only green phase ran the agreed regression/contract-hardening checks without changing production code or adding tests; `npm run builder:ci` passed end-to-end, including builder lint, builder tests, TypeScript compile, and the production builder run against the committed vendored JsonDbApp subset.
  - Validation completed: `npm run lint` exited 0 while still reporting the same existing unrelated `no-magic-numbers` warning in `src/backend/Models/Cohort.js`; `npm test -- tests/api/requestStore.test.js` passed (23 tests).
  - Manual reconfirmation completed: the Sonar timeout smoke check still raises `ScriptError` with `Timed out after 15s fetching Sonar API JSON from https://sonarcloud.io/api/test`; the Husky smoke check still preserves blocking failure behaviour (`husky_exit=42` when `npm run lint:fix` is forced to fail); docs inspection still shows the fixed `(#-json-db-lock-timeout-ms)` anchor and no broken variant; the deprecated AdminSheet files still contain the cleaned meaningful JSDoc descriptions, with zero placeholder blocks detected.
  - Green review completed: Section 4 is review-clean after the builder/root regression reruns and manual reconfirmations were checked together as a validation-only closure pass.
  - Outcome summary: the regression/contract-hardening section is complete as a validation-only closeout, and the builder contract, repo quality gates, and the touched regression surfaces still hold together after the maintenance pass while the unrelated existing Cohort lint warning remains unchanged.
- **Delivery evidence:**
  - Branch: `chore/apihandler-gas-log-preservation-spec`.
  - Section 4 delivery commit: `7869b86de05efaa0c2d3387a469b1c93f4bbcc08` — `chore: complete section 4 regression hardening`.
  - Push confirmation: `git push origin chore/apihandler-gas-log-preservation-spec` succeeded (`bbfc4d3..7869b86` on `origin/chore/apihandler-gas-log-preservation-spec`).
  - Forward-only ACTION_PLAN evidence follow-up commit message: `docs: record section 4 commit evidence`.
- **Deviations from plan:** None beyond carrying forward the existing unrelated `src/backend/Models/Cohort.js` lint warning context while the command still exits 0.
- **Follow-up implications for later sections:** Do not reopen this validation-only section during de-sloppification; preserve the recorded regression evidence and the unchanged unrelated lint warning context as baseline history.

---

## Documentation and rollout notes

### Objective

- Keep planning and builder-facing documentation aligned with the delivered contract and call out any intentionally manual verification.

### Constraints

- Only update documentation relevant to the touched builder contract, planning artefacts, and agreed docs fixes.

### Acceptance criteria

- Root `SPEC.md` and `ACTION_PLAN.md` fully replace the stale apiHandler planning artefacts.
- Any touched builder docs now reflect the committed-vendor JsonDbApp contract, the corrected config example, the confirmed public-export list, and the non-download Stage 6 behaviour.
- Manual verification notes and any implementation deviations are filled in before the plan is deleted.
- No separate frontend layout spec is introduced because none is required.

### Required checks

1. Verify the planning artefacts reflect the final scope and assumptions.
2. Verify any touched builder docs match the final Stage 6 and vendored-provenance contract.
3. Confirm section implementation-notes and deviation fields are completed during execution.

### Optional `@remarks` JSDoc review

- Confirm whether Section 1 or 2 introduced any non-obvious reasoning worth preserving in code-level `@remarks`; otherwise record `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** TBD during delivery.
- **Deviations from plan:** TBD during delivery.

---

## Suggested implementation order

1. Section 1 — JsonDbApp contract alignment and config validation
2. Section 2 — Builder portability and stage-diagnostic hardening
3. Section 3 — Repo quality-gate and hygiene follow-through
4. Regression and contract hardening
5. Documentation and rollout notes
