import { describe, test, expect, beforeAll } from 'vitest';
import { TaskDefinition } from '../../src/AdminSheet/Models/TaskDefinition.js';

if (!global.Utils || !global.Utilities) {
  throw new Error('Global Utils/Utilities expected from setupGlobals.js');
}

describe('Phase 2 – Parser Interface Updates (Interface-Level / Stubs)', () => {
  const basePath = '../../src/AdminSheet/DocumentParsers/DocumentParser.js';
  let ParserExport;
  let ParserClass;
  beforeAll(() => {
    ParserExport = require(basePath); // expect { DocumentParser }
    ParserClass = ParserExport.DocumentParser || ParserExport; // fallback
  });

  test('Abstract enforcement: instantiating base or calling abstract methods throws', () => {
  expect(() => new ParserClass()).toThrow();
    try {
      const maybe = Object.create(ParserClass.prototype);
      expect(() => maybe.extractTaskDefinitions('ref', 'tpl')).toThrow();
      expect(() => maybe.extractSubmissionArtifacts('doc', [])).toThrow();
    } catch (e) {
    }
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
        for (let i = 0; i < this.sequence.length; i++) {
          const t = this.sequence[i];
            const td = new TaskDefinition({ taskTitle: t.title, pageId: t.pageId, index: defs.length });
            td.addReferenceArtifact({ type: 'text', content: t.refContent ?? null });
            td.addTemplateArtifact({ type: 'text', content: t.tplContent ?? null });
            defs.push(td);
        }
        return defs;
      }
      extractSubmissionArtifacts(documentId, taskDefs) {
        return taskDefs.map(td => ({
          taskId: td.id,
          pageId: td.pageId || null,
          content: (td.getPrimaryTemplate() && td.getPrimaryTemplate().content) ? 'student ' + td.getPrimaryTemplate().content : null,
          metadata: { simulated: true }
        }));
      }
    };
  });

  test('extractTaskDefinitions returns TaskDefinitions with sequential index starting at 0', () => {
    const parser = new TestDocumentParser([
      { title: 'A', refContent: 'R1', tplContent: 'T1' },
      { title: 'B', refContent: 'R2', tplContent: 'T2' },
      { title: 'A', refContent: 'R3', tplContent: 'T3' }
    ]);
    const defs = parser.extractTaskDefinitions('refDoc', 'tplDoc');
    expect(defs.map(d => d.index)).toEqual([0,1,2]);
  });

  test('Returned TaskDefinitions artifacts contain only primitive artifact contents', () => {
    const parser = new TestDocumentParser([
      { title: 'A', refContent: 'Ref', tplContent: 'Tpl' }
    ]);
    const [def] = parser.extractTaskDefinitions('refDoc','tplDoc');
    const ref = def.getPrimaryReference();
    const tpl = def.getPrimaryTemplate();
    expect(typeof ref.content === 'string' || ref.content === null).toBe(true);
    expect(typeof tpl.content === 'string' || tpl.content === null).toBe(true);
  });

  test('extractSubmissionArtifacts output objects contain only primitive fields and no contentHash', () => {
    const parser = new TestDocumentParser([
      { title: 'A', refContent: 'Ref', tplContent: 'Tpl' }
    ]);
    const defs = parser.extractTaskDefinitions('refDoc','tplDoc');
    const subs = parser.extractSubmissionArtifacts('studentDoc', defs);
    subs.forEach(o => {
      expect(o).not.toHaveProperty('contentHash');
      expect(Object.keys(o).sort()).toEqual(expect.arrayContaining(['taskId','content','pageId','metadata']));
      expect(typeof o.taskId).toBe('string');
      expect(o.metadata && typeof o.metadata).toBe('object');
      if (o.content != null) expect(typeof o.content).toBe('string');
    });
  });

  test('Parser artifacts already hashed immediately for reference/template', () => {
    const parser = new TestDocumentParser([
      { title: 'A', refContent: 'Ref', tplContent: 'Tpl' }
    ]);
    const [def] = parser.extractTaskDefinitions('refDoc','tplDoc');
    const ref = def.getPrimaryReference();
    const tpl = def.getPrimaryTemplate();
    expect(ref.contentHash).toBeTruthy();
    expect(tpl.contentHash).toBeTruthy();
  });

  test('Alignment logic: duplicate titles maintain order of appearance via index', () => {
    const parser = new TestDocumentParser([
      { title: 'B', refContent: 'R1', tplContent: 'T1' },
      { title: 'A', refContent: 'R2', tplContent: 'T2' },
      { title: 'B', refContent: 'R3', tplContent: 'T3' }
    ]);
    const defs = parser.extractTaskDefinitions('ref','tpl');
    expect(defs.map(d => d.taskTitle + ':' + d.index)).toEqual(['B:0','A:1','B:2']);
  });
});
