import { z } from 'zod';

const NonEmptyNameSchema = z.string().trim().min(1);

const MIN_VALID_MONTH = 1;
const MAX_VALID_MONTH = 12;

const CohortRecordInputSchema = z.object({
    name: NonEmptyNameSchema,
    active: z.boolean().optional(),
    startYear: z.number().int().optional(),
    startMonth: z.number().int().min(MIN_VALID_MONTH).max(MAX_VALID_MONTH).optional(),
});

const UpdateCohortRecordInputSchema = z.object({
    name: NonEmptyNameSchema,
    active: z.boolean(),
    startYear: z.number().int().optional(),
    startMonth: z.number().int().min(MIN_VALID_MONTH).max(MAX_VALID_MONTH).optional(),
});

export const CohortSchema = z.object({
    key: NonEmptyNameSchema,
    name: NonEmptyNameSchema,
    active: z.boolean(),
    startYear: z.number().int(),
    startMonth: z.number().int().min(MIN_VALID_MONTH).max(MAX_VALID_MONTH),
});

export type Cohort = z.infer<typeof CohortSchema>;

export const CohortListResponseSchema = z.array(CohortSchema);

export type CohortListResponse = z.infer<typeof CohortListResponseSchema>;

export const CreateCohortResponseSchema = CohortSchema;

export type CreateCohortResponse = z.infer<typeof CreateCohortResponseSchema>;

export const UpdateCohortResponseSchema = CohortSchema;

export type UpdateCohortResponse = z.infer<typeof UpdateCohortResponseSchema>;

export const DeleteCohortResponseSchema = z.void();

export type DeleteCohortResponse = z.infer<typeof DeleteCohortResponseSchema>;

export const CreateCohortInputSchema = z.object({
    record: CohortRecordInputSchema,
});

export type CreateCohortInput = z.infer<typeof CreateCohortInputSchema>;

export const UpdateCohortInputSchema = z.object({
    key: NonEmptyNameSchema,
    record: UpdateCohortRecordInputSchema,
});

export type UpdateCohortInput = z.infer<typeof UpdateCohortInputSchema>;

export const DeleteCohortInputSchema = z.object({
    key: NonEmptyNameSchema,
});

export type DeleteCohortInput = z.infer<typeof DeleteCohortInputSchema>;

export const YearGroupSchema = z.object({
    key: NonEmptyNameSchema,
    name: NonEmptyNameSchema,
});

export type YearGroup = z.infer<typeof YearGroupSchema>;

export const YearGroupListResponseSchema = z.array(YearGroupSchema);

export type YearGroupListResponse = z.infer<typeof YearGroupListResponseSchema>;

export const CreateYearGroupResponseSchema = YearGroupSchema;

export type CreateYearGroupResponse = z.infer<typeof CreateYearGroupResponseSchema>;

export const UpdateYearGroupResponseSchema = YearGroupSchema;

export type UpdateYearGroupResponse = z.infer<typeof UpdateYearGroupResponseSchema>;

export const DeleteYearGroupResponseSchema = z.void();

export type DeleteYearGroupResponse = z.infer<typeof DeleteYearGroupResponseSchema>;

export const CreateYearGroupInputSchema = z.object({
    record: z.object({
        name: NonEmptyNameSchema,
    }),
});

export type CreateYearGroupInput = z.infer<typeof CreateYearGroupInputSchema>;

export const UpdateYearGroupInputSchema = z.object({
    key: NonEmptyNameSchema,
    record: z.object({
        name: NonEmptyNameSchema,
    }),
});

export type UpdateYearGroupInput = z.infer<typeof UpdateYearGroupInputSchema>;

export const DeleteYearGroupInputSchema = z.object({
    key: NonEmptyNameSchema,
});

export type DeleteYearGroupInput = z.infer<typeof DeleteYearGroupInputSchema>;
