import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Collapse, Empty, Row, Skeleton, Space, Typography } from 'antd';
import { type JSX, useMemo } from 'react';
import { useStartupWarmupState } from '../features/auth/startupWarmupState';
import { getClassPartialsQueryOptions, getYearGroupsQueryOptions } from '../query/sharedQueries';
import {
  buildClassesPageModel,
  type ClassesPagePanelViewModel,
  type InvalidClassesPageDataViewModel,
} from './classes/classesPageModel';
import { PageSection } from './PageSection';
import { pageContent } from './pageContent';

/**
 * Messages for Classes page states.
 */
const CLASSES_PAGE_LOADING_LABEL = 'Classes page loading';
const CLASSES_BLOCKING_ERROR_MESSAGE = 'Classes data could not be trusted or loaded.';
const CLASSES_PAGE_EMPTY_DESCRIPTION = 'No year groups configured yet.';
const CLASSES_REFRESH_TEXT = 'Refreshing...';

const CLASSES_CARD_WIDTH_PX = 268;
const CLASSES_CARD_GAP_PX = 16;

/**
 * Returns whether a single dataset should block.
 *
 * @param {Readonly<{ isDatasetFailed: boolean; hasQueryData: boolean; isQueryError: boolean; isDatasetReady: boolean; isDatasetTrustworthy: boolean; }>} input Dataset state.
 * @returns {boolean} True if dataset should block.
 */
function shouldBlockSingleDataset(
  input: Readonly<{
    isDatasetFailed: boolean;
    hasQueryData: boolean;
    isQueryError: boolean;
    isDatasetReady: boolean;
    isDatasetTrustworthy: boolean;
  }>
): boolean {
  if (input.isDatasetFailed) {
    return !input.hasQueryData || input.isQueryError;
  }

  if (input.isDatasetReady && !input.isDatasetTrustworthy) {
    return true;
  }

  return input.isDatasetReady && input.isDatasetTrustworthy && input.isQueryError;
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
    }>;
    yearGroups: Readonly<{
      isDatasetFailed: boolean;
      hasQueryData: boolean;
      isQueryError: boolean;
      isDatasetReady: boolean;
      isDatasetTrustworthy: boolean;
    }>;
  }>
): boolean {
  return (
    shouldBlockSingleDataset(input.classPartials) || shouldBlockSingleDataset(input.yearGroups)
  );
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

type ClassesSurfaceState = Readonly<{
  shouldRenderBlockingState: boolean;
  shouldRenderLoadingState: boolean;
}>;

/**
 * Returns whether the classes surface is busy (fetching).
 *
 * @param {Readonly<{ isClassPartialsQueryFetching: boolean; isYearGroupsQueryFetching: boolean; }>} input Fetching state.
 * @returns {boolean} True when busy.
 */
function computeClassesSurfaceBusy(
  input: Readonly<{
    isClassPartialsQueryFetching: boolean;
    isYearGroupsQueryFetching: boolean;
  }>
): boolean {
  return input.isClassPartialsQueryFetching || input.isYearGroupsQueryFetching;
}

/**
 * Checks if the model result is an invalid data view model.
 *
 * @param {ClassesPagePanelViewModel | InvalidClassesPageDataViewModel} modelResult The model result.
 * @returns {modelResult is InvalidClassesPageDataViewModel} True if invalid.
 */
function isModelInvalid(
  modelResult: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel
): modelResult is InvalidClassesPageDataViewModel {
  return 'type' in modelResult && modelResult.type === 'invalidClassesPageData';
}

/**
 * Checks if the model result represents an empty state.
 *
 * @param {ClassesPagePanelViewModel | InvalidClassesPageDataViewModel} modelResult The model result.
 * @returns {boolean} True if empty.
 */
function isModelEmpty(
  modelResult: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel
): boolean {
  if ('type' in modelResult) return false; // InvalidClassesPageDataViewModel
  return modelResult.panels.length === 0 && modelResult.defaultExpandedPanelKeys.length === 0;
}

/**
 * Renders the year-group collapse with class cards.
 *
 * Uses Collapse.Panel children pattern instead of items prop to ensure proper
 * keyboard navigation support (Space/Enter to toggle, ArrowUp/ArrowDown to navigate).
 * This triggers a deprecation warning in Ant Design v6 but is the only way to
 * get proper keyboard support with custom header components.
 *
 * @param {ClassesPagePanelViewModel} viewModel The view model with panels and default expanded keys.
 * @returns {JSX.Element} The rendered collapse.
 */
function renderYearGroupCollapse(viewModel: ClassesPagePanelViewModel): JSX.Element {
  const { panels, defaultExpandedPanelKeys } = viewModel;

  return (
    <section aria-label="year group panels">
      <Collapse defaultActiveKey={defaultExpandedPanelKeys}>
        {panels.map((panel) => {
          const headerId = `panel-header-${panel.yearGroupKey}`;
          const contentId = `panel-content-${panel.yearGroupKey}`;

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
              <section id={contentId} aria-label={panel.yearGroupLabel} aria-labelledby={headerId}>
                {panel.classes.length > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Row gutter={[CLASSES_CARD_GAP_PX, CLASSES_CARD_GAP_PX]}>
                      {panel.classes.map((card) => (
                        <Col key={card.classId}>
                          <Card
                            role="article"
                            aria-label={card.className}
                            size="small"
                            title={card.className}
                            style={{
                              width: CLASSES_CARD_WIDTH_PX,
                              maxWidth: CLASSES_CARD_WIDTH_PX,
                            }}
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
                        </Col>
                      ))}
                    </Row>
                  </div>
                ) : (
                  <Card style={{ marginTop: `${CLASSES_CARD_GAP_PX}px` }}>
                    <Empty description="No classes" />
                  </Card>
                )}
              </section>
            </Collapse.Panel>
          );
        })}
      </Collapse>
    </section>
  );
}

/**
 * Renders the content based on the current state.
 *
 * @param {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; viewModel: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel; isBusy: boolean; }>} properties Render properties.
 * @returns {JSX.Element} The rendered content.
 */
function renderClassesContent(
  properties: Readonly<{
    finalShouldRenderBlockingState: boolean;
    shouldRenderLoadingState: boolean;
    shouldRenderEmptyState: boolean;
    viewModel: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel;
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

  // viewModel must be ClassesPagePanelViewModel at this point — all other branches return early
  return (
    <>
      {properties.isBusy ? (
        <div aria-live="polite" role="status">
          {CLASSES_REFRESH_TEXT}
        </div>
      ) : null}
      {renderYearGroupCollapse(properties.viewModel as ClassesPagePanelViewModel)}
    </>
  );
}

/**
 * Computes the final render states for the Classes page.
 *
 * @param {Readonly<{ classesSurfaceState: ClassesSurfaceState; modelResult: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel; hasTrustworthyClassPartials: boolean; hasTrustworthyYearGroups: boolean; }>} input Surface state, model result, and dataset trustworthiness.
 * @returns {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; }>} Final render states.
 */
function getFinalClassesPageStates(
  input: Readonly<{
    classesSurfaceState: ClassesSurfaceState;
    modelResult: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel;
    hasTrustworthyClassPartials: boolean;
    hasTrustworthyYearGroups: boolean;
  }>
): Readonly<{
  finalShouldRenderBlockingState: boolean;
  shouldRenderLoadingState: boolean;
  shouldRenderEmptyState: boolean;
}> {
  const finalShouldRenderBlockingState =
    input.classesSurfaceState.shouldRenderBlockingState || isModelInvalid(input.modelResult);
  const shouldRenderLoadingState = input.classesSurfaceState.shouldRenderLoadingState;
  const hasTrustworthyDatasets =
    input.hasTrustworthyClassPartials && input.hasTrustworthyYearGroups;
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
  };

  const yearGroupsDatasetState = {
    hasQueryData: yearGroupsQuery.data !== undefined,
    isQueryError: yearGroupsQuery.isError,
    isDatasetFailed: startupWarmupState.isDatasetFailed('yearGroups'),
    isDatasetReady: startupWarmupState.isDatasetReady('yearGroups'),
    isDatasetTrustworthy: yearGroupsSnapshot.isTrustworthy,
    hasTrustworthyDataset:
      startupWarmupState.isDatasetReady('yearGroups') && yearGroupsSnapshot.isTrustworthy,
  };

  // Compute surface state
  const classesSurfaceState: ClassesSurfaceState = getClassesSurfaceState({
    classPartials: classPartialsDatasetState,
    yearGroups: yearGroupsDatasetState,
  });

  // Compute busy state
  const isClassesSurfaceBusy = computeClassesSurfaceBusy({
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
    <PageSection heading={pageContent.classes.heading} summary={pageContent.classes.summary}>
      <section
        aria-label="Classes page content"
        aria-busy={isClassesSurfaceBusy ? 'true' : undefined}
      >
        {renderClassesContent({
          finalShouldRenderBlockingState,
          shouldRenderLoadingState,
          shouldRenderEmptyState,
          viewModel: modelResult,
          isBusy: isClassesSurfaceBusy,
        })}
      </section>
    </PageSection>
  );
}
