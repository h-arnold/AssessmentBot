import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

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
  }) => string;
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
  runChecksFromConfig: (options: {
    config: RegressionConfig;
    repoRoot: string;
    rawArtefactDirectory: string;
    runCommandImpl: (
      command: string,
      args: string[],
      options: { cwd: string; env?: NodeJS.ProcessEnv }
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
      options: { cwd: string; env?: NodeJS.ProcessEnv }
    ) => Promise<{ stdout: string; stderr: string }>;
  }) => Promise<{
    exitCode: number;
    outputText: string;
    mode: StorageMode;
  }>;
};

const CREATED_AT = '2026-05-13T05:00:00.000Z';
const REPORT_DIRECTORY = '.ts-regression-checker/reports';
const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    })
  );
});

/**
 *
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
 *
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
 *
 * @param mode
 */
function createManifest(mode: StorageMode): SessionManifest {
  return {
    sessionId: 'feature/regression-checker',
    sessionStorageKey: 'session-feature-regression-checker',
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

describe('report writer and CLI orchestration', () => {
  it('returns baseline-mode output with explicit baseline-created messaging and zero exit code', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const writes: Array<{ targetPath: string; content: string }> = [];

    const result = await runRegressionCheckerCli({
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
        mode: 'baseline',
        sessionStorageKey: 'session-feature-regression-checker',
        sessionDirectory: '/repo/.ts-regression-checker/reports/session-feature-regression-checker',
        baselineDirectory:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/baseline',
        baselineManifestPath:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/baseline/manifest.json',
        currentRunDirectory: null,
        currentManifestPath:
          '/repo/.ts-regression-checker/reports/session-feature-regression-checker/baseline/manifest.json',
        manifest: createManifest('baseline'),
      }),
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
    expect(result.outputText).toContain('baselineCreatedThisRun: true');
    expect(result.outputText).toContain('baselineTimestamp: N/A');
    expect(result.outputText).toContain(
      'This run created the baseline and did not perform comparison diffing.'
    );
    expect(writes).toEqual([]);
  });

  it('writes compare artefacts and returns exit code 1 when regressions are detected', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const writes: Array<{ targetPath: string; content: string }> = [];

    const result = await runRegressionCheckerCli({
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
    expect(result.outputText).toContain('overallStatus: FAILING');
    expect(writes.map((entry) => entry.targetPath)).toEqual([
      '/repo/.ts-regression-checker/reports/session-feature-regression-checker/runs/2026-05-13T05-00-00.000Z/comparison.json',
      '/repo/.ts-regression-checker/reports/session-feature-regression-checker/runs/2026-05-13T05-00-00.000Z/comparison.txt',
    ]);
  });

  it('returns exit code 0 for compare mode without regressions and preserves header field order', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();

    const result = await runRegressionCheckerCli({
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
      .slice(0, 14);
    expect(headerLines).toEqual([
      'sessionId: feature/regression-checker',
      'sessionStorageKey: session-feature-regression-checker',
      'sessionIdSource: arg',
      'mode: compare',
      'baselineCreatedThisRun: false',
      'baselineTimestamp: 2026-05-13T05:00:00.000Z',
      'currentTimestamp: 2026-05-13T05:00:00.000Z',
      'overallStatus: GREEN',
      'totalChecks: 1',
      'checksPassing: 1',
      'checksFailing: 0',
      'regressionsCount: 0',
      'newFailuresCount: 0',
      'fixesCount: 0',
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

    expect(result.exitCode).toBe(2);
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
        });
      },
      compareRegressionChecks: ({ checksInConfigOrder }) => {
        expect(checksInConfigOrder[0]?.current.status).toBe('failing');
        expect(checksInConfigOrder[0]?.current.exitCode).toBe(2);
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

    expect(report).toContain('overallStatus: BASELINE-INCOMPATIBLE');
    expect(report).toContain('checkId: builder-lint');
    expect(report).toContain('status: baseline-incompatible');
  });

  it('persists playwright stdout artefacts and resolves session artefact paths deterministically', async () => {
    const { persistCapturedArtefact, resolveSessionArtefactPath } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-playwright-'));
    tempDirectories.push(tempRoot);
    const rawArtefactPath = path.join(tempRoot, 'raw.json');

    await persistCapturedArtefact({
      tool: 'playwright',
      rawArtefactPath,
      commandOutput: {
        stdout: '{"status":"ok"}',
        stderr: '',
      },
    });

    await expect(fs.readFile(rawArtefactPath, 'utf8')).resolves.toBe('{"status":"ok"}');
    expect(
      resolveSessionArtefactPath('/tmp/session-root', 'baseline/checks/example/raw.json')
    ).toBe(path.join('/tmp/session-root', 'baseline/checks/example/raw.json'));
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
});
