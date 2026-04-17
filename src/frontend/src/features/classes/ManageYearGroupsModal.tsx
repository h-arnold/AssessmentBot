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

import { Alert, Button, Flex, Form, Modal, Skeleton, Space, Table, Typography, type TableColumnType } from 'antd';
import { useEffect, useState, type ReactElement } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { YearGroup } from '../../services/referenceData.zod';
import {
  createYearGroup,
  deleteYearGroup,
  updateYearGroup,
} from '../../services/referenceDataService';
import { queryKeys } from '../../query/queryKeys';
import { getYearGroupsQueryOptions } from '../../query/sharedQueries';
import {
  clearPersistedBlockingLoadError,
  getDeleteErrorMessage,
  getPersistedBlockingLoadError,
  getReferenceDataBlockingLoadErrorQueryKey,
  getReferenceDataLoadError,
  isInUseError,
  refetchRequiredReferenceDataQuery,
  setPersistedBlockingLoadError,
  syncReferenceDataModalBusyState,
  type BlockingLoadErrorState,
} from './manageReferenceDataHelpers';
import {
  ReferenceDataDeleteDialog,
  ReferenceDataFormDialog,
  type ReferenceDataFormValues,
} from './manageReferenceDataDialogs';

export type ManageYearGroupsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

type FormMode = 'create' | 'edit';

type YearGroupFormValues = ReferenceDataFormValues;

type DeleteDialogState = Readonly<{
  open: boolean;
  yearGroup: YearGroup | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
}>;

const INITIAL_DELETE_STATE: DeleteDialogState = {
  open: false,
  yearGroup: null,
  error: null,
  blocked: false,
  submitting: false,
};

const FORM_DIALOG_LABEL_ID = 'manage-year-groups-form-dialog-title';
const DELETE_DIALOG_LABEL_ID = 'manage-year-groups-delete-dialog-title';
const yearGroupsLoadFailureCopy = 'Unable to load year groups right now.';
const yearGroupsRefreshStatusCopy = 'Refreshing year groups...';

const { Text } = Typography;

type YearGroupColumnsOptions = Readonly<{
  onEdit: (yearGroup: YearGroup) => void;
  onDelete: (yearGroup: YearGroup) => void;
}>;


type ManageYearGroupsModalBodyProperties = Readonly<{
  columns: TableColumnType<YearGroup>[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  onCreate: () => void;
  yearGroups: YearGroup[];
}>;

/**
 * Renders the year-groups modal body for the current load state.
 *
 * @param {ManageYearGroupsModalBodyProperties} properties Body render properties.
 * @returns {JSX.Element} The modal body.
 */
function renderManageYearGroupsModalBody(properties: ManageYearGroupsModalBodyProperties): ReactElement {
  if (properties.isInitialLoading) {
    return <ManageYearGroupsInitialLoadingState />;
  }

  if (properties.loadError !== null) {
    return <Alert description={properties.loadError} showIcon type="error" />;
  }

  return (
    <Flex vertical gap={12}>
      {properties.isRefreshing ? (
        <div aria-live="polite" role="status">
          <Text type="secondary">{yearGroupsRefreshStatusCopy}</Text>
        </div>
      ) : null}
      <Button type="primary" onClick={properties.onCreate}>
        Create year group
      </Button>
      <Table<YearGroup>
        aria-label="year groups"
        dataSource={properties.yearGroups}
        columns={properties.columns}
        rowKey="key"
        pagination={false}
        locale={{ emptyText: 'No year groups' }}
      />
    </Flex>
  );
}

/**
 * Builds the column definitions for the year groups management table.
 *
 * @param {YearGroupColumnsOptions} options Column action callbacks.
 * @returns {TableColumnType<YearGroup>[]} Table column definitions.
 */
function buildYearGroupColumns(options: YearGroupColumnsOptions): TableColumnType<YearGroup>[] {
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
          <Button onClick={() => { options.onEdit(yearGroup); }}>Edit</Button>
          <Button danger onClick={() => { options.onDelete(yearGroup); }}>Delete</Button>
        </Space>
      ),
    },
  ];
}

type YearGroupFormDialogProperties = Readonly<{
  editingYearGroup: YearGroup | null;
  form: ReturnType<typeof Form.useForm<YearGroupFormValues>>[0];
  formDialogTitle: string;
  formError: string | null;
  formMode: FormMode | null;
  formSubmitting: boolean;
  onClose: () => void;
  onFinish: (values: YearGroupFormValues) => Promise<void>;
  onOk: () => void;
}>;

/**
 * Returns the shared year-group form dialog when the form is open.
 *
 * @param {YearGroupFormDialogProperties} properties Dialog properties.
 * @returns {JSX.Element | null} Rendered year-group form dialog.
 */
function renderYearGroupFormDialog(properties: YearGroupFormDialogProperties) {
  if (properties.formMode === null) {
    return null;
  }

  return (
    <ReferenceDataFormDialog
      formKey={properties.editingYearGroup?.key ?? 'create'}
      form={properties.form}
      initialName={properties.editingYearGroup?.name ?? null}
      labelId={FORM_DIALOG_LABEL_ID}
      title={properties.formDialogTitle}
      formError={properties.formError}
      formSubmitting={properties.formSubmitting}
      validationMessage="Please enter a year group name."
      onClose={properties.onClose}
      onFinish={properties.onFinish}
      onOk={properties.onOk}
    />
  );
}

type YearGroupDeleteDialogProperties = Readonly<{
  deleteState: DeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}>;

/**
 * Returns the shared year-group delete dialog when delete mode is open.
 *
 * @param {YearGroupDeleteDialogProperties} properties Dialog properties.
 * @returns {JSX.Element | null} Rendered year-group delete dialog.
 */
function renderYearGroupDeleteDialog(properties: YearGroupDeleteDialogProperties) {
  if (!properties.deleteState.open) {
    return null;
  }

  return (
    <ReferenceDataDeleteDialog
      blocked={properties.deleteState.blocked}
      entityLabel="year group"
      entityName={properties.deleteState.yearGroup?.name ?? null}
      error={properties.deleteState.error}
      labelId={DELETE_DIALOG_LABEL_ID}
      submitting={properties.deleteState.submitting}
      title="Delete year group"
      onClose={properties.onClose}
      onConfirm={properties.onConfirm}
    />
  );
}

type YearGroupFormFinishHandlerProperties = Readonly<{
  closeFormDialog: () => void;
  editingYearGroup: YearGroup | null;
  formMode: FormMode | null;
  onRequiredRefreshFailure: () => void;
  queryClient: QueryClient;
  setFormError: (message: string | null) => void;
  setFormSubmitting: (isSubmitting: boolean) => void;
}>;

/**
 * Builds the year-group form submit handler.
 *
 * @param {YearGroupFormFinishHandlerProperties} properties Handler dependencies.
 * @returns {(values: YearGroupFormValues) => Promise<void>} Form submit handler.
 */
function createYearGroupFormFinishHandler(properties: YearGroupFormFinishHandlerProperties) {
  return async function handleFormFinish(values: YearGroupFormValues): Promise<void> {
    properties.setFormSubmitting(true);
    properties.setFormError(null);

    try {
      if (properties.formMode === 'create') {
        await createYearGroup({ record: { name: values.name } });
      } else {
        if (properties.editingYearGroup === null) {
          throw new Error('Unable to save the year group.');
        }

        await updateYearGroup({
          key: properties.editingYearGroup.key,
          record: { name: values.name },
        });
      }

      const refreshSucceeded = await refetchRequiredReferenceDataQuery(
        properties.queryClient,
        queryKeys.yearGroups()
      );

      if (!refreshSucceeded) {
        properties.onRequiredRefreshFailure();
        return;
      }

      properties.closeFormDialog();
    } catch (error: unknown) {
      properties.setFormError(error instanceof Error ? error.message : 'Unable to save the year group.');
    } finally {
      properties.setFormSubmitting(false);
    }
  };
}

type YearGroupDeleteConfirmHandlerProperties = Readonly<{
  deleteState: DeleteDialogState;
  onRequiredRefreshFailure: () => void;
  queryClient: QueryClient;
  setDeleteState: (updater: (previous: DeleteDialogState) => DeleteDialogState) => void;
}>;

/**
 * Builds the year-group delete confirmation handler.
 *
 * @param {YearGroupDeleteConfirmHandlerProperties} properties Handler dependencies.
 * @returns {() => Promise<void>} Delete confirmation handler.
 */
function createYearGroupDeleteConfirmHandler(properties: YearGroupDeleteConfirmHandlerProperties) {
  return async function handleDeleteConfirm(): Promise<void> {
    if (properties.deleteState.yearGroup === null) {
      return;
    }

    properties.setDeleteState((previous) => ({ ...previous, submitting: true, error: null }));

    try {
      await deleteYearGroup({ key: properties.deleteState.yearGroup.key });
      const refreshSucceeded = await refetchRequiredReferenceDataQuery(
        properties.queryClient,
        queryKeys.yearGroups()
      );

      if (!refreshSucceeded) {
        properties.onRequiredRefreshFailure();
        return;
      }

      properties.setDeleteState(() => INITIAL_DELETE_STATE);
    } catch (error: unknown) {
      const blocked = isInUseError(error);

      properties.setDeleteState((previous) => ({
        ...previous,
        submitting: false,
        error: getDeleteErrorMessage(error, blocked, 'year group'),
        blocked,
      }));
    }
  };
}

/**
 * Returns the dialog title for the current year-group form mode.
 *
 * @param {FormMode | null} formMode Current form mode.
 * @returns {string} Form dialog title.
 */
function getYearGroupFormDialogTitle(formMode: FormMode | null): string {
  return formMode === 'create' ? 'Create year group' : 'Edit year group';
}

/**
 * Renders the initial blocking-load treatment for the outer year-groups modal body.
 *
 * @returns {JSX.Element} Loading skeleton content.
 */
function ManageYearGroupsInitialLoadingState() {
  return (
    <div aria-label="Loading year groups" role="status">
      <Flex vertical gap={12}>
        <Skeleton.Button active />
        <Skeleton active paragraph={{ rows: 5 }} title={{ width: '24%' }} />
      </Flex>
    </div>
  );
}

/**
 * Renders the Manage Year Groups modal workflow.
 *
 * @param {ManageYearGroupsModalProperties} properties Component properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function ManageYearGroupsModal(properties: ManageYearGroupsModalProperties) {
  const queryClient = useQueryClient();
  const yearGroupsQuery = useQuery(getYearGroupsQueryOptions());
  const yearGroups = yearGroupsQuery.data ?? [];
  const isInitialLoading = yearGroupsQuery.isPending && yearGroupsQuery.data === undefined;
  const blockingLoadErrorQuery = useQuery({
    enabled: false,
    queryFn: () => getPersistedBlockingLoadError(queryClient, 'yearGroups'),
    queryKey: getReferenceDataBlockingLoadErrorQueryKey('yearGroups'),
  });
  const blockingLoadError = blockingLoadErrorQuery.data ?? null;
  const isRefreshing = !isInitialLoading && yearGroupsQuery.isFetching;

  useEffect(() => {
    syncReferenceDataModalBusyState('.manage-year-groups-modal[role="dialog"]', isRefreshing);
  }, [isRefreshing, properties.open]);

  useEffect(() => {
    if (blockingLoadError === null || yearGroupsQuery.dataUpdatedAt <= blockingLoadError.dataUpdatedAt) {
      return;
    }

    clearPersistedBlockingLoadError(queryClient, 'yearGroups');
  }, [blockingLoadError, queryClient, yearGroupsQuery.dataUpdatedAt]);

  const [form] = Form.useForm<YearGroupFormValues>();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingYearGroup, setEditingYearGroup] = useState<YearGroup | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteDialogState>(INITIAL_DELETE_STATE);
  const loadError = getReferenceDataLoadError(
    yearGroupsQuery,
    blockingLoadError,
    yearGroupsQuery.dataUpdatedAt,
    yearGroupsLoadFailureCopy
  );

  const handleFormFinish = createYearGroupFormFinishHandler({
    closeFormDialog,
    editingYearGroup,
    formMode,
    onRequiredRefreshFailure: handleRequiredRefreshFailure,
    queryClient,
    setFormError,
    setFormSubmitting,
  });
  const handleDeleteConfirm = createYearGroupDeleteConfirmHandler({
    deleteState,
    onRequiredRefreshFailure: handleRequiredRefreshFailure,
    queryClient,
    setDeleteState,
  });

  /**
   * Opens the create form with blank fields.
   */
  function openCreateForm(): void {
    form.resetFields();
    setEditingYearGroup(null);
    setFormError(null);
    setDeleteState(INITIAL_DELETE_STATE);
    setFormMode('create');
  }

  /**
   * Opens the edit form pre-filled with the given year group.
   *
   * @param {YearGroup} yearGroup Year group to edit.
   */
  function openEditForm(yearGroup: YearGroup): void {
    setEditingYearGroup(yearGroup);
    setFormError(null);
    setDeleteState(INITIAL_DELETE_STATE);
    setFormMode('edit');
  }

  /**
   * Closes the form dialog and resets transient form state.
   */
  function closeFormDialog(): void {
    const wasFormOpen = formMode !== null;

    setFormMode(null);
    setEditingYearGroup(null);
    setFormError(null);
    setFormSubmitting(false);

    if (wasFormOpen) {
      form.resetFields();
    }
  }

  /**
   * Closes the outer modal and clears all transient modal state first.
   */
  function handleModalClose(): void {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
    properties.onClose();
  }

  /**
   * Handles the fail-closed state required after a successful mutation cannot be refreshed.
   */
  function handleRequiredRefreshFailure(): void {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);

    const nextBlockingLoadError: BlockingLoadErrorState = {
      dataUpdatedAt: yearGroupsQuery.dataUpdatedAt,
      message: yearGroupsLoadFailureCopy,
    };

    setPersistedBlockingLoadError(queryClient, 'yearGroups', nextBlockingLoadError);
  }

  const columns = buildYearGroupColumns({
    onEdit: openEditForm,
    onDelete: (yearGroup) => {
      closeFormDialog();
      setDeleteState({ open: true, yearGroup, error: null, blocked: false, submitting: false });
    },
  });

  const modalBody = renderManageYearGroupsModalBody({
    columns,
    isInitialLoading,
    isRefreshing,
    loadError,
    onCreate: openCreateForm,
    yearGroups,
  });

  return (
    <Modal
      open={properties.open}
      title="Manage Year Groups"
      onCancel={handleModalClose}
      className="manage-year-groups-modal"
      footer={
        <Button onClick={handleModalClose}>Cancel</Button>
      }
      width={700}
    >
      {modalBody}

      {renderYearGroupFormDialog({
        editingYearGroup,
        form,
        formDialogTitle: getYearGroupFormDialogTitle(formMode),
        formError,
        formMode,
        formSubmitting,
        onClose: closeFormDialog,
        onFinish: handleFormFinish,
        onOk: () => { form.submit(); },
      })}

      {renderYearGroupDeleteDialog({
        deleteState,
        onClose: () => { setDeleteState(INITIAL_DELETE_STATE); },
        onConfirm: () => { void handleDeleteConfirm(); },
      })}
    </Modal>
  );
}
