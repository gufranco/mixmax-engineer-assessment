import { z } from 'zod';

import { DATE_HOUR_PATTERN } from './date-hour.pattern';
import { IDENTIFIER_PATTERN, MAX_IDENTIFIER_LENGTH } from './identifier.pattern';
import { getMaxDateRangeDays } from '../config/max-date-range-days.config';

const maxDays = getMaxDateRangeDays();

export const metricQueryRequestSchema = z
  .object({
    metricId: z
      .string({ error: 'metricId is required and must be a non-empty string' })
      .min(1, 'metricId is required and must be a non-empty string')
      .max(MAX_IDENTIFIER_LENGTH, `metricId must be at most ${MAX_IDENTIFIER_LENGTH} characters`)
      .regex(
        IDENTIFIER_PATTERN,
        'metricId must contain only alphanumeric characters, hyphens, and underscores',
      ),
    workspaceId: z
      .string({ error: 'workspaceId is required and must be a non-empty string' })
      .min(1, 'workspaceId is required and must be a non-empty string')
      .max(MAX_IDENTIFIER_LENGTH, `workspaceId must be at most ${MAX_IDENTIFIER_LENGTH} characters`)
      .regex(
        IDENTIFIER_PATTERN,
        'workspaceId must contain only alphanumeric characters, hyphens, and underscores',
      ),
    userId: z
      .string({ error: 'userId must be a non-empty string' })
      .min(1, 'userId must be a non-empty string')
      .max(MAX_IDENTIFIER_LENGTH, `userId must be at most ${MAX_IDENTIFIER_LENGTH} characters`)
      .regex(
        IDENTIFIER_PATTERN,
        'userId must contain only alphanumeric characters, hyphens, and underscores',
      )
      .optional(),
    fromDate: z
      .string({ error: 'fromDate is required and must match YYYY-MM-DDThh format' })
      .regex(DATE_HOUR_PATTERN, 'fromDate is required and must match YYYY-MM-DDThh format'),
    toDate: z
      .string({ error: 'toDate is required and must match YYYY-MM-DDThh format' })
      .regex(DATE_HOUR_PATTERN, 'toDate is required and must match YYYY-MM-DDThh format'),
  })
  .refine((data) => data.toDate >= data.fromDate, {
    error: 'toDate must not be before fromDate',
  })
  .refine(
    (data) => {
      const from = new Date(`${data.fromDate.substring(0, 10)}T00:00:00Z`);
      const to = new Date(`${data.toDate.substring(0, 10)}T00:00:00Z`);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      return diffDays <= maxDays;
    },
    { error: `date range exceeds maximum of ${maxDays} days` },
  );
