const DEFAULT_TTL_DAYS = 90;

export function getTtlDays(): number {
  const value = Number(process.env['TTL_DAYS']);

  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TTL_DAYS;
}
