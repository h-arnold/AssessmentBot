/**
 * Focused adapter tests: recent-assignment selection, ordering, date
 * formatting, and definitionKey mapping for the Class page adapter
 * (`classPageAdapter.ts`).
 *
 * @remarks
 * Shared fixture builders live in
 * `src/test/classPage/classPageAdapterTestFixtures.ts`.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, expect, it } from 'vitest';
import { createDefinitionPartial } from '@/test/dataAnalysis/fixtures';
import {
  DEFAULT_TS,
  assignment,
  averagingResult,
  canonicalFullHistoryAdapterInput,
  classFull,
  computedPerTaskRow,
  singleAssignmentAdapterInput,
  student,
} from '@/test/classPage/classPageAdapterTestFixtures';
import { adaptClassPageToViewModel } from './classPageAdapter';
import { TaskTitlesUnavailableError } from '@/services/dataAnalysis/heatmapAdapter';
import type { PerTaskRow } from '@/services/dataAnalysis/dataAnalysis.zod';

/** Assignment count that distinguishes the full history from the old three-item cap. */
const MORE_THAN_THREE_ASSIGNMENTS = 3;

describe('adaptClassPageToViewModel', () => {
  describe('recentAssignments', () => {
    it('returns empty array when the class has no assignments', () => {
      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult(),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [],
        }),
        assignmentDefinitionPartials: [],
      });

      expect(result.recentAssignments).toEqual([]);
    });

    it('returns every canonical class assignment in descending updatedAt order without truncating older assignments', () => {
      const input = canonicalFullHistoryAdapterInput();
      const suppliedAssignments = input.classFull.assignments;
      if (suppliedAssignments.length <= MORE_THAN_THREE_ASSIGNMENTS) {
        throw new Error('Canonical fixture must supply more than three assignments');
      }

      // Independent newest-first derivation from the raw canonical input:
      // updatedAt descending, with ascending assignmentId as tie-break.
      const expectedIds = suppliedAssignments
        .toSorted((left, right) => {
          return (
            String(right.updatedAt).localeCompare(String(left.updatedAt)) ||
            left.assignmentId.localeCompare(right.assignmentId)
          );
        })
        .map((supplied) => supplied.assignmentId);

      const result = adaptClassPageToViewModel(input);

      const returnedIds = result.recentAssignments.map((card) => card.assignmentId);
      expect(result.recentAssignments).toHaveLength(suppliedAssignments.length);
      expect(returnedIds).toEqual(expectedIds);
    });

    // Algorithmic boundary: equal `updatedAt` values are not present in the
    // corpus, and local control is required to isolate the ascending-ID tie-break.
    it('orders every equal-timestamp assignment by ascending assignmentId', () => {
      const suppliedAssignmentIds = ['a-3', 'a-1', 'a-4', 'a-2'];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({ perTask: [] }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: suppliedAssignmentIds.map((assignmentId) => {
            return assignment({
              assignmentId,
              updatedAt: DEFAULT_TS,
              definitionKey: `dk-${assignmentId}`,
            });
          }),
        }),
        assignmentDefinitionPartials: suppliedAssignmentIds.map((assignmentId) =>
          createDefinitionPartial({ definitionKey: `dk-${assignmentId}` })
        ),
      });

      const returnedIds = result.recentAssignments.map((card) => card.assignmentId);
      expect(result.recentAssignments).toHaveLength(suppliedAssignmentIds.length);
      expect(returnedIds).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
    });

    it('preserves millisecond precision when sorting assignments by lastAssessedAt', () => {
      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: [],
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-3',
              updatedAt: '2026-01-01T00:00:00.002Z',
              definitionKey: 'dk-3',
            }),
            assignment({
              assignmentId: 'a-1',
              updatedAt: '2026-01-01T00:00:00.000Z',
              definitionKey: 'dk-1',
            }),
            assignment({
              assignmentId: 'a-2',
              updatedAt: '2026-01-01T00:00:00.001Z',
              definitionKey: 'dk-2',
            }),
          ],
        }),
        assignmentDefinitionPartials: ['dk-1', 'dk-2', 'dk-3'].map((dk) =>
          createDefinitionPartial({ definitionKey: dk })
        ),
      });

      expect(result.recentAssignments[0].assignmentId).toBe('a-3');
      expect(result.recentAssignments[1].assignmentId).toBe('a-2');
      expect(result.recentAssignments[2].assignmentId).toBe('a-1');
    });
  });

  describe('recentAssignments — baseline-mode card rollups', () => {
    it('restricts card rollups to rows inside the attempt baseline when the applied mode is topDecileBaseline', () => {
      // The card's aggregates recompute from baseline-restricted per-task
      // evidence: t1 is inside the baseline set, t2 is outside it, so the
      // card's rollups must reflect t1 only.
      const perTaskRows: PerTaskRow[] = [
        computedPerTaskRow('dk1', 't1', { completeness: 4, accuracy: 3, spag: 2 }),
        computedPerTaskRow('dk1', 't2', { completeness: 2, accuracy: 2, spag: 2 }),
      ];

      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput(perTaskRows, {
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: { poolStudentIds: ['s-1', 's-2'], baselineTaskKeys: ['dk1::t1'] },
        })
      );

      const metrics = result.recentAssignments[0].metrics;
      expect(metrics.completeness).toMatchObject({ state: 'computed', value: 4 });
      expect(metrics.accuracy).toMatchObject({ state: 'computed', value: 3 });
      expect(metrics.spag).toMatchObject({ state: 'computed', value: 2 });
      // Average composite from the filtered criteria: 0.4*4 + 0.4*3 + 0.2*2 = 3.2
      const expectedBaselineAverage = 3.2;
      expect(metrics.average.state).toBe('computed');
      if (metrics.average.state === 'computed') {
        expect(metrics.average.value).toBeCloseTo(expectedBaselineAverage);
      }
    });

    it('keeps card rollups computed when every task row is inside the attempt baseline', () => {
      const perTaskRows: PerTaskRow[] = [
        computedPerTaskRow('dk1', 't1', { completeness: 4, accuracy: 3, spag: 2 }),
        computedPerTaskRow('dk1', 't2', { completeness: 5, accuracy: 4, spag: 3 }),
      ];

      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput(perTaskRows, {
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: {
            poolStudentIds: ['s-1', 's-2'],
            baselineTaskKeys: ['dk1::t1', 'dk1::t2'],
          },
        })
      );

      const metrics = result.recentAssignments[0].metrics;
      const expectedFullBaselineCompleteness = 4.5;
      const expectedFullBaselineAccuracy = 3.5;
      const expectedFullBaselineSpag = 2.5;
      expect(metrics.completeness).toMatchObject({ state: 'computed' });
      if (metrics.completeness.state === 'computed') {
        expect(metrics.completeness.value).toBeCloseTo(expectedFullBaselineCompleteness);
      }
      expect(metrics.accuracy).toMatchObject({ state: 'computed' });
      if (metrics.accuracy.state === 'computed') {
        expect(metrics.accuracy.value).toBeCloseTo(expectedFullBaselineAccuracy);
      }
      expect(metrics.spag).toMatchObject({ state: 'computed' });
      if (metrics.spag.state === 'computed') {
        expect(metrics.spag.value).toBeCloseTo(expectedFullBaselineSpag);
      }
      // 0.4*4.5 + 0.4*3.5 + 0.2*2.5 = 3.7
      const expectedFullBaselineAverage = 3.7;
      expect(metrics.average.state).toBe('computed');
      if (metrics.average.state === 'computed') {
        expect(metrics.average.value).toBeCloseTo(expectedFullBaselineAverage);
      }
    });
  });

  describe('date formatting', () => {
    it('formats lastAssessedAtLabel via formatUpdatedAtLabel', () => {
      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult(),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: '2025-11-05T00:00:00.000Z',
              definitionKey: 'dk1',
            }),
          ],
        }),
        assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'dk1' })],
      });

      expect(result.recentAssignments).toHaveLength(1);
      const card = result.recentAssignments[0];
      // formatUpdatedAtLabel('2025-11-05T00:00:00.000Z', en-GB, UTC) => '05/11/2025'
      expect(card.lastAssessedAt).toBe('2025-11-05T00:00:00.000Z');
      expect(card.lastAssessedAtLabel).toBe('05/11/2025');
    });
  });

  it('matches all per-task rows by definitionKey when multiple assignments share the same definitionKey', () => {
    // Two assignments sharing definitionKey 'shared-dk', each with its own taskId.
    // Two per-task rows exist for 'shared-dk' (one per taskId). Both assignments
    // should receive both per-task rows in their recent assignment card.
    const sharedPerTaskRows: PerTaskRow[] = [
      computedPerTaskRow('shared-dk', 't1', { completeness: 4, accuracy: 3, spag: 2 }),
      computedPerTaskRow('shared-dk', 't2', { completeness: 5, accuracy: 4, spag: 3 }),
    ];

    const result = adaptClassPageToViewModel({
      analyserResult: averagingResult({
        perTask: sharedPerTaskRows,
      }),
      classFull: classFull({
        students: [student('s-1', 'Alice')],
        assignments: [
          assignment({
            assignmentId: 'a-1',
            updatedAt: DEFAULT_TS,
            definitionKey: 'shared-dk',
          }),
          assignment({
            assignmentId: 'a-2',
            updatedAt: DEFAULT_TS,
            definitionKey: 'shared-dk',
          }),
        ],
      }),
      assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'shared-dk' })],
    });

    const expectedSharedCardCount = 2;
    const expectedSharedCompletenessRollup = 4.5;

    // Both assignments should appear (no limit exceeded yet)
    expect(result.recentAssignments).toHaveLength(expectedSharedCardCount);

    // Assignment a-1 should have metrics rolled up from BOTH per-task rows
    const card1 = result.recentAssignments.find((c) => c.assignmentId === 'a-1');
    expect(card1).toBeDefined();
    expect(card1!.metrics.completeness.state).toBe('computed');
    if (card1!.metrics.completeness.state === 'computed') {
      // completeness rollup: (4*1 + 5*1) / 2 = 4.5
      expect(card1!.metrics.completeness.value).toBeCloseTo(expectedSharedCompletenessRollup);
    }

    // Assignment a-2 should also have metrics from BOTH per-task rows
    const card2 = result.recentAssignments.find((c) => c.assignmentId === 'a-2');
    expect(card2).toBeDefined();
    expect(card2!.metrics.completeness.state).toBe('computed');
    if (card2!.metrics.completeness.state === 'computed') {
      expect(card2!.metrics.completeness.value).toBeCloseTo(expectedSharedCompletenessRollup);
    }
  });

  it('produces all-notAttempted metrics when analyserResult.perTask is empty', () => {
    // A single assignment with definitionKey 'dk1' but no per-task rows.
    // The adapter should fall back to noDataMetric() for each criterion.
    const result = adaptClassPageToViewModel(singleAssignmentAdapterInput([]));

    expect(result.recentAssignments).toHaveLength(1);
    const card = result.recentAssignments[0];
    expect(card.metrics.completeness).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.accuracy).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.spag).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.average).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.completeness.totalDataPoints).toBe(0);
    expect(card.metrics.average.totalDataPoints).toBe(0);
  });

  it('throws TaskTitlesUnavailableError when assignmentDefinitionPartials has no matching entry for the assignment definitionKey', () => {
    expect(() => {
      return adaptClassPageToViewModel({
        analyserResult: averagingResult(),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'DEF_MISSING',
            }),
          ],
        }),
        assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'DEF_OTHER' })],
      });
    }).toThrow(TaskTitlesUnavailableError);
  });
});
