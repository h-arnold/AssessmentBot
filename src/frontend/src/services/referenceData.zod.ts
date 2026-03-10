import { z } from 'zod';

const NonEmptyNameSchema = z.string().trim().min(1);

const CohortRecordInputSchema = z.object({
    name: NonEmptyNameSchema,
    active: z.boolean().optional(),
});

const UpdateCohortRecordInputSchema = z.object({
    name: NonEmptyNameSchema,
    active: z.boolean(),
});

export const CohortSchema = z.object({
    name: NonEmptyNameSchema,
    active: z.boolean(),
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
    originalName: NonEmptyNameSchema,
    record: UpdateCohortRecordInputSchema,
});

export type UpdateCohortInput = z.infer<typeof UpdateCohortInputSchema>;

export const DeleteCohortInputSchema = z.object({
    name: NonEmptyNameSchema,
});

export type DeleteCohortInput = z.infer<typeof DeleteCohortInputSchema>;

export const YearGroupSchema = z.object({
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
    originalName: NonEmptyNameSchema,
    record: z.object({
        name: NonEmptyNameSchema,
    }),
});

export type UpdateYearGroupInput = z.infer<typeof UpdateYearGroupInputSchema>;

export const DeleteYearGroupInputSchema = z.object({
    name: NonEmptyNameSchema,
});

export type DeleteYearGroupInput = z.infer<typeof DeleteYearGroupInputSchema>;