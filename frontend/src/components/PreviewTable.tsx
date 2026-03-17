import type { BatchInfo } from '../types';

interface Props {
  batch: BatchInfo;
  onEnrichAll: () => void;
  enriching: boolean;
}

export default function PreviewTable({ batch, onEnrichAll, enriching }: Props) {
  const columns = batch.preview.length > 0 ? Object.keys(batch.preview[0]) : [];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            CSV Preview — {batch.total} rows loaded
          </h2>
          <p className="text-sm text-gray-500">Showing first {batch.preview.length} rows</p>
        </div>
        <button
          onClick={onEnrichAll}
          disabled={enriching}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {enriching ? 'Starting...' : `Enrich All (${batch.total} rows)`}
        </button>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batch.preview.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2.5 text-gray-700 max-w-xs truncate">
                    {row[col] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
