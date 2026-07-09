// src/lib/csv.js

export function rowsToCsv(rows, fields) {
  if (!rows || rows.length === 0) {
    return fields.join(',') + '\n';
  }

  // Escape a single cell value for CSV
  function escapeCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If the string contains commas, newlines, or quotes, wrap it in quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // Build header
  let csv = fields.join(',') + '\n';

  // Build rows
  for (const row of rows) {
    const rowValues = fields.map(f => {
      const val = row[f];
      return escapeCell(val);
    });
    csv += rowValues.join(',') + '\n';
  }

  return csv;
}
