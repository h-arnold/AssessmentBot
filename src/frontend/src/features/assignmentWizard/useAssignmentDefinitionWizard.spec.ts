import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
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

describe('useAssignmentDefinitionWizard', () => {
  it('initialValues set selectedTopicKey and selectedYearGroupKey state', async () => {
    const module = await loadUseAssignmentDefinitionWizard();
    const useAssignmentDefinitionWizard = module.useAssignmentDefinitionWizard as (
      properties: Record<string, unknown>
    ) => UseAssignmentDefinitionWizardReturn;

    const { result } = renderHook(
      () =>
        useAssignmentDefinitionWizard({
          open: true,
          mode: 'create',
          definitionKey: null,
          onClose: vi.fn(),
          initialValues: {
            title: 'Test',
            topic: 'topic-algebra',
            yearGroup: 'year-group-10',
          },
        }),
      { wrapper: createQueryWrapper() }
    );

    // After initial render, selectedTopicKey and selectedYearGroupKey should be set
    // from initialValues. This will fail until the implementation exists.
    expect(result.current.selectedTopicKey).toBe('topic-algebra');
    expect(result.current.selectedYearGroupKey).toBe('year-group-10');
  });

  it('definitionKey passed to onCreateSuccess matches the save response key', async () => {
    // Access the mocked upsertAssignmentDefinition service
    const serviceModule =
      await import('../../services/assignmentDefinition/assignmentDefinitionService');
    const upsertAssignmentDefinitionMock = serviceModule.upsertAssignmentDefinition as ReturnType<
      typeof vi.fn
    >;

    const onCreateSuccess = vi.fn();
    const onClose = vi.fn();

    // Mock parse response with definitionKey
    const parseResponse = {
      definitionKey: 'test-create-key',
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
    };

    // Mock save response with definitionKey (the key passed to onCreateSuccess)
    const saveResponse = {
      ...parseResponse,
      assignmentWeighting: 3,
      tasks: [{ taskId: 't1', taskTitle: 'Task 1', taskWeighting: 3 }],
    };

    upsertAssignmentDefinitionMock
      .mockResolvedValueOnce(parseResponse)
      .mockResolvedValueOnce(saveResponse);

    const module = await loadUseAssignmentDefinitionWizard();
    const useAssignmentDefinitionWizard = module.useAssignmentDefinitionWizard as (
      properties: Record<string, unknown>
    ) => UseAssignmentDefinitionWizardReturn;

    const { result } = renderHook(
      () =>
        useAssignmentDefinitionWizard({
          open: true,
          mode: 'create',
          definitionKey: null,
          onClose,
          initialValues: { title: 'Test', topic: 'topic-algebra', yearGroup: 'year-group-10' },
          onCreateSuccess,
        }),
      { wrapper: createQueryWrapper() }
    );

    // Set form values for the parse step
    await act(async () => {
      result.current.form.setFieldsValue({
        title: 'Test',
        topic: 'topic-algebra',
        yearGroup: 'year-group-10',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc/edit',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc/edit',
      });
    });

    // Trigger parse (first call to handlePrimaryAction)
    await act(async () => {
      (result.current.handlePrimaryAction as () => void)();
    });

    // Wait for parse to complete
    await waitFor(() => {
      expect(result.current.hasParsedTasks).toBe(true);
    });

    // Trigger save (second call to handlePrimaryAction)
    await act(async () => {
      (result.current.handlePrimaryAction as () => void)();
    });

    // Verify onCreateSuccess was called with the definitionKey from the save response
    // This will fail until the implementation threads onCreateSuccess through the save path.
    await waitFor(() => {
      expect(onCreateSuccess).toHaveBeenCalledWith('test-create-key');
    });
  });

  it('onCreateSuccess is NOT called when save fails', async () => {
    // Access the mocked upsertAssignmentDefinition service
    const serviceModule =
      await import('../../services/assignmentDefinition/assignmentDefinitionService');
    const upsertAssignmentDefinitionMock = serviceModule.upsertAssignmentDefinition as ReturnType<
      typeof vi.fn
    >;

    const onCreateSuccess = vi.fn();
    const onClose = vi.fn();

    // Mock parse response with definitionKey
    const parseResponse = {
      definitionKey: 'test-fail-key',
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
    };

    // Parse succeeds, save fails
    upsertAssignmentDefinitionMock
      .mockResolvedValueOnce(parseResponse)
      .mockRejectedValueOnce(new Error('Save failed'));

    const module = await loadUseAssignmentDefinitionWizard();
    const useAssignmentDefinitionWizard = module.useAssignmentDefinitionWizard as (
      properties: Record<string, unknown>
    ) => UseAssignmentDefinitionWizardReturn;

    const { result } = renderHook(
      () =>
        useAssignmentDefinitionWizard({
          open: true,
          mode: 'create',
          definitionKey: null,
          onClose,
          initialValues: { title: 'Test', topic: 'topic-algebra', yearGroup: 'year-group-10' },
          onCreateSuccess,
        }),
      { wrapper: createQueryWrapper() }
    );

    // Set form values for the parse step
    await act(async () => {
      result.current.form.setFieldsValue({
        title: 'Test',
        topic: 'topic-algebra',
        yearGroup: 'year-group-10',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref-doc/edit',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc/edit',
      });
    });

    // Trigger parse
    await act(async () => {
      (result.current.handlePrimaryAction as () => void)();
    });

    // Wait for parse to complete
    await waitFor(() => {
      expect(result.current.hasParsedTasks).toBe(true);
    });

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
