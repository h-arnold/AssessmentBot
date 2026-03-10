import { callApi } from './apiService';

export interface TeacherSummary {
    userId: string | null;
    email: string | null;
    teacherName: string | null;
}

/**
 * Shape of a class partial document returned by the backend transport.
 * Teacher-bearing fields use TeacherSummary rather than the full Teacher model.
 */
export interface ClassPartial {
    classId: string;
    className: string | null;
    cohort: string | null;
    courseLength: number;
    yearGroup: number | null;
    classOwner: TeacherSummary | null;
    teachers: TeacherSummary[];
    active: boolean | null;
}

const GET_AB_CLASS_PARTIALS_METHOD = 'getABClassPartials';

/**
 * Retrieves all class partial documents from the backend registry.
 *
 * The backend normalises stored partial records to this transport shape before
 * returning them, so storage-only fields are not exposed here.
 *
 * @returns Promise resolving to an array of class partial transport objects.
 */
export async function getABClassPartials(): Promise<ClassPartial[]> {
    return callApi<ClassPartial[]>(GET_AB_CLASS_PARTIALS_METHOD);
}
