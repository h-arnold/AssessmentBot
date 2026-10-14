# Dependency Upgrade Delivery Plan

## Status and source of truth

Planning artefacts, 8 October 2026, authorised for implementation on the same date. Follow `SPEC.md` for version targets, scope, compatibility decisions, and acceptance criteria. No layout document is required.

Rule-level lint decisions are authoritative in [`LINT_UPGRADE_REVIEW.md`](LINT_UPGRADE_REVIEW.md). Where this plan's earlier wording disagrees with that log, the log wins. Implementation proceeds one rule at a time under those decisions.

Before this task, the tracked manifests and lockfiles, both CI workflows, the regression compiler runner and its test, and the root backend and frontend ESLint configurations had already been changed. Some phases below therefore describe work that is already partially applied; treat the remaining items as outstanding work rather than rewriting phase history. No phase is complete, and no passing test or review result is claimed, until the Phase 7 verification. Lint remediation has progressed through rule 55; its authoritative record is `LINT_UPGRADE_REVIEW.md`.

The fallback checked the SPEC draft against manifests, workflow definitions, compiler metadata, regression runner source, and authoritative vendor upstream before deriving this plan. Planner Reviewer independently reviewed both documents; its command-inventory, install-script-pin, and manifest-tag findings have been addressed and await resubmission.

## Global constraints and handoffs

- Upgrade the three tracked package/lockfile pairs, Python documentation requirements, and GitHub actions. Ignore harness-managed untracked `.opencode` dependencies.
- Use ordinary npm resolution only. Preserve rules, strictness, thresholds, assertions, and hooks, except the narrow, individually approved exclusions recorded in `LINT_UPGRADE_REVIEW.md`. No downgrades, `--force`, `--legacy-peer-deps`, untracked suppressions, unauthorised disabled rules, or broad autofixing. Apply the approved sequential, targeted fixes instead.
- Compare resolved package identities/versions with pre-upgrade tracked locks. Package removals or relocation from a changed upstream dependency graph are not themselves downgrades; investigate any lower version of a continuing dependency instead of accepting it silently.
- Keep the existing baseline intact. Do not run mutating lint commands during diagnosis; use runtime-specific check scripts.
- The user has already assessed remediation breadth rule by rule in `LINT_UPGRADE_REVIEW.md`; implement those approved decisions. Stop and ask with concrete diagnostics only for remediation outside those decisions or when compatibility requires a new contractual change. This is the user's required scope boundary, not permission to silently defer an upgrade or silently weaken standards.
- Lint remediation runs sequentially, one rule at a time, against `LINT_UPGRADE_REVIEW.md`. Further decomposition of oversized files remains deferred, but the user's 11 October 2026 session-wide permission allows targeted issue fixes in oversized files to proceed without decomposing them for the remainder of the session; this does not authorise unrelated changes, refactors, altered runtime behaviour or undecided rule treatments. Outside that permission, a fix that would require editing a file already over the 550-line decomposition threshold is skipped and queued, per the deferred-decomposition decision. Rule 16's record-only hold is superseded, so its Assignment scoped exception plus the `createdAt` and Teacher-validator fixes are in scope.
- If delegation is available, use Implementation → Code Reviewer → Implementation corrections → Code Reviewer until clean for each non-trivial code phase. Pass relevant documentation updates to Docs; route Vitest/backend test changes to Testing Specialist and E2E test changes to Playwright.
- Every handoff includes changed files, concrete requirements, diagnostics, acceptance criteria, and the phase's Mandatory Reading below. Do not attach agent definitions or AGENTS files; agents receive their own instructions. Executing agents must also obey component read-first rules.
- Execution constraint: use **one agent at a time**, scoped to its area, after the user reported that concurrent fix-agent work crashed the environment. Wait for each handoff before further delegation; audit interrupted changes before continuing. This applies to implementation, testing, review and documentation work alike.
- If test delegation is unavailable, read `.opencode/agents/testing-specialist.md` or `.opencode/agents/playwright.md` and applicable testing documentation before editing tests.
- Use existing tests for dependency/configuration updates; do not invent implementation-mirroring tests. Use meaningful red/green regression tests for the compiler runner behaviour change. No new shared helper is planned. The approved five API name renames do change API and schema identifiers, so update producers, consumers, registries, schemas, tests, and canonical data-shape docs together, and involve the Data Shapes Agent before sign-off.
- Record actual versions, checks, compatibility edits, and approved deviations in the phase outcomes during implementation. Ephemeral diagnostics belong in `.opencode/scratchpad/`.
- The user explicitly accepted three new frontend `max-lines` warnings caused by arrow-return fixes (rule 3 in `LINT_UPGRADE_REVIEW.md`). Report this approved baseline deviation separately; do not suppress it, reset the baseline, or treat it as permission for other new warnings.
- Rule 6 exception: the user authorised Boolean-naming edits in oversized files and deferred decomposition of those files until a later date. Implement all Boolean findings and all five approved API renames across their complete reference/contract chains; preserve the size deferral for other rules.
- Browser compatibility exception: after the Boolean pass exposed five E2E failures, the user asked to continue with proposed test-only alert-selector and keyboard-navigation repairs, including the 564-line backend-settings spec without decomposition. Preserve keyboard-only coverage and the existing behavioural assertions; keep this exception local to those repairs.
- Rule 22 exception: the user authorised fixing all 20 `unicorn/prefer-promise-with-resolvers` findings, including those in oversized specs, without decomposing the files. Limit edits to those findings and directly required references; the size deferral remains in force for rules without an individually approved exception.
- Rule 23 exception: the user authorised migrating the affected `fetchQuery`/`prefetchQuery` references to `queryClient.query`, including the directly required update to the oversized `useClassPageData.spec.ts` query spy, test titles/comments and directly related assertions, without decomposing the file. Other unrelated findings and the general size deferral remain unchanged.
- Rule 28 exception: the user authorised fixing all 14 `unicorn/consistent-conditional-object-spread` findings, including the five in the three oversized files named in `LINT_UPGRADE_REVIEW.md`, without decomposing those files. Preserve exact predicates, conditional evaluation and omitted-versus-present keys, particularly the PII logging exclusion. All 14 findings are fixed and the review is clean.
- Rule 29 exception: the user authorised fixing all 14 `unicorn/no-declarations-before-early-exit` findings, including the directly required edits in the oversized `useReferenceDataManagement.ts`, `ClassesPage.spec.tsx` and `apiService.spec.ts`, without decomposing those files. The two remaining blockers were resolved by explicitly approved short-circuit changes: batch-size configuration access after the `ImageManager` empty-input guard, and delete-dialog rendering after the form-dialog precedence guard in the reference-data hook. All 14 findings are fixed and the review is clean.
- Session-wide oversized-file permission: granted 11 October 2026, allowing targeted issue fixes in oversized files to proceed without decomposition for the remainder of the session. It lifts the size-only edit blocker for the session; it does not authorise unrelated changes, refactors, altered runtime behaviour or undecided rule treatments, and file decomposition itself remains deferred.
- Rule 30 approval: apply the six behaviour-preserving parameter-default cleanups under the narrow constructor-policy permission, and retain the three concrete contracts through file-scoped ESLint overrides. The re-run identity finding remains unchanged and enforced. Independent review of this final subset now passes after correcting its sole stale documentation quote and re-submitting; evidence is recorded in `LINT_UPGRADE_REVIEW.md`.
- Rules 31–35 approval: retain and fix `no-unnecessary-global-this`; disable `prefer-await`, `name-replacements` and `prefer-number-coercion` in backend/frontend configs; create the custom-error investigation issue #328 and temporarily disable the related error rules pending it. These treatments are implemented and validated sequentially. Independent review of rule 31 now passes with no findings after the funding-related launch failure was retried; evidence is recorded in `LINT_UPGRADE_REVIEW.md`. Do not advance to further undecided rules from this approval.
- Rules 36–40 approval: fix `prefer-continue` (36), the unused consumer properties (38) and the scoped selectors (39) with enforcement retained; implement rule 37's coordinated safe-integer validation hardening; and add rule-40 exclusions only for the four approved frontend configuration/mock-registration files (`eslint.config.js`, `playwright.config.ts`, `vite.config.ts`, `src/test/taskHeatmapPageMocks.ts`). All five are implemented: rules 36–39 have clean independent source review and rule 40's config-only exclusion passed effective-setting/diagnostic verification without a separate review. Preserve rule 30's single re-run identity finding. Record the outcome in `LINT_UPGRADE_REVIEW.md`. Do not advance to further undecided rules from this approval.
- Rules 41–45 approval and completion: disable `unicorn/no-for-each` in both runtimes; temporarily disable `unicorn/no-error-property-assignment` under issue #328; and fix all of rules 43, 44 and 45 with enforcement retained (rule 44 keeps `minimumComparisons: 3`). Implementation is complete: rules 43–45 passed clean independent source review (`review-rule43-20261012.md`, `review-rule44-final-20261012.md`, `review-rule45-20261012.md`) and the rule 41/42 config-only disables passed effective-setting/diagnostic verification without a separate review. The issue-backed temporary disables of rules 27 (#326), 33 and 42 (#328) supersede their earlier enforcement-retained decisions; rule 9 (#325) is unchanged. Do not advance to further undecided rules from this approval.
- Rules 46–55 approval and completion: fix all ten rules with enforcement retained and no disable, exception or deferral. The approved findings cleared (10 backend / 22 frontend) plus one coupled `prefer-dom-node-replace-children` diagnostic, with warnings unchanged; original and final independent source reviews are clean (`review-rules46-55-20261012.md`, `review-rules46-55-final-20261012.md`). The coupled diagnostic is not a separately reviewed rule. Parallel research was expressly authorised for this batch; implementation/testing/review handoffs remain serial, and the session-wide targeted oversized-file permission covers the approved `AssignmentsPage.tsx` and `ClassesPage.spec.tsx` locations without decomposition. Do not advance to further undecided rules from this approval; record the outcome in `LINT_UPGRADE_REVIEW.md`.

## Phase 1 — Confirm inventory and preserve evidence

### Mandatory Reading — Implementation and Code Reviewer

- @SPEC.md
- @ACTION_PLAN.md
- @package.json
- @src/frontend/package.json
- @scripts/builder/package.json
- @requirements-docs.txt
- @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md
- @.ts-regression-checker/regression.config.json
- @docs/developer/builder/regression-checker-how-to.md
- @.github/workflows/ci.yml
- @.github/workflows/build-docs.yml

### Work and checks

1. Confirm worktree status and capture pre-upgrade resolved versions from all three tracked locks without modifying them. Check Node/npm versions and npm configuration for existing peer-resolution bypasses; do not introduce any bypass.
2. Preserve session `dependency-update-20261007` and its baseline at `.ts-regression-checker/reports/session-dependency-update-20261007/baseline`. Use the supplied baseline; do not rerun the full baseline just to duplicate completed work.
3. Recheck direct package latest metadata, especially packages absent from `npm outdated` because a broad range already resolves latest. Confirm peer/engine requirements for coherent upgrade groups and consult only relevant official major-migration guidance.
4. Record that seven baseline checks pass; strict backend lint carries ten existing `max-lines` warnings and zero errors. A no-regression comparison does not make this existing strict-lint failure disappear.
5. Confirm JsonDbApp releases/tags in `h-arnold/JsonDbApp`: existing `v0.3.0` is already latest. Keep the snapshot unchanged unless newer authoritative evidence requires replanning under the SPEC boundary.

### Acceptance

Complete inventory, baseline location, selected candidate versions, supported runtime/peer combinations, and no-downgrade comparison evidence are available to subsequent phases.

## Phase 2 — Make compiler selection deterministic

### Mandatory Reading — Implementation, Testing Specialist, and Code Reviewer

- @SPEC.md
- @ACTION_PLAN.md
- @package.json
- @src/frontend/package.json
- @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md
- @docs/developer/builder/builder-script.md
- @docs/developer/builder/regression-checker-how-to.md
- @scripts/builder/src/regression-checker/runners/index.ts
- @scripts/builder/src/regression-checker/runners/tool-runners-and-bounded-scheduling.spec.ts
- @.ts-regression-checker/regression.config.json

### Work and meaningful red/green sequence

1. Testing Specialist first adds/adjusts runner tests to require the current Node executable and absolute root TypeScript 7 alias entrypoint, preserving project resolution, cwd, plain diagnostics, and raw artefact extension. Verify they fail against the existing bare-`tsc` runner. Use the existing canonical runner/config fixtures; domain synthetic datasets are not relevant to CLI command construction. Migrate only touched assertions.
2. Correct root/frontend `typescript` declarations to official exact `6.0.3`, retaining `@typescript/native: npm:typescript@^7.0.2`; regenerate affected locks with ordinary installation and verify no downgrade.
3. Change root `builder:compile` to `node node_modules/@typescript/native/bin/tsc -p scripts/builder/tsconfig.json`; change frontend build to `node node_modules/@typescript/native/bin/tsc -b && vite build`.
4. Extend the existing runner in place: select `process.execPath` and the root's absolute `node_modules/@typescript/native/bin/tsc` as the first argument. Preserve the existing `kind: tsc` schema, output/error contracts, and remaining arguments. No configurable compiler path, new helper, or baseline reset.
5. Check other tracked compile invocations/documented commands for bare `tsc`; make project type-check paths select TS7 explicitly without changing lint's TS6 module resolution. Include `CONTRIBUTING.md`, `.github/agents/implementation.agent.md`, `.github/agents/code-reviewer.agent.md`, `.opencode/agents/implementation.md`, `.opencode/agents/code-reviewer.md`, and `.opencode/agents/playwright.md` in the documentation handoff. These command-accuracy edits do not authorise OpenCode launch/configuration repairs.

### Checks and acceptance

- Root and frontend explicit alias compiler `--version` reports 7.0.2; their canonical `typescript` package reports 6.0.3.
- Run focused runner tests via `npm run test:builder -- scripts/builder/src/regression-checker/runners/tool-runners-and-bounded-scheduling.spec.ts`.
- Run `npm run builder:compile`, `npm run build:frontend`, `npm run lint:frontend:check`, and `npm run lint:builder:check`.
- Demonstrate the compiler remains TS7 even when `.bin/tsc` belongs to TS6; confirm missing compiler/compilation failures surface, rather than falling back.
- Review the compiler change before broader upgrades. Document why explicit entrypoints are necessary in the canonical guides during Phase 7.

## Phase 3 — Upgrade lint tooling and implement approved remediation decisions

### Mandatory Reading — Implementation and Code Reviewer

- @SPEC.md
- @ACTION_PLAN.md
- @LINT_UPGRADE_REVIEW.md
- @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md
- @config/eslint/ts-base-rules.cjs
- @eslint.config.js
- @src/frontend/eslint.config.js
- @scripts/builder/eslint.config.js
- @package.json
- @src/frontend/package.json
- @scripts/builder/package.json

### Work and checks

1. Upgrade ESLint 10.12.0, the typescript-eslint family 8.71.1, Unicorn 77.0.0, JSDoc 65.2.0, Security 4.2.0, SonarJS 4.2.2, and frontend-specific lint dependencies to the SPEC targets. Keep duplicate packages aligned across owners and update the builder lock independently.
2. Retain existing configurations and overrides except the decisions approved in `LINT_UPGRADE_REVIEW.md`. If upstream renamed or removed an option (for example `unicorn/prevent-abbreviations` → `unicorn/name-replacements`), make only the equivalent migration with evidence that enforcement is preserved.
3. Run non-mutating frontend, builder, synthetic, and backend lint checks; collect new violations by rule, file, and required remediation. Frontend's `configs.all` makes Unicorn the principal breadth gate.
4. The breadth assessment and each rule's treatment are already recorded in `LINT_UPGRADE_REVIEW.md`. Do not re-ask for already-decided rules, broaden approved exclusions, disable additional rules, or select an older Unicorn version. Stop only for findings in a rule the log has not yet reviewed.
5. For approved targeted fixes, read affected component/helper/logging docs, retain behaviour, and use existing tests. Except for the individually approved rule-specific exceptions in `LINT_UPGRADE_REVIEW.md`, do not touch a file already over the 550-line decomposition threshold; skip and queue those. Do not substitute broad autofix passes for the approved targeted changes.
6. Apply the approved exclusions and targeted fixes sequentially, one rule at a time. For the five approved API renames, update producers, consumers, registries, schemas, tests, and canonical data-shape docs together. Keep the Assignment lazy-registration scoped exception, the `createdAt` fix, and the Teacher-validator fix in scope now that rule 16's record-only hold is superseded.

### Acceptance

Frontend/builder/synthetic checks pass. Backend stays error-free with no added baseline warnings; report the strict warning gate honestly. Type-aware lint uses supported TS6.0.3 without unsupported-version suppression. No rule or safety setting is weakened beyond the individually approved, documented exclusions.

## Phase 4 — Upgrade build, test, and remaining root tooling

### Mandatory Reading — Implementation, Testing Specialist, and Code Reviewer

- @SPEC.md
- @ACTION_PLAN.md
- @package.json
- @src/frontend/package.json
- @src/frontend/vite.config.ts
- @vitest.config.js
- @scripts/builder/vitest.config.ts
- @docs/developer/builder/builder-script.md
- @docs/developer/backend/backend-testing.md
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/builder/regression-checker-how-to.md

### Work and checks

1. Upgrade Vite 8.3.3 / React plugin 6.1.2 together, and Vitest / coverage-v8 5.0.3 together in root/frontend. Consult official migration notes for changed worker, configuration, coverage, and reporter APIs.
2. Upgrade DOM/test utilities, Node types 26.6.4, Zod 4.6.5, Prettier 3.9.9, clasp 3.4.1, and remaining root/dev packages to the SPEC targets. Keep current test environments and runtime major lines.
3. Make only necessary tooling compatibility edits. Verify changed native bundler output still meets the GAS inlining contract. Inspect actual Vitest JSON output consumed by the regression checker; keep reporter normalisation and failure detection accurate.
4. Use existing coverage and runner suites. Delegate test debugging appropriately; if genuine new behavioural coverage is needed, write a meaningful failing test before the fix. Retain existing realistic fixtures; consult canonical synthetic fixture documentation only when domain test data must change.
5. Confirm that neither npm nor project tooling consumes the frontend `allowScripts` field. If it is unused, remove its obsolete `esbuild@0.28.2` pin as part of the bundler upgrade and record the evidence.

### Checks and acceptance

Run backend tests, frontend coverage, builder coverage, synthetic tests, and `npm run build:production`. No lowered thresholds, weakened assertions, unsupported Node APIs, or manual generated-output edits. Include source-remediation findings in the review loop before Phase 5.

## Phase 5 — Upgrade frontend runtime packages and browser tooling

### Mandatory Reading — Implementation, Testing Specialist, Playwright, and Code Reviewer

- @SPEC.md
- @ACTION_PLAN.md
- @src/frontend/package.json
- @src/frontend/playwright.config.ts
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/frontend/frontend-playwright-e2e.md
- @docs/developer/frontend/frontend-react-query-and-prefetch.md
- @docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md
- @docs/developer/frontend/frontend-logging-and-error-handling.md

### Work and checks

1. Upgrade React/react-dom 19.3.0 together, Ant Design 6.6.5/icons 6.3.4, React Query 5.104.1, Fuse 7.5.0, Lucide 1.52.0, and other declared runtime packages to SPEC targets.
2. Upgrade Playwright and `@playwright/test` to matching 1.64.0; install the corresponding Chromium using the existing E2E setup.
3. Run existing frontend component/coverage and E2E suites. Resolve only dependency-induced incompatibilities; no UI redesign. If UI compatibility edits are necessary, read the relevant spacing/loading/component documentation and official Ant Design docs first.
4. Delegate unit/component test work to Testing Specialist and E2E work to Playwright. Preserve assertions and fixture fidelity. New domain data tests must choose an existing canonical synthetic profile/view or record a generator extension before test implementation; no wholesale fixture migration.

### Acceptance

Frontend lint, coverage, browser tests, and build pass. Existing navigation, accessibility, layout, API validation, loading/mutation semantics, and offline HtmlService asset behaviour remain correct.

## Phase 6 — Upgrade Python documentation dependencies and GitHub actions

### Mandatory Reading — Implementation, Code Reviewer, and Docs

- @SPEC.md
- @ACTION_PLAN.md
- @requirements-docs.txt
- @mkdocs.yml
- @.github/workflows/ci.yml
- @.github/workflows/build-docs.yml
- @scripts/builder/package.json
- @scripts/builder/package-lock.json

### Work and checks

1. Keep `mkdocs==1.6.1`; set `mkdocs-material==9.7.7`. Validate installation/resolution in an isolated environment under `.opencode/scratchpad/`, using documentation Python 3.12, then run the existing `mkdocs build --verbose` command. Do not add a new strictness flag that changes the baseline acceptance policy.
2. Update actions to the authoritative latest major tags listed in SPEC after confirming release/tag migration requirements. Retain existing permissions, triggers, Pages eligibility, artefact names, and paths.
3. Set all CI Node pins consistently to 24.21.0. Add ordinary `npm --prefix scripts/builder ci` to builder validation and include its lock in that job's cache-dependency paths, so CI validates the third tracked package.
4. Check workflow structure and referenced action inputs against upstream documentation. Local builds do not prove hosted action/Pages execution; record whether CI verification is available without publishing or deploying solely for validation.

### Acceptance

Python dependency resolution and documentation build succeed. Workflow references and inputs match supported upstream contracts; all package installations use reproducible locks and compatible runtime versions. No deployment/commit/push is implied by this plan.

## Phase 7 — Final regression, documentation, and sign-off

### Mandatory Reading — Implementation, Code Reviewer, and Docs

- @SPEC.md
- @ACTION_PLAN.md
- @docs/developer/builder/TypeScriptAndLintConfigHierarchy.md
- @docs/developer/builder/regression-checker-how-to.md
- @docs/developer/builder/builder-script.md
- @docs/developer/frontend/frontend-testing.md
- @docs/developer/frontend/frontend-playwright-e2e.md
- @.ts-regression-checker/regression.config.json
- @.github/workflows/ci.yml
- @.github/workflows/build-docs.yml

### Required verification

1. Perform ordinary fresh installs: `npm ci`, `npm --prefix src/frontend ci`, and `npm --prefix scripts/builder ci`. Inspect each `npm ls --all` tree for invalid peers and compare final resolved dependencies against pre-upgrade locks. Reconfirm compiler versions after installation.
2. Run non-mutating lint: `npm run lint:backend:errors-only`, `npm run lint:frontend:check`, `npm run lint:builder:check`, `npm run lint:synthetic:check`. Keep the existing strict backend lint command intact and report its known warning status through the regression comparison.
3. Run `npm run regression-checker -- dependency-update-20261007` against the preserved baseline. Require zero new regressions/failures and accurate coverage comparisons. Do not reset the baseline to absorb upgraded tool failures; stop for a decision if reporter-contract incompatibility prevents a meaningful comparison.
4. The checker covers backend tests, frontend coverage/E2E, builder coverage/compile, and component lint. Separately verify synthetic tests, `npm run build:production`, `npm run build:dev`, and `mkdocs build --verbose`; reuse already completed final-version checks instead of duplicating expensive runs without a new concern.
5. Run `npm outdated --json` in all three packages. Investigate any remaining direct dependency behind latest; report the approved official TS6.0.3 lint-only exception explicitly.
6. Update canonical compiler/lint and regression-checker guides with explicit TS7 commands and TS6 lint rationale. Update build/testing docs only for actual tooling changes; avoid policy duplication in AGENTS files. The approved five API renames require the canonical data-shape docs to be updated with the Data Shapes Agent before sign-off. No new shared-helper entry is needed.
7. Submit the complete resulting diff to Code Reviewer; fix and resubmit all in-scope findings until clean. If contractual boundaries changed with explicit approval, involve Data Shapes Agent and reconcile canonical shape docs before sign-off. Have Docs changes reviewed with the final diff.

### Completion report

List final package/action/Python versions, compatibility edits, no-downgrade evidence, baseline comparison result, existing backend warnings, completed checks, hosted CI verification status, and any user-approved constraints. Record the individually approved exclusions, the deferred over-threshold remediation queue, and the superseded rule 16 hold; do not claim zero exclusions. Do not call strict lint entirely green when its existing warning gate fails. No implementation is complete before required reviewer sign-off when delegation is available.
