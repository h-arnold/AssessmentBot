/**
 * Manage Topics Modal — list, create, edit, and delete topic records.
 *
 * Reads topics from the shared React Query cache via useReferenceDataManagement.
 * Successful mutations refetch the active `assignmentTopics` query so the visible dataset
 * stays trustworthy.
 *
 * Delete-blocked state (IN_USE from the API transport) is surfaced as an inline Alert
 * inside the delete confirmation dialog; the destructive button is disabled so the user
 * cannot retry blindly.
 *
 * Inner form and delete "dialogs" are rendered as inline elements with role="dialog"
 * inside the outer Modal body. This avoids portal async-render issues in jsdom unit
 * tests while maintaining full ARIA semantics and correct Playwright behaviour.
 *
 * @remarks
 * This component follows the same pattern as ManageCohortsModal and ManageYearGroupsModal,
 * with added year group multi-select support for the AssignmentTopic type.
 */

import { Alert, Button, Form, Input, Select, Space, type FormInstance, type TableColumnType } from 'antd';
import type { ReactElement } from 'react';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { AssignmentTopic, YearGroup, TopicFormValues } from '../../services/referenceData/referenceData.zod';
import {
  createAssignmentTopic,
  deleteAssignmentTopic,
  updateAssignmentTopic,
} from '../../services/referenceData/referenceDataService';
import { getAssignmentTopicsQueryOptions, getYearGroupsQueryOptions } from '../../query/sharedQueries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReferenceDataInitialLoadingState } from './ReferenceDataInitialLoadingState';
import { ReferenceDataManagementModalScaffold } from './ReferenceDataManagementModalScaffold';
import {
  getPersistedBlockingLoadError,
  getReferenceDataBlockingLoadErrorQueryKey,
  getReferenceDataLoadError,
  setPersistedBlockingLoadError,
  clearPersistedBlockingLoadError,
  type BlockingLoadErrorState,
} from './manageReferenceDataHelpers';
import { InlineDialog } from './InlineDialog';
import {
  useReferenceDataManagement,
  type ReferenceDataManagementConfig,
  type FormDialogProperties,
} from './useReferenceDataManagement';
import { useCallback, useEffect, useMemo } from 'react';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the column definitions for the topics management table.
 *
 * @param {Readonly<{ onEdit: (topic: AssignmentTopic) => void; onDelete: (topic: AssignmentTopic) => void; yearGroupMap: Map<string, string>; }>} options Column action callbacks and data.
 * @returns {TableColumnType<AssignmentTopic>[]} Table column definitions.
 */
function buildTopicsColumns(options: Readonly<{
  onEdit: (topic: AssignmentTopic) => void;
  onDelete: (topic: AssignmentTopic) => void;
  yearGroupMap: Map<string, string>;
}>): TableColumnType<AssignmentTopic>[] {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Year Groups',
      dataIndex: 'yearGroupKeys',
      key: 'yearGroupKeys',
      onCell: (): object => ({
        'aria-label': 'Year Groups',
      }),
      render: (_: unknown, topic: AssignmentTopic): ReactElement | string => {
        if (!topic.yearGroupKeys || topic.yearGroupKeys.length === 0) {
          return '';
        }
        return topic.yearGroupKeys.map((key) => options.yearGroupMap.get(key) ?? key).join(', ');
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, topic: AssignmentTopic) => (
        <Space>
          <Button
            onClick={() => {
              options.onEdit(topic);
            }}
          >
            Edit
          </Button>
          <Button
            danger
            onClick={() => {
              options.onDelete(topic);
            }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];
}

// ============================================================================
// Component
// ============================================================================

export type ManageTopicsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
  onEntityCreated?: (entity: AssignmentTopic) => void;
}>;

const FORM_DIALOG_LABEL_ID = 'manage-topics-form-dialog-title';
const DELETE_DIALOG_LABEL_ID = 'manage-topics-delete-dialog-title';

/**
 * Year Groups Form Field - a multi-select component for year group association.
 *
 * @param {Readonly<{ value?: string[]; onChange?: (value: string[]) => void; yearGroups: YearGroup[]; disabled?: boolean; }>} properties Component properties.
 * @returns {ReactElement} The year groups multi-select form field.
 */
function YearGroupsFormField(properties: Readonly<{
  value?: string[];
  onChange?: (value: string[]) => void;
  yearGroups: YearGroup[];
  disabled?: boolean;
}>): ReactElement {
  const yearGroupOptions = properties.yearGroups.map((yearGroup) => ({
    value: yearGroup.key,
    label: yearGroup.name,
  }));

  return (
    <Select
      mode="multiple"
      allowClear
      placeholder="Select year groups"
      value={properties.value}
      onChange={properties.onChange}
      disabled={properties.disabled}
      options={yearGroupOptions}
    />
  );
}

/**
 * Determines if the form dialog should be rendered based on editing entity and title.
 *
 * @param {AssignmentTopic | null} editingEntity The entity being edited.
 * @param {string} formDialogTitle The title of the form dialog.
 * @returns {boolean} True if the dialog should be rendered.
 */
function shouldRenderFormDialog(editingEntity: AssignmentTopic | null, formDialogTitle: string): boolean {
  return !(editingEntity === null && formDialogTitle !== 'Create topic');
}

/**
 * Extracts form dialog properties from an editing entity.
 *
 * @param {AssignmentTopic | null} editingEntity The entity being edited.
 * @returns {Readonly<{ formKey: string; initialName: string | null; initialYearGroupKeys: string[]; }>} Form dialog properties.
 */
function getFormDialogEntityProperties(editingEntity: AssignmentTopic | null): Readonly<{
  formKey: string;
  initialName: string | null;
  initialYearGroupKeys: string[];
}> {
  return {
    formKey: editingEntity?.key ?? 'create',
    initialName: editingEntity?.name ?? null,
    initialYearGroupKeys: editingEntity?.yearGroupKeys ?? [],
  };
}

/**
 * Renders the topic form dialog with year group multi-select.
 *
 * @param {Readonly<{ formKey: string; form: FormInstance<TopicFormValues>; initialName: string | null; initialYearGroupKeys: string[]; labelId: string; title: string; formError: string | null; formSubmitting: boolean; onClose: () => void; onFinish: (values: TopicFormValues) => Promise<void>; onOk: () => void; yearGroups: YearGroup[]; }>} properties Dialog properties.
 * @returns {ReactElement | null} The rendered form dialog.
 */
function TopicFormDialog(properties: Readonly<{
  formKey: string;
  form: FormInstance<TopicFormValues>;
  initialName: string | null;
  initialYearGroupKeys: string[];
  labelId: string;
  title: string;
  formError: string | null;
  formSubmitting: boolean;
  onClose: () => void;
  onFinish: (values: TopicFormValues) => Promise<void>;
  onOk: () => void;
  yearGroups: YearGroup[];
}>): ReactElement | null {
  return (
    <InlineDialog labelId={properties.labelId} title={properties.title}>
      {properties.formError === null ? null : (
        <Alert
          description={properties.formError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form<TopicFormValues>
        key={properties.formKey}
        form={properties.form}
        layout="vertical"
        onFinish={properties.onFinish}
        initialValues={{
          name: properties.initialName ?? undefined,
          yearGroupKeys: properties.initialYearGroupKeys,
        }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Please enter a topic name.' }]}
        >
          <Input disabled={properties.formSubmitting} />
        </Form.Item>
        <Form.Item label="Year Groups" name="yearGroupKeys">
          <YearGroupsFormField
            yearGroups={properties.yearGroups}
            disabled={properties.formSubmitting}
          />
        </Form.Item>
      </Form>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={properties.onClose}>Cancel</Button>
        <Button type="primary" loading={properties.formSubmitting} onClick={properties.onOk}>
          OK
        </Button>
      </Space>
    </InlineDialog>
  );
}



/**
 * Renders the Manage Topics modal workflow.
 *
 * @param {ManageTopicsModalProperties} properties Component properties.
 * @returns {ReactElement} The rendered modal.
 */
export function ManageTopicsModal(properties: ManageTopicsModalProperties): ReactElement {
  const queryClient = useQueryClient();

  // Fetch yearGroups as blocking-required data for form options and table rendering
  const yearGroupsQueryOptions = getYearGroupsQueryOptions() as unknown as UseQueryOptions<YearGroup[]>;
  const yearGroupsQuery = useQuery({ ...yearGroupsQueryOptions });
  const yearGroupsLoadError = yearGroupsQuery.error;
  const yearGroupsIsLoading = yearGroupsQuery.isPending && yearGroupsQuery.data === undefined;
  const yearGroupsDataUpdatedAt = yearGroupsQuery.dataUpdatedAt;
  // Memoize yearGroups to prevent unnecessary re-renders in downstream hooks
  const yearGroups = useMemo(() => yearGroupsQuery.data ?? [], [yearGroupsQuery.data]);

  // Year groups blocking error state (using persisted blocking error mechanism)
  const yearGroupsBlockingErrorQuery = useQuery({
    queryFn: () => getPersistedBlockingLoadError(queryClient, 'yearGroups'),
    queryKey: getReferenceDataBlockingLoadErrorQueryKey('yearGroups'),
  });
  const yearGroupsPersistedBlockingError = yearGroupsBlockingErrorQuery.data ?? null;

  // Cleanup year groups blocking error when fresh data is available
  useEffect(() => {
    if (yearGroupsPersistedBlockingError === null || yearGroupsDataUpdatedAt <= yearGroupsPersistedBlockingError.dataUpdatedAt) {
      return;
    }

    clearPersistedBlockingLoadError(queryClient, 'yearGroups');
  }, [yearGroupsPersistedBlockingError, yearGroupsDataUpdatedAt, queryClient]);

  // Sync year groups blocking error state
  useEffect(() => {
    if (yearGroupsLoadError !== null) {
      const nextBlockingLoadError: BlockingLoadErrorState = {
        dataUpdatedAt: yearGroupsDataUpdatedAt,
        message: 'Unable to load year groups right now.',
      };
      setPersistedBlockingLoadError(queryClient, 'yearGroups', nextBlockingLoadError);
    }
  }, [yearGroupsLoadError, yearGroupsDataUpdatedAt, queryClient]);

  // Derived year groups load error
  const yearGroupsLoadErrorMessage = getReferenceDataLoadError(
    yearGroupsQuery,
    yearGroupsPersistedBlockingError,
    yearGroupsDataUpdatedAt,
    'Unable to load year groups right now.'
  );

  // Topics query options
  const topicsQueryOptions = getAssignmentTopicsQueryOptions() as unknown as UseQueryOptions<AssignmentTopic[]>;

  // Build year group map for column rendering
  const yearGroupMap = useMemo(
    () => new Map(yearGroups.map((yg) => [yg.key, yg.name])),
    [yearGroups]
  );

  // Custom form dialog renderer
  const renderFormDialog = useCallback(
    (formDialogProperties: FormDialogProperties<AssignmentTopic>): ReactElement | null => {
      if (!shouldRenderFormDialog(formDialogProperties.editingEntity, formDialogProperties.formDialogTitle)) {
        return null;
      }

      const { formKey, initialName, initialYearGroupKeys } = getFormDialogEntityProperties(
        formDialogProperties.editingEntity
      );

      // The hook's form is typed for ReferenceDataFormValues which now includes optional yearGroupKeys,
      // so we can safely cast it to TopicFormValues since TopicFormValues extends it with required yearGroupKeys
      const topicForm = formDialogProperties.form as FormInstance<TopicFormValues>;
      const topicOnFinish = formDialogProperties.onFinish as (values: TopicFormValues) => Promise<void>;

      return (
        <TopicFormDialog
          formKey={formKey}
          form={topicForm}
          initialName={initialName}
          initialYearGroupKeys={initialYearGroupKeys}
          labelId={FORM_DIALOG_LABEL_ID}
          title={formDialogProperties.formDialogTitle}
          formError={formDialogProperties.formError}
          formSubmitting={formDialogProperties.formSubmitting}
          onClose={formDialogProperties.onClose}
          onFinish={topicOnFinish}
          onOk={formDialogProperties.onOk}
          yearGroups={yearGroups}
        />
      );
    },
    [yearGroups]
  );



  // Configure the hook for topics
  const hookConfig: ReferenceDataManagementConfig<AssignmentTopic> = {
    entityLabel: 'topic',
    entityKey: 'assignmentTopics',
    queryOptions: topicsQueryOptions,
    createService: async ({ record }: { record: Omit<AssignmentTopic, 'key'> }) => {
      const result = await createAssignmentTopic({
        record,
      });
      // Call onEntityCreated callback if provided
      if (properties.onEntityCreated) {
        properties.onEntityCreated(result);
      }
    },
    updateService: async ({ key, record }: { key: string; record: Omit<AssignmentTopic, 'key'> }) => {
      await updateAssignmentTopic({ key, record });
    },
    deleteService: async ({ key }: { key: string }) => {
      await deleteAssignmentTopic({ key });
    },
    supportsToggleActive: false,
    formValidationMessage: 'Please enter a topic name.',
    loadFailureCopy: 'Unable to load topics right now.',
    refreshStatusCopy: 'Refreshing topics...',
    formDialogLabelId: FORM_DIALOG_LABEL_ID,
    deleteDialogLabelId: DELETE_DIALOG_LABEL_ID,
    deleteDialogTitle: 'Delete topic',
    renderFormDialog,
  };

  const hookResult = useReferenceDataManagement(hookConfig);

  const {
    loadError: topicsLoadError,
    isInitialLoading: topicsIsInitialLoading,
    isRefreshing: topicsIsRefreshing,
    rows: topics,
    inlineDialog: hookInlineDialog,
    inlineAlert,
    openCreateForm,
    openEditForm,
    openDeleteDialog,
    handleModalClose,
  } = hookResult;

  // Combined blocking state: both topics and yearGroups must be ready
  const isInitialLoading = topicsIsInitialLoading || yearGroupsIsLoading;
  const isRefreshing = !isInitialLoading && (topicsIsRefreshing || yearGroupsQuery.isFetching);

  // Combined load error: either topics or year groups error
  const loadError = topicsLoadError ?? yearGroupsLoadErrorMessage;

  // Build columns with year group map and action handlers
  const finalColumns = useMemo(
    () => buildTopicsColumns({ onEdit: openEditForm, onDelete: openDeleteDialog, yearGroupMap }),
    [openEditForm, openDeleteDialog, yearGroupMap]
  );

  return (
    <ReferenceDataManagementModalScaffold<AssignmentTopic>
      open={properties.open}
      modalTitle="Manage Topics"
      modalClassName="manage-topics-modal"
      modalWidth={700}
      createActionLabel="Create topic"
      tableAriaLabel="topics"
      emptyTableCopy="No topics"
      refreshStatusCopy="Refreshing topics..."
      isInitialLoading={isInitialLoading}
      isRefreshing={isRefreshing}
      loadError={loadError}
      loadingState={
        <ReferenceDataInitialLoadingState ariaLabel="Loading topics" />
      }
      rows={topics}
      columns={finalColumns}
      inlineAlert={inlineAlert}
      inlineDialog={hookInlineDialog}
      onClose={() => {
        handleModalClose();
        properties.onClose();
      }}
      onCreate={openCreateForm}
    />
  );
}
