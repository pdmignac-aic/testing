"use client";

import { useMemo, useState } from "react";
import { DISPLAY_COLUMNS, type Company } from "@/lib/schema";
import FilterBar, { type Filters } from "./FilterBar";
import AddCompanyDialog from "./AddCompanyDialog";
import UploadCsvDialog from "./UploadCsvDialog";
import SqlQueryBar from "./SqlQueryBar";
import DataGrid from "./DataGrid";

type Props = {
  initialCompanies: Company[];
  loadError: string | null;
  userEmail: string | null;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  owner: "",
  status: "",
  layer: "",
  grade: "",
  territory: "",
  mineOnly: false,
};

export default function PipelineClient({
  initialCompanies,
  loadError,
  userEmail,
}: Props) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const owners = useMemo(() => unique(companies, "owner"), [companies]);
  const statuses = useMemo(() => unique(companies, "status"), [companies]);
  const layers = useMemo(() => unique(companies, "layer"), [companies]);
  const grades = useMemo(() => unique(companies, "dirty_grade"), [companies]);
  const territories = useMemo(() => unique(companies, "territory"), [companies]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return companies.filter((c) => {
      if (filters.owner && c.owner !== filters.owner) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.layer && c.layer !== filters.layer) return false;
      if (filters.grade && c.dirty_grade !== filters.grade) return false;
      if (filters.territory && c.territory !== filters.territory) return false;
      if (filters.mineOnly && userEmail) {
        const ownerGuess = (c.owner ?? "").toLowerCase();
        const localPart = userEmail.split("@")[0].toLowerCase();
        if (!ownerGuess.includes(localPart)) return false;
      }
      if (q) {
        const haystack = [
          c.company_name,
          c.identifier,
          c.contact_name,
          c.email,
          c.components,
          c.notes,
          c.notes2,
          c.city,
          c.state,
        ]
          .map((v) => (v ?? "").toLowerCase())
          .join(" ");
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [companies, filters, userEmail]);

  function addCompany(c: Company) {
    setCompanies((prev) => [c, ...prev]);
  }

  function addMany(newRows: Company[]) {
    setCompanies((prev) => [...newRows, ...prev]);
  }

  return (
    <main className="min-h-screen p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-white/50">
            {filtered.length} of {companies.length} companies
            {userEmail && ` · signed in as ${userEmail}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 rounded bg-white text-black text-sm font-medium"
          >
            Add company
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="px-3 py-2 rounded border border-white/20 text-sm"
          >
            Upload CSV
          </button>
          <form action="/auth/signout" method="post">
            <button className="px-3 py-2 rounded border border-white/20 text-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {loadError && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          Error loading data: {loadError}
        </div>
      )}

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        owners={owners}
        statuses={statuses}
        layers={layers}
        grades={grades}
        territories={territories}
      />

      <DataGrid
        columns={DISPLAY_COLUMNS}
        rows={filtered}
      />

      <SqlQueryBar />

      {showAdd && (
        <AddCompanyDialog
          onClose={() => setShowAdd(false)}
          onAdded={(c) => {
            addCompany(c);
            setShowAdd(false);
          }}
          owners={owners}
          statuses={statuses}
          layers={layers}
        />
      )}
      {showUpload && (
        <UploadCsvDialog
          onClose={() => setShowUpload(false)}
          onUploaded={(rows) => {
            addMany(rows);
            setShowUpload(false);
          }}
        />
      )}
    </main>
  );
}

function unique(rows: Company[], key: keyof Company): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "string" && v.trim() !== "") set.add(v);
  }
  return [...set].sort();
}
