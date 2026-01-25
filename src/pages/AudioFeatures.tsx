import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchWithToken, getMultipleAudioFeatures } from "../lib/spotify";
import type { SpotifyTrack, AudioFeatures } from "../types/spotify";
import AudioFeaturesRadar from "../components/AudioFeaturesRadar";
import AudioFeaturesBar from "../components/AudioFeaturesBar";

export default function AudioFeaturesPage() {
  const { accessToken, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [selectedFeatures, setSelectedFeatures] =
    useState<AudioFeatures | null>(null);
  const [averageFeatures, setAverageFeatures] = useState<AudioFeatures | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"radar" | "bars">("radar");

  const loadTopTracksWithFeatures = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const { items } = await fetchWithToken<{ items: SpotifyTrack[] }>(
        accessToken,
        "me/top/tracks?limit=20&time_range=short_term",
      );
      setTopTracks(items);

      // Obtener features de todos los tracks
      const trackIds = items.map((t) => t.id);
      const features = await getMultipleAudioFeatures(accessToken, trackIds);

      if (features.length > 0) {
        // Calcular promedio de features
        const avg: AudioFeatures = {
          id: "average",
          acousticness: 0,
          danceability: 0,
          energy: 0,
          instrumentalness: 0,
          liveness: 0,
          loudness: 0,
          speechiness: 0,
          valence: 0,
          tempo: 0,
          key: 0,
          mode: 0,
          time_signature: 0,
          duration_ms: 0,
        };

        features.forEach((f) => {
          avg.acousticness += f.acousticness;
          avg.danceability += f.danceability;
          avg.energy += f.energy;
          avg.instrumentalness += f.instrumentalness;
          avg.liveness += f.liveness;
          avg.loudness += f.loudness;
          avg.speechiness += f.speechiness;
          avg.valence += f.valence;
          avg.tempo += f.tempo;
        });

        const count = features.length;
        avg.acousticness /= count;
        avg.danceability /= count;
        avg.energy /= count;
        avg.instrumentalness /= count;
        avg.liveness /= count;
        avg.loudness /= count;
        avg.speechiness /= count;
        avg.valence /= count;
        avg.tempo /= count;

        setAverageFeatures(avg);

        // Seleccionar el primer track por defecto
        if (items[0] && features[0]) {
          setSelectedTrack(items[0]);
          setSelectedFeatures(features[0]);
        }
      }
    } catch (err) {
      setError((err as Error).message);
      console.error("Error loading audio features:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadTopTracksWithFeatures();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  const handleSelectTrack = async (track: SpotifyTrack) => {
    if (!accessToken) return;
    setSelectedTrack(track);
    setLoading(true);
    try {
      const features = await getMultipleAudioFeatures(accessToken, [track.id]);
      if (features[0]) {
        setSelectedFeatures(features[0]);
      }
    } catch (err) {
      console.error("Error loading track features:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-[#9fb2c8] text-lg">
          Conecta tu cuenta de Spotify para ver análisis de audio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Análisis de Audio</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === "radar" ? "bars" : "radar")}
            className="rounded-xl px-4 py-2 text-sm font-bold bg-white/10 border border-white/20 text-[#e8f2ff] hover:bg-white/20 active:translate-y-px transition"
          >
            {viewMode === "radar" ? "📊 Barras" : "🕸️ Radar"}
          </button>
          <button
            onClick={loadTopTracksWithFeatures}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-bold bg-white/10 border border-white/20 text-[#e8f2ff] hover:bg-white/20 active:translate-y-px transition disabled:opacity-50"
          >
            {loading ? "Cargando..." : "🔄 Actualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* Info */}
      <div className="bg-[#8fe1b0]/10 border border-[#8fe1b0]/30 rounded-xl p-4">
        <p className="text-[#8fe1b0] font-bold text-sm mb-2 flex items-center gap-2">
          <span className="text-lg">📈</span> Características de Audio
        </p>
        <p className="text-[#c8d6e8] text-xs leading-relaxed">
          Spotify analiza cada canción para extraer características musicales
          como energía, bailabilidad y valencia (positividad). Explora tus top
          tracks o el promedio de tu música favorita.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visualización */}
        <div>
          {selectedFeatures && viewMode === "radar" && (
            <AudioFeaturesRadar
              features={selectedFeatures}
              title={
                selectedTrack
                  ? `${selectedTrack.name} - ${selectedTrack.artists.map((a) => a.name).join(", ")}`
                  : "Promedio de tus top tracks"
              }
            />
          )}

          {selectedFeatures && viewMode === "bars" && (
            <AudioFeaturesBar
              features={selectedFeatures}
              title={
                selectedTrack
                  ? `${selectedTrack.name} - ${selectedTrack.artists.map((a) => a.name).join(", ")}`
                  : "Promedio de tus top tracks"
              }
            />
          )}

          {averageFeatures && (
            <div className="mt-4">
              <button
                onClick={() => {
                  setSelectedTrack(null);
                  setSelectedFeatures(averageFeatures);
                }}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                  !selectedTrack
                    ? "bg-[#8fe1b0]/20 border-2 border-[#8fe1b0] text-[#8fe1b0]"
                    : "bg-white/5 border border-white/20 text-[#c8d6e8] hover:bg-white/10"
                }`}
              >
                📊 Ver promedio de tus top 20 tracks
              </button>
            </div>
          )}
        </div>

        {/* Lista de tracks */}
        <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="mb-4">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0 mb-2">
              Tus top tracks
            </p>
            <h3 className="text-lg font-bold m-0">
              Selecciona una canción ({topTracks.length})
            </h3>
          </div>

          {loading && topTracks.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-3">🎵</div>
              <p className="text-[#9fb2c8]">Analizando tus canciones…</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {topTracks.map((track, idx) => (
                <button
                  key={track.id}
                  onClick={() => handleSelectTrack(track)}
                  className={`w-full text-left rounded-lg p-3 transition ${
                    selectedTrack?.id === track.id
                      ? "bg-[#8fe1b0]/20 border border-[#8fe1b0]/40"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex gap-3 items-center">
                    <span
                      className={`text-sm font-bold w-6 text-center ${
                        selectedTrack?.id === track.id
                          ? "text-[#8fe1b0]"
                          : "text-[#9fb2c8]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                      {track.album.images?.[0]?.url ? (
                        <img
                          src={track.album.images[0].url}
                          alt={track.album.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          🎵
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-bold text-sm truncate ${
                          selectedTrack?.id === track.id
                            ? "text-[#8fe1b0]"
                            : "text-[#e8f2ff]"
                        }`}
                      >
                        {track.name}
                      </p>
                      <p className="text-xs text-[#9fb2c8] truncate">
                        {track.artists.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
