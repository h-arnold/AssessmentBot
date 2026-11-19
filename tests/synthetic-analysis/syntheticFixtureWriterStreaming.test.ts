import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { PROFILE_VIEW_FILE_NAMES, writeProfileFixtures } from '#synthetic-data/fixtureWriter.js';
import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMMITTED_FIXTURE_ROOT = 'tests/__mocks__/data/synthetic-analysis';
const SMALL_PROFILE_NAME = 'small';
const TEMPORARY_ROOT_PREFIX = '.synthetic-streaming-';
// Generating a small graph, streaming six views and comparing their bytes under
// coverage instrumentation can exceed the synthetic project's default timeout.
const STREAMING_TEST_TIMEOUT_MS = 20_000;

const temporaryRoots: string[] = [];

/**
 * Mutable observation of the formatter mock. `formatCallCount` proves the
 * injected max-string-length error actually drove the streaming fallback for
 * every view; the message matches V8's hard string-length `RangeError` exactly.
 */
const formatterControl = vi.hoisted(() => ({
  formatCallCount: 0,
  rangeErrorMessage: 'Invalid string length',
}));

// Leave `resolveConfig` on the real implementation so the streamed writer uses
// the repository's print width. Only `format` is replaced, with the algorithmic
// boundary error that cannot be produced by the shared corpus without the
// on-demand ~1.08M-item large-full graph (Exception 2 in the testing guide):
// a real max-string-length `RangeError` needs a view larger than V8 allows, so
// the smallest deterministic way to reach this branch is to inject it here.
vi.mock('prettier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prettier')>();
  return {
    ...actual,
    format: (): Promise<string> => {
      formatterControl.formatCallCount += 1;
      throw new RangeError(formatterControl.rangeErrorMessage);
    },
  };
});

/**
 * Creates an isolated scratchpad output root for a streaming write.
 *
 * @returns The absolute temporary output root.
 */
function createTemporaryOutputRoot(): string {
  const root = mkdtempSync(join(REPOSITORY_ROOT, '.opencode/scratchpad', TEMPORARY_ROOT_PREFIX));
  temporaryRoots.push(root);
  return root;
}

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('oversized view streaming fallback', () => {
  it(
    'writes every streamed view byte-for-byte identical to the committed profile fixture',
    async () => {
      const outputRoot = createTemporaryOutputRoot();
      const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE_NAME);
      formatterControl.formatCallCount = 0;

      await writeProfileFixtures({ graph, outputRoot });

      // Every view reached the injected error, so none took the in-memory
      // stringify path and all of them exercised the chunked streaming writer.
      expect(formatterControl.formatCallCount).toBe(PROFILE_VIEW_FILE_NAMES.size);

      const profileDirectory = join(outputRoot, SMALL_PROFILE_NAME);
      expect(readdirSync(profileDirectory).sort()).toEqual(
        [...PROFILE_VIEW_FILE_NAMES.values()].sort()
      );

      for (const [viewName, fileName] of PROFILE_VIEW_FILE_NAMES) {
        const streamedPath = join(profileDirectory, fileName);
        const committedPath = join(
          REPOSITORY_ROOT,
          COMMITTED_FIXTURE_ROOT,
          SMALL_PROFILE_NAME,
          fileName
        );

        const streamed = readFileSync(streamedPath);
        const committed = readFileSync(committedPath);

        // Both parse as JSON and carry the same data; the byte comparison then
        // proves the streaming writer reproduces the committed representation.
        expect(JSON.parse(streamed.toString('utf8'))).toEqual(
          JSON.parse(committed.toString('utf8'))
        );
        expect(
          streamed.equals(committed),
          `${viewName} must stream byte-for-byte identically`
        ).toBe(true);
      }
    },
    STREAMING_TEST_TIMEOUT_MS
  );
});
