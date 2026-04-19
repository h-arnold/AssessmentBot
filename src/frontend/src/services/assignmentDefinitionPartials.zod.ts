import { z } from 'zod';

const TrimmedNonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0 && value.trim() === value, {
    message: 'Expected a non-empty, trimmed string.',
  });

const ISO_DATE_TIME_WITH_TIMEZONE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u;
const DELETE_UNSAFE_PATH_CHARACTERS_PATTERN = /[\\/]|\.\./u;
const LAST_CONTROL_CHARACTER_CODE = 31;
const DELETE_CHARACTER_CODE = 127;
const MAX_OFFSET_HOURS = 23;
const MAX_OFFSET_MINUTES = 59;
const MINUTES_PER_HOUR = 60;
const NEGATIVE_TIMEZONE_MULTIPLIER = -1;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * MINUTES_PER_HOUR;

type IsoDateTimeComponents = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  timezone: string;
  sign: string | undefined;
  offsetHours: number;
  offsetMinutes: number;
};

/**
 * Returns whether a string contains ASCII control characters.
 *
 * @param {string} value Candidate definition key.
 * @returns {boolean} True when any control character is present.
 */
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);

    if (
      codePoint !== undefined &&
      (codePoint <= LAST_CONTROL_CHARACTER_CODE || codePoint === DELETE_CHARACTER_CODE)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Parses ISO datetime components for backend-equivalent strict validation.
 *
 * @param {string} value Candidate datetime value.
 * @returns {IsoDateTimeComponents | null} Parsed components or null when invalid.
 */
function parseIsoDateTimeComponents(value: string): IsoDateTimeComponents | null {
  const match = ISO_DATE_TIME_WITH_TIMEZONE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
    timezone,
    sign,
    offsetHours,
    offsetMinutes,
  ] = match;

  const parsedOffsetHours = timezone === 'Z' ? 0 : Number(offsetHours);
  const parsedOffsetMinutes = timezone === 'Z' ? 0 : Number(offsetMinutes);
  if (parsedOffsetHours > MAX_OFFSET_HOURS || parsedOffsetMinutes > MAX_OFFSET_MINUTES) {
    return null;
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hours: Number(hours),
    minutes: Number(minutes),
    seconds: Number(seconds),
    milliseconds: Number(milliseconds),
    timezone,
    sign,
    offsetHours: parsedOffsetHours,
    offsetMinutes: parsedOffsetMinutes,
  };
}

/**
 * Returns the timezone offset in minutes from parsed datetime components.
 *
 * @param {IsoDateTimeComponents} components Parsed datetime components.
 * @returns {number} Timezone offset in minutes.
 */
function getTimezoneOffsetMinutes(components: IsoDateTimeComponents): number {
  const timezoneOffsetSign =
    components.timezone === 'Z' || components.sign === '+' ? 1 : NEGATIVE_TIMEZONE_MULTIPLIER;

  return (
    timezoneOffsetSign *
    (components.offsetHours * MINUTES_PER_HOUR + components.offsetMinutes)
  );
}

/**
 * Returns whether parsed datetime components round-trip through JavaScript Date parsing.
 *
 * @param {Date} parsedDate Parsed date instance.
 * @param {IsoDateTimeComponents} components Parsed datetime components.
 * @returns {boolean} True when every component round-trips exactly.
 */
function hasDateTimeRoundTrip(parsedDate: Date, components: IsoDateTimeComponents): boolean {
  const timezoneOffsetMinutes = getTimezoneOffsetMinutes(components);
  const localDate = new Date(parsedDate.getTime() + timezoneOffsetMinutes * MILLISECONDS_PER_MINUTE);

  return (
    localDate.getUTCFullYear() === components.year &&
    localDate.getUTCMonth() + 1 === components.month &&
    localDate.getUTCDate() === components.day &&
    localDate.getUTCHours() === components.hours &&
    localDate.getUTCMinutes() === components.minutes &&
    localDate.getUTCSeconds() === components.seconds &&
    localDate.getUTCMilliseconds() === components.milliseconds
  );
}

/**
 * Returns whether the candidate value is a strict ISO datetime string with timezone info.
 *
 * @param {string} value Candidate datetime value.
 * @returns {boolean} True when format and round-trip semantics are valid.
 */
function isIsoDateTimeWithTimezone(value: string): boolean {
  const components = parseIsoDateTimeComponents(value);
  if (components === null) {
    return false;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return hasDateTimeRoundTrip(parsedDate, components);
}

const IsoDateTimeWithTimezoneSchema = z.string().refine(isIsoDateTimeWithTimezone, {
  message: 'Expected an ISO datetime string with timezone info.',
});

const NullableIsoDateTimeWithTimezoneSchema = IsoDateTimeWithTimezoneSchema.nullable();

const SafeDeleteDefinitionKeySchema = TrimmedNonEmptyStringSchema.refine((value) => {
  return !DELETE_UNSAFE_PATH_CHARACTERS_PATTERN.test(value) && !hasControlCharacters(value);
}, {
  message: 'Expected a safe definition key without path traversal/control characters.',
});

export const AssignmentDefinitionPartialSchema = z
  .object({
    primaryTitle: z.string(),
    primaryTopic: z.string(),
    yearGroup: z.number().nullable(),
    alternateTitles: z.array(z.string()),
    alternateTopics: z.array(z.string()),
    documentType: z.string(),
    referenceDocumentId: z.string(),
    templateDocumentId: z.string(),
    assignmentWeighting: z.number().nullable(),
    definitionKey: TrimmedNonEmptyStringSchema,
    tasks: z.null(),
    createdAt: NullableIsoDateTimeWithTimezoneSchema,
    updatedAt: NullableIsoDateTimeWithTimezoneSchema,
  })
  .strict();

export type AssignmentDefinitionPartial = z.infer<typeof AssignmentDefinitionPartialSchema>;

export const AssignmentDefinitionPartialsResponseSchema = z.array(AssignmentDefinitionPartialSchema);

export type AssignmentDefinitionPartialsResponse = z.infer<
  typeof AssignmentDefinitionPartialsResponseSchema
>;

export const DeleteAssignmentDefinitionRequestSchema = z
  .object({
    definitionKey: SafeDeleteDefinitionKeySchema,
  })
  .strict();

export type DeleteAssignmentDefinitionRequest = z.infer<
  typeof DeleteAssignmentDefinitionRequestSchema
>;

export const DeleteAssignmentDefinitionResponseSchema = z.void();

export type DeleteAssignmentDefinitionResponse = z.infer<
  typeof DeleteAssignmentDefinitionResponseSchema
>;
