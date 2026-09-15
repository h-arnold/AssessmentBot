/**
 * Shared Slides parser test harness.
 *
 * Consolidates the repeated Slides parser setup and factory blocks previously
 * duplicated across the Slides parser suites (definition extraction, facade
 * dispatch, matching and document IDs, submission matching, and the malformed
 * table consumer). Extracts only genuinely shared test infrastructure: module
 * loading, mock globals, logger creation, element and slide factories, table
 * mocks, and the parser harness builder.
 *
 * Suites register the standard lifecycle with
 * registerSlidesParserSuiteLifecycle, which preserves per-file global
 * isolation and per-test mock installation. Suite behaviour and assertions
 * stay in the calling file; this helper only removes the duplicated
 * construction details.
 */

const { withGlobalMocks, saveGlobals, restoreGlobals } = require('./globalMockManager.js');
const { createMockABLogger } = require('./mockFactories.js');

/**
 * Module globals preserved around Slides parser suites.
 * @returns {string[]} - Frozen list of module global names.
 */
const SLIDES_PARSER_MODULE_GLOBALS = Object.freeze(['DocumentParser', 'TaskDefinition']);

/**
 * Saves the Slides parser module globals before a suite runs.
 * @returns {Object} - Map of global names to their saved values.
 */
function saveSlidesParserModuleGlobals() {
  return saveGlobals([...SLIDES_PARSER_MODULE_GLOBALS]);
}

/**
 * Restores previously saved Slides parser module globals.
 * @param {Object} savedGlobals - Map from saveSlidesParserModuleGlobals.
 * @returns {void}
 */
function restoreSlidesParserModuleGlobals(savedGlobals) {
  restoreGlobals(savedGlobals);
}

/**
 * Creates a mock ABLogger instance shared by Slides parser suites.
 * Delegates to the canonical createMockABLogger factory so there is a single
 * source of truth for the mock logger shape.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @returns {Object} - Mock logger with spies.
 */
function createSlidesParserMockLogger(vi) {
  return createMockABLogger(vi);
}

/**
 * Installs the per-test ABLogger and SlidesApp globals for Slides parser suites.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {Object} mockLogger - Logger returned by createSlidesParserMockLogger.
 * @returns {Function} - Restore function for afterEach.
 */
function installSlidesParserGlobals(vi, mockLogger) {
  const mockContext = withGlobalMocks({
    ABLogger: () => ({
      getInstance: vi.fn().mockReturnValue(mockLogger),
    }),
    SlidesApp: () => ({
      PageElementType: {
        SHAPE: 'SHAPE',
        TABLE: 'TABLE',
        IMAGE: 'IMAGE',
      },
      CellMergeState: {
        NORMAL: 'NORMAL',
        HEAD: 'HEAD',
        MERGED: 'MERGED',
      },
      openById: vi.fn(),
    }),
  });
  return mockContext.restore;
}

/**
 * Loads the Slides parser modules and exposes them as globals.
 * @returns {Promise<Function>} - The loaded SlidesParser class.
 */
async function loadSlidesParserModules() {
  const documentParserModule = await import('../../src/backend/DocumentParsers/DocumentParser.js');
  const taskDefinitionModule = await import('../../src/backend/Models/TaskDefinition.js');
  globalThis.DocumentParser =
    documentParserModule.DocumentParser || documentParserModule.default?.DocumentParser;
  globalThis.TaskDefinition =
    taskDefinitionModule.TaskDefinition || taskDefinitionModule.default?.TaskDefinition;
  const slidesParserModule =
    await import('../../src/backend/DocumentParsers/SlidesParser/index.js');
  const SlidesParser = slidesParserModule.SlidesParser || slidesParserModule.default?.SlidesParser;
  if (!SlidesParser) {
    throw new Error('Failed to load SlidesParser for tests');
  }
  return SlidesParser;
}

/**
 * Creates a mock SHAPE page element carrying the given description and text.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {string} description - Element description (tag source).
 * @param {string} text - Shape text content.
 * @returns {Object} - Mock page element.
 */
function createShapeElement(vi, description, text) {
  return {
    getDescription: vi.fn(() => description),
    getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.SHAPE),
    asShape: vi.fn(() => ({
      getText: vi.fn(() => ({
        asString: vi.fn(() => text),
      })),
    })),
  };
}

/**
 * Creates a mock TABLE page element backed by the given rows.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {string} description - Element description (tag source).
 * @param {Array<Array<string>>} rows - Table cell values.
 * @returns {Object} - Mock page element.
 */
function createTableElement(vi, description, rows) {
  return {
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
  };
}

/**
 * Creates a mock element carrying only a description (image tag fixtures).
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {string} description - Element description (tag source).
 * @returns {Object} - Mock page element.
 */
function createTaggedElement(vi, description) {
  return {
    getDescription: vi.fn(() => description),
  };
}

/**
 * Creates a mock IMAGE page element for unsupported title-tag fixtures.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {string} description - Element description (tag source).
 * @returns {Object} - Mock page element.
 */
function createUnsupportedTitleElement(vi, description) {
  return {
    getDescription: vi.fn(() => description),
    getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.IMAGE),
  };
}

/**
 * Creates a mock slide returning the given elements.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {string} pageId - Slide object ID.
 * @param {Array} elements - Page elements on the slide.
 * @returns {Object} - Mock slide.
 */
function createSlide(vi, pageId, elements) {
  return {
    getObjectId: vi.fn(() => pageId),
    getPageElements: vi.fn(() => elements),
  };
}

/**
 * Creates a mock TABLE page element backed by a caller-supplied table mock.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {string} description - Element description (tag source).
 * @param {Object} tableMock - Table mock returned by asTable.
 * @returns {Object} - Mock page element.
 */
function createTableElementFromMock(vi, description, tableMock) {
  return {
    getDescription: vi.fn(() => description),
    getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.TABLE),
    asTable: vi.fn(() => tableMock),
  };
}

/**
 * Builds a well-behaved table mock returning the given rows.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {Array<Array<string>>} rows - Table cell values.
 * @returns {Object} - Mock table.
 */
function buildNormalTableMock(vi, rows) {
  return {
    getNumRows: vi.fn().mockReturnValue(rows.length),
    getNumColumns: vi.fn().mockReturnValue(rows[0]?.length || 0),
    getCell: vi.fn((rowIndex, columnIndex) => ({
      getMergeState: vi.fn(() => globalThis.SlidesApp.CellMergeState.NORMAL),
      getText: vi.fn(() => ({
        asString: vi.fn(() => rows[rowIndex]?.[columnIndex] ?? ''),
      })),
    })),
  };
}

/**
 * Builds a SlidesParser instance backed by the given slides per document ID.
 * @param {Object} vi - Vitest vi object for creating mocks.
 * @param {Function} ParserClass - SlidesParser class (or subclass).
 * @param {Object} slidesByDocId - Map of document ID to slides or slide factory.
 * @returns {Object} - Parser instance.
 */
function buildSlidesParserHarness(vi, ParserClass, slidesByDocId) {
  globalThis.SlidesApp.openById = vi.fn((id) => {
    const val = slidesByDocId[id];
    return { getSlides: typeof val === 'function' ? val : () => val || [] };
  });
  return new ParserClass();
}

/**
 * Registers the standard Slides parser suite lifecycle.
 *
 * Saves module globals at registration, loads the parser in beforeAll,
 * installs per-test globals and logger in beforeEach, and restores in
 * afterEach. Each calling suite keeps its own saved globals and restore
 * closure, so global isolation is preserved.
 * @param {Object} hooks - Vitest hooks and mocks object.
 * @param {Function} hooks.beforeAll - Vitest beforeAll hook.
 * @param {Function} hooks.afterAll - Vitest afterAll hook.
 * @param {Function} hooks.beforeEach - Vitest beforeEach hook.
 * @param {Function} hooks.afterEach - Vitest afterEach hook.
 * @param {Object} hooks.vi - Vitest vi object for creating mocks.
 * @param {boolean} [hooks.restoreMocks] - Also call vi.restoreAllMocks in afterEach.
 * @returns {Object} - Mutable suite state with SlidesParser and mockLogger.
 */
function registerSlidesParserSuiteLifecycle({
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
  restoreMocks,
}) {
  const state = { SlidesParser: undefined, mockLogger: undefined };
  let restorePerTestGlobals;
  const savedModuleGlobals = saveSlidesParserModuleGlobals();

  beforeAll(async () => {
    state.SlidesParser = await loadSlidesParserModules();
  });

  afterAll(() => {
    restoreSlidesParserModuleGlobals(savedModuleGlobals);
  });

  beforeEach(() => {
    state.mockLogger = createSlidesParserMockLogger(vi);
    restorePerTestGlobals = installSlidesParserGlobals(vi, state.mockLogger);
  });

  afterEach(() => {
    if (restorePerTestGlobals) {
      restorePerTestGlobals();
      restorePerTestGlobals = undefined;
    }
    if (restoreMocks) {
      vi.restoreAllMocks();
    }
  });

  return state;
}

module.exports = {
  SLIDES_PARSER_MODULE_GLOBALS,
  saveSlidesParserModuleGlobals,
  restoreSlidesParserModuleGlobals,
  createSlidesParserMockLogger,
  installSlidesParserGlobals,
  loadSlidesParserModules,
  registerSlidesParserSuiteLifecycle,
  createShapeElement,
  createTableElement,
  createTaggedElement,
  createUnsupportedTitleElement,
  createSlide,
  createTableElementFromMock,
  buildNormalTableMock,
  buildSlidesParserHarness,
};
