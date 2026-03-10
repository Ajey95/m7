"""
US8 — Automated Fraud Detection Analytics
==========================================
ML Method: Isolation Forest (scikit-learn) — unsupervised anomaly detection

For each entity (donor / NGO), we compute a feature vector from their
transactional behaviour and feed it through Isolation Forest.
Isolation Forest assigns an anomaly score; the most anomalous entities
are flagged for admin review and written to the `fraud_flags` table.

Donor features:
  - avg_claimed_kg_per_task
  - max_single_claim_kg
  - cancellation_rate
  - claim_frequency_days   (avg days between donations)

NGO features:
  - avg_received_kg_per_task
  - max_single_receipt_kg
  - daily_receipt_vs_capacity_ratio   (max daily kg / declared capacity_kg)
  - total_tasks_last_30_days
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Literal


EntityType = Literal["DONOR", "NGO", "VOLUNTEER"]


def _run_isolation_forest(
    df: pd.DataFrame,
    feature_cols: list[str],
    contamination: float = 0.1,
) -> pd.DataFrame:
    """Fits Isolation Forest; returns df with added `anomaly_score` and `is_anomaly`."""
    if len(df) < 5:
        df["anomaly_score"] = 0.0
        df["is_anomaly"] = False
        return df

    X = df[feature_cols].fillna(0.0).values
    iso = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
    )
    iso.fit(X)

    # decision_function: negative = more anomalous; score_samples gives log-density
    raw_scores = iso.decision_function(X)   # range ~[-0.5, 0.5]
    predictions = iso.predict(X)            # -1 = anomaly, 1 = normal

    # Normalise to [0, 1] where 1.0 = most anomalous
    min_s, max_s = raw_scores.min(), raw_scores.max()
    if max_s - min_s == 0:
        norm_scores = np.zeros_like(raw_scores)
    else:
        norm_scores = 1.0 - (raw_scores - min_s) / (max_s - min_s)

    df = df.copy()
    df["anomaly_score"] = np.round(norm_scores, 4)
    df["is_anomaly"] = predictions == -1
    return df


def detect_donor_fraud(donor_rows: list[dict]) -> list[dict]:
    """
    Parameters
    ----------
    donor_rows : list of dicts, one per donor with keys:
        donor_id, avg_claimed_kg_per_task, max_single_claim_kg,
        cancellation_rate, claim_frequency_days

    Returns
    -------
    list of flagged dicts (only anomalies):
        donor_id, anomaly_score, reason
    """
    if not donor_rows:
        return []

    FEATURES = ["avg_claimed_kg_per_task", "max_single_claim_kg",
                 "cancellation_rate", "claim_frequency_days"]
    df = pd.DataFrame(donor_rows)
    df = _run_isolation_forest(df, FEATURES)

    flagged = df[df["is_anomaly"]].copy()
    results = []
    for _, row in flagged.iterrows():
        reason = _donor_reason(row)
        results.append({
            "entity_type": "DONOR",
            "entity_id": str(row.get("donor_id", "")),
            "anomaly_score": float(row["anomaly_score"]),
            "reason": reason,
        })
    return sorted(results, key=lambda x: x["anomaly_score"], reverse=True)


def detect_ngo_fraud(ngo_rows: list[dict]) -> list[dict]:
    """
    Parameters
    ----------
    ngo_rows : list of dicts, one per NGO with keys:
        ngo_id, avg_received_kg_per_task, max_single_receipt_kg,
        daily_receipt_vs_capacity_ratio, total_tasks_last_30_days

    Returns
    -------
    list of flagged dicts (only anomalies)
    """
    if not ngo_rows:
        return []

    FEATURES = ["avg_received_kg_per_task", "max_single_receipt_kg",
                 "daily_receipt_vs_capacity_ratio", "total_tasks_last_30_days"]
    df = pd.DataFrame(ngo_rows)
    df = _run_isolation_forest(df, FEATURES)

    flagged = df[df["is_anomaly"]].copy()
    results = []
    for _, row in flagged.iterrows():
        reason = _ngo_reason(row)
        results.append({
            "entity_type": "NGO",
            "entity_id": str(row.get("ngo_id", "")),
            "anomaly_score": float(row["anomaly_score"]),
            "reason": reason,
        })
    return sorted(results, key=lambda x: x["anomaly_score"], reverse=True)


def _donor_reason(row) -> str:
    parts = []
    if row.get("max_single_claim_kg", 0) > 200:
        parts.append(f"Single claim of {row['max_single_claim_kg']} kg (very high)")
    if row.get("cancellation_rate", 0) > 0.5:
        parts.append(f"Cancellation rate {row['cancellation_rate']*100:.0f}%")
    if row.get("claim_frequency_days", 999) < 0.5:
        parts.append("Abnormally high donation frequency")
    return "; ".join(parts) if parts else "Statistical outlier detected by Isolation Forest"


def _ngo_reason(row) -> str:
    parts = []
    if row.get("daily_receipt_vs_capacity_ratio", 0) > 1.5:
        parts.append(f"Daily receipts {row['daily_receipt_vs_capacity_ratio']:.1f}x declared capacity")
    if row.get("max_single_receipt_kg", 0) > 500:
        parts.append(f"Single receipt of {row['max_single_receipt_kg']} kg (very high)")
    return "; ".join(parts) if parts else "Statistical outlier detected by Isolation Forest"
