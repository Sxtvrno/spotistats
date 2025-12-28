import type { StoredAuth } from "../types/spotify";

export const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-modify-private",
  "playlist-modify-public",
];

export const STORAGE_KEY = "spotistats.auth";
export const VERIFIER_KEY = "spotistats.pkce_verifier";

export const readStoredAuth = (): StoredAuth | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
};

export const saveAuth = (auth: StoredAuth) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));

export const clearAuth = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
};

export const createVerifier = (length = 64) => {
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

export const createChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(digest);
};

export const buildAuthorizeUrl = (
  clientId: string,
  redirectUri: string,
  scopes: string[],
  challenge: string
) => {
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);
  return authUrl.toString();
};

export const exchangeCodeForToken = async (
  clientId: string,
  redirectUri: string,
  code: string,
  verifier: string,
  fallbackRefreshToken?: string | null
): Promise<StoredAuth> => {
  const body = new URLSearchParams({
    client_id: clientId,
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
    refreshToken: json.refresh_token ?? fallbackRefreshToken ?? undefined,
    expiresAt,
  };
  saveAuth(auth);
  return auth;
};

export const refreshAccessToken = async (
  clientId: string,
  tokenToRefresh: string
): Promise<StoredAuth> => {
  const body = new URLSearchParams({
    client_id: clientId,
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
  return auth;
};

export const fetchWithToken = async <T>(
  token: string,
  endpoint: string
): Promise<T> => {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.spotify.com/v1/${endpoint}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) return res.json() as Promise<T>;

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

// Nuevo: request genérico (POST/PUT)
export const requestWithToken = async <T>(
  token: string,
  endpoint: string,
  init?: RequestInit
): Promise<T> => {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.spotify.com/v1/${endpoint}`;
  const res = await fetch(url, {
    ...(init ?? {}),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Error HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {}
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
};

export const searchFirstTrackUri = async (
  token: string,
  query: string
): Promise<string | null> => {
  const data = await fetchWithToken<{
    tracks: { items: Array<{ uri: string }> };
  }>(token, `search?q=${encodeURIComponent(query)}&type=track&limit=1`);
  return data.tracks.items[0]?.uri ?? null;
};

export const createPlaylist = async (
  token: string,
  userId: string,
  name: string,
  description: string,
  isPublic = false
): Promise<{ id: string; externalUrl: string }> => {
  const playlist = await requestWithToken<{
    id: string;
    external_urls: { spotify: string };
  }>(token, `users/${userId}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });
  return { id: playlist.id, externalUrl: playlist.external_urls.spotify };
};

export const addTracksToPlaylist = async (
  token: string,
  playlistId: string,
  uris: string[]
): Promise<void> => {
  await requestWithToken<void>(token, `playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris }),
  });
};
