"use client";

export function PrintActions() {
  return (
    <div
      className="no-print"
      style={{ textAlign: "right", marginBottom: "12px" }}
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
          marginLeft: "8px",
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
