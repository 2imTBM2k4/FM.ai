import { describe, expect, it, vi } from 'vitest';
import { createSoftShadow } from './design-tokens';
import { formatCurrencyAmount } from '@/state/preferences';

vi.mock('@/data/connection', () => ({
  withDatabase: async () => undefined,
}));

describe('Shadow & Currency Formatting Utilities', () => {
  it('computes mode-aware soft shadows for sm, md, and lg elevations', () => {
    const lightSm = createSoftShadow('light', 'sm');
    const lightMd = createSoftShadow('light', 'md');
    const darkLg = createSoftShadow('dark', 'lg');

    expect(lightSm.shadowRadius ?? 0).toBeLessThan(lightMd.shadowRadius ?? 0);
    expect(lightMd.shadowRadius).toBe(18);
    expect(darkLg.shadowRadius).toBe(26);
    expect(darkLg.shadowOpacity ?? 0).toBeGreaterThan(
      lightMd.shadowOpacity ?? 0,
    );
  });

  it('formats zero, standard, negative, and huge integer currency amounts accurately without floats', () => {
    // Zero balance
    expect(formatCurrencyAmount(0, 'VND')).toBe('0 ₫');
    expect(formatCurrencyAmount(0, 'USD')).toBe('$0.00');

    // Standard integer VND & USD conversion
    expect(formatCurrencyAmount(30_000, 'VND')).toBe('30.000 ₫');
    expect(formatCurrencyAmount(1_500_000, 'VND', { showPlus: true })).toBe(
      '+1.500.000 ₫',
    );
    expect(formatCurrencyAmount(-450_000, 'VND')).toBe('-450.000 ₫');

    // Compact formatting
    expect(formatCurrencyAmount(1_500_000, 'VND', { compact: true })).toBe(
      '1.5M ₫',
    );
    expect(formatCurrencyAmount(100_000_000_000, 'VND')).toBe(
      '100.000.000.000 ₫',
    );

    // Truncates any accidental float input to integer smallest unit
    expect(formatCurrencyAmount(30000.89, 'VND')).toBe('30.000 ₫');
  });
});
