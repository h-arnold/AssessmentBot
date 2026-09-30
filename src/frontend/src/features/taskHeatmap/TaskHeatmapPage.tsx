/**
 * Task Heatmap page component.
 *
 * Renders the full heatmap view for a single assignment, consuming an already-
 * computed `AveragingResult` (no second `useClassPageData` call).  The component
 * wraps `adaptMetricsToHeatmap` in a `try`/`catch`; on error it logs the error
 * via the frontend logger and calls `onBack` (no in-view error UI).
 *
 * @see SPEC.md
 */

import { useMemo, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Flex, App as AntdApp } from 'antd';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { APP_GAP_MD } from '../../theme/spacing';

import type { ReRunContext } from '../shared/reRunAssessmentContext';

import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import {
  adaptMetricsToHeatmap,
  TaskTitlesUnavailableError,
} from '../../services/dataAnalysis/heatmapAdapter';
import { logFrontendError, logFrontendEvent } from '../../logging/frontendLogger';
import { useLogOnce } from '../../hooks/useLogOnce';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import { getAssignmentQueryOptions } from '../../query/sharedQueries';
import { TaskHeatmapTable } from './TaskHeatmapTable';
import { PageTitleCard, PageNavCard } from '../../components/PageHeader/PageHeader';

type HeatmapPageState = Readonly<{
  heatmapResult: ReturnType<typeof adaptMetricsToHeatmap> | null;
  error: unknown;
}>;

type HeaderLabels = Readonly<{
  assignmentName: string;
}>;

type TaskHeatmapPageProperties = Readonly<{
  /** The already-computed analyser result (non-null, narrowed by the ready gate). */
  analyserResult: AveragingResult;
  /** The full class data (non-null, narrowed by the ready gate). */
  classFull: ClassFull;
  /** The assignment ID to project the heatmap for. */
  assignmentId: string;
  /** Warm-up assignment-definition partials (non-null, narrowed by the ready gate). */
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse;
  /** Callback invoked when the user clicks Back to return to the overview. */
  onBack: () => void;
  /** Callback invoked when the user clicks Refresh to re-run the data pipeline. */
  refetch: () => void;
  /** Callback invoked when the user clicks Re-run Assessment (renders only when supplied). */
  onReRunAssessment?: (context: ReRunContext) => void;
}>;

/**
 * Reads the persisted definition key linked to an assignment.
 *
 * @param {ClassFull} classFull - The full class data.
 * @param {string} assignmentId - The assignment identifier.
 * @returns {string | null} The linked definition key, or null when the assignment is absent.
 */
function getAssignmentDefinitionKey(classFull: ClassFull, assignmentId: string): string | null {
  const assignment = classFull.assignments.find((a) => a.assignmentId === assignmentId);
  return assignment?.assignmentDefinitionKey ?? null;
}

/**
 * Derive the header display labels from class data.
 *
 * Resolves the assignment's `primaryTitle` from the
 * `assignmentDefinitionPartials` registry rather than from an embedded
 * `assignmentDefinition` object (which was replaced with a lightweight
 * `assignmentDefinitionKey`).
 *
 * @param {ClassFull} classFull - The full class data.
 * @param {string} assignmentId - The assignment identifier.
 * @param {AssignmentDefinitionPartialsResponse} adp - The definition registry.
 * @returns {HeaderLabels} Always-available header values.
 */
function getHeaderLabels(
  classFull: ClassFull,
  assignmentId: string,
  adp: AssignmentDefinitionPartialsResponse
): HeaderLabels {
  const definitionKey = getAssignmentDefinitionKey(classFull, assignmentId);
  const partial = definitionKey
    ? adp.find((p) => p.definitionKey === definitionKey)
    : undefined;
  return {
    assignmentName: partial?.primaryTitle ?? '',
  };
}

/**
 * Compute the heatmap result, catching errors into state.
 *
 * Called by `useMemo` so the result is recomputed whenever the inputs change
 * (e.g. after a `refetch`).
 *
 * @param {AveragingResult} analyserResult - The analyser result.
 * @param {ClassFull} classFull - The full class data.
 * @param {string} assignmentId - The assignment identifier.
 * @param {AssignmentDefinitionPartialsResponse} adp - Warm-up partials.
 * @returns {HeatmapPageState} The result or error.
 */
function computeHeatmapState(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  assignmentId: string,
  adp: AssignmentDefinitionPartialsResponse
): HeatmapPageState {
  try {
    return {
      heatmapResult: adaptMetricsToHeatmap(analyserResult, classFull, assignmentId, adp),
      error: null,
    };
  } catch (error: unknown) {
    return { heatmapResult: null, error };
  }
}

/**
 * Render the Task Heatmap page for a single assignment.
 *
 * Computes `HeatmapResult` via `useMemo` keyed on the four data props so the
 * result stays fresh after `refetch` brings new data.  The error catch
 * distinguishes two error types:
 *
 * - {@link TaskTitlesUnavailableError}: renders an in-view `Alert` in place of
 *   the table region while keeping the header `Card` visible.  Does NOT call
 *   `onBack`.
 * - All other errors (generic `Error`, unknown `assignmentId`): logs via
 *   `logFrontendError('TaskHeatmapPage', error)`, surfaces a user-safe
 *   toast message, then calls `onBack` exactly once — no in-view error UI.
 *
 * @param {TaskHeatmapPageProperties} properties - Component properties.
 * @param {AveragingResult} properties.analyserResult - The analyser result.
 * @param {ClassFull} properties.classFull - The full class data.
 * @param {string} properties.assignmentId - The assignment ID.
 * @param {AssignmentDefinitionPartialsResponse} properties.assignmentDefinitionPartials -
 *   Warm-up partials for column/title sourcing.
 * @param {() => void} properties.onBack - Back callback.
 * @param {() => void} properties.refetch - Refresh callback.
 * @param {(context: ReRunContext) => void} [properties.onReRunAssessment] -
 *   Re-run Assessment callback; the action renders only when supplied.
 * @returns {JSX.Element | null} The rendered heatmap page, an error `Alert`,
 *   or `null` on generic error (after navigation).
 */
export function TaskHeatmapPage({
  analyserResult,
  classFull,
  assignmentId,
  assignmentDefinitionPartials,
  onBack: backCallback,
  onReRunAssessment,
  refetch,
}: TaskHeatmapPageProperties): JSX.Element | null {
  const state = useMemo<HeatmapPageState>(() =>
    computeHeatmapState(analyserResult, classFull, assignmentId, assignmentDefinitionPartials),
    [analyserResult, classFull, assignmentId, assignmentDefinitionPartials]
  );

  const { assignmentName } = useMemo<HeaderLabels>(
    () => getHeaderLabels(classFull, assignmentId, assignmentDefinitionPartials),
    [classFull, assignmentId, assignmentDefinitionPartials]
  );

  const isTitleError: boolean = state.error instanceof TaskTitlesUnavailableError;
  const isGenericError: boolean = state.error !== null && !isTitleError;

  // Context-aware Ant Design message/notification API for user feedback.
  const { message } = AntdApp.useApp();

  // Assignment full-data query for cell preview popover data.
  const assignmentQuery = useQuery(getAssignmentQueryOptions(classFull.classId, assignmentId));

  const cellPreviewLookup = useMemo<CellPreviewLookup | null>(
    () => (assignmentQuery.data ? buildCellPreviewLookup(assignmentQuery.data) : null),
    [assignmentQuery.data],
  );

  const showAssignmentError: boolean = assignmentQuery.isError || assignmentQuery.data === null;
  const isAssignmentLoading: boolean = assignmentQuery.isPending;

  // Assignment-query error logging: fires once via useLogOnce guard.
  useLogOnce(assignmentQuery.isError, () => {
    logFrontendError('TaskHeatmapPage', assignmentQuery.error);
  });

  // Assignment not-found logging: fires once via useLogOnce guard.
  useLogOnce(
    assignmentQuery.data === null && !assignmentQuery.isPending && !assignmentQuery.isError,
    () => {
      logFrontendEvent('warn', {
        context: 'TaskHeatmapPage',
        errorMessage: 'Assignment not found in AssignmentFull payload',
      });
    },
  );

  // Generic errors (unknown assignmentId): log, surface user-safe message,
  // and auto-navigate back. Guarded against double-execution in React 19
  // StrictMode via useLogOnce.
  useLogOnce(isGenericError, () => {
    logFrontendError('TaskHeatmapPage', state.error);
    message.error('Something went wrong while loading the heatmap. Returning to class overview.');
    backCallback();
  });

  // Title-error logging: emits a developer diagnostic once when task titles
  // cannot be resolved, alongside the in-view Alert for the user.
  useLogOnce(isTitleError, () => {
    logFrontendEvent('warn', {
      context: 'TaskHeatmapPage',
      errorMessage: 'Task titles are currently unavailable.',
    });
  });

  /**
   * Handles the Re-run Assessment click: hands the assignment and its
   * persisted definition key to the owning class page.
   *
   * @returns {void}
   */
  function handleReRunAssessment(): void {
    onReRunAssessment?.({
      assignmentId,
      definitionKey: getAssignmentDefinitionKey(classFull, assignmentId),
    });
  }

  /**
   * Renders the navigation-card action buttons for the normal heatmap view.
   *
   * @remarks Re-run Assessment sits immediately left of Refresh when the
   * owner supplies a re-run callback; otherwise only Refresh renders. The
   * buttons return as a fragment so Ant Design's `Space` flattens them into
   * adjacent items (a conditional null child would leave an empty item).
   *
   * @returns {React.ReactNode} The action buttons.
   */
  function renderNavActions(): React.ReactNode {
    const refreshButton = (
      <Button
        icon={<RefreshCw size={16} />}
        onClick={() => {
          refetch();
          assignmentQuery.refetch();
        }}
      >
        Refresh
      </Button>
    );
    if (onReRunAssessment === undefined) {
      return refreshButton;
    }

    const reRunButton = (
      <Button icon={<RotateCcw size={16} />} onClick={handleReRunAssessment}>
        Re-run Assessment
      </Button>
    );
    return (
      <>
        {reRunButton}
        {refreshButton}
      </>
    );
  }

  if (isGenericError) {
    return null;
  }

  if (isTitleError) {
    // Title-error: render parent title + child title + nav + Alert, no onBack auto-navigate.
    // The Alert replaces the table region; only the title Cards and nav Card stay visible.
    return (
      <Flex vertical gap={APP_GAP_MD}>
        <PageTitleCard title={assignmentName} />
        <PageNavCard
          onBack={backCallback}
          backLabel="Back to Class overview"
          backAriaLabel="Back to Class overview"
        />
        <Alert type="error" showIcon title="Task titles are currently unavailable." description="Please try reloading the page." />
      </Flex>
    );
  }

  // Normal (successful) rendering.
  const { heatmapResult } = state;
  return (
    <Flex vertical gap={APP_GAP_MD}>
      <PageTitleCard title={heatmapResult!.assignmentName} />
      <PageNavCard
        onBack={backCallback}
        backLabel="Back to Class overview"
        backAriaLabel="Back to Class overview"
        actions={renderNavActions()}
      />
      <Card size="small">
        <TaskHeatmapTable heatmapResult={heatmapResult!} cellPreviewLookup={cellPreviewLookup} isAssignmentLoading={isAssignmentLoading} showAssignmentError={showAssignmentError} />
      </Card>
    </Flex>
  );
}