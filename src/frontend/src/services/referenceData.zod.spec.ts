import { describe, expect, it } from 'vitest';
import {
    CohortListResponseSchema,
    CohortSchema,
    CreateCohortInputSchema,
    DeleteCohortInputSchema,
    DeleteCohortResponseSchema,
    CreateYearGroupInputSchema,
    DeleteYearGroupInputSchema,
    DeleteYearGroupResponseSchema,
    UpdateCohortInputSchema,
    UpdateYearGroupInputSchema,
    YearGroupSchema,
} from './referenceData.zod';

const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

describe('referenceData.zod schemas', () => {
    it('CohortSchema accepts keyed cohort payloads with academic-year metadata', () => {
        expect(
            CohortSchema.parse({
                key: 'coh-2026',
                name: 'Cohort 2026',
                active: true,
                startYear: 2025,
                startMonth: 9,
            })
        ).toEqual({
            key: 'coh-2026',
            name: 'Cohort 2026',
            active: true,
            startYear: 2025,
            startMonth: 9,
        });
    });

    it.each(['', '   '])('CohortSchema rejects empty or whitespace-only names: %j', (name) => {
        expect(() =>
            CohortSchema.parse({
                key: 'coh-2026',
                name,
                active: true,
                startYear: 2025,
                startMonth: 9,
            })
        ).toThrow();
    });

    it.each([
        [{ name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 }],
        [{ key: 'coh-2026', active: true, startYear: 2025, startMonth: 9 }],
        [{ key: 'coh-2026', name: 'Cohort 2026', active: true, startMonth: 9 }],
        [{ key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025 }],
    ])('CohortSchema rejects backend cohort payloads that omit keyed metadata: %j', (payload) => {
        expect(() => CohortSchema.parse(payload)).toThrow();
    });

    it('CohortSchema rejects non-boolean active', () => {
        expect(() =>
            CohortSchema.parse({
                key: 'coh-2026',
                name: 'Cohort 2026',
                active: 'yes',
                startYear: 2025,
                startMonth: 9,
            })
        ).toThrow();
    });

    it('CohortListResponseSchema rejects legacy cohort payloads without key and academic-year metadata', () => {
        expect(() => CohortListResponseSchema.parse([{ name: 'Cohort 2026', active: true }])).toThrow();
    });

    it('YearGroupSchema accepts keyed year-group payloads', () => {
        expect(YearGroupSchema.parse({ key: 'yg-10', name: 'Year 10' })).toEqual({
            key: 'yg-10',
            name: 'Year 10',
        });
    });

    it.each(['', '   '])('YearGroupSchema rejects empty or whitespace-only names: %j', (name) => {
        expect(() => YearGroupSchema.parse({ key: 'yg-10', name })).toThrow();
    });

    it('CreateCohortInputSchema preserves provided academic-year metadata', () => {
        expect(
            CreateCohortInputSchema.parse({
                record: {
                    name: 'Cohort 2026',
                    active: true,
                    startYear: 2025,
                    startMonth: 9,
                },
            })
        ).toEqual({
            record: {
                name: 'Cohort 2026',
                active: true,
                startYear: 2025,
                startMonth: 9,
            },
        });
    });

    it('UpdateCohortInputSchema requires key-addressed payloads with the keyed cohort record shape', () => {
        expect(
            UpdateCohortInputSchema.parse({
                key: 'coh-2026',
                record: {
                    name: 'Cohort 2027',
                    active: false,
                    startYear: 2026,
                    startMonth: 9,
                },
            })
        ).toEqual({
            key: 'coh-2026',
            record: {
                name: 'Cohort 2027',
                active: false,
                startYear: 2026,
                startMonth: 9,
            },
        });

        expect(() =>
            UpdateCohortInputSchema.parse({
                record: {
                    name: 'Cohort 2027',
                    active: true,
                    startYear: 2026,
                    startMonth: 9,
                },
            })
        ).toThrow();
        expect(() =>
            UpdateCohortInputSchema.parse({
                originalName: 'Cohort 2026',
                record: {
                    name: 'Cohort 2027',
                    active: true,
                    startYear: 2026,
                    startMonth: 9,
                },
            })
        ).toThrow();
        expect(() =>
            UpdateCohortInputSchema.parse({
                key: 'coh-2026',
                record: { name: 'Cohort 2027', active: true },
            })
        ).toThrow();
    });

    it('DeleteCohortInputSchema accepts only key-addressed identity payloads', () => {
        expect(DeleteCohortInputSchema.parse({ key: 'coh-2026' })).toEqual({ key: 'coh-2026' });
        expect(() => DeleteCohortInputSchema.parse({ name: 'Cohort 2026' })).toThrow();
        expect(() => DeleteCohortInputSchema.parse({ key: '   ' })).toThrow();
    });

    it('DeleteCohortResponseSchema accepts an omitted backend success payload', () => {
        expect(DeleteCohortResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    });

    it('DeleteCohortResponseSchema rejects unexpected backend success payload data', () => {
        expect(() => DeleteCohortResponseSchema.parse({ deleted: true })).toThrow();
    });

    it('yearGroup create, update, and delete input schemas require keyed identity for update and delete', () => {
        expect(() => CreateYearGroupInputSchema.parse({ record: { name: '   ' } })).toThrow();
        expect(() =>
            UpdateYearGroupInputSchema.parse({
                key: 'yg-9',
                record: { name: '' },
            })
        ).toThrow();
        expect(() =>
            UpdateYearGroupInputSchema.parse({
                originalName: 'Year 9',
                record: { name: 'Year 10' },
            })
        ).toThrow();
        expect(DeleteYearGroupInputSchema.parse({ key: 'yg-10' })).toEqual({ key: 'yg-10' });
        expect(() => DeleteYearGroupInputSchema.parse({ name: 'Year 10' })).toThrow();
    });

    it('DeleteYearGroupResponseSchema accepts an omitted backend success payload', () => {
        expect(DeleteYearGroupResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    });

    it('DeleteYearGroupResponseSchema rejects unexpected backend success payload data', () => {
        expect(() => DeleteYearGroupResponseSchema.parse({ deleted: true })).toThrow();
    });
});
