import { z } from 'zod';

const GoogleClassroomAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
  title: z.string().min(1),
  topicId: z.string().nullable().default(null),
  topicName: z.string().nullable().default(null),
}).strict();

export const GoogleClassroomAssignmentsResponseSchema = z.array(GoogleClassroomAssignmentSchema);

export type GoogleClassroomAssignmentsResponse = z.infer<
  typeof GoogleClassroomAssignmentsResponseSchema
>;
