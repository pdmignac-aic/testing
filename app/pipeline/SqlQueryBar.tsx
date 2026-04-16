"use client";

import { useState } from "react";

export default function SqlQueryBar() {
  const [query, setQuery] = useState(
    "select company_name, owner, status, layer from companies limit 25"
  );
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setError(null);
    setRunning(true);
    const res = await fetch("/api/sql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    setRunning(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `Query failed: ${res.status}`);
      setRows(null);
      setColumns([]);
      return;
    }
    const data: Record<string, unknown>[] = body.rows ?? [];
    setRows(data);
    setColumns(data.length > 0 ? Object.keys(data[0]) : []);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          SQL query (read-only)
        </h2>
        <span className="text-xs text-white/40">
          SELECT / WITH only · 5,000 row cap · single statement
        </span>
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
        spellCheck={false}
        className="w-full px-3 py-2 rounded bg-black/60 border border-white/10 font-mono text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={running}
          className="px-3 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-60"
        >
          {running ? "Running..." : "Run"}
        </button>
        {rows && <span className="text-xs text-white/50">{rows.length} rows</span>}
      </div>
      {error && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="border border-white/10 rounded overflow-auto max-h-[40vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/80">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="text-left px-3 py-2 border-b border-white/10 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-white/5">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-1.5 border-b border-white/5 whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis">
                      {formatCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows && rows.length === 0 && (
        <p className="text-sm text-white/50">Query returned no rows.</p>
      )}
    </section>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
