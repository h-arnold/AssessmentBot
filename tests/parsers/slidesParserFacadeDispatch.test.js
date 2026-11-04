import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  registerSlidesParserSuiteLifecycle,
  createShapeElement,
  createTableElement,
  createTableElementFromMock,
  createSlide,
  buildSlidesParserHarness,
} from '../helpers/slidesParserTestHarness.js';

// Facade dispatch regression: helpers must route preserved public methods
// through the SlidesParser facade so subclass overrides and spies stay observable.
describe('SlidesParser facade dispatch', () => {
  const refDocId = 'ref-doc-dispatch';
  const studentDocId = 'student-doc-dispatch';
  const suite = registerSlidesParserSuiteLifecycle({
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    vi,
  });

  it('routes definition shape reads through facade spies', () => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'Ref text')])],
    });
    const shapeSpy = vi.spyOn(parser, 'extractTextFromShape');
    const defs = parser.extractTaskDefinitions(refDocId);

    expect(defs).toHaveLength(1);
    expect(defs[0].getPrimaryReference().content).toBe('Ref text');
    expect(shapeSpy).toHaveBeenCalledTimes(1);
  });

  it('routes definition table reads through facade spies without recursion', () => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [createSlide(vi, 'page-1', [createTableElement(vi, '# Task Table', [['A']])])],
    });
    const tableSpy = vi.spyOn(parser, 'extractTableCells');
    const cellSpy = vi.spyOn(parser, 'extractCellText');
    const defs = parser.extractTaskDefinitions(refDocId);

    expect(defs).toHaveLength(1);
    expect(defs[0].getPrimaryReference().getType()).toBe('TABLE');
    expect(defs[0].getPrimaryReference().content).toContain('A');
    expect(tableSpy).toHaveBeenCalledTimes(1);
    expect(cellSpy).toHaveBeenCalledTimes(1);
  });

  it('honours a subclass override of shape text during definition extraction', () => {
    class OverrideParser extends suite.SlidesParser {
      extractTextFromShape() {
        return 'overridden';
      }
    }
    globalThis.SlidesApp.openById = vi.fn(() => ({
      getSlides: () => [
        createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'Ref text')]),
      ],
    }));
    const parser = new OverrideParser();
    const defs = parser.extractTaskDefinitions(refDocId);

    expect(defs[0].getPrimaryReference().content).toBe('overridden');
  });

  it('routes submission matching steps through facade spies', () => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [createSlide(vi, 'ref-page', [createShapeElement(vi, '# Task 1', 'Ref text')])],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createShapeElement(vi, '# Task 1', 'Answer')]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    const contextsSpy = vi.spyOn(parser, 'buildSubmissionSlideContexts');
    const indexSpy = vi.spyOn(parser, 'buildSubmissionIndex');
    const plansSpy = vi.spyOn(parser, 'buildSubmissionCandidatePlans');
    const collectSpy = vi.spyOn(parser, 'collectSubmissionArtifact');
    const scanSpy = vi.spyOn(parser, 'scanSubmissionBuckets');
    const probeSpy = vi.spyOn(parser, 'isExpectedElementType');

    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifacts[0]).toMatchObject({ pageId: 'student-page', content: 'Answer' });
    expect(contextsSpy).toHaveBeenCalledTimes(1);
    expect(indexSpy).toHaveBeenCalledTimes(1);
    expect(plansSpy).toHaveBeenCalledTimes(1);
    expect(collectSpy).toHaveBeenCalledTimes(1);
    expect(scanSpy).toHaveBeenCalled();
    expect(probeSpy).toHaveBeenCalled();
  });

  it('honours a subclass override of the type probe during submission matching', () => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [createSlide(vi, 'ref-page', [createShapeElement(vi, '# Task 1', 'Ref text')])],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createShapeElement(vi, '# Task 1', 'Answer')]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    vi.spyOn(parser, 'isExpectedElementType').mockReturnValue(false);

    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifacts[0]).toMatchObject({ pageId: null, content: null });
  });

  it.each([
    ['shape', new Error('shape internal failure')],
    ['shape', new TypeError('shape type failure')],
    ['shape', new ReferenceError('shape reference failure')],
    ['shape', 'shape non-error failure'],
    ['cell', new Error('cell internal failure')],
    ['cell', new TypeError('cell type failure')],
    ['cell', new ReferenceError('cell reference failure')],
    ['cell', 'cell non-error failure'],
  ])('lets the original %s content fault escape matching', (site, thrown) => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [
          site === 'shape'
            ? createShapeElement(vi, '# Task 1', 'Ref')
            : createTableElement(vi, '# Task 1', [['Ref']]),
        ]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [
          site === 'shape'
            ? createShapeElement(vi, '# Task 1', 'Answer')
            : createTableElement(vi, '# Task 1', [['Answer']]),
        ]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    expect(defs[0].getPrimaryReference().getType()).toBe(site === 'cell' ? 'TABLE' : 'TEXT');
    const extractionOverride = vi
      .spyOn(parser, site === 'shape' ? 'extractTextFromShape' : 'extractCellText')
      .mockImplementation(() => {
        throw thrown;
      });

    let caught;
    try {
      parser.extractSubmissionArtifacts(studentDocId, defs);
    } catch (error) {
      caught = error;
    }

    expect(extractionOverride).toHaveBeenCalled();
    expect(caught).toBe(thrown);
    expect(suite.mockLogger.error).not.toHaveBeenCalled();
  });

  const nativeFailureKinds = [
    ['TypeError', () => new TypeError('native type failure')],
    ['ReferenceError', () => new ReferenceError('native reference failure')],
    ['non-Error', () => ({ kind: 'native non-error failure' })],
  ];
  const nativeReadSites = [
    ['shape.getText', 'shape'],
    ['shape TextRange.asString', 'shape'],
    ['table.getNumRows', 'table'],
    ['table.getNumColumns', 'table'],
    ['table.getCell', 'table'],
    ['cell.getMergeState', 'table'],
    ['cell.getText', 'table'],
    ['cell TextRange.asString', 'table'],
  ];

  it.each(
    nativeReadSites.flatMap(([site, elementKind]) =>
      nativeFailureKinds.map(([failureKind, createFailure]) => [
        site,
        failureKind,
        elementKind,
        createFailure,
      ])
    )
  )(
    'preserves native student %s %s identity through submission matching',
    (site, failureKind, elementKind, createFailure) => {
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
        [refDocId]: [
          createSlide(vi, 'ref-page', [
            elementKind === 'shape'
              ? createShapeElement(vi, '# Task 1', 'Ref')
              : createTableElement(vi, '# Task 1', [['Ref']]),
          ]),
        ],
        [studentDocId]: [],
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const nativeFailure = createFailure();
      let nativeRead;

      if (elementKind === 'shape') {
        const element = createShapeElement(vi, '# Task 1', 'Answer');
        const textRange = { asString: vi.fn(() => 'Answer') };
        const shape = { getText: vi.fn(() => textRange) };
        element.asShape = vi.fn(() => shape);
        if (site === 'shape.getText') {
          nativeRead = shape.getText.mockImplementation(() => {
            throw nativeFailure;
          });
        } else {
          nativeRead = textRange.asString.mockImplementation(() => {
            throw nativeFailure;
          });
        }
        globalThis.SlidesApp.openById = vi.fn(() => ({
          getSlides: () => [createSlide(vi, 'student-page', [element])],
        }));
      } else {
        const cell = {
          getMergeState: vi.fn(() => globalThis.SlidesApp.CellMergeState.NORMAL),
          getText: vi.fn(() => ({ asString: vi.fn(() => 'Answer') })),
        };
        const table = {
          getNumRows: vi.fn(() => 1),
          getNumColumns: vi.fn(() => 1),
          getCell: vi.fn(() => cell),
        };
        const dimensionMethod = site === 'table.getNumRows' ? 'getNumRows' : 'getNumColumns';
        if (site.startsWith('table.getNum')) {
          nativeRead = table[dimensionMethod].mockImplementation(() => {
            throw nativeFailure;
          });
        } else if (site === 'table.getCell') {
          nativeRead = table.getCell.mockImplementation(() => {
            throw nativeFailure;
          });
        } else if (site === 'cell.getMergeState') {
          nativeRead = cell.getMergeState.mockImplementation(() => {
            throw nativeFailure;
          });
        } else if (site === 'cell.getText') {
          nativeRead = cell.getText.mockImplementation(() => {
            throw nativeFailure;
          });
        } else {
          const textRange = { asString: vi.fn(() => 'Answer') };
          cell.getText.mockReturnValue(textRange);
          nativeRead = textRange.asString.mockImplementation(() => {
            throw nativeFailure;
          });
        }
        const element = createTableElementFromMock(vi, '# Task 1', table);
        globalThis.SlidesApp.openById = vi.fn(() => ({
          getSlides: () => [createSlide(vi, 'student-page', [element])],
        }));
      }

      let caught;
      try {
        parser.extractSubmissionArtifacts(studentDocId, defs);
      } catch (error) {
        caught = error;
      }

      expect(nativeRead).toHaveBeenCalled();
      expect(caught).toBe(nativeFailure);
      expect(suite.mockLogger.error).not.toHaveBeenCalled();
    }
  );

  it('threads submission read context through facade content reads', () => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [createSlide(vi, 'ref-page', [createShapeElement(vi, '# Task 1', 'Ref')])],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createShapeElement(vi, '# Task 1', 'Answer')]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    const shapeSpy = vi.spyOn(parser, 'extractTextFromShape');

    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifacts[0]).toMatchObject({ pageId: 'student-page', content: 'Answer' });
    expect(shapeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        readMode: 'submission',
        documentId: studentDocId,
        pageId: 'student-page',
        taskId: defs[0].getId(),
      })
    );
  });

  it('threads submission task and cell coordinates through cell facade reads', () => {
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [createTableElement(vi, '# Task Table', [['Ref']])]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createTableElement(vi, '# Task Table', [['Answer']])]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    const cellSpy = vi.spyOn(parser, 'extractCellText');

    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifacts[0]).toMatchObject({ pageId: 'student-page', content: [['Answer']] });
    expect(cellSpy).toHaveBeenCalledWith(
      expect.any(Object),
      'NORMAL',
      expect.objectContaining({
        readMode: 'submission',
        documentId: studentDocId,
        pageId: 'student-page',
        taskId: defs[0].getId(),
        row: 0,
        column: 0,
      })
    );
  });
});
