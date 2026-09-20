import { describe, it, expect } from 'vitest';

// Persisted-JSON/model-instance representation boundary (issue #301): persistence
// returns raw TaskDefinition.toJSON() output while parsing returns live
// TaskDefinition instances, so unchanged artefact-bearing tasks must compare
// equivalent across that boundary. Only the canonical artefact fields (taskId,
// role, pageId, documentId, content, metadata, type) participate; runtime-only
// state (contentHash, uid/_uid, taskIndex, artifactIndex and live-instance
// internals such as TableTaskArtifact _rows) never flips the decision.
const {
  compareTaskEquivalence,
} = require('../../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js');
const { TaskDefinition } = require('../../src/backend/Models/TaskDefinition.js');

// Local boundary fixtures shaped like TaskDefinition.toJSON() output. Boundary
// cases stay local under the canonical-fixture policy, so no synthetic fixtures
// are imported.
function buildPersistedArtefactJson(overrides = {}) {
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

function buildPersistedTaskJson(overrides = {}) {
  return {
    id: 't_task_one',
    taskTitle: 'Task One',
    pageId: 'slide_ref_1',
    taskNotes: 'Notes for task one.',
    taskMetadata: { sheetName: 'Task One', bbox: { startRow: 1, numRows: 4 } },
    taskWeighting: 2,
    index: 0,
    artifacts: {
      reference: [buildPersistedArtefactJson()],
      template: [
        buildPersistedArtefactJson({
          role: 'template',
          pageId: 'slide_tpl_1',
          documentId: 'template-doc-id',
          content: 'Template content for task one.',
          contentHash: 'hash-template-one',
          metadata: { skill: 'analysis' },
          uid: 't_task_one-0-template-slide_tpl_1-0',
        }),
      ],
    },
    ...overrides,
  };
}

function rehydrateModelTask(persistedJson) {
  return TaskDefinition.fromJSON(JSON.parse(JSON.stringify(persistedJson)));
}

describe('compareTaskEquivalence persisted JSON versus rehydrated model instances', () => {
  it('returns equivalent for persisted TEXT artefact JSON versus a rehydrated model instance', () => {
    const persistedTask = buildPersistedTaskJson();
    const rehydratedTask = rehydrateModelTask(persistedTask);
    const result = compareTaskEquivalence(persistedTask, rehydratedTask);
    expect(result).toEqual({ equivalent: true, reason: 'equivalent' });
  });

  it('returns equivalent when the persisted and rehydrated order is reversed', () => {
    const persistedTask = buildPersistedTaskJson();
    const rehydratedTask = rehydrateModelTask(persistedTask);
    const result = compareTaskEquivalence(rehydratedTask, persistedTask);
    expect(result).toEqual({ equivalent: true, reason: 'equivalent' });
  });

  it('returns equivalent for TABLE artefacts carrying live _rows internals', () => {
    const persistedTask = buildPersistedTaskJson();
    persistedTask.artifacts.reference[0] = buildPersistedArtefactJson({
      content: '| Name | Score |\n| --- | --- |\n| Alice | 10 |',
      contentHash: 'hash-table-one',
      metadata: {},
      uid: 't_task_one-0-reference-slide_ref_1-0',
      type: 'TABLE',
    });
    const rehydratedTask = rehydrateModelTask(persistedTask);
    expect(rehydratedTask.artifacts.reference[0].getType()).toBe('TABLE');
    const result = compareTaskEquivalence(persistedTask, rehydratedTask);
    expect(result).toEqual({ equivalent: true, reason: 'equivalent' });
  });

  it('reports changed when rehydrated content differs from persisted JSON', () => {
    const persistedTask = buildPersistedTaskJson();
    const rehydratedTask = rehydrateModelTask(persistedTask);
    rehydratedTask.artifacts.reference[0].content = 'Edited reference content.';
    const result = compareTaskEquivalence(persistedTask, rehydratedTask);
    expect(result).toEqual({ equivalent: false, reason: 'artefact-changed' });
  });
});
