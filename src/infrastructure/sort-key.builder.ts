const SK_PREFIX = {
  HOURLY: 'H#',
  DAILY: 'D#',
} as const;

export function buildSortKey(granularity: 'hourly' | 'daily', date: string): string {
  const prefix = granularity === 'hourly' ? SK_PREFIX.HOURLY : SK_PREFIX.DAILY;
  const dateValue = granularity === 'daily' ? date.substring(0, 10) : date;

  return `${prefix}${dateValue}`;
}
