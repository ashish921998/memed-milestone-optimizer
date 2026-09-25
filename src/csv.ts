import { readFileSync, writeFileSync } from 'node:fs';

// Minimal CSV. Values never contain commas, quotes or newlines by construction.
export function writeCsv(path: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) throw new Error(`writeCsv: no rows for ${path}`);
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => String(r[c])).join(','))];
  writeFileSync(path, lines.join('\n') + '\n');
}

// RFC 4180 fields: quotes, embedded commas and doubled quotes. No embedded newlines.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ && ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

// Numbers and booleans are parsed; everything else stays a string. Columns must match types.ts.
export function readCsv<T>(path: string): T[] {
  const [header, ...lines] = readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n');
  const cols = splitCsvLine(header).map((c) => c.trim());
  return lines.filter((l) => l.trim() !== '').map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      const v = cells[i];
      if (v === 'true') row[c] = true;
      else if (v === 'false') row[c] = false;
      else if (v !== '' && !Number.isNaN(Number(v)) && !/^\d{4}-\d{2}-\d{2}$/.test(v) && !/^[A-Za-z]/.test(v)) row[c] = Number(v);
      else row[c] = v;
    });
    return row as T;
  });
}
