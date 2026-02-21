import { faker } from '@faker-js/faker';

import { buildPartitionKey } from '../../src/infrastructure/partition-key.builder';
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
