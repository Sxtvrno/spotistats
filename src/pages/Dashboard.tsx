import { useEffect, useMemo, useState } from "react";
import {
  SCOPES,
  VERIFIER_KEY,
  readStoredAuth,
  saveAuth,
  clearAuth,
  createVerifier,
  createChallenge,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  fetchWithToken,
} from "../lib/spotify";
import type {
  SpotifyUser,
  SpotifyArtist,
  SpotifyTrack,
  RecentPlay,
  GenreStat,
  SpotifyImage,
} from "../types/spotify";
import { generatePlaylistPlan } from "../lib/ai";
import {
  searchFirstTrackUri,
  createPlaylist,
  addTracksToPlaylist,
} from "../lib/spotify";

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

export default function Dashboard() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
  const redirectUri =
    (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined) ||
    window.location.origin;

  const [status, setStatus] = useState<
    "idle" | "authorizing" | "loading" | "ready"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  const [profile, setProfile] = useState<SpotifyUser | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);

  const [genreStats, setGenreStats] = useState<GenreStat[]>([]);
  const [recentPatterns, setRecentPatterns] = useState<{
    topHours: Array<{ hour: number; count: number }>;
    topArtist?: string;
  } | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createdPlaylistUrl, setCreatedPlaylistUrl] = useState<string | null>(
    null
  );

  const isAuthenticated = useMemo(() => Boolean(accessToken), [accessToken]);

  const cleanCodeFromUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  };

  const loadDashboard = async (token: string) => {
    setStatus("loading");
    setError(null);
    try {
      const [userData, tracks, artists, recent] = await Promise.all([
        fetchWithToken<SpotifyUser>(token, "me"),
        fetchWithToken<{ items: SpotifyTrack[] }>(
          token,
          "me/top/tracks?limit=8"
        ),
        fetchWithToken<{ items: SpotifyArtist[] }>(
          token,
          "me/top/artists?limit=50"
        ),
        fetchWithToken<{ items: RecentPlay[] }>(
          token,
          "me/player/recently-played?limit=50"
        ),
      ]);

      setProfile(userData);
      setTopTracks(tracks.items);
      setTopArtists(artists.items);
      setRecentPlays(recent.items);

      setGenreStats(computeGenreStats(artists.items));
      setRecentPatterns(computeRecentPatterns(recent.items));

      setStatus("ready");
    } catch (err) {
      setStatus("ready");
      setError((err as Error).message);
    }
  };

  const handleAuthorize = async () => {
    if (!clientId) {
      setError("Configura VITE_SPOTIFY_CLIENT_ID en tu entorno.");
      return;
    }
    setStatus("authorizing");
    const verifier = createVerifier();
    const challenge = await createChallenge(verifier);
    localStorage.setItem(VERIFIER_KEY, verifier);

    const url = buildAuthorizeUrl(clientId, redirectUri, SCOPES, challenge);
    window.location.assign(url);
  };

  const bootstrapAuth = async () => {
    if (!clientId) {
      setError("Falta configurar VITE_SPOTIFY_CLIENT_ID.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const verifier = localStorage.getItem(VERIFIER_KEY);
    const stored = readStoredAuth();

    if (code && verifier) {
      try {
        const auth = await exchangeCodeForToken(
          clientId,
          redirectUri,
          code,
          verifier,
          refreshToken
        );
        saveAuth(auth);
        setAccessToken(auth.accessToken);
        setRefreshToken(auth.refreshToken ?? null);
        cleanCodeFromUrl();
        await loadDashboard(auth.accessToken);
        return;
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }

    if (stored) {
      if (stored.expiresAt > Date.now()) {
        setAccessToken(stored.accessToken);
        setRefreshToken(stored.refreshToken ?? null);
        await loadDashboard(stored.accessToken);
        return;
      }

      if (stored.refreshToken) {
        try {
          const auth = await refreshAccessToken(clientId, stored.refreshToken);
          saveAuth(auth);
          setAccessToken(auth.accessToken);
          setRefreshToken(auth.refreshToken ?? null);
          await loadDashboard(auth.accessToken);
          return;
        } catch (err) {
          clearAuth();
          setError((err as Error).message);
        }
      }
    }
  };

  useEffect(() => {
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    clearAuth();
    setAccessToken(null);
    setRefreshToken(null);
    setProfile(null);
    setTopTracks([]);
    setTopArtists([]);
    setRecentPlays([]);
    setGenreStats([]);
    setRecentPatterns(null);
    setStatus("idle");
  };

  const lastPlay = recentPlays[0];

  const handleGenerateAndSavePlaylist = async () => {
    setCreateErr(null);
    setCreateMsg(null);
    setCreatedPlaylistUrl(null);
    if (!isAuthenticated || !accessToken || !profile) {
      setCreateErr("Debes conectar tu cuenta para crear una playlist.");
      return;
    }
    if (!aiPrompt.trim()) {
      setCreateErr("Escribe un prompt para la playlist.");
      return;
    }
    try {
      setCreating(true);
      const plan = await generatePlaylistPlan(aiPrompt.trim());
      setCreateMsg("Buscando canciones…");

      const uris: string[] = [];
      for (const q of plan.queries) {
        // búsqueda principal
        const uri = await searchFirstTrackUri(accessToken, q);
        if (uri) uris.push(uri);

        // corta a un máximo razonable para evitar rate limits
        if (uris.length >= 50) break;
      }
      // Enforce mínimo de 20 canciones
      if (uris.length < 20) {
        throw new Error(
          `Se necesitan al menos 20 canciones; se encontraron ${uris.length}. Prueba con un prompt más específico o diverso.`
        );
      }

      setCreateMsg("Creando playlist…");
      const { id, externalUrl } = await createPlaylist(
        accessToken,
        profile.id,
        plan.name,
        plan.description ?? "",
        false
      );

      setCreateMsg("Agregando canciones…");
      await addTracksToPlaylist(accessToken, id, uris);

      setCreatedPlaylistUrl(externalUrl);
      setCreateMsg(`Playlist creada (${uris.length} canciones).`);
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen text-[#e8f2ff] px-4 md:px-8 lg:px-10 py-12">
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_260px] gap-6 items-center mb-8">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#8fe1b0] mb-2">
            Datune · Data + Tune ;)
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Lee tus métricas de Spotify en segundos
          </h1>
          <p className="text-[#c8d6e8] max-w-[720px] mb-4">
            Conecta tu cuenta y obtén un snapshot de tu perfil, artistas y
            canciones más escuchadas.
          </p>
          <p className="text-[#8fe1b0] text-2xl font-bold mb-4">
            NUEVO!! Crea playlists personalizadas con IA
          </p>
          <div className="flex gap-3 flex-wrap mb-3">
            {!isAuthenticated ? (
              <button
                className="rounded-xl border border-transparent px-4 py-3 font-bold bg-gradient-to-br from-[#2cd37d] to-[#18b663] text-[#0b1f1a] shadow-[0_10px_30px_rgba(24,182,99,0.35)] active:translate-y-px transition"
                onClick={handleAuthorize}
                disabled={status === "authorizing"}
              >
                {status === "authorizing"
                  ? "Redirigiendo…"
                  : "Conectar con Spotify"}
              </button>
            ) : (
              <>
                <button
                  className="rounded-xl px-4 py-3 font-bold bg-white/10 border border-white/20 text-[#e8f2ff] active:translate-y-px transition"
                  onClick={() => loadDashboard(accessToken ?? "")}
                >
                  Actualizar datos
                </button>
                <button
                  className="rounded-xl px-4 py-3 font-bold bg-red-500/20 border border-red-500/40 text-red-300 active:translate-y-px transition"
                  onClick={handleLogout}
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
          {!clientId && (
            <p className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl mt-1 max-w-[520px]">
              Hubo un error. Revisa la configuración de la aplicación.
            </p>
          )}
          {error && (
            <p className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl mt-1 max-w-[520px]">
              {error}
            </p>
          )}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-3 items-center">
          <div className="w-3 h-3 bg-[#2cd37d] rounded-full animate-pulse" />
          <div>
            <p className="text-xs text-[#9fb2c8] m-0">Estado</p>
            <p className="mt-1 font-bold">
              {status === "loading"
                ? "Cargando datos…"
                : isAuthenticated
                ? "Conectado"
                : "Desconectado"}
            </p>
          </div>
        </div>
      </header>

      <main className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
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
            <p className="text-[#9fb2c8]">
              No hay reproducciones recientes para mostrar.
            </p>
          )}
        </section>

        {/* Géneros destacados - ahora a la derecha de reproducción */}
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
                  <span className="text-[#8fe1b0] font-bold text-xs">
                    #{i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-[15px] leading-tight m-0">
                      {g.genre}
                    </p>
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
                <h3 className="text-xl font-semibold">
                  {profile.display_name}
                </h3>
                <p className="text-[#9fb2c8]">
                  {profile.email ?? "Email no disponible"}
                </p>
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
            <p className="text-[#9fb2c8]">
              Conecta tu cuenta para ver tu perfil.
            </p>
          )}
        </section>

        {/* Playlist IA - ahora a la derecha de perfil */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
              Playlist IA
            </p>
            <h2 className="text-lg m-0">Generar y guardar por prompt</h2>
          </div>

          {/* Tip box */}
          <div className="bg-[#8fe1b0]/10 border border-[#8fe1b0]/30 rounded-xl p-3 mb-3">
            <p className="text-[#8fe1b0] font-bold text-xs mb-2 flex items-center gap-1">
              <span className="text-sm">💡</span> Tips para mejores resultados:
            </p>
            <ul className="space-y-1.5 text-[11px] text-[#c8d6e8] leading-relaxed">
              <li className="flex gap-2">
                <span className="text-[#8fe1b0] mt-0.5">•</span>
                <span>
                  <strong className="text-[#8fe1b0]">Sé específico:</strong>{" "}
                  "Rock progresivo de los 70" en lugar de solo "rock"
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8fe1b0] mt-0.5">•</span>
                <span>
                  <strong className="text-[#8fe1b0]">Incluye contexto:</strong>{" "}
                  "Para entrenar", "para trabajar concentrado"
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8fe1b0] mt-0.5">•</span>
                <span>
                  <strong className="text-[#8fe1b0]">Menciona artistas:</strong>{" "}
                  "Al estilo de Daft Punk y Justice"
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8fe1b0] mt-0.5">•</span>
                <span>
                  <strong className="text-[#8fe1b0]">Define el mood:</strong>{" "}
                  "Energética y motivadora" o "Relajante y atmosférica"
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8fe1b0] mt-0.5">•</span>
                <span>
                  <strong className="text-[#8fe1b0]">Combina géneros:</strong>{" "}
                  "Jazz fusion con toques electrónicos"
                </span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ej: 'Synthwave para manejar de noche'"
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-[#e8f2ff] placeholder-[#9fb2c8] focus:outline-none"
            />
            <button
              onClick={handleGenerateAndSavePlaylist}
              disabled={creating || !isAuthenticated}
              className="rounded-xl px-4 py-2 font-bold bg-gradient-to-br from-[#2cd37d] to-[#18b663] text-[#0b1f1a] shadow-[0_10px_30px_rgba(24,182,99,0.35)] disabled:opacity-50 active:translate-y-px transition"
            >
              {creating ? "Creando…" : "Generar y guardar"}
            </button>
          </div>
          <div className="mt-2">
            {createMsg && <p className="text-[#c8d6e8] text-sm">{createMsg}</p>}
            {createErr && (
              <p className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl mt-2">
                {createErr}
              </p>
            )}
            {createdPlaylistUrl && (
              <a
                href={createdPlaylistUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-[13px] text-[#8fe1b0] underline"
              >
                Ver en Spotify
              </a>
            )}
          </div>
          {!isAuthenticated && (
            <p className="text-[#9fb2c8] text-sm mt-2">
              Conecta tu cuenta para guardar la playlist.
            </p>
          )}
        </section>

        {/* Artistas favoritos */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
              Top
            </p>
            <h2 className="text-lg m-0">Artistas favoritos</h2>
          </div>
          {status === "loading" && (
            <div className="p-3 text-[#9fb2c8] text-sm">Cargando artistas…</div>
          )}
          {topArtists.length > 0 ? (
            <ul className="divide-y divide-white/10">
              {topArtists.slice(0, 5).map((artist, idx) => (
                <li
                  key={artist.id}
                  className="grid grid-cols-[auto_48px_minmax(0,1fr)_auto] gap-3 items-center py-2"
                >
                  <span className="text-[#8fe1b0] font-bold text-xs">
                    #{idx + 1}
                  </span>
                  <img
                    src={pickImage(artist.images)}
                    alt={artist.name}
                    className="w-12 h-12 min-w-12 min-h-12 object-cover rounded-xl border border-white/10 bg-white/5"
                  />
                  <div>
                    <p className="font-bold text-[15px] leading-tight m-0">
                      {artist.name}
                    </p>
                    <p className="text-[13px] text-[#9fb2c8] m-0">
                      {artist.genres?.slice(0, 2).join(" · ") || "Sin géneros"}
                    </p>
                  </div>
                  <span className="bg-white/10 px-3 py-1 rounded-xl text-xs text-[#c9d7e8]">
                    Popularidad {artist.popularity ?? 0}
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
            <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
              Top
            </p>
            <h2 className="text-lg m-0">Canciones favoritas</h2>
          </div>
          {status === "loading" && (
            <div className="p-3 text-[#9fb2c8] text-sm">
              Cargando canciones…
            </div>
          )}
          {topTracks.length > 0 ? (
            <ul className="divide-y divide-white/10">
              {topTracks.slice(0, 5).map((track, idx) => (
                <li
                  key={track.id}
                  className="grid grid-cols-[auto_48px_minmax(0,1fr)_auto] gap-3 items-center py-2"
                >
                  <span className="text-[#8fe1b0] font-bold text-xs">
                    #{idx + 1}
                  </span>
                  <img
                    src={pickImage(track.album.images)}
                    alt={track.name}
                    className="w-12 h-12 min-w-12 min-h-12 object-cover rounded-xl border border-white/10 bg-white/5"
                  />
                  <div>
                    <p className="font-bold text-[15px] leading-tight m-0">
                      {track.name}
                    </p>
                    <p className="text-[13px] text-[#9fb2c8] m-0">
                      {track.artists.map((a) => a.name).join(" · ")} ·{" "}
                      {track.album.name}
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

        {/* Reproducciones recientes */}
        <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)] md:col-span-2">
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
          {status === "loading" && (
            <div className="p-3 text-[#9fb2c8] text-sm">Leyendo actividad…</div>
          )}
          {recentPlays.length > 0 ? (
            <ul className="divide-y divide-white/10">
              {recentPlays.map((play) => (
                <li
                  key={play.played_at}
                  className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 items-center py-2"
                >
                  <img
                    src={pickImage(play.track.album.images)}
                    alt={play.track.name}
                    className="w-12 h-12 min-w-12 min-h-12 object-cover rounded-xl border border-white/10 bg-white/5"
                  />
                  <div>
                    <p className="font-bold text-[15px] leading-tight m-0">
                      {play.track.name}
                    </p>
                    <p className="text-[13px] text-[#9fb2c8] m-0">
                      {play.track.artists.map((a) => a.name).join(" · ")} ·{" "}
                      {play.track.album.name}
                    </p>
                  </div>
                  <span className="bg-white/10 px-3 py-1 rounded-xl text-xs text-[#9fb2c8]">
                    {formatDate(play.played_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9fb2c8]">
              No hemos encontrado actividad reciente.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
