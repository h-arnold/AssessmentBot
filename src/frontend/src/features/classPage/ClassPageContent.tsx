/**
 * Per-state content dispatcher for the Class page.
 *
 * @remarks
 * This component was extracted from the page composition root to keep
 * `ClassPage.tsx` thin (modal state, breadcrumb wiring, and callback
 * plumbing only).  The per-state branching has 6 blocking-state variants
 * and 1 ready variant; inlining this in the page root would push the file
 * over the 250-line target and mix presentation concerns with composition
 * concerns.
 *
 * Three sub-components are co-located here because they are small and
 * tightly coupled to the page-level error precedence:
 *
 * - {@link ClassPageLoading} — shape-matched skeletons (heading + card row
 *   + table region) using the paragraph-row pattern consistent with
 *   existing pages (`CLASS_PAGE_LAYOUT.md` §"Recommended page skeleton").
 * - {@link ClassPageBlocking} — a single `Result` per `error.type` with
 *   the correct Ant Design `Result` status variant (`warning` for
 *   retryable, `error` for non-retryable).  Retryable errors include
 *   `Retry` + `Back to Classes` buttons; non-retryable errors include
 *   only `Back to Classes`.
 * - {@link ClassPageReady} — the full content tree (heading row with
 *   header actions, `RecentAssignmentsSection`, `StudentAveragesTableCard`).
 *
 * @see SPEC_CLASS_PAGE.md — "ClassPageContent — per-state dispatcher"
 * @see CLASS_PAGE_LAYOUT.md — "Surface hierarchy"
 */

import type { JSX } from 'react';
import { Space, Skeleton, Button, Result } from 'antd';
import type {
  ClassPageSurfaceState,
  ClassPageError,
} from './useClassPageData';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import { ClassPageHeaderActions } from './ClassPageHeaderActions';
import { RecentAssignmentsSection } from './RecentAssignmentsSection';
import { StudentAveragesTableCard } from './StudentAveragesTableCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClassPageContentProperties = Readonly<{
  /** The combined surface state (`loading` | `blocking` | `ready`). */
  surfaceState: ClassPageSurfaceState;
  /** Adapter result (non-null only when `surfaceState.status === 'ready'`). */
  adapterResult: ClassPageAdapterResult | null;
  /** Structured error (non-null only when `surfaceState.status === 'blocking'`). */
  error: ClassPageError | null;
  /** Callback invoked when the user clicks "Start New Assessment". */
  onStartNewAssessment: () => void;
  /** Callback invoked when the user clicks "Back to Classes". */
  onNavigateToClasses: () => void;
  /** Callback invoked when the user clicks "Retry" on a retryable error. */
  onRetry: () => void;
}>;

type ClassPageBlockingProperties = Readonly<{
  /** The blocking error to display. */
  error: ClassPageError;
  /** Retry callback (only used for retryable error types). */
  onRetry: () => void;
  /** Navigation callback to return to the classes list. */
  onNavigateToClasses: () => void;
}>;

type ClassPageReadyProperties = Readonly<{
  /** The adapter result with recent assignments and student averages. */
  adapterResult: ClassPageAdapterResult;
  /** Callback invoked when the user clicks "Start New Assessment". */
  onStartNewAssessment: () => void;
}>;

// ---------------------------------------------------------------------------
// Error configuration
// ---------------------------------------------------------------------------

type ErrorConfig = Readonly<{
  /** The Ant Design Result status variant. */
  status: 'error' | 'warning';
  /** The user-facing title for the Result. */
  title: string;
  /** Whether the error is retryable (shows a Retry button). */
  retryable: boolean;
}>;

/**
 * Maps each `ClassPageError.type` to its Result configuration.
 *
 * @see SPEC_CLASS_PAGE.md — "Blocking failure" error table
 */
const ERROR_CONFIG_MAP: Record<ClassPageError['type'], ErrorConfig> = {
  classNotFound: { status: 'error', title: 'Class not found', retryable: false },
  classQueryError: { status: 'warning', title: "Couldn't load class", retryable: true },
  analyserError: { status: 'warning', title: "Couldn't compute averages", retryable: true },
  adapterError: { status: 'error', title: 'Class data is invalid', retryable: false },
  assignmentDefinitionPartialsFailed: {
    status: 'warning',
    title: "Couldn't load assessment definitions",
    retryable: true,
  },
  assignmentDefinitionPartialsUntrustworthy: {
    status: 'warning',
    title: 'Assessment definitions are unavailable',
    retryable: true,
  },
};

// ---------------------------------------------------------------------------
// Sub-component: ClassPageLoading
// ---------------------------------------------------------------------------

/**
 * Loading-state skeleton for the Class page.
 *
 * Renders shape-matched `Skeleton` placeholders for the heading row, the
 * Recent Assignments card row, and the Student Averages table region.
 *
 * @remarks
 * Uses the paragraph-row pattern consistent with `ClassesPage` and
 * `AssignmentsPage` loading states (`CLASS_PAGE_LAYOUT.md` §"Recommended
 * page skeleton").
 *
 * The skeleton uses a shape-matched pattern (`Skeleton.Input` / `Skeleton.Button`)
 * instead of the generic paragraph-row pattern prescribed in `CLASS_PAGE_LAYOUT.md`
 * — the shape-matched shapes provide better perceived-performance feedback
 * for the three distinct content regions (heading, card row, table).
 *
 * Wraps the skeleton in `role="status"` and `aria-live="polite"` per
 * accessibility requirements (`frontend-loading-and-width-standards.md` §8).
 *
 * @returns {JSX.Element} The loading skeleton.
 */
function ClassPageLoading(): JSX.Element {
  return (
    <div role="status" aria-live="polite">
      {/* Heading skeleton */}
      <Skeleton.Input size="large" style={{ width: 300 }} active />

      {/* Recent assignments section skeleton */}
      <div style={{ marginTop: 16 }}>
        <Skeleton.Button active style={{ width: 80, height: 22 }} />
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <Skeleton.Button active style={{ width: 280, height: 140 }} />
          <Skeleton.Button active style={{ width: 280, height: 140 }} />
          <Skeleton.Button active style={{ width: 280, height: 140 }} />
        </div>
      </div>

      {/* Table skeleton */}
      <div style={{ marginTop: 16 }}>
        <Skeleton paragraph={{ rows: 6 }} active />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ClassPageBlocking
// ---------------------------------------------------------------------------

/**
 * Blocking-state error display for the Class page.
 *
 * Renders an Ant Design `Result` component with the correct status and
 * title for the given `error.type`.  Retryable errors include a `Retry`
 * button (calls `onRetry`) and a `Back to Classes` button (calls
 * `onNavigateToClasses`).  Non-retryable errors show only the
 * `Back to Classes` button.
 *
 * @param {ClassPageBlockingProperties} properties - Component properties.
 * @param {ClassPageError} properties.error - The blocking error.
 * @param {() => void} properties.onRetry - Retry callback.
 * @param {() => void} properties.onNavigateToClasses - Navigation callback.
 * @returns {JSX.Element} The blocking error Result.
 */
function ClassPageBlocking({
  error,
  onRetry,
  onNavigateToClasses,
}: ClassPageBlockingProperties): JSX.Element {
  const config: ErrorConfig = ERROR_CONFIG_MAP[error.type];

  return (
    <Result
      status={config.status}
      title={config.title}
      extra={
        <Space>
          {config.retryable && (
            <Button type="primary" onClick={onRetry}>
              Retry
            </Button>
          )}
          <Button onClick={onNavigateToClasses}>Back to Classes</Button>
        </Space>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ClassPageReady
// ---------------------------------------------------------------------------

/**
 * Ready-state content for the Class page.
 *
 * Renders the full content tree:
 * 1. `ClassPageHeaderActions` with the `onStartNewAssessment` callback
 * 2. `RecentAssignmentsSection` with `adapterResult.recentAssignments`
 * 3. `StudentAveragesTableCard` with `adapterResult`
 *
 * @param {ClassPageReadyProperties} properties - Component properties.
 * @param {ClassPageAdapterResult} properties.adapterResult - The adapter result.
 * @param {() => void} properties.onStartNewAssessment - Callback to start a new assessment.
 * @returns {JSX.Element} The full ready-state content tree.
 */
function ClassPageReady({
  adapterResult,
  onStartNewAssessment,
}: ClassPageReadyProperties): JSX.Element {
  return (
    <>
      <ClassPageHeaderActions onStartNewAssessment={onStartNewAssessment} />
      <RecentAssignmentsSection
        recentAssignments={adapterResult.recentAssignments}
        onStartNewAssessment={onStartNewAssessment}
      />
      <StudentAveragesTableCard
        adapterResult={adapterResult}
        onStartNewAssessment={onStartNewAssessment}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component: ClassPageContent
// ---------------------------------------------------------------------------

/**
 * Per-state content dispatcher for the Class page.
 *
 * Switches on `surfaceState.status` and renders the appropriate
 * sub-component:
 * - `'loading'` → {@link ClassPageLoading}
 * - `'blocking'` → {@link ClassPageBlocking}
 * - `'ready'` → {@link ClassPageReady}
 *
 * @param {ClassPageContentProperties} properties - Component properties.
 * @param {ClassPageSurfaceState} properties.surfaceState - The combined surface state.
 * @param {ClassPageAdapterResult | null} properties.adapterResult - Adapter result.
 * @param {ClassPageError | null} properties.error - Structured error.
 * @param {() => void} properties.onStartNewAssessment - Start new assessment callback.
 * @param {() => void} properties.onNavigateToClasses - Navigation callback.
 * @param {() => void} properties.onRetry - Retry callback.
 * @returns {JSX.Element} The rendered content for the current surface state.
 */
export function ClassPageContent({
  surfaceState,
  adapterResult,
  error,
  onStartNewAssessment,
  onNavigateToClasses,
  onRetry,
}: ClassPageContentProperties): JSX.Element {
  switch (surfaceState.status) {
    case 'loading': {
      return <ClassPageLoading />;
    }

    case 'blocking': {
      return (
        // safe: status === 'blocking' guarantees error is non-null
        <ClassPageBlocking
          error={error!}
          onRetry={onRetry}
          onNavigateToClasses={onNavigateToClasses}
        />
      );
    }

    case 'ready': {
      return (
        // safe: status === 'ready' guarantees adapterResult is non-null
        <ClassPageReady
          adapterResult={adapterResult!}
          onStartNewAssessment={onStartNewAssessment}
        />
      );
    }
  }
}
