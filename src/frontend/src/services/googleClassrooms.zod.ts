import { z } from 'zod';

const NonEmptyStringSchema = z.string().trim().min(1);

export const GoogleClassroomSchema = z.object({
  classId: NonEmptyStringSchema,
  className: NonEmptyStringSchema,
});

export type GoogleClassroom = z.infer<typeof GoogleClassroomSchema>;

export const GoogleClassroomsResponseSchema = z.array(GoogleClassroomSchema);

export type GoogleClassroomsResponse = z.infer<typeof GoogleClassroomsResponseSchema>;
