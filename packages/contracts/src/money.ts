import { MAX_AMOUNT_VND } from '@pfm/domain';
import { z } from 'zod';

export const CurrencySchema = z.literal('VND');
export const MoneySchema = z.number().int().safe().min(0).max(MAX_AMOUNT_VND);
export type Currency = z.infer<typeof CurrencySchema>;
