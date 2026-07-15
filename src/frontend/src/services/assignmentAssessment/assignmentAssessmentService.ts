import { callApi } from '../apiService';
import {
  StartAssessmentRunRequestSchema,
  StartAssessmentRunResponseSchema,
  GetAssignmentRequestSchema,
  AssignmentFullResponseSchema,
  type StartAssessmentRunRequest,
  type GetAssignmentRequest,
  type AssignmentFullResponse,
} from './assignmentAssessment.zod';

const START_ASSESSMENT_RUN_METHOD = 'startAssessmentRun';
const GET_ASSIGNMENT_METHOD = 'getAssignment';

/**
 * Starts an assessment run for the given definition, assignment, and course.
 *
 * @param {StartAssessmentRunRequest} input Request payload with definitionKey, assignmentId, and courseId.
 * @returns {Promise<null>} Promise resolving to null on success.
 */
export async function startAssessmentRun(input: StartAssessmentRunRequest): Promise<null> {
  const parsedInput = StartAssessmentRunRequestSchema.parse(input);
  return StartAssessmentRunResponseSchema.parse(
    await callApi(START_ASSESSMENT_RUN_METHOD, parsedInput)
  ) as null;
}

/**
 * Fetches the fully rehydrated Assignment for a single assignment.
 *
 * @remarks Wraps the backend `getAssignment` method (dispatches internally to `getAssignment_`). The response is the full
 * rehydrated `Assignment.toJSON()` shape (not a partial). `null` means the
 * assignment document was not found.
 *
 * @param {GetAssignmentRequest} input Request payload with `courseId` and `assignmentId`.
 * @returns {Promise<AssignmentFullResponse>} Promise resolving to the full assignment, or `null` if not found.
 */
export async function getAssignment(input: GetAssignmentRequest): Promise<AssignmentFullResponse> {
  const parsedInput = GetAssignmentRequestSchema.parse(input);
  return AssignmentFullResponseSchema.parse(await callApi(GET_ASSIGNMENT_METHOD, parsedInput));
}
