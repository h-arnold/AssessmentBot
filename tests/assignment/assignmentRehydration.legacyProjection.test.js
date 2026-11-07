/**
 * Legacy read preparation facade seam: per-marker preservation.
 *
 * These tests target the pure `prepareLegacyReadSubmissions()` facade only; the
 * wire callers (`toReadJSON`/`ABClassResponseMapper`) own the marker mapping and
 * have their own suites, and the detailed preservation/corruption rules live in
 * the `assignmentLegacyReadPreparation` suites. The retired detached reassessment
 * projection discarded every historical mark for missing, null and unsupported
 * stored markers alike; these cases pin the replacement: real marks, feedback
 * and identities are preserved for every legacy marker.
 */
import { describe, expect, it } from 'vitest';
import { currentAssignmentJson } from './assignmentRehydrationCurrentSupport.js';
import { restoreLegacy } from './assignmentLegacyReadPreparationSupport.js';

const Rehydration = require('#backend/AssignmentProcessor/Assignment/02_AssignmentRehydration.js');

/** Stored legacy markers that must all prepare preserved read results. */
const LEGACY_MARKER_CASES = [
  ['missing', (record) => Reflect.deleteProperty(record, 'assessmentContractVersion')],
  ['null', (record) => (record.assessmentContractVersion = null)],
  ['unsupported', (record) => (record.assessmentContractVersion = 88)],
];

describe('legacy read preparation facade preserves history for every legacy marker', () => {
  it.each(LEGACY_MARKER_CASES)(
    'keeps historical scores, feedback and identities for a %s stored marker',
    (_label, applyMarker) => {
      const record = currentAssignmentJson();
      applyMarker(record);
      const stored = structuredClone(record.submissions);
      const restored = restoreLegacy(record);
      expect(restored.assessmentContractVersion).not.toBe(1);

      const prepared = Rehydration.prepareLegacyReadSubmissions(restored, 'full');

      // Preparation walks the stored submissions in stored order and keeps
      // every identity, mark and feedback body exactly as stored.
      expect(prepared.map((submission) => submission.studentId)).toEqual(
        stored.map((submission) => submission.studentId)
      );
      prepared.forEach((submission, index) => {
        expect(Object.keys(submission.items).sort()).toEqual(
          Object.keys(stored[index].items).sort()
        );
        for (const [taskId, storedItem] of Object.entries(stored[index].items)) {
          expect(submission.items[taskId].assessments).toEqual(storedItem.assessments);
          expect(submission.items[taskId].feedback).toEqual(storedItem.feedback);
        }
      });
      // Preparation never rewrites the restored instance's raw state.
      expect(restored.toJSON().submissions).toEqual(stored);
      expect(record.submissions).toEqual(stored);
    }
  );

  it('rejects an unsupported preparation form', () => {
    const record = currentAssignmentJson();
    Reflect.deleteProperty(record, 'assessmentContractVersion');
    const restored = restoreLegacy(record);

    expect(() => Rehydration.prepareLegacyReadSubmissions(restored, 'not-a-form')).toThrow(
      /Invalid legacy read preparation form/
    );
  });

  it('prepares deterministic results across repeated facade calls', () => {
    const record = currentAssignmentJson();
    Reflect.deleteProperty(record, 'assessmentContractVersion');
    const before = structuredClone(record);
    const restored = restoreLegacy(record);

    const first = Rehydration.prepareLegacyReadSubmissions(restored, 'full');
    const second = Rehydration.prepareLegacyReadSubmissions(restored, 'full');
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));

    // A mutated result never reaches the instance, the input or a later result.
    const headTaskId = Object.keys(first[0].items)[0];
    first[0].items[headTaskId].feedback = { mutated: true };
    first[0].items[headTaskId].assessments.completeness.score = 99;
    expect(restored.toJSON().submissions).toEqual(before.submissions);
    expect(JSON.stringify(Rehydration.prepareLegacyReadSubmissions(restored, 'full'))).toBe(
      JSON.stringify(second)
    );
    expect(record).toEqual(before);
  });
});
