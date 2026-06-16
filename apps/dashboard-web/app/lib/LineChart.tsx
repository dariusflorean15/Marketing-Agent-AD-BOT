"use client";

import { useState, type MouseEvent } from "react";

export interface ChartPoint {
  label: string; // e.g. the date
  value: number;
}

/**
 * Lightweight interactive line chart (area + line) with a hover tooltip and
 * crosshair. No chart library — uniform-scaled SVG so dots stay round.
 */
export function LineChart({
  points,
  color,
  format,
  height = 160,
}: {
  points: ChartPoint[];
  color: string;
  format: (n: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 560;
  const H = 160;
  const P = 12;

  if (points.length < 2) {
    return (
      <div className="flex items-center text-sm text-slate-400" style={{ height }}>
        Not enough data to chart yet.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area =
    `M${x(0).toFixed(1)} ${H - P} ` +
    points.map((p, i) => `L${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ") +
    ` L${x(points.length - 1).toFixed(1)} ${H - P} Z`;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - P) / (W - 2 * P)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={area} fill={color} opacity={0.08} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {hover !== null && active && (
          <>
            <line
              x1={x(hover)}
              y1={P}
              x2={x(hover)}
              y2={H - P}
              stroke={color}
              strokeOpacity={0.3}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(hover)} cy={y(active.value)} r={4} fill={color} />
          </>
        )}
      </svg>
      {hover !== null && active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-center text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}
        >
          <div className="font-semibold">{format(active.value)}</div>
          <div className="text-slate-300">{active.label}</div>
        </div>
      )}
    </div>
  );
}
