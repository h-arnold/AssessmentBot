import { z } from 'zod';

const GoogleClassroomAssignmentSchema = z.strictObject({
  assignmentId: z.string().min(1),
  title: z.string().min(1),
});

export const GoogleClassroomAssignmentsResponseSchema = z.array(GoogleClassroomAssignmentSchema);

export type GoogleClassroomAssignmentsResponse = z.infer<
  typeof GoogleClassroomAssignmentsResponseSchema
>;
