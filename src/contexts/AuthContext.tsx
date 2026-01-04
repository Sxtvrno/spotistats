import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
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
import type { SpotifyUser } from "../types/spotify";

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  profile: SpotifyUser | null;
  isAuthenticated: boolean;
  status: "idle" | "authorizing" | "loading" | "ready";
  error: string | null;
  handleAuthorize: () => Promise<void>;
  handleLogout: () => void;
  loadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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

  const isAuthenticated = Boolean(accessToken);

  const cleanCodeFromUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  };

  const loadProfile = async () => {
    if (!accessToken) return;
    try {
      const userData = await fetchWithToken<SpotifyUser>(accessToken, "me");
      setProfile(userData);
    } catch (err) {
      console.error("Error loading profile:", err);
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

  const handleLogout = () => {
    clearAuth();
    setAccessToken(null);
    setRefreshToken(null);
    setProfile(null);
    setStatus("idle");
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

        const userData = await fetchWithToken<SpotifyUser>(
          auth.accessToken,
          "me"
        );
        setProfile(userData);
        setStatus("ready");
        return;
      } catch (err) {
        setError((err as Error).message);
        setStatus("idle");
        return;
      }
    }

    if (stored) {
      if (stored.expiresAt > Date.now()) {
        setAccessToken(stored.accessToken);
        setRefreshToken(stored.refreshToken ?? null);

        const userData = await fetchWithToken<SpotifyUser>(
          stored.accessToken,
          "me"
        );
        setProfile(userData);
        setStatus("ready");
        return;
      }

      if (stored.refreshToken) {
        try {
          const auth = await refreshAccessToken(clientId, stored.refreshToken);
          saveAuth(auth);
          setAccessToken(auth.accessToken);
          setRefreshToken(auth.refreshToken ?? null);

          const userData = await fetchWithToken<SpotifyUser>(
            auth.accessToken,
            "me"
          );
          setProfile(userData);
          setStatus("ready");
          return;
        } catch (err) {
          clearAuth();
          setError((err as Error).message);
          setStatus("idle");
        }
      }
    }
  };

  useEffect(() => {
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        refreshToken,
        profile,
        isAuthenticated,
        status,
        error,
        handleAuthorize,
        handleLogout,
        loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};
