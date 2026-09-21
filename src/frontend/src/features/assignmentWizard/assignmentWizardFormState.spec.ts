import { type FormInstance } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import type { AssignmentDefinition } from '../../services/assignmentDefinition/assignmentDefinition.zod';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';
import formStateSourceRaw from './assignmentWizardFormState.ts?raw';
import {
  applyFormInitialValues,
  buildDocumentUrlsFromDefinition,
  buildTaskRowsFromResponse,
  calculateDirtyState,
  detectDocumentChange,
  hasCreateModeDirtyEdits,
  hasUpdateModeDirtyEdits,
  hydrateFormFromDefinition,
  type ParsedCreateBaseline,
  type TaskRow,
} from './assignmentWizardFormState';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture instead of a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical `definition-0-slides` record exercised as the form-state seed. */
const CANONICAL_EDITABLE_DEFINITION_SEED: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

const CANONICAL_REFERENCE_URL = 'https://docs.google.com/presentation/d/reference-document-0/edit';
const CANONICAL_TEMPLATE_URL = 'https://docs.google.com/presentation/d/template-document-0/edit';

/**
 * Creates a mock Ant Design form instance capturing `setFieldsValue` calls.
 *
 * @returns {{ form: FormInstance; setFieldsValue: ReturnType<typeof vi.fn> }} Mock form and spy.
 */
function createMockForm(): { form: FormInstance; setFieldsValue: ReturnType<typeof vi.fn> } {
  const setFieldsValue = vi.fn();
  const form = { setFieldsValue } as unknown as FormInstance;
  return { form, setFieldsValue };
}

/**
 * Builds a parsed-create baseline matching the canonical seed.
 *
 * @returns {ParsedCreateBaseline} Baseline for create-mode dirty-state tests.
 */
function buildSeedBaseline(): ParsedCreateBaseline {
  return {
    title: CANONICAL_EDITABLE_DEFINITION_SEED.primaryTitle,
    topic: CANONICAL_EDITABLE_DEFINITION_SEED.primaryTopicKey,
    yearGroup: CANONICAL_EDITABLE_DEFINITION_SEED.yearGroupKey,
    referenceDocumentUrl: CANONICAL_REFERENCE_URL,
    templateDocumentUrl: CANONICAL_TEMPLATE_URL,
    referenceDocumentId: CANONICAL_EDITABLE_DEFINITION_SEED.referenceDocumentId,
    templateDocumentId: CANONICAL_EDITABLE_DEFINITION_SEED.templateDocumentId,
    documentType: CANONICAL_EDITABLE_DEFINITION_SEED.documentType,
    assignmentWeighting: CANONICAL_EDITABLE_DEFINITION_SEED.assignmentWeighting,
    taskWeightings: new Map(
      CANONICAL_EDITABLE_DEFINITION_SEED.tasks.map((task) => [task.taskId, task.taskWeighting])
    ),
  };
}

/**
 * Builds form values matching the canonical seed baseline.
 *
 * @returns {Record<string, unknown>} Clean form values.
 */
function buildSeedFormValues(): Record<string, unknown> {
  return {
    title: CANONICAL_EDITABLE_DEFINITION_SEED.primaryTitle,
    topic: CANONICAL_EDITABLE_DEFINITION_SEED.primaryTopicKey,
    yearGroup: CANONICAL_EDITABLE_DEFINITION_SEED.yearGroupKey,
    referenceDocumentUrl: CANONICAL_REFERENCE_URL,
    templateDocumentUrl: CANONICAL_TEMPLATE_URL,
    assignmentWeighting: CANONICAL_EDITABLE_DEFINITION_SEED.assignmentWeighting,
  };
}

/**
 * Builds task rows matching the canonical seed tasks.
 *
 * @returns {TaskRow[]} Seed task rows.
 */
function buildSeedTaskRows(): TaskRow[] {
  return CANONICAL_EDITABLE_DEFINITION_SEED.tasks.map((task) => ({
    key: task.taskId,
    taskId: task.taskId,
    taskTitle: task.taskTitle,
    taskWeighting: task.taskWeighting,
  }));
}

describe('buildDocumentUrlsFromDefinition', () => {
  it('builds canonical presentation URLs for a SLIDES definition', () => {
    const urls = buildDocumentUrlsFromDefinition({
      ...CANONICAL_EDITABLE_DEFINITION_SEED,
    });

    expect(urls).toEqual({
      referenceUrl: CANONICAL_REFERENCE_URL,
      templateUrl: CANONICAL_TEMPLATE_URL,
    });
  });

  it('builds canonical spreadsheet URLs for a SHEETS definition', () => {
    const urls = buildDocumentUrlsFromDefinition({
      documentType: 'SHEETS',
      referenceDocumentId: 'ref-sheet',
      templateDocumentId: 'tpl-sheet',
    });

    expect(urls).toEqual({
      referenceUrl: 'https://docs.google.com/spreadsheets/d/ref-sheet/edit',
      templateUrl: 'https://docs.google.com/spreadsheets/d/tpl-sheet/edit',
    });
  });

  it('returns null when document identifiers are missing', () => {
    expect(buildDocumentUrlsFromDefinition({ documentType: 'SLIDES' })).toBeNull();
    expect(buildDocumentUrlsFromDefinition({})).toBeNull();
  });
});

describe('hydrateFormFromDefinition', () => {
  it('populates form fields, task rows, and document change state from the definition', () => {
    const { form, setFieldsValue } = createMockForm();
    const setTaskRows = vi.fn();
    const setHasParsedTasks = vi.fn();
    const setDocumentChange = vi.fn();

    hydrateFormFromDefinition(
      form,
      CANONICAL_EDITABLE_DEFINITION_SEED,
      setTaskRows,
      setHasParsedTasks,
      setDocumentChange
    );

    expect(setFieldsValue).toHaveBeenCalledWith({
      title: CANONICAL_EDITABLE_DEFINITION_SEED.primaryTitle,
      topic: CANONICAL_EDITABLE_DEFINITION_SEED.primaryTopicKey,
      yearGroup: CANONICAL_EDITABLE_DEFINITION_SEED.yearGroupKey,
      referenceDocumentUrl: CANONICAL_REFERENCE_URL,
      templateDocumentUrl: CANONICAL_TEMPLATE_URL,
      assignmentWeighting: CANONICAL_EDITABLE_DEFINITION_SEED.assignmentWeighting,
    });
    expect(setTaskRows).toHaveBeenCalledWith(buildSeedTaskRows());
    expect(setHasParsedTasks).toHaveBeenCalledWith(true);
    expect(setDocumentChange).toHaveBeenCalledWith({
      hasPendingChange: false,
      previousReferenceUrl: CANONICAL_REFERENCE_URL,
      previousTemplateUrl: CANONICAL_TEMPLATE_URL,
    });
  });
});

describe('applyFormInitialValues', () => {
  it('applies provided values to the form and synchronises selection keys', () => {
    const { form, setFieldsValue } = createMockForm();
    const setSelectedTopicKey = vi.fn();
    const setSelectedYearGroupKey = vi.fn();

    applyFormInitialValues(
      form,
      { title: 'Pre-filled', topic: 'topic-0', yearGroup: 'year-group-7' },
      setSelectedTopicKey,
      setSelectedYearGroupKey
    );

    expect(setFieldsValue).toHaveBeenCalledWith({
      title: 'Pre-filled',
      topic: 'topic-0',
      yearGroup: 'year-group-7',
    });
    expect(setSelectedTopicKey).toHaveBeenCalledWith('topic-0');
    expect(setSelectedYearGroupKey).toHaveBeenCalledWith('year-group-7');
  });

  it('converts empty-string selections to undefined for SelectWithAddNew compatibility', () => {
    const { form, setFieldsValue } = createMockForm();
    const setSelectedTopicKey = vi.fn();
    const setSelectedYearGroupKey = vi.fn();

    applyFormInitialValues(
      form,
      { title: 'Only title', topic: '', yearGroup: '' },
      setSelectedTopicKey,
      setSelectedYearGroupKey
    );

    expect(setFieldsValue).toHaveBeenCalledWith({
      title: 'Only title',
      topic: '',
      yearGroup: '',
    });
    expect(setSelectedTopicKey).toHaveBeenCalledWith(undefined);
    expect(setSelectedYearGroupKey).toHaveBeenCalledWith(undefined);
  });
});

describe('calculateDirtyState', () => {
  it('returns false in create mode before tasks have been parsed', () => {
    expect(
      calculateDirtyState(buildSeedFormValues(), buildSeedBaseline(), null, [], true, false)
    ).toBe(false);
  });

  it('returns false in create mode when values match the parsed baseline', () => {
    expect(
      calculateDirtyState(
        buildSeedFormValues(),
        buildSeedBaseline(),
        null,
        buildSeedTaskRows(),
        true,
        true
      )
    ).toBe(false);
  });

  it('returns true in create mode when the title differs from the baseline', () => {
    expect(
      calculateDirtyState(
        { ...buildSeedFormValues(), title: 'Edited title' },
        buildSeedBaseline(),
        null,
        buildSeedTaskRows(),
        true,
        true
      )
    ).toBe(true);
  });

  it('returns false in update mode when values match the definition', () => {
    expect(
      calculateDirtyState(
        buildSeedFormValues(),
        null,
        { ...CANONICAL_EDITABLE_DEFINITION_SEED },
        buildSeedTaskRows(),
        false,
        true
      )
    ).toBe(false);
  });

  it('returns true in update mode when a task weighting differs', () => {
    const firstTaskId = CANONICAL_EDITABLE_DEFINITION_SEED.tasks[0].taskId;
    const editedRows = buildSeedTaskRows().map((row) =>
      row.taskId === firstTaskId ? { ...row, taskWeighting: 3 } : row
    );

    expect(
      calculateDirtyState(
        buildSeedFormValues(),
        null,
        { ...CANONICAL_EDITABLE_DEFINITION_SEED },
        editedRows,
        false,
        true
      )
    ).toBe(true);
  });

  it('returns false in update mode without a definition', () => {
    expect(calculateDirtyState(buildSeedFormValues(), null, null, [], false, true)).toBe(false);
  });
});

describe('hasCreateModeDirtyEdits', () => {
  it('returns false for clean values and preserves the default weighting fallback', () => {
    const values = buildSeedFormValues();
    delete values.assignmentWeighting;

    expect(hasCreateModeDirtyEdits(values, buildSeedBaseline(), buildSeedTaskRows())).toBe(false);
  });

  it('returns true when a task weighting differs from the baseline', () => {
    const firstTaskId = CANONICAL_EDITABLE_DEFINITION_SEED.tasks[0].taskId;
    const editedRows = buildSeedTaskRows().map((row) =>
      row.taskId === firstTaskId ? { ...row, taskWeighting: 2 } : row
    );

    expect(hasCreateModeDirtyEdits(buildSeedFormValues(), buildSeedBaseline(), editedRows)).toBe(
      true
    );
  });
});

describe('hasUpdateModeDirtyEdits', () => {
  it('returns false when values and weightings match the definition', () => {
    expect(
      hasUpdateModeDirtyEdits(
        buildSeedFormValues(),
        { ...CANONICAL_EDITABLE_DEFINITION_SEED },
        buildSeedTaskRows()
      )
    ).toBe(false);
  });

  it('preserves valid zero weightings without reporting dirty edits', () => {
    const [firstTask, secondTask] = CANONICAL_EDITABLE_DEFINITION_SEED.tasks;
    const definition = {
      ...CANONICAL_EDITABLE_DEFINITION_SEED,
      tasks: [{ ...firstTask, taskWeighting: 0 }, { ...secondTask }],
    };
    const rows: TaskRow[] = [
      {
        key: firstTask.taskId,
        taskId: firstTask.taskId,
        taskTitle: firstTask.taskTitle,
        taskWeighting: 0,
      },
      {
        key: secondTask.taskId,
        taskId: secondTask.taskId,
        taskTitle: secondTask.taskTitle,
        taskWeighting: secondTask.taskWeighting,
      },
    ];

    expect(hasUpdateModeDirtyEdits(buildSeedFormValues(), definition, rows)).toBe(false);
  });

  it('returns false when the definition has no task array', () => {
    const definition = { ...CANONICAL_EDITABLE_DEFINITION_SEED, tasks: 'not-an-array' };

    expect(hasUpdateModeDirtyEdits(buildSeedFormValues(), definition, buildSeedTaskRows())).toBe(
      false
    );
  });
});

describe('detectDocumentChange', () => {
  it('flags a pending change when the reference URL differs', () => {
    const state = detectDocumentChange(
      { referenceDocumentUrl: 'https://docs.google.com/presentation/d/other/edit' },
      { referenceUrl: CANONICAL_REFERENCE_URL, templateUrl: CANONICAL_TEMPLATE_URL },
      false
    );

    expect(state).toEqual({
      hasPendingChange: true,
      previousReferenceUrl: CANONICAL_REFERENCE_URL,
      previousTemplateUrl: CANONICAL_TEMPLATE_URL,
    });
  });

  it('clears a pending change when the URLs match again', () => {
    const state = detectDocumentChange(
      {
        referenceDocumentUrl: CANONICAL_REFERENCE_URL,
        templateDocumentUrl: CANONICAL_TEMPLATE_URL,
      },
      { referenceUrl: CANONICAL_REFERENCE_URL, templateUrl: CANONICAL_TEMPLATE_URL },
      true
    );

    expect(state).toEqual({
      hasPendingChange: false,
      previousReferenceUrl: CANONICAL_REFERENCE_URL,
      previousTemplateUrl: CANONICAL_TEMPLATE_URL,
    });
  });

  it('stays clean when URLs match and no change is pending', () => {
    const state = detectDocumentChange(
      {
        referenceDocumentUrl: CANONICAL_REFERENCE_URL,
        templateDocumentUrl: CANONICAL_TEMPLATE_URL,
      },
      { referenceUrl: CANONICAL_REFERENCE_URL, templateUrl: CANONICAL_TEMPLATE_URL },
      false
    );

    expect(state.hasPendingChange).toBe(false);
  });
});

describe('buildTaskRowsFromResponse', () => {
  it('maps response tasks to rows on parse without preserving weightings', () => {
    const [firstTask] = CANONICAL_EDITABLE_DEFINITION_SEED.tasks;
    const rows = buildTaskRowsFromResponse(
      [
        { taskId: firstTask.taskId, taskTitle: firstTask.taskTitle, taskWeighting: 2 },
        { taskId: 'task-new', taskTitle: 'New task', taskWeighting: 1 },
      ],
      buildSeedTaskRows(),
      'parse'
    );

    expect(rows).toEqual([
      {
        key: firstTask.taskId,
        taskId: firstTask.taskId,
        taskTitle: firstTask.taskTitle,
        taskWeighting: 2,
      },
      { key: 'task-new', taskId: 'task-new', taskTitle: 'New task', taskWeighting: 1 },
    ]);
  });

  it('preserves existing weightings for matching tasks on re-parse', () => {
    const [firstTask] = CANONICAL_EDITABLE_DEFINITION_SEED.tasks;
    const existing: TaskRow[] = [
      { key: firstTask.taskId, taskId: firstTask.taskId, taskTitle: 'Old title', taskWeighting: 3 },
    ];

    const rows = buildTaskRowsFromResponse(
      [
        { taskId: firstTask.taskId, taskTitle: 'Updated title', taskWeighting: 1 },
        { taskId: 'task-new', taskTitle: 'New task', taskWeighting: 1 },
      ],
      existing,
      'reparse'
    );

    expect(rows).toEqual([
      {
        key: firstTask.taskId,
        taskId: firstTask.taskId,
        taskTitle: 'Updated title',
        taskWeighting: 3,
      },
      { key: 'task-new', taskId: 'task-new', taskTitle: 'New task', taskWeighting: 1 },
    ]);
  });
});

describe('assignment wizard presentation hygiene', () => {
  it('derives reference-data state without the unused trust field', async () => {
    const formStateModule = await import('./assignmentWizardFormState');
    const deriveReferenceDataState = formStateModule.deriveReferenceDataState as unknown as (
      warmup: {
        isDatasetReady: (datasetKey: string) => boolean;
        isDatasetFailed: (datasetKey: string) => boolean;
      },
      isTopicsLoading: boolean,
      isYearGroupsLoading: boolean,
      open: boolean
    ) => Record<string, unknown>;

    const state = deriveReferenceDataState(
      { isDatasetReady: () => true, isDatasetFailed: () => false },
      false,
      false,
      true
    );

    expect(state).not.toHaveProperty('hasTrustworthyReferenceData');
    expect(state).toHaveProperty('isReferenceDataLoading');
    expect(state).toHaveProperty('isReferenceDataBlocked');
  });

  it('exposes a shared assignment-weighting coercion helper for active callers', async () => {
    const formStateModule = await import('./assignmentWizardFormState');

    expect(formStateModule).toHaveProperty('coerceAssignmentWeighting');
  });

  it('spells cancellation with British English in restoration documentation', () => {
    expect(formStateSourceRaw).toContain('cancelling');
    expect(formStateSourceRaw).not.toContain('canceling');
  });
});
