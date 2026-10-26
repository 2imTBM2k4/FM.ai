import { ceilDiv } from './arithmetic';
import { monthIndex, validateDate } from './dates';

// Calculate remaining saving from calendar months, including overdue deadlines.
export function goalProgress(
  target: number,
  progress: number,
  date: string,
  deadline: string | null,
) {
  if (
    !Number.isSafeInteger(target) ||
    target <= 0 ||
    !Number.isSafeInteger(progress)
  )
    throw new RangeError('Invalid goal amounts.');
  validateDate(date);
  const monthsLeft =
    deadline === null
      ? null
      : Math.max(1, monthIndex(deadline) - monthIndex(date));
  return {
    monthsLeft,
    requiredPerMonth:
      monthsLeft === null
        ? null
        : ceilDiv(Math.max(0, target - progress), monthsLeft),
    achieved: progress >= target,
  };
}
