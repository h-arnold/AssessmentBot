# Lint Triage — Issue #299

Date: 11 September 2026
Branch: `main` (`b35b750`, up to date with `origin/main`)
Issue: https://github.com/h-arnold/AssessmentBot/issues/299

## 1. Fix applied

Root cause: `package.json` passed shell-expanded globs to ESLint. Without
`globstar`, the shell expands `**` as a single `*` before ESLint receives it,
so only one directory level was linted.

Measured coverage gap (shell with `globstar` disabled):

- Backend: old globs expanded to 199 files; `find src/backend tests -name "*.js"`
  lists 279 files. 80 files omitted (root-level files and files two levels deep).
- Builder: old `scripts/builder/src/**/*.ts` expanded to 33 files;
  `find scripts/builder/src -name "*.ts"` lists 51 files. 18 files omitted
  (root-level files and files below the first level).

Change made in `package.json` only (no rule changes, no source changes).
Directory arguments let ESLint recurse using its own `files` patterns:

```diff
-    "lint:backend": "eslint --config eslint.config.js --fix src/backend/**/*.js tests/**/*.js",
-    "lint:backend:check": "eslint --max-warnings 0 --config eslint.config.js src/backend/**/*.js tests/**/*.js",
-    "lint:backend:errors-only": "eslint --config eslint.config.js src/backend/**/*.js tests/**/*.js",
+    "lint:backend": "eslint --config eslint.config.js --fix src/backend tests",
+    "lint:backend:check": "eslint --max-warnings 0 --config eslint.config.js src/backend tests",
+    "lint:backend:errors-only": "eslint --config eslint.config.js src/backend tests",
-    "lint:builder": "eslint --config scripts/builder/eslint.config.js --fix scripts/builder/src/**/*.ts .opencode/plugins",
-    "lint:builder:check": "eslint --max-warnings 0 --config scripts/builder/eslint.config.js scripts/builder/src/**/*.ts .opencode/plugins",
+    "lint:builder": "eslint --config scripts/builder/eslint.config.js --fix scripts/builder/src .opencode/plugins",
+    "lint:builder:check": "eslint --max-warnings 0 --config scripts/builder/eslint.config.js scripts/builder/src .opencode/plugins",
```

Frontend needed no change: `src/frontend/package.json` already lints
directories (`eslint src e2e-tests playwright.config.ts vite.config.ts
eslint.config.js`).

CI (` .github/workflows/ci.yml`) invokes the npm scripts
(`lint:backend:errors-only`, `lint:frontend:check`, `lint:builder:check`),
so it inherits the fix without further edits.

Omitted from the old backend run (representative):

- `src/backend/00_BaseSingleton.js` (root level)
- `src/backend/AssignmentProcessor/Assignment/06_AssignmentLLMOrchestration.js`
- `src/backend/Models/Artifacts/**` (two levels deep)
- `src/backend/Utils/ErrorTypes/**` (two levels deep)
- `src/backend/y_controllers/**/index.js` and other second-level controllers
- `src/backend/z_Api/*/**` domain files
- `tests/**/…` second-level suites (e.g. `tests/api/apiHandler/*`,
  `tests/controllers/*/*`, `tests/utils/*/*`)

Omitted from the old builder run:

- Root-level `scripts/builder/src/*.ts` (e.g. `config.ts`, `build-gas-bundle.ts`)
- Files below the first level (e.g.
  `regression-checker/compare/*.spec.ts`)

## 2. Commands run

All commands run from the repo root on `main`, without `--fix`:

| Scope                    | Command                                                                                      | Result                                                |
| ------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Backend (full, post-fix) | `npx eslint --config eslint.config.js src/backend tests`                                     | 107 errors, 13 warnings across 26 files with findings |
| Builder (full, post-fix) | `npx eslint --config scripts/builder/eslint.config.js scripts/builder/src .opencode/plugins` | 15 errors, 2 warnings across 4 files with findings    |
| Frontend                 | `npm run lint:frontend:check`                                                                | 0 errors, 0 warnings (exit 0)                         |

Raw outputs retained for this triage (git-ignored):
`.opencode/scratchpad/backend-lint-full.txt`,
`.opencode/scratchpad/builder-lint-full.txt`,
`.opencode/scratchpad/frontend-lint-check.txt`.

## 3. Triage

Categories used:

- **Simple mechanical**: no behavioural change; rename, JSDoc wording, whitespace, single-call API swap, constant extraction.
- **Minor refactor**: small logic touch or a judgement call (guard clause, helper extraction, documented disable).
- **Major rework**: structural change, file split, or complexity reduction needing tests.

### 3.1 Simple mechanical (~90 findings)

JSDoc completions dominate. Most are missing `@param` descriptions,
`@returns` descriptions, or `@returns` declarations where `@return` is used
(e.g. `scripts/builder/src/config.ts` uses `@return`, the rule requires `@returns`).

Backend JSDoc errors (66):

- `jsdoc/require-returns-description`: 23
- `jsdoc/require-param`: 15 (includes 10× `opts.*` in `0_BaseTaskArtifact.js`)
- `jsdoc/require-param-description`: 14
- `jsdoc/require-returns`: 8
- `jsdoc/require-description`: 5
- `jsdoc/require-jsdoc`: 1 (`06_AssignmentLLMOrchestration.js:13`)

Builder JSDoc errors (14):

- `jsdoc/require-jsdoc`: 7 (all in `config.spec.ts`)
- `jsdoc/require-returns`: 7 (all in `config.ts`)

Abbreviations and modern-JS clean-ups (backend, 24 errors):

- `unicorn/prevent-abbreviations`: 15 — `params` (7×, → `parameters`), `err` (2×, → `error`), `i` (3×, → `index`), plus `str`, `obj`, `src`, `f`, `json`, `row`/`rows` context as flagged.
- `unicorn/no-useless-error-capture-stack-trace`: 5 — delete redundant `Error.captureStackTrace` in all `Utils/ErrorTypes/*.js` except the two whitespace-only files.
- `unicorn/empty-brace-spaces`: 2 — `ApiValidationError.js:34`, `ClassNotFoundError.js:32`.
- `unicorn/no-new-array`: 1, `unicorn/no-array-sort`: 1 (→ `toSorted`), `require-unicode-regexp`: 1 (add `u` flag in `1_TextTaskArtifact.js:60`), `unicorn/no-immediate-mutation`: 1, `unicorn/prefer-single-call`: 1.

Magic numbers (warnings, mechanical):

- Backend `no-magic-numbers`: 1 (`3_SpreadsheetTaskArtifact.js:64`, `-1`).
- Builder `@typescript-eslint/no-magic-numbers`: 2 (`build-gas-bundle.ts:21`, `derived-summaries-and-comparison-engine.spec.ts:838`).

These can be batched file-by-file with `--fix` review plus manual JSDoc wording.

### 3.2 Minor refactor (~10 findings)

- `security/detect-object-injection`: 6 — `0_BaseTaskArtifact.js` (1×, `obj[k]` in `_stableStringify`), `2_TableTaskArtifact.js` (2×), `3_SpreadsheetTaskArtifact.js` (3×). Each needs a `Object.hasOwn`/allow-list guard or an explicit addition to the existing per-file opt-out block in `eslint.config.js` (which already documents this rationale for 14 other backend files).
- `sonarjs/no-global-this`: 4 — one each in `1_TextTaskArtifact.js`, `2_TableTaskArtifact.js`, `3_SpreadsheetTaskArtifact.js`, `5_ArtifactFactory.js`. In GAS-concatenated classes `this` is idiomatic; verify each site and either refactor or add a narrowly documented disable.
- `unicorn/no-nested-ternary` + `sonarjs/no-nested-conditional`: 2 findings on the same line (`2_TableTaskArtifact.js:190`). Extract to a named helper or `if/else`.
- Builder `complexity`: 1 — `config.spec.ts:130`, async arrow complexity 13 (max 7). Split the oversized test block into smaller cases.

### 3.3 Major rework (complexity + file size)

- `sonarjs/cognitive-complexity`: 2 — both in `3_SpreadsheetTaskArtifact.js` (`_trimEmpty` at 19, `_canonicaliseFormula` at 20; limit 15). Requires extracting helpers and re-testing spreadsheet normalisation behaviour.
- `max-lines` warnings: 12 — the only warnings in the full backend audit besides the single magic number:
  - Production: `SlidesParser.js` (595 lines), `DriveManager.js` (661), `y_controllers/ABClassController/index.js` (581).
  - Tests: `assignmentDefinitionPartials.unit.test.js` (2776), `referenceDataController.test.js` (701), `dbManager.test.js` (665), `assignmentController.hydration.test.js` (653), `tests/api/apiHandler/shared.js` (630), `batchUpdateUtility.test.js` (615), `classroomApiClient.test.js` (550), `abclassController.readClass.test.js` (540), `assignmentFactory.test.js` (519).
  - Per backend `AGENTS.md` §11, non-API files over 550 lines should use the facade-pattern split; test files need decomposition into smaller suites/fixtures. The 2776-line partials suite is the largest single item.

## 4. Per-file summary (full audits only)

Backend errors are confined to 14 files (all missed by the old glob):

| File                                                                          | E   | W   | Dominant rules                                         |
| ----------------------------------------------------------------------------- | --- | --- | ------------------------------------------------------ |
| `src/backend/Models/Artifacts/0_BaseTaskArtifact.js`                          | 26  | 0   | JSDoc `opts.*`, abbreviations, object-injection        |
| `src/backend/Models/Artifacts/2_TableTaskArtifact.js`                         | 24  | 0   | JSDoc, abbreviations, nested ternary, object-injection |
| `src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js`                   | 18  | 1   | JSDoc, cognitive-complexity ×2, object-injection ×3    |
| `src/backend/Models/Artifacts/5_ArtifactFactory.js`                           | 17  | 0   | JSDoc, `params` ×5                                     |
| `src/backend/Models/Artifacts/1_TextTaskArtifact.js`                          | 5   | 0   | JSDoc, `u` flag, `params`, `no-global-this`            |
| `src/backend/00_BaseSingleton.js`                                             | 4   | 0   | JSDoc                                                  |
| `src/backend/Utils/ErrorTypes/PersistError.js`                                | 4   | 0   | JSDoc, useless `captureStackTrace`                     |
| `src/backend/Utils/ErrorTypes/ApiDisabledError.js`                            | 2   | 0   | JSDoc, useless `captureStackTrace`                     |
| `src/backend/Utils/ErrorTypes/ApiRateLimitError.js`                           | 2   | 0   | JSDoc, useless `captureStackTrace`                     |
| `src/backend/Utils/ErrorTypes/AbortRequestError.js`                           | 1   | 0   | useless `captureStackTrace`                            |
| `src/backend/Utils/ErrorTypes/ApiValidationError.js`                          | 1   | 0   | brace spacing                                          |
| `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`                     | 1   | 0   | useless `captureStackTrace`                            |
| `src/backend/Utils/ErrorTypes/ClassNotFoundError.js`                          | 1   | 0   | brace spacing                                          |
| `src/backend/AssignmentProcessor/Assignment/06_AssignmentLLMOrchestration.js` | 1   | 0   | missing JSDoc                                          |

Builder findings are confined to 4 files:

| File                                                                                             | E   | W   | Dominant rules                    |
| ------------------------------------------------------------------------------------------------ | --- | --- | --------------------------------- |
| `scripts/builder/src/config.spec.ts`                                                             | 8   | 0   | missing JSDoc ×7, `complexity` ×1 |
| `scripts/builder/src/config.ts`                                                                  | 7   | 0   | missing `@returns` ×7             |
| `scripts/builder/src/build-gas-bundle.ts`                                                        | 0   | 1   | magic number                      |
| `scripts/builder/src/regression-checker/compare/derived-summaries-and-comparison-engine.spec.ts` | 0   | 1   | magic number                      |

Frontend: clean under `lint:frontend:check`.

## 5. Suggested sequencing

1. This report covers the file-selection fix in `package.json` so CI sees the full set. No further selection changes are needed.
2. Land the simple-mechanical batch first (JSDoc, renames, `captureStackTrace` removal, `toSorted`, `u` flag, brace spacing, magic-number constants).
3. Resolve minor-refactor items with one judgement per site (object-injection guards vs documented opt-out; `this` vs `globalThis`; nested-ternary extraction; `config.spec.ts` split).
4. Schedule major rework separately (`SpreadsheetTaskArtifact` complexity, `max-lines` splits starting with the 2776-line test and the three oversized production files).
5. Restore `--max-warnings 0` enforcement once the documented large-file warnings are resolved.
