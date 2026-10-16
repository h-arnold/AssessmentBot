import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { validateSyntheticAnalysisGraph } from '#synthetic-data/validateSyntheticAnalysisGraph.js';

type Metadata = {
  classAverages: Record<string, unknown> & { updatedAt: string };
  recentAssignments: Array<{
    assignmentId: string;
    assignmentDefinitionKey: string;
    updatedAt: string;
    averages: Record<string, unknown>;
  }>;
} | null;

type FullGraph = {
  manifest: { seed: number; generatedEntityCounts: Record<string, number> };
  persistence: {
    classes: Array<{ classId: string; metadata?: Metadata }>;
    assignmentDefinitions: Array<{ definitionKey: string }>;
    assignments: Array<{
      assignmentId: string;
      courseId: string;
      assignmentDefinitionKey: string;
      updatedAt: string;
    }>;
  };
  transport: {
    classPartials: Array<{ classId: string; metadata?: Metadata }>;
    classesById: Record<string, { metadata?: Metadata }>;
  };
};

function expectIndependentMetadataOwnership(snapshots: Array<Metadata | undefined>) {
  for (let leftIndex = 0; leftIndex < snapshots.length; leftIndex += 1) {
    const left = snapshots[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < snapshots.length; rightIndex += 1) {
      const right = snapshots[rightIndex];
      if (!left || !right) continue;
      expect(left).not.toBe(right);
      expect(left.classAverages).not.toBe(right.classAverages);
      expect(left.recentAssignments).not.toBe(right.recentAssignments);
      for (const [index, entry] of left.recentAssignments.entries()) {
        const otherEntry = right.recentAssignments[index];
        expect(entry).not.toBe(otherEntry);
        expect(entry.averages).not.toBe(otherEntry.averages);
      }
    }
  }
}

const SCORE_TEMPLATES = [
  { completeness: 4, accuracy: 3.5, spag: 4.5, overall: 3.9 },
  { completeness: 'N', accuracy: 'N', spag: 'N', overall: 'N' },
  { completeness: 'E', accuracy: 'E', spag: 'E', overall: 'E' },
  { completeness: 'excluded', accuracy: 'excluded', spag: 'excluded', overall: 'excluded' },
  { completeness: 4, accuracy: 3, spag: 'N', overall: 3.5 },
];

const EXPECTED_RECENT_COUNTS = [null, 0, 1, 2, 3] as const;

describe('large-full canonical class metadata', () => {
  let graph: FullGraph;
  beforeAll(() => {
    graph = generateSyntheticAnalysisGraph('large-full') as FullGraph;
  });

  it('applies the compact matrix, source linkage, raw parity, and domain contract at full scale', () => {
    expect(graph.manifest.seed).toBe(41064);
    expect(graph.manifest.generatedEntityCounts).toMatchObject({
      classes: 100,
      students: 3000,
      assignments: 10000,
    });
    expect(graph.persistence.classes).toHaveLength(100);
    let nonNullCount = 0;
    const domain = (globalThis as any).ABClassMetadata;
    expect(typeof domain?.validateMetadata).toBe('function');
    if (typeof domain?.validateMetadata !== 'function') return;

    graph.persistence.classes.forEach((classDocument, index) => {
      const partial = graph.transport.classPartials.find(
        ({ classId }) => classId === classDocument.classId
      );
      const full = graph.transport.classesById[classDocument.classId];
      const metadata = classDocument.metadata;
      const recentCount = EXPECTED_RECENT_COUNTS[index % 5];
      expect(Object.hasOwn(classDocument, 'metadata')).toBe(true);
      expect(partial && Object.hasOwn(partial, 'metadata')).toBe(true);
      expect(full && Object.hasOwn(full, 'metadata')).toBe(true);
      expect(metadata).toStrictEqual(partial?.metadata);
      expect(metadata).toStrictEqual(full?.metadata);
      const snapshots = [classDocument.metadata, partial?.metadata, full?.metadata];
      expectIndependentMetadataOwnership(snapshots);
      for (const snapshot of snapshots) {
        expect(() => domain.validateMetadata(snapshot)).not.toThrow();
      }

      if (recentCount === null) {
        expect(metadata).toBeNull();
        return;
      }

      expect(metadata).not.toBeNull();
      if (!metadata) return;
      nonNullCount += 1;
      const sourceAssignments = graph.persistence.assignments
        .filter(({ courseId }) => courseId === classDocument.classId)
        .toSorted((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
      expect(sourceAssignments).toHaveLength(100);
      const templateIndex = Math.floor(index / 5) % SCORE_TEMPLATES.length;
      const template = SCORE_TEMPLATES[templateIndex];
      expect(metadata.classAverages).toStrictEqual({
        ...template,
        updatedAt: sourceAssignments[0].updatedAt,
      });
      expect(metadata.recentAssignments).toHaveLength(recentCount);
      expect(metadata.recentAssignments.map(({ assignmentId }) => assignmentId)).toEqual(
        sourceAssignments.slice(0, recentCount).map(({ assignmentId }) => assignmentId)
      );
      expect(metadata.recentAssignments).toEqual(
        sourceAssignments.slice(0, recentCount).map((assignment) => ({
          assignmentId: assignment.assignmentId,
          assignmentDefinitionKey: assignment.assignmentDefinitionKey,
          updatedAt: assignment.updatedAt,
          averages: template,
        }))
      );
      for (const entry of metadata.recentAssignments) {
        const source = sourceAssignments.find(
          ({ assignmentId }) => assignmentId === entry.assignmentId
        );
        expect(source).toBeDefined();
        expect(source?.courseId).toBe(classDocument.classId);
        expect(entry.assignmentDefinitionKey).toBe(source?.assignmentDefinitionKey);
        expect(entry.updatedAt).toBe(source?.updatedAt);
        expect(
          graph.persistence.assignmentDefinitions.some(
            ({ definitionKey }) => definitionKey === entry.assignmentDefinitionKey
          )
        ).toBe(true);
      }
    });
    expect(nonNullCount).toBe(80);
  }, 30_000);

  it('composes the full graph through the same metadata stage as compact profiles', () => {
    const source = readFileSync(
      'scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js',
      'utf8'
    );
    expect(source).toMatch(
      /import\s*\{\s*generateClassMetadata\s*\}\s*from\s*['"].\/generateClassMetadata\.js['"]/u
    );
    expect(source.match(/generateClassMetadata\s*\(/gu)).toHaveLength(1);
    expect(source).toMatch(/generateClassMetadata\s*\(\s*\{[^}]*profileDefinition/su);
    const validatorSource = readFileSync(
      'scripts/synthetic-test-data/validateSyntheticAnalysisGraph.js',
      'utf8'
    );
    expect(validatorSource).toMatch(
      /import\s*\{\s*validateClassMetadata\s*\}\s*from\s*['"].\/validateClassMetadata\.js['"]/u
    );
    expect(validatorSource.match(/validateClassMetadata\s*\(/gu)).toHaveLength(1);
  });

  it('rejects a bounded full-view metadata corruption through the public graph validator', () => {
    expect(() => validateSyntheticAnalysisGraph(graph)).not.toThrow();
    const classDocument = graph.persistence.classes.find(({ metadata }) => metadata !== null)!;
    const full = graph.transport.classesById[classDocument.classId];
    const original = full.metadata;
    expect(original).toStrictEqual(classDocument.metadata);
    full.metadata = { classAverages: { updatedAt: 'invalid' }, recentAssignments: [] };
    try {
      expect(() => validateSyntheticAnalysisGraph(graph)).toThrow(
        /metadata|classAverages|transport\.classesById/iu
      );
    } finally {
      full.metadata = original;
    }
  });
});
