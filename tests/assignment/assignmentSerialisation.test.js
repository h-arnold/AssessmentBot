/**
 * Assignment Serialisation Tests (RED Phase)
 *
 * These tests capture the desired behaviour for the Assignment serialization
 * enhancements. They are expected to fail until `Assignment.toPartialJSON()`
 * and supporting helpers are implemented.
 */

import { describe, it, expect } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';
import {
  createSlidesAssignment,
  createTextTask,
  createStudentSubmission,
} from '../helpers/modelFactories.js';

/**
 * Build a fully-hydrated slides assignment with rich task/submission data.
 * @return {{ assignment: import('../../src/AdminSheet/AssignmentProcessor/SlidesAssignment.js'), taskId: string }}
 */
function buildAssignmentFixture() {
  const taskDefinition = createTextTask(1, 'Reference paragraph', 'Template guidance');

  const submission = createStudentSubmission({
    studentId: 'student-123',
    assignmentId: 'a-serial',
    documentId: 'doc-serial',
  });

  submission.upsertItemFromExtraction(taskDefinition, {
    pageId: 'page-1',
    content: 'Learner response text that will be redacted in partial payloads.',
    metadata: { wordCount: 42 },
  });

  const submissionItem = submission.items[taskDefinition.getId()];
  submissionItem.addAssessment('completeness', {
    score: 4,
    reasoning: 'Covers the expected talking points.',
  });
  submissionItem.addFeedback('summary', { body: 'Nice effort overall.' });

  const assignment = createSlidesAssignment({
    courseId: 'course-serial',
    assignmentId: 'a-serial',
    referenceDocumentId: 'ref-serial',
    templateDocumentId: 'tpl-serial',
    tasks: { [taskDefinition.getId()]: taskDefinition.toJSON() },
    submissions: [submission.toJSON()],
    assignmentName: 'Serialisation Fixture',
  });

  // Attach a transient hydration marker to confirm it never leaks into payloads.
  assignment._hydrationLevel = 'full';

  return {
    assignment,
    taskId: taskDefinition.getId(),
  };
}

/**
 * Assert that a partial artifact keeps identifiers/metadata while nulling heavy fields.
 * @param {object} partialArtifact - Artifact from toPartialJSON payload.
 * @param {object} fullArtifact - Artifact from toJSON payload.
 */
function expectPartialArtifact(partialArtifact, fullArtifact) {
  expect(partialArtifact).toBeDefined();
  expect(partialArtifact.taskId).toBe(fullArtifact.taskId);
  expect(partialArtifact.role).toBe(fullArtifact.role);
  expect(partialArtifact.uid).toBe(fullArtifact.uid);
  expect(partialArtifact.type).toBe(fullArtifact.type);
  expect(partialArtifact.pageId).toBe(fullArtifact.pageId);
  expect(partialArtifact.documentId).toBe(fullArtifact.documentId);
  expect(partialArtifact.metadata).toEqual(fullArtifact.metadata);
  expect(partialArtifact.content).toBeNull();
  expect(partialArtifact.contentHash).toBeNull();
}

describe('Assignment Serialisation', () => {
  describe('toPartialJSON()', () => {
    it('exposes toPartialJSON and redacts heavy artifact fields while preserving identifiers', () => {
      const { assignment, taskId } = buildAssignmentFixture();

      expect(typeof assignment.toPartialJSON).toBe('function');

      const fullJson = assignment.toJSON();
      const partialJson = assignment.toPartialJSON();

      expect(partialJson.documentType).toBe(fullJson.documentType);
      expect(partialJson.courseId).toBe(fullJson.courseId);
      expect(partialJson.assignmentId).toBe(fullJson.assignmentId);

      const fullTask = fullJson.tasks[taskId];
      const partialTask = partialJson.tasks[taskId];
      expect(partialTask).toBeDefined();

      expectPartialArtifact(partialTask.artifacts.reference[0], fullTask.artifacts.reference[0]);
      expectPartialArtifact(partialTask.artifacts.template[0], fullTask.artifacts.template[0]);

      const fullSubmission = fullJson.submissions[0];
      const partialSubmission = partialJson.submissions[0];
      expect(partialSubmission.studentId).toBe(fullSubmission.studentId);
      expect(partialSubmission.documentId).toBe(fullSubmission.documentId);
      expect(partialSubmission.assignmentId).toBe(fullSubmission.assignmentId);

      const fullItem = fullSubmission.items[taskId];
      const partialItem = partialSubmission.items[taskId];
      expect(partialItem.assessments).toEqual(fullItem.assessments);
      expect(partialItem.feedback).toEqual(fullItem.feedback);
      expectPartialArtifact(partialItem.artifact, fullItem.artifact);
    });

    it('omits transient fields such as students, progressTracker, and _hydrationLevel', () => {
      const { assignment } = buildAssignmentFixture();

      assignment.students = [{ id: 'student-transient' }];
      assignment.progressTracker = { mocked: true };
      assignment._hydrationLevel = 'partial';

      expect(typeof assignment.toPartialJSON).toBe('function');

      const partialJson = assignment.toPartialJSON();

      expect(partialJson.students).toBeUndefined();
      expect(partialJson.progressTracker).toBeUndefined();
      expect(partialJson._hydrationLevel).toBeUndefined();
    });

    it('does not mutate the live assignment instance when producing partial payloads', () => {
      const { assignment, taskId } = buildAssignmentFixture();

      const originalReferenceContent = assignment.tasks[taskId].artifacts.reference[0].content;
      const originalReferenceHash = assignment.tasks[taskId].artifacts.reference[0].contentHash;
      const originalSubmissionContent = assignment.submissions[0].items[taskId].artifact.content;
      const originalSubmissionHash = assignment.submissions[0].items[taskId].artifact.contentHash;

      expect(typeof assignment.toPartialJSON).toBe('function');

      assignment.toPartialJSON();

      expect(assignment.tasks[taskId].artifacts.reference[0].content).toBe(
        originalReferenceContent
      );
      expect(assignment.tasks[taskId].artifacts.reference[0].contentHash).toBe(
        originalReferenceHash
      );
      expect(assignment.submissions[0].items[taskId].artifact.content).toBe(
        originalSubmissionContent
      );
      expect(assignment.submissions[0].items[taskId].artifact.contentHash).toBe(
        originalSubmissionHash
      );
    });
  });

  describe('SlidesAssignment.toJSON()', () => {
    it('includes subclass-specific identifiers while delegating to the base payload', () => {
      const assignment = Assignment.fromJSON({
        courseId: 'course-tojson',
        assignmentId: 'assign-tojson',
        assignmentName: 'Slides assignment serialisation',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-tojson',
        templateDocumentId: 'tpl-tojson',
        tasks: {},
        submissions: [],
      });

      const json = assignment.toJSON();

      expect(json.courseId).toBe('course-tojson');
      expect(json.assignmentId).toBe('assign-tojson');
      expect(json.documentType).toBe('SLIDES');
      expect(json.referenceDocumentId).toBe('ref-tojson');
      expect(json.templateDocumentId).toBe('tpl-tojson');
      expect(json.students).toBeUndefined();
      expect(json.progressTracker).toBeUndefined();
    });
  });
});
