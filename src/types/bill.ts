export type BillFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one-time' | 'custom';

export interface BillType {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface BillAccount {
  id: string;
  name: string;
  color?: string | null;
  sort_order: number;
  created_at: string;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  active: boolean;
  expiry_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  bill_type_id: string | null;
  account_id?: string | null;
  frequency: BillFrequency;
  payment_day?: number | null;
  payment_date?: string | null;
  weekly_days?: string[] | null;
  custom_count?: number | null;
  expiry_date?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  bill_type?: BillType;
  account?: BillAccount | null;
}

export interface MonthlyBillCalculation {
  bill: Bill;
  paymentCount: number;
  individualAmount: number;
  totalAmount: number;
  effectiveDate?: Date;
}

export interface AccountBreakdown {
  accountId: string | null;
  accountName: string;
  accountColor: string;
  total: number;
  calculations: MonthlyBillCalculation[];
}

export interface PayPeriodSummary {
  calculations: MonthlyBillCalculation[];
  grandTotal: number;
  startDate: Date;
  endDate: Date;
  incomeTotal: number;
  incomes: Income[];
  difference: number;
  accountBreakdowns: AccountBreakdown[];
}
