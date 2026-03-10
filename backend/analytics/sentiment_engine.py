"""
US14 — Sentiment Analysis (NLP) on NGO Feedback
=================================================
ML Method: VADER SentimentIntensityAnalyzer (vaderSentiment)

VADER (Valence Aware Dictionary and sEntiment Reasoner) is a pre-trained
lexicon + rule-based NLP model designed for short, social-media-style text.
It is ideal here because:
  - No training data required (it ships with a built-in sentiment lexicon)
  - Works well on informal short feedback ("food was fresh and good packaging")
  - Runs in < 1ms per sentence, entirely in-process

Output:
  - compound score: -1.0 (very negative) → +1.0 (very positive)
  - label: POSITIVE | NEUTRAL | NEGATIVE
  - star_rating: 1–5 (mapped from compound for display purposes)
"""

from __future__ import annotations
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Singleton analyser — instantiate once (loads lexicon from disk)
_analyser = SentimentIntensityAnalyzer()

# Food-quality domain words to boost/dampen
_DOMAIN_BOOSTERS = {
    "fresh": 0.5, "clean": 0.4, "packed": 0.3, "hygienic": 0.6,
    "warm": 0.3, "hot": 0.3, "nutritious": 0.5, "timely": 0.4,
    "generous": 0.4, "plentiful": 0.3,
}
_DOMAIN_DAMPENERS = {
    "stale": -0.6, "rotten": -0.9, "expired": -0.8, "smelly": -0.7,
    "cold": -0.2, "insufficient": -0.5, "dirty": -0.7, "late": -0.3,
    "damaged": -0.5, "contaminated": -0.9,
}


def _apply_domain_shift(text: str, base_compound: float) -> float:
    """Slightly shift compound score using food-rescue specific vocabulary."""
    lower = text.lower()
    shift = 0.0
    for word, delta in _DOMAIN_BOOSTERS.items():
        if word in lower:
            shift += delta * 0.1      # small nudge
    for word, delta in _DOMAIN_DAMPENERS.items():
        if word in lower:
            shift += delta * 0.1
    return max(-1.0, min(1.0, base_compound + shift))


def _compound_to_stars(compound: float) -> int:
    if compound >= 0.5:  return 5
    if compound >= 0.2:  return 4
    if compound >= -0.05: return 3
    if compound >= -0.3: return 2
    return 1


def analyze(text: str) -> dict:
    """
    Analyse a single feedback string.

    Parameters
    ----------
    text : str — raw NGO or donor feedback

    Returns
    -------
    dict with:
        - compound      : float  [-1.0, 1.0]
        - label         : str    POSITIVE | NEUTRAL | NEGATIVE
        - star_rating   : int    1–5
        - pos           : float  positive component
        - neg           : float  negative component
        - neu           : float  neutral component
        - model_used    : str
    """
    if not text or not text.strip():
        return {
            "compound": 0.0, "label": "NEUTRAL", "star_rating": 3,
            "pos": 0.0, "neg": 0.0, "neu": 1.0,
            "model_used": "VADER (empty input)",
        }

    scores = _analyser.polarity_scores(text)
    compound = _apply_domain_shift(text, scores["compound"])

    if compound >= 0.05:
        label = "POSITIVE"
    elif compound <= -0.05:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"

    return {
        "compound": round(compound, 4),
        "label": label,
        "star_rating": _compound_to_stars(compound),
        "pos": round(scores["pos"], 4),
        "neg": round(scores["neg"], 4),
        "neu": round(scores["neu"], 4),
        "model_used": "VADER SentimentIntensityAnalyzer + domain lexicon",
    }


def analyze_batch(texts: list[str]) -> dict:
    """
    Analyse multiple feedback strings and return aggregated stats.

    Returns
    -------
    dict with:
        - results       : list of individual analyze() results
        - avg_compound  : float
        - avg_stars     : float
        - label_counts  : {POSITIVE: int, NEUTRAL: int, NEGATIVE: int}
        - overall_label : str
    """
    results = [analyze(t) for t in texts]
    if not results:
        return {"results": [], "avg_compound": 0.0, "avg_stars": 3.0,
                "label_counts": {"POSITIVE": 0, "NEUTRAL": 0, "NEGATIVE": 0},
                "overall_label": "NEUTRAL"}

    avg_compound = sum(r["compound"] for r in results) / len(results)
    avg_stars = sum(r["star_rating"] for r in results) / len(results)
    label_counts = {"POSITIVE": 0, "NEUTRAL": 0, "NEGATIVE": 0}
    for r in results:
        label_counts[r["label"]] += 1

    if avg_compound >= 0.05:
        overall_label = "POSITIVE"
    elif avg_compound <= -0.05:
        overall_label = "NEGATIVE"
    else:
        overall_label = "NEUTRAL"

    return {
        "results": results,
        "avg_compound": round(avg_compound, 4),
        "avg_stars": round(avg_stars, 2),
        "label_counts": label_counts,
        "overall_label": overall_label,
    }
