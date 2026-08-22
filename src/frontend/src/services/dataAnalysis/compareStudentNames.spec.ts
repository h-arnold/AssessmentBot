/**
 * Tests for the shared student-name comparator (`compareStudentNames.ts`).
 *
 * @remarks
 * Covers locale-aware ascending ordering by `studentName`, the deterministic
 * `studentId` ascending tie-break when names are equal ignoring case, and the
 * direction-neutral single-comparator contract under which call sites invert
 * the result themselves to obtain descending order. Structural acceptance is
 * asserted with bare `{ studentName, studentId }` literals — no casts.
 *
 * @see SPEC.md decision 4 — flat shared services-layer placement
 */

import { describe, expect, it } from 'vitest';
import { compareStudentNames } from './compareStudentNames';

/**
 * Minimal structural shape accepted by the comparator.
 *
 * Both `StudentAverageRowModel` (Class overview rows) and `HeatmapRow`
 * (heatmap table rows) satisfy this shape structurally, so bare object
 * literals must be accepted without casts.
 */
type StudentNameComparable = Readonly<{ studentName: string; studentId: string }>;

/** Number of parameters declared on the direction-neutral comparator (`a`, `b`). */
const COMPARATOR_DECLARED_PARAMETERS = 2;

/**
 * Build a minimal row fixture matching the comparator's structural shape.
 *
 * @param {string} studentName - The student's display name (primary sort key).
 * @param {string} studentId - The stable identifier (deterministic tie-break key).
 * @returns {StudentNameComparable} A bare row literal accepted by the comparator.
 */
function buildStudentRow(studentName: string, studentId: string): StudentNameComparable {
  return { studentName, studentId };
}

describe('compareStudentNames', () => {
  // -------------------------------------------------------------------------
  // Ascending name order (locale-aware)
  // -------------------------------------------------------------------------

  it('sorts rows into ascending locale-aware studentName order', () => {
    const diana = buildStudentRow('Diana', 's-4');
    const alice = buildStudentRow('Alice', 's-1');
    const charlie = buildStudentRow('Charlie', 's-3');
    const bob = buildStudentRow('Bob', 's-2');

    const sorted = [diana, alice, charlie, bob].toSorted(compareStudentNames);

    expect(sorted.map((row) => row.studentName)).toStrictEqual([
      'Alice',
      'Bob',
      'Charlie',
      'Diana',
    ]);
  });

  // -------------------------------------------------------------------------
  // Deterministic `studentId` tie-break
  // -------------------------------------------------------------------------

  it('tie-breaks by studentId ascending when names are equal ignoring case', () => {
    const laterId = buildStudentRow('david', 's-2');
    const earlierId = buildStudentRow('David', 's-1');

    // Names equal ignoring case ('david' vs 'David') — the smaller studentId wins.
    expect(compareStudentNames(laterId, earlierId)).toBeGreaterThan(0);
    expect(compareStudentNames(earlierId, laterId)).toBeLessThan(0);

    // Deterministic regardless of input order: both permutations agree.
    const fromLaterFirst = [laterId, earlierId].toSorted(compareStudentNames);
    const fromEarlierFirst = [earlierId, laterId].toSorted(compareStudentNames);
    expect(fromLaterFirst.map((row) => row.studentId)).toStrictEqual(['s-1', 's-2']);
    expect(fromEarlierFirst.map((row) => row.studentId)).toStrictEqual(['s-1', 's-2']);
  });

  // -------------------------------------------------------------------------
  // Case-insensitive name comparison
  // -------------------------------------------------------------------------

  it('orders case-insensitively — lowercase "alice" sorts before "Bob"', () => {
    const alice = buildStudentRow('alice', 's-1');
    const bob = buildStudentRow('Bob', 's-2');

    // Codepoint ordering would rank uppercase 'B' before lowercase 'a';
    // base-sensitivity locale comparison ranks alphabetically instead.
    expect(compareStudentNames(alice, bob)).toBeLessThan(0);
  });

  // -------------------------------------------------------------------------
  // Direction-neutral single-comparator contract
  // -------------------------------------------------------------------------

  it('exposes one direction-neutral comparator that call sites invert themselves', () => {
    // Exactly two declared parameters (`a`, `b`) — no direction argument exists.
    expect(compareStudentNames).toHaveLength(COMPARATOR_DECLARED_PARAMETERS);

    const alice = buildStudentRow('Alice', 's-1');
    const bob = buildStudentRow('Bob', 's-2');

    // The single comparator yields opposite signs under operand swap...
    expect(compareStudentNames(alice, bob)).toBeLessThan(0);
    expect(compareStudentNames(bob, alice)).toBeGreaterThan(0);

    // ...so call sites obtain descending order purely by inverting the result.
    const rows = [alice, bob];
    const ascending = rows.toSorted(compareStudentNames).map((row) => row.studentName);
    const descending = rows
      .toSorted((a, b) => -compareStudentNames(a, b))
      .map((row) => row.studentName);
    expect(ascending).toStrictEqual(['Alice', 'Bob']);
    expect(descending).toStrictEqual(['Bob', 'Alice']);
  });

  // -------------------------------------------------------------------------
  // Structural acceptance of bare literals
  // -------------------------------------------------------------------------

  it('accepts bare studentName/studentId object literals without casts', () => {
    // Bare literals typed only against the structural shape compile and call
    // cleanly — no feature-owned types or casts required anywhere in this file.
    const result = compareStudentNames(
      { studentName: 'Amara', studentId: 's-1' },
      { studentName: 'Bella', studentId: 's-2' }
    );

    expect(result).toBeLessThan(0);
  });
});
