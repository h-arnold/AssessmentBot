# Dependency Upgrade Specification

## Status and purpose

Planning baseline, researched on 8 October 2026, then authorised for implementation on the same date. Upgrade the tracked project dependencies to the latest stable versions possible without breakage, downgrades, or weakened quality standards.

Implementation is authorised. Before this task, the tracked manifests and lockfiles, both CI workflows, the regression compiler runner and its test, and the root backend and frontend ESLint configurations had already been changed. Lint remediation continues one rule at a time under the decisions recorded in [`LINT_UPGRADE_REVIEW.md`](LINT_UPGRADE_REVIEW.md), which is the source of truth for all rule-level treatment; remediation has now progressed through rule 55. This document claims neither passing tests nor a clean code review.

The configured Planner could not launch (`Model not found: opencode/union-alpha`), so these planning artefacts were prepared by the planning fallback. The delivery plan records an independent Planner Reviewer pass with findings; implementation sign-off still requires review of the resulting changes.

## Agreed decisions

1. Cover all three tracked npm package/lockfile pairs: root, `src/frontend`, and `scripts/builder`; `requirements-docs.txt`; and both tracked GitHub workflows.
2. Target latest stable releases, including major upgrades. Refresh transitive dependencies within upstream-supported ranges; do not force incompatible transitive majors or add speculative overrides.
3. Never downgrade an existing resolved dependency. Compare against the pre-upgrade lockfiles, not just manifest ranges; account for package identity when aliases change. If compatibility cannot be achieved, report the evidence and request a decision rather than silently retaining an older release or downgrading.
4. The user approved TypeScript 7 for builds and the existing TypeScript 6.0.3 solely for lint. This is the explicit compatibility exception to the latest-version requirement.
5. Retain existing lint rules, overrides, severities, strict TypeScript options, coverage thresholds, test assertions, and hook enforcement, except for the narrowly-scoped exclusions individually approved in `LINT_UPGRADE_REVIEW.md`. No `--force`, `--legacy-peer-deps`, untracked suppressions, unauthorised disabled rules, warning suppression, or reduced checks. There must be zero unauthorised weakening.
6. Make only dependency-related compatibility changes. The user has reviewed the remediation breadth rule by rule and authorised the specific exclusions, configuration options, and sequential targeted fixes in `LINT_UPGRADE_REVIEW.md`. Apply those decisions as written: do not broaden them, do not disable additional rules, and do not substitute broad autofix passes for the approved targeted changes. Stop for a fresh decision only when remediation falls outside the approved decisions, for example new findings in a rule not yet reviewed.
7. Preserve existing UI, accessibility, persistence, and GAS bundle behaviour. No UI redesign or layout specification is needed. The five approved project-owned API name renames in `LINT_UPGRADE_REVIEW.md` (rule 6) are the only authorised API-name change; coordinate them across producers, consumers, registries, schemas, tests, and canonical data-shape docs. Keep the persisted cohort `active` field and the library-defined `enabled` and `onFilter` spellings unchanged.
8. Ignore harness-managed untracked `.opencode` dependencies. Existing tracked plugins remain covered by builder lint; do not edit OpenCode configuration to repair agent launch failures.

## Lint remediation decisions

[`LINT_UPGRADE_REVIEW.md`](LINT_UPGRADE_REVIEW.md) is the authoritative decision log for every newly failing rule: classification, evidence, approved exclusions and configuration, approved targeted fixes, and deferred work. Treat it as the source of truth over any earlier planning wording in this file or in `ACTION_PLAN.md`.

Key commitments from that log:

- Fixes are applied sequentially and one rule at a time. Do not run broad autofix passes in place of the approved targeted changes.
- Further large-file decomposition remains deferred. On 11 October 2026 the user granted a **session-wide permission** allowing targeted issue fixes in oversized files to proceed without decomposition for the remainder of the session; this lifts the size-only edit blocker for the session but does not authorise unrelated changes, refactors, altered runtime behaviour or undecided rule treatments. Outside that permission, a source fix that would require editing a file already over the 550-line decomposition threshold is skipped and queued rather than forced into this run.
- Rule-specific exceptions recorded in the decision log: the user authorised Boolean-naming fixes in oversized files for rule 6 (all findings, affected references and the complete five-API-name rename scope, including those files); for rule 22, all 20 `unicorn/prefer-promise-with-resolvers` findings, including those in oversized specs; for rule 23, the directly required `sonarjs/deprecation` edits to the oversized `useClassPageData.spec.ts` (its query spy, test titles/comments and directly related assertions); for rule 28, the five `unicorn/consistent-conditional-object-spread` findings in the oversized `classes-page-end-to-end-helpers.ts`, `useReferenceDataManagement.ts` and `AssignmentsPage.tsx`; and, for rule 29, the directly required `unicorn/no-declarations-before-early-exit` edits in the oversized `useReferenceDataManagement.ts`, `ClassesPage.spec.tsx` and `apiService.spec.ts`. None required decomposing the files. Each exception applies only to the rule it names, and the session-wide permission above does not broaden them; apart from these individually approved exceptions, the size deferral remains in force for other rules and no undecided rule treatment is authorised.
- Five project-owned API names are renamed together across producers, consumers, registries, schemas, fixtures and tests, and canonical data-shape docs. The specific names are listed in the decision log; final replacements are chosen during implementation and are not invented here.
- The persisted cohort `active` field and the library-defined `enabled` and `onFilter` spellings are retained unchanged.
- Assignment keeps its existing lazy helper-registration pattern, covered by a narrowly documented, scoped exception to `unicorn/no-undeclared-class-members`, alongside the approved `createdAt` and Teacher-validator fixes.
- Rule 16's earlier record-only hold is superseded by the implementation request, so those Assignment and Teacher fixes are now in scope.
- Rule 30 additionally permits six behaviour-preserving parameter-default cleanups outside constructors and three file-scoped ESLint exceptions protecting concrete contracts, as recorded in the decision log. This does not change the general default-ownership policy; the re-run identity finding remains unchanged and enforced.
- Rules 31–35: fix all unnecessary global-object references with enforcement retained; disable await preference, name replacements and number-coercion preference; temporarily disable custom-error design together with the related error-property rule under issue #328. Rule 31 and rule 30's final six cleanups now have clean independent review after successful retries. See the decision log for exact scopes and evidence.
- Rules 36–40: fix the guard-first loops, the unused consumer properties and the scoped selectors with enforcement retained; implement rule 37's coordinated safe-integer validation hardening; and add rule-40 exclusions only for the four approved frontend configuration and mock-registration files. Rules 36–39 have clean independent source review; rule 40's config-only exclusion is verified under the user's no-separate-review instruction. Rule 30's single re-run identity finding remains unchanged. See the decision log for exact scopes and evidence.
- Rules 41–45: disable `no-for-each` in both runtimes; temporarily disable `no-error-property-assignment` under issue #328; and fix all of rules 43, 44 and 45 with enforcement retained (rule 44 keeps `minimumComparisons: 3`). Rules 43–45 have clean independent source review; the rule 41/42 config-only disables are verified under the user's no-separate-review instruction. The issue-backed temporary disables of rules 27 (#326), 33 and 42 (#328) supersede their earlier enforcement-retained decisions. See the decision log for exact scopes, accepted diagnostics and evidence.
- Rules 46–55: fix all ten rules with enforcement retained, with no disable, exception or deferral. Full `Math.PI`/`Math.E` fixtures retain independent expected strings (46); three declarations narrow to smaller scopes while the GAS script-global `LOCK_WAIT_WARN_THRESHOLD_MS` stays top level and annotated (47); lookup values are bound and truthiness-guarded within the ordinary data/string-UID scope, with a constructor-owned retry seed (48); equivalent `some`/`every` predicates preserve sparse/empty and short-circuit semantics (49); inner push callbacks become statement-only while outer Promise returns stay (50); three verified narrowed booleans simplify while guards remain (51); DOM fixtures use readable `createElement`/`replaceChildren` construction (52); infinity sentinels use `-Infinity`/`Infinity` spelling (53); ordered `Map` contents are collected with `Map.forEach` (54); and ternaries minimise into the varying argument/property (55). Original and final independent source reviews are clean. See the decision log for exact scopes and evidence.

## Assumptions

1. “Latest” means stable registry releases, excluding prereleases and unreleased vendor branch changes.
2. Retain the existing runtime major lines (Node 24 and documentation Python 3.12); advance the CI Node pin within Node 24 to match the working 24.21.0 environment. New Node type definitions must not introduce APIs unavailable on Node 24 or in GAS.

## Existing architecture and ownership

- Root scripts own backend checks, builder compilation, synthetic tests, and GAS builds. Frontend scripts run through `npm --prefix src/frontend`.
- The builder has its own tracked manifest and lockfile. CI now installs and validates it alongside the root and frontend packages; keep that installation and its lockfile cache entry in place so fresh installs do not conceal nested resolution drift.
- Shared compiler strictness belongs in `tsconfig.base.json`; shared TypeScript lint rules belong in `config/eslint/ts-base-rules.cjs`. Runtime-specific settings belong in leaf configurations, following `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md`.
- Frontend lint applies `unicorn.configs.all`; moving from Unicorn 63 to 77 enabled substantial new diagnostics. Existing explicit overrides stay intact except for the narrowly-scoped, individually approved changes in `LINT_UPGRADE_REVIEW.md`.
- Frontend tests use Happy DOM; root also declares jsdom. Do not exchange test environments to avoid failures.
- GAS output is generated by the builder. Preserve inlined assets, manifest merge semantics, source ordering, and protected globals. Do not edit generated output manually.
- JsonDbApp is a committed, allowlisted snapshot, not a runtime download or an npm package.

## TypeScript compatibility contract

Authoritative npm metadata confirms `typescript-eslint@8.71.1`, `@typescript-eslint/eslint-plugin@8.71.1`, and `@typescript-eslint/typescript-estree@8.71.1` require TypeScript `>=4.8.4 <6.1.0`. Their ESLint support includes ESLint 10.

In both root and frontend packages:

- Replace `typescript: npm:@typescript/typescript6@^6.0.2` with the official declaration `typescript: 6.0.3`. Existing locks already resolve official TypeScript 6.0.3; the alias registry only offers 6.0.2, so retaining it risks a downgrade on installation.
- Retain the separate `@typescript/native: npm:typescript@^7.0.2` build compiler alias. TypeScript 7.0.2 is the current stable registry release and exposes only `tsc: bin/tsc`, not `tsgo`.
- Root builder compilation explicitly invokes `node node_modules/@typescript/native/bin/tsc -p scripts/builder/tsconfig.json`.
- Frontend compilation explicitly invokes `node node_modules/@typescript/native/bin/tsc -b` before Vite, relative to the frontend package directory.
- Never depend on whichever compiler owns `.bin/tsc` after installation. The canonical `typescript` module remains TypeScript 6.0.3 for ESLint's parser/services; every project compile/type-check path selects TypeScript 7 explicitly.

The regression checker launches the running Node executable followed by the root's absolute `node_modules/@typescript/native/bin/tsc` path in `scripts/builder/src/regression-checker/runners/index.ts`, replacing the former bare `tsc`. Preserve its project argument, `--pretty false`, working directory, output handling, and failure propagation. Keep the existing `kind: tsc` configuration and data shape; no compiler-selection configuration or new abstractions are introduced.

## Registry research and candidate versions

Sources: `npm outdated --json` in each tracked package and `npm view <package>@latest version peerDependencies engines --json`. These are target candidates, not claims that integration tests have passed. Recheck metadata at implementation time and record any newer candidate or compatibility blocker.

### Root targets

| Dependency                                                      | Target                              |
| --------------------------------------------------------------- | ----------------------------------- |
| `@faker-js/faker`                                               | 10.6.0 (already latest)             |
| `@google/clasp`                                                 | 3.4.1                               |
| `@types/node`                                                   | 26.6.4                              |
| `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` | 8.71.1 together                     |
| `@typescript/native`                                            | alias to TypeScript 7.0.2           |
| `typescript`                                                    | official 6.0.3, lint-only exception |
| `vitest`, `@vitest/coverage-v8`                                 | 5.0.3 together                      |
| `eslint`                                                        | 10.12.0                             |
| `eslint-plugin-googleappsscript`                                | 1.0.5 (already latest)              |
| `eslint-plugin-jsdoc`                                           | 65.2.0                              |
| `eslint-plugin-security`                                        | 4.2.0                               |
| `eslint-plugin-sonarjs`                                         | 4.2.2                               |
| `eslint-plugin-unicorn`                                         | 77.0.0                              |
| `husky`                                                         | 9.1.7 (already latest)              |
| `jsdom`                                                         | 30.1.2                              |
| `prettier`                                                      | 3.9.9                               |
| `zod`                                                           | 4.6.5                               |

### Frontend targets

| Dependency                                       | Target                                           |
| ------------------------------------------------ | ------------------------------------------------ |
| `@ant-design/icons`                              | 6.3.4                                            |
| `@tanstack/react-query`                          | 5.104.1                                          |
| `antd`                                           | 6.6.5                                            |
| `fuse.js`                                        | 7.5.0                                            |
| `lucide-react`                                   | 1.52.0                                           |
| `react`, `react-dom`                             | 19.3.0 together                                  |
| `react-markdown`, `remark-gfm`                   | 10.1.0, 4.0.1 (already latest)                   |
| `zod`                                            | 4.6.5                                            |
| `@eslint/js`                                     | 10.0.1                                           |
| `@playwright/test`, `playwright`                 | 1.64.0 together; matching Chromium install       |
| `@testing-library/dom`                           | 10.4.2                                           |
| `@testing-library/jest-dom`                      | 7.0.1                                            |
| `@testing-library/react`                         | 16.3.3                                           |
| `@testing-library/user-event`                    | 14.6.7                                           |
| `@tsconfig/node24`                               | 24.0.5                                           |
| `@types/node`                                    | 26.6.4                                           |
| `@types/react`, `@types/react-dom`               | 19.3.0                                           |
| `@typescript/native`, `typescript`               | TypeScript 7.0.2 alias, official lint-only 6.0.3 |
| `@vitejs/plugin-react`, `vite`                   | 6.1.2, 8.3.3 together                            |
| `vitest`, `@vitest/coverage-v8`                  | 5.0.3 together                                   |
| `eslint`, `eslint-plugin-jsdoc`                  | 10.12.0, 65.2.0                                  |
| `eslint-plugin-react-hooks`                      | 7.1.1 (already latest)                           |
| `eslint-plugin-react-refresh`                    | 0.5.7                                            |
| `eslint-plugin-sonarjs`, `eslint-plugin-unicorn` | 4.2.2, 77.0.0                                    |
| `globals`                                        | 17.13.0                                          |
| `happy-dom`                                      | 20.14.5                                          |
| `typescript-eslint`                              | 8.71.1                                           |

### Builder, documentation, and workflows

- Builder's sole declared dependency, `eslint-plugin-sonarjs`, targets 4.2.2; refresh its tracked lockfile independently.
- PyPI confirms `mkdocs==1.6.1` is already latest and `mkdocs-material` advances from 9.7.1 to 9.7.7. Preserve exact Python requirement pins.
- GitHub's authoritative `repos/actions/<action>/releases/latest` API reports the following latest stable action versions:

| Action                          | Latest release / existing major-tag style target |
| ------------------------------- | ------------------------------------------------ |
| `actions/checkout`              | v7.0.1 / `@v7`                                   |
| `actions/setup-node`            | v7.0.0 / `@v7`                                   |
| `actions/upload-artifact`       | v7.0.2 / `@v7`                                   |
| `actions/setup-python`          | v7.0.0 / `@v7`                                   |
| `actions/configure-pages`       | v6.0.0 / `@v6`                                   |
| `actions/upload-pages-artifact` | v5.0.0 / `@v5`                                   |
| `actions/deploy-pages`          | v5.0.1 / `@v5`                                   |

Use the existing major-tag convention; check official migration notes and referenced tags before editing workflows. Preserve permissions, triggers, cache behaviour, Pages deployment eligibility, and artefact names/paths. Include the builder lockfile in relevant npm cache keys when its installation is added.

## Compatibility evidence and investigation boundaries

- Node 24.21.0 / npm 11.19 are the supplied working environment. CI Node pins are now set to 24.21.0 in both workflows; keep every CI Node pin consistent. This meets jsdom 30.1.2's `^24.15.0` engine requirement and JSDoc 65.2.0's Node requirement.
- Unicorn 77 requires ESLint `>=10.4` and Node `>=22`; ESLint 10.12.0 and Node 24 meet these requirements.
- Vite 8.3.3 and React plugin 6.1.2 are a paired major upgrade. Vitest 5.0.3 supports Vite 6.4/7/8. Check optional peers and official migration guidance rather than installing all listed peers indiscriminately.
- Vitest and its coverage provider must match exactly. Check runner/report changes so the regression checker still parses actual tool output correctly; never hide failed checks behind a new baseline.
- Assess React/Ant Design and DOM-test upgrades against existing tests and browser workflows. Preserve UI behaviour rather than accepting changed snapshots or weaker assertions merely to pass.
- Advance numeric declarations to the selected candidate so tracked manifests and locks agree. Keep manifest range/tag conventions consistent with the changed manifests; record the resolved version for any tag that remains `latest`. The explicit TypeScript 6.0.3 declaration is the authorised compatibility exception.
- The obsolete frontend `allowScripts` `esbuild` pin has been removed: npm does not consume this non-standard field and no project consumer existed.

## Authoritative JsonDbApp decision

The project's builder documentation identifies the pin as `v0.3.0`. The authoritative upstream is [h-arnold/JsonDbApp](https://github.com/h-arnold/JsonDbApp), corroborated by existing project release notes.

On 8 October 2026, upstream releases/latest and tags both identify [v0.3.0](https://github.com/h-arnold/JsonDbApp/releases/tag/v0.3.0), tag commit `f336640398695d7ac0715bb99569fd3c66cba0a2`, as latest. Retain the existing pin and snapshot: no vendor update is currently needed. Reconfirm authoritative upstream before any future vendor change; do not substitute a fork, unreleased HEAD, or runtime download. A newly discovered incompatible persistence/API change requires an explicit scope decision before implementation.

## Baseline and acceptance criteria

The existing session is `dependency-update-20261007`, established with `npm run regression-checker -- dependency-update-20261007`. Preserve `.ts-regression-checker/reports/session-dependency-update-20261007/baseline` and compare subsequent runs against it.

Supplied baseline: seven checks pass; backend lint has ten existing `max-lines` warnings and zero errors. Its `--max-warnings 0` check is not a passing check. Accept no unapproved added diagnostics; distinguish zero regressions from an entirely green strict-lint run. The user explicitly accepted three additional frontend `max-lines` warnings caused by approved arrow-return fixes, recorded under rule 3 in `LINT_UPGRADE_REVIEW.md`; this exception does not authorise other new warnings. Do not weaken the check command or expand this upgrade into unrelated backend decomposition.

Completion requires:

1. All three package/lockfile pairs install cleanly with ordinary npm resolution and `npm ci`; no tracked dependency downgrade or invalid peer tree.
2. Explicit root/frontend TypeScript 7 compilation succeeds; lint resolves supported official TypeScript 6.0.3; regression compiler execution cannot select TypeScript 6 through PATH.
3. Frontend/builder/synthetic lint, backend tests, frontend coverage and browser tests, builder coverage, synthetic tests, production and development GAS builds, and documentation build succeed. Backend lint remains error-free with no new baseline warnings.
4. Regression comparison reports no new failures/diagnostics or coverage regressions. Preserve check IDs, order, configuration, and execution metadata; if unavoidable reporter changes invalidate comparability, explain the evidence and obtain a decision before replacing a baseline.
5. Root/frontend/builder outdated checks have no unexplained stale direct dependencies; TypeScript 6.0.3 is reported as the authorised lint-only exception. Record version selection, peers, and any approved constraints.
6. Implement the decisions in `LINT_UPGRADE_REVIEW.md` one rule at a time, then complete the final code-review loop until it returns clean when delegation is available. Record review and test status honestly: this specification claims neither a passing code review nor passing test runs, and strict backend lint still carries its existing warnings.

## Data shapes, helpers, and documentation

No persistence-shape or regression configuration-shape change is planned: the persisted cohort `active` field stays as-is and the regression checker keeps its `kind: tsc` configuration shape. The five approved API name renames do change API and schema identifiers, so producers, consumers, registries, schemas, tests, and the canonical data-shape docs under `docs/developer/data-shapes/` must be updated together, with the Data Shapes Agent involved before sign-off. No new shared helper is required: reuse the existing runner and package scripts.

If any other upgrade necessitates a contractual shape change or shared abstraction, stop for a scope decision and update canonical documentation before implementation.

Update the compiler/lint hierarchy guide and regression-checker guide to explain explicit compiler selection; update relevant build/testing documentation only where commands or supported tooling change. The command inventory includes `CONTRIBUTING.md`, `.github/agents/implementation.agent.md`, `.github/agents/code-reviewer.agent.md`, `.opencode/agents/implementation.md`, `.opencode/agents/code-reviewer.md`, and `.opencode/agents/playwright.md`. Documentation accuracy edits to agent commands are in scope; OpenCode launch/configuration repairs remain out of scope. Implementation agents must read component instructions and applicable test/logging documentation before making compatibility edits.
