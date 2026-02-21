import { getTtlDays } from '../config/ttl-days.config';

export function calculateTtl(): number {
  return Math.floor(Date.now() / 1000) + getTtlDays() * 24 * 60 * 60;
}
