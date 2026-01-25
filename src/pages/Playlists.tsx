import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { generatePlaylistPlan } from "../lib/ai";
import {
  searchFirstTrackUri,
  createPlaylist,
  addTracksToPlaylist,
  fetchWithToken,
} from "../lib/spotify";

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  tracks: { total: number };
  external_urls: { spotify: string };
  owner: { display_name: string };
  public: boolean;
}

export default function Playlists() {
  const { accessToken, isAuthenticated, profile } = useAuth();
  const [aiPrompt, setAiPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createdPlaylistUrl, setCreatedPlaylistUrl] = useState<string | null>(
    null,
  );

  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);

  const loadUserPlaylists = async () => {
    if (!accessToken) {
      console.warn("No accessToken available");
      return;
    }
    setLoadingPlaylists(true);
    setPlaylistsError(null);
    try {
      const data = await fetchWithToken<{ items: SpotifyPlaylist[] }>(
        accessToken,
        "me/playlists?limit=50",
      );
      console.log("Playlists loaded:", data.items?.length);
      setUserPlaylists(data.items || []);
    } catch (err) {
      console.error("Error loading playlists:", err);
      setPlaylistsError((err as Error).message);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadUserPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

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
        const uri = await searchFirstTrackUri(accessToken, q);
        if (uri) uris.push(uri);
        if (uris.length >= 50) break;
      }

      if (uris.length < 20) {
        throw new Error(
          `Se necesitan al menos 20 canciones; se encontraron ${uris.length}. Prueba con un prompt más específico.`,
        );
      }

      setCreateMsg("Creando playlist…");
      const { id, externalUrl } = await createPlaylist(
        accessToken,
        profile.id,
        plan.name,
        plan.description ?? "",
        false,
      );

      setCreateMsg("Agregando canciones…");
      await addTracksToPlaylist(accessToken, id, uris);

      setCreatedPlaylistUrl(externalUrl);
      setCreateMsg(`✅ Playlist creada con ${uris.length} canciones.`);
      setAiPrompt("");

      // Recargar playlists para mostrar la nueva
      setTimeout(() => loadUserPlaylists(), 1000);
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-[#9fb2c8] text-lg">
          Conecta tu cuenta de Spotify para crear y ver tus playlists
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Playlists</h2>
        <button
          onClick={loadUserPlaylists}
          disabled={loadingPlaylists}
          className="rounded-xl px-4 py-2 text-sm font-bold bg-white/10 border border-white/20 text-[#e8f2ff] hover:bg-white/20 active:translate-y-px transition disabled:opacity-50"
        >
          {loadingPlaylists ? "Actualizando…" : "🔄 Actualizar"}
        </button>
      </div>

      {/* Generador con IA */}
      <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0">
            Crear nueva
          </p>
          <h3 className="text-xl m-0">Generar playlist con IA</h3>
        </div>

        {/* Tip box */}
        <div className="bg-[#8fe1b0]/10 border border-[#8fe1b0]/30 rounded-xl p-4 mb-4">
          <p className="text-[#8fe1b0] font-bold text-sm mb-3 flex items-center gap-2">
            <span className="text-lg">💡</span> Tips para mejores resultados:
          </p>
          <ul className="space-y-2 text-[12px] text-[#c8d6e8] leading-relaxed">
            <li className="flex gap-2">
              <span className="text-[#8fe1b0] mt-0.5">•</span>
              <span>
                <strong className="text-[#8fe1b0]">Sé específico:</strong> "Rock
                progresivo de los 70" en lugar de solo "rock"
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
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ej: 'Synthwave para manejar de noche', 'Hip-hop clásico de los 90', 'Jazz para estudiar'…"
            className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-[#e8f2ff] placeholder-[#9fb2c8] focus:outline-none focus:border-[#8fe1b0] resize-none h-20"
          />
          <button
            onClick={handleGenerateAndSavePlaylist}
            disabled={creating || !aiPrompt.trim()}
            className="rounded-xl px-6 py-3 font-bold bg-gradient-to-br from-[#2cd37d] to-[#18b663] text-[#0b1f1a] shadow-[0_10px_30px_rgba(24,182,99,0.35)] disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px transition"
          >
            {creating ? "✨ Creando…" : "✨ Generar y guardar en Spotify"}
          </button>
        </div>

        {createMsg && (
          <div className="mt-3 p-3 bg-[#8fe1b0]/20 border border-[#8fe1b0]/40 rounded-xl">
            <p className="text-[#c8d6e8] text-sm">{createMsg}</p>
          </div>
        )}
        {createErr && (
          <div className="mt-3 p-3 bg-amber-400/20 border border-amber-400/40 rounded-xl">
            <p className="text-amber-100 text-sm">{createErr}</p>
          </div>
        )}
        {createdPlaylistUrl && (
          <div className="mt-3 flex gap-2 items-center">
            <a
              href={createdPlaylistUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#8fe1b0]/20 border border-[#8fe1b0]/40 rounded-xl text-[#8fe1b0] font-bold hover:bg-[#8fe1b0]/30 transition text-sm"
            >
              🎵 Abrir en Spotify
            </a>
            <button
              onClick={() => {
                setCreatedPlaylistUrl(null);
                setCreateMsg(null);
              }}
              className="px-3 py-2 text-sm text-[#9fb2c8] hover:text-[#e8f2ff] transition"
            >
              ✕
            </button>
          </div>
        )}
      </section>

      {/* Playlists del usuario */}
      <section className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
        <div className="mb-6">
          <p className="uppercase text-[#8fe1b0] text-[11px] tracking-widest m-0 mb-2">
            Tu biblioteca
          </p>
          <h3 className="text-xl font-bold m-0">
            Tus playlists de Spotify ({userPlaylists.length})
          </h3>
        </div>

        {playlistsError && (
          <div className="p-3 bg-amber-400/20 border border-amber-400/40 rounded-xl mb-4">
            <p className="text-amber-100 text-sm">{playlistsError}</p>
          </div>
        )}

        {loadingPlaylists && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-3">🎵</div>
              <p className="text-[#9fb2c8]">Cargando tus playlists…</p>
            </div>
          </div>
        )}

        {!loadingPlaylists && userPlaylists.length === 0 && (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-[#9fb2c8]">Aún no tienes playlists.</p>
            <p className="text-[#9fb2c8] text-sm mt-2">
              Crea una nueva playlist arriba o en Spotify.
            </p>
          </div>
        )}

        {!loadingPlaylists && userPlaylists.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userPlaylists.map((playlist) => (
              <a
                key={playlist.id}
                href={playlist.external_urls.spotify}
                target="_blank"
                rel="noreferrer"
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-[#8fe1b0]/40 transition group overflow-hidden"
              >
                <div className="flex flex-col h-full">
                  {/* Cover */}
                  <div className="mb-3 rounded-lg overflow-hidden bg-white/5 border border-white/10 aspect-square flex items-center justify-center">
                    {playlist.images[0]?.url ? (
                      <img
                        src={playlist.images[0].url}
                        alt={playlist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="text-5xl">🎵</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-[15px] leading-tight mb-2 line-clamp-2 group-hover:text-[#8fe1b0] transition">
                        {playlist.name}
                      </p>
                      {playlist.description && (
                        <p className="text-[12px] text-[#9fb2c8] line-clamp-2 mb-2">
                          {playlist.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 border-t border-white/10 pt-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9fb2c8]">
                          🎵 {playlist.tracks.total} canciones
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            playlist.public
                              ? "bg-[#8fe1b0]/20 text-[#8fe1b0]"
                              : "bg-white/10 text-[#9fb2c8]"
                          }`}
                        >
                          {playlist.public ? "🌐 Pública" : "🔒 Privada"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9fb2c8]">
                        Por {playlist.owner.display_name}
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
