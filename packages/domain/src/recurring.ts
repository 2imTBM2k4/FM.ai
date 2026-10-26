import { addDays, addMonths, monthIndex, validateDate } from './dates';

export interface RecurringSchedule {
  startOn: string;
  endOn?: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  intervalCount: number;
}

// Find the next anchored occurrence without walking every date since the start.
export function nextOccurrence(
  rule: RecurringSchedule,
  after: string,
): string | null {
  validateDate(rule.startOn);
  validateDate(after);
  if (rule.endOn) validateDate(rule.endOn);
  if (!Number.isSafeInteger(rule.intervalCount) || rule.intervalCount < 1)
    throw new RangeError('Invalid recurrence interval.');
  if (rule.endOn && rule.endOn < rule.startOn)
    throw new RangeError('Invalid recurrence end.');
  let candidate = rule.startOn;
  if (after >= rule.startOn) {
    if (rule.frequency === 'daily' || rule.frequency === 'weekly') {
      const step = rule.intervalCount * (rule.frequency === 'weekly' ? 7 : 1);
      const elapsed =
        (Date.parse(`${after}T12:00:00Z`) -
          Date.parse(`${rule.startOn}T12:00:00Z`)) /
        86400000;
      const offset = (Math.floor(elapsed / step) + 1) * step;
      const remaining =
        (Date.parse('9999-12-31T12:00:00Z') -
          Date.parse(`${rule.startOn}T12:00:00Z`)) /
        86400000;
      if (offset > remaining) return null;
      candidate = addDays(rule.startOn, offset);
    } else {
      const step = rule.intervalCount * (rule.frequency === 'yearly' ? 12 : 1);
      let offset =
        Math.floor((monthIndex(after) - monthIndex(rule.startOn)) / step) *
        step;
      candidate = addMonths(rule.startOn, offset);
      if (candidate <= after) {
        offset += step;
        if (monthIndex(rule.startOn) + offset > monthIndex('9999-12-31'))
          return null;
        candidate = addMonths(rule.startOn, offset);
      }
    }
  }
  return rule.endOn && candidate > rule.endOn ? null : candidate;
}
