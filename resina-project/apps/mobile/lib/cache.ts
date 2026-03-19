import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
};

type CacheReadResult<T> = {
  value: T;
  updatedAt: number;
  isExpired: boolean;
};

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const payload: CacheEnvelope<T> = {
    value,
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(key, JSON.stringify(payload));
}

export async function readCache<T>(key: string, maxAgeMs?: number): Promise<CacheReadResult<T> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || !("updatedAt" in parsed) || !("value" in parsed)) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const updatedAt = Number(parsed.updatedAt);
    if (!Number.isFinite(updatedAt)) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const isExpired = typeof maxAgeMs === "number" && maxAgeMs > 0 ? Date.now() - updatedAt > maxAgeMs : false;

    return {
      value: parsed.value,
      updatedAt,
      isExpired,
    };
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function clearExpiredCaches(entries: Array<{ key: string; maxAgeMs: number }>): Promise<void> {
  await Promise.all(
    entries.map(async (entry) => {
      const cached = await readCache<unknown>(entry.key, entry.maxAgeMs);
      if (cached?.isExpired) {
        await AsyncStorage.removeItem(entry.key);
      }
    }),
  );
}
