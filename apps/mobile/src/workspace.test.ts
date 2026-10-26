import { MoneySchema } from '@pfm/contracts';
import { formatVnd } from '@pfm/domain';
import { expect, it } from 'vitest';

it('shares validated VND amounts between the app and domain packages', () => {
  expect(formatVnd(MoneySchema.parse(1_500_000))).toBe('1.500.000 ₫');
  expect(MoneySchema.safeParse(-1).success).toBe(false);
});
