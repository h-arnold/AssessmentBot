/**
 * Page composition root for the Class page (class detail view).
 *
 * @remarks
 * This is a thin composition root.  It owns:
 * - the `isAssessModalOpen` state for the `AssessTaskModal`
 * - the per-state content dispatcher (`ClassPageContent`)
 *
 * Consumed contracts:
 * - {@link useClassPageData} — the sole data-fetching entry point
 * - {@link ClassPageContent} — per-state content dispatcher (loading, blocking, ready)
 * - {@link AssessTaskModal} — pre-existing modal for starting a new assessment on
 *   the current class
 * - {@link pageContent} — static strings for the page (heading, summary, empty states)
 * - {@link useClassSelection} — class-selection context for the "Back to Classes" navigation
 *
 * The `AssessTaskModal` is rendered at the page root (not inside `ClassPageContent`)
 * because the modal open/close state spans the loading/blocking/ready transitions.
 *
 * The breadcrumb is owned by the shell (`AppShell`), not rendered here.
 *
 * @see SPEC_CLASS_PAGE.md — "Page composition root"
 * @see CLASS_PAGE_LAYOUT.md — "Surface hierarchy" and "Global state rules"
 */

import { useState, type JSX } from 'react';
import { Flex } from 'antd';
import { ClassPageContent } from './ClassPageContent';
import { ClassPageHeaderActions } from './ClassPageHeaderActions';
import { useClassPageData } from './useClassPageData';
import { AssessTaskModal } from '../../features/classes/AssessTaskModal/AssessTaskModal';
import { pageContent } from '../../pages/pageContent';
import { useClassSelection } from '../../ClassSelectionContext';
import { APP_GAP_MD } from '../../theme/spacing';
import { PageTitleCard, PageNavCard } from '../../components/PageHeader';

type ClassPageProperties = Readonly<{
  /** The class ID to fetch data for. */
  classId: string;
}>;

type ClassPageHeaderProperties = Readonly<{
  /** The class name to display as the page title. */
  className: string;
  /** Whether the overview view is active (controls the parent nav card). */
  isOverview: boolean;
  /** Callback invoked when the user clicks "Back to Classes". */
  onNavigateToClasses: () => void;
  /** Callback invoked when the user clicks "Start New Assessment". */
  onStartNewAssessment: () => void;
}>;

/**
 * Render the Class page header.
 *
 * Always shows the class-name {@link PageTitleCard}. The parent {@link PageNavCard}
 * ("Back to Classes") is shown only in the overview view; when a child view
 * (heatmap) is active, the child page renders its own navigation card so that
 * only the most-junior nav card is visible.
 *
 * @param {ClassPageHeaderProperties} properties - Component properties.
 * @param {string} properties.className - The class name to display.
 * @param {boolean} properties.isOverview - Whether the overview view is active.
 * @param {() => void} properties.onNavigateToClasses - Back-to-classes callback.
 * @param {() => void} properties.onStartNewAssessment - Start-assessment callback.
 * @returns {JSX.Element} The rendered header.
 */
function ClassPageHeader({
  className,
  isOverview,
  onNavigateToClasses,
  onStartNewAssessment,
}: ClassPageHeaderProperties): JSX.Element {
  return (
    <>
      <PageTitleCard title={className || pageContent.classDetail.heading} titleLevel={2} />
      {isOverview && (
        <PageNavCard
          onBack={onNavigateToClasses}
          backLabel="Back to Classes"
          backAriaLabel="Back to Classes"
          actions={<ClassPageHeaderActions onStartNewAssessment={onStartNewAssessment} />}
        />
      )}
    </>
  );
}

/**
 * Render the Class page composition root.
 *
 * Fetches class data via `useClassPageData`, owns the `AssessTaskModal` open/close
 * state, and dispatches per-state content to `ClassPageContent`.
 *
 * @param {ClassPageProperties} properties - Component properties.
 * @param {string} properties.classId - The class ID to fetch data for.
 * @returns {JSX.Element} The composed Class page.
 */
export function ClassPage({ classId }: ClassPageProperties): JSX.Element {
  const { onNavigateToClasses } = useClassSelection();
  const { surfaceState, classFull, analyserResult, adapterResult, error, refetch, assignmentDefinitionPartials } =
    useClassPageData(classId);

  const [isAssessModalOpen, setIsAssessModalOpen] = useState<boolean>(false);

  const [selectedView, setSelectedView] = useState<{
    view: 'overview' | 'heatmap';
    assignmentId?: string;
  }>({ view: 'overview' });

  const className: string = classFull?.className ?? '';
  const isLoading: boolean = surfaceState.status === 'loading';
  const isOverview: boolean = selectedView.view === 'overview';

  /**
   * Open the AssessTaskModal.
   * Called from both the header button and the empty-state CTA.
   */
  function handleStartNewAssessment(): void {
    setIsAssessModalOpen(true);
  }

  /**
   * Close the AssessTaskModal.
   */
  function handleCloseModal(): void {
    setIsAssessModalOpen(false);
  }

  /**
   * Switch to the heatmap view for the given assignment.
   *
   * @param {string} assignmentId - The assignment ID to open the heatmap for.
   */
  function handleOpenHeatmap(assignmentId: string): void {
    setSelectedView({ view: 'heatmap', assignmentId });
  }

  /**
   * Return to the overview view.
   */
  function handleBack(): void {
    setSelectedView({ view: 'overview' });
  }

  return (
    <>
      <Flex vertical gap={APP_GAP_MD}>
        {!isLoading && (
          <ClassPageHeader
            className={className}
            isOverview={isOverview}
            onNavigateToClasses={onNavigateToClasses}
            onStartNewAssessment={handleStartNewAssessment}
          />
        )}

        <ClassPageContent
          surfaceState={surfaceState}
          adapterResult={adapterResult}
          error={error}
          analyserResult={analyserResult}
          classFull={classFull}
          selectedView={selectedView}
          assignmentDefinitionPartials={assignmentDefinitionPartials}
          onOpenHeatmap={handleOpenHeatmap}
          onBack={handleBack}
          refetch={refetch}
          onStartNewAssessment={handleStartNewAssessment}
          onNavigateToClasses={onNavigateToClasses}
          onRetry={refetch}
        />
      </Flex>

      {isAssessModalOpen && (
        <AssessTaskModal
          open
          classId={classId}
          className={className}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
