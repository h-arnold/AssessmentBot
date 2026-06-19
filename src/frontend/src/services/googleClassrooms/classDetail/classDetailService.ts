import { callApi } from '../../apiService';
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
 * The response is validated through `ClassFullResponseSchema` (Zod).
 *
 * @param {Object} parameters - Request parameters.
 * @param {string} parameters.classId - The class ID to read.
 * @returns {Promise<ClassFull | null>} Typed class response or null.
 */
export async function getABClass(parameters: { classId: string }): Promise<ClassFull | null> {
  return ClassFullResponseSchema.parse(await callApi(GET_AB_CLASS_METHOD, parameters));
}
