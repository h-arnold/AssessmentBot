/**
 * Manage Cohorts Modal — list, create, edit, toggle-active, and delete cohort records.
 *
 * Reads cohorts from the shared React Query cache. Successful mutations refetch the active
 * `cohorts` query so the visible dataset stays trustworthy.
 *
 * Delete-blocked state (IN_USE from the API transport) is surfaced as an inline Alert
 * inside the delete confirmation dialog; the destructive button is disabled so the user
 * cannot retry blindly.
 *
 * Inner form and delete "dialogs" are rendered as inline elements with role="dialog"
 * inside the outer Modal body. This avoids portal async-render issues in jsdom unit
 * tests while maintaining full ARIA semantics and correct Playwright behaviour.
 */

import { Button, Space, Switch, type TableColumnType } from 'antd';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { Cohort } from '../../services/referenceData.zod';
import { createCohort, deleteCohort, updateCohort } from '../../services/referenceDataService';
import { getCohortsQueryOptions } from '../../query/sharedQueries';
import { ReferenceDataInitialLoadingState } from './ReferenceDataInitialLoadingState';
import { ReferenceDataManagementModalScaffold } from './ReferenceDataManagementModalScaffold';
import {
  ReferenceDataDeleteDialog,
  ReferenceDataFormDialog,
} from './manageReferenceDataDialogs';
import { useReferenceDataManagement } from './hooks/useReferenceDataManagement';
import type {
  FormDialogProperties,
  DeleteDialogProperties,
} from './hooks/useReferenceDataManagement';

export type ManageCohortsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

const FORM_DIALOG_LABEL_ID = 'manage-cohorts-form-dialog-title';
const DELETE_DIALOG_LABEL_ID = 'manage-cohorts-delete-dialog-title';

/**
 * Builds the column definitions for the cohorts management table.
 *
 * @param {Readonly<{ onEdit: (cohort: Cohort) => void; onDelete: (cohort: Cohort) => void; onToggleActive: (cohort: Cohort, checked: boolean) => void; }>} options Column action callbacks.
 * @returns {TableColumnType<Cohort>[]} Table column definitions.
 */
function buildCohortColumns(options: Readonly<{
  onEdit: (cohort: Cohort) => void;
  onDelete: (cohort: Cohort) => void;
  onToggleActive: (cohort: Cohort, checked: boolean) => void;
}>): TableColumnType<Cohort>[] {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Start year',
      dataIndex: 'startYear',
      key: 'startYear',
    },
    {
      title: 'Start month',
      dataIndex: 'startMonth',
      key: 'startMonth',
    },
    {
      title: 'Active',
      key: 'active',
      render: (_value: unknown, cohort: Cohort) => (
        <Switch
          checked={cohort.active}
          onChange={(checked) => {
            options.onToggleActive(cohort, checked);
          }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_value: unknown, cohort: Cohort) => (
        <Space>
          <Button
            onClick={() => {
              options.onEdit(cohort);
            }}
          >
            Edit
          </Button>
          <Button
            danger
            onClick={() => {
              options.onDelete(cohort);
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
 * Renders the cohort form dialog.
 *
 * @param {FormDialogProperties<Cohort>} properties Dialog properties.
 * @returns {React.ReactElement | null} Rendered form dialog.
 */
function renderCohortFormDialog(
  properties: FormDialogProperties<Cohort>
): React.ReactElement | null {
  if (properties.formMode === null) {
    return null;
  }

  return (
    <ReferenceDataFormDialog
      formKey={properties.editingEntity?.key ?? 'create'}
      form={properties.form}
      initialName={properties.editingEntity?.name ?? null}
      labelId={FORM_DIALOG_LABEL_ID}
      title={properties.formDialogTitle}
      formError={properties.formError}
      formSubmitting={properties.formSubmitting}
      validationMessage="Please enter a cohort name."
      onClose={properties.onClose}
      onFinish={properties.onFinish}
      onOk={properties.onOk}
    />
  );
}

/**
 * Renders the cohort delete dialog.
 *
 * @param {DeleteDialogProperties<Cohort>} properties Dialog properties.
 * @returns {React.ReactElement | null} Rendered delete dialog.
 */
function renderCohortDeleteDialog(
  properties: DeleteDialogProperties<Cohort>
): React.ReactElement | null {
  if (!properties.deleteState.open) {
    return null;
  }

  return (
    <ReferenceDataDeleteDialog
      blocked={properties.deleteState.blocked}
      entityLabel="cohort"
      entityName={properties.deleteState.entity?.name ?? null}
      error={properties.deleteState.error}
      labelId={DELETE_DIALOG_LABEL_ID}
      submitting={properties.deleteState.submitting}
      title="Delete cohort"
      onClose={properties.onClose}
      onConfirm={properties.onConfirm}
    />
  );
}

/**
 * Renders the Manage Cohorts modal workflow.
 *
 * @param {ManageCohortsModalProperties} properties Component properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function ManageCohortsModal(properties: ManageCohortsModalProperties) {
  // Type assertion to work around the query key type mismatch between
  // the specific tuple type from queryOptions() and the generic unknown[] in UseQueryOptions
  const cohortQueryOptions = getCohortsQueryOptions() as unknown as UseQueryOptions<Cohort[]>;

  const hookResult = useReferenceDataManagement({
    entityName: 'cohorts',
    entityLabel: 'cohort',
    entityKey: 'cohorts',
    queryOptions: cohortQueryOptions,
    createService: async ({ record }: { record: Omit<Cohort, 'key'> }) => {
      await createCohort({ record });
    },
    updateService: async ({ key, record }: { key: string; record: Omit<Cohort, 'key'> }) => {
      await updateCohort({ key, record });
    },
    deleteService: async ({ key }: { key: string }) => {
      await deleteCohort({ key });
    },
    supportsToggleActive: true,
    toggleService: async ({ entity, active }: { entity: Cohort; active: boolean }) => {
      await updateCohort({
        key: entity.key,
        record: {
          name: entity.name,
          active,
          startYear: entity.startYear,
          startMonth: entity.startMonth,
        },
      });
      // Return void to match the expected signature
    },
    formValidationMessage: 'Please enter a cohort name.',
    loadFailureCopy: 'Unable to load cohorts right now.',
    refreshStatusCopy: 'Refreshing cohorts...',
    renderFormDialog: renderCohortFormDialog,
    renderDeleteDialog: renderCohortDeleteDialog,
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
    handleToggleActive,
  } = hookResult;

  const columns = buildCohortColumns({
    onEdit: openEditForm,
    onDelete: openDeleteDialog,
    onToggleActive: (cohort, checked) => {
      if (handleToggleActive) {
        void handleToggleActive(cohort, checked);
      }
    },
  });

  return (
    <ReferenceDataManagementModalScaffold<Cohort>
      open={properties.open}
      modalTitle="Manage Cohorts"
      modalClassName="manage-cohorts-modal"
      modalWidth={800}
      createActionLabel="Create cohort"
      tableAriaLabel="cohorts"
      emptyTableCopy="No cohorts"
      refreshStatusCopy="Refreshing cohorts..."
      isInitialLoading={isInitialLoading}
      isRefreshing={isRefreshing}
      loadError={loadError}
      loadingState={<ReferenceDataInitialLoadingState ariaLabel="Loading cohorts" />}
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
