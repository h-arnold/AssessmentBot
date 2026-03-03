import { resolveBuilderPaths } from './config.js';
import { logBuildFailure, logInfo } from './lib/process.js';
import { runPreflightClean } from './steps/preflight-clean.js';

const run = async (): Promise<void> => {
  const paths = await resolveBuilderPaths();
  await runPreflightClean(paths);
  logInfo('Step 1 complete: preflight checks passed and build directories prepared.');
};

run().catch((err) => {
  logBuildFailure(err);
  process.exitCode = 1;
});
