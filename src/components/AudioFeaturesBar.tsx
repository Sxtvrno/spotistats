import type { AudioFeatures } from "../types/spotify";

interface AudioFeaturesBarProps {
  features: AudioFeatures;
  title?: string;
}

export default function AudioFeaturesBar({
  features,
  title,
}: AudioFeaturesBarProps) {
  const metrics = [
    {
      label: "Energía",
      value: features.energy,
      color: "from-red-500 to-orange-500",
      icon: "⚡",
    },
    {
      label: "Bailabilidad",
      value: features.danceability,
      color: "from-purple-500 to-pink-500",
      icon: "💃",
    },
    {
      label: "Valencia (Positividad)",
      value: features.valence,
      color: "from-yellow-400 to-orange-400",
      icon: "😊",
    },
    {
      label: "Acústico",
      value: features.acousticness,
      color: "from-green-400 to-teal-500",
      icon: "🎸",
    },
    {
      label: "Instrumental",
      value: features.instrumentalness,
      color: "from-blue-400 to-indigo-500",
      icon: "🎹",
    },
    {
      label: "En vivo",
      value: features.liveness,
      color: "from-pink-400 to-rose-500",
      icon: "🎤",
    },
    {
      label: "Hablado",
      value: features.speechiness,
      color: "from-cyan-400 to-blue-500",
      icon: "🗣️",
    },
  ];

  const additionalInfo = [
    { label: "Tempo", value: `${Math.round(features.tempo)} BPM`, icon: "🥁" },
    {
      label: "Volumen",
      value: `${Math.round(features.loudness)} dB`,
      icon: "🔊",
    },
    {
      label: "Tonalidad",
      value: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][
        features.key
      ],
      icon: "🎵",
    },
    {
      label: "Modo",
      value: features.mode === 1 ? "Mayor" : "Menor",
      icon: "🎼",
    },
  ];

  return (
    <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
      {title && (
        <div className="mb-5">
          <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0 mb-2">
            Audio Features
          </p>
          <h3 className="text-lg font-bold m-0">{title}</h3>
        </div>
      )}

      <div className="space-y-3 mb-5">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#c8d6e8] flex items-center gap-1.5">
                <span>{metric.icon}</span>
                <span>{metric.label}</span>
              </span>
              <span className="text-xs font-bold text-[#8fe1b0]">
                {Math.round(metric.value * 100)}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${metric.color} transition-all duration-500`}
                style={{ width: `${metric.value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Additional info */}
      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
        {additionalInfo.map((info) => (
          <div
            key={info.label}
            className="bg-white/5 rounded-lg p-2 flex items-center gap-2"
          >
            <span className="text-lg">{info.icon}</span>
            <div>
              <p className="text-[10px] text-[#9fb2c8] m-0">{info.label}</p>
              <p className="text-sm font-bold text-[#e8f2ff] m-0">
                {info.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
