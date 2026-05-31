"use client";

import { formatPKR } from "@/lib/utils";

// ── Fee Collection Trend (last 6 months) ─────────────────────────────
// Lightweight SVG bar chart — no charting library needed.
export function FeeTrendChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  const hasData = data.some((d) => d.amount > 0);

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Fee Collection Trend</h2>
        <span className="text-xs text-muted-foreground">Last 6 months</span>
      </div>

      {!hasData ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          No fee payments recorded yet
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2 h-40">
          {data.map((d, i) => {
            const heightPct = Math.max((d.amount / max) * 100, 2);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="relative w-full flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] font-medium text-gray-600 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {d.amount > 0 ? formatPKR(d.amount) : ""}
                  </span>
                  <div
                    className="w-full max-w-[36px] bg-gradient-to-t from-[#1B4332] to-[#2D6A4F] rounded-t-md transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Student Distribution (donut by class) ────────────────────────────
const COLORS = ["#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7", "#D8F3DC"];

export function StudentDistribution({ data }: { data: { label: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  // Build donut segments
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data.map((d, i) => {
    const fraction = total > 0 ? d.count / total : 0;
    const dash = fraction * circumference;
    const seg = { color: COLORS[i % COLORS.length], dash, offset, label: d.label, count: d.count };
    offset += dash;
    return seg;
  });

  return (
    <div className="bg-white border rounded-xl p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Student Distribution</h2>

      {total === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          No students enrolled yet
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="relative shrink-0">
            <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
              {segments.map((s, i) => (
                <circle
                  key={i}
                  cx="75" cy="75" r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="20"
                  strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{total}</span>
              <span className="text-[11px] text-muted-foreground">students</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-700 truncate flex-1">{d.label}</span>
                <span className="text-muted-foreground font-medium">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
