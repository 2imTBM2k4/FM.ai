import { addDays, nextOccurrence, today } from '@pfm/domain';
import { scheduleOf, type RecurringRow } from '@/data/recurring';

export const RECURRING_NOTIFICATION_PREFIX = 'pfm-recurring-';

// Keep the earliest reminders across rules in a finite, replenished local window.
export function buildRecurringReminders(
  rules: RecurringRow[],
  excluded: Set<string>,
  now: Date,
  capacity = 32,
) {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 32)
    throw new RangeError('Invalid reminder capacity.');
  const date = today({ now: () => now, timeZone: 'Asia/Ho_Chi_Minh' });
  const result: { id: string; date: string; at: number }[] = [];
  for (const rule of rules) {
    if (!rule.is_active || rule.blocked) continue;
    let after =
      rule.last_generated_on && rule.last_generated_on > date
        ? rule.last_generated_on
        : date;
    let count = 0;
    for (
      let attempt = 0;
      count < capacity && attempt < capacity + excluded.size + 1;
      attempt++
    ) {
      const next = nextOccurrence(scheduleOf(rule), after);
      if (!next) break;
      after = next;
      const at = Date.parse(`${addDays(next, -1)}T09:00:00+07:00`);
      if (at <= now.getTime() || excluded.has(`${rule.id}/${next}`)) continue;
      result.push({
        id: `${RECURRING_NOTIFICATION_PREFIX}${rule.id}-${next}`,
        date: next,
        at,
      });
      count++;
    }
  }
  return result
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .slice(0, capacity);
}
