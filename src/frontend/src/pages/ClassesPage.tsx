import { Alert, Button, Card, Col, Collapse, Empty, Row, Skeleton, Space, Tooltip, Typography } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import { type JSX, useMemo, useState } from 'react';
import {
  computeDatasetRenderable,
  computePageSurfaceBlocking,
  computePageSurfaceBusy,
  usePageDataset,
  type PageDatasetState,
} from '../hooks/usePageDataset';
import type { ClassPartial } from '../services/googleClassrooms/classPartials.zod';
import type { YearGroup } from '../services/referenceData/referenceData.zod';
import {
  buildClassesPageModel,
  type ClassesPagePanelViewModel,
  type InvalidClassesPageDataViewModel,
} from './classes/classesPageModel';
import { AssessTaskModal } from '../features/classes/AssessTaskModal/AssessTaskModal';
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
const CLASSES_CARD_HORIZONTAL_PADDING_FACTOR = 2;
const MIN_PANEL_WIDTH_PX =
  CLASSES_CARD_WIDTH_PX + CLASSES_CARD_HORIZONTAL_PADDING_FACTOR * CLASSES_CARD_GAP_PX; // 300px
const CLASSES_MOBILE_BREAKPOINT_PX = 768;

/**
 * Resolves whether classes surface should show loading or blocking states.
 *
 * Composes per-dataset decisions from the shared {@link computePageSurfaceBlocking}
 * and {@link computeDatasetRenderable} helpers.
 *
 * @param {Readonly<{ classPartials: object; yearGroups: object; }>} input Dataset and query state.
 * @returns {Readonly<{ shouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; }>} Surface state.
 */
function getClassesSurfaceState(
  input: Readonly<{
    classPartials: PageDatasetState;
    yearGroups: PageDatasetState;
  }>
): Readonly<{ shouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean }> {
  const isBlocking =
    computePageSurfaceBlocking(input.classPartials) ||
    computePageSurfaceBlocking(input.yearGroups);

  if (isBlocking) {
    return {
      shouldRenderBlockingState: true,
      shouldRenderLoadingState: false,
    };
  }

  const hasRenderableClassPartials = computeDatasetRenderable(input.classPartials);
  const hasRenderableYearGroups = computeDatasetRenderable(input.yearGroups);
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
 * Callback type for the assess-task button on a class card.
 */
type OnAssessTask = (classId: string, className: string) => void;

/**
 * Renders the year-group collapse with class cards.
 *
 * Uses Collapse.Panel children pattern instead of items prop to ensure proper
 * keyboard navigation support (Space/Enter to toggle, ArrowUp/ArrowDown to navigate).
 * This triggers a deprecation warning in Ant Design v6 but is the only way to
 * get proper keyboard support with custom header components.
 *
 * @param {ClassesPagePanelViewModel} viewModel The view model with panels and default expanded keys.
 * @param {OnAssessTask} onAssessTask Callback when the Assess Task button is clicked.
 * @returns {JSX.Element} The rendered collapse.
 */
function renderYearGroupCollapse(
  viewModel: ClassesPagePanelViewModel,
  onAssessTask: OnAssessTask
): JSX.Element {
  const { panels, defaultExpandedPanelKeys } = viewModel;

  const isMobile = window.innerWidth <= CLASSES_MOBILE_BREAKPOINT_PX;

  return (
    <section aria-label="year group panels" style={{ minWidth: isMobile ? `${MIN_PANEL_WIDTH_PX}px` : 'auto' }}>
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
                            title={<div style={{ textAlign: 'center' }}>{card.className}</div>}
                            style={{
                              width: CLASSES_CARD_WIDTH_PX,
                              maxWidth: CLASSES_CARD_WIDTH_PX,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <Space wrap>
                                <Button disabled tabIndex={-1} type="text">
                                  View
                                </Button>
                                <Tooltip title="Assess Task">
                                  <Button
                                    aria-label="Assess Task"
                                    icon={<AuditOutlined />}
                                    type="text"
                                    onClick={() => {
                                      onAssessTask(card.classId, card.className);
                                    }}
                                  />
                                </Tooltip>
                              </Space>
                            </div>
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
 * @param {Readonly<{ finalShouldRenderBlockingState: boolean; shouldRenderLoadingState: boolean; shouldRenderEmptyState: boolean; viewModel: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel; isBusy: boolean; onAssessTask: OnAssessTask; }>} properties Render properties.
 * @returns {JSX.Element} The rendered content.
 */
function renderClassesContent(
  properties: Readonly<{
    finalShouldRenderBlockingState: boolean;
    shouldRenderLoadingState: boolean;
    shouldRenderEmptyState: boolean;
    viewModel: ClassesPagePanelViewModel | InvalidClassesPageDataViewModel;
    isBusy: boolean;
    onAssessTask: OnAssessTask;
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
      {renderYearGroupCollapse(
        properties.viewModel as ClassesPagePanelViewModel,
        properties.onAssessTask
      )}
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
  const { query: classPartialsQuery, datasetState: classPartialsDatasetState } =
    usePageDataset<ClassPartial[]>('classPartials');
  const { query: yearGroupsQuery, datasetState: yearGroupsDatasetState } =
    usePageDataset<YearGroup[]>('yearGroups');

  // Compute surface state
  const classesSurfaceState: ClassesSurfaceState = getClassesSurfaceState({
    classPartials: classPartialsDatasetState,
    yearGroups: yearGroupsDatasetState,
  });

  // Modal state for Assess Task workflow
  const [assessModalClassId, setAssessModalClassId] = useState<string | null>(null);
  const [assessModalClassName, setAssessModalClassName] = useState<string | null>(null);

  // Compute busy state
  const isClassesSurfaceBusy = computePageSurfaceBusy(
    [classPartialsQuery.isFetching, yearGroupsQuery.isFetching],
    []
  );

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
          onAssessTask: (classId, className) => {
            setAssessModalClassId(classId);
            setAssessModalClassName(className);
          },
        })}
      </section>
      {assessModalClassId !== null && assessModalClassName !== null && (
        <AssessTaskModal
          open
          classId={assessModalClassId}
          className={assessModalClassName}
          onClose={() => {
            setAssessModalClassId(null);
            setAssessModalClassName(null);
          }}
        />
      )}
    </PageSection>
  );
}
