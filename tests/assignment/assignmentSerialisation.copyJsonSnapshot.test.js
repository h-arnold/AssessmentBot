/**
 * AssignmentSerialisation.copyJsonSnapshot Date handling.
 *
 * JsonDbApp revives stored ISO strings as live `Date` objects. Copying a `Date` key by key
 * produces `{}`, which was persisted over the assignment definition timestamps.
 */

import { describe, expect, it } from 'vitest';
import { AssignmentDefinition } from '#backend/Models/AssignmentDefinition.js';

const AssignmentSerialisation =
  require('#backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js')
    .AssignmentSerialisation ?? globalThis.AssignmentSerialisation;

const ISO = '2026-11-05T15:03:36.136Z';

describe('AssignmentSerialisation.copyJsonSnapshot Dates', () => {
  it('converts a live Date to its ISO string', () => {
    expect(AssignmentSerialisation.copyJsonSnapshot(new Date(ISO))).toBe(ISO);
  });

  it('converts nested and array Dates, leaving other values untouched', () => {
    const copy = AssignmentSerialisation.copyJsonSnapshot({
      createdAt: new Date(ISO),
      nested: { updatedAt: new Date(ISO), name: 'x', missing: null },
      list: [new Date(ISO), 1, 'a'],
    });

    expect(copy).toEqual({
      createdAt: ISO,
      nested: { updatedAt: ISO, name: 'x', missing: null },
      list: [ISO, 1, 'a'],
    });
  });

  it('keeps revived assignment definition timestamps as strings', () => {
    const revived = new Date(ISO);
    const definition = AssignmentDefinition.fromJSON({
      primaryTitle: 't',
      primaryTopic: 'p',
      yearGroupKey: 'y',
      assignmentWeighting: 1,
      documentType: 'SLIDES',
      referenceDocumentId: 'r',
      templateDocumentId: 't2',
      referenceLastModified: revived,
      templateLastModified: revived,
      createdAt: revived,
      updatedAt: revived,
      tasks: {},
    });

    const copy = AssignmentSerialisation.copyJsonSnapshot(definition.toJSON());

    expect(copy.referenceLastModified).toBe(ISO);
    expect(copy.templateLastModified).toBe(ISO);
    expect(copy.createdAt).toBe(ISO);
    expect(copy.updatedAt).toBe(ISO);
  });
});
