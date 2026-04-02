import { describe, expect, it } from 'vitest';

describe('googleClassrooms.zod schemas', () => {
    it('GoogleClassroomSchema accepts the backend classroom summary contract', async () => {
        const { GoogleClassroomSchema } = await import('./googleClassrooms.zod');

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

    it('GoogleClassroomsResponseSchema rejects malformed classroom payloads and strips no extra contract fields into the frontend cache', async () => {
        const { GoogleClassroomsResponseSchema } = await import('./googleClassrooms.zod');

        expect(() =>
            GoogleClassroomsResponseSchema.parse([
                {
                    classId: 'course-001',
                },
            ])
        ).toThrow();

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
    });
});
