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
