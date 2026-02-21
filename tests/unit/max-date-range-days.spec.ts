import { faker } from '@faker-js/faker';

import { getMaxDateRangeDays } from '../../src/config/max-date-range-days.config';

describe('getMaxDateRangeDays', () => {
  const originalValue = process.env['MAX_DATE_RANGE_DAYS'];

  afterEach(() => {
    if (originalValue !== undefined) {
      process.env['MAX_DATE_RANGE_DAYS'] = originalValue;
    } else {
      delete process.env['MAX_DATE_RANGE_DAYS'];
    }
  });

  it('should return 1825 when env var is not set', () => {
    // Arrange
    delete process.env['MAX_DATE_RANGE_DAYS'];

    // Act
    const result = getMaxDateRangeDays();

    // Assert
    expect(result).toBe(1825);
  });

  it('should return parsed value when env var is set', () => {
    // Arrange
    const days = faker.number.int({ min: 1, max: 5000 });

    process.env['MAX_DATE_RANGE_DAYS'] = String(days);

    // Act
    const result = getMaxDateRangeDays();

    // Assert
    expect(result).toBe(days);
  });

  it('should return default when env var is not a number', () => {
    // Arrange
    process.env['MAX_DATE_RANGE_DAYS'] = faker.string.alpha(5);

    // Act
    const result = getMaxDateRangeDays();

    // Assert
    expect(result).toBe(1825);
  });

  it('should return default when env var is zero', () => {
    // Arrange
    process.env['MAX_DATE_RANGE_DAYS'] = '0';

    // Act
    const result = getMaxDateRangeDays();

    // Assert
    expect(result).toBe(1825);
  });

  it('should return default when env var is negative', () => {
    // Arrange
    process.env['MAX_DATE_RANGE_DAYS'] = '-100';

    // Act
    const result = getMaxDateRangeDays();

    // Assert
    expect(result).toBe(1825);
  });
});
