"""
US1 — Surplus Volume Prediction per Donor
==========================================
ML Method: Linear Regression (scikit-learn)

Feature vector (per donor, per historical month):
  X = [month_number (1-12), total_donations_so_far]
  y = quantity_kg donated that month

The model is fit on the last 12 months of that donor's data and
predicts the expected kg for the *next* calendar month.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
from typing import Optional


def predict_surplus(task_rows: list[dict]) -> dict:
    """
    Parameters
    ----------
    task_rows : list of dicts with keys:
        - created_at  (datetime)
        - quantity_kg (float)

    Returns
    -------
    dict with:
        - predicted_kg         : float  — predicted volume for next month
        - trend                : str    — 'INCREASING' | 'DECREASING' | 'STABLE'
        - confidence           : str    — 'HIGH' | 'MEDIUM' | 'LOW'
        - monthly_history      : list   — [{month, kg}]
    """
    if not task_rows:
        return _empty_prediction()

    df = pd.DataFrame(task_rows)
    df["created_at"] = pd.to_datetime(df["created_at"])
    df["quantity_kg"] = df["quantity_kg"].astype(float)

    # Aggregate by month
    df["month"] = df["created_at"].dt.to_period("M")
    monthly = df.groupby("month")["quantity_kg"].sum().reset_index()
    monthly = monthly.sort_values("month")

    if len(monthly) < 2:
        avg = float(monthly["quantity_kg"].mean()) if len(monthly) == 1 else 0.0
        return {
            "predicted_kg": round(avg, 2),
            "trend": "STABLE",
            "confidence": "LOW",
            "monthly_history": _to_history(monthly),
        }

    # Encode month as integer index for regression
    monthly["month_idx"] = np.arange(len(monthly))
    X = monthly[["month_idx"]].values
    y = monthly["quantity_kg"].values

    model = LinearRegression()
    model.fit(X, y)

    next_idx = np.array([[len(monthly)]])
    predicted_kg = float(model.predict(next_idx)[0])
    predicted_kg = max(predicted_kg, 0.0)   # clip negatives

    # Trend from slope
    slope = model.coef_[0]
    if slope > 0.5:
        trend = "INCREASING"
    elif slope < -0.5:
        trend = "DECREASING"
    else:
        trend = "STABLE"

    confidence = "HIGH" if len(monthly) >= 6 else ("MEDIUM" if len(monthly) >= 3 else "LOW")

    return {
        "predicted_kg": round(predicted_kg, 2),
        "trend": trend,
        "confidence": confidence,
        "monthly_history": _to_history(monthly),
    }


def _to_history(monthly: pd.DataFrame) -> list:
    return [
        {"month": str(row["month"]), "kg": round(float(row["quantity_kg"]), 2)}
        for _, row in monthly.iterrows()
    ]


def _empty_prediction() -> dict:
    return {
        "predicted_kg": 0.0,
        "trend": "STABLE",
        "confidence": "LOW",
        "monthly_history": [],
    }
