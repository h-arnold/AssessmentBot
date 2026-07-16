import { z } from 'zod';
import { callApi } from '../apiService';
import { logFrontendError } from '../../logging/frontendLogger';
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

const MAX_RESPONSE_PREVIEW_LENGTH = 200;
const TRUNCATION_SUFFIX = '…';

/**
 * Parses a backend response through the given schema, logging structured
 * diagnostics when the schema rejects it.
 *
 * The transport layer (`callApi`) enriches only transport-level failures.
 * Schema validation runs after the payload has been received, so a rejection
 * here would otherwise surface as a bare `ZodError` with no clue which method
 * or which part of the payload failed. This mirrors `callApi`'s
 * `buildFailureMetadata` by attaching the backend `method`, the structured
 * `zodIssues`, and a truncated `responsePreview`.
 *
 * @template T The expected parsed response type.
 * @param {z.ZodType<T>} schema Schema to validate the response against.
 * @param {string} method Backend method name that produced the response.
 * @param {unknown} data Raw response returned from `callApi`.
 * @returns {T} The validated response.
 */
function parseResponseWithLoggedContext<T>(schema: z.ZodType<T>, method: string, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const previewSource = typeof data === 'string' ? data : JSON.stringify(data);
      const responsePreview =
        previewSource.length > MAX_RESPONSE_PREVIEW_LENGTH
          ? `${previewSource.slice(0, MAX_RESPONSE_PREVIEW_LENGTH)}${TRUNCATION_SUFFIX}`
          : previewSource;

      logFrontendError('services/assignmentAssessment.parseResponse', error, {
        method,
        zodIssues: error.issues,
        responsePreview,
      });
    }

    throw error;
  }
}

/**
 * Starts an assessment run for the given definition, assignment, and course.
 *
 * @param {StartAssessmentRunRequest} input Request payload with definitionKey, assignmentId, and courseId.
 * @returns {Promise<null>} Promise resolving to null on success.
 */
export async function startAssessmentRun(input: StartAssessmentRunRequest): Promise<null> {
  const parsedInput = StartAssessmentRunRequestSchema.parse(input);
  return parseResponseWithLoggedContext(
    StartAssessmentRunResponseSchema,
    START_ASSESSMENT_RUN_METHOD,
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
  return parseResponseWithLoggedContext(
    AssignmentFullResponseSchema,
    GET_ASSIGNMENT_METHOD,
    await callApi(GET_ASSIGNMENT_METHOD, parsedInput)
  );
}
