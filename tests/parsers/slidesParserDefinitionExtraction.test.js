import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Slides parser definition extraction coverage (Pass A extraction behaviour).
describe('SlidesParser definition extraction', () => {
  describe('SlidesParser', () => {
    const refDocId = 'ref-doc-123';
    const tplDocId = 'tpl-doc-456';
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

    const createTaggedElement = (description) => ({
      getDescription: vi.fn(() => description),
    });

    const createUnsupportedTitleElement = (description) => ({
      getDescription: vi.fn(() => description),
      getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.IMAGE),
    });

    const createSlide = (pageId, elements) => ({
      getObjectId: vi.fn(() => pageId),
      getPageElements: vi.fn(() => elements),
    });

    function buildSlidesParserHarness(slidesByDocId) {
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
      mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

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
        }),
      });
      restoreGlobals = mockContext.restore;
    });

    afterEach(() => {
      restoreGlobals();
    });

    it('ignores caret-prefixed descriptions now that notes tags were removed', () => {
      const definitionPageId = 'ref-page-1';
      const notesPageId = 'ref-page-2';
      const refSlides = [
        createSlide(definitionPageId, [createShapeElement('# Task 1', 'Ref text')]),
        createSlide(notesPageId, [createShapeElement('^ Task 1', 'Notes for Task 1')]),
      ];
      const parser = buildSlidesParserHarness({ [refDocId]: refSlides });
      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs).toHaveLength(1);
      expect(defs[0].pageId).toBe(definitionPageId);
      expect(defs[0].taskNotes).toBeNull();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('treats caret-prefixed and plain descriptions as untagged with empty tag text', () => {
      const parser = buildSlidesParserHarness({ [refDocId]: [] });

      expect(parser.parseDescriptionTag('^ Task 1')).toMatchObject({ tag: null, tagText: '' });
      expect(parser.parseDescriptionTag('Task 1')).toMatchObject({ tag: null, tagText: '' });
      expect(parser.parseDescriptionTag('')).toMatchObject({ tag: null, tagText: '' });
    });

    it.each([['#'], ['~'], ['|'], ['#   '], ['~   ']])(
      'fails fast with contextual error on empty tag text %s',
      (description) => {
        const pageId = 'page-bad';
        const slide = createSlide(pageId, [createTaggedElement(description)]);
        const parser = buildSlidesParserHarness({ [refDocId]: [slide] });

        const action = () => parser.extractTaskDefinitions(refDocId);
        expect(action).toThrow(
          `Empty tag text for "${description.trim()}" on page ${pageId} (role: reference).`
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Empty tag text'),
          expect.objectContaining({ pageId, role: 'reference', rawText: description.trim() })
        );
      }
    );

    it('fails fast on duplicate title tags within the same role', () => {
      const refSlides = [
        createSlide('page-1', [createShapeElement('# Task 1', 'First')]),
        createSlide('page-2', [createShapeElement('# Task 1', 'Second')]),
      ];
      const parser = buildSlidesParserHarness({ [refDocId]: refSlides });

      expect(() => parser.extractTaskDefinitions(refDocId)).toThrow(/Duplicate title tag "Task 1"/);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate title tag'),
        expect.objectContaining({ taskTitle: 'Task 1', pageId: 'page-2', role: 'reference' })
      );
    });

    it.each([['~ Combined task'], ['| Combined task']])(
      'attaches image tag %s to the existing title definition in the same role',
      (imageTag) => {
        const refSlides = [
          createSlide('page-1', [createShapeElement('# Combined task', 'Ref text')]),
          createSlide('page-2', [createTaggedElement(imageTag)]),
        ];
        const parser = buildSlidesParserHarness({ [refDocId]: refSlides });

        const defs = parser.extractTaskDefinitions(refDocId);

        expect(defs).toHaveLength(1);
        expect(defs[0].taskTitle).toBe('Combined task');
        expect(defs[0].artifacts.reference).toHaveLength(2);
        expect(defs[0].artifacts.reference.map((artifact) => artifact.getType()).sort()).toEqual([
          'IMAGE',
          'TEXT',
        ]);
        expect(mockLogger.error).not.toHaveBeenCalled();
      }
    );

    it('warns and keeps the definition when a title tag has no extractable content', () => {
      const pageId = 'page-unsupported';
      const slide = createSlide(pageId, [createUnsupportedTitleElement('# Task Ghost')]);
      const parser = buildSlidesParserHarness({ [refDocId]: [slide] });

      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs).toHaveLength(1);
      expect(defs[0].taskTitle).toBe('Task Ghost');
      expect(defs[0].artifacts.reference).toHaveLength(0);
      expect(defs[0].getPrimaryReference()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No extractable content'),
        expect.objectContaining({ taskTitle: 'Task Ghost', pageId, role: 'reference' })
      );
    });

    it('treats tilde and pipe as equivalent image tags during extraction', () => {
      const refSlides = [
        createSlide('page-tilde', [createTaggedElement('~ Task Tilde')]),
        createSlide('page-pipe', [createTaggedElement('| Task Pipe')]),
      ];
      const parser = buildSlidesParserHarness({ [refDocId]: refSlides });

      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs.map((def) => def.taskTitle).sort()).toEqual(['Task Pipe', 'Task Tilde']);
      defs.forEach((def) => {
        expect(def.getPrimaryReference().getType()).toBe('IMAGE');
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('exposes both image tags through isImageTag and parseDescriptionTag', () => {
      const parser = buildSlidesParserHarness({ [refDocId]: [] });

      expect(parser.isImageTag('~')).toBe(true);
      expect(parser.isImageTag('|')).toBe(true);
      expect(parser.isImageTag('#')).toBe(false);
      expect(parser.isImageTag('^')).toBe(false);
      expect(parser.isImageTag(null)).toBe(false);
      expect(parser.parseDescriptionTag('~ Task 1')).toMatchObject({
        tag: '~',
        tagText: 'Task 1',
      });
      expect(parser.parseDescriptionTag('| Task 1')).toMatchObject({
        tag: '|',
        tagText: 'Task 1',
      });
      expect(parser.parseDescriptionTag('# Task 1')).toMatchObject({
        tag: '#',
        tagText: 'Task 1',
      });
    });

    it('rejects extraction when the reference document id is missing', () => {
      const parser = buildSlidesParserHarness({});

      expect(() => parser.extractTaskDefinitions(undefined)).toThrow(
        /referenceDocumentId is required/
      );
      expect(() => parser.extractTaskDefinitions(null)).toThrow(/referenceDocumentId is required/);
    });

    it('rejects slide image URL generation for missing or blank identifiers', () => {
      const parser = buildSlidesParserHarness({});

      expect(() => parser.generateSlideImageUrl(undefined, 'page-1')).toThrow(
        /documentId is required/
      );
      expect(() => parser.generateSlideImageUrl('doc-1', undefined)).toThrow(/pageId is required/);
      expect(() => parser.generateSlideImageUrl('', 'page-1')).toThrow(
        /Invalid slide image identifiers/
      );
      expect(() => parser.generateSlideImageUrl('doc-1', '   ')).toThrow(
        /Invalid slide image identifiers/
      );
    });

    it('generates a slide image URL carrying both identifiers', () => {
      const parser = buildSlidesParserHarness({});

      expect(parser.generateSlideImageUrl('doc-1', 'page-9')).toBe(
        'https://docs.google.com/presentation/d/doc-1/export/png?id=doc-1&pageid=page-9'
      );
    });

    it('does not create task definitions from untagged plain titles in reference or template slides', () => {
      const refSlide = createSlide('ref-plain-page', [createShapeElement('Task 1', 'Ref text')]);
      const tplSlide = createSlide('tpl-plain-page', [createShapeElement('Task 1', 'Tpl text')]);
      const parser = buildSlidesParserHarness({ [refDocId]: [refSlide], [tplDocId]: [tplSlide] });
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);

      expect(defs).toHaveLength(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
