import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { TaskDefinition } from '../../src/backend/Models/TaskDefinition.js';

if (!globalThis.Utils || !globalThis.Utilities) {
  throw new Error('Global Utils/Utilities expected from setupGlobals.js');
}

describe('Document Parser Interface and Stub Tests', () => {
  const basePath = '../../src/backend/DocumentParsers/DocumentParser.js';
  let ParserExport;
  let ParserClass;
  beforeAll(() => {
    ParserExport = require(basePath); // expect { DocumentParser }
    ParserClass = ParserExport.DocumentParser || ParserExport; // fallback
  });

  let mockWarn;
  let previousLogger;
  beforeEach(() => {
    mockWarn = vi.fn();
    previousLogger = globalThis.ABLogger;
    globalThis.ABLogger = {
      getInstance: () => ({
        debug: () => {},
        debugUi: () => {},
        info: () => {},
        warn: mockWarn,
        error: () => {},
        log: () => {},
      }),
    };
  });

  afterEach(() => {
    globalThis.ABLogger = previousLogger;
  });

  test('Abstract enforcement: instantiating base or calling abstract methods throws', () => {
    expect(() => new ParserClass()).toThrow();
    const maybe = Object.create(ParserClass.prototype);
    expect(() => maybe.extractTaskDefinitions('ref', 'tpl')).toThrow();
    expect(() => maybe.extractSubmissionArtifacts('doc', [])).toThrow();
  });

  let TestDocumentParser;
  beforeAll(() => {
    TestDocumentParser = class extends ParserClass {
      constructor(sequence) {
        super(sequence);
        this.sequence = sequence || [];
      }
      extractTaskDefinitions(referenceId, templateId) {
        const defs = [];
        for (const t of this.sequence) {
          const td = new TaskDefinition({
            taskTitle: t.title,
            pageId: t.pageId,
            index: defs.length,
          });
          td.addReferenceArtifact({ type: 'text', content: t.refContent ?? null });
          td.addTemplateArtifact({ type: 'text', content: t.tplContent ?? null });
          defs.push(td);
        }
        return defs;
      }
      extractSubmissionArtifacts(documentId, taskDefs) {
        return taskDefs.map((td) => ({
          taskId: td.id,
          pageId: td.pageId || null,
          content: td.getPrimaryTemplate()?.content
            ? 'student ' + td.getPrimaryTemplate().content
            : null,
          metadata: { simulated: true },
          documentId,
          type: 'TEXT',
        }));
      }
    };
  });

  test('extractTaskDefinitions returns TaskDefinitions with sequential index starting at 0', () => {
    const parser = new TestDocumentParser([
      { title: 'A', refContent: 'R1', tplContent: 'T1' },
      { title: 'B', refContent: 'R2', tplContent: 'T2' },
      { title: 'A', refContent: 'R3', tplContent: 'T3' },
    ]);
    const defs = parser.extractTaskDefinitions('refDoc', 'tplDoc');
    expect(defs.map((d) => d.index)).toEqual([0, 1, 2]);
  });

  test('Returned TaskDefinitions artifacts contain only primitive artifact contents', () => {
    const parser = new TestDocumentParser([{ title: 'A', refContent: 'Ref', tplContent: 'Tpl' }]);
    const [def] = parser.extractTaskDefinitions('refDoc', 'tplDoc');
    const ref = def.getPrimaryReference();
    const tpl = def.getPrimaryTemplate();
    expect(typeof ref.content === 'string' || ref.content === null).toBe(true);
    expect(typeof tpl.content === 'string' || tpl.content === null).toBe(true);
  });

  test('extractSubmissionArtifacts output uses the canonical shape with no parser-owned contentHash or role', () => {
    const parser = new TestDocumentParser([{ title: 'A', refContent: 'Ref', tplContent: 'Tpl' }]);
    const defs = parser.extractTaskDefinitions('refDoc', 'tplDoc');
    const subs = parser.extractSubmissionArtifacts('studentDoc', defs);
    subs.forEach((o) => {
      expect(o).not.toHaveProperty('contentHash');
      expect(o).not.toHaveProperty('role');
      expect(Object.keys(o).sort((a, b) => a.localeCompare(b))).toEqual([
        'content',
        'documentId',
        'metadata',
        'pageId',
        'taskId',
        'type',
      ]);
      expect(typeof o.taskId).toBe('string');
      expect(o.metadata && typeof o.metadata).toBe('object');
      expect(o.documentId).toBe('studentDoc');
      expect(typeof o.type).toBe('string');
      if (o.content != null) expect(typeof o.content).toBe('string');
    });
  });

  test('Parser artifacts already hashed immediately for reference/template', () => {
    const parser = new TestDocumentParser([{ title: 'A', refContent: 'Ref', tplContent: 'Tpl' }]);
    const [def] = parser.extractTaskDefinitions('refDoc', 'tplDoc');
    const ref = def.getPrimaryReference();
    const tpl = def.getPrimaryTemplate();
    expect(ref.contentHash).toBeTruthy();
    expect(tpl.contentHash).toBeTruthy();
  });

  test('Alignment logic: duplicate titles maintain order of appearance via index', () => {
    const parser = new TestDocumentParser([
      { title: 'B', refContent: 'R1', tplContent: 'T1' },
      { title: 'A', refContent: 'R2', tplContent: 'T2' },
      { title: 'B', refContent: 'R3', tplContent: 'T3' },
    ]);
    const defs = parser.extractTaskDefinitions('ref', 'tpl');
    expect(defs.map((d) => d.taskTitle + ':' + d.index)).toEqual(['B:0', 'A:1', 'B:2']);
  });

  test('convertToMarkdownTable escapes pipes in the header row so columns stay intact', () => {
    const parser = new TestDocumentParser([]);
    const markdown = parser.convertToMarkdownTable([
      ['Task | A', 'Score'],
      ['one', 'two'],
    ]);

    expect(markdown).toBe('| Task \\| A | Score |\n| --- | --- |\n| one | two |\n');
  });

  test('convertToMarkdownTable escapes backslashes in the header row consistently with data rows', () => {
    const parser = new TestDocumentParser([]);
    const markdown = parser.convertToMarkdownTable([
      ['Path \\ here', 'Score'],
      ['a\\b', 'c|d'],
    ]);

    expect(markdown).toBe('| Path \\\\ here | Score |\n| --- | --- |\n| a\\\\b | c\\|d |\n');
  });

  test.each([[null], [[]], [[[]]]])(
    'convertToMarkdownTable warns with context and returns empty string for invalid input %s',
    (tableData) => {
      const parser = new TestDocumentParser([]);

      expect(parser.convertToMarkdownTable(tableData)).toBe('');
      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(
        'The provided data is empty or invalid.',
        expect.objectContaining({
          rowCount: expect.any(Number),
          columnCount: expect.any(Number),
          workflow: 'DocumentParser.convertToMarkdownTable',
        })
      );
    }
  );

  test('convertToMarkdownTable preserves null rowCount for malformed array-like input', () => {
    const parser = new TestDocumentParser([]);
    // Array-like with truthy container but null length: historic behaviour reports null.
    const malformed = { length: null, 0: [] };

    expect(parser.convertToMarkdownTable(malformed)).toBe('');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      'The provided data is empty or invalid.',
      expect.objectContaining({
        rowCount: null,
        columnCount: 0,
        workflow: 'DocumentParser.convertToMarkdownTable',
      })
    );
  });

  test('convertToMarkdownTable preserves null columnCount for malformed first row', () => {
    const parser = new TestDocumentParser([]);
    // Zero-length container with a truthy first row whose length is null.
    const malformed = { length: 0, 0: { length: null } };

    expect(parser.convertToMarkdownTable(malformed)).toBe('');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      'The provided data is empty or invalid.',
      expect.objectContaining({
        rowCount: 0,
        columnCount: null,
        workflow: 'DocumentParser.convertToMarkdownTable',
      })
    );
  });
});
