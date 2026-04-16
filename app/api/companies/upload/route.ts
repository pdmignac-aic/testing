import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { mapCsvRow } from "@/lib/csv";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const text = await request.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV" }, { status: 400 });

  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  if (!parsed.data.length) {
    return NextResponse.json({ error: "No rows found" }, { status: 400 });
  }

  const [headers, ...rows] = parsed.data;
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const values of rows) {
    const { row, errors } = mapCsvRow(headers, values);
    if (errors.length > 0) {
      skipped++;
      continue;
    }
    toInsert.push(row as Record<string, unknown>);
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: "No valid rows to insert", skipped }, { status: 400 });
  }

  const inserted: Record<string, unknown>[] = [];
  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("companies").insert(chunk).select("*");
    if (error) {
      return NextResponse.json(
        { error: error.message, insertedSoFar: inserted.length },
        { status: 500 }
      );
    }
    inserted.push(...(data ?? []));
  }

  return NextResponse.json({ inserted, skipped });
}
