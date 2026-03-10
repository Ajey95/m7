"""
US3 — Personalised Waste-Reduction Suggestions via Donor Clustering
=====================================================================
ML Method: K-Means Clustering (scikit-learn)

Donors are clustered into 4 behavioural archetypes based on:
  - avg_quantity_kg_per_task
  - cancellation_rate          (cancelled / total tasks)
  - avg_hours_before_expiry    (how far before expiry they donate)
  - donation_frequency_per_month

Each cluster maps to a pre-written set of actionable suggestions.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------------------------
# Cluster → Suggestion mapping
# ---------------------------------------------------------------------------
CLUSTER_SUGGESTIONS: dict[int, dict] = {
    0: {
        "archetype": "Last-Minute Donor",
        "description": "You tend to donate close to expiry, which reduces pickup success.",
        "suggestions": [
            "Post donations at least 4 hours before expiry for best matching.",
            "Enable auto-scheduling for recurring surplus days.",
            "Set expiry reminder alerts for your most common food items.",
        ],
    },
    1: {
        "archetype": "High-Volume Donor",
        "description": "You donate large quantities — great impact, but can stress logistics.",
        "suggestions": [
            "Split large batches into multiple smaller donations for easier transport.",
            "Coordinate with the same NGO regularly for predictable large pickups.",
            "Consider refrigerated vehicle requests for perishable bulk donations.",
        ],
    },
    2: {
        "archetype": "Inconsistent Donor",
        "description": "Your donation frequency is irregular with a higher cancellation rate.",
        "suggestions": [
            "Set a recurring donation schedule (e.g., every Friday evening).",
            "Only post when food is confirmed available to reduce cancellations.",
            "Review your top cancellation reasons and address the most common one.",
        ],
    },
    3: {
        "archetype": "Ideal Donor",
        "description": "Your donation patterns are exemplary — consistent, timely and reliable.",
        "suggestions": [
            "You're doing great! Consider mentoring new donors in your area.",
            "Try expanding to a 2nd NGO partner to diversify your impact.",
            "Share your CO₂ savings badge on social media to inspire others.",
        ],
    },
}


def suggest_for_donor(donor_stats: dict, all_donor_stats: list[dict]) -> dict:
    """
    Parameters
    ----------
    donor_stats : metrics for the *current* donor (same schema as each row in all_donor_stats)
    all_donor_stats : list of dicts for all donors — used to train the cluster model
        Each dict has keys:
            avg_quantity_kg, cancellation_rate,
            avg_hours_before_expiry, donations_per_month

    Returns
    -------
    dict with:
        - cluster_id        : int
        - archetype         : str
        - description       : str
        - suggestions       : list[str]
        - model_used        : str
    """
    FEATURES = ["avg_quantity_kg", "cancellation_rate",
                 "avg_hours_before_expiry", "donations_per_month"]

    # Need at least 4 donors for K=4 clusters
    if len(all_donor_stats) < 4:
        return {**CLUSTER_SUGGESTIONS[3], "cluster_id": 3,
                "model_used": "K-Means (fallback: insufficient donors)"}

    df = pd.DataFrame(all_donor_stats)
    for feat in FEATURES:
        if feat not in df.columns:
            df[feat] = 0.0
    df[FEATURES] = df[FEATURES].fillna(0.0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[FEATURES])

    n_clusters = min(4, len(df))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(X_scaled)

    # Predict cluster for the current donor
    donor_vec = np.array([[
        donor_stats.get("avg_quantity_kg", 0),
        donor_stats.get("cancellation_rate", 0),
        donor_stats.get("avg_hours_before_expiry", 0),
        donor_stats.get("donations_per_month", 0),
    ]])
    donor_scaled = scaler.transform(donor_vec)
    cluster_id = int(kmeans.predict(donor_scaled)[0])

    result = CLUSTER_SUGGESTIONS.get(cluster_id, CLUSTER_SUGGESTIONS[3]).copy()
    result["cluster_id"] = cluster_id
    result["model_used"] = f"K-Means (k={n_clusters}, donors trained on={len(df)})"
    return result
