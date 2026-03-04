# React + GAS Unified Build Plan (AssessmentBot)

## Scope and Goal

This document defines the implementation contract for a TypeScript builder that produces one deployable Google Apps Script (GAS) project containing:

- React frontend (Vite build transformed for HtmlService)
- AssessmentBot backend GAS source
- JsonDbApp source inlined behind a dedicated namespace

Goal:

- One deterministic build command that always materialises a clasp-ready `build/gas/` directory.

Non-goals:

- No runtime feature changes to AssessmentBot logic.
- No deployment automation in this phase.

## Technical Direction

### Language and standards

Builder code should be written in TypeScript and match frontend defaults to avoid divergence:

- ESM modules (`"type": "module"` style)
- Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- ESLint flat config with TypeScript ESLint rules
- Prettier formatting using repository `.prettierrc`
- 2-space indentation

### Proposed builder location

- Source: `scripts/builder/src/**/*.ts`
- Entrypoint: `scripts/builder/src/build-gas-bundle.ts`
- Compiled runner: `scripts/builder/dist/build-gas-bundle.js`
- Tests: inlined with source modules using `.spec.ts` suffix (for example `merge-manifest.spec.ts`)

### Proposed npm scripts (root)

- `builder:build`: compile the builder TypeScript
- `builder:run`: execute builder and produce `build/gas`
- `builder:test`: run builder unit tests
- `builder:lint`: lint builder TypeScript

## Viability Summary

Plan is viable with these hard constraints:

- GAS project files share one global namespace.
- JsonDbApp cannot be copied raw because collisions are guaranteed (for example `Validate`).
- Final artefact must contain one authoritative `appsscript.json`.
- Vite output must be transformed for HtmlService (no module script/runtime asset assumptions).

## Target Build Outputs

- `build/frontend/` - raw frontend build artefacts
- `build/work/` - temporary transformation workspace (optional, but recommended)
- `build/gas/` - final clasp-ready GAS project

Required final files (minimum):

- `build/gas/appsscript.json`
- `build/gas/UI/ReactApp.html`
- `build/gas/JsonDbApp.inlined.js`
- Backend `.js` files copied from `src/backend/`

## Pipeline Contract (Step-by-Step)

### Step 1: Preflight and clean

Required functionality:

- Validate required directories/files exist (`src/frontend`, `src/backend`, builder config).
- Remove previous `build/` output.
- Recreate base directories with deterministic structure.

Acceptance criteria:

- Build fails fast with a clear error if required inputs are missing.
- Re-running immediately after a successful build starts from a clean state.
- No stale artefacts remain from prior runs.

Test cases:

- Unit: missing `src/backend` path throws expected error.
- Unit: clean removes nested stale files under `build/gas/`.
- Integration: two consecutive runs produce identical file list.

### Step 2: Frontend build (Vite)

Required functionality:

- Execute frontend build from `src/frontend`.
- Use HtmlService-compatible configuration profile:
  - `base: './'` (or empty equivalent)
  - `build.cssCodeSplit = false`
  - `build.modulePreload = false`
  - `rollupOptions.output.inlineDynamicImports = true`
- Capture build metadata (entry html path, generated chunks, warnings).

Acceptance criteria:

- Vite exits successfully.
- Output exists in `build/frontend` (or configured output path).
- Build log includes generated entry HTML.

Test cases:

- Integration: frontend build command is invoked with expected working directory.
- Integration: build failure propagates non-zero exit and halts pipeline.

### Step 3: Convert frontend for HtmlService

Required functionality:

- Transform built `index.html` into `UI/ReactApp.html` for GAS HtmlService.
- Inline JS and CSS into HTML template (or equivalent single-delivery strategy).
- Remove incompatible module semantics and asset URL assumptions.
- Preserve essential meta tags and root mount node.

Acceptance criteria:

- Output contains no external `/assets/*` references.
- Output is valid HtmlService template file.
- React root node is present and script executes in GAS client context.

Test cases:

- Unit: HTML transformer inlines `<script type="module">` content.
- Unit: CSS link tags are replaced with inline style block.
- Integration: transformed file contains no `type="module"` and no `/assets/` path.

### Step 4: Copy AssessmentBot backend

Required functionality:

- Copy backend JS files from `src/backend` into `build/gas` preserving relative structure.
- Exclude non-runtime noise (`*.test.*`, temporary files, source maps).
- Preserve top-level callable GAS functions and file naming.

Acceptance criteria:

- All required runtime backend files are present in `build/gas`.
- No test-only files appear in final output.
- Existing backend behaviour entrypoints remain intact.

Test cases:

- Unit: file filter includes `.js` runtime files and excludes tests.
- Integration: expected backend file manifest matches actual output.

### Step 5: Resolve JsonDbApp source

Required functionality:

- Source JsonDbApp from a pinned snapshot (vendored path or pinned commit archive).
- Resolve deterministic load order for concatenation.
- Validate all expected JsonDbApp source files are present before proceeding.

Acceptance criteria:

- Build fails if pinned source revision is unavailable.
- Load order is stable across runs.
- Source list is logged for traceability.

Test cases:

- Unit: load-order resolver returns deterministic ordering.
- Unit: missing required JsonDbApp file produces explicit failure.

### Step 6: Generate `JsonDbApp.inlined.js` with namespace isolation

Required functionality:

- Concatenate ordered JsonDbApp source.
- Wrap in IIFE.
- Expose a single global namespace (for example `JsonDbAppNS`).
- Export only approved API surface from wrapper return object.

Example target shape:

```javascript
const JsonDbAppNS = (function () {
  // inlined JsonDbApp internals
  return {
    loadDatabase,
    createAndInitialiseDatabase,
    DatabaseConfig,
  };
})();
```

Acceptance criteria:

- Only one new global symbol from JsonDbApp is introduced.
- Known collision names (for example `Validate`) are not leaked globally.
- File is syntactically valid JavaScript for GAS runtime.

Test cases:

- Unit: wrapper generator outputs expected namespace declaration.
- Unit: export list contains only configured public names.
- Integration: duplicate global scan does not report JsonDb internals.

### Step 7: Merge manifests into one `appsscript.json`

Required functionality:

- Use AssessmentBot manifest as base.
- Union scopes/services required by backend + JsonDbApp.
- Preserve required fields and stable key ordering for deterministic diffs.

Acceptance criteria:

- Exactly one final manifest exists in `build/gas`.
- No duplicate scope entries.
- All required advanced services remain enabled.

Test cases:

- Unit: scope merge de-duplicates and sorts deterministically.
- Unit: service merge keeps existing service versions.
- Integration: final manifest passes JSON parse and required-field assertions.

### Step 8: Materialise final GAS project structure

Required functionality:

- Write all generated/copied assets into `build/gas`.
- Ensure consistent directory layout (`UI`, backend files, manifest, inlined JsonDb file).
- Optionally emit build metadata file (for example input revisions and timestamps).

Acceptance criteria:

- `build/gas` is directly usable by clasp without manual edits.
- Required file set is complete.

Test cases:

- Integration: file tree assertion for expected structure.
- Integration: no temporary workspace files leak into final output.

### Step 9: Validate output and fail fast

Required functionality:

- Run final checks:
  - required files present
  - manifest sanity
  - duplicate global symbol detection for protected names
  - frontend HTML has no forbidden external asset references
- Emit concise build summary.

Acceptance criteria:

- Any failed check aborts build with actionable message.
- Successful build prints output path and key artefact sizes.

Test cases:

- Unit: duplicate symbol detector flags known collision fixture.
- Unit: required-file validator fails with missing file list.
- Integration: happy-path run ends with success summary and zero exit.

## Suggested TypeScript Module Layout

- `scripts/builder/src/build-gas-bundle.ts` (orchestrator)
- `scripts/builder/src/config.ts` (paths, constants, defaults)
- `scripts/builder/src/steps/preflight-clean.ts`
- `scripts/builder/src/steps/build-frontend.ts`
- `scripts/builder/src/steps/convert-htmlservice.ts`
- `scripts/builder/src/steps/copy-backend.ts`
- `scripts/builder/src/steps/resolve-jsondb-source.ts`
- `scripts/builder/src/steps/generate-jsondb-inline.ts`
- `scripts/builder/src/steps/merge-manifest.ts`
- `scripts/builder/src/steps/materialise-output.ts`
- `scripts/builder/src/steps/validate-output.ts`
- `scripts/builder/src/lib/fs.ts`
- `scripts/builder/src/lib/process.ts`
- `scripts/builder/src/lib/hash.ts`
- `scripts/builder/src/types.ts`

## Error Handling Contract for Builder

- Fail fast; never swallow errors.
- Throw typed errors with stage context (for example `BuildStageError`).
- Include:
  - pipeline stage id
  - concise human-readable message
  - underlying error object
- Exit non-zero on first hard failure.

## Determinism Requirements

- Stable file ordering for concatenation and copy operations.
- Stable JSON serialisation order for manifest writes.
- Optional content-hash output to verify repeatability.

Acceptance criteria:

- Two builds from unchanged inputs produce identical checksums for core outputs:
  - `appsscript.json`
  - `JsonDbApp.inlined.js`
  - `UI/ReactApp.html`

## Test Strategy (Builder)

Test levels:

- Unit tests for pure transforms and merge logic.
- Integration tests for pipeline stages using fixture directories.
- Smoke test for end-to-end build with representative sample inputs.

Test file convention:

- Colocate tests with implementation in `scripts/builder/src/`.
- Use `.spec.ts` suffix for all builder tests to keep TypeScript conventions idiomatic.

Recommended coverage focus:

- HtmlService conversion edge cases
- Manifest merge correctness
- JsonDb namespacing and collision prevention
- Deterministic output ordering

## Initial Milestones

1. Implement steps 1-3 with fixture-based integration tests.
2. Add backend copy + manifest merge (steps 4 and 7).
3. Add JsonDb resolution/inlining (steps 5 and 6).
4. Add materialisation + final validators (steps 8 and 9).
5. Wire npm scripts and CI checks for builder lint/test/run.

## Final Acceptance Criteria (MVP)

- Single command builds `build/gas` from clean checkout.
- React app renders via HtmlService without runtime asset fetch failures.
- Backend callable functions remain available.
- JsonDb functionality is accessible via namespace only (`JsonDbAppNS.*`).
- One valid merged `appsscript.json` is emitted.
- Build is deterministic across repeat runs with unchanged inputs.
