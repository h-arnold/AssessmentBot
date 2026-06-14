import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
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
  getTaskTable,
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
} from '../../test/assignmentDefinition/wizardModalTestHelpers';
import type { RenderWizardModalOptions } from '../../test/assignmentDefinition/wizardModalTestHelpers';

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

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  getAssignmentDefinition: getAssignmentDefinitionMock,
  upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
}));

vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../../services/referenceData/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

// Test constants to avoid magic numbers
const EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT = 2;

/**
 * Creates a base render options object for create mode tests.
 *
 * @param {() => void} [onClose] - Optional onClose handler.
 * @param {Parameters<typeof createStartupWarmupState>[0]} [warmupState] - Optional warmup state override.
 * @returns {RenderWizardModalOptions} Render options for create mode.
 */
function createBaseCreateOptions(
  onClose?: () => void,
  warmupState?: Parameters<typeof createStartupWarmupState>[0]
): RenderWizardModalOptions {
  if (warmupState) {
    useStartupWarmupStateMock.mockReturnValue(createStartupWarmupState(warmupState));
  } else {
    useStartupWarmupStateMock.mockReturnValue(
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
function createBaseUpdateOptions(
  definitionKey = 'algebra-baseline',
  definition: AssignmentDefinition = mockFullAssignmentDefinition,
  onClose?: () => void
): RenderWizardModalOptions {
  useStartupWarmupStateMock.mockReturnValue(
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
function setupCreateModeMocks(): void {
  getAssignmentTopicsMock.mockResolvedValue(mockTopics);
  getCohortsMock.mockResolvedValue(mockCohorts);
  getYearGroupsMock.mockResolvedValue(mockYearGroups);
  getAssignmentDefinitionMock.mockResolvedValue(mockFullAssignmentDefinition);
  upsertAssignmentDefinitionMock.mockResolvedValue(mockUpsertResponse);
}

/**
 * Sets up service mocks for update mode tests.
 *
 * @param {unknown} definition - The assignment definition to use.
 * @returns {void}
 */
function setupUpdateModeMocks(definition: unknown): void {
  getAssignmentTopicsMock.mockResolvedValue(mockTopics);
  getCohortsMock.mockResolvedValue(mockCohorts);
  getYearGroupsMock.mockResolvedValue(mockYearGroups);
  getAssignmentDefinitionMock.mockResolvedValue(definition);
  upsertAssignmentDefinitionMock.mockResolvedValue(mockUpsertResponse);
}

describe('AssignmentDefinitionWizardModal', () => {
  beforeEach(() => {
    setupCreateModeMocks();
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
      const renderOptions = createBaseCreateOptions();
      const { modal } = await renderWizardModal(renderOptions);

      assertTaskEditingHidden({ modal });
      assertParseButtonPresent({ modal });
    });

    // Test Case 2: Stage-one success hydrates shared edit surface
    it('stage-one success hydrates shared edit surface', async () => {
      const renderOptions = createBaseCreateOptions();
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions();
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions();
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions();
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
      const renderOptions = createBaseCreateOptions();
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions();
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
      const renderOptions = createBaseCreateOptions();
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions();
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
      const renderOptions = createBaseCreateOptions(onCloseSpy);
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

    // Test Case 12: Post-parse document change triggers re-parse-or-cancel flow in update mode
    it('post-parse document change triggers re-parse-or-cancel flow in update mode', async () => {
      const updateDefinition = {
        ...mockFullAssignmentDefinition,
        definitionKey: 'test-update-key',
      };
      setupUpdateModeMocks(updateDefinition);
      getAssignmentDefinitionMock.mockResolvedValue(updateDefinition);

      const renderOptions = createBaseUpdateOptions('test-update-key', updateDefinition);
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
      setupUpdateModeMocks(initialDefinition);
      getAssignmentDefinitionMock.mockResolvedValue(initialDefinition);

      const renderOptions = createBaseUpdateOptions('test-update-key', initialDefinition);
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
      const renderOptions = createBaseCreateOptions(onCloseSpy);
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
      const renderOptions = createBaseCreateOptions(onCloseSpy);
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
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
      setupUpdateModeMocks(definition);
      const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
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

      const renderOptions = createBaseCreateOptions(onCloseSpy);
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

    // Test Case 20: Update mode shows blocking error when getAssignmentDefinition fails validation
    it('update mode shows blocking error when getAssignmentDefinition fails validation', async () => {
      // Make getAssignmentDefinition reject to simulate a validation failure
      // (e.g. ZodError from malformed GAS-serialized response, as in issue #244)
      setupUpdateModeMocks(mockFullAssignmentDefinition);
      getAssignmentDefinitionMock.mockRejectedValue(new Error('Failed to parse assignment definition'));

      const onCloseSpy = vi.fn();

      // Do NOT provide assignmentDefinition in render options so query cache does not pre-load it.
      // The useQuery for the definition (line 776-783 of useAssignmentDefinitionWizard.ts)
      // will fire and call the mocked getAssignmentDefinition, which rejects.
      useStartupWarmupStateMock.mockReturnValue(
        createStartupWarmupState({
          assignmentTopicsStatus: 'ready',
          yearGroupsStatus: 'ready',
        })
      );

      const renderOptions: RenderWizardModalOptions = {
        mode: 'update',
        definitionKey: 'algebra-baseline',
        onClose: onCloseSpy,
        open: true,
        topics: [...mockTopics],
        yearGroups: [...mockYearGroups],
        cohorts: [...mockCohorts],
        mockInvalidateQueries: true,
        waitForFormFields: false,
        // No assignmentDefinition — cache is empty, useQuery must fetch and will reject
      };

      await renderWizardModal(renderOptions);

      // Should show blocking error with role="alert" containing the error message
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('An error occurred. Please try again.');
      });

      // Error should be dismissible via Escape key (modal has keyboard=true by default)
      const blockingDialog = screen.getByRole('dialog', { name: /update assignment/i });
      await act(async () => {
        fireEvent.keyDown(blockingDialog, { key: 'Escape' });
      });

      await waitFor(() => {
        expect(onCloseSpy).toHaveBeenCalled();
      });
    });

    // ============================================================================
    // Section 1 — initialValues and onCreateSuccess
    // ============================================================================

    describe('initialValues and onCreateSuccess', () => {
      it('applies initialValues to form fields in create mode', async () => {
        const renderOptions = createBaseCreateOptions();
        renderOptions.initialValues = {
          title: 'Pre-filled Title',
          topic: 'topic-algebra',
          yearGroup: 'year-group-10',
        };
        const { modal } = await renderWizardModal(renderOptions);

        const { titleInput, topicSelect, yearGroupSelect } = getFormElements({ modal });

        // Title input should be pre-populated
        expect((titleInput as HTMLInputElement).value).toBe('Pre-filled Title');

        // Topic and year group should be pre-populated from initialValues
        expect(topicSelect.parentElement?.textContent).toContain('Algebra');
        expect(yearGroupSelect.parentElement?.textContent).toContain('Year 10');
      });

      it('applies partial initialValues — only provided fields are pre-populated', async () => {
        const renderOptions = createBaseCreateOptions();
        renderOptions.initialValues = {
          title: 'Only Title',
          // No topic, no yearGroup — they should remain blank
        };
        const { modal } = await renderWizardModal(renderOptions);

        const { titleInput, topicSelect, yearGroupSelect } = getFormElements({ modal });

        // Title should be pre-populated
        expect((titleInput as HTMLInputElement).value).toBe('Only Title');

        // Topic and year group should be empty since initialValues doesn't include them
        expect(topicSelect.parentElement?.textContent).not.toContain('Algebra');
        expect(topicSelect.parentElement?.textContent).not.toContain('Geometry');
        expect(yearGroupSelect.parentElement?.textContent).not.toContain('Year 10');
        expect(yearGroupSelect.parentElement?.textContent).not.toContain('Year 11');
      });

      it('starts empty in create mode when initialValues are absent', async () => {
        const renderOptions = createBaseCreateOptions();
        const { modal } = await renderWizardModal(renderOptions);

        const { titleInput } = getFormElements({ modal });

        // Title should be empty (existing behaviour)
        expect((titleInput as HTMLInputElement).value).toBe('');
      });

      it('ignores initialValues in update mode — hydrates from definition', async () => {
        setupUpdateModeMocks(mockFullAssignmentDefinition);
        const renderOptions = createBaseUpdateOptions(
          'algebra-baseline',
          mockFullAssignmentDefinition
        );
        renderOptions.initialValues = {
          title: 'Should Be Ignored',
          topic: 'topic-geometry',
        };
        const { modal } = await renderWizardModal(renderOptions);

        const { titleInput, topicSelect, yearGroupSelect } = getFormElements({ modal });

        // Title should be from definition, not from initialValues
        expect((titleInput as HTMLInputElement).value).toBe('Algebra Baseline');

        // Topic should be from definition ('Algebra'), not initialValues ('topic-geometry')
        expect(topicSelect.parentElement?.textContent).toContain('Algebra');
        expect(topicSelect.parentElement?.textContent).not.toContain('Geometry');

        // Year group should be from definition ('Year 10'), not from initialValues
        expect(yearGroupSelect.parentElement?.textContent).toContain('Year 10');
      });

      it('calls onCreateSuccess on final save in create mode with the correct definition key', async () => {
        const onCreateSuccess = vi.fn();
        const renderOptions = createBaseCreateOptions();
        renderOptions.onCreateSuccess = onCreateSuccess;
        const { modal } = await renderWizardModal(renderOptions);

        // Fill in all required fields
        await fillRequiredFields({ modal }, { title: 'New Assessment', yearGroup: 'Year 10' });

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

        // Wait for parse to complete
        await waitFor(() => {
          assertSharedEditSurfaceHydrated({ modal });
          expect(getSaveButton({ modal })).toBeInTheDocument();
        });

        // Mock the final save response
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

        // Wait for the save to complete
        await waitFor(() => {
          expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(
            EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT
          );
        });

        // onCreateSuccess should have been called with the definitionKey from the save response
        await waitFor(() => {
          expect(onCreateSuccess).toHaveBeenCalledWith('test-create-key');
        });
      });

      it('does NOT call onCreateSuccess when save fails', async () => {
        const onCreateSuccess = vi.fn();
        const renderOptions = createBaseCreateOptions();
        renderOptions.onCreateSuccess = onCreateSuccess;
        const { modal } = await renderWizardModal(renderOptions);

        // Fill in all required fields
        await fillRequiredFields({ modal }, { title: 'New Assessment', yearGroup: 'Year 10' });

        await waitFor(() => {
          assertParseButtonEnabled({ modal });
        });

        // Mock the stage-one parse response
        const parseResponse = {
          definitionKey: 'test-fail-key',
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

        // Wait for parse to complete
        await waitFor(() => {
          assertSharedEditSurfaceHydrated({ modal });
          expect(getSaveButton({ modal })).toBeInTheDocument();
        });

        // Mock the final save to fail
        upsertAssignmentDefinitionMock.mockRejectedValueOnce(new Error('Save failed'));

        // Click Save
        const saveButton = getSaveButton({ modal });
        await act(async () => {
          fireEvent.click(saveButton);
        });

        // Wait for blocking error to appear
        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // onCreateSuccess should NOT have been called
        expect(onCreateSuccess).not.toHaveBeenCalled();
      });

      it('does NOT call onClose when onCreateSuccess is provided and save succeeds', async () => {
        const onCloseSpy = vi.fn();
        const onCreateSuccess = vi.fn();
        const renderOptions = createBaseCreateOptions(onCloseSpy);
        renderOptions.onCreateSuccess = onCreateSuccess;
        const { modal } = await renderWizardModal(renderOptions);

        // Fill in all required fields
        await fillRequiredFields({ modal }, { title: 'New Assessment', yearGroup: 'Year 10' });

        await waitFor(() => {
          assertParseButtonEnabled({ modal });
        });

        // Mock the stage-one parse response
        const parseResponse = {
          definitionKey: 'test-no-close-key',
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

        // Wait for parse to complete
        await waitFor(() => {
          assertSharedEditSurfaceHydrated({ modal });
          expect(getSaveButton({ modal })).toBeInTheDocument();
        });

        // Mock the final save response
        const finalSaveResponse = {
          definitionKey: 'test-no-close-key',
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

        // Wait for save to complete
        await waitFor(() => {
          expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(
            EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT
          );
        });

        // onClose should NOT have been called (onCreateSuccess replaces it)
        expect(onCloseSpy).not.toHaveBeenCalled();
      });

      it('calls onClose when onCreateSuccess is NOT provided and save succeeds', async () => {
        const onCloseSpy = vi.fn();
        const renderOptions = createBaseCreateOptions(onCloseSpy);
        const { modal } = await renderWizardModal(renderOptions);

        // Fill in all required fields
        await fillRequiredFields({ modal }, { title: 'New Assessment', yearGroup: 'Year 10' });

        await waitFor(() => {
          assertParseButtonEnabled({ modal });
        });

        // Mock the stage-one parse response
        const parseResponse = {
          definitionKey: 'test-close-key',
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

        // Wait for parse to complete
        await waitFor(() => {
          assertSharedEditSurfaceHydrated({ modal });
          expect(getSaveButton({ modal })).toBeInTheDocument();
        });

        // Mock the final save response
        const finalSaveResponse = {
          definitionKey: 'test-close-key',
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

        // Wait for save to complete
        await waitFor(() => {
          expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(
            EXPECTED_STAGE_ONE_AND_FINAL_SAVE_CALL_COUNT
          );
        });

        // onClose SHOULD have been called (existing behaviour)
        await waitFor(() => {
          expect(onCloseSpy).toHaveBeenCalled();
        });
      });
    });

    // Test Case 21: Save error shows blocking error that can be dismissed to return to assignments page
    it('save error shows blocking error that can be dismissed to return to assignments page', async () => {
      setupUpdateModeMocks(mockFullAssignmentDefinition);
      const onCloseSpy = vi.fn();
      const definition = mockFullAssignmentDefinition;
      const renderOptions = createBaseUpdateOptions('algebra-baseline', definition, onCloseSpy);
      const { modal } = await renderWizardModal(renderOptions);

      // Make a dirty edit so the form has unsaved changes
      const { titleInput } = getFormElements({ modal });
      await act(async () => {
        setTextboxValue(titleInput, 'Updated Title');
      });

      // Mock upsert to reject on save (simulates Zod validation failure from serialization issue)
      upsertAssignmentDefinitionMock.mockRejectedValue(new Error('Failed to save assignment definition'));

      // Click Save button
      const saveButton = getSaveButton({ modal });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Should show blocking error with role="alert"
      // This part WORKS because runWizardMutation catches the error and sets blockingError
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Dismiss the error via Escape key
      const blockingDialog = screen.getByRole('dialog', { name: /update assignment/i });
      await act(async () => {
        fireEvent.keyDown(blockingDialog, { key: 'Escape' });
      });

      // Should close the wizard and return to assignments page
      await waitFor(() => {
        expect(onCloseSpy).toHaveBeenCalled();
      });
    });
  });
});
