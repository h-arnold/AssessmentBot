import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SheetsAssessor from '../../src/AdminSheet/Assessors/SheetsAssessor.js';
import { TaskDefinition } from '../../src/AdminSheet/Models/TaskDefinition.js';
import { StudentSubmission } from '../../src/AdminSheet/Models/StudentSubmission.js';
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
    const taskDefinition = new TaskDefinition({
      taskTitle: 'Formula task',
      pageId: 17,
      taskMetadata: {
        bbox: {
          startRow: 2,
          startColumn: 3,
        },
      },
    });
    taskDefinition.addReferenceArtifact({
      type: 'SPREADSHEET',
      content: [
        ['=SUM(A1:A2)', '=B1'],
        ['=C1', ''],
      ],
    });

    const submission = new StudentSubmission('student-1', 'assignment-1', 'doc-1', 'Student One');
    submission.upsertItemFromExtraction(taskDefinition, {
      content: [
        ['=SUM(A1:A2)', ''],
        ['=C2', ''],
      ],
    });

    const taskId = taskDefinition.getId();
    const assessor = new SheetsAssessor({ [taskId]: taskDefinition }, [submission]);

    assessor.assessResponses();

    const submissionItem = submission.getItem(taskId);
    expect(submissionItem.getAssessment('completeness')).toMatchObject({ score: 3.33 });
    expect(submissionItem.getAssessment('accuracy')).toMatchObject({ score: 2.5 });
    expect(submissionItem.getAssessment('spag')).toMatchObject({ score: 'N' });
    expect(submissionItem.assessments.formulaComparison).toMatchObject({
      correct: 1,
      incorrect: 1,
      notAttempted: 1,
      totalFormulae: 3,
    });
    expect(submissionItem.getFeedback('cellReference')).toEqual({
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

      const comparisonResults = assessor._compareGridFormulaArrays([['=A1']], [['=A1']], {
        bbox,
      });

      expect(comparisonResults.cellReferenceFeedback.getItems()).toEqual([
        { location: expectedLocation, status: 'correct' },
      ]);
      expect(comparisonResults.cellReferenceFeedback.getItems()[0].location).not.toContain(NaN);
    }
  );

  it('treats vertical SUM ranges and direct addition as equivalent in grid comparisons', () => {
    const assessor = new SheetsAssessor({}, []);

    const comparisonResults = assessor._compareGridFormulaArrays([['=SUM(A1:A2)']], [['=A1+A2']], {
      bbox: {
        startRow: 4,
        startColumn: 2,
      },
    });

    expect(comparisonResults).toMatchObject({
      correct: 1,
      incorrect: 0,
      notAttempted: 0,
      totalFormulae: 1,
    });
    expect(comparisonResults.incorrectFormulae).toEqual([]);
    expect(comparisonResults.cellReferenceFeedback.getItems()).toEqual([
      { location: [3, 1], status: 'correct' },
    ]);
  });

  it('treats reversed addition order as equivalent to a horizontal SUM range in grid comparisons', () => {
    const assessor = new SheetsAssessor({}, []);

    const comparisonResults = assessor._compareGridFormulaArrays([['=SUM(A1:B1)']], [['=B1+A1']], {
      bbox: {
        startRow: 1,
        startColumn: 1,
      },
    });

    expect(comparisonResults).toMatchObject({
      correct: 1,
      incorrect: 0,
      notAttempted: 0,
      totalFormulae: 1,
    });
    expect(comparisonResults.incorrectFormulae).toEqual([]);
    expect(comparisonResults.cellReferenceFeedback.getItems()).toEqual([
      { location: [0, 0], status: 'correct' },
    ]);
  });

  it('keeps wider SUM ranges incorrect when they are outside the supported equivalence rules', () => {
    const assessor = new SheetsAssessor({}, []);

    const comparisonResults = assessor._compareGridFormulaArrays([['=SUM(A1:A3)']], [['=A1+A2']], {
      bbox: {
        startRow: 2,
        startColumn: 5,
      },
    });

    expect(comparisonResults).toMatchObject({
      correct: 0,
      incorrect: 1,
      notAttempted: 0,
      totalFormulae: 1,
    });
    expect(comparisonResults.incorrectFormulae).toEqual([
      {
        studentFormula: '=A1+A2',
        referenceFormula: '=SUM(A1:A3)',
        location: [1, 4],
      },
    ]);
    expect(comparisonResults.cellReferenceFeedback.getItems()).toEqual([
      { location: [1, 4], status: 'incorrect' },
    ]);
  });

  it('treats equivalent SUM and addition formulae as correct in legacy comparisons', () => {
    const assessor = new SheetsAssessor({}, []);

    const comparisonResults = assessor._compareLegacyFormulaArrays(
      [
        {
          referenceFormula: '=SUM(A1:A2)',
          location: [6, 3],
        },
      ],
      [
        {
          formula: '=A1+A2',
          location: [6, 3],
        },
      ]
    );

    expect(comparisonResults).toMatchObject({
      correct: 1,
      incorrect: 0,
      notAttempted: 0,
      totalFormulae: 1,
    });
    expect(comparisonResults.incorrectFormulae).toEqual([]);
    expect(comparisonResults.cellReferenceFeedback.getItems()).toEqual([
      { location: [6, 3], status: 'correct' },
    ]);
  });
});
