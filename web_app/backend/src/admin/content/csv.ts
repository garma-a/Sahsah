/** Quotes a cell when it holds a comma, quote or line break (RFC 4180). */
export const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
export const csvLine = (cells: string[]) => cells.map(csvCell).join(",");

export class CsvError extends Error {
  constructor(readonly code: string, readonly row?: number) {
    super(code);
  }
}

/**
 * Reads UTF-8 CSV text into rows of cells: commas, quoted cells with doubled quotes and embedded
 * line breaks, LF or CRLF line ends. Blank lines are skipped. `row` numbers in errors count the
 * header as row 1, like a spreadsheet.
 */
export function parseCsv(textValue: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, started = false, closed = false, line = 1;
  const endCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const endRow = () => {
    endCell();
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
    started = false;
  };
  for (let i = 0; i < textValue.length; i++) {
    const c = textValue[i]!;
    if (quoted) {
      if (c === '"') {
        if (textValue[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        if (c === "\n") line++;
        cell += c;
      }
      continue;
    }
    if (closed && c !== "," && c !== "\n" && c !== "\r") throw new CsvError("csv_stray_quote", line);
    if (c === '"' && !started) {
      quoted = true;
      started = true;
    } else if (c === '"') throw new CsvError("csv_stray_quote", line);
    else if (c === ",") {
      endCell();
      started = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && textValue[i + 1] === "\n") i++;
      line++;
      endRow();
    } else {
      cell += c;
      started = true;
    }
  }
  if (quoted) throw new CsvError("csv_unterminated_quote", line);
  if (started || cell !== "" || row.length) endRow();
  return rows;
}

/** Strict UTF-8: a Windows-1256 or UTF-16 file is refused instead of turning Arabic into garbage. */
export function decodeUtf8(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes).replace(/^﻿/, "");
  } catch {
    throw new CsvError("csv_encoding");
  }
}
