import { afterEach, describe, expect, it, vi } from 'vitest';
const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');
const { StudentSubmissionItem } = require('#backend/Models/StudentSubmission/index.js');
const SpreadsheetTaskArtifact = require('#backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js');
const { TaskDefinition } = require('#backend/Models/TaskDefinition.js');
import {
  HEAD_TASK_ID,
  SIBLING_TASK_ID,
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
  expectCorruptRecordPlaceholder,
  expectSiblingIntact,
  storedItemJson,
} from './assignmentRehydrationCurrentSupport.js';

afterEach(() => vi.restoreAllMocks());
const markdown = '| Name | Mark |\n| --- | --- |\n| Ada | 4 |';

describe('CURRENT full task dual identity', () => {
  it.each([true, false])(
    'rejects conflicting canonical id with %s populated submissions before construction',
    (populated) => {
      const record = currentAssignmentJson();
      const task = record.assignmentDefinition.tasks[HEAD_TASK_ID];
      task.taskId = HEAD_TASK_ID;
      task.id = 'foreign-task';
      if (!populated) record.submissions = [];
      expect(Object.keys(record.assignmentDefinition.tasks)).toContain(HEAD_TASK_ID);
      expect(task.taskId).toBe(HEAD_TASK_ID);
      expect(task.id).not.toBe(task.taskId);
      expect(record.submissions.length > 0).toBe(populated);
      expect(typeof TaskDefinition.fromJSON).toBe('function');
      const construct = vi.spyOn(TaskDefinition, 'fromJSON');
      expect(() => restoreAssignment(record)).toThrow();
      expect(construct).not.toHaveBeenCalled();
    }
  );

  it('accepts canonical id and a matching optional taskId', () => {
    const record = currentAssignmentJson();
    const task = record.assignmentDefinition.tasks[HEAD_TASK_ID];
    task.taskId = task.id;
    expect(Object.keys(record.assignmentDefinition.tasks)).toContain(HEAD_TASK_ID);
    expect(task.id).toBe(HEAD_TASK_ID);
    expect(task.taskId).toBe(HEAD_TASK_ID);
    expect(() => restoreAssignment(record)).not.toThrow();
  });
});

function setTable(record, taskId, role) {
  const item = record.submissions[0].items[taskId];
  item.artifact = {
    ...item.artifact,
    type: 'TABLE',
    role,
    content: markdown,
    contentHash: Utils.generateHash(markdown),
  };
  return item;
}

describe('CURRENT supported TABLE artefacts', () => {
  it.each(['full', 'partial', 'model input'])(
    'preserves a healthy TABLE in %s restoration',
    (mode) => {
      const source = currentAssignmentJson();
      if (mode === 'partial') {
        const partial = rawPartialEmbeddedSnapshot(source);
        const artifact = partial.submissions[0].items[HEAD_TASK_ID].artifact;
        artifact.type = 'TABLE';
        artifact.content = null;
        artifact.contentHash = null;
        const expectedAssessments = structuredClone(
          partial.submissions[0].items[HEAD_TASK_ID].assessments
        );
        const sibling = storedItemJson(partial, 0, SIBLING_TASK_ID);
        const restored = restoreAssignment(partial, 'partial');
        const result = restored.submissions[0].items[HEAD_TASK_ID];
        expect(result.artifact.getType()).toBe('TABLE');
        expect(result.artifact.content).toBeNull();
        expect(result.artifact.contentHash).toBeNull();
        expect(result.assessments).toEqual(expectedAssessments);
        expectSiblingIntact(restored.submissions[0], sibling);
        return;
      }
      const record = source;
      const tableItem = setTable(record, HEAD_TASK_ID, 'submission');
      const raw = structuredClone(tableItem);
      const sibling = storedItemJson(record, 0, SIBLING_TASK_ID);
      const restored =
        mode === 'model input'
          ? (() => {
              const materialised = restoreAssignment(record);
              record.submissions[0].items = materialised.submissions[0].items;
              return Assignment.fromJSON(record);
            })()
          : restoreAssignment(record);
      const result = restored.submissions[0].items[HEAD_TASK_ID];
      expect(raw.artifact.type).toBe('TABLE');
      expect(result.artifact.getType()).toBe('TABLE');
      expect(result.artifact.content).toBe(markdown);
      expect(result.assessments).toEqual(raw.assessments);
      expectSiblingIntact(restored.submissions[0], sibling);
    }
  );

  it('rejects malformed TABLE bodies before invoking the item constructor and corrupts all criteria', () => {
    const record = currentAssignmentJson();
    const malformedItem = setTable(record, HEAD_TASK_ID, 'submission');
    malformedItem.artifact.content = { malformed: true };
    const sibling = storedItemJson(record, 0, SIBLING_TASK_ID);
    const construct = vi.spyOn(StudentSubmissionItem, 'fromJSON');
    const restored = restoreAssignment(record);
    expectCorruptRecordPlaceholder(restored.submissions[0].items[HEAD_TASK_ID]);
    expect(construct.mock.calls.some(([raw]) => raw === malformedItem)).toBe(false);
    expectSiblingIntact(restored.submissions[0], sibling);
  });
});

describe('CURRENT blank spreadsheet preservation', () => {
  it('preserves an empty student grid with its actual hash and unchanged sibling', () => {
    const record = currentAssignmentJson();
    const item = record.submissions[0].items[HEAD_TASK_ID];
    item.artifact.type = 'SPREADSHEET';
    item.artifact.content = [];
    item.artifact.contentHash = Utils.generateHash('[]');
    item.assessments = {
      completeness: { score: 0, reasoning: 'Blank submission.' },
      accuracy: { score: 0, reasoning: 'Blank submission.' },
      spag: { score: 'N', reasoning: 'Not attempted.' },
    };
    const expectedHash = item.artifact.contentHash;
    const expectedAssessments = structuredClone(item.assessments);
    const sibling = storedItemJson(record, 0, SIBLING_TASK_ID);
    expect(item.artifact.content).toEqual([]);
    expect(item.artifact.contentHash).toBe(Utils.generateHash('[]'));
    expect(Object.values(item.assessments).map(({ score }) => score)).toEqual([0, 0, 'N']);
    const restored = restoreAssignment(record, 'full');
    const result = restored.submissions[0].items[HEAD_TASK_ID];
    expect(result.artifact.content).toEqual([]);
    expect(result.artifact.contentHash).toBe(expectedHash);
    expect(result.assessments).toEqual(expectedAssessments);
    expectSiblingIntact(restored.submissions[0], sibling);
  });

  it.each([
    { grid: [] },
    {
      grid: [
        [null, null],
        [null, null],
      ],
    },
  ])('canonicalises blank grids to an empty array: %j', ({ grid }) => {
    expect(Array.isArray(grid)).toBe(true);
    expect(grid).toEqual(
      grid.length === 0
        ? []
        : [
            [null, null],
            [null, null],
          ]
    );
    const artifact = new SpreadsheetTaskArtifact({
      taskId: HEAD_TASK_ID,
      role: 'template',
      content: grid,
    });
    expect(artifact.content).toEqual([]);
  });

  it('preserves blank spreadsheet templates as empty arrays', () => {
    const record = currentAssignmentJson();
    const artifacts = record.assignmentDefinition.tasks[HEAD_TASK_ID].artifacts;
    expect(Array.isArray(artifacts.template)).toBe(true);
    const template = artifacts.template[0];
    expect(template).toBeDefined();
    template.type = 'SPREADSHEET';
    template.content = [];
    template.contentHash = Utils.generateHash('[]');
    const restored = restoreAssignment(record);
    const result = restored.assignmentDefinition.tasks[HEAD_TASK_ID].artifacts.template[0];
    expect(result.content).toEqual([]);
  });

  it('preserves populated spreadsheet formula content through restoration', () => {
    const record = currentAssignmentJson();
    const item = record.submissions[0].items[HEAD_TASK_ID];
    item.artifact.type = 'SPREADSHEET';
    item.artifact.content = [
      ['=SUM(A1:A2)', 3],
      [1, 2],
    ];
    item.artifact.contentHash = Utils.generateHash(JSON.stringify(item.artifact.content));
    const expected = structuredClone(item.artifact.content);
    expect(item.artifact.content.length).toBeGreaterThan(0);
    const restored = restoreAssignment(record);
    expect(restored.submissions[0].items[HEAD_TASK_ID].artifact.content).toEqual(expected);
  });

  it('propagates injected spreadsheet normalisation faults', () => {
    const record = currentAssignmentJson();
    const item = record.submissions[0].items[HEAD_TASK_ID];
    item.artifact.type = 'SPREADSHEET';
    item.artifact.content = [['=SUM(A1:A2)']];
    item.artifact.contentHash = Utils.generateHash(JSON.stringify(item.artifact.content));
    const sentinel = new Error('injected spreadsheet restoration fault');
    const spy = vi
      .spyOn(SpreadsheetTaskArtifact.prototype, 'normalizeContent')
      .mockImplementation(() => {
        throw sentinel;
      });
    expect(() => restoreAssignment(record)).toThrow(sentinel);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
