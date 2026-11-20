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

  it('accepts both coherent baseline availability states', () => {
    const availableSummary = createValidClassSummary();
    expect(ClassSummarySchema.parse(availableSummary)).toEqual(availableSummary);

    const unavailableSummary = createValidClassSummary();
    unavailableSummary.baseline = { available: false, classAverages: null, standings: null };
    expect(ClassSummarySchema.parse(unavailableSummary)).toEqual(unavailableSummary);
  });

  it.each([
    ['available with null standings', true, true, false],
    ['available with null class averages', true, false, true],
    ['available with both fields null', true, false, false],
    ['unavailable with class averages', false, true, false],
    ['unavailable with standings', false, false, true],
    ['unavailable with both fields set', false, true, true],
  ] as const)(
    'rejects a baseline that is %s',
    (_description, available, hasAverages, hasStandings) => {
      const summary = createValidClassSummary();
      const classAverages = summary.baseline.classAverages;
      const standings = summary.baseline.standings;
      if (standings === null) {
        throw new Error('Expected the valid summary to carry baseline standings');
      }
      summary.baseline = {
        available,
        classAverages: hasAverages ? classAverages : null,
        standings: hasStandings ? standings : null,
      };

      expect(() => ClassSummarySchema.parse(summary)).toThrow();
    }
  );

  it.each([' Alice ', '', 'Alice ', ' Alice', '\nAlice'])(
    'rejects a standing studentName that is empty or not already trimmed: %j',
    (studentName) => {
      for (const basis of ['allTasks', 'baseline'] as const) {
        const summary = createValidClassSummary();
        const standings = summary[basis].standings;
        if (standings === null) {
          throw new Error(`Expected the valid summary to carry ${basis} standings`);
        }
        standings.top[0].studentName = studentName;
        expect(
          () => ClassSummarySchema.parse(summary),
          `${basis}: ${JSON.stringify(studentName)}`
        ).toThrow();
      }
    }
  );

  it('accepts ordinary already-trimmed standing names', () => {
    const summary = createValidClassSummary();
    summary.allTasks.standings.top[0].studentName = 'Alice';
    if (summary.baseline.standings === null) {
      throw new Error('Expected the valid summary to carry baseline standings');
    }
    summary.baseline.standings.top[0].studentName = 'Bob';

    expect(ClassSummarySchema.parse(summary)).toEqual(summary);
  });
});
