import { BuildStageError } from '../lib/errors.js';
import { CommandExecutionError, runCommand } from '../lib/process.js';
import type { BuilderPaths, FrontendInstallDependenciesResult } from '../types.js';

const STAGE_ID = 'frontend-install-deps' as const;

/**
 * Ensures frontend dependencies are present for the build pipeline.
 *
 * @param {BuilderPaths} paths - Resolved builder filesystem paths.
 * @returns {Promise<FrontendInstallDependenciesResult>} Dependency verification outcome.
 */
export async function runFrontendInstallDeps(
  paths: BuilderPaths
): Promise<FrontendInstallDependenciesResult> {
  const verifyArgs: string[] = ['--prefix', paths.frontendDir, 'ls', '--depth=0'];

  try {
    await runCommand('npm', verifyArgs, { cwd: paths.repoRoot });
    return {
      stage: STAGE_ID,
      installed: false,
    };
  } catch {
    const installArgs: string[] = [
      '--prefix',
      paths.frontendDir,
      'ci',
      '--no-audit',
      '--no-fund',
    ];

    try {
      await runCommand('npm', installArgs, { cwd: paths.repoRoot });
      return {
        stage: STAGE_ID,
        installed: true,
      };
    } catch (installErr) {
      if (installErr instanceof CommandExecutionError) {
        const diagnostics = JSON.stringify(installErr.diagnostics);
        throw new BuildStageError(
          STAGE_ID,
          `Frontend dependency install failed while running npm ci. Diagnostics: ${diagnostics}`,
          installErr
        );
      }
      throw new BuildStageError(
        STAGE_ID,
        'Frontend dependency install failed while running npm ci.',
        installErr
      );
    }
  }
}
