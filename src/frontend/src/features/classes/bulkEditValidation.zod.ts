import { z } from 'zod';

export const courseLengthValidationMessage = 'Course length must be an integer greater than or equal to 1.';

export const bulkReferenceKeySchema = z.string().trim().min(1);

export const bulkCourseLengthSchema = z.number()
  .int(courseLengthValidationMessage)
  .min(1, courseLengthValidationMessage);
