import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
const SheetsAssessor = require('../../src/backend/Assessors/SheetsAssessor.js');
import { createMockABLogger } from '../helpers/mockFactories.js';

class TestAssessment {
  constructor(score, reasoning) {
    this.score = score;
    this.reasoning = reasoning;
  }

  toJSON() {
    return {
      score: this.score,
      reasoning: this.reasoning,
    };
  }
}

class TestCellReferenceFeedback {
  constructor(items = []) {
    this.items = items;
  }

  addItem(location, status) {
    this.items.push({ location, status });
  }

  getItems() {
    return this.items;
  }

  toJSON() {
    return {
      type: 'cellReference',
      items: this.items,
    };
  }
}

describe('SheetsAssessor', () => {
  let originalABLogger;
  let originalProgressTracker;
  let originalAssessment;
  let originalCellReferenceFeedback;
  let mockABLogger;
  let mockProgressTracker;

  beforeEach(() => {
    originalABLogger = globalThis.ABLogger;
    originalProgressTracker = globalThis.ProgressTracker;
    originalAssessment = globalThis.Assessment;
    originalCellReferenceFeedback = globalThis.CellReferenceFeedback;

    mockABLogger = createMockABLogger(vi);
    mockProgressTracker = {
      updateProgress: vi.fn(),
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };

    globalThis.ABLogger = {
      getInstance: () => mockABLogger,
    };
    globalThis.ProgressTracker = {
      getInstance: () => mockProgressTracker,
    };
    globalThis.Assessment = TestAssessment;
    globalThis.CellReferenceFeedback = TestCellReferenceFeedback;
  });

  afterEach(() => {
    globalThis.ABLogger = originalABLogger;
    globalThis.ProgressTracker = originalProgressTracker;
    globalThis.Assessment = originalAssessment;
    globalThis.CellReferenceFeedback = originalCellReferenceFeedback;
    vi.restoreAllMocks();
  });

  it('assesses spreadsheet items from artifact content and primary references', () => {
    const taskId = 'task-1';
    const submission = {
      studentId: 'student-1',
      student: { name: 'Student One' },
      items: {
        [taskId]: {
          response: [
            { formula: '=SUM(A1:A2)', location: [1, 2] },
            { formula: '', location: [1, 3] },
            { formula: '=C2', location: [2, 2] },
          ],
        },
      },
      addAssessment(taskKey, criterion, assessment) {
        const item = this.items[taskKey];
        item.assessments = item.assessments || {};
        item.assessments[criterion] = assessment.toJSON ? assessment.toJSON() : assessment;
      },
      addFeedback(taskKey, feedback) {
        const item = this.items[taskKey];
        item.feedback = item.feedback || {};
        item.feedback.cellReference = feedback.toJSON ? feedback.toJSON() : feedback;
      },
    };
    const assessor = new SheetsAssessor(
      {
        [taskId]: {
          taskReference: [
            { referenceFormula: '=SUM(A1:A2)' },
            { referenceFormula: '=B1' },
            { referenceFormula: '=C1' },
          ],
        },
      },
      [submission]
    );

    assessor.assessResponses();

    const submissionItem = submission.items[taskId];
    expect(submissionItem.assessments.completeness).toMatchObject({ score: 3.33 });
    expect(submissionItem.assessments.accuracy).toMatchObject({ score: 2.5 });
    expect(submissionItem.assessments.spag).toMatchObject({ score: 'N' });
    expect(submissionItem.assessments.formulaComparison).toMatchObject({
      correct: 1,
      incorrect: 1,
      notAttempted: 1,
    });
    expect(submissionItem.feedback.cellReference).toEqual({
      type: 'cellReference',
      items: [
        { location: [1, 2], status: 'correct' },
        { location: [1, 3], status: 'notAttempted' },
        { location: [2, 2], status: 'incorrect' },
      ],
    });
    expect(mockProgressTracker.logError).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'defaults a missing start row to the top row',
      bbox: { startColumn: 4 },
      expectedLocation: [0, 3],
    },
    {
      caseName: 'defaults a missing start column to the first column',
      bbox: { startRow: 3 },
      expectedLocation: [2, 0],
    },
    {
      caseName: 'defaults both missing bbox coordinates to the first cell',
      bbox: {},
      expectedLocation: [0, 0],
    },
  ])(
    'uses safe defaults when bbox metadata is partial: $caseName',
    ({ bbox, expectedLocation }) => {
      const assessor = new SheetsAssessor({}, []);

      const referenceArray = [{ referenceFormula: '=A1' }];
      const studentArray = [{ formula: '=A1', location: expectedLocation }];
      const comparisonResults = assessor._compareFormulaArrays(referenceArray, studentArray);

      expect(comparisonResults.cellReferenceFeedback.getItems()).toEqual([
        { location: expectedLocation, status: 'correct' },
      ]);
      expect(comparisonResults.cellReferenceFeedback.getItems()[0].location).not.toContain(NaN);
    }
  );
});
