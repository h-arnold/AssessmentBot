import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BASELINE_ARTEFACT_ROOT,
  CURRENT_RUN_ARTEFACT_ROOT,
  REPO_ROOT,
  TSC_PROJECT_PATH,
  createCheckFixture,
  loadRunnerModule,
  rawArtefactPathFor,
} from './fixtures.js';

describe('tool runner command construction and bounded scheduling', () => {
  it('builds runner invocations for eslint, vitest, playwright, and tsc with tool-appropriate output modes', async () => {
    const { buildRunnerInvocation } = await loadRunnerModule();

    const eslintCheck = createCheckFixture({
      id: 'backend-lint-check',
      tool: 'eslint',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'lint:backend:check',
      },
    });
    const vitestCheck = createCheckFixture({
      id: 'backend-tests',
      tool: 'vitest',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'test:backend',
      },
    });
    const playwrightCheck = createCheckFixture({
      id: 'frontend-e2e',
      tool: 'playwright',
      cwd: '.',
      run: {
        kind: 'npm-script',
        script: 'test:frontend:e2e',
      },
    });
    const tscCheck = createCheckFixture({
      id: 'builder-compile',
      tool: 'tsc',
      cwd: '.',
      run: {
        kind: 'tsc',
        project: TSC_PROJECT_PATH,
      },
    });

    const eslintInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: eslintCheck,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, eslintCheck.id, '.json'),
    });
    expect(eslintInvocation).toMatchObject({
      executable: 'npm',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, eslintCheck.id, '.json'),
      rawArtefactExtension: '.json',
    });
    expect(eslintInvocation.rawArtefactPath).toContain('/baseline/checks/');
    expect(eslintInvocation.args).toEqual(
      expect.arrayContaining(['run', 'lint:backend:check', '--', '--format', 'json'])
    );

    const vitestInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: vitestCheck,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, vitestCheck.id, '.json'),
    });
    expect(vitestInvocation).toMatchObject({
      executable: 'npm',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, vitestCheck.id, '.json'),
      rawArtefactExtension: '.json',
    });
    expect(vitestInvocation.rawArtefactPath).toContain('/runs/2026-03-02T09-00-00.000Z/checks/');
    expect(vitestInvocation.args.join(' ')).toContain('--reporter=json');

    const playwrightInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: playwrightCheck,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, playwrightCheck.id, '.json'),
    });
    expect(playwrightInvocation).toMatchObject({
      executable: 'npm',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, playwrightCheck.id, '.json'),
      rawArtefactExtension: '.json',
    });
    expect(playwrightInvocation.rawArtefactPath).toContain(
      '/runs/2026-03-02T09-00-00.000Z/checks/'
    );
    expect(playwrightInvocation.args.join(' ')).toContain('--reporter=json');

    const tscInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: tscCheck,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, tscCheck.id, '.txt'),
    });
    expect(tscInvocation).toMatchObject({
      executable: 'tsc',
      cwd: REPO_ROOT,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, tscCheck.id, '.txt'),
      rawArtefactExtension: '.txt',
    });
    expect(tscInvocation.rawArtefactPath).toContain('/baseline/checks/');
    expect(tscInvocation.args).toEqual(
      expect.arrayContaining(['-p', path.resolve(REPO_ROOT, TSC_PROJECT_PATH), '--pretty', 'false'])
    );
  });

  it('resolves command-facing output and project paths from repo root for non-root cwd checks', async () => {
    const { buildRunnerInvocation } = await loadRunnerModule();

    const nestedCheck = createCheckFixture({
      id: 'frontend-vitest',
      tool: 'vitest',
      cwd: 'src/frontend',
      run: {
        kind: 'npm-script',
        script: 'test',
      },
    });
    const nestedTscCheck = createCheckFixture({
      id: 'frontend-tsc',
      tool: 'tsc',
      cwd: 'src/frontend',
      run: {
        kind: 'tsc',
        project: TSC_PROJECT_PATH,
      },
    });

    const rawArtefactPath = rawArtefactPathFor(CURRENT_RUN_ARTEFACT_ROOT, nestedCheck.id, '.json');
    const nestedInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: nestedCheck,
      rawArtefactPath,
    });

    expect(nestedInvocation.cwd).toBe(path.resolve(REPO_ROOT, nestedCheck.cwd));
    expect(nestedInvocation.rawArtefactPath).toBe(rawArtefactPath);
    expect(nestedInvocation.args).toEqual(
      expect.arrayContaining(['--outputFile=' + path.resolve(REPO_ROOT, rawArtefactPath)])
    );

    const nestedTscInvocation = buildRunnerInvocation({
      repoRoot: REPO_ROOT,
      check: nestedTscCheck,
      rawArtefactPath: rawArtefactPathFor(BASELINE_ARTEFACT_ROOT, nestedTscCheck.id, '.txt'),
    });
    expect(nestedTscInvocation.cwd).toBe(path.resolve(REPO_ROOT, nestedTscCheck.cwd));
    expect(nestedTscInvocation.args).toEqual(
      expect.arrayContaining(['-p', path.resolve(REPO_ROOT, TSC_PROJECT_PATH), '--pretty', 'false'])
    );
  });
});
