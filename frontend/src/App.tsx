import { useState, useEffect, useRef } from 'react';
import FileUpload from './components/FileUpload';
import PreviewTable from './components/PreviewTable';
import ProgressBar from './components/ProgressBar';
import ErrorLog from './components/ErrorLog';
import ResultsTable from './components/ResultsTable';
import { startEnrichment, getProgress, getConfigStatus } from './api';
import type { BatchInfo, Progress } from './types';
import type { ConfigStatus } from './api';
import './App.css';

type View = 'upload' | 'preview' | 'results';

function App() {
  const [view, setView] = useState<View>('upload');
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getConfigStatus()
      .then((status) => {
        if (!status.search_configured) {
          setConfigWarning(status.message);
        }
      })
      .catch(() => {});
  }, []);

  const handleUploadComplete = (b: BatchInfo) => {
    setBatch(b);
    setView('preview');
  };

  const handleEnrichAll = async () => {
    if (!batch) return;
    setEnriching(true);
    try {
      await startEnrichment(batch.batch_id);
      setView('results');
      startPolling(batch.batch_id);
    } catch (err) {
      console.error('Failed to start enrichment:', err);
    } finally {
      setEnriching(false);
    }
  };

  const startPolling = (batchId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const prog = await getProgress(batchId);
        setProgress(prog);
        setRefreshTrigger((t) => t + 1);
        if (prog.status === 'complete') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (err) {
        console.error('Progress poll error:', err);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setBatch(null);
    setProgress(null);
    setView('upload');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Manufacturer Relationship Mapper
            </h1>
            <p className="text-sm text-gray-500">
              Enrich manufacturer data with EDCs, customers, and trade associations
            </p>
          </div>
          {view !== 'upload' && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              New Upload
            </button>
          )}
        </div>
      </header>

      {/* Config warning */}
      {configWarning && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            <strong>Configuration Warning:</strong> {configWarning}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === 'upload' && <FileUpload onUploadComplete={handleUploadComplete} />}

        {view === 'preview' && batch && (
          <PreviewTable batch={batch} onEnrichAll={handleEnrichAll} enriching={enriching} />
        )}

        {view === 'results' && batch && (
          <div>
            {progress && <ProgressBar progress={progress} />}
            {progress && progress.errors.length > 0 && <ErrorLog errors={progress.errors} />}
            <ResultsTable batchId={batch.batch_id} refreshTrigger={refreshTrigger} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
