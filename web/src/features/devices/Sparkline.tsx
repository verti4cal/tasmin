import type { TelemetryPoint } from "./telemetryApi.js";

interface SparklineProps {
  points: TelemetryPoint[];
}

const WIDTH = 320;
const HEIGHT = 80;

/** Hand-rolled inline SVG line chart — no charting library, just a <path>. */
export function Sparkline({ points }: SparklineProps) {
  const values = points.map((p) => Number(p.value)).filter((v) => Number.isFinite(v));

  if (values.length < 2) {
    return <p className="text-sm text-gray-500">Not enough numeric data yet.</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = WIDTH / (values.length - 1);

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${(HEIGHT - ((v - min) / range) * HEIGHT).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-20 text-blue-600">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-xs text-gray-500">
        <span>min {min}</span>
        <span>max {max}</span>
      </div>
    </div>
  );
}
