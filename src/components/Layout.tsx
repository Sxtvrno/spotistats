import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NowPlaying from "./NowPlaying";

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
    <div className="min-h-screen text-[#e8f2ff] px-3 md:px-4 lg:px-8 xl:px-10 py-4 md:py-8 lg:py-12">
      <header className="mb-6 md:mb-8">
        <div className="flex flex-col gap-4 md:gap-6 mb-4 md:mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] md:text-xs uppercase tracking-wider text-[#8fe1b0] mb-1 md:mb-2">
                Datune · Data + Tune ;)
              </p>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
                Tu música en datos
              </h1>
            </div>

            {!isAuthenticated && (
              <button
                className="rounded-lg md:rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-bold bg-gradient-to-br from-[#2cd37d] to-[#18b663] text-[#0b1f1a] shadow-[0_10px_30px_rgba(24,182,99,0.35)] active:translate-y-px transition whitespace-nowrap"
                onClick={handleAuthorize}
                disabled={status === "authorizing"}
              >
                {status === "authorizing" ? "..." : "Conectar"}
              </button>
            )}
          </div>

          {isAuthenticated && (
            <div className="flex gap-2 md:gap-3 flex-wrap items-center justify-between">
              <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-2 md:p-3 flex gap-2 md:gap-3 items-center">
                {profile?.images?.[0]?.url && (
                  <img
                    src={profile.images[0].url}
                    alt="Avatar"
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-white/10"
                  />
                )}
                <div>
                  <p className="text-[10px] md:text-xs text-[#9fb2c8] m-0">
                    Conectado
                  </p>
                  <p className="mt-0.5 font-bold text-xs md:text-sm truncate max-w-[120px] md:max-w-none">
                    {profile?.display_name}
                  </p>
                </div>
              </div>
              <button
                className="rounded-lg md:rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-bold bg-red-500/20 border border-red-500/40 text-red-300 active:translate-y-px transition"
                onClick={handleLogout}
              >
                Salir
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="bg-amber-400/20 border border-amber-400/40 text-amber-100 px-3 py-2 rounded-xl mb-4 text-xs md:text-sm">
            {error}
          </p>
        )}

        <nav className="flex gap-1 md:gap-2 border-b border-white/10 pb-1 overflow-x-auto">
          <Link
            to="/"
            className={`px-3 md:px-4 py-2 rounded-t-lg md:rounded-t-xl transition text-xs md:text-sm whitespace-nowrap ${
              isActive("/")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Inicio
          </Link>
          <Link
            to="/stats"
            className={`px-3 md:px-4 py-2 rounded-t-lg md:rounded-t-xl transition text-xs md:text-sm whitespace-nowrap ${
              isActive("/stats")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Stats
          </Link>
          <Link
            to="/playlists"
            className={`px-3 md:px-4 py-2 rounded-t-lg md:rounded-t-xl transition text-xs md:text-sm whitespace-nowrap ${
              isActive("/playlists")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Playlists
          </Link>
          <Link
            to="/audio-analysis"
            className={`px-3 md:px-4 py-2 rounded-t-lg md:rounded-t-xl transition text-xs md:text-sm whitespace-nowrap ${
              isActive("/audio-analysis")
                ? "bg-white/10 text-[#8fe1b0] font-bold"
                : "text-[#c8d6e8] hover:text-[#e8f2ff]"
            }`}
          >
            Análisis
          </Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <NowPlaying />
    </div>
  );
}
