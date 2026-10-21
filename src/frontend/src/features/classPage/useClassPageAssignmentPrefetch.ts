import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAssignmentQueryOptions } from '@/query/sharedQueries';
import { logFrontendError } from '@/logging/frontendLogger';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { compareAssignmentUpdatedAtDesc } from './classPageModel';

/** Maximum number of recent assignments to prefetch per class. */
const MAX_PREFETCH_ASSIGNMENTS = 3;

/**
 * Warm the three newest assignment reads once the Class page is ready.
 *
 * @remarks
 * The per-instance ref prevents repeat dispatch on refetch and StrictMode replay.
 * Navigating to a different ready class replaces the guard, allowing dispatch
 * again when returning to the previous class. Keyed queries also deduplicate
 * in-flight requests. Rejections are logged without changing the page surface.
 *
 * @param {string} classId - Current navigation identity.
 * @param {ClassFull | null} classFull - Loaded class and assignment partials.
 * @param {'loading' | 'blocking' | 'ready'} surfaceStatus - Current surface status.
 * @returns {void} Nothing.
 */
export function useClassPageAssignmentPrefetch(
  classId: string,
  classFull: ClassFull | null,
  surfaceStatus: 'loading' | 'blocking' | 'ready'
): void {
  const queryClient = useQueryClient();
  const prefetchedClassIdReference = useRef<string | null>(null);

  useEffect(() => {
    if (
      surfaceStatus !== 'ready' ||
      classFull === null ||
      prefetchedClassIdReference.current === classId
    ) {
      return;
    }

    // Defensive guard: every assignment must have a non-null updatedAt before the sort.
    // The adapter's validateUpdatedAt throws before surfaceState can become 'ready',
    // so this invariant always holds; throwing here fails fast if violated.
    for (const a of classFull.assignments) {
      if (!a.updatedAt) {
        throw new Error(
          `Cannot prefetch: assignment ${a.assignmentId} has null or falsy updatedAt`
        );
      }
    }

    // Set the guard only after the invariant check succeeds, so a thrown violation
    // does not permanently disable prefetch for this classId.
    prefetchedClassIdReference.current = classId;

    const sorted = (classFull.assignments as Array<{ assignmentId: string; updatedAt: string }>)
      .toSorted(compareAssignmentUpdatedAtDesc)
      .slice(0, MAX_PREFETCH_ASSIGNMENTS);

    for (const assignment of sorted) {
      void queryClient
        .query(getAssignmentQueryOptions(classFull.classId, assignment.assignmentId))
        .catch((error) => {
          logFrontendError('useClassPageData.prefetch', error, {
            courseId: classFull.classId,
            assignmentId: assignment.assignmentId,
          });
        });
    }
    // The ref guard prevents re-dispatch when classFull reference changes; the effect
    // fires when surfaceStatus transitions to 'ready' or classId changes.
  }, [surfaceStatus, classId, classFull, queryClient]);
}
