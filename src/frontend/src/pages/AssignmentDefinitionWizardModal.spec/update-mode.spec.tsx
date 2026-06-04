import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStartupWarmupState,
} from '../../test/assignmentDefinition/wizardTestHelpers';
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
  renderWizardModal,
  getFormElements,
  getTaskTable,
  getParseButton,
  getReparseButton,
  getReparseCancelButton,
  fillRequiredFields,
  changeReferenceUrl,
  assertDocumentChangePromptVisible,
  assertDocumentChangePromptNotVisible,
  assertMetadataAndTaskWeightingsDisabled,
  assertMetadataAndTaskWeightingsEnabled,
  assertTaskVisible,
  getReferenceUrlValue,
  type RenderWizardModalOptions,
} from '../../test/assignmentDefinition/wizardModalTestHelpers';
import {
  createBaseCreateOptions,
  createBaseUpdateOptions,
  setupCreateModeMocks,
  setupUpdateModeMocks,
  type Mocks,
  type Fixtures,
} from './shared-setup';

const {
  getAssignmentDefinitionMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  upsertAssignmentDefinitionMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  getAssignmentDefinitionMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  upsertAssignmentDefinitionMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

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

const mocks: Mocks = {
  useStartupWarmupStateMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  getAssignmentDefinitionMock,
  upsertAssignmentDefinitionMock,
};

const fixtures: Fixtures = {
  createStartupWarmupState,
  mockTopics,
  mockYearGroups,
  mockCohorts,
  mockFullAssignmentDefinition,
  mockUpsertResponse,
};

describe('AssignmentDefinitionWizardModal', () => {
  beforeEach(() => {
    setupCreateModeMocks(mocks, fixtures);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Batch D: Direct Unit Tests for AssignmentDefinitionWizardModal
  // Required test cases from specification
  // ============================================================================

  describe('Batch D: Direct unit tests for AssignmentDefinitionWizardModal', () => {
    // Test Case 12: Post-parse document change triggers re-parse-or-cancel flow in update mode
    it('post-parse document change triggers re-parse-or-cancel flow in update mode', async () => {
      const updateDefinition = {
        ...mockFullAssignmentDefinition,
        definitionKey: 'test-update-key',
      };
      setupUpdateModeMocks(mocks, fixtures, updateDefinition);
      getAssignmentDefinitionMock.mockResolvedValue(updateDefinition);

      const renderOptions = createBaseUpdateOptions(mocks, fixtures, 'test-update-key', updateDefinition);
      const { modal } = await renderWizardModal(renderOptions);

      // Verify we're in the shared edit surface with tasks
      expect(getTaskTable({ modal })).toBeInTheDocument();

      // Store original reference URL
      const originalReferenceUrl = getReferenceUrlValue({ modal });

      // Change document URL
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref-doc');

      // Should show re-parse prompt
      assertDocumentChangePromptVisible({ modal });

      // Re-parse and Cancel buttons should be present in the document change action row
      expect(getReparseButton({ modal })).toBeInTheDocument();
      expect(getReparseCancelButton({ modal })).toBeInTheDocument();

      // Metadata and task weighting inputs should be disabled
      await assertMetadataAndTaskWeightingsDisabled({ modal });

      // Clicking cancel should restore the previous URL
      const cancelButton = getReparseCancelButton({ modal });
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // URL should be restored
      await waitFor(() => {
        expect(getReferenceUrlValue({ modal })).toBe(originalReferenceUrl);
      });

      // Metadata inputs should be re-enabled
      await assertMetadataAndTaskWeightingsEnabled({ modal });

      // Re-parse alert should be gone
      assertDocumentChangePromptNotVisible({ modal });
    });

    // Test Case 13: Post-parse re-parse success preserves and resets task-row state in update mode
    it('post-parse re-parse success preserves and resets task-row state in update mode', async () => {
      const initialDefinition = {
        ...mockFullAssignmentDefinition,
        definitionKey: 'test-update-key',
        tasks: [
          { taskId: 'task-1', taskTitle: 'Original Task 1', taskWeighting: 2 },
          { taskId: 'task-2', taskTitle: 'Original Task 2', taskWeighting: 1 },
        ],
      };
      setupUpdateModeMocks(mocks, fixtures, initialDefinition);
      getAssignmentDefinitionMock.mockResolvedValue(initialDefinition);

      const renderOptions = createBaseUpdateOptions(mocks, fixtures, 'test-update-key', initialDefinition);
      const { modal, mockInvalidateQueries } = await renderWizardModal(renderOptions);

      // Verify initial tasks are present
      assertTaskVisible({ modal }, 'Original Task 1');
      assertTaskVisible({ modal }, 'Original Task 2');

      // Change document URL to trigger re-parse
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref-doc');

      // Wait for re-parse prompt
      await waitFor(() => {
        assertDocumentChangePromptVisible({ modal });
      });

      // Mock the re-parse response with new tasks
      const reparseResponse = {
        definitionKey: 'test-update-key',
        primaryTitle: 'Algebra Baseline',
        primaryTopicKey: 'topic-algebra',
        primaryTopic: 'Algebra',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'new-ref-doc',
        templateDocumentId: 'tpl-doc-456',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/new-ref-doc',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl-doc-456',
        assignmentWeighting: 5,
        tasks: [
          { taskId: 'task-1', taskTitle: 'Updated Task 1', taskWeighting: 2 }, // Same ID, weighting preserved
          { taskId: 'task-3', taskTitle: 'New Task 3', taskWeighting: 1 }, // New task, defaults to 1
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      };
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(reparseResponse);
      getAssignmentDefinitionMock.mockResolvedValue(reparseResponse);

      // Click re-parse
      const reparseButton = getReparseButton({ modal });
      await act(async () => {
        fireEvent.click(reparseButton);
      });

      // Verify upsert was called for re-parse with updated document URL
      await waitFor(() => {
        expect(upsertAssignmentDefinitionMock).toHaveBeenCalled();
        const reparseCall = upsertAssignmentDefinitionMock.mock.calls[0][0] as Record<string, unknown>;
        expect(reparseCall.definitionKey).toBe('test-update-key');
        expect(String(reparseCall.referenceDocumentUrl)).toContain('new-ref-doc');
      });

      // After re-parse, document change alert should be cleared
      assertDocumentChangePromptNotVisible({ modal });

      // Modal should still be open
      expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();

      // Metadata inputs should be re-enabled
      const { titleInput } = getFormElements({ modal });
      await waitFor(() => {
        expect(titleInput).toBeEnabled();
      });

      // New task rows should be visible
      await waitFor(() => {
        assertTaskVisible({ modal }, 'Updated Task 1');
        assertTaskVisible({ modal }, 'New Task 3');
      });

      // Verify mockInvalidateQueries was called
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    // Test Case 14: Create mode post-parse document change triggers re-parse-or-cancel flow
    it('create mode post-parse document change triggers re-parse-or-cancel flow', async () => {
      const onCloseSpy = vi.fn();
      const createDefinition = {
        ...mockFullAssignmentDefinition,
        definitionKey: 'test-create-doc-change',
      };

      getAssignmentDefinitionMock.mockResolvedValue(createDefinition);
      const renderOptions = createBaseCreateOptions(mocks, fixtures, onCloseSpy);
      const { modal, mockInvalidateQueries } = await renderWizardModal(renderOptions);

      // Fill in all required fields for stage-one parse
      await fillRequiredFields({ modal }, { yearGroup: 'Year 10' });

      // Mock the parse response with definitionKey from backend
      const parseResponse = {
        definitionKey: 'test-create-doc-change',
        primaryTitle: 'Create Test',
        primaryTopicKey: 'topic-algebra',
        primaryTopic: 'Algebra',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl',
        assignmentWeighting: 1,
        tasks: [
          { taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 },
          { taskId: 'task-2', taskTitle: 'Task 2', taskWeighting: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(parseResponse);

      // Click Parse and continue
      const parseButton = getParseButton({ modal });
      await waitFor(() => {
        expect(parseButton).toBeEnabled();
      });
      await act(async () => {
        fireEvent.click(parseButton);
      });

      // Wait for parse to complete and tasks to appear (shared edit surface)
      await waitFor(() => {
        expect(getTaskTable({ modal })).toBeInTheDocument();
      });

      // onClose should NOT have been called
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Verify mockInvalidateQueries was called
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    // Test Case 15: Create mode post-parse re-parse success preserves and resets task-row state
    it('create mode post-parse re-parse success preserves and resets task-row state', async () => {
      const onCloseSpy = vi.fn();
      const renderOptions = createBaseCreateOptions(mocks, fixtures, onCloseSpy);
      const { modal, mockInvalidateQueries } = await renderWizardModal(renderOptions);

      // Fill in all required fields for stage-one parse
      await fillRequiredFields({ modal }, { yearGroup: 'Year 10' });

      // Mock the parse response with initial tasks
      const parseResponse = {
        definitionKey: 'test-create-reparse',
        primaryTitle: 'Reparse Test',
        primaryTopicKey: 'topic-algebra',
        primaryTopic: 'Algebra',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl',
        assignmentWeighting: 1,
        tasks: [
          { taskId: 'task-1', taskTitle: 'Original Task 1', taskWeighting: 1 },
          { taskId: 'task-2', taskTitle: 'Original Task 2', taskWeighting: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(parseResponse);

      // Click Parse and continue
      const parseButton = getParseButton({ modal });
      await waitFor(() => {
        expect(parseButton).toBeEnabled();
      });
      await act(async () => {
        fireEvent.click(parseButton);
      });

      // Wait for parse to complete and tasks to appear
      await waitFor(() => {
        expect(getTaskTable({ modal })).toBeInTheDocument();
      });

      // Verify initial tasks are present
      assertTaskVisible({ modal }, 'Original Task 1');
      assertTaskVisible({ modal }, 'Original Task 2');

      // onClose should NOT have been called
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Verify mockInvalidateQueries was called
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    // Test Case 16: Loading state renders skeleton during initial load
    it('loading state renders skeleton during initial load', async () => {
      useStartupWarmupStateMock.mockReturnValue(
        createStartupWarmupState({
          assignmentTopicsStatus: 'ready',
          yearGroupsStatus: 'ready',
        })
      );

      getAssignmentTopicsMock.mockImplementation(
        () => new Promise(() => {}) // Never resolves, keeps loading
      );
      getYearGroupsMock.mockImplementation(
        () => new Promise(() => {}) // Never resolves, keeps loading
      );

      const renderOptions: RenderWizardModalOptions = {
        mode: 'create',
        definitionKey: null,
        open: true,
        mockInvalidateQueries: true,
        waitForFormFields: false,
      };
      await renderWizardModal(renderOptions);

      // Should show loading skeleton with accessible loading semantics
      const skeleton = await waitFor(() => {
        return screen.getByRole('status', { name: /assignment wizard loading/i });
      });
      expect(skeleton).toHaveAttribute('aria-live', 'polite');
    });

    // Test Case 17: Guarded close blocks mask click when pending document change
    it('guarded close blocks mask click when pending document change', async () => {
      const onCloseSpy = vi.fn();
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures, undefined, definition, onCloseSpy);
      const { modal } = await renderWizardModal(renderOptions);

      // Change document URL to trigger pending change
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref-doc');

      // Wait for document change to be detected
      await waitFor(() => {
        assertDocumentChangePromptVisible({ modal });
      });

      // Mask click should be blocked
      const mask = screen.getByRole('dialog', { name: /update assignment/i }).parentElement;
      if (mask) {
        // Attempt to click outside the modal (mask click)
        await act(async () => {
          fireEvent.mouseDown(mask);
          fireEvent.mouseUp(mask);
        });

        // Modal should still be open, onClose should not have been called
        expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
        expect(onCloseSpy).not.toHaveBeenCalled();
      }

      // The re-parse action row Cancel button should be present and enabled
      expect(getReparseCancelButton({ modal })).toBeEnabled();

      // onClose should not have been called
      expect(onCloseSpy).not.toHaveBeenCalled();
    });

    // Test Case 18: Guarded close blocks escape key when pending document change
    it('guarded close blocks escape key when pending document change', async () => {
      const onCloseSpy = vi.fn();
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures, undefined, definition, onCloseSpy);
      const { modal } = await renderWizardModal(renderOptions);

      // Change document URL to trigger pending change
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref-doc');

      // Wait for document change to be detected
      await waitFor(() => {
        assertDocumentChangePromptVisible({ modal });
      });

      // Escape key should be blocked
      await act(async () => {
        fireEvent.keyDown(modal, { key: 'Escape' });
      });

      // Modal should still be open
      expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
      expect(onCloseSpy).not.toHaveBeenCalled();
    });

    // Test Case 19: Guarded close blocks when isSubmitting
    it('guarded close blocks when isSubmitting', async () => {
      const onCloseSpy = vi.fn();
      const parseResponseForSubmittingTest = {
        definitionKey: 'test-submitting-key',
        primaryTitle: 'Submitting Assessment',
        primaryTopicKey: 'topic-algebra',
        primaryTopic: 'Algebra',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [],
        alternateTopics: [],
        documentType: 'SLIDES',
        referenceDocumentId: 'sub-ref',
        templateDocumentId: 'sub-tpl',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/sub-ref',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/sub-tpl',
        assignmentWeighting: 1,
        tasks: [
          { taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 },
        ],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      };

      const renderOptions = createBaseCreateOptions(mocks, fixtures, onCloseSpy);
      const { modal } = await renderWizardModal(renderOptions);

      // Fill in all required fields
      await fillRequiredFields({ modal }, { yearGroup: 'Year 10' });

      // Mock a slow parse response to keep isSubmitting true
      let resolveParse: (value: unknown) => void;
      const parsePromise = new Promise((resolve) => {
        resolveParse = resolve;
      });
      upsertAssignmentDefinitionMock.mockReturnValueOnce(parsePromise);

      // Click Parse and continue
      const parseButton = getParseButton({ modal });
      await waitFor(() => {
        expect(parseButton).toBeEnabled();
      });

      await act(async () => {
        fireEvent.click(parseButton);
      });

      // At this point, isSubmitting should be true
      // Escape key should be blocked
      await act(async () => {
        fireEvent.keyDown(modal, { key: 'Escape' });
      });

      // Modal should still be open
      expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Mask click should also be blocked
      const mask = screen.getByRole('dialog', { name: /create assignment/i }).parentElement;
      if (mask) {
        await act(async () => {
          fireEvent.mouseDown(mask);
          fireEvent.mouseUp(mask);
        });

        // Modal should still be open
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
        expect(onCloseSpy).not.toHaveBeenCalled();
      }

      // Footer cancel button should also be disabled
      const footerCancelButton = within(modal).getByRole('button', { name: 'Cancel' });
      expect(footerCancelButton).toBeDisabled();

      // Now resolve the parse to let it complete
      await act(async () => {
        resolveParse!(parseResponseForSubmittingTest);
        // Wait for isSubmitting to become false
        await waitFor(() => {
          expect(parseButton).not.toBeDisabled();
        });
      });

      // After parse completes, modal should still be open
      expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      // onClose should still not have been called during the entire test
      expect(onCloseSpy).not.toHaveBeenCalled();
    });
  });
});
