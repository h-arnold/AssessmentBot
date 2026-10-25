import { describe, expect, it } from 'vitest';

type Target = { item: Record<string, unknown>; submission: Record<string, unknown> };
import {
  createPersistenceBoundary,
  createFullTransportBoundary,
} from './syntheticAssessmentValidationOwners.js';

/**
 * Valid blank student spreadsheet regression suite: a successfully read blank
 * student SPREADSHEET submission is represented as the empty grid `[]` beside
 * its normal string hash and numeric completeness/accuracy scores of 0 with a
 * non-applicable SPaG of `'N'`. It is successfully read source content, not
 * unavailable content, and the validators must accept it; blank spreadsheet
 * references and blank templates keep their separate role-scoped contracts.
 */

/**
 * Applies the permitted blank student spreadsheet representation on a document
 * submission item: empty raw grid, normal string hash, and the partial-source
 * numeric results (0/0/N) beside their reasoning.
 *
 * @param {Target} target Owner target with the mutated item.
 * @returns {unknown} The stored raw grid.
 */
function applyBlankStudentSpreadsheet(target: Target) {
  const artefact = target.item.artifact as Record<string, unknown>;
  artefact.type = 'SPREADSHEET';
  artefact.content = [];
  artefact.contentHash = 'hash-blank-student-grid';
  target.item.assessments = {
    completeness: { score: 0, reasoning: 'The blank student grid carries no completed work.' },
    accuracy: { score: 0, reasoning: 'The blank student grid carries no completed work.' },
    spag: { score: 'N', reasoning: 'No prose is present for a SPaG assessment.' },
  };
  return artefact.content;
}

/**
 * Runs the blank student spreadsheet acceptance suite for one owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => {validate: () => void, healthyDocumentTarget: () => Target},
 * }} config Suite configuration.
 */
function runBlankStudentSpreadsheetMatrix(config: {
  describe: string;
  subject: () => {
    validate: () => void;
    healthyDocumentTarget: () => Target;
  };
}) {
  describe(config.describe, () => {
    it('accepts a successfully read blank student spreadsheet submission grid', () => {
      const subject = config.subject();
      const target = subject.healthyDocumentTarget();
      expect(target.submission.documentId).not.toBeNull();
      const storedGrid = applyBlankStudentSpreadsheet(target);
      expect(storedGrid).toStrictEqual([]);
      expect(subject.validate).not.toThrow();
    });
  });
}

runBlankStudentSpreadsheetMatrix({
  describe: 'persistence blank student spreadsheet boundary',
  subject: createPersistenceBoundary,
});

runBlankStudentSpreadsheetMatrix({
  describe: 'full transport blank student spreadsheet boundary',
  subject: createFullTransportBoundary,
});
