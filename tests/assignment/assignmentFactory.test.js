/**
 * Assignment Factory Pattern Tests (RED Phase)
 *
 * Tests for polymorphic assignment creation and deserialization.
 * All tests should FAIL initially as the factory pattern is not yet implemented.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';
import { createSlidesAssignment, createSheetsAssignment } from '../helpers/modelFactories.js';

// Note: These imports will need to exist for tests to pass
// They are expected to fail in RED phase
let SlidesAssignment, SheetsAssignment;
try {
  SlidesAssignment = require('../../src/AdminSheet/AssignmentProcessor/SlidesAssignment.js');
  SheetsAssignment = require('../../src/AdminSheet/AssignmentProcessor/SheetsAssignment.js');
} catch (e) {
  // Expected to fail in RED phase
}

describe('Assignment.create() Factory Method', () => {
  it('should create a SlidesAssignment for documentType SLIDES', () => {
    // RED: Assignment.create does not exist yet
    const assignment = Assignment.create('SLIDES', 'c1', 'a1', 'ref1', 'tpl1');

    expect(assignment).toBeDefined();
    expect(assignment.documentType).toBe('SLIDES');
    expect(assignment.courseId).toBe('c1');
    expect(assignment.assignmentId).toBe('a1');
    expect(assignment.referenceDocumentId).toBe('ref1');
    expect(assignment.templateDocumentId).toBe('tpl1');

    // Verify it's the correct subclass
    if (SlidesAssignment) {
      expect(assignment instanceof SlidesAssignment).toBe(true);
    }
  });

  it('should create a SheetsAssignment for documentType SHEETS', () => {
    // RED: Assignment.create does not exist yet
    const assignment = Assignment.create('SHEETS', 'c2', 'a2', 'ref2', 'tpl2');

    expect(assignment).toBeDefined();
    expect(assignment.documentType).toBe('SHEETS');
    expect(assignment.courseId).toBe('c2');
    expect(assignment.assignmentId).toBe('a2');
    expect(assignment.referenceDocumentId).toBe('ref2');
    expect(assignment.templateDocumentId).toBe('tpl2');

    // Verify it's the correct subclass
    if (SheetsAssignment) {
      expect(assignment instanceof SheetsAssignment).toBe(true);
    }
  });

  it('should throw an error for an unknown documentType', () => {
    // RED: Assignment.create does not exist yet
    expect(() => {
      Assignment.create('INVALID', 'c1', 'a1', 'ref1', 'tpl1');
    }).toThrow(/unknown.*documentType/i);
  });

  it('should throw for null/undefined documentType', () => {
    // RED: Assignment.create does not exist yet
    expect(() => {
      Assignment.create(null, 'c1', 'a1', 'ref1', 'tpl1');
    }).toThrow();

    expect(() => {
      Assignment.create(undefined, 'c1', 'a1', 'ref1', 'tpl1');
    }).toThrow();
  });
});

describe('Assignment.fromJSON() Polymorphic Deserialization', () => {
  it('should deserialize to a SlidesAssignment when data.documentType is SLIDES', () => {
    // RED: Polymorphic fromJSON routing not implemented yet
    const data = {
      courseId: 'c1',
      assignmentId: 'a1',
      assignmentName: 'Test Assignment',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref1',
      templateDocumentId: 'tpl1',
      tasks: {},
      submissions: [],
    };

    const assignment = Assignment.fromJSON(data);

    expect(assignment).toBeDefined();
    expect(assignment.documentType).toBe('SLIDES');
    expect(assignment.referenceDocumentId).toBe('ref1');
    expect(assignment.templateDocumentId).toBe('tpl1');

    if (SlidesAssignment) {
      expect(assignment instanceof SlidesAssignment).toBe(true);
    }
  });

  it('should deserialize to a SheetsAssignment when data.documentType is SHEETS', () => {
    // RED: Polymorphic fromJSON routing not implemented yet
    const data = {
      courseId: 'c2',
      assignmentId: 'a2',
      assignmentName: 'Test Assignment',
      documentType: 'SHEETS',
      referenceDocumentId: 'ref2',
      templateDocumentId: 'tpl2',
      tasks: {},
      submissions: [],
    };

    const assignment = Assignment.fromJSON(data);

    expect(assignment).toBeDefined();
    expect(assignment.documentType).toBe('SHEETS');
    expect(assignment.referenceDocumentId).toBe('ref2');
    expect(assignment.templateDocumentId).toBe('tpl2');

    if (SheetsAssignment) {
      expect(assignment instanceof SheetsAssignment).toBe(true);
    }
  });

  it('should correctly restore subclass-specific properties (referenceDocumentId, templateDocumentId)', () => {
    // RED: Subclass properties not restored yet
    const data = {
      courseId: 'c5',
      assignmentId: 'a5',
      assignmentName: 'Test Assignment',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref5',
      templateDocumentId: 'tpl5',
      tasks: {},
      submissions: [],
    };

    const assignment = Assignment.fromJSON(data);

    expect(assignment.referenceDocumentId).toBe('ref5');
    expect(assignment.templateDocumentId).toBe('tpl5');
  });
});

describe('Polymorphic Round-Trip', () => {
  it('should preserve type and data for a SlidesAssignment after a toJSON() -> fromJSON() round-trip', () => {
    // RED: Full round-trip not working yet
    const original = createSlidesAssignment({
      courseId: 'c1',
      assignmentId: 'a1',
      referenceDocumentId: 'ref1',
      templateDocumentId: 'tpl1',
    });

    const json = original.toJSON();
    const restored = Assignment.fromJSON(json);

    expect(restored.documentType).toBe('SLIDES');
    expect(restored.courseId).toBe('c1');
    expect(restored.assignmentId).toBe('a1');
    expect(restored.referenceDocumentId).toBe('ref1');
    expect(restored.templateDocumentId).toBe('tpl1');

    if (SlidesAssignment) {
      expect(restored instanceof SlidesAssignment).toBe(true);
    }
  });

  it('should explicitly verify documentType field survives round-trip', () => {
    // RED: documentType field doesn't exist yet
    const data = {
      courseId: 'c_doctype',
      assignmentId: 'a_doctype',
      assignmentName: 'DocType Assignment',
      documentType: 'SLIDES',
      referenceDocumentId: 'ref_doctype',
      templateDocumentId: 'tpl_doctype',
      tasks: {},
      submissions: [],
    };

    const original = Assignment.fromJSON(data);
    expect(original.documentType).toBe('SLIDES');

    const json = original.toJSON();
    expect(json.documentType).toBe('SLIDES');

    const restored = Assignment.fromJSON(json);
    expect(restored.documentType).toBe('SLIDES');
  });
});

describe('Subclass-Specific Serialization', () => {
  it('should include documentType, referenceDocumentId, templateDocumentId in SlidesAssignment.toJSON()', () => {
    // RED: Subclass toJSON not implemented yet
    const assignment = createSlidesAssignment({
      courseId: 'c1',
      assignmentId: 'a1',
      referenceDocumentId: 'ref1',
      templateDocumentId: 'tpl1',
    });

    const json = assignment.toJSON();

    expect(json.documentType).toBe('SLIDES');
    expect(json.referenceDocumentId).toBe('ref1');
    expect(json.templateDocumentId).toBe('tpl1');
  });

  it('should include documentType, referenceDocumentId, templateDocumentId in SheetsAssignment.toJSON()', () => {
    // RED: Subclass toJSON not implemented yet
    const assignment = createSheetsAssignment({
      courseId: 'c2',
      assignmentId: 'a2',
      referenceDocumentId: 'ref2',
      templateDocumentId: 'tpl2',
    });

    const json = assignment.toJSON();

    expect(json.documentType).toBe('SHEETS');
    expect(json.referenceDocumentId).toBe('ref2');
    expect(json.templateDocumentId).toBe('tpl2');
  });
});

describe('Transient Field Exclusion', () => {
  it('should not serialize _hydrationLevel even if present', () => {
    // RED: _hydrationLevel field doesn't exist yet
    const assignment = createSlidesAssignment({
      courseId: 'c3',
      assignmentId: 'a3',
    });

    // Simulate setting hydration level
    assignment._hydrationLevel = 'full';

    const json = assignment.toJSON();

    expect(json._hydrationLevel).toBeUndefined();
  });
});
