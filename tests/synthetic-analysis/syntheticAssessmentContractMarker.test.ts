import { describe, expect, it } from 'vitest';

import {
  createClassTransportBoundary,
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import { MARKER_RULE } from './syntheticAssessmentRedRules.js';
import { expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * Current-format marker validation regression suite: each validation owner must
 * reject an assignment whose `assessmentContractVersion` is null, a legacy
 * number, or missing, while the raw projection propagation tests stay separate.
 * Every mutation targets exactly one assignment record per row and each owning
 * subject starts from its canonicalised baseline.
 */

type RawRecord = Record<string, unknown>;

/** Marker corruption rows: values a non-current record would carry. */
const MARKER_CORRUPTION_ROWS: Array<{ label: string; value: null | number | undefined }> = [
  { label: 'a null marker', value: null },
  { label: 'a legacy numeric marker', value: 777 },
  { label: 'an omitted marker', value: undefined },
];

/**
 * Runs the marker corruption matrix for one owner factory.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, assignments?: () => RawRecord[]},
 * }} config Suite configuration.
 */
function runMarkerMatrix(config: {
  describe: string;
  subject: () => { validate: () => void; assignments?: () => RawRecord[] };
}) {
  describe(config.describe, () => {
    it('accepts its canonical baseline with current markers', () => {
      const subject = config.subject();
      const assignments = subject.assignments?.() ?? [];
      expect(assignments.length).toBeGreaterThan(0);
      const firstAssignment = assignments[0] as RawRecord;
      expect(Object.hasOwn(firstAssignment, 'assessmentContractVersion')).toBe(true);
      expect(firstAssignment.assessmentContractVersion).toBe(1);
      expect(subject.validate).not.toThrow();
    });

    it.each(MARKER_CORRUPTION_ROWS)('rejects the current-format change $label', ({ value }) => {
      const subject = config.subject();
      const assignment = subject.assignments?.()[0] as RawRecord;
      if (value === undefined) {
        delete assignment.assessmentContractVersion;
      } else {
        assignment.assessmentContractVersion = value;
      }
      expectRule(subject.validate, MARKER_RULE, [String(assignment.assignmentId)]);
    });
  });
}

runMarkerMatrix({
  describe: 'persistence current-format marker boundary',
  subject: createPersistenceBoundary,
});

runMarkerMatrix({
  describe: 'full transport current-format marker boundary',
  subject: createFullTransportBoundary,
});

runMarkerMatrix({
  describe: 'class partial transport current-format marker boundary',
  subject: () => createClassTransportBoundary('keyed'),
});

runMarkerMatrix({
  describe: 'partial-only transport current-format marker boundary',
  subject: () => createClassTransportBoundary('partialOnly'),
});
