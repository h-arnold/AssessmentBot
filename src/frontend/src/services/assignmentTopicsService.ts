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
 * @returns {Promise<AssignmentTopicsResponse>} Promise resolving to validated assignment topics.
 */
export async function getAssignmentTopics(): Promise<AssignmentTopicsResponse> {
  return AssignmentTopicsResponseSchema.parse(await callApi(GET_ASSIGNMENT_TOPICS_METHOD));
}
