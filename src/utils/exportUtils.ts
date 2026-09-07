import * as XLSX from 'xlsx';

export interface ExportExcelOptions<T extends Record<string, any>> {
  filename: string;
  sheetName?: string;
  data: T[];
  columns?: { header: string; key: keyof T | string; width?: number }[];
}

/**
 * Utility to export data to real Excel (.xlsx) file with SheetJS (xlsx library).
 * Auto-calculates column widths, ensures NIK & Nomor Anggota are stored as formatted strings,
 * and attaches proper sheet names and titles.
 */
export function exportToExcel<T extends Record<string, any>>({
  filename,
  sheetName = 'Data',
  data,
  columns
}: ExportExcelOptions<T>): void {
  // Ensure filename has .xlsx extension
  const cleanFilename = filename.toLowerCase().endsWith('.xlsx')
    ? filename
    : `${filename}.xlsx`;

  // Format dataset
  let formattedData: Record<string, any>[] = [];

  if (columns && columns.length > 0) {
    formattedData = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        const val = item[col.key as string];
        row[col.header] = val !== undefined && val !== null ? String(val) : '';
      });
      return row;
    });
  } else {
    formattedData = data.map((item) => {
      const row: Record<string, any> = {};
      Object.keys(item).forEach((key) => {
        const val = item[key];
        row[key] = val !== undefined && val !== null ? String(val) : '';
      });
      return row;
    });
  }

  // Generate worksheet from JSON
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Calculate Column Widths dynamically based on text content length
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const colWidths: { wch: number }[] = [];

  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxLen = 12; // Base minimum width

    // Check custom column width definition if provided
    if (columns && columns[C] && columns[C].width) {
      maxLen = columns[C].width!;
    } else {
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (cell && cell.v !== undefined && cell.v !== null) {
          const valStr = String(cell.v);
          maxLen = Math.max(maxLen, valStr.length + 3);
        }
      }
    }
    colWidths.push({ wch: Math.min(Math.max(maxLen, 12), 65) });
  }

  worksheet['!cols'] = colWidths;

  // Build workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger file download
  XLSX.writeFile(workbook, cleanFilename);
}
