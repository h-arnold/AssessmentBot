import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  GoogleClassroomSchema,
  GoogleClassroomsResponseSchema,
} from './googleClassrooms.zod';

describe('googleClassrooms.zod schemas', () => {
  it('GoogleClassroomSchema accepts the backend classroom summary contract', () => {
    expect(
      GoogleClassroomSchema.parse({
        classId: 'course-001',
        className: '10A Computer Science',
      })
    ).toEqual({
      classId: 'course-001',
      className: '10A Computer Science',
    });
  });

  it('GoogleClassroomsResponseSchema rejects malformed classroom payloads and strips extra contract fields from the frontend cache', () => {
    expect(
      GoogleClassroomsResponseSchema.parse([
        {
          classId: 'course-001',
          className: '10A Computer Science',
          enrollmentCode: 'ABC123',
        },
      ])
    ).toEqual([
      {
        classId: 'course-001',
        className: '10A Computer Science',
      },
    ]);

    expect(() =>
      GoogleClassroomsResponseSchema.parse([
        {
          classId: 'course-002',
        },
      ])
    ).toThrow(ZodError);
  });
});
