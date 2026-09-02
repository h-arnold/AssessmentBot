/**
 * Tests for `compareStudentNames` (canonical student-name comparator).
 *
 * @remarks
 * `compareStudentNames` (in `services/dataAnalysis/compareStudentNames`) was
 * previously wrapped by the now-removed `compareHeatmapStudentName`
 * (`taskHeatmapModel.ts`). These tests lock the app-wide ordering contract at
 * the heatmap call site, exercising locale-aware, case-insensitive name
 * ordering with a deterministic `studentId` ascending tie-break.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §9.17 (entry 6 — `compareStudentNames` shared helper placement)
 */

import { describe, expect, it } from 'vitest';
import { compareStudentNames } from '../../services/dataAnalysis/compareStudentNames';

// -----------------------------------------------------------------------
// compareStudentNames
// -----------------------------------------------------------------------
describe('compareStudentNames', () => {
  it('orders two rows identically to itself on the same names (sanity)', () => {
    const alice = { studentId: 's-1', studentName: 'Alice' };
    const bob = { studentId: 's-2', studentName: 'Bob' };

    const result = compareStudentNames(alice, bob);
    expect(result).toBeLessThan(0);
    // Symmetric inverse.
    expect(compareStudentNames(bob, alice)).toBeGreaterThan(0);
  });

  it('returns positive when a.studentName > b.studentName', () => {
    const bob = { studentId: 's-2', studentName: 'Bob' };
    const alice = { studentId: 's-1', studentName: 'Alice' };

    const result = compareStudentNames(bob, alice);

    expect(result).toBeGreaterThan(0);
  });

  it('tie-breaks by studentId ascending when names are equal', () => {
    const davidB = { studentId: 's-B', studentName: 'David' };
    const davidA = { studentId: 's-A', studentName: 'David' };

    const result = compareStudentNames(davidA, davidB);

    // s-A vs s-B → negative (s-A sorts before s-B)
    expect(result).toBeLessThan(0);
  });

  it('orders case-insensitively — lowercase "alice" sorts before "Bob"', () => {
    const alice = { studentId: 's-1', studentName: 'alice' };
    const bob = { studentId: 's-2', studentName: 'Bob' };

    const result = compareStudentNames(alice, bob);

    // Case-insensitive: 'alice' (lowercase) should be considered < 'Bob'
    expect(result).toBeLessThan(0);
  });
});
