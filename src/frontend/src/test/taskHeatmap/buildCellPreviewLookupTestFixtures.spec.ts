/**
 * Independence tests for the shared `createAssignment` fixture builder.
 *
 * Pins that every call hands the caller a detached payload: the module-level
 * minimal assignment definition and the submission metadata spread from the
 * shared `BASE_ARTIFACT_FIELDS` literal must never be mutated through one
 * returned assignment and leak into another.
 *
 * Also pins `buildExpectedSourceUrl`: it builds the documented editor URL from
 * usable stored IDs and fails loudly on a null or blank expected document ID
 * rather than fabricating a URL.
 */

import { describe, it, expect } from 'vitest';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import {
  BASE_ARTIFACT_FIELDS,
  DEFAULT_DATE,
  buildExpectedSourceUrl,
  createAssignment,
} from './buildCellPreviewLookupTestFixtures';

/**
 * Build a submission literal that spreads the shared base artifact fields,
 * mirroring how the `buildCellPreviewLookup` spec family constructs fixtures.
 *
 * @returns {AssignmentFull['submissions']} A single submission carrying shared artifact fields.
 */
function createSubmissionWithSharedFields(): AssignmentFull['submissions'] {
  return [
    {
      studentId: 'student-1',
      studentName: 'Alice',
      assignmentId: 'assignment-1',
      documentId: null,
      items: {
        'item-1': {
          id: 'item-1',
          taskId: 'task-1',
          artifact: {
            ...BASE_ARTIFACT_FIELDS,
            type: 'TEXT' as const,
            content: 'Response',
            taskId: 'task-1',
          },
          assessments: {},
          feedback: {},
        },
      },
      createdAt: DEFAULT_DATE,
      updatedAt: DEFAULT_DATE,
    },
  ];
}

describe('createAssignment fixture independence', () => {
  it('returns an independent assignmentDefinition for every call', () => {
    const first = createAssignment([]);
    const second = createAssignment([]);

    expect(first.assignmentDefinition).not.toBe(second.assignmentDefinition);
    expect(first.assignmentDefinition.tasks).not.toBe(second.assignmentDefinition.tasks);

    first.assignmentDefinition.alternateTitles.push('Mutated after creation');

    expect(second.assignmentDefinition.alternateTitles).toEqual([]);
  });

  it('detaches submission artifact metadata from the caller shared fields', () => {
    const sharedSubmissions = createSubmissionWithSharedFields();
    const first = createAssignment(sharedSubmissions);
    const second = createAssignment(sharedSubmissions);

    first.submissions[0].items['item-1'].artifact.metadata.leaked = true;

    expect(second.submissions[0].items['item-1'].artifact.metadata).toEqual({});
    expect(sharedSubmissions[0].items['item-1'].artifact.metadata).toEqual({});
  });
});

describe('buildExpectedSourceUrl', () => {
  it('builds the Slides editor URL from usable stored IDs', () => {
    expect(buildExpectedSourceUrl('SLIDES', ' doc-1 ', ' pg-1 ')).toBe(
      'https://docs.google.com/presentation/d/doc-1/edit#slide=id.pg-1'
    );
  });

  it('throws on a null expected document ID instead of fabricating a URL', () => {
    expect(() => buildExpectedSourceUrl('SLIDES', null, 'pg-1')).toThrow(
      /expected document ID is null/
    );
  });

  it('throws on a blank expected document ID instead of fabricating a URL', () => {
    expect(() => buildExpectedSourceUrl('SHEETS', '   ', '0')).toThrow(
      /expected document ID is blank/
    );
  });
});
