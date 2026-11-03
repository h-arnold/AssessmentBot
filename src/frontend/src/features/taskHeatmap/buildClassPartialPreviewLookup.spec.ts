/**
 * Tests for the embedded heatmap's class-partial preview lookup.
 *
 * @remarks
 * The lookup is the only source of a known result while the full read is
 * pending or has failed, so these cases pin which partial entries can be shown
 * at all: a known explicit `E` is usable card data, while a redacted partial
 * entry with no error is not.
 */

import { describe, expect, it } from 'vitest';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { buildClassPartialPreviewLookup } from './buildClassPartialPreviewLookup';
import { createAssignmentPartial } from '@/test/dataAnalysis/fixtures';
import type { createSubmissionItem } from '@/test/dataAnalysis/fixtures';
import { createClassFull as createHeatmapClassFull } from '@/test/heatmapsPageDataFixtures';

const STUDENT_ID = 's-1';
const TASK_ID = 'tA';
const TASK_KEY = 'def1::tA';
const ERROR_REASONING = 'The extracted work could not be assessed.';
const ERROR_CAUSE = { stage: 'assessment', code: 'ASSESSMENT_FAILED' } as const;

type PartialAssessments = Record<string, unknown>;

/**
 * Build a class whose single assignment carries one partial submission item.
 * @param {PartialAssessments} assessments - The item's partial assessments.
 * @returns {ClassFull} The class snapshot.
 */
function createClassWithPartialItem(assessments: PartialAssessments): ClassFull {
  const assignment = createAssignmentPartial({
    assignmentId: 'a1',
    definitionKey: 'def1',
    submissions: [
      {
        studentId: STUDENT_ID,
        studentName: 'Student One',
        assignmentId: 'a1',
        documentId: null,
        items: {
          [TASK_ID]: {
            id: `${TASK_ID}_item`,
            taskId: TASK_ID,
            artifact: {
              taskId: TASK_ID,
              role: 'submission',
              pageId: null,
              documentId: null,
              content: null,
              contentHash: null,
              metadata: undefined,
              uid: `${TASK_ID}_uid`,
              type: 'base',
            },
            assessments,
          } as unknown as ReturnType<typeof createSubmissionItem>,
        },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
  });
  return createHeatmapClassFull({ assignments: [assignment] });
}

describe('buildClassPartialPreviewLookup', () => {
  it('projects a known class-partial E into a preview cell', () => {
    const lookup = buildClassPartialPreviewLookup(
      createClassWithPartialItem({
        completeness: { score: 'E', reasoning: ERROR_REASONING, error: ERROR_CAUSE },
        accuracy: { score: 3 },
        spag: { score: 'N' },
      }),
      'a1'
    );

    const cell = lookup.get(STUDENT_ID)?.get(TASK_KEY);
    expect(cell).toMatchObject({
      artifactType: 'base',
      artifactContent: null,
      sourceUrl: null,
      reasoning: { completeness: ERROR_REASONING, accuracy: null, spag: null },
      errors: { completeness: ERROR_CAUSE, accuracy: null, spag: null },
    });
  });

  it('omits an item whose partial assessments carry no known error', () => {
    const lookup = buildClassPartialPreviewLookup(
      createClassWithPartialItem({ completeness: { score: 3 }, accuracy: { score: 3 } }),
      'a1'
    );

    expect(lookup.get(STUDENT_ID)).toBeUndefined();
  });

  it('returns an empty lookup when the class has no such assignment', () => {
    const lookup = buildClassPartialPreviewLookup(createClassWithPartialItem({}), 'missing');

    expect(lookup.size).toBe(0);
  });
});
