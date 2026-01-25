import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const location = useLocation();
  const {
    isAuthenticated,
    profile,
    handleAuthorize,
    handleLogout,
    status,
    error,
  } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen text-[#e8f2ff] px-4 md:px-8 lg:px-10 py-12">
      <header className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#8fe1b0] mb-2">
              Datune · Data + Tune ;)
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Tu música en datos
            </h1>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
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
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex gap-3 items-center">
                  {profile?.images?.[0]?.url && (
                    <img
                      src={profile.images[0].url}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                  )}
                  <div>
                    <p className="text-xs text-[#9fb2c8] m-0">Conectado como</p>
                    <p className="mt-0.5 font-bold text-sm">
                      {profile?.display_name}
                    </p>
                  </div>
                </div>
                <button
                  className="rounded-xl px-4 py-3 font-bold bg-red-500/20 border border-red-500/40 text-red-300 active:translate-y-px transition"
                  onClick={handleLogout}
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <p className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl mb-4 max-w-[520px]">
            {error}
          </p>
        )}

        <nav className="flex gap-2 border-b border-white/10 pb-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-t-xl transition ${
              isActive("/")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Inicio
          </Link>
          <Link
            to="/stats"
            className={`px-4 py-2 rounded-t-xl transition ${
              isActive("/stats")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Estadísticas
          </Link>
          <Link
            to="/playlists"
            className={`px-4 py-2 rounded-t-xl transition ${
              isActive("/playlists")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Playlists
          </Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
