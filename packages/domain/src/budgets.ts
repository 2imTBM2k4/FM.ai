export function budgetThresholds(
  spent: number,
  amount: number,
  warnPercent: number,
): number[] {
  if (
    !Number.isSafeInteger(spent) ||
    spent < 0 ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !Number.isInteger(warnPercent) ||
    warnPercent < 1 ||
    warnPercent > 100
  )
    throw new RangeError('Invalid budget threshold inputs.');
  const result: number[] = [];
  if (BigInt(spent) * 100n >= BigInt(amount) * BigInt(warnPercent))
    result.push(warnPercent);
  if (spent >= amount && warnPercent !== 100) result.push(100);
  return result;
}
