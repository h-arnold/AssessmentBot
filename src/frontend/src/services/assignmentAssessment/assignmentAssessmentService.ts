import { callApi, parseApiResponse } from '../apiService';
import { normaliseAssignmentRead } from './assignmentReadNormalisation';
import { logFrontendError } from '@/logging/frontendLogger';
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
  return parseApiResponse(
    StartAssessmentRunResponseSchema,
    START_ASSESSMENT_RUN_METHOD,
    await callApi(START_ASSESSMENT_RUN_METHOD, parsedInput)
  ) as null;
}

/**
 * Fetches the fully rehydrated Assignment for a single assignment.
 *
 * @remarks Wraps the backend `getAssignment` method (dispatches internally to `getAssignment_`). The response is the full
 * rehydrated `Assignment.toReadJSON()` shape (not a partial). A root-only
 * response parse fails fast on transport-shape errors, then
 * `normaliseAssignmentRead()` performs the single per-item validation pass and
 * returns the typed result. `null` means the assignment document was not found.
 *
 * @param {GetAssignmentRequest} input Request payload with `courseId` and `assignmentId`.
 * @returns {Promise<AssignmentFullResponse>} Promise resolving to the full assignment, or `null` if not found.
 */
export async function getAssignment(input: GetAssignmentRequest): Promise<AssignmentFullResponse> {
  const parsedInput = GetAssignmentRequestSchema.parse(input);
  const response = await callApi(GET_ASSIGNMENT_METHOD, parsedInput);
  const rootResponse =
    response === null ? null : { ...(response as Record<string, unknown>), submissions: [] };
  parseApiResponse(AssignmentFullResponseSchema, GET_ASSIGNMENT_METHOD, rootResponse);
  try {
    return normaliseAssignmentRead(response);
  } catch (error: unknown) {
    logFrontendError('services/assignmentAssessment.getAssignment', error, {
      method: GET_ASSIGNMENT_METHOD,
    });
    throw error;
  }
}
