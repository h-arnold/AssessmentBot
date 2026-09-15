import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  registerSlidesParserSuiteLifecycle,
  createShapeElement,
  createTableElement,
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
});
