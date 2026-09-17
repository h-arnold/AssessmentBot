import { describe, expect, it } from 'vitest';
import { compareStudentNamePart, splitStudentName } from './splitStudentName';

describe('splitStudentName', () => {
  it.each<{ name: string; input: string; forename: string; surname: string }>([
    {
      name: 'returns empty forename and surname for an empty string',
      input: '',
      forename: '',
      surname: '',
    },
    {
      name: 'returns empty forename and surname for a whitespace-only string',
      input: '   ',
      forename: '',
      surname: '',
    },
    {
      name: 'returns the whole name as forename with an empty surname for a single token',
      input: 'Alice',
      forename: 'Alice',
      surname: '',
    },
    {
      name: 'splits a two-token name into forename and surname',
      input: 'Alice Smith',
      forename: 'Alice',
      surname: 'Smith',
    },
    {
      name: 'keeps apostrophes inside tokens when splitting',
      input: "Burnice O'Kon",
      forename: 'Burnice',
      surname: "O'Kon",
    },
    {
      name: 'joins the remaining tokens into a multi-token surname',
      input: 'Alice Mary Smith',
      forename: 'Alice',
      surname: 'Mary Smith',
    },
    {
      name: 'collapses multiple internal spaces so the surname uses single spaces',
      input: 'Alice  Smith   Jones',
      forename: 'Alice',
      surname: 'Smith Jones',
    },
    {
      name: 'trims leading and trailing whitespace around the tokens',
      input: '  Alice   Smith  ',
      forename: 'Alice',
      surname: 'Smith',
    },
    {
      name: 'applies the first-token rule to honourific-shaped input without special-casing',
      input: 'Miss Katarina Sauer',
      forename: 'Miss',
      surname: 'Katarina Sauer',
    },
  ])('$name', ({ input, forename, surname }) => {
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
