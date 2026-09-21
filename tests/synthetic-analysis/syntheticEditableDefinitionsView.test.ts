import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { validateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js';
import { generateCommittedProfiles } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisFixtures.js';
import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';
import { createApiHandlerRoundTripBridge } from '../../scripts/synthetic-test-data/apiHandlerRoundTripBridge.js';
import { AssignmentDefinitionSchema } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod';
import {
  AssignmentDefinitionPartialsResponseSchema,
  type AssignmentDefinitionPartial,
} from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { getAssignmentDefinition } from '../../src/frontend/src/services/assignmentDefinition/assignmentDefinitionService';
import type { GoogleScriptRunApiHandler } from '../../src/frontend/src/test/googleScriptRunHarness';
import { createSyntheticApiRoundTripRunner } from '../../src/frontend/src/test/syntheticApiRoundTripAdapter';

// RED PHASE (Section 2, issue #301): every test below fails until `toTransportViews.js`
// projects `transport.editableDefinitions` and the view is wired through the writer,
// loader, validation suite, and round-trip bridge. No production or script code is
// changed here; the failures prove the view does not exist yet.

const SMALL_PROFILE = 'small';
const COMMITTED_PROFILE_NAMES = ['small', 'medium', 'large-representative'] as const;
const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMMITTED_FIXTURE_ROOT = 'tests/__mocks__/data/synthetic-analysis';
const EDITABLE_DEFINITIONS_FILE_NAME = 'editableDefinitions.json';
const UNKNOWN_DEFINITION_KEY = 'definition-not-generated';

/** Strict `AssignmentDefinitionSchema` record field set; freshness fields are omitted. */
const EXPECTED_RECORD_KEYS = [
  'alternateTitles',
  'alternateTopics',
  'assignmentWeighting',
  'createdAt',
  'definitionKey',
  'documentType',
  'primaryTitle',
  'primaryTopic',
  'primaryTopicKey',
  'referenceDocumentId',
  'templateDocumentId',
  'tasks',
  'updatedAt',
  'yearGroupKey',
  'yearGroupLabel',
];

/** Lightweight task array entry field set produced by the transport transformation. */
const EXPECTED_TASK_KEYS = ['taskId', 'taskTitle', 'taskWeighting'];

/**
 * Leading honourific tokens stripped from generated person names. Faker emits some
 * with a trailing full stop (for example "Mrs."), tolerated by the extractor below.
 */
const STRIPPED_HONOURIFICS: ReadonlyArray<string> = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof'];

/**
 * Generator-internal observation of the logical graph. The editable-definitions
 * view is optional because the red phase asserts its absence.
 */
type GeneratedSyntheticAnalysisGraph = {
  transport: {
    assignmentDefinitionPartials: AssignmentDefinitionPartial[];
    editableDefinitions?: Record<string, unknown>;
  };
};

type GoogleScriptGlobal = {
  google?: { script?: { run?: GoogleScriptRunApiHandler } };
};

/**
 * Returns the projected editable-definitions view, failing loudly when the
 * projection does not exist yet (the expected red-state signal).
 *
 * @param graph The generated logical graph.
 * @returns The editable-definitions view keyed by definition key.
 */
function requireEditableDefinitions(
  graph: GeneratedSyntheticAnalysisGraph
): Record<string, unknown> {
  const view = graph.transport.editableDefinitions;
  expect(
    view,
    'transport.editableDefinitions must be projected with a record per full definition'
  ).toBeDefined();
  if (view === undefined) {
    throw new Error('transport.editableDefinitions is missing from the generated transport.');
  }
  return view;
}

/**
 * Reads the definition keys of the full-definition rows of the partials view.
 * Partial-only registry rows carry null document identifiers and are excluded.
 *
 * @param partials The transport definition partials.
 * @returns The full-definition keys in sorted order.
 */
function fullDefinitionKeys(partials: AssignmentDefinitionPartial[]): string[] {
  return partials
    .filter(
      (partial) => partial.referenceDocumentId !== null && partial.templateDocumentId !== null
    )
    .map((partial) => partial.definitionKey)
    .sort();
}

/**
 * Loads the committed editable-definitions view for a profile. Fails while the
 * loader has no `editableDefinitions` view wired (the expected red-state signal).
 *
 * @param profileName The committed profile name.
 * @returns The committed view keyed by definition key.
 */
function loadCommittedEditableDefinitions(profileName: string): Record<string, unknown> {
  return loadSyntheticAnalysisProfile(profileName, 'editableDefinitions') as Record<
    string,
    unknown
  >;
}

/**
 * Creates a fresh, locally mutable copy of the small-profile generated graph.
 *
 * @returns A mutable copy of the small-profile logical graph.
 */
function createMutableGraph(): GeneratedSyntheticAnalysisGraph {
  return structuredClone(
    generateSyntheticAnalysisGraph(SMALL_PROFILE)
  ) as GeneratedSyntheticAnalysisGraph;
}

/**
 * Collects every string value in a view tree for the person-name invariant check.
 *
 * @param value The current value being inspected.
 * @returns The string values in traversal order.
 */
function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
}

/**
 * Extracts the leading token of a person name without a trailing full stop.
 *
 * @param personName The full person name to inspect.
 * @returns The leading token with one trailing full stop removed.
 */
function extractLeadingToken(personName: string): string {
  const [leadingToken] = personName.split(' ');
  return leadingToken.endsWith('.') ? leadingToken.slice(0, -1) : leadingToken;
}

/**
 * Installs a `google.script.run` runner for the current test.
 *
 * @param runner The runner to install.
 */
function installGoogleRunner(runner: GoogleScriptRunApiHandler): void {
  (globalThis as GoogleScriptGlobal).google = { script: { run: runner } };
}

/**
 * Removes the mock `google.script.run` runner installed by a test.
 */
function clearGoogleRunner(): void {
  delete (globalThis as GoogleScriptGlobal).google;
}

const temporaryRoots: string[] = [];

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  clearGoogleRunner();
  vi.restoreAllMocks();
});

describe('editable-definitions transport projection', () => {
  it('covers exactly the full-definition rows of the partials view', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const view = requireEditableDefinitions(graph);
    const partials = AssignmentDefinitionPartialsResponseSchema.parse(
      graph.transport.assignmentDefinitionPartials
    );

    expect(Object.keys(view).sort()).toEqual(fullDefinitionKeys(partials));
  });

  it('exposes lightweight task arrays with no null weightings and no freshness fields', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const view = requireEditableDefinitions(graph);

    for (const [definitionKey, record] of Object.entries(view)) {
      const entry = record as Record<string, unknown>;
      expect(entry, `${definitionKey} must omit freshness fields`).not.toHaveProperty(
        'referenceLastModified'
      );
      expect(entry, `${definitionKey} must omit freshness fields`).not.toHaveProperty(
        'templateLastModified'
      );

      const tasks = entry.tasks as Array<Record<string, unknown>>;
      expect(Array.isArray(tasks), `${definitionKey} tasks must be an array`).toBe(true);
      expect(tasks.length, `${definitionKey} must carry at least one task`).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(Object.keys(task).sort(), `${definitionKey} task shape`).toEqual(EXPECTED_TASK_KEYS);
        expect(typeof task.taskWeighting, `${definitionKey} task weighting`).toBe('number');
      }
    }
  });

  it('round-trips the projected view through JSON serialisation unchanged', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const view = requireEditableDefinitions(graph);

    expect(JSON.parse(JSON.stringify(view))).toStrictEqual(view);
  });
});

describe('editable-definitions strict-schema validity', () => {
  it('parses every record through the real AssignmentDefinitionSchema contract', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const view = requireEditableDefinitions(graph);

    for (const record of Object.values(view)) {
      expect(() => AssignmentDefinitionSchema.parse(record)).not.toThrow();
    }
  });

  it('carries exactly the strict record field set with no extra keys', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const view = requireEditableDefinitions(graph);

    for (const [definitionKey, record] of Object.entries(view)) {
      expect(Object.keys(record as Record<string, unknown>).sort()).toEqual(
        [...EXPECTED_RECORD_KEYS].sort()
      );
      expect(definitionKey, 'record key must match its definitionKey').toBe(
        (record as { definitionKey: string }).definitionKey
      );
    }
  });
});

describe('committed editable-definitions loader and serialisation harness', () => {
  it('exposes a deep-frozen editableDefinitions.json view for every committed profile', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const view = loadCommittedEditableDefinitions(profileName);

      expect(Object.keys(view).length).toBeGreaterThan(0);
      expect(Object.isFrozen(view), `${profileName} view must be frozen`).toBe(true);
      for (const record of Object.values(view)) {
        expect(Object.isFrozen(record), `${profileName} record must be frozen`).toBe(true);
      }
    }
  });

  it('matches the committed editableDefinitions.json bytes through the loader', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const committed = JSON.parse(
        readFileSync(
          join(
            REPOSITORY_ROOT,
            COMMITTED_FIXTURE_ROOT,
            profileName,
            EDITABLE_DEFINITIONS_FILE_NAME
          ),
          'utf8'
        )
      ) as Record<string, unknown>;

      expect(loadCommittedEditableDefinitions(profileName)).toStrictEqual(committed);
    }
  });

  it('routes getAssignmentDefinition through the round-trip bridge to the committed record', async () => {
    const partials = loadSyntheticAnalysisProfile(
      SMALL_PROFILE,
      'assignmentDefinitionPartials'
    ) as AssignmentDefinitionPartial[];
    const knownFullDefinitionKey = fullDefinitionKeys(partials)[0];
    if (knownFullDefinitionKey === undefined) {
      throw new Error('Expected at least one full-definition row in the small profile.');
    }

    const bridge = createApiHandlerRoundTripBridge({ vi, profileName: SMALL_PROFILE });
    installGoogleRunner(createSyntheticApiRoundTripRunner(bridge.invokeRequest));

    // RED: rejects until the bridge wires editableDefinitions named-view loading,
    // because the getAssignmentDefinition seam has no full-definition data yet.
    const resolved = await getAssignmentDefinition({ definitionKey: knownFullDefinitionKey });
    const committed = loadCommittedEditableDefinitions(SMALL_PROFILE);

    expect(resolved).toStrictEqual(committed[knownFullDefinitionKey]);
  });
});

describe('editable-definitions validation suite', () => {
  it('rejects an editableDefinitions key matching no full-definition partial row', () => {
    const graph = createMutableGraph();
    const view = requireEditableDefinitions(graph);
    const validKey = Object.keys(view)[0];
    if (validKey === undefined) {
      throw new Error('Expected at least one projected editable definition.');
    }
    graph.transport.editableDefinitions = {
      ...view,
      [UNKNOWN_DEFINITION_KEY]: view[validKey],
    };

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
      new RegExp(UNKNOWN_DEFINITION_KEY, 'u')
    );
  });

  it('rejects an editableDefinitions view missing a full definition', () => {
    const graph = createMutableGraph();
    const view = requireEditableDefinitions(graph);
    const [removedKey, ...remainingKeys] = Object.keys(view);
    if (removedKey === undefined || remainingKeys.length === 0) {
      throw new Error('Expected at least two projected editable definitions.');
    }
    const reduced: Record<string, unknown> = {};
    for (const key of remainingKeys) {
      reduced[key] = view[key];
    }
    graph.transport.editableDefinitions = reduced;

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/editableDefinitions/u);
  });

  it('rejects an editableDefinitions entry that is not an object', () => {
    const graph = createMutableGraph();
    const view = requireEditableDefinitions(graph);
    const validKey = Object.keys(view)[0];
    if (validKey === undefined) {
      throw new Error('Expected at least one projected editable definition.');
    }
    graph.transport.editableDefinitions = { ...view, [validKey]: null };

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/editableDefinitions/u);
  });

  it('rejects an editableDefinitions record leaking a freshness field', () => {
    const graph = createMutableGraph();
    const view = requireEditableDefinitions(graph);
    const validKey = Object.keys(view)[0];
    if (validKey === undefined) {
      throw new Error('Expected at least one projected editable definition.');
    }
    graph.transport.editableDefinitions = {
      ...view,
      [validKey]: {
        ...(view[validKey] as Record<string, unknown>),
        referenceLastModified: '2024-01-01T00:00:00.000Z',
      },
    };

    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/referenceLastModified/u);
  });
});

describe('committed editable-definitions fixture regeneration', () => {
  it('regenerates editableDefinitions.json byte-for-byte for every committed profile', () => {
    const outputRoot = mkdtempSync(
      join(REPOSITORY_ROOT, '.opencode/scratchpad/synthetic-editable-definitions-')
    );
    temporaryRoots.push(outputRoot);
    generateCommittedProfiles({ outputRoot });

    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const regeneratedPath = join(outputRoot, profileName, EDITABLE_DEFINITIONS_FILE_NAME);
      expect(
        existsSync(regeneratedPath),
        `${profileName} regeneration must emit ${EDITABLE_DEFINITIONS_FILE_NAME}`
      ).toBe(true);

      const committed = readFileSync(
        join(REPOSITORY_ROOT, COMMITTED_FIXTURE_ROOT, profileName, EDITABLE_DEFINITIONS_FILE_NAME)
      );
      const regenerated = readFileSync(regeneratedPath);

      expect(
        regenerated.equals(committed),
        `${profileName}/${EDITABLE_DEFINITIONS_FILE_NAME} must regenerate byte-for-byte`
      ).toBe(true);
    }
  });
});

describe('honourific-free editable-definition names', () => {
  it('holds no leading honourific in any generated editable-definition name content', () => {
    const graph = generateSyntheticAnalysisGraph(SMALL_PROFILE) as GeneratedSyntheticAnalysisGraph;
    const view = requireEditableDefinitions(graph);
    const names = collectStrings(view);

    expect(names.length).toBeGreaterThan(0);
    const offending = names.filter((name) =>
      STRIPPED_HONOURIFICS.includes(extractLeadingToken(name))
    );

    expect(
      offending,
      'generated editable-definition names must not begin with an honourific'
    ).toEqual([]);
  });

  it('holds no leading honourific in any committed editable-definition name content', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const names = collectStrings(loadCommittedEditableDefinitions(profileName));

      expect(names.length).toBeGreaterThan(0);
      const offending = names.filter((name) =>
        STRIPPED_HONOURIFICS.includes(extractLeadingToken(name))
      );

      expect(
        offending,
        `${profileName} committed editable-definition names must not begin with an honourific`
      ).toEqual([]);
    }
  });
});
