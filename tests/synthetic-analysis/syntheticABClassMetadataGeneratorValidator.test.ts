import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { validateClassMetadata } from '#synthetic-data/validateClassMetadata.js';
import { validateSyntheticAnalysisGraph } from '#synthetic-data/validateSyntheticAnalysisGraph.js';

type RawRecord = Record<string, any>;
type Graph = {
  persistence: {
    classes: Array<{ classId: string; metadata: RawRecord | null }>;
    assignments: Array<Record<string, unknown>>;
  };
};
type RawGraph = Graph & {
  transport: {
    classPartials: Array<{ classId: string; metadata: RawRecord | null }>;
    classesById: Record<string, { metadata: RawRecord | null }>;
  };
};

const SUPPORTED_PROFILES = ['small', 'medium', 'large-representative'] as const;
const FIVE_FIELD_KEYS = [
  'classAverages',
  'recentAssignments',
  'baselineAverages',
  'allTaskStandings',
  'baselineStandings',
] as const;
const STANDING_KEYS = ['studentId', 'studentName', 'scores', 'recentAssignmentScores'] as const;
// Mirrors the generator's fixed supplied-score templates; a fixed contract, not regenerated data.
const SCORE_TEMPLATES = [
  { completeness: 4, accuracy: 3.5, spag: 4.5, overall: 3.9 },
  { completeness: 'N', accuracy: 'N', spag: 'N', overall: 'N' },
  { completeness: 'E', accuracy: 'E', spag: 'E', overall: 'E' },
  { completeness: 'excluded', accuracy: 'excluded', spag: 'excluded', overall: 'excluded' },
  { completeness: 4, accuracy: 3, spag: 'N', overall: 3.5 },
] as const;
// The whole-metadata legacy null cases retained by the coverage matrix.
const LEGACY_NULL_CLASSES: Record<(typeof SUPPORTED_PROFILES)[number], string[]> = {
  small: ['class-0'],
  medium: [],
  'large-representative': ['class-0'],
};

describe('five-field supplied-snapshot generation', () => {
  it.each(SUPPORTED_PROFILES)('emits valid nested new fields for %s classes', (profile) => {
    const graph = generateSyntheticAnalysisGraph(profile) as Graph;
    const assignmentsByClass = new Map<string, Array<Record<string, unknown>>>();
    for (const assignment of graph.persistence.assignments) {
      const classId = String(assignment.courseId);
      assignmentsByClass.set(classId, [...(assignmentsByClass.get(classId) ?? []), assignment]);
    }
    for (const [index, { classId, metadata }] of graph.persistence.classes.entries()) {
      if (metadata === null) {
        expect(LEGACY_NULL_CLASSES[profile]).toContain(classId);
        continue;
      }
      const raw = metadata as RawRecord;
      expect
        .soft(hasFiveFieldShape(raw), `${profile} class ${index} owns all five fields`)
        .toBe(true);
      if (!hasFiveFieldShape(raw)) continue;
      const newest = [...(assignmentsByClass.get(classId) ?? [])].sort((left, right) =>
        String(right.updatedAt).localeCompare(String(left.updatedAt))
      );
      expectNestedNewFields(raw, newest);
    }
  });

  it.each(SUPPORTED_PROFILES)('regenerates byte-identical %s metadata', (profile) => {
    const first = generateSyntheticAnalysisGraph(profile) as Graph;
    const second = generateSyntheticAnalysisGraph(profile) as Graph;
    expect(JSON.stringify(second.persistence.classes.map((row) => row.metadata))).toBe(
      JSON.stringify(first.persistence.classes.map((row) => row.metadata))
    );
    expect(
      first.persistence.classes.filter((row) => row.metadata === null).map((row) => row.classId)
    ).toEqual(LEGACY_NULL_CLASSES[profile]);
  });
});

describe('raw metadata validator legacy and current shapes', () => {
  it('accepts legacy two-field and five-field snapshots from controlled graph clones', () => {
    const legacyGraph = makeMetadataGraph();
    const source = sourceMetadata(legacyGraph);
    setSourceMetadata(legacyGraph, {
      classAverages: source.classAverages,
      recentAssignments: source.recentAssignments,
    });
    expect(() => validateClassMetadata(legacyGraph)).not.toThrow();
    expect(() => validateSyntheticAnalysisGraph(legacyGraph)).not.toThrow();

    const currentGraph = makeMetadataGraph();
    setSourceMetadata(currentGraph, withFiveFieldShape(sourceMetadata(currentGraph)));
    expect(() => validateClassMetadata(currentGraph)).not.toThrow();
    expect(() => validateSyntheticAnalysisGraph(currentGraph)).not.toThrow();
  });

  const malformed: Array<{ name: string; mutate: (metadata: RawRecord) => void }> = [
    { name: 'missing baselineAverages key', mutate: (value) => delete value.baselineAverages },
    {
      name: 'extra metadata key',
      mutate: (value) => {
        value.unexpected = true;
      },
    },
    {
      name: 'present undefined baselineAverages',
      mutate: (value) => {
        value.baselineAverages = undefined;
      },
    },
    {
      name: 'bad baseline score',
      mutate: (value) => {
        value.baselineAverages.completeness = 6;
      },
    },
    {
      name: 'bad baseline timestamp',
      mutate: (value) => {
        value.baselineAverages.updatedAt = '2026-13-01T00:00:00.000Z';
      },
    },
    {
      name: 'extra standings key',
      mutate: (value) => {
        value.allTaskStandings.extra = true;
      },
    },
    {
      name: 'sparse standing list',
      mutate: (value) => {
        value.baselineStandings.top = Array(1);
      },
    },
    {
      name: 'untrimmed student identifier',
      mutate: (value) => {
        value.allTaskStandings.top[0].studentId = ' student-0';
      },
    },
    {
      name: 'bad standing score',
      mutate: (value) => {
        value.baselineStandings.bottom[0].scores.overall = 'n';
      },
    },
    {
      name: 'wrong recentAssignmentScores length',
      mutate: (value) => {
        value.allTaskStandings.top[0].recentAssignmentScores = [];
      },
    },
    {
      name: 'custom-prototype baseline',
      mutate: (value) => {
        Object.setPrototypeOf(value.baselineAverages, { inherited: true });
      },
    },
  ];
  it.each(malformed)('rejects $name', ({ mutate }) => {
    const clean = makeMetadataGraph();
    setSourceMetadata(clean, withFiveFieldShape(sourceMetadata(clean)));
    expect(() => validateClassMetadata(clean)).not.toThrow();
    // Views share one metadata reference after setSourceMetadata, so the mutation reaches all
    // three without a clone that would erase non-serialisable prototype probes.
    const candidate = structuredClone(clean);
    mutate(sourceMetadata(candidate));
    expect(() => validateClassMetadata(candidate)).toThrow();
    expect(() => validateSyntheticAnalysisGraph(candidate)).toThrow();
  });
});

/** Asserts one generated snapshot's baseline and standings are deterministic supplied values. */
function expectNestedNewFields(raw: RawRecord, newest: Array<Record<string, unknown>>): void {
  const baseline = asRecord(raw.baselineAverages);
  expect(isScoreSet(baseline, true)).toBe(true);
  expect(baseline.updatedAt).toBe(newest[0].updatedAt);
  for (const basis of ['allTaskStandings', 'baselineStandings'] as const) {
    const standings = asRecord(raw[basis]);
    expect(Object.keys(standings).sort()).toEqual(['bottom', 'top']);
    for (const listName of ['top', 'bottom'] as const) {
      const list = standings[listName];
      expect(Array.isArray(list) && list.length <= 3).toBe(true);
      for (const item of list as unknown[]) {
        const standing = asRecord(item);
        expect(Object.keys(standing).sort()).toEqual([...STANDING_KEYS].sort());
        // Identity format is a generator choice; determinism is pinned by byte reproducibility.
        expect(standing.studentId).toBe(standing.studentId.trim());
        expect(standing.studentId.length).toBeGreaterThan(0);
        expect(standing.studentName).toBe(standing.studentName.trim());
        expect(standing.studentName.length).toBeGreaterThan(0);
        expect(isScoreSet(standing.scores)).toBe(true);
        expect(standing.recentAssignmentScores).toHaveLength(
          (raw.recentAssignments as unknown[]).length
        );
        for (const scoreSet of standing.recentAssignmentScores as unknown[]) {
          expect(isScoreSet(scoreSet)).toBe(true);
        }
      }
    }
  }
}

/** Reports whether a raw metadata value owns all five contract fields. */
function hasFiveFieldShape(value: RawRecord): boolean {
  return FIVE_FIELD_KEYS.every((key) => Object.hasOwn(value, key));
}

/** Requires a plain object where a nested metadata record is expected. */
function asRecord(value: unknown): RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a nested metadata record.');
  }
  return value as RawRecord;
}

/** Reports whether a value is one fixed score template, optionally with a timestamp. */
function isScoreSet(value: unknown, includeTimestamp = false): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as RawRecord;
  const metrics = ['accuracy', 'completeness', 'overall', 'spag'];
  const expected = (includeTimestamp ? [...metrics, 'updatedAt'] : metrics).sort().join();
  if (Object.keys(record).sort().join() !== expected) return false;
  return SCORE_TEMPLATES.some((template) =>
    ['completeness', 'accuracy', 'spag', 'overall'].every(
      (metric) => (template as RawRecord)[metric] === record[metric]
    )
  );
}

/** Builds a controlled five-field snapshot from a raw two-field corpus record. */
function withFiveFieldShape(metadata: RawRecord): RawRecord {
  const scores = { ...metadata.classAverages };
  delete scores.updatedAt;
  const recentAssignments = metadata.recentAssignments as RawRecord[];
  const standing = (suffix: string): RawRecord => ({
    studentId: `student-${suffix}`,
    studentName: `Student ${suffix}`,
    scores: { ...scores },
    recentAssignmentScores: recentAssignments.map((assignment) => ({ ...assignment.averages })),
  });
  return {
    ...metadata,
    baselineAverages: { ...scores, updatedAt: metadata.classAverages.updatedAt },
    allTaskStandings: { top: [standing('0')], bottom: [] },
    baselineStandings: { top: [], bottom: [standing('1')] },
  };
}

/** Clones a canonical graph for controlled raw-validator probes. */
function makeMetadataGraph(): RawGraph {
  const graph = structuredClone(generateSyntheticAnalysisGraph('medium')) as unknown as RawGraph;
  sourceMetadata(graph);
  return graph;
}

/** Returns the first non-null canonical metadata record in a graph clone. */
function sourceMetadata(graph: RawGraph): RawRecord {
  const metadata = graph.persistence.classes[0].metadata;
  if (metadata === null) throw new Error('Expected a non-null canonical metadata case.');
  return metadata;
}

/** Replaces the source metadata and keeps its three views aligned by reference. */
function setSourceMetadata(graph: RawGraph, metadata: RawRecord): void {
  const classId = graph.persistence.classes[0].classId;
  graph.persistence.classes[0].metadata = metadata;
  graph.transport.classPartials.find((row) => row.classId === classId)!.metadata = metadata;
  graph.transport.classesById[classId].metadata = metadata;
}
