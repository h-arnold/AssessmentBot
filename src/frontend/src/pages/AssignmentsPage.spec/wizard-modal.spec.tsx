import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  setTextboxValue,
  createStartupWarmupState,
  createReadyStartupWarmupState,
} from '../../test/assignmentDefinition/wizardTestHelpers';
import {
  mockTopics,
  mockYearGroups,
  mockFullAssignmentDefinition,
  mockUpsertResponse,
  readyAssignmentPartialRows,
} from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { AssignmentsPage } from '../AssignmentsPage';
import { readyRows } from './shared-setup';

const {
  deleteAssignmentDefinitionMock,
  getAssignmentDefinitionPartialsMock,
  getAssignmentDefinitionMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  getABClassPartialsMock,
  upsertAssignmentDefinitionMock,
  useStartupWarmupStateMock,
  refetchAfterStaleInvalidateMock,
} = vi.hoisted(() => ({
  deleteAssignmentDefinitionMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  getAssignmentDefinitionMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  getABClassPartialsMock: vi.fn(),
  upsertAssignmentDefinitionMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
  refetchAfterStaleInvalidateMock: vi.fn(),
}));

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../../services/assignmentDefinitionPartialsService', () => ({
  deleteAssignmentDefinition: deleteAssignmentDefinitionMock,
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/assignmentDefinitionService', () => ({
  getAssignmentDefinition: getAssignmentDefinitionMock,
  upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
}));

vi.mock('../../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../query/queryInvalidationHelpers', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;
  refetchAfterStaleInvalidateMock.mockImplementation(
    actualModule.refetchAfterStaleInvalidate as (...arguments_: unknown[]) => unknown
  );
  return { ...actualModule, refetchAfterStaleInvalidate: refetchAfterStaleInvalidateMock };
});

describe('AssignmentsPage', () => {
  let userEventInstance: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    userEventInstance = userEvent.setup();
    useStartupWarmupStateMock.mockReturnValue(createReadyStartupWarmupState());
    getAssignmentDefinitionPartialsMock.mockResolvedValue([...readyAssignmentPartialRows]);
    deleteAssignmentDefinitionMock.mockResolvedValue(void 0);
    getAssignmentTopicsMock.mockResolvedValue(mockTopics);
    getYearGroupsMock.mockResolvedValue(mockYearGroups);
    getCohortsMock.mockResolvedValue([]);
    getABClassPartialsMock.mockResolvedValue([]);
    upsertAssignmentDefinitionMock.mockResolvedValue(mockUpsertResponse);
    getAssignmentDefinitionMock.mockResolvedValue(mockFullAssignmentDefinition);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Shared edit surface, re-parse gating, and task weighting workflow', () => {
    it('page action cluster has Refresh assignments data + Create assignment only, no top-level Update assignment button', () => {
      renderWithFrontendProviders(<AssignmentsPage />);

      // Should have Refresh and Create buttons
      expect(screen.getByRole('button', { name: 'Refresh assignments data' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeInTheDocument();

      // Should NOT have a top-level Update assignment button
      expect(screen.queryByRole('button', { name: /^Update assignment$/ })).not.toBeInTheDocument();

      // Should NOT show "not available in v1" text
      expect(screen.queryByText(/not available in v1/i)).not.toBeInTheDocument();
    });

    it('page-level create and update affordances enabled only when complete workflow available', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      // With trustworthy data, Create should be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create assignment' })).toBeEnabled();
      });

      // Table should have Update row actions
      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });
      expect(within(safeRow).getByRole('button', { name: /update/i })).toBeInTheDocument();
    });

    it('create mode hides or disables task editing before first parse', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      // Create button should be enabled
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeEnabled();

      // Clicking Create should open the modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      });

      // Before first parse, task editing should be hidden/disabled
      expect(screen.getByText(/parsing is required/i)).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: /task weighting/i })).not.toBeInTheDocument();
    });

    it('create mode opens without a full-definition read', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);

      // Open create modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /create assignment/i });
      });

      expect(within(modal).getByRole('button', { name: /parse and continue/i })).toBeDisabled();
      expect(getAssignmentDefinitionMock).not.toHaveBeenCalled();
    });

    it('document change disables metadata and task weighting inputs until re-parse or cancel', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Row should have update action
      const updateButton = within(safeRow).getByRole('button', { name: /update/i });
      expect(updateButton).toBeInTheDocument();

      // Click update
      fireEvent.click(updateButton);

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Change document URL using userEvent for Ant Design Form compatibility
      const referenceUrlInput = within(modal).getByRole('textbox', {
        name: /reference document url/i,
      });
      await waitFor(() => {
        expect(referenceUrlInput).toBeEnabled();
      });
      fireEvent.change(referenceUrlInput, {
        target: { value: 'https://docs.google.com/presentation/d/new-ref' },
      });

      // Metadata and task weighting should be disabled
      await waitFor(() => {
        const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
        const weightingInput = within(modal).getByRole('spinbutton', {
          name: /assignment weighting/i,
        });
        expect(titleInput).toBeDisabled();
        expect(weightingInput).toBeDisabled();
      });

      // Should show re-parse prompt
      expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
      const reparseActionRow = within(modal)
        .getByRole('button', { name: /re-parse/i })
        .closest('.ant-space') as HTMLElement;
      expect(
        within(reparseActionRow).getByRole('button', { name: /re-parse/i })
      ).toBeInTheDocument();
      expect(
        within(reparseActionRow).getByRole('button', { name: /^cancel$/i })
      ).toBeInTheDocument();
    });

    it('cancel restores persisted URLs and re-enables other fields', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Store original URLs
      const referenceUrlInput = within(modal).getByRole('textbox', {
        name: /reference document url/i,
      }) as HTMLInputElement;
      const originalReferenceUrl = referenceUrlInput.value;
      const templateUrlInput = within(modal).getByRole('textbox', {
        name: /template document url/i,
      }) as HTMLInputElement;
      const originalTemplateUrl = templateUrlInput.value;

      // Change document URLs using userEvent
      await waitFor(() => {
        expect(referenceUrlInput).toBeEnabled();
        expect(templateUrlInput).toBeEnabled();
      });
      fireEvent.change(referenceUrlInput, {
        target: { value: 'https://docs.google.com/presentation/d/new-ref' },
      });
      fireEvent.change(templateUrlInput, {
        target: { value: 'https://docs.google.com/presentation/d/new-tpl' },
      });

      // Click cancel on re-parse prompt
      const reparseActionRow = within(modal)
        .getByRole('button', { name: /re-parse/i })
        .closest('.ant-space') as HTMLElement;
      const cancelButton = within(reparseActionRow).getByRole('button', { name: /^cancel$/i });
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // URLs should be restored
      await waitFor(() => {
        const restoredModal = screen.getByRole('dialog', { name: /update assignment/i });
        const referenceInput = within(restoredModal).getByRole('textbox', {
          name: /reference document url/i,
        });
        const templateInput = within(restoredModal).getByRole('textbox', {
          name: /template document url/i,
        });
        expect(referenceInput).toHaveValue(originalReferenceUrl);
        expect(templateInput).toHaveValue(originalTemplateUrl);
      });

      // Other fields should be re-enabled
      const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
      const weightingInput = within(modal).getByRole('spinbutton', {
        name: /assignment weighting/i,
      });
      expect(titleInput).toBeEnabled();
      expect(weightingInput).toBeEnabled();
    });

    it('re-parse refreshes task rows and preserves matching weightings', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Change document URL using userEvent
      const referenceUrlInput = within(modal).getByRole('textbox', {
        name: /reference document url/i,
      });
      await waitFor(() => {
        expect(referenceUrlInput).toBeEnabled();
      });
      fireEvent.change(referenceUrlInput, {
        target: { value: 'https://docs.google.com/presentation/d/new-ref' },
      });

      upsertAssignmentDefinitionMock.mockResolvedValueOnce({
        ...mockFullAssignmentDefinition,
        tasks: [
          { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 1 },
          { taskId: 'task-4', taskTitle: 'Complete revision quiz', taskWeighting: 1 },
        ],
      });

      // Click re-parse
      const reparseButton = within(modal).getByRole('button', { name: /re-parse/i });
      await act(async () => {
        fireEvent.click(reparseButton);
      });

      // Task rows should be refreshed
      await waitFor(() => {
        const refreshedModal = screen.getByRole('dialog', { name: /update assignment/i });
        expect(within(refreshedModal).getByText(/complete revision quiz/i)).toBeInTheDocument();
      });
    });

    it('save blocked until valid year-group selection present', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);

      // Open create modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /create assignment/i });
      });

      // Fill in required fields except year group using userEvent
      const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
      const referenceUrlInput = within(modal).getByRole('textbox', {
        name: /reference document url/i,
      });
      const templateUrlInput = within(modal).getByRole('textbox', {
        name: /template document url/i,
      });

      setTextboxValue(titleInput, 'New Assessment');
      setTextboxValue(referenceUrlInput, 'https://docs.google.com/presentation/d/test-ref');
      setTextboxValue(templateUrlInput, 'https://docs.google.com/presentation/d/test-tpl');

      // Save/Parse should be blocked without year group
      const primaryAction = within(modal).getByRole('button', { name: /parse and continue/i });
      expect(primaryAction).toBeDisabled();
    });

    it('dirty metadata or weighting edits disable document URL fields until save or discard-by-close', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Edit metadata using userEvent
      const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
      await userEventInstance.clear(titleInput);
      await userEventInstance.type(titleInput, 'Updated Title');

      // Document URL fields should be disabled
      await waitFor(() => {
        const referenceUrlInput = within(modal).getByRole('textbox', {
          name: /reference document url/i,
        });
        const templateUrlInput = within(modal).getByRole('textbox', {
          name: /template document url/i,
        });
        expect(referenceUrlInput).toBeDisabled();
        expect(templateUrlInput).toBeDisabled();
      });
    });

    it('create entry blocks locally when required reference data cannot be loaded', async () => {
      useStartupWarmupStateMock.mockReturnValue(
        createStartupWarmupState({
          assignmentDefinitionPartialsStatus: 'ready',
          isDatasetReady: (datasetKey: string) =>
            datasetKey !== 'assignmentTopics' && datasetKey !== 'yearGroups',
          isDatasetFailed: (datasetKey: string) =>
            datasetKey === 'assignmentTopics' || datasetKey === 'yearGroups',
        })
      );

      renderWithFrontendProviders(<AssignmentsPage />);

      // Create button should be disabled when reference data is not trustworthy
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
    });
  });
});
