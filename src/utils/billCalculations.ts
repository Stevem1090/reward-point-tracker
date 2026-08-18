import {
  AccountBreakdown,
  Bill,
  Income,
  MonthlyBillCalculation,
  PayPeriodSummary,
} from '@/types/bill';

// Hardcoded pay day (27th of each month)
const PAY_DAY = 27;

// Helper to get payment day with default
export const getPaymentDay = (bill: Bill): number => {
  return bill.payment_day || 1;
};

// Count number of days in a month
export const countDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// Calculate pay period date range for a given display month
export const getPayPeriodRange = (displayYear: number, displayMonth: number): {
  startDate: Date;
  endDate: Date;
} => {
  // If display month is "February", we want Jan 27 - Feb 26
  // Start is always the 27th of the PREVIOUS month
  const startMonth = displayMonth === 0 ? 11 : displayMonth - 1;
  const startYear = displayMonth === 0 ? displayYear - 1 : displayYear;
  
  const startDate = new Date(startYear, startMonth, PAY_DAY);
  
  // End is always the 26th of the display month
  const endDate = new Date(displayYear, displayMonth, 26);
  
  return { startDate, endDate };
};

// Check if a date falls within a pay period
export const isDateInPayPeriod = (
  date: Date,
  startDate: Date,
  endDate: Date
): boolean => {
  return date >= startDate && date <= endDate;
};

// Parse an expiry (or payment) date string into a local Date at end of day
const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// The effective end of a bill within a period, capped by its expiry date
export const getEffectiveEndDate = (bill: Bill, endDate: Date): Date => {
  const expiry = parseDate(bill.expiry_date);
  if (!expiry) return endDate;
  return expiry < endDate ? expiry : endDate;
};

export const isBillExpiredForPeriod = (bill: Bill, startDate: Date): boolean => {
  const expiry = parseDate(bill.expiry_date);
  return !!expiry && expiry < startDate;
};

export const isBillExpiredNow = (bill: Bill): boolean => {
  const expiry = parseDate(bill.expiry_date);
  if (!expiry) return false;
  return expiry < new Date(new Date().toDateString());
};

// Count occurrences of a specific weekday within a date range
export const countWeekdayOccurrencesInRange = (
  startDate: Date,
  endDate: Date,
  weekday: string
): number => {
  const weekdayMap: { [key: string]: number } = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const targetDay = weekdayMap[weekday];
  if (targetDay === undefined) return 0;

  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    if (currentDate.getDay() === targetDay) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
};

// Count number of days between two dates (inclusive)
export const countDaysInRange = (startDate: Date, endDate: Date): number => {
  if (endDate < startDate) return 0;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
};

// Check if a yearly bill is due in a specific pay period
export const isPaymentDueInPayPeriod = (
  bill: Bill,
  startDate: Date,
  endDate: Date
): boolean => {
  if (!bill.payment_date) return false;

  const paymentDate = new Date(bill.payment_date);
  return isDateInPayPeriod(paymentDate, startDate, endDate);
};

// Check if a one-time bill is due in a specific pay period
export const isOneTimeBillInPayPeriod = (
  bill: Bill,
  startDate: Date,
  endDate: Date
): boolean => {
  if (!bill.payment_date) return false;
  
  const paymentDate = new Date(bill.payment_date);
  return isDateInPayPeriod(paymentDate, startDate, endDate);
};

// Calculate monthly payments for a bill within a pay period
export const calculateMonthlyPaymentsInPeriod = (
  bill: Bill,
  startDate: Date,
  endDate: Date
): { paymentCount: number; effectiveDate: Date | null; totalAmount: number } => {
  const paymentDay = getPaymentDay(bill);
  
  // Check each month in the range
  const currentDate = new Date(startDate);
  let paymentCount = 0;
  let effectiveDate: Date | null = null;
  
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = countDaysInMonth(year, month);
    const effectiveDay = Math.min(paymentDay, daysInMonth);
    
    const potentialPaymentDate = new Date(year, month, effectiveDay);
    
    if (isDateInPayPeriod(potentialPaymentDate, startDate, endDate)) {
      paymentCount++;
      if (!effectiveDate) {
        effectiveDate = potentialPaymentDate;
      }
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1); // Reset to first day to avoid skipping months
  }
  
  return {
    paymentCount,
    effectiveDate,
    totalAmount: bill.amount * paymentCount,
  };
};

// Calculate total payments for a bill in a given pay period
export const calculateBillTotalForPayPeriod = (
  bill: Bill,
  startDate: Date,
  endDate: Date
): MonthlyBillCalculation => {
  let paymentCount = 0;
  let totalAmount = 0;

  // Bill has already stopped before this period started
  if (isBillExpiredForPeriod(bill, startDate)) {
    return {
      bill,
      paymentCount: 0,
      individualAmount: bill.amount,
      totalAmount: 0,
    };
  }

  // Cap the period end at the bill's expiry date
  const effectiveEnd = getEffectiveEndDate(bill, endDate);

  switch (bill.frequency) {
    case 'daily':
      paymentCount = countDaysInRange(startDate, effectiveEnd);
      totalAmount = bill.amount * paymentCount;
      break;

    case 'weekly':
      if (bill.weekly_days && bill.weekly_days.length > 0) {
        paymentCount = bill.weekly_days.reduce((total, day) => {
          return total + countWeekdayOccurrencesInRange(startDate, effectiveEnd, day);
        }, 0);
        totalAmount = bill.amount * paymentCount;
      }
      break;

    case 'monthly': {
      const monthlyData = calculateMonthlyPaymentsInPeriod(bill, startDate, effectiveEnd);
      paymentCount = monthlyData.paymentCount;
      totalAmount = monthlyData.totalAmount;
      break;
    }

    case 'custom':
      paymentCount = bill.custom_count && bill.custom_count > 0 ? bill.custom_count : 0;
      totalAmount = bill.amount * paymentCount;
      break;

    case 'yearly':
      if (isPaymentDueInPayPeriod(bill, startDate, effectiveEnd)) {
        paymentCount = 1;
        totalAmount = bill.amount;
      }
      break;

    case 'one-time':
      if (isOneTimeBillInPayPeriod(bill, startDate, effectiveEnd)) {
        paymentCount = 1;
        totalAmount = bill.amount;
      }
      break;
  }

  return {
    bill,
    paymentCount,
    individualAmount: bill.amount,
    totalAmount,
  };
};

// Income counts for a period unless it has expired before the period started
export const calculateIncomeForPayPeriod = (
  incomes: Income[],
  startDate: Date
): { activeIncomes: Income[]; incomeTotal: number } => {
  const activeIncomes = incomes.filter((income) => {
    if (!income.active) return false;
    const expiry = parseDate(income.expiry_date);
    return !expiry || expiry >= startDate;
  });

  const incomeTotal = activeIncomes.reduce(
    (sum, income) => sum + Number(income.amount || 0),
    0
  );

  return { activeIncomes, incomeTotal };
};

const UNASSIGNED_COLOR = '#94a3b8';

export const buildAccountBreakdowns = (
  calculations: MonthlyBillCalculation[]
): AccountBreakdown[] => {
  const groups = new Map<string, AccountBreakdown>();

  calculations.forEach((calc) => {
    const account = calc.bill.account;
    const key = account?.id || 'unassigned';

    if (!groups.has(key)) {
      groups.set(key, {
        accountId: account?.id || null,
        accountName: account?.name || 'Unassigned',
        accountColor: account?.color || UNASSIGNED_COLOR,
        total: 0,
        calculations: [],
      });
    }

    const group = groups.get(key)!;
    group.total += calc.totalAmount;
    group.calculations.push(calc);
  });

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
};

// Calculate all bills for a specific pay period
export const calculatePayPeriodTotal = (
  bills: Bill[],
  displayYear: number,
  displayMonth: number,
  incomes: Income[] = []
): PayPeriodSummary => {
  const { startDate, endDate } = getPayPeriodRange(displayYear, displayMonth);
  const activeBills = bills.filter((bill) => bill.active);
  
  const calculations = activeBills.map((bill) =>
    calculateBillTotalForPayPeriod(bill, startDate, endDate)
  );
  
  const grandTotal = calculations.reduce((sum, calc) => sum + calc.totalAmount, 0);
  const { activeIncomes, incomeTotal } = calculateIncomeForPayPeriod(incomes, startDate);

  return {
    calculations,
    grandTotal,
    startDate,
    endDate,
    incomeTotal,
    incomes: activeIncomes,
    difference: incomeTotal - grandTotal,
    accountBreakdowns: buildAccountBreakdowns(calculations),
  };
};
