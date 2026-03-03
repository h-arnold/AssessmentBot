import { resolveBuilderPaths } from './config.js';
import { logBuildFailure, logInfo } from './lib/process.js';
import { runBackendCopy } from './steps/backend-copy.js';
import { runFrontendBuild } from './steps/frontend-build.js';
import { runFrontendHtmlServiceTransform } from './steps/frontend-htmlservice-transform.js';
import { runJsonDbInlineNamespace } from './steps/jsondb-inline-namespace.js';
import { runMergeManifest } from './steps/merge-manifest.js';
import { runPreflightClean } from './steps/preflight-clean.js';
import { runResolveJsonDbSource } from './steps/resolve-jsondb-source.js';

/**
 * Runs the builder pipeline entrypoint.
 *
 * @return {Promise<void>} Resolves when the configured build steps complete.
 */
async function run(): Promise<void> {
  const paths = await resolveBuilderPaths();
  await runPreflightClean(paths);
  logInfo('Step 1 complete: preflight checks passed and build directories prepared.');

  const frontendBuildResult = await runFrontendBuild(paths);
  logInfo(`Step 2 complete: frontend build generated entry HTML at ${frontendBuildResult.entryHtmlPath}`);

  const htmlServiceTransformResult = await runFrontendHtmlServiceTransform(paths);
  logInfo(
    `Step 3 complete: HtmlService ReactApp generated at ${htmlServiceTransformResult.reactAppPath}`,
  );

  const backendCopyResult = await runBackendCopy(paths);
  logInfo(`Step 4 complete: copied ${backendCopyResult.copiedFiles.length} backend runtime files.`);

  const resolveJsonDbSourceResult = await runResolveJsonDbSource(paths);
  logInfo(
    `Step 5 complete: resolved JsonDbApp source files (${resolveJsonDbSourceResult.sourceFiles.length}): ${resolveJsonDbSourceResult.sourceFiles.join(', ')}`,
  );

  const jsonDbInlineNamespaceResult = await runJsonDbInlineNamespace(paths);
  logInfo(
    `Step 6 complete: generated ${jsonDbInlineNamespaceResult.outputPath} with namespace ${jsonDbInlineNamespaceResult.namespaceSymbol} and exports: ${jsonDbInlineNamespaceResult.exportedApi.join(', ')}`,
  );

  const mergeManifestResult = await runMergeManifest(paths);
  logInfo(
    `Step 7 complete: merged manifest written to ${mergeManifestResult.outputPath} with ${mergeManifestResult.mergedScopeCount} scopes and ${mergeManifestResult.mergedServiceCount} enabled advanced services.`,
  );
}

run().catch((err) => {
  logBuildFailure(err);
  process.exitCode = 1;
});
