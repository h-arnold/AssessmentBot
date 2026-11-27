/**
 * Link-flow-specific test helpers for AssessTaskModal tests.
 *
 * This module provides reusable wrappers around the standard no-match cache
 * setup and the five-step link-flow action sequence, reducing intra-file
 * duplication in AssessTaskModal.spec.tsx.
 */

import { act } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';
import {
  renderWithCache,
  seedAssessmentFlowQueryData,
  type RenderWithCacheOptions,
  MOCK_CLASS_ID,
  selectAssignment,
  clickStartAssessment,
  clickLinkToExisting,
  pickLinkableDefinition,
  clickLink,
} from './AssessTaskModal.test-utilities';
import { findMatchingDefinition } from '@/features/classes/AssessTaskModal/matchDefinitionForAssignment';
import type { useAssessTaskFlow } from '@/features/classes/AssessTaskModal/useAssessTaskFlow';
import { getGoogleClassroomAssignments } from '@/services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '@/services/assignmentDefinition/assignmentDefinitionService';
import type { GoogleClassroomAssignmentsResponse } from '@/services/googleClassrooms/googleClassroomAssignments.zod';
import type { StartAssessmentRunResponse } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentDefinitionPartial } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { createAppQueryClient } from '@/query/queryClient';
import { createDefinitionPartial } from './matchDefinitionForAssignment.test-utilities';
import { createFixtureClassPartial } from './classesPageTestHelpers';

/**
 * Renders the modal with standard no-match cache data.
 *
 * Defaults:
 * - `classPartials` = a single class partial for MOCK_CLASS_ID with year-10
 * - `definitionPartials` = a single default definition partial
 * - `findMatchResult` = `{ kind: 'no-match' }`
 *
 * @param {Partial<RenderWithCacheOptions>} [overrides] Overrides spread on top of defaults.
 * @returns {{ dialog: HTMLElement; queryClient: QueryClient }} Dialog element and query client.
 */
export function renderWithNoMatchCache(overrides: Partial<RenderWithCacheOptions> = {}): {
  dialog: HTMLElement;
  queryClient: QueryClient;
} {
  return renderWithCache({
    classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' })],
    definitionPartials: [createDefinitionPartial()],
    findMatchResult: { kind: 'no-match' },
    ...overrides,
  });
}

/**
 * Performs the full link-flow action sequence.
 *
 * Runs: `selectAssignment` → `clickStartAssessment` → `clickLinkToExisting`
 * → `pickLinkableDefinition` → `clickLink`.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 * @returns {Promise<void>} Resolves when the sequence is complete.
 */
export async function performLinkFlow(dialog: HTMLElement): Promise<void> {
  await selectAssignment(dialog);
  await clickStartAssessment(dialog);
  await clickLinkToExisting(dialog);
  await pickLinkableDefinition(dialog);
  await clickLink(dialog);
}

/** Rendered flow hook result used by the link-confirmation driver. */
type FlowHookResult = { current: ReturnType<typeof useAssessTaskFlow> };

/**
 * Seeds the service mocks and caches for a link-path flow with a held-open assessment start.
 *
 * @param {GoogleClassroomAssignmentsResponse} assignments Assignments served by the fetch mock.
 * @param {Promise<StartAssessmentRunResponse>} pendingRun Held-open assessment-start promise.
 * @returns {object} The seeded query client and definition partial.
 */
export function seedDeferredLinkPath(
  assignments: GoogleClassroomAssignmentsResponse,
  pendingRun: Promise<StartAssessmentRunResponse>
): { queryClient: QueryClient; definition: AssignmentDefinitionPartial } {
  vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(assignments);
  vi.mocked(upsertAssignmentDefinition).mockResolvedValue({} as never);
  vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

  const queryClient = createAppQueryClient();
  const definition = createDefinitionPartial();
  seedAssessmentFlowQueryData(queryClient, definition);
  return { queryClient, definition };
}

/**
 * Drives a rendered flow hook through assignment selection and link confirmation.
 *
 * @param {FlowHookResult} result The rendered flow hook result.
 * @param {string} definitionKey Definition key selected for linking.
 * @returns {Promise<void>} Resolves once the link confirmation has settled.
 */
export async function driveLinkConfirmation(
  result: FlowHookResult,
  definitionKey: string
): Promise<void> {
  act(() => result.current.handleAssignmentChange('a1'));
  vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });
  await act(async () => {
    await result.current.handleStartAssessment();
  });
  act(() => result.current.handleLinkExistingDefinition());
  act(() => result.current.handleLinkSelect(definitionKey));
  await act(async () => {
    void result.current.handleLinkConfirm();
    await Promise.resolve();
  });
}
