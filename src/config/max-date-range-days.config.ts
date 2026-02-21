const DEFAULT_MAX_DATE_RANGE_DAYS = 1825;

export function getMaxDateRangeDays(): number {
  const value = Number(process.env['MAX_DATE_RANGE_DAYS']);

  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_DATE_RANGE_DAYS;
}
