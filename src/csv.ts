import { readFileSync, writeFileSync } from 'node:fs';

// Minimal CSV. Values never contain commas, quotes or newlines by construction.
export function writeCsv(path: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) throw new Error(`writeCsv: no rows for ${path}`);
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => String(r[c])).join(','))];
  writeFileSync(path, lines.join('\n') + '\n');
}

// Numbers and booleans are parsed; everything else stays a string.
export function readCsv<T>(path: string): T[] {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split('\n');
  const cols = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
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
