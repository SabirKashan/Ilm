"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // Small delay so styles are painted before print dialog opens
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function PrintButtons() {
  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        display: "flex",
        gap: 8,
        zIndex: 9999,
      }}
    >
      <button
        onClick={() => window.print()}
        style={{
          background: "#1B4332",
          color: "white",
          border: "none",
          padding: "8px 20px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        🖨️ Print / Save as PDF
      </button>
      <button
        onClick={() => window.close()}
        style={{
          background: "#eee",
          border: "none",
          padding: "8px 16px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        Close
      </button>
    </div>
  );
}
