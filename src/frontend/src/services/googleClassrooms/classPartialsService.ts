import { callApi, parseApiResponse } from '../apiService';
import { ClassPartialsResponseSchema, type ClassPartial } from './classPartials.zod';

export type { ClassPartial, TeacherSummary } from './classPartials.zod';

const GET_AB_CLASS_PARTIALS_METHOD = 'getABClassPartials';

/**
 * Retrieves all class partial documents from the backend registry.
 *
 * The backend normalises stored partial records to this transport shape before
 * returning them, so storage-only fields are not exposed here.
 *
 * @remarks Each partial retains required nullable ABClass summary `metadata`.
 * Missing or malformed metadata fails response parsing; no frontend legacy
 * default is applied. An empty registry still returns `[]`.
 *
 * @returns {Promise<ClassPartial[]>} Promise resolving to validated class partial transport objects.
 */
export async function getABClassPartials(): Promise<ClassPartial[]> {
  return parseApiResponse(
    ClassPartialsResponseSchema,
    GET_AB_CLASS_PARTIALS_METHOD,
    await callApi(GET_AB_CLASS_PARTIALS_METHOD)
  );
}
