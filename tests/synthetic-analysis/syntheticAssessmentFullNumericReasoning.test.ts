import { describe, expect, it } from 'vitest';

import {
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';
import { REASONING_RULE, expectRule } from './syntheticAssessmentValidationRules.js';

/**
 * Full non-E reasoning regression suite: the independent full representation
 * requires a string reasoning beside every non-E entry, including numeric and
 * "N" scores, so a missing or non-string full reasoning is rejected while a
 * deliberately blank string stays valid. The partial representation stays
 * score-only and is covered by the separate partial redaction suites.
 */

type Target = { item: Record<string, unknown>; submission: Record<string, unknown> };
type Owner = { validate: () => void; healthyDocumentTarget: () => Target };

/** Reasoning corruptions the full-domain owners must reject. */
const FULL_REASONING_ROWS: Array<{
  label: string;
  score: number | 'N';
  mutate: (entry: Record<string, unknown>) => void;
}> = [
  {
    label: 'missing numeric reasoning',
    score: 4,
    mutate: (entry) => {
      delete entry.reasoning;
    },
  },
  {
    label: 'numeric reasoning',
    score: 3,
    mutate: (entry) => {
      entry.reasoning = 42;
    },
  },
  {
    label: 'missing N reasoning',
    score: 'N',
    mutate: (entry) => {
      delete entry.reasoning;
    },
  },
  {
    label: 'numeric N reasoning',
    score: 'N',
    mutate: (entry) => {
      entry.reasoning = 42;
    },
  },
];

/** The criterion whose entry every row mutates. */
const MUTATED_CRITERION = 'completeness';

/**
 * Rewrites one criterion entry of a document item with the row's score and
 * mutated reasoning, keeping the other criteria canonical.
 *
 * @param {Target} target Healthy document item target.
 * @param {{score: number | 'N', mutate: (entry: Record<string, unknown>) => void}} row
 *   Reasoning corruption row under test.
 */
function applyReasoningRow(
  target: Target,
  row: { score: number | 'N'; mutate: (entry: Record<string, unknown>) => void }
): void {
  const assessments = target.item.assessments as Record<string, Record<string, unknown>>;
  entryWithScore(assessments, 'accuracy', 5);
  entryWithScore(assessments, 'spag', 3);
  const entry = entryWithScore(assessments, MUTATED_CRITERION, row.score);
  row.mutate(entry);
}

/**
 * Replaces one criterion's entry with a full score-only record with canonical
 * reasoning so an unrelated criterion cannot fire first.
 *
 * @param {Record<string, unknown>} assessments Assessment map under test.
 * @param {string} criterion Criterion key.
 * @param {number | 'N'} score Entry score.
 * @returns {Record<string, unknown>} The rewritten entry.
 */
function entryWithScore(
  assessments: Record<string, unknown>,
  criterion: string,
  score: number | 'N'
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    score,
    reasoning: `Canonical synthetic evidence for ${criterion}.`,
  };
  if (score === 'N') entry.reasoning = '';
  assessments[criterion] = entry;
  return entry;
}

/**
 * Runs the full numeric/N reasoning matrix for one full representation owner.
 *
 * @param {{describe: string, subject: () => Owner}} config Suite configuration.
 */
function runFullReasoningMatrix(config: { describe: string; subject: () => Owner }): void {
  describe(config.describe, () => {
    it('accepts the healthy document item before any reasoning mutation', () => {
      const subject = config.subject();
      expect(subject.validate).not.toThrow();
    });

    it.each(FULL_REASONING_ROWS)('rejects a full entry with $label', (row) => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      applyReasoningRow(target, row);
      expectRule(subject.validate, REASONING_RULE, [String(target.item.taskId), MUTATED_CRITERION]);
    });

    it('accepts full numeric and N entries with a deliberately blank string reasoning', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      const assessments = target.item.assessments as Record<string, Record<string, unknown>>;
      entryWithScore(assessments, 'accuracy', 5);
      entryWithScore(assessments, 'spag', 3);
      const completeness = entryWithScore(assessments, 'completeness', 4);
      completeness.reasoning = '';
      expect(subject.validate).not.toThrow();
    });
  });
}

runFullReasoningMatrix({
  describe: 'persistence full numeric/N reasoning boundary',
  subject: createPersistenceBoundary,
});

runFullReasoningMatrix({
  describe: 'full transport numeric/N reasoning boundary',
  subject: createFullTransportBoundary,
});
