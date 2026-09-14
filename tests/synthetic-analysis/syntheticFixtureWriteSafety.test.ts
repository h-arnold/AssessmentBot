import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { writeProfileFixtures } from '../../scripts/synthetic-test-data/fixtureWriter.js';
import {
  generateCommittedProfiles,
  generateFullProfile,
} from '../../scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMMITTED_FIXTURE_ROOT = 'tests/__mocks__/data/synthetic-analysis';
const FULL_OUTPUT_ROOT = '.opencode/scratchpad/synthetic-analysis-full';
const SMALL_PROFILE_NAME = 'small';
const REPRESENTATIVE_PROFILE_NAME = 'large-representative';
const CLI_SCRIPT_PATH = 'scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
const STAGING_PREFIX = '.synthetic-staging-';
const BACKUP_SUFFIX = '-previous';
const INJECTED_WRITE_FAILURE_MESSAGE = 'injected synthetic fixture write failure';
const INJECTED_REPLACEMENT_FAILURE_MESSAGE = 'injected synthetic fixture replacement failure';
const COMMITTED_PROFILE_NAMES = ['small', 'medium', REPRESENTATIVE_PROFILE_NAME] as const;

const temporaryRoots: string[] = [];

/**
 * Mutable control exercised by the Node filesystem mock so a test can inject one
 * deterministic write or replacement failure without changing file permissions.
 * Every other filesystem call is delegated to the real implementation, so the
 * safety assertions still observe real filesystem state.
 */
const fileSystemFailureControl = vi.hoisted(() => ({
  writeFileSuffix: null as string | null,
  renameDestinationSuffix: null as string | null,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: actual,
    writeFileSync: (filePath: string, data: string) => {
      if (
        fileSystemFailureControl.writeFileSuffix !== null &&
        filePath.endsWith(fileSystemFailureControl.writeFileSuffix)
      ) {
        throw new Error(INJECTED_WRITE_FAILURE_MESSAGE);
      }
      return actual.writeFileSync(filePath, data);
    },
    renameSync: (source: string, destination: string) => {
      // Only the staged-to-profile swap is injected; the backup-to-profile
      // restore performed during rollback must still be allowed to succeed.
      const isStagedSwap = source.includes(STAGING_PREFIX) && !source.endsWith(BACKUP_SUFFIX);
      if (
        fileSystemFailureControl.renameDestinationSuffix !== null &&
        isStagedSwap &&
        destination.endsWith(fileSystemFailureControl.renameDestinationSuffix)
      ) {
        throw new Error(INJECTED_REPLACEMENT_FAILURE_MESSAGE);
      }
      return actual.renameSync(source, destination);
    },
  };
});

/**
 * Generator-internal observation of the top-level graph needed to exercise the
 * fixture writer. Persistence and transport shapes are already covered by the
 * generator specs, so only the writable view keys are captured here.
 */
type GeneratedGraph = {
  manifest: {
    schemaVersion: number;
    profile: string;
    seed: number;
    generatedEntityCounts: Record<string, number>;
  };
  referenceData: unknown;
  persistence: { classes: unknown[]; assignmentDefinitions: unknown[]; assignments: unknown[] };
  transport: {
    classPartials: unknown[];
    assignmentDefinitionPartials: unknown[];
    classesById: Record<string, unknown>;
    assignmentsByKey: Record<string, unknown>;
  };
};

/**
 * Creates an isolated scratchpad output root for a write-safety run.
 *
 * @returns The absolute temporary output root.
 */
function createTemporaryOutputRoot(): string {
  const root = mkdtempSync(join(REPOSITORY_ROOT, '.opencode/scratchpad/synthetic-write-safety-'));
  temporaryRoots.push(root);
  return root;
}

/**
 * Generates a graph for the supplied profile as the writable observation shape.
 *
 * @param profileName The profile to generate.
 * @returns The generated graph cast to the observable shape.
 */
function generateGraph(profileName: string): GeneratedGraph {
  return generateSyntheticAnalysisGraph(profileName) as unknown as GeneratedGraph;
}

/**
 * Clones a generated graph so a test can corrupt its contents locally.
 *
 * @param graph The graph to clone.
 * @returns A deep copy of the graph.
 */
function cloneGraph(graph: GeneratedGraph): GeneratedGraph {
  return JSON.parse(JSON.stringify(graph)) as GeneratedGraph;
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

/**
 * Lists the staging directories currently present under an output root.
 *
 * @param outputRoot The absolute output root to inspect.
 * @returns The staging directory names.
 */
function readStagingDirectoryNames(outputRoot: string): string[] {
  return readdirSync(outputRoot).filter((name) => name.startsWith(STAGING_PREFIX));
}

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('atomic committed profile writing', () => {
  it('leaves an existing profile directory unchanged when graph validation fails', () => {
    const outputRoot = createTemporaryOutputRoot();
    const graph = generateGraph(SMALL_PROFILE_NAME);
    writeProfileFixtures({ graph, outputRoot });
    const before = snapshotDirectory(outputRoot);

    const invalidGraph = cloneGraph(graph);
    invalidGraph.manifest.generatedEntityCounts.classes += 1;

    expect(() => writeProfileFixtures({ graph: invalidGraph, outputRoot })).toThrow(/invariant/iu);
    expect(snapshotDirectory(outputRoot)).toEqual(before);
  });

  it('replaces an already written profile directory in place without changing its contents', () => {
    const outputRoot = createTemporaryOutputRoot();
    const graph = generateGraph(SMALL_PROFILE_NAME);
    writeProfileFixtures({ graph, outputRoot });
    const firstWrite = snapshotDirectory(outputRoot);

    writeProfileFixtures({ graph, outputRoot });

    expect(snapshotDirectory(outputRoot)).toEqual(firstWrite);
  });

  it('cleans up the staging directory and rethrows when a staged write fails', () => {
    const outputRoot = createTemporaryOutputRoot();
    const graph = generateGraph(SMALL_PROFILE_NAME);
    writeProfileFixtures({ graph, outputRoot });
    const before = snapshotDirectory(outputRoot);

    fileSystemFailureControl.writeFileSuffix = 'assignmentsByKey.json';
    try {
      expect(() => writeProfileFixtures({ graph, outputRoot })).toThrow(
        INJECTED_WRITE_FAILURE_MESSAGE
      );
    } finally {
      fileSystemFailureControl.writeFileSuffix = null;
    }

    expect(snapshotDirectory(outputRoot)).toEqual(before);
    expect(readStagingDirectoryNames(outputRoot)).toEqual([]);
  });
});

describe('committed profile set replacement safety', () => {
  it('rolls back every replaced profile when a later profile replacement fails', () => {
    const outputRoot = createTemporaryOutputRoot();
    generateCommittedProfiles({ outputRoot });
    const before = snapshotDirectory(outputRoot);

    fileSystemFailureControl.renameDestinationSuffix = join(outputRoot, 'medium');
    try {
      expect(() => generateCommittedProfiles({ outputRoot })).toThrow(
        INJECTED_REPLACEMENT_FAILURE_MESSAGE
      );
    } finally {
      fileSystemFailureControl.renameDestinationSuffix = null;
    }

    expect(snapshotDirectory(outputRoot)).toEqual(before);
    expect(readdirSync(outputRoot).sort()).toEqual([...COMMITTED_PROFILE_NAMES].sort());
  });
});

describe('full-large output path boundary', () => {
  it('rejects the committed fixture root as a full-output destination', () => {
    const committedRoot = join(REPOSITORY_ROOT, COMMITTED_FIXTURE_ROOT);
    const committedRepresentative = join(committedRoot, REPRESENTATIVE_PROFILE_NAME);
    const before = snapshotDirectory(committedRepresentative);

    expect(() => generateFullProfile({ outputRoot: committedRoot })).toThrow(
      /synthetic-analysis-full/u
    );
    expect(snapshotDirectory(committedRepresentative)).toEqual(before);
  });

  it('rejects a full-output destination outside the ignored root and writes nothing there', () => {
    const outsideRoot = join(createTemporaryOutputRoot(), 'outside-full-output');

    expect(() => generateFullProfile({ outputRoot: outsideRoot })).toThrow(
      /synthetic-analysis-full/u
    );
    expect(existsSync(outsideRoot)).toBe(false);
  });

  it('rejects a traversal output path that resolves outside the ignored root and creates nothing there', () => {
    const permittedRoot = join(REPOSITORY_ROOT, FULL_OUTPUT_ROOT);
    // Build the traversal lexically so `..` is not normalised before the call: the
    // string still begins with the permitted root, but `allowed/../..` climbs out to
    // a sibling directory. A naive string-prefix check would accept it; resolved
    // containment must reject it.
    const escapedDirectoryName = `escaped-${process.pid}`;
    const traversalOutputRoot = `${permittedRoot}/allowed/../../${escapedDirectoryName}`;
    const escapedOutputRoot = join(REPOSITORY_ROOT, '.opencode/scratchpad', escapedDirectoryName);

    try {
      expect(() => generateFullProfile({ outputRoot: traversalOutputRoot })).toThrow(
        /synthetic-analysis-full/u
      );
      expect(existsSync(escapedOutputRoot)).toBe(false);
    } finally {
      rmSync(escapedOutputRoot, { recursive: true, force: true });
    }
  });

  it('rejects a symlinked ancestor that redirects a full-output write outside the ignored root', () => {
    const permittedRoot = join(REPOSITORY_ROOT, FULL_OUTPUT_ROOT);
    mkdirSync(permittedRoot, { recursive: true });
    const outsideRoot = createTemporaryOutputRoot();
    const escapeLink = join(permittedRoot, `escape-link-${process.pid}`);
    const requestedOutputRoot = join(escapeLink, REPRESENTATIVE_PROFILE_NAME);
    symlinkSync(outsideRoot, escapeLink, 'dir');

    try {
      expect(() => generateFullProfile({ outputRoot: requestedOutputRoot })).toThrow(
        /synthetic-analysis-full/u
      );
      expect(existsSync(join(outsideRoot, REPRESENTATIVE_PROFILE_NAME))).toBe(false);
    } finally {
      rmSync(escapeLink, { force: true });
    }
  });

  it('writes fixtures only under the ignored full-output root without touching committed representative data', () => {
    const committedRepresentative = join(
      REPOSITORY_ROOT,
      COMMITTED_FIXTURE_ROOT,
      REPRESENTATIVE_PROFILE_NAME
    );
    const before = snapshotDirectory(committedRepresentative);
    const ignoredOutputRoot = join(
      REPOSITORY_ROOT,
      FULL_OUTPUT_ROOT,
      `synthetic-writer-probe-${process.pid}`
    );

    try {
      writeProfileFixtures({
        graph: generateGraph(REPRESENTATIVE_PROFILE_NAME),
        outputRoot: ignoredOutputRoot,
      });

      expect(
        existsSync(join(ignoredOutputRoot, REPRESENTATIVE_PROFILE_NAME, 'manifest.json'))
      ).toBe(true);
      expect(snapshotDirectory(committedRepresentative)).toEqual(before);
    } finally {
      rmSync(ignoredOutputRoot, { recursive: true, force: true });
    }
  });

  it('exits non-zero when the CLI full mode targets the committed fixture root', () => {
    const committedRoot = join(REPOSITORY_ROOT, COMMITTED_FIXTURE_ROOT);
    const committedRepresentative = join(committedRoot, REPRESENTATIVE_PROFILE_NAME);
    const before = snapshotDirectory(committedRepresentative);

    const result = spawnSync(
      process.execPath,
      [
        '--no-warnings',
        join(REPOSITORY_ROOT, CLI_SCRIPT_PATH),
        '--full',
        '--output-root',
        committedRoot,
      ],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' }
    );

    expect(typeof result.status).toBe('number');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/synthetic-analysis-full/u);
    expect(snapshotDirectory(committedRepresentative)).toEqual(before);
  });
});
