import { callApi } from './apiService';

/** Shape of a class partial document returned by the backend registry. */
export interface ClassPartial {
    classId: string;
    className: string | null;
    cohort: string | null;
    courseLength: number;
    yearGroup: number | null;
    classOwner: Record<string, unknown> | null;
    teachers: unknown[];
    active: boolean | null;
}

const GET_AB_CLASS_PARTIALS_METHOD = 'getABClassPartials';

/**
 * Retrieves all class partial documents from the backend registry.
 *
 * @returns Promise resolving to an array of class partial objects.
 */
export async function getABClassPartials(): Promise<ClassPartial[]> {
    return callApi<ClassPartial[]>(GET_AB_CLASS_PARTIALS_METHOD);
}
