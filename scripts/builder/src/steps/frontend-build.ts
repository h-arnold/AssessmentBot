import path from 'node:path';

import { BuildStageError } from '../lib/errors.js';
import { CommandExecutionError, runCommand } from '../lib/process.js';
import type { BuilderPaths, FrontendBuildResult } from '../types.js';
import { pathExists } from '../lib/fs.js';

const FRONTEND_BUILD_STAGE = 'frontend-build';

/**
 * Runs the frontend Vite build with HtmlService-compatible options.
 *
 * @param {BuilderPaths} paths - Resolved builder filesystem paths.
 * @return {Promise<FrontendBuildResult>} Build output metadata.
 */
export async function runFrontendBuild(paths: BuilderPaths): Promise<FrontendBuildResult> {
  const entryHtmlPath = path.join(paths.buildFrontendDir, 'index.html');
  const commandArgs = [
    '--prefix',
    paths.frontendDir,
    'run',
    'build',
    '--',
    '--base=./',
    '--outDir',
    paths.buildFrontendDir,
    '--emptyOutDir',
    '--cssCodeSplit=false',
    '--modulePreload=false',
  ];

  let commandOutput: { stdout: string; stderr: string };
  try {
    commandOutput = await runCommand('npm', commandArgs, {
      cwd: paths.repoRoot,
      env: process.env,
    });
  } catch (err) {
    if (err instanceof CommandExecutionError) {
      const diagnostics = JSON.stringify(err.diagnostics);
      throw new BuildStageError(
        FRONTEND_BUILD_STAGE,
        `Frontend build failed while running Vite build command. Diagnostics: ${diagnostics}`,
        err,
      );
    }
    throw new BuildStageError(
      FRONTEND_BUILD_STAGE,
      'Frontend build failed while running Vite build command.',
      err,
    );
  }

  const hasEntryHtml = await pathExists(entryHtmlPath);
  if (!hasEntryHtml) {
    throw new BuildStageError(
      FRONTEND_BUILD_STAGE,
      `Frontend build did not generate entry HTML: ${entryHtmlPath}. stdout: ${commandOutput.stdout.trim()} stderr: ${commandOutput.stderr.trim()}`,
    );
  }

  const combinedOutput = `${commandOutput.stdout}\n${commandOutput.stderr}`;
  const generatedChunks = combinedOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => line.includes('build/frontend/') || line.includes('build\\frontend\\'));

  const warnings = combinedOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^warning/i.test(line));

  return {
    stage: FRONTEND_BUILD_STAGE,
    entryHtmlPath,
    generatedChunks,
    warnings,
  };
}
