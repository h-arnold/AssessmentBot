import { describe, it, expect } from 'vitest';

// RED PHASE (issue #301, Section 1): failing tests for the task-equivalence comparator.
// The module under test does not exist yet, so this suite fails at import time.
//
// Contract decision: compareTaskEquivalence(previousTask, reparsedTask) returns
// `{ equivalent: boolean, reason: string }`, consumed by
// AssignmentDefinitionUpsertOrchestrator._resolveTaskState as:
//   equivalent true  -> preserve the stored weighting, including valid zeroes;
//   equivalent false -> fall back to the TaskDefinition constructor default of 1;
//   no previous task -> treated as new by the orchestrator without calling here.
// Reason codes: 'equivalent' | 'task-id-changed' | 'page-id-changed' |
// 'title-changed' | 'notes-changed' | 'task-metadata-changed' | 'artefact-changed'.
// Precedence when several fields differ: task id, page id, title, notes,
// task metadata, then artefact collections. Artefact collections cover type,
// role, source document/page identity, content and assessment-relevant metadata;
// any count, order or content difference reports 'artefact-changed'.
// The module must export the named function through a guarded
// `module.exports = { compareTaskEquivalence };` block.
// Weighting preservation itself lives in the orchestrator and weighting helper;
// these tests pin the equivalence decision that drives it, including the rule
// that differing weightings never flip the decision.
const {
  compareTaskEquivalence,
} = require('../../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js');

// Local boundary fixtures shaped like TaskDefinition.toJSON() output with
// BaseTaskArtifact.toJSON() artefacts. Per the recorded policy deviation these
// stay local; no synthetic fixtures are imported.
function buildReferenceArtefact(overrides = {}) {
  return {
    taskId: 't_task_one',
    role: 'reference',
    pageId: 'slide_ref_1',
    documentId: 'reference-doc-id',
    content: 'Reference content for task one.',
    contentHash: 'hash-reference-one',
    metadata: { skill: 'analysis', level: 'high' },
    uid: 't_task_one-0-reference-slide_ref_1-0',
    type: 'TEXT',
    ...overrides,
  };
}

function buildSecondReferenceArtefact(overrides = {}) {
  return {
    taskId: 't_task_one',
    role: 'reference',
    pageId: 'slide_ref_2',
    documentId: 'reference-doc-id',
    content: 'Second reference extract.',
    contentHash: 'hash-reference-two',
    metadata: { skill: 'recall' },
    uid: 't_task_one-0-reference-slide_ref_2-1',
    type: 'TEXT',
    ...overrides,
  };
}

function buildTemplateArtefact(overrides = {}) {
  return {
    taskId: 't_task_one',
    role: 'template',
    pageId: 'slide_tpl_1',
    documentId: 'template-doc-id',
    content: 'Template content for task one.',
    contentHash: 'hash-template-one',
    metadata: { skill: 'analysis' },
    uid: 't_task_one-0-template-slide_tpl_1-0',
    type: 'TEXT',
    ...overrides,
  };
}

function buildTask(overrides = {}) {
  return {
    id: 't_task_one',
    taskTitle: 'Task One',
    pageId: 'slide_ref_1',
    taskNotes: 'Notes for task one.',
    taskMetadata: { sheetName: 'Task One', bbox: { startRow: 1, numRows: 4 } },
    taskWeighting: 2,
    index: 0,
    artifacts: {
      reference: [buildReferenceArtefact()],
      template: [buildTemplateArtefact()],
    },
    ...overrides,
  };
}

function cloneTask(task) {
  return JSON.parse(JSON.stringify(task));
}

describe('compareTaskEquivalence unchanged content', () => {
  it('returns equivalent for identical parsed content', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: true,
      reason: 'equivalent',
    });
  });

  it('returns equivalent when only the stored weighting differs', () => {
    const previousTask = buildTask({ taskWeighting: 3 });
    const reparsedTask = buildTask({ taskWeighting: 1 });
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('returns equivalent when the stored weighting is a valid zero', () => {
    const previousTask = buildTask({ taskWeighting: 0 });
    const reparsedTask = buildTask({ taskWeighting: 1 });
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });
});

describe('compareTaskEquivalence changed assessment content', () => {
  it('reports changed when the title changes', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({ taskTitle: 'Task One Revised' });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'title-changed',
    });
  });

  it('reports changed when the notes change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({ taskNotes: 'Different notes.' });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'notes-changed',
    });
  });

  it('reports changed when the task metadata changes', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      taskMetadata: { sheetName: 'Task One', bbox: { startRow: 2, numRows: 4 } },
    });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'task-metadata-changed',
    });
  });

  it('reports changed when artefact order changes', () => {
    const previousTask = buildTask();
    previousTask.artifacts.reference.push(buildSecondReferenceArtefact());
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference = [
      cloneTask(buildSecondReferenceArtefact()),
      cloneTask(buildReferenceArtefact()),
    ];
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });

  it('reports changed when artefact content changes', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].content = 'Edited reference content.';
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });

  it('reports changed when artefact assessment metadata changes', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].metadata = { skill: 'recall', level: 'low' };
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });

  it('reports changed when artefact type changes', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].type = 'TABLE';
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });
});

describe('compareTaskEquivalence key order and array order', () => {
  it('returns equivalent when task metadata keys are reordered', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      taskMetadata: { bbox: { numRows: 4, startRow: 1 }, sheetName: 'Task One' },
    });
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('returns equivalent when artefact metadata keys are reordered', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].metadata = { level: 'high', skill: 'analysis' };
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('reports changed when reference artefacts are reordered', () => {
    const previousTask = buildTask();
    previousTask.artifacts.reference.push(buildSecondReferenceArtefact());
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference = reparsedTask.artifacts.reference.reverse();
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });

  it('reports changed when template artefacts are reordered', () => {
    const previousTask = buildTask();
    previousTask.artifacts.template.push(buildTemplateArtefact({ content: 'Extra template.' }));
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.template = reparsedTask.artifacts.template.reverse();
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });
});

describe('compareTaskEquivalence parser-volatile exclusions', () => {
  it('ignores taskWeighting differences', () => {
    const previousTask = buildTask({ taskWeighting: 4 });
    const reparsedTask = buildTask({ taskWeighting: 7 });
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('ignores derived contentHash differences', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].contentHash = 'recomputed-hash-ref';
    reparsedTask.artifacts.template[0].contentHash = 'recomputed-hash-tpl';
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('ignores regenerated artefact uid differences', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].uid = 'regenerated-uid-ref';
    reparsedTask.artifacts.template[0].uid = 'regenerated-uid-tpl';
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('ignores positional index differences', () => {
    const previousTask = buildTask({ index: 0 });
    const reparsedTask = buildTask({ index: 5 });
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('ignores taskIndex bookkeeping wherever carried', () => {
    const previousTask = buildTask({ taskIndex: 0 });
    previousTask.artifacts.reference[0].taskIndex = 0;
    const reparsedTask = buildTask({ taskIndex: 5 });
    reparsedTask.artifacts.reference[0].taskIndex = 5;
    reparsedTask.artifacts.template[0].taskIndex = 5;
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });

  it('ignores artifactIndex bookkeeping wherever carried', () => {
    const previousTask = buildTask();
    previousTask.artifacts.reference[0].artifactIndex = 0;
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].artifactIndex = 3;
    reparsedTask.artifacts.template[0].artifactIndex = 2;
    const result = compareTaskEquivalence(previousTask, reparsedTask);
    expect(result.equivalent).toBe(true);
    expect(result.reason).toBe('equivalent');
  });
});

describe('compareTaskEquivalence reason precedence', () => {
  it('prefers task id over title when both change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      id: 't_task_one_renamed',
      taskTitle: 'Task One Revised',
    });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'task-id-changed',
    });
  });

  it('prefers task id over page id when both change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      id: 't_task_one_renamed',
      pageId: 'slide_ref_9',
    });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'task-id-changed',
    });
  });

  it('prefers page id over title when both change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      pageId: 'slide_ref_9',
      taskTitle: 'Task One Revised',
    });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'page-id-changed',
    });
  });

  it('prefers title over notes when both change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      taskTitle: 'Task One Revised',
      taskNotes: 'Different notes.',
    });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'title-changed',
    });
  });

  it('prefers notes over task metadata when both change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      taskNotes: 'Different notes.',
      taskMetadata: { sheetName: 'Task One', bbox: { startRow: 2, numRows: 4 } },
    });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'notes-changed',
    });
  });

  it('prefers task metadata over artefacts when both change', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({
      taskMetadata: { sheetName: 'Task One', bbox: { startRow: 2, numRows: 4 } },
    });
    reparsedTask.artifacts.reference[0].content = 'Edited reference content.';
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'task-metadata-changed',
    });
  });
});

describe('compareTaskEquivalence identity without fuzzy matching', () => {
  it('reports changed when the task id changes', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({ id: 't_task_one_renamed' });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'task-id-changed',
    });
  });

  it('reports changed when the task page id changes', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({ pageId: 'slide_ref_9' });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'page-id-changed',
    });
  });

  it('reports changed when an artefact page id changes', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].pageId = 'slide_ref_9';
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });

  it('reports changed when an artefact document id changes', () => {
    const previousTask = buildTask();
    const reparsedTask = cloneTask(previousTask);
    reparsedTask.artifacts.reference[0].documentId = 'moved-doc-id';
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'artefact-changed',
    });
  });

  it('reports changed for near-identical titles with no fuzzy matching', () => {
    const previousTask = buildTask();
    const reparsedTask = buildTask({ taskTitle: 'Task One!' });
    expect(compareTaskEquivalence(previousTask, reparsedTask)).toEqual({
      equivalent: false,
      reason: 'title-changed',
    });
  });
});
