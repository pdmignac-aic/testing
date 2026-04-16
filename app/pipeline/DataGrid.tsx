"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/lib/schema";

type Col = { key: keyof Company; label: string };

type Props = {
  columns: Col[];
  rows: Company[];
};

export default function DataGrid({ columns, rows }: Props) {
  const [sortKey, setSortKey] = useState<keyof Company | null>("company_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: keyof Company) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <div className="border border-white/10 rounded overflow-auto max-h-[60vh]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-black/80 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                onClick={() => toggleSort(c.key)}
                className="text-left px-3 py-2 border-b border-white/10 cursor-pointer select-none whitespace-nowrap"
              >
                {c.label}
                {sortKey === c.key && (sortDir === "asc" ? " ▲" : " ▼")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="hover:bg-white/5">
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className="px-3 py-1.5 border-b border-white/5 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis"
                  title={formatCell(row[c.key])}
                >
                  {formatCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-white/50">
                No rows match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
