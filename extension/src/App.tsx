import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { ClassificationState } from "./content/backend-client";
import {
  BACKEND_DOCS_URL,
  STORAGE_KEYS,
  UPGRADE_URL,
  getFocusModeEnabled,
  getTodayStats,
  resetTodayStats,
  setFocusModeEnabled,
  type TodayStats
} from "./shared/storage";

export function App() {
  const [focusModeEnabled, setFocusModeEnabledState] = useState(true);
  const [classificationState, setClassificationState] =
    useState<ClassificationState | null>(null);
  const [todayStats, setTodayStatsState] = useState<TodayStats>({
    date: "",
    allowed: 0,
    blocked: 0,
    bypassesUsed: 0
  });

  useEffect(() => {
    void hydratePopupState();

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") {
        return;
      }

      if (changes[STORAGE_KEYS.latestClassification]) {
        setClassificationState(
          changes[STORAGE_KEYS.latestClassification].newValue ?? null
        );
      }

      if (changes[STORAGE_KEYS.focusModeEnabled]) {
        setFocusModeEnabledState(
          changes[STORAGE_KEYS.focusModeEnabled].newValue ?? true
        );
      }

      if (changes[STORAGE_KEYS.todayStats]) {
        setTodayStatsState(changes[STORAGE_KEYS.todayStats].newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  async function hydratePopupState(): Promise<void> {
    const [enabled, stats, classificationResult] = await Promise.all([
      getFocusModeEnabled(),
      getTodayStats(),
      chrome.storage.local.get(STORAGE_KEYS.latestClassification)
    ]);

    setFocusModeEnabledState(enabled);
    setTodayStatsState(stats);
    setClassificationState(
      classificationResult[STORAGE_KEYS.latestClassification] ?? null
    );
  }

  async function handleFocusModeToggle(): Promise<void> {
    const nextValue = !focusModeEnabled;

    setFocusModeEnabledState(nextValue);
    await setFocusModeEnabled(nextValue);
  }

  async function handleResetTodayStats(): Promise<void> {
    setTodayStatsState(await resetTodayStats());
  }

  const status = getCurrentStatus(classificationState, focusModeEnabled);

  return (
    <main className="w-96 bg-neutral-950 p-4 text-neutral-100">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 shadow-lg shadow-black/20">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">Deep-Focus</h1>
            <p className="mt-1 text-xs text-neutral-400">Control center</p>
          </div>
          <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
            MV3
          </span>
        </header>

        <div className="mt-4 space-y-3">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-200">Focus Mode</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {focusModeEnabled ? "Blocking is active" : "Blocking is paused"}
                </p>
              </div>
              <button
                className={
                  focusModeEnabled
                    ? "min-w-16 rounded-md border border-blue-500 bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                    : "min-w-16 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-semibold text-neutral-300"
                }
                type="button"
                onClick={() => void handleFocusModeToggle()}
              >
                {focusModeEnabled ? "ON" : "OFF"}
              </button>
            </div>
          </Panel>

          <Panel>
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Current Page Status
            </p>
            <p className={`mt-2 text-sm font-semibold ${status.className}`}>
              {status.label}
            </p>
            {classificationState?.response?.reason && focusModeEnabled ? (
              <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                {classificationState.response.reason}
              </p>
            ) : null}
          </Panel>

          <Panel>
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Today's Stats
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Allowed" value={todayStats.allowed} tone="green" />
              <Stat label="Blocked" value={todayStats.blocked} tone="red" />
              <Stat label="Bypasses" value={todayStats.bypassesUsed} tone="blue" />
            </div>
          </Panel>

          <Panel>
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Quick Actions
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <ActionButton onClick={() => openUrl(chrome.runtime.getURL("dashboard.html"))}>
                Open Dashboard
              </ActionButton>
              <ActionButton onClick={() => openUrl(BACKEND_DOCS_URL)}>
                Open Backend Docs
              </ActionButton>
              <ActionButton onClick={() => openUrl(UPGRADE_URL)}>
                Open Upgrade Link
              </ActionButton>
              <button
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-semibold text-neutral-300"
                type="button"
                onClick={() => void handleResetTodayStats()}
              >
                Reset Today's Stats
              </button>
            </div>
          </Panel>

          <Panel>
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Bypass Info
            </p>
            <div className="mt-2 space-y-1 text-sm text-neutral-300">
              <p>Free bypass: 50 words</p>
              <p>Pro teaser: 15 focused words</p>
            </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-3">
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "red";
}) {
  const toneClass = {
    blue: "text-blue-300",
    green: "text-emerald-300",
    red: "text-red-300"
  }[tone];

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-2 text-center">
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{label}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-md border border-blue-500/70 bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getCurrentStatus(
  state: ClassificationState | null,
  focusModeEnabled: boolean
): { label: string; className: string } {
  if (!focusModeEnabled) {
    return { label: "Focus Mode OFF", className: "text-neutral-400" };
  }

  if (!state) {
    return { label: "Not analyzing yet", className: "text-neutral-300" };
  }

  if (state.status === "error") {
    return { label: "Backend offline", className: "text-red-300" };
  }

  if (!state.response) {
    return { label: "Not analyzing yet", className: "text-neutral-300" };
  }

  if (state.response.topLabel === "navigation") {
    return { label: "Navigation page allowed", className: "text-emerald-300" };
  }

  if (state.response.decision === "allow") {
    return {
      label: `ALLOW - ${state.response.topLabel}`,
      className: "text-emerald-300"
    };
  }

  return {
    label: `BLOCK - ${state.response.topLabel}`,
    className: "text-red-300"
  };
}

function openUrl(url: string): void {
  chrome.tabs.create({ url });
}
