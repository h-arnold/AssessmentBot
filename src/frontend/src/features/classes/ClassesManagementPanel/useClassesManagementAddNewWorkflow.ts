import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/query/queryKeys';

export interface ClassesManagementAddNewWorkflow {
  manageCohortsModalOpen: boolean;
  manageYearGroupsModalOpen: boolean;
  onCohortAddNew: () => void;
  onCohortEntityCreated: (entity: { key: string }) => void;
  onYearGroupAddNew: () => void;
  onYearGroupEntityCreated: (entity: { key: string }) => void;
  pendingCreatedCohortKey: string | undefined;
  pendingCreatedYearGroupKey: string | undefined;
  setCohortManagerOpen: (isOpen: boolean) => void;
  setYearGroupManagerOpen: (isOpen: boolean) => void;
}

/**
 * Owns the 'Add new' cohort/year-group manager flow for the classes panel.
 *
 * Tracks the manager-modal open state and the newly created keys that the
 * create/select modals should preselect, and invalidates the reference-data
 * queries once an entity has been created.
 *
 * @returns {ClassesManagementAddNewWorkflow} Manager state and handlers.
 */
export function useClassesManagementAddNewWorkflow(): ClassesManagementAddNewWorkflow {
  const queryClient = useQueryClient();
  const [manageCohortsModalOpen, setManageCohortsModalOpen] = useState(false);
  const [manageYearGroupsModalOpen, setManageYearGroupsModalOpen] = useState(false);
  const [pendingCreatedCohortKey, setPendingCreatedCohortKey] = useState<string | undefined>();
  const [pendingCreatedYearGroupKey, setPendingCreatedYearGroupKey] = useState<
    string | undefined
  >();

  // Handlers for 'Add new' cohort/year group workflow
  const onCohortAddNew = useCallback(() => {
    setManageCohortsModalOpen(true);
  }, []);

  const onYearGroupAddNew = useCallback(() => {
    setManageYearGroupsModalOpen(true);
  }, []);

  const onCohortEntityCreated = useCallback(
    (entity: { key: string }) => {
      setPendingCreatedCohortKey(entity.key);
      // Invalidate cohorts query so the dropdown refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
    },
    [queryClient]
  );

  const onYearGroupEntityCreated = useCallback(
    (entity: { key: string }) => {
      setPendingCreatedYearGroupKey(entity.key);
      // Invalidate yearGroups query so the dropdown refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.yearGroups() });
    },
    [queryClient]
  );

  return {
    manageCohortsModalOpen,
    manageYearGroupsModalOpen,
    onCohortAddNew,
    onCohortEntityCreated,
    onYearGroupAddNew,
    onYearGroupEntityCreated,
    pendingCreatedCohortKey,
    pendingCreatedYearGroupKey,
    setCohortManagerOpen: setManageCohortsModalOpen,
    setYearGroupManagerOpen: setManageYearGroupsModalOpen,
  };
}
