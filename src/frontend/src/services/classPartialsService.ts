import { callApi } from './apiService';
import { ClassPartialsResponseSchema, type ClassPartial } from './classPartials.zod';

export type { ClassPartial, TeacherSummary } from './classPartials.zod';

const GET_AB_CLASS_PARTIALS_METHOD = 'getABClassPartials';

/**
 * Retrieves all class partial documents from the backend registry.
 *
 * The backend normalises stored partial records to this transport shape before
 * returning them, so storage-only fields are not exposed here.
 *
 * @returns Promise resolving to an array of validated class partial transport objects.
 */
export async function getABClassPartials(): Promise<ClassPartial[]> {
    return ClassPartialsResponseSchema.parse(await callApi(GET_AB_CLASS_PARTIALS_METHOD));
}
