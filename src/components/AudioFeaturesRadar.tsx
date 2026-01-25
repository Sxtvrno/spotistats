import type { AudioFeatures } from "../types/spotify";

interface AudioFeaturesRadarProps {
  features: AudioFeatures;
  title?: string;
}

export default function AudioFeaturesRadar({
  features,
  title,
}: AudioFeaturesRadarProps) {
  // Características principales para el radar (0-1)
  const metrics = [
    { label: "Energía", value: features.energy, color: "#ff6b6b" },
    { label: "Bailabilidad", value: features.danceability, color: "#4ecdc4" },
    { label: "Valencia", value: features.valence, color: "#ffe66d" },
    { label: "Acústico", value: features.acousticness, color: "#95e1d3" },
    {
      label: "Instrumental",
      value: features.instrumentalness,
      color: "#a8dadc",
    },
    { label: "En vivo", value: features.liveness, color: "#f38181" },
  ];

  // SVG Radar Chart
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 40;
  const levels = 5;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const r = radius * value;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const axisPoints = metrics.map((_, i) => getPoint(i, 1));
  const dataPoints = metrics.map((m, i) => getPoint(i, m.value));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
      {title && (
        <div className="mb-4">
          <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0 mb-2">
            Audio Features
          </p>
          <h3 className="text-lg font-bold m-0">{title}</h3>
        </div>
      )}

      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="mb-4">
          {/* Grid circles */}
          {Array.from({ length: levels }).map((_, i) => {
            const r = (radius / levels) * (i + 1);
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            );
          })}

          {/* Axis lines */}
          {axisPoints.map((point, i) => (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          ))}

          {/* Data polygon */}
          <polygon
            points={polygonPoints}
            fill="rgba(44,211,125,0.2)"
            stroke="rgba(44,211,125,0.8)"
            strokeWidth="2"
          />

          {/* Data points */}
          {dataPoints.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={metrics[i].color}
              stroke="white"
              strokeWidth="1.5"
            />
          ))}

          {/* Labels */}
          {axisPoints.map((point, i) => {
            const labelAngle = (Math.PI * 2 * i) / metrics.length - Math.PI / 2;
            const labelRadius = radius + 25;
            const labelX = center + labelRadius * Math.cos(labelAngle);
            const labelY = center + labelRadius * Math.sin(labelAngle);

            return (
              <text
                key={i}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[11px] fill-[#c8d6e8] font-medium"
              >
                {metrics[i].label}
              </text>
            );
          })}
        </svg>

        {/* Legend with values */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-2 bg-white/5 rounded-lg p-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                <span className="text-xs text-[#c8d6e8]">{metric.label}</span>
              </div>
              <span className="text-xs font-bold text-[#8fe1b0]">
                {Math.round(metric.value * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
