import type { RenderWizardModalOptions } from '../../test/assignmentDefinition/wizardModalTestHelpers';
import {
  mockTopics,
  mockYearGroups,
  mockCohorts,
} from '../../test/assignmentDefinition/sharedTestFixtures';
import { mockFullAssignmentDefinition } from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
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
  getParseButton,
  getSaveButton,
  getReparseCancelButton,
  fillRequiredFields,
  changeReferenceUrl,
  assertDocumentChangePromptVisible,
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

describe('AssignmentDefinitionWizardModal guarded close and errors', () => {
  // Test Case 16: Loading state renders skeleton during initial load
  it('loading state renders skeleton during initial load', async () => {
    useStartupWarmupStateMock.mockReturnValue(
      createStartupWarmupState({
        assignmentTopicsStatus: 'ready',
        yearGroupsStatus: 'ready',
      })
    );

    getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));
    getYearGroupsMock.mockImplementation(() => new Promise(() => {}));

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
      fireEvent.mouseDown(mask);
      fireEvent.mouseUp(mask);

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
    fireEvent.keyDown(modal, { key: 'Escape' });

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
      tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
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

    fireEvent.click(parseButton);

    // Wait for the parse mutation to enter its submitting state before testing guarded close.
    const footerCancelButton = within(modal).getByRole('button', { name: 'Cancel' });
    await waitFor(() => {
      expect(footerCancelButton).toBeDisabled();
    });

    // Escape key should be blocked while the parse mutation is submitting.
    fireEvent.keyDown(modal, { key: 'Escape' });

    // Modal should still be open
    expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
    expect(onCloseSpy).not.toHaveBeenCalled();

    // Mask click should also be blocked
    const mask = screen.getByRole('dialog', { name: /create assignment/i }).parentElement;
    if (mask) {
      fireEvent.mouseDown(mask);
      fireEvent.mouseUp(mask);

      // Modal should still be open
      expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      expect(onCloseSpy).not.toHaveBeenCalled();
    }

    // Now resolve the parse to let it complete
    await act(async () => {
      resolveParse!(parseResponseForSubmittingTest);
      await waitFor(() => {
        expect(parseButton).not.toBeDisabled();
      });
    });

    // After parse completes, modal should still be open
    expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
    expect(onCloseSpy).not.toHaveBeenCalled();
  });

  // Test Case 20: Update mode shows blocking error when getAssignmentDefinition fails validation
  it('update mode shows blocking error when getAssignmentDefinition fails validation', async () => {
    setupUpdateModeMocks(mockFullAssignmentDefinition);
    getAssignmentDefinitionMock.mockRejectedValue(
      new Error('Failed to parse assignment definition')
    );

    const onCloseSpy = vi.fn();

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
    };

    await renderWizardModal(renderOptions);

    // Should show blocking error with role="alert" containing the error message
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('An error occurred. Please try again.');
    });

    // Error should be dismissible via Escape key
    const blockingDialog = screen.getByRole('dialog', { name: /update assignment/i });
    fireEvent.keyDown(blockingDialog, { key: 'Escape' });

    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled();
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

    // Mock upsert to reject on save
    upsertAssignmentDefinitionMock.mockRejectedValue(
      new Error('Failed to save assignment definition')
    );

    // Click Save button
    const saveButton = getSaveButton({ modal });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const blockingDialog = screen.getByRole('dialog', { name: /update assignment/i });
    fireEvent.keyDown(blockingDialog, { key: 'Escape' });

    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled();
    });
  });
});
