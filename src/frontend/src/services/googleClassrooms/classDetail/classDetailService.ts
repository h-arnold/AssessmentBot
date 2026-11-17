import { callApi, parseApiResponse } from '@/services/apiService';
import { normaliseClassRead } from '@/services/assignmentAssessment/assignmentReadNormalisation';
import { logFrontendError } from '@/logging/frontendLogger';
import {
  ClassFullResponseSchema,
  GetABClassRequestSchema,
  type ClassFull,
  type GetABClassRequest,
} from './classDetailService.zod';

export type {
  ClassFull,
  TeacherSummary,
  StudentSummary,
  AssignmentPartial,
} from './classDetailService.zod';

const GET_AB_CLASS_METHOD = 'getABClass';

/**
 * Retrieves the full class document for a given class ID.
 *
 * @remarks
 * Returns `null` when the backend reports the class does not exist
 * (ClassNotFoundError mapped to null at the transport boundary).
 * A root-only response parse fails fast on transport-shape errors, then
 * `normaliseClassRead()` performs the single per-item validation pass and
 * returns the typed result.
 * Existing classes retain required nullable ABClass summary `metadata`, distinct
 * from task-artifact metadata and top-level not-found `null`. Missing or malformed
 * summary metadata fails response parsing; no frontend legacy default is applied.
 *
 * @param {GetABClassRequest} parameters Request payload with `classId`.
 * @returns {Promise<ClassFull | null>} Typed class response or null.
 */
export async function getABClass(parameters: GetABClassRequest): Promise<ClassFull | null> {
  const parsedInput = GetABClassRequestSchema.parse(parameters);
  const responseData = await callApi(GET_AB_CLASS_METHOD, parsedInput);
  const rootResponse =
    responseData === null
      ? null
      : { ...(responseData as Record<string, unknown>), assignments: [] };
  parseApiResponse(ClassFullResponseSchema, GET_AB_CLASS_METHOD, rootResponse);
  try {
    return normaliseClassRead(responseData);
  } catch (error: unknown) {
    logFrontendError('services/classDetailService.getABClass', error, {
      method: GET_AB_CLASS_METHOD,
    });
    throw error;
  }
}
