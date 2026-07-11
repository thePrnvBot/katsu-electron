import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorOverlayProps {
  url: string;
  error: string;
  onRetry?: () => void;
}

export const ErrorOverlay = ({ url, error, onRetry }: ErrorOverlayProps) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#1a1a1a] p-6 text-center">
    <AlertCircle className="h-12 w-12 text-[#ff6b6b]" />
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-[#ff6b6b]">Failed to load</h3>
      <p className="max-w-md text-sm text-[#888] break-all">{url}</p>
      <p className="text-xs text-[#666]">{error}</p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 flex items-center gap-2 rounded-lg bg-[#333] px-4 py-2 text-sm text-[#ddd] transition-colors hover:bg-[#444]"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    )}
  </div>
);
