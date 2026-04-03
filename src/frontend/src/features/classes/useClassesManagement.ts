import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getClassPartialsQueryOptions,
  getCohortsQueryOptions,
  getGoogleClassroomsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../query/sharedQueries';
import type { ClassPartial } from '../../services/classPartialsService';
import type { GoogleClassroom } from '../../services/googleClassroomsService';
import type { Cohort, YearGroup } from '../../services/referenceData.zod';
import { buildClassesManagementRows, type ClassesManagementRow } from './classesManagementViewModel';
import { pruneSelectedRowKeys } from './selectionState';

export type ClassesManagementViewState = 'loading' | 'ready' | 'error';

export type ClassesManagementState = Readonly<{
  classesManagementViewState: ClassesManagementViewState;
  classesCount: number | null;
  errorMessage: string | null;
  rows: ClassesManagementRow[];
  selectedRowKeys: string[];
  onSelectedRowKeysChange: (selectedRowKeys: string[]) => void;
}>;

type ClassesQueriesState = Readonly<{
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
  classPartials: readonly ClassPartial[];
  cohorts: readonly Cohort[];
  googleClassrooms: readonly GoogleClassroom[];
  yearGroups: readonly YearGroup[];
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
    classPartials: queryState.classPartialsQuery.data as readonly ClassPartial[],
    cohorts: queryState.cohortsQuery.data as readonly Cohort[],
    googleClassrooms: queryState.googleClassroomsQuery.data as readonly GoogleClassroom[],
    yearGroups: queryState.yearGroupsQuery.data as readonly YearGroup[],
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
    googleClassrooms: [...readyQueryState.googleClassrooms],
    classPartials: [...readyQueryState.classPartials],
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
    hasErrorStartupDataset: querySnapshots.some((querySnapshot) => querySnapshot.isError),
    hasPendingStartupDataset: querySnapshots.some((querySnapshot) => querySnapshot.isPending),
    readyQueryState,
  };
}

/**
 * Provides shell state for the Classes management feature.
 *
 * @returns {ClassesManagementState} The current Classes management state.
 */
export function useClassesManagement(): ClassesManagementState {
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

  if (queryState.hasPendingStartupDataset) {
    return {
      classesManagementViewState: 'loading',
      classesCount: null,
      errorMessage: null,
      rows: [],
      selectedRowKeys,
      onSelectedRowKeysChange: setSelectedRowKeys,
    };
  }

  if (queryState.hasErrorStartupDataset) {
    return {
      classesManagementViewState: 'error',
      classesCount: null,
      errorMessage: 'Unable to load classes right now.',
      rows: [],
      selectedRowKeys,
      onSelectedRowKeysChange: setSelectedRowKeys,
    };
  }

  const rows = buildRowsForReadyState(queryState.readyQueryState);
  const visibleSelectedRowKeys = pruneSelectedRowKeys(selectedRowKeys, rows);

  return {
    classesManagementViewState: 'ready',
    classesCount: rows.length,
    errorMessage: null,
    rows,
    selectedRowKeys: visibleSelectedRowKeys,
    onSelectedRowKeysChange: setSelectedRowKeys,
  };
}
