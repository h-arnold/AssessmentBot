import { expect } from 'vitest';

/** @typedef {Record<string, any>} RecordValue */

/**
 * Verifies full model serialisation retains each populated item payload.
 * @param {RecordValue[]} output Serialised full submissions.
 * @param {RecordValue[]} sourceRows Canonical full submissions.
 */
export function expectFullSubmissionPreserved(output, sourceRows) {
  expect(output).toHaveLength(sourceRows.length);
  for (const submission of output) {
    const source = sourceRows.find((row) => row.studentId === submission.studentId);
    expect(source).toBeDefined();
    expect(Object.keys(submission.items).sort()).toEqual(Object.keys(source.items).sort());
    for (const [taskId, item] of Object.entries(submission.items)) {
      const original = source.items[taskId];
      expect(item.artifact.content).toBe(original.artifact.content);
      expect(item.artifact.contentHash).toBe(original.artifact.contentHash);
      expect(item.assessments).toEqual(original.assessments);
      expect(item.feedback).toEqual(original.feedback);
    }
  }
}

/**
 * Verifies partial model serialisation redacts content, hashes, and reasoning.
 * @param {RecordValue[]} output Serialised partial submissions.
 * @param {RecordValue[]} sourceRows Canonical full submissions.
 */
export function expectPartialSubmissionRedacted(output, sourceRows) {
  expect(output).toHaveLength(sourceRows.length);
  for (const submission of output) {
    const source = sourceRows.find((row) => row.studentId === submission.studentId);
    expect(source).toBeDefined();
    expect(submission.documentId).toBe(source.documentId);
    expect(Object.keys(submission.items).sort()).toEqual(Object.keys(source.items).sort());
    for (const [taskId, item] of Object.entries(submission.items)) {
      const original = source.items[taskId];
      expect(item.artifact.content).toBeNull();
      expect(item.artifact.contentHash).toBeNull();
      expect(item.assessments).toEqual(
        Object.fromEntries(
          Object.entries(original.assessments).map(([criterion, assessment]) => [
            criterion,
            { score: assessment.score },
          ])
        )
      );
      for (const assessment of Object.values(item.assessments)) {
        expect(assessment).not.toHaveProperty('reasoning');
      }
      expect(item.feedback).toEqual(original.feedback);
    }
  }
}

/**
 * Verifies restored class-embedded partial submissions against their canonical redacted rows.
 * @param {RecordValue[]} output Serialised submissions from the restored class assignment.
 * @param {RecordValue[]} sourceRows Canonical redacted class-transport submissions.
 * @returns {number} Number of restored submission items checked.
 */
export function expectPartialSubmissionMatchesRedactedSource(output, sourceRows) {
  expect(output).toHaveLength(sourceRows.length);
  let itemCount = 0;

  for (const [index, submission] of output.entries()) {
    const source = sourceRows.find((row) => row.studentId === submission.studentId);
    expect(source).toBeDefined();
    expect(submission.studentId).toBe(source.studentId);
    expect(submission.studentName).toBe(source.studentName);
    expect(submission.assignmentId).toBe(source.assignmentId);
    expect(submission.documentId).toBe(source.documentId);
    expect(submission.createdAt).toBe(source.createdAt);
    expect(submission.updatedAt).toBe(source.updatedAt);
    expect(output[index].studentId).toBe(sourceRows[index].studentId);
    expect(Object.keys(submission.items).sort()).toEqual(Object.keys(source.items).sort());

    for (const [taskId, item] of Object.entries(submission.items)) {
      const original = source.items[taskId];
      expect(original).toBeDefined();
      itemCount += 1;
      expect(item.id).toBe(original.id);
      expect(item.taskId).toBe(original.taskId);
      expect(item.artifact.content).toBeNull();
      expect(item.artifact.contentHash).toBeNull();
      expect(item.assessments).toEqual(original.assessments);
      for (const assessment of Object.values(item.assessments)) {
        expect(assessment).toHaveProperty('score');
        expect(assessment).not.toHaveProperty('reasoning');
      }
      expect(item.feedback).toEqual(original.feedback);
    }
  }

  return itemCount;
}
