"use client";

import { useState } from "react";
import type { Company } from "@/lib/schema";

type Props = {
  onClose: () => void;
  onUploaded: (rows: Company[]) => void;
};

export default function UploadCsvDialog({ onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    if (!file) {
      setError("Pick a CSV file first.");
      return;
    }
    const text = await file.text();
    setSubmitting(true);
    const res = await fetch("/api/companies/upload", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: text,
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Upload failed: ${res.status}`);
      return;
    }
    const body = (await res.json()) as { inserted: Company[]; skipped: number };
    setReport(`Inserted ${body.inserted.length}, skipped ${body.skipped}.`);
    onUploaded(body.inserted);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#13161a] border border-white/10 rounded-lg p-5 space-y-4"
      >
        <h2 className="text-lg font-semibold">Upload CSV</h2>
        <p className="text-sm text-white/60">
          CSV must include a <code>Company Name</code> column. Column headers should
          match the pipeline schema (same as the export). Unrecognized columns are
          ignored.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {report && <p className="text-sm text-green-400">{report}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded border border-white/20 text-sm">
              Close
            </button>
            <button disabled={submitting} className="px-3 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-60">
              {submitting ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
