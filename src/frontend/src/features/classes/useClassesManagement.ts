import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getClassPartialsQueryOptions,
  getCohortsQueryOptions,
  getGoogleClassroomsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../query/sharedQueries';
import { useStartupWarmupState } from '../auth/startupWarmupState';
import type { ClassPartial } from '../../services/classPartialsService';
import type { GoogleClassroom } from '../../services/googleClassroomsService';
import type { Cohort, YearGroup } from '../../services/referenceData.zod';
import { buildClassesManagementRows, type ClassesManagementRow } from './classesManagementViewModel';
import { pruneSelectedRowKeys } from './selectionState';

export type ClassesManagementViewState = 'loading' | 'ready' | 'error';

export type ClassesManagementState = Readonly<{
  blockingErrorMessage: string | null;
  classesManagementViewState: ClassesManagementViewState;
  classesCount: number | null;
  cohorts: Cohort[];
  errorMessage: string | null;
  nonBlockingWarningMessage: string | null;
  refreshRequiredMessage: string | null;
  rows: ClassesManagementRow[];
  selectedRowKeys: string[];
  yearGroups: YearGroup[];
  onSelectedRowKeysChange: (selectedRowKeys: string[]) => void;
}>;

type ClassesQueriesState = Readonly<{
  hasAnyBlockingDataGap: boolean;
  hasErrorStartupDataset: boolean;
  hasPendingStartupDataset: boolean;
  readyQueryState: ReadyClassesQueryState | null;
}>;

type ClassesQuerySnapshot = Readonly<{
  data: unknown;
  isError: boolean;
  isPending: boolean;
}>;

type ReadyClassesQueryState = Readonly<{
  classPartials: ClassPartial[];
  cohorts: Cohort[];
  googleClassrooms: GoogleClassroom[];
  yearGroups: YearGroup[];
}>;

/**
 * Indexes record labels by key.
 *
 * @param {readonly { key: string; name: string }[]} records Records to index.
 * @returns {Readonly<Record<string, string>>} Labels by key.
 */
function toLabelsByKey(
  records: readonly { key: string; name: string }[]
): Readonly<Record<string, string>> {
  const labelsByKey: Record<string, string> = {};

  for (const record of records) {
    labelsByKey[record.key] = record.name;
  }

  return labelsByKey;
}

/**
 * Derives readiness flags from the four classes-related queries.
 *
 * @param {Readonly<{
 *   googleClassroomsQuery: ReturnType<typeof useQuery>;
 *   classPartialsQuery: ReturnType<typeof useQuery>;
 *   cohortsQuery: ReturnType<typeof useQuery>;
 *   yearGroupsQuery: ReturnType<typeof useQuery>;
 * }>} queryState Query state inputs.
 * @returns {ReadyClassesQueryState | null} Typed ready datasets when all are available.
 */
function getReadyClassesQueryState(queryState: Readonly<{
  googleClassroomsQuery: ReturnType<typeof useQuery>;
  classPartialsQuery: ReturnType<typeof useQuery>;
  cohortsQuery: ReturnType<typeof useQuery>;
  yearGroupsQuery: ReturnType<typeof useQuery>;
}>): ReadyClassesQueryState | null {
  if (
    queryState.googleClassroomsQuery.data === undefined ||
    queryState.classPartialsQuery.data === undefined ||
    queryState.cohortsQuery.data === undefined ||
    queryState.yearGroupsQuery.data === undefined
  ) {
    return null;
  }

  return {
    classPartials: queryState.classPartialsQuery.data as ClassPartial[],
    cohorts: queryState.cohortsQuery.data as Cohort[],
    googleClassrooms: queryState.googleClassroomsQuery.data as GoogleClassroom[],
    yearGroups: queryState.yearGroupsQuery.data as YearGroup[],
  };
}

/**
 * Builds merged rows when all required datasets are available.
 *
 * @param {ReadyClassesQueryState | null} readyQueryState Typed ready-state query data.
 * @returns {ClassesManagementRow[]} Merged rows when ready, otherwise empty rows.
 */
function buildRowsForReadyState(readyQueryState: ReadyClassesQueryState | null): ClassesManagementRow[] {
  if (readyQueryState === null) {
    return [];
  }

  return buildClassesManagementRows({
    googleClassrooms: readyQueryState.googleClassrooms,
    classPartials: readyQueryState.classPartials,
    cohortLabelsByKey: toLabelsByKey(readyQueryState.cohorts),
    yearGroupLabelsByKey: toLabelsByKey(readyQueryState.yearGroups),
  });
}

/**
 * Derives readiness flags from the four classes-related queries.
 *
 * @param {readonly ClassesQuerySnapshot[]} querySnapshots Snapshot list for all required datasets.
 * @param {ReadyClassesQueryState | null} readyQueryState Typed ready-state data.
 * @returns {ClassesQueriesState} Derived readiness flags.
 */
function createClassesQueriesState(
  querySnapshots: readonly ClassesQuerySnapshot[],
  readyQueryState: ReadyClassesQueryState | null
): ClassesQueriesState {
  return {
    hasAnyBlockingDataGap: querySnapshots.some((querySnapshot) => querySnapshot.data === undefined),
    hasErrorStartupDataset: querySnapshots.some((querySnapshot) => querySnapshot.isError),
    hasPendingStartupDataset: querySnapshots.some((querySnapshot) => querySnapshot.isPending),
    readyQueryState,
  };
}

/**
 * Builds the non-ready shell state when startup data is still loading or blocked.
 *
 * @param {Readonly<{
 *   queryState: ClassesQueriesState;
 *   selectedRowKeys: string[];
 *   setSelectedRowKeys: (selectedRowKeys: string[]) => void;
 *   startupWarmupFailed: boolean;
 * }>} options Derived readiness inputs.
 * @returns {ClassesManagementState | null} Non-ready state, or null when ready.
 */
function getNonReadyClassesManagementState(options: Readonly<{
  queryState: ClassesQueriesState;
  selectedRowKeys: string[];
  setSelectedRowKeys: (selectedRowKeys: string[]) => void;
  startupWarmupFailed: boolean;
}>): ClassesManagementState | null {
  if (options.queryState.hasPendingStartupDataset) {
    return {
      blockingErrorMessage: null,
      classesManagementViewState: 'loading',
      classesCount: null,
      cohorts: [],
      errorMessage: null,
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: options.selectedRowKeys,
      yearGroups: [],
      onSelectedRowKeysChange: options.setSelectedRowKeys,
    };
  }

  if (options.queryState.hasAnyBlockingDataGap) {
    return {
      blockingErrorMessage: 'Unable to load active Google Classrooms right now.',
      classesManagementViewState: 'error',
      classesCount: null,
      cohorts: [],
      errorMessage: 'Unable to load classes right now.',
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: options.selectedRowKeys,
      yearGroups: [],
      onSelectedRowKeysChange: options.setSelectedRowKeys,
    };
  }

  if (options.startupWarmupFailed) {
    return {
      blockingErrorMessage: 'Required startup data failed to load. Reload the page and try again.',
      classesManagementViewState: 'error',
      classesCount: null,
      cohorts: [],
      errorMessage: 'Unable to load classes right now.',
      nonBlockingWarningMessage: null,
      refreshRequiredMessage: null,
      rows: [],
      selectedRowKeys: options.selectedRowKeys,
      yearGroups: [],
      onSelectedRowKeysChange: options.setSelectedRowKeys,
    };
  }

  return null;
}

/**
 * Provides shell state for the Classes management feature.
 *
 * @returns {ClassesManagementState} The current Classes management state.
 */
export function useClassesManagement(): ClassesManagementState {
  const startupWarmupState = useStartupWarmupState();
  const googleClassroomsQuery = useQuery(getGoogleClassroomsQueryOptions());
  const classPartialsQuery = useQuery(getClassPartialsQueryOptions());
  const cohortsQuery = useQuery(getCohortsQueryOptions());
  const yearGroupsQuery = useQuery(getYearGroupsQueryOptions());
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const querySnapshots: readonly ClassesQuerySnapshot[] = [
    googleClassroomsQuery,
    classPartialsQuery,
    cohortsQuery,
    yearGroupsQuery,
  ];
  const readyQueryState = getReadyClassesQueryState({
    googleClassroomsQuery,
    classPartialsQuery,
    cohortsQuery,
    yearGroupsQuery,
  });
  const queryState = createClassesQueriesState(querySnapshots, readyQueryState);
  const nonReadyState = getNonReadyClassesManagementState({
    queryState,
    selectedRowKeys,
    setSelectedRowKeys,
    startupWarmupFailed: startupWarmupState.isFailed,
  });

  if (nonReadyState !== null) {
    return nonReadyState;
  }

  const rows = buildRowsForReadyState(queryState.readyQueryState);
  const visibleSelectedRowKeys = pruneSelectedRowKeys(selectedRowKeys, rows);

  return {
    blockingErrorMessage: null,
    classesManagementViewState: 'ready',
    classesCount: rows.length,
    cohorts: queryState.readyQueryState?.cohorts ?? [],
    errorMessage: null,
    nonBlockingWarningMessage: null,
    refreshRequiredMessage: null,
    rows,
    selectedRowKeys: visibleSelectedRowKeys,
    yearGroups: queryState.readyQueryState?.yearGroups ?? [],
    onSelectedRowKeysChange: setSelectedRowKeys,
  };
}
