import { queryKeys } from '../../query/queryKeys';
import { mockFullAssignmentDefinition } from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
  performStageOneParse,
  performFinalSave,
  createStageOneParseResponse,
  setupUpdateModeMocks,
  getFormElements,
  getParseButton,
  getTaskTable,
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

describe('AssignmentDefinitionWizardModal persistence and callbacks', () => {
  // Test Case 11: Final save success from shared edit surface in create mode after parse
  it('final save success from shared edit surface in create mode after parse', async () => {
    const onCloseSpy = vi.fn();
    const renderOptions = createBaseCreateOptions(onCloseSpy);
    const { modal, queryClient } = await renderWizardModal(renderOptions);

    await performStageOneParse(modal, 'test-create-key');

    // Now mock the final save response
    await performFinalSave(modal, 'test-create-key', {
      tasks: [
        { taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 2 },
        { taskId: 'task-2', taskTitle: 'Task 2', taskWeighting: 3 },
      ],
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
        { taskId: 'task-1', taskTitle: 'Updated Task 1', taskWeighting: 2 },
        { taskId: 'task-3', taskTitle: 'New Task 3', taskWeighting: 1 },
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
      const reparseCall = upsertAssignmentDefinitionMock.mock.calls[0][0] as Record<
        string,
        unknown
      >;
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
    upsertAssignmentDefinitionMock.mockResolvedValueOnce(
      createStageOneParseResponse('test-create-doc-change', {
        primaryTitle: 'Create Test',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl',
      })
    );

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
    upsertAssignmentDefinitionMock.mockResolvedValueOnce(
      createStageOneParseResponse('test-create-reparse', {
        primaryTitle: 'Reparse Test',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceDocumentUrl: 'https://docs.google.com/presentation/d/ref',
        templateDocumentUrl: 'https://docs.google.com/presentation/d/tpl',
        tasks: [
          { taskId: 'task-1', taskTitle: 'Original Task 1', taskWeighting: 1 },
          { taskId: 'task-2', taskTitle: 'Original Task 2', taskWeighting: 1 },
        ],
      })
    );

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
});
