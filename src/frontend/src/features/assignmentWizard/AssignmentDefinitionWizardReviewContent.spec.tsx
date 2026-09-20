/**
 * Structural specs for the assignment wizard decomposition.
 *
 * These specs pin the extraction boundaries of the wizard refactor
 * (form-state module plus chrome-free review-content component).
 * Existing wizard behaviour remains covered by the untouched suites alongside.
 */

import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { createElement, type ComponentType, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';
import reviewContentSourceRaw from './AssignmentDefinitionWizardReviewContent.tsx?raw';
import type { TaskRow } from './useAssignmentDefinitionWizard';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture instead of a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical `definition-0-slides` record exercised as the review-content seed. */
const CANONICAL_EDITABLE_DEFINITION_SEED: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

/**
 * First task title from the canonical seed, reused by the task-row assertions.
 */
const SEED_FIRST_TASK_TITLE = CANONICAL_EDITABLE_DEFINITION_SEED.tasks[0].taskTitle;

/**
 * Dynamically imports the wizard form-state module under test.
 * Mirrors the existing dynamic-import pattern used by the wizard suites.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module namespace.
 */
async function loadAssignmentWizardFormState(): Promise<Record<string, unknown>> {
  const modulePath = './assignmentWizardFormState';
  return import(/* @vite-ignore */ modulePath);
}

/**
 * Dynamically imports the chrome-free review-content component.
 * Mirrors the existing dynamic-import pattern used by the wizard suites.
 *
 * @returns {Promise<Record<string, unknown>>} Imported module namespace.
 */
async function loadReviewContentModule(): Promise<Record<string, unknown>> {
  // Decided filename is AssignmentDefinitionWizardReviewContent.tsx (natural
  // extraction name, recorded in ACTION_PLAN.md).
  const modulePath = './AssignmentDefinitionWizardReviewContent';
  return import(/* @vite-ignore */ modulePath);
}

/**
 * Resolves the review-content component from its module.
 *
 * @returns {Promise<ComponentType<Record<string, unknown>>>} Review-content component.
 */
async function loadReviewContentComponent(): Promise<ComponentType<Record<string, unknown>>> {
  const reviewModule = await loadReviewContentModule();
  return reviewModule.AssignmentDefinitionWizardReviewContent as unknown as ComponentType<
    Record<string, unknown>
  >;
}

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
 * Builds stage-one content properties for the review-content component.
 * Follows the shell content contract: no parsed tasks, URL entry visible.
 *
 * @returns {Record<string, unknown>} Stage-one content properties.
 */
function buildStageOneContentProperties(): Record<string, unknown> {
  return {
    hasParsedTasks: false,
    taskRows: [],
    documentChange: {
      hasPendingChange: false,
      previousReferenceUrl: '',
      previousTemplateUrl: '',
    },
    topicOptions: [],
    yearGroupOptions: [],
    primaryActionLabel: 'Parse and continue',
    isPrimaryActionDisabled: false,
    isMutationBusy: false,
    onCancel: vi.fn(),
    onPrimaryAction: vi.fn(),
    onFormValuesChange: vi.fn(),
    onTaskWeightingChange: vi.fn(),
  };
}

/**
 * Builds stage-two content properties for the review-content component.
 * Seeds task rows from the canonical editable-definition view.
 *
 * @returns {Record<string, unknown>} Stage-two content properties.
 */
function buildStageTwoContentProperties(): Record<string, unknown> {
  return {
    hasParsedTasks: true,
    taskRows: buildSeedTaskRows(CANONICAL_EDITABLE_DEFINITION_SEED),
    documentChange: {
      hasPendingChange: false,
      previousReferenceUrl: '',
      previousTemplateUrl: '',
    },
    topicOptions: [],
    yearGroupOptions: [],
    primaryActionLabel: 'Save',
    isPrimaryActionDisabled: false,
    isMutationBusy: false,
    onCancel: vi.fn(),
    onPrimaryAction: vi.fn(),
    onFormValuesChange: vi.fn(),
    onTaskWeightingChange: vi.fn(),
  };
}

/**
 * Renders a dynamically loaded review-content component with a live Ant
 * Design form instance and the supplied content properties.
 *
 * @param {Readonly<{ component: ComponentType<Record<string, unknown>>; content: Record<string, unknown> }>} properties Harness properties.
 * @param {ComponentType<Record<string, unknown>>} properties.component Review-content component.
 * @param {Record<string, unknown>} properties.content Content properties.
 * @returns {JSX.Element} Review-content harness element.
 */
function ReviewContentHarness(properties: Readonly<{
  component: ComponentType<Record<string, unknown>>;
  content: Record<string, unknown>;
}>): JSX.Element {
  const [form] = Form.useForm();
  return createElement(properties.component, { ...properties.content, form });
}

describe('assignmentWizardFormState module', () => {
  it('exposes the extracted wizard form-state module', async () => {
    const formStateModule = await loadAssignmentWizardFormState();

    expect(formStateModule).toBeDefined();
  });

  it('exposes form-state derivation for the hook and the orchestrator', async () => {
    const formStateModule = await loadAssignmentWizardFormState();

    expect(Object.keys(formStateModule).length).toBeGreaterThan(0);
  });

  /**
   * Per-responsibility export pins for the `assignmentWizardFormState`
   * extraction. Names mirror the pure derivations in
   * `useAssignmentDefinitionWizard.ts`. Behavioural parity stays covered by the
   * moved hook suite; these assertions only pin the extraction surface.
   */
  it('exposes form-hydration derivations', async () => {
    const formStateModule = await loadAssignmentWizardFormState();

    expect(formStateModule).toHaveProperty('hydrateFormFromDefinition');
    expect(formStateModule).toHaveProperty('buildDocumentUrlsFromDefinition');
    expect(formStateModule).toHaveProperty('applyFormInitialValues');
  });

  it('exposes dirty-state derivations', async () => {
    const formStateModule = await loadAssignmentWizardFormState();

    expect(formStateModule).toHaveProperty('calculateDirtyState');
    expect(formStateModule).toHaveProperty('hasCreateModeDirtyEdits');
    expect(formStateModule).toHaveProperty('hasUpdateModeDirtyEdits');
  });

  it('exposes document-change derivation', async () => {
    const formStateModule = await loadAssignmentWizardFormState();

    expect(formStateModule).toHaveProperty('detectDocumentChange');
  });

  it('exposes task-row derivation', async () => {
    const formStateModule = await loadAssignmentWizardFormState();

    expect(formStateModule).toHaveProperty('buildTaskRowsFromResponse');
  });
});

describe('AssignmentDefinitionWizardReviewContent', () => {
  it('renders stage one URL entry when no tasks have been parsed', async () => {
    const ReviewContent = await loadReviewContentComponent();
    render(
      createElement(ReviewContentHarness, {
        component: ReviewContent,
        content: buildStageOneContentProperties(),
      })
    );

    expect(screen.getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /template document url/i })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /task weightings/i })).not.toBeInTheDocument();
  });

  it('renders stage two metadata and task rows from the canonical seed', async () => {
    const ReviewContent = await loadReviewContentComponent();
    render(
      createElement(ReviewContentHarness, {
        component: ReviewContent,
        content: buildStageTwoContentProperties(),
      })
    );

    expect(screen.getByRole('table', { name: /task weightings/i })).toBeInTheDocument();
    expect(screen.getByText(SEED_FIRST_TASK_TITLE)).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: /assignment weighting/i })
    ).toBeInTheDocument();
  });

  it('renders chrome-free without Ant Design modal chrome', async () => {
    const ReviewContent = await loadReviewContentComponent();
    render(
      createElement(ReviewContentHarness, {
        component: ReviewContent,
        content: buildStageTwoContentProperties(),
      })
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.ant-modal')).toBeNull();
  });
});

describe('AssignmentDefinitionWizardReviewContent presentation hygiene', () => {
  it('exposes an explicit alert-visibility contract instead of the optional-prop sentinel', async () => {
    const reviewModule = await loadReviewContentModule();

    expect(reviewModule).toHaveProperty('AssignmentDefinitionWizardReviewContent');
    const source = reviewContentSourceRaw as unknown as string;

    expect(source).toContain('showAlerts');
    expect(source).not.toContain('hasParsedTasks !== undefined');
  });

  it('derives the primary-action label from the single shared derivation', async () => {
    const source = reviewContentSourceRaw as unknown as string;

    expect(source).toContain('derivePrimaryActionState');
    expect(source).not.toMatch(/hasParsedTasks \? 'Save' : 'Parse and continue'/);
  });

  it('spaces alerts, rows, and actions with canonical spacing constants', () => {
    const source = reviewContentSourceRaw as unknown as string;

    expect(source).toContain('APP_GAP_MD');
    expect(source).toContain('APP_SPACE_SIZE');
    expect(source).not.toContain('marginBottom: 16');
    expect(source).not.toContain('gap: 16');
    expect(source).not.toContain('marginTop: 8');
  });
});
