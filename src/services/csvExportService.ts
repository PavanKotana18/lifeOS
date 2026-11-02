/**
 * LifeOS CSV Export Service with Formula Injection (CWE-1236) Protection
 */

export function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Formula Injection Prevention: If cell starts with dangerous symbols (=, +, -, @, tab, CR), prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export const CsvExportService = {
  exportTransactionsToCsv(transactions: any[]): string {
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Payment Method', 'Description', 'Notes'];
    const rows = (transactions || []).map(t => [
      sanitizeCsvCell(t.date || ''),
      sanitizeCsvCell(t.type || ''),
      sanitizeCsvCell(t.category || ''),
      sanitizeCsvCell(t.amount !== undefined ? Number(t.amount).toFixed(2) : '0.00'),
      sanitizeCsvCell(t.paymentMethod || ''),
      sanitizeCsvCell(t.description || ''),
      sanitizeCsvCell(t.notes || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    return csvContent;
  },

  exportTasksToCsv(tasks: any[]): string {
    const headers = ['Title', 'Due Date', 'Priority', 'Category', 'Completed', 'Recurring', 'Notes'];
    const rows = (tasks || []).map(t => [
      sanitizeCsvCell(t.title || ''),
      sanitizeCsvCell(t.dueDate || ''),
      sanitizeCsvCell(t.priority || ''),
      sanitizeCsvCell(t.category || ''),
      sanitizeCsvCell(t.completed ? 'Yes' : 'No'),
      sanitizeCsvCell(t.recurring || 'None'),
      sanitizeCsvCell(t.notes || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    return csvContent;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CsvExportService,
    sanitizeCsvCell
  };
}
if (typeof window !== 'undefined') {
  (window as any).CsvExportService = CsvExportService;
}
