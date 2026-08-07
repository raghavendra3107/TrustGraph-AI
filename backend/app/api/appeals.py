from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.models import Appeal, Transaction, User
from app.schemas.schemas import AppealCreate, AppealUpdate, AppealResponse
from app.api.auth import get_current_user
from app.core.notifications import notification_manager
import datetime

router = APIRouter()

@router.post("/", response_model=AppealResponse, status_code=201)
async def create_appeal(
    appeal_in: AppealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate transaction exists
    tx = db.query(Transaction).filter(Transaction.id == appeal_in.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check if appeal already exists
    existing_appeal = db.query(Appeal).filter(Appeal.transaction_id == appeal_in.transaction_id).first()
    if existing_appeal:
        raise HTTPException(status_code=400, detail="An appeal has already been submitted for this transaction.")

    # Create appeal
    appeal = Appeal(
        transaction_id=appeal_in.transaction_id,
        user_email=current_user.email,
        reason=appeal_in.reason,
        status="pending"
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)

    # Broadcast new appeal notification via WebSocket
    appeal_payload = {
        "type": "NEW_APPEAL",
        "data": {
            "id": appeal.id,
            "transaction_id": appeal.transaction_id,
            "transaction_code": tx.transaction_id,
            "user_email": appeal.user_email,
            "reason": appeal.reason,
            "status": appeal.status,
            "amount": tx.amount,
            "created_at": appeal.created_at.isoformat() if hasattr(appeal.created_at, "isoformat") else str(appeal.created_at)
        }
    }
    await notification_manager.broadcast(appeal_payload)

    return appeal

@router.get("/", response_model=List[AppealResponse])
def read_appeals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If the user is merchant, only show their own appeals
    if current_user.role == "merchant":
        return db.query(Appeal).filter(Appeal.user_email == current_user.email).order_by(Appeal.created_at.desc()).all()
    
    # Otherwise (admin/analyst), show all appeals
    return db.query(Appeal).order_by(Appeal.created_at.desc()).all()

@router.get("/{appeal_id}", response_model=AppealResponse)
def read_appeal(
    appeal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")
        
    if current_user.role == "merchant" and appeal.user_email != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized to view this appeal")
        
    return appeal

@router.put("/{appeal_id}", response_model=AppealResponse)
async def update_appeal(
    appeal_id: int,
    appeal_update: AppealUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only analysts can update appeal decisions
    if current_user.role != "analyst":
        raise HTTPException(status_code=403, detail="Only analysts can approve or reject appeals.")

    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    appeal.status = appeal_update.status
    appeal.analyst_feedback = appeal_update.analyst_feedback

    # Update the linked transaction status accordingly
    tx = db.query(Transaction).filter(Transaction.id == appeal.transaction_id).first()
    if tx:
        if appeal_update.status == "approved":
            tx.status = "approved"  # Override fraud flag if approved
            tx.is_flagged = False
        elif appeal_update.status == "rejected":
            tx.status = "blocked"
            tx.is_flagged = True

    db.commit()
    db.refresh(appeal)

    # Broadcast appeal decision event via WebSocket
    event_type = "APPEAL_APPROVED" if appeal.status == "approved" else "APPEAL_REJECTED"
    appeal_payload = {
        "type": event_type,
        "data": {
            "id": appeal.id,
            "transaction_id": appeal.transaction_id,
            "transaction_code": tx.transaction_id if tx else "unknown",
            "user_email": appeal.user_email,
            "status": appeal.status,
            "analyst_feedback": appeal.analyst_feedback,
            "updated_at": datetime.datetime.utcnow().isoformat()
        }
    }
    await notification_manager.broadcast(appeal_payload)

    return appeal
