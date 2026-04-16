"use client";

export type Filters = {
  search: string;
  owner: string;
  status: string;
  layer: string;
  grade: string;
  territory: string;
  mineOnly: boolean;
};

type Props = {
  filters: Filters;
  setFilters: (f: Filters) => void;
  owners: string[];
  statuses: string[];
  layers: string[];
  grades: string[];
  territories: string[];
};

export default function FilterBar({
  filters,
  setFilters,
  owners,
  statuses,
  layers,
  grades,
  territories,
}: Props) {
  function patch(part: Partial<Filters>) {
    setFilters({ ...filters, ...part });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center p-3 rounded border border-white/10 bg-white/5">
      <input
        placeholder="Search companies, contacts, notes..."
        value={filters.search}
        onChange={(e) => patch({ search: e.target.value })}
        className="flex-1 min-w-[220px] px-3 py-2 rounded bg-black/40 border border-white/10 text-sm"
      />
      <Select label="Owner" value={filters.owner} options={owners} onChange={(v) => patch({ owner: v })} />
      <Select label="Status" value={filters.status} options={statuses} onChange={(v) => patch({ status: v })} />
      <Select label="Layer" value={filters.layer} options={layers} onChange={(v) => patch({ layer: v })} />
      <Select label="Grade" value={filters.grade} options={grades} onChange={(v) => patch({ grade: v })} />
      <Select label="Territory" value={filters.territory} options={territories} onChange={(v) => patch({ territory: v })} />
      <label className="text-sm flex items-center gap-2 px-2">
        <input
          type="checkbox"
          checked={filters.mineOnly}
          onChange={(e) => patch({ mineOnly: e.target.checked })}
        />
        Mine only
      </label>
      <button
        onClick={() =>
          setFilters({
            search: "",
            owner: "",
            status: "",
            layer: "",
            grade: "",
            territory: "",
            mineOnly: false,
          })
        }
        className="px-3 py-2 rounded border border-white/20 text-sm"
      >
        Reset
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-2 rounded bg-black/40 border border-white/10 text-sm"
      aria-label={label}
    >
      <option value="">{label}: Any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
