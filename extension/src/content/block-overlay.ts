import type { ClassificationResponse } from "./backend-client";
import { DEFAULT_ALLOWED_CATEGORIES } from "./backend-client";
import {
  saveBypass,
  validateBypassReason,
  type BypassValidationResult
} from "./bypass";
import type { PageContext } from "./dom-reader";

const OVERLAY_ID = "deep-focus-block-overlay";
const CLOSE_TAB_MESSAGE = "DEEP_FOCUS_CLOSE_TAB";
const SUPPRESS_OVERLAY_EVENT = "deep-focus:suppress-overlay";
const GO_BACK_FALLBACK_DELAY_MS = 900;
const BYPASS_SAVED_EVENT = "deep-focus:bypass-saved";
const UPGRADE_URL = "https://example.com/upgrade";

export function showBlockOverlay(
  context: PageContext,
  classification: ClassificationResponse
): void {
  const existingOverlay = document.getElementById(OVERLAY_ID);

  if (existingOverlay) {
    existingOverlay.replaceWith(createOverlay(context, classification));
    return;
  }

  document.documentElement.appendChild(createOverlay(context, classification));
}

export function removeBlockOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

function createOverlay(
  context: PageContext,
  classification: ClassificationResponse
): HTMLElement {
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="deep-focus-card">
      <div class="deep-focus-status">Blocked</div>
      <h1>Context Switch Detected</h1>
      <p class="deep-focus-lede">This page does not match your current focus.</p>

      <div class="deep-focus-detail">
        <span>Detected Category</span>
        <strong>${escapeHtml(classification.topLabel)}</strong>
      </div>

      <div class="deep-focus-reason">
        <span>Reason</span>
        <p>${escapeHtml(classification.reason)}</p>
      </div>

      <div class="deep-focus-focus">
        <span>Current Focus</span>
        <p>${DEFAULT_ALLOWED_CATEGORIES.map(escapeHtml).join(", ")}</p>
      </div>

      <div class="deep-focus-bypass">
        <label for="deep-focus-bypass-reason">Bypass with Intent</label>
        <textarea id="deep-focus-bypass-reason" placeholder="Write why this page is necessary for your current focus..."></textarea>
        <div class="deep-focus-bypass-meta">
          <span class="deep-focus-word-count">0 / 50 words</span>
          <span class="deep-focus-bypass-error" aria-live="polite"></span>
        </div>
        <div class="deep-focus-upgrade">
          <p>Need a shorter bypass? Pro users can unlock with 15 focused words.</p>
          <button type="button" data-deep-focus-action="upgrade">Upgrade for Shorter Bypass</button>
        </div>
      </div>

      <div class="deep-focus-actions">
        <button type="button" data-deep-focus-action="submit-reason">Submit Reason</button>
        <button type="button" data-deep-focus-action="back">Go Back</button>
        <button type="button" data-deep-focus-action="close">Close Tab</button>
      </div>
      <p class="deep-focus-message" aria-live="polite"></p>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = getOverlayStyles();
  overlay.prepend(style);

  overlay
    .querySelector<HTMLButtonElement>('[data-deep-focus-action="back"]')
    ?.addEventListener("click", () => goBackWithFallback());
  overlay
    .querySelector<HTMLButtonElement>('[data-deep-focus-action="close"]')
    ?.addEventListener("click", () => requestCloseTab(overlay));
  overlay
    .querySelector<HTMLButtonElement>('[data-deep-focus-action="upgrade"]')
    ?.addEventListener("click", () => window.open(UPGRADE_URL, "_blank", "noopener"));
  wireBypassControls(overlay, context, classification);

  return overlay;
}

function wireBypassControls(
  overlay: HTMLElement,
  context: PageContext,
  classification: ClassificationResponse
): void {
  const textarea = overlay.querySelector<HTMLTextAreaElement>(
    "#deep-focus-bypass-reason"
  );
  const submitButton = overlay.querySelector<HTMLButtonElement>(
    '[data-deep-focus-action="submit-reason"]'
  );
  const wordCount = overlay.querySelector<HTMLElement>(".deep-focus-word-count");
  const error = overlay.querySelector<HTMLElement>(".deep-focus-bypass-error");

  if (!textarea || !submitButton || !wordCount || !error) {
    return;
  }

  const updateValidationState = () => {
    const validation = validateBypassReason(textarea.value);
    wordCount.textContent = `${validation.wordCount} / 50 words`;
    error.textContent = validation.error;
    submitButton.disabled = !validation.valid;
  };

  textarea.addEventListener("input", updateValidationState);
  submitButton.addEventListener("click", () => {
    void submitBypassReason(overlay, textarea.value, context, classification);
  });
  updateValidationState();
}

async function submitBypassReason(
  overlay: HTMLElement,
  reason: string,
  context: PageContext,
  classification: ClassificationResponse
): Promise<void> {
  const error = overlay.querySelector<HTMLElement>(".deep-focus-bypass-error");
  const validation = validateBypassReason(reason);

  if (!validation.valid) {
    if (error) {
      error.textContent = validation.error;
    }
    return;
  }

  await saveBypass(context, classification, reason);
  window.dispatchEvent(new CustomEvent(BYPASS_SAVED_EVENT, { detail: { url: context.url } }));
  removeBlockOverlay();
}

function goBackWithFallback(): void {
  const blockedUrl = location.href;
  const fallbackUrl = getSafeFallbackUrl();

  window.dispatchEvent(
    new CustomEvent(SUPPRESS_OVERLAY_EVENT, { detail: { durationMs: 3000 } })
  );
  removeBlockOverlay();
  window.history.back();

  window.setTimeout(() => {
    if (location.href !== blockedUrl) {
      return;
    }

    if (fallbackUrl) {
      window.location.assign(fallbackUrl);
      return;
    }

    showManualCloseNotice();
  }, GO_BACK_FALLBACK_DELAY_MS);
}

function getSafeFallbackUrl(): string {
  const host = location.hostname.toLowerCase();

  if (host.includes("youtube.com")) {
    return "https://www.youtube.com";
  }

  if (host.includes("google.com")) {
    return "https://www.google.com";
  }

  return "";
}

function showManualCloseNotice(): void {
  const notice = document.createElement("div");
  notice.id = `${OVERLAY_ID}-notice`;
  notice.textContent = "Please close this tab manually.";
  notice.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    background: #18181b;
    color: #f4f4f5;
    padding: 10px 12px;
    font: 13px Inter, ui-sans-serif, system-ui, sans-serif;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
  `;

  document.getElementById(notice.id)?.remove();
  document.documentElement.appendChild(notice);
  window.setTimeout(() => notice.remove(), 3500);
}

function requestCloseTab(overlay: HTMLElement): void {
  const message = overlay.querySelector<HTMLElement>(".deep-focus-message");

  chrome.runtime.sendMessage({ type: CLOSE_TAB_MESSAGE }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      if (message) {
        message.textContent = "Close this tab manually.";
      }
    }
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function getOverlayStyles(): string {
  return `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      padding: 24px;
      background: rgba(10, 10, 10, 0.86);
      backdrop-filter: blur(8px);
      color: #f5f5f5;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #${OVERLAY_ID} * {
      box-sizing: border-box;
    }

    #${OVERLAY_ID} .deep-focus-card {
      width: min(560px, 100%);
      border: 1px solid #27272a;
      border-radius: 8px;
      background: #18181b;
      padding: 28px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }

    #${OVERLAY_ID} .deep-focus-status {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid rgba(248, 113, 113, 0.45);
      border-radius: 999px;
      padding: 3px 10px;
      background: rgba(127, 29, 29, 0.24);
      color: #fca5a5;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    #${OVERLAY_ID} h1 {
      margin: 18px 0 0;
      color: #fafafa;
      font-size: 26px;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 0;
    }

    #${OVERLAY_ID} .deep-focus-lede {
      margin: 8px 0 0;
      color: #d4d4d8;
      font-size: 15px;
      line-height: 1.5;
    }

    #${OVERLAY_ID} .deep-focus-detail,
    #${OVERLAY_ID} .deep-focus-reason,
    #${OVERLAY_ID} .deep-focus-focus,
    #${OVERLAY_ID} .deep-focus-bypass {
      margin-top: 18px;
      border: 1px solid #27272a;
      border-radius: 6px;
      background: #09090b;
      padding: 12px;
    }

    #${OVERLAY_ID} span {
      display: block;
      color: #a1a1aa;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    #${OVERLAY_ID} label {
      display: block;
      color: #a1a1aa;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    #${OVERLAY_ID} textarea {
      width: 100%;
      min-height: 110px;
      margin-top: 8px;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      background: #18181b;
      color: #f4f4f5;
      padding: 10px;
      resize: vertical;
      font: inherit;
      font-size: 14px;
      line-height: 1.45;
      outline: none;
    }

    #${OVERLAY_ID} textarea:focus {
      border-color: #2563eb;
    }

    #${OVERLAY_ID} .deep-focus-bypass-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 8px;
    }

    #${OVERLAY_ID} .deep-focus-bypass-error {
      color: #fca5a5;
      text-align: right;
      text-transform: none;
    }

    #${OVERLAY_ID} .deep-focus-upgrade {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
      border: 1px solid #27272a;
      border-radius: 6px;
      background: #18181b;
      padding: 10px;
    }

    #${OVERLAY_ID} .deep-focus-upgrade p {
      margin: 0;
      color: #a1a1aa;
      font-size: 13px;
      line-height: 1.4;
      font-weight: 500;
    }

    #${OVERLAY_ID} strong,
    #${OVERLAY_ID} p {
      margin: 6px 0 0;
      color: #f4f4f5;
      font-size: 14px;
      line-height: 1.5;
      font-weight: 500;
    }

    #${OVERLAY_ID} .deep-focus-focus p {
      color: #d4d4d8;
    }

    #${OVERLAY_ID} .deep-focus-actions {
      display: flex;
      gap: 10px;
      margin-top: 22px;
    }

    #${OVERLAY_ID} button {
      min-height: 40px;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 0 14px;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
    }

    #${OVERLAY_ID} button[data-deep-focus-action="back"] {
      border-color: #3f3f46;
      background: #27272a;
      color: #f4f4f5;
    }

    #${OVERLAY_ID} button[data-deep-focus-action="submit-reason"] {
      border-color: #2563eb;
      background: #2563eb;
      color: #ffffff;
    }

    #${OVERLAY_ID} button[data-deep-focus-action="upgrade"] {
      min-height: 34px;
      flex: 0 0 auto;
      border-color: #2563eb;
      background: rgba(37, 99, 235, 0.12);
      color: #bfdbfe;
      font-size: 13px;
    }

    #${OVERLAY_ID} button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    #${OVERLAY_ID} button[data-deep-focus-action="close"] {
      background: #27272a;
      color: #f4f4f5;
    }

    #${OVERLAY_ID} .deep-focus-message {
      min-height: 20px;
      margin-top: 12px;
      color: #a1a1aa;
      font-size: 13px;
    }

    @media (max-width: 520px) {
      #${OVERLAY_ID} {
        padding: 14px;
      }

      #${OVERLAY_ID} .deep-focus-card {
        padding: 20px;
      }

      #${OVERLAY_ID} .deep-focus-actions {
        flex-direction: column;
      }

      #${OVERLAY_ID} .deep-focus-upgrade {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `;
}
