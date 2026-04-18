export const CACHE_KEYS = {
  sensor: "resina:cache:sensor-snapshot",
  weather: "resina:cache:weather-snapshot",
  announcements: "resina:cache:announcements",
  history: "resina:cache:history-records",
  tide: "resina:cache:tide-status",
  tideHourly: "resina:cache:tide-hourly",
  tideExtremes: "resina:cache:tide-extremes",
  profile: (userId: string) => `resina:cache:profile:${userId}`,
};

export const CACHE_TTL_MS = {
  sensor: 5 * 60 * 1000,
  weather: 5 * 60 * 1000,
  announcements: 30 * 60 * 1000,
  history: 60 * 60 * 1000,
  tide: 60 * 60 * 1000,
  tideHourly: 60 * 60 * 1000,
  tideExtremes: 60 * 60 * 1000,
  profile: 24 * 60 * 60 * 1000,
};
