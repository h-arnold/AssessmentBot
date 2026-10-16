import { describe, expect, it } from 'vitest';

import { ABClassMetadata } from '#backend/Models/ABClassMetadata.js';
import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

type Snapshot = {
  classId: string;
  metadata?: Metadata | null;
};

type Metadata = {
  classAverages: {
    completeness: number | string;
    accuracy: number | string;
    spag: number | string;
    overall: number | string;
  };
  recentAssignments: unknown[];
};

type Graph = {
  persistence: { classes: Snapshot[] };
  transport: {
    classPartials: Snapshot[];
    classesById: Record<string, Snapshot>;
  };
};

const PROFILE_MATRIX = {
  small: {
    nonNull: 2,
    variants: { numeric: 1, N: 1 },
  },
  medium: {
    nonNull: 4,
    variants: { E: 1, excluded: 1, mixed: 1, numeric: 1 },
  },
  'large-representative': {
    nonNull: 3,
    variants: { numeric: 2, mixed: 1 },
  },
} as const;

function scoreVariant(metadata: Metadata): string {
  const scores = metadata.classAverages;
  if (
    typeof scores.completeness === 'string' &&
    ['N', 'E', 'excluded'].includes(scores.completeness)
  ) {
    return scores.completeness;
  }
  if (scores.accuracy === 3.5) return 'numeric';
  return 'mixed';
}

describe('canonical class metadata domain acceptance', () => {
  for (const [profile, expected] of Object.entries(PROFILE_MATRIX)) {
    const graph = generateSyntheticAnalysisGraph(profile) as Graph;
    const snapshots = [
      ...graph.persistence.classes.map((row) => ({ view: 'persistence', row })),
      ...graph.transport.classPartials.map((row) => ({ view: 'classPartials', row })),
      ...Object.values(graph.transport.classesById).map((row) => ({ view: 'classesById', row })),
    ];

    it.each(snapshots)(
      `validates ${profile}/$view/$row.classId with the backend domain`,
      ({ view, row }) => {
        let validationError: unknown;
        try {
          ABClassMetadata.validateMetadata(row.metadata);
        } catch (error) {
          validationError = error;
        }

        expect(
          Object.hasOwn(row, 'metadata'),
          `${profile}/${view}/${row.classId} owns metadata`
        ).toBe(true);
        expect(
          validationError,
          `${profile}/${view}/${row.classId} passes ABClassMetadata.validateMetadata`
        ).toBeUndefined();
      }
    );

    it(`pins expected non-null metadata coverage for ${profile}`, () => {
      let nonNullCount = 0;
      const variants: Record<string, number> = {};
      expect(snapshots).toHaveLength(graph.persistence.classes.length * 3);
      for (const { row } of snapshots) {
        if (row.metadata !== null && row.metadata !== undefined) {
          nonNullCount += 1;
          const variant = scoreVariant(row.metadata);
          variants[variant] = (variants[variant] ?? 0) + 1;
        }
      }

      expect(nonNullCount).toBe(expected.nonNull * 3);
      for (const [variant, classCount] of Object.entries(expected.variants)) {
        expect(variants[variant]).toBe(classCount * 3);
      }
    });
  }
});
