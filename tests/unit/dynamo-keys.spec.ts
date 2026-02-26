import { faker } from '@faker-js/faker';

import { buildPartitionKey } from '../../src/infrastructure/partition-key.builder';
import { buildQuerySegments } from '../../src/infrastructure/query-granularity.util';
import { buildSortKey } from '../../src/infrastructure/sort-key.builder';

function fakeDateHour(): string {
  return faker.date
    .between({ from: '2023-01-01', to: '2025-12-31' })
    .toISOString()
    .substring(0, 13);
}

describe('buildPartitionKey', () => {
  it('should build user partition key', () => {
    // Arrange
    const userId = faker.string.alphanumeric(8);
    const metricId = faker.string.alphanumeric(10);

    // Act
    const result = buildPartitionKey('user', userId, metricId);

    // Assert
    expect(result).toBe(`USR#${userId}#MET#${metricId}`);
  });

  it('should build workspace partition key', () => {
    // Arrange
    const workspaceId = faker.string.alphanumeric(8);
    const metricId = faker.string.alphanumeric(10);

    // Act
    const result = buildPartitionKey('workspace', workspaceId, metricId);

    // Assert
    expect(result).toBe(`WSP#${workspaceId}#MET#${metricId}`);
  });
});

describe('buildSortKey', () => {
  it('should build hourly sort key preserving full date', () => {
    // Arrange
    const date = fakeDateHour();

    // Act
    const result = buildSortKey('hourly', date);

    // Assert
    expect(result).toBe(`H#${date}`);
  });

  it('should build daily sort key truncating to date only', () => {
    // Arrange
    const date = fakeDateHour();

    // Act
    const result = buildSortKey('daily', date);

    // Assert
    expect(result).toBe(`D#${date.substring(0, 10)}`);
  });
});

describe('buildQuerySegments', () => {
  it('should return single daily segment for same-day T00-T23', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T00', '2024-06-15T23');

    // Assert
    expect(segments).toEqual([
      { granularity: 'daily', fromDate: '2024-06-15T00', toDate: '2024-06-15T23' },
    ]);
  });

  it('should return single hourly segment for same-day partial range', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T05', '2024-06-15T18');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-06-15T05', toDate: '2024-06-15T18' },
    ]);
  });

  it('should return single daily segment for multi-day T00-T23', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T00', '2024-06-20T23');

    // Assert
    expect(segments).toEqual([
      { granularity: 'daily', fromDate: '2024-06-15T00', toDate: '2024-06-20T23' },
    ]);
  });

  it('should split into leading hourly + daily when only start is partial', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T05', '2024-06-20T23');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-06-15T05', toDate: '2024-06-15T23' },
      { granularity: 'daily', fromDate: '2024-06-16T00', toDate: '2024-06-20T23' },
    ]);
  });

  it('should split into daily + trailing hourly when only end is partial', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T00', '2024-06-20T18');

    // Assert
    expect(segments).toEqual([
      { granularity: 'daily', fromDate: '2024-06-15T00', toDate: '2024-06-19T23' },
      { granularity: 'hourly', fromDate: '2024-06-20T00', toDate: '2024-06-20T18' },
    ]);
  });

  it('should split into 3 segments when both boundaries are partial', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T05', '2024-06-20T18');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-06-15T05', toDate: '2024-06-15T23' },
      { granularity: 'daily', fromDate: '2024-06-16T00', toDate: '2024-06-19T23' },
      { granularity: 'hourly', fromDate: '2024-06-20T00', toDate: '2024-06-20T18' },
    ]);
  });

  it('should return 2 hourly segments when adjacent days have no full middle', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T05', '2024-06-16T18');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-06-15T05', toDate: '2024-06-15T23' },
      { granularity: 'hourly', fromDate: '2024-06-16T00', toDate: '2024-06-16T18' },
    ]);
  });

  it('should return single hourly segment for a single hour', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-06-15T14', '2024-06-15T14');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-06-15T14', toDate: '2024-06-15T14' },
    ]);
  });

  it('should handle month boundary correctly', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-01-31T05', '2024-02-02T18');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-01-31T05', toDate: '2024-01-31T23' },
      { granularity: 'daily', fromDate: '2024-02-01T00', toDate: '2024-02-01T23' },
      { granularity: 'hourly', fromDate: '2024-02-02T00', toDate: '2024-02-02T18' },
    ]);
  });

  it('should handle leap year boundary correctly', () => {
    // Arrange & Act
    const segments = buildQuerySegments('2024-02-28T12', '2024-03-02T18');

    // Assert
    expect(segments).toEqual([
      { granularity: 'hourly', fromDate: '2024-02-28T12', toDate: '2024-02-28T23' },
      { granularity: 'daily', fromDate: '2024-02-29T00', toDate: '2024-03-01T23' },
      { granularity: 'hourly', fromDate: '2024-03-02T00', toDate: '2024-03-02T18' },
    ]);
  });
});
