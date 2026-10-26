// Reject values that cannot be represented exactly as integer numbers.
function requireInteger(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Expected a safe integer.');
  }
}

// Convert an exact result only when it fits the public number representation.
function safeNumber(value: bigint): number {
  const result = Number(value);
  requireInteger(result);
  return result;
}

// Round an integer ratio to nearest, with ties away from zero.
function roundRatio(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator * sign;
  const whole = magnitude / denominator;
  return (
    sign * (whole + ((magnitude % denominator) * 2n >= denominator ? 1n : 0n))
  );
}

// Divide non-negative integers and round up without intermediate overflow.
export function ceilDiv(numerator: number, denominator: number): number {
  requireInteger(numerator);
  requireInteger(denominator);
  if (numerator < 0 || denominator <= 0) {
    throw new RangeError(
      'Ceiling division requires a non-negative numerator and positive divisor.',
    );
  }
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  return safeNumber(n / d + (n % d === 0n ? 0n : 1n));
}

// Round a scalar or exact integer ratio to whole units, with ties away from zero.
export function roundHalfUp(numerator: number, denominator = 1): number {
  requireInteger(denominator);
  if (denominator <= 0) {
    throw new RangeError('The divisor must be positive.');
  }
  if (
    denominator === 1 &&
    Number.isFinite(numerator) &&
    !Number.isInteger(numerator)
  ) {
    const whole = Math.trunc(numerator);
    const rounded =
      whole + (Math.abs(numerator - whole) >= 0.5 ? Math.sign(numerator) : 0);
    requireInteger(rounded);
    return rounded;
  }
  requireInteger(numerator);
  return safeNumber(roundRatio(BigInt(numerator), BigInt(denominator)));
}

// Express a signed ratio in basis points, or null when its denominator is zero.
export function ratioBps(
  numerator: number,
  denominator: number,
): number | null {
  requireInteger(numerator);
  requireInteger(denominator);
  if (denominator < 0) {
    throw new RangeError('The denominator cannot be negative.');
  }
  return denominator === 0
    ? null
    : safeNumber(roundRatio(BigInt(numerator) * 10_000n, BigInt(denominator)));
}
