import { getTtlDays } from '../config/ttl-days.config';

export function calculateTtl(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000) + getTtlDays() * 24 * 60 * 60;
}
