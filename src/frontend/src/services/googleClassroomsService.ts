import { callApi } from './apiService';
import {
  GoogleClassroomsResponseSchema,
  type GoogleClassroomsResponse,
} from './googleClassrooms.zod';

export type { GoogleClassroom } from './googleClassrooms.zod';

const GET_GOOGLE_CLASSROOMS_METHOD = 'getGoogleClassrooms';

/**
 * Retrieves the active Google Classroom summaries from the backend transport.
 *
 * @returns {Promise<GoogleClassroomsResponse>} Promise resolving to validated classroom summaries.
 */
export async function getGoogleClassrooms(): Promise<GoogleClassroomsResponse> {
  return GoogleClassroomsResponseSchema.parse(await callApi(GET_GOOGLE_CLASSROOMS_METHOD));
}
