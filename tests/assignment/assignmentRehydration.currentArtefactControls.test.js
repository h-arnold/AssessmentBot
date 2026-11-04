import { describe, expect, it } from 'vitest';
import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import { assertDecodablePngDataUrl } from '../synthetic-analysis/syntheticAssessmentImageBodySupport.js';

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');

function fullAssignmentWithItem(type, validBody) {
  const graph = generateSyntheticAnalysisGraph('small');
  const assignments = Object.values(graph.transport.assignmentsByKey);
  for (const assignment of assignments) {
    for (const submission of assignment.submissions) {
      for (const item of Object.values(submission.items)) {
        if (
          item.artifact?.role === 'submission' &&
          item.artifact.type === type &&
          validBody(item.artifact.content) &&
          Object.values(item.assessments ?? {}).some(
            (assessment) => typeof assessment.score === 'number'
          )
        )
          return { assignment, submission, item };
      }
    }
  }
  throw new Error(`Canonical small graph has no numeric ${type} submission item`);
}

function restoredItem(selected) {
  const record = structuredClone(selected.assignment);
  const originalSubmission = record.submissions.find(
    (entry) => entry.studentId === selected.submission.studentId
  );
  const taskId = selected.item.taskId;
  const before = structuredClone(originalSubmission.items[taskId]);
  const restored = Assignment.fromJSON(record);
  return { record, before, restored, taskId };
}

describe('current-format healthy artefact restoration controls', () => {
  it('restores a canonical numeric IMAGE submission without changing its source', () => {
    const selected = fullAssignmentWithItem(
      'IMAGE',
      (content) => typeof content === 'string' && content.startsWith('data:image/png;base64,')
    );
    assertDecodablePngDataUrl(selected.item.artifact.content, 'canonical IMAGE submission');
    const { record, before, restored, taskId } = restoredItem(selected);
    const item = restored.submissions.find(
      (entry) => entry.studentId === selected.submission.studentId
    ).items[taskId];
    expect(restored.assignmentId).toBe(record.assignmentId);
    expect(item.assessments).toEqual(before.assessments);
    expect(item.artifact.content).toBe(before.artifact.content);
    expect(item.artifact.contentHash).toBe(before.artifact.contentHash);
  });

  it('restores a canonical numeric SPREADSHEET submission grid and results', () => {
    const selected = fullAssignmentWithItem(
      'SPREADSHEET',
      (content) => Array.isArray(content) && content.every(Array.isArray)
    );
    const grid = structuredClone(selected.item.artifact.content);
    expect(grid.length).toBeGreaterThan(0);
    expect(grid[0].length).toBeGreaterThan(0);
    const { record, before, restored, taskId } = restoredItem(selected);
    const item = restored.submissions.find(
      (entry) => entry.studentId === selected.submission.studentId
    ).items[taskId];
    expect(restored.assignmentId).toBe(record.assignmentId);
    expect(item.artifact.content).toEqual(grid);
    expect(item.artifact.content).toEqual(before.artifact.content);
    expect(item.artifact.contentHash).toBe(before.artifact.contentHash);
    expect(item.assessments).toEqual(before.assessments);
  });
});
