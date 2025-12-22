import { useEffect, useMemo, useState } from "react";
import "./App.css";

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyUser = {
  id: string;
  display_name: string;
  email?: string;
  country?: string;
  product?: string;
  followers?: { total: number };
  images?: SpotifyImage[];
};
type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
  followers?: { total: number };
  images?: SpotifyImage[];
};
type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images?: SpotifyImage[] };
  popularity?: number;
  duration_ms?: number;
};
type RecentPlay = { played_at: string; track: SpotifyTrack };

type StoredAuth = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

type GenreStat = { genre: string; count: number; artists: string[] };

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
];

const STORAGE_KEY = "spotistats.auth";
const VERIFIER_KEY = "spotistats.pkce_verifier";
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

const readStoredAuth = (): StoredAuth | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
};

const saveAuth = (auth: StoredAuth) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
const clearAuth = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
};

const createVerifier = (length = 64) => {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => alphabet[n % alphabet.length]).join("");
};

const base64Url = (input: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const createChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(digest);
};

function App() {
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

  const isAuthenticated = useMemo(() => Boolean(accessToken), [accessToken]);

  const cleanCodeFromUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  };

  const exchangeCodeForToken = async (code: string, verifier: string) => {
    const body = new URLSearchParams({
      client_id: clientId ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok)
      throw new Error("No se pudo intercambiar el código de autorización.");

    const json = await res.json();
    const expiresAt = Date.now() + json.expires_in * 1000 - 60000;
    const auth: StoredAuth = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken ?? undefined,
      expiresAt,
    };
    saveAuth(auth);
    setAccessToken(auth.accessToken);
    setRefreshToken(auth.refreshToken ?? null);
    cleanCodeFromUrl();
    return auth.accessToken;
  };

  const refreshAccessToken = async (tokenToRefresh: string) => {
    const body = new URLSearchParams({
      client_id: clientId ?? "",
      grant_type: "refresh_token",
      refresh_token: tokenToRefresh,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) throw new Error("No se pudo refrescar el token de acceso.");

    const json = await res.json();
    const expiresAt = Date.now() + json.expires_in * 1000 - 60000;
    const auth: StoredAuth = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? tokenToRefresh,
      expiresAt,
    };
    saveAuth(auth);
    setAccessToken(auth.accessToken);
    setRefreshToken(auth.refreshToken ?? null);
    return auth.accessToken;
  };

  const fetchWithToken = async <T,>(
    token: string,
    endpoint: string,
    retry = true
  ): Promise<T> => {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `https://api.spotify.com/v1/${endpoint}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) return res.json() as Promise<T>;

    // 401: intenta refrescar una vez
    if (res.status === 401 && refreshToken && retry) {
      const newToken = await refreshAccessToken(refreshToken);
      setAccessToken(newToken);
      return fetchWithToken<T>(newToken, endpoint, false);
    }

    let message = `Error HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* ignore */
    }

    if (res.status === 403) {
      throw new Error(
        "Tu cuenta no está autorizada para esta app (modo desarrollo en Spotify). Pide al owner que te agregue en Users and Access."
      );
    }

    throw new Error(message);
  };

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

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", challenge);

    window.location.assign(authUrl.toString());
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
        const token = await exchangeCodeForToken(code, verifier);
        await loadDashboard(token);
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
          const token = await refreshAccessToken(stored.refreshToken);
          await loadDashboard(token);
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Spotistats · Panel personal</p>
          <h1>Lee tus métricas de Spotify en segundos</h1>
          <p className="lede">
            Conecta tu cuenta y obtén un snapshot curado de tu perfil, artistas
            y canciones más escuchadas.
          </p>
          <div className="actions">
            {!isAuthenticated ? (
              <button
                className="btn primary"
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
                  className="btn ghost"
                  onClick={() => loadDashboard(accessToken ?? "")}
                >
                  Actualizar datos
                </button>
                <button className="btn danger" onClick={handleLogout}>
                  Desconectar
                </button>
              </>
            )}
          </div>
          {!clientId && (
            <p className="warning">
              Define VITE_SPOTIFY_CLIENT_ID y VITE_SPOTIFY_REDIRECT_URI en un
              archivo .env.local.
            </p>
          )}
          {error && <p className="warning">{error}</p>}
        </div>
        <div className="badge">
          <div className="pulse" />
          <div>
            <p className="badge-label">Estado</p>
            <p className="badge-value">
              {status === "loading"
                ? "Cargando datos…"
                : isAuthenticated
                ? "Conectado"
                : "Desconectado"}
            </p>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="card span-2">
          <div className="card-head">
            <p className="card-kicker">Reproducción</p>
            <h2>Última canción reproducida</h2>
          </div>

          {lastPlay ? (
            <div className="now-embed">
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <img
                  src={pickImage(lastPlay.track.album.images)}
                  alt={lastPlay.track.name}
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
                <div>
                  <p className="title" style={{ marginBottom: 4 }}>
                    {lastPlay.track.name}
                  </p>
                  <p className="muted" style={{ marginBottom: 4 }}>
                    {lastPlay.track.artists.map((a) => a.name).join(" · ")}
                  </p>
                  <p className="muted" style={{ fontSize: 13 }}>
                    {formatDate(lastPlay.played_at)}
                  </p>
                </div>
              </div>

              <div style={{ width: "100%" }}>
                <iframe
                  title="Última canción en Spotify"
                  src={`https://open.spotify.com/embed/track/${lastPlay.track.id}`}
                  width="100%"
                  height="80"
                  frameBorder="0"
                  allow="encrypted-media; clipboard-write"
                  style={{ borderRadius: 8 }}
                />
              </div>
            </div>
          ) : (
            <p className="muted">
              No hay reproducciones recientes para mostrar.
            </p>
          )}
        </section>
        <section className="card span-2">
          <div className="card-head">
            <p className="card-kicker">Perfil</p>
            <h2>Resumen de cuenta</h2>
          </div>
          {profile ? (
            <div className="profile">
              <img
                src={pickImage(profile.images)}
                alt="Avatar"
                className="avatar"
              />
              <div>
                <h3>{profile.display_name}</h3>
                <p className="muted">
                  {profile.email ?? "Email no disponible"}
                </p>
                <div className="chips">
                  {profile.country && (
                    <span className="chip">País · {profile.country}</span>
                  )}
                  {profile.product && (
                    <span className="chip">Plan · {profile.product}</span>
                  )}
                  {profile.followers?.total !== undefined && (
                    <span className="chip">
                      Seguidores · {numberFmt.format(profile.followers.total)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">Conecta tu cuenta para ver tu perfil.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <p className="card-kicker">Géneros</p>
            <h2>Géneros destacados</h2>
          </div>
          {genreStats.length ? (
            <ul className="list">
              {genreStats.map((g, i) => (
                <li key={g.genre} className="list-row">
                  <span className="rank">#{i + 1}</span>
                  <div className="list-meta">
                    <p className="title">{g.genre}</p>
                    <p className="muted">
                      {g.count} artistas · {g.artists.join(", ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aún no hay géneros disponibles.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <p className="card-kicker">Top</p>
            <h2>Artistas favoritos</h2>
          </div>
          {status === "loading" && (
            <div className="skeleton">Cargando artistas…</div>
          )}
          {topArtists.length > 0 ? (
            <ul className="list">
              {topArtists.slice(0, 5).map((artist, idx) => (
                <li key={artist.id} className="list-row">
                  <span className="rank">#{idx + 1}</span>
                  <img
                    src={pickImage(artist.images)}
                    alt={artist.name}
                    className="thumb"
                  />
                  <div className="list-meta">
                    <p className="title">{artist.name}</p>
                    <p className="muted">
                      {artist.genres?.slice(0, 2).join(" · ") || "Sin géneros"}
                    </p>
                  </div>
                  <span className="pill">
                    Popularidad {artist.popularity ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aún no hay artistas cargados.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <p className="card-kicker">Top</p>
            <h2>Canciones favoritas</h2>
          </div>
          {status === "loading" && (
            <div className="skeleton">Cargando canciones…</div>
          )}
          {topTracks.length > 0 ? (
            <ul className="list">
              {topTracks.slice(0, 5).map((track, idx) => (
                <li key={track.id} className="list-row">
                  <span className="rank">#{idx + 1}</span>
                  <img
                    src={pickImage(track.album.images)}
                    alt={track.name}
                    className="thumb"
                  />
                  <div className="list-meta">
                    <p className="title">{track.name}</p>
                    <p className="muted">
                      {track.artists.map((a) => a.name).join(" · ")} ·{" "}
                      {track.album.name}
                    </p>
                  </div>
                  <span className="pill">
                    {formatDuration(track.duration_ms)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aún no hay canciones cargadas.</p>
          )}
        </section>

        <section className="card span-2">
          <div className="card-head">
            <p className="card-kicker">Actividad</p>
            <h2>Reproducciones recientes</h2>
          </div>
          {recentPatterns && (
            <div className="chips" style={{ marginBottom: 8 }}>
              {recentPatterns.topHours.map((h) => (
                <span key={h.hour} className="chip">
                  Hora {h.hour.toString().padStart(2, "0")}: {h.count}
                </span>
              ))}
              {recentPatterns.topArtist && (
                <span className="chip">
                  Artista más repetido · {recentPatterns.topArtist}
                </span>
              )}
            </div>
          )}
          {status === "loading" && (
            <div className="skeleton">Leyendo actividad…</div>
          )}
          {recentPlays.length > 0 ? (
            <ul className="list dense">
              {recentPlays.map((play) => (
                <li key={play.played_at} className="list-row">
                  <img
                    src={pickImage(play.track.album.images)}
                    alt={play.track.name}
                    className="thumb"
                  />
                  <div className="list-meta">
                    <p className="title">{play.track.name}</p>
                    <p className="muted">
                      {play.track.artists.map((a) => a.name).join(" · ")} ·{" "}
                      {play.track.album.name}
                    </p>
                  </div>
                  <span className="pill muted">
                    {formatDate(play.played_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No hemos encontrado actividad reciente.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
