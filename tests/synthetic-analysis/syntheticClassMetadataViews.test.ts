import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

type Scores = Record<'completeness' | 'accuracy' | 'spag' | 'overall', number | string>;
type Metadata = {
  classAverages: Scores & { updatedAt: string };
  recentAssignments: Array<{
    assignmentId: string;
    assignmentDefinitionKey: string;
    averages: Scores;
    updatedAt: string;
  }>;
};
type Graph = {
  manifest: { seed: number; generatedEntityCounts: Record<string, number> };
  persistence: {
    classes: Array<{ classId: string; metadata?: Metadata | null }>;
    assignments: Array<Record<string, any>>;
    assignmentDefinitions: Array<Record<string, any>>;
  };
  transport: {
    classPartials: Array<{ classId: string; metadata?: Metadata | null }>;
    classesById: Record<string, { metadata?: Metadata | null }>;
  };
};

const SCORE_TEMPLATES: Record<string, Scores> = {
  numeric: { completeness: 4, accuracy: 3.5, spag: 4.5, overall: 3.9 },
  N: { completeness: 'N', accuracy: 'N', spag: 'N', overall: 'N' },
  E: { completeness: 'E', accuracy: 'E', spag: 'E', overall: 'E' },
  excluded: {
    completeness: 'excluded',
    accuracy: 'excluded',
    spag: 'excluded',
    overall: 'excluded',
  },
  mixed: { completeness: 4, accuracy: 3, spag: 'N', overall: 3.5 },
};

const MATRIX: Record<string, Array<null | { template: string; count: number }>> = {
  small: [null, { template: 'numeric', count: 0 }, { template: 'N', count: 1 }],
  medium: [
    { template: 'E', count: 2 },
    { template: 'excluded', count: 3 },
    { template: 'mixed', count: 1 },
    { template: 'numeric', count: 0 },
  ],
  'large-representative': [
    null,
    { template: 'numeric', count: 3 },
    { template: 'mixed', count: 2 },
    { template: 'numeric', count: 1 },
  ],
};

function expectIndependentOwnership(first: Metadata, second: Metadata) {
  expect(first).not.toBe(second);
  expect(first.classAverages).not.toBe(second.classAverages);
  expect(first.recentAssignments).not.toBe(second.recentAssignments);
  for (const [index, firstEntry] of first.recentAssignments.entries()) {
    const secondEntry = second.recentAssignments[index];
    expect(firstEntry).not.toBe(secondEntry);
    expect(firstEntry.averages).not.toBe(secondEntry.averages);
  }
}

describe('canonical class metadata views', () => {
  it('projects the exact compact matrix with parity, linkage, and detached ownership', () => {
    for (const profile of Object.keys(MATRIX)) {
      const graph = generateSyntheticAnalysisGraph(profile) as Graph;
      const cases = MATRIX[profile];
      expect(graph.persistence.classes).toHaveLength(cases.length);

      for (const [index, persisted] of graph.persistence.classes.entries()) {
        const partial = graph.transport.classPartials.find(
          (row) => row.classId === persisted.classId
        );
        const full = graph.transport.classesById[persisted.classId];
        expect(partial).toBeDefined();
        expect(full).toBeDefined();
        expect(Object.hasOwn(persisted, 'metadata')).toBe(true);
        expect(Object.hasOwn(partial!, 'metadata')).toBe(true);
        expect(Object.hasOwn(full!, 'metadata')).toBe(true);
        expect(persisted.metadata).toStrictEqual(partial?.metadata);
        expect(persisted.metadata).toStrictEqual(full?.metadata);

        const expected = cases[index];
        if (expected === null) {
          expect(persisted.metadata).toBeNull();
          expect(partial?.metadata).toBeNull();
          expect(full?.metadata).toBeNull();
          continue;
        }

        expect(persisted.metadata).not.toBeNull();
        expect(partial?.metadata).not.toBeNull();
        expect(full?.metadata).not.toBeNull();
        const persistedMetadata = persisted.metadata!;
        const partialMetadata = partial!.metadata!;
        const fullMetadata = full!.metadata!;
        expectIndependentOwnership(persistedMetadata, partialMetadata);
        expectIndependentOwnership(persistedMetadata, fullMetadata);
        expectIndependentOwnership(partialMetadata, fullMetadata);

        const expectedScores = SCORE_TEMPLATES[expected.template];
        expect(persistedMetadata.classAverages).toStrictEqual({
          ...expectedScores,
          updatedAt: expect.any(String),
        });
        expect(persistedMetadata.recentAssignments).toHaveLength(expected.count);
        expect(persistedMetadata.recentAssignments.map(({ averages }) => averages)).toEqual(
          Array.from({ length: expected.count }, () => expectedScores)
        );

        const classAssignments = graph.persistence.assignments.filter(
          (assignment) => assignment.courseId === persisted.classId
        );
        const newestFirst = [...classAssignments].sort((left, right) =>
          String(right.updatedAt).localeCompare(String(left.updatedAt))
        );
        expect(persistedMetadata.classAverages.updatedAt).toBe(newestFirst[0].updatedAt);
        expect(persistedMetadata.recentAssignments.map(({ assignmentId }) => assignmentId)).toEqual(
          newestFirst.slice(0, expected.count).map(({ assignmentId }) => assignmentId)
        );

        for (const [entryIndex, entry] of persistedMetadata.recentAssignments.entries()) {
          const source = newestFirst[entryIndex];
          expect(entry.assignmentId).toBe(source.assignmentId);
          expect(entry.assignmentDefinitionKey).toBe(source.assignmentDefinitionKey);
          expect(entry.updatedAt).toBe(source.updatedAt);
          expect(source.courseId).toBe(persisted.classId);
          expect(
            graph.persistence.assignmentDefinitions.some(
              ({ definitionKey }) => definitionKey === entry.assignmentDefinitionKey
            )
          ).toBe(true);
        }
      }
    }
  });

  it('keeps seeds, entity counts, assignment timestamps, and non-metadata projection stable', () => {
    const first = generateSyntheticAnalysisGraph('small') as Graph;
    const second = generateSyntheticAnalysisGraph('small') as Graph;
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.manifest.seed).toBe(17031);
    expect(first.manifest.generatedEntityCounts).toMatchObject({
      classes: 3,
      students: 18,
      assignments: 12,
    });
    for (const assignment of first.persistence.assignments) {
      expect(assignment.updatedAt).toEqual(expect.any(String));
    }
    const alteredSeed = generateSyntheticAnalysisGraph('small', { seed: 17032 }) as Graph;
    expect(alteredSeed.manifest.generatedEntityCounts).toEqual(
      first.manifest.generatedEntityCounts
    );
    expect(alteredSeed.persistence.classes.map(({ classId }) => classId)).toEqual(
      first.persistence.classes.map(({ classId }) => classId)
    );
  });
});
