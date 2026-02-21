export function getTableName(): string {
  const env = process.env['ENV'];

  if (!env) {
    throw new Error('ENV environment variable is not set');
  }

  return `feature-usage-${env}`;
}
