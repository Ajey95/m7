"""
US4 — Spoilage Risk Analytics
===============================
ML Method: Logistic Regression (scikit-learn)

For each active in-transit task, computes a spoilage risk score (0–1)
based on features:
  - hours_until_expiry    (negative = already expired)
  - requires_cooling      (binary)
  - transit_time_hours    (time since pickup_verified_at)
  - food_type_risk        (encoded: NON_VEG=1.0, VEG=0.5, VEGAN=0.4, MIXED=0.7)

The model is trained on synthetic/historical data representing known
spoilage outcomes (task_exceptions with issue_type='FOOD_SPOILED').
Falls back to a parametric risk formula when training data is sparse.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from datetime import datetime


FOOD_TYPE_RISK: dict[str, float] = {
    "NON_VEG": 1.0,
    "MIXED":   0.7,
    "VEG":     0.5,
    "VEGAN":   0.4,
}

RISK_LABELS = {
    (0.0, 0.3): "LOW",
    (0.3, 0.6): "MEDIUM",
    (0.6, 1.0): "HIGH",
}


def _risk_label(score: float) -> str:
    for (lo, hi), label in RISK_LABELS.items():
        if lo <= score < hi:
            return label
    return "HIGH"


def _build_features(task: dict) -> list[float]:
    now = datetime.utcnow()
    expiry = task.get("expiry_time")
    if isinstance(expiry, str):
        expiry = datetime.fromisoformat(expiry.replace("Z", ""))
    hours_until_expiry = (expiry - now).total_seconds() / 3600 if expiry else 2.0

    pickup_at = task.get("pickup_verified_at")
    if isinstance(pickup_at, str):
        pickup_at = datetime.fromisoformat(pickup_at.replace("Z", ""))
    transit_hours = (now - pickup_at).total_seconds() / 3600 if pickup_at else 0.0

    food_type = task.get("food_type", "VEG")
    food_risk = FOOD_TYPE_RISK.get(food_type, 0.5)
    cooling = 1.0 if task.get("requires_cooling") else 0.0

    return [hours_until_expiry, cooling, transit_hours, food_risk]


def score_spoilage_risk(
    active_tasks: list[dict],
    historical_spoilage: list[dict] | None = None,
) -> list[dict]:
    """
    Parameters
    ----------
    active_tasks : list of task dicts (IN_TRANSIT or ASSIGNED) with keys:
        id, food_type, requires_cooling, expiry_time,
        pickup_verified_at, quantity_kg, distance_km

    historical_spoilage : optional list of past completed tasks with
        extra key `spoiled` (bool) — used to train the LR model.
        If None or length < 10, falls back to parametric formula.

    Returns
    -------
    list of dicts:
        - task_id, food_type, risk_score (0-1), risk_level, hours_until_expiry
    """
    results = []

    # Try to train a proper LR if we have enough labelled history
    model = None
    scaler = None
    if historical_spoilage and len(historical_spoilage) >= 10:
        rows = [_build_features(t) for t in historical_spoilage]
        labels = [int(t.get("spoiled", False)) for t in historical_spoilage]
        if len(set(labels)) > 1:   # need both classes
            scaler = StandardScaler()
            X = scaler.fit_transform(rows)
            model = LogisticRegression(max_iter=200)
            model.fit(X, labels)

    for task in active_tasks:
        feats = _build_features(task)
        hours_until_expiry = feats[0]

        if model and scaler:
            score = float(model.predict_proba(scaler.transform([feats]))[0][1])
        else:
            # Parametric fallback — weighted sum normalised to [0,1]
            time_pressure = max(0.0, 1.0 - hours_until_expiry / 6.0)
            transit_pressure = min(1.0, feats[2] / 3.0)
            food_risk = feats[3]
            cooling_factor = 0.3 if feats[1] else 0.0
            score = min(1.0, 0.4 * time_pressure + 0.25 * transit_pressure
                        + 0.2 * food_risk + 0.15 * cooling_factor)

        results.append({
            "task_id": str(task.get("id", "")),
            "food_type": task.get("food_type", ""),
            "quantity_kg": float(task.get("quantity_kg", 0)),
            "risk_score": round(score, 4),
            "risk_level": _risk_label(score),
            "hours_until_expiry": round(hours_until_expiry, 2),
            "model_used": "Logistic Regression" if model else "Parametric Risk Formula",
        })

    return sorted(results, key=lambda x: x["risk_score"], reverse=True)
