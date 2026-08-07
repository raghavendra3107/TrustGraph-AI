from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.models import Appeal, Transaction, User
from app.schemas.schemas import AppealCreate, AppealUpdate, AppealResponse
from app.api.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=AppealResponse, status_code=201)
def create_appeal(
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
        raise HTTPException(status_code=400, detail="Appeal already exists for this transaction")

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
def update_appeal(
    appeal_id: int,
    appeal_update: AppealUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only analysts and admins can update appeal decisions
    if current_user.role not in ["analyst", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to update appeals")

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
    return appeal
