import { act, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { createStartupWarmupState } from '../../test/assignmentDefinition/wizardTestHelpers';
import {
  mockTopics,
  mockYearGroups,
  mockCohorts,
} from '../../test/assignmentDefinition/sharedTestFixtures';
import {
  mockFullAssignmentDefinition,
  mockUpsertResponse,
} from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import {
  getParseButton,
  getSaveButton,
  fillRequiredFields,
  assertParseButtonEnabled,
  assertSharedEditSurfaceHydrated,
} from '../../test/assignmentDefinition/wizardModalTestHelpers';
import type { RenderWizardModalOptions } from '../../test/assignmentDefinition/wizardModalTestHelpers';

export * from '../../test/assignmentDefinition/wizardModalTestHelpers';
export {
  mockTopics,
  mockYearGroups,
  mockCohorts,
} from '../../test/assignmentDefinition/sharedTestFixtures';
export {
  mockFullAssignmentDefinition,
  mockUpsertResponse,
} from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';

type WizardMocks = {
  getAssignmentDefinitionMock: ReturnType<typeof vi.fn>;
  getAssignmentTopicsMock: ReturnType<typeof vi.fn>;
  getCohortsMock: ReturnType<typeof vi.fn>;
  getYearGroupsMock: ReturnType<typeof vi.fn>;
  upsertAssignmentDefinitionMock: ReturnType<typeof vi.fn>;
  useStartupWarmupStateMock: ReturnType<typeof vi.fn>;
};

let activeMocks: WizardMocks;

/** Configures the hoisted mock set used by the shared wizard harness.
 * @param {WizardMocks} mocks Hoisted Vitest mocks used by the focused spec.
 */
export function setWizardMocks(mocks: WizardMocks): void {
  activeMocks = mocks;
}

// Test constants to avoid magic numbers
const EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT = 2;

// ============================================================================
// Shared response factories
// ============================================================================

/**
 * Creates a stage-one parse response for create mode tests.
 * Customise with definitionKey and optional overrides.
 *
 * @param {string} definitionKey - The definition key for the response.
 * @param {Partial<Record<string, unknown>>} [overrides={}] - Optional overrides.
 * @returns {Record<string, unknown>} The mock parse response.
 */
export function createStageOneParseResponse(
  definitionKey: string,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    definitionKey,
    primaryTitle: 'New Assessment',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'new-ref',
    templateDocumentId: 'new-tpl',
    referenceDocumentUrl: 'https://docs.google.com/presentation/d/new-ref',
    templateDocumentUrl: 'https://docs.google.com/presentation/d/new-tpl',
    assignmentWeighting: 1,
    tasks: [
      { taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 },
      { taskId: 'task-2', taskTitle: 'Task 2', taskWeighting: 1 },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a final save response for create mode tests.
 * Customise with definitionKey and optional overrides.
 *
 * @param {string} definitionKey - The definition key for the response (same as parse).
 * @param {Partial<Record<string, unknown>>} [overrides={}] - Optional overrides.
 * @returns {Record<string, unknown>} The mock final save response.
 */
export function createFinalSaveResponse(
  definitionKey: string,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    definitionKey,
    primaryTitle: 'New Assessment',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'new-ref',
    templateDocumentId: 'new-tpl',
    referenceDocumentUrl: 'https://docs.google.com/presentation/d/new-ref',
    templateDocumentUrl: 'https://docs.google.com/presentation/d/new-tpl',
    assignmentWeighting: 5,
    tasks: [
      { taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 2 },
      { taskId: 'task-2', taskTitle: 'Task 2', taskWeighting: 3 },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Shared flow helpers
// ============================================================================

/**
 * Performs stage-one parse in create mode: fills required fields, waits for
 * the parse button to become enabled, mocks the upsert response with a
 * parse response, clicks the parse button, and waits for the shared edit
 * surface to be hydrated.
 *
 * @param {HTMLElement} modal - The modal element.
 * @param {string} definitionKey - The definition key to use in the mock parse response.
 * @param {Partial<Record<string, unknown>>} [overrides={}] - Optional overrides for the parse response.
 * @returns {Promise<void>} Completion signal.
 */
export async function performStageOneParse(
  modal: HTMLElement,
  definitionKey: string,
  overrides: Partial<Record<string, unknown>> = {}
): Promise<void> {
  await fillRequiredFields({ modal }, { title: 'New Assessment', yearGroup: 'Year 10' });

  await waitFor(() => {
    assertParseButtonEnabled({ modal });
  });

  activeMocks.upsertAssignmentDefinitionMock.mockResolvedValueOnce(
    createStageOneParseResponse(definitionKey, overrides)
  );

  const parseButton = getParseButton({ modal });
  await act(async () => {
    fireEvent.click(parseButton);
  });

  await waitFor(() => {
    assertSharedEditSurfaceHydrated({ modal });
    expect(getSaveButton({ modal })).toBeInTheDocument();
  });
}

/**
 * Performs a final save in create mode after stage-one parse:
 * mocks the final save response, clicks the save button, and waits for the
 * save to complete (both upsert calls).
 *
 * @param {HTMLElement} modal - The modal element.
 * @param {string} definitionKey - The definition key for the final save response.
 * @param {Partial<Record<string, unknown>>} [overrides={}] - Optional overrides for the final save response.
 * @returns {Promise<void>} Completion signal.
 */
export async function performFinalSave(
  modal: HTMLElement,
  definitionKey: string,
  overrides: Partial<Record<string, unknown>> = {}
): Promise<void> {
  activeMocks.upsertAssignmentDefinitionMock.mockResolvedValueOnce(
    createFinalSaveResponse(definitionKey, overrides)
  );

  const saveButton = getSaveButton({ modal });
  await act(async () => {
    fireEvent.click(saveButton);
  });

  await waitFor(() => {
    expect(activeMocks.upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(
      EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT
    );
  });
}

// ============================================================================
// Create-mode options builder
// ============================================================================

/**
 * Creates a base render options object for create mode tests.
 *
 * @param {() => void} [onClose] - Optional onClose handler.
 * @param {Parameters<typeof createStartupWarmupState>[0]} [warmupState] - Optional warmup state override.
 * @returns {RenderWizardModalOptions} Render options for create mode.
 */
export function createBaseCreateOptions(
  onClose?: () => void,
  warmupState?: Parameters<typeof createStartupWarmupState>[0]
): RenderWizardModalOptions {
  if (warmupState) {
    activeMocks.useStartupWarmupStateMock.mockReturnValue(createStartupWarmupState(warmupState));
  } else {
    activeMocks.useStartupWarmupStateMock.mockReturnValue(
      createStartupWarmupState({
        assignmentTopicsStatus: 'ready',
        yearGroupsStatus: 'ready',
      })
    );
  }

  return {
    mode: 'create',
    definitionKey: null,
    onClose,
    open: true,
    topics: [...mockTopics],
    yearGroups: [...mockYearGroups],
    cohorts: [...mockCohorts],
    mockInvalidateQueries: true,
  };
}

/**
 * Creates a base render options object for update mode tests.
 *
 * @param {string} [definitionKey='algebra-baseline'] - Definition key for the assignment.
 * @param {unknown} [definition=mockFullAssignmentDefinition] - Assignment definition for update mode.
 * @param {() => void} [onClose] - Optional onClose handler.
 * @returns {RenderWizardModalOptions} Render options for update mode.
 */
export function createBaseUpdateOptions(
  definitionKey = 'algebra-baseline',
  definition: AssignmentDefinition = mockFullAssignmentDefinition,
  onClose?: () => void
): RenderWizardModalOptions {
  activeMocks.useStartupWarmupStateMock.mockReturnValue(
    createStartupWarmupState({
      assignmentTopicsStatus: 'ready',
      yearGroupsStatus: 'ready',
    })
  );

  return {
    mode: 'update',
    definitionKey,
    assignmentDefinition: definition,
    onClose,
    open: true,
    topics: [...mockTopics],
    yearGroups: [...mockYearGroups],
    cohorts: [...mockCohorts],
    mockInvalidateQueries: true,
  };
}

/**
 * Sets up service mocks for create mode tests.
 *
 * @returns {void}
 */
export function setupCreateModeMocks(): void {
  activeMocks.getAssignmentTopicsMock.mockResolvedValue(mockTopics);
  activeMocks.getCohortsMock.mockResolvedValue(mockCohorts);
  activeMocks.getYearGroupsMock.mockResolvedValue(mockYearGroups);
  activeMocks.getAssignmentDefinitionMock.mockResolvedValue(mockFullAssignmentDefinition);
  activeMocks.upsertAssignmentDefinitionMock.mockResolvedValue(mockUpsertResponse);
}

/**
 * Sets up service mocks for update mode tests.
 *
 * @param {unknown} definition - The assignment definition to use.
 * @returns {void}
 */
export function setupUpdateModeMocks(definition: unknown): void {
  activeMocks.getAssignmentTopicsMock.mockResolvedValue(mockTopics);
  activeMocks.getCohortsMock.mockResolvedValue(mockCohorts);
  activeMocks.getYearGroupsMock.mockResolvedValue(mockYearGroups);
  activeMocks.getAssignmentDefinitionMock.mockResolvedValue(definition);
  activeMocks.upsertAssignmentDefinitionMock.mockResolvedValue(mockUpsertResponse);
}

/** Applies the default create-mode service mock responses. */
export function setupAssignmentDefinitionWizardMocks(): void {
  setupCreateModeMocks();
}

/** Restores mock implementations and call history after each focused spec. */
export function resetAssignmentDefinitionWizardMocks(): void {
  vi.resetAllMocks();
}
