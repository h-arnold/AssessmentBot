import { afterEach, describe, expect, it, vi } from 'vitest';

type StepMocks = {
  parseCliOptions: ReturnType<typeof vi.fn>;
  resolveBuilderPaths: ReturnType<typeof vi.fn>;
  runPreflightClean: ReturnType<typeof vi.fn>;
  runFrontendInstallDeps: ReturnType<typeof vi.fn>;
  runFrontendBuildWithMode: ReturnType<typeof vi.fn>;
  runFrontendHtmlServiceTransform: ReturnType<typeof vi.fn>;
  runBackendCopy: ReturnType<typeof vi.fn>;
  runResolveJsonDbSource: ReturnType<typeof vi.fn>;
  runJsonDbInlineNamespace: ReturnType<typeof vi.fn>;
  runMergeManifest: ReturnType<typeof vi.fn>;
  runMaterialiseOutput: ReturnType<typeof vi.fn>;
  runValidateOutput: ReturnType<typeof vi.fn>;
  logInfo: ReturnType<typeof vi.fn>;
  logBuildFailure: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

/**
 * Imports the builder entrypoint with mocked step modules for branch-focused tests.
 *
 * @param {object} [overrides] - Optional behaviour overrides for mocked steps.
 * @param {{ installed: boolean }} [overrides.installDepsResult] - Optional install-step result.
 * @param {boolean} overrides.installDepsResult.installed - Whether dependency install was required.
 * @param {Error} [overrides.resolvePathsFailure] - Optional error thrown by path resolution.
 * @returns {Promise<StepMocks>} Resolved mock handles for assertions.
 */
async function importEntrypointWithMocks(overrides?: {
  installDepsResult?: { installed: boolean };
  resolvePathsFailure?: Error;
}): Promise<StepMocks> {
  const logInfo = vi.fn();
  const logBuildFailure = vi.fn();
  const parseCliOptions = vi.fn(() => ({ frontendMode: 'production' }));
  const resolveBuilderPaths = overrides?.resolvePathsFailure
    ? vi.fn(async () => {
        throw overrides.resolvePathsFailure;
      })
    : vi.fn(async () => ({ repoRoot: '/repo' }));
  const runPreflightClean = vi.fn(async () => {});
  const runFrontendInstallDeps = vi.fn(
    async () => overrides?.installDepsResult ?? { installed: true }
  );
  const runFrontendBuildWithMode = vi.fn(async () => ({ entryHtmlPath: '/repo/build/index.html' }));
  const runFrontendHtmlServiceTransform = vi.fn(async () => ({
    reactAppPath: '/repo/build/ReactApp.html',
  }));
  const runBackendCopy = vi.fn(async () => ({ copiedFiles: ['Code.js'] }));
  const runResolveJsonDbSource = vi.fn(async () => ({ sourceFiles: ['JsonDbApp.js'] }));
  const runJsonDbInlineNamespace = vi.fn(async () => ({
    outputPath: '/repo/build/JsonDbApp.inlined.js',
    namespaceSymbol: 'JsonDbApp',
    exportedApi: ['create'],
  }));
  const runMergeManifest = vi.fn(async () => ({
    outputPath: '/repo/build/appsscript.json',
    mergedScopeCount: 2,
    mergedServiceCount: 1,
  }));
  const runMaterialiseOutput = vi.fn(async () => ({
    fileCount: 3,
    gasRootPath: '/repo/build/gas',
    totalBytes: 42,
  }));
  const runValidateOutput = vi.fn(async () => ({
    outputPath: '/repo/build/gas',
    requiredFileCount: 3,
    gasFileCount: 3,
    artefactSizes: {
      'appsscript.json': 10,
      'JsonDbApp.inlined.js': 20,
      'UI/ReactApp.html': 30,
    },
    artefactChecksums: {
      'appsscript.json': 'a',
      'JsonDbApp.inlined.js': 'b',
      'UI/ReactApp.html': 'c',
    },
  }));

  vi.doMock('./lib/process.js', () => ({ logInfo, logBuildFailure }));
  vi.doMock('./lib/cli-options.js', () => ({ parseCliOptions }));
  vi.doMock('./config.js', () => ({ resolveBuilderPaths }));
  vi.doMock('./steps/preflight-clean.js', () => ({ runPreflightClean }));
  vi.doMock('./steps/frontend-install-deps.js', () => ({ runFrontendInstallDeps }));
  vi.doMock('./steps/frontend-build.js', () => ({ runFrontendBuildWithMode }));
  vi.doMock('./steps/frontend-htmlservice-transform.js', () => ({
    runFrontendHtmlServiceTransform,
  }));
  vi.doMock('./steps/backend-copy.js', () => ({ runBackendCopy }));
  vi.doMock('./steps/resolve-jsondb-source.js', () => ({ runResolveJsonDbSource }));
  vi.doMock('./steps/jsondb-inline-namespace.js', () => ({ runJsonDbInlineNamespace }));
  vi.doMock('./steps/merge-manifest.js', () => ({ runMergeManifest }));
  vi.doMock('./steps/materialise-output.js', () => ({ runMaterialiseOutput }));
  vi.doMock('./steps/validate-output.js', () => ({ runValidateOutput }));

  await import('./build-gas-bundle.js');
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    parseCliOptions,
    resolveBuilderPaths,
    runPreflightClean,
    runFrontendInstallDeps,
    runFrontendBuildWithMode,
    runFrontendHtmlServiceTransform,
    runBackendCopy,
    runResolveJsonDbSource,
    runJsonDbInlineNamespace,
    runMergeManifest,
    runMaterialiseOutput,
    runValidateOutput,
    logInfo,
    logBuildFailure,
  };
}

describe('build-gas-bundle entrypoint', () => {
  it('runs all steps and logs dependency installation when npm ci is required', async () => {
    const mocks = await importEntrypointWithMocks({ installDepsResult: { installed: true } });

    expect(mocks.parseCliOptions).toHaveBeenCalled();
    expect(mocks.resolveBuilderPaths).toHaveBeenCalled();
    expect(mocks.runValidateOutput).toHaveBeenCalled();
    expect(mocks.logInfo).toHaveBeenCalledWith(
      expect.stringContaining(
        'frontend dependencies were missing and have been installed with npm ci'
      )
    );
  });

  it('logs dependency check messaging when install step is not required', async () => {
    const mocks = await importEntrypointWithMocks({ installDepsResult: { installed: false } });

    expect(mocks.runFrontendInstallDeps).toHaveBeenCalled();
    expect(mocks.logInfo).toHaveBeenCalledWith(
      expect.stringContaining('frontend dependency check passed')
    );
  });

  it('logs build failures and sets a non-zero process exit code', async () => {
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    const failure = new Error('preflight failed');
    const mocks = await importEntrypointWithMocks({ resolvePathsFailure: failure });

    expect(mocks.logBuildFailure).toHaveBeenCalledWith(failure);
    expect(process.exitCode).toBe(1);

    process.exitCode = originalExitCode;
  });
});
