import { BillAccount, PayPeriodSummary } from '@/types/bill';

export interface FinancialSnapshot {
  currency: 'GBP';
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  income: { total: number; items: { name: string; amount: number }[] };
  outgoings: {
    total: number;
    byAccount: {
      account: string;
      total: number;
      byType: {
        type: string;
        total: number;
        bills: {
          name: string;
          frequency: string;
          unitAmount: number;
          paymentsThisPeriod: number;
          totalThisPeriod: number;
        }[];
      }[];
    }[];
  };
  netCashFlow: number;
  accounts: {
    name: string;
    kind: string;
    balance: number;
    creditLimit?: number | null;
    apr?: number | null;
    promoEndDate?: string | null;
  }[];
  totals: {
    liquidCash: number;
    cardDebt: number;
    netPosition: number;
  };
}

export const getAccountBalanceSigned = (account: BillAccount): number => {
  const balance = Number(account.current_balance || 0);
  return account.account_kind === 'credit_card' ? -Math.abs(balance) : balance;
};

export const getNetPosition = (accounts: BillAccount[]): number =>
  accounts.reduce((sum, account) => sum + getAccountBalanceSigned(account), 0);

export const buildFinancialSnapshot = (
  summary: PayPeriodSummary,
  accounts: BillAccount[],
  periodLabel: string
): FinancialSnapshot => {
  const liquidCash = accounts
    .filter((a) => a.account_kind !== 'credit_card')
    .reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  const cardDebt = accounts
    .filter((a) => a.account_kind === 'credit_card')
    .reduce((sum, a) => sum + Math.abs(Number(a.current_balance || 0)), 0);

  return {
    currency: 'GBP',
    periodLabel,
    periodStart: summary.startDate.toISOString().slice(0, 10),
    periodEnd: summary.endDate.toISOString().slice(0, 10),
    income: {
      total: Number(summary.incomeTotal.toFixed(2)),
      items: summary.incomes.map((income) => ({
        name: income.name,
        amount: Number(income.amount),
      })),
    },
    outgoings: {
      total: Number(summary.grandTotal.toFixed(2)),
      byAccount: summary.accountBreakdowns.map((account) => ({
        account: account.accountName,
        total: Number(account.total.toFixed(2)),
        byType: account.typeBreakdowns.map((type) => ({
          type: type.typeName,
          total: Number(type.total.toFixed(2)),
          bills: type.calculations.map((calc) => ({
            name: calc.bill.name,
            frequency: calc.bill.frequency,
            unitAmount: Number(calc.individualAmount),
            paymentsThisPeriod: calc.paymentCount,
            totalThisPeriod: Number(calc.totalAmount.toFixed(2)),
          })),
        })),
      })),
    },
    netCashFlow: Number(summary.difference.toFixed(2)),
    accounts: accounts.map((account) => ({
      name: account.name,
      kind: account.account_kind,
      balance: getAccountBalanceSigned(account),
      creditLimit: account.credit_limit ?? null,
      apr: account.apr ?? null,
      promoEndDate: account.promo_end_date ?? null,
    })),
    totals: {
      liquidCash: Number(liquidCash.toFixed(2)),
      cardDebt: Number(cardDebt.toFixed(2)),
      netPosition: Number((liquidCash - cardDebt).toFixed(2)),
    },
  };
};
