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
  getModalCloseButton,
  getFooterCancelButton,
  dismissModalByMaskClick,
  fillRequiredFields,
  performStageOneParse,
  changeReferenceUrl,
  changeTemplateUrl,
  getReferenceUrlValue,
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
  /** Replacement reference URL used to leave a document change pending. */
  const PENDING_REFERENCE_URL = 'https://docs.google.com/presentation/d/new-ref-doc';

  /** Replacement template URL used to leave a document change pending. */
  const PENDING_TEMPLATE_URL = 'https://docs.google.com/presentation/d/new-tpl-doc';

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

  it('update mode close control dismisses the wizard for a URL-only pending document change', async () => {
    const onCloseSpy = vi.fn();
    const definition = mockFullAssignmentDefinition;
    setupUpdateModeMocks(definition);
    const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    // Change document URL to trigger pending change
    await changeReferenceUrl({ modal }, PENDING_REFERENCE_URL);

    // Wait for document change to be detected
    await waitFor(() => {
      assertDocumentChangePromptVisible({ modal });
    });

    // The top-right close control stays live and dismisses the wizard.
    const closeControl = getModalCloseButton({ modal });
    expect(closeControl).toBeEnabled();

    fireEvent.click(closeControl);

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('update mode escape key dismisses the wizard for a URL-only pending document change', async () => {
    const onCloseSpy = vi.fn();
    const definition = mockFullAssignmentDefinition;
    setupUpdateModeMocks(definition);
    const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    // Change document URL to trigger pending change
    await changeReferenceUrl({ modal }, PENDING_REFERENCE_URL);

    // Wait for document change to be detected
    await waitFor(() => {
      assertDocumentChangePromptVisible({ modal });
    });

    fireEvent.keyDown(modal, { key: 'Escape' });

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('update mode mask dismissal dismisses the wizard for a URL-only pending document change', async () => {
    const onCloseSpy = vi.fn();
    const definition = mockFullAssignmentDefinition;
    setupUpdateModeMocks(definition);
    const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    // Change document URL to trigger pending change
    await changeReferenceUrl({ modal }, PENDING_REFERENCE_URL);

    // Wait for document change to be detected
    await waitFor(() => {
      assertDocumentChangePromptVisible({ modal });
    });

    // Dispatched on the rc-dialog wrapper, which is the only element that owns the
    // mask-closable path.
    await dismissModalByMaskClick(modal);

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('update mode footer cancel dismisses the wizard for a URL-only pending document change', async () => {
    const onCloseSpy = vi.fn();
    const definition = mockFullAssignmentDefinition;
    setupUpdateModeMocks(definition);
    const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    // Both URLs are changed so the pending state is independent of which field was edited.
    await changeReferenceUrl({ modal }, PENDING_REFERENCE_URL);
    await changeTemplateUrl({ modal }, PENDING_TEMPLATE_URL);

    // Wait for document change to be detected
    await waitFor(() => {
      assertDocumentChangePromptVisible({ modal });
    });

    // The footer Cancel is distinct from the document-change Cancel, which only restores URLs.
    const footerCancel = getFooterCancelButton({ modal });
    expect(footerCancel).toBeEnabled();
    expect(getReparseCancelButton({ modal })).toBeEnabled();

    fireEvent.click(footerCancel);

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('update mode routes a pending document change with unsaved metadata through the discard confirmation', async () => {
    const onCloseSpy = vi.fn();
    const definition = mockFullAssignmentDefinition;
    setupUpdateModeMocks(definition);
    const renderOptions = createBaseUpdateOptions(undefined, definition, onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    // Change document URL to trigger pending change
    await changeReferenceUrl({ modal }, PENDING_REFERENCE_URL);

    // Wait for document change to be detected
    await waitFor(() => {
      assertDocumentChangePromptVisible({ modal });
    });

    // Metadata edits are locked while the document change is pending, so the dirty
    // combination is applied through the form directly to exercise the guard.
    const { titleInput } = getFormElements({ modal });
    fireEvent.change(titleInput, { target: { value: 'Unsaved metadata edit' } });

    fireEvent.keyDown(modal, { key: 'Escape' });

    // The wizard is not dismissed straight away; the discard confirmation is shown.
    const discardDialog = await screen.findByRole('dialog', { name: /discard changes/i });
    expect(onCloseSpy).not.toHaveBeenCalled();

    // Keeping editing returns to the wizard without discarding anything.
    fireEvent.click(within(discardDialog).getByRole('button', { name: 'Keep editing' }));

    expect(
      screen.queryByRole('dialog', { name: /discard changes/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
    expect(onCloseSpy).not.toHaveBeenCalled();

    // Confirming the discard is the only path that closes the wizard.
    fireEvent.click(getFooterCancelButton({ modal }));

    const reopenedDiscardDialog = await screen.findByRole('dialog', { name: /discard changes/i });
    fireEvent.click(within(reopenedDiscardDialog).getByRole('button', { name: 'Discard changes' }));

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('create mode blocks every dismissal path while a document change is pending', async () => {
    const onCloseSpy = vi.fn();
    const renderOptions = createBaseCreateOptions(onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    await performStageOneParse(modal, 'create-pending-document-change');

    const persistedReferenceUrl = getReferenceUrlValue({ modal });
    await changeReferenceUrl({ modal }, PENDING_REFERENCE_URL);

    // Wait for document change to be detected
    await waitFor(() => {
      assertDocumentChangePromptVisible({ modal });
    });

    // Create mode has no close control at all while the document change is pending.
    expect(within(modal).queryByRole('button', { name: /^close$/i })).toBeNull();

    fireEvent.keyDown(modal, { key: 'Escape' });
    await dismissModalByMaskClick(modal);
    fireEvent.click(getFooterCancelButton({ modal }));

    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
    expect(getSaveButton({ modal })).toBeDisabled();

    // The document-change Cancel stays live as the only way to resolve the pending change.
    const documentChangeCancel = getReparseCancelButton({ modal });
    expect(documentChangeCancel).toBeEnabled();

    fireEvent.click(documentChangeCancel);

    expect(getReferenceUrlValue({ modal })).toBe(persistedReferenceUrl);
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
    resolveParse!(parseResponseForSubmittingTest);
    await waitFor(() => {
      expect(parseButton).not.toBeDisabled();
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
