import { Bill, MonthlyBillCalculation } from '@/types/bill';

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

  switch (bill.frequency) {
    case 'daily':
      paymentCount = countDaysInRange(startDate, endDate);
      totalAmount = bill.amount * paymentCount;
      break;

    case 'weekly':
      if (bill.weekly_days && bill.weekly_days.length > 0) {
        paymentCount = bill.weekly_days.reduce((total, day) => {
          return total + countWeekdayOccurrencesInRange(startDate, endDate, day);
        }, 0);
        totalAmount = bill.amount * paymentCount;
      }
      break;

    case 'monthly':
      const monthlyData = calculateMonthlyPaymentsInPeriod(bill, startDate, endDate);
      paymentCount = monthlyData.paymentCount;
      totalAmount = monthlyData.totalAmount;
      break;

    case 'yearly':
      if (isPaymentDueInPayPeriod(bill, startDate, endDate)) {
        paymentCount = 1;
        totalAmount = bill.amount;
      }
      break;

    case 'one-time':
      if (isOneTimeBillInPayPeriod(bill, startDate, endDate)) {
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

// Calculate all bills for a specific pay period
export const calculatePayPeriodTotal = (
  bills: Bill[],
  displayYear: number,
  displayMonth: number
): {
  calculations: MonthlyBillCalculation[];
  grandTotal: number;
  startDate: Date;
  endDate: Date;
} => {
  const { startDate, endDate } = getPayPeriodRange(displayYear, displayMonth);
  const activeBills = bills.filter((bill) => bill.active);
  
  const calculations = activeBills.map((bill) =>
    calculateBillTotalForPayPeriod(bill, startDate, endDate)
  );
  
  const grandTotal = calculations.reduce((sum, calc) => sum + calc.totalAmount, 0);

  return {
    calculations,
    grandTotal,
    startDate,
    endDate,
  };
};
