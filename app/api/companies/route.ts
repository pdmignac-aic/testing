import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set([
  "company_name",
  "identifier",
  "is_duplicate",
  "status",
  "owner",
  "layer",
  "dirty_grade",
  "components",
  "full_address",
  "street",
  "city",
  "state",
  "zip",
  "country",
  "founding_year",
  "territory",
  "notes",
  "contact_name",
  "contact_title",
  "email",
  "other",
  "warm_intro",
  "phone_linkedin",
  "notes2",
  "touch_1_date",
  "touch_1_channel",
  "touch_2_date",
  "touch_2_channel",
  "touch_3_date",
  "touch_3_channel",
  "touch_4_date",
  "touch_4_channel",
  "touch_5_date",
  "touch_5_channel",
  "touch_6_date",
  "touch_6_channel",
  "linkedin_date",
  "linkedin",
  "response_date",
  "engaged_date",
  "email_count",
  "tp1_sent",
  "tp2_sent",
  "tp3_sent",
  "tp1_date",
  "tp2_date",
  "tp3_date",
]);

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k) && v !== "" && v !== undefined) {
      payload[k] = v;
    }
  }

  if (!payload.company_name || typeof payload.company_name !== "string") {
    return NextResponse.json({ error: "company_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("companies")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data });
}
