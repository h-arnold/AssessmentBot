import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const IGNORED_FULL_OUTPUT_PATH = '.opencode/scratchpad/synthetic-analysis-full/';
const COMMITTED_FIXTURE_PROBE_PATH = 'tests/__mocks__/data/synthetic-analysis/small/probe.json';
const FULL_OUTPUT_PROBE_PATH = `${IGNORED_FULL_OUTPUT_PATH}probe.json`;
const SYNTHETIC_ANALYSIS_MARKER = 'synthetic-analysis';
const GIT_CHECK_IGNORE_MATCH_STATUS = 0;
const GIT_CHECK_IGNORE_NO_MATCH_STATUS = 1;

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

const gitignoreEntries = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

const syntheticAnalysisIgnoreEntries = gitignoreEntries.filter(
  (entry) => !entry.startsWith('!') && entry.includes(SYNTHETIC_ANALYSIS_MARKER)
);

/**
 * Runs `git check-ignore` from the repository root against a worktree-relative path.
 *
 * @param args The arguments passed to `git check-ignore` after the subcommand name.
 * @returns The completed git invocation.
 */
function runCheckIgnore(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('git', ['check-ignore', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

/**
 * Reads the ignore pattern that `git check-ignore -v` reports for a probe path.
 *
 * @param probePath The worktree-relative probe path to check.
 * @returns The reported exit status and ignore pattern.
 */
function readIgnoreReport(probePath: string): { status: number | null; pattern: string } {
  const result = runCheckIgnore(['-v', '--no-index', '--', probePath]);
  const [reportLine = ''] = result.stdout.split(/\r?\n/u);
  const [patternReport = ''] = reportLine.split('\t');

  return {
    status: result.status,
    pattern: patternReport.split(':').slice(2).join(':'),
  };
}

describe('synthetic analysis full-corpus ignore boundary', () => {
  it('leaves the committed synthetic-fixture probe outside every git ignore rule', () => {
    const result = runCheckIgnore(['--quiet', '--no-index', '--', COMMITTED_FIXTURE_PROBE_PATH]);

    expect(result.status).toBe(GIT_CHECK_IGNORE_NO_MATCH_STATUS);
  });

  it('ignores the full-corpus probe through the dedicated synthetic-analysis output rule', () => {
    const report = readIgnoreReport(FULL_OUTPUT_PROBE_PATH);

    expect(report.status).toBe(GIT_CHECK_IGNORE_MATCH_STATUS);
    expect(report.pattern).toBe(IGNORED_FULL_OUTPUT_PATH);
  });

  it('declares exactly the dedicated full-corpus output directory among synthetic-analysis entries', () => {
    expect(syntheticAnalysisIgnoreEntries).toEqual([IGNORED_FULL_OUTPUT_PATH]);
  });
});
