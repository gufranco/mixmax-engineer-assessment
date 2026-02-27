import { faker } from '@faker-js/faker';

import { calculateTtl } from '../../src/infrastructure/calculate-ttl.util';
import { getTableName } from '../../src/config/table-name.config';
import { getTtlDays } from '../../src/config/ttl-days.config';

describe('getTableName', () => {
  const originalTableName = process.env['TABLE_NAME'];

  afterEach(() => {
    if (originalTableName !== undefined) {
      process.env['TABLE_NAME'] = originalTableName;
    } else {
      delete process.env['TABLE_NAME'];
    }
  });

  it('should return table name from TABLE_NAME variable', () => {
    // Arrange
    const name = `feature-usage-${faker.string.alphanumeric(6)}`;

    process.env['TABLE_NAME'] = name;

    // Act
    const result = getTableName();

    // Assert
    expect(result).toBe(name);
  });

  it('should throw when TABLE_NAME is not set', () => {
    // Arrange
    delete process.env['TABLE_NAME'];

    // Act & Assert
    expect(() => getTableName()).toThrow('TABLE_NAME environment variable is not set');
  });
});

describe('getTtlDays', () => {
  const originalTtl = process.env['TTL_DAYS'];

  afterEach(() => {
    if (originalTtl !== undefined) {
      process.env['TTL_DAYS'] = originalTtl;
    } else {
      delete process.env['TTL_DAYS'];
    }
  });

  it('should return 90 when env var is not set', () => {
    // Arrange
    delete process.env['TTL_DAYS'];

    // Act
    const result = getTtlDays();

    // Assert
    expect(result).toBe(90);
  });

  it('should return parsed value when env var is set', () => {
    // Arrange
    const days = faker.number.int({ min: 1, max: 365 });

    process.env['TTL_DAYS'] = String(days);

    // Act
    const result = getTtlDays();

    // Assert
    expect(result).toBe(days);
  });

  it('should return default when env var is not a number', () => {
    // Arrange
    process.env['TTL_DAYS'] = faker.string.alpha(5);

    // Act
    const result = getTtlDays();

    // Assert
    expect(result).toBe(90);
  });

  it('should return default when env var is zero', () => {
    // Arrange
    process.env['TTL_DAYS'] = '0';

    // Act
    const result = getTtlDays();

    // Assert
    expect(result).toBe(90);
  });

  it('should return default when env var is negative', () => {
    // Arrange
    process.env['TTL_DAYS'] = '-5';

    // Act
    const result = getTtlDays();

    // Assert
    expect(result).toBe(90);
  });
});

describe('calculateTtl', () => {
  const originalTtl = process.env['TTL_DAYS'];

  afterEach(() => {
    if (originalTtl !== undefined) {
      process.env['TTL_DAYS'] = originalTtl;
    } else {
      delete process.env['TTL_DAYS'];
    }
  });

  it('should return exact epoch seconds for a fixed clock', () => {
    // Arrange
    const days = faker.number.int({ min: 1, max: 365 });

    process.env['TTL_DAYS'] = String(days);

    const fixedNowMs = 1_700_000_000_000;
    const expectedTtl = 1_700_000_000 + days * 24 * 60 * 60;

    // Act
    const ttl = calculateTtl(fixedNowMs);

    // Assert
    expect(ttl).toBe(expectedTtl);
  });

  it('should default to 90 days when TTL_DAYS is not set', () => {
    // Arrange
    delete process.env['TTL_DAYS'];

    const fixedNowMs = 1_700_000_000_000;
    const ninetyDaysInSeconds = 90 * 24 * 60 * 60;
    const expectedTtl = 1_700_000_000 + ninetyDaysInSeconds;

    // Act
    const ttl = calculateTtl(fixedNowMs);

    // Assert
    expect(ttl).toBe(expectedTtl);
  });

  it('should use Date.now() when no argument is provided', () => {
    // Arrange
    delete process.env['TTL_DAYS'];

    const before = Math.floor(Date.now() / 1000);

    // Act
    const ttl = calculateTtl();

    // Assert
    const after = Math.floor(Date.now() / 1000);
    const ninetyDays = 90 * 24 * 60 * 60;

    expect(ttl).toBeGreaterThanOrEqual(before + ninetyDays);
    expect(ttl).toBeLessThanOrEqual(after + ninetyDays);
  });
});
