import { describe, expect, it } from 'vitest';
import SpreadsheetTaskArtifact from '#backend/Models/Artifacts/3_SpreadsheetTaskArtifact.js';

describe('SpreadsheetTaskArtifact content availability (RED)', () => {
  it.each([
    { grid: [] },
    { grid: [[null]] },
    {
      grid: [
        [null, null],
        [null, null],
      ],
    },
    { grid: [['', null]] },
  ])(
    'normalises a successfully read blank grid through construction and restoration',
    ({ grid }) => {
      const artifact = new SpreadsheetTaskArtifact({
        type: 'SPREADSHEET',
        role: 'reference',
        taskId: 'task-blank',
        content: grid,
      });
      expect(artifact.content).toEqual([]);
      expect(typeof artifact.contentHash).toBe('string');
      const emptyGridHash = new SpreadsheetTaskArtifact({
        type: 'SPREADSHEET',
        role: 'reference',
        taskId: 'task-blank',
        content: [],
      }).contentHash;
      expect(typeof emptyGridHash).toBe('string');
      expect(artifact.toJSON()).toMatchObject({ content: [], contentHash: emptyGridHash });
      expect(artifact.contentHash).toBe(emptyGridHash);
      const restored = new SpreadsheetTaskArtifact(artifact.toJSON());
      expect(restored.content).toEqual([]);
      expect(restored.contentHash).toBe(artifact.contentHash);
    }
  );

  it('keeps literal null unavailable instead of treating it as a successfully read blank grid', () => {
    const artifact = new SpreadsheetTaskArtifact({
      type: 'SPREADSHEET',
      role: 'submission',
      taskId: 'task-null',
      content: null,
    });
    expect(artifact.content).toBeNull();
    expect(artifact.contentHash).toBeNull();
  });

  it('normalises blank submission grids through serialization and restoration', () => {
    const artifact = new SpreadsheetTaskArtifact({
      type: 'SPREADSHEET',
      role: 'submission',
      taskId: 'task-blank',
      content: [[null]],
    });
    const restored = new SpreadsheetTaskArtifact(artifact.toJSON());
    expect(restored.content).toEqual([]);
    expect(restored.contentHash).toBe(artifact.contentHash);
  });

  it('normalises a successfully read blank template grid through construction and restoration', () => {
    const artifact = new SpreadsheetTaskArtifact({
      type: 'SPREADSHEET',
      role: 'template',
      taskId: 'task-blank-template',
      content: [[null, null], [null]],
    });
    expect(artifact.content).toEqual([]);
    expect(typeof artifact.contentHash).toBe('string');
    expect(artifact.toJSON()).toMatchObject({ content: [], contentHash: expect.any(String) });
    expect(artifact.contentHash).toBe(
      new SpreadsheetTaskArtifact({
        type: 'SPREADSHEET',
        role: 'template',
        taskId: 'task-blank-template',
        content: [],
      }).contentHash
    );
    const restored = new SpreadsheetTaskArtifact(artifact.toJSON());
    expect(restored.content).toEqual([]);
    expect(restored.contentHash).toBe(artifact.contentHash);
  });

  it('retains populated formula canonicalisation', () => {
    const artifact = new SpreadsheetTaskArtifact({
      type: 'SPREADSHEET',
      role: 'reference',
      taskId: 'task-formula',
      content: [['= sum(a1:a2)']],
    });
    expect(artifact.content).toEqual([['=SUM(A1:A2)']]);
  });
});
