import type { TransactionInput } from '@pfm/contracts';
import { vi } from '@/messages/vi';
export const DEBT_KIND_LABELS: Partial<
  Record<TransactionInput['kind'], string>
> = {
  debt_borrow: vi.debtBorrow,
  debt_lend: vi.debtLend,
  debt_repay_paid: vi.debtRepayPaid,
  debt_repay_received: vi.debtRepayReceived,
};
