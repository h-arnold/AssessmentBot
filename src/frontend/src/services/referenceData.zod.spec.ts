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
    it('CohortSchema accepts { name: "Year 7", active: true }', () => {
        expect(CohortSchema.parse({ name: 'Year 7', active: true })).toEqual({
            name: 'Year 7',
            active: true,
        });
    });

    it.each(['', '   '])('CohortSchema rejects empty or whitespace-only names: %j', (name) => {
        expect(() => CohortSchema.parse({ name, active: true })).toThrow();
    });

    it('CohortSchema rejects missing active so parsed backend cohort payloads stay strict', () => {
        expect(() => CohortSchema.parse({ name: 'Year 7' })).toThrow();
    });

    it('CohortSchema rejects non-boolean active', () => {
        expect(() => CohortSchema.parse({ name: 'Year 7', active: 'yes' })).toThrow();
    });

    it('CohortListResponseSchema rejects cohort payloads that omit active', () => {
        expect(() => CohortListResponseSchema.parse([{ name: 'Year 7' }])).toThrow();
    });

    it('YearGroupSchema accepts { name: "Year 10" }', () => {
        expect(YearGroupSchema.parse({ name: 'Year 10' })).toEqual({ name: 'Year 10' });
    });

    it.each(['', '   '])('YearGroupSchema rejects empty or whitespace-only names: %j', (name) => {
        expect(() => YearGroupSchema.parse({ name })).toThrow();
    });

    it('CreateCohortInputSchema accepts omitted active', () => {
        expect(CreateCohortInputSchema.parse({ record: { name: 'Year 7' } })).toEqual({
            record: { name: 'Year 7' },
        });
    });

    it('UpdateCohortInputSchema requires originalName and a valid cohort record payload', () => {
        expect(
            UpdateCohortInputSchema.parse({
                originalName: 'Year 7',
                record: { name: 'Year 8', active: false },
            })
        ).toEqual({
            originalName: 'Year 7',
            record: { name: 'Year 8', active: false },
        });

        expect(() => UpdateCohortInputSchema.parse({ record: { name: 'Year 8', active: true } })).toThrow();
        expect(() =>
            UpdateCohortInputSchema.parse({
                originalName: 'Year 7',
                record: { name: '   ', active: true },
            })
        ).toThrow();
        expect(() =>
            UpdateCohortInputSchema.parse({
                originalName: 'Year 7',
                record: { name: 'Year 8' },
            })
        ).toThrow();
    });

    it.each(['', '   '])('DeleteCohortInputSchema rejects empty names: %j', (name) => {
        expect(() => DeleteCohortInputSchema.parse({ name })).toThrow();
    });

    it('DeleteCohortResponseSchema accepts an omitted backend success payload', () => {
        expect(DeleteCohortResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    });

    it('DeleteCohortResponseSchema rejects unexpected backend success payload data', () => {
        expect(() => DeleteCohortResponseSchema.parse({ deleted: true })).toThrow();
    });

    it('yearGroup create, update, and delete input schemas reject malformed names', () => {
        expect(() => CreateYearGroupInputSchema.parse({ record: { name: '   ' } })).toThrow();
        expect(() =>
            UpdateYearGroupInputSchema.parse({
                originalName: 'Year 9',
                record: { name: '' },
            })
        ).toThrow();
        expect(() => DeleteYearGroupInputSchema.parse({ name: '   ' })).toThrow();
    });

    it('DeleteYearGroupResponseSchema accepts an omitted backend success payload', () => {
        expect(DeleteYearGroupResponseSchema.parse(omittedBackendSuccessPayload)).toBeUndefined();
    });

    it('DeleteYearGroupResponseSchema rejects unexpected backend success payload data', () => {
        expect(() => DeleteYearGroupResponseSchema.parse({ deleted: true })).toThrow();
    });
});