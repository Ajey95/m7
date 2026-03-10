"""
US15 — Predictive Route Efficiency Analysis
=============================================
ML Method: Ridge Regression (scikit-learn)

For each delivery we compare:
  - straight-line distance_km  (from task record)
  - actual distance_traveled_km (from tracking_sessions)
  - completion_time_minutes
  - vehicle_type

Ridge Regression learns to predict expected_time_minutes from
(distance_km, vehicle_encoding) so we can compute an efficiency ratio:

    efficiency_ratio = expected_time / actual_time
      > 1.0 → volunteer was faster than model predicts  ✅
      < 1.0 → volunteer was slower (possible detour)    ⚠️

Zone-level aggregation gives admins a heatmap of inefficient areas.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler, LabelEncoder
from typing import Optional


VEHICLE_ORDER = ["BIKE", "SCOOTER", "CAR", "VAN"]


def _encode_vehicle(vt: str) -> int:
    try:
        return VEHICLE_ORDER.index(vt.upper())
    except ValueError:
        return 1  # default SCOOTER


def analyze_route_efficiency(delivery_rows: list[dict]) -> dict:
    """
    Parameters
    ----------
    delivery_rows : list of dicts — one per completed delivery with keys:
        volunteer_id, vehicle_type,
        distance_km (task straight-line),
        distance_traveled_km (tracking session actual),
        completion_time_minutes,
        pickup_lat, pickup_lng        (optional, for zone aggregation)

    Returns
    -------
    dict with:
        - volunteer_stats : list — per-volunteer efficiency ratio
        - model_r2        : float — model fit quality
        - model_used      : str
        - top_inefficient_zones : list — lat/lng centroid + avg ratio
    """
    if not delivery_rows:
        return _empty_result()

    df = pd.DataFrame(delivery_rows)
    REQUIRED = ["distance_km", "completion_time_minutes", "vehicle_type"]
    df = df.dropna(subset=REQUIRED)
    df["distance_km"] = pd.to_numeric(df["distance_km"], errors="coerce").fillna(0)
    df["completion_time_minutes"] = pd.to_numeric(df["completion_time_minutes"], errors="coerce").fillna(0)
    df["vehicle_enc"] = df["vehicle_type"].apply(_encode_vehicle)

    if len(df) < 5:
        return _empty_result(note="Insufficient data for regression")

    X = df[["distance_km", "vehicle_enc"]].values
    y = df["completion_time_minutes"].values

    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)

    model = Ridge(alpha=1.0)
    model.fit(X_s, y)

    r2 = float(model.score(X_s, y))
    expected = model.predict(X_s)

    df = df.copy()
    df["expected_minutes"] = expected.clip(min=1)
    df["actual_minutes"] = df["completion_time_minutes"].clip(min=1)
    df["efficiency_ratio"] = np.round(df["expected_minutes"] / df["actual_minutes"], 3)
    df["efficiency_label"] = df["efficiency_ratio"].apply(
        lambda r: "FAST" if r > 1.1 else ("SLOW" if r < 0.85 else "NORMAL")
    )

    # Per-volunteer aggregate
    vol_stats = []
    if "volunteer_id" in df.columns:
        grp = df.groupby("volunteer_id").agg(
            deliveries=("efficiency_ratio", "count"),
            avg_efficiency=("efficiency_ratio", "mean"),
            avg_distance_km=("distance_km", "mean"),
        ).reset_index()
        for _, row in grp.iterrows():
            vol_stats.append({
                "volunteer_id": str(row["volunteer_id"]),
                "deliveries": int(row["deliveries"]),
                "avg_efficiency_ratio": round(float(row["avg_efficiency"]), 3),
                "avg_distance_km": round(float(row["avg_distance_km"]), 2),
                "performance": "FAST" if row["avg_efficiency"] > 1.1
                               else ("SLOW" if row["avg_efficiency"] < 0.85 else "NORMAL"),
            })

    # Zone aggregation (if pickup lat/lng available)
    zone_agg = []
    if "pickup_lat" in df.columns and "pickup_lng" in df.columns:
        df2 = df.dropna(subset=["pickup_lat", "pickup_lng"])
        if len(df2) > 0:
            # Bin into 0.05° cells (~5 km)
            df2 = df2.copy()
            df2["lat_bin"] = (df2["pickup_lat"].astype(float) / 0.05).round() * 0.05
            df2["lng_bin"] = (df2["pickup_lng"].astype(float) / 0.05).round() * 0.05
            zones = df2.groupby(["lat_bin", "lng_bin"])["efficiency_ratio"].mean().reset_index()
            zones = zones.sort_values("efficiency_ratio").head(5)
            for _, z in zones.iterrows():
                zone_agg.append({
                    "lat": round(float(z["lat_bin"]), 4),
                    "lng": round(float(z["lng_bin"]), 4),
                    "avg_efficiency_ratio": round(float(z["efficiency_ratio"]), 3),
                })

    return {
        "volunteer_stats": sorted(vol_stats, key=lambda x: x["avg_efficiency_ratio"]),
        "top_inefficient_zones": zone_agg,
        "model_r2": round(r2, 4),
        "model_used": "Ridge Regression (scikit-learn)",
        "total_deliveries_analysed": len(df),
    }


def _empty_result(note: str = "No data") -> dict:
    return {
        "volunteer_stats": [],
        "top_inefficient_zones": [],
        "model_r2": 0.0,
        "model_used": f"Ridge Regression (skipped: {note})",
        "total_deliveries_analysed": 0,
    }
