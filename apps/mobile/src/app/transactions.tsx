import { TransactionManager } from '@/features/transactions/transaction-manager';
import { RecurringManager } from '@/features/recurring/recurring-manager';
import { DebtManager } from '@/features/debts/debt-manager';
import { useState } from 'react';
export default function Transactions() {
  const [recurring, setRecurring] = useState(false);
  const [debts, setDebts] = useState(false);
  if (debts) return <DebtManager onClose={() => setDebts(false)} />;
  return recurring ? (
    <RecurringManager onClose={() => setRecurring(false)} />
  ) : (
    <TransactionManager
      onManageRecurring={() => setRecurring(true)}
      onManageDebts={() => setDebts(true)}
    />
  );
}
