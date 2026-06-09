import { z } from 'zod';

const GoogleClassroomAssignmentSchema = z.strictObject({
  assignmentId: z.string().min(1),
  title: z.string().min(1),
  topicId: z.string().nullable().default(null),
  topicName: z.string().nullable().default(null),
});

export const GoogleClassroomAssignmentsResponseSchema = z.array(GoogleClassroomAssignmentSchema);

export type GoogleClassroomAssignmentsResponse = z.infer<
  typeof GoogleClassroomAssignmentsResponseSchema
>;
