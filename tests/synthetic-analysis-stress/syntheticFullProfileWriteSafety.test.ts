import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { generateFullProfile } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
import {
  LARGE_FULL_ASSIGNMENTS_PER_CLASS,
  LARGE_FULL_CLASS_COUNT,
  LARGE_FULL_PROFILE_NAME,
  LARGE_FULL_STUDENTS_PER_CLASS,
} from '../../scripts/synthetic-test-data/profileDefinitions.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FULL_OUTPUT_ROOT = '.opencode/scratchpad/synthetic-analysis-full';
const CLI_SCRIPT_PATH = 'scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
const COMMITTED_REPRESENTATIVE_PROFILE_PATH =
  'tests/__mocks__/data/synthetic-analysis/large-representative';
const PROFILE_VIEW_FILE_NAMES = [
  'manifest.json',
  'classPartials.json',
  'assignmentDefinitionPartials.json',
  'classesById.json',
  'assignmentsByKey.json',
] as const;

/**
 * The full-profile entity counts this spec expects to be written, derived from
 * the canonical profile definition rather than duplicated numeric literals.
 */
const EXPECTED_FULL_ENTITY_COUNTS = {
  classes: LARGE_FULL_CLASS_COUNT,
  students: LARGE_FULL_CLASS_COUNT * LARGE_FULL_STUDENTS_PER_CLASS,
  assignments: LARGE_FULL_CLASS_COUNT * LARGE_FULL_ASSIGNMENTS_PER_CLASS,
} as const;

/**
 * Observation of the manifest written by the full-profile generation mode. No
 * frontend schema models the manifest, so only the asserted fields are captured.
 */
type WrittenFullManifest = {
  schemaVersion: number;
  profile: string;
  seed: number;
  generatedEntityCounts: Record<string, number>;
};

/**
 * Captures every file under a directory as a relative-path keyed content map so
 * a test can prove a generation run left committed fixtures untouched.
 *
 * @param directory The absolute directory to snapshot.
 * @returns A map of relative file path to UTF-8 file content.
 */
function snapshotDirectory(directory: string): Record<string, string> {
  const files: Record<string, string> = {};

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [relativePath, content] of Object.entries(snapshotDirectory(absolutePath))) {
        files[`${entry.name}/${relativePath}`] = content;
      }
    } else {
      files[entry.name] = readFileSync(absolutePath, 'utf8');
    }
  }

  return files;
}

describe('opt-in full-large profile writing', () => {
  it('writes the full profile to the permitted ignored root and leaves committed representative fixtures unchanged', () => {
    const committedRepresentative = join(REPOSITORY_ROOT, COMMITTED_REPRESENTATIVE_PROFILE_PATH);
    const before = snapshotDirectory(committedRepresentative);
    const outputRoot = join(FULL_OUTPUT_ROOT, `stress-probe-${process.pid}`);
    const profileOutputRoot = join(outputRoot, LARGE_FULL_PROFILE_NAME);

    try {
      generateFullProfile({ outputRoot });

      for (const viewFileName of PROFILE_VIEW_FILE_NAMES) {
        expect(
          existsSync(join(profileOutputRoot, viewFileName)),
          `${viewFileName} must be written for the full profile`
        ).toBe(true);
      }

      const manifest = JSON.parse(
        readFileSync(join(profileOutputRoot, 'manifest.json'), 'utf8')
      ) as WrittenFullManifest;

      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.profile).toBe(LARGE_FULL_PROFILE_NAME);
      expect(manifest.generatedEntityCounts.classes).toBe(EXPECTED_FULL_ENTITY_COUNTS.classes);
      expect(manifest.generatedEntityCounts.students).toBe(EXPECTED_FULL_ENTITY_COUNTS.students);
      expect(manifest.generatedEntityCounts.assignments).toBe(
        EXPECTED_FULL_ENTITY_COUNTS.assignments
      );

      expect(snapshotDirectory(committedRepresentative)).toEqual(before);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  it('writes the large-full profile through the CLI to a unique permitted ignored root', () => {
    const committedRepresentative = join(REPOSITORY_ROOT, COMMITTED_REPRESENTATIVE_PROFILE_PATH);
    const before = snapshotDirectory(committedRepresentative);
    const outputRoot = join(FULL_OUTPUT_ROOT, `cli-probe-${process.pid}`);
    const profileOutputRoot = join(outputRoot, LARGE_FULL_PROFILE_NAME);

    try {
      const result = spawnSync(
        process.execPath,
        [
          '--no-warnings',
          join(REPOSITORY_ROOT, CLI_SCRIPT_PATH),
          '--full',
          '--output-root',
          outputRoot,
        ],
        { cwd: REPOSITORY_ROOT, encoding: 'utf8' }
      );

      expect(result.status, result.stderr).toBe(0);

      for (const viewFileName of PROFILE_VIEW_FILE_NAMES) {
        expect(
          existsSync(join(profileOutputRoot, viewFileName)),
          `${viewFileName} must be written for the full profile`
        ).toBe(true);
      }

      const manifest = JSON.parse(
        readFileSync(join(profileOutputRoot, 'manifest.json'), 'utf8')
      ) as WrittenFullManifest;

      expect(manifest.profile).toBe(LARGE_FULL_PROFILE_NAME);
      expect(manifest.generatedEntityCounts.classes).toBe(EXPECTED_FULL_ENTITY_COUNTS.classes);
      expect(manifest.generatedEntityCounts.students).toBe(EXPECTED_FULL_ENTITY_COUNTS.students);
      expect(manifest.generatedEntityCounts.assignments).toBe(
        EXPECTED_FULL_ENTITY_COUNTS.assignments
      );
      expect(snapshotDirectory(committedRepresentative)).toEqual(before);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });
});
