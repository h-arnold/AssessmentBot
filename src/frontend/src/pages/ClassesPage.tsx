import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, Skeleton } from 'antd';
import { useMemo } from 'react';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { getClassPartialsQueryOptions, getYearGroupsQueryOptions } from '../query/sharedQueries';
import { buildClassesPageModel, type InvalidClassesPageDataViewModel } from './classes/classesPageModel';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Messages for Classes page states.
 */
const CLASSES_PAGE_LOADING_LABEL = 'Classes page loading';
const CLASSES_BLOCKING_ERROR_MESSAGE = 'Classes data could not be trusted or loaded.';
const CLASSES_PAGE_EMPTY_DESCRIPTION = 'No year groups configured yet.';

/**
 * Returns whether a single dataset should block.
 *
 * @param {Readonly<{ isDatasetFailed: boolean; hasQueryData: boolean; isQueryError: boolean; isDatasetReady: boolean; isDatasetTrustworthy: boolean; hasTrustworthyDataset: boolean; }>} input Dataset state.
 * @returns {boolean} True if dataset should block.
 */
function shouldBlockSingleDataset(
  input: Readonly<{
    isDatasetFailed: boolean;
    hasQueryData: boolean;
    isQueryError: boolean;
    isDatasetReady: boolean;
    isDatasetTrustworthy: boolean;
    hasTrustworthyDataset: boolean;
  }>
): boolean {
  if (input.isDatasetFailed) {
    return !input.hasQueryData || input.isQueryError;
  }

  if (input.isDatasetReady && !input.isDatasetTrustworthy) {
    return true;
  }

  return input.hasTrustworthyDataset && input.isQueryError;
}

/**
 * Returns whether classes content should be blocked.
 *
 * @param {Readonly<{ classPartials: object; yearGroups: object; }>} input States for both datasets.
 * @returns {boolean} True if should block.
 */
function shouldRenderClassesBlockingState(
  input: Readonly<{
    classPartials: Readonly<{
      isDatasetFailed: boolean;
      hasQueryData: boolean;
      isQueryError: boolean;
      isDatasetReady: boolean;
      isDatasetTrustworthy: boolean;
      hasTrustworthyDataset: boolean;
    }>;
    yearGroups: Readonly<{
      isDatasetFailed: boolean;
      hasQueryData: boolean;
      isQueryError: boolean;
      isDatasetReady: boolean;
      isDatasetTrustworthy: boolean;
      hasTrustworthyDataset: boolean;
    }>;
  }>
): boolean {
  return shouldBlockSingleDataset(input.classPartials) || shouldBlockSingleDataset(input.yearGroups);
}

/**
 * Returns whether a dataset has recovered from failed warmup.
 *
 * @param {Readonly<{ isDatasetFailed: boolean; hasQueryData: boolean; isQueryError: boolean; }>} input Recovery inputs.
 * @returns {boolean} True if recovered.
 */
function hasRecoveredDataset(
  input: Readonly<{
    isDatasetFailed: boolean;
    hasQueryData: boolean;
    isQueryError: boolean;
  }>
): boolean {
  return input.isDatasetFailed && input.hasQueryData && !input.isQueryError;
}

/**
 * Returns whether a dataset is renderable.
 *
 * @param {Readonly<{ hasTrustworthyDataset: boolean; isDatasetFailed: boolean; hasQueryData: boolean; isQueryError: boolean; }>} input Renderability inputs.
 * @returns {boolean} True if renderable.
 */
function isDatasetRenderable(
  input: Readonly<{
    hasTrustworthyDataset: boolean;
    isDatasetFailed: boolean;
    hasQueryData: boolean;
    isQueryError: boolean;
  }>
): boolean {
  const hasRecovered = hasRecoveredDataset({
    isDatasetFailed: input.isDatasetFailed,
    hasQueryData: input.hasQueryData,
    isQueryError: input.isQueryError,
  });
  return input.hasTrustworthyDataset || hasRecovered;
}

/**
 * Resolves whether classes surface should show loading or blocking states.
 *
 * @param {Readonly<{ classPartials: object; yearGroups: object; }>} input Dataset and query state.
 * @returns {Readonly<{ shouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; }>} Surface state.
 */
function getClassesSurfaceState(
  input: Readonly<{
    classPartials: Readonly<{
      hasQueryData: boolean;
      isQueryError: boolean;
      isDatasetFailed: boolean;
      isDatasetReady: boolean;
      isDatasetTrustworthy: boolean;
      hasTrustworthyDataset: boolean;
    }>;
    yearGroups: Readonly<{
      hasQueryData: boolean;
      isQueryError: boolean;
      isDatasetFailed: boolean;
      isDatasetReady: boolean;
      isDatasetTrustworthy: boolean;
      hasTrustworthyDataset: boolean;
    }>;
  }>
): Readonly<{ shouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean }> {
  const isBlocking = shouldRenderClassesBlockingState(input);

  if (isBlocking) {
    return {
      shouldRenderBlockingState: true,
      shouldRenderLoadingState: false,
    };
  }

  const hasRenderableClassPartials = isDatasetRenderable(input.classPartials);
  const hasRenderableYearGroups = isDatasetRenderable(input.yearGroups);
  const hasRenderableDatasets = hasRenderableClassPartials && hasRenderableYearGroups;

  return {
    shouldRenderBlockingState: false,
    shouldRenderLoadingState: !hasRenderableDatasets,
  };
}

/**
 * Returns whether the classes surface is busy (fetching).
 *
 * @param {Readonly<{ isClassPartialsQueryFetching: boolean; isYearGroupsQueryFetching: boolean; }>} input Fetching state.
 * @returns {boolean} True when busy.
 */
function isClassesSurfaceBusy(input: Readonly<{
  isClassPartialsQueryFetching: boolean;
  isYearGroupsQueryFetching: boolean;
}>): boolean {
  return input.isClassPartialsQueryFetching || input.isYearGroupsQueryFetching;
}

/**
 * Checks if the model result is invalid.
 *
 * @param {unknown} modelResult The model result.
 * @returns {boolean} True if invalid.
 */
function isModelInvalid(modelResult: unknown): boolean {
  return (modelResult as InvalidClassesPageDataViewModel).type === 'invalidClassesPageData';
}

/**
 * Checks if the model result represents an empty state.
 *
 * @param {unknown} modelResult The model result.
 * @returns {boolean} True if empty.
 */
function isModelEmpty(modelResult: unknown): boolean {
  return (
    'panels' in (modelResult as Record<string, unknown>) &&
    (modelResult as { panels: unknown[] }).panels.length === 0 &&
    (modelResult as { defaultExpandedPanelKeys: unknown[] }).defaultExpandedPanelKeys.length === 0
  );
}

/**
 * Renders the content based on the current state.
 *
 * @param {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; }>} properties Render properties.
 * @returns {JSX.Element} The rendered content.
 */
function renderClassesContent(
  properties: Readonly<{
    finalShouldRenderBlockingState: boolean;
    shouldRenderLoadingState: boolean;
    shouldRenderEmptyState: boolean;
  }>
): JSX.Element {
  if (properties.finalShouldRenderBlockingState) {
    return <Alert showIcon title={CLASSES_BLOCKING_ERROR_MESSAGE} type="error" />;
  }

  if (properties.shouldRenderLoadingState) {
    return (
      <div aria-label={CLASSES_PAGE_LOADING_LABEL} aria-live="polite" role="status">
        <Skeleton active paragraph={{ rows: 4 }} title={{ width: '40%' }} />
      </div>
    );
  }

  if (properties.shouldRenderEmptyState) {
    return <Empty description={CLASSES_PAGE_EMPTY_DESCRIPTION} />;
  }

  return (
    <div role="region" aria-label="Year group panels">
      {/* Placeholder for Section 4 implementation */}
    </div>
  );
}

/**
 * Renders the Classes page with owned-surface loading, blocking, and empty states.
 *
 * Files read (Mandatory Reading):
 * - AGENTS.md
 * - src/frontend/AGENTS.md
 * - SPEC.md
 * - CLASSES_PAGE_LAYOUT.md
 * - docs/developer/frontend/frontend-loading-and-width-standards.md
 * - docs/developer/frontend/frontend-react-query-and-prefetch.md
 * - src/frontend/src/features/auth/startupWarmupState.ts
 * - src/frontend/src/pages/AssignmentsPage.tsx
 * - src/frontend/src/query/sharedQueries.ts
 * - src/frontend/src/pages/ClassesPage.spec.tsx
 * - src/frontend/src/pages/classes/classesPageModel.ts
 *
 * @returns {JSX.Element} The Classes page.
 */
/**
 * Builds dataset state object for a single dataset.
 *
 * @param {Readonly<{ queryData: unknown; isQueryError: boolean; isDatasetFailed: boolean; isDatasetReady: boolean; isDatasetTrustworthy: boolean; hasTrustworthyDataset: boolean; }>} input State inputs.
 * @returns {Readonly<{ hasQueryData: boolean; isQueryError: boolean; isDatasetFailed: boolean; isDatasetReady: boolean; isDatasetTrustworthy: boolean; hasTrustworthyDataset: boolean; }>} Dataset state object.
 */
function buildDatasetState(
  input: Readonly<{
    queryData: unknown;
    isQueryError: boolean;
    isDatasetFailed: boolean;
    isDatasetReady: boolean;
    isDatasetTrustworthy: boolean;
    hasTrustworthyDataset: boolean;
  }>
): Readonly<{
  hasQueryData: boolean;
  isQueryError: boolean;
  isDatasetFailed: boolean;
  isDatasetReady: boolean;
  isDatasetTrustworthy: boolean;
  hasTrustworthyDataset: boolean;
}> {
  return {
    hasQueryData: input.queryData !== undefined,
    isQueryError: input.isQueryError,
    isDatasetFailed: input.isDatasetFailed,
    isDatasetReady: input.isDatasetReady,
    isDatasetTrustworthy: input.isDatasetTrustworthy,
    hasTrustworthyDataset: input.hasTrustworthyDataset,
  };
}

/**
 * Computes the final render states for the Classes page.
 *
 * @param {Readonly<{ classesSurfaceState: ReturnType<typeof getClassesSurfaceState>; modelResult: unknown; }>} input Surface state and model result.
 * @returns {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; }>} Final render states.
 */
function getFinalClassesPageStates(input: Readonly<{
  classesSurfaceState: ReturnType<typeof getClassesSurfaceState>;
  modelResult: unknown;
}>): Readonly<{
  finalShouldRenderBlockingState: boolean;
  shouldRenderLoadingState: boolean;
  shouldRenderEmptyState: boolean;
}> {
  const finalShouldRenderBlockingState =
    input.classesSurfaceState.shouldRenderBlockingState || isModelInvalid(input.modelResult);
  const shouldRenderLoadingState = input.classesSurfaceState.shouldRenderLoadingState;
  const shouldRenderEmptyState =
    !finalShouldRenderBlockingState &&
    !shouldRenderLoadingState &&
    isModelEmpty(input.modelResult);

  return {
    finalShouldRenderBlockingState,
    shouldRenderLoadingState,
    shouldRenderEmptyState,
  };
}

/**
 * Renders the Classes page with owned-surface loading, blocking, and empty states.
 *
 * @returns {JSX.Element} The Classes page.
 */
export function ClassesPage() {
  const startupWarmupState = useStartupWarmupState();

  const classPartialsSnapshot = startupWarmupState.snapshot.datasets.classPartials;
  const yearGroupsSnapshot = startupWarmupState.snapshot.datasets.yearGroups;

  // Use live queries that remain enabled even if startup warmup failed
  const classPartialsQuery = useQuery({
    ...getClassPartialsQueryOptions(),
    enabled:
      startupWarmupState.isDatasetReady('classPartials') ||
      startupWarmupState.isDatasetFailed('classPartials'),
    refetchOnMount: false,
  });

  const yearGroupsQuery = useQuery({
    ...getYearGroupsQueryOptions(),
    enabled:
      startupWarmupState.isDatasetReady('yearGroups') ||
      startupWarmupState.isDatasetFailed('yearGroups'),
    refetchOnMount: false,
  });

  // Build dataset states
  const classPartialsDatasetState = buildDatasetState({
    queryData: classPartialsQuery.data,
    isQueryError: classPartialsQuery.isError,
    isDatasetFailed: startupWarmupState.isDatasetFailed('classPartials'),
    isDatasetReady: startupWarmupState.isDatasetReady('classPartials'),
    isDatasetTrustworthy: classPartialsSnapshot.isTrustworthy,
    hasTrustworthyDataset:
      startupWarmupState.isDatasetReady('classPartials') && classPartialsSnapshot.isTrustworthy,
  });

  const yearGroupsDatasetState = buildDatasetState({
    queryData: yearGroupsQuery.data,
    isQueryError: yearGroupsQuery.isError,
    isDatasetFailed: startupWarmupState.isDatasetFailed('yearGroups'),
    isDatasetReady: startupWarmupState.isDatasetReady('yearGroups'),
    isDatasetTrustworthy: yearGroupsSnapshot.isTrustworthy,
    hasTrustworthyDataset:
      startupWarmupState.isDatasetReady('yearGroups') && yearGroupsSnapshot.isTrustworthy,
  });

  // Compute surface state
  const classesSurfaceState = getClassesSurfaceState({
    classPartials: classPartialsDatasetState,
    yearGroups: yearGroupsDatasetState,
  });

  // Compute busy state
  const isClassesSurfaceBusyValue = isClassesSurfaceBusy({
    isClassPartialsQueryFetching: classPartialsQuery.isFetching,
    isYearGroupsQueryFetching: yearGroupsQuery.isFetching,
  });

  // Build the view model - move conditional logic inside useMemo
  const modelResult = useMemo(() => {
    const classPartials = classPartialsQuery.data ?? [];
    const yearGroups = yearGroupsQuery.data ?? [];
    return buildClassesPageModel(classPartials, yearGroups);
  }, [classPartialsQuery.data, yearGroupsQuery.data]);

  // Determine final states
  const { finalShouldRenderBlockingState, shouldRenderLoadingState, shouldRenderEmptyState } =
    getFinalClassesPageStates({
      classesSurfaceState,
      modelResult,
    });

  return (
    <PageSection
      heading={pageContent.classes.heading}
      summary={pageContent.classes.summary}
    >
      <section
        aria-label="Classes page content"
        aria-busy={isClassesSurfaceBusyValue ? 'true' : undefined}
      >
        {renderClassesContent({
          finalShouldRenderBlockingState,
          shouldRenderLoadingState,
          shouldRenderEmptyState,
        })}
      </section>
    </PageSection>
  );
}
