import { budgetThresholds } from '@pfm/domain';
import {
  claimBudgetAlert,
  readBudgetMonth,
  releaseBudgetAlert,
} from '@/data/budgets';
import type { Database } from '@/data/migrate';

export interface BudgetAlertPort {
  hasPermission(): Promise<boolean>;
  send(budgetId: string, month: string, threshold: number): Promise<void>;
}

export async function processBudgetAlerts(
  db: Database,
  month: string,
  port: BudgetAlertPort,
) {
  if (!(await port.hasPermission())) return;
  const rows = await readBudgetMonth(db, month);
  for (const budget of rows.filter((row) => row.is_active && row.in_period)) {
    for (const threshold of budgetThresholds(
      budget.spent,
      budget.amount,
      budget.warn_percent,
    )) {
      if (
        !(await claimBudgetAlert(
          db,
          budget.id,
          month,
          threshold,
          new Date().toISOString(),
        ))
      )
        continue;
      try {
        // shortcut: claim-before-send avoids duplicates after a crash but can miss a crash-window alert; reconcile native delivery before release.
        await port.send(budget.id, month, threshold);
      } catch (error) {
        await releaseBudgetAlert(db, budget.id, month, threshold);
        throw error;
      }
    }
  }
}
