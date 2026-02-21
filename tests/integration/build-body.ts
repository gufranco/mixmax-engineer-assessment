import { faker } from '@faker-js/faker';

function fakeDateHour(): string {
  return faker.date
    .between({ from: '2023-01-01', to: '2025-12-31' })
    .toISOString()
    .substring(0, 13);
}

export function buildBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    workspaceId: faker.string.alphanumeric(8),
    metricId: faker.string.alphanumeric(10),
    count: faker.number.int({ min: 1, max: 1000 }),
    date: fakeDateHour(),
    ...overrides,
  });
}
