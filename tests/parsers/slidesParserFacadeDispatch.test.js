import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Facade dispatch regression: helpers must route preserved public methods
// through the SlidesParser facade so subclass overrides and spies stay observable.
describe('SlidesParser facade dispatch', () => {
  const refDocId = 'ref-doc-dispatch';
  const studentDocId = 'student-doc-dispatch';
  let SlidesParser;
  let mockLogger;
  let restoreGlobals;
  const savedModuleGlobals = saveGlobals(['DocumentParser', 'TaskDefinition']);

  const createShapeElement = (description, text) => ({
    getDescription: vi.fn(() => description),
    getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.SHAPE),
    asShape: vi.fn(() => ({
      getText: vi.fn(() => ({
        asString: vi.fn(() => text),
      })),
    })),
  });

  const createTableElement = (description, rows) => ({
    getDescription: vi.fn(() => description),
    getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.TABLE),
    asTable: vi.fn(() => ({
      getNumRows: vi.fn(() => rows.length),
      getNumColumns: vi.fn(() => rows[0]?.length || 0),
      getCell: vi.fn((rowIndex, columnIndex) => ({
        getMergeState: vi.fn(() => globalThis.SlidesApp.CellMergeState.NORMAL),
        getText: vi.fn(() => ({
          asString: vi.fn(() => rows[rowIndex]?.[columnIndex] ?? ''),
        })),
      })),
    })),
  });

  const createSlide = (pageId, elements) => ({
    getObjectId: vi.fn(() => pageId),
    getPageElements: vi.fn(() => elements),
  });

  function buildHarness(slidesByDocId) {
    globalThis.SlidesApp.openById = vi.fn((id) => {
      const val = slidesByDocId[id];
      return { getSlides: typeof val === 'function' ? val : () => val || [] };
    });
    return new SlidesParser();
  }

  beforeAll(async () => {
    const documentParserModule =
      await import('../../src/backend/DocumentParsers/DocumentParser.js');
    const taskDefinitionModule = await import('../../src/backend/Models/TaskDefinition.js');
    globalThis.DocumentParser = documentParserModule.DocumentParser;
    globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;
    const slidesParserModule =
      await import('../../src/backend/DocumentParsers/SlidesParser/index.js');
    SlidesParser = slidesParserModule.SlidesParser;
  });

  afterAll(() => {
    restoreSavedGlobals(savedModuleGlobals);
  });

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: vi.fn().mockReturnValue(mockLogger) }),
      SlidesApp: () => ({
        PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE', IMAGE: 'IMAGE' },
        CellMergeState: { NORMAL: 'NORMAL', HEAD: 'HEAD', MERGED: 'MERGED' },
      }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
  });

  it('routes definition shape reads through facade spies', () => {
    const parser = buildHarness({
      [refDocId]: [createSlide('page-1', [createShapeElement('# Task 1', 'Ref text')])],
    });
    const shapeSpy = vi.spyOn(parser, 'extractTextFromShape');
    const defs = parser.extractTaskDefinitions(refDocId);

    expect(defs).toHaveLength(1);
    expect(defs[0].getPrimaryReference().content).toBe('Ref text');
    expect(shapeSpy).toHaveBeenCalledTimes(1);
  });

  it('routes definition table reads through facade spies without recursion', () => {
    const parser = buildHarness({
      [refDocId]: [createSlide('page-1', [createTableElement('# Task Table', [['A']])])],
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
    class OverrideParser extends SlidesParser {
      extractTextFromShape() {
        return 'overridden';
      }
    }
    globalThis.SlidesApp.openById = vi.fn(() => ({
      getSlides: () => [createSlide('page-1', [createShapeElement('# Task 1', 'Ref text')])],
    }));
    const parser = new OverrideParser();
    const defs = parser.extractTaskDefinitions(refDocId);

    expect(defs[0].getPrimaryReference().content).toBe('overridden');
  });

  it('routes submission matching steps through facade spies', () => {
    const parser = buildHarness({
      [refDocId]: [createSlide('ref-page', [createShapeElement('# Task 1', 'Ref text')])],
      [studentDocId]: [createSlide('student-page', [createShapeElement('# Task 1', 'Answer')])],
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
    const parser = buildHarness({
      [refDocId]: [createSlide('ref-page', [createShapeElement('# Task 1', 'Ref text')])],
      [studentDocId]: [createSlide('student-page', [createShapeElement('# Task 1', 'Answer')])],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    vi.spyOn(parser, 'isExpectedElementType').mockReturnValue(false);

    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifacts[0]).toMatchObject({ pageId: null, content: null });
  });
});
