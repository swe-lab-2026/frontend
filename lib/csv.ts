/**
 * CSV cell. Text starting with = + - @ (or a control character) would run as a
 * formula in Excel, and these cells hold user-supplied names and reasons.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** RFC 4180 rows with a BOM, so Excel reads Cyrillic correctly. */
export function toCsv(header: string[], rows: string[][]): string {
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
