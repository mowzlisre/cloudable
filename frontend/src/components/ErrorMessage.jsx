import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorMessage({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="p-3 bg-red-950/30 rounded-full border border-red-900/30">
        <AlertCircle size={24} className="text-red-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-white mb-1">Failed to load data</p>
        <p className="text-xs text-gray-500 max-w-xs">{error?.message || 'An unexpected error occurred.'}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
