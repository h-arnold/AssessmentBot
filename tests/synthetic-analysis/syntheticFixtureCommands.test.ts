import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLI_SCRIPT_PATH = 'scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
const REGENERATE_COMMAND = 'fixtures:synthetic';
const FULL_COMMAND = 'fixtures:synthetic:full';
const COMPACT_PROFILE_NAMES = ['small', 'medium', 'large-representative'] as const;
const PROFILE_VIEW_FILE_NAMES = [
  'manifest.json',
  'classPartials.json',
  'assignmentDefinitionPartials.json',
  'classesById.json',
  'assignmentsByKey.json',
] as const;
const TEMPORARY_OUTPUT_PREFIX = 'synthetic-cli-compact-';

const temporaryRoots: string[] = [];

type PackageManifest = {
  scripts: Record<string, string>;
};

const packageManifest = JSON.parse(
  readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')
) as PackageManifest;

/**
 * Tokenises a package script into whitespace-separated arguments.
 *
 * @param command The package script command to tokenise.
 * @returns The command's argument tokens.
 */
function tokenizeCommand(command: string): string[] {
  return command.match(/\S+/gu) ?? [];
}

/**
 * Reports whether a tokenised script invokes the synthetic fixture CLI.
 *
 * @param tokens The tokenised package script.
 * @returns True when a token names the fixture CLI entry point.
 */
function invokesFixtureCli(tokens: string[]): boolean {
  return tokens.some((token) => token === CLI_SCRIPT_PATH || token.endsWith(CLI_SCRIPT_PATH));
}

/**
 * Creates an isolated scratchpad output root for a CLI invocation.
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

describe('synthetic analysis fixture command contract', () => {
  it('exposes a root command that regenerates committed compact profiles', () => {
    const tokens = tokenizeCommand(packageManifest.scripts[REGENERATE_COMMAND] ?? '');

    expect(tokens).toContain('node');
    expect(invokesFixtureCli(tokens)).toBe(true);
    expect(tokens).not.toContain('--full');
  });

  it('exposes a separate explicit root command that generates full-large output', () => {
    const tokens = tokenizeCommand(packageManifest.scripts[FULL_COMMAND] ?? '');

    expect(tokens).toContain('node');
    expect(invokesFixtureCli(tokens)).toBe(true);
    expect(tokens).toContain('--full');
  });
});

describe('synthetic analysis fixture CLI execution', () => {
  it('writes the three committed compact profiles to a temporary output root', () => {
    const outputRoot = createTemporaryOutputRoot();

    const result = spawnSync(
      process.execPath,
      ['--no-warnings', join(REPOSITORY_ROOT, CLI_SCRIPT_PATH), '--output-root', outputRoot],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' }
    );

    expect(result.status, result.stderr).toBe(0);

    for (const profileName of COMPACT_PROFILE_NAMES) {
      for (const viewFileName of PROFILE_VIEW_FILE_NAMES) {
        expect(
          existsSync(join(outputRoot, profileName, viewFileName)),
          `${profileName}/${viewFileName} must be written by the compact CLI`
        ).toBe(true);
      }
    }
  });
});
