import path from 'node:path';
import { promises as fs } from 'node:fs';

import { afterEach } from 'vitest';

type SessionIdSource = 'arg' | 'git-branch';
type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';
type StorageMode = 'baseline' | 'compare';

export type SessionManifest = {
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: SessionIdSource;
  mode: StorageMode;
  createdAt: string;
  baselineCreatedThisRun: boolean;
  configFingerprint: string;
  checks: Array<{
    id: string;
    tool: RegressionTool;
    cwd: string;
    executionMetadata: Record<string, string | number | boolean | null>;
    rawArtefactPath: string;
    derivedSummaryPath: string;
  }>;
};

export type RegressionConfig = {
  reportDirectory: string;
  parallel: {
    enabled: boolean;
    maxWorkers: number;
  };
  checks: Array<{
    id: string;
    tool: RegressionTool;
    cwd: string;
    timeoutMs?: number;
    reporterMode?: string;
    run: { kind: 'npm-script'; script: string } | { kind: 'tsc'; project: string };
  }>;
};

export type ScheduledCheckResult = {
  id: string;
  tool: RegressionTool;
  rawArtefactPath: string;
  status: 'passing' | 'failing' | 'execution-error';
  exitCode: number | null;
  error: { code: string; message: string } | null;
};

export type ComparisonResult = {
  overallStatus: 'GREEN' | 'FAILING' | 'BASELINE-INCOMPATIBLE';
  baselineCompatibility:
    | { compatible: true }
    | { compatible: false; reason: { code: string; message: string } };
  checks: Array<{
    id: string;
    tool: RegressionTool;
    status: 'passing' | 'failing' | 'execution-error' | 'baseline-incompatible';
    baselineSummary: unknown;
    currentSummary: unknown;
    regressions: string[];
    newFailures: string[];
    fixes: string[];
    executionError: { code: string; message: string } | null;
    baselineIncompatibility: { code: string; message: string } | null;
  }>;
  totals: {
    regressionsCount: number;
    newFailuresCount: number;
    fixesCount: number;
    checksPassing: number;
    checksFailing: number;
  };
};

export type RegressionCliModule = {
  createSessionManifestChecks: (
    config: RegressionConfig,
    createdAt: string,
    mode: StorageMode
  ) => SessionManifest['checks'];
  getRawFileName: (tool: RegressionTool) => 'raw.json' | 'raw.txt';
  renderBaselineReport: (options: {
    sessionId: string;
    sessionStorageKey: string;
    sessionIdSource: SessionIdSource;
    createdAt: string;
    checks: ScheduledCheckResult[];
    readRawArtefact: (rawArtefactPath: string) => Promise<unknown>;
  }) => Promise<string>;
  renderComparisonReport: (options: {
    sessionId: string;
    sessionStorageKey: string;
    sessionIdSource: SessionIdSource;
    baselineTimestamp: string;
    currentTimestamp: string;
    comparison: ComparisonResult;
  }) => string;
  persistCapturedArtefact: (options: {
    tool: RegressionTool;
    rawArtefactPath: string;
    commandOutput: { stdout: string; stderr: string };
  }) => Promise<void>;
  resolveSessionArtefactPath: (sessionDirectory: string, relativeArtefactPath: string) => string;
  loadDefaultRegressionCheckerConfig: (repoRoot: string) => Promise<unknown>;
  writeFileToDisk: (targetPath: string, content: string) => Promise<void>;
  extractCurrentFailures: (summary: Record<string, unknown>) => string[];
  runChecksFromConfig: (options: {
    config: RegressionConfig;
    repoRoot: string;
    rawArtefactDirectory: string;
    runCommandImpl: (
      command: string,
      args: string[],
      options: {
        cwd: string;
        env?: NodeJS.ProcessEnv;
        timeoutMs?: number;
        streamOutput?: boolean;
      }
    ) => Promise<{ stdout: string; stderr: string }>;
  }) => Promise<ScheduledCheckResult[]>;
  runRegressionCheckerCli: (options: {
    positionalSessionId?: string;
    repoRoot: string;
    createdAt: string;
    logicalCpuCount: number;
    loadRawConfig: () => Promise<unknown>;
    packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
    resolveGitBranchName: () => Promise<string>;
    computeConfigFingerprint?: (config: RegressionConfig) => string;
    prepareSessionStorage: (options: {
      repoRoot: string;
      reportDirectory: string;
      sessionId: string;
      sessionIdSource: SessionIdSource;
      createdAt: string;
      configFingerprint: string;
      checks: SessionManifest['checks'];
    }) => Promise<{
      mode: StorageMode;
      sessionStorageKey: string;
      sessionDirectory: string;
      baselineDirectory: string;
      baselineManifestPath: string;
      currentRunDirectory: string | null;
      currentManifestPath: string;
      manifest: SessionManifest;
    }>;
    readBaselineManifest?: (baselineManifestPath: string) => Promise<SessionManifest>;
    evaluateBaselineCompatibility?: (options: {
      baselineManifest: SessionManifest;
      currentConfigFingerprint: string;
      currentChecks: Array<{
        id: string;
        tool: RegressionTool;
        executionMetadata: Record<string, string | number | boolean | null>;
      }>;
    }) => { compatible: true } | { compatible: false; reason: { code: string; message: string } };
    runChecks?: (options: {
      config: RegressionConfig;
      rawArtefactDirectory: string;
    }) => Promise<ScheduledCheckResult[]>;
    compareRegressionChecks?: (options: {
      checksInConfigOrder: Array<{
        baseline: ScheduledCheckResult & { rawArtefact: unknown };
        current: ScheduledCheckResult & { rawArtefact: unknown };
      }>;
      baselineCompatibility:
        | { compatible: true }
        | { compatible: false; reason: { code: string; message: string } };
    }) => ComparisonResult;
    readRawArtefact?: (rawArtefactPath: string) => Promise<unknown>;
    writeFile?: (targetPath: string, content: string) => Promise<void>;
    runCommand?: (
      command: string,
      args: string[],
      options: {
        cwd: string;
        env?: NodeJS.ProcessEnv;
        timeoutMs?: number;
        streamOutput?: boolean;
      }
    ) => Promise<{ stdout: string; stderr: string }>;
  }) => Promise<{
    exitCode: number;
    outputText: string;
    mode: StorageMode;
  }>;
};

export const CREATED_AT = '2026-05-13T05:00:00.000Z';
export const REPORT_DIRECTORY = '.ts-regression-checker/reports';
export const SESSION_ID = 'feature/regression-checker';
export const SESSION_STORAGE_KEY = 'session-feature-regression-checker';
export const REPO_ROOT = '/repo';
export const LINT_SCRIPT_NAME = 'lint:builder:check';
export const LINT_SCRIPT_COMMAND =
  'eslint --config scripts/builder/eslint.config.js scripts/builder/src/**/*.ts';
export const COMPARE_HEADER_LINE_COUNT = 14;
export const INVALID_CONFIG_EXIT_CODE = 2;
export const TSC_FAILURE_EXIT_CODE = 2;
export const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    })
  );
});

/**
 * Loads the regression-checker CLI module under test.
 *
 * @returns {Promise<RegressionCliModule>} Loaded module contract.
 */
export async function loadCliModule(): Promise<RegressionCliModule> {
  try {
    return (await import('../index.js')) as RegressionCliModule;
  } catch (error) {
    throw new Error(
      'Section 5 requires ./index.js to export runRegressionCheckerCli for CLI orchestration and report writing.',
      { cause: error }
    );
  }
}

/**
 * Builds a minimal valid regression-checker config fixture.
 *
 * @returns {RegressionConfig} Default config used by CLI tests.
 */
export function createConfig(): RegressionConfig {
  return {
    reportDirectory: REPORT_DIRECTORY,
    parallel: {
      enabled: true,
      maxWorkers: 2,
    },
    checks: [
      {
        id: 'builder-lint',
        tool: 'eslint',
        cwd: '.',
        run: {
          kind: 'npm-script',
          script: 'lint:builder:check',
        },
      },
    ],
  };
}

/**
 * Builds package.json scripts map used across CLI tests.
 *
 * @returns {Record<string, Record<string, string>>} Scripts map keyed by repo-relative directory.
 */
export function createPackageScriptMap(): Record<string, Record<string, string>> {
  return {
    '.': {
      [LINT_SCRIPT_NAME]: LINT_SCRIPT_COMMAND,
    },
  };
}

/**
 * Builds a baseline or compare manifest fixture for orchestration tests.
 *
 * @param {StorageMode} mode - Manifest mode.
 * @returns {SessionManifest} Manifest fixture matching the selected mode.
 */
export function createManifest(mode: StorageMode): SessionManifest {
  return {
    sessionId: SESSION_ID,
    sessionStorageKey: SESSION_STORAGE_KEY,
    sessionIdSource: 'arg',
    mode,
    createdAt: CREATED_AT,
    baselineCreatedThisRun: mode === 'baseline',
    configFingerprint: 'config-fingerprint-v1',
    checks: [
      {
        id: 'builder-lint',
        tool: 'eslint',
        cwd: '.',
        executionMetadata: {
          reporterMode: 'json',
        },
        rawArtefactPath:
          mode === 'baseline'
            ? 'baseline/checks/builder-lint/raw.json'
            : 'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/raw.json',
        derivedSummaryPath:
          mode === 'baseline'
            ? 'baseline/checks/builder-lint/derived.json'
            : 'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/derived.json',
      },
    ],
  };
}

/**
 * Builds a canonical storage response fixture for baseline/compare mode.
 *
 * @param {StorageMode} mode - Storage mode.
 * @returns {Awaited<Parameters<RegressionCliModule['runRegressionCheckerCli']>[0]['prepareSessionStorage']>} Storage fixture payload.
 */
export function createStorageResult(mode: StorageMode) {
  const sessionDirectory =
    '/repo/.ts-regression-checker/reports/session-feature-regression-checker';
  const baselineDirectory = `${sessionDirectory}/baseline`;
  const baselineManifestPath = `${baselineDirectory}/manifest.json`;
  const currentRunDirectory =
    mode === 'compare' ? `${sessionDirectory}/runs/2026-05-13T05-00-00.000Z` : null;
  const currentManifestPath =
    mode === 'compare' ? `${currentRunDirectory}/manifest.json` : `${baselineManifestPath}`;

  return {
    mode,
    sessionStorageKey: SESSION_STORAGE_KEY,
    sessionDirectory,
    baselineDirectory,
    baselineManifestPath,
    currentRunDirectory,
    currentManifestPath,
    manifest: createManifest(mode),
  };
}

/**
 * Runs `runChecksFromConfig` with a canonical single-check builder-lint config fixture.
 *
 * @param {RegressionCliModule['runChecksFromConfig']} runChecksFromConfig - CLI module runner.
 * @param {string} tempRoot - Temporary repository root for the test.
 * @param {Parameters<RegressionCliModule['runChecksFromConfig']>[0]['runCommandImpl']} runCommandImpl
 * Command runner implementation for the scenario.
 * @returns {Promise<ScheduledCheckResult[]>} Normalised scheduled check results.
 */
export async function runSingleBuilderLintCheck(
  runChecksFromConfig: RegressionCliModule['runChecksFromConfig'],
  tempRoot: string,
  runCommandImpl: Parameters<RegressionCliModule['runChecksFromConfig']>[0]['runCommandImpl']
): Promise<ScheduledCheckResult[]> {
  return runChecksFromConfig({
    repoRoot: tempRoot,
    rawArtefactDirectory: path.join(tempRoot, 'reports', 'run'),
    config: createConfig(),
    runCommandImpl,
  });
}
