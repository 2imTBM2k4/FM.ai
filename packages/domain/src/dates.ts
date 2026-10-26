export interface Clock {
  now(): Date;
  timeZone: string;
}

// Count days using Gregorian leap-year rules without the machine's timezone.
export function daysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError(
      'Expected a year from 1 to 9999 and month from 1 to 12.',
    );
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];
}

// Validate and return a canonical local calendar date.
export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Expected YYYY-MM-DD.');
  }
  const [year, month, day] = value.split('-').map(Number);
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError('Invalid calendar day.');
  }
  return value;
}

// Get today's calendar date from the injected clock and configured timezone.
export function today(clock: Clock): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: clock.timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(clock.now());
  const fields = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return validateDate(
    `${fields.year.padStart(4, '0')}-${fields.month}-${fields.day}`,
  );
}

// Get the month key of a validated local date.
export function monthKey(value: string): string {
  return validateDate(value).slice(0, 7);
}

// Convert a calendar month into an integer for month-distance calculations.
export function monthIndex(value: string): number {
  const [year, month] = validateDate(value).split('-').map(Number);
  return year * 12 + month - 1;
}

// Add whole calendar months, clamping the day to the last day of the target month.
export function addMonths(value: string, delta: number): string {
  if (!Number.isSafeInteger(delta)) {
    throw new RangeError('Month offset must be a safe integer.');
  }
  const target = monthIndex(value) + delta;
  const year = Math.floor(target / 12);
  const month = (target % 12) + 1;
  const day = Math.min(Number(value.slice(8)), daysInMonth(year, month));
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Add whole days using UTC only as a calendar arithmetic representation.
export function addDays(value: string, delta: number): string {
  validateDate(value);
  if (!Number.isSafeInteger(delta)) {
    throw new RangeError('Day offset must be a safe integer.');
  }
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return validateDate(date.toISOString().slice(0, 10));
}

// Return Monday of the week containing the given local date.
export function startOfWeek(value: string): string {
  validateDate(value);
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return addDays(value, -((day + 6) % 7));
}
