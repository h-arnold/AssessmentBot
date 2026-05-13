import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadPackageJsonScriptsByDirectory,
  resolveGitBranchName,
} from './run-regression-checker.js';
import { CommandExecutionError } from '../lib/process.js';

const tempDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    })
  );
});

describe('run-regression-checker helpers', () => {
  it('loads package scripts for the repo root and configured check directories', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-checker-wrapper-'));
    tempDirectories.push(tempRoot);

    await fs.writeFile(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({
        scripts: {
          rootScript: 'npm run something',
        },
      }),
      'utf8'
    );
    await fs.mkdir(path.join(tempRoot, 'packages', 'builder-child'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'packages', 'builder-child', 'package.json'),
      JSON.stringify({
        scripts: {
          childScript: 'vitest run',
        },
      }),
      'utf8'
    );

    const scriptsByDirectory = await loadPackageJsonScriptsByDirectory({
      repoRoot: tempRoot,
      rawConfig: {
        checks: [{ cwd: '.' }, { cwd: 'packages/builder-child' }, { cwd: 'missing-dir' }],
      },
    });

    expect(scriptsByDirectory).toEqual({
      '.': {
        rootScript: 'npm run something',
      },
      'packages/builder-child': {
        childScript: 'vitest run',
      },
    });
  });

  it('ignores configs without a checks array and still reads the repo root package.json', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-checker-wrapper-root-'));
    tempDirectories.push(tempRoot);

    await fs.writeFile(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({
        scripts: {
          rootOnly: 'eslint .',
        },
      }),
      'utf8'
    );

    await expect(
      loadPackageJsonScriptsByDirectory({
        repoRoot: tempRoot,
        rawConfig: {},
      })
    ).resolves.toEqual({
      '.': {
        rootOnly: 'eslint .',
      },
    });
  });

  it('ignores unsafe check cwd values during package script discovery', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-checker-wrapper-safe-'));
    tempDirectories.push(tempRoot);

    await fs.writeFile(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({
        scripts: { rootOnly: 'eslint .' },
      }),
      'utf8'
    );

    await expect(
      loadPackageJsonScriptsByDirectory({
        repoRoot: tempRoot,
        rawConfig: {
          checks: [
            { cwd: '../outside' },
            { cwd: '/absolute/path' },
            { cwd: 'C:/windows/path' },
            { cwd: '   ' },
            { cwd: 'safe/..' },
            { cwd: './nested/./safe/..' },
          ],
        },
      })
    ).resolves.toEqual({
      '.': { rootOnly: 'eslint .' },
    });
  });

  it('normalises safe cwd aliases to canonical directory keys', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-checker-wrapper-alias-'));
    tempDirectories.push(tempRoot);

    await fs.mkdir(path.join(tempRoot, 'packages', 'builder-child'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'packages', 'builder-child', 'package.json'),
      JSON.stringify({
        scripts: { childScript: 'vitest run' },
      }),
      'utf8'
    );

    await expect(
      loadPackageJsonScriptsByDirectory({
        repoRoot: tempRoot,
        rawConfig: {
          checks: [
            { cwd: './packages/builder-child/.' },
            { cwd: String.raw`packages\builder-child` },
          ],
        },
      })
    ).resolves.toEqual({
      'packages/builder-child': { childScript: 'vitest run' },
    });
  });

  it('discovers nested npm --prefix package directories referenced by scripts', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-checker-wrapper-nested-'));
    tempDirectories.push(tempRoot);

    await fs.writeFile(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({
        scripts: {
          'lint:frontend:check': 'npm --prefix src/frontend run lint --',
        },
      }),
      'utf8'
    );
    await fs.mkdir(path.join(tempRoot, 'src', 'frontend'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'src', 'frontend', 'package.json'),
      JSON.stringify({
        scripts: {
          lint: 'eslint .',
        },
      }),
      'utf8'
    );

    await expect(
      loadPackageJsonScriptsByDirectory({
        repoRoot: tempRoot,
        rawConfig: {
          checks: [
            {
              cwd: '.',
              run: {
                kind: 'npm-script',
                script: 'lint:frontend:check',
              },
            },
          ],
        },
      })
    ).resolves.toEqual({
      '.': {
        'lint:frontend:check': 'npm --prefix src/frontend run lint --',
      },
      'src/frontend': {
        lint: 'eslint .',
      },
    });
  });

  it('propagates invalid package.json parse errors', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'regression-checker-wrapper-json-'));
    tempDirectories.push(tempRoot);

    await fs.writeFile(path.join(tempRoot, 'package.json'), '{ invalid-json', 'utf8');

    await expect(
      loadPackageJsonScriptsByDirectory({
        repoRoot: tempRoot,
        rawConfig: {},
      })
    ).rejects.toThrow();
  });

  it('resolves the active git branch name from git output', async () => {
    const processModule = await import('../lib/process.js');
    vi.spyOn(processModule, 'runCommand').mockResolvedValue({
      stdout: 'feature/regression-checker\n',
      stderr: '',
    });

    await expect(resolveGitBranchName()).resolves.toBe('feature/regression-checker');
  });

  it('fails when git returns an empty branch name', async () => {
    const processModule = await import('../lib/process.js');
    vi.spyOn(processModule, 'runCommand').mockResolvedValue({
      stdout: '\n',
      stderr: '',
    });

    await expect(resolveGitBranchName()).rejects.toThrow('Git branch name is empty.');
  });

  it('propagates git execution failures', async () => {
    const processModule = await import('../lib/process.js');
    vi.spyOn(processModule, 'runCommand').mockRejectedValue(
      new CommandExecutionError('git failed', {
        command: 'git',
        args: ['branch', '--show-current'],
        cwd: process.cwd(),
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: 'fatal',
        timedOut: false,
        timeoutMs: null,
      })
    );

    await expect(resolveGitBranchName()).rejects.toThrow('git failed');
  });
});
