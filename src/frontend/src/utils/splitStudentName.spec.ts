import { describe, expect, it } from 'vitest';
import { compareStudentNamePart, splitStudentName } from './splitStudentName';

describe('splitStudentName', () => {
  it('returns empty forename and surname for an empty string', () => {
    expect(splitStudentName('')).toEqual({ forename: '', surname: '' });
  });

  it('returns empty forename and surname for a whitespace-only string', () => {
    expect(splitStudentName('   ')).toEqual({ forename: '', surname: '' });
  });

  it('returns the whole name as forename with an empty surname for a single token', () => {
    expect(splitStudentName('Alice')).toEqual({ forename: 'Alice', surname: '' });
  });

  it('splits a two-token name into forename and surname', () => {
    expect(splitStudentName('Alice Smith')).toEqual({ forename: 'Alice', surname: 'Smith' });
  });

  it('keeps apostrophes inside tokens when splitting', () => {
    expect(splitStudentName("Burnice O'Kon")).toEqual({ forename: 'Burnice', surname: "O'Kon" });
  });

  it('joins the remaining tokens into a multi-token surname', () => {
    expect(splitStudentName('Alice Mary Smith')).toEqual({
      forename: 'Alice',
      surname: 'Mary Smith',
    });
  });

  it('collapses multiple internal spaces so the surname uses single spaces', () => {
    expect(splitStudentName('Alice  Smith   Jones')).toEqual({
      forename: 'Alice',
      surname: 'Smith Jones',
    });
  });

  it('trims leading and trailing whitespace around the tokens', () => {
    expect(splitStudentName('  Alice   Smith  ')).toEqual({
      forename: 'Alice',
      surname: 'Smith',
    });
  });

  it('applies the first-token rule to honourific-shaped input without special-casing', () => {
    // Non-behaviour lock-in: honourifics are never special-cased; the leading
    // token is always the forename. Fixtures contain no such names (Section 1).
    expect(splitStudentName('Miss Katarina Sauer')).toEqual({
      forename: 'Miss',
      surname: 'Katarina Sauer',
    });
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
