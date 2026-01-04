import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-[rgba(10,18,30,0.75)] border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
        <h2 className="text-2xl font-bold mb-4 text-[#8fe1b0]">
          Bienvenido a Datune
        </h2>
        <p className="text-[#c8d6e8] text-lg mb-6">
          Tu dashboard personal de Spotify con análisis detallados y generación
          de playlists con IA.
        </p>

        {!isAuthenticated && (
          <div className="bg-[#8fe1b0]/10 border border-[#8fe1b0]/30 rounded-xl p-4 mb-6">
            <p className="text-[#8fe1b0] font-bold mb-2">
              👉 Comienza conectando tu cuenta
            </p>
            <p className="text-[#c8d6e8] text-sm">
              Haz clic en "Conectar con Spotify" arriba para empezar a explorar
              tus datos musicales.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            to="/stats"
            className="bg-gradient-to-br from-[#2cd37d]/20 to-[#18b663]/20 border border-[#2cd37d]/40 rounded-xl p-6 hover:from-[#2cd37d]/30 hover:to-[#18b663]/30 transition group"
          >
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-[#8fe1b0] transition">
              Estadísticas
            </h3>
            <p className="text-[#c8d6e8] text-sm">
              Explora tus artistas, canciones y géneros favoritos. Analiza tus
              patrones de escucha.
            </p>
          </Link>

          <Link
            to="/playlists"
            className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/40 rounded-xl p-6 hover:from-purple-500/30 hover:to-pink-500/30 transition group"
          >
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-purple-300 transition">
              Playlists con IA
            </h3>
            <p className="text-[#c8d6e8] text-sm">
              Genera playlists personalizadas con inteligencia artificial y
              gestiona tus colecciones.
            </p>
          </Link>
        </div>
      </div>

      {isAuthenticated && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl mb-2">🎵</div>
            <p className="text-[#9fb2c8] text-sm mb-1">Funcionalidad</p>
            <p className="font-bold">Top Tracks & Artists</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl mb-2">🎭</div>
            <p className="text-[#9fb2c8] text-sm mb-1">Análisis</p>
            <p className="font-bold">Géneros y Patrones</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-2xl mb-2">✨</div>
            <p className="text-[#9fb2c8] text-sm mb-1">Creación</p>
            <p className="font-bold">Playlists con IA</p>
          </div>
        </div>
      )}
    </div>
  );
}
