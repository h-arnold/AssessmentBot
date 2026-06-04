import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CommandExecutionError } from '../../../lib/process.js';
import {
  type SessionManifest,
  COMPARE_HEADER_LINE_COUNT,
  CREATED_AT,
  INVALID_CONFIG_EXIT_CODE,
  REPORT_DIRECTORY,
  REPO_ROOT,
  SESSION_ID,
  TSC_FAILURE_EXIT_CODE,
  createConfig,
  createManifest,
  createPackageScriptMap,
  createStorageResult,
  loadCliModule,
  tempDirectories,
} from './fixtures.js';

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
            currentSummary: {
              kind: 'eslint',
              counts: { errors: 1, warnings: 0 },
              findings: [
                { fingerprint: 'no-alert|src/example.ts|1|1|Unexpected alert.', severity: 2 },
              ],
            },
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
    expect(result.outputText).toContain('Current Failures: 1');
    expect(result.outputText).toContain('- no-alert|src/example.ts|1|1|Unexpected alert.');
    expect(result.outputText).toContain('REGRESSION CREATED');
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

  it('reads baseline manifest from disk via readBaselineManifest', async () => {
    const { runRegressionCheckerCli } = await loadCliModule();
    const { createSessionStorageKey } = await import('../../storage/session-storage.js');
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
});
