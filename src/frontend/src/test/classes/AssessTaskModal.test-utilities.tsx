import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { AssessTaskModal } from '../../features/classes/AssessTaskModal/AssessTaskModal';
import { getGoogleClassroomAssignments } from '../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../services/assignmentAssessment/assignmentAssessmentService';
import {
  findMatchingDefinition,
  type MatchResult,
} from '../../features/classes/AssessTaskModal/matchDefinitionForAssignment';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import { createAppQueryClient } from '../../query/queryClient';
import type { GoogleClassroomAssignmentsResponse } from '../../services/googleClassrooms/googleClassroomAssignments.zod';
import type { AssignmentDefinitionPartial } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { QueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MOCK_CLASS_ID = 'class-123';
export const MOCK_CLASS_NAME = 'My Class';

export const MOCK_ASSIGNMENTS: GoogleClassroomAssignmentsResponse = [
  { assignmentId: 'a1', title: 'Essay', topicName: 'Writing', topicId: null },
];

export const MOCK_EMPTY_ASSIGNMENTS: GoogleClassroomAssignmentsResponse = [];

export const MODAL_TITLE = `Assess Task — ${MOCK_CLASS_NAME}`;

export const DEFAULT_ISO_DATETIME = '2025-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/**
 * Creates an AssignmentDefinitionPartial fixture for cache-hit tests.
 *
 * @param {Partial<AssignmentDefinitionPartial>} overrides Fields to override.
 * @returns {AssignmentDefinitionPartial} A definition partial fixture.
 */
export function createDefinitionPartial(
  overrides: Partial<AssignmentDefinitionPartial> = {}
): AssignmentDefinitionPartial {
  return {
    primaryTitle: 'Essay',
    primaryTopic: 'Writing',
    primaryTopicKey: 'topic-writing',
    yearGroupKey: 'year-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-001',
    templateDocumentId: 'tpl-001',
    assignmentWeighting: null,
    definitionKey: 'essay-def-key',
    tasks: null,
    createdAt: DEFAULT_ISO_DATETIME,
    updatedAt: DEFAULT_ISO_DATETIME,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Standard props
// ---------------------------------------------------------------------------

export type DefaultPropertiesOverrides = Partial<{
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
}>;

/**
 * Standard props for the modal in most tests.
 *
 * @param {DefaultPropertiesOverrides} [overrides] Optional prop overrides.
 * @returns {object} The complete properties object with sensible defaults.
 */
export function defaultProperties(overrides: DefaultPropertiesOverrides = {}) {
  return {
    open: true,
    classId: MOCK_CLASS_ID,
    className: MOCK_CLASS_NAME,
    onClose: vi.fn(),
    ...overrides,
  };
}

/** Returns a promise that never resolves — used for loading-state tests. */
export function createPendingPromise<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/**
 * Creates a default query client and renders the modal via
 * `renderWithFrontendProviders` so `useQueryClient()` works inside
 * the component.
 *
 * @param {GoogleClassroomAssignmentsResponse | Promise<GoogleClassroomAssignmentsResponse> | Error} mockValue - Value to pass to mockReturnValue/mockResolvedValue/mockRejectedValue.
 * @param {'return' | 'resolve' | 'reject'} mockType - How to set up the mock.
 * @returns {HTMLElement} The dialog element.
 */
export function renderAssessTaskModal(
  mockValue:
    | GoogleClassroomAssignmentsResponse
    | Promise<GoogleClassroomAssignmentsResponse>
    | Error,
  mockType: 'return' | 'resolve' | 'reject' = 'return'
): HTMLElement {
  const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
  if (mockType === 'resolve') {
    mockedGetAssignments.mockResolvedValue(mockValue as GoogleClassroomAssignmentsResponse);
  } else if (mockType === 'reject') {
    mockedGetAssignments.mockRejectedValue(mockValue);
  } else {
    mockedGetAssignments.mockReturnValue(mockValue as Promise<GoogleClassroomAssignmentsResponse>);
  }

  renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);
  return screen.getByRole('dialog', { name: MODAL_TITLE });
}

/**
 * Options for {@link renderWithCache}.
 */
export type RenderWithCacheOptions = {
  classPartials?: Array<{ classId: string; yearGroupKey: string | null; className: string | null }>;
  definitionPartials?: AssignmentDefinitionPartial[];
  assignments?: GoogleClassroomAssignmentsResponse;
  findMatchResult?: MatchResult;
  startRunResult?: unknown;
  startRunType?: 'resolve' | 'reject';
  onClose?: () => void;
};

/**
 * Creates a query client pre-populated with the given cache data and renders
 * the modal inside `renderWithFrontendProviders`. Returns the dialog and
 * query client for further interaction.
 *
 * @param {RenderWithCacheOptions} [options] Render options.
 * @returns {{ dialog: HTMLElement; queryClient: QueryClient }} Dialog element and query client.
 */
// eslint-disable-next-line complexity -- Test helper with many optional parameters
export function renderWithCache(options: RenderWithCacheOptions = {}): {
  dialog: HTMLElement;
  queryClient: QueryClient;
} {
  const {
    classPartials,
    definitionPartials,
    assignments = MOCK_ASSIGNMENTS,
    findMatchResult,
    startRunResult,
    startRunType,
    onClose: onCloseOption,
  } = options;

  vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(
    assignments as GoogleClassroomAssignmentsResponse
  );

  if (findMatchResult !== undefined) {
    vi.mocked(findMatchingDefinition).mockReturnValue(findMatchResult as MatchResult);
  }

  if (startRunType === 'reject') {
    vi.mocked(startAssessmentRun).mockRejectedValue(startRunResult);
  } else if (startRunResult !== undefined) {
    vi.mocked(startAssessmentRun).mockResolvedValue(startRunResult as null);
  }

  const queryClient = createAppQueryClient();
  if (classPartials !== undefined) {
    queryClient.setQueryData(queryKeys.classPartials(), classPartials);
  }
  if (definitionPartials !== undefined) {
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), definitionPartials);
  }

  const modalProperties = onCloseOption === undefined
    ? defaultProperties()
    : defaultProperties({ onClose: onCloseOption });

  const { queryClient: returnedClient } = renderWithFrontendProviders(
    <AssessTaskModal {...modalProperties} />,
    { queryClient }
  );

  return {
    dialog: screen.getByRole('dialog', { name: MODAL_TITLE }),
    queryClient: returnedClient,
  };
}

// ---------------------------------------------------------------------------
// Interaction helpers
// ---------------------------------------------------------------------------

/**
 * Selects an assignment in the dropdown and waits for Start Assessment to
 * become enabled.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 * @returns {Promise<void>} Resolves when the button is enabled.
 */
export async function selectAssignment(dialog: HTMLElement): Promise<void> {
  await within(dialog).findByRole('combobox');
  fireEvent.mouseDown(within(dialog).getByRole('combobox'));
  const option = await screen.findByText('Essay');
  fireEvent.click(option);
  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
  });
}

/**
 * Clicks the Start Assessment button.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 */
export function clickStartAssessment(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Start Assessment' }));
}

/**
 * Clicks the "Create New Definition" button during the choice/no-match state.
 *
 * @param {HTMLElement} dialog The modal dialog element.
 */
export async function clickCreateNewDefinition(dialog: HTMLElement): Promise<void> {
  await within(dialog).findByRole('button', { name: 'Create New Definition' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));
}

/**
 * Returns the props object stored on the wizard mock element by the
 * `__wizardProps` ref.  Must be called after `clickCreateNewDefinition`
 * has rendered the wizard mock.
 *
 * @returns {Promise<any>} The wizard mock properties.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWizardProperties(): Promise<any> {
  const wizard = await screen.findByTestId('wizard-mock');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (wizard as any).__wizardProps || {};
}

/**
 * Asserts that the Start Assessment button is disabled within the given dialog.
 *
 * @param {HTMLElement} dialog - The modal dialog element.
 */
export function expectStartAssessmentDisabled(dialog: HTMLElement): void {
  expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeDisabled();
}

/**
 * Asserts that the Cancel button is present within the given dialog.
 *
 * @param {HTMLElement} dialog - The modal dialog element.
 */
export function expectCancelButtonPresent(dialog: HTMLElement): void {
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
}
