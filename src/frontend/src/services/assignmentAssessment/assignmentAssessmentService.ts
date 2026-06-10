import { callApi } from '../apiService';
import {
  StartAssessmentRunRequestSchema,
  StartAssessmentRunResponseSchema,
  type StartAssessmentRunRequest,
} from './assignmentAssessment.zod';

const START_ASSESSMENT_RUN_METHOD = 'startAssessmentRun';

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
