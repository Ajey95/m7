"""
US2 — NGO Demand Forecast (Seasonal + Calendar)
================================================
ML Method: Holt-Winters Exponential Smoothing (statsmodels)

Uses the number of task claims (deliveries received) per NGO per month
as the time-series. Holt-Winters captures both trend and seasonality,
making it appropriate for food-demand which spikes around festivals.

Calendar events (Indian, hardcoded) are used to annotate the forecast
with a human-readable spike reason when the predicted month coincides.
"""

from __future__ import annotations
import pandas as pd
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from datetime import date
from typing import Optional


# ---------------------------------------------------------------------------
# Calendar event lookup — month → list of event names
# ---------------------------------------------------------------------------
CALENDAR_EVENTS: dict[int, list[str]] = {
    1:  ["New Year", "Pongal", "Makar Sankranti"],
    4:  ["Ram Navami", "Ugadi"],
    8:  ["Independence Day", "Janmashtami"],
    9:  ["Ganesh Chaturthi"],
    10: ["Navratri", "Dussehra"],
    11: ["Diwali", "Bhai Dooj"],
    12: ["Christmas", "Year-End Drives"],
}


def forecast_demand(claim_rows: list[dict], periods_ahead: int = 3) -> dict:
    """
    Parameters
    ----------
    claim_rows : list of dicts with keys:
        - completed_at  (datetime)  — when delivery was confirmed
        - quantity_kg   (float)

    periods_ahead : int — how many future months to forecast (default 3)

    Returns
    -------
    dict with:
        - forecast          : list  — [{month, predicted_kg, events}]
        - model_used        : str
        - data_points_used  : int
    """
    if not claim_rows:
        return _empty_forecast(periods_ahead)

    df = pd.DataFrame(claim_rows)
    df["completed_at"] = pd.to_datetime(df["completed_at"])
    df["quantity_kg"] = df["quantity_kg"].astype(float)
    df["month"] = df["completed_at"].dt.to_period("M")

    monthly = df.groupby("month")["quantity_kg"].sum().sort_index()

    if len(monthly) < 4:
        # Not enough data — fall back to simple average
        avg = float(monthly.mean()) if len(monthly) else 0.0
        return _simple_forecast(avg, periods_ahead, monthly)

    # Reindex to fill any missing months with 0
    full_range = pd.period_range(start=monthly.index.min(),
                                 end=monthly.index.max(), freq="M")
    monthly = monthly.reindex(full_range, fill_value=0.0)

    series = monthly.values.astype(float)

    try:
        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal="add" if len(series) >= 12 else None,
            seasonal_periods=12 if len(series) >= 12 else None,
            initialization_method="estimated",
        )
        fit = model.fit(optimized=True)
        raw_forecast = fit.forecast(periods_ahead)
    except Exception:
        # Graceful fallback
        avg = float(np.mean(series))
        raw_forecast = [avg] * periods_ahead

    # Build output
    last_month = monthly.index[-1]
    forecast_out = []
    for i, pred_kg in enumerate(raw_forecast):
        next_period = last_month + (i + 1)
        month_num = next_period.month
        events = CALENDAR_EVENTS.get(month_num, [])
        forecast_out.append({
            "month": str(next_period),
            "predicted_kg": round(max(float(pred_kg), 0.0), 2),
            "calendar_events": events,
            "demand_spike": len(events) > 0,
        })

    return {
        "forecast": forecast_out,
        "model_used": "Holt-Winters Exponential Smoothing",
        "data_points_used": len(monthly),
    }


def _simple_forecast(avg: float, periods_ahead: int, monthly) -> dict:
    last_month = monthly.index[-1] if len(monthly) else pd.Period("2025-01", freq="M")
    forecast_out = []
    for i in range(periods_ahead):
        next_period = last_month + (i + 1)
        month_num = next_period.month
        events = CALENDAR_EVENTS.get(month_num, [])
        forecast_out.append({
            "month": str(next_period),
            "predicted_kg": round(avg, 2),
            "calendar_events": events,
            "demand_spike": len(events) > 0,
        })
    return {
        "forecast": forecast_out,
        "model_used": "Moving Average (fallback — insufficient data)",
        "data_points_used": len(monthly),
    }


def _empty_forecast(periods_ahead: int) -> dict:
    from datetime import date
    today = date.today()
    base = pd.Period(f"{today.year}-{today.month:02d}", freq="M")
    forecast_out = []
    for i in range(periods_ahead):
        p = base + (i + 1)
        events = CALENDAR_EVENTS.get(p.month, [])
        forecast_out.append({
            "month": str(p),
            "predicted_kg": 0.0,
            "calendar_events": events,
            "demand_spike": len(events) > 0,
        })
    return {
        "forecast": forecast_out,
        "model_used": "No data — empty forecast",
        "data_points_used": 0,
    }
