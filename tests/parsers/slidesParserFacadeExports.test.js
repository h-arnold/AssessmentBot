import { describe, it, expect, afterAll, vi } from 'vitest';
import { restoreGlobals } from '../helpers/globalMockManager.js';
import SlidesParserDefault, {
  SlidesParser as SlidesParserNamed,
} from '../../src/backend/DocumentParsers/SlidesParser/index.js';

// Contract regression for the real SlidesParser CommonJS facade. No vi.mock is
// used here: the assertions must observe the shipped module bindings so that a
// consumer can construct the default export while named imports resolve to the
// very same class reference.
//
// The facade extends the DocumentParser global, so the prerequisite global is
// registered before the static import is evaluated (vi.hoisted runs first) and
// restored afterwards.
const facadePrerequisiteGlobals = vi.hoisted(() => {
  const hadDocumentParser = Object.hasOwn(globalThis, 'DocumentParser');
  const previousDocumentParser = globalThis.DocumentParser;
  const documentParserModule = require('../../src/backend/DocumentParsers/DocumentParser.js');
  globalThis.DocumentParser = documentParserModule.DocumentParser || documentParserModule;
  return { hadDocumentParser, previousDocumentParser };
});

describe('SlidesParser facade module exports', () => {
  afterAll(() => {
    restoreGlobals({
      DocumentParser: facadePrerequisiteGlobals.hadDocumentParser
        ? facadePrerequisiteGlobals.previousDocumentParser
        : undefined,
    });
  });

  it('exposes the same class as the default and named export', () => {
    expect(typeof SlidesParserDefault).toBe('function');
    expect(SlidesParserNamed).toBe(SlidesParserDefault);
  });

  it('constructs the default export as an instance of the named export', () => {
    const parser = new SlidesParserDefault();

    expect(parser).toBeInstanceOf(SlidesParserNamed);
    expect(typeof parser.extractTaskDefinitions).toBe('function');
  });
});
