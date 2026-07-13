/**
 * Task Heatmap page component.
 *
 * Renders the full heatmap view for a single assignment, consuming an already-
 * computed `AveragingResult` (no second `useClassPageData` call).  The component
 * wraps `adaptMetricsToHeatmap` in a `try`/`catch`; on error it logs the error
 * via the frontend logger and calls `onBack` (no in-view error UI).
 *
 * @see ACTION_PLAN.md §5 — TaskHeatmapPage
 * @see TASK_HEATMAP_LAYOUT.md — §"1. Header region", §"2. Control region", §"3. Table region"
 * @see SPEC.md — §"Page composition", §"Navigation / breadcrumb", §"Error handling"
 */

import { useEffect, useMemo, useState, type JSX } from 'react';
import { Alert, Button, Card, Flex } from 'antd';
import { RefreshCw } from 'lucide-react';
import { APP_GAP_MD } from '../../theme/spacing';

import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import {
  adaptMetricsToHeatmap,
  TaskTitlesUnavailableError,
} from '../../services/dataAnalysis/heatmapAdapter';
import { logFrontendError } from '../../logging/frontendLogger';
import { TaskHeatmapTable } from './TaskHeatmapTable';
import { PageTitleCard, PageNavCard } from '../../components/PageHeader';

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
}>;

/**
 * Derive the header display labels from class data.
 *
 * @param {ClassFull} classFull - The full class data.
 * @param {string} assignmentId - The assignment identifier.
 * @returns {HeaderLabels} Always-available header values.
 */
function getHeaderLabels(classFull: ClassFull, assignmentId: string): HeaderLabels {
  const assignment = classFull.assignments.find((a) => a.assignmentId === assignmentId);
  return {
    assignmentName: assignment?.assignmentDefinition.primaryTitle ?? '',
  };
}

/**
 * Lazily compute the heatmap result, catching errors into state.
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
 * Computes `HeatmapResult` exactly once via a lazy `useState` initializer.
 * The error catch distinguishes two error types:
 *
 * - {@link TaskTitlesUnavailableError}: renders an in-view `Alert` in place of
 *   the table region while keeping the header `Card` visible.  Does NOT call
 *   `onBack`.
 * - All other errors (generic `Error`, unknown `assignmentId`): logs via
 *   `logFrontendError('TaskHeatmapPage', error)` and calls `onBack` exactly
 *   once — no in-view error UI.
 *
 * @param {TaskHeatmapPageProperties} properties - Component properties.
 * @param {AveragingResult} properties.analyserResult - The analyser result.
 * @param {ClassFull} properties.classFull - The full class data.
 * @param {string} properties.assignmentId - The assignment ID.
 * @param {AssignmentDefinitionPartialsResponse} properties.assignmentDefinitionPartials -
 *   Warm-up partials for column/title sourcing.
 * @param {() => void} properties.onBack - Back callback.
 * @param {() => void} properties.refetch - Refresh callback.
 * @returns {JSX.Element | null} The rendered heatmap page, an error `Alert`,
 *   or `null` on generic error (after navigation).
 */
export function TaskHeatmapPage({
  analyserResult,
  classFull,
  assignmentId,
  assignmentDefinitionPartials,
  onBack: backCallback,
  refetch,
}: TaskHeatmapPageProperties): JSX.Element | null {
  const [state] = useState<HeatmapPageState>(() =>
    computeHeatmapState(analyserResult, classFull, assignmentId, assignmentDefinitionPartials)
  );

  const { assignmentName } = useMemo<HeaderLabels>(
    () => getHeaderLabels(classFull, assignmentId),
    [classFull, assignmentId]
  );

  const isTitleError: boolean = state.error instanceof TaskTitlesUnavailableError;
  const isGenericError: boolean = state.error !== null && !isTitleError;

  // Generic errors (unknown assignmentId): log and auto-navigate back.
  useEffect(() => {
    if (isGenericError) {
      logFrontendError('TaskHeatmapPage', state.error);
      backCallback();
    }
  }, [isGenericError, state.error, backCallback]);

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
        <Alert type="error" showIcon title="Task titles are currently unavailable." description="Please try reloading the page." role="alert" />
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
        actions={
          <Button icon={<RefreshCw size={16} />} onClick={refetch}>
            Refresh
          </Button>
        }
      />
      <Card size="small">
        <TaskHeatmapTable heatmapResult={heatmapResult!} />
      </Card>
    </Flex>
  );
}