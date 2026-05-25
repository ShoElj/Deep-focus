import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  DEFAULT_ALLOWED_CATEGORIES,
  DEFAULT_BLOCKED_CATEGORIES,
  DEFAULT_BYPASS_DURATION_MINUTES,
  UPGRADE_URL,
  clearBypassHistory,
  getAllowedCategories,
  getBlockedCategories,
  getBypassDurationMinutes,
  getBypassHistory,
  getFocusModeEnabled,
  getTodayStats,
  resetAllowedCategories,
  resetBlockedCategories,
  setAllowedCategories,
  setBlockedCategories,
  setBypassDurationMinutes,
  type BypassHistoryEntry,
  type TodayStats
} from "../shared/storage";

export function Dashboard() {
  const [focusModeEnabled, setFocusModeEnabled] = useState(true);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    date: "",
    allowed: 0,
    blocked: 0,
    bypassesUsed: 0
  });
  const [allowedCategories, setAllowedCategoriesState] = useState<string[]>([]);
  const [blockedCategories, setBlockedCategoriesState] = useState<string[]>([]);
  const [allowedInput, setAllowedInput] = useState("");
  const [blockedInput, setBlockedInput] = useState("");
  const [bypassDuration, setBypassDuration] = useState(
    DEFAULT_BYPASS_DURATION_MINUTES
  );
  const [bypassHistory, setBypassHistory] = useState<BypassHistoryEntry[]>([]);

  useEffect(() => {
    void hydrateDashboard();
  }, []);

  async function hydrateDashboard(): Promise<void> {
    const [
      enabled,
      stats,
      allowed,
      blocked,
      duration,
      history
    ] = await Promise.all([
      getFocusModeEnabled(),
      getTodayStats(),
      getAllowedCategories(),
      getBlockedCategories(),
      getBypassDurationMinutes(),
      getBypassHistory()
    ]);

    setFocusModeEnabled(enabled);
    setTodayStats(stats);
    setAllowedCategoriesState(allowed);
    setBlockedCategoriesState(blocked);
    setBypassDuration(duration);
    setBypassHistory(history);
  }

  async function addAllowedCategory(): Promise<void> {
    const category = allowedInput.trim();

    if (!category || allowedCategories.includes(category)) {
      setAllowedInput("");
      return;
    }

    const nextCategories = [...allowedCategories, category];
    await setAllowedCategories(nextCategories);
    setAllowedCategoriesState(nextCategories);
    setAllowedInput("");
  }

  async function addBlockedCategory(): Promise<void> {
    const category = blockedInput.trim();

    if (!category || blockedCategories.includes(category)) {
      setBlockedInput("");
      return;
    }

    const nextCategories = [...blockedCategories, category];
    await setBlockedCategories(nextCategories);
    setBlockedCategoriesState(nextCategories);
    setBlockedInput("");
  }

  async function removeAllowedCategory(category: string): Promise<void> {
    const nextCategories = allowedCategories.filter((item) => item !== category);
    await setAllowedCategories(nextCategories);
    setAllowedCategoriesState(nextCategories);
  }

  async function removeBlockedCategory(category: string): Promise<void> {
    const nextCategories = blockedCategories.filter((item) => item !== category);
    await setBlockedCategories(nextCategories);
    setBlockedCategoriesState(nextCategories);
  }

  async function handleResetAllowedCategories(): Promise<void> {
    setAllowedCategoriesState(await resetAllowedCategories());
  }

  async function handleResetBlockedCategories(): Promise<void> {
    setBlockedCategoriesState(await resetBlockedCategories());
  }

  async function handleBypassDurationChange(value: string): Promise<void> {
    const minutes = Math.max(1, Number(value) || DEFAULT_BYPASS_DURATION_MINUTES);

    setBypassDuration(minutes);
    await setBypassDurationMinutes(minutes);
  }

  async function handleClearBypassHistory(): Promise<void> {
    await clearBypassHistory();
    setBypassHistory([]);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <h1 className="text-2xl font-semibold">Deep-Focus Dashboard</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Local settings for focus categories, bypass rules, and usage history.
            </p>
          </div>
          <Badge tone={focusModeEnabled ? "green" : "neutral"}>
            Focus Mode {focusModeEnabled ? "ON" : "OFF"}
          </Badge>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Section title="Overview">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Allowed Today" value={todayStats.allowed} tone="green" />
              <Metric label="Blocked Today" value={todayStats.blocked} tone="red" />
              <Metric label="Bypasses Today" value={todayStats.bypassesUsed} tone="blue" />
              <Metric label="Bypass Rule" value={`${bypassDuration} min`} tone="neutral" />
            </div>
            <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-3">
              <p className="text-sm text-neutral-300">
                Free bypass requires 50 words and 15 unique words. Pro teaser:
                15 focused words.
              </p>
            </div>
          </Section>

          <Section title="Upgrade / Pro">
            <div className="space-y-2 text-sm text-neutral-300">
              <p>Free: 50-word bypass</p>
              <p>Pro: 15-word bypass, advanced schedules, better analytics</p>
            </div>
            <button
              className="mt-4 rounded-md border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => chrome.tabs.create({ url: UPGRADE_URL })}
            >
              Upgrade
            </button>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <CategoryEditor
            title="Allowed Categories"
            categories={allowedCategories}
            defaults={DEFAULT_ALLOWED_CATEGORIES}
            inputValue={allowedInput}
            onInputChange={setAllowedInput}
            onAdd={() => void addAllowedCategory()}
            onRemove={(category) => void removeAllowedCategory(category)}
            onReset={() => void handleResetAllowedCategories()}
            tone="green"
          />

          <CategoryEditor
            title="Blocked Categories"
            categories={blockedCategories}
            defaults={DEFAULT_BLOCKED_CATEGORIES}
            inputValue={blockedInput}
            onInputChange={setBlockedInput}
            onAdd={() => void addBlockedCategory()}
            onRemove={(category) => void removeBlockedCategory(category)}
            onReset={() => void handleResetBlockedCategories()}
            tone="red"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
          <Section title="Bypass Rules">
            <div className="space-y-2 text-sm text-neutral-300">
              <p>Free plan requires 50 words.</p>
              <p>At least 15 unique words.</p>
              <p>Pro teaser: 15 focused words.</p>
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase text-neutral-500">
              Bypass duration in minutes
            </label>
            <input
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-blue-500"
              min={1}
              type="number"
              value={bypassDuration}
              onChange={(event) => void handleBypassDurationChange(event.target.value)}
            />
          </Section>

          <Section
            title="Bypass History"
            action={
              <button
                className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300"
                type="button"
                onClick={() => void handleClearBypassHistory()}
              >
                Clear Bypass History
              </button>
            }
          >
            {bypassHistory.length === 0 ? (
              <p className="text-sm text-neutral-500">No bypass history yet.</p>
            ) : (
              <div className="max-h-[460px] space-y-3 overflow-auto pr-1">
                {bypassHistory.map((entry) => (
                  <article
                    className="rounded-md border border-neutral-800 bg-neutral-950 p-3"
                    key={`${entry.url}-${entry.createdAt}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="max-w-xl text-sm font-semibold text-neutral-100">
                        {entry.title || "Untitled page"}
                      </h3>
                      <Badge tone="red">{entry.detectedCategory}</Badge>
                    </div>
                    <a
                      className="mt-1 block break-all text-xs text-blue-300"
                      href={entry.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {entry.url}
                    </a>
                    <p className="mt-2 text-sm text-neutral-300">{entry.reason}</p>
                    <dl className="mt-3 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDate(entry.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{formatDate(entry.expiresAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone: "blue" | "green" | "neutral" | "red";
}) {
  const toneClass = {
    blue: "text-blue-300",
    green: "text-emerald-300",
    neutral: "text-neutral-200",
    red: "text-red-300"
  }[tone];

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3">
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function CategoryEditor({
  title,
  categories,
  defaults,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  onReset,
  tone
}: {
  title: string;
  categories: string[];
  defaults: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (category: string) => void;
  onReset: () => void;
  tone: "green" | "red";
}) {
  return (
    <Section
      title={title}
      action={
        <button
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-semibold text-neutral-300"
          type="button"
          onClick={onReset}
        >
          Reset
        </button>
      }
    >
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-blue-500"
          placeholder="Add category"
          type="text"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAdd();
            }
          }}
        />
        <button
          className="rounded-md border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          type="button"
          onClick={onAdd}
        >
          Add
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            className={`rounded-full border px-3 py-1 text-sm ${
              tone === "green"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
            key={category}
            type="button"
            onClick={() => onRemove(category)}
            title="Remove category"
          >
            {category} x
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Defaults: {defaults.join(", ")}
      </p>
    </Section>
  );
}

function Badge({
  children,
  tone
}: {
  children: ReactNode;
  tone: "green" | "neutral" | "red";
}) {
  const toneClass = {
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    neutral: "border-neutral-700 bg-neutral-900 text-neutral-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300"
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

