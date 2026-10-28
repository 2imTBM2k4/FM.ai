import { formatVnd } from '@pfm/domain';

/**
 * Formats a stored ISO date (YYYY-MM-DD) for Vietnamese display without changing
 * the value used by forms, parsers or the database.
 */
export function formatDisplayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Formats a stored month key (YYYY-MM) as MM/YYYY.
 */
export function formatDisplayMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[2]}/${match[1]}`;
}

/**
 * Formats a month key as a compact chart label (T10 for October).
 */
export function formatDisplayMonthShort(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `T${Number(match[2])}`;
}

/**
 * Compact Vietnamese money label for small dashboard cards.
 * Uses "tr"/"tỷ" rather than the English "M"/"B" so dashboard values stay
 * consistent with the rest of the Vietnamese interface.
 */
export function formatCompactVndShort(value: number): string {
  if (!Number.isSafeInteger(value)) return formatVnd(value);
  const absolute = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absolute >= 1_000_000_000) {
    return `${sign}${trimTenth(absolute / 1_000_000_000)} tỷ`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}${trimTenth(absolute / 1_000_000)} tr`;
  }
  if (absolute >= 1_000) {
    return `${sign}${Math.round(absolute / 1_000)}k`;
  }
  return formatVnd(value);
}

function trimTenth(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toString().replace('.', ',').replace(/,0$/, '');
}
