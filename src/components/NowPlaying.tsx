import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getCurrentPlayback,
  pausePlayback,
  resumePlayback,
  skipToNext,
  skipToPrevious,
  toggleShuffle,
  setRepeatMode,
} from "../lib/spotify";
import type { PlaybackState } from "../types/spotify";

export default function NowPlaying() {
  const { accessToken, isAuthenticated } = useAuth();
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const loadPlayback = async () => {
    if (!accessToken) return;
    try {
      const state = await getCurrentPlayback(accessToken);
      setPlayback(state);
      setError(null);
    } catch (err) {
      console.error("Error loading playback:", err);
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadPlayback();
      const interval = setInterval(loadPlayback, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, accessToken]);

  const handlePlayPause = async () => {
    if (!accessToken || !playback) return;
    setLoading(true);
    try {
      if (playback.is_playing) {
        await pausePlayback(accessToken);
      } else {
        await resumePlayback(accessToken);
      }
      setTimeout(loadPlayback, 300);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await skipToNext(accessToken);
      setTimeout(loadPlayback, 500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await skipToPrevious(accessToken);
      setTimeout(loadPlayback, 500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleShuffle = async () => {
    if (!accessToken || !playback) return;
    setLoading(true);
    try {
      await toggleShuffle(accessToken, !playback.shuffle_state);
      setTimeout(loadPlayback, 300);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRepeat = async () => {
    if (!accessToken || !playback) return;
    setLoading(true);
    try {
      const nextState =
        playback.repeat_state === "off"
          ? "context"
          : playback.repeat_state === "context"
            ? "track"
            : "off";
      await setRepeatMode(accessToken, nextState);
      setTimeout(loadPlayback, 300);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="fixed bottom-2 left-2 right-2 md:bottom-4 md:left-auto md:right-4 md:max-w-xs bg-amber-400/20 border border-amber-400/40 rounded-xl p-3 z-50 backdrop-blur-md">
        <p className="text-amber-100 text-xs">{error}</p>
      </div>
    );
  }

  if (!playback || !playback.item) {
    return (
      <div className="fixed bottom-2 left-2 right-2 md:bottom-4 md:left-auto md:right-4 md:max-w-xs bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md z-50">
        <p className="text-[#9fb2c8] text-xs text-center md:text-left">
          Sin reproducción activa
        </p>
      </div>
    );
  }

  const track = playback.item;
  const progress = playback.progress_ms || 0;
  const duration = track.duration_ms || 0;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <>
      {/* Mobile: Bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[rgba(10,18,30,0.98)] border-t border-white/20 backdrop-blur-xl z-50">
        {/* Progress bar at top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#8fe1b0] to-[#2cd37d] transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-3 py-2">
          {!isMinimized && (
            <>
              {/* Track info */}
              <div className="flex gap-2 items-center mb-2">
                <div className="w-10 h-10 rounded-md overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                  {track.album.images?.[0]?.url ? (
                    <img
                      src={track.album.images[0].url}
                      alt={track.album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-[#9fb2c8]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs leading-tight truncate text-[#e8f2ff]">
                    {track.name}
                  </p>
                  <p className="text-[10px] text-[#9fb2c8] truncate">
                    {track.artists.map((a) => a.name).join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 text-[#9fb2c8] hover:text-[#8fe1b0] transition"
                >
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Time */}
              <div className="flex justify-between text-[9px] text-[#9fb2c8] mb-2 px-1">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-1.5">
            {/* Shuffle */}
            <button
              onClick={handleShuffle}
              disabled={loading}
              className={`p-1.5 md:p-2 rounded-lg transition ${
                playback.shuffle_state
                  ? "bg-[#8fe1b0]/20 text-[#8fe1b0]"
                  : "bg-white/5 text-[#9fb2c8]"
              } disabled:opacity-50`}
              title="Shuffle"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.42z"
                />
                <path d="M3 18h3.5L15 6h3M3 6h3.5L9 9" />
              </svg>
            </button>

            {/* Previous */}
            <button
              onClick={handlePrevious}
              disabled={loading}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 text-[#e8f2ff] active:scale-95 transition disabled:opacity-50"
              title="Anterior"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              disabled={loading}
              className="p-2.5 md:p-3 rounded-full bg-gradient-to-br from-[#2cd37d] to-[#18b663] text-white active:scale-95 transition shadow-[0_5px_20px_rgba(24,182,99,0.4)] disabled:opacity-50"
              title={playback.is_playing ? "Pausar" : "Reproducir"}
            >
              {playback.is_playing ? (
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next */}
            <button
              onClick={handleNext}
              disabled={loading}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 text-[#e8f2ff] active:scale-95 transition disabled:opacity-50"
              title="Siguiente"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            {/* Repeat */}
            <button
              onClick={handleRepeat}
              disabled={loading}
              className={`p-1.5 md:p-2 rounded-lg transition ${
                playback.repeat_state !== "off"
                  ? "bg-[#8fe1b0]/20 text-[#8fe1b0]"
                  : "bg-white/5 text-[#9fb2c8]"
              } disabled:opacity-50`}
              title={
                playback.repeat_state === "off"
                  ? "Repeat: Off"
                  : playback.repeat_state === "context"
                    ? "Repeat: Context"
                    : "Repeat: Track"
              }
            >
              {playback.repeat_state === "track" ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2V9a2 2 0 00-2-2h-2m-8 8H5a2 2 0 01-2-2V9a2 2 0 012-2h2m5-4v12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Bottom right card */}
      <div className="hidden md:block fixed bottom-4 right-4 bg-[rgba(10,18,30,0.95)] border border-white/20 rounded-2xl p-4 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] w-80 z-50">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <p className="uppercase text-[#8fe1b0] text-[10px] tracking-widest m-0">
            Reproduciendo ahora
          </p>
          <button
            onClick={loadPlayback}
            className="text-[#9fb2c8] hover:text-[#8fe1b0] transition p-1"
            title="Actualizar"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
            {track.album.images?.[0]?.url ? (
              <img
                src={track.album.images[0].url}
                alt={track.album.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#9fb2c8]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight mb-1 truncate text-[#e8f2ff]">
              {track.name}
            </p>
            <p className="text-xs text-[#9fb2c8] truncate">
              {track.artists.map((a) => a.name).join(", ")}
            </p>
            <p className="text-[10px] text-[#9fb2c8]/60 truncate mt-1">
              {track.album.name}
            </p>
          </div>
        </div>

        <div className="mb-3">
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8fe1b0] to-[#2cd37d] transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#9fb2c8] mt-1">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Previous */}
          <button
            onClick={handlePrevious}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 text-[#e8f2ff] hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
            title="Anterior"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            disabled={loading}
            className="p-3 rounded-full bg-gradient-to-br from-[#2cd37d] to-[#18b663] text-white hover:scale-105 active:scale-95 transition shadow-[0_5px_20px_rgba(24,182,99,0.4)] disabled:opacity-50"
            title={playback.is_playing ? "Pausar" : "Reproducir"}
          >
            {playback.is_playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={handleNext}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 text-[#e8f2ff] hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
            title="Siguiente"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
