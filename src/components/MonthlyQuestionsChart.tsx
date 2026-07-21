import { useState } from "react";
import type { QuestionLogMonthlyCount } from "../types";

function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function niceCeil(n: number): number {
  if (n <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  const residual = n / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}

function roundedTopBarPath(x: number, yBase: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, h, w / 2);
  const y = yBase - h;
  if (h <= 0) return "";
  if (radius <= 0) {
    return `M ${x} ${yBase} L ${x} ${y} L ${x + w} ${y} L ${x + w} ${yBase} Z`;
  }
  return `M ${x} ${yBase} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${yBase} Z`;
}

export default function MonthlyQuestionsChart({ data }: { data: QuestionLogMonthlyCount[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[220px] text-sm text-zinc-400">No questions logged yet.</div>;
  }

  const H = 220;
  const padTop = 16;
  const padBottom = 26;
  const padLeft = 32;
  const padRight = 8;
  const plotH = H - padTop - padBottom;
  const plotBottom = padTop + plotH;
  const barSlotMin = 56;
  const W = Math.max(data.length * barSlotMin, 320);
  const barSlot = (W - padLeft - padRight) / data.length;
  const barWidth = Math.min(24, barSlot * 0.55);

  const max = Math.max(...data.map((d) => d.count));
  const niceMax = niceCeil(max);
  const gridSteps = 4;
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, i) => Math.round((niceMax * (gridSteps - i)) / gridSteps));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ height: H, minWidth: W }} className="w-full">
        {gridValues.map((val, i) => {
          const y = padTop + (plotH * i) / gridSteps;
          return (
            <g key={val + "-" + i}>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={y}
                y2={y}
                strokeWidth={1}
                className="stroke-zinc-200 dark:stroke-zinc-800"
              />
              <text x={padLeft - 6} y={y} dy="0.32em" textAnchor="end" className="fill-zinc-400 dark:fill-zinc-500 text-[9px]">
                {val}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = padLeft + i * barSlot + (barSlot - barWidth) / 2;
          const h = niceMax === 0 ? 0 : (d.count / niceMax) * plotH;
          const isHover = hover === i;
          return (
            <g key={d.month}>
              <path
                d={roundedTopBarPath(x, plotBottom, barWidth, h, 4)}
                className={isHover ? "fill-[#1c5cab] dark:fill-[#5598e7]" : "fill-[#2a78d6] dark:fill-[#3987e5]"}
              />
              <rect
                x={x - (barSlot - barWidth) / 2}
                y={padTop}
                width={barSlot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="img"
                aria-label={`${formatMonth(d.month)}: ${d.count} question${d.count === 1 ? "" : "s"}`}
              />
              <text
                x={x + barWidth / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-zinc-400 dark:fill-zinc-500 text-[10px]"
              >
                {formatMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-xs text-center text-zinc-500 dark:text-zinc-400 mt-1 h-4">
        {hover != null && (
          <>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{data[hover].count}</span>{" "}
            question{data[hover].count === 1 ? "" : "s"} in {formatMonth(data[hover].month)}
          </>
        )}
      </div>
    </div>
  );
}
