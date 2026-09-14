import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { generateCommittedProfiles } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
import { getProfileDefinition } from '../../scripts/synthetic-test-data/profileDefinitions.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMMITTED_FIXTURE_ROOT = 'tests/__mocks__/data/synthetic-analysis';
const MEDIUM_PROFILE_NAME = 'medium';
const FULL_LARGE_PROFILE_NAME = 'large-full';
const REPRESENTATIVE_PROFILE_NAME = 'large-representative';
const COMMITTED_PROFILE_NAMES = [
  'small',
  MEDIUM_PROFILE_NAME,
  REPRESENTATIVE_PROFILE_NAME,
] as const;
const INJECTED_GENERATION_FAILURE_MESSAGE = 'injected later-profile generation failure';

/**
 * Mutable control exercised by the graph-generator mock so a test can make a
 * nominated later profile fail after an earlier profile has been staged.
 */
const generationFailureControl = vi.hoisted(() => ({ failedProfile: null as string | null }));

vi.mock(
  '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js')
      >();
    return {
      ...actual,
      generateSyntheticAnalysisGraph: (profileName: string, options?: { seed?: number }) => {
        if (profileName === generationFailureControl.failedProfile) {
          throw new Error(INJECTED_GENERATION_FAILURE_MESSAGE);
        }
        return actual.generateSyntheticAnalysisGraph(profileName, options);
      },
    };
  }
);

const PROFILE_VIEW_FILE_NAMES = [
  'manifest.json',
  'classPartials.json',
  'assignmentDefinitionPartials.json',
  'classesById.json',
  'assignmentsByKey.json',
] as const;

const FULL_LARGE_CANONICAL_PARAMETERS = {
  classCount: 100,
  studentsPerClass: 30,
  assignmentsPerClass: 100,
  yearGroupCount: 24,
} as const;

const temporaryRoots: string[] = [];

/**
 * Creates an isolated scratchpad output root for a regeneration run.
 *
 * @returns The absolute temporary output root.
 */
function createTemporaryOutputRoot(): string {
  const root = mkdtempSync(join(REPOSITORY_ROOT, '.opencode/scratchpad/synthetic-regeneration-'));
  temporaryRoots.push(root);
  return root;
}

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Generator-internal observation of a committed manifest. No frontend schema
 * models the manifest, so only the fields this spec asserts are captured.
 */
type ProfileManifest = {
  schemaVersion: number;
  profile: string;
  seed: number;
  generatedEntityCounts: Record<string, number>;
  canonicalFullProfile?: {
    classCount: number;
    studentsPerClass: number;
    assignmentsPerClass: number;
    yearGroupCount: number;
  };
};

/**
 * Reads a committed profile manifest from the checked-in fixture tree.
 *
 * @param profileName The committed profile whose manifest is read.
 * @returns The parsed committed manifest.
 */
function readCommittedManifest(profileName: string): ProfileManifest {
  const manifestPath = join(REPOSITORY_ROOT, COMMITTED_FIXTURE_ROOT, profileName, 'manifest.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ProfileManifest;
}

/**
 * Captures every file under a directory as a relative-path keyed content map.
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

describe('committed synthetic analysis fixture regeneration', () => {
  it('regenerates every committed profile view byte-for-byte', () => {
    const outputRoot = createTemporaryOutputRoot();
    generateCommittedProfiles({ outputRoot });

    for (const profileName of COMMITTED_PROFILE_NAMES) {
      for (const viewFileName of PROFILE_VIEW_FILE_NAMES) {
        const committed = readFileSync(
          join(REPOSITORY_ROOT, COMMITTED_FIXTURE_ROOT, profileName, viewFileName)
        );
        const regenerated = readFileSync(join(outputRoot, profileName, viewFileName));

        expect(
          regenerated.equals(committed),
          `${profileName}/${viewFileName} must regenerate byte-for-byte`
        ).toBe(true);
      }
    }
  });

  it('regenerates identical bytes across separate runs', () => {
    const firstRoot = createTemporaryOutputRoot();
    const secondRoot = createTemporaryOutputRoot();
    generateCommittedProfiles({ outputRoot: firstRoot });
    generateCommittedProfiles({ outputRoot: secondRoot });

    for (const profileName of COMMITTED_PROFILE_NAMES) {
      for (const viewFileName of PROFILE_VIEW_FILE_NAMES) {
        const first = readFileSync(join(firstRoot, profileName, viewFileName));
        const second = readFileSync(join(secondRoot, profileName, viewFileName));

        expect(second.equals(first), `${profileName}/${viewFileName} must be deterministic`).toBe(
          true
        );
      }
    }
  });

  it('does not include an on-demand large-full profile among the committed fixtures', () => {
    const outputRoot = createTemporaryOutputRoot();
    generateCommittedProfiles({ outputRoot });

    expect(readdirSync(outputRoot).sort()).toEqual([...COMMITTED_PROFILE_NAMES].sort());
    expect(existsSync(join(outputRoot, FULL_LARGE_PROFILE_NAME))).toBe(false);
  });
});

describe('committed synthetic analysis profile manifests', () => {
  it('records the profile seed, schema version and own entity counts', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const manifest = readCommittedManifest(profileName);
      const definition = getProfileDefinition(profileName) as { seed: number };

      expect(manifest.profile).toBe(profileName);
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.seed).toBe(definition.seed);
      expect(Object.keys(manifest.generatedEntityCounts).length).toBeGreaterThan(0);

      for (const count of Object.values(manifest.generatedEntityCounts)) {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  it('records the canonical full-large parameters on the representative projection', () => {
    const manifest = readCommittedManifest(REPRESENTATIVE_PROFILE_NAME);

    expect(manifest.canonicalFullProfile).toEqual(FULL_LARGE_CANONICAL_PARAMETERS);
    expect(manifest.generatedEntityCounts.classes).toBeLessThan(
      FULL_LARGE_CANONICAL_PARAMETERS.classCount
    );
    expect(manifest.generatedEntityCounts.assignments).toBeLessThan(
      FULL_LARGE_CANONICAL_PARAMETERS.classCount *
        FULL_LARGE_CANONICAL_PARAMETERS.assignmentsPerClass
    );
  });
});

describe('committed synthetic analysis fixture set failure safety', () => {
  it('preserves every pre-existing committed profile when a later profile fails to generate', () => {
    const outputRoot = createTemporaryOutputRoot();
    generateCommittedProfiles({ outputRoot });
    const before = snapshotDirectory(outputRoot);

    generationFailureControl.failedProfile = MEDIUM_PROFILE_NAME;
    try {
      expect(() => generateCommittedProfiles({ outputRoot })).toThrow(
        INJECTED_GENERATION_FAILURE_MESSAGE
      );
    } finally {
      generationFailureControl.failedProfile = null;
    }

    expect(snapshotDirectory(outputRoot)).toEqual(before);
    expect(readdirSync(outputRoot).sort()).toEqual([...COMMITTED_PROFILE_NAMES].sort());
  });
});
