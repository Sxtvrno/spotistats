export type SpotifyImage = { url: string; width?: number; height?: number };

export type SpotifyUser = {
  id: string;
  display_name: string;
  email?: string;
  country?: string;
  product?: string;
  followers?: { total: number };
  images?: SpotifyImage[];
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
  followers?: { total: number };
  images?: SpotifyImage[];
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images?: SpotifyImage[] };
  popularity?: number;
  duration_ms?: number;
};

export type RecentPlay = { played_at: string; track: SpotifyTrack };

export type StoredAuth = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export type GenreStat = { genre: string; count: number; artists: string[] };

export type SpotifyDevice = {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
};

export type PlaybackState = {
  device: SpotifyDevice;
  repeat_state: "off" | "track" | "context";
  shuffle_state: boolean;
  timestamp: number;
  progress_ms: number;
  is_playing: boolean;
  item: SpotifyTrack | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
};

export type AudioFeatures = {
  id: string;
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  valence: number;
  tempo: number;
  key: number;
  mode: number;
  time_signature: number;
  duration_ms: number;
};

export type TrackWithFeatures = SpotifyTrack & {
  features?: AudioFeatures;
};
