/**
 * Focused tests for the shared class-summary fixtures.
 *
 * Only the two parameterised builders need direct coverage: the mode must reach
 * the parsed filter, and the count must truncate the newest-first assignment
 * list. Derivation behaviour stays in the two sibling analyser specs.
 *
 * @module test/dataAnalysis/classSummaryFixtures.spec
 */

import { describe, expect, it } from 'vitest';
import { buildMediumInput, buildSummaryOptions } from './classSummaryFixtures';

/** Count used to check that the recent-assignment list is truncated. */
const RECENT_ASSIGNMENT_COUNT = 3;

describe('classSummaryFixtures', () => {
  it('propagates the requested analysis mode into the parsed input filter', () => {
    expect(buildMediumInput('absolute').filter.analysisMode).toBe('absolute');
    expect(buildMediumInput('topDecileBaseline').filter.analysisMode).toBe('topDecileBaseline');
  });

  it('truncates the newest-first recent assignments to the requested count', () => {
    const input = buildMediumInput('absolute');
    const assignments = input.classes[0].assignments;
    const single = buildSummaryOptions(input, 1);
    const multiple = buildSummaryOptions(input, RECENT_ASSIGNMENT_COUNT);

    expect(single.recentAssignments).toHaveLength(1);
    expect(multiple.recentAssignments).toHaveLength(
      Math.min(RECENT_ASSIGNMENT_COUNT, assignments.length)
    );
    expect(single.target).toEqual(assignments.toReversed()[0]);
    expect(multiple.recentAssignments).toEqual(
      assignments.toReversed().slice(0, RECENT_ASSIGNMENT_COUNT)
    );
  });
});
