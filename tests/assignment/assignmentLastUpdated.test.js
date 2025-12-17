import { describe, it, expect, vi } from 'vitest';
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
    expect(a.getDocumentType()).toBe('SLIDES');
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
    expect(a.getDocumentType()).toBe('SHEETS');
    a.setLastUpdated(new Date(2021, 5, 6, 7, 8, 9));
    const json = a.toJSON();
    expect(json.lastUpdated).toBeTruthy();
    const restored = Assignment.fromJSON(json);
    expect(restored.getDocumentType()).toBe('SHEETS');
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

  it('should surface an error via ProgressTracker when documentType is missing', () => {
    const tracker = globalThis.ProgressTracker.getInstance();
    const logAndThrowSpy = vi.spyOn(tracker, 'logAndThrowError').mockImplementation((msg) => {
      throw new Error(`ProgressTracker: ${msg}`);
    });

    const legacyData = {
      courseId: 'c5',
      assignmentId: 'as5',
      assignmentName: 'Legacy Assignment',
      tasks: {},
      submissions: [],
      // No documentType field - simulates old persisted data
    };

    expect(() => Assignment.fromJSON(legacyData)).toThrow(
      /ProgressTracker: Assignment data missing documentType for courseId=c5, assignmentId=as5/
    );

    expect(logAndThrowSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing documentType'),
      expect.objectContaining({ data: expect.objectContaining(legacyData) })
    );
  });
});
