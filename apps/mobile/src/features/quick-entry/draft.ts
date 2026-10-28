import { TransactionInputSchema, type TransactionInput } from '@pfm/contracts';
import type { ParsedEntry, ParseResult } from '@pfm/domain';
import type { WalletRow } from '@/data/repository';
import type { CategoryRow } from '@/data/categories';
import type { DebtRow } from '@/data/debts';
import { foldSearchText } from '@/data/search-text';
import {
  formatAmountInput,
  parseAmountInput,
  manualOccurredAt,
} from '../transactions/form';

export interface EntryDraft {
  transactionId: string;
  newDebtId: string;
  selected: boolean;
  amountConfirmed: boolean;
  kind: ParsedEntry['kind'];
  amount: string;
  walletId: string;
  toWalletId: string;
  categoryId: string;
  date: string;
  note: string;
  counterpartyLabel: string;
  debtId: string;
}
export interface EntryReferences {
  wallets: WalletRow[];
  categories: CategoryRow[];
  debts: DebtRow[];
  lastWalletId: string | null;
}
export interface ConfirmedEntry {
  transactionId: string;
  input: TransactionInput;
  newDebt: { id: string; counterpartyLabel: string } | null;
}

// Selection is explicit; unselected candidates cannot block or enter the saved batch.
export function confirmSelectedEntries(
  result: ParseResult,
  drafts: EntryDraft[],
  now: Date,
): ConfirmedEntry[] {
  if (drafts.length !== result.candidates.length)
    throw new Error('ENTRY_STATE');
  const selected = drafts.flatMap((draft, index) =>
    draft.selected
      ? [confirmEntryDraft(result.candidates[index], draft, now)]
      : [],
  );
  if (!selected.length) throw new Error('ENTRY_SELECTION');
  return selected;
}

// Populate only active references; an ambiguous wallet hint never replaces last-used wallet.
export function makeEntryDrafts(
  result: ParseResult,
  refs: EntryReferences,
  id: () => string,
): EntryDraft[] {
  const wallets = refs.wallets.filter((wallet) => !wallet.is_archived);
  const walletId =
    wallets.find((wallet) => wallet.id === refs.lastWalletId)?.id ??
    wallets[0]?.id ??
    '';
  return result.candidates.map((candidate) => {
    const category = refs.categories.find(
      (category) =>
        category.kind === candidate.kind &&
        !category.is_archived &&
        (!category.parent_id ||
          refs.categories.some(
            (parent) => parent.id === category.parent_id && !parent.is_archived,
          )) &&
        (candidate.categoryIdHint
          ? category.id === candidate.categoryIdHint
          : candidate.categoryKey !== null &&
            category.system_key === candidate.categoryKey),
    );
    const text = ` ${foldSearchText(candidate.noteText).replace(/[^a-z0-9 ]/g, ' ')} `;
    const debts = refs.debts.filter(
      (debt) =>
        debt.outstanding > 0 &&
        debt.direction ===
          (candidate.kind === 'debt_repay_paid' ? 'borrowed' : 'lent') &&
        text.includes(` ${foldSearchText(debt.counterparty_label)} `),
    );
    return {
      transactionId: id(),
      newDebtId: id(),
      selected: true,
      amountConfirmed: false,
      kind: candidate.kind,
      amount:
        candidate.amount.value === null
          ? ''
          : formatAmountInput(String(candidate.amount.value)),
      walletId,
      toWalletId: '',
      categoryId: category?.id ?? '',
      date: candidate.date.value ?? '',
      note: candidate.noteText,
      counterpartyLabel: '',
      debtId: debts.length === 1 ? debts[0].id : '',
    };
  });
}

// Convert an explicit final choice, preserving parsed time unless the date changed.
export function confirmEntryDraft(
  candidate: ParsedEntry,
  draft: EntryDraft,
  now: Date,
): ConfirmedEntry {
  if (draft.kind === 'unknown') throw new Error('ENTRY_KIND');
  if (
    candidate.explanation.includes('amount.assumed_thousands') &&
    !draft.amountConfirmed
  )
    throw new Error('ENTRY_AMOUNT_CONFIRMATION');
  const newLoan = draft.kind === 'debt_borrow' || draft.kind === 'debt_lend';
  const repay =
    draft.kind === 'debt_repay_paid' || draft.kind === 'debt_repay_received';
  const counterpartyLabel = draft.counterpartyLabel.trim();
  if (newLoan && !counterpartyLabel) throw new Error('ENTRY_COUNTERPARTY');
  if (repay && !draft.debtId) throw new Error('ENTRY_DEBT_REQUIRED');
  const financialCategory = draft.kind === 'expense' || draft.kind === 'income';
  const input = TransactionInputSchema.parse({
    kind: draft.kind,
    amount: parseAmountInput(draft.amount),
    walletId: draft.walletId,
    toWalletId: draft.kind === 'transfer' ? draft.toWalletId || null : null,
    categoryId: financialCategory ? draft.categoryId || null : null,
    debtId: newLoan ? draft.newDebtId : repay ? draft.debtId : null,
    occurredOn: draft.date,
    occurredAt:
      draft.date === candidate.date.value && candidate.occurredAtHint
        ? candidate.occurredAtHint
        : manualOccurredAt(draft.date, now),
    note: draft.note,
    source: 'parsed',
  });
  return {
    transactionId: draft.transactionId,
    input,
    newDebt: newLoan ? { id: draft.newDebtId, counterpartyLabel } : null,
  };
}
