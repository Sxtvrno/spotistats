import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchWithToken } from "../lib/spotify";
import type {
  SpotifyArtist,
  SpotifyTrack,
  RecentPlay,
  GenreStat,
  SpotifyImage,
} from "../types/spotify";

const numberFmt = new Intl.NumberFormat("es-ES");

const pickImage = (images?: SpotifyImage[]) => images?.[0]?.url ?? "";
const formatDuration = (ms?: number) => {
  if (!ms) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const computeGenreStats = (artists: SpotifyArtist[]): GenreStat[] => {
  const map = new Map<string, { count: number; artists: Set<string> }>();
  artists.forEach((a) => {
    (a.genres ?? []).forEach((g) => {
      const entry = map.get(g) ?? { count: 0, artists: new Set<string>() };
      entry.count += 1;
      entry.artists.add(a.name);
      map.set(g, entry);
    });
  });
  return Array.from(map.entries())
    .map(([genre, { count, artists }]) => ({
      genre,
      count,
      artists: Array.from(artists).slice(0, 4),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
};

const computeRecentPatterns = (items: RecentPlay[]) => {
  const byHour = new Array(24).fill(0) as number[];
  const artistCounts = new Map<string, number>();
  items.forEach((p) => {
    const d = new Date(p.played_at);
    byHour[d.getHours()]++;
    p.track.artists.forEach((a) => {
      artistCounts.set(a.name, (artistCounts.get(a.name) ?? 0) + 1);
    });
  });
  const topHours = byHour
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const topArtist = Array.from(artistCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];
  return { topHours, topArtist };
};

export default function Stats() {
  const { accessToken, isAuthenticated, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [genreStats, setGenreStats] = useState<GenreStat[]>([]);
  const [recentPatterns, setRecentPatterns] = useState<{
    topHours: Array<{ hour: number; count: number }>;
    topArtist?: string;
  } | null>(null);

  const loadStats = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [tracks, artists, recent] = await Promise.all([
        fetchWithToken<{ items: SpotifyTrack[] }>(
          accessToken,
          "me/top/tracks?limit=8"
        ),
        fetchWithToken<{ items: SpotifyArtist[] }>(
          accessToken,
          "me/top/artists?limit=50"
        ),
        fetchWithToken<{ items: RecentPlay[] }>(
          accessToken,
          "me/player/recently-played?limit=50"
        ),
      ]);

      setTopTracks(tracks.items);
      setTopArtists(artists.items);
      setRecentPlays(recent.items);
      setGenreStats(computeGenreStats(artists.items));
      setRecentPatterns(computeRecentPatterns(recent.items));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <p className="text-[#9fb2c8] text-lg">
          Conecta tu cuenta de Spotify para ver tus estadísticas
        </p>
      </div>
    );
  }

  const lastPlay = recentPlays[0];

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tus Estadísticas</h2>
        <button
          onClick={loadStats}
          disabled={loading}
          className="rounded-xl px-4 py-2 font-bold bg-white/10 border border-white/20 text-[#e8f2ff] active:translate-y-px transition disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Perfil */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
              Perfil
            </p>
            <h2 className="text-lg m-0">Resumen de cuenta</h2>
          </div>
          {profile ? (
            <div className="grid grid-cols-[64px_1fr] gap-3 items-center">
              <img
                src={pickImage(profile.images)}
                alt="Avatar"
                className="w-16 h-16 rounded-xl object-cover border border-white/10 bg-white/5"
              />
              <div>
                <h3 className="text-xl font-semibold">{profile.display_name}</h3>
                <p className="text-[#9fb2c8]">{profile.email ?? "Email no disponible"}</p>
                <div className="flex gap-2 flex-wrap mt-2">
                  {profile.country && (
                    <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-[#c9d7e8]">
                      País · {profile.country}
                    </span>
                  )}
                  {profile.product && (
                    <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-[#c9d7e8]">
                      Plan · {profile.product}
                    </span>
                  )}
                  {profile.followers?.total !== undefined && (
                    <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-[#c9d7e8]">
                      Seguidores · {numberFmt.format(profile.followers.total)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[#9fb2c8]">Cargando perfil...</p>
          )}
        </section>

        {/* Última canción reproducida */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
              Reproducción
            </p>
            <h2 className="text-lg m-0">Última canción reproducida</h2>
          </div>
          {lastPlay ? (
            <div className="space-y-2">
              <div className="flex gap-3 items-center">
                <img
                  src={pickImage(lastPlay.track.album.images)}
                  alt={lastPlay.track.name}
                  className="w-[72px] h-[72px] object-cover rounded-lg border border-white/10 bg-white/5"
                />
                <div>
                  <p className="font-bold text-[15px] leading-tight mb-1">
                    {lastPlay.track.name}
                  </p>
                  <p className="text-[13px] text-[#9fb2c8] mb-1">
                    {lastPlay.track.artists.map((a) => a.name).join(" · ")}
                  </p>
                  <p className="text-[13px] text-[#9fb2c8]">
                    {formatDate(lastPlay.played_at)}
                  </p>
                </div>
              </div>
              <iframe
                title="Última canción en Spotify"
                src={`https://open.spotify.com/embed/track/${lastPlay.track.id}`}
                className="w-full h-20 rounded-lg"
                frameBorder="0"
                allow="encrypted-media; clipboard-write"
              />
            </div>
          ) : (
            <p className="text-[#9fb2c8]">No hay reproducciones recientes.</p>
          )}
        </section>
      </div>

      {/* Géneros destacados */}
      <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
            Géneros
          </p>
          <h2 className="text-lg m-0">Géneros destacados</h2>
        </div>
        {genreStats.length ? (
          <ul className="divide-y divide-white/10">
            {genreStats.map((g, i) => (
              <li
                key={g.genre}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center py-2"
              >
                <span className="text-[#8fe1b0] font-bold text-xs">#{i + 1}</span>
                <div>
                  <p className="font-bold text-[15px] leading-tight m-0">{g.genre}</p>
                  <p className="text-[13px] text-[#9fb2c8] m-0">
                    {g.count} artistas · {g.artists.join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#9fb2c8]">Aún no hay géneros disponibles.</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Artistas favoritos */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">Top</p>
            <h2 className="text-lg m-0">Artistas favoritos</h2>
          </div>
          {loading && <div className="p-3 text-[#9fb2c8] text-sm">Cargando...</div>}
          {topArtists.length > 0 ? (
            <ul className="divide-y divide-white/10">
              {topArtists.slice(0, 5).map((artist, idx) => (
                <li
                  key={artist.id}
                  className="grid grid-cols-[auto_48px_minmax(0,1fr)_auto] gap-3 items-center py-2"
                >
                  <span className="text-[#8fe1b0] font-bold text-xs">#{idx + 1}</span>
                  <img
                    src={pickImage(artist.images)}
                    alt={artist.name}
                    className="w-12 h-12 object-cover rounded-xl border border-white/10 bg-white/5"
                  />
                  <div>
                    <p className="font-bold text-[15px] leading-tight m-0">{artist.name}</p>
                    <p className="text-[13px] text-[#9fb2c8] m-0">
                      {artist.genres?.slice(0, 2).join(" · ") || "Sin géneros"}
                    </p>
                  </div>
                  <span className="bg-white/10 px-3 py-1 rounded-xl text-xs text-[#c9d7e8]">
                    Pop. {artist.popularity ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9fb2c8]">Aún no hay artistas cargados.</p>
          )}
        </section>

        {/* Canciones favoritas */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">Top</p>
            <h2 className="text-lg m-0">Canciones favoritas</h2>
          </div>
          {loading && <div className="p-3 text-[#9fb2c8] text-sm">Cargando...</div>}
          {topTracks.length > 0 ? (
            <ul className="divide-y divide-white/10">
              {topTracks.slice(0, 5).map((track, idx) => (
                <li
                  key={track.id}
                  className="grid grid-cols-[auto_48px_minmax(0,1fr)_auto] gap-3 items-center py-2"
                >
                  <span className="text-[#8fe1b0] font-bold text-xs">#{idx + 1}</span>
                  <img
                    src={pickImage(track.album.images)}
                    alt={track.name}
                    className="w-12 h-12 object-cover rounded-xl border border-white/10 bg-white/5"
                  />
                  <div>
                    <p className="font-bold text-[15px] leading-tight m-0">{track.name}</p>
                    <p className="text-[13px] text-[#9fb2c8] m-0">
                      {track.artists.map((a) => a.name).join(" · ")}
                    </p>
                  </div>
                  <span className="bg-white/10 px-3 py-1 rounded-xl text-xs text-[#c9d7e8]">
                    {formatDuration(track.duration_ms)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9fb2c8]">Aún no hay canciones cargadas.</p>
          )}
        </section>
      </div>

      {/* Reproducciones recientes */}
      <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
            Actividad
          </p>
          <h2 className="text-lg m-0">Reproducciones recientes</h2>
        </div>
        {recentPatterns && (
          <div className="flex gap-2 flex-wrap mb-2">
            {recentPatterns.topHours.map((h) => (
              <span
                key={h.hour}
                className="bg-white/10 rounded-full px-3 py-1 text-xs text-[#c9d7e8]"
              >
                Hora {h.hour.toString().padStart(2, "0")}: {h.count}
              </span>
            ))}
            {recentPatterns.topArtist && (
              <span className="bg-white/10 rounded-full px-3 py-1 text-xs text-[#c9d7e8]">
                Artista más repetido · {recentPatterns.topArtist}
              </span>
            )}
          </div>
        )}
        {loading && <div className="p-3 text-[#9fb2c8] text-sm">Leyendo actividad…</div>}
        {recentPlays.length > 0 ? (
          <ul className="divide-y divide-white/10">
            {recentPlays.slice(0, 10).map((play) => (
              <li
                key={play.played_at}
                className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 items-center py-2"
              >
                <img
                  src={pickImage(play.track.album.images)}
                  alt={play.track.name}
                  className="w-12 h-12 object-cover rounded-xl border border-white/10 bg-white/5"
                />
                <div>
                  <p className="font-bold text-[15px] leading-tight m-0">
                    {play.track.name}
                  </p>
                  <p className="text-[13px] text-[#9fb2c8] m-0">
                    {play.track.artists.map((a) => a.name).join(" · ")}
                  </p>
                </div>
                <span className="bg-white/10 px-3 py-1 rounded-xl text-xs text-[#9fb2c8]">
                  {formatDate(play.played_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#9fb2c8]">No hay actividad reciente.</p>
        )}
      </section>
    </div>
  );
}