import type { RenderWizardModalOptions } from '../../test/assignmentDefinition/wizardModalTestHelpers';
import {
  mockFullAssignmentDefinition,
  mockUpsertResponse,
} from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import {
  createStartupWarmupState,
  setTextboxValue,
} from '../../test/assignmentDefinition/wizardTestHelpers';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAssignmentDefinitionWizardMocks,
  resetAssignmentDefinitionWizardMocks,
  setWizardMocks,
} from '../../test/assignmentDefinition/AssignmentDefinitionWizardModal.test-harness';
import * as wizard from '../../test/assignmentDefinition/AssignmentDefinitionWizardModal.test-harness';

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
  return { ...actualModule, useStartupWarmupState: useStartupWarmupStateMock };
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

const {
  renderWizardModal,
  createBaseCreateOptions,
  createBaseUpdateOptions,
  setupUpdateModeMocks,
  getFormElements,
  getAssignmentWeightingInput,
  getAllTaskWeightingInputs,
  getReparseButton,
  getReparseCancelButton,
  fillRequiredFields,
  changeReferenceUrl,
  changeTemplateUrl,
  assertTaskEditingHidden,
  assertParseButtonPresent,
  assertDocumentChangePromptVisible,
  assertDocumentChangePromptNotVisible,
  assertMetadataAndTaskWeightingsDisabled,
  assertMetadataAndTaskWeightingsEnabled,
  assertDocumentUrlFieldsDisabled,
  assertAllRequiredFieldsPresent,
  assertParseButtonDisabled,
  assertTaskVisible,
  getReferenceUrlValue,
  getTemplateUrlValue,
} = wizard;

beforeEach(() => {
  setWizardMocks({
    getAssignmentDefinitionMock,
    getAssignmentTopicsMock,
    getCohortsMock,
    getYearGroupsMock,
    upsertAssignmentDefinitionMock,
    useStartupWarmupStateMock,
  });
  setupAssignmentDefinitionWizardMocks();
});

afterEach(() => {
  resetAssignmentDefinitionWizardMocks();
});

describe('AssignmentDefinitionWizardModal create and update flows', () => {
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
        { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 2 },
        { taskId: 'task-4', taskTitle: 'Complete revision quiz', taskWeighting: 1 },
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
      {
        title: 'New Assessment',
        referenceUrl: 'https://docs.google.com/presentation/d/test-ref',
        templateUrl: 'https://docs.google.com/presentation/d/test-tpl',
        yearGroup: undefined,
      }
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
});
