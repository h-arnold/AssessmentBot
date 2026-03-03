# React + GAS Unified Build Plan (AssessmentBot)

## Scope and Goal

This document captures the agreed implementation direction for bundling the new React frontend and GAS backend into one deployable Google Apps Script project.

Goal:

- Build React with Vite into a GAS HtmlService-compatible artefact.
- Copy AssessmentBot backend into a single build target.
- Inline JsonDbApp source into the same GAS project without global symbol collisions.

Non-goals:

- No code changes are implemented in this document.
- No deployment behaviour is changed yet.

## Viability Summary

Plan A is viable, with required packaging constraints:

- GAS uses a shared global namespace across project files, so direct raw copy of JsonDbApp source will cause collisions (confirmed collision: `Validate`).
- Only one effective `appsscript.json` should exist in the final build output; manifests must be merged, not copied independently.
- Standard Vite dist output is not directly HtmlService-safe unless transformed (module scripts, asset graph, path assumptions).

## Required Vite/Frontend Build Changes for HtmlService

1. Build for inline/single-file delivery (or equivalent post-processing):

- Inline JS/CSS output.
- Avoid runtime `/assets/*` fetches.

1. Configure Vite for HtmlService compatibility:

- `base: './'` (or empty).
- `build.cssCodeSplit = false`.
- `build.modulePreload = false`.
- `rollupOptions.output.inlineDynamicImports = true`.

1. Routing:

- Use hash routing for SPA navigation in GAS web app URLs.

1. API bridge:

- Frontend should call GAS-exposed backend functions via `google.script.run` wrapper layer (not a generic REST assumption).

## JsonDbApp Namespacing Strategy

### Why namespacing is required

GAS project files share one global scope. Copying AssessmentBot backend + JsonDbApp source as-is causes collisions.

### Recommended approach: generated IIFE wrapper

Do not copy JsonDbApp source files raw into build output.

Instead:

1. Resolve JsonDbApp source files in deterministic load order.
2. Concatenate them.
3. Wrap concatenated source in one IIFE.
4. Expose only one global namespace object.

Example shape:

```javascript
const JsonDbAppNS = (function () {
  // concatenated JsonDbApp source files

  return {
    loadDatabase,
    createAndInitialiseDatabase,
    DatabaseConfig,
  };
})();
```

Result:

- Internals (including `Validate`) stay function-scoped inside the IIFE.
- Only `JsonDbAppNS` enters global scope.
- AssessmentBot globals remain unaffected.

## Final Shape of the Builder Script

Location:

- `scripts/builder/` (new orchestration area)

Proposed entrypoint:

- `scripts/builder/build-gas-bundle.js`

Proposed output:

- `build/frontend/` (intermediate frontend build output)
- `build/backend/` (intermediate backend copy)
- `build/gas/` (final clasp-ready unified artefact)

### Pipeline steps

1. Clean previous `build/` directories.
2. Run frontend build with HtmlService-compatible config.
3. Convert frontend output into GAS HTML template(s) (e.g. `ReactApp.html`).
4. Copy AssessmentBot backend JS into build workspace.
5. Fetch/synchronise JsonDbApp source (pinned ref or vendored snapshot).
6. Generate `JsonDbApp.inlined.js` using the IIFE namespace wrapper.
7. Merge manifest scopes/services into one final `appsscript.json`.
8. Materialise final GAS project structure under `build/gas/`.
9. Validate build (duplicate symbol checks, required files, manifest sanity).

### Suggested script module layout

- `scripts/builder/build-gas-bundle.js` (orchestrator)
- `scripts/builder/steps/buildFrontend.js`
- `scripts/builder/steps/convertFrontendToHtmlService.js`
- `scripts/builder/steps/copyBackend.js`
- `scripts/builder/steps/prepareJsonDbApp.js`
- `scripts/builder/steps/mergeManifest.js`
- `scripts/builder/steps/validateOutput.js`
- `scripts/builder/lib/fs.js`
- `scripts/builder/lib/order.js`

### Pseudocode (agreed shape)

```javascript
async function buildGasBundle() {
  cleanBuildDirs();

  await buildFrontend({
    outDir: 'build/frontend',
    htmlServiceCompat: true,
  });

  const frontendHtml = await convertFrontendToHtmlService({
    distDir: 'build/frontend',
    outFile: 'build/gas/UI/ReactApp.html',
  });

  await copyAssessmentBotBackend({
    srcDir: 'src/backend',
    outDir: 'build/gas',
  });

  const jsonDbSources = await getJsonDbAppSources({
    source: 'pinned-repo-ref-or-local-vendor',
  });

  const jsonDbIife = buildIifeNamespace({
    namespace: 'JsonDbAppNS',
    sourcesInLoadOrder: jsonDbSources,
    exports: ['loadDatabase', 'createAndInitialiseDatabase', 'DatabaseConfig'],
  });

  writeFile('build/gas/JsonDbApp.inlined.js', jsonDbIife);

  const mergedManifest = mergeAppsscriptJson({
    base: 'src/backend/appsscript.json',
    additions: {
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/script.storage',
        'https://www.googleapis.com/auth/script.scriptapp',
      ],
      services: ['drive:v3', 'sheets:v4', 'slides:v1', 'classroom:v1'],
    },
  });

  writeJson('build/gas/appsscript.json', mergedManifest);

  validateOutput({
    gasDir: 'build/gas',
    assertNoDuplicateGlobalSymbols: ['Validate', 'ABLogger', 'ProgressTracker'],
    assertRequiredFiles: ['appsscript.json', 'JsonDbApp.inlined.js', 'UI/ReactApp.html'],
  });
}
```

## Manifest and Scope Notes

- Final artefact should include one authoritative `appsscript.json`.
- Merge (union) scopes from AssessmentBot backend and JsonDbApp requirements.
- Preserve required enabled advanced services for AssessmentBot.

## Risk Checklist

- Global symbol collisions if JsonDbApp is copied raw.
- Incorrect source order when concatenating JsonDbApp classes.
- HtmlService runtime failures if module assumptions leak into output.
- Oversized UI payload if all assets are inlined without pruning.

## Acceptance Criteria for First Implementation

- `build/gas/` contains one valid GAS project (`appsscript.json` + JS/HTML files).
- React app renders in HtmlService without external runtime asset fetches.
- Backend callable functions remain available.
- JsonDbApp operations are accessible only via `JsonDbAppNS.*` and do not collide with AssessmentBot globals.
- Build is repeatable from a single command.
