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
# Compile builder TypeScript into scripts/builder/dist
npm run builder:build

# Execute the pipeline in production mode (default; minified frontend output)
npm run builder:run
# Equivalent explicit flag
npm run builder:run -- --frontend-mode=production

# Execute the pipeline in development mode (non-minified frontend output + inline source maps)
npm run builder:run -- --frontend-mode=dev
```

Useful supporting commands:

```bash
# Builder lint checks
npm run builder:lint

# Builder unit tests
npm run builder:test

# Full builder CI sequence: lint -> test -> build -> run
npm run builder:ci
```

### Typical local workflow

1. `npm run builder:build`
2. `npm run builder:run`
3. Inspect `build/gas`
4. Deploy with your normal clasp workflow

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
    "sourceFiles": ["src/01-core.js", "src/02-database.js"],
    "publicExports": ["loadDatabase", "createAndInitialiseDatabase", "DatabaseConfig"]
  }
}
```

Notes:

- Paths must resolve inside the repository root.
- `buildDir` is fully removed and recreated during preflight.
- `jsonDbApp.sourceFiles` is sorted deterministically before inlining.
- `jsonDbApp.publicExports` controls what is exposed on `JsonDbAppNS`.

### Failure behaviour

The builder fails fast with stage-specific messages. Stage IDs map directly to pipeline modules:

- `preflight-clean`
- `frontend-build`
- `frontend-htmlservice-transform`
- `backend-copy`
- `resolve-jsondb-source`
- `jsondb-inline-namespace`
- `merge-manifest`
- `materialise-output`
- `validate-output`

## 2. How it works

The entrypoint is `scripts/builder/src/build-gas-bundle.ts`. It resolves config and runs nine stages in order.

### Stage 1: Preflight clean

- Validates required input directories/files.
- Removes `buildDir`.
- Recreates deterministic directories:
  - `build`
  - `build/frontend`
  - `build/work`
  - `build/gas`
  - `build/gas/UI`

### Stage 2: Frontend build

- Runs:
  - `npm --prefix <frontendDir> run build -- --base=./ --outDir <buildFrontendDir> --emptyOutDir`
- Requires `build/frontend/index.html` to exist.
- Captures chunk and warning metadata from command output.

### Stage 3: HtmlService transform

- Reads `build/frontend/index.html`.
- Replaces stylesheet `<link ... href="...">` tags with inline `<style>` blocks.
- Replaces `<script type="module" src="..."></script>` with inline classic `<script>` blocks.
- Writes final HtmlService template to `build/gas/UI/ReactApp.html`.
- Fails if unresolved asset references or module scripts remain.

### Stage 4: Backend copy

- Recursively copies runtime `.js` files from `src/backend` to `build/gas`.
- Preserves relative directory structure.
- Excludes non-runtime noise:
  - `*.test.*`
  - `*.spec.*`
  - `.map`
  - `~`, `.tmp`, `.temp` suffixed files

### Stage 5: Resolve JsonDb source

- Resolves `jsonDbApp.sourceFiles` from the pinned snapshot directory.
- Verifies each source file exists before continuing.
- Uses deterministic ordering.

### Stage 6: Inline JsonDb namespace

- Concatenates ordered JsonDb source files.
- Wraps them in an IIFE namespace:

```javascript
const JsonDbAppNS = (function () {
  // inlined JsonDb source
  return {
    loadDatabase,
    createAndInitialiseDatabase,
    DatabaseConfig,
  };
})();
```

- Writes `build/gas/JsonDbApp.inlined.js`.
- Keeps JsonDb internals out of global scope except `JsonDbAppNS`.

### Stage 7: Merge manifest

- Reads:
  - backend manifest (`src/backend/appsscript.json`)
  - JsonDb snapshot manifest (`scripts/builder/vendor/jsondbapp/appsscript.json`)
- Uses backend manifest as the base object.
- Merges and de-duplicates:
  - `oauthScopes` (sorted)
  - `dependencies.enabledAdvancedServices` by `serviceId` (backend version wins on collisions)
- Sorts keys recursively for deterministic output.
- Writes merged `build/gas/appsscript.json`.

### Stage 8: Materialise output

- Scans final `build/gas` tree.
- Verifies required layout files exist.
- Verifies no temporary `work` or `frontend` directories leaked under `build/gas`.
- Emits summary metadata (`fileCount`, `totalBytes`).

### Stage 9: Validate output

- Re-validates required files.
- Checks manifest sanity:
  - Valid JSON
  - Non-empty `oauthScopes`
  - No duplicate scopes
  - No duplicate advanced services by `serviceId`
- Checks UI HTML for forbidden external/asset references.
- Scans JavaScript top-level declarations and fails on duplicate protected globals:
  - `Validate`
  - `JsonDbAppNS`
- Emits artefact sizes and SHA-256 checksums for determinism tracking.

### Error model and determinism

- Stage failures throw `BuildStageError` with stage context.
- Command failures from spawned processes are wrapped with diagnostics.
- Successful builds log deterministic checksums for:
  - `appsscript.json`
  - `JsonDbApp.inlined.js`
  - `UI/ReactApp.html`
