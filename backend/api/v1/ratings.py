from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from database import get_db
from models import Task, TaskStatus, PerformanceStat, Volunteer
from utils.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/ratings", tags=["Ratings"])


class TaskRating(BaseModel):
    rating: float = Field(..., ge=1.0, le=5.0, description="Rating from 1.0 to 5.0")
    feedback: Optional[str] = Field(None, description="Optional feedback text")


class RatingResponse(BaseModel):
    task_id: str
    volunteer_id: str
    rating: float
    feedback: Optional[str]
    rated_at: datetime

    class Config:
        from_attributes = True


@router.post("/tasks/{task_id}/rate", response_model=RatingResponse)
async def rate_task(
    task_id: str,
    rating_data: TaskRating,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Rate a completed task (donor/NGO can rate volunteer)"""

    # Get task
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Verify task is completed
    if task.status != TaskStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate completed tasks"
        )

    # Verify current user is donor or NGO for this task
    from models import Donor, NGO
    donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()

    is_donor = donor and task.donor_id == donor.id
    is_ngo = ngo and task.ngo_id == ngo.id

    if not (is_donor or is_ngo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the donor or NGO associated with this task can rate it"
        )

    # Check if already rated
    if task.rating is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task has already been rated"
        )

    # Update task rating
    task.rating = rating_data.rating
    task.rating_feedback = rating_data.feedback
    task.rated_at = datetime.utcnow()

    # Create performance stat record for this task
    if task.volunteer_id:
        # Create a performance stat entry for this completed task
        db.add(PerformanceStat(
            volunteer_id=task.volunteer_id,
            task_id=task.id,
            on_time=True,  # Could be calculated based on delivery time vs estimate
            rating=int(rating_data.rating),
            feedback=rating_data.feedback
        ))

    db.commit()
    db.refresh(task)

    return {
        "task_id": str(task.id),
        "volunteer_id": str(task.volunteer_id) if task.volunteer_id else None,
        "rating": task.rating,
        "feedback": task.rating_feedback,
        "rated_at": task.rated_at
    }


@router.get("/volunteers/{volunteer_id}/ratings", response_model=List[RatingResponse])
async def get_volunteer_ratings(
    volunteer_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get all ratings for a volunteer"""

    # Check volunteer exists
    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer not found"
        )

    # Get rated tasks
    tasks = db.query(Task).filter(
        Task.volunteer_id == volunteer_id,
        Task.rating.isnot(None)
    ).order_by(Task.rated_at.desc()).offset(skip).limit(limit).all()

    return [
        {
            "task_id": str(task.id),
            "volunteer_id": str(task.volunteer_id) if task.volunteer_id else None,
            "rating": task.rating,
            "feedback": task.rating_feedback,
            "rated_at": task.rated_at
        }
        for task in tasks
    ]


@router.get("/volunteers/{volunteer_id}/summary")
async def get_volunteer_rating_summary(
    volunteer_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get rating summary for a volunteer"""

    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer not found"
        )

    # Count ratings by star from Task table
    from sqlalchemy import func
    rating_distribution = db.query(
        func.count(Task.id).label('count'),
        Task.rating.label('rating')
    ).filter(
        Task.volunteer_id == volunteer_id,
        Task.rating.isnot(None)
    ).group_by(Task.rating).all()

    total_ratings = sum(r.count for r in rating_distribution)

    # Calculate average rating from tasks
    avg_rating_result = db.query(func.avg(Task.rating)).filter(
        Task.volunteer_id == volunteer_id,
        Task.rating.isnot(None)
    ).scalar()
    average_rating = float(avg_rating_result) if avg_rating_result else 0.0

    # Count total deliveries
    total_deliveries = db.query(func.count(Task.id)).filter(
        Task.volunteer_id == volunteer_id,
        Task.status == TaskStatus.DELIVERED
    ).scalar() or 0

    distribution = {
        "5_star": 0,
        "4_star": 0,
        "3_star": 0,
        "2_star": 0,
        "1_star": 0
    }

    for rating in rating_distribution:
        if rating.rating >= 4.5:
            distribution["5_star"] += rating.count
        elif rating.rating >= 3.5:
            distribution["4_star"] += rating.count
        elif rating.rating >= 2.5:
            distribution["3_star"] += rating.count
        elif rating.rating >= 1.5:
            distribution["2_star"] += rating.count
        else:
            distribution["1_star"] += rating.count

    return {
        "volunteer_id": volunteer_id,
        "average_rating": round(average_rating, 2),
        "total_ratings": total_ratings,
        "distribution": distribution,
        "total_deliveries": total_deliveries
    }
