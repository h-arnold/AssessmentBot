# Builder Script

This document covers the TypeScript builder pipeline in `scripts/builder`.

## 1. Usage guidance

### What the builder produces

The builder creates one deployable Google Apps Script output in `build/gas` by combining:

- Frontend output from `src/frontend`
- Backend runtime files from `src/backend`
- A namespaced JsonDbApp snapshot from `scripts/builder/vendor/jsondbapp`

### Prerequisites

Run from the repository root:

```bash
npm install
```

Make sure these inputs exist:

- `src/frontend`
- `src/backend`
- `scripts/builder/builder.config.json`

### Commands

Use the builder commands from the root `package.json`:

```bash
# Standard production builder routine (lint + tests + production build pipeline)
npm run build

# Fast development builder routine (skip lint/tests, build with frontend debug mode)
npm run build:dev
```

Useful supporting commands:

```bash
# Builder lint checks
npm run builder:lint

# Builder unit tests
npm run builder:test

# Full builder CI sequence: lint -> test -> compile -> run
npm run builder:ci
```

### Coverage requirement

Builder unit tests must meet a minimum coverage threshold of **85%** for lines, functions, statements, and branches. The threshold is enforced in `scripts/builder/vitest.config.ts` and checked via `npm run builder:test:coverage`.

### Typical local workflow

1. `npm run build` (or `npm run build:dev` during frontend debugging)
2. Inspect `build/gas`
3. Deploy with your normal clasp workflow

### Output directories

- `build/frontend`: Raw Vite output used as an intermediate artefact.
- `build/work`: Reserved temporary workspace directory.
- `build/gas`: Final clasp-ready output.

Expected core files in `build/gas`:

- `appsscript.json`
- `JsonDbApp.inlined.js`
- `UI/ReactApp.html`

### Configuration

Builder configuration lives in `scripts/builder/builder.config.json`.

```json
{
  "frontendDir": "src/frontend",
  "backendDir": "src/backend",
  "buildDir": "build",
  "jsonDbApp": {
    "pinnedSnapshotDir": "scripts/builder/vendor/jsondbapp",
    "sourceFiles": [
      "src/01_utils/ComparisonUtils.js",
      "src/01_utils/ErrorHandler.js",
      "src/01_utils/FieldPathUtils.js",
      "src/01_utils/IdGenerator.js",
      "src/01_utils/JDbLogger.js",
      "src/01_utils/ObjectUtils.js",
      "src/01_utils/Validation.js",
      "src/02_components/CollectionCoordinator.js",
      "src/02_components/CollectionMetadata.js",
      "src/02_components/DocumentOperations.js",
      "src/02_components/FileOperations.js",
      "src/02_components/QueryEngine/01_QueryEngineValidation.js",
      "src/02_components/QueryEngine/02_QueryEngineMatcher.js",
      "src/02_components/QueryEngine/99_QueryEngine.js",
      "src/02_components/UpdateEngine/01_UpdateEngineFieldOperators.js",
      "src/02_components/UpdateEngine/02_UpdateEngineArrayOperators.js",
      "src/02_components/UpdateEngine/03_UpdateEngineFieldPathAccess.js",
      "src/02_components/UpdateEngine/04_UpdateEngineValidation.js",
      "src/02_components/UpdateEngine/99_UpdateEngine.js",
      "src/03_services/DbLockService.js",
      "src/03_services/FileService.js",
      "src/04_core/99_PublicAPI.js",
      "src/04_core/Collection/01_CollectionReadOperations.js",
      "src/04_core/Collection/02_CollectionWriteOperations.js",
      "src/04_core/Collection/99_Collection.js",
      "src/04_core/Database/01_DatabaseLifecycle.js",
      "src/04_core/Database/02_DatabaseCollectionManagement.js",
      "src/04_core/Database/03_DatabaseIndexOperations.js",
      "src/04_core/Database/04_DatabaseMasterIndexOperations.js",
      "src/04_core/Database/99_Database.js",
      "src/04_core/DatabaseConfig.js",
      "src/04_core/MasterIndex/01_MasterIndexMetadataNormaliser.js",
      "src/04_core/MasterIndex/02_MasterIndexLockManager.js",
      "src/04_core/MasterIndex/04_MasterIndexConflictResolver.js",
      "src/04_core/MasterIndex/99_MasterIndex.js"
    ],
    "publicExports": ["loadDatabase", "createAndInitialiseDatabase"]
  }
}
```

Notes:

- Paths must resolve inside the repository root.
- `buildDir` is fully removed and recreated during preflight.
- If `build/gas/.clasp.json` exists before preflight, it is preserved and restored after directory recreation.
- `builder.config.json` is the authoritative JsonDbApp inclusion allowlist for the committed vendored subset.
- `jsonDbApp.sourceFiles` is sorted deterministically before inlining.
- `jsonDbApp.publicExports` controls what is exposed on `JsonDbApp`.
- The committed vendored snapshot is sourced from upstream JsonDbApp tag `v0.1.1`; Stage 6 validates that local snapshot and never downloads or extracts releases at runtime.
- The vendored upstream logger implementation at `scripts/builder/vendor/jsondbapp/src/01_utils/JDbLogger.js` intentionally retains `console.error`, `console.warn`, and `console.log` for upstream/runtime parity. This is a narrow exception for that vendored file only, not a general precedent for active project code.

### Failure behaviour

The builder fails fast with stage-specific messages. Stage IDs map directly to pipeline modules:

- `preflight-clean`
- `frontend-install-deps`
- `frontend-build`
- `frontend-htmlservice-transform`
- `backend-copy`
- `resolve-jsondb-source`
- `jsondb-inline-namespace`
- `merge-manifest`
- `materialise-output`
- `validate-output`

## 2. How it works

The entrypoint is `scripts/builder/src/build-gas-bundle.ts`. It resolves config and runs ten stages in order.

### Stage 1: Preflight clean

- Validates required input directories/files.
- Removes `buildDir`.
- Recreates deterministic directories:
  - `build`
  - `build/frontend`
  - `build/work`
  - `build/gas`
  - `build/gas/UI`

### Stage 2: Frontend dependency check and install

- Verifies frontend dependencies with:
  - `npm --prefix <frontendDir> ls --depth=0`
- If verification fails, runs:
  - `npm --prefix <frontendDir> ci --no-audit --no-fund`
- Fails with stage-aware diagnostics if dependency installation fails.

### Stage 3: Frontend build

- Runs:
  - `npm --prefix <frontendDir> run build -- --base=./ --outDir <buildFrontendDir> --emptyOutDir`
- Requires `build/frontend/index.html` to exist.
- Captures chunk and warning metadata from command output.

### Stage 4: HtmlService transform

- Reads `build/frontend/index.html`.
- Replaces stylesheet `<link ... href="...">` tags with inline `<style>` blocks.
- Replaces local `<script type="module" src="..."></script>` references with inline `<script>` blocks, removing only `src` and preserving remaining attributes (including `type="module"`).
- Writes final HtmlService template to `build/gas/UI/ReactApp.html`.
- Fails if unresolved asset references remain, or if any module script still has an unresolved external `src` after transform.
- Handles module script attributes in quoted or unquoted form, and supports either `src`/`type` attribute order.

### Stage 5: Backend copy

- Recursively copies runtime `.js` files from `src/backend` to `build/gas`.
- Preserves relative directory structure.
- Excludes non-runtime noise:
  - `*.test.*`
  - `*.spec.*`
  - `.map`
  - `~`, `.tmp`, `.temp` suffixed files

### Stage 6: Resolve JsonDb source

- Validates the committed vendored snapshot rooted at `scripts/builder/vendor/jsondbapp`.
- Verifies `appsscript.json` exists and every configured `jsonDbApp.sourceFiles` entry resolves inside that snapshot.
- Rejects placeholder vendored content before Stage 7 begins.
- Leaves `BuilderPaths` pointed at the committed vendored snapshot; no runtime download, archive extraction, or file auto-discovery occurs here.

### Stage 7: Inline JsonDb namespace

- Concatenates ordered JsonDb source files.
- Wraps them in an IIFE namespace:

```javascript
const JsonDbApp = (function () {
  // inlined JsonDb source
  return {
    loadDatabase,
    createAndInitialiseDatabase,
  };
})();
```

- Writes `build/gas/JsonDbApp.inlined.js`.
- Keeps JsonDb internals out of global scope except `JsonDbApp`.

### Stage 8: Merge manifest

- Reads:
  - backend manifest (`src/backend/appsscript.json`)
  - JsonDb snapshot manifest (`scripts/builder/vendor/jsondbapp/appsscript.json`)
- Uses backend manifest as the base object.
- Merges and de-duplicates:
  - `oauthScopes` (sorted)
  - `dependencies.enabledAdvancedServices` by `serviceId` (backend version wins on collisions)
- Sorts keys recursively for deterministic output.
- Writes merged `build/gas/appsscript.json`.

### Stage 9: Materialise output

- Scans final `build/gas` tree.
- Verifies required layout files exist.
- Verifies no temporary `work` or `frontend` directories leaked under `build/gas`.
- Emits summary metadata (`fileCount`, `totalBytes`).

### Stage 10: Validate output

- Re-validates required files.
- Checks manifest sanity:
  - Valid JSON
  - Non-empty `oauthScopes`
  - No duplicate scopes
  - No duplicate advanced services by `serviceId`
- Checks UI HTML for forbidden external/asset references.
- Scans JavaScript top-level declarations and fails on duplicate protected globals:
  - `Validate`
  - `JsonDbApp`
- Emits artefact sizes and SHA-256 checksums for determinism tracking.

### Error model and determinism

- Stage failures throw `BuildStageError` with stage context.
- Command failures from spawned processes are wrapped with diagnostics.
- Successful builds log deterministic checksums for:
  - `appsscript.json`
  - `JsonDbApp.inlined.js`
  - `UI/ReactApp.html`

## 3. Builder mode and logging boundaries

The builder already exposes two workflows:

- `npm run build` (production-oriented)
- `npm run build:dev` (fast developer feedback loop)

Treat these modes as diagnostics controls, not separate runtime contracts.

### What should differ by mode

- **Developer mode (`build:dev`)**
  - Higher diagnostic verbosity is acceptable.
  - Frontend debug logs can be enabled for local troubleshooting.
  - Builder step summaries should still stay deterministic and structured.

- **Production mode (`build`)**
  - Keep logs concise and operationally useful.
  - Avoid noisy debug-level browser logs by default.
  - Keep stack-trace-heavy client diagnostics disabled by default.
  - Preserve the same user-facing error behaviour and copy as dev mode.

### What must not differ by mode

- API envelope contracts (`ok`, `requestId`, `error.code`, `error.message`, `retriable`).
- Error-mapping semantics from transport failures to user-facing UI states.
- Build failure signalling (non-zero exit code and stage-aware failure output).

### Practical boundary guidance

1. Keep builder logs focused on pipeline stages, artefact outputs, and deterministic checksums.
2. Keep stage failures explicit and actionable, including stage identity and cause details.
3. Keep frontend developer diagnostics in frontend logger abstractions, not mixed into builder pipeline messages.
4. Keep user-facing message copy stable across build modes.
5. Never log sensitive values (tokens, secrets, personal data) in either mode.
6. Preserve stream discipline: routine build progress to stdout, failure diagnostics to stderr.

For frontend implementation details, see `docs/developer/frontend/frontend-logging-and-error-handling.md`.
