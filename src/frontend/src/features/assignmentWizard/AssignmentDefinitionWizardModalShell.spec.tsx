import { cleanup, render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { createElement, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import { AssignmentDefinitionWizardReviewContent } from './AssignmentDefinitionWizardReviewContent';
import type { TaskRow } from './useAssignmentDefinitionWizard';

const baseProperties = {
  open: true,
  mode: 'create' as const,
  title: null,
  isHydrating: false,
  blockingError: null,
  isMutationBusy: false,
  onCancel: () => {},
  onSubmit: () => {},
};

/**
 * Dynamically imports the wizard modal shell module under test.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module.
 */
async function loadAssignmentDefinitionWizardModalShell() {
  const modulePath = './AssignmentDefinitionWizardModalShell';
  return import(/* @vite-ignore */ modulePath);
}

describe('AssignmentDefinitionWizardModalShell', () => {
  it('renders hydrated, loading, and blocking-error shell states for the assignment-definition wizard modal', async () => {    const { AssignmentDefinitionWizardModalShell } = await loadAssignmentDefinitionWizardModalShell();

    const { rerender } = render(
      createElement(ShellStateHarness, { shell: AssignmentDefinitionWizardModalShell, mode: 'create' })
    );

    expect(screen.getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse and continue/i })).toBeEnabled();

    rerender(
      createElement(ShellStateHarness, {
        shell: AssignmentDefinitionWizardModalShell,
        isHydrating: true,
        mode: 'update',
      })
    );

    expect(screen.getByLabelText(/assignment wizard loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /reference document url/i })).not.toBeInTheDocument();

    rerender(
      createElement(ShellStateHarness, {
        shell: AssignmentDefinitionWizardModalShell,
        blockingError: 'Assignment definition could not be loaded.',
        mode: 'update',
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByRole('textbox', { name: /reference document url/i })).not.toBeInTheDocument();
  });

  it('shell renders the same DOM regions through the extracted review content', async () => {
    const { AssignmentDefinitionWizardModalShell } = await loadAssignmentDefinitionWizardModalShell();

    render(createElement(ShellHarness, { shell: AssignmentDefinitionWizardModalShell }));

    expect(screen.getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /task weightings/i })).toBeInTheDocument();
    expect(screen.getByText(SEED_FIRST_TASK_TITLE)).toBeInTheDocument();
    cleanup();

    render(createElement(ReviewContentHarness));

    expect(screen.getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /task weightings/i })).toBeInTheDocument();
    expect(screen.getByText(SEED_FIRST_TASK_TITLE)).toBeInTheDocument();
  });
});

/**
 * Static full-definition seed copied from the canonical Section 2
 * `transport.editableDefinitions` view (small profile `definition-0-slides`
 * record in `tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json`).
 * Frontend specs keep a static copy so they never import backend or GAS modules.
 */
const CANONICAL_EDITABLE_DEFINITION_SEED: AssignmentDefinition = {
  definitionKey: 'definition-0-slides',
  primaryTitle: 'Synthetic Assignment Definition 1',
  primaryTopicKey: 'topic-0',
  primaryTopic: 'Synthetic Topic 1',
  yearGroupKey: 'year-group-7',
  yearGroupLabel: 'Year 7',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'reference-document-0',
  templateDocumentId: 'template-document-0',
  assignmentWeighting: 1,
  tasks: [
    { taskId: 'task-0-0', taskTitle: 'Synthetic Task 1.1', taskWeighting: 1 },
    { taskId: 'task-0-1', taskTitle: 'Synthetic Task 1.2', taskWeighting: 1 },
  ],
  createdAt: '2024-01-02T09:00:00.000Z',
  updatedAt: '2024-01-02T09:02:00.000Z',
};

/**
 * First task title from the canonical seed, reused by the task-row assertions.
 */
const SEED_FIRST_TASK_TITLE = 'Synthetic Task 1.1';

/**
 * Builds shell-shaped task rows from the canonical seed definition.
 *
 * @param {AssignmentDefinition} definition Canonical full-definition seed.
 * @returns {TaskRow[]} Task rows for the wizard content properties.
 */
function buildSeedTaskRows(definition: AssignmentDefinition): TaskRow[] {
  return definition.tasks.map((task) => ({
    key: task.taskId,
    taskId: task.taskId,
    taskTitle: task.taskTitle,
    taskWeighting: task.taskWeighting,
  }));
}

/**
 * Renders the shell with a live Ant Design form instance for shell-state coverage.
 * Ensures the main antd `<Form>` path renders with form context provided.
 *
 * @param {Readonly<{ shell: (properties: Record<string, unknown>) => JSX.Element; mode: 'create' | 'update'; isHydrating?: boolean; blockingError?: string | null }>} properties Harness properties.
 * @param {(properties: Record<string, unknown>) => JSX.Element} properties.shell Shell component.
 * @param {'create' | 'update'} properties.mode Wizard mode.
 * @param {boolean} [properties.isHydrating] Whether the shell is hydrating.
 * @param {string | null} [properties.blockingError] Blocking error message.
 * @returns {JSX.Element} Shell harness element.
 */
function ShellStateHarness(properties: Readonly<{
  shell: (properties: Record<string, unknown>) => JSX.Element;
  mode: 'create' | 'update';
  isHydrating?: boolean;
  blockingError?: string | null;
}>): JSX.Element {
  const [form] = Form.useForm();
  return createElement(properties.shell, {
    ...baseProperties,
    mode: properties.mode,
    isHydrating: properties.isHydrating ?? false,
    blockingError: properties.blockingError ?? null,
    form,
    onFormValuesChange: vi.fn(),
  });
}

/**
 * Renders the shell with a live Ant Design form instance in update
 * mode, seeded with the canonical task rows for region comparison.
 *
 * @param {Readonly<{ shell: (properties: Record<string, unknown>) => JSX.Element }>} properties Harness properties.
 * @param {(properties: Record<string, unknown>) => JSX.Element} properties.shell Shell component.
 * @returns {JSX.Element} Shell harness element.
 */
function ShellHarness(properties: Readonly<{
  shell: (properties: Record<string, unknown>) => JSX.Element;
}>): JSX.Element {
  const [form] = Form.useForm();
  return createElement(properties.shell, {
    open: true,
    mode: 'update',
    title: null,
    isHydrating: false,
    blockingError: null,
    isMutationBusy: false,
    isClosable: true,
    hasDirtyEdits: false,
    hasParsedTasks: true,
    taskRows: buildSeedTaskRows(CANONICAL_EDITABLE_DEFINITION_SEED),
    documentChange: {
      hasPendingChange: false,
      previousReferenceUrl: '',
      previousTemplateUrl: '',
    },
    form,
    topicOptions: [],
    yearGroupOptions: [],
    primaryActionLabel: 'Save',
    isPrimaryActionDisabled: false,
    onCancel: vi.fn(),
    onPrimaryAction: vi.fn(),
    onFormValuesChange: vi.fn(),
    onTaskWeightingChange: vi.fn(),
  });
}

/**
 * Renders the extracted review-content component with a live Ant
 * Design form instance and stage-two content seeded from the canonical view.
 *
 * @returns {JSX.Element} Review-content harness element.
 */
function ReviewContentHarness(): JSX.Element {
  const [form] = Form.useForm();
  return createElement(AssignmentDefinitionWizardReviewContent, {
    hasParsedTasks: true,
    taskRows: buildSeedTaskRows(CANONICAL_EDITABLE_DEFINITION_SEED),
    documentChange: {
      hasPendingChange: false,
      previousReferenceUrl: '',
      previousTemplateUrl: '',
    },
    form,
    topicOptions: [],
    yearGroupOptions: [],
    primaryActionLabel: 'Save',
    isPrimaryActionDisabled: false,
    isMutationBusy: false,
    onCancel: vi.fn(),
    onPrimaryAction: vi.fn(),
    onFormValuesChange: vi.fn(),
    onTaskWeightingChange: vi.fn(),
  });
}
