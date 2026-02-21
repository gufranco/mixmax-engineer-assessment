import { faker } from '@faker-js/faker';

import { validateQueryRequest } from '../../src/validators/query-request.validator';
import { validateUpdateMessage } from '../../src/validators/update-message.validator';
import { ValidationError } from '../../src/errors/validation.error';

function fakeDateHour(): string {
  return faker.date
    .between({ from: '2023-01-01', to: '2025-12-31' })
    .toISOString()
    .substring(0, 13);
}

function fakeValidQueryRequest() {
  const baseDate = faker.date
    .between({ from: '2023-01-01', to: '2025-12-31' })
    .toISOString()
    .substring(0, 10);

  return {
    metricId: faker.string.alphanumeric(10),
    workspaceId: faker.string.alphanumeric(8),
    fromDate: `${baseDate}T00`,
    toDate: `${baseDate}T23`,
  };
}

function fakeValidUpdateMessage() {
  return {
    workspaceId: faker.string.alphanumeric(8),
    metricId: faker.string.alphanumeric(10),
    count: faker.number.int({ min: 1, max: 1000 }),
    date: fakeDateHour(),
  };
}

describe('validateQueryRequest', () => {
  it('should return typed object for valid request without userId', () => {
    // Arrange
    const request = fakeValidQueryRequest();

    // Act
    const result = validateQueryRequest(request);

    // Assert
    expect(result).toEqual({ ...request, userId: undefined });
  });

  it('should return typed object for valid request with userId', () => {
    // Arrange
    const request = fakeValidQueryRequest();
    const userId = faker.string.alphanumeric(8);

    // Act
    const result = validateQueryRequest({ ...request, userId });

    // Assert
    expect(result.userId).toBe(userId);
    expect(result.metricId).toBe(request.metricId);
  });

  it('should throw when metricId is missing', () => {
    // Arrange
    const { metricId: _, ...input } = fakeValidQueryRequest();

    // Act & Assert
    expect(() => validateQueryRequest(input)).toThrow(ValidationError);
    expect(() => validateQueryRequest(input)).toThrow('metricId is required');
  });

  it('should throw when metricId is empty string', () => {
    // Act & Assert
    expect(() => validateQueryRequest({ ...fakeValidQueryRequest(), metricId: '' })).toThrow(
      ValidationError,
    );
  });

  it('should throw when workspaceId is missing', () => {
    // Arrange
    const { workspaceId: _, ...input } = fakeValidQueryRequest();

    // Act & Assert
    expect(() => validateQueryRequest(input)).toThrow(ValidationError);
    expect(() => validateQueryRequest(input)).toThrow('workspaceId is required');
  });

  it('should throw when userId is provided as empty string', () => {
    // Act & Assert
    expect(() => validateQueryRequest({ ...fakeValidQueryRequest(), userId: '' })).toThrow(
      'userId must be a non-empty string',
    );
  });

  it('should throw when fromDate is missing', () => {
    // Arrange
    const { fromDate: _, ...input } = fakeValidQueryRequest();

    // Act & Assert
    expect(() => validateQueryRequest(input)).toThrow('fromDate is required');
  });

  it('should throw when toDate is missing', () => {
    // Arrange
    const { toDate: _, ...input } = fakeValidQueryRequest();

    // Act & Assert
    expect(() => validateQueryRequest(input)).toThrow('toDate is required');
  });

  it('should throw when fromDate has invalid format', () => {
    // Arrange
    const invalidDate = faker.date
      .between({ from: '2023-01-01', to: '2025-12-31' })
      .toISOString()
      .substring(0, 10);

    // Act & Assert
    expect(() =>
      validateQueryRequest({ ...fakeValidQueryRequest(), fromDate: invalidDate }),
    ).toThrow('fromDate is required and must match YYYY-MM-DDThh format');
  });

  it('should throw when toDate has invalid format', () => {
    // Act & Assert
    expect(() =>
      validateQueryRequest({ ...fakeValidQueryRequest(), toDate: faker.string.alpha(10) }),
    ).toThrow('toDate is required and must match YYYY-MM-DDThh format');
  });

  it('should throw when toDate is before fromDate', () => {
    // Act & Assert
    expect(() =>
      validateQueryRequest({
        ...fakeValidQueryRequest(),
        fromDate: '2024-02-01T00',
        toDate: '2024-01-01T00',
      }),
    ).toThrow('toDate must not be before fromDate');
  });

  it('should throw when date range exceeds 1825 days', () => {
    // Act & Assert
    expect(() =>
      validateQueryRequest({
        ...fakeValidQueryRequest(),
        fromDate: '2020-01-01T00',
        toDate: '2025-06-01T00',
      }),
    ).toThrow('date range exceeds maximum of 1825 days');
  });

  it('should accept date range of exactly 1825 days', () => {
    // Act
    const result = validateQueryRequest({
      ...fakeValidQueryRequest(),
      fromDate: '2020-01-01T00',
      toDate: '2024-12-30T00',
    });

    // Assert
    expect(result.fromDate).toBe('2020-01-01T00');
  });

  it('should throw when input is null', () => {
    // Act & Assert
    expect(() => validateQueryRequest(null)).toThrow('request must be a non-null object');
  });

  it('should throw when input is a string', () => {
    // Act & Assert
    expect(() => validateQueryRequest(faker.string.alpha(10))).toThrow(ValidationError);
  });

  it('should throw when input is an array', () => {
    // Act & Assert
    expect(() => validateQueryRequest([1, 2, 3])).toThrow(ValidationError);
  });

  it('should throw when workspaceId contains hash character', () => {
    // Act & Assert
    expect(() =>
      validateQueryRequest({ ...fakeValidQueryRequest(), workspaceId: 'abc#def' }),
    ).toThrow('workspaceId must contain only alphanumeric characters, hyphens, and underscores');
  });

  it('should throw when metricId exceeds max length', () => {
    // Arrange
    const longId = faker.string.alphanumeric(129);

    // Act & Assert
    expect(() => validateQueryRequest({ ...fakeValidQueryRequest(), metricId: longId })).toThrow(
      'metricId must be at most 128 characters',
    );
  });

  it('should throw when userId contains special characters', () => {
    // Act & Assert
    expect(() =>
      validateQueryRequest({ ...fakeValidQueryRequest(), userId: 'user@workspace' }),
    ).toThrow('userId must contain only alphanumeric characters, hyphens, and underscores');
  });

  it('should accept identifiers with hyphens and underscores', () => {
    // Arrange
    const request = {
      ...fakeValidQueryRequest(),
      workspaceId: 'my-workspace_01',
      metricId: 'emails_sent-v2',
    };

    // Act
    const result = validateQueryRequest(request);

    // Assert
    expect(result.workspaceId).toBe('my-workspace_01');
    expect(result.metricId).toBe('emails_sent-v2');
  });
});

describe('validateUpdateMessage', () => {
  it('should return typed object for valid message without userId', () => {
    // Arrange
    const message = fakeValidUpdateMessage();

    // Act
    const result = validateUpdateMessage(message);

    // Assert
    expect(result).toEqual({ ...message, userId: undefined });
  });

  it('should return typed object for valid message with userId', () => {
    // Arrange
    const message = fakeValidUpdateMessage();
    const userId = faker.string.alphanumeric(8);

    // Act
    const result = validateUpdateMessage({ ...message, userId });

    // Assert
    expect(result.userId).toBe(userId);
  });

  it('should throw when workspaceId is missing', () => {
    // Arrange
    const { workspaceId: _, ...input } = fakeValidUpdateMessage();

    // Act & Assert
    expect(() => validateUpdateMessage(input)).toThrow('workspaceId is required');
  });

  it('should throw when metricId is missing', () => {
    // Arrange
    const { metricId: _, ...input } = fakeValidUpdateMessage();

    // Act & Assert
    expect(() => validateUpdateMessage(input)).toThrow('metricId is required');
  });

  it('should throw when count is missing', () => {
    // Arrange
    const { count: _, ...input } = fakeValidUpdateMessage();

    // Act & Assert
    expect(() => validateUpdateMessage(input)).toThrow('count must be a positive finite number');
  });

  it('should throw when date is missing', () => {
    // Arrange
    const { date: _, ...input } = fakeValidUpdateMessage();

    // Act & Assert
    expect(() => validateUpdateMessage(input)).toThrow('date is required');
  });

  it('should throw when count is zero', () => {
    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), count: 0 })).toThrow(
      'count must be a positive finite number',
    );
  });

  it('should throw when count is negative', () => {
    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), count: -1 })).toThrow(
      'count must be a positive finite number',
    );
  });

  it('should throw when count is NaN', () => {
    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), count: NaN })).toThrow(
      'count must be a positive finite number',
    );
  });

  it('should throw when count is Infinity', () => {
    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), count: Infinity })).toThrow(
      'count must be a positive finite number',
    );
  });

  it('should throw when count is a string', () => {
    // Act & Assert
    expect(() =>
      validateUpdateMessage({
        ...fakeValidUpdateMessage(),
        count: String(faker.number.int({ min: 1, max: 100 })),
      }),
    ).toThrow('count must be a positive finite number');
  });

  it('should throw when date has invalid format', () => {
    // Arrange
    const invalidDate = faker.date
      .between({ from: '2023-01-01', to: '2025-12-31' })
      .toISOString()
      .substring(0, 10);

    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), date: invalidDate })).toThrow(
      'date is required and must match YYYY-MM-DDThh format',
    );
  });

  it('should throw when input is null', () => {
    // Act & Assert
    expect(() => validateUpdateMessage(null)).toThrow('message body must be a non-null object');
  });

  it('should throw when workspaceId contains hash character', () => {
    // Act & Assert
    expect(() =>
      validateUpdateMessage({ ...fakeValidUpdateMessage(), workspaceId: 'ws#inject' }),
    ).toThrow('workspaceId must contain only alphanumeric characters, hyphens, and underscores');
  });

  it('should throw when metricId exceeds max length', () => {
    // Arrange
    const longId = faker.string.alphanumeric(129);

    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), metricId: longId })).toThrow(
      'metricId must be at most 128 characters',
    );
  });

  it('should throw when count exceeds maximum', () => {
    // Act & Assert
    expect(() => validateUpdateMessage({ ...fakeValidUpdateMessage(), count: 1_000_001 })).toThrow(
      'count must be at most 1000000',
    );
  });

  it('should accept count at exactly the maximum', () => {
    // Arrange
    const message = { ...fakeValidUpdateMessage(), count: 1_000_000 };

    // Act
    const result = validateUpdateMessage(message);

    // Assert
    expect(result.count).toBe(1_000_000);
  });

  it('should accept identifiers with hyphens and underscores', () => {
    // Arrange
    const message = {
      ...fakeValidUpdateMessage(),
      workspaceId: 'my-ws_01',
      metricId: 'emails_sent-v2',
    };

    // Act
    const result = validateUpdateMessage(message);

    // Assert
    expect(result.workspaceId).toBe('my-ws_01');
    expect(result.metricId).toBe('emails_sent-v2');
  });
});
