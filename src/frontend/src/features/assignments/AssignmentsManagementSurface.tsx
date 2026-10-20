import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, Modal, Skeleton, Space, Typography } from 'antd';
import { useState } from 'react';
import { useStartupWarmupState } from '../auth/startupWarmupState';
import {
  shouldBlockPageSurface,
  isDatasetRenderable,
  isPageSurfaceBusy,
  usePageDataset,
  type PageDatasetState,
} from '@/hooks/usePageDataset';
import { logFrontendError } from '@/logging/frontendLogger';
import { queryKeys } from '@/query/queryKeys';
import { refetchAfterStaleInvalidate } from '@/query/queryInvalidationHelpers';
import {
  deleteAssignmentDefinition,
  type AssignmentDefinitionPartial,
} from '@/services/assignmentDefinition/assignmentDefinitionPartialsService';
import { AssignmentDefinitionWizardModal } from '../assignmentWizard/AssignmentDefinitionWizardModal';
import { AssignmentDefinitionsTable } from './AssignmentDefinitionsTable';
import { APP_GAP_COMPACT, APP_GAP_MD, APP_GAP_SM, APP_SPACE_SIZE_TIGHT } from '@/theme/spacing';

const { Text } = Typography;

const ASSIGNMENTS_PANEL_REGION_LABEL = 'Assignments management panel';
const BLOCKING_ERROR_MESSAGE = 'Assignment definitions could not be trusted or loaded.';
const DELETE_SUCCESS_MESSAGE = 'Assignment definition deleted.';
const DELETE_FAILURE_MESSAGE = 'Could not delete assignment definition. Please try again.';
type DeleteOutcome = Readonly<{
  type: 'success' | 'error';
  message: string;
}>;

type AssignmentsSurfaceState = Readonly<{
  shouldRenderActionLoadingState: boolean;
  shouldRenderBlockingState: boolean;
  shouldRenderTableLoadingState: boolean;
}>;

/**
 * Resolves whether assignments cards should show loading or blocking states.
 *
 * @param {PageDatasetState} datasetState Derived per-dataset state for assignment definition partials.
 * @param {boolean} isAssignmentsQueryPending Whether the assignments query is in a pending state.
 * @returns {AssignmentsSurfaceState} Surface-state booleans.
 */
function getAssignmentsSurfaceState(
  datasetState: PageDatasetState,
  isAssignmentsQueryPending: boolean
): AssignmentsSurfaceState {
  const isBlocking = shouldBlockPageSurface(datasetState);

  if (isBlocking) {
    return {
      shouldRenderActionLoadingState: false,
      shouldRenderBlockingState: true,
      shouldRenderTableLoadingState: false,
    };
  }

  const hasRenderableAssignmentsDataset = isDatasetRenderable(datasetState);

  return {
    shouldRenderActionLoadingState: !hasRenderableAssignmentsDataset,
    shouldRenderBlockingState: false,
    shouldRenderTableLoadingState:
      !hasRenderableAssignmentsDataset || (isAssignmentsQueryPending && !datasetState.hasQueryData),
  };
}

/**
 * Returns whether the assignments panel should expose busy state.
 *
 * @param {Readonly<{ surfaceState: AssignmentsSurfaceState; isQueryFetching: boolean; isDeletePending: boolean; }>} input Busy-state inputs.
 * @returns {boolean} `true` when the panel is busy.
 */
function isAssignmentsSurfaceBusyState(
  input: Readonly<{
    surfaceState: AssignmentsSurfaceState;
    isQueryFetching: boolean;
    isDeletePending: boolean;
  }>
): boolean {
  return (
    input.surfaceState.shouldRenderTableLoadingState ||
    isPageSurfaceBusy([input.isQueryFetching], [input.isDeletePending])
  );
}

/**
 * Renders the status and action card for assignments management.
 *
 * @param {Readonly<{ shouldRenderBlockingState: boolean; deleteOutcome: DeleteOutcome | null; shouldRenderActionLoadingState: boolean; onRefreshAssignmentsData: () => void; onCreateAssignment: () => void; hasTrustworthyData: boolean; }>} properties Card properties.
 * @returns {JSX.Element} Card content.
 */
function AssignmentsStatusAndActionsCard(
  properties: Readonly<{
    shouldRenderBlockingState: boolean;
    deleteOutcome: DeleteOutcome | null;
    shouldRenderActionLoadingState: boolean;
    onRefreshAssignmentsData: () => void;
    onCreateAssignment: () => void;
    hasTrustworthyData: boolean;
  }>
) {
  return (
    <Card size="small" title="Status and actions">
      <Flex vertical gap={APP_GAP_COMPACT}>
        {properties.shouldRenderBlockingState ? (
          <Alert showIcon title={BLOCKING_ERROR_MESSAGE} type="error" />
        ) : null}

        {properties.deleteOutcome === null ? null : (
          <Alert
            showIcon
            title={properties.deleteOutcome.message}
            type={properties.deleteOutcome.type === 'success' ? 'success' : 'error'}
          />
        )}

        {properties.shouldRenderActionLoadingState ? (
          <div aria-label="Assignments actions loading" aria-live="polite">
            <Space>
              <Skeleton.Button active />
              <Skeleton.Button active />
              <Skeleton.Button active />
            </Space>
          </div>
        ) : (
          <Flex gap={APP_GAP_SM} justify="space-between" wrap>
            <Space wrap>
              <Button onClick={properties.onRefreshAssignmentsData}>
                Refresh assignments data
              </Button>
              <Button
                disabled={!properties.hasTrustworthyData}
                onClick={properties.onCreateAssignment}
              >
                Create assignment
              </Button>
            </Space>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

/**
 * Renders the delete-confirmation modal.
 *
 * @param {Readonly<{ deleteTarget: AssignmentDefinitionPartial | null; isDeleteMutationPending: boolean; onCancel: () => void; onConfirm: () => void; error: string | null; }>} properties Modal properties.
 * @returns {JSX.Element} Delete modal.
 */
function AssignmentsDeleteModal(
  properties: Readonly<{
    deleteTarget: AssignmentDefinitionPartial | null;
    isDeleteMutationPending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    error: string | null;
  }>
) {
  const isDeleteBusy = properties.isDeleteMutationPending;

  return (
    <Modal
      centered
      destroyOnHidden
      footer={
        <Space>
          <Button disabled={isDeleteBusy} onClick={properties.onCancel}>
            Cancel
          </Button>
          <Button
            disabled={isDeleteBusy}
            loading={isDeleteBusy}
            onClick={properties.onConfirm}
            type="primary"
          >
            Delete definition
          </Button>
        </Space>
      }
      keyboard={!isDeleteBusy}
      onCancel={properties.onCancel}
      open={properties.deleteTarget !== null}
      title="Delete assignment definition"
      transitionName=""
    >
      <Space orientation="vertical" size={APP_SPACE_SIZE_TIGHT}>
        {properties.error && (
          <Alert
            description={properties.error}
            showIcon
            type="error"
            style={{ marginBottom: APP_GAP_MD }}
          />
        )}
        <Text>You are deleting this assignment definition.</Text>
        {properties.deleteTarget === null ? null : (
          <Text strong>{properties.deleteTarget.primaryTitle}</Text>
        )}
        <Text>This delete is permanent and cannot be undone.</Text>
      </Space>
    </Modal>
  );
}

/**
 * Renders the assignments management surface.
 *
 * @returns {JSX.Element} Assignments management content.
 */
export function AssignmentsManagementSurface() {
  const startupWarmupState = useStartupWarmupState();
  const queryClient = useQueryClient();

  const { query: assignmentsQuery, datasetState: assignmentsDatasetState } = usePageDataset<
    AssignmentDefinitionPartial[]
  >('assignmentDefinitionPartials');

  const hasTrustworthyAssignmentsDataset = assignmentsDatasetState.hasTrustworthyDataset;
  const hasTrustworthyReferenceData =
    startupWarmupState.isDatasetReady('assignmentTopics') &&
    startupWarmupState.isDatasetReady('yearGroups');

  const deleteMutation = useMutation({
    mutationFn: async (input: { definitionKey: string }) => deleteAssignmentDefinition(input),
  });

  const [deleteTarget, setDeleteTarget] = useState<AssignmentDefinitionPartial | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteOutcome, setDeleteOutcome] = useState<DeleteOutcome | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'update'>('create');
  const [wizardDefinitionKey, setWizardDefinitionKey] = useState<string | null>(null);

  const assignmentsSurfaceState = getAssignmentsSurfaceState(
    assignmentsDatasetState,
    assignmentsQuery.isPending
  );

  const isAssignmentsSurfaceBusy = isAssignmentsSurfaceBusyState({
    isDeletePending: deleteMutation.isPending,
    isQueryFetching: assignmentsQuery.isFetching,
    surfaceState: assignmentsSurfaceState,
  });

  /** Opens the create assignment definition modal.
   * @returns {void} No return value.
   */
  function handleCreateAssignment() {
    setWizardMode('create');
    setWizardDefinitionKey(null);
    setWizardOpen(true);
  }

  /** Handles closing the wizard modal.
   * @returns {void} No return value.
   */
  function handleWizardClose() {
    setWizardOpen(false);
    setWizardDefinitionKey(null);
  }

  /** Refetches assignment definitions using the scoped query key only.
   * @returns {Promise<void>} Promise resolving once invalidate-then-refetch completes.
   */
  async function handleRetryAssignmentsData() {
    setDeleteOutcome(null);
    await refetchAfterStaleInvalidate(queryClient, queryKeys.assignmentDefinitionPartials());
  }

  /** Confirms and runs one assignment-definition delete.
   * @returns {Promise<void>} Promise resolving once delete flow settles.
   */
  async function handleConfirmDelete(): Promise<void> {
    if (deleteTarget === null || deleteMutation.isPending) {
      return;
    }

    setDeleteError(null);
    setDeleteOutcome(null);

    let hasDeleteCompleted = false;

    try {
      await deleteMutation.mutateAsync({ definitionKey: deleteTarget.definitionKey });
      hasDeleteCompleted = true;
      setDeleteTarget(null);

      await refetchAfterStaleInvalidate(queryClient, queryKeys.assignmentDefinitionPartials());
      setDeleteOutcome({ type: 'success', message: DELETE_SUCCESS_MESSAGE });
    } catch (error: unknown) {
      logFrontendError(
        'features/assignments/AssignmentsManagementSurface.handleConfirmDelete',
        error,
        {
          definitionKey: deleteTarget.definitionKey,
          deleteCompleted: hasDeleteCompleted,
        }
      );

      if (!hasDeleteCompleted) {
        setDeleteError(DELETE_FAILURE_MESSAGE);
      }
    }
  }

  /** Closes the delete modal when the delete flow is idle.
   * @returns {void} No return value.
   */
  function handleDeleteModalClose() {
    if (deleteMutation.isPending) {
      return;
    }

    setDeleteError(null);
    setDeleteTarget(null);
  }

  return (
    <section
      aria-label={ASSIGNMENTS_PANEL_REGION_LABEL}
      aria-busy={isAssignmentsSurfaceBusy ? 'true' : undefined}
    >
      <Flex vertical gap={APP_GAP_MD}>
        <AssignmentsStatusAndActionsCard
          deleteOutcome={deleteOutcome}
          hasTrustworthyData={hasTrustworthyAssignmentsDataset && hasTrustworthyReferenceData}
          onCreateAssignment={handleCreateAssignment}
          onRefreshAssignmentsData={handleRetryAssignmentsData}
          shouldRenderActionLoadingState={assignmentsSurfaceState.shouldRenderActionLoadingState}
          shouldRenderBlockingState={assignmentsSurfaceState.shouldRenderBlockingState}
        />
        <AssignmentDefinitionsTable
          hasTrustworthyAssignmentsDataset={hasTrustworthyAssignmentsDataset}
          hasTrustworthyReferenceData={hasTrustworthyReferenceData}
          isDeletePending={deleteMutation.isPending}
          onDelete={(row) => {
            setDeleteError(null);
            setDeleteOutcome(null);
            setDeleteTarget(row);
          }}
          onUpdate={(row) => {
            setWizardMode('update');
            setWizardDefinitionKey(row.definitionKey);
            setWizardOpen(true);
          }}
          rows={assignmentsQuery.data ?? []}
          shouldRenderBlockingState={assignmentsSurfaceState.shouldRenderBlockingState}
          shouldRenderTableLoadingState={assignmentsSurfaceState.shouldRenderTableLoadingState}
        />
      </Flex>

      <AssignmentDefinitionWizardModal
        definitionKey={wizardDefinitionKey}
        mode={wizardMode}
        onClose={handleWizardClose}
        open={wizardOpen}
      />

      <AssignmentsDeleteModal
        deleteTarget={deleteTarget}
        error={deleteError}
        isDeleteMutationPending={deleteMutation.isPending}
        onCancel={handleDeleteModalClose}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </section>
  );
}
