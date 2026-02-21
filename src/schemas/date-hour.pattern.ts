export const DATE_HOUR_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3])$/;

export function isValidCalendarDate(dateHour: string): boolean {
  const datePart = dateHour.substring(0, 10);
  const parsed = new Date(`${datePart}T00:00:00Z`);

  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(datePart);
}
