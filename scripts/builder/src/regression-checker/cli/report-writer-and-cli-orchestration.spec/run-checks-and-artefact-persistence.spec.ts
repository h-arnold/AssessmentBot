import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

import { describe, expect, it } from 'vitest';

import { CommandExecutionError } from '../../../lib/process.js';
import { REPORT_DIRECTORY, createConfig, loadCliModule, tempDirectories } from './fixtures.js';

describe('report writer and CLI orchestration', () => {
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

  it('returns passing check results when runner commands succeed', async () => {
    const { runChecksFromConfig } = await loadCliModule();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-cli-success-runchecks-'));
    tempDirectories.push(tempRoot);

    const results = await runChecksFromConfig({
      repoRoot: tempRoot,
      rawArtefactDirectory: path.join(tempRoot, 'reports', 'run'),
      config: createConfig(),
      runCommandImpl: async () => ({
        stdout: '',
        stderr: '',
      }),
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

    const results = await runChecksFromConfig({
      repoRoot: tempRoot,
      rawArtefactDirectory: path.join(tempRoot, 'reports', 'run'),
      config: createConfig(),
      runCommandImpl: async () => {
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
        error: null,
      },
    ]);
  });

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
});
