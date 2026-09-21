import { mockFullAssignmentDefinition } from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  setupUpdateModeMocks,
  getFormElements,
  getSaveButton,
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

    expect((titleInput as HTMLInputElement).value).toBe('Pre-filled Title');
    expect(topicSelect.parentElement?.textContent).toContain('Algebra');
    expect(yearGroupSelect.parentElement?.textContent).toContain('Year 10');
  });

  it('applies partial initialValues — only provided fields are pre-populated', async () => {
    const renderOptions = createBaseCreateOptions();
    renderOptions.initialValues = {
      title: 'Only Title',
    };
    const { modal } = await renderWizardModal(renderOptions);

    const { titleInput, topicSelect, yearGroupSelect } = getFormElements({ modal });

    expect((titleInput as HTMLInputElement).value).toBe('Only Title');
    expect(topicSelect.parentElement?.textContent).not.toContain('Algebra');
    expect(topicSelect.parentElement?.textContent).not.toContain('Geometry');
    expect(yearGroupSelect.parentElement?.textContent).not.toContain('Year 10');
    expect(yearGroupSelect.parentElement?.textContent).not.toContain('Year 11');
  });

  it('starts empty in create mode when initialValues are absent', async () => {
    const renderOptions = createBaseCreateOptions();
    const { modal } = await renderWizardModal(renderOptions);

    const { titleInput } = getFormElements({ modal });

    expect((titleInput as HTMLInputElement).value).toBe('');
  });

  it('ignores initialValues in update mode — hydrates from definition', async () => {
    setupUpdateModeMocks(mockFullAssignmentDefinition);
    const renderOptions = createBaseUpdateOptions('algebra-baseline', mockFullAssignmentDefinition);
    renderOptions.initialValues = {
      title: 'Should Be Ignored',
      topic: 'topic-geometry',
    };
    const { modal } = await renderWizardModal(renderOptions);

    const { titleInput, topicSelect, yearGroupSelect } = getFormElements({ modal });

    expect((titleInput as HTMLInputElement).value).toBe('Algebra Baseline');
    expect(topicSelect.parentElement?.textContent).toContain('Algebra');
    expect(topicSelect.parentElement?.textContent).not.toContain('Geometry');
    expect(yearGroupSelect.parentElement?.textContent).toContain('Year 10');
  });

  it('calls onCreateSuccess on final save in create mode with the correct definition key', async () => {
    const onCreateSuccess = vi.fn();
    const renderOptions = createBaseCreateOptions();
    renderOptions.onCreateSuccess = onCreateSuccess;
    const { modal } = await renderWizardModal(renderOptions);

    await performStageOneParse(modal, 'test-create-key');
    await performFinalSave(modal, 'test-create-key');

    await waitFor(() => {
      expect(onCreateSuccess).toHaveBeenCalledWith('test-create-key');
    });
  });

  it('does NOT call onCreateSuccess when save fails', async () => {
    const onCreateSuccess = vi.fn();
    const renderOptions = createBaseCreateOptions();
    renderOptions.onCreateSuccess = onCreateSuccess;
    const { modal } = await renderWizardModal(renderOptions);

    await performStageOneParse(modal, 'test-fail-key');

    upsertAssignmentDefinitionMock.mockRejectedValueOnce(new Error('Save failed'));

    const saveButton = getSaveButton({ modal });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(onCreateSuccess).not.toHaveBeenCalled();
  });

  it('does NOT call onClose when onCreateSuccess is provided and save succeeds', async () => {
    const onCloseSpy = vi.fn();
    const onCreateSuccess = vi.fn();
    const renderOptions = createBaseCreateOptions(onCloseSpy);
    renderOptions.onCreateSuccess = onCreateSuccess;
    const { modal } = await renderWizardModal(renderOptions);

    await performStageOneParse(modal, 'test-no-close-key', {
      tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
    });
    await performFinalSave(modal, 'test-no-close-key', {
      tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 2 }],
    });

    expect(onCloseSpy).not.toHaveBeenCalled();
  });

  it('calls onClose when onCreateSuccess is NOT provided and save succeeds', async () => {
    const onCloseSpy = vi.fn();
    const renderOptions = createBaseCreateOptions(onCloseSpy);
    const { modal } = await renderWizardModal(renderOptions);

    await performStageOneParse(modal, 'test-close-key', {
      tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
    });
    await performFinalSave(modal, 'test-close-key', {
      tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 2 }],
    });

    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled();
    });
  });
});
