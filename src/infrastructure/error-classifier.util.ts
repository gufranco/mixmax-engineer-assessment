const TRANSIENT_ERROR_NAMES = new Set([
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded',
  'InternalServerError',
  'ServiceUnavailableException',
  'TransactionConflictException',
  'TimeoutError',
  'NetworkingError',
]);

interface ErrorWithMetadata extends Error {
  $metadata?: { httpStatusCode?: number };
}

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (TRANSIENT_ERROR_NAMES.has(error.name)) {
    return true;
  }

  const metadata = (error as ErrorWithMetadata).$metadata;

  if (metadata?.httpStatusCode !== undefined && metadata.httpStatusCode >= 500) {
    return true;
  }

  return false;
}
