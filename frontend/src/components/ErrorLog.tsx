interface Props {
  errors: { id: number; company: string; error: string }[];
}

export default function ErrorLog({ errors }: Props) {
  if (errors.length === 0) return null;

  return (
    <details className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <summary className="cursor-pointer text-sm font-medium text-red-700">
        {errors.length} error(s) during enrichment
      </summary>
      <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
        {errors.map((err) => (
          <div key={err.id} className="text-xs text-red-600 font-mono">
            [{err.id}] {err.company}: {err.error}
          </div>
        ))}
      </div>
    </details>
  );
}
