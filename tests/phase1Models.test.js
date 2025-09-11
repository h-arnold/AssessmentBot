import { describe, it, expect } from 'vitest';
import { TaskDefinition } from '../src/AdminSheet/Models/TaskDefinition.js';
import { ArtifactFactory, TextTaskArtifact, TableTaskArtifact, SpreadsheetTaskArtifact, ImageTaskArtifact } from '../src/AdminSheet/Models/Artifacts.js';
import { StudentSubmission } from '../src/AdminSheet/Models/StudentSubmission.js';

function makeTD(idx = 0, opts = {}) {
  const td = new TaskDefinition({ taskTitle: opts.title || `Task ${idx}`, pageId: opts.pageId || `p${idx}`, index: idx });
  td.addReferenceArtifact({ type: 'text', content: 'Reference content' });
  td.addTemplateArtifact({ type: 'text', content: '' });
  return td;
}

describe('Phase1 Model Requirements', () => {
  it('TaskDefinition stable id after title/page mutation', () => {
    const td = new TaskDefinition({ taskTitle: 'Original', pageId: 'pg1', index: 0 });
    const id = td.getId();
    td.taskTitle = 'Changed Title';
    td.pageId = 'pg2';
    expect(td.getId()).toBe(id);
  });

  it('TaskDefinition validate fails when missing artifacts', () => {
    const td = new TaskDefinition({ taskTitle: 'No artifacts', pageId: 'p0', index: 0 });
    const res = td.validate();
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBe(2);
  });

  it('TaskDefinition serialization preserves index, metadata, artifacts', () => {
    const td = new TaskDefinition({ taskTitle: 'Serialize', pageId: 'p3', index: 3, taskMetadata: { a: 1 } });
    td.addReferenceArtifact({ type: 'text', content: 'Ref' });
    td.addTemplateArtifact({ type: 'text', content: 'Template' });
    const json = td.toJSON();
    const restored = TaskDefinition.fromJSON(json);
    expect(restored.index).toBe(3);
    expect(restored.taskMetadata).toEqual({ a: 1 });
    expect(restored.artifacts.reference[0].content).toBe('Ref');
    expect(restored.artifacts.template[0].content).toBe('Template');
  });

  it('TextTaskArtifact normalisation and immediate hash stability', () => {
    const raw = '  Line1\r\nLine2  ';
    const art = ArtifactFactory.text({ taskId: 'tX', role: 'reference', content: raw });
    expect(art.content).toBe('Line1\nLine2');
    expect(art.contentHash).toBeTruthy();
    const firstHash = art.contentHash;
    art.ensureHash(); // idempotent
    expect(art.contentHash).toBe(firstHash); // stable
    const empty = ArtifactFactory.text({ taskId: 'tY', role: 'reference', content: '   ' });
    expect(empty.content).toBeNull();
  });

  it('TableTaskArtifact trimming and markdown header separator count', () => {
    const table = ArtifactFactory.table({ taskId: 'tTable', role: 'reference', content: [['H1', 'H2', ''], [' a ', ' b ', ' '], ['', '', ''], ['', '', '']] });
    // internal cells trimmed
    expect(table.content[1][0]).toBe('a');
    // trailing empty rows removed (should not include rows with all empties)
    expect(table.content.length).toBe(2);
    // trailing empty column removed
    expect(table.content[0].length).toBe(2);
    const md = table.toMarkdown();
    const lines = md.split('\n');
    // header separator line count equals content header length
    const sepCount = lines[1].split('|').filter(s => s.trim() === '---').length;
    expect(sepCount).toBe(table.content[0].length);
  });

  it('SpreadsheetTaskArtifact canonicalisation uppercase outside quotes and idempotent with immediate hash', () => {
    const ss = ArtifactFactory.spreadsheet({ taskId: 'tSS', role: 'reference', content: [['=sum("a")', '=if("Text",1,2)']] });
    expect(ss.content[0][0]).toBe('=SUM("a")');
    expect(ss.content[0][1]).toBe('=IF("Text",1,2)');
    expect(ss.contentHash).toBeTruthy();
    const firstHash = ss.contentHash;
    ss.ensureHash(); // still stable
    expect(ss.contentHash).toBe(firstHash);
    const before = JSON.stringify(ss.content);
    // force re-normalise by creating new artifact from existing content
    const ss2 = ArtifactFactory.spreadsheet({ taskId: 'tSS', role: 'reference', content: ss.content });
    expect(JSON.stringify(ss2.content)).toBe(before);
  });

  it('ImageTaskArtifact setContentFromBlob hashing', () => {
    const img = ArtifactFactory.image({ taskId: 'tImg', role: 'reference', metadata: { sourceUrl: 'http://img' } });
    expect(img.content).toBeNull();
    const bytes1 = new Uint8Array([1, 2, 3, 4]);
    img.setContentFromBlob(bytes1);
    const hash1 = img.contentHash;
    expect(hash1).toBeTruthy();
    const img2 = ArtifactFactory.image({ taskId: 'tImg', role: 'reference', metadata: { sourceUrl: 'http://img' } });
    img2.setContentFromBlob(new Uint8Array([1, 2, 3, 4]));
    expect(img2.contentHash).toBe(hash1);
    const img3 = ArtifactFactory.image({ taskId: 'tImg', role: 'reference', metadata: { sourceUrl: 'http://img' } });
    img3.setContentFromBlob(new Uint8Array([1, 2, 3, 5]));
    expect(img3.contentHash).not.toBe(hash1);
  });

  it('Artifact UID format pattern', () => {
    const td = new TaskDefinition({ taskTitle: 'UID Test', pageId: 'pg', index: 5 });
    td.addReferenceArtifact({ type: 'text', content: 'Ref' });
    td.addTemplateArtifact({ type: 'text', content: 'Tpl' });
    const ref = td.getPrimaryReference();
    const tpl = td.getPrimaryTemplate();
    const pattern = new RegExp(`^${td.getId()}-5-(reference|template)-pg-0$`);
    expect(pattern.test(ref.getUid())).toBe(true);
    expect(pattern.test(tpl.getUid())).toBe(true);
  });

  it('StudentSubmission upsert updates hash and metadata merge', () => {
    const td = makeTD(1);
    const sub = new StudentSubmission('stu1', 'assign1', 'doc1');
    sub.upsertItemFromExtraction(td, { content: ' first ', metadata: { a: 1 } });
    const item = sub.getItem(td.getId());
    const firstHash = item.artifact.contentHash;
    expect(item.artifact.content).toBe('first');
    const firstUpdateTime = sub.updatedAt;
    sub.upsertItemFromExtraction(td, { content: ' second ', metadata: { b: 2 } });
    const item2 = sub.getItem(td.getId());
    expect(item2.artifact.content).toBe('second');
    expect(item2.artifact.contentHash).not.toBe(firstHash);
    expect(sub.updatedAt > firstUpdateTime).toBe(true);
    expect(item2.artifact.metadata).toEqual({ a: 1, b: 2 });
  });

  it('StudentSubmissionItem assessment/markAssessed/type proxy', () => {
    const td = makeTD(2);
    const sub = new StudentSubmission('stu2', 'assign1', 'doc2');
    sub.upsertItemFromExtraction(td, { content: ' response ' });
    const item = sub.getItem(td.getId());
    expect(item.getType()).toBe('text');
    item.addAssessment('quality', { score: 0.8 });
    expect(item.getAssessment('quality').score).toBe(0.8);
    item.markAssessed();
    expect(item.lastAssessedHash).toBe(item.artifact.contentHash);
  });

  it('ArtifactFactory convenience helpers create proper subclasses', () => {
    const text = ArtifactFactory.text({ taskId: 't1', role: 'reference', content: ' hi ' });
    const table = ArtifactFactory.table({ taskId: 't2', role: 'reference', content: [['H'], ['v']] });
    const sheet = ArtifactFactory.spreadsheet({ taskId: 't3', role: 'reference', content: [['=sum(a1:a2)']] });
    const img = ArtifactFactory.image({ taskId: 't4', role: 'reference' });
    expect(text).toBeInstanceOf(TextTaskArtifact);
    expect(table).toBeInstanceOf(TableTaskArtifact);
    expect(sheet).toBeInstanceOf(SpreadsheetTaskArtifact);
    expect(img).toBeInstanceOf(ImageTaskArtifact);
  });
});
