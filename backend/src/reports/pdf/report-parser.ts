import type { TextItem } from './pdf-reader.js';

export interface ParsedParameter {
  name: string;
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
}

export interface ParsedReport {
  reportCode: string | null;
  parameters: ParsedParameter[];
}

type Field = keyof ParsedParameter;

interface Column {
  x: number;
  field: Field | null;
}

// all distances are fractions of the page width or height
const ROW_TOLERANCE = 0.008;
const WORD_GAP = 0.02;
const COLUMN_SLACK = 0.015;

const REPORT_CODE =
  /\b(?:report|sample)\s*(?:id|no|number)\b\.?\s*[:#-]?\s*([A-Za-z0-9][\w/-]*)/i;

export function parseReport(pages: TextItem[][]): ParsedReport {
  let reportCode: string | null = null;
  let columns: Column[] | null = null;
  const parameters: ParsedParameter[] = [];

  // columns are kept between pages, so a table that carries on to the
  // next page without its header still gets read
  for (const page of pages) {
    for (const cells of groupIntoRows(page)) {
      const line = cells.map((cell) => cell.text).join(' ');
      if (/end of report/i.test(line)) return { reportCode, parameters };
      reportCode ??= REPORT_CODE.exec(line)?.[1] ?? null;

      const header = readHeader(cells);
      if (header) {
        columns = header;
        continue;
      }
      // skip anything before the table and "Label : value" lines like patient
      // details, but keep values like 1:160
      if (!columns || /:\s/.test(line)) continue;

      const parameter = readRow(cells, columns);
      if (parameter) parameters.push(parameter);
    }
  }
  return { reportCode, parameters };
}

function groupIntoRows(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];

  for (const item of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - item.y) <= ROW_TOLERANCE) row.push(item);
    else rows.push([item]);
  }
  return rows.map(joinNearbyWords);
}

// some PDFs store a cell as separate words, so words that sit close together become one cell
function joinNearbyWords(row: TextItem[]): TextItem[] {
  const cells: TextItem[] = [];

  for (const item of [...row].sort((a, b) => a.x - b.x)) {
    const last = cells.at(-1);
    if (last && item.x - (last.x + last.width) < WORD_GAP) {
      last.text += ` ${item.text}`;
      last.width = item.x + item.width - last.x;
    } else {
      cells.push({ ...item });
    }
  }
  return cells;
}

function readHeader(cells: TextItem[]): Column[] | null {
  const columns = cells.map((cell) => ({
    x: cell.x,
    field: headerField(cell.text),
  }));
  const fields = columns.map((column) => column.field);
  return fields.includes('name') && fields.includes('value') ? columns : null;
}

function headerField(text: string): Field | null {
  if (/^(test|parameter|investigation)/i.test(text)) return 'name';
  if (/^(result|value|observed)/i.test(text)) return 'value';
  if (/^units?$/i.test(text)) return 'unit';
  if (/reference|normal|biological|range|interval/i.test(text)) {
    return 'referenceRange';
  }
  return null;
}

function readRow(cells: TextItem[], columns: Column[]): ParsedParameter | null {
  const row: Record<Field, string | null> = {
    name: null,
    value: null,
    unit: null,
    referenceRange: null,
  };

  for (const cell of cells) {
    // a lone dash means the cell is empty
    if (/^[-–—]+$/.test(cell.text) || /^page\s*\d+/i.test(cell.text)) continue;

    const column =
      columns.findLast((col) => col.x <= cell.x + COLUMN_SLACK) ?? columns[0];
    if (!column.field) continue;

    const current = row[column.field];
    row[column.field] = current ? `${current} ${cell.text}` : cell.text;
  }

  const { name, value, unit, referenceRange } = row;
  if (!name || !(value || unit || referenceRange)) return null;
  return { name, value, unit, referenceRange };
}
