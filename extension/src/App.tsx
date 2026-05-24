export function App() {
  const focusModeEnabled = false;

  return (
    <main className="w-80 bg-neutral-950 p-4 text-neutral-100">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 shadow-lg shadow-black/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">Deep-Focus</h1>
            <p className="mt-1 text-xs text-neutral-400">Extension foundation</p>
          </div>
          <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
            MV3
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
            <span className="text-sm text-neutral-300">Focus Mode</span>
            <span
              className={
                focusModeEnabled
                  ? "text-sm font-semibold text-blue-300"
                  : "text-sm font-semibold text-neutral-500"
              }
            >
              {focusModeEnabled ? "ON" : "OFF"}
            </span>
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Current Status
            </p>
            <p className="mt-1 text-sm text-neutral-200">Not analyzing yet</p>
          </div>
        </div>
      </section>
    </main>
  );
}
