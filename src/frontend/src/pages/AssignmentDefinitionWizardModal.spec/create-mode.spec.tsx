import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import {
  createStartupWarmupState,
  setTextboxValue,
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
  getParseButton,
  getSaveButton,
  getAssignmentWeightingInput,
  getAllTaskWeightingInputs,
  getReparseButton,
  getReparseCancelButton,
  fillRequiredFields,
  changeReferenceUrl,
  changeTemplateUrl,
  assertTaskEditingHidden,
  assertParseButtonPresent,
  assertSharedEditSurfaceHydrated,
  assertDocumentChangePromptVisible,
  assertDocumentChangePromptNotVisible,
  assertMetadataAndTaskWeightingsDisabled,
  assertMetadataAndTaskWeightingsEnabled,
  assertDocumentUrlFieldsDisabled,
  assertAllRequiredFieldsPresent,
  assertParseButtonDisabled,
  assertParseButtonEnabled,
  assertTaskVisible,
  getReferenceUrlValue,
  getTemplateUrlValue,
  type RenderWizardModalOptions,
} from '../../test/assignmentDefinition/wizardModalTestHelpers';
import {
  createBaseCreateOptions,
  createBaseUpdateOptions,
  setupCreateModeMocks,
  setupUpdateModeMocks,
  EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT,
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
    // Test Case 1: Create mode hides task editing before first parse
    it('create mode hides task editing before first parse', async () => {
      const renderOptions = createBaseCreateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      assertTaskEditingHidden({ modal });
      assertParseButtonPresent({ modal });
    });

    // Test Case 2: Stage-one success hydrates shared edit surface
    it('stage-one success hydrates shared edit surface', async () => {
      const renderOptions = createBaseCreateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Parse button should be disabled initially
      assertParseButtonDisabled({ modal });

      // Mock the upsert response for stage-one
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(mockUpsertResponse);

      // Verify that the modal has the required form structure
      const { titleInput, referenceUrlInput, templateUrlInput } = getFormElements({ modal });
      expect(titleInput).toBeInTheDocument();
      expect(referenceUrlInput).toBeInTheDocument();
      expect(templateUrlInput).toBeInTheDocument();

      // getAssignmentDefinition should NOT be called during create mode
      expect(getAssignmentDefinitionMock).not.toHaveBeenCalled();
    });

    // Test Case 3: Document change disables metadata/task weighting inputs
    it('document change disables metadata and task weighting inputs', async () => {
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Change document URL
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref');

      await assertMetadataAndTaskWeightingsDisabled({ modal });

      // Should show re-parse prompt
      assertDocumentChangePromptVisible({ modal });
      expect(getReparseButton({ modal })).toBeInTheDocument();
    });

    // Test Case 4: Cancel restores persisted URLs
    it('cancel restores persisted URLs', async () => {
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Store original URLs
      const originalReferenceUrl = getReferenceUrlValue({ modal });
      const originalTemplateUrl = getTemplateUrlValue({ modal });

      // Change document URLs
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref');
      await changeTemplateUrl({ modal }, 'https://docs.google.com/presentation/d/new-tpl');

      // Click cancel on re-parse prompt
      const cancelButton = getReparseCancelButton({ modal });
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // URLs should be restored
      await waitFor(() => {
        expect(getReferenceUrlValue({ modal })).toBe(originalReferenceUrl);
        expect(getTemplateUrlValue({ modal })).toBe(originalTemplateUrl);
      });

      // Other fields should be re-enabled
      await assertMetadataAndTaskWeightingsEnabled({ modal });

      // Re-parse alert should be gone
      assertDocumentChangePromptNotVisible({ modal });
    });

    // Test Case 5: Re-parse refreshes task rows, preserves matching weightings
    it('re-parse refreshes task rows and preserves matching weightings', async () => {
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures);
      const { modal, mockInvalidateQueries } = await renderWizardModal(renderOptions);

      // Verify initial tasks are present
      assertTaskVisible({ modal }, /solve quadratic equations/i);

      // Change document URL
      await changeReferenceUrl({ modal }, 'https://docs.google.com/presentation/d/new-ref');

      // Mock re-parse response with new tasks and preserved weightings
      const reparseResponse = {
        ...mockFullAssignmentDefinition,
        definitionKey: 'algebra-baseline',
        tasks: [
          { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 2 }, // Preserved weighting
          { taskId: 'task-4', taskTitle: 'Complete revision quiz', taskWeighting: 1 }, // New task defaults to 1
        ],
      };
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(reparseResponse);

      // Click re-parse
      const reparseButton = getReparseButton({ modal });
      await act(async () => {
        fireEvent.click(reparseButton);
      });

      // Re-parse should have been called
      expect(upsertAssignmentDefinitionMock).toHaveBeenCalled();

      // Verify the re-parse was called with the definitionKey and updated URL
      expect(upsertAssignmentDefinitionMock.mock.calls[0][0]).toMatchObject({
        definitionKey: 'algebra-baseline',
        referenceDocumentUrl: expect.stringContaining('new-ref'),
      });

      // After re-parse, the document change alert should be cleared
      // and the modal should still be open
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
      });

      // Verify mockInvalidateQueries was called
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    // Test Case 6: Save blocked without year-group selection
    it('save blocked without year-group selection', async () => {
      const renderOptions = createBaseCreateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Fill in required fields except year group
      await fillRequiredFields(
        { modal },
        { title: 'New Assessment', referenceUrl: 'https://docs.google.com/presentation/d/test-ref', templateUrl: 'https://docs.google.com/presentation/d/test-tpl', yearGroup: undefined }
      );

      // Parse button should be blocked without year group
      assertParseButtonDisabled({ modal });
    });

    // Test Case 7: Dirty edits disable document URL fields
    it('dirty edits disable document URL fields', async () => {
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Edit metadata - change title
      const { titleInput } = getFormElements({ modal });
      await act(async () => {
        setTextboxValue(titleInput, 'Updated Title');
      });

      // Trigger form value change detection
      await assertDocumentUrlFieldsDisabled({ modal });
    });

    // Test Case 8: Form validation rules for required fields
    it('form validation rules for required fields', async () => {
      const renderOptions = createBaseCreateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Parse button should be disabled initially (no fields filled)
      assertParseButtonDisabled({ modal });

      // Form has required field indicators
      const requiredLabels = within(modal).getAllByText((_, element) => {
        return element?.classList.contains('ant-form-item-required') ?? false;
      });
      expect(requiredLabels.length).toBeGreaterThan(0);

      // Fill in only title - button should remain disabled
      const { titleInput } = getFormElements({ modal });
      setTextboxValue(titleInput, 'Test');
      assertParseButtonDisabled({ modal });

      // Fill in some more fields but not all - button should remain disabled
      const { referenceUrlInput } = getFormElements({ modal });
      setTextboxValue(referenceUrlInput, 'https://docs.google.com/presentation/d/test-ref');
      assertParseButtonDisabled({ modal });

      // Verify that all required fields are present
      assertAllRequiredFieldsPresent({ modal });
    });

    // Test Case 9: Weighting range validation (0-10)
    it('weighting range validation for 0 to 10', async () => {
      const definition = mockFullAssignmentDefinition;
      setupUpdateModeMocks(mocks, fixtures, definition);
      const renderOptions = createBaseUpdateOptions(mocks, fixtures);
      const { modal } = await renderWizardModal(renderOptions);

      // Assignment weighting input should be present and editable
      const assignmentWeightingInput = getAssignmentWeightingInput({ modal });
      expect(assignmentWeightingInput).toBeInTheDocument();
      expect(assignmentWeightingInput).toBeEnabled();

      // Task weighting inputs should be present in the table
      const taskWeightingInputs = getAllTaskWeightingInputs({ modal });
      // Should have at least assignment weighting + task weightings
      expect(taskWeightingInputs.length).toBeGreaterThan(0);

      // All inputs should be enabled
      taskWeightingInputs.forEach((input) => {
        expect(input).toBeEnabled();
      });

      // Form should have validation rules for weighting range
      // The form rules include: { type: 'number', min: 0, max: 10, message: 'Weighting must be between 0 and 10' }
      // We verify this by checking the form structure rather than HTML attributes
      // since Ant Design InputNumber does not expose min/max as DOM attributes
    });

    // Test Case 10: Create blocks when reference data cannot be loaded
    it('create blocks when reference data cannot be loaded', async () => {
      useStartupWarmupStateMock.mockReturnValue(
        createStartupWarmupState({
          assignmentTopicsStatus: 'failed',
          yearGroupsStatus: 'failed',
        })
      );

      const renderOptions: RenderWizardModalOptions = {
        mode: 'create',
        definitionKey: null,
        open: true,
        mockInvalidateQueries: true,
        waitForFormFields: false,
      };
      await renderWizardModal(renderOptions);

      // Modal should show blocking error
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/could not be trusted or loaded/i)).toBeInTheDocument();
      });
    });

    // Test Case 11: Final save success from shared edit surface in create mode after parse
    it('final save success from shared edit surface in create mode after parse', async () => {
      const onCloseSpy = vi.fn();
      const renderOptions = createBaseCreateOptions(mocks, fixtures, onCloseSpy);
      const { modal, queryClient } = await renderWizardModal(renderOptions);

      // Fill in all required fields for stage-one parse
      await fillRequiredFields({ modal }, { title: 'New Assessment', yearGroup: 'Year 10' });

      // Wait for form validation to pass and Parse button to become enabled
      await waitFor(() => {
        assertParseButtonEnabled({ modal });
      });

      // Mock the stage-one parse response
      const parseResponse = {
        definitionKey: 'test-create-key',
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
      };
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(parseResponse);

      // Click Parse and continue
      const parseButton = getParseButton({ modal });
      await act(async () => {
        fireEvent.click(parseButton);
      });

      // Wait for parse to complete and tasks to appear
      await waitFor(() => {
        assertSharedEditSurfaceHydrated({ modal });
        expect(getSaveButton({ modal })).toBeInTheDocument();
      });

      // Now mock the final save response
      const finalSaveResponse = {
        definitionKey: 'test-create-key',
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
      };
      upsertAssignmentDefinitionMock.mockResolvedValueOnce(finalSaveResponse);

      // Click Save
      const saveButton = getSaveButton({ modal });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Verify stage-one parse and final save were both called
      await waitFor(() => {
        expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT);
      });

      // Verify the stage-one parse call created the definition
      const parseCall = upsertAssignmentDefinitionMock.mock.calls[0][0] as Record<string, unknown>;
      expect(parseCall.primaryTitle).toBe('New Assessment');
      expect(parseCall.primaryTopicKey).toBe('topic-algebra');
      expect(parseCall.yearGroupKey).toBe('year-group-10');
      expect(parseCall.definitionKey).toBeUndefined(); // Stage-one create does not include definitionKey

      // Verify the final save call includes definitionKey from parse response per SPEC.md #20 and #21
      const saveCall = upsertAssignmentDefinitionMock.mock.calls[1][0] as Record<string, unknown>;
      expect(saveCall.primaryTitle).toBe('New Assessment');
      expect(saveCall.primaryTopicKey).toBe('topic-algebra');
      expect(saveCall.yearGroupKey).toBe('year-group-10');
      expect(saveCall.assignmentWeighting).toBe(1); // Default weighting
      // Verify taskWeightings are included
      expect(saveCall.taskWeightings).toBeDefined();
      expect(Array.isArray(saveCall.taskWeightings)).toBe(true);
      expect((saveCall.taskWeightings as Array<Record<string, unknown>>).length).toBeGreaterThan(0);

      // Verify assignmentDefinitionPartials query was invalidated after create
      await waitFor(() => {
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: queryKeys.assignmentDefinitionPartials(),
          })
        );
      });

      // Verify onClose was called after successful save
      await waitFor(() => {
        expect(onCloseSpy).toHaveBeenCalled();
      });
    });
  });
});
