import { describe, it, expect } from 'vitest';
import Assignment from '../../src/AdminSheet/AssignmentProcessor/Assignment.js';
import { createSlidesAssignment, createSheetsAssignment } from '../helpers/modelFactories.js';

describe('Assignment lastUpdated behavior', () => {
  it('touchUpdated sets lastUpdated to a recent Date', () => {
    const a = createSlidesAssignment({
      courseId: 'c1',
      assignmentId: 'as1',
      referenceDocumentId: 'ref1',
      templateDocumentId: 'tpl1',
      assignmentName: 'Slides Assignment',
    });
    expect(a.documentType).toBe('SLIDES');
    expect(a.getLastUpdated()).toBeNull();
    const before = Date.now();
    const d = a.touchUpdated();
    expect(d).toBeInstanceOf(Date);
    expect(a.getLastUpdated()).toBeInstanceOf(Date);
    const after = Date.now();
    expect(d.getTime()).toBeGreaterThanOrEqual(before - 5);
    expect(d.getTime()).toBeLessThanOrEqual(after + 5);
  });

  it('setLastUpdated accepts a Date and stores a copy (immutable)', () => {
    const a = createSlidesAssignment({
      courseId: 'c2',
      assignmentId: 'as2',
      referenceDocumentId: 'ref2',
      templateDocumentId: 'tpl2',
      assignmentName: 'Slides Assignment 2',
    });
    const src = new Date(2020, 0, 2, 3, 4, 5);
    const ret = a.setLastUpdated(src);
    expect(ret).toBeInstanceOf(Date);
    expect(ret.getTime()).toBe(src.getTime());
    src.setFullYear(1999);
    expect(a.getLastUpdated().getFullYear()).not.toBe(1999);
    a.setLastUpdated(null);
    expect(a.getLastUpdated()).toBeNull();
  });

  it('setLastUpdated rejects invalid values', () => {
    const a = createSlidesAssignment({
      courseId: 'c3',
      assignmentId: 'as3',
      referenceDocumentId: 'ref3',
      templateDocumentId: 'tpl3',
      assignmentName: 'Slides Assignment 3',
    });
    expect(() => a.setLastUpdated('2020-01-01')).toThrow();
    expect(() => a.setLastUpdated(12345)).toThrow();
    expect(() => a.setLastUpdated(new Date('invalid'))).toThrow();
  });

  it('toJSON and fromJSON preserve lastUpdated', () => {
    const a = createSheetsAssignment({
      courseId: 'c4',
      assignmentId: 'as4',
      referenceDocumentId: 'ref4',
      templateDocumentId: 'tpl4',
      assignmentName: 'Sheets Assignment',
    });
    expect(a.documentType).toBe('SHEETS');
    a.setLastUpdated(new Date(2021, 5, 6, 7, 8, 9));
    const json = a.toJSON();
    expect(json.lastUpdated).toBeTruthy();
    const restored = Assignment.fromJSON(json);
    expect(restored.documentType).toBe('SHEETS');
    expect(restored.getLastUpdated()).toBeInstanceOf(Date);
    expect(restored.getLastUpdated().getTime()).toBe(a.getLastUpdated().getTime());
  });

  it('touchUpdated behaves consistently across subclasses', () => {
    const slides = createSlidesAssignment({
      courseId: 'c6',
      assignmentId: 'as6',
      referenceDocumentId: 'ref6',
      templateDocumentId: 'tpl6',
      assignmentName: 'Slides Assignment 6',
    });
    const sheets = createSheetsAssignment({
      courseId: 'c7',
      assignmentId: 'as7',
      referenceDocumentId: 'ref7',
      templateDocumentId: 'tpl7',
      assignmentName: 'Sheets Assignment 7',
    });

    const slidesUpdated = slides.touchUpdated();
    const sheetsUpdated = sheets.touchUpdated();

    expect(slidesUpdated).toBeInstanceOf(Date);
    expect(sheetsUpdated).toBeInstanceOf(Date);
    expect(slides.getLastUpdated()).toBeInstanceOf(Date);
    expect(sheets.getLastUpdated()).toBeInstanceOf(Date);
  });

  it('should support legacy data without documentType (creates base Assignment)', () => {
    // RED: Legacy fallback path - Assignment.fromJSON should handle missing documentType
    const legacyData = {
      courseId: 'c5',
      assignmentId: 'as5',
      assignmentName: 'Legacy Assignment',
      tasks: {},
      submissions: [],
      // No documentType field - simulates old persisted data
    };

    const assignment = Assignment.fromJSON(legacyData);

    expect(assignment).toBeDefined();
    expect(assignment.courseId).toBe('c5');
    expect(assignment.assignmentId).toBe('as5');
    expect(assignment.assignmentName).toBe('Legacy Assignment');

    // Should be a base Assignment, not a subclass
    expect(assignment.constructor.name).toBe('Assignment');

    // Should not have documentType (or it should be undefined/null for base class)
    expect(assignment.documentType).toBeUndefined();
  });
});
