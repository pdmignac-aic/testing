import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { mapCsvRow } from "../lib/csv";

config({ path: ".env.local" });
config({ path: ".env" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const CSV_PATH = process.argv[2] ?? resolve(process.cwd(), "pipeline");
console.log(`Reading CSV from: ${CSV_PATH}`);

const raw = readFileSync(CSV_PATH, "utf-8");
const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: true });

if (parsed.errors.length > 0) {
  console.warn(`CSV parse warnings: ${parsed.errors.length}`);
}

const [headers, ...rows] = parsed.data;
console.log(`Headers: ${headers.length}, data rows: ${rows.length}`);

const payload: Record<string, unknown>[] = [];
const skipped: { line: number; reason: string }[] = [];

rows.forEach((values, idx) => {
  const { row, errors } = mapCsvRow(headers, values);
  if (errors.length > 0) {
    skipped.push({ line: idx + 2, reason: errors.join("; ") });
    return;
  }
  payload.push(row as Record<string, unknown>);
});

console.log(`Prepared ${payload.length} rows (${skipped.length} skipped).`);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabase.from("companies").insert(chunk);
    if (error) {
      console.error(`Insert failed at chunk starting ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`Inserted ${Math.min(i + CHUNK, payload.length)} / ${payload.length}`);
  }

  if (skipped.length > 0) {
    console.log("\nSkipped rows:");
    skipped.slice(0, 20).forEach((s) => console.log(`  line ${s.line}: ${s.reason}`));
    if (skipped.length > 20) console.log(`  ...and ${skipped.length - 20} more`);
  }

  console.log("\nSeed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
