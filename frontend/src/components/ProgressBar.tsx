import type { Progress } from '../types';

interface Props {
  progress: Progress;
}

export default function ProgressBar({ progress }: Props) {
  const { total, completed, processing, failed, partial, pending, status } = progress;
  const done = completed + partial;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Processing {done + failed} of {total}...
        </span>
        <span className="text-sm text-gray-500">{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div className="flex h-full">
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
          <div
            className="bg-yellow-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (partial / total) * 100 : 0}%` }}
          />
          <div
            className="bg-blue-500 transition-all duration-300 animate-pulse"
            style={{ width: `${total > 0 ? (processing / total) * 100 : 0}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Complete: {completed}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Partial: {partial}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Processing: {processing}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Failed: {failed}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Pending: {pending}
        </span>
      </div>
      {status === 'complete' && (
        <p className="mt-2 text-sm font-medium text-green-600">Enrichment complete!</p>
      )}
    </div>
  );
}
