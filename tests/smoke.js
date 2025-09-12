/* Basic smoke tests for model layer */
// Provide minimal shims for GAS globals used in model code
global.Utils = {
  generateHash(str) {
    // simple non-crypto hash for test determinism
    let h = 0, i, chr;
    if (str.length === 0) return '0';
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      h = ((h << 5) - h) + chr;
      h |= 0; // Convert to 32bit int
    }
    return Math.abs(h).toString(16);
  }
};
global.Utilities = {
  base64Encode(bytes) {
    if (Array.isArray(bytes)) {
      return Buffer.from(Uint8Array.from(bytes)).toString('base64');
    }
    return '';
  }
};

const { ArtifactFactory, TextTaskArtifact, TableTaskArtifact, SpreadsheetTaskArtifact, ImageTaskArtifact } = require('../src/AdminSheet/Models/Artifacts.js');
global.ArtifactFactory = ArtifactFactory; // so TaskDefinition can reference it when loaded
const { TaskDefinition } = require('../src/AdminSheet/Models/TaskDefinition.js');
const { StudentSubmission } = require('../src/AdminSheet/Models/StudentSubmission.js');

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

function testTaskDefinitionAndArtifacts() {
  const td = new TaskDefinition({ taskTitle: 'Word Bank', pageId: 'p1', index: 0 });
  const ref = td.addReferenceArtifact({ type: 'text', content: ' Cat,  Dog  ' });
  const tmpl = td.addTemplateArtifact({ type: 'text', content: '   ' });
  assert(ref.getType() === 'text', 'reference artifact type');
  assert(ref.content === 'Cat,  Dog', 'text normalisation trims newlines & spaces');
  assert(tmpl.content === null, 'empty template becomes null');
  assert(ref.contentHash && ref.contentHash.length >= 1, 'contentHash computed');
  const round = TaskDefinition.fromJSON(td.toJSON());
  assert(round.getPrimaryReference().content === ref.content, 'round-trip reference content');
}

function testTableArtifact() {
  const raw = [ [' H ', 'B', ''], ['1', ' 2 ', null], [' ', ' ', ' '] ];
  const table = ArtifactFactory.table({ type: 'table', taskId: 't1', role: 'reference', content: raw });
  assert(table.content.length === 2, 'trimmed empty trailing row');
  assert(table.content[0][0] === 'H', 'cell trimmed');
  const md = table.toMarkdown();
  assert(md.split('\n').length === 3, 'markdown lines');
}

function testSpreadsheetArtifact() {
  const raw = [ ['=sum(a1:a2)', 'x'], ['=IF("a",1,2)', '=concatenate("Hi"," there")'] ];
  const ss = ArtifactFactory.spreadsheet({ type: 'spreadsheet', taskId: 't2', role: 'reference', content: raw });
  assert(ss.content[0][0] === '=SUM(A1:A2)', 'formula uppercased outside quotes');
  assert(ss.content[1][0] === '=IF("a",1,2)', 'quoted segment preserved');
}

function testImageArtifact() {
  const img = ArtifactFactory.image({ type: 'image', taskId: 't3', role: 'reference', content: null, metadata: { sourceUrl: 'http://x/y.png' } });
  assert(img.getType() === 'image', 'image type');
  assert(img.content === null, 'no content initially');
}

function testStudentSubmissionFlow() {
  const td = new TaskDefinition({ taskTitle: 'Short Answer', pageId: 'p2', index: 1 });
  td.addReferenceArtifact({ type: 'text', content: 'Reference answer' });
  td.addTemplateArtifact({ type: 'text', content: '' });
  const sub = new StudentSubmission('stu1', 'assign1', 'doc1');
  sub.upsertItemFromExtraction(td, { content: ' Student response ' });
  const item = sub.getItem(td.getId());
  assert(item.artifact.content === 'Student response', 'submission text trimmed');
  const json = sub.toJSON();
  const restored = StudentSubmission.fromJSON(json);
  assert(restored.getItem(td.getId()).artifact.content === 'Student response', 'submission round-trip');
}

function run() {
  const tests = [
    testTaskDefinitionAndArtifacts,
    testTableArtifact,
    testSpreadsheetArtifact,
    testImageArtifact,
    testStudentSubmissionFlow
  ];
  let passed = 0;
  for (const t of tests) {
    t();
    passed++;
  }
  console.log(`Smoke tests passed: ${passed}/${tests.length}`);
}

run();
