import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { GoogleClassroomAssignmentsResponseSchema } from './googleClassroomAssignments.zod';

describe('GoogleClassroomAssignmentsResponseSchema', () => {
  it('accepts an assignment with all fields', () => {
    expect(
      GoogleClassroomAssignmentsResponseSchema.parse([
        {
          assignmentId: 'a1',
          title: 'Essay',
          creationTime: '2024-01-01T00:00:00.000Z',
          topicId: 'abc123',
          topicName: 'Algebra',
        },
      ])
    ).toEqual([
      {
        assignmentId: 'a1',
        title: 'Essay',
        creationTime: '2024-01-01T00:00:00.000Z',
        topicId: 'abc123',
        topicName: 'Algebra',
      },
    ]);
  });

  it('accepts an assignment with nullable fields as null', () => {
    expect(
      GoogleClassroomAssignmentsResponseSchema.parse([
        { assignmentId: 'a1', title: 'Essay', creationTime: null, topicId: null, topicName: null },
      ])
    ).toEqual([
      { assignmentId: 'a1', title: 'Essay', creationTime: null, topicId: null, topicName: null },
    ]);
  });

  it('defaults missing nullable fields to null', () => {
    expect(
      GoogleClassroomAssignmentsResponseSchema.parse([{ assignmentId: 'a1', title: 'Essay' }])
    ).toEqual([
      { assignmentId: 'a1', title: 'Essay', creationTime: null, topicId: null, topicName: null },
    ]);
  });

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  const NON_STRING_ID = 100 as unknown as string;

  it('rejects topicId that is not a string', () => {
    expect(() =>
      GoogleClassroomAssignmentsResponseSchema.parse([
        { assignmentId: 'a1', title: 'Essay', topicId: NON_STRING_ID, topicName: 'Algebra' },
      ])
    ).toThrow(ZodError);
  });

  it('rejects topicName that is not a string', () => {
    expect(() =>
      GoogleClassroomAssignmentsResponseSchema.parse([
        { assignmentId: 'a1', title: 'Essay', topicId: null, topicName: NON_STRING_ID },
      ])
    ).toThrow(ZodError);
  });
});
