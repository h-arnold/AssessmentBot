/**
 * Tests for the merged cell-preview lookup / status assembly
 * (`assembleMergedPreviewData`).
 *
 * Composite-key lookup merge (first-wins in stable column order) and per-column preview
 * status (first occurrence wins for shared taskKeys).
 *
 * GREEN: the assembly module is fully implemented and its tests pass.  The
 * assertions below pin the exact merge + status-map contract.
 */

import { describe, expect, it } from 'vitest';
import * as assembleModule from './assembleMergedPreviewData';
import type {
  AssignmentPreviewInput,
  MergedPreviewAssemblyResult,
} from './assembleMergedPreviewData';
import type { CellPreviewData, CellPreviewLookup } from './buildCellPreviewLookup';
import type { MergedHeatmapTaskColumn } from '../../services/dataAnalysis/heatmapAdapter.merged';

const assembleMergedPreviewData = assembleModule.assembleMergedPreviewData;

if (typeof assembleMergedPreviewData !== 'function') {
  throw new TypeError(
    'GREEN: assembleMergedPreviewData.ts is implemented; export missing unexpectedly'
  );
}

/**
 * Build a minimal valid `CellPreviewData` (artifactType 'base') tagged so the
 * merged-lookup first-wins assertion can tell assignments apart.
 *
 * @param {string} tag - Identity marker carried in `artifactContent`.
 * @returns {CellPreviewData} A minimal cell-preview payload.
 */
function makeCell(tag: string): CellPreviewData {
  return {
    artifactType: 'base',
    artifactContent: tag,
    reasoning: { completeness: null, accuracy: null, spag: null },
  };
}

/**
 * Build a `CellPreviewLookup` from a `studentId → taskKey → CellPreviewData` map.
 *
 * @param {Record<string, Record<string, CellPreviewData>>} entries - Source entries.
 * @returns {CellPreviewLookup} The constructed lookup.
 */
function buildLookup(entries: Record<string, Record<string, CellPreviewData>>): CellPreviewLookup {
  const outer = new Map<string, Map<string, CellPreviewData>>();
  for (const [studentId, tasks] of Object.entries(entries)) {
    const inner = new Map<string, CellPreviewData>();
    for (const [taskKey, cell] of Object.entries(tasks)) {
      inner.set(taskKey, cell);
    }
    outer.set(studentId, inner);
  }
  return outer;
}

/**
 * Build a merged-column descriptor fixture.
 *
 * @param {string} assignmentId - Contributing assignment ID.
 * @param {string} definitionKey - Definition key.
 * @param {string} taskId - Task ID.
 * @param {string | null} taskTitle - Task title.
 * @returns {MergedHeatmapTaskColumn} A merged column descriptor.
 */
function col(
  assignmentId: string,
  definitionKey: string,
  taskId: string,
  taskTitle: string | null
): MergedHeatmapTaskColumn {
  return {
    taskKey: `${definitionKey}::${taskId}`,
    taskId,
    taskTitle,
    assignmentId,
    definitionKey,
    assignmentName: assignmentId,
  };
}

describe('assembleMergedPreviewData — merged lookup', () => {
  it('merges per-assignment lookups, first-wins in stable column order for duplicate taskKeys', () => {
    const taskKey = 'def1::tA';
    const a1Lookup = buildLookup({ s1: { [taskKey]: makeCell('a1') } });
    const a2Lookup = buildLookup({ s1: { [taskKey]: makeCell('a2') } });

    // Inputs arrive in the opposite order from columnOrder on purpose: the merge
    // must follow columnOrder (first occurrence wins), not the input/selection order.
    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a2', lookup: a2Lookup, isLoading: false, hasError: false },
      { assignmentId: 'a1', lookup: a1Lookup, isLoading: false, hasError: false },
    ];
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a2', 'def1', 'tA', null),
    ];

    const result: MergedPreviewAssemblyResult = assembleMergedPreviewData(inputs, columnOrder);

    // a1 appears first in columnOrder, so its cell wins for the shared taskKey
    // even though a2 is earlier in the inputs array.
    expect(result.mergedLookup.get('s1')?.get(taskKey)?.artifactContent).toBe('a1');
  });

  it('keeps assignments with distinct taskKeys as separate merged entries', () => {
    const a1Lookup = buildLookup({ s1: { 'def1::tA': makeCell('a1') } });
    const a2Lookup = buildLookup({ s1: { 'def2::tB': makeCell('a2') } });

    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a1', lookup: a1Lookup, isLoading: false, hasError: false },
      { assignmentId: 'a2', lookup: a2Lookup, isLoading: false, hasError: false },
    ];
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a2', 'def2', 'tB', null),
    ];

    const result: MergedPreviewAssemblyResult = assembleMergedPreviewData(inputs, columnOrder);

    expect(result.mergedLookup.get('s1')?.get('def1::tA')?.artifactContent).toBe('a1');
    expect(result.mergedLookup.get('s1')?.get('def2::tB')?.artifactContent).toBe('a2');
  });
});

describe('assembleMergedPreviewData — previewStatusByTaskKey', () => {
  it('covers every selected assignment taskKeys, first occurrence wins for a shared taskKey', () => {
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a2', 'def1', 'tA', null),
    ];
    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a1', lookup: buildLookup({}), isLoading: true, hasError: false },
      { assignmentId: 'a2', lookup: buildLookup({}), isLoading: false, hasError: true },
    ];

    const result: MergedPreviewAssemblyResult = assembleMergedPreviewData(inputs, columnOrder);

    // One shared taskKey → first occurrence (a1, isLoading) wins over a2 (hasError).
    expect(result.previewStatusByTaskKey.get('def1::tA')).toEqual({
      isLoading: true,
      hasError: false,
    });
  });

  it('populates a status entry for every distinct taskKey across distinct assignments', () => {
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a1', 'def1', 'tB', null),
      col('a2', 'def2', 'tC', null),
    ];
    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a1', lookup: buildLookup({}), isLoading: false, hasError: false },
      { assignmentId: 'a2', lookup: buildLookup({}), isLoading: true, hasError: false },
    ];

    const result: MergedPreviewAssemblyResult = assembleMergedPreviewData(inputs, columnOrder);

    expect(result.previewStatusByTaskKey.size).toBe(columnOrder.length);
    expect(result.previewStatusByTaskKey.get('def1::tA')).toEqual({
      isLoading: false,
      hasError: false,
    });
    expect(result.previewStatusByTaskKey.get('def1::tB')).toEqual({
      isLoading: false,
      hasError: false,
    });
    expect(result.previewStatusByTaskKey.get('def2::tC')).toEqual({
      isLoading: true,
      hasError: false,
    });
  });

  it('maps per-assignment query state onto that assignment taskKeys (errored assignment only flags its own)', () => {
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a2', 'def2', 'tB', null),
    ];
    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a1', lookup: buildLookup({}), isLoading: false, hasError: false },
      { assignmentId: 'a2', lookup: buildLookup({}), isLoading: false, hasError: true },
    ];

    const result: MergedPreviewAssemblyResult = assembleMergedPreviewData(inputs, columnOrder);

    expect(result.previewStatusByTaskKey.get('def1::tA')).toEqual({
      isLoading: false,
      hasError: false,
    });
    expect(result.previewStatusByTaskKey.get('def2::tB')).toEqual({
      isLoading: false,
      hasError: true,
    });
  });
});

describe('assembleMergedPreviewData — fail-fast on missing preview input (T-8 / E-1)', () => {
  it('throws when a column assignmentId has no matching preview input (never silently falls back to healthy)', () => {
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a2', 'def1', 'tB', null),
    ];
    // inputs omit the preview for 'a2' — a wiring regression that previously
    // silently yielded { isLoading: false, hasError: false } for the column.
    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a1', lookup: buildLookup({}), isLoading: false, hasError: false },
    ];

    expect(() => assembleMergedPreviewData(inputs, columnOrder)).toThrow(
      /no preview input for assignmentId "a2" \(taskKey "def1::tB"\)/
    );
  });

  it('does not throw when every column assignmentId has a matching input (status map populated)', () => {
    const columnOrder: ReadonlyArray<MergedHeatmapTaskColumn> = [
      col('a1', 'def1', 'tA', null),
      col('a2', 'def1', 'tB', null),
    ];
    const inputs: ReadonlyArray<AssignmentPreviewInput> = [
      { assignmentId: 'a1', lookup: buildLookup({}), isLoading: false, hasError: false },
      { assignmentId: 'a2', lookup: buildLookup({}), isLoading: true, hasError: false },
    ];

    expect(() => assembleMergedPreviewData(inputs, columnOrder)).not.toThrow();
    const result: MergedPreviewAssemblyResult = assembleMergedPreviewData(inputs, columnOrder);

    expect(result.previewStatusByTaskKey.size).toBe(columnOrder.length);
    expect(result.previewStatusByTaskKey.get('def1::tA')).toEqual({
      isLoading: false,
      hasError: false,
    });
    expect(result.previewStatusByTaskKey.get('def1::tB')).toEqual({
      isLoading: true,
      hasError: false,
    });
  });
});
