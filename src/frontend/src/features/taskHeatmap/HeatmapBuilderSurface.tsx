/**
 * Feature-owned entry component for the standalone Heatmaps builder surface.
 *
 * @remarks
 * Assembles the full builder surface:
 * chrome region (`PageTitleCard` + `PageNavCard` actions-only with Refresh),
 * the co-located `HeatmapSelectionBar`, and the content region.
 *
 * **Precedence-order ownership (single source).** The content region renders
 * exactly ONE of the six ranked branches below, chosen by a single decision in
 * `renderContent` (not scattered conditionals across the component):
 *
 *   1. `loading`           → shape-matched `Skeleton`
 *   2. `blocking`          → `Result` (documented deviation from `Alert`; see `docs/developer/frontend/frontend-logging-and-error-handling.md` §4)
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
 * @see docs/developer/frontend/frontend-logging-and-error-handling.md
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
import type { BlockingConfig } from '../../errors/blockingConfig';
import { resolveBlockingResultConfig } from '../../errors/blockingConfig';

/**
 * User-safe `Result` configuration per `HeatmapsPageError.type`.
 *
 * @remarks
 * The mapping *mechanism* is shared (`resolveBlockingResultConfig`); only this
 * feature-specific copy is owned here. Titles/status/retryable match the prior
 * per-feature switch exactly.
 */
const HEATMAPS_BLOCKING_CONFIG: Record<HeatmapsPageError['type'], BlockingConfig> = {
  classNotFound: { status: 'error', title: 'Class not found', retryable: false },
  adapterError: { status: 'error', title: 'The heatmap could not be built', retryable: false },
  classQueryError: {
    status: 'warning',
    title: 'We could not load this class',
    retryable: true,
  },
  assignmentDefinitionPartialsFailed: {
    status: 'warning',
    title: 'Assignment definitions failed to load',
    retryable: true,
  },
  assignmentDefinitionPartialsUntrustworthy: {
    status: 'warning',
    title: 'Assignment definitions are not trustworthy',
    retryable: true,
  },
  analyserError: { status: 'warning', title: 'Analysis failed', retryable: true },
};

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
  const config = resolveBlockingResultConfig(error, HEATMAPS_BLOCKING_CONFIG);
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
 * Persistent content region for the builder surface.
 *
 * @remarks
 * Wraps the rendered content in a container that carries the background-refresh
 * busy signal. A disabled Refresh button is removed from the accessibility
 * tree, so its `aria-busy` would never be announced; the busy signal therefore
 * lives on this persistent container, paired with a visually-hidden live status.
 *
 * @param {Readonly<{ isRefreshing: boolean; children: JSX.Element }>} properties - Region properties.
 * @param {boolean} properties.isRefreshing - Whether a background refresh is in flight.
 * @param {JSX.Element} properties.children - The rendered content region.
 * @returns {JSX.Element} The busy-aware content region.
 */
function ContentRegion({
  isRefreshing,
  children,
}: Readonly<{ isRefreshing: boolean; children: JSX.Element }>): JSX.Element {
  return (
    <div aria-busy={isRefreshing}>
      <span className="sr-only" aria-live="polite">
        {isRefreshing ? 'Refreshing heatmap…' : ''}
      </span>
      {children}
    </div>
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
      ? (classFull.className ?? pageContent.heatmaps.heading)
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
      <ContentRegion isRefreshing={isRefreshing}>{renderContent()}</ContentRegion>
    </Flex>
  );
}
