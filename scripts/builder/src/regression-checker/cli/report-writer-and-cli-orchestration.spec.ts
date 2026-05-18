import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { afterEach, describe, expect, it, test } from 'vitest';

import { CommandExecutionError } from '../../lib/process.js';

type SessionIdSource = 'arg' | 'git-branch';
type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';
type StorageMode = 'baseline' | 'compare';

type SessionManifest = {
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

type RegressionConfig = {
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

type ScheduledCheckResult = {
  id: string;
  tool: RegressionTool;
  rawArtefactPath: string;
  status: 'passing' | 'failing' | 'execution-error';
  exitCode: number | null;
  error: { code: string; message: string } | null;
};

type ComparisonResult = {
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

type RegressionCliModule = {
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

const CREATED_AT = '2026-05-13T05:00:00.000Z';
const REPORT_DIRECTORY = '.ts-regression-checker/reports';
const SESSION_ID = 'feature/regression-checker';
const SESSION_STORAGE_KEY = 'session-feature-regression-checker';
const REPO_ROOT = '/repo';
const LINT_SCRIPT_NAME = 'lint:builder:check';
const LINT_SCRIPT_COMMAND =
  'eslint --config scripts/builder/eslint.config.js scripts/builder/src/**/*.ts';
const COMPARE_HEADER_LINE_COUNT = 14;
const INVALID_CONFIG_EXIT_CODE = 2;
const TSC_FAILURE_EXIT_CODE = 2;
const tempDirectories: string[] = [];

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
async function loadCliModule(): Promise<RegressionCliModule> {
  try {
    return (await import('./index.js')) as RegressionCliModule;
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
function createConfig(): RegressionConfig {
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
function createPackageScriptMap(): Record<string, Record<string, string>> {
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
function createManifest(mode: StorageMode): SessionManifest {
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
function createStorageResult(mode: StorageMode) {
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
async function runSingleBuilderLintCheck(
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

describe('report writer and CLI orchestration', () => {
  it('returns baseline-mode output with explicit baseline-created messaging and zero exit code', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const writes: Array<{ targetPath: string; content: string }> = [];
    let receivedManifestChecks: SessionManifest['checks'] = [];

    const result = await runRegressionCheckerCli({
      positionalSessionId: SESSION_ID,
      repoRoot: REPO_ROOT,
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => createConfig(),
      packageJsonScriptsByDirectory: createPackageScriptMap(),
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async ({ checks }) => {
        receivedManifestChecks = checks;
        return createStorageResult('baseline');
      },
      runChecks: async () => [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      writeFile: async (targetPath, content) => {
        writes.push({ targetPath, content });
      },
    });

    expect(result.mode).toBe('baseline');
    expect(result.exitCode).toBe(0);
    expect(result.outputText).toContain('=== REGRESSION HEADER START ===');
    expect(result.outputText).toContain('Baseline Created This Run: true');
    expect(result.outputText).toContain('Baseline Timestamp: N/A');
    expect(result.outputText).toContain('builder-lint: passing');
    expect(result.outputText).toContain('--- PER-COMMAND SUMMARY ---');
    expect(receivedManifestChecks).toEqual([
      expect.objectContaining({
        rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
        derivedSummaryPath: 'baseline/checks/builder-lint/derived.json',
      }),
    ]);
    expect(writes).toEqual([
      {
        targetPath:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/baseline/baseline.txt',
        content: expect.stringContaining('=== REGRESSION HEADER START ==='),
      },
    ]);
  });

  it('writes compare artefacts and returns exit code 1 when regressions are detected', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const writes: Array<{ targetPath: string; content: string }> = [];

    const result = await runRegressionCheckerCli({
      positionalSessionId: SESSION_ID,
      repoRoot: REPO_ROOT,
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => createConfig(),
      packageJsonScriptsByDirectory: createPackageScriptMap(),
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => createStorageResult('compare'),
      readBaselineManifest: async () => createManifest('baseline'),
      runChecks: async () => [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
      ],
      compareRegressionChecks: () => ({
        overallStatus: 'FAILING',
        baselineCompatibility: { compatible: true },
        checks: [
          {
            id: 'builder-lint',
            tool: 'eslint',
            status: 'failing',
            baselineSummary: { kind: 'eslint', counts: { errors: 0, warnings: 0 } },
            currentSummary: { kind: 'eslint', counts: { errors: 1, warnings: 0 } },
            regressions: ['no-alert|src/example.ts|1|1|Unexpected alert.'],
            newFailures: ['no-alert|src/example.ts|1|1|Unexpected alert.'],
            fixes: [],
            executionError: null,
            baselineIncompatibility: null,
          },
        ],
        totals: {
          regressionsCount: 1,
          newFailuresCount: 1,
          fixesCount: 0,
          checksPassing: 0,
          checksFailing: 1,
        },
      }),
      readRawArtefact: async (rawArtefactPath) =>
        rawArtefactPath.includes('/baseline/')
          ? []
          : [
              {
                filePath: 'src/example.ts',
                messages: [
                  {
                    ruleId: 'no-alert',
                    severity: 2,
                    message: 'Unexpected alert.',
                    line: 1,
                    column: 1,
                  },
                ],
              },
            ],
      writeFile: async (targetPath, content) => {
        writes.push({ targetPath, content });
      },
    });

    expect(result.mode).toBe('compare');
    expect(result.exitCode).toBe(1);
    expect(result.outputText).toContain('Overall Status: FAILING');
    expect(writes.map((entry) => entry.targetPath)).toEqual([
      '/repo/.ts-regression-checker/reports/session-feature-regression-checker/runs/2026-05-13T05-00-00.000Z/comparison.json',
      '/repo/.ts-regression-checker/reports/session-feature-regression-checker/runs/2026-05-13T05-00-00.000Z/comparison.txt',
    ]);
  });

  it('returns exit code 0 for compare mode without regressions and preserves header field order', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();

    const result = await runRegressionCheckerCli({
      positionalSessionId: SESSION_ID,
      repoRoot: REPO_ROOT,
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => createConfig(),
      packageJsonScriptsByDirectory: createPackageScriptMap(),
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => createStorageResult('compare'),
      readBaselineManifest: async () => createManifest('baseline'),
      runChecks: async () => [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      compareRegressionChecks: () => ({
        overallStatus: 'GREEN',
        baselineCompatibility: { compatible: true },
        checks: [
          {
            id: 'builder-lint',
            tool: 'eslint',
            status: 'passing',
            baselineSummary: { kind: 'eslint', counts: { errors: 0, warnings: 0 } },
            currentSummary: { kind: 'eslint', counts: { errors: 0, warnings: 0 } },
            regressions: [],
            newFailures: [],
            fixes: [],
            executionError: null,
            baselineIncompatibility: null,
          },
        ],
        totals: {
          regressionsCount: 0,
          newFailuresCount: 0,
          fixesCount: 0,
          checksPassing: 1,
          checksFailing: 0,
        },
      }),
      readRawArtefact: async () => [],
      writeFile: async () => {},
    });

    expect(result.exitCode).toBe(0);

    const headerLines = result.outputText
      .split('\n')
      .filter((line) => line.includes(': '))
      .slice(0, COMPARE_HEADER_LINE_COUNT);
    expect(headerLines).toEqual([
      'Session ID: feature/regression-checker',
      'Session Storage Key: session-feature-regression-checker',
      'Session ID Source: arg',
      'Mode: compare',
      'Baseline Created This Run: false',
      'Baseline Timestamp: 2026-05-13T05:00:00.000Z',
      'Current Timestamp: 2026-05-13T05:00:00.000Z',
      'Overall Status: GREEN',
      'Total Checks: 1',
      'Checks Passing: 1',
      'Checks Failing: 0',
      'Regressions Count: 0',
      'New Failures Count: 0',
      'Fixes Count: 0',
    ]);
  });

  it('returns a non-zero exit code for invalid config before any runner work starts', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    let runChecksCalled = false;

    const result = await runRegressionCheckerCli({
      positionalSessionId: 'feature/regression-checker',
      repoRoot: '/repo',
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => {
        throw new Error('Regression config is invalid: checks must not be empty.');
      },
      packageJsonScriptsByDirectory: {},
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => {
        throw new Error('prepareSessionStorage should not run for invalid config.');
      },
      runChecks: async () => {
        runChecksCalled = true;
        return [];
      },
      writeFile: async () => {},
    });

    expect(result.exitCode).toBe(INVALID_CONFIG_EXIT_CODE);
    expect(result.outputText).toContain('Regression config is invalid');
    expect(runChecksCalled).toBe(false);
  });

  it('resolves compare artefact reads against the session directory for baseline and current manifests', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const rawArtefactReads: string[] = [];
    const sessionDirectory =
      '/repo/.ts-regression-checker/reports/session-feature-regression-checker';

    await runRegressionCheckerCli({
      positionalSessionId: 'feature/regression-checker',
      repoRoot: '/repo',
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => createConfig(),
      packageJsonScriptsByDirectory: {
        '.': {
          'lint:builder:check':
            'eslint --config scripts/builder/eslint.config.js scripts/builder/src/**/*.ts',
        },
      },
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => ({
        mode: 'compare',
        sessionStorageKey: 'session-feature-regression-checker',
        sessionDirectory,
        baselineDirectory: path.join(sessionDirectory, 'baseline'),
        baselineManifestPath: path.join(sessionDirectory, 'baseline', 'manifest.json'),
        currentRunDirectory: path.join(sessionDirectory, 'runs', '2026-05-13T05-00-00.000Z'),
        currentManifestPath: path.join(
          sessionDirectory,
          'runs',
          '2026-05-13T05-00-00.000Z',
          'manifest.json'
        ),
        manifest: createManifest('compare'),
      }),
      readBaselineManifest: async () => createManifest('baseline'),
      runChecks: async () => [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: path.join(
            sessionDirectory,
            'runs',
            '2026-05-13T05-00-00.000Z',
            'checks',
            'builder-lint',
            'raw.json'
          ),
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      compareRegressionChecks: () => ({
        overallStatus: 'GREEN',
        baselineCompatibility: { compatible: true },
        checks: [],
        totals: {
          regressionsCount: 0,
          newFailuresCount: 0,
          fixesCount: 0,
          checksPassing: 1,
          checksFailing: 0,
        },
      }),
      readRawArtefact: async (rawArtefactPath) => {
        rawArtefactReads.push(rawArtefactPath);
        return [];
      },
      writeFile: async () => {},
    });

    expect(rawArtefactReads).toEqual([
      path.join(sessionDirectory, 'baseline', 'checks', 'builder-lint', 'raw.json'),
      path.join(
        sessionDirectory,
        'runs',
        '2026-05-13T05-00-00.000Z',
        'checks',
        'builder-lint',
        'raw.json'
      ),
    ]);
  });

  it('treats non-zero tsc exits as failing checks and persists diagnostics for comparison', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-section5-'));
    tempDirectories.push(tempRoot);
    const sessionDirectory = path.join(
      tempRoot,
      '.ts-regression-checker',
      'reports',
      'session-feature-regression-checker'
    );
    const currentRunDirectory = path.join(sessionDirectory, 'runs', '2026-05-13T05-00-00.000Z');
    const diagnosticText = "src/sample.ts(1,1): error TS1005: ';' expected.";
    const baselineRawArtefactPath = path.join(
      sessionDirectory,
      'baseline',
      'checks',
      'builder-compile',
      'raw.txt'
    );
    await fs.mkdir(path.dirname(baselineRawArtefactPath), { recursive: true });
    await fs.writeFile(baselineRawArtefactPath, '', 'utf8');

    const result = await runRegressionCheckerCli({
      positionalSessionId: 'feature/regression-checker',
      repoRoot: tempRoot,
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => ({
        reportDirectory: REPORT_DIRECTORY,
        parallel: { enabled: true, maxWorkers: 1 },
        checks: [
          {
            id: 'builder-compile',
            tool: 'tsc',
            cwd: '.',
            run: {
              kind: 'tsc',
              project: 'scripts/builder/tsconfig.json',
            },
          },
        ],
      }),
      packageJsonScriptsByDirectory: {},
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => ({
        mode: 'compare',
        sessionStorageKey: 'session-feature-regression-checker',
        sessionDirectory,
        baselineDirectory: path.join(sessionDirectory, 'baseline'),
        baselineManifestPath: path.join(sessionDirectory, 'baseline', 'manifest.json'),
        currentRunDirectory,
        currentManifestPath: path.join(currentRunDirectory, 'manifest.json'),
        manifest: {
          ...createManifest('compare'),
          checks: [
            {
              id: 'builder-compile',
              tool: 'tsc',
              cwd: '.',
              executionMetadata: { project: 'scripts/builder/tsconfig.json' },
              rawArtefactPath: 'runs/2026-05-13T05-00-00.000Z/checks/builder-compile/raw.txt',
              derivedSummaryPath:
                'runs/2026-05-13T05-00-00.000Z/checks/builder-compile/derived.json',
            },
          ],
        },
      }),
      readBaselineManifest: async () => ({
        ...createManifest('baseline'),
        checks: [
          {
            id: 'builder-compile',
            tool: 'tsc',
            cwd: '.',
            executionMetadata: { project: 'scripts/builder/tsconfig.json' },
            rawArtefactPath: 'baseline/checks/builder-compile/raw.txt',
            derivedSummaryPath: 'baseline/checks/builder-compile/derived.json',
          },
        ],
      }),
      runCommand: async () => {
        throw new CommandExecutionError('TypeScript compilation failed.', {
          command: 'tsc',
          args: ['-p', 'scripts/builder/tsconfig.json', '--pretty', 'false'],
          cwd: tempRoot,
          exitCode: 2,
          signal: null,
          stdout: diagnosticText,
          stderr: '',
          timedOut: false,
          timeoutMs: null,
        });
      },
      compareRegressionChecks: ({ checksInConfigOrder }) => {
        expect(checksInConfigOrder[0]?.current.status).toBe('failing');
        expect(checksInConfigOrder[0]?.current.exitCode).toBe(TSC_FAILURE_EXIT_CODE);
        expect(checksInConfigOrder[0]?.current.rawArtefact).toBe(diagnosticText);

        return {
          overallStatus: 'FAILING',
          baselineCompatibility: { compatible: true },
          checks: [],
          totals: {
            regressionsCount: 1,
            newFailuresCount: 1,
            fixesCount: 0,
            checksPassing: 0,
            checksFailing: 1,
          },
        };
      },
      writeFile: async () => {},
    });

    expect(result.exitCode).toBe(1);
    await expect(
      fs.readFile(path.join(currentRunDirectory, 'checks', 'builder-compile', 'raw.txt'), 'utf8')
    ).resolves.toBe(diagnosticText);
  });

  it('creates baseline and compare manifest paths with tool-specific raw artefact names', async () => {
    const { createSessionManifestChecks, getRawFileName } = await loadCliModule();

    const baselineChecks = createSessionManifestChecks(createConfig(), CREATED_AT, 'baseline');
    const compareChecks = createSessionManifestChecks(createConfig(), CREATED_AT, 'compare');

    expect(getRawFileName('eslint')).toBe('raw.json');
    expect(getRawFileName('tsc')).toBe('raw.txt');
    expect(baselineChecks[0]?.rawArtefactPath).toBe('baseline/checks/builder-lint/raw.json');
    expect(compareChecks[0]?.rawArtefactPath).toBe(
      'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/raw.json'
    );
  });

  it('renders compare reports with explicit per-check details and baseline-incompatible status', async () => {
    const { renderComparisonReport } = await loadCliModule();

    const report = renderComparisonReport({
      sessionId: 'feature/regression-checker',
      sessionStorageKey: 'session-feature-regression-checker',
      sessionIdSource: 'arg',
      baselineTimestamp: CREATED_AT,
      currentTimestamp: CREATED_AT,
      comparison: {
        overallStatus: 'BASELINE-INCOMPATIBLE',
        baselineCompatibility: {
          compatible: false,
          reason: {
            code: 'check-ids-mismatch',
            message: 'Mismatch.',
          },
        },
        checks: [
          {
            id: 'builder-lint',
            tool: 'eslint',
            status: 'baseline-incompatible',
            baselineSummary: {},
            currentSummary: {},
            regressions: [],
            newFailures: [],
            fixes: [],
            executionError: null,
            baselineIncompatibility: {
              code: 'check-ids-mismatch',
              message: 'Mismatch.',
            },
          },
        ],
        totals: {
          regressionsCount: 0,
          newFailuresCount: 0,
          fixesCount: 0,
          checksPassing: 0,
          checksFailing: 1,
        },
      },
    });

    expect(report).toContain('Overall Status: BASELINE-INCOMPATIBLE');
    expect(report).toContain('builder-lint: baseline-incompatible');
  });

  it('strips npm script banners from Playwright JSON artefacts before persisting them', async () => {
    const { persistCapturedArtefact, resolveSessionArtefactPath } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-playwright-'));
    tempDirectories.push(tempRoot);
    const rawArtefactPath = path.join(tempRoot, 'raw.json');

    await persistCapturedArtefact({
      tool: 'playwright',
      rawArtefactPath,
      commandOutput: {
        stdout: [
          '> AssessmentBot@1.0.0 test:frontend:e2e',
          '> npm --prefix src/frontend run test:e2e -- --reporter=json',
          '',
          '> frontend@0.0.0 test:e2e',
          '> playwright test --reporter=json',
          '',
          '{"status":"ok"}',
        ].join('\n'),
        stderr: 'browser warning: cached dependencies are stale',
      },
    });

    await expect(fs.readFile(rawArtefactPath, 'utf8')).resolves.toBe('{"status":"ok"}');
    expect(
      resolveSessionArtefactPath('/workspace/session-root', 'baseline/checks/example/raw.json')
    ).toBe(path.join('/workspace/session-root', 'baseline/checks/example/raw.json'));
    expect(() =>
      resolveSessionArtefactPath('/workspace/session-root', '../outside/raw.json')
    ).toThrow('Unsafe session artefact path escapes the session directory: ../outside/raw.json');
    expect(() =>
      resolveSessionArtefactPath('/workspace/session-root', '/outside/raw.json')
    ).toThrow('Unsafe session artefact path escapes the session directory: /outside/raw.json');
  });

  it('runs checks from config with repo-root-aware invocations and captures non-tsc failure exit codes', async () => {
    const { runChecksFromConfig } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-runchecks-'));
    tempDirectories.push(tempRoot);

    const results = await runChecksFromConfig({
      repoRoot: tempRoot,
      rawArtefactDirectory: path.join(tempRoot, 'reports', 'run'),
      config: {
        reportDirectory: REPORT_DIRECTORY,
        parallel: {
          enabled: true,
          maxWorkers: 1,
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
      },
      runCommandImpl: async () => {
        throw new CommandExecutionError('eslint failed', {
          command: 'npm',
          args: ['run', 'lint:builder:check'],
          cwd: tempRoot,
          exitCode: 1,
          signal: null,
          stdout: '',
          stderr: 'eslint failed',
          timedOut: false,
          timeoutMs: null,
        });
      },
    });

    expect(results).toEqual([
      {
        id: 'builder-lint',
        tool: 'eslint',
        rawArtefactPath: path.join(
          tempRoot,
          'reports',
          'run',
          'checks',
          'builder-lint',
          'raw.json'
        ),
        status: 'failing',
        exitCode: 1,
        error: null,
      },
    ]);
  });

  it('passes timeout and stream options through to command execution', async () => {
    const { runChecksFromConfig } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-timeout-options-'));
    tempDirectories.push(tempRoot);
    const runCommandCalls: Array<{ timeoutMs?: number; streamOutput?: boolean; cwd: string }> = [];

    const previousStreamFlag = process.env.REGRESSION_CHECKER_STREAM_OUTPUT;
    process.env.REGRESSION_CHECKER_STREAM_OUTPUT = 'true';

    try {
      const results = await runChecksFromConfig({
        repoRoot: tempRoot,
        rawArtefactDirectory: path.join(tempRoot, 'reports', 'run'),
        config: {
          reportDirectory: REPORT_DIRECTORY,
          parallel: { enabled: true, maxWorkers: 1 },
          checks: [
            {
              id: 'builder-lint',
              tool: 'eslint',
              cwd: '.',
              timeoutMs: 1234,
              run: { kind: 'npm-script', script: 'lint:builder:check' },
            },
          ],
        },
        runCommandImpl: async (_command, _args, commandOptions) => {
          runCommandCalls.push({
            timeoutMs: commandOptions.timeoutMs,
            streamOutput: commandOptions.streamOutput,
            cwd: commandOptions.cwd,
          });
          return {
            stdout: '',
            stderr: '',
          };
        },
      });

      expect(results[0]?.status).toBe('passing');
      expect(runCommandCalls).toEqual([
        {
          timeoutMs: 1234,
          streamOutput: true,
          cwd: tempRoot,
        },
      ]);
    } finally {
      if (previousStreamFlag === undefined) {
        delete process.env.REGRESSION_CHECKER_STREAM_OUTPUT;
      } else {
        process.env.REGRESSION_CHECKER_STREAM_OUTPUT = previousStreamFlag;
      }
    }
  });

  it('persists tsc diagnostics from stderr fallback and preserves eslint tool-written artefacts', async () => {
    const { persistCapturedArtefact } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-tsc-stderr-'));
    tempDirectories.push(tempRoot);

    const tscRawArtefactPath = path.join(tempRoot, 'checks', 'compile', 'raw.txt');
    const eslintRawArtefactPath = path.join(tempRoot, 'checks', 'lint', 'raw.json');
    const stderrDiagnostics = "src/failure.ts(4,2): error TS2304: Cannot find name 'missing'.";

    await persistCapturedArtefact({
      tool: 'tsc',
      rawArtefactPath: tscRawArtefactPath,
      commandOutput: { stdout: '   ', stderr: stderrDiagnostics },
    });

    // First, have eslint write its own file (simulating tool behavior)
    await fs.mkdir(path.dirname(eslintRawArtefactPath), { recursive: true });
    await fs.writeFile(eslintRawArtefactPath, '{"messages":[]}', 'utf8');

    // Now call persistCapturedArtefact - it should NOT overwrite the tool-written file
    await persistCapturedArtefact({
      tool: 'eslint',
      rawArtefactPath: eslintRawArtefactPath,
      commandOutput: { stdout: 'npm header', stderr: '' },
    });

    await expect(fs.readFile(tscRawArtefactPath, 'utf8')).resolves.toBe(stderrDiagnostics);
    // ESLint file should still have the tool-written content, not the captured stdout
    await expect(fs.readFile(eslintRawArtefactPath, 'utf8')).resolves.toBe('{"messages":[]}');
  });

  it('falls back to captured output when eslint tool does not write file', async () => {
    const { persistCapturedArtefact } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-eslint-fallback-'));
    tempDirectories.push(tempRoot);

    const eslintRawArtefactPath = path.join(tempRoot, 'checks', 'lint', 'raw.json');
    const errorMessage = 'ESLint configuration error';

    // Call persistCapturedArtefact without tool-written file - should write captured output
    await persistCapturedArtefact({
      tool: 'eslint',
      rawArtefactPath: eslintRawArtefactPath,
      commandOutput: { stdout: '', stderr: errorMessage },
    });

    // Should contain stderr error message
    await expect(fs.readFile(eslintRawArtefactPath, 'utf8')).resolves.toBe(errorMessage);
  });

  it('combines stdout and stderr when both are present and tool does not write file', async () => {
    const { persistCapturedArtefact } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-combined-'));
    tempDirectories.push(tempRoot);

    const eslintRawArtefactPath = path.join(tempRoot, 'checks', 'lint', 'raw.json');

    // Call persistCapturedArtefact with both stdout and stderr
    await persistCapturedArtefact({
      tool: 'eslint',
      rawArtefactPath: eslintRawArtefactPath,
      commandOutput: { stdout: 'npm header', stderr: 'Error: ESLint failed' },
    });

    // Should contain stderr first, then stdout
    await expect(fs.readFile(eslintRawArtefactPath, 'utf8')).resolves.toBe(
      'Error: ESLint failed\nnpm header'
    );
  });

  it('loads default config from disk and rethrows unexpected runner failures', async () => {
    const { loadDefaultRegressionCheckerConfig, runChecksFromConfig } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-default-config-'));
    tempDirectories.push(tempRoot);

    await fs.mkdir(path.join(tempRoot, '.ts-regression-checker'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, '.ts-regression-checker', 'regression.config.json'),
      JSON.stringify({ reportDirectory: '.ts-regression-checker/reports', checks: [] }),
      'utf8'
    );

    await expect(loadDefaultRegressionCheckerConfig(tempRoot)).resolves.toEqual({
      reportDirectory: '.ts-regression-checker/reports',
      checks: [],
    });

    const results = await runChecksFromConfig({
      repoRoot: tempRoot,
      rawArtefactDirectory: path.join(tempRoot, 'reports', 'run'),
      config: {
        reportDirectory: REPORT_DIRECTORY,
        parallel: { enabled: true, maxWorkers: 1 },
        checks: [
          {
            id: 'builder-lint',
            tool: 'eslint',
            cwd: '.',
            run: { kind: 'npm-script', script: 'lint:builder:check' },
          },
        ],
      },
      runCommandImpl: async () => {
        throw new Error('unexpected spawn failure');
      },
    });

    expect(results).toEqual([
      {
        id: 'builder-lint',
        tool: 'eslint',
        rawArtefactPath: path.join(
          tempRoot,
          'reports',
          'run',
          'checks',
          'builder-lint',
          'raw.json'
        ),
        status: 'execution-error',
        exitCode: null,
        error: {
          code: 'runner-execution-failed',
          message: 'Check builder-lint execution failed: unexpected spawn failure',
        },
      },
    ]);
  });

  it('skips unmatched baseline checks during compare hydration', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const compareInputs: Array<{ checksInConfigOrderLength: number }> = [];

    await runRegressionCheckerCli({
      positionalSessionId: 'feature/regression-checker',
      repoRoot: '/repo',
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => createConfig(),
      packageJsonScriptsByDirectory: {
        '.': {
          'lint:builder:check':
            'eslint --config scripts/builder/eslint.config.js scripts/builder/src/**/*.ts',
        },
      },
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => ({
        mode: 'compare',
        sessionStorageKey: 'session-feature-regression-checker',
        sessionDirectory: '/repo/.ts-regression-checker/reports/session-feature-regression-checker',
        baselineDirectory:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/baseline',
        baselineManifestPath:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/baseline/manifest.json',
        currentRunDirectory:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/runs/2026-05-13T05-00-00.000Z',
        currentManifestPath:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/runs/2026-05-13T05-00-00.000Z/manifest.json',
        manifest: createManifest('compare'),
      }),
      readBaselineManifest: async () => ({
        ...createManifest('baseline'),
        checks: [
          ...createManifest('baseline').checks,
          {
            id: 'missing-in-current',
            tool: 'eslint',
            cwd: '.',
            executionMetadata: { reporterMode: 'json' },
            rawArtefactPath: 'baseline/checks/missing-in-current/raw.json',
            derivedSummaryPath: 'baseline/checks/missing-in-current/derived.json',
          },
        ],
      }),
      runChecks: async () => [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      compareRegressionChecks: ({ checksInConfigOrder }) => {
        compareInputs.push({ checksInConfigOrderLength: checksInConfigOrder.length });
        return {
          overallStatus: 'GREEN',
          baselineCompatibility: { compatible: true },
          checks: [],
          totals: {
            regressionsCount: 0,
            newFailuresCount: 0,
            fixesCount: 0,
            checksPassing: 1,
            checksFailing: 0,
          },
        };
      },
      readRawArtefact: async () => [],
      writeFile: async () => {},
    });

    expect(compareInputs).toEqual([{ checksInConfigOrderLength: 1 }]);
  });

  it('returns passing check results when runner commands succeed', async () => {
    const { runChecksFromConfig } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-success-runchecks-'));
    tempDirectories.push(tempRoot);

    const results = await runSingleBuilderLintCheck(runChecksFromConfig, tempRoot, async () => ({
      stdout: '',
      stderr: '',
    }));

    expect(results).toEqual([
      {
        id: 'builder-lint',
        tool: 'eslint',
        rawArtefactPath: path.join(
          tempRoot,
          'reports',
          'run',
          'checks',
          'builder-lint',
          'raw.json'
        ),
        status: 'passing',
        exitCode: 0,
        error: null,
      },
    ]);
  });

  it('returns execution-error status for CommandExecutionError with null exitCode', async () => {
    const { runChecksFromConfig } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-exec-error-'));
    tempDirectories.push(tempRoot);

    const results = await runSingleBuilderLintCheck(runChecksFromConfig, tempRoot, async () => {
      throw new CommandExecutionError('Command failed without exit code', {
        command: 'npm',
        args: ['run', 'lint:builder:check'],
        cwd: tempRoot,
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: 'Command failed without exit code',
        timedOut: false,
        timeoutMs: null,
      });
    });

    expect(results).toEqual([
      {
        id: 'builder-lint',
        tool: 'eslint',
        rawArtefactPath: path.join(
          tempRoot,
          'reports',
          'run',
          'checks',
          'builder-lint',
          'raw.json'
        ),
        status: 'execution-error',
        exitCode: null,
        error: null,
      },
    ]);
  });

  it('reads baseline manifest from disk via readBaselineManifest', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const { createSessionStorageKey } = await import('../storage/session-storage.js');
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-readbaseline-'));
    tempDirectories.push(tempRoot);

    const config = createConfig();
    const sessionId = SESSION_ID;
    const sessionStorageKey = createSessionStorageKey(sessionId);

    // Create the baseline manifest at the exact path
    const reportRoot = path.join(tempRoot, config.reportDirectory);
    const sessionDirectory = path.join(reportRoot, sessionStorageKey);
    const baselineDirectory = path.join(sessionDirectory, 'baseline');
    const baselineManifestPath = path.join(baselineDirectory, 'manifest.json');

    await fs.mkdir(baselineDirectory, { recursive: true });
    await fs.writeFile(
      baselineManifestPath,
      JSON.stringify({
        sessionId,
        sessionStorageKey,
        sessionIdSource: 'arg',
        mode: 'baseline',
        createdAt: CREATED_AT,
        baselineCreatedThisRun: true,
        configFingerprint: 'config-fingerprint-v1',
        checks: [],
      }),
      'utf8'
    );

    const result = await runRegressionCheckerCli({
      positionalSessionId: sessionId,
      repoRoot: tempRoot,
      createdAt: CREATED_AT,
      logicalCpuCount: 4,
      loadRawConfig: async () => config,
      packageJsonScriptsByDirectory: createPackageScriptMap(),
      resolveGitBranchName: async () => 'ignored',
      prepareSessionStorage: async () => ({
        mode: 'compare' as const,
        sessionStorageKey,
        sessionDirectory,
        baselineDirectory,
        baselineManifestPath,
        currentRunDirectory: path.join(sessionDirectory, 'runs', '2026-05-13T05-00-00.000Z'),
        currentManifestPath: path.join(
          sessionDirectory,
          'runs',
          '2026-05-13T05-00-00.000Z',
          'manifest.json'
        ),
        manifest: {
          sessionId,
          sessionStorageKey,
          sessionIdSource: 'arg',
          mode: 'compare',
          createdAt: CREATED_AT,
          baselineCreatedThisRun: false,
          configFingerprint: 'config-fingerprint-v1',
          checks: [],
        },
      }),
      // Do NOT inject readBaselineManifest - use default from module
      runChecks: async () => [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'runs/2026-05-13T05-00-00.000Z/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      writeFile: async () => {},
    });

    expect(result.mode).toBe('compare');
  });

  it('renders baseline report with multiple tools sorted in tool summary', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
        {
          id: 'builder-test',
          tool: 'vitest',
          rawArtefactPath: 'baseline/checks/builder-test/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
        {
          id: 'builder-typecheck',
          tool: 'tsc',
          rawArtefactPath: 'baseline/checks/builder-typecheck/raw.txt',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      readRawArtefact: async () => ({}),
    });

    // Should contain sorted tool summary (eslint, playwright, tsc, vitest)
    expect(report).toContain('Tool Summary: eslint=1, tsc=1, vitest=1');
    expect(report).not.toContain('--- FAILED CHECKS ---');
  });

  test.each([
    {
      name: 'single fix showing singular form',
      checkId: 'builder-lint',
      tool: 'eslint' as const,
      fixesCount: 1,
      fixes: ['no-alert|src/example.ts|1|1|Alert removed.'],
      expectedCheckLine: 'builder-lint (1 fix): passing',
      expectedTotalsLine: 'Fixes Count: 1',
      baselineSummary: { kind: 'eslint' as const, counts: { errors: 1, warnings: 0 } },
      currentSummary: { kind: 'eslint' as const, counts: { errors: 0, warnings: 0 } },
    },
    {
      name: 'multiple fixes showing plural form',
      checkId: 'frontend-e2e-check',
      tool: 'playwright' as const,
      fixesCount: 3,
      fixes: ['spec-a.ts|suite|test-a', 'spec-b.ts|suite|test-b', 'spec-c.ts|suite|test-c'],
      expectedCheckLine: 'frontend-e2e-check (3 fixes): passing',
      expectedTotalsLine: 'Fixes Count: 3',
      baselineSummary: {
        kind: 'playwright' as const,
        counts: { total: 3, passed: 0, failed: 3, skipped: 0 },
      },
      currentSummary: {
        kind: 'playwright' as const,
        counts: { total: 3, passed: 3, failed: 0, skipped: 0 },
      },
    },
  ])(
    'renders comparison report with $name',
    async ({
      checkId,
      tool,
      fixesCount,
      fixes,
      expectedCheckLine,
      expectedTotalsLine,
      baselineSummary,
      currentSummary,
    }) => {
      const { renderComparisonReport } = await loadCliModule();

      const report = renderComparisonReport({
        sessionId: SESSION_ID,
        sessionStorageKey: SESSION_STORAGE_KEY,
        sessionIdSource: 'arg',
        baselineTimestamp: CREATED_AT,
        currentTimestamp: CREATED_AT,
        comparison: {
          overallStatus: 'GREEN',
          baselineCompatibility: { compatible: true },
          checks: [
            {
              id: checkId,
              tool,
              status: 'passing',
              baselineSummary,
              currentSummary,
              regressions: [],
              newFailures: [],
              fixes,
              executionError: null,
              baselineIncompatibility: null,
            },
          ],
          totals: {
            regressionsCount: 0,
            newFailuresCount: 0,
            fixesCount,
            checksPassing: 1,
            checksFailing: 0,
          },
        },
      });

      expect(report).toContain(expectedCheckLine);
      expect(report).toContain(expectedTotalsLine);
      expect(report).not.toContain('--- FAILED CHECKS ---');
    }
  );

  it('writes file content to disk via writeFileToDisk', async () => {
    const { writeFileToDisk } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-writefile-'));
    tempDirectories.push(tempRoot);

    const targetPath = path.join(tempRoot, 'subdir', 'test-file.txt');
    const content = 'test content';

    await writeFileToDisk(targetPath, content);

    const writtenContent = await fs.readFile(targetPath, 'utf8');
    expect(writtenContent).toBe(content);
  });

  it('renders baseline report with failing checks and failed checks list', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
      ],
      readRawArtefact: async () => ({}),
    });

    // Should contain the FAILED CHECKS section when there are failed checks
    expect(report).toContain('--- FAILED CHECKS ---');
    expect(report).toContain('builder-lint: failing');
    expect(report).toContain('Overall Status: FAILING');
  });

  it('renders baseline report with empty failed checks list when all checks pass', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'builder-lint',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/builder-lint/raw.json',
          status: 'passing',
          exitCode: 0,
          error: null,
        },
      ],
      readRawArtefact: async () => ({}),
    });

    // Should not contain the FAILED CHECKS section when all checks pass
    expect(report).not.toContain('--- FAILED CHECKS ---');
    expect(report).toContain('--- PER-COMMAND SUMMARY ---');
    expect(report).toContain('builder-lint: passing');
    expect(report).toContain('Overall Status: GREEN');
  });

  it('renders rich failure details across eslint, vitest/playwright, and tsc checks', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'lint-rich',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/lint-rich/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
        {
          id: 'vitest-rich',
          tool: 'vitest',
          rawArtefactPath: 'baseline/checks/vitest-rich/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
        {
          id: 'playwright-empty',
          tool: 'playwright',
          rawArtefactPath: 'baseline/checks/playwright-empty/raw.json',
          status: 'failing',
          exitCode: 1,
          error: null,
        },
        {
          id: 'tsc-rich',
          tool: 'tsc',
          rawArtefactPath: 'baseline/checks/tsc-rich/raw.txt',
          status: 'failing',
          exitCode: 2,
          error: null,
        },
      ],
      readRawArtefact: async (rawArtefactPath) => {
        if (rawArtefactPath.includes('lint-rich')) {
          return [
            {
              filePath: 'src/rich.ts',
              messages: [
                { ruleId: 'a', severity: 2, message: 'a', line: 1, column: 1 },
                { ruleId: 'b', severity: 2, message: 'b', line: 2, column: 1 },
                { ruleId: 'c', severity: 1, message: 'c', line: 3, column: 1 },
                { ruleId: 'd', severity: 1, message: 'd', line: 4, column: 1 },
                { ruleId: 'e', severity: 1, message: 'e', line: 5, column: 1 },
                { ruleId: 'f', severity: 1, message: 'f', line: 6, column: 1 },
              ],
            },
          ];
        }

        if (rawArtefactPath.includes('vitest-rich')) {
          return {
            testResults: [
              {
                name: 'src/example.spec.ts',
                assertionResults: [
                  { ancestorTitles: ['suite'], title: 'pass', status: 'passed' },
                  { ancestorTitles: ['suite'], title: 'skip', status: 'skipped' },
                  { ancestorTitles: ['suite'], title: 'fail one', status: 'failed' },
                  { ancestorTitles: ['suite'], title: 'fail two', status: 'failed' },
                ],
              },
            ],
          };
        }

        if (rawArtefactPath.includes('playwright-empty')) {
          return {
            suites: [
              {
                title: 'pw',
                file: 'e2e/sample.spec.ts',
                specs: [],
              },
            ],
          };
        }

        if (rawArtefactPath.includes('tsc-rich')) {
          return [
            'src/a.ts(1,1): error TS1001: one',
            'src/b.ts(2,1): error TS1002: two',
            'src/c.ts(3,1): error TS1003: three',
            'src/d.ts(4,1): error TS1004: four',
            'src/e.ts(5,1): error TS1005: five',
            'src/f.ts(6,1): error TS1006: six',
          ].join('\n');
        }

        return {};
      },
    });

    expect(report).toContain('Errors: 2, Warnings: 4');
    expect(report).toContain('... and 1 more issues');
    expect(report).toContain('Failed: 2, Passed: 1, Skipped: 1');
    expect(report).toContain('Failed Tests:');
    expect(report).toContain('Diagnostics: 6');
    expect(report).toContain('... and 1 more diagnostics');
  });

  it('omits rich details when artefact reads fail or summaries contain no actionable failures', async () => {
    const { renderBaselineReport } = await loadCliModule();

    const report = await renderBaselineReport({
      sessionId: SESSION_ID,
      sessionStorageKey: SESSION_STORAGE_KEY,
      sessionIdSource: 'arg',
      createdAt: CREATED_AT,
      checks: [
        {
          id: 'lint-read-error',
          tool: 'eslint',
          rawArtefactPath: 'baseline/checks/lint-read-error/raw.json',
          status: 'failing',
          exitCode: null,
          error: null,
        },
        {
          id: 'tsc-empty',
          tool: 'tsc',
          rawArtefactPath: 'baseline/checks/tsc-empty/raw.txt',
          status: 'failing',
          exitCode: 2,
          error: null,
        },
      ],
      readRawArtefact: async (rawArtefactPath) => {
        if (rawArtefactPath.includes('lint-read-error')) {
          throw new Error('disk read failed');
        }

        return '';
      },
    });

    expect(report).toContain('lint-read-error (eslint)');
    expect(report).toContain('Exit Code: N/A');
    expect(report).not.toContain('Issues:');
    expect(report).not.toContain('Diagnostics:');
  });
});
