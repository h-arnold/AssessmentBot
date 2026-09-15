import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SheetsAssessor from '../../src/backend/Assessors/SheetsAssessor.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic branch coverage for the spreadsheet assessors: formula
// equivalence shapes and the SheetsAssessor scoring pipeline. Formula
// equivalence is exercised through the setupGlobals global (CommonJS loader);
// SheetsAssessor through the ESM import shared with the existing suite.
class TestAssessment {
  constructor(score, reasoning) {
    this.score = score;
    this.reasoning = reasoning;
  }

  toJSON() {
    return { score: this.score, reasoning: this.reasoning };
  }
}

class TestCellReferenceFeedback {
  constructor() {
    this.items = [];
  }

  addItem(location, status) {
    this.items.push({ location, status });
  }

  toJSON() {
    return { type: 'cellReference', items: this.items };
  }
}

class PlainCellReferenceFeedback {
  constructor() {
    this.items = [];
  }

  addItem(location, status) {
    this.items.push({ location, status });
  }
}

describe('SpreadsheetFormulaEquivalence behaviour', () => {
  const equivalence = () => globalThis.SpreadsheetFormulaEquivalence;

  it('matches identical formulae immediately', () => {
    expect(equivalence().areEquivalent('=A1', '=A1')).toBe(true);
  });

  it('rejects missing inputs', () => {
    expect(equivalence().areEquivalent(null, '=A1')).toBe(false);
    expect(equivalence().areEquivalent('=A1', undefined)).toBe(false);
    expect(equivalence().areEquivalent('', '')).toBe(true);
  });

  it('rejects pairs without a plausible addition shape', () => {
    expect(equivalence().areEquivalent('=A1', '=B1')).toBe(false);
    expect(equivalence().areEquivalent('=A1+A2', '=B1')).toBe(false);
    expect(equivalence().areEquivalent('=A1', '=B1+B2')).toBe(false);
  });

  it('rejects unparseable signatures after the structural check', () => {
    expect(equivalence().areEquivalent('=!+A2', '=!+B2')).toBe(false);
    expect(equivalence().areEquivalent('=A1+A2', '=BOGUS!+B2')).toBe(false);
  });

  it('matches order independent additions and ranges', () => {
    expect(equivalence().areEquivalent('=A1+A2', '=A2+A1')).toBe(true);
    expect(equivalence().areEquivalent('=SUM(A1:A2)', '=A1+A2')).toBe(true);
    expect(equivalence().areEquivalent('=A1+A2', '=A1+A3')).toBe(false);
  });

  it('detects sum candidates by shape', () => {
    const target = equivalence();
    expect(target._isSumCandidate('=SUM(A1:A2)')).toBe(true);
    expect(target._isSumCandidate('=SUM(A1)')).toBe(false);
    expect(target._isSumCandidate('SUM(A1:A2)')).toBe(false);
    expect(target._isSumCandidate('=SUM(A1:A2')).toBe(false);
  });

  it('returns null signatures for empty or unsupported formulae', () => {
    const target = equivalence();
    expect(target._getSimpleAdditionSignature('')).toBeNull();
    expect(target._getSimpleAdditionSignature(null)).toBeNull();
    expect(target._getSimpleAdditionSignature('=AVERAGE(A1:A2)')).toBeNull();
    expect(target._getSimpleAdditionSignature('=SUM(A1:A1)')).toBeNull();
    expect(target._getSimpleAdditionSignature('=A1+A2')).toContain('1|1');
  });

  it('parses absolute, sheet qualified and multi letter references', () => {
    const target = equivalence();
    expect(target._parseA1Reference('')).toBeNull();
    expect(target._parseA1Reference('!')).toBeNull();
    expect(target._parseA1Reference('!A1')).toBeNull();
    expect(target._parseA1Reference('Sheet1!')).toBeNull();
    expect(target._parseA1Reference('$A$1')).toMatchObject({ rowNumber: 1, columnNumber: 1 });
    expect(target._parseA1Reference('Sheet1!$AA$10')).toMatchObject({
      sheetName: 'Sheet1',
      rowNumber: 10,
      columnNumber: 27,
    });
    expect(target._parseA1Reference('a1')).toBeNull();
    expect(target._parseA1Reference('A')).toBeNull();
    expect(target._parseA1Reference('A0')).toBeNull();
    expect(target._parseA1Reference('1A')).toBeNull();
  });

  it('validates two cell range geometry', () => {
    const target = equivalence();
    const start = { sheetName: '', rowNumber: 1, columnNumber: 1 };
    const across = { sheetName: '', rowNumber: 1, columnNumber: 2 };
    const below = { sheetName: '', rowNumber: 2, columnNumber: 1 };
    expect(target._createTwoCellRangeSignature(null, across)).toBeNull();
    expect(target._createTwoCellRangeSignature(start, null)).toBeNull();
    expect(
      target._createTwoCellRangeSignature(start, { ...across, sheetName: 'Other' })
    ).toBeNull();
    expect(target._createTwoCellRangeSignature(start, start)).toBeNull();
    expect(
      target._createTwoCellRangeSignature(start, { sheetName: '', rowNumber: 2, columnNumber: 2 })
    ).toBeNull();
    expect(
      target._createTwoCellRangeSignature(start, { sheetName: '', rowNumber: 1, columnNumber: 3 })
    ).toBeNull();
    expect(
      target._createTwoCellRangeSignature(start, { sheetName: '', rowNumber: 3, columnNumber: 1 })
    ).toBeNull();
    expect(target._createTwoCellRangeSignature(start, across)).toContain('1|1');
    expect(target._createTwoCellRangeSignature(start, below)).toContain('2|1');
  });
});

describe('SheetsAssessor response handling', () => {
  let restoreGlobals;
  let mockLogger;
  let mockTracker;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    mockTracker = {
      updateProgress: vi.fn(),
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      ProgressTracker: () => ({ getInstance: () => mockTracker }),
      Assessment: () => TestAssessment,
      CellReferenceFeedback: () => TestCellReferenceFeedback,
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  function spreadsheetItem(content) {
    return {
      getType: () => 'SPREADSHEET',
      artifact: { content },
      addAssessment: vi.fn(),
      assessments: {},
      addFeedback: vi.fn(),
    };
  }

  function referenceTask(content, taskMetadata = {}) {
    return {
      taskMetadata,
      getPrimaryReference: () => ({ content }),
    };
  }

  it('warns and skips submissions without items', () => {
    const assessor = new SheetsAssessor({}, [{ studentName: 'No Items' }, null]);
    assessor.assessResponses();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Submission or items missing for student: No Items'
    );
    expect(mockTracker.updateProgress).not.toHaveBeenCalled();
  });

  it('skips items without assessable spreadsheet types', () => {
    const assessor = new SheetsAssessor({}, [
      {
        studentId: 's-one',
        items: {
          broken: null,
          text: { getType: () => 'TEXT' },
        },
      },
    ]);
    assessor.assessResponses();
    expect(mockTracker.logAndThrowError).not.toHaveBeenCalled();
  });

  it('throws when the reference task is missing', () => {
    const assessor = new SheetsAssessor({}, [
      { studentId: 's-two', items: { task_one: spreadsheetItem([['=A1']]) } },
    ]);
    expect(() => assessor.assessResponses()).toThrow('Reference task missing for task_one');
  });

  it('skips tasks with invalid assessment inputs', () => {
    const item = spreadsheetItem('not-an-array');
    const assessor = new SheetsAssessor({ task_one: referenceTask('also-not-an-array') }, [
      { studentId: 's-three', items: { task_one: item } },
    ]);
    assessor.assessResponses();
    expect(mockTracker.logError).toHaveBeenCalledWith(
      expect.stringContaining('Invalid data for formula assessment')
    );
    expect(item.addAssessment).not.toHaveBeenCalled();
  });

  it('warns when no reference formulae exist', () => {
    const item = spreadsheetItem([['']]);
    const assessor = new SheetsAssessor({ task_one: referenceTask([['']]) }, [
      { studentName: 'Empty Ref', items: { task_one: item } },
    ]);
    assessor.assessResponses();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No reference formulae found')
    );
  });

  it('assesses formulae and stores serialised comparisons', () => {
    const item = spreadsheetItem([['=A1+A2']]);
    const assessor = new SheetsAssessor({ task_one: referenceTask([['=A2+A1']]) }, [
      { studentName: 'Student One', items: { task_one: item } },
    ]);
    assessor.assessResponses();
    expect(item.addAssessment).toHaveBeenCalledTimes(3);
    expect(item.assessments.formulaComparison).toMatchObject({ totalFormulae: 1 });
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('serialises feedback with and without toJSON support', () => {
    const assessor = new SheetsAssessor({}, []);
    const withJson = { cellReferenceFeedback: new TestCellReferenceFeedback(), totalFormulae: 1 };
    expect(assessor._serialiseFormulaComparisonResults(withJson).cellReferenceFeedback).toEqual({
      type: 'cellReference',
      items: [],
    });
    const plain = { cellReferenceFeedback: new PlainCellReferenceFeedback(), totalFormulae: 1 };
    expect(assessor._serialiseFormulaComparisonResults(plain).cellReferenceFeedback).toBeInstanceOf(
      PlainCellReferenceFeedback
    );
  });

  it('compares grids with bounding box offsets and ragged rows', () => {
    const assessor = new SheetsAssessor({}, []);
    const compared = assessor._compareGridFormulaArrays(
      [['=A1+A2', ''], 'not-a-row', ['=B1']],
      [['=A2+A1'], [], ['']],
      { boundingBox: { startRow: 2, startColumn: 3 } }
    );
    expect(compared.totalFormulae).toBe(2);
    expect(compared.correct).toBe(1);
    expect(compared.notAttempted).toBe(1);

    const withoutBox = assessor._compareGridFormulaArrays([['=A1']], [['=B1']], {});
    expect(withoutBox.incorrect).toBe(1);
    expect(withoutBox.incorrectFormulae[0]).toMatchObject({ referenceFormula: '=A1' });
  });

  it('formats incorrect formulae lists and reasoning strings', () => {
    const assessor = new SheetsAssessor({}, []);
    expect(assessor._formatIncorrectFormulaeList(null)).toBe('');
    expect(assessor._formatIncorrectFormulaeList([])).toBe('');
    const formatted = assessor._formatIncorrectFormulaeList([
      { studentFormula: '=B1', referenceFormula: '=A1' },
    ]);
    expect(formatted).toContain('Student Formula: =B1');

    const withIncorrect = assessor._generateAccuracyReasoning(
      { correct: 1, incorrect: 1, notAttempted: 0, incorrectFormulae: [] },
      2
    );
    expect(withIncorrect).toContain('Incorrect Formulae');
    const withoutIncorrect = assessor._generateAccuracyReasoning(
      { correct: 2, incorrect: 0, notAttempted: 0, incorrectFormulae: [] },
      2
    );
    expect(withoutIncorrect).not.toContain('Incorrect Formulae');
    expect(
      assessor._generateCompletenessReasoning({ correct: 1, incorrect: 1, notAttempted: 1 }, 3)
    ).toContain('Completed 2 out of 3');
  });

  it('scores completeness and accuracy at the boundaries', () => {
    const assessor = new SheetsAssessor({}, []);
    expect(assessor.calculateFormulaeAssessmentScores({ correct: 0, notAttempted: 2 }, 2)).toEqual({
      completenessScore: 0,
      accuracyScore: 0,
      spagScore: 'N',
    });
    expect(assessor.calculateFormulaeAssessmentScores({ correct: 2, notAttempted: 0 }, 2)).toEqual({
      completenessScore: 5,
      accuracyScore: 5,
      spagScore: 'N',
    });
    const partial = assessor.calculateFormulaeAssessmentScores({ correct: 1, notAttempted: 1 }, 3);
    expect(partial.completenessScore).toBeGreaterThan(0);
    expect(partial.accuracyScore).toBeGreaterThan(0);
  });
});
