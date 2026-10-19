import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { validateClassMetadata } from '#synthetic-data/validateClassMetadata.js';
import { validateSyntheticAnalysisGraph } from '#synthetic-data/validateSyntheticAnalysisGraph.js';

type Graph = {
  manifest: Record<string, unknown>;
  referenceData: Record<string, unknown>;
  persistence: { classes: Array<any>; assignments: Array<any>; assignmentDefinitions: Array<any> };
  transport: { classPartials: Array<any>; classesById: Record<string, any> };
};

type Corruption = {
  name: string;
  isolatedRule: string;
  path: string;
  mutate: (graph: Graph) => void;
};

describe('canonical class metadata integrity', () => {
  it.each(['small', 'medium', 'large-representative'])(
    'validates raw generated snapshots through the backend domain for %s',
    (profile) => {
      const graph = generateSyntheticAnalysisGraph(profile) as Graph;
      const domain = (globalThis as any).ABClassMetadata;
      expect(typeof domain?.validateMetadata).toBe('function');
      for (const classDocument of graph.persistence.classes) {
        expect(Object.hasOwn(classDocument, 'metadata')).toBe(true);
        if (Object.hasOwn(classDocument, 'metadata')) {
          expect(() => domain.validateMetadata(classDocument.metadata)).not.toThrow();
        }
      }
    }
  );

  it('accepts each current compact graph with the dedicated integrity helper', () => {
    for (const profile of ['small', 'medium', 'large-representative']) {
      expect(() => validateClassMetadata(generateSyntheticAnalysisGraph(profile))).not.toThrow();
    }
  });

  const corruptions: Corruption[] = [
    {
      name: 'missing metadata',
      isolatedRule: 'required presence',
      path: 'persistence.classes',
      mutate: (graph) => {
        delete graph.persistence.classes[0].metadata;
      },
    },
    {
      name: 'malformed metadata shape',
      isolatedRule: 'complete class averages',
      path: 'classAverages.accuracy',
      mutate: (graph) => {
        graph.persistence.classes[0].metadata!.classAverages.accuracy = undefined;
      },
    },
    {
      name: 'invalid score',
      isolatedRule: 'score union',
      path: 'classAverages.completeness',
      mutate: (graph) => {
        graph.persistence.classes[0].metadata!.classAverages.completeness = 6;
      },
    },
    {
      name: 'unknown assignment',
      isolatedRule: 'assignment existence',
      path: 'recentAssignments[0].assignmentId',
      mutate: (graph) => {
        graph.persistence.classes[0].metadata!.recentAssignments[0].assignmentId =
          'unknown-assignment';
      },
    },
    {
      name: 'wrong class membership',
      isolatedRule: 'class membership',
      path: 'recentAssignments[0].assignmentId',
      mutate: (graph) => {
        const target = graph.persistence.classes[0];
        const foreign = graph.persistence.assignments.find(
          (assignment) => assignment.courseId !== target.classId
        )!;
        const entry = target.metadata!.recentAssignments[0];
        Object.assign(entry, {
          assignmentId: foreign.assignmentId,
          assignmentDefinitionKey: foreign.assignmentDefinitionKey,
          updatedAt: foreign.updatedAt,
        });
      },
    },
    {
      name: 'wrong definition',
      isolatedRule: 'assignment-definition linkage',
      path: 'recentAssignments[0].assignmentDefinitionKey',
      mutate: (graph) => {
        const entry = graph.persistence.classes[0].metadata!.recentAssignments[0];
        const assignment = graph.persistence.assignments.find(
          (row) => row.assignmentId === entry.assignmentId
        )!;
        const foreign = graph.persistence.assignmentDefinitions.find(
          (row) => row.definitionKey !== assignment.assignmentDefinitionKey
        )!;
        entry.assignmentDefinitionKey = foreign.definitionKey;
      },
    },
    {
      name: 'wrong exact source timestamp',
      isolatedRule: 'exact source timestamp',
      path: 'recentAssignments[0].updatedAt',
      mutate: (graph) => {
        graph.persistence.classes[0].metadata!.recentAssignments[0].updatedAt =
          '2099-01-01T00:00:00.000Z';
      },
    },
    {
      name: 'invalid order',
      isolatedRule: 'newest-first ordering',
      path: 'recentAssignments',
      mutate: (graph) => {
        const metadata = graph.persistence.classes[0].metadata!;
        metadata.recentAssignments = [...metadata.recentAssignments].reverse();
      },
    },
    {
      name: 'four complete entries overflow',
      isolatedRule: 'maximum three entries',
      path: 'recentAssignments',
      mutate: (graph) => {
        const metadata = graph.persistence.classes[0].metadata!;
        const assignments = graph.persistence.assignments
          .filter((row) => row.courseId === graph.persistence.classes[0].classId)
          .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, 4);
        metadata.recentAssignments = assignments.map((assignment) => ({
          assignmentId: assignment.assignmentId,
          assignmentDefinitionKey: assignment.assignmentDefinitionKey,
          averages: { completeness: 4, accuracy: 3.5, spag: 4.5, overall: 3.9 },
          updatedAt: assignment.updatedAt,
        }));
      },
    },
    {
      name: 'partial view drift',
      isolatedRule: 'classPartials parity',
      path: 'transport.classPartials',
      mutate: (graph) => {
        graph.transport.classPartials[0].metadata = null;
      },
    },
    {
      name: 'full view drift',
      isolatedRule: 'classesById parity',
      path: 'transport.classesById',
      mutate: (graph) => {
        graph.transport.classesById[graph.persistence.classes[0].classId].metadata = null;
      },
    },
  ];

  it.each(corruptions)('rejects $name via its isolated $isolatedRule rule', ({ mutate, path }) => {
    const baseline = generateSyntheticAnalysisGraph('medium') as Graph;
    expect(() => validateClassMetadata(baseline)).not.toThrow();
    const clone = structuredClone(baseline);
    mutate(clone);
    if (!path.startsWith('transport.')) {
      const classDocument = clone.persistence.classes[0];
      const partial = clone.transport.classPartials.find(
        (row) => row.classId === classDocument.classId
      )!;
      const full = clone.transport.classesById[classDocument.classId];
      if (Object.hasOwn(classDocument, 'metadata')) {
        partial.metadata = structuredClone(classDocument.metadata);
        full.metadata = structuredClone(classDocument.metadata);
      } else {
        delete partial.metadata;
        delete full.metadata;
      }
    }
    expect(() => validateClassMetadata(clone)).toThrow(path);
  });

  it.each([
    ['invalid month', '2026-13-01T00:00:00.000Z'],
    ['invalid time', '2026-01-01T25:00:00.000Z'],
    ['normalised calendar overflow', '2026-02-30T00:00:00.000Z'],
  ])('rejects %s with an actionable timestamp diagnostic', (_case, value) => {
    const graph = structuredClone(generateSyntheticAnalysisGraph('medium')) as Graph;
    graph.persistence.classes[0].metadata!.classAverages.updatedAt = value;
    const classId = graph.persistence.classes[0].classId;
    graph.transport.classPartials.find((row) => row.classId === classId)!.metadata =
      structuredClone(graph.persistence.classes[0].metadata);
    graph.transport.classesById[classId].metadata = structuredClone(
      graph.persistence.classes[0].metadata
    );
    expect(() => validateClassMetadata(graph)).toThrow(
      /classAverages\.updatedAt.*canonical UTC timestamp/iu
    );
  });

  it('rejects a metadata corruption through the public graph validator', () => {
    const graph = generateSyntheticAnalysisGraph('medium') as Graph;
    const classDocument = graph.persistence.classes[0];
    expect(Object.hasOwn(classDocument, 'metadata')).toBe(true);
    if (!classDocument.metadata) return;
    classDocument.metadata.classAverages.completeness = 99;
    graph.transport.classPartials[0].metadata!.classAverages.completeness = 99;
    graph.transport.classesById[classDocument.classId].metadata!.classAverages.completeness = 99;
    expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(/classAverages\.completeness/iu);
  });
});
