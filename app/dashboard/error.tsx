"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; plug in Sentry/LogRocket here for production
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-600" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        An unexpected error occurred. Try again — if the issue persists, refresh the page.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button
          className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
          onClick={() => window.location.reload()}
        >
          Refresh page
        </Button>
      </div>
      {process.env.NODE_ENV === "development" && error.message && (
        <pre className="mt-4 text-xs text-left bg-red-50 border border-red-200 rounded-lg p-3 max-w-sm overflow-auto text-red-700 w-full">
          {error.message}
          {error.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
      )}
    </div>
  );
}
