/**
 * Feature-owned entry component for the standalone Heatmaps builder surface.
 *
 * @remarks
 * Assembles the full builder surface per `HEATMAPS_PAGE_LAYOUT.md`:
 * chrome region (`PageTitleCard` + `PageNavCard` actions-only with Refresh),
 * the co-located `HeatmapSelectionBar`, and the content region.
 *
 * **Precedence-order ownership (single source).** The content region renders
 * exactly ONE of the six ranked branches below, chosen by a single decision in
 * `renderContent` (not scattered conditionals across the component):
 *
 *   1. `loading`           → shape-matched `Skeleton`
 *   2. `blocking`          → `Result` (layout-spec documented deviation from `Alert`)
 *   3. no class selected   → `Empty` (no-class copy)
 *   4. no assignments      → `Empty` (no-assignments copy)
 *   5. ready w/ selections → merged-table `Card`
 *   6. selections present but the merged result not yet available → defensive
 *      shape-matched `Skeleton` (avoids flashing empty while the adapter resolves)
 *
 * The rank is derived from the hook's discriminated `surfaceState` plus the
 * `selection` (class/assignment presence). Because the hook already encodes the
 * blocking-vs-loading-vs-ready precedence, the surface only needs to branch on
 * that one derived state and the two selection booleans — no second, conflicting
 * readiness calculation lives here.
 *
 * The component consumes the REAL `useHeatmapsPageData` hook (no data logic is
 * duplicated in the surface) and never imports from `pages/` for feature logic.
 *
 * @see HEATMAPS_PAGE_LAYOUT.md
 * @see ACTION_PLAN.md §Section 6
 */

import type { JSX } from 'react';
import { Button, Card, Empty, Flex, Result, Skeleton } from 'antd';
import { RefreshCw } from 'lucide-react';
import { PageTitleCard, PageNavCard } from '../../components/PageHeader/PageHeader';
import { pageContent } from '../../pages/pageContent';
import { APP_GAP_MD } from '../../theme/spacing';
import { TaskHeatmapTable } from './TaskHeatmapTable';
import { HeatmapSelectionBar } from './HeatmapSelectionBar';
import { useHeatmapsPageData } from './useHeatmapsPageData';
import type { HeatmapsPageError } from './heatmapsSurfaceState';

/** User-safe configuration for a blocking `Result` per the Class Page taxonomy. */
type BlockingConfig = Readonly<{
  /** Ant Design `Result` status. */
  status: 'error' | 'warning';
  /** User-facing title. */
  title: string;
  /** Whether a Retry action should be offered (retryable errors). */
  retryable: boolean;
}>;

/**
 * Map a structured surface error to a user-safe `Result` configuration.
 *
 * @param {HeatmapsPageError} error - The structured blocking error.
 * @returns {BlockingConfig} The user-safe result configuration.
 */
function resolveBlockingConfig(error: HeatmapsPageError): BlockingConfig {
  switch (error.type) {
    case 'classNotFound': {
      return { status: 'error', title: 'Class not found', retryable: false };
    }
    case 'adapterError': {
      return { status: 'error', title: 'The heatmap could not be built', retryable: false };
    }
    case 'classQueryError': {
      return {
        status: 'warning',
        title: 'We could not load this class',
        retryable: true,
      };
    }
    case 'assignmentDefinitionPartialsFailed': {
      return {
        status: 'warning',
        title: 'Assignment definitions failed to load',
        retryable: true,
      };
    }
    case 'assignmentDefinitionPartialsUntrustworthy': {
      return {
        status: 'warning',
        title: 'Assignment definitions are not trustworthy',
        retryable: true,
      };
    }
    case 'analyserError': {
      return { status: 'warning', title: 'Analysis failed', retryable: true };
    }
  }
}

/**
 * Render the content region for a blocking surface error.
 *
 * @param {HeatmapsPageError} error - The structured blocking error.
 * @param {() => void} onRetry - Retry callback (re-runs the owned queries).
 * @returns {JSX.Element} The blocking `Result`.
 */
function BlockingResult({
  error,
  onRetry,
}: Readonly<{ error: HeatmapsPageError; onRetry: () => void }>): JSX.Element {
  const config = resolveBlockingConfig(error);
  return (
    <Result
      status={config.status}
      title={config.title}
      extra={
        config.retryable ? (
          <Button type="primary" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * Feature-owned entry component for the standalone Heatmaps builder surface.
 *
 * @returns {JSX.Element} The rendered builder surface.
 */
export function HeatmapBuilderSurface(): JSX.Element {
  const {
    selection,
    classPartials,
    assignmentDefinitionPartials,
    classFull,
    mergedResult,
    mergedPreview,
    surfaceState,
    isRefreshing,
    refetch,
    selectClass,
    changeTopics,
    changeAssignments,
  } = useHeatmapsPageData();

  const title =
    selection.classId !== null && classFull !== null
      ? classFull.className ?? pageContent.heatmaps.heading
      : pageContent.heatmaps.heading;

  const cellPreviewLookup = mergedPreview?.mergedLookup ?? null;
  const previewStatusByTaskKey = mergedPreview?.previewStatusByTaskKey;

  const renderContent = (): JSX.Element => {
    if (surfaceState.status === 'loading') {
      return (
        <div role="status" aria-live="polite" aria-label="Loading heatmap content">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      );
    }

    if (surfaceState.status === 'blocking') {
      return <BlockingResult error={surfaceState.error} onRetry={refetch} />;
    }

    if (selection.classId === null) {
      return <Empty description={pageContent.heatmaps.noClassEmpty} />;
    }

    if (selection.assignmentIds.length === 0) {
      return <Empty description={pageContent.heatmaps.noAssignmentsEmpty} />;
    }

    if (mergedResult !== null) {
      return (
        <Card size="small">
          <TaskHeatmapTable
            heatmapResult={mergedResult}
            cellPreviewLookup={cellPreviewLookup}
            isAssignmentLoading={false}
            showAssignmentError={false}
            previewStatusByTaskKey={previewStatusByTaskKey}
          />
        </Card>
      );
    }

    // Defensive fallback: selections present but the merged result is not yet
    // available — keep the shape-matched skeleton rather than flashing empty.
    return (
      <div role="status" aria-live="polite" aria-label="Loading heatmap content">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  };

  return (
    <Flex vertical gap={APP_GAP_MD}>
      <PageTitleCard title={title} titleLevel={2} />
      <PageNavCard
        actions={
          <Button
            icon={<RefreshCw size={16} />}
            onClick={() => {
              refetch();
            }}
            aria-busy={isRefreshing}
            disabled={isRefreshing}
          >
            Refresh
          </Button>
        }
      />
      <Card size="small">
        <HeatmapSelectionBar
          selection={selection}
          classPartials={classPartials}
          assignmentDefinitionPartials={assignmentDefinitionPartials}
          classFull={classFull}
          onSelectClass={selectClass}
          onChangeTopics={changeTopics}
          onChangeAssignments={changeAssignments}
        />
      </Card>
      {renderContent()}
    </Flex>
  );
}
