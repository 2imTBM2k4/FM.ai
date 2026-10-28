import { describe, expect, it, vi } from 'vitest';
import {
  createSoftShadow,
  DesignColors,
  DesignRadius,
  DesignSpacing,
} from './design-tokens';
import { formatCurrencyAmount } from '@/state/preferences';

vi.mock('@/data/connection', () => ({
  withDatabase: async () => undefined,
}));

describe('Design Tokens & Currency Formatting (Stage 1)', () => {
  it('provides complete light (Pastel Sunset) and dark (Midnight Aurora) token palettes', () => {
    expect(DesignColors.light.brand.primary).toBe('#7C5CFF');
    expect(DesignColors.dark.brand.primary).toBe('#7C5CFF');

    // Card radius tokens match the 20-28px specification
    expect(DesignRadius.md).toBe(20);
    expect(DesignRadius.lg).toBe(24);
    expect(DesignRadius.xl).toBe(28);
    expect(DesignRadius.pill).toBe(999);

    // Floating black pill tab bar tokens
    expect(DesignColors.light.tabBar.activeTab).toBe('#7C5CFF');
    expect(DesignColors.light.tabBar.addButton).toBe('#7C5CFF');
    expect(DesignSpacing.bottomTabClearance).toBeGreaterThanOrEqual(100);

    const lightShadow = createSoftShadow('light', 'md');
    const darkShadow = createSoftShadow('dark', 'lg');
    expect(lightShadow.shadowRadius).toBe(18);
    expect(darkShadow.shadowRadius).toBe(26);
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

