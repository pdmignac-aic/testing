import { CSV_COLUMNS, type Company, type CsvColumn } from "./schema";

const TRUE_VALUES = new Set(["true", "yes", "y", "1", "t"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0", "f"]);

export function coerceValue(raw: string, type: CsvColumn["type"]) {
  const value = (raw ?? "").trim();
  if (value === "") return null;

  switch (type) {
    case "int": {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : null;
    }
    case "numeric": {
      const n = parseFloat(value);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean": {
      const lower = value.toLowerCase();
      if (TRUE_VALUES.has(lower)) return true;
      if (FALSE_VALUES.has(lower)) return false;
      return null;
    }
    case "date": {
      return normalizeDate(value);
    }
    default:
      return value;
  }
}

// Accepts "M/D/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"; returns ISO "YYYY-MM-DD" or null.
export function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export type RowMapResult = {
  row: Partial<Company>;
  errors: string[];
};

export function mapCsvRow(
  headers: string[],
  values: string[]
): RowMapResult {
  const row: Partial<Company> = {};
  const errors: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
    const spec = CSV_COLUMNS.find((c) => c.csvHeader === header);
    if (!spec || !spec.dbColumn) continue;
    const coerced = coerceValue(values[i] ?? "", spec.type);
    (row as Record<string, unknown>)[spec.dbColumn] = coerced;
  }

  if (!row.company_name) {
    errors.push("Missing Company Name");
  }

  return { row, errors };
}
