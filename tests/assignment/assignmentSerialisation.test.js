/**
 * Assignment Serialisation Tests
 *
 * Tests for Assignment serialization including partial definitions with tasks: null.
 */

import { describe, it, expect } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';
import { AssignmentDefinition } from '../../src/AdminSheet/Models/AssignmentDefinition.js';
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

describe('Assignment Serialisation', () => {
  describe('toPartialJSON()', () => {
    it('omits tasks, referenceDocumentId, and templateDocumentId from root for partial', () => {
      const { assignment } = buildAssignmentFixture();

      expect(typeof assignment.toPartialJSON).toBe('function');

      const partialJson = assignment.toPartialJSON();

      // Root level should NOT have these fields for partial
      expect(partialJson).not.toHaveProperty('tasks');
      expect(partialJson).not.toHaveProperty('referenceDocumentId');
      expect(partialJson).not.toHaveProperty('templateDocumentId');

      // assignmentDefinition should have tasks: null but include doc IDs
      expect(partialJson.assignmentDefinition.tasks).toBe(null);
      expect(partialJson.assignmentDefinition.referenceDocumentId).toBe('ref-serial');
      expect(partialJson.assignmentDefinition.templateDocumentId).toBe('tpl-serial');

      // documentType should be present in both root and definition
      expect(partialJson.documentType).toBe('SLIDES');
      expect(partialJson.assignmentDefinition.documentType).toBe('SLIDES');

      // Core identifiers should be preserved
      expect(partialJson.courseId).toBeDefined();
      expect(partialJson.assignmentId).toBeDefined();
      expect(partialJson.assignmentName).toBeDefined();
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

    it('preserves submissions in partial JSON', () => {
      const { assignment } = buildAssignmentFixture();

      const partialJson = assignment.toPartialJSON();

      expect(partialJson.submissions).toBeDefined();
      expect(partialJson.submissions.length).toBeGreaterThan(0);
      expect(partialJson.submissions[0].studentId).toBe('student-123');
    });
  });

  describe('Round-trip partial serialization', () => {
    it('maintains tasks: null through round-trip', () => {
      const partialDef = new AssignmentDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        tasks: null,
      });

      const assignment = Assignment.create(partialDef, 'C123', 'A1');
      assignment.assignmentName = 'Test Assignment';

      const partialJson = assignment.toPartialJSON();
      const restored = Assignment.fromJSON(partialJson);

      expect(restored.assignmentDefinition.tasks).toBe(null);
      expect(restored.assignmentDefinition.referenceDocumentId).toBe(null);
      expect(restored.assignmentDefinition.templateDocumentId).toBe(null);
      expect(restored.documentType).toBe('SLIDES');
    });
  });

  describe('SlidesAssignment.toPartialJSON()', () => {
    it('produces correct partial shape with documentType', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Slides Essay',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-slides',
        templateDocumentId: 'tmpl-slides',
        tasks: {},
      });

      const assignment = Assignment.create(fullDef, 'C123', 'A1');
      const partialJson = assignment.toPartialJSON();

      expect(partialJson.documentType).toBe('SLIDES');
      expect(partialJson.assignmentDefinition.documentType).toBe('SLIDES');
      expect(partialJson.assignmentDefinition.tasks).toBe(null);
      expect(partialJson).not.toHaveProperty('referenceDocumentId');
      expect(partialJson).not.toHaveProperty('templateDocumentId');
      expect(partialJson).not.toHaveProperty('tasks');
    });
  });

  describe('SlidesAssignment.toJSON()', () => {
    it('includes subclass-specific identifiers while delegating to the base payload', () => {
      const fullDef = new AssignmentDefinition({
        primaryTitle: 'Slides assignment serialisation',
        primaryTopic: 'English',
        yearGroup: 10,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-tojson',
        templateDocumentId: 'tpl-tojson',
        tasks: {},
      });

      const assignment = Assignment.create(fullDef, 'course-tojson', 'assign-tojson');
      assignment.assignmentName = 'Slides assignment serialisation';

      const json = assignment.toJSON();

      expect(json.courseId).toBe('course-tojson');
      expect(json.assignmentId).toBe('assign-tojson');
      expect(json.documentType).toBe('SLIDES');
      expect(json.assignmentDefinition.referenceDocumentId).toBe('ref-tojson');
      expect(json.assignmentDefinition.templateDocumentId).toBe('tpl-tojson');
      expect(json.students).toBeUndefined();
      expect(json.progressTracker).toBeUndefined();
    });
  });
});
