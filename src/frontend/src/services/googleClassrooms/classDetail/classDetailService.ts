import { callApi, parseApiResponse } from '@/services/apiService';
import { normaliseClassRead } from '@/services/assignmentAssessment/assignmentReadNormalisation';
import { ClassFullResponseSchema, type ClassFull } from './classDetailService.zod';

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
 * The response is normalised for item-level read corruption, then validated
 * through `ClassFullResponseSchema` (Zod).
 * Existing classes retain required nullable ABClass summary `metadata`, distinct
 * from task-artifact metadata and top-level not-found `null`. Missing or malformed
 * summary metadata fails response parsing; no frontend legacy default is applied.
 *
 * @param {Object} parameters - Request parameters.
 * @param {string} parameters.classId - The class ID to read.
 * @returns {Promise<ClassFull | null>} Typed class response or null.
 */
export async function getABClass(parameters: { classId: string }): Promise<ClassFull | null> {
  const responseData = await callApi(GET_AB_CLASS_METHOD, parameters);
  const rootResponse =
    responseData === null
      ? null
      : { ...(responseData as Record<string, unknown>), assignments: [] };
  parseApiResponse(ClassFullResponseSchema, GET_AB_CLASS_METHOD, rootResponse);
  return parseApiResponse(
    ClassFullResponseSchema,
    GET_AB_CLASS_METHOD,
    normaliseClassRead(responseData)
  );
}
