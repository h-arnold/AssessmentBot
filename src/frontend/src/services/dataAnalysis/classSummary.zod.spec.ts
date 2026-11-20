/**
 * Validation contract for the in-memory `ClassSummary` shape.
 *
 * Boundary fixtures are local and minimal on purpose: this suite pins schema
 * placement and invariants (four-state analyser-native metrics, aligned
 * per-assignment score arrays, disjoint standings), not corpus realism. The
 * realistic derivation contract is covered by `classSummaryAnalyser.spec.ts`
 * against the canonical `medium` view.
 */

import { describe, expect, it } from 'vitest';
import { ClassSummarySchema, type ClassSummary } from './classSummary.zod';
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
  createNotAttemptedMetricResult,
} from '@/test/dataAnalysis/fixtures';

/** Canonical ISO-with-timezone timestamp used by the summary fixtures. */
const UPDATED_AT = '2026-01-02T09:03:00.000Z';

/**
 * Build a four-metric set from explicit analyser-native results.
 * @returns {ClassSummary['allTasks']['classAverages']} A valid metric set.
 */
function createMetricScores(): ClassSummary['allTasks']['classAverages'] {
  return {
    completeness: createComputedMetricResult({ value: 4 }),
    accuracy: createComputedMetricResult({ value: 3.5 }),
    spag: createNotAttemptedMetricResult(),
    overall: createComputedMetricResult({ value: 3.8 }),
  };
}

/**
 * Build one complete, schema-valid summary with all four metric states present.
 * @returns {ClassSummary} A valid summary fixture.
 */
function createValidClassSummary(): ClassSummary {
  const classAverages = createMetricScores();
  const excludedAverages: ClassSummary['allTasks']['classAverages'] = {
    completeness: createExcludedMetricResult(),
    accuracy: createExcludedMetricResult(),
    spag: createErrorMetricResult(),
    overall: createExcludedMetricResult(),
  };
  const recentAssignments = [
    {
      assignmentId: 'a_newest',
      assignmentDefinitionKey: 'dk_newest',
      updatedAt: UPDATED_AT,
    },
    {
      assignmentId: 'a_previous',
      assignmentDefinitionKey: 'dk_previous',
      updatedAt: '2026-01-01T09:03:00.000Z',
    },
  ];
  const recentAssignmentScores = [createMetricScores(), excludedAverages];

  return {
    classId: 'c_001',
    allTasks: {
      classAverages,
      standings: {
        top: [
          {
            studentId: 's_001',
            studentName: 'Alice',
            scores: createMetricScores(),
            recentAssignmentScores,
          },
        ],
        bottom: [
          {
            studentId: 's_003',
            studentName: 'Carol',
            scores: excludedAverages,
            recentAssignmentScores: [createMetricScores(), excludedAverages],
          },
        ],
      },
    },
    baseline: {
      available: true,
      classAverages,
      standings: {
        top: [
          {
            studentId: 's_002',
            studentName: 'Bob',
            scores: createMetricScores(),
            recentAssignmentScores,
          },
        ],
        bottom: [],
      },
    },
    target: {
      assignmentId: 'a_newest',
      assignmentDefinitionKey: 'dk_newest',
      updatedAt: UPDATED_AT,
      averages: createMetricScores(),
    },
    recentAssignments,
  };
}

describe('ClassSummarySchema', () => {
  it('accepts a complete valid summary with analyser-native four-state metrics', () => {
    const summary = createValidClassSummary();

    expect(() => ClassSummarySchema.parse(summary)).not.toThrow();
    expect(ClassSummarySchema.parse(summary)).toEqual(summary);
  });

  it('rejects unexpected own fields at the summary root', () => {
    const summary = { ...createValidClassSummary(), unexpected: true };

    expect(() => ClassSummarySchema.parse(summary)).toThrow();
  });

  it('rejects wrong metric states inside a result set', () => {
    const summary = createValidClassSummary();
    summary.allTasks.classAverages = {
      ...summary.allTasks.classAverages,
      completeness: {
        state: 'computed',
        value: 'N',
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      } as unknown as ClassSummary['allTasks']['classAverages']['completeness'],
    };

    expect(() => ClassSummarySchema.parse(summary)).toThrow();
  });

  it('rejects an excluded metric with no observed data points', () => {
    const summary = createValidClassSummary();
    summary.target.averages = {
      ...summary.target.averages,
      accuracy: createExcludedMetricResult({ totalDataPoints: 0 }),
    };

    expect(() => ClassSummarySchema.parse(summary)).toThrow();
  });

  it('rejects recentAssignmentScores that do not align with recentAssignments', () => {
    const summary = createValidClassSummary();
    // Two recent assignments, but the first standing carries only one score set.
    summary.allTasks.standings.top[0].recentAssignmentScores = [
      summary.allTasks.standings.top[0].recentAssignmentScores[0],
    ];

    expect(() => ClassSummarySchema.parse(summary)).toThrow();
  });

  it('rejects a standing where one studentId appears in both top and bottom of a basis', () => {
    const summary = createValidClassSummary();
    summary.allTasks.standings.bottom[0].studentId = summary.allTasks.standings.top[0].studentId;

    expect(() => ClassSummarySchema.parse(summary)).toThrow();
  });

  it('rejects more than three recent assignments', () => {
    const summary = createValidClassSummary();
    summary.recentAssignments = Array.from({ length: 4 }, (_unused, index) => {
      return {
        assignmentId: `a_${index}`,
        assignmentDefinitionKey: `dk_${index}`,
        updatedAt: UPDATED_AT,
      };
    });

    expect(() => ClassSummarySchema.parse(summary)).toThrow();
  });
});
