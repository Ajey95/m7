"""
Analytics API Router — All 15 User Stories
===========================================
FastAPI router that serves all analytics endpoints.
Registered in main.py with prefix="/api/v1".
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text, and_, or_
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from database import get_db
from models import (
    Task, TaskStatus, TaskException,
    Donor, NGO, Volunteer, User, UserRole,
    PerformanceStat, TrackingSession
)
from utils.auth import get_current_user

# Analytics ML engines
from analytics.surplus_model import predict_surplus
from analytics.demand_model import forecast_demand
from analytics.cluster_model import suggest_for_donor
from analytics.spoilage_model import score_spoilage_risk
from analytics.fraud_model import detect_donor_fraud, detect_ngo_fraud
from analytics.sentiment_engine import analyze as analyze_sentiment, analyze_batch
from analytics.route_model import analyze_route_efficiency

import uuid

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ─────────────────────────────────────────────────────────────
# Pydantic schemas (request bodies)
# ─────────────────────────────────────────────────────────────
class SentimentRequest(BaseModel):
    text: str
    task_id: Optional[str] = None
    save_to_db: bool = False


# ─────────────────────────────────────────────────────────────
# US1 — Surplus Volume Prediction per Donor
# GET /analytics/surplus-prediction
# ─────────────────────────────────────────────────────────────
@router.get("/surplus-prediction")
async def surplus_prediction(
    days_back: int = Query(180, description="Historical window in days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """System / Admin: Predict surplus volume per donor using Linear Regression."""
    cutoff = datetime.utcnow() - timedelta(days=days_back)

    # Pull all completed task data grouped we need per-donor
    donors = db.query(Donor).all()
    results = []
    for donor in donors:
        task_rows = db.query(Task).filter(
            Task.donor_id == donor.id,
            Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
            Task.created_at >= cutoff,
        ).all()

        history = [
            {"created_at": t.created_at, "quantity_kg": float(t.quantity_kg)}
            for t in task_rows
        ]

        prediction = predict_surplus(history)
        results.append({
            "donor_id": str(donor.id),
            "donor_name": donor.user.full_name if donor.user else "Unknown",
            "organization": donor.organization_name,
            **prediction,
        })

    # Sort by highest predicted volume first
    results.sort(key=lambda x: x["predicted_kg"], reverse=True)
    return {"predictions": results, "window_days": days_back}


# ─────────────────────────────────────────────────────────────
# US2 — NGO Demand Forecast (Seasonal + Calendar)
# GET /analytics/demand-forecast
# ─────────────────────────────────────────────────────────────
@router.get("/demand-forecast")
async def demand_forecast(
    ngo_id: Optional[str] = Query(None),
    periods_ahead: int = Query(3, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """System / NGO: Forecast demand for next N months using Holt-Winters."""
    query = db.query(Task).filter(
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
        Task.completed_at.isnot(None),
    )
    if ngo_id:
        query = query.filter(Task.ngo_id == ngo_id)

    tasks = query.all()
    claim_rows = [
        {"completed_at": t.completed_at, "quantity_kg": float(t.quantity_kg)}
        for t in tasks if t.completed_at
    ]

    forecast = forecast_demand(claim_rows, periods_ahead=periods_ahead)
    return {"ngo_id": ngo_id or "all", **forecast}


# ─────────────────────────────────────────────────────────────
# US3 — Personalized Suggestions per Donor (K-Means)
# GET /analytics/donor/{donor_id}/suggestions
# ─────────────────────────────────────────────────────────────
@router.get("/donor/{donor_id}/suggestions")
async def donor_suggestions(
    donor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Donor: Personalised waste-reduction suggestions via K-Means clustering."""
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    # Build feature vectors for ALL donors
    all_donors = db.query(Donor).all()
    all_stats = []
    for d in all_donors:
        tasks = db.query(Task).filter(Task.donor_id == d.id).all()
        total = len(tasks)
        cancelled = sum(1 for t in tasks if t.status == TaskStatus.CANCELLED)
        completed_tasks = [t for t in tasks if t.completed_at]
        avg_kg = sum(float(t.quantity_kg) for t in tasks) / max(total, 1)

        # Average hours before expiry at donation time
        expiry_windows = []
        for t in tasks:
            if t.expiry_time and t.created_at:
                hrs = (t.expiry_time - t.created_at).total_seconds() / 3600
                expiry_windows.append(hrs)
        avg_expiry_hrs = sum(expiry_windows) / max(len(expiry_windows), 1)

        # Donations per month
        if tasks:
            span_days = max((datetime.utcnow() - min(t.created_at for t in tasks)).days, 1)
            donations_per_month = total / (span_days / 30)
        else:
            donations_per_month = 0.0

        all_stats.append({
            "donor_id": str(d.id),
            "avg_quantity_kg": avg_kg,
            "cancellation_rate": cancelled / max(total, 1),
            "avg_hours_before_expiry": avg_expiry_hrs,
            "donations_per_month": donations_per_month,
        })

    # Current donor's stats
    target_stats = next((s for s in all_stats if s["donor_id"] == donor_id), None)
    if not target_stats:
        raise HTTPException(status_code=404, detail="No donation history found")

    result = suggest_for_donor(target_stats, all_stats)
    result["donor_id"] = donor_id
    result["donor_stats"] = {
        "avg_quantity_kg": round(target_stats["avg_quantity_kg"], 2),
        "cancellation_rate_pct": round(target_stats["cancellation_rate"] * 100, 1),
        "avg_hours_before_expiry": round(target_stats["avg_hours_before_expiry"], 1),
        "donations_per_month": round(target_stats["donations_per_month"], 2),
    }
    return result


# ─────────────────────────────────────────────────────────────
# US4 — Spoilage Risk Analytics
# GET /analytics/spoilage-risk
# ─────────────────────────────────────────────────────────────
@router.get("/spoilage-risk")
async def spoilage_risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """System / Admin: Real-time spoilage risk for active in-transit tasks."""
    active_tasks = db.query(Task).filter(
        Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_TRANSIT, TaskStatus.PICKED_UP])
    ).all()

    task_dicts = []
    for t in active_tasks:
        task_dicts.append({
            "id": str(t.id),
            "food_type": t.food_type.value if t.food_type else "VEG",
            "requires_cooling": t.requires_cooling,
            "expiry_time": t.expiry_time,
            "pickup_verified_at": t.pickup_verified_at,
            "quantity_kg": float(t.quantity_kg),
            "distance_km": float(t.distance_km) if t.distance_km else 0,
        })

    # Use historical spoilage exceptions as training labels
    spoilage_exceptions = db.query(TaskException).filter(
        TaskException.issue_type == "FOOD_SPOILED"
    ).all()

    historical = []
    for ex in spoilage_exceptions:
        parent_task = db.query(Task).filter(Task.id == ex.task_id).first()
        if parent_task:
            historical.append({
                "food_type": parent_task.food_type.value if parent_task.food_type else "VEG",
                "requires_cooling": parent_task.requires_cooling,
                "expiry_time": parent_task.expiry_time,
                "pickup_verified_at": parent_task.pickup_verified_at,
                "quantity_kg": float(parent_task.quantity_kg),
                "spoiled": True,
            })

    scored = score_spoilage_risk(task_dicts, historical if len(historical) >= 10 else None)
    high_risk = [s for s in scored if s["risk_level"] == "HIGH"]

    return {
        "total_active_tasks": len(active_tasks),
        "high_risk_count": len(high_risk),
        "risk_assessments": scored,
    }


# ─────────────────────────────────────────────────────────────
# US5 — Sustainability Credits (Gamification)
# GET  /analytics/donor/{donor_id}/credits
# POST /analytics/credits/award/{task_id}
# ─────────────────────────────────────────────────────────────
@router.get("/donor/{donor_id}/credits")
async def get_donor_credits(
    donor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Donor: View total sustainability credits and breakdown."""
    # Compute from completed tasks — 10 points per kg delivered
    tasks = db.query(Task).filter(
        Task.donor_id == donor_id,
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
    ).all()

    total_kg = sum(float(t.quantity_kg) for t in tasks)
    base_points = int(total_kg * 10)

    # Streak bonus — consecutive weeks with at least 1 delivery
    streak_weeks = _compute_streak(tasks)
    streak_bonus = streak_weeks * 50

    total_points = base_points + streak_bonus
    tier = _points_to_tier(total_points)

    # Persist to sustainability_credits — upsert-style (insert per task, skip existing)
    try:
        for t in tasks:
            db.execute(text("""
                INSERT INTO sustainability_credits (donor_id, task_id, points_earned, reason)
                VALUES (:donor_id, :task_id, :points, 'DELIVERY_COMPLETE')
                ON CONFLICT DO NOTHING
            """), {"donor_id": donor_id, "task_id": str(t.id), "points": int(float(t.quantity_kg) * 10)})
        if streak_weeks > 0:
            db.execute(text("""
                INSERT INTO sustainability_credits (donor_id, task_id, points_earned, reason)
                VALUES (:donor_id, NULL, :points, 'STREAK_BONUS')
                ON CONFLICT DO NOTHING
            """), {"donor_id": donor_id, "points": streak_bonus})
        db.commit()
    except Exception:
        db.rollback()

    return {
        "donor_id": donor_id,
        "total_points": total_points,
        "base_points": base_points,
        "streak_weeks": streak_weeks,
        "streak_bonus": streak_bonus,
        "tier": tier,
        "total_deliveries": len(tasks),
        "total_kg_contributed": round(total_kg, 2),
    }


def _compute_streak(tasks) -> int:
    if not tasks:
        return 0
    weeks = sorted({t.completed_at.isocalendar()[:2] for t in tasks if t.completed_at}, reverse=True)
    streak = 0
    for i, week in enumerate(weeks):
        if i == 0:
            streak = 1
        else:
            prev = weeks[i - 1]
            # Check consecutive ISO weeks
            if prev[0] == week[0] and prev[1] - week[1] == 1:
                streak += 1
            elif prev[0] - week[0] == 1 and week[1] == 52 and prev[1] == 1:
                streak += 1   # year boundary
            else:
                break
    return streak


def _points_to_tier(points: int) -> dict:
    if points >= 5000:
        return {"name": "Platinum", "icon": "🏆", "next_tier": None, "points_to_next": 0}
    elif points >= 2000:
        return {"name": "Gold", "icon": "🥇", "next_tier": "Platinum", "points_to_next": 5000 - points}
    elif points >= 500:
        return {"name": "Silver", "icon": "🥈", "next_tier": "Gold", "points_to_next": 2000 - points}
    else:
        return {"name": "Bronze", "icon": "🥉", "next_tier": "Silver", "points_to_next": 500 - points}


# ─────────────────────────────────────────────────────────────
# US6 — CO2 Reduction Metrics per Donor
# GET /analytics/donor/{donor_id}/co2
# ─────────────────────────────────────────────────────────────
@router.get("/donor/{donor_id}/co2")
async def donor_co2(
    donor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Donor: CO₂ reduction metrics from successful redistributions."""
    tasks = db.query(Task).filter(
        Task.donor_id == donor_id,
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
    ).all()

    total_kg = sum(float(t.quantity_kg) for t in tasks)
    # IPCC standard: ~2.5 kg CO2e saved per kg of food waste prevented
    co2_saved_kg = total_kg * 2.5
    trees_equivalent = co2_saved_kg / 21.0      # avg tree absorbs 21 kg CO2/year
    car_km_equivalent = co2_saved_kg / 0.21     # avg car ~210g CO2/km

    monthly = {}
    for t in tasks:
        key = t.completed_at.strftime("%Y-%m") if t.completed_at else "unknown"
        monthly[key] = monthly.get(key, 0) + float(t.quantity_kg) * 2.5

    return {
        "donor_id": donor_id,
        "total_food_kg_redistributed": round(total_kg, 2),
        "co2_saved_kg": round(co2_saved_kg, 2),
        "co2_saved_tonnes": round(co2_saved_kg / 1000, 4),
        "trees_equivalent_per_year": round(trees_equivalent, 1),
        "car_km_equivalent": round(car_km_equivalent, 1),
        "monthly_co2_kg": {k: round(v, 2) for k, v in sorted(monthly.items())},
        "methodology": "IPCC factor: 2.5 kg CO₂e per kg food waste prevented",
    }


# ─────────────────────────────────────────────────────────────
# US7 — Meals Served Compliance Report
# GET /analytics/ngo/{ngo_id}/meals-report
# ─────────────────────────────────────────────────────────────
@router.get("/ngo/{ngo_id}/meals-report")
async def meals_served_report(
    ngo_id: str,
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NGO: Generate Meals Served compliance report for auditing."""
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    query = db.query(Task).filter(
        Task.ngo_id == ngo_id,
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
    )

    start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end_dt = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
    if start_dt:
        query = query.filter(Task.completed_at >= start_dt)
    if end_dt:
        query = query.filter(Task.completed_at <= end_dt + timedelta(days=1))

    tasks = query.all()
    total_kg = sum(float(t.quantity_kg) for t in tasks)
    # FAO estimate: 1 kg of prepared food ≈ 4 meals
    total_meals = int(total_kg * 4)

    monthly_breakdown = {}
    for t in tasks:
        key = t.completed_at.strftime("%Y-%m") if t.completed_at else "unknown"
        if key not in monthly_breakdown:
            monthly_breakdown[key] = {"deliveries": 0, "kg": 0.0, "meals": 0}
        monthly_breakdown[key]["deliveries"] += 1
        monthly_breakdown[key]["kg"] += float(t.quantity_kg)
        monthly_breakdown[key]["meals"] += int(float(t.quantity_kg) * 4)

    return {
        "ngo_id": ngo_id,
        "ngo_name": ngo.organization_name,
        "report_period": {"start": start_date or "all-time", "end": end_date or "now"},
        "total_deliveries": len(tasks),
        "total_kg_received": round(total_kg, 2),
        "total_meals_served": total_meals,
        "monthly_breakdown": monthly_breakdown,
        "audit_note": "Meals calculated at FAO standard: 4 meals per kg food received",
        "generated_at": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# US8 — Fraud Detection Analytics (Isolation Forest)
# GET /analytics/fraud-flags
# ─────────────────────────────────────────────────────────────
@router.get("/fraud-flags")
async def fraud_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Automated fraud detection using Isolation Forest anomaly detection."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")

    # ---- Build donor feature vectors ----
    donors = db.query(Donor).all()
    donor_rows = []
    for d in donors:
        tasks = db.query(Task).filter(Task.donor_id == d.id).all()
        if not tasks:
            continue
        total = len(tasks)
        cancelled = sum(1 for t in tasks if t.status == TaskStatus.CANCELLED)
        kgs = [float(t.quantity_kg) for t in tasks]
        # Days between donations
        dates = sorted([t.created_at for t in tasks if t.created_at])
        freq_days = [(dates[i+1]-dates[i]).days for i in range(len(dates)-1)]
        donor_rows.append({
            "donor_id": str(d.id),
            "avg_claimed_kg_per_task": sum(kgs) / total,
            "max_single_claim_kg": max(kgs),
            "cancellation_rate": cancelled / total,
            "claim_frequency_days": sum(freq_days) / max(len(freq_days), 1),
        })

    # ---- Build NGO feature vectors ----
    ngos = db.query(NGO).all()
    ngo_rows = []
    for n in ngos:
        tasks = db.query(Task).filter(
            Task.ngo_id == n.id,
            Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
        ).all()
        if not tasks:
            continue
        kgs = [float(t.quantity_kg) for t in tasks]
        # Max kg received in any single day
        from collections import defaultdict
        daily: dict = defaultdict(float)
        for t in tasks:
            day = (t.completed_at or t.created_at).date() if (t.completed_at or t.created_at) else None
            if day:
                daily[day] += float(t.quantity_kg)
        max_daily = max(daily.values()) if daily else 0.0
        capacity = n.capacity_kg or 1
        ngo_rows.append({
            "ngo_id": str(n.id),
            "avg_received_kg_per_task": sum(kgs) / len(kgs),
            "max_single_receipt_kg": max(kgs),
            "daily_receipt_vs_capacity_ratio": max_daily / capacity,
            "total_tasks_last_30_days": sum(
                1 for t in tasks
                if t.completed_at and t.completed_at >= datetime.utcnow() - timedelta(days=30)
            ),
        })

    donor_flags = detect_donor_fraud(donor_rows)
    ngo_flags = detect_ngo_fraud(ngo_rows)
    all_flags = sorted(donor_flags + ngo_flags, key=lambda x: x["anomaly_score"], reverse=True)

    # Persist fraud flags to DB (skip already-saved ones via conflict handling)
    try:
        for flag in all_flags:
            db.execute(text("""
                INSERT INTO fraud_flags (entity_type, entity_id, anomaly_score, reason)
                VALUES (:etype, :eid, :score, :reason)
                ON CONFLICT DO NOTHING
            """), {
                "etype": flag["entity_type"],
                "eid": flag["entity_id"],
                "score": flag["anomaly_score"],
                "reason": flag.get("reason", ""),
            })
        db.commit()
    except Exception:
        db.rollback()

    return {
        "total_flagged": len(all_flags),
        "donor_flags": len(donor_flags),
        "ngo_flags": len(ngo_flags),
        "flags": all_flags,
        "model_used": "Isolation Forest (scikit-learn, contamination=0.1)",
        "generated_at": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# US9 — City-Level Impact Dashboard (Public)
# GET /analytics/city-impact
# ─────────────────────────────────────────────────────────────
@router.get("/city-impact")
async def city_impact(db: Session = Depends(get_db)):
    """Public: City-level impact dashboard — total kg, CO2, meals, volunteers, NGOs."""
    completed_tasks = db.query(Task).filter(
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED])
    ).all()

    total_kg = sum(float(t.quantity_kg) for t in completed_tasks)
    total_meals = int(total_kg * 4)
    co2_saved_kg = total_kg * 2.5
    total_tasks = len(completed_tasks)

    active_volunteers = db.query(func.count(Volunteer.id)).filter(
        Volunteer.total_deliveries > 0
    ).scalar() or 0

    active_ngos = db.query(func.count(NGO.id)).filter(
        NGO.total_claims > 0
    ).scalar() or 0

    # Week-over-week growth
    week_ago = datetime.utcnow() - timedelta(days=7)
    this_week = sum(
        float(t.quantity_kg) for t in completed_tasks
        if (t.completed_at or t.created_at) and (t.completed_at or t.created_at) >= week_ago
    )

    return {
        "total_kg_rescued": round(total_kg, 2),
        "total_meals_served": total_meals,
        "co2_saved_kg": round(co2_saved_kg, 2),
        "co2_saved_tonnes": round(co2_saved_kg / 1000, 3),
        "total_deliveries": total_tasks,
        "active_volunteers": int(active_volunteers),
        "active_ngos": int(active_ngos),
        "kg_rescued_this_week": round(this_week, 2),
        "last_updated": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# US10 — Volunteer Performance Analytics Comparison
# GET /analytics/volunteer/{volunteer_id}/perf
# ─────────────────────────────────────────────────────────────
@router.get("/volunteer/{volunteer_id}/perf")
async def volunteer_performance(
    volunteer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Volunteer: Performance analytics vs city average."""
    vol = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    vol_tasks = db.query(Task).filter(Task.volunteer_id == volunteer_id).all()
    vol_completed = [t for t in vol_tasks if t.status in [TaskStatus.DELIVERED, TaskStatus.COMPLETED]]
    vol_cancelled = [t for t in vol_tasks if t.status == TaskStatus.CANCELLED]

    vol_kg = sum(float(t.quantity_kg) for t in vol_completed)
    vol_perf = db.query(PerformanceStat).filter(PerformanceStat.volunteer_id == volunteer_id).all()
    vol_avg_time = sum(p.completion_time_minutes or 0 for p in vol_perf) / max(len(vol_perf), 1)
    vol_on_time_pct = (sum(1 for p in vol_perf if p.on_time) / max(len(vol_perf), 1)) * 100

    # City averages across all volunteers
    city_perfs = db.query(PerformanceStat).all()
    city_avg_time = sum(p.completion_time_minutes or 0 for p in city_perfs) / max(len(city_perfs), 1)
    city_on_time = (sum(1 for p in city_perfs if p.on_time) / max(len(city_perfs), 1)) * 100
    city_deliveries = db.query(func.avg(Volunteer.total_deliveries)).scalar() or 0

    return {
        "volunteer_id": volunteer_id,
        "volunteer_name": vol.user.full_name if vol.user else "Unknown",
        "my_stats": {
            "total_deliveries": len(vol_completed),
            "cancellation_rate_pct": round(len(vol_cancelled) / max(len(vol_tasks), 1) * 100, 1),
            "total_kg_delivered": round(vol_kg, 2),
            "avg_completion_minutes": round(vol_avg_time, 1),
            "on_time_percentage": round(vol_on_time_pct, 1),
            "rating": float(vol.rating) if vol.rating else 5.0,
        },
        "city_avg": {
            "avg_deliveries": round(float(city_deliveries), 1),
            "avg_completion_minutes": round(city_avg_time, 1),
            "on_time_percentage": round(city_on_time, 1),
        },
        "comparison": {
            "deliveries_vs_avg": round(len(vol_completed) - float(city_deliveries), 1),
            "completion_time_delta": round(city_avg_time - vol_avg_time, 1),
            "on_time_delta_pct": round(vol_on_time_pct - city_on_time, 1),
        },
    }


# ─────────────────────────────────────────────────────────────
# US11 — Nutritional Breakdown Analytics
# GET /analytics/ngo/{ngo_id}/nutrition
# ─────────────────────────────────────────────────────────────
@router.get("/ngo/{ngo_id}/nutrition")
async def ngo_nutrition(
    ngo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NGO: Nutritional breakdown of all received food for diet planning."""
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    NUTRITION_PER_KG = {
        "VEG":     {"calories": 800,  "protein_g": 22, "carbs_g": 150, "fat_g": 8,  "fiber_g": 18},
        "NON_VEG": {"calories": 1500, "protein_g": 80, "carbs_g": 50,  "fat_g": 60, "fiber_g": 5},
        "VEGAN":   {"calories": 700,  "protein_g": 18, "carbs_g": 160, "fat_g": 5,  "fiber_g": 22},
        "MIXED":   {"calories": 1050, "protein_g": 48, "carbs_g": 105, "fat_g": 32, "fiber_g": 12},
    }

    tasks = db.query(Task).filter(
        Task.ngo_id == ngo_id,
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
    ).all()

    totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0}
    by_type: dict = {}

    for t in tasks:
        ft = t.food_type.value if t.food_type else "MIXED"
        kg = float(t.quantity_kg)
        nutrients = NUTRITION_PER_KG.get(ft, NUTRITION_PER_KG["MIXED"])

        for key in totals:
            totals[key] += nutrients[key] * kg

        if ft not in by_type:
            by_type[ft] = {"total_kg": 0, **{k: 0 for k in totals}}
        by_type[ft]["total_kg"] += kg
        for key in totals:
            by_type[ft][key] += nutrients[key] * kg

    total_kg = sum(float(t.quantity_kg) for t in tasks)
    total_meals = int(total_kg * 4)

    # Round everything
    for key in totals:
        totals[key] = round(totals[key], 1)
    for ft in by_type:
        for key in list(by_type[ft].keys()):
            by_type[ft][key] = round(by_type[ft][key], 1) if isinstance(by_type[ft][key], float) else by_type[ft][key]

    return {
        "ngo_id": ngo_id,
        "ngo_name": ngo.organization_name,
        "total_kg_received": round(total_kg, 2),
        "total_meals_estimated": total_meals,
        "cumulative_nutrition": totals,
        "per_food_type": by_type,
        "note": "Based on ICMR/FAO average nutritional values per food category",
    }


# ─────────────────────────────────────────────────────────────
# US12 — Waste Hotspot Geospatial Heatmap
# GET /analytics/waste-hotspots
# ─────────────────────────────────────────────────────────────
@router.get("/waste-hotspots")
async def waste_hotspots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin / City Planner: Lat/lng of cancelled/spoiled tasks for heatmap."""
    cancelled = db.query(Task).filter(Task.status == TaskStatus.CANCELLED).all()
    spoiled_exceptions = db.query(TaskException).filter(
        TaskException.issue_type == "FOOD_SPOILED"
    ).all()

    hotspots = []
    for t in cancelled:
        lat = t.pickup_lat
        lng = t.pickup_lng
        if lat and lng:
            hotspots.append({
                "lat": float(lat), "lng": float(lng),
                "type": "CANCELLED",
                "quantity_kg": float(t.quantity_kg),
                "food_type": t.food_type.value if t.food_type else None,
                "date": t.cancelled_at.isoformat() if t.cancelled_at else None,
            })

    for ex in spoiled_exceptions:
        if ex.location:
            from geoalchemy2.shape import to_shape
            try:
                pt = to_shape(ex.location)
                hotspots.append({
                    "lat": pt.y, "lng": pt.x,
                    "type": "SPOILED",
                    "quantity_kg": None,
                    "food_type": None,
                    "date": ex.reported_at.isoformat() if ex.reported_at else None,
                })
            except Exception:
                pass

    return {
        "total_hotspots": len(hotspots),
        "cancelled_count": len(cancelled),
        "spoiled_count": len(spoiled_exceptions),
        "hotspots": hotspots,
    }


# ─────────────────────────────────────────────────────────────
# US13 — Cost Saving & Tax Benefit Report
# GET /analytics/donor/{donor_id}/tax-report
# ─────────────────────────────────────────────────────────────
@router.get("/donor/{donor_id}/tax-report")
async def tax_report(
    donor_id: str,
    financial_year: Optional[str] = Query(None, description="e.g. 2024-25"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Corporate Donor: Cost saving & estimated tax benefit report."""
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    # Determine financial year window (April–March, India)
    if financial_year:
        yr_start = int(financial_year.split("-")[0])
        window_start = datetime(yr_start, 4, 1)
        window_end = datetime(yr_start + 1, 3, 31, 23, 59, 59)
    else:
        window_start = datetime(datetime.utcnow().year, 4, 1)
        window_end = datetime.utcnow()

    tasks = db.query(Task).filter(
        Task.donor_id == donor_id,
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED]),
        Task.completed_at >= window_start,
        Task.completed_at <= window_end,
    ).all()

    total_kg = sum(float(t.quantity_kg) for t in tasks)
    # Market value estimate: ₹50/kg average prepared food
    donation_value_inr = total_kg * 50
    # India: Section 80GGA allows 100% deduction for scientific/social donations
    tax_deduction_inr = donation_value_inr * 1.0
    # Assuming 30% tax bracket
    tax_saving_inr = tax_deduction_inr * 0.30

    # GST credit estimate for food sector: ~5% on inputs
    gst_credit_inr = donation_value_inr * 0.05

    return {
        "donor_id": donor_id,
        "donor_name": donor.user.full_name if donor.user else "Unknown",
        "organization": donor.organization_name,
        "financial_year": financial_year or f"{window_start.year}-{str(window_start.year+1)[-2:]}",
        "window": {
            "from": window_start.strftime("%Y-%m-%d"),
            "to": window_end.strftime("%Y-%m-%d"),
        },
        "donations_count": len(tasks),
        "total_kg_donated": round(total_kg, 2),
        "financials": {
            "estimated_donation_value_inr": round(donation_value_inr, 2),
            "tax_deduction_eligible_inr": round(tax_deduction_inr, 2),
            "estimated_tax_saving_inr": round(tax_saving_inr, 2),
            "estimated_gst_credit_inr": round(gst_credit_inr, 2),
        },
        "legal_basis": "Income Tax Act Section 80GGA (India) — 100% deduction on eligible donations",
        "disclaimer": "This is an indicative estimate. Consult your CA for exact figures.",
        "generated_at": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# US14 — Sentiment Analysis (NLP) on NGO Feedback
# POST /analytics/sentiment/analyze
# ─────────────────────────────────────────────────────────────
@router.post("/sentiment/analyze")
async def sentiment_analysis(
    request: SentimentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin / System: VADER NLP sentiment analysis on NGO feedback text."""
    result = analyze_sentiment(request.text)

    # Optionally persist to ngo_feedback_sentiments table
    if request.save_to_db and request.task_id:
        try:
            db.execute(text("""
                INSERT INTO ngo_feedback_sentiments
                    (task_id, raw_feedback, compound_score, label, analyzed_at)
                VALUES
                    (:task_id, :feedback, :compound, :label, NOW())
                ON CONFLICT DO NOTHING
            """), {
                "task_id": request.task_id,
                "feedback": request.text,
                "compound": result["compound"],
                "label": result["label"],
            })
            db.commit()
        except Exception:
            pass  # Non-critical — don't fail the API call

    return result


@router.post("/sentiment/batch")
async def sentiment_batch(
    texts: list[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch sentiment analysis for multiple feedback strings."""
    return analyze_batch(texts)


@router.get("/ngo/{ngo_id}/sentiment")
async def ngo_sentiment_summary(
    ngo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated sentiment score for all feedback received by an NGO."""
    perf_rows = db.query(PerformanceStat).join(
        Task, PerformanceStat.task_id == Task.id
    ).filter(
        Task.ngo_id == ngo_id,
        PerformanceStat.feedback.isnot(None),
    ).all()

    feedback_texts = [p.feedback for p in perf_rows if p.feedback]
    if not feedback_texts:
        return {"ngo_id": ngo_id, "message": "No feedback found", "avg_stars": None}

    summary = analyze_batch(feedback_texts)
    summary["ngo_id"] = ngo_id
    summary["feedback_count"] = len(feedback_texts)
    return summary


# ─────────────────────────────────────────────────────────────
# US15 — Predictive Route Efficiency Analysis
# GET /analytics/route-efficiency
# ─────────────────────────────────────────────────────────────
@router.get("/route-efficiency")
async def route_efficiency(
    days_back: int = Query(90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Ridge Regression route efficiency analysis to optimise logistics."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")

    cutoff = datetime.utcnow() - timedelta(days=days_back)

    sessions = db.query(TrackingSession).filter(
        TrackingSession.end_time.isnot(None),
        TrackingSession.start_time >= cutoff,
    ).all()

    delivery_rows = []
    for s in sessions:
        task = db.query(Task).filter(Task.id == s.task_id).first()
        if not task:
            continue
        vol = db.query(Volunteer).filter(Volunteer.id == s.volunteer_id).first()
        dur_mins = ((s.end_time - s.start_time).total_seconds() / 60) if s.end_time and s.start_time else None

        delivery_rows.append({
            "volunteer_id": str(s.volunteer_id) if s.volunteer_id else None,
            "vehicle_type": vol.vehicle_type.value if vol and vol.vehicle_type else "SCOOTER",
            "distance_km": float(task.distance_km) if task.distance_km else 0,
            "distance_traveled_km": float(s.distance_traveled_km) if s.distance_traveled_km else 0,
            "completion_time_minutes": dur_mins,
            "pickup_lat": task.pickup_lat,
            "pickup_lng": task.pickup_lng,
        })

    result = analyze_route_efficiency(delivery_rows)
    result["window_days"] = days_back
    return result
