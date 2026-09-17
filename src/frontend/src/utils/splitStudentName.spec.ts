import { describe, expect, it } from 'vitest';
import { compareStudentNamePart, splitStudentName } from './splitStudentName';

/** Labelled split case: `[name, input, forename, surname]`. */
type SplitCase = readonly [name: string, input: string, forename: string, surname: string];

describe('splitStudentName', () => {
  const splitCases: readonly SplitCase[] = [
    ['returns empty forename and surname for an empty string', '', '', ''],
    ['returns empty forename and surname for a whitespace-only string', '   ', '', ''],
    [
      'returns the whole name as forename with an empty surname for a single token',
      'Alice',
      'Alice',
      '',
    ],
    ['splits a two-token name into forename and surname', 'Alice Smith', 'Alice', 'Smith'],
    ['keeps apostrophes inside tokens when splitting', "Burnice O'Kon", 'Burnice', "O'Kon"],
    [
      'joins the remaining tokens into a multi-token surname',
      'Alice Mary Smith',
      'Alice',
      'Mary Smith',
    ],
    [
      'collapses multiple internal spaces so the surname uses single spaces',
      'Alice  Smith   Jones',
      'Alice',
      'Smith Jones',
    ],
    [
      'trims leading and trailing whitespace around the tokens',
      '  Alice   Smith  ',
      'Alice',
      'Smith',
    ],
    [
      'applies the first-token rule to honourific-shaped input without special-casing',
      'Miss Katarina Sauer',
      'Miss',
      'Katarina Sauer',
    ],
  ];

  it.each(splitCases)('%s', (_name, input, forename, surname) => {
    expect(splitStudentName(input)).toEqual({ forename, surname });
  });
});

describe('compareStudentNamePart', () => {
  it('orders rows by forename for the forename part', () => {
    const alice = { studentId: 's-1', studentName: 'Alice Smith' };
    const bob = { studentId: 's-2', studentName: 'Bob Jones' };

    expect(compareStudentNamePart('forename', alice, bob)).toBeLessThan(0);
    expect(compareStudentNamePart('forename', bob, alice)).toBeGreaterThan(0);
  });

  it('orders rows by surname for the surname part', () => {
    const smith = { studentId: 's-1', studentName: 'Alice Smith' };
    const jones = { studentId: 's-2', studentName: 'Bob Jones' };

    expect(compareStudentNamePart('surname', smith, jones)).toBeGreaterThan(0);
    expect(compareStudentNamePart('surname', jones, smith)).toBeLessThan(0);
  });

  it('tie-breaks by studentId ascending when the selected part is equal', () => {
    // Same forename: full-name order would put Brown first, but the forename
    // part ties on Alice so the studentId tie-break applies instead.
    const smith = { studentId: 's-2', studentName: 'Alice Smith' };
    const brown = { studentId: 's-1', studentName: 'Alice Brown' };

    expect(compareStudentNamePart('forename', smith, brown)).toBeGreaterThan(0);
    expect(compareStudentNamePart('forename', brown, smith)).toBeLessThan(0);
  });

  it('tie-breaks by studentId ascending when both surnames are empty', () => {
    const first = { studentId: 's-1', studentName: 'Plato' };
    const second = { studentId: 's-2', studentName: 'Plato' };

    expect(compareStudentNamePart('surname', first, second)).toBeLessThan(0);
    expect(compareStudentNamePart('surname', second, first)).toBeGreaterThan(0);
  });

  it('compares the selected part case-insensitively', () => {
    const alice = { studentId: 's-1', studentName: 'alice Smith' };
    const bob = { studentId: 's-2', studentName: 'Bob Jones' };

    expect(compareStudentNamePart('forename', alice, bob)).toBeLessThan(0);
  });
});
