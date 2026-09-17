/**
 * Focused adapter tests: trust validation (null/unparseable `updatedAt`,
 * duplicate IDs) for the Class page adapter (`classPageAdapter.ts`).
 *
 * @remarks
 * Split from the original single-file `classPageAdapter.spec.ts` to keep each
 * spec module under the 500-line `max-lines` lint threshold. Shared fixture
 * builders live in `src/test/classPage/classPageAdapterTestFixtures.ts`.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TS,
  assignment,
  averagingResult,
  classFull,
  student,
} from '../../test/classPage/classPageAdapterTestFixtures';
import { adaptClassPageToViewModel } from './classPageAdapter';

describe('adaptClassPageToViewModel', () => {
  describe('trust validation', () => {
    it('throws on null updatedAt with an error referencing the assignmentId', () => {
      const nullUpdatedAtAssignment = assignment({
        assignmentId: 'a-bad',
        updatedAt: null, // null is a data bug
        definitionKey: 'dk1',
        taskIds: ['t1'],
      });

      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [student('s-1', 'Alice')],
            assignments: [nullUpdatedAtAssignment],
          }),
          assignmentDefinitionPartials: [],
        })
      ).toThrow(/a-bad/);
    });

    it('throws on unparseable updatedAt with an error referencing the assignmentId', () => {
      const badUpdatedAtAssignment = assignment({
        assignmentId: 'a-bad-format',
        updatedAt: 'not-a-valid-iso-string',
        definitionKey: 'dk1',
        taskIds: ['t1'],
      });

      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [student('s-1', 'Alice')],
            assignments: [badUpdatedAtAssignment],
          }),
          assignmentDefinitionPartials: [],
        })
      ).toThrow(/a-bad-format/);
    });

    it('throws on duplicate studentId', () => {
      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [
              student('s-1', 'Alice'),
              student('s-1', 'Alice Duplicate'), // same id
            ],
            assignments: [
              assignment({
                assignmentId: 'a-1',
                updatedAt: DEFAULT_TS,
                definitionKey: 'dk1',
                taskIds: ['t1'],
              }),
            ],
          }),
          assignmentDefinitionPartials: [],
        })
      ).toThrow(/duplicate.*student/i);
    });

    it('throws on duplicate assignmentId', () => {
      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [student('s-1', 'Alice')],
            assignments: [
              assignment({
                assignmentId: 'a-1',
                updatedAt: DEFAULT_TS,
                definitionKey: 'dk1',
                taskIds: ['t1'],
              }),
              assignment({
                assignmentId: 'a-1',
                updatedAt: DEFAULT_TS,
                definitionKey: 'dk2',
                taskIds: ['t1'],
              }), // duplicate id
            ],
          }),
          assignmentDefinitionPartials: [],
        })
      ).toThrow(/duplicate.*assignment/i);
    });
  });
});
