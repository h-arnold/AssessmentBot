/**
 * Capability probe for the opt-in multi-task run-stop selector. The default
 * harness selector stays single-task; this suite asserts the regenerated medium
 * corpus can supply numeric-healthy TEXT candidates across distinct tasks of one
 * assignment without relaxing any realism or type-matching gate.
 */
import { describe, expect, it } from 'vitest';
import {
  createMultiTaskRunStopAssignment,
  createRunStopAssignment,
} from '../helpers/llmRunStopHarness.js';

const MEDIUM_PROFILE = 'medium';

describe('run-stop harness multi-task capability', () => {
  it('selects numeric-healthy TEXT candidates spanning at least two tasks of one medium assignment', () => {
    const fixture = createMultiTaskRunStopAssignment(MEDIUM_PROFILE, 2);

    expect(fixture.numeric).toHaveLength(2);
    const taskIds = fixture.numeric.map((entry) => entry.task.id);
    expect(new Set(taskIds).size).toBeGreaterThanOrEqual(2);

    // The harness's numeric-healthy and type-matching gates stay intact; selected
    // numeric items are cleared to in-flight maps so they remain dispatch-eligible.
    for (const entry of fixture.numeric) {
      expect(entry.item.artifact.type).toBe('TEXT');
      expect(entry.task.artifacts.reference[0].type).toBe('TEXT');
      expect(entry.task.artifacts.template[0].type).toBe('TEXT');
      expect(entry.item.assessments).toEqual({});
    }
  });

  it('keeps single-task selection as the default harness behaviour', () => {
    const fixture = createRunStopAssignment(MEDIUM_PROFILE, 3);

    expect(fixture.numeric).toHaveLength(3);
    expect(new Set(fixture.numeric.map((entry) => entry.item.artifact.getUid())).size).toBe(3);
  });

  it('fails loudly when candidate selection cannot find the required TEXT/numeric pairs', () => {
    // Algorithmic boundary: the corpus's distinct-student guard caps numeric TEXT
    // candidates at 12 per medium assignment, so no corpus-backed count can reach
    // the loud-failure branch; a minimal impossible local count is used instead.
    const unsatisfiableCount = 99;

    expect(() => createRunStopAssignment(MEDIUM_PROFILE, unsatisfiableCount)).toThrow(
      new RegExp(
        `${MEDIUM_PROFILE} canonical inputs contain no assignment with ${unsatisfiableCount} numeric TEXT candidates`
      )
    );
    expect(() => createMultiTaskRunStopAssignment(MEDIUM_PROFILE, unsatisfiableCount)).toThrow(
      new RegExp(
        `no assignment with ${unsatisfiableCount} numeric TEXT candidates across at least two distinct tasks`
      )
    );
  });
});
