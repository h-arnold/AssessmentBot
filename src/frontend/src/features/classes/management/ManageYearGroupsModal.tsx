/**
 * Manage Year Groups Modal — list, create, edit, and delete year-group records.
 *
 * Reads year groups from the shared React Query cache. Successful mutations refetch the active
 * `yearGroups` query so the visible dataset stays trustworthy.
 *
 * Delete-blocked state (IN_USE from the API transport) is surfaced as an inline Alert
 * inside the delete confirmation dialog; the destructive button is disabled so the user
 * cannot retry blindly.
 *
 * Inner form and delete "dialogs" are rendered as inline elements with role="dialog"
 * inside the outer Modal body. This avoids portal async-render issues in jsdom unit
 * tests while maintaining full ARIA semantics and correct Playwright behaviour.
 */

import { Button, Space, type TableColumnType } from 'antd';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { YearGroup } from '../../../services/referenceData/referenceData.zod';
import {
  createYearGroup,
  deleteYearGroup,
  updateYearGroup,
} from '../../../services/referenceData/referenceDataService';
import { getYearGroupsQueryOptions } from '../../../query/sharedQueries';
import { ReferenceDataInitialLoadingState } from '../components/ReferenceDataInitialLoadingState';
import { ReferenceDataManagementModalScaffold } from './ReferenceDataManagementModalScaffold';
import { useReferenceDataManagement } from '../hooks/useReferenceDataManagement';

export type ManageYearGroupsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
  onEntityCreated?: (entity: { key: string; name: string }) => void;
}>;

const FORM_DIALOG_LABEL_ID = 'manage-year-groups-form-dialog-title';
const DELETE_DIALOG_LABEL_ID = 'manage-year-groups-delete-dialog-title';

/**
 * Builds the column definitions for the year groups management table.
 *
 * @param {Readonly<{ onEdit: (yearGroup: YearGroup) => void; onDelete: (yearGroup: YearGroup) => void; }>} options Column action callbacks.
 * @returns {TableColumnType<YearGroup>[]} Table column definitions.
 */
function buildYearGroupColumns(options: Readonly<{
  onEdit: (yearGroup: YearGroup) => void;
  onDelete: (yearGroup: YearGroup) => void;
}>): TableColumnType<YearGroup>[] {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_value: unknown, yearGroup: YearGroup) => (
        <Space>
          <Button
            onClick={() => {
              options.onEdit(yearGroup);
            }}
          >
            Edit
          </Button>
          <Button
            danger
            onClick={() => {
              options.onDelete(yearGroup);
            }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];
}

/**
 * Renders the year-group form dialog.
 *
/**
 * Renders the Manage Year Groups modal workflow.
 *
 * @param {ManageYearGroupsModalProperties} properties Component properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function ManageYearGroupsModal(properties: ManageYearGroupsModalProperties) {
  // Type assertion to work around the query key type mismatch between
  // the specific tuple type from queryOptions() and the generic unknown[] in UseQueryOptions
  const yearGroupsQueryOptions = getYearGroupsQueryOptions() as unknown as UseQueryOptions<YearGroup[]>;

  const hookResult = useReferenceDataManagement({
    entityLabel: 'year group',
    entityKey: 'yearGroups',
    queryOptions: yearGroupsQueryOptions,
    createService: async ({ record }: { record: Omit<YearGroup, 'key'> }) => {
      const result = await createYearGroup({ record });
      // Call onEntityCreated callback if provided
      if (properties.onEntityCreated) {
        properties.onEntityCreated({ key: result.key, name: result.name });
      }
    },
    updateService: async ({ key, record }: { key: string; record: Omit<YearGroup, 'key'> }) => {
      await updateYearGroup({ key, record });
    },
    deleteService: async ({ key }: { key: string }) => {
      await deleteYearGroup({ key });
    },
    supportsToggleActive: false,
    formValidationMessage: 'Please enter a year group name.',
    loadFailureCopy: 'Unable to load year groups right now.',
    refreshStatusCopy: 'Refreshing year groups...',
    formDialogLabelId: FORM_DIALOG_LABEL_ID,
    deleteDialogLabelId: DELETE_DIALOG_LABEL_ID,
    deleteDialogTitle: 'Delete year group',
  });

  const {
    loadError,
    isInitialLoading,
    isRefreshing,
    rows,
    inlineDialog,
    inlineAlert,
    openCreateForm,
    openEditForm,
    openDeleteDialog,
    handleModalClose,
  } = hookResult;

  const columns = buildYearGroupColumns({
    onEdit: openEditForm,
    onDelete: openDeleteDialog,
  });

  return (
    <ReferenceDataManagementModalScaffold<YearGroup>
      open={properties.open}
      modalTitle="Manage Year Groups"
      modalClassName="manage-year-groups-modal"
      modalWidth={700}
      createActionLabel="Create year group"
      tableAriaLabel="year groups"
      emptyTableCopy="No year groups"
      refreshStatusCopy="Refreshing year groups..."
      isInitialLoading={isInitialLoading}
      isRefreshing={isRefreshing}
      loadError={loadError}
      loadingState={<ReferenceDataInitialLoadingState ariaLabel="Loading year groups" />}
      rows={rows}
      columns={columns}
      inlineAlert={inlineAlert}
      inlineDialog={inlineDialog}
      onClose={() => {
        handleModalClose();
        properties.onClose();
      }}
      onCreate={openCreateForm}
    />
  );
}
