import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { RenderHookResult } from '@testing-library/react';
import { createAppQueryClient } from '../../query/queryClient';
import type { UseAssignmentDefinitionWizardReturn } from './useAssignmentDefinitionWizard';

// Mock dependencies
vi.mock('../../services/apiService', () => ({
  callApi: vi.fn(),
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: vi.fn(),
}));

vi.mock('../../errors/map-error-to-ui', () => ({
  mapErrorToUserMessage: vi.fn(() => 'Error message'),
  extractErrorCode: vi.fn(() => null),
  extractRequestId: vi.fn(() => null),
}));

vi.mock('../../features/auth/startupWarmupState', () => ({
  useStartupWarmupState: () => ({
    isDatasetReady: vi.fn(
      (datasetKey: string) =>
        datasetKey === 'assignmentDefinitionPartials' ||
        datasetKey === 'assignmentTopics' ||
        datasetKey === 'yearGroups'
    ),
    isDatasetFailed: vi.fn(() => false),
    isFailed: false,
    isLoading: false,
    isReady: true,
    warmupState: 'ready',
  }),
}));

vi.mock('../../query/sharedQueries', () => ({
  getAssignmentDefinitionQueryOptions: vi.fn(() => ({
    queryKey: ['assignmentDefinition'],
    queryFn: vi.fn(),
  })),
  getAssignmentTopicsQueryOptions: vi.fn(() => ({
    queryKey: ['assignmentTopics'],
    queryFn: vi.fn(),
  })),
  getYearGroupsQueryOptions: vi.fn(() => ({ queryKey: ['yearGroups'], queryFn: vi.fn() })),
}));

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  upsertAssignmentDefinition: vi.fn(),
}));

/**
 * Creates a fresh React Query wrapper for each test.
 *
 * @returns {(properties: Readonly<PropsWithChildren>) => JSX.Element} The query client wrapper used by the tests.
 */
function createQueryWrapper() {
  const queryClient = createAppQueryClient();

  return function QueryWrapper({ children }: Readonly<PropsWithChildren>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * Dynamically imports the useAssignmentDefinitionWizard module under test.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module.
 */
async function loadUseAssignmentDefinitionWizard() {
  const modulePath = './useAssignmentDefinitionWizard';
  return import(/* @vite-ignore */ modulePath);
}

// ============================================================================
// Shared test factories and helpers
// ============================================================================

/**
 * Creates a mock parse response for the assignment definition wizard tests.
 * The default definitionKey is 'test-create-key'.
 *
 * @param {string} [definitionKey='test-create-key'] - The definition key for the mock response.
 * @param {Partial<Record<string, unknown>>} [overrides={}] - Optional overrides to merge into the default.
 * @returns {Record<string, unknown>} The mock parse response.
 */
function createParseResponse(
  definitionKey = 'test-create-key',
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    definitionKey,
    primaryTitle: 'Test',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc',
    templateDocumentId: 'tpl-doc',
    referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc/edit',
    templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc/edit',
    assignmentWeighting: 1,
    tasks: [{ taskId: 't1', taskTitle: 'Task 1', taskWeighting: 1 }],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Gets the upsertAssignmentDefinition mock after importing the service module.
 *
 * @returns {Promise<ReturnType<typeof vi.fn>>} The mock function.
 */
async function getUpsertDefinitionMock(): Promise<ReturnType<typeof vi.fn>> {
  const serviceModule =
    await import('../../services/assignmentDefinition/assignmentDefinitionService');
  return serviceModule.upsertAssignmentDefinition as ReturnType<typeof vi.fn>;
}

/**
 * Renders the useAssignmentDefinitionWizard hook with common setup.
 * Loads the module and wraps the hook with a fresh QueryClient.
 *
 * @param {Record<string, unknown>} properties - Hook properties to pass.
 * @returns {Promise<RenderHookResult<UseAssignmentDefinitionWizardReturn, Record<string, unknown>>>} Render result.
 */
async function renderWizardHook(
  properties: Record<string, unknown>
): Promise<RenderHookResult<UseAssignmentDefinitionWizardReturn, Record<string, unknown>>> {
  const module = await loadUseAssignmentDefinitionWizard();
  const useAssignmentDefinitionWizard = module.useAssignmentDefinitionWizard as (
    properties: Record<string, unknown>
  ) => UseAssignmentDefinitionWizardReturn;

  return renderHook(() => useAssignmentDefinitionWizard(properties), {
    wrapper: createQueryWrapper(),
  });
}

/**
 * Sets the form values needed for the parse step in create mode.
 *
 * @param {{ readonly current: UseAssignmentDefinitionWizardReturn }} wizardReference - The render result reference (result).
 * @param {UseAssignmentDefinitionWizardReturn} wizardReference.current - The current wizard state.
 * @returns {Promise<void>} Completion signal.
 */
async function setWizardFormValues(wizardReference: {
  readonly current: UseAssignmentDefinitionWizardReturn;
}): Promise<void> {
  await act(async () => {
    wizardReference.current.form.setFieldsValue({
      title: 'Test',
      topic: 'topic-algebra',
      yearGroup: 'year-group-10',
      referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc/edit',
      templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc/edit',
    });
  });
}

/**
 * Triggers the primary action (parse step) and waits for parsing to complete.
 *
 * @param {{ readonly current: UseAssignmentDefinitionWizardReturn }} wizardReference - The render result reference (result).
 * @param {UseAssignmentDefinitionWizardReturn} wizardReference.current - The current wizard state.
 * @returns {Promise<void>} Completion signal.
 */
async function triggerParseAndWait(wizardReference: {
  readonly current: UseAssignmentDefinitionWizardReturn;
}): Promise<void> {
  await act(async () => {
    (wizardReference.current.handlePrimaryAction as () => void)();
  });

  await waitFor(() => {
    expect(wizardReference.current.hasParsedTasks).toBe(true);
  });
}

describe('useAssignmentDefinitionWizard', () => {
  it('initialValues set selectedTopicKey and selectedYearGroupKey state', async () => {
    const { result } = await renderWizardHook({
      open: true,
      mode: 'create',
      definitionKey: null,
      onClose: vi.fn(),
      initialValues: {
        title: 'Test',
        topic: 'topic-algebra',
        yearGroup: 'year-group-10',
      },
    });

    // After initial render, selectedTopicKey and selectedYearGroupKey should be set
    // from initialValues.
    expect(result.current.selectedTopicKey).toBe('topic-algebra');
    expect(result.current.selectedYearGroupKey).toBe('year-group-10');
  });

  it('definitionKey passed to onCreateSuccess matches the save response key', async () => {
    const upsertAssignmentDefinitionMock = await getUpsertDefinitionMock();
    const onCreateSuccess = vi.fn();
    const onClose = vi.fn();

    const parseResponse = createParseResponse('test-create-key');
    const saveResponse = {
      ...parseResponse,
      assignmentWeighting: 3,
      tasks: [{ taskId: 't1', taskTitle: 'Task 1', taskWeighting: 3 }],
    };

    upsertAssignmentDefinitionMock
      .mockResolvedValueOnce(parseResponse)
      .mockResolvedValueOnce(saveResponse);

    const { result } = await renderWizardHook({
      open: true,
      mode: 'create',
      definitionKey: null,
      onClose,
      initialValues: { title: 'Test', topic: 'topic-algebra', yearGroup: 'year-group-10' },
      onCreateSuccess,
    });

    await setWizardFormValues(result);
    await triggerParseAndWait(result);

    // Trigger save (second call to handlePrimaryAction)
    await act(async () => {
      (result.current.handlePrimaryAction as () => void)();
    });

    // Verify onCreateSuccess was called with the definitionKey from the save response
    await waitFor(() => {
      expect(onCreateSuccess).toHaveBeenCalledWith('test-create-key');
    });
  });

  it('onCreateSuccess is NOT called when save fails', async () => {
    const upsertAssignmentDefinitionMock = await getUpsertDefinitionMock();
    const onCreateSuccess = vi.fn();
    const onClose = vi.fn();

    // Parse succeeds, save fails
    upsertAssignmentDefinitionMock
      .mockResolvedValueOnce(createParseResponse('test-fail-key'))
      .mockRejectedValueOnce(new Error('Save failed'));

    const { result } = await renderWizardHook({
      open: true,
      mode: 'create',
      definitionKey: null,
      onClose,
      initialValues: { title: 'Test', topic: 'topic-algebra', yearGroup: 'year-group-10' },
      onCreateSuccess,
    });

    await setWizardFormValues(result);
    await triggerParseAndWait(result);

    // Trigger save (will fail)
    await act(async () => {
      (result.current.handlePrimaryAction as () => void)();
    });

    // Wait for the save error to be processed (blockingError set)
    await waitFor(() => {
      expect(result.current.blockingError).toBe('Error message');
    });

    // onCreateSuccess should NOT have been called
    expect(onCreateSuccess).not.toHaveBeenCalled();
  });
});
