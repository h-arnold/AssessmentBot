import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { createUpdateRequest, createUpsertRequest } from '@/test/abClass/abClassMutationFixtures';
import {
  UpsertABClassRequestSchema,
  UpdateABClassRequestSchema,
  type UpsertABClassRequest,
  type UpdateABClassRequest,
} from './abClassMutations.zod';

const NEGATIVE_COURSE_LENGTH = -1;
const FRACTIONAL_COURSE_LENGTH = 1.5;

describe('ABClass mutation request schemas', () => {
  it('exports schema-derived request types', () => {
    expectTypeOf<UpsertABClassRequest>().toEqualTypeOf<
      z.infer<typeof UpsertABClassRequestSchema>
    >();
    expectTypeOf<UpdateABClassRequest>().toEqualTypeOf<
      z.infer<typeof UpdateABClassRequestSchema>
    >();
  });

  it.each(['classId', 'cohortKey', 'yearGroupKey', 'courseLength'])(
    'requires upsert configuration %s without defaults',
    (field) => {
      const request: Record<string, unknown> = createUpsertRequest();
      delete request[field];
      expect(UpsertABClassRequestSchema.safeParse(request).success).toBe(false);
      request[field] = undefined;
      expect(UpsertABClassRequestSchema.safeParse(request).success).toBe(false);
    }
  );

  it.each(['cohortKey', 'yearGroupKey'] as const)(
    'rejects null upsert configuration %s',
    (field) => {
      expect(
        UpsertABClassRequestSchema.safeParse({ ...createUpsertRequest(), [field]: null }).success
      ).toBe(false);
    }
  );

  it('accepts all optional editable update fields and preserves explicit nulls', () => {
    const request = {
      ...createUpdateRequest(),
      cohortKey: null,
      yearGroupKey: null,
      courseLength: 2,
      active: null,
    };
    expect(UpdateABClassRequestSchema.parse(request)).toEqual(request);
    for (const isActive of [true, false]) {
      expect(UpdateABClassRequestSchema.parse({ ...request, active: isActive }).active).toBe(
        isActive
      );
    }
    expect(
      UpdateABClassRequestSchema.parse({ ...request, cohortKey: 'cohort', yearGroupKey: 'year' })
    ).toMatchObject({ cohortKey: 'cohort', yearGroupKey: 'year' });
  });

  describe.each([
    ['upsert', UpsertABClassRequestSchema, createUpsertRequest],
    ['update', UpdateABClassRequestSchema, () => ({ classId: createUpsertRequest().classId })],
  ] as const)('%s', (_name, schema, createRequest) => {
    it('distinguishes omission, null and whole metadata replacement', () => {
      const omitted = schema.parse(createRequest());
      expect(Object.hasOwn(omitted, 'metadata')).toBe(false);
      expect(schema.parse({ ...createRequest(), metadata: null })).toHaveProperty('metadata', null);
      const request = { ...createRequest(), metadata: createUpdateRequest().metadata };
      const parsed = schema.parse(request);
      expect(parsed).toEqual(request);
      expect(parsed.metadata).not.toBe(request.metadata);
      expect(parsed.metadata?.classAverages).not.toBe(request.metadata.classAverages);
      expect(parsed.metadata?.recentAssignments).not.toBe(request.metadata.recentAssignments);
    });

    it.each([
      '',
      ' ',
      ' padded',
      'padded ',
      'a/b',
      String.raw`a\b`,
      '..',
      'a..b',
      'a\0b',
      'a\u{7F}b',
      1,
      null,
    ])('rejects unsafe classId %j without trimming or coercion', (classId) => {
      expect(schema.safeParse({ ...createRequest(), classId }).success).toBe(false);
    });

    it('accepts opaque safe identifiers without numeric conversion', () => {
      const classId = '100000000000000000001';
      expect(schema.parse({ ...createRequest(), classId }).classId).toBe(classId);
    });

    it.each([
      0,
      NEGATIVE_COURSE_LENGTH,
      FRACTIONAL_COURSE_LENGTH,
      NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      '2',
      null,
    ])('rejects invalid courseLength %j', (courseLength) => {
      expect(schema.safeParse({ ...createRequest(), courseLength }).success).toBe(false);
    });

    it.each([1, Number.MAX_SAFE_INTEGER])('retains safe courseLength %s', (courseLength) => {
      expect(schema.parse({ ...createRequest(), courseLength }).courseLength).toBe(courseLength);
    });

    it.each(['classOwner', 'teachers', 'students', 'assignments', 'unexpected'])(
      'rejects protected or unknown own field %s rather than stripping',
      (field) => {
        for (const value of [[], undefined]) {
          expect(schema.safeParse({ ...createRequest(), [field]: value }).success).toBe(false);
        }
      }
    );

    it.each([undefined, {}, { recentAssignments: [] }, { classAverages: { overall: 4 } }])(
      'rejects supplied undefined or nested metadata patches %j',
      (metadata) => {
        expect(schema.safeParse({ ...createRequest(), metadata }).success).toBe(false);
      }
    );
  });

  it.each(['cohortKey', 'yearGroupKey', 'courseLength', 'active', 'metadata'])(
    'rejects own undefined update %s even alongside valid edits',
    (field) => {
      expect(
        UpdateABClassRequestSchema.safeParse({
          ...createUpdateRequest(),
          active: true,
          cohortKey: 'valid',
          [field]: undefined,
        }).success
      ).toBe(false);
    }
  );

  it.each([0, 'true', {}, []])('rejects invalid active %j without coercion', (active) => {
    expect(UpdateABClassRequestSchema.safeParse({ ...createUpdateRequest(), active }).success).toBe(
      false
    );
  });
});
