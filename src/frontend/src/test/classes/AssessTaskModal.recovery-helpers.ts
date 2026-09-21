/**
 * Recovery-flow test harness for the `AssessTaskModal` stale-definition specs.
 *
 * Seeds the canonical `transport.editableDefinitions` fixture, queues the
 * backend service mocks (definition load, forced reparse, approval save and
 * assessment start) and exposes the user-visible interaction helpers needed to
 * drive the recovery states (stale prompt, reparsing, review, parse failure
 * and approval outcomes) through the single owning modal.
 *
 * The harness is intentionally UI-driven: assertions live in the spec and pin
 * user-visible behaviour (alerts, footer actions, width token, accessible
 * busy semantics) rather than internal state, so the green recovery
 * implementation stays free to organise its own orchestration.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';
import { AssessTaskModal } from '../../features/classes/AssessTaskModal/AssessTaskModal';
import { findMatchingDefinition } from '../../features/classes/AssessTaskModal/matchDefinitionForAssignment';
import { getGoogleClassroomAssignments } from '../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../services/assignmentAssessment/assignmentAssessmentService';
import {
  getAssignmentDefinition,
  upsertAssignmentDefinition,
} from '../../services/assignmentDefinition/assignmentDefinitionService';
import { getAssignmentTopics } from '../../services/assignmentDefinition/assignmentTopicsService';
import { getCohorts, getYearGroups } from '../../services/referenceData/referenceDataService';
import { mapErrorCodeToUserMessage } from '../../errors/map-error-to-ui';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import { createFixtureClassPartial } from './classesPageTestHelpers';
import {
  MOCK_CLASS_ID,
  MODAL_TITLE,
  clickStartAssessment,
  defaultProperties,
  selectAssignment,
} from './AssessTaskModal.test-utilities';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import type { AssignmentDefinitionPartial } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { GoogleClassroomAssignmentsResponse } from '../../services/googleClassrooms/googleClassroomAssignments.zod';
import type { AssignmentTopic, YearGroup } from '../../services/referenceData/referenceData.zod';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so these specs consume the committed synthetic fixture rather than a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical definition used as the stale/reparsed/reviewed definition. */
export const RECOVERY_DEFINITION: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

/** Definition key captured by the assessment start context and reused on recovery. */
export const RECOVERY_DEFINITION_KEY = RECOVERY_DEFINITION.definitionKey;

/** Approved shared modal-width exception token applied while wizard content is active. */
export const WIDE_DATA_WIDTH = 'var(--app-modal-width-wide-data)';

/** Registry copy for the `DEFINITION_STALE` code (the stale-prompt explanation). */
export const DEFINITION_STALE_MESSAGE = mapErrorCodeToUserMessage('DEFINITION_STALE');

/** Registry copy for the `DEFINITION_PARSE_FAILED` code (the parse-failure explanation). */
export const DEFINITION_PARSE_FAILED_MESSAGE = mapErrorCodeToUserMessage('DEFINITION_PARSE_FAILED');

/** Registry copy for a representative non-stale approval-save failure. */
export const NON_STALE_FAILURE_MESSAGE = mapErrorCodeToUserMessage('INTERNAL_ERROR');

/** Repeated accessible names and copy patterns hoisted to shared constants. */
export const CANCEL_BUTTON = 'Cancel';
export const UPDATE_BUTTON = 'Update';
export const SAVE_BUTTON = 'Save';
export const RETRY_BUTTON = 'Retry';
export const CREATE_BUTTON = 'Create New Definition';
export const LINK_BUTTON = 'Link to Existing Definition';
export const START_ASSESSMENT_BUTTON = 'Start Assessment';
export const TASK_TABLE_PATTERN = /task weightings/i;
export const ASSIGNMENT_TITLE_PATTERN = /assignment title/i;
export const REFERENCE_URL_PATTERN = /reference document url/i;
export const DISCARD_DIALOG_PATTERN = /discard changes/i;
export const UNSAVED_CHANGES_PATTERN = /unsaved changes/i;
export const REPARSING_PATTERN = /repars/i;

/** Matching assignment for the stale matched-definition path. */
const RECOVERY_ASSIGNMENTS: GoogleClassroomAssignmentsResponse = [
  {
    assignmentId: 'a1',
    title: 'Essay',
    creationTime: '2024-09-02T08:30:00.000Z',
    topicName: 'Synthetic Topic 1',
    topicId: 'topic-0',
  },
];

/** Reference-data options aligned with the canonical definition keys. */
const RECOVERY_TOPICS: AssignmentTopic[] = [
  { key: 'topic-0', name: 'Synthetic Topic 1', yearGroupKeys: [] },
];
const RECOVERY_YEAR_GROUPS: YearGroup[] = [{ key: 'year-group-7', name: 'Year 7' }];

/**
 * Builds a coded transport rejection shaped like the backend error envelopes.
 *
 * @param {string} code - Error code to carry on the rejection.
 * @param {string} message - User-facing message for the rejection.
 * @returns {ApiTransportError} The coded transport error.
 */
function buildCodedError(code: string, message: string): ApiTransportError {
  return new ApiTransportError({ requestId: `recovery-${code}`, error: { code, message } });
}

/**
 * Builds the `DEFINITION_STALE` rejection used by the assessment-start and
 * approval-save mocks.
 *
 * @returns {ApiTransportError} The stale transport error.
 */
export function buildStaleError(): ApiTransportError {
  return buildCodedError('DEFINITION_STALE', DEFINITION_STALE_MESSAGE);
}

/**
 * Builds the `DEFINITION_PARSE_FAILED` rejection used by the reparse mock.
 *
 * @returns {ApiTransportError} The parse-failure transport error.
 */
export function buildParseFailedError(): ApiTransportError {
  return buildCodedError('DEFINITION_PARSE_FAILED', DEFINITION_PARSE_FAILED_MESSAGE);
}

/**
 * Builds a non-stale approval-save rejection.
 *
 * @returns {ApiTransportError} The non-stale transport error.
 */
export function buildNonStaleError(): ApiTransportError {
  return buildCodedError('INTERNAL_ERROR', NON_STALE_FAILURE_MESSAGE);
}

/**
 * A queued `startAssessmentRun` outcome.
 */
export type StartResult =
  { kind: 'stale' } | { kind: 'success' } | { kind: 'error'; error: unknown };

/**
 * Queues assessment-start outcomes, always finishing with a non-once fallback
 * so StrictMode double-firing can never exhaust the queue.
 *
 * @param {readonly StartResult[]} results - Ordered assessment-start outcomes.
 * @returns {void}
 */
export function queueStartResults(...results: readonly StartResult[]): void {
  const mock = vi.mocked(startAssessmentRun);
  mock.mockReset();
  for (const result of results) {
    if (result.kind === 'stale') {
      mock.mockRejectedValueOnce(buildStaleError());
    } else if (result.kind === 'error') {
      mock.mockRejectedValueOnce(result.error);
    } else {
      mock.mockResolvedValueOnce(null);
    }
  }
  mock.mockResolvedValue(null);
}

/**
 * A queued upsert outcome (reparse or approval save).
 */
export type UpsertResult =
  { kind: 'success'; definition?: AssignmentDefinition } | { kind: 'reject'; error: unknown };

/**
 * Queues upsert outcomes, always finishing with a non-once fallback so
 * StrictMode double-firing can never exhaust the queue.
 *
 * @param {readonly UpsertResult[]} results - Ordered upsert outcomes.
 * @returns {void}
 */
export function queueUpsertResults(...results: readonly UpsertResult[]): void {
  const mock = vi.mocked(upsertAssignmentDefinition);
  mock.mockReset();
  for (const result of results) {
    if (result.kind === 'reject') {
      mock.mockRejectedValueOnce(result.error);
    } else {
      mock.mockResolvedValueOnce(result.definition ?? RECOVERY_DEFINITION);
    }
  }
  mock.mockResolvedValue(RECOVERY_DEFINITION);
}

/**
 * Makes the recovery definition load fail, so the blocking-error treatment is
 * exercised instead of the reparsing/review flow.
 *
 * @param {unknown} [error] - Rejection to return from the load.
 * @returns {void}
 */
export function setDefinitionLoadFailure(
  error: unknown = new Error('definition load failed')
): void {
  vi.mocked(getAssignmentDefinition).mockReset().mockRejectedValue(error);
}

/**
 * The rendered recovery modal and its collaborators.
 */
export type RecoveryModal = Readonly<{
  dialog: HTMLElement;
  queryClient: QueryClient;
  onClose: () => void;
}>;

/**
 * Options for {@link renderRecoveryModal}.
 */
export type RecoveryModalOptions = Readonly<{
  setupMocks?: () => void;
  assignments?: GoogleClassroomAssignmentsResponse;
  onClose?: () => void;
}>;

/**
 * Renders `AssessTaskModal` on the matched-definition path with the canonical
 * recovery fixture, then applies any per-test mock overrides before render so
 * the component never observes stale defaults.
 *
 * @param {RecoveryModalOptions} [options] - Per-test mock overrides and close handler.
 * @returns {RecoveryModal} The owning dialog, query client and close spy.
 */
export function renderRecoveryModal(options: RecoveryModalOptions = {}): RecoveryModal {
  vi.mocked(getGoogleClassroomAssignments)
    .mockReset()
    .mockResolvedValue(options.assignments ?? RECOVERY_ASSIGNMENTS);
  vi.mocked(findMatchingDefinition)
    .mockReset()
    .mockReturnValue({
      kind: 'matched',
      definition: RECOVERY_DEFINITION as unknown as AssignmentDefinitionPartial,
    });
  vi.mocked(getAssignmentDefinition).mockReset().mockResolvedValue(RECOVERY_DEFINITION);
  vi.mocked(upsertAssignmentDefinition).mockReset().mockResolvedValue(RECOVERY_DEFINITION);
  vi.mocked(getAssignmentTopics).mockReset().mockResolvedValue(RECOVERY_TOPICS);
  vi.mocked(getYearGroups).mockReset().mockResolvedValue(RECOVERY_YEAR_GROUPS);
  vi.mocked(getCohorts).mockReset().mockResolvedValue([]);

  options.setupMocks?.();

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.classPartials(), [
    createFixtureClassPartial({
      classId: MOCK_CLASS_ID,
      yearGroupKey: RECOVERY_DEFINITION.yearGroupKey,
    }),
  ]);
  queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [RECOVERY_DEFINITION]);

  const onClose = options.onClose ?? vi.fn();
  renderWithFrontendProviders(createElement(AssessTaskModal, defaultProperties({ onClose })), {
    queryClient,
  });

  return {
    dialog: screen.getByRole('dialog', { name: MODAL_TITLE }),
    queryClient,
    onClose,
  };
}

/**
 * Drives the matched-definition path to the stale prompt: selects the
 * assignment, starts the assessment, and waits for the recovery Update action.
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {Promise<void>} Resolves when the stale prompt is visible.
 */
export async function triggerStalePrompt(dialog: HTMLElement): Promise<void> {
  await selectAssignment(dialog);
  await clickStartAssessment(dialog);
  await within(dialog).findByRole('button', { name: UPDATE_BUTTON });
}

/**
 * Clicks a named action button inside the owning dialog.
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @param {string | RegExp} name - Accessible button name.
 * @returns {Promise<void>} Resolves when the click action completes.
 */
export async function clickAction(dialog: HTMLElement, name: string | RegExp): Promise<void> {
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole('button', { name }));
}

/**
 * Clicks a named action button inside a nested dialog (for example the
 * discard confirmation).
 *
 * @param {HTMLElement} container - The nested dialog element.
 * @param {string | RegExp} name - Accessible button name.
 * @returns {Promise<void>} Resolves when the click action completes.
 */
export async function clickWithin(container: HTMLElement, name: string | RegExp): Promise<void> {
  const user = userEvent.setup();
  await user.click(within(container).getByRole('button', { name }));
}

/**
 * Completes the Update step and waits for the in-modal review surface.
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {Promise<void>} Resolves when the review task-weightings table is visible.
 */
export async function reachRecoveryReview(dialog: HTMLElement): Promise<void> {
  await clickAction(dialog, UPDATE_BUTTON);
  await within(dialog).findByRole('table', { name: TASK_TABLE_PATTERN });
}

/**
 * Reads the visible (non-empty) action-button names in DOM order.
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {string[]} Ordered action names.
 */
export function getVisibleActionNames(dialog: HTMLElement): string[] {
  return within(dialog)
    .getAllByRole('button')
    .map((button) => button.textContent?.trim() ?? '')
    .filter((name) => name.length > 0);
}

/**
 * Waits for the owning dialog to return to the assignment-selection body in
 * the idle state (combobox visible, Start Assessment available).
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {Promise<void>} Resolves when the selection body is idle.
 */
export async function waitForSelectionBody(dialog: HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(within(dialog).getByRole('combobox')).toBeInTheDocument();
  });
  expect(within(dialog).getByRole('button', { name: START_ASSESSMENT_BUTTON })).toBeInTheDocument();
}
