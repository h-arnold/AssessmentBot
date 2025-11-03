/**
 * ABClass Assignment Serialization Tests (RED Phase)
 *
 * Tests validating that ABClass correctly serializes and deserializes assignments
 * while preserving polymorphic types. These tests should FAIL initially as the
 * factory pattern and typed reconstruction are not yet implemented in ABClass.fromJSON().
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ABClass } from '../../src/AdminSheet/Models/ABClass.js';
import {
  createSlidesAssignment,
  createSheetsAssignment,
  createTextTask,
  createStudentSubmission,
} from '../helpers/modelFactories.js';

let origConfigMgr;

beforeEach(() => {
  origConfigMgr = globalThis.ConfigurationManager;
  // Provide a minimal ConfigurationManager to prevent ABClass constructor errors
  function FakeConfigurationManager() {}
  FakeConfigurationManager.getInstance = () => ({
    getAssessmentRecordCourseId: () => 'test-course-123',
  });
  globalThis.ConfigurationManager = FakeConfigurationManager;
});

afterEach(() => {
  globalThis.ConfigurationManager = origConfigMgr;
});

describe('ABClass Assignment Serialization', () => {
  describe('findAssignmentIndex() Helper Method', () => {
    it('returns the array index of a matching assignment', () => {
      const abClass = new ABClass('class-idx', 'Test Class');

      const assignment1 = createSlidesAssignment({
        courseId: 'class-idx',
        assignmentId: 'a1',
      });
      const assignment2 = createSheetsAssignment({
        courseId: 'class-idx',
        assignmentId: 'a2',
      });
      const assignment3 = createSlidesAssignment({
        courseId: 'class-idx',
        assignmentId: 'a3',
      });

      abClass.addAssignment(assignment1);
      abClass.addAssignment(assignment2);
      abClass.addAssignment(assignment3);

      // RED: findAssignmentIndex doesn't exist yet
      expect(typeof abClass.findAssignmentIndex).toBe('function');

      const idx = abClass.findAssignmentIndex((a) => a.assignmentId === 'a2');
      expect(idx).toBe(1);
    });

    it('returns -1 when no assignment matches the predicate', () => {
      const abClass = new ABClass('class-notfound', 'Test Class');

      const assignment1 = createSlidesAssignment({
        courseId: 'class-notfound',
        assignmentId: 'a1',
      });

      abClass.addAssignment(assignment1);

      // RED: findAssignmentIndex doesn't exist yet
      expect(typeof abClass.findAssignmentIndex).toBe('function');

      const idx = abClass.findAssignmentIndex((a) => a.assignmentId === 'nonexistent');
      expect(idx).toBe(-1);
    });

    it('returns -1 for an empty assignments array', () => {
      const abClass = new ABClass('class-empty', 'Test Class');

      // RED: findAssignmentIndex doesn't exist yet
      expect(typeof abClass.findAssignmentIndex).toBe('function');

      const idx = abClass.findAssignmentIndex((a) => a.assignmentId === 'any');
      expect(idx).toBe(-1);
    });

    it('supports immutable replace pattern during rehydration', () => {
      const abClass = new ABClass('class-replace', 'Test Class');

      const assignment1 = createSlidesAssignment({
        courseId: 'class-replace',
        assignmentId: 'a1',
      });
      const assignment2 = createSheetsAssignment({
        courseId: 'class-replace',
        assignmentId: 'a2',
      });

      abClass.addAssignment(assignment1);
      abClass.addAssignment(assignment2);

      // RED: findAssignmentIndex doesn't exist yet
      expect(typeof abClass.findAssignmentIndex).toBe('function');

      const idx = abClass.findAssignmentIndex((a) => a.assignmentId === 'a2');

      // Create a new version of assignment2 (simulating rehydration)
      const assignment2Updated = createSheetsAssignment({
        courseId: 'class-replace',
        assignmentId: 'a2',
        assignmentName: 'Updated Assignment 2',
      });

      // Replace using the index
      abClass.assignments[idx] = assignment2Updated;

      expect(abClass.assignments[1].assignmentName).toBe('Updated Assignment 2');
      expect(abClass.assignments[0]).toBe(assignment1); // Original unchanged
    });
  });

  describe('ABClass.toJSON() with Assignments', () => {
    it('serializes assignments via their toJSON() methods', () => {
      const abClass = new ABClass('class-ser1', 'Serialization Test');

      const assignment = createSlidesAssignment({
        courseId: 'class-ser1',
        assignmentId: 'a-ser1',
        referenceDocumentId: 'ref-doc-1',
        templateDocumentId: 'tpl-doc-1',
      });

      abClass.addAssignment(assignment);

      const json = abClass.toJSON();

      expect(json.assignments).toBeDefined();
      expect(json.assignments).toHaveLength(1);

      const serializedAssignment = json.assignments[0];
      expect(serializedAssignment.courseId).toBe('class-ser1');
      expect(serializedAssignment.assignmentId).toBe('a-ser1');
      expect(serializedAssignment.documentType).toBe('SLIDES');
      expect(serializedAssignment.referenceDocumentId).toBe('ref-doc-1');
      expect(serializedAssignment.templateDocumentId).toBe('tpl-doc-1');
    });

    it('serializes multiple assignments of different types', () => {
      const abClass = new ABClass('class-multi', 'Multi Assignment Test');

      const slidesAssignment = createSlidesAssignment({
        courseId: 'class-multi',
        assignmentId: 'a-slides',
      });

      const sheetsAssignment = createSheetsAssignment({
        courseId: 'class-multi',
        assignmentId: 'a-sheets',
      });

      abClass.addAssignment(slidesAssignment);
      abClass.addAssignment(sheetsAssignment);

      const json = abClass.toJSON();

      expect(json.assignments).toHaveLength(2);
      expect(json.assignments[0].documentType).toBe('SLIDES');
      expect(json.assignments[1].documentType).toBe('SHEETS');
    });

    it('serializes all subclass-specific fields in assignment payloads', () => {
      const abClass = new ABClass('class-fields', 'Fields Test');

      const taskDef = createTextTask(0, 'Task reference', 'Task template');
      const submission = createStudentSubmission({
        studentId: 'student-1',
        assignmentId: 'a-fields',
        documentId: 'doc-1',
      });

      const assignment = createSlidesAssignment({
        courseId: 'class-fields',
        assignmentId: 'a-fields',
        referenceDocumentId: 'ref-fields',
        templateDocumentId: 'tpl-fields',
        tasks: { [taskDef.getId()]: taskDef.toJSON() },
        submissions: [submission.toJSON()],
      });

      abClass.addAssignment(assignment);

      const json = abClass.toJSON();

      const serializedAssignment = json.assignments[0];

      // Verify base fields
      expect(serializedAssignment.courseId).toBe('class-fields');
      expect(serializedAssignment.assignmentId).toBe('a-fields');

      // Verify subclass fields
      expect(serializedAssignment.documentType).toBe('SLIDES');
      expect(serializedAssignment.referenceDocumentId).toBe('ref-fields');
      expect(serializedAssignment.templateDocumentId).toBe('tpl-fields');

      // Verify nested structures
      expect(serializedAssignment.tasks).toBeDefined();
      expect(Object.keys(serializedAssignment.tasks)).toHaveLength(1);
      expect(serializedAssignment.submissions).toBeDefined();
      expect(serializedAssignment.submissions).toHaveLength(1);
    });

    it('maintains polymorphic type information through documentType field', () => {
      const abClass = new ABClass('class-poly', 'Polymorphic Test');

      const assignment = createSlidesAssignment({
        courseId: 'class-poly',
        assignmentId: 'a-poly',
      });

      abClass.addAssignment(assignment);

      const json = abClass.toJSON();

      // documentType is the polymorphic discriminator
      expect(json.assignments[0]).toHaveProperty('documentType');
      expect(json.assignments[0].documentType).toBe('SLIDES');
    });
  });

  describe('ABClass.fromJSON() with Assignments', () => {
    it('reconstructs assignments as proper typed instances (not plain objects)', () => {
      const abClass = new ABClass('class-recon', 'Reconstruction Test');

      const assignment = createSlidesAssignment({
        courseId: 'class-recon',
        assignmentId: 'a-recon',
        referenceDocumentId: 'ref-recon',
        templateDocumentId: 'tpl-recon',
      });

      abClass.addAssignment(assignment);

      const json = abClass.toJSON();
      const restored = ABClass.fromJSON(json);

      // RED: This will fail because ABClass.fromJSON doesn't call Assignment.fromJSON yet
      expect(restored.assignments).toHaveLength(1);

      const restoredAssignment = restored.assignments[0];

      // Should be a proper Assignment instance with methods, not a plain object
      expect(typeof restoredAssignment.toJSON).toBe('function');
      expect(typeof restoredAssignment.toPartialJSON).toBe('function');
      expect(restoredAssignment.documentType).toBe('SLIDES');
    });

    it('preserves assignment types across round-trip serialization', () => {
      const abClass = new ABClass('class-roundtrip', 'Round Trip Test');

      const slidesAssignment = createSlidesAssignment({
        courseId: 'class-roundtrip',
        assignmentId: 'a-slides-rt',
      });

      const sheetsAssignment = createSheetsAssignment({
        courseId: 'class-roundtrip',
        assignmentId: 'a-sheets-rt',
      });

      abClass.addAssignment(slidesAssignment);
      abClass.addAssignment(sheetsAssignment);

      const json = abClass.toJSON();
      const restored = ABClass.fromJSON(json);

      // RED: This will fail because assignments aren't properly typed after fromJSON
      expect(restored.assignments).toHaveLength(2);

      expect(restored.assignments[0].documentType).toBe('SLIDES');
      expect(typeof restored.assignments[0].toJSON).toBe('function');

      expect(restored.assignments[1].documentType).toBe('SHEETS');
      expect(typeof restored.assignments[1].toJSON).toBe('function');
    });

    it('reconstructs polymorphic fields correctly (referenceDocumentId, templateDocumentId)', () => {
      const abClass = new ABClass('class-polyfields', 'Polymorphic Fields Test');

      const assignment = createSlidesAssignment({
        courseId: 'class-polyfields',
        assignmentId: 'a-polyfields',
        referenceDocumentId: 'ref-unique-123',
        templateDocumentId: 'tpl-unique-456',
      });

      abClass.addAssignment(assignment);

      const json = abClass.toJSON();
      const restored = ABClass.fromJSON(json);

      // RED: Fields should be preserved but instance methods may be missing
      const restoredAssignment = restored.assignments[0];

      expect(restoredAssignment.referenceDocumentId).toBe('ref-unique-123');
      expect(restoredAssignment.templateDocumentId).toBe('tpl-unique-456');
      expect(restoredAssignment.documentType).toBe('SLIDES');
    });

    it('handles nested data structures (tasks, submissions) after round-trip', () => {
      const abClass = new ABClass('class-nested', 'Nested Data Test');

      const taskDef = createTextTask(1, 'Nested reference', 'Nested template');
      const submission = createStudentSubmission({
        studentId: 'student-nested',
        assignmentId: 'a-nested',
        documentId: 'doc-nested',
      });

      const assignment = createSlidesAssignment({
        courseId: 'class-nested',
        assignmentId: 'a-nested',
        tasks: { [taskDef.getId()]: taskDef.toJSON() },
        submissions: [submission.toJSON()],
      });

      abClass.addAssignment(assignment);

      const json = abClass.toJSON();
      const restored = ABClass.fromJSON(json);

      const restoredAssignment = restored.assignments[0];

      // Verify nested structures are preserved
      expect(restoredAssignment.tasks).toBeDefined();
      expect(Object.keys(restoredAssignment.tasks)).toHaveLength(1);

      expect(restoredAssignment.submissions).toBeDefined();
      expect(restoredAssignment.submissions).toHaveLength(1);
      expect(restoredAssignment.submissions[0].studentId).toBe('student-nested');
    });

    it('gracefully handles corrupt assignment data with logging', () => {
      const abClass = new ABClass('class-corrupt', 'Corrupt Data Test');

      // Manually add a malformed assignment to the JSON
      const json = abClass.toJSON();
      json.assignments = [
        {
          // Missing required fields
          courseId: 'class-corrupt',
          // assignmentId missing
          documentType: 'SLIDES',
        },
      ];

      // RED: ABClass.fromJSON should attempt Assignment.fromJSON and handle errors
      // For now this may throw or leave plain objects
      const restored = ABClass.fromJSON(json);

      expect(restored.assignments).toBeDefined();
      // Should either have a plain object fallback or log error appropriately
      // The exact behavior depends on implementation but should not crash
    });

    it('handles empty assignments array correctly', () => {
      const abClass = new ABClass('class-empty-assign', 'Empty Assignments Test');

      const json = abClass.toJSON();
      const restored = ABClass.fromJSON(json);

      expect(restored.assignments).toEqual([]);
    });

    it('verifies second round-trip still produces valid typed instances', () => {
      const abClass = new ABClass('class-2rt', 'Second Round Trip Test');

      const assignment = createSlidesAssignment({
        courseId: 'class-2rt',
        assignmentId: 'a-2rt',
      });

      abClass.addAssignment(assignment);

      // First round-trip
      const json1 = abClass.toJSON();
      const restored1 = ABClass.fromJSON(json1);

      // Second round-trip
      const json2 = restored1.toJSON();
      const restored2 = ABClass.fromJSON(json2);

      // RED: After two round-trips, should still have proper types
      expect(restored2.assignments).toHaveLength(1);
      expect(typeof restored2.assignments[0].toJSON).toBe('function');
      expect(restored2.assignments[0].documentType).toBe('SLIDES');
    });
  });

  describe('Assignment Immutability During Serialization', () => {
    it('does not mutate original assignment instances during toJSON', () => {
      const abClass = new ABClass('class-immut', 'Immutability Test');

      const assignment = createSlidesAssignment({
        courseId: 'class-immut',
        assignmentId: 'a-immut',
        referenceDocumentId: 'ref-immut',
      });

      abClass.addAssignment(assignment);

      const originalRefId = assignment.referenceDocumentId;
      const json = abClass.toJSON();

      // Mutate the JSON
      json.assignments[0].referenceDocumentId = 'mutated-ref';

      // Original should be unchanged
      expect(assignment.referenceDocumentId).toBe(originalRefId);
      expect(abClass.assignments[0].referenceDocumentId).toBe(originalRefId);
    });
  });
});
