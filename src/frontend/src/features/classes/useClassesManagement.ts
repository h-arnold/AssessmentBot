import { useQuery } from '@tanstack/react-query';
import { getGoogleClassroomsQueryOptions } from '../../query/sharedQueries';

export type ClassesManagementViewState = 'loading' | 'ready' | 'error';

export type ClassesManagementState = Readonly<{
  classesManagementViewState: ClassesManagementViewState;
  classesCount: number | null;
  errorMessage: string | null;
}>;

/**
 * Provides shell state for the Classes management feature.
 *
 * @returns {ClassesManagementState} The current Classes management state.
 */
export function useClassesManagement(): ClassesManagementState {
  const googleClassroomsQuery = useQuery(getGoogleClassroomsQueryOptions());

  if (googleClassroomsQuery.isPending) {
    return {
      classesManagementViewState: 'loading',
      classesCount: null,
      errorMessage: null,
    };
  }

  if (googleClassroomsQuery.isError) {
    return {
      classesManagementViewState: 'error',
      classesCount: null,
      errorMessage: 'Unable to load classes right now.',
    };
  }

  return {
    classesManagementViewState: 'ready',
    classesCount: googleClassroomsQuery.data.length,
    errorMessage: null,
  };
}
