# Regression-Checker Builder CLI Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `/home/developer/AssessmentBot/SPEC.md`.
2. Read `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`.
3. Read `/home/developer/AssessmentBot/AGENTS.md`.
4. Read `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`.
5. Read `/home/developer/AssessmentBot/docs/developer/builder/builder-script.md`.
6. Read `/home/developer/AssessmentBot/docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.
7. Read `/home/developer/AssessmentBot/package.json`.
8. Read `/home/developer/AssessmentBot/scripts/builder/vitest.config.ts`.
9. Treat those documents as the source of truth for scope, safety, builder quality gates, and command hierarchy.

## Scope and assumptions

### Scope

- builder-only delivery of the `regression-checker [sessionId]` CLI under `scripts/builder/src/regression-checker/`
- config loading and validation for supported tool families only
- baseline storage, follow-up comparison, deterministic reporting, and hook-friendly exit codes
- builder tests, builder lint/compile validation, and minimal supporting docs or ignore-rule updates required by the CLI contract

### Out of scope

- frontend layout or workflow changes
- backend or API integration
- arbitrary command execution beyond validated supported tools
- changes to existing human-friendly npm scripts beyond any CLI entry point required for this feature
- post-v1 tool families or CI orchestration features

### Assumptions

1. `docs/developer/regression-cli-spec.md` remains the product source of truth when plan detail and wording differ.
2. The implementation will stay inside builder TypeScript conventions and the existing builder Vitest/ESLint/TypeScript hierarchy.
3. Generated reports live under `.ts-regression-checker/reports`, while `.ts-regression-checker/regression.config.json` remains trackable.
4. Existing in-progress builder test files under `scripts/builder/src/regression-checker/` are part of the intended delivery and should be extended rather than replaced blindly.

---

## Global constraints and quality gates

### Engineering constraints

- Keep scope builder-only and minimal.
- Fail fast on invalid config, unsupported tool families, repo-escaping paths, and baseline incompatibility.
- Do not execute arbitrary shell strings; only validated supported tool invocations are allowed.
- Preserve deterministic ordering for manifests, derived summaries, and text reports.
- Use Zod-first validation and infer TypeScript types from schemas for new validation modules.
- Use British English in docs, comments, and user-facing text.

### Builder-first command hierarchy

Use the smallest builder command first, then expand only as needed:

1. Focused builder test command for the active spec file(s), for example `npm run test:builder -- scripts/builder/src/regression-checker/<target>.spec.ts`.
2. Targeted builder test batch for the active regression-checker area.
3. `npm run lint:builder`
4. `npm run builder:compile`
5. `npm run test:builder`
6. `npm run test:builder:coverage`
7. `npm run build:production` only after the feature is otherwise green or when builder pipeline integration must be proved.

Do not start with repo-wide `lint`, `test`, or frontend/backend commands for this feature.

### Strict TDD flow (mandatory per section)

For every implementation section:

1. **Red** — add or extend failing builder tests that cover only that section’s acceptance criteria.
2. **Red check** — run the smallest relevant builder test command and capture the failing evidence.
3. **Green** — implement the smallest production change that makes the red tests pass.
4. **Refactor** — simplify names, duplication, and helper boundaries while keeping the section green.
5. **Section verification** — run the section checks exactly as listed before moving on.
6. **Review gate** — do not mark the section complete until mandatory-read evidence, review evidence, and checklist items are satisfied.

### Delegation mandatory-read gate

For every delegated hand-off:

- include a `Files read` section with absolute paths
- verify every mandatory path for that phase before accepting the hand-off
- if any mandatory path is missing, return the task to the same agent and block progress

### Commit and push evidence requirements

- Every completed section must capture `git --no-pager status --short` evidence before commit.
- Every section that claims completion must record the commit hash from `git --no-pager log -1 --stat`.
- Final completion requires branch evidence from `git --no-pager rev-parse --abbrev-ref HEAD` and push evidence from `git push` output or equivalent orchestrator record.
- Do not tick commit or push checklist items without explicit evidence.

### Mandatory de-sloppification and docs pass

- Before final completion, run a dedicated de-sloppification pass on the delivered builder diff.
- Before final completion, run a dedicated docs pass for any touched builder-facing docs and ignore rules.
- Both passes must honour the same mandatory-read evidence gate.

### Checklist status template (use in every section)

- [ ] Red tests added/updated
- [ ] Red failure captured
- [ ] Green implementation complete
- [ ] Refactor complete
- [ ] Section checks passed
- [ ] Mandatory-read evidence verified
- [ ] Review feedback resolved
- [ ] Docs impact handled or marked N/A
- [ ] Commit evidence captured
- [ ] Push evidence captured or marked N/A until final section

---

## Section 1 — CLI contract and config safety rails

### Objective

- Finalise the CLI entry contract, session resolution, config schema, path safety, script resolution, and validation-time rejection of unsupported or mutating inputs.

### Constraints

- `sessionId` resolution must use the positional argument first, then Git branch lookup.
- Detached HEAD branch lookup failure is a hard error.
- `tool=tsc` must require `run.kind=tsc`.
- `npm-script` checks must resolve to exactly one supported tool family and must be non-mutating.
- New validation modules must follow Zod-first typing.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
- `/home/developer/AssessmentBot/docs/developer/builder/builder-script.md`
- `/home/developer/AssessmentBot/package.json`
- `/home/developer/AssessmentBot/scripts/builder/vitest.config.ts`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/section1-cli-contract.spec.ts`

Implementation mandatory docs:

- all Testing Specialist docs above
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/cli/session-resolution.ts`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/config/validate-regression-config.ts`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/config/validate-regression-config.zod.ts`

Code Reviewer mandatory docs:

- all Implementation docs above

### Shared helper plan

1. Helper: config schema and validation helper set
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/config/`
   - Call-site rationale: validation must stay centralised and deterministic across CLI, runners, and storage
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`
2. Helper: session resolution helper
   - Decision: `keep local`
   - Owning module/path: `scripts/builder/src/regression-checker/cli/`
   - Call-site rationale: no broader builder reuse is proven in v1
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Valid config loads with defaulted `parallel.maxWorkers=min(4, logicalCpuCount)`.
- Unsupported tools, unsupported reporter modes, duplicate check IDs, repo-escaping paths, mutating scripts, multi-tool scripts, and unmappable scripts are rejected before execution.
- Explicit `sessionId` uses source `arg`; omitted `sessionId` uses source `git-branch`.
- Detached HEAD or failed branch lookup surfaces a clear error.

### Required test cases (Red first)

Builder tests:

1. Extend `section1-cli-contract.spec.ts` for valid config loading and session-source resolution.
2. Cover duplicate IDs, unsupported tool families, unsupported reporter modes, and `tool=tsc` plus `run.kind=npm-script` rejection.
3. Cover mutating script flags, chained scripts, unmappable scripts, and missing nested `package.json` resolution.
4. Cover absolute or escaping `reportDirectory`, `cwd`, and `project` paths.
5. Cover omitted `parallel.maxWorkers` defaulting and detached HEAD failure wording.

### Section checks

- `npm run test:builder -- scripts/builder/src/regression-checker/section1-cli-contract.spec.ts`
- `npm run lint:builder`
- `npm run builder:compile`
- Mandatory-read evidence gate passed for all delegated hand-offs.

### Implementation notes

- Completion status: complete.
- Finalised Section 1 CLI and config safety-rail fixes covering session source resolution, strict tool/run-kind validation, repo-safe path checks, mutating-script rejection, and deterministic `parallel.maxWorkers` defaulting behaviour.
- Resolved review findings by tightening validation failure coverage and confirming detached-HEAD/branch lookup failure handling is explicit and test-backed.
- Deviations: none.
- Follow-up implications for later sections: Section 2+ can now assume stable session/config validation contracts and proceed directly with storage, manifest, runner, and comparison layering on top of the locked Section 1 interfaces.
- Commit/push evidence: branch `feature/regression-checker-cli-implementation`; commits `abd8138 — feat(regression-checker): complete section 1 cli contract and config safety rails` and `d35caaf — docs(plan): add regression-checker spec and section 1 progress tracking`; push succeeded to `origin/feature/regression-checker-cli-implementation`.

### Next status

- Section 1 is **complete** with commit and push evidence captured.

### Section checklist

- [x] Red tests added/updated
- [x] Red failure captured
- [x] Green implementation complete
- [x] Refactor complete
- [x] Section checks passed
- [x] Mandatory-read evidence verified
- [x] Review feedback resolved
- [x] Docs impact handled or marked N/A
- [x] Commit evidence captured
- [x] Push evidence captured or marked N/A until final section

---

## Section 2 — Storage layout, manifests, and baseline compatibility

> Current phase marker: **Complete**

### Objective

- Implement safe session storage keys, baseline/run directory layout, manifest writing, baseline detection, and baseline compatibility validation.

### Constraints

- Session manifests must persist both `sessionId` and `sessionStorageKey`.
- Baselines live under `<reportDirectory>/<sessionStorageKey>/baseline/`.
- Follow-up runs live under `<reportDirectory>/<sessionStorageKey>/runs/<timestamp>/`.
- Comparison must abort cleanly when baseline metadata is incompatible.
- File layout and written metadata must stay deterministic.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
- `/home/developer/AssessmentBot/docs/developer/builder/builder-script.md`
- `/home/developer/AssessmentBot/scripts/builder/vitest.config.ts`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/storage`
- every changed file under `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/storage/`, listed explicitly in `Files read`

Implementation mandatory docs:

- all Testing Specialist docs above
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/storage`
- every changed file under `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/storage/`, listed explicitly in `Files read`

Code Reviewer mandatory docs:

- all Implementation docs above

### Shared helper plan

1. Helper: storage path resolver and session key encoder
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/storage/`
   - Call-site rationale: storage paths must stay consistent across baseline creation, compare runs, and reporting
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`
2. Helper: baseline compatibility evaluator
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/storage/`
   - Call-site rationale: comparison gating should stay separate from reporting and runner logic
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Missing baseline selects baseline mode; existing baseline selects compare mode.
- Baseline and current-run manifests write the required identity and metadata fields.
- Session storage keys are filesystem-safe and stable.
- Baseline incompatibility is detected before diffing and surfaced as a clear error/result.

### Required test cases (Red first)

Builder tests:

1. Baseline-mode path and manifest creation for a new session.
2. Compare-mode run path creation when a baseline already exists.
3. Stable session storage key generation from branch-like session IDs.
4. Baseline incompatibility for changed config fingerprint, check IDs, or tool families.
5. Deterministic manifest ordering and persisted path references.

### Section checks

- `npm run test:builder -- scripts/builder/src/regression-checker`
- `npm run lint:builder`
- `npm run builder:compile`
- Mandatory-read evidence gate passed for all delegated hand-offs.

### Implementation notes

- Completion status: complete.
- Review findings encountered and resolved: storage key path safety and manifest field ordering were flagged during review; both were resolved by enforcing deterministic session-key encoding and stable manifest write ordering across baseline/run outputs.
- Deviations: none.
- Follow-up implications for later sections: Section 3 can assume stable storage layout + manifest contracts and focus only on runner execution, artefact capture, and scheduler behaviour.
- Commit/push evidence: branch `feature/regression-checker-cli-implementation`; commits `6d2144e — feat(regression-checker): implement section 2 storage manifests and compatibility` and `d4a6d7b — docs(plan): record section 2 completion and section 3 start`; push succeeded to `origin/feature/regression-checker-cli-implementation`.

### Next status

- Section 2 is **complete** with commit/push evidence captured.

### Section checklist

- [x] Red tests added/updated
- [x] Red failure captured
- [x] Green implementation complete
- [x] Refactor complete
- [x] Section checks passed
- [x] Mandatory-read evidence verified
- [x] Review feedback resolved
- [x] Docs impact handled or marked N/A
- [x] Commit evidence captured
- [x] Push evidence captured or marked N/A until final section

---

## Section 3 — Tool runners and bounded scheduling

> Current phase marker: **Complete**

### Objective

- Deliver the runner layer for `eslint`, `vitest`, `playwright`, and `tsc`, including raw artefact capture and bounded scheduling rules.

### Constraints

- Only supported tools may execute.
- Each runner must enforce tool-native structured or parseable output modes.
- Playwright must run in a dedicated single-worker lane.
- Completion order must not affect stored order or rendered order.
- Execution errors must be captured as reportable check failures.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
- `/home/developer/AssessmentBot/docs/developer/builder/builder-script.md`
- `/home/developer/AssessmentBot/package.json`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/runners`
- every changed file under `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/runners/`, listed explicitly in `Files read`

Implementation mandatory docs:

- all Testing Specialist docs above
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/runners`
- every changed command-execution or scheduler file, listed explicitly in `Files read`

Code Reviewer mandatory docs:

- all Implementation docs above

### Shared helper plan

1. Helper: supported-tool runner registry
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/runners/`
   - Call-site rationale: CLI orchestration should select runners by tool family without switch duplication across sections
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`
2. Helper: scheduler for general lane plus Playwright lane
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/runners/`
   - Call-site rationale: concurrency rules are a core contract and should be testable separately from the CLI shell
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- ESLint, Vitest, and Playwright runners capture JSON artefacts in the required tool-native mode.
- `tsc` runs in stable text mode and captures parseable diagnostics output.
- Raw artefacts are written per check in the current baseline or run directory.
- Parallel execution honours `maxWorkers`, while Playwright remains isolated to one worker.
- Execution errors become structured failing check results rather than silent crashes.

### Required test cases (Red first)

Builder tests:

1. Runner command construction for each supported tool family.
2. Raw artefact capture paths and extensions per tool.
3. Scheduler behaviour for bounded general workers plus single-worker Playwright lane.
4. Deterministic result ordering despite out-of-order completion.
5. Execution error capture and propagation into reportable check results.

### Section checks

- `npm run test:builder -- scripts/builder/src/regression-checker`
- `npm run lint:builder`
- `npm run builder:compile`
- Mandatory-read evidence gate passed for all delegated hand-offs.

### Implementation notes

- Completion status: complete.
- Review findings encountered and resolved: no additional blocking findings were recorded beyond Section 3 scope; runner command wiring, artefact capture, scheduler lane isolation, and deterministic ordering were implemented and validated against the section checks.
- Deviations: none.
- Follow-up implications for later sections: Section 4 can assume per-check raw artefacts and execution-failure capture are available for deterministic derive and comparison logic.
- Commit/push evidence: _Pending — capture branch, commit hash(es), and push output after commit/push are completed._

### Section checklist

- [x] Red tests added/updated
- [x] Red failure captured
- [x] Green implementation complete
- [x] Refactor complete
- [x] Section checks passed
- [x] Mandatory-read evidence verified
- [x] Review feedback resolved
- [x] Docs impact handled or marked N/A
- [ ] Commit evidence captured
- [ ] Push evidence captured or marked N/A until final section

---

## Section 4 — Derived summaries and comparison engine

> Current phase marker: **Red tests in progress**

### Objective

- Convert raw artefacts into tool-specific derived summaries and implement regression, new-failure, and fix detection.

### Constraints

- Fingerprint rules must match the spec per tool family.
- Runtime/execution errors count as regressions.
- Vitest and Playwright skipped-in-current behaviour must count as regressions when baseline was not skipped.
- Output categories must remain deterministic and testable.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/compare`
- every changed file under `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/compare/`, listed explicitly in `Files read`

Implementation mandatory docs:

- all Testing Specialist docs above
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/compare`
- every changed comparison, runner-result, and manifest type file, listed explicitly in `Files read`

Code Reviewer mandatory docs:

- all Implementation docs above

### Shared helper plan

1. Helper: tool-specific derive adapters
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/compare/`
   - Call-site rationale: each tool family needs an explicit parse-and-fingerprint boundary
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`
2. Helper: comparison result aggregator
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/compare/`
   - Call-site rationale: report rendering should consume a stable comparison result rather than re-deriving counts
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Derived summaries are produced for every supported tool family.
- Regression, new-failure, and fix counts and item lists match the spec.
- Execution errors and baseline incompatibility are represented clearly in the comparison model.
- Result ordering stays deterministic for later report generation.

### Required test cases (Red first)

Builder tests:

1. ESLint error and warning fingerprints and regression semantics.
2. Vitest and Playwright failure plus skipped-state regression semantics.
3. `tsc` diagnostic parsing and fingerprint derivation.
4. Execution-error handling as regressions.
5. Aggregated counts and deterministic ordering across mixed check results.

### Section checks

- `npm run test:builder -- scripts/builder/src/regression-checker`
- `npm run lint:builder`
- `npm run builder:compile`
- Mandatory-read evidence gate passed for all delegated hand-offs.

### Section checklist

- [ ] Red tests added/updated
- [ ] Red failure captured
- [ ] Green implementation complete
- [ ] Refactor complete
- [ ] Section checks passed
- [ ] Mandatory-read evidence verified
- [ ] Review feedback resolved
- [ ] Docs impact handled or marked N/A
- [ ] Commit evidence captured
- [ ] Push evidence captured or marked N/A until final section

---

## Section 5 — Report writer, CLI orchestration, and exit codes

### Objective

- Integrate config, storage, runners, comparison, and report writing into the callable CLI with the fixed-structure header contract.

### Constraints

- Header markers and field order must be deterministic.
- Baseline mode must explicitly state baseline creation and lack of comparison diffing.
- Compare mode must write both `comparison.json` and `comparison.txt`.
- Exit codes must follow the spec: `0` for successful baseline creation, `0` for compare without regressions, `1` for compare with regressions, non-zero for invalid config or execution failure.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/cli`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/report`
- every changed file under those directories, listed explicitly in `Files read`

Implementation mandatory docs:

- all Testing Specialist docs above
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/cli`
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker/report`
- every changed orchestration, storage, runner, and comparison file, listed explicitly in `Files read`

Code Reviewer mandatory docs:

- all Implementation docs above

### Shared helper plan

1. Helper: report header renderer
   - Decision: `new`
   - Owning module/path: `scripts/builder/src/regression-checker/report/`
   - Call-site rationale: deterministic header formatting must stay isolated from CLI flow control
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`
2. Helper: CLI orchestration entrypoint
   - Decision: `keep local`
   - Owning module/path: `scripts/builder/src/regression-checker/cli/`
   - Call-site rationale: orchestration is feature-specific in v1
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- The CLI creates a baseline when none exists and a comparison run when one does.
- Reports begin with the required header markers and fields in fixed order.
- Detailed body includes execution metadata, per-check status/counts, diff listings, and raw artefact references.
- Compare runs return the required exit codes for regression and no-regression outcomes.

### Required test cases (Red first)

Builder tests:

1. Baseline-mode CLI integration and explicit baseline-created messaging.
2. Compare-mode CLI integration with regressions and with no regressions.
3. Header field order and marker assertions.
4. Written `comparison.json` and `comparison.txt` artefact assertions.
5. Exit-code assertions for invalid config, baseline mode, compare-green, and compare-failing outcomes.

### Section checks

- `npm run test:builder -- scripts/builder/src/regression-checker`
- `npm run lint:builder`
- `npm run builder:compile`
- `npm run test:builder`
- Mandatory-read evidence gate passed for all delegated hand-offs.

### Section checklist

- [ ] Red tests added/updated
- [ ] Red failure captured
- [ ] Green implementation complete
- [ ] Refactor complete
- [ ] Section checks passed
- [ ] Mandatory-read evidence verified
- [ ] Review feedback resolved
- [ ] Docs impact handled or marked N/A
- [ ] Commit evidence captured
- [ ] Push evidence captured or marked N/A until final section

---

## Section 6 — Final regression hardening, docs pass, de-sloppification, and delivery evidence

### Objective

- Finish builder validation, tighten docs and ignore rules, run de-sloppification, and collect final commit/push evidence.

### Constraints

- Keep docs changes limited to builder-facing guidance affected by the delivered CLI.
- `.gitignore` may ignore generated reports only; do not hide the tracked config file.
- De-sloppification must simplify naming, branching, and helper boundaries without changing behaviour.
- Final validation must still follow the builder-first hierarchy before broader builder integration commands.

### Delegation mandatory reads

Docs mandatory docs:

- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/SPEC.md`
- `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
- `/home/developer/AssessmentBot/docs/developer/builder/builder-script.md`
- `/home/developer/AssessmentBot/docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`
- `/home/developer/AssessmentBot/.gitignore`
- every changed builder-facing doc, listed explicitly in `Files read`

De-Sloppification mandatory docs:

- all Docs mandatory docs above
- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker`
- every changed production and test file under that directory, listed explicitly in `Files read`

Code Reviewer mandatory docs:

- `/home/developer/AssessmentBot/scripts/builder/src/regression-checker`
- `/home/developer/AssessmentBot/.gitignore`
- every changed production file, test file, and doc file, listed explicitly in `Files read`

### Shared helper plan

1. Helper decisions from Sections 1-5
   - Decision: `reconcile`
   - Owning module/path: all delivered regression-checker modules
   - Call-site rationale: confirm no planned helper remained broader than necessary
   - Relevant canonical doc target: `/home/developer/AssessmentBot/docs/developer/regression-cli-spec.md`
   - Planned doc status: update from `Not implemented` only where the implementation and docs now match

### Acceptance criteria

- Final touched builder tests, lint, compile, and coverage checks are green.
- Any required `.gitignore` and builder documentation updates are complete.
- A de-sloppification pass has been completed and any resulting fixes are revalidated.
- Commit and push evidence are recorded for the delivered branch.

### Required test cases/checks

1. Re-run focused regression-checker builder tests for touched suites.
2. Run `npm run lint:builder`.
3. Run `npm run builder:compile`.
4. Run `npm run test:builder`.
5. Run `npm run test:builder:coverage`.
6. Run `npm run build:production` if the CLI affects builder pipeline packaging or entry wiring.
7. Verify docs/ignore updates against the delivered behaviour.
8. Verify mandatory-read evidence for Docs, De-Sloppification, and Code Reviewer hand-offs.
9. Capture commit hash, branch name, and push evidence.

### Section checks

- `npm run lint:builder`
- `npm run builder:compile`
- `npm run test:builder`
- `npm run test:builder:coverage`
- `npm run build:production` (when integration wiring changed)
- `git --no-pager status --short`
- `git --no-pager log -1 --stat`
- `git --no-pager rev-parse --abbrev-ref HEAD`
- Mandatory-read evidence gate passed for all delegated hand-offs.

### Section checklist

- [ ] Red tests added/updated
- [ ] Red failure captured
- [ ] Green implementation complete
- [ ] Refactor complete
- [ ] Section checks passed
- [ ] Mandatory-read evidence verified
- [ ] Review feedback resolved
- [ ] Docs impact handled or marked N/A
- [ ] Commit evidence captured
- [ ] Push evidence captured or marked N/A until final section

---

## Suggested implementation order

1. Section 1 — CLI contract and config safety rails
2. Section 2 — Storage layout, manifests, and baseline compatibility
3. Section 3 — Tool runners and bounded scheduling
4. Section 4 — Derived summaries and comparison engine
5. Section 5 — Report writer, CLI orchestration, and exit codes
6. Section 6 — Final regression hardening, docs pass, de-sloppification, and delivery evidence
