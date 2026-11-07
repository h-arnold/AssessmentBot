/**
 * Non-array legacy submissions root passthrough on both read serialisers.
 *
 * A present non-array `submissions` value (an object or `null`) bypasses read
 * preparation entirely: `prepareLegacyReadSubmissions` returns `null` and both
 * read serialisers emit the preserved, date-normalised value with the
 * `'legacy'` marker instead of throwing first or replacing it with `[]`. The
 * frontend root validation then rejects the payload, so the backend must not
 * throw first. This is the read-side twin of the persistence preservation rule.
 */
import { describe, expect, it } from 'vitest';
import {
  healthyFullRecord,
  partialSnapshot,
  restoreLegacy,
} from './assignmentLegacyReadPreparationSupport.js';

const ABClassResponseMapper = require('#backend/y_controllers/ABClassController/ABClassResponseMapper.js');

/** Builds a class read view around one restored legacy assignment and roster. */
function classView(assignment, students) {
  return {
    classId: 'class-non-array-root',
    className: null,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: null,
    classOwner: null,
    teachers: [],
    students,
    active: true,
    metadata: null,
    assignments: [assignment],
    serialiseOwner: (owner) => owner,
  };
}

/** Restores the record and reads it through the real class response mapper. */
function classRead(record) {
  const assignment = restoreLegacy(record);
  const students = [{ studentId: 'roster-only', studentName: 'Roster learner' }];
  return new ABClassResponseMapper()._toReadView(classView(assignment, students)).assignments[0];
}

describe('legacy non-array submissions root on both read serialisers', () => {
  it('emits the preserved object body date-normalised with the legacy marker on a full read', () => {
    const record = healthyFullRecord();
    record.submissions = {
      preserved: { marks: [null, { score: 3 }] },
      stampedAt: new Date('2021-02-03T04:05:06.000Z'),
    };
    Reflect.deleteProperty(record, 'assessmentContractVersion');

    const read = restoreLegacy(record).toReadJSON();

    expect(read.assessmentContractVersion).toBe('legacy');
    expect(read.submissions).toEqual({
      preserved: { marks: [null, { score: 3 }] },
      stampedAt: '2021-02-03T04:05:06.000Z',
    });
  });

  it('emits the preserved null root with the legacy marker on a partial-definition class read', () => {
    const record = partialSnapshot(healthyFullRecord());
    record.submissions = null;

    const view = classRead(record);

    expect(view.assessmentContractVersion).toBe('legacy');
    expect(view.submissions).toBeNull();
    expect(view.assignmentDefinitionKey).toEqual(expect.any(String));
    expect(view).not.toHaveProperty('assignmentDefinition');
  });

  it('emits the preserved object body with the legacy marker on a full-definition class read', () => {
    const record = healthyFullRecord();
    const storedBody = { preserved: { opaque: [null, { body: 'unchanged' }] } };
    record.submissions = storedBody;

    const view = classRead(record);

    expect(view.assessmentContractVersion).toBe('legacy');
    expect(view.submissions).toEqual(storedBody);
    expect(view.assignmentDefinitionKey).toEqual(expect.any(String));
    expect(view).not.toHaveProperty('assignmentDefinition');
  });
});
