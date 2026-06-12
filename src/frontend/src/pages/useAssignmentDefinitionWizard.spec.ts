import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { createAppQueryClient } from '../query/queryClient';

// Mock dependencies
vi.mock('../services/apiService', () => ({
  callApi: vi.fn(),
}));

vi.mock('../logging/frontendLogger', () => ({
  logFrontendError: vi.fn(),
}));

vi.mock('../errors/map-error-to-ui', () => ({
  mapErrorToUserMessage: vi.fn(() => 'Error message'),
  extractErrorCode: vi.fn(() => null),
  extractRequestId: vi.fn(() => null),
}));

vi.mock('../features/auth/startupWarmupState', () => ({
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

vi.mock('../query/sharedQueries', () => ({
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

vi.mock('../services/assignmentDefinition/assignmentDefinitionService', () => ({
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
  // Section 7 - Red Loop: Failing tests for orchestration
  describe('Section 7 - SelectWithAddNew orchestration', () => {
    it('useAssignmentDefinitionWizard/AssignmentDefinitionWizardModal handle topic and year-group onEntityCreated orchestration and pass updated selected values to shell props', async () => {
      // This test should fail because the onEntityCreated orchestration isn't implemented yet
      const { useAssignmentDefinitionWizard } = await loadUseAssignmentDefinitionWizard();

      // This should fail because useAssignmentDefinitionWizard doesn't expose onEntityCreated handlers yet
      // and doesn't pass updated selected values to shell
      const { result } = renderHook(
        () =>
          useAssignmentDefinitionWizard({
            open: true,
            mode: 'create',
            definitionKey: null,
            onClose: vi.fn(),
          }),
        {
          wrapper: createQueryWrapper(),
        }
      );

      // This should fail - the hook doesn't expose onEntityCreated handlers
      expect(result.current).toHaveProperty('onTopicEntityCreated');
      expect(result.current).toHaveProperty('onYearGroupEntityCreated');

      // This should fail - the hook doesn't pass updated selected values
      expect(result.current).toHaveProperty('selectedTopicKey');
      expect(result.current).toHaveProperty('selectedYearGroupKey');
    });
  });
});
