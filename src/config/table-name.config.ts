export function getTableName(): string {
  const name = process.env['TABLE_NAME'];

  if (!name) {
    throw new Error('TABLE_NAME environment variable is not set');
  }

  return name;
}
