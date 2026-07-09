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

import { useEffect, useState, type JSX } from 'react';
import { Button, Card, Flex, Typography } from 'antd';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { adaptMetricsToHeatmap } from '../../services/dataAnalysis/heatmapAdapter';
import { logFrontendError } from '../../logging/frontendLogger';
import { TaskHeatmapTable } from './TaskHeatmapTable';

type TaskHeatmapPageProperties = Readonly<{
  /** The already-computed analyser result (non-null, narrowed by the ready gate). */
  analyserResult: AveragingResult;
  /** The full class data (non-null, narrowed by the ready gate). */
  classFull: ClassFull;
  /** The assignment ID to project the heatmap for. */
  assignmentId: string;
  /** Callback invoked when the user clicks Back to return to the overview. */
  onBack: () => void;
  /** Callback invoked when the user clicks Refresh to re-run the data pipeline. */
  refetch: () => void;
}>;

/**
 * Render the Task Heatmap page for a single assignment.
 *
 * Computes `HeatmapResult` exactly once via a lazy `useState` initializer.
 * When `adaptMetricsToHeatmap` throws (unknown `assignmentId`), the error is
 * logged via `logFrontendError('TaskHeatmapPage', error)` and `onBack` is
 * called — no in-view error message is rendered.
 *
 * @param {TaskHeatmapPageProperties} properties - Component properties.
 * @param {AveragingResult} properties.analyserResult - The analyser result.
 * @param {ClassFull} properties.classFull - The full class data.
 * @param {string} properties.assignmentId - The assignment ID.
 * @param {() => void} properties.onBack - Back callback.
 * @param {() => void} properties.refetch - Refresh callback.
 * @returns {JSX.Element | null} The rendered heatmap page or `null` on error.
 */
export function TaskHeatmapPage({
  analyserResult,
  classFull,
  assignmentId,
  onBack,
  refetch,
}: TaskHeatmapPageProperties): JSX.Element | null {
  // Compute the heatmap result exactly ONCE via a lazy initializer. If the
  // adapter throws (unknown assignmentId), the error is caught and stored so
  // the effect below can log it and navigate back.
  const [state] = useState(() => {
    try {
      return {
        heatmapResult: adaptMetricsToHeatmap(analyserResult, classFull, assignmentId),
        error: null as unknown,
      };
    } catch (error: unknown) {
      return { heatmapResult: null, error };
    }
  });

  // On mount (or when error/onBack changes), log the error and auto-navigate
  // back to the overview. No in-view error UI is rendered.
  useEffect(() => {
    if (state.error !== null) {
      logFrontendError('TaskHeatmapPage', state.error);
      onBack();
    }
  }, [state.error, onBack]);

  // When the adapter threw, render nothing — the effect above will have called
  // onBack and the component will be unmounted.
  if (state.error !== null || state.heatmapResult === null) {
    return null;
  }

  const { heatmapResult } = state;

  return (
    <Flex vertical gap={16}>
      {/* ── Header region ──────────────────────────────────────────── */}
      <Card size="small">
        <Flex justify="space-between" align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
          {heatmapResult.assignmentName}
          </Typography.Title>
          <Button
            type="text"
            icon={<ArrowLeft size={16} />}
            aria-label="Back to Class overview"
            onClick={onBack}
          />
        </Flex>
        <Typography.Text type="secondary">{heatmapResult.className}</Typography.Text>
      </Card>

      {/* ── Control region ─────────────────────────────────────────── */}
      <Card size="small">
        <Flex justify="space-between">
          <Button icon={<RefreshCw size={16} />} onClick={refetch}>
            Refresh
          </Button>
        </Flex>
      </Card>

      {/* ── Table region ───────────────────────────────────────────── */}
      <Card size="small">
        <TaskHeatmapTable heatmapResult={heatmapResult} />
      </Card>
    </Flex>
  );
}