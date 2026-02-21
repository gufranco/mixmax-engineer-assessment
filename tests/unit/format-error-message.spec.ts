import { formatErrorMessage } from '../../src/errors/format-error-message.util';

describe('formatErrorMessage', () => {
  it('should return stack trace for Error instances', () => {
    // Arrange
    const error = new Error('something broke');

    // Act
    const result = formatErrorMessage(error);

    // Assert
    expect(result).toContain('something broke');
    expect(result).toContain('format-error-message.spec.ts');
  });

  it('should return message when stack is unavailable', () => {
    // Arrange
    const error = new Error('no stack');

    Object.defineProperty(error, 'stack', { value: undefined });

    // Act
    const result = formatErrorMessage(error);

    // Assert
    expect(result).toBe('no stack');
  });

  it('should return string representation for non-Error values', () => {
    // Act & Assert
    expect(formatErrorMessage('string error')).toBe('string error');
    expect(formatErrorMessage(42)).toBe('42');
    expect(formatErrorMessage(null)).toBe('null');
    expect(formatErrorMessage(undefined)).toBe('undefined');
  });
});
