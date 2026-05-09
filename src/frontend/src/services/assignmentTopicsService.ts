import { callApi } from './apiService';
import {
  AssignmentTopicsResponseSchema,
  type AssignmentTopicsResponse,
} from './assignmentTopics.zod';

const GET_ASSIGNMENT_TOPICS_METHOD = 'getAssignmentTopics';

export type { AssignmentTopic, AssignmentTopicsResponse } from './assignmentTopics.zod';

/**
 * Retrieves assignment-topic reference data from backend transport.
 *
 * This dataset is part of the startup warm-up surface because it supports the assignment-definition
 * wizard modal workflow alongside other shared reference data. The resolved topic names are used
 * for display while topic keys are authoritative for persistence and duplicate detection.
 *
 * @returns {Promise<AssignmentTopicsResponse>} Promise resolving to validated assignment topics
 *   as an array of { key, name } objects.
 */
export async function getAssignmentTopics(): Promise<AssignmentTopicsResponse> {
  return AssignmentTopicsResponseSchema.parse(await callApi(GET_ASSIGNMENT_TOPICS_METHOD));
}
