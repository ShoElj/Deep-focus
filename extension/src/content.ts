import {
  classifyPageContext,
  createClassifiedState,
  createErrorState,
  getClassificationSettingsSignature,
  saveClassificationState
} from "./content/backend-client";
import { isBypassActive } from "./content/bypass";
import { removeBlockOverlay, showBlockOverlay } from "./content/block-overlay";
import { readPageContext } from "./content/dom-reader";

const EXTRACTION_DELAYS_MS = [0, 1500, 3000];
const SUPPRESS_OVERLAY_EVENT = "deep-focus:suppress-overlay";
const BYPASS_SAVED_EVENT = "deep-focus:bypass-saved";
const FOCUS_MODE_KEY = "focusModeEnabled";
const TODAY_STATS_KEY = "todayStats";
const ALLOWED_CATEGORIES_KEY = "allowedCategories";
const BLOCKED_CATEGORIES_KEY = "blockedCategories";
const CATEGORIES_UPDATED_AT_KEY = "categoriesUpdatedAt";
let lastLoggedContext = "";
let lastClassifiedContext = "";
let lastObservedUrl = location.href;
let suppressOverlayUntil = 0;

async function processPageContextIfChanged(): Promise<void> {
  const focusModeEnabled = await getFocusModeEnabled();

  if (!focusModeEnabled) {
    removeBlockOverlay();
    console.info("[Deep-Focus] Focus Mode is OFF. Skipping classification.");
    return;
  }

  const context = readPageContext();
  const serializedContext = JSON.stringify(context);

  if (serializedContext === lastLoggedContext) {
    return;
  }

  lastLoggedContext = serializedContext;
  console.info("[Deep-Focus] Page context:", context);

  const classificationSettingsSignature =
    await getClassificationSettingsSignature();
  const classificationCacheKey = JSON.stringify({
    context,
    classificationSettingsSignature
  });

  if (classificationCacheKey === lastClassifiedContext) {
    return;
  }

  lastClassifiedContext = classificationCacheKey;

  try {
    const classification = await classifyPageContext(context);
    console.info("[Deep-Focus] Backend classification:", classification);
    saveClassificationState(createClassifiedState(context, classification));

    if (classification.decision === "block" && Date.now() >= suppressOverlayUntil) {
      const bypassActive = await isBypassActive(context.url);

      if (bypassActive) {
        console.info("[Deep-Focus] Active bypass found for this URL.");
        removeBlockOverlay();
        return;
      }

      await incrementTodayStat("blocked");
      showBlockOverlay(context, classification);
    } else {
      if (classification.decision === "allow") {
        await incrementTodayStat("allowed");
      }

      removeBlockOverlay();
    }
  } catch (error) {
    console.warn("[Deep-Focus] Backend classification failed:", error);
    saveClassificationState(createErrorState(context, error));
    removeBlockOverlay();
  }
}

function schedulePageContextChecks(): void {
  for (const delay of EXTRACTION_DELAYS_MS) {
    window.setTimeout(() => {
      void processPageContextIfChanged();
    }, delay);
  }
}

function handlePossibleNavigation(): void {
  if (location.href === lastObservedUrl) {
    return;
  }

  lastObservedUrl = location.href;
  lastLoggedContext = "";
  lastClassifiedContext = "";
  removeBlockOverlay();
  schedulePageContextChecks();
}

function watchHistoryNavigation(): void {
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    window.setTimeout(handlePossibleNavigation, 0);
    return result;
  };

  window.history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    window.setTimeout(handlePossibleNavigation, 0);
    return result;
  };

  window.addEventListener("popstate", handlePossibleNavigation);
  window.addEventListener("yt-navigate-finish", handlePossibleNavigation);
  window.addEventListener(SUPPRESS_OVERLAY_EVENT, (event) => {
    const durationMs =
      event instanceof CustomEvent && typeof event.detail?.durationMs === "number"
        ? event.detail.durationMs
        : 2500;

    suppressOverlayUntil = Date.now() + durationMs;
  });
  window.addEventListener(BYPASS_SAVED_EVENT, () => {
    lastClassifiedContext = "";
    removeBlockOverlay();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const categoriesChanged = Boolean(
      changes[ALLOWED_CATEGORIES_KEY] ||
        changes[BLOCKED_CATEGORIES_KEY] ||
        changes[CATEGORIES_UPDATED_AT_KEY]
    );

    if (categoriesChanged) {
      lastLoggedContext = "";
      lastClassifiedContext = "";
      removeBlockOverlay();
      console.info("[Deep-Focus] Categories updated. Rechecking page.");
      schedulePageContextChecks();
    }

    if (!changes[FOCUS_MODE_KEY]) {
      return;
    }

    const enabled = changes[FOCUS_MODE_KEY].newValue ?? true;

    lastLoggedContext = "";
    lastClassifiedContext = "";

    if (!enabled) {
      removeBlockOverlay();
      console.info("[Deep-Focus] Focus Mode turned OFF.");
      return;
    }

    console.info("[Deep-Focus] Focus Mode turned ON.");
    schedulePageContextChecks();
  });
}

async function getFocusModeEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(FOCUS_MODE_KEY);

  return result[FOCUS_MODE_KEY] ?? true;
}

async function incrementTodayStat(key: "allowed" | "blocked"): Promise<void> {
  const result = await chrome.storage.local.get(TODAY_STATS_KEY);
  const today = getTodayKey();
  const stats = result[TODAY_STATS_KEY]?.date === today
    ? result[TODAY_STATS_KEY]
    : { date: today, allowed: 0, blocked: 0, bypassesUsed: 0 };

  await chrome.storage.local.set({
    [TODAY_STATS_KEY]: {
      ...stats,
      [key]: stats[key] + 1
    }
  });
}

function getTodayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

console.info("[Deep-Focus] Content script loaded.");

watchHistoryNavigation();
schedulePageContextChecks();
