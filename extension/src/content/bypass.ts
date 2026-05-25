import type { ClassificationResponse } from "./backend-client";
import type { PageContext } from "./dom-reader";

export interface BypassEntry {
  url: string;
  title: string;
  reason: string;
  detectedCategory: string;
  createdAt: string;
  expiresAt: string;
}

export interface BypassValidationResult {
  valid: boolean;
  wordCount: number;
  uniqueWordCount: number;
  error: string;
}

const DEFAULT_BYPASS_DURATION_MINUTES = 10;
const MIN_WORD_COUNT = 50;
const MIN_UNIQUE_WORD_COUNT = 15;
const ACTIVE_BYPASSES_KEY = "activeBypasses";
const BYPASS_HISTORY_KEY = "bypassHistory";
const BYPASS_DURATION_MINUTES_KEY = "bypassDurationMinutes";
const TODAY_STATS_KEY = "todayStats";
export function validateBypassReason(reason: string): BypassValidationResult {
  const words = getWords(reason);
  const uniqueWords = new Set(words);

  if (words.length === 0) {
    return createValidationResult(words, uniqueWords, "Write a reason first.");
  }

  if (words.length < MIN_WORD_COUNT) {
    return createValidationResult(
      words,
      uniqueWords,
      `Use at least ${MIN_WORD_COUNT} words to explain why this helps your focus.`
    );
  }

  if (uniqueWords.size < MIN_UNIQUE_WORD_COUNT) {
    return createValidationResult(
      words,
      uniqueWords,
      `Use at least ${MIN_UNIQUE_WORD_COUNT} unique words. Repeated text is not accepted.`
    );
  }

  if (hasRepeatedNonsense(words)) {
    return createValidationResult(
      words,
      uniqueWords,
      "Repeated filler text is not accepted."
    );
  }

  return createValidationResult(words, uniqueWords, "");
}

export async function isBypassActive(url: string): Promise<boolean> {
  const activeBypasses = await getActiveBypasses();
  const entry = activeBypasses[url];

  if (!entry) {
    return false;
  }

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    delete activeBypasses[url];
    await chrome.storage.local.set({
      [ACTIVE_BYPASSES_KEY]: activeBypasses
    });
    return false;
  }

  return true;
}

export async function saveBypass(
  context: PageContext,
  classification: ClassificationResponse,
  reason: string
): Promise<BypassEntry> {
  const now = new Date();
  const bypassDurationMinutes = await getBypassDurationMinutes();
  const entry: BypassEntry = {
    url: context.url,
    title: context.youtubeTitle ?? context.youtubeVideoTitle ?? context.title,
    reason: reason.trim(),
    detectedCategory: classification.topLabel,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + bypassDurationMinutes * 60 * 1000).toISOString()
  };
  const activeBypasses = await getActiveBypasses();
  const history = await getBypassHistory();

  activeBypasses[entry.url] = entry;
  history.unshift(entry);

  await chrome.storage.local.set({
    [ACTIVE_BYPASSES_KEY]: activeBypasses,
    [BYPASS_HISTORY_KEY]: history.slice(0, 100)
  });
  await incrementBypassesUsed();

  return entry;
}

async function getBypassDurationMinutes(): Promise<number> {
  const result = await chrome.storage.local.get(BYPASS_DURATION_MINUTES_KEY);
  const value = Number(result[BYPASS_DURATION_MINUTES_KEY]);

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_BYPASS_DURATION_MINUTES;
}

function getWords(reason: string): string[] {
  return reason
    .toLowerCase()
    .match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) ?? [];
}

function hasRepeatedNonsense(words: string[]): boolean {
  if (words.length < MIN_WORD_COUNT) {
    return false;
  }

  const uniqueWords = new Set(words);
  const mostFrequentCount = Math.max(
    ...Array.from(uniqueWords).map((word) => words.filter((item) => item === word).length)
  );

  return mostFrequentCount / words.length > 0.35;
}

function createValidationResult(
  words: string[],
  uniqueWords: Set<string>,
  error: string
): BypassValidationResult {
  return {
    valid: !error,
    wordCount: words.length,
    uniqueWordCount: uniqueWords.size,
    error
  };
}

async function getActiveBypasses(): Promise<Record<string, BypassEntry>> {
  const result = await chrome.storage.local.get(ACTIVE_BYPASSES_KEY);

  return result[ACTIVE_BYPASSES_KEY] ?? {};
}

async function getBypassHistory(): Promise<BypassEntry[]> {
  const result = await chrome.storage.local.get(BYPASS_HISTORY_KEY);

  return result[BYPASS_HISTORY_KEY] ?? [];
}

async function incrementBypassesUsed(): Promise<void> {
  const result = await chrome.storage.local.get(TODAY_STATS_KEY);
  const today = getTodayKey();
  const stats = result[TODAY_STATS_KEY]?.date === today
    ? result[TODAY_STATS_KEY]
    : { date: today, allowed: 0, blocked: 0, bypassesUsed: 0 };

  await chrome.storage.local.set({
    [TODAY_STATS_KEY]: {
      ...stats,
      bypassesUsed: stats.bypassesUsed + 1
    }
  });
}

function getTodayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
