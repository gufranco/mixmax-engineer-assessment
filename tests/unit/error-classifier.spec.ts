import { isPermanentError, isTransientError } from '../../src/infrastructure/error-classifier.util';

function errorWithName(name: string): Error {
  const err = new Error('test');

  err.name = name;

  return err;
}

function errorWithMetadata(statusCode: number): Error {
  const err = new Error('test') as Error & { $metadata: { httpStatusCode: number } };

  err.$metadata = { httpStatusCode: statusCode };

  return err;
}

describe('isTransientError', () => {
  it.each([
    'ProvisionedThroughputExceededException',
    'ThrottlingException',
    'RequestLimitExceeded',
    'InternalServerError',
    'ServiceUnavailableException',
    'TransactionConflictException',
    'TimeoutError',
    'NetworkingError',
  ])('should classify %s as transient', (name) => {
    // Arrange
    const error = errorWithName(name);

    // Act & Assert
    expect(isTransientError(error)).toBe(true);
  });

  it('should classify errors with httpStatusCode >= 500 as transient', () => {
    // Arrange
    const error = errorWithMetadata(503);

    // Act & Assert
    expect(isTransientError(error)).toBe(true);
  });

  it('should not classify errors with httpStatusCode 400 as transient', () => {
    // Arrange
    const error = errorWithMetadata(400);

    // Act & Assert
    expect(isTransientError(error)).toBe(false);
  });

  it('should not classify a plain Error as transient', () => {
    // Arrange
    const error = new Error('generic error');

    // Act & Assert
    expect(isTransientError(error)).toBe(false);
  });

  it('should not classify ConditionalCheckFailedException as transient', () => {
    // Arrange
    const error = errorWithName('ConditionalCheckFailedException');

    // Act & Assert
    expect(isTransientError(error)).toBe(false);
  });

  it('should not classify a non-Error value as transient', () => {
    // Act & Assert
    expect(isTransientError('some string')).toBe(false);
    expect(isTransientError(42)).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe('isPermanentError', () => {
  it.each([
    'AccessDeniedException',
    'ResourceNotFoundException',
    'ValidationException',
    'SerializationException',
  ])('should classify %s as permanent', (name) => {
    // Arrange
    const error = errorWithName(name);

    // Act & Assert
    expect(isPermanentError(error)).toBe(true);
  });

  it('should not classify transient errors as permanent', () => {
    // Arrange
    const error = errorWithName('ThrottlingException');

    // Act & Assert
    expect(isPermanentError(error)).toBe(false);
  });

  it('should not classify a plain Error as permanent', () => {
    // Arrange
    const error = new Error('generic error');

    // Act & Assert
    expect(isPermanentError(error)).toBe(false);
  });

  it('should not classify a non-Error value as permanent', () => {
    // Act & Assert
    expect(isPermanentError('some string')).toBe(false);
    expect(isPermanentError(null)).toBe(false);
  });
});
