export type TodayStatKey = "allowed" | "blocked" | "bypassesUsed";

export interface TodayStats {
  date: string;
  allowed: number;
  blocked: number;
  bypassesUsed: number;
}

export interface BypassHistoryEntry {
  url: string;
  title: string;
  reason: string;
  detectedCategory: string;
  createdAt: string;
  expiresAt: string;
}

export const STORAGE_KEYS = {
  activeBypasses: "activeBypasses",
  allowedCategories: "allowedCategories",
  blockedCategories: "blockedCategories",
  categoriesUpdatedAt: "categoriesUpdatedAt",
  bypassDurationMinutes: "bypassDurationMinutes",
  bypassHistory: "bypassHistory",
  focusModeEnabled: "focusModeEnabled",
  latestClassification: "latestClassification",
  todayStats: "todayStats"
} as const;

export const BACKEND_DOCS_URL = "http://127.0.0.1:8000/docs";
export const UPGRADE_URL = "https://example.com/upgrade";
export const DEFAULT_BYPASS_DURATION_MINUTES = 10;

export const DEFAULT_ALLOWED_CATEGORIES = [
  "coding",
  "python",
  "javascript",
  "react",
  "programming",
  "web development",
  "software development",
  "AI learning",
  "machine learning",
  "SEO",
  "product strategy",
  "academic study"
];

export const DEFAULT_BLOCKED_CATEGORIES = [
  "gaming",
  "supercars",
  "cars",
  "racing",
  "nascar",
  "celebrity drama",
  "entertainment",
  "football highlights",
  "gossip",
  "memes",
  "random videos",
  "movie clips",
  "comedy skits",
  "prank",
  "reaction",
  "vlog",
  "challenge"
];

export async function getFocusModeEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.focusModeEnabled);

  return result[STORAGE_KEYS.focusModeEnabled] ?? true;
}

export async function setFocusModeEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.focusModeEnabled]: enabled });
}

export async function getTodayStats(): Promise<TodayStats> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.todayStats);
  const stats = result[STORAGE_KEYS.todayStats] as TodayStats | undefined;
  const today = getTodayKey();

  if (!stats || stats.date !== today) {
    return createEmptyTodayStats();
  }

  return stats;
}

export async function incrementTodayStat(key: TodayStatKey): Promise<TodayStats> {
  const stats = await getTodayStats();
  const updatedStats = {
    ...stats,
    [key]: stats[key] + 1
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.todayStats]: updatedStats });
  return updatedStats;
}

export async function resetTodayStats(): Promise<TodayStats> {
  const stats = createEmptyTodayStats();

  await chrome.storage.local.set({ [STORAGE_KEYS.todayStats]: stats });
  return stats;
}

export async function getAllowedCategories(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.allowedCategories);

  return normalizeCategories(
    result[STORAGE_KEYS.allowedCategories],
    DEFAULT_ALLOWED_CATEGORIES
  );
}

export async function setAllowedCategories(categories: string[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.allowedCategories]: normalizeCategories(categories, []),
    [STORAGE_KEYS.categoriesUpdatedAt]: new Date().toISOString()
  });
}

export async function resetAllowedCategories(): Promise<string[]> {
  await setAllowedCategories(DEFAULT_ALLOWED_CATEGORIES);
  return DEFAULT_ALLOWED_CATEGORIES;
}

export async function getBlockedCategories(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.blockedCategories);

  return normalizeCategories(
    result[STORAGE_KEYS.blockedCategories],
    DEFAULT_BLOCKED_CATEGORIES
  );
}

export async function setBlockedCategories(categories: string[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.blockedCategories]: normalizeCategories(categories, []),
    [STORAGE_KEYS.categoriesUpdatedAt]: new Date().toISOString()
  });
}

export async function resetBlockedCategories(): Promise<string[]> {
  await setBlockedCategories(DEFAULT_BLOCKED_CATEGORIES);
  return DEFAULT_BLOCKED_CATEGORIES;
}

export async function getBypassDurationMinutes(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.bypassDurationMinutes);
  const value = Number(result[STORAGE_KEYS.bypassDurationMinutes]);

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_BYPASS_DURATION_MINUTES;
}

export async function setBypassDurationMinutes(minutes: number): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.bypassDurationMinutes]: Math.max(1, Math.round(minutes))
  });
}

export async function getBypassHistory(): Promise<BypassHistoryEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.bypassHistory);

  return result[STORAGE_KEYS.bypassHistory] ?? [];
}

export async function clearBypassHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.bypassHistory]: [] });
}

function normalizeCategories(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const categories = value
    .map((category) => String(category).trim())
    .filter(Boolean);

  return Array.from(new Set(categories));
}

function createEmptyTodayStats(): TodayStats {
  return {
    date: getTodayKey(),
    allowed: 0,
    blocked: 0,
    bypassesUsed: 0
  };
}

function getTodayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
