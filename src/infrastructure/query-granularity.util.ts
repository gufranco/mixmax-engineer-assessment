export interface QuerySegment {
  granularity: 'hourly' | 'daily';
  fromDate: string;
  toDate: string;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().substring(0, 10);
}

export function buildQuerySegments(fromDate: string, toDate: string): QuerySegment[] {
  const fromDay = fromDate.substring(0, 10);
  const toDay = toDate.substring(0, 10);
  const fromHour = fromDate.substring(11);
  const toHour = toDate.substring(11);

  if (fromDay === toDay) {
    const granularity = fromHour === '00' && toHour === '23' ? 'daily' : 'hourly';

    return [{ granularity, fromDate, toDate }];
  }

  const fromIsStart = fromHour === '00';
  const toIsEnd = toHour === '23';

  if (fromIsStart && toIsEnd) {
    return [{ granularity: 'daily', fromDate, toDate }];
  }

  const segments: QuerySegment[] = [];
  const dailyStart = fromIsStart ? fromDay : addDays(fromDay, 1);
  const dailyEnd = toIsEnd ? toDay : addDays(toDay, -1);

  if (!fromIsStart) {
    segments.push({
      granularity: 'hourly',
      fromDate,
      toDate: `${fromDay}T23`,
    });
  }

  if (dailyStart <= dailyEnd) {
    segments.push({
      granularity: 'daily',
      fromDate: `${dailyStart}T00`,
      toDate: `${dailyEnd}T23`,
    });
  }

  if (!toIsEnd) {
    segments.push({
      granularity: 'hourly',
      fromDate: `${toDay}T00`,
      toDate,
    });
  }

  return segments;
}
