import { callApi } from './apiService';
import type { GoogleClassroomAssignmentsResponse } from './googleClassroomAssignments.zod';
import { GoogleClassroomAssignmentsResponseSchema } from './googleClassroomAssignments.zod';

/**
 * Retrieves Google Classroom assignments for a given course.
 *
 * @param {string} classId Google Classroom course ID.
 * @returns {Promise<GoogleClassroomAssignmentsResponse>} The assignment list sorted by updateTime descending.
 */
export async function getGoogleClassroomAssignments(
  classId: string
): Promise<GoogleClassroomAssignmentsResponse> {
  return GoogleClassroomAssignmentsResponseSchema.parse(
    await callApi('getGoogleClassroomAssignments', { classId })
  );
}
