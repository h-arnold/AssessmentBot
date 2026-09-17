/**
 * Focused adapter tests: recent-assignment selection, ordering, date
 * formatting, and definitionKey mapping for the Class page adapter
 * (`classPageAdapter.ts`).
 *
 * @remarks
 * Split from the original single-file `classPageAdapter.spec.ts` to keep each
 * spec module under the 500-line `max-lines` lint threshold. Shared fixture
 * builders live in `src/test/classPage/classPageAdapterTestFixtures.ts`.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, expect, it } from 'vitest';
import { createDefinitionPartial } from '../../test/dataAnalysis/fixtures';
import {
  DEFAULT_TS,
  assignment,
  averagingResult,
  classFull,
  computedPerTaskRow,
  singleAssignmentAdapterInput,
  student,
} from '../../test/classPage/classPageAdapterTestFixtures';
import { adaptClassPageToViewModel } from './classPageAdapter';
import { TaskTitlesUnavailableError } from '../../services/dataAnalysis/heatmapAdapter';
import type { PerTaskRow } from '../../services/dataAnalysis/dataAnalysis.zod';

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

    it('returns up to 3 assignments sorted by updatedAt descending', () => {
      const perTaskRows: PerTaskRow[] = [
        computedPerTaskRow('dk-a', 't1', { completeness: 4, accuracy: 3, spag: 2 }),
        computedPerTaskRow('dk-b', 't1', { completeness: 5, accuracy: 4, spag: 3 }),
        computedPerTaskRow('dk-c', 't1', { completeness: 3, accuracy: 2, spag: 1 }),
        computedPerTaskRow('dk-d', 't1', { completeness: 2, accuracy: 2, spag: 2 }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: perTaskRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-D',
              updatedAt: '2026-04-01T00:00:00.000Z',
              definitionKey: 'dk-d',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-C',
              updatedAt: '2026-03-01T00:00:00.000Z',
              definitionKey: 'dk-c',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-B',
              updatedAt: '2026-05-01T00:00:00.000Z',
              definitionKey: 'dk-b',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-A',
              updatedAt: '2026-06-01T00:00:00.000Z',
              definitionKey: 'dk-a',
              taskIds: ['t1'],
            }),
          ],
        }),
        assignmentDefinitionPartials: ['dk-a', 'dk-b', 'dk-c', 'dk-d'].map((dk) =>
          createDefinitionPartial({ definitionKey: dk })
        ),
      });

      const expectedTopCount = 3;
      expect(result.recentAssignments).toHaveLength(expectedTopCount);
      // Most recent 3 by updatedAt: a-A (June), a-B (May), a-D (April)
      expect(result.recentAssignments[0].assignmentId).toBe('a-A');
      expect(result.recentAssignments[1].assignmentId).toBe('a-B');
      expect(result.recentAssignments[2].assignmentId).toBe('a-D');
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
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-1',
              updatedAt: '2026-01-01T00:00:00.000Z',
              definitionKey: 'dk-1',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-2',
              updatedAt: '2026-01-01T00:00:00.001Z',
              definitionKey: 'dk-2',
              taskIds: ['t1'],
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
              taskIds: ['t1'],
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
            taskIds: ['t1'],
          }),
          assignment({
            assignmentId: 'a-2',
            updatedAt: DEFAULT_TS,
            definitionKey: 'shared-dk',
            taskIds: ['t2'],
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
    const result = adaptClassPageToViewModel(singleAssignmentAdapterInput([], ['t1']));

    expect(result.recentAssignments).toHaveLength(1);
    const card = result.recentAssignments[0];
    expect(card.metrics.completeness).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.accuracy).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.spag).toMatchObject({ state: 'notAttempted' });
    expect(card.metrics.average).toMatchObject({ state: 'notAttempted' });
  });

  it('throws TaskTitlesUnavailableError when assignmentDefinitionPartials has no matching entry for the assignment definitionKey', () => {
    expect(() =>
      adaptClassPageToViewModel({
        analyserResult: averagingResult(),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'DEF_MISSING',
              taskIds: ['t1'],
            }),
          ],
        }),
        assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'DEF_OTHER' })],
      })
    ).toThrow(TaskTitlesUnavailableError);
  });
});
