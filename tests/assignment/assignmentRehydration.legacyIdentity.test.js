/**
 * Legacy read preparation identity and definition trust boundaries.
 *
 * Preparation reuses the marker-1 identity check: every stored submission needs
 * a non-blank string `studentId` matching its parent assignment, so the retired
 * projector's `userId`-only fallback is gone. Root identity is rejected at
 * legacy restoration, and embedded-definition trust faults reject loudly instead
 * of being relabelled E or silently prepared.
 */
import { describe, expect, it } from 'vitest';
import {
  currentAssignmentJson,
  rawPartialEmbeddedSnapshot,
  restoreAssignment,
} from './assignmentRehydrationCurrentSupport.js';

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');

/** A stored legacy full record with its marker removed. */
function legacyFull() {
  const record = currentAssignmentJson();
  Reflect.deleteProperty(record, 'assessmentContractVersion');
  return record;
}

/** A stored legacy class-embedded record with a summary-array definition. */
function legacyPartial() {
  const partial = rawPartialEmbeddedSnapshot(legacyFull());
  // The snapshot helper stamps the current marker; legacy restoration needs it gone.
  Reflect.deleteProperty(partial, 'assessmentContractVersion');
  return partial;
}

describe('legacy read preparation submission identity boundaries', () => {
  it.each([
    ['a non-string student id', (record) => (record.submissions[0].studentId = 4)],
    [
      'a userId-only history row (the removed projector fallback)',
      (record) => {
        record.submissions[0].userId = record.submissions[0].studentId;
        Reflect.deleteProperty(record.submissions[0], 'studentId');
      },
    ],
  ])('rejects %s instead of preparing it', (_label, corrupt) => {
    const record = legacyFull();
    corrupt(record);
    // Restoration keeps raw legacy rows as stored; preparation owns the
    // per-submission identity check, shared with marker-1 records.
    const restored = restoreAssignment(record);
    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'full')).toThrow(
      /identity|student|submission/i
    );
  });

  it.each([
    ['a missing course id', (record) => Reflect.deleteProperty(record, 'courseId')],
    ['a missing assignment id', (record) => Reflect.deleteProperty(record, 'assignmentId')],
  ])('rejects %s at legacy restoration, before preparation can run', (_label, corrupt) => {
    const record = legacyFull();
    corrupt(record);
    expect(() => restoreAssignment(record)).toThrow(/courseId and assignmentId are required/);
  });
});

describe('legacy read preparation embedded-definition trust boundaries', () => {
  it.each([
    [
      'an absent embedded definition',
      (record) => Reflect.deleteProperty(record, 'assignmentDefinition'),
    ],
    ['a null embedded definition', (record) => (record.assignmentDefinition = null)],
  ])('rejects %s loudly at restoration, before preparation can run', (_label, corrupt) => {
    const record = legacyFull();
    corrupt(record);
    // The assignment factory fails fast on a record with no usable embedded
    // definition; preparation never receives such an instance.
    expect(() => restoreAssignment(record)).toThrow(TypeError);
  });

  it('rejects a restored instance whose definition was stripped before preparation', () => {
    const restored = restoreAssignment(legacyFull());
    restored.assignmentDefinition = null;
    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'full')).toThrow(
      /embedded task universe/
    );
  });

  it('rejects a summary definition carrying a missing task id', () => {
    const partial = legacyPartial();
    Reflect.deleteProperty(partial.assignmentDefinition.tasks[0], 'taskId');
    expect(Array.isArray(partial.assignmentDefinition.tasks)).toBe(true);
    const restored = restoreAssignment(partial);

    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'partial')).toThrow(
      /task universe/i
    );
  });

  it('prepares no invented submissions for empty stored history on either form', () => {
    const record = legacyFull();
    record.submissions = [];
    const restored = restoreAssignment(record);
    expect(Rehydration.prepareLegacyReadSubmissions(restored, 'full')).toEqual([]);
    expect(Rehydration.prepareLegacyReadSubmissions(restored, 'partial')).toEqual([]);
  });
});
