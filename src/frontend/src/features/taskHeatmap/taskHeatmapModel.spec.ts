/**
 * Tests for `compareHeatmapStudentName` (`taskHeatmapModel.ts`).
 *
 * @remarks
 * The comparator is a thin `HeatmapRow`-typed wrapper delegating to the
 * canonical services comparator `compareStudentNames`; these tests lock its
 * ordering contract at the heatmap call site.
 *
 * @see SPEC.md — decision 4 ("Shared helper placement")
 */

import { describe, expect, it } from 'vitest';
import { compareHeatmapStudentName } from './taskHeatmapModel';
import type { HeatmapRow } from '../../services/dataAnalysis/heatmapAdapter';

// -----------------------------------------------------------------------
// compareHeatmapStudentName
// -----------------------------------------------------------------------
describe('compareHeatmapStudentName', () => {
  it('orders two HeatmapRows identically to compareStudentNames on the same names', () => {
    const alice: HeatmapRow = { studentId: 's-1', studentName: 'Alice', cells: [] };
    const bob: HeatmapRow = { studentId: 's-2', studentName: 'Bob', cells: [] };

    const result = compareHeatmapStudentName(alice, bob);

    expect(result).toBeLessThan(0);
  });

  it('returns positive when a.studentName > b.studentName', () => {
    const bob: HeatmapRow = { studentId: 's-2', studentName: 'Bob', cells: [] };
    const alice: HeatmapRow = { studentId: 's-1', studentName: 'Alice', cells: [] };

    const result = compareHeatmapStudentName(bob, alice);

    expect(result).toBeGreaterThan(0);
  });

  it('tie-breaks by studentId ascending when names are equal', () => {
    const davidB: HeatmapRow = { studentId: 's-B', studentName: 'David', cells: [] };
    const davidA: HeatmapRow = { studentId: 's-A', studentName: 'David', cells: [] };

    const result = compareHeatmapStudentName(davidA, davidB);

    // s-A vs s-B → negative (s-A sorts before s-B)
    expect(result).toBeLessThan(0);
  });

  it('orders case-insensitively — lowercase "alice" sorts before "Bob"', () => {
    const alice: HeatmapRow = { studentId: 's-1', studentName: 'alice', cells: [] };
    const bob: HeatmapRow = { studentId: 's-2', studentName: 'Bob', cells: [] };

    const result = compareHeatmapStudentName(alice, bob);

    // Case-insensitive: 'alice' (lowercase) should be considered < 'Bob'
    expect(result).toBeLessThan(0);
  });

  it('accepts HeatmapRow (not StudentAverageRowModel) — function is defined', () => {
    // RED phase fails because compareHeatmapStudentName is not yet exported.
    // Green phase: this call confirms the function signature accepts HeatmapRow.
    expect(typeof compareHeatmapStudentName).toBe('function');
  });
});
