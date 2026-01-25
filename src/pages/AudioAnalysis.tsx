import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchWithToken } from "../lib/spotify";
import type { SpotifyTrack, SpotifyArtist } from "../types/spotify";

interface DerivedStats {
  popularityAvg: number;
  trackCount: number;
  artistDiversity: number;
  genreCount: number;
  topGenres: string[];
  eraDistribution: { decade: string; count: number }[];
  durationAvg: number;
}

export default function AudioAnalysis() {
  const { accessToken, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [stats, setStats] = useState<DerivedStats | null>(null);

  const computeStats = (
    tracks: SpotifyTrack[],
    artists: SpotifyArtist[],
  ): DerivedStats => {
    const popularityAvg =
      tracks.reduce((sum, t) => sum + (t.popularity || 0), 0) / tracks.length;

    const uniqueArtists = new Set(
      tracks.flatMap((t) => t.artists.map((a) => a.name)),
    );
    const artistDiversity = (uniqueArtists.size / tracks.length) * 100;

    const allGenres = artists.flatMap((a) => a.genres || []);
    const genreSet = new Set(allGenres);
    const genreCounts = new Map<string, number>();
    allGenres.forEach((g) => genreCounts.set(g, (genreCounts.get(g) || 0) + 1));
    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([genre]) => genre);

    const durationAvg =
      tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / tracks.length;

    return {
      popularityAvg,
      trackCount: tracks.length,
      artistDiversity,
      genreCount: genreSet.size,
      topGenres,
      eraDistribution: [],
      durationAvg,
    };
  };

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [tracksData, artistsData] = await Promise.all([
        fetchWithToken<{ items: SpotifyTrack[] }>(
          accessToken,
          "me/top/tracks?limit=50&time_range=short_term",
        ),
        fetchWithToken<{ items: SpotifyArtist[] }>(
          accessToken,
          "me/top/artists?limit=50&time_range=short_term",
        ),
      ]);

      setTopTracks(tracksData.items);
      setStats(computeStats(tracksData.items, artistsData.items));
    } catch (err) {
      setError((err as Error).message);
      console.error("Error loading analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-[#9fb2c8] text-base md:text-lg">
          Conecta tu cuenta de Spotify para ver análisis
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl md:text-2xl font-bold">Análisis Musical</h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="rounded-xl px-4 py-2 text-sm font-bold bg-white/10 border border-white/20 text-[#e8f2ff] hover:bg-white/20 active:translate-y-px transition disabled:opacity-50 w-full sm:w-auto"
        >
          {loading ? "Cargando..." : "🔄 Actualizar"}
        </button>
      </div>

      {error && (
        <div className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Nota sobre Audio Features */}
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 md:p-4">
        <p className="text-amber-200 font-bold text-xs md:text-sm mb-2 flex items-center gap-2">
          <span className="text-base md:text-lg">⚠️</span> Funcionalidad
          limitada
        </p>
        <p className="text-amber-100/80 text-[11px] md:text-xs leading-relaxed">
          El endpoint de Audio Features requiere Extended Quota Mode. Por ahora,
          mostramos análisis basado en popularidad, géneros y artistas.
        </p>
      </div>

      {loading && !stats ? (
        <div className="text-center py-12">
          <div className="animate-spin text-4xl mb-3">🎵</div>
          <p className="text-[#9fb2c8]">Analizando tu música…</p>
        </div>
      ) : (
        stats && (
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Popularidad */}
            <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 backdrop-blur-sm">
              <div className="text-2xl md:text-3xl mb-2">⭐</div>
              <p className="text-[#9fb2c8] text-[10px] md:text-xs mb-1">
                Popularidad
              </p>
              <p className="text-2xl md:text-3xl font-bold text-[#8fe1b0]">
                {Math.round(stats.popularityAvg)}
                <span className="text-sm md:text-base text-[#9fb2c8]">
                  /100
                </span>
              </p>
            </div>

            {/* Diversidad */}
            <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 backdrop-blur-sm">
              <div className="text-2xl md:text-3xl mb-2">🎭</div>
              <p className="text-[#9fb2c8] text-[10px] md:text-xs mb-1">
                Diversidad
              </p>
              <p className="text-2xl md:text-3xl font-bold text-[#8fe1b0]">
                {Math.round(stats.artistDiversity)}
                <span className="text-sm md:text-base text-[#9fb2c8]">%</span>
              </p>
              <p className="text-[9px] md:text-[10px] text-[#9fb2c8] mt-1">
                Artistas únicos
              </p>
            </div>

            {/* Géneros */}
            <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 backdrop-blur-sm">
              <div className="text-2xl md:text-3xl mb-2">🎸</div>
              <p className="text-[#9fb2c8] text-[10px] md:text-xs mb-1">
                Géneros
              </p>
              <p className="text-2xl md:text-3xl font-bold text-[#8fe1b0]">
                {stats.genreCount}
              </p>
              <p className="text-[9px] md:text-[10px] text-[#9fb2c8] mt-1">
                Diferentes
              </p>
            </div>

            {/* Duración */}
            <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-5 backdrop-blur-sm">
              <div className="text-2xl md:text-3xl mb-2">⏱️</div>
              <p className="text-[#9fb2c8] text-[10px] md:text-xs mb-1">
                Duración
              </p>
              <p className="text-2xl md:text-3xl font-bold text-[#8fe1b0]">
                {Math.floor(stats.durationAvg / 60000)}
                <span className="text-sm md:text-base text-[#9fb2c8]">
                  :
                  {Math.floor((stats.durationAvg % 60000) / 1000)
                    .toString()
                    .padStart(2, "0")}
                </span>
              </p>
            </div>
          </div>
        )
      )}

      {/* Top Géneros */}
      {stats && stats.topGenres.length > 0 && (
        <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm">
          <div className="mb-3 md:mb-4">
            <p className="uppercase text-[#8fe1b0] text-[10px] md:text-[11px] tracking-widest m-0 mb-2">
              Tus géneros principales
            </p>
            <h3 className="text-base md:text-lg font-bold m-0">
              Top 8 Géneros
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.topGenres.map((genre) => (
              <span
                key={genre}
                className="bg-gradient-to-br from-[#2cd37d]/20 to-[#18b663]/20 border border-[#2cd37d]/40 rounded-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm text-[#8fe1b0] font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Tracks */}
      {topTracks.length > 0 && (
        <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 backdrop-blur-sm">
          <div className="mb-3 md:mb-4">
            <p className="uppercase text-[#8fe1b0] text-[10px] md:text-[11px] tracking-widest m-0 mb-2">
              Tus canciones más escuchadas
            </p>
            <h3 className="text-base md:text-lg font-bold m-0">
              Top Tracks (últimas 4 semanas)
            </h3>
          </div>
          <div className="space-y-2 md:space-y-3">
            {topTracks.slice(0, 10).map((track, idx) => (
              <div
                key={track.id}
                className="flex gap-2 md:gap-3 items-center bg-white/5 rounded-lg p-2 md:p-3 border border-white/10"
              >
                <span className="text-xs md:text-sm font-bold w-5 md:w-6 text-center text-[#9fb2c8]">
                  {idx + 1}
                </span>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-md overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                  {track.album.images?.[0]?.url ? (
                    <img
                      src={track.album.images[0].url}
                      alt={track.album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg md:text-xl">
                      🎵
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs md:text-sm truncate text-[#e8f2ff]">
                    {track.name}
                  </p>
                  <p className="text-[10px] md:text-xs text-[#9fb2c8] truncate">
                    {track.artists.map((a) => a.name).join(", ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="w-12 md:w-20 h-1.5 md:h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#8fe1b0] to-[#2cd37d]"
                        style={{ width: `${track.popularity || 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-[#8fe1b0] w-6 md:w-8 text-right">
                      {track.popularity || 0}
                    </span>
                  </div>
                  <p className="text-[9px] md:text-[10px] text-[#9fb2c8]">
                    {Math.floor((track.duration_ms || 0) / 60000)}:
                    {Math.floor(((track.duration_ms || 0) % 60000) / 1000)
                      .toString()
                      .padStart(2, "0")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
