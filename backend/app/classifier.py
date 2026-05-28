import re
from dataclasses import dataclass
from urllib.parse import urlparse

from app.schemas import ClassifyRequest, ClassifyResponse


DEFAULT_ALLOWED_KEYWORDS = {
    "academic study": ["academic", "research", "study", "lecture", "university"],
    "ai": ["artificial intelligence", "ai learning", "llm", "openai"],
    "ai learning": ["artificial intelligence", "ai learning", "llm", "openai"],
    "artificial intelligence": ["artificial intelligence", "ai learning", "llm", "openai"],
    "coding": ["coding", "learn to code", "developer tutorial", "programming"],
    "javascript": ["javascript", "typescript", "node", "npm"],
    "machine learning": ["machine learning", "deep learning", "ml model", "transformer"],
    "product strategy": ["product strategy", "product roadmap", "startup growth"],
    "programming": ["programming", "algorithm", "data structure", "software"],
    "python": ["python", "django", "fastapi", "pandas", "numpy"],
    "react": ["react", "reactjs", "next.js", "frontend"],
    "seo": [
        "seo",
        "search engine optimization",
        "keyword research",
        "ranking website",
        "rank a website",
        "google ranking",
        "backlinks",
    ],
    "software": ["software", "software engineering", "architecture", "system design"],
    "software development": ["software development", "software engineering", "programming"],
    "tutorial": ["tutorial", "course", "lesson"],
    "web development": ["web development", "html", "css", "frontend", "backend"],
}

DEFAULT_BLOCKED_KEYWORDS = {
    "celebrity drama": ["celebrity", "drama", "controversy", "scandal"],
    "comedy skits": ["comedy skit", "skit", "prank"],
    "entertainment": [
        "entertainment",
        "reaction",
        "reactions",
        "viral",
        "challenge",
        "prank",
    ],
    "football highlights": [
        "football highlights",
        "match highlights",
        "goal highlights",
        "football",
    ],
    "gaming": ["gaming", "gameplay", "minecraft", "fortnite", "roblox"],
    "gossip": ["gossip", "rumor", "tea"],
    "memes": ["meme", "memes"],
    "movie clips": ["movie clip", "film clip", "trailer"],
    "random videos": ["random video", "random videos", "compilation", "challenge"],
    "supercars": [
        "car",
        "cars",
        "supercar",
        "supercars",
        "nascar",
        "race",
        "racing",
        "driver",
        "compilation",
        "lamborghini",
        "ferrari",
    ],
}

WEAK_ALLOWED_KEYWORDS = {"ranking", "learn", "tips", "strategy", "content", "tutorial"}
TITLE_WEIGHT = 4.0
BODY_WEIGHT = 1.0


@dataclass
class LabelScore:
    label: str
    score: float
    matches: list[str]
    main_matches: list[str]


def classify_page(request: ClassifyRequest) -> ClassifyResponse:
    if _is_neutral_navigation_page(request):
        return ClassifyResponse(
            decision="allow",
            topLabel="navigation",
            score=1.0,
            reason="Navigation/search page allowed so the user can find focus-related content.",
        )

    main_text = _build_main_text(request)
    support_text = _build_support_text(request)
    use_default_categories = not bool(request.categoriesUpdatedAt)
    allowed_labels = _labels_for_request(
        request.allowedCategories, DEFAULT_ALLOWED_KEYWORDS, use_default_categories
    )
    blocked_labels = _labels_for_request(
        request.blockedCategories, DEFAULT_BLOCKED_KEYWORDS, use_default_categories
    )

    allowed_score = _score_labels(
        main_text, support_text, allowed_labels, DEFAULT_ALLOWED_KEYWORDS
    )
    blocked_score = _score_labels(
        main_text, support_text, blocked_labels, DEFAULT_BLOCKED_KEYWORDS
    )

    if blocked_score.main_matches:
        return ClassifyResponse(
            decision="block",
            topLabel=blocked_score.label,
            score=_normalize_score(blocked_score.score),
            reason=_build_reason(
                "blocked",
                blocked_score.label,
                blocked_score.matches,
                "Strong blocked keyword(s) appeared in the main title or metadata.",
            ),
        )

    if _has_blocked_conflict(blocked_score, allowed_score):
        return ClassifyResponse(
            decision="block",
            topLabel=blocked_score.label,
            score=_normalize_score(blocked_score.score),
            reason=_build_reason(
                "blocked",
                blocked_score.label,
                blocked_score.matches,
                "Blocked terms outweighed only weak allowed signals outside the main page context.",
            ),
        )

    if allowed_score.main_matches and _has_strong_allowed_signal(allowed_score):
        return ClassifyResponse(
            decision="allow",
            topLabel=allowed_score.label,
            score=_normalize_score(allowed_score.score),
            reason=_build_reason(
                "allowed",
                allowed_score.label,
                allowed_score.matches,
                "Matched a specific allowed learning or work category.",
            ),
        )

    return ClassifyResponse(
        decision="block",
        topLabel="non_focus",
        score=0.0,
        reason="This page does not clearly match your allowed focus categories.",
    )


def _is_neutral_navigation_page(request: ClassifyRequest) -> bool:
    if not request.url or request.url in {"about:blank", "chrome://newtab/"}:
        return True

    parsed_url = urlparse(request.url)
    host = parsed_url.netloc.lower()
    path = parsed_url.path.rstrip("/") or "/"

    if host.endswith("google.com"):
        return path == "/" or path == "/search"

    if host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if path == "/":
            return True

        if path == "/results":
            return True

        return path not in {"/watch"} and not path.startswith("/shorts/")

    return False


def _build_main_text(request: ClassifyRequest) -> str:
    return _normalize_text(
        " ".join(
            [
                request.youtubeTitle,
                request.title,
                request.metaDescription,
            ]
        )
    )


def _build_support_text(request: ClassifyRequest) -> str:
    parts = [
        request.url,
        request.source,
        request.channelName,
        request.textSample,
        " ".join(request.headings),
    ]

    return _normalize_text(" ".join(parts))


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _labels_for_request(
    requested_categories: list[str],
    default_keywords: dict[str, list[str]],
    use_defaults: bool,
) -> list[str]:
    labels = [category.strip().lower() for category in requested_categories if category]

    if labels or not use_defaults:
        return labels

    return list(default_keywords.keys())


def _score_labels(
    main_text: str,
    support_text: str,
    labels: list[str],
    default_keywords: dict[str, list[str]],
) -> LabelScore:
    best_label = labels[0] if labels else "uncategorized"
    best_score = 0.0
    best_matches: list[str] = []
    best_main_matches: list[str] = []

    for label in labels:
        keywords = default_keywords.get(label, [label])
        main_matches = [
            keyword for keyword in keywords if _contains_keyword(main_text, keyword)
        ]
        support_matches = [
            keyword
            for keyword in keywords
            if keyword not in main_matches and _contains_keyword(support_text, keyword)
        ]
        score = len(main_matches) * TITLE_WEIGHT + len(support_matches) * BODY_WEIGHT

        if score > best_score:
            best_label = label
            best_score = score
            best_matches = main_matches + support_matches
            best_main_matches = main_matches

    return LabelScore(
        label=best_label,
        score=best_score,
        matches=best_matches,
        main_matches=best_main_matches,
    )


def _contains_keyword(text: str, keyword: str) -> bool:
    normalized_keyword = re.escape(keyword.lower())

    return re.search(rf"(?<![a-z0-9]){normalized_keyword}(?![a-z0-9])", text) is not None


def _has_blocked_conflict(
    blocked_score: LabelScore, allowed_score: LabelScore
) -> bool:
    if blocked_score.score == 0:
        return False

    allowed_matches_are_weak = bool(allowed_score.matches) and all(
        match.lower() in WEAK_ALLOWED_KEYWORDS for match in allowed_score.matches
    )

    return blocked_score.score >= allowed_score.score or allowed_matches_are_weak


def _has_strong_allowed_signal(allowed_score: LabelScore) -> bool:
    return any(
        match.lower() not in WEAK_ALLOWED_KEYWORDS for match in allowed_score.main_matches
    )


def _normalize_score(raw_score: float) -> float:
    return round(min(1.0, 0.45 + raw_score * 0.12), 2)


def _build_reason(action: str, label: str, matches: list[str], detail: str) -> str:
    keyword_text = ", ".join(matches[:4])

    return (
        f"{detail} Matched {action} category '{label}' using keyword(s): "
        f"{keyword_text}."
    )
