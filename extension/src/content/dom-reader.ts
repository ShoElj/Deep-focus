export type PageSource = "youtube" | "web";

export interface PageContext {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  h1: string[];
  h2: string[];
  textSample: string;
  source: PageSource;
  youtubeTitle?: string;
  youtubeVideoTitle?: string;
  youtubeChannelName?: string;
}

const MAX_HEADINGS_PER_LEVEL = 8;
const MAX_TEXT_SAMPLE_LENGTH = 700;
const MAX_TEXT_NODES = 80;
const GENERIC_YOUTUBE_TITLES = new Set(["youtube", "- youtube"]);

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function cleanYouTubeTitle(value: string | null | undefined): string {
  const text = cleanText(value).replace(/\s+-\s+YouTube$/i, "");

  return GENERIC_YOUTUBE_TITLES.has(text.toLowerCase()) ? "" : text;
}

function getMetaDescription(): string {
  const meta =
    document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]') ??
    document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');

  return cleanText(meta?.content);
}

function getHeadingText(selector: "h1" | "h2"): string[] {
  return Array.from(document.querySelectorAll<HTMLHeadingElement>(selector))
    .map((heading) => cleanText(heading.innerText || heading.textContent))
    .filter(Boolean)
    .slice(0, MAX_HEADINGS_PER_LEVEL);
}

function isVisibleElement(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  const style = window.getComputedStyle(htmlElement);
  const hasRenderedBox =
    htmlElement.getClientRects().length > 0 ||
    htmlElement === document.body ||
    htmlElement === document.documentElement;

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    htmlElement.getAttribute("aria-hidden") !== "true" &&
    hasRenderedBox
  );
}

function shouldSkipTextNode(parent: Element): boolean {
  const tagName = parent.tagName.toLowerCase();

  return [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "template"
  ].includes(tagName);
}

function getElementText(selector: string): string {
  const element = document.querySelector<HTMLElement>(selector);

  if (!element || !isVisibleElement(element)) {
    return "";
  }

  return cleanText(element.innerText || element.textContent);
}

function getPreferredVisibleTextSample(): string {
  const selectors = isYouTubePage()
    ? [
        "ytd-watch-metadata",
        "#above-the-fold",
        "#primary",
        "ytd-watch-flexy"
      ]
    : ["article", "main", '[role="main"]'];

  for (const selector of selectors) {
    const text = getElementText(selector);

    if (text.length > 40) {
      return truncateText(text, MAX_TEXT_SAMPLE_LENGTH);
    }
  }

  return "";
}

function getVisibleTextSample(): string {
  const preferredTextSample = getPreferredVisibleTextSample();

  if (preferredTextSample) {
    return preferredTextSample;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = cleanText(node.textContent);
      const parent = node.parentElement;

      if (!text || !parent || shouldSkipTextNode(parent) || !isVisibleElement(parent)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const chunks: string[] = [];
  let visitedTextNodes = 0;

  while (visitedTextNodes < MAX_TEXT_NODES) {
    const node = walker.nextNode();

    if (!node) {
      break;
    }

    visitedTextNodes += 1;
    chunks.push(cleanText(node.textContent));

    if (chunks.join(" ").length >= MAX_TEXT_SAMPLE_LENGTH) {
      break;
    }
  }

  const walkerTextSample = truncateText(
    cleanText(chunks.join(" ")),
    MAX_TEXT_SAMPLE_LENGTH
  );

  if (walkerTextSample) {
    return walkerTextSample;
  }

  return truncateText(cleanText(document.body?.innerText), MAX_TEXT_SAMPLE_LENGTH);
}

function isYouTubePage(): boolean {
  return location.hostname.includes("youtube.com") || location.hostname === "youtu.be";
}

function getYouTubeVideoTitle(): string {
  const elementSelectors = [
    "h1 yt-formatted-string",
    "ytd-watch-metadata h1",
    "ytd-watch-metadata h1 yt-formatted-string",
    "#title h1",
    "#title h1 yt-formatted-string",
    "h1.title yt-formatted-string",
    "#container h1 yt-formatted-string"
  ];

  for (const selector of elementSelectors) {
    const text = cleanYouTubeTitle(getElementText(selector));

    if (text) {
      return text;
    }
  }

  const metaSelectors = [
    'meta[property="og:title"]',
    'meta[name="title"]',
    'meta[itemprop="name"]',
    'meta[name="twitter:title"]'
  ];

  for (const selector of metaSelectors) {
    const meta = document.querySelector<HTMLMetaElement>(selector);
    const text = cleanYouTubeTitle(meta?.content);

    if (text) {
      return text;
    }
  }

  return cleanYouTubeTitle(document.title);
}

function getYouTubeChannelName(): string {
  const candidates = [
    document.querySelector<HTMLElement>(
      "#owner ytd-channel-name yt-formatted-string"
    ),
    document.querySelector<HTMLElement>(
      "ytd-watch-metadata ytd-channel-name yt-formatted-string"
    ),
    document.querySelector<HTMLMetaElement>('link[itemprop="name"]')
  ];

  for (const candidate of candidates) {
    const text =
      candidate instanceof HTMLLinkElement
        ? cleanText(candidate.getAttribute("content") || candidate.textContent)
        : cleanText(candidate?.innerText || candidate?.textContent);

    if (text) {
      return text;
    }
  }

  return "";
}

export function readPageContext(): PageContext {
  const h1 = getHeadingText("h1");
  const h2 = getHeadingText("h2");
  const source = isYouTubePage() ? "youtube" : "web";
  const youtubeVideoTitle = source === "youtube" ? getYouTubeVideoTitle() : "";
  const youtubeChannelName = source === "youtube" ? getYouTubeChannelName() : "";
  const title =
    source === "youtube"
      ? youtubeVideoTitle || cleanYouTubeTitle(document.title) || cleanText(document.title)
      : cleanText(document.title);

  return {
    url: location.href,
    title,
    metaDescription: getMetaDescription(),
    headings: [...h1, ...h2],
    h1,
    h2,
    textSample: getVisibleTextSample(),
    source,
    ...(youtubeVideoTitle ? { youtubeTitle: youtubeVideoTitle } : {}),
    ...(youtubeVideoTitle ? { youtubeVideoTitle } : {}),
    ...(youtubeChannelName ? { youtubeChannelName } : {})
  };
}
