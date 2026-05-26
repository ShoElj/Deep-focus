import type { PageContext } from "./dom-reader";

export interface ClassificationResponse {
  decision: "allow" | "block";
  topLabel: string;
  score: number;
  reason: string;
}

export interface ClassificationState {
  status: "idle" | "classified" | "error";
  pageTitle: string;
  pageUrl: string;
  response?: ClassificationResponse;
  error?: string;
  updatedAt: string;
}

const CLASSIFY_ENDPOINT = "http://127.0.0.1:8000/classify";
const ALLOWED_CATEGORIES_KEY = "allowedCategories";
const BLOCKED_CATEGORIES_KEY = "blockedCategories";

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

export async function classifyPageContext(
  context: PageContext
): Promise<ClassificationResponse> {
  const { allowedCategories, blockedCategories } = await getStoredCategories();
  const response = await fetch(CLASSIFY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: context.url,
      title: context.title,
      metaDescription: context.metaDescription,
      headings: context.headings,
      textSample: context.textSample,
      youtubeTitle: context.youtubeTitle ?? context.youtubeVideoTitle ?? "",
      channelName: context.youtubeChannelName ?? "",
      source: context.source,
      allowedCategories,
      blockedCategories
    })
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}

async function getStoredCategories(): Promise<{
  allowedCategories: string[];
  blockedCategories: string[];
}> {
  const result = await chrome.storage.local.get([
    ALLOWED_CATEGORIES_KEY,
    BLOCKED_CATEGORIES_KEY
  ]);

  return {
    allowedCategories: normalizeCategories(
      result[ALLOWED_CATEGORIES_KEY],
      DEFAULT_ALLOWED_CATEGORIES
    ),
    blockedCategories: normalizeCategories(
      result[BLOCKED_CATEGORIES_KEY],
      DEFAULT_BLOCKED_CATEGORIES
    )
  };
}

function normalizeCategories(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const categories = value
    .map((category) => String(category).trim())
    .filter(Boolean);

  return categories.length > 0 ? Array.from(new Set(categories)) : fallback;
}

export function saveClassificationState(state: ClassificationState): void {
  chrome.storage.local.set({ latestClassification: state });
}

export function createClassifiedState(
  context: PageContext,
  response: ClassificationResponse
): ClassificationState {
  return {
    status: "classified",
    pageTitle: context.title,
    pageUrl: context.url,
    response,
    updatedAt: new Date().toISOString()
  };
}

export function createErrorState(
  context: PageContext,
  error: unknown
): ClassificationState {
  return {
    status: "error",
    pageTitle: context.title,
    pageUrl: context.url,
    error: error instanceof Error ? error.message : "Backend request failed",
    updatedAt: new Date().toISOString()
  };
}
