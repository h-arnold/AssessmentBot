import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  getClassPartialsQueryOptions,
  getCohortsQueryOptions,
  getGoogleClassroomsQueryOptions,
  getYearGroupsQueryOptions,
} from '../../query/sharedQueries';
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

function toLabelsByKey(records: readonly { key: string; name: string }[]): Readonly<Record<string, string>> {
  return records.reduce<Record<string, string>>((labelsByKey, record) => {
    labelsByKey[record.key] = record.name;
    return labelsByKey;
  }, {});
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

  const rows = useMemo(() => {
    if (
      googleClassroomsQuery.data === undefined
      || classPartialsQuery.data === undefined
      || cohortsQuery.data === undefined
      || yearGroupsQuery.data === undefined
    ) {
      return [];
    }

    return buildClassesManagementRows({
      googleClassrooms: googleClassroomsQuery.data,
      classPartials: classPartialsQuery.data,
      cohortLabelsByKey: toLabelsByKey(cohortsQuery.data),
      yearGroupLabelsByKey: toLabelsByKey(yearGroupsQuery.data),
    });
  }, [classPartialsQuery.data, cohortsQuery.data, googleClassroomsQuery.data, yearGroupsQuery.data]);

  useEffect(() => {
    const prunedKeys = pruneSelectedRowKeys(selectedRowKeys, rows);
    if (prunedKeys.length !== selectedRowKeys.length) {
      setSelectedRowKeys(prunedKeys);
    }
  }, [rows, selectedRowKeys]);

  if (
    googleClassroomsQuery.isPending
    || classPartialsQuery.isPending
    || cohortsQuery.isPending
    || yearGroupsQuery.isPending
  ) {
    return {
      classesManagementViewState: 'loading',
      classesCount: null,
      errorMessage: null,
      rows: [],
      selectedRowKeys,
      onSelectedRowKeysChange: setSelectedRowKeys,
    };
  }

  if (
    googleClassroomsQuery.isError
    || classPartialsQuery.isError
    || cohortsQuery.isError
    || yearGroupsQuery.isError
  ) {
    return {
      classesManagementViewState: 'error',
      classesCount: null,
      errorMessage: 'Unable to load classes right now.',
      rows: [],
      selectedRowKeys,
      onSelectedRowKeysChange: setSelectedRowKeys,
    };
  }

  return {
    classesManagementViewState: 'ready',
    classesCount: rows.length,
    errorMessage: null,
    rows,
    selectedRowKeys,
    onSelectedRowKeysChange: setSelectedRowKeys,
  };
}
