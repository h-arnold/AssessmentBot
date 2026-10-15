# TypeScript and ESLint Configuration Hierarchy

This project uses a shared configuration tree so TypeScript and linting standards remain consistent across frontend and builder code, while still allowing environment-specific settings.

## Why this exists

- Keep one source of truth for strictness and quality standards.
- Avoid drift between frontend and builder defaults.
- Isolate runtime-specific settings (browser vs Node.js) to leaf configs.

## Why this structure is intentional

- One neutral root base keeps shared standards in a single place.
- Leaf configs stay explicit about runtime behaviour (frontend app, frontend Node tooling, builder Node CLI).
- This avoids hidden coupling where one runtime config accidentally becomes the parent for another runtime.
- A frontend-only intermediate base could remove a small amount of duplication, but adds another inheritance layer with limited practical benefit at current project size.

## TypeScript hierarchy

### 1) Single global base

- `tsconfig.base.json`
- Defines shared language and safety defaults used everywhere:
  - `target`
  - `strict`
  - `noUnusedLocals`
  - `noUnusedParameters`
  - `forceConsistentCasingInFileNames`
  - `skipLibCheck`
  - `noFallthroughCasesInSwitch`
  - `noUncheckedSideEffectImports`
  - `erasableSyntaxOnly`

### 2) Component leaf configs

- `src/frontend/tsconfig.app.json`
  - Extends `../../tsconfig.base.json`.
  - Adds frontend app specifics only: DOM libs, JSX, Vite/Vitest types, app include paths.
- `src/frontend/tsconfig.node.json`
  - Extends `../../tsconfig.base.json`.
  - Adds frontend tooling specifics only: include for `vite.config.ts`, build info path.
- `scripts/builder/tsconfig.json`
  - Extends `../../tsconfig.base.json`.
  - Adds builder specifics only: `rootDir`, `outDir`, JSON module resolution, include paths.
- `.opencode/tsconfig.json`
  - Extends `../tsconfig.base.json`.
  - Lint-only project (`noEmit`) backing the type-aware ESLint rules for the OpenCode plugin tree (`.opencode/plugins/**/*.ts`).

## ESLint hierarchy

### 1) Shared TypeScript rule base

- `config/eslint/ts-base-rules.cjs`
- Contains cross-component TypeScript lint standards:
  - `eslint-plugin-security` recommended rules promoted to `error` severity
  - Complexity limit
  - JSDoc requirement baseline
  - Magic number policy
  - Consistent type imports

### 2) Shared Unicorn preference module

- `config/eslint/unicorn-preference-rules.cjs`
- Holds the Unicorn preference rules shared by the backend and frontend configs so the two cannot drift. The frontend config (`src/frontend/eslint.config.js`) and the backend root config (`eslint.config.js`) import these maps instead of restating the rules.
- Exports two maps, preserving the original frontend scoping:
  - `unicornPreferenceRules` — general shared preferences, applied to backend source and, in the frontend config, unscoped across all frontend files.
  - `crossRuntimeUnicornPreferenceRules` — the four cross-runtime preferences (`catch-error-name`, `no-null`, `no-keyword-prefix`, `filename-case`), applied to backend source and to frontend TypeScript/TSX files only.
- Keeps each rule's rationale, caveats and issue links beside the rule it explains.
- Runtime-specific and file-scoped overrides stay local to their leaf config; only preferences shared across runtimes live here.
- The move changes no effective rule severity or scope.

### 3) Component ESLint configs

- `src/frontend/eslint.config.js`
  - Imports shared TS base rules.
  - Applies `unicorn.configs.all` as the frontend baseline.
  - Adds frontend-only rules/plugins (React hooks, Vite React refresh, browser globals).
  - Applies shared Unicode hardening rules as errors for frontend test files, with a test-only suppression for `require-unicode-regexp` after false-positive triage.
  - Globally disables `security/detect-object-injection` because its heuristic produced harmful workarounds; input sanitisation and validation are the preferred security controls.
  - Uses targeted `unicorn/*` overrides only where current frontend conventions intentionally differ.
  - Temporarily disables `unicorn/try-complexity` across frontend files pending the exception-boundary review in [issue #325](https://github.com/h-arnold/AssessmentBot/issues/325). Its default limit of one needs deliberate assessment against the existing error-handling approach before re-enabling it.
  - Disables `unicorn/prefer-string-repeat`. Short blank-input fixtures (three or five spaces) are clearer as literals than `' '.repeat(n)` expressions; keeping the literal is a deliberate readability preference.
  - Disables `unicorn/consistent-class-member-order`. Consistent member-category sorting would rearrange the existing constructor-first and public-entrypoint-first layouts; retaining logical member grouping is a deliberate readability preference, and no class members were reordered.
  - Disables `unicorn/prefer-simple-condition-first`. Its syntactic simplicity heuristic does not measure runtime cost, and reordering short-circuit conditions can skip calls or getter side effects. Preserve semantic guard order instead of rearranging conditions solely for this rule.
  - Disables `unicorn/prefer-default-parameters` only for `src/features/taskHeatmap/TaskPreviewCard.tsx`, preserving “No reasoning available” for empty reasoning. Destructuring defaults handle undefined only. The rule remains enabled elsewhere, including the nullable re-run identity hook.
  - Disables `unicorn/no-array-front-mutation` only for `src/services/apiService.ts`, where FIFO head removal is clearer with `shift()`. `unicorn/no-unnecessary-splice` **remains enabled** everywhere, including this file, so replacing `shift()` with `splice(0, 1)` only moves the finding. The rule stays `error` for every other frontend file, and no inline disable was added.
- `scripts/builder/eslint.config.js`
  - Imports shared TS base rules.
  - Adds builder-only parser/project context for Node-side TypeScript files.
  - Also governs the OpenCode plugin tree (`.opencode/plugins/**`) via the lint-only `.opencode/tsconfig.json` project.
  - Keeps `security/detect-non-literal-fs-filename` disabled because builder path resolution is already constrained to repo-root-safe paths, plus a small explicit `security/detect-object-injection` allowlist for triaged false positives.
- `eslint.config.js` (repo root)
  - Remains focused on backend JavaScript linting rules.
  - Applies shared `eslint-plugin-security` and Unicode hardening rules as errors for backend source.
  - Keeps `require-unicode-regexp` disabled for root `tests/**/*.js` and disables `security/detect-object-injection` backend-wide after full-audit triage showed only false positives; robust validation and input sanitisation at the trust boundaries are the preferred controls.
  - Disables `unicorn/prefer-private-class-fields` for backend files only. Google Apps Script's V8 runtime does not support private class fields, so `#` members cause parse errors; see the upstream [V8 runtime class limitations](https://developers.google.com/apps-script/guides/v8-runtime#class_limitations). The rule also misreads `BaseSingleton._createInstance`, a factory hook subclasses intentionally override: a `#private` method cannot provide equivalent inheritance semantics. The frontend config retains the rule.
  - Disables `unicorn/no-undeclared-class-members` for `src/backend/AssignmentProcessor/Assignment/index.js` only, because its five lazy sub-class helpers are installed as prototype getters (`Object.defineProperty(Assignment.prototype, ...)`) that the rule cannot trace; declaring them as class fields would shadow those getters and break lazy and constructor-free `Object.create(Assignment.prototype)` construction. Enforcement stays at `error` for all other backend classes. The original `Teacher` findings were fixed in source (setters call the static `Validate` service directly and the test-only prototype `_Validate` injection was removed), and Assignment's `createdAt` is now an explicit `Date` instance field populated from the real Classroom `creationTime`.
  - Disables `unicorn/no-global-object-property-assignment` through an explicit, user-authorised file-scoped override for the 17 GAS export files that intentionally publish namespace or proxy properties on the global object:
    - `src/backend/00_BaseSingleton.js`
    - `src/backend/Assessors/0_SpreadsheetFormulaEquivalence.js`
    - `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`
    - `src/backend/Models/Artifacts/0_BaseTaskArtifact.js`
    - `src/backend/Models/Artifacts/1_TextTaskArtifact.js`
    - `src/backend/Models/Artifacts/2_TableTaskArtifact.js`
    - `src/backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js`
    - `src/backend/Models/Artifacts/4_ImageTaskArtifact.js`
    - `src/backend/Models/Artifacts/5_ArtifactFactory.js`
    - `src/backend/Utils/ABLogger.js`
    - `src/backend/Utils/AuthService.js`
    - `src/backend/Utils/BatchUpdateUtility.js`
    - `src/backend/Utils/GoogleGroupsAuthService.js`
    - `src/backend/Utils/ProgressTracker.js`
    - `src/backend/Utils/ScriptAppManager.js`
    - `src/backend/Utils/ScriptPropertiesAuthService.js`
    - `src/backend/Utils/Utils.js`
      This is a scoped exception, not a backend-wide disable: the rule stays at `error` for every other backend file (including `src/backend/z_Api/z_apiHandler.js`) and for frontend files. The exception lives in the shared `eslint.config.js` file list; do not use inline `eslint-disable` comments for these publications.
  - Does not replace frontend/builder TypeScript lint configs.
  - Temporarily disables `unicorn/try-complexity` for backend source pending the same [exception-boundary review](https://github.com/h-arnold/AssessmentBot/issues/325); existing logging and error-handling policy remains in force.
  - Disables `unicorn/prefer-string-repeat`. Short blank-input fixtures (three or five spaces) are clearer as literals than `' '.repeat(n)` expressions; keeping the literal is a deliberate readability preference.
  - Disables `unicorn/consistent-class-member-order`. Backend classes likewise keep logical member grouping rather than category-sorted order; no class members were reordered.
  - Disables `unicorn/prefer-simple-condition-first` for the same semantic guard-order reason. For example, moving the missing-document-ID check ahead of `Validate.isValidUrl` in `ImageManager` would skip URL validation and its failure logging when the ID is absent.
  - Disables `unicorn/class-reference-in-static-methods` for backend files only. Explicit class references preserve fixed hydration prototypes, shared configuration fields and helper bindings, while singleton factories intentionally use receiver-relative `this`/`super` for inheritance. Enforcing either style everywhere can change inherited or unbound static calls; existing bindings are retained. Frontend enforcement remains enabled.
  - Disables `unicorn/prefer-default-parameters` only for `src/backend/Models/ABClass.js` and `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionValidation.js`. Their falsy normalisation preserves empty class names as null and prevents malformed persisted titles from falsely matching legitimate titles. Parameter defaults handle undefined only; enforcement remains enabled in other backend files.

### Scoped default-ownership permission

Rule 30's user-approved cleanups permit parameter defaults outside constructors only for six existing conversions: `absentToNull_`, the class-table filter-key map callback, the optional folder-ID form transform, the heatmap class-selection callback, and the two teacher-name schema transforms. These preserve their existing null, undefined and empty-value behaviour. This is a scoped exception to constructor-owned defaults, not a general ownership-policy change; the approval and per-finding outcomes are recorded in `LINT_UPGRADE_REVIEW.md`.

### Promise style

Backend and frontend configs disable `unicorn/prefer-await` by explicit user preference. Existing promise chaining can express non-blocking settlement observers, preserve in-flight promise identity and attach cleanup without extra async wrappers. This exclusion changes no promise implementation, error handling or concurrency contract.

### Naming preference

Backend and frontend configs disable `unicorn/name-replacements` by explicit user preference, retaining descriptive full names such as `ConfigurationManager` and `ApplicationAccess`. The rule succeeds Unicorn's older `prevent-abbreviations` spelling, but some replacements now shorten full words; no obsolete rule is re-enabled. Previous filename and module-specific overrides for this rule were removed so they cannot re-enable it. Names, API spellings and filenames remain unchanged.

### Numeric parsing

Backend and frontend configs disable `unicorn/prefer-number-coercion` to preserve intentional prefix parsing and existing validation contracts. CSS values such as `'12px'` need prefix parsing; `Number()` produces NaN. Decimal `parseInt` also differs from `Math.trunc(Number())` for blank, scientific-notation and hexadecimal inputs. `unicorn/prefer-number-properties` remains enabled, retaining the `Number.parseInt`/`Number.parseFloat` spelling preference without changing parsing semantics.

### Iteration style

Backend and frontend configs disable `unicorn/no-for-each` by explicit user preference: `.forEach` is readable and preserves existing iteration semantics, and `for...of` offers no readability benefit here. This replaces the obsolete `unicorn/no-array-for-each` entries; no source or behaviour changed.

### GAS exported globals and iterator compatibility

- Rule 47's `unicorn/prefer-smaller-scope` keeps the GAS script-global `LOCK_WAIT_WARN_THRESHOLD_MS` at program top level because `src/backend/z_Api/z_apiHandler.js` reads it at script-evaluation time, before any dispatcher instance exists. The declaration now carries `/* exported LOCK_WAIT_WARN_THRESHOLD_MS */`, the **first use** of this annotation in the codebase; the established convention elsewhere is `/* global … */` on the consuming file. The annotation informs scope analysis that an external GAS consumer uses the binding — it does not disable the rule or change configuration, and the guarded CommonJS export block and load order are unchanged. The documented GAS consumer is the API layer (`docs/developer/backend/api-layer.md`).
- Rule 54's `unicorn/prefer-iterator-to-array` is fixed by collecting ordered `Map` values/keys with `Map.forEach`, the same `.forEach` convention rule 41 permits. Native `Iterator.prototype.toArray()` works on Node 24 but fails the current ES2024 frontend typings, and GAS support is unestablished; no library, polyfill or runtime fallback was added, and no Node wiring was introduced.

### GAS runtime compatibility caveats

Two backend syntax/API choices made during the post-55 collections work are **unverified in the Apps Script V8 runtime** and are explicitly accepted by the user pending live testing:

- `Object.groupBy` in `src/backend/RequestHandlers/ImageManager.js`. Node lint and tests do not establish Apps Script availability, and Google's V8 overview names neither this API nor a guaranteeing engine version. The result is a **null-prototype** dictionary, so reserved keys such as `__proto__` and `constructor` become ordinary keys rather than throwing as the previous plain-object dictionary did; normal Drive-ID string keys are unaffected.
- Logical assignment `||=` in `src/backend/ConfigurationManager/98_ConfigurationManagerClass.js`. The distinguishing inputs between `||=` and `??=` are the other falsy values (`false`, `0`, `''`), **not** `null`: `??=` falls through on `null`, so the two are not interchangeable at this site.

No feature detection, polyfill, runtime fallback or deployment was added. Do not treat Node or browser results as Apps Script results, and do not describe these APIs as confirmed supported.

### Global access and error-rule deferrals

`unicorn/no-unnecessary-global-this` remains enabled in both runtimes. Frontend findings use direct globals; reduced-motion availability checks stay guarded, and test setup targets the DOM Window through `document.defaultView` separately from the Vitest global.

Three error-focused Unicorn rules are **temporarily disabled in both runtimes**, each with an adjacent config comment carrying its issue link:

- `unicorn/custom-error-definition` — [issue #328](https://github.com/h-arnold/AssessmentBot/issues/328) (universal custom-error approach across GAS and frontend runtimes). Existing constructor signatures, metadata and cause handling are retained.
- `unicorn/no-error-property-assignment` — [issue #328](https://github.com/h-arnold/AssessmentBot/issues/328). Native error-constructor cause support should be established and property-descriptor/serialisation differences reviewed before any migration; original cause identity and `.cause` reads are unchanged.
- `unicorn/prefer-error-is-error` — [issue #326](https://github.com/h-arnold/AssessmentBot/issues/326) (native `Error.isError` runtime, typing and recognition).

### Configuration and mock registration

The frontend config disables `unicorn/no-top-level-side-effects` only for `eslint.config.js`, `playwright.config.ts`, `vite.config.ts` and `src/test/taskHeatmapPageMocks.ts`. The first three use standard configuration entry points evaluated at load time; the shared mock module must register Vitest factories before production imports. Their exports and registration timing remain unchanged. Application modules and other files retain enforcement.

### Post-55 Unicorn exclusions (implemented)

Four post-55 Unicorn disables are implemented after independent research and configuration-only review. The opposite runtime keeps `error` severity for the three single-runtime rules, and no inline `eslint-disable` comment is used:

| Rule                               | Disabled in              | Still `error` in | Rationale                                                                                                                                                                    |
| ---------------------------------- | ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unicorn/prefer-ternary`           | backend **and** frontend | —                | Guard clauses and comparator tie-breaks read more clearly as statements, and ternary conversion also conflicts with the enabled `prefer-logical-operator-over-ternary` rule. |
| `unicorn/no-useless-override`      | **backend only**         | frontend         | Preserves the documented per-singleton `getInstance` forwarding convention.                                                                                                  |
| `unicorn/prefer-uint8array-base64` | **backend only**         | frontend         | Keeps the Node 24 `Buffer` test fallback; `Uint8Array#toBase64` is unavailable there, and the installed rule carries an upstream Node-version caveat.                        |
| `unicorn/prefer-iterator-concat`   | **frontend only**        | backend          | `Iterator.concat` is absent from Node 24 and from the project's ES2024 TypeScript typings.                                                                                   |

These suppress diagnostics only: no source, contract or runtime path changed. The configuration-only review (`PASS` on scope) verified the effective settings with `ESLint.calculateConfigForFile`; whole-upgrade verification remains `FAIL` on inherited gates. The `apiService.ts` `unicorn/no-array-front-mutation` exception above is retained and stays file-scoped. The decision record is `LINT_UPGRADE_REVIEW.md`.

## Running lint checks

The canonical `typescript` dependency is TypeScript 6.0.3 for type-aware ESLint parsing and
services; it remains below TypeScript 7 because the current typescript-eslint release does not
support TypeScript 7. Project compilation uses the separately installed TypeScript 7 alias
(`@typescript/native`) explicitly, so npm's `.bin/tsc` selection cannot change the compiler.
The root builder compile script and frontend build script invoke
`node node_modules/@typescript/native/bin/tsc` (from their respective package roots). For a
manual frontend project type-check, run:

```bash
node src/frontend/node_modules/@typescript/native/bin/tsc -b src/frontend/tsconfig.json
```

For a manual builder project type-check, run:

```bash
npm run builder:compile
```

Run all lint checks across the codebase from repo root:

```bash
npm run lint        # every scope, fixing issues in place
npm run lint:check  # every scope, zero-warning budget, no file modification
```

The plain variants pass `--fix` and rewrite files. Use the `:check` variants when verifying rather than fixing.

Run lint for a specific module:

- Backend GAS JavaScript:

```bash
npm run lint:backend
npm run lint:backend:check
```

- Frontend TypeScript/React:

```bash
npm run lint:frontend
npm run lint:frontend:check
```

- Builder TypeScript and OpenCode plugins:

```bash
npm run lint:builder
npm run lint:builder:check
```

- Synthetic test data (`scripts/synthetic-test-data`, `tests/synthetic-analysis`, `tests/synthetic-analysis-stress`):

```bash
npm run lint:synthetic
npm run lint:synthetic:check
```

## Change policy

When updating TypeScript or lint standards:

1. Update root shared base first (`tsconfig.base.json`, `config/eslint/ts-base-rules.cjs`, or `config/eslint/unicorn-preference-rules.cjs`) when the rule is intended to apply across components.
2. Update leaf config only for runtime- or component-specific behaviour.
3. Run affected validation commands:
   - `npm run build:production`
   - `npm run lint:builder`
   - `npm exec tsc -- -b src/frontend/tsconfig.json`
   - `npm run build:frontend`
   - `npm run lint:frontend`

If a proposed change does not clearly belong to a specific runtime, prefer placing it in a shared root config.
