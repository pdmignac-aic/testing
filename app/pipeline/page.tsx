import { createClient } from "@/lib/supabase/server";
import PipelineClient from "./PipelineClient";
import type { Company } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = createClient();

  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .order("company_name", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PipelineClient
      initialCompanies={(companies ?? []) as Company[]}
      loadError={error?.message ?? null}
      userEmail={user?.email ?? null}
    />
  );
}
