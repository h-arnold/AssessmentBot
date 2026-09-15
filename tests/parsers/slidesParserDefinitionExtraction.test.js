import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  registerSlidesParserSuiteLifecycle,
  createShapeElement,
  createTaggedElement,
  createUnsupportedTitleElement,
  createSlide,
  buildSlidesParserHarness,
} from '../helpers/slidesParserTestHarness.js';

// Slides parser definition extraction coverage (Pass A extraction behaviour).
describe('SlidesParser definition extraction', () => {
  describe('SlidesParser', () => {
    const refDocId = 'ref-doc-123';
    const tplDocId = 'tpl-doc-456';
    const suite = registerSlidesParserSuiteLifecycle({
      beforeAll,
      afterAll,
      beforeEach,
      afterEach,
      vi,
    });

    it('ignores caret-prefixed descriptions now that notes tags were removed', () => {
      const definitionPageId = 'ref-page-1';
      const notesPageId = 'ref-page-2';
      const refSlides = [
        createSlide(vi, definitionPageId, [createShapeElement(vi, '# Task 1', 'Ref text')]),
        createSlide(vi, notesPageId, [createShapeElement(vi, '^ Task 1', 'Notes for Task 1')]),
      ];
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: refSlides });
      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs).toHaveLength(1);
      expect(defs[0].pageId).toBe(definitionPageId);
      expect(defs[0].taskNotes).toBeNull();
      expect(suite.mockLogger.warn).not.toHaveBeenCalled();
    });

    it('treats caret-prefixed and plain descriptions as untagged with empty tag text', () => {
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: [] });

      expect(parser.parseDescriptionTag('^ Task 1')).toMatchObject({ tag: null, tagText: '' });
      expect(parser.parseDescriptionTag('Task 1')).toMatchObject({ tag: null, tagText: '' });
      expect(parser.parseDescriptionTag('')).toMatchObject({ tag: null, tagText: '' });
    });

    it.each([['#'], ['~'], ['|'], ['#   '], ['~   ']])(
      'fails fast with contextual error on empty tag text %s',
      (description) => {
        const pageId = 'page-bad';
        const slide = createSlide(vi, pageId, [createTaggedElement(vi, description)]);
        const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: [slide] });

        const action = () => parser.extractTaskDefinitions(refDocId);
        expect(action).toThrow(
          `Empty tag text for "${description.trim()}" on page ${pageId} (role: reference).`
        );
        expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
        expect(suite.mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Empty tag text'),
          expect.objectContaining({ pageId, role: 'reference', rawText: description.trim() })
        );
      }
    );

    it('fails fast on duplicate title tags within the same role', () => {
      const refSlides = [
        createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'First')]),
        createSlide(vi, 'page-2', [createShapeElement(vi, '# Task 1', 'Second')]),
      ];
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: refSlides });

      expect(() => parser.extractTaskDefinitions(refDocId)).toThrow(/Duplicate title tag "Task 1"/);
      expect(suite.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate title tag'),
        expect.objectContaining({ taskTitle: 'Task 1', pageId: 'page-2', role: 'reference' })
      );
    });

    it.each([['~ Combined task'], ['| Combined task']])(
      'attaches image tag %s to the existing title definition in the same role',
      (imageTag) => {
        const refSlides = [
          createSlide(vi, 'page-1', [createShapeElement(vi, '# Combined task', 'Ref text')]),
          createSlide(vi, 'page-2', [createTaggedElement(vi, imageTag)]),
        ];
        const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: refSlides });

        const defs = parser.extractTaskDefinitions(refDocId);

        expect(defs).toHaveLength(1);
        expect(defs[0].taskTitle).toBe('Combined task');
        expect(defs[0].artifacts.reference).toHaveLength(2);
        expect(defs[0].artifacts.reference.map((artifact) => artifact.getType()).sort()).toEqual([
          'IMAGE',
          'TEXT',
        ]);
        expect(suite.mockLogger.error).not.toHaveBeenCalled();
      }
    );

    it('warns and keeps the definition when a title tag has no extractable content', () => {
      const pageId = 'page-unsupported';
      const slide = createSlide(vi, pageId, [createUnsupportedTitleElement(vi, '# Task Ghost')]);
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: [slide] });

      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs).toHaveLength(1);
      expect(defs[0].taskTitle).toBe('Task Ghost');
      expect(defs[0].artifacts.reference).toHaveLength(0);
      expect(defs[0].getPrimaryReference()).toBeNull();
      expect(suite.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No extractable content'),
        expect.objectContaining({ taskTitle: 'Task Ghost', pageId, role: 'reference' })
      );
    });

    it('treats tilde and pipe as equivalent image tags during extraction', () => {
      const refSlides = [
        createSlide(vi, 'page-tilde', [createTaggedElement(vi, '~ Task Tilde')]),
        createSlide(vi, 'page-pipe', [createTaggedElement(vi, '| Task Pipe')]),
      ];
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: refSlides });

      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs.map((def) => def.taskTitle).sort()).toEqual(['Task Pipe', 'Task Tilde']);
      defs.forEach((def) => {
        expect(def.getPrimaryReference().getType()).toBe('IMAGE');
      });
      expect(suite.mockLogger.error).not.toHaveBeenCalled();
    });

    it('exposes both image tags through isImageTag and parseDescriptionTag', () => {
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, { [refDocId]: [] });

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
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {});

      expect(() => parser.extractTaskDefinitions(undefined)).toThrow(
        /referenceDocumentId is required/
      );
      expect(() => parser.extractTaskDefinitions(null)).toThrow(/referenceDocumentId is required/);
    });

    it('rejects slide image URL generation for missing or blank identifiers', () => {
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {});

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
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {});

      expect(parser.generateSlideImageUrl('doc-1', 'page-9')).toBe(
        'https://docs.google.com/presentation/d/doc-1/export/png?id=doc-1&pageid=page-9'
      );
    });

    it('does not create task definitions from untagged plain titles in reference or template slides', () => {
      const refSlide = createSlide(vi, 'ref-plain-page', [
        createShapeElement(vi, 'Task 1', 'Ref text'),
      ]);
      const tplSlide = createSlide(vi, 'tpl-plain-page', [
        createShapeElement(vi, 'Task 1', 'Tpl text'),
      ]);
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
        [refDocId]: [refSlide],
        [tplDocId]: [tplSlide],
      });
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);

      expect(defs).toHaveLength(0);
      expect(suite.mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
