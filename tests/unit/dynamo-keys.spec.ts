import { faker } from '@faker-js/faker';

import { buildPartitionKey } from '../../src/infrastructure/partition-key.builder';
import { isFullDayRange } from '../../src/infrastructure/query-granularity.util';
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

describe('isFullDayRange', () => {
  it('should return true when fromDate starts at T00 and toDate ends at T23', () => {
    // Arrange
    const fromDate = '2024-06-15T00';
    const toDate = '2024-06-20T23';

    // Act & Assert
    expect(isFullDayRange(fromDate, toDate)).toBe(true);
  });

  it('should return false when fromDate does not start at T00', () => {
    // Arrange
    const fromDate = '2024-06-15T08';
    const toDate = '2024-06-20T23';

    // Act & Assert
    expect(isFullDayRange(fromDate, toDate)).toBe(false);
  });

  it('should return false when toDate does not end at T23', () => {
    // Arrange
    const fromDate = '2024-06-15T00';
    const toDate = '2024-06-20T18';

    // Act & Assert
    expect(isFullDayRange(fromDate, toDate)).toBe(false);
  });

  it('should return false when both boundaries are partial', () => {
    // Arrange
    const fromDate = '2024-06-15T14';
    const toDate = '2024-06-20T18';

    // Act & Assert
    expect(isFullDayRange(fromDate, toDate)).toBe(false);
  });

  it('should return true for a single full day', () => {
    // Arrange
    const fromDate = '2024-06-15T00';
    const toDate = '2024-06-15T23';

    // Act & Assert
    expect(isFullDayRange(fromDate, toDate)).toBe(true);
  });
});
