import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Collapse, Empty, Skeleton, Space, Typography } from 'antd';
import { type JSX, useMemo } from 'react';
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
const CLASSES_REFRESH_TEXT = 'Refreshing...';

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
 * Renders the year-group collapse with class cards.
 *
 * Uses Collapse.Panel children pattern instead of items prop to ensure proper
 * keyboard navigation support (Space/Enter to toggle, ArrowUp/ArrowDown to navigate).
 * This triggers a deprecation warning in Ant Design v6 but is the only way to
 * get proper keyboard support with custom header components.
 *
 * @param {Readonly<{ panels: Array<{ yearGroupKey: string; yearGroupLabel: string; classes: Array<{ classId: string; className: string; yearGroupKey: string; yearGroupLabel: string; }>; }>; defaultExpandedPanelKeys: string[]; }>} viewModel The view model with panels and default expanded keys.
 * @returns {JSX.Element} The rendered collapse.
 */
function renderYearGroupCollapse(
  viewModel: Readonly<{
    panels: ReadonlyArray<{
      yearGroupKey: string;
      yearGroupLabel: string;
      classes: ReadonlyArray<{
        classId: string;
        className: string;
        yearGroupKey: string;
        yearGroupLabel: string;
      }>;
    }>;
    defaultExpandedPanelKeys: ReadonlyArray<string>;
  }>
): JSX.Element {
  const { panels, defaultExpandedPanelKeys } = viewModel;

  return (
    <div role="region" aria-label="year group panels">
      {/*
       * Ant Design v6 Collapse: type assertion required because the library expects
       * mutable string[] for defaultActiveKey, but defaultExpandedPanelKeys is ReadonlyArray<string>.
       * This is a safe cast as the values are only read by the component.
       *
       * Using Collapse.Panel children pattern instead of items prop for proper keyboard
       * navigation support. This is the recommended approach for custom headers.
       */}
      <Collapse defaultActiveKey={defaultExpandedPanelKeys as string[]}>
        {panels.map((panel) => {
          const headerId = `panel-header-${panel.yearGroupKey}`;
          const contentId = `panel-content-${panel.yearGroupKey}`;
          const isExpanded = defaultExpandedPanelKeys.includes(panel.yearGroupKey);

          return (
            <Collapse.Panel
              key={panel.yearGroupKey}
              header={
                <Typography.Title level={3} id={headerId}>
                  {panel.yearGroupLabel}
                </Typography.Title>
              }
              forceRender
            >
              <div
                id={contentId}
                role="region"
                aria-label={panel.yearGroupLabel}
                aria-labelledby={headerId}
                aria-expanded={isExpanded}
              >
                {panel.classes.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px',
                      marginTop: '16px',
                    }}
                  >
                    {panel.classes.map((card) => (
                      <Card
                        role="article"
                        aria-label={card.className}
                        key={card.classId}
                        size="small"
                        title={card.className}
                        style={{ flex: '1 1 200px', minWidth: 200 }}
                      >
                        <Space wrap>
                          <Button disabled tabIndex={-1} type="text">
                            View
                          </Button>
                          <Button disabled tabIndex={-1} type="text">
                            Edit
                          </Button>
                        </Space>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card style={{ marginTop: '16px' }}>
                    <Empty description="No classes" />
                  </Card>
                )}
              </div>
            </Collapse.Panel>
          );
        })}
      </Collapse>
    </div>
  );
}

/**
 * Renders a refresh status message for background refresh.
 *
 * @returns {JSX.Element} The refresh status element.
 */
function renderClassesRefreshStatus(): JSX.Element {
  return (
    <div aria-live="polite" role="status">
      {CLASSES_REFRESH_TEXT}
    </div>
  );
}

/**
 * Renders the content based on the current state.
 *
 * @param {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; viewModel: unknown; isBusy: boolean; }>} properties Render properties.
 * @returns {JSX.Element} The rendered content.
 */
function renderClassesContent(
  properties: Readonly<{
    finalShouldRenderBlockingState: boolean;
    shouldRenderLoadingState: boolean;
    shouldRenderEmptyState: boolean;
    viewModel: unknown;
    isBusy: boolean;
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

  // viewModel must be ClassesPagePanelViewModel at this point
  const viewModel = properties.viewModel as {
    panels: ReadonlyArray<{
      yearGroupKey: string;
      yearGroupLabel: string;
      classes: ReadonlyArray<{
        classId: string;
        className: string;
        yearGroupKey: string;
        yearGroupLabel: string;
      }>;
    }>;
    defaultExpandedPanelKeys: ReadonlyArray<string>;
  };

  return (
    <>
      {properties.isBusy ? renderClassesRefreshStatus() : null}
      {renderYearGroupCollapse(viewModel)}
    </>
  );
}



/**
 * Computes the final render states for the Classes page.
 *
 * @param {Readonly<{ classesSurfaceState: ReturnType<typeof getClassesSurfaceState>; modelResult: unknown; hasTrustworthyClassPartials: boolean; hasTrustworthyYearGroups: boolean; }>} input Surface state, model result, and dataset trustworthiness.
 * @returns {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; }>} Final render states.
 */
function getFinalClassesPageStates(input: Readonly<{
  classesSurfaceState: ReturnType<typeof getClassesSurfaceState>;
  modelResult: unknown;
  hasTrustworthyClassPartials: boolean;
  hasTrustworthyYearGroups: boolean;
}>): Readonly<{
  finalShouldRenderBlockingState: boolean;
  shouldRenderLoadingState: boolean;
  shouldRenderEmptyState: boolean;
}> {
  const finalShouldRenderBlockingState =
    input.classesSurfaceState.shouldRenderBlockingState || isModelInvalid(input.modelResult);
  const shouldRenderLoadingState = input.classesSurfaceState.shouldRenderLoadingState;
  const hasTrustworthyDatasets = input.hasTrustworthyClassPartials && input.hasTrustworthyYearGroups;
  const shouldRenderEmptyState =
    !finalShouldRenderBlockingState &&
    !shouldRenderLoadingState &&
    hasTrustworthyDatasets &&
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
  const classPartialsDatasetState = {
    hasQueryData: classPartialsQuery.data !== undefined,
    isQueryError: classPartialsQuery.isError,
    isDatasetFailed: startupWarmupState.isDatasetFailed('classPartials'),
    isDatasetReady: startupWarmupState.isDatasetReady('classPartials'),
    isDatasetTrustworthy: classPartialsSnapshot.isTrustworthy,
    hasTrustworthyDataset:
      startupWarmupState.isDatasetReady('classPartials') && classPartialsSnapshot.isTrustworthy,
  } as const;

  const yearGroupsDatasetState = {
    hasQueryData: yearGroupsQuery.data !== undefined,
    isQueryError: yearGroupsQuery.isError,
    isDatasetFailed: startupWarmupState.isDatasetFailed('yearGroups'),
    isDatasetReady: startupWarmupState.isDatasetReady('yearGroups'),
    isDatasetTrustworthy: yearGroupsSnapshot.isTrustworthy,
    hasTrustworthyDataset:
      startupWarmupState.isDatasetReady('yearGroups') && yearGroupsSnapshot.isTrustworthy,
  } as const;

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
      hasTrustworthyClassPartials: classPartialsDatasetState.hasTrustworthyDataset,
      hasTrustworthyYearGroups: yearGroupsDatasetState.hasTrustworthyDataset,
    });

  return (
    <PageSection
      heading={pageContent.classes.heading}
      summary={pageContent.classes.summary}
    >
      <section
        role="region"
        aria-label="Classes page content"
        aria-busy={isClassesSurfaceBusyValue ? 'true' : undefined}
      >
        {renderClassesContent({
          finalShouldRenderBlockingState,
          shouldRenderLoadingState,
          shouldRenderEmptyState,
          viewModel: modelResult,
          isBusy: isClassesSurfaceBusyValue,
        })}
      </section>
    </PageSection>
  );
}
