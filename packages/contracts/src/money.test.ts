import { describe, expect, it } from 'vitest';

import { CurrencySchema, MoneySchema } from './index';

describe('core financial contracts', () => {
  it.each([0, 1000, 100_000_000_000])('accepts VND amount %s', (value) => {
    expect(MoneySchema.parse(value)).toBe(value);
  });

  it.each([-1, 0.5, NaN, Infinity, 100_000_000_001, '1000', null])(
    'rejects invalid money %s',
    (value) => {
      expect(MoneySchema.safeParse(value).success).toBe(false);
    },
  );

  it('accepts only the supported currency', () => {
    expect(CurrencySchema.parse('VND')).toBe('VND');
    expect(CurrencySchema.safeParse('USD').success).toBe(false);
  });
});
