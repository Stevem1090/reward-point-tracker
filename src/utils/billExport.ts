import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PayPeriodSummary } from '@/types/bill';

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const money = (value: number) => `£${value.toFixed(2)}`;

export const getExportFileBase = (displayDate: Date) => {
  const year = displayDate.getFullYear();
  const month = String(displayDate.getMonth() + 1).padStart(2, '0');
  return `bills-summary-${year}-${month}`;
};

const frequencyLabel = (frequency: string) => {
  const labels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    'one-time': 'One-Time',
    custom: 'Custom',
  };
  return labels[frequency] || frequency;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const csvEscape = (value: string | number) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportSummaryToCsv = (summary: PayPeriodSummary, displayDate: Date) => {
  const periodStart = summary.startDate.toISOString().slice(0, 10);
  const periodEnd = summary.endDate.toISOString().slice(0, 10);

  const header = [
    'period_start',
    'period_end',
    'row_type',
    'name',
    'account',
    'bill_type',
    'frequency',
    'payment_count',
    'unit_amount',
    'total_amount',
  ];

  const rows: (string | number)[][] = [];

  summary.incomes.forEach((income) => {
    rows.push([
      periodStart,
      periodEnd,
      'income',
      income.name,
      '',
      '',
      'monthly',
      1,
      Number(income.amount).toFixed(2),
      Number(income.amount).toFixed(2),
    ]);
  });

  summary.accountBreakdowns.forEach((account) => {
    account.typeBreakdowns.forEach((type) => {
      type.calculations.forEach((calc) => {
        rows.push([
          periodStart,
          periodEnd,
          'bill',
          calc.bill.name,
          account.accountName,
          type.typeName,
          frequencyLabel(calc.bill.frequency),
          calc.paymentCount,
          calc.individualAmount.toFixed(2),
          calc.totalAmount.toFixed(2),
        ]);
      });
      rows.push([
        periodStart,
        periodEnd,
        'type_total',
        type.typeName,
        account.accountName,
        type.typeName,
        '',
        '',
        '',
        type.total.toFixed(2),
      ]);
    });
  });

  summary.accountBreakdowns.forEach((account) => {
    rows.push([
      periodStart,
      periodEnd,
      'account_total',
      account.accountName,
      account.accountName,
      '',
      '',
      '',
      '',
      account.total.toFixed(2),
    ]);
  });

  rows.push([periodStart, periodEnd, 'summary', 'Total income', '', '', '', '', '', summary.incomeTotal.toFixed(2)]);
  rows.push([periodStart, periodEnd, 'summary', 'Total outgoings', '', '', '', '', '', summary.grandTotal.toFixed(2)]);
  rows.push([periodStart, periodEnd, 'summary', 'Difference', '', '', '', '', '', summary.difference.toFixed(2)]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${getExportFileBase(displayDate)}.csv`);
};

export const exportSummaryToPdf = (summary: PayPeriodSummary, displayDate: Date) => {
  const doc = new jsPDF();
  const monthName = displayDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  doc.setFontSize(16);
  doc.text(`Bills & Income Summary — ${monthName}`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Pay period ${formatDate(summary.startDate)} to ${formatDate(summary.endDate)}`, 14, 25);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    head: [['Overview', 'Amount']],
    body: [
      ['Total income', money(summary.incomeTotal)],
      ['Total outgoings', money(summary.grandTotal)],
      [summary.difference >= 0 ? 'Surplus' : 'Shortfall', money(Math.abs(summary.difference))],
    ],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] },
  });

  if (summary.incomes.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Income', 'Amount']],
      body: summary.incomes.map((income) => [income.name, money(Number(income.amount))]),
      theme: 'striped',
      headStyles: { fillColor: [22, 163, 74] },
    });
  }

  summary.accountBreakdowns.forEach((account) => {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [[`${account.accountName} — ${money(account.total)}`, 'Frequency', 'Payments', 'Total']],
      body: account.typeBreakdowns.flatMap((type) => [
        [
          { content: `${type.typeName} — ${money(type.total)}`, colSpan: 4, styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } },
        ],
        ...type.calculations.map((calc) => [
          `   ${calc.bill.name}`,
          frequencyLabel(calc.bill.frequency),
          String(calc.paymentCount),
          money(calc.totalAmount),
        ]),
      ]) as any,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 9 },
    });
  });

  doc.save(`${getExportFileBase(displayDate)}.pdf`);
};
