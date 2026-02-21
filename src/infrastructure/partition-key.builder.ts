const KEY_PREFIX = {
  USER: 'USR#',
  WORKSPACE: 'WSP#',
  METRIC: '#MET#',
} as const;

export function buildPartitionKey(
  type: 'user' | 'workspace',
  id: string,
  metricId: string,
): string {
  const prefix = type === 'user' ? KEY_PREFIX.USER : KEY_PREFIX.WORKSPACE;

  return `${prefix}${id}${KEY_PREFIX.METRIC}${metricId}`;
}
