import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Focused regression for the removed extractTextFromShape defensive guard:
// an invalid shape must now fail loudly via shape.getText() rather than
// producing an empty text artefact.
describe('SlidesParser extractTextFromShape invalid-shape regression', () => {
  let SlidesParser;
  let restoreGlobals;
  let mockLogger;
  const savedModuleGlobals = saveGlobals(['DocumentParser', 'TaskDefinition']);

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
    mockLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      SlidesApp: () => ({
        PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE', IMAGE: 'IMAGE' },
        CellMergeState: { NORMAL: 'NORMAL', HEAD: 'HEAD', MERGED: 'MERGED' },
      }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('propagates invalid-shape errors instead of returning empty text', () => {
    const parser = new SlidesParser();

    expect(() => parser.extractTextFromShape(null)).toThrow();
    expect(() => parser.extractTextFromShape(undefined)).toThrow();
    expect(() => parser.extractTextFromShape({})).toThrow();
    expect(() => parser.extractTextFromShape({ getText: null })).toThrow();
    expect(() => parser.extractTextFromShape({ getText: () => null })).toThrow();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('propagates shape failures through definition content extraction', () => {
    const parser = new SlidesParser();
    const invalidShapeElement = {
      getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.SHAPE),
      asShape: vi.fn(() => ({})),
    };

    expect(() => parser.extractDefinitionContent(invalidShapeElement, {})).toThrow();
  });

  it('still extracts trimmed text from a valid shape', () => {
    const parser = new SlidesParser();
    const shape = {
      getText: vi.fn(() => ({
        asString: vi.fn(() => '  Valid text  '),
      })),
    };

    expect(parser.extractTextFromShape(shape)).toBe('Valid text');
  });
});
