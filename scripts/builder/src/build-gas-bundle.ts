import { resolveBuilderPaths } from './config.js';
import { logBuildFailure, logInfo } from './lib/process.js';
import { runBackendCopy } from './steps/backend-copy.js';
import { runFrontendBuild } from './steps/frontend-build.js';
import { runFrontendHtmlServiceTransform } from './steps/frontend-htmlservice-transform.js';
import { runPreflightClean } from './steps/preflight-clean.js';

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
}

run().catch((err) => {
  logBuildFailure(err);
  process.exitCode = 1;
});
