import { useState } from 'react';
import { BudgetManager } from '@/features/budgets/budget-manager';
import { StatsView } from '@/features/stats/stats-view';

export default function Budgets() {
  const [activeTab, setActiveTab] = useState<'stats' | 'budgets'>('stats');
  return activeTab === 'stats' ? (
    <StatsView onSwitchToBudgets={() => setActiveTab('budgets')} />
  ) : (
    <BudgetManager onSwitchToStats={() => setActiveTab('stats')} />
  );
}
