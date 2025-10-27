import { Bill, MonthlyBillCalculation } from '@/types/bill';

// Helper to get payment day with default
export const getPaymentDay = (bill: Bill): number => {
  return bill.payment_day || 1;
};

// Count number of days in a month
export const countDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// Count occurrences of a specific weekday in a month
export const countWeekdayOccurrences = (
  year: number,
  month: number,
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
  const daysInMonth = countDaysInMonth(year, month);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === targetDay) {
      count++;
    }
  }

  return count;
};

// Check if a yearly bill is due in a specific month
export const isPaymentDueInMonth = (
  bill: Bill,
  year: number,
  month: number
): boolean => {
  if (!bill.payment_date) return false;

  const paymentDate = new Date(bill.payment_date);
  return paymentDate.getMonth() === month && paymentDate.getFullYear() === year;
};

// Calculate monthly payments for a bill
export const calculateMonthlyPayments = (
  bill: Bill,
  year: number,
  month: number
): { paymentCount: number; effectiveDate: Date; totalAmount: number } => {
  const paymentDay = getPaymentDay(bill);
  const daysInMonth = countDaysInMonth(year, month);

  // If payment day exceeds days in month, use last day
  const effectiveDay = Math.min(paymentDay, daysInMonth);

  return {
    paymentCount: 1,
    effectiveDate: new Date(year, month, effectiveDay),
    totalAmount: bill.amount,
  };
};

// Calculate total payments for a bill in a given month
export const calculateBillTotal = (
  bill: Bill,
  year: number,
  month: number
): MonthlyBillCalculation => {
  let paymentCount = 0;
  let totalAmount = 0;

  switch (bill.frequency) {
    case 'daily':
      paymentCount = countDaysInMonth(year, month);
      totalAmount = bill.amount * paymentCount;
      break;

    case 'weekly':
      if (bill.weekly_days && bill.weekly_days.length > 0) {
        paymentCount = bill.weekly_days.reduce((total, day) => {
          return total + countWeekdayOccurrences(year, month, day);
        }, 0);
        totalAmount = bill.amount * paymentCount;
      }
      break;

    case 'monthly':
      const monthlyData = calculateMonthlyPayments(bill, year, month);
      paymentCount = monthlyData.paymentCount;
      totalAmount = monthlyData.totalAmount;
      break;

    case 'yearly':
      if (isPaymentDueInMonth(bill, year, month)) {
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

// Calculate all bills for a specific month
export const calculateMonthlyTotal = (
  bills: Bill[],
  year: number,
  month: number
): {
  calculations: MonthlyBillCalculation[];
  grandTotal: number;
} => {
  const activeBills = bills.filter((bill) => bill.active);
  const calculations = activeBills.map((bill) =>
    calculateBillTotal(bill, year, month)
  );
  const grandTotal = calculations.reduce((sum, calc) => sum + calc.totalAmount, 0);

  return {
    calculations,
    grandTotal,
  };
};
