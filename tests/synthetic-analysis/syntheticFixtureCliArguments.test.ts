import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  executeCli,
  parseCliOptions,
  resolveFullOutputRoot,
  runCli,
} from '../../scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FULL_OUTPUT_ROOT = '.opencode/scratchpad/synthetic-analysis-full';
const COMMITTED_FIXTURE_ROOT = 'tests/__mocks__/data/synthetic-analysis';
const TEMPORARY_OUTPUT_PREFIX = 'synthetic-cli-arguments-';
const OUTPUT_ROOT_FLAG = '--output-root';

const temporaryRoots: string[] = [];

/**
 * Creates an isolated scratchpad output root for a CLI argument test.
 *
 * @returns The absolute temporary output root.
 */
function createTemporaryOutputRoot(): string {
  const root = mkdtempSync(join(REPOSITORY_ROOT, '.opencode/scratchpad', TEMPORARY_OUTPUT_PREFIX));
  temporaryRoots.push(root);
  return root;
}

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('synthetic analysis fixture CLI argument validation', () => {
  it('rejects a missing value for --output-root instead of falling through to a default', () => {
    expect(() => parseCliOptions([OUTPUT_ROOT_FLAG])).toThrow(/--output-root/u);
  });

  it('rejects a flag-like value for --output-root instead of consuming the next flag', () => {
    expect(() => parseCliOptions([OUTPUT_ROOT_FLAG, '--full'])).toThrow(/--output-root/u);
  });

  it('rejects an unknown option', () => {
    expect(() => parseCliOptions(['--unknown-option'])).toThrow(/unknown-option/u);
  });

  it('defaults compact mode to the committed fixture root', () => {
    const options = parseCliOptions([]);

    expect(options.full).toBe(false);
    expect(options.outputRoot).toBe(resolve(join(REPOSITORY_ROOT, COMMITTED_FIXTURE_ROOT)));
  });

  it('defaults full mode to the ignored full-output root', () => {
    const options = parseCliOptions(['--full']);

    expect(options.full).toBe(true);
    expect(options.outputRoot).toBe(resolve(join(REPOSITORY_ROOT, FULL_OUTPUT_ROOT)));
  });

  it('honours an explicit output root in either mode', () => {
    expect(parseCliOptions([OUTPUT_ROOT_FLAG, '/tmp/compact']).outputRoot).toBe('/tmp/compact');

    const fullOptions = parseCliOptions(['--full', OUTPUT_ROOT_FLAG, '/tmp/full']);
    expect(fullOptions.full).toBe(true);
    expect(fullOptions.outputRoot).toBe('/tmp/full');
  });
});

describe('synthetic analysis fixture full-output containment', () => {
  it('accepts the permitted root and its descendants', () => {
    const permittedRoot = resolve(join(REPOSITORY_ROOT, FULL_OUTPUT_ROOT));

    expect(resolveFullOutputRoot(permittedRoot)).toBe(permittedRoot);
    expect(resolveFullOutputRoot(join(permittedRoot, 'nested-probe'))).toBe(
      join(permittedRoot, 'nested-probe')
    );
  });

  it('rejects a destination outside the ignored root', () => {
    expect(() => resolveFullOutputRoot(createTemporaryOutputRoot())).toThrow(
      /synthetic-analysis-full/u
    );
  });
});

describe('synthetic analysis fixture CLI dispatch', () => {
  it('writes compact profiles to an explicit output root', () => {
    const outputRoot = createTemporaryOutputRoot();

    runCli([OUTPUT_ROOT_FLAG, outputRoot]);

    expect(existsSync(join(outputRoot, 'small', 'manifest.json'))).toBe(true);
  });

  it('rejects a disallowed full output root before generating the large graph', () => {
    const outsideRoot = createTemporaryOutputRoot();

    expect(() => runCli(['--full', OUTPUT_ROOT_FLAG, outsideRoot])).toThrow(
      /synthetic-analysis-full/u
    );
    expect(existsSync(join(outsideRoot, 'large-full'))).toBe(false);
  });
});

describe('synthetic analysis fixture CLI error reporting', () => {
  it('reports a malformed invocation on stderr and sets a non-zero exit code', () => {
    const previousExitCode = process.exitCode;
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    try {
      executeCli(['--unknown-option']);

      expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('--unknown-option'));
      expect(process.exitCode).toBe(1);
    } finally {
      stderrWrite.mockRestore();
      process.exitCode = previousExitCode;
    }
  });
});
