import { describe, it, expect } from 'vitest';
import { ArtifactFactory } from '../../src/AdminSheet/Models/Artifacts/index.js';

describe('Artifacts', () => {
  it('normalises text content and hashes immediately for reference/template', () => {
    const art = ArtifactFactory.text({ type: 'text', taskId: 't1', role: 'reference', content: '  Hello  ' });
    expect(art.content).toBe('Hello');
    expect(art.contentHash).toBeTruthy();
    const first = art.contentHash;
    art.ensureHash();
    expect(art.contentHash).toBe(first); // stable
  });

  it('trims table trailing empties and converts to markdown', () => {
    const table = ArtifactFactory.table({ type: 'table', taskId: 't2', role: 'reference', content: [ ['H','B',''], ['1','2',null], [' ', ' ', ' '] ] });
    const rows = table.getRows();
    expect(rows.length).toBe(2);
    const md = table.content; // already markdown
    expect(md.split('\n').length).toBe(3);
  });

  it('canonicalises spreadsheet formulas and hashes immediately', () => {
    const ss = ArtifactFactory.spreadsheet({ type: 'spreadsheet', taskId: 't3', role: 'reference', content: [ ['=sum(a1:a2)', '"a"'], ['=if("b",1,2)'] ] });
    expect(ss.content[0][0]).toBe('=SUM(A1:A2)');
    expect(ss.content[0][1]).toBe('"a"');
    expect(ss.contentHash).toBeTruthy();
    const first = ss.contentHash;
    ss.ensureHash();
    expect(ss.contentHash).toBe(first);
  });

  it('creates image artifact without base64 initially', () => {
    const img = ArtifactFactory.image({ type: 'image', taskId: 't4', role: 'reference', metadata: { sourceUrl: 'http://x/img.png' } });
    expect(img.content).toBeNull();
    expect(img.metadata.sourceUrl).toBeTruthy();
  });
});
