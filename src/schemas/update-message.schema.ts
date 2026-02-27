import { z } from 'zod';

import { DATE_HOUR_PATTERN, isValidCalendarDate } from './date-hour.pattern';
import { IDENTIFIER_PATTERN, MAX_IDENTIFIER_LENGTH } from './identifier.pattern';

const MAX_COUNT = 1_000_000;

export const metricUpdateMessageSchema = z.object({
  schemaVersion: z.number().int().positive().default(1),
  workspaceId: z
    .string({ error: 'workspaceId is required and must be a non-empty string' })
    .min(1, 'workspaceId is required and must be a non-empty string')
    .max(MAX_IDENTIFIER_LENGTH, `workspaceId must be at most ${MAX_IDENTIFIER_LENGTH} characters`)
    .regex(
      IDENTIFIER_PATTERN,
      'workspaceId must contain only alphanumeric characters, hyphens, and underscores',
    ),
  metricId: z
    .string({ error: 'metricId is required and must be a non-empty string' })
    .min(1, 'metricId is required and must be a non-empty string')
    .max(MAX_IDENTIFIER_LENGTH, `metricId must be at most ${MAX_IDENTIFIER_LENGTH} characters`)
    .regex(
      IDENTIFIER_PATTERN,
      'metricId must contain only alphanumeric characters, hyphens, and underscores',
    ),
  count: z
    .number({ error: 'count must be a positive integer' })
    .int('count must be a positive integer')
    .positive('count must be a positive integer')
    .max(MAX_COUNT, `count must be at most ${MAX_COUNT}`),
  date: z
    .string({ error: 'date is required and must match YYYY-MM-DDThh format' })
    .regex(DATE_HOUR_PATTERN, 'date is required and must match YYYY-MM-DDThh format')
    .refine(isValidCalendarDate, 'date contains an invalid calendar date'),
  userId: z
    .string({ error: 'userId must be a non-empty string' })
    .min(1, 'userId must be a non-empty string')
    .max(MAX_IDENTIFIER_LENGTH, `userId must be at most ${MAX_IDENTIFIER_LENGTH} characters`)
    .regex(
      IDENTIFIER_PATTERN,
      'userId must contain only alphanumeric characters, hyphens, and underscores',
    )
    .optional(),
});
