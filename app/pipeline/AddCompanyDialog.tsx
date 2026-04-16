"use client";

import { useState } from "react";
import type { Company } from "@/lib/schema";

type Props = {
  onClose: () => void;
  onAdded: (c: Company) => void;
  owners: string[];
  statuses: string[];
  layers: string[];
};

const EMPTY: Partial<Company> = {
  company_name: "",
  identifier: "",
  status: "",
  owner: "",
  layer: "",
  dirty_grade: "",
  territory: "",
  contact_name: "",
  contact_title: "",
  email: "",
  city: "",
  state: "",
  notes: "",
};

export default function AddCompanyDialog({ onClose, onAdded, owners, statuses, layers }: Props) {
  const [form, setForm] = useState<Partial<Company>>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(part: Partial<Company>) {
    setForm((f) => ({ ...f, ...part }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.company_name?.trim()) {
      setError("Company name is required");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Request failed: ${res.status}`);
      return;
    }
    const { company } = await res.json();
    onAdded(company);
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="text-lg font-semibold">Add company</h2>
        <Grid>
          <Field label="Company name *">
            <input
              required
              value={form.company_name ?? ""}
              onChange={(e) => patch({ company_name: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Domain">
            <input value={form.identifier ?? ""} onChange={(e) => patch({ identifier: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Status">
            <DataListInput value={form.status ?? ""} options={statuses} onChange={(v) => patch({ status: v })} />
          </Field>
          <Field label="Owner">
            <DataListInput value={form.owner ?? ""} options={owners} onChange={(v) => patch({ owner: v })} />
          </Field>
          <Field label="Layer">
            <DataListInput value={form.layer ?? ""} options={layers} onChange={(v) => patch({ layer: v })} />
          </Field>
          <Field label="Grade">
            <input value={form.dirty_grade ?? ""} onChange={(e) => patch({ dirty_grade: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Territory">
            <input value={form.territory ?? ""} onChange={(e) => patch({ territory: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Contact name">
            <input value={form.contact_name ?? ""} onChange={(e) => patch({ contact_name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Contact title">
            <input value={form.contact_title ?? ""} onChange={(e) => patch({ contact_title: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email ?? ""} onChange={(e) => patch({ email: e.target.value })} className={inputCls} />
          </Field>
          <Field label="City">
            <input value={form.city ?? ""} onChange={(e) => patch({ city: e.target.value })} className={inputCls} />
          </Field>
          <Field label="State">
            <input value={form.state ?? ""} onChange={(e) => patch({ state: e.target.value })} className={inputCls} />
          </Field>
        </Grid>
        <Field label="Notes">
          <textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value })}
            className={inputCls}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded border border-white/20 text-sm">
            Cancel
          </button>
          <button disabled={submitting} className="px-3 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-60">
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

const inputCls = "w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-sm";

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#13161a] border border-white/10 rounded-lg p-5 max-h-[90vh] overflow-auto"
      >
        {children}
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-white/60 text-xs block mb-1">{label}</span>
      {children}
    </label>
  );
}

function DataListInput({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const listId = `dl-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        className={inputCls}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
