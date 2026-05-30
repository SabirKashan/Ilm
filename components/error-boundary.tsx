"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in development; swap for Sentry/LogRocket in production
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            An unexpected error occurred on this page. Try refreshing — if the issue persists, contact support.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Try again
            </Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.message && (
            <pre className="mt-4 text-xs text-left bg-red-50 border border-red-200 rounded-lg p-3 max-w-sm overflow-auto text-red-700">
              {this.state.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
