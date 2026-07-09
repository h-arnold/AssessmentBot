/**
 * Page composition root for the Class page (class detail view).
 *
 * @remarks
 * This is a thin composition root.  It owns:
 * - the `isAssessModalOpen` state for the `AssessTaskModal`
 * - the breadcrumb `Classes` link wiring
 * - the per-state content dispatcher (`ClassPageContent`)
 *
 * Consumed contracts:
 * - {@link useClassPageData} — the sole data-fetching entry point
 * - {@link ClassPageContent} — per-state content dispatcher (loading, blocking, ready)
 * - {@link AssessTaskModal} — pre-existing modal for starting a new assessment on
 *   the current class
 * - {@link pageContent} — static strings for the page (heading, summary, empty states)
 *
 * The `AssessTaskModal` is rendered at the page root (not inside `ClassPageContent`)
 * because the modal open/close state spans the loading/blocking/ready transitions.
 *
 * The breadcrumb is rendered in-page (not by the shell), producing a temporary visual
 * duplication with the shell's two-segment breadcrumb — an accepted v1 trade-off
 * (see SPEC_CLASS_PAGE.md §"Shell and routing integration").
 *
 * @see SPEC_CLASS_PAGE.md — "Page composition root"
 * @see CLASS_PAGE_LAYOUT.md — "Surface hierarchy" and "Global state rules"
 */

import { useState, useMemo, type JSX } from 'react';
import { Breadcrumb, Typography } from 'antd';
import { ClassPageContent } from './ClassPageContent';
import { useClassPageData } from './useClassPageData';
import { AssessTaskModal } from '../../features/classes/AssessTaskModal/AssessTaskModal';
import { pageContent } from '../../pages/pageContent';

type ClassPageProperties = Readonly<{
  /** The class ID to fetch data for. */
  classId: string;
  /** Callback invoked when the user navigates back to the classes list. */
  onNavigateToClasses: () => void;
}>;

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

/** Static breadcrumb items that do not depend on component state or props. */
const STATIC_BREADCRUMB_ITEMS = [
  { title: 'AssessmentBot Frontend' },
  { title: 'Classes' },
] as const;

/**
 * Render the Class page composition root.
 *
 * Fetches class data via `useClassPageData`, owns the `AssessTaskModal` open/close
 * state, and dispatches per-state content to `ClassPageContent`.
 *
 * @param {ClassPageProperties} properties - Component properties.
 * @param {string} properties.classId - The class ID to fetch data for.
 * @param {() => void} properties.onNavigateToClasses - Navigation callback.
 * @returns {JSX.Element} The composed Class page.
 */
export function ClassPage({
  classId,
  onNavigateToClasses,
}: ClassPageProperties): JSX.Element {
  const { surfaceState, classFull, analyserResult, adapterResult, error, refetch } =
    useClassPageData(classId);

  const [isAssessModalOpen, setIsAssessModalOpen] = useState<boolean>(false);

  const [selectedView, setSelectedView] = useState<{
    view: 'overview' | 'heatmap';
    assignmentId?: string;
  }>({ view: 'overview' });

  const className: string = classFull?.className ?? '';

  /**
   * Memoised breadcrumb items.
   *
   * The first two segments are static (module-level constant). The second
   * carries the navigation callback so clicking "Classes" returns to the
   * class list. The third uses the class name. When the heatmap view is
   * active, a fourth "Task Heatmap" segment is appended.
   */
  const breadcrumbItems = useMemo(
    () => {
      const items = [
        STATIC_BREADCRUMB_ITEMS[0],
        { ...STATIC_BREADCRUMB_ITEMS[1], onClick: onNavigateToClasses },
        { title: className },
      ];
      if (selectedView.view === 'heatmap') {
        items.push({ title: 'Task Heatmap' });
      }
      return items;
    },
    [className, onNavigateToClasses, selectedView.view]
  );

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
      <Breadcrumb items={breadcrumbItems} />

      {surfaceState.status !== 'loading' && (
        <Typography.Title level={2}>
          {className || pageContent.classDetail.heading}
        </Typography.Title>
      )}

      <ClassPageContent
        surfaceState={surfaceState}
        adapterResult={adapterResult}
        error={error}
        analyserResult={analyserResult}
        classFull={classFull}
        selectedView={selectedView}
        onOpenHeatmap={handleOpenHeatmap}
        onBack={handleBack}
        refetch={refetch}
        onStartNewAssessment={handleStartNewAssessment}
        onNavigateToClasses={onNavigateToClasses}
        onRetry={refetch}
      />

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
