import { resolveBuilderPaths } from './config.js';
import { logBuildFailure, logInfo } from './lib/process.js';
import { parseCliOptions } from './lib/cli-options.js';
import { runBackendCopy } from './steps/backend-copy.js';
import { runFrontendBuildWithMode } from './steps/frontend-build.js';
import { runFrontendHtmlServiceTransform } from './steps/frontend-htmlservice-transform.js';
import { runJsonDbInlineNamespace } from './steps/jsondb-inline-namespace.js';
import { runMaterialiseOutput } from './steps/materialise-output.js';
import { runMergeManifest } from './steps/merge-manifest.js';
import { runPreflightClean } from './steps/preflight-clean.js';
import { runResolveJsonDbSource } from './steps/resolve-jsondb-source.js';
import { runValidateOutput } from './steps/validate-output.js';

/**
 * Runs the builder pipeline entrypoint.
 *
 * @return {Promise<void>} Resolves when the configured build steps complete.
 */
async function run(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const paths = await resolveBuilderPaths();
  await runPreflightClean(paths);
  logInfo('Step 1 complete: preflight checks passed and build directories prepared.');

  const frontendBuildResult = await runFrontendBuildWithMode(paths, options.frontendMode);
  logInfo(
    `Step 2 complete: frontend build (${options.frontendMode}) generated entry HTML at ${frontendBuildResult.entryHtmlPath}`
  );

  const htmlServiceTransformResult = await runFrontendHtmlServiceTransform(paths);
  logInfo(
    `Step 3 complete: HtmlService ReactApp generated at ${htmlServiceTransformResult.reactAppPath}`
  );

  const backendCopyResult = await runBackendCopy(paths);
  logInfo(`Step 4 complete: copied ${backendCopyResult.copiedFiles.length} backend runtime files.`);

  const resolveJsonDbSourceResult = await runResolveJsonDbSource(paths);
  logInfo(
    `Step 5 complete: resolved JsonDbApp source files (${resolveJsonDbSourceResult.sourceFiles.length}): ${resolveJsonDbSourceResult.sourceFiles.join(', ')}`
  );

  const jsonDbInlineNamespaceResult = await runJsonDbInlineNamespace(paths);
  logInfo(
    `Step 6 complete: generated ${jsonDbInlineNamespaceResult.outputPath} with namespace ${jsonDbInlineNamespaceResult.namespaceSymbol} and exports: ${jsonDbInlineNamespaceResult.exportedApi.join(', ')}`
  );

  const mergeManifestResult = await runMergeManifest(paths);
  logInfo(
    `Step 7 complete: merged manifest written to ${mergeManifestResult.outputPath} with ${mergeManifestResult.mergedScopeCount} scopes and ${mergeManifestResult.mergedServiceCount} enabled advanced services.`
  );

  const materialiseOutputResult = await runMaterialiseOutput(paths);
  logInfo(
    `Step 8 complete: materialised ${materialiseOutputResult.fileCount} files in ${materialiseOutputResult.gasRootPath} (${materialiseOutputResult.totalBytes} bytes).`
  );

  const validateOutputResult = await runValidateOutput(paths);
  logInfo(
    `Step 9 complete: validated ${validateOutputResult.outputPath} with ${validateOutputResult.requiredFileCount} required artefacts (${validateOutputResult.gasFileCount} total files).`
  );
  logInfo(
    `Build summary: appsscript.json=${validateOutputResult.artefactSizes['appsscript.json']} bytes, JsonDbApp.inlined.js=${validateOutputResult.artefactSizes['JsonDbApp.inlined.js']} bytes, UI/ReactApp.html=${validateOutputResult.artefactSizes['UI/ReactApp.html']} bytes.`
  );
  logInfo(
    `Determinism checksums: appsscript.json=${validateOutputResult.artefactChecksums['appsscript.json']}, JsonDbApp.inlined.js=${validateOutputResult.artefactChecksums['JsonDbApp.inlined.js']}, UI/ReactApp.html=${validateOutputResult.artefactChecksums['UI/ReactApp.html']}.`
  );
}

run().catch((err) => {
  logBuildFailure(err);
  process.exitCode = 1;
});
