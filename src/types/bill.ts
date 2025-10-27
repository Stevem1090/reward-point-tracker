export type BillFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface BillType {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  bill_type_id: string | null;
  frequency: BillFrequency;
  payment_day?: number | null;
  payment_date?: string | null;
  weekly_days?: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  bill_type?: BillType;
}

export interface MonthlyBillCalculation {
  bill: Bill;
  paymentCount: number;
  individualAmount: number;
  totalAmount: number;
  effectiveDate?: Date;
}
