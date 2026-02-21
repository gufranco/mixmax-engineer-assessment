export function isFullDayRange(fromDate: string, toDate: string): boolean {
  return fromDate.endsWith('T00') && toDate.endsWith('T23');
}
