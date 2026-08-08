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

def get_merchant_seller_id(email: str) -> str:
    mapping = {
        "merchant@trustgraph.ai": "SELL_APEX_STORE",
        "apple@trustgraph.ai": "SELL_APPLE_STORE",
        "dell@trustgraph.ai": "SELL_DELL_STORE",
        "hp@trustgraph.ai": "SELL_HP_STORE",
        "fashion@trustgraph.ai": "SELL_FASHION_STORE"
    }
    return mapping.get(email, "SELL_APEX_STORE")

@router.get("/", response_model=List[AppealResponse])
def read_appeals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Apply RBAC filters
    if current_user.role == "merchant":
        seller_id = current_user.seller_id or get_merchant_seller_id(current_user.email)
        return db.query(Appeal).join(Transaction).filter(Transaction.seller_id == seller_id).order_by(Appeal.created_at.desc()).all()
    
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
        
    user_seller_id = current_user.seller_id or get_merchant_seller_id(current_user.email)
    if current_user.role == "merchant" and appeal.transaction.seller_id != user_seller_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this appeal")
        
    return appeal

@router.put("/{appeal_id}", response_model=AppealResponse)
async def update_appeal(
    appeal_id: int,
    appeal_update: AppealUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Admins are read-only and cannot make decisions.")

    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    tx = db.query(Transaction).filter(Transaction.id == appeal.transaction_id).first()

    if current_user.role == "analyst":
        # Analyst can only update: investigation_status, investigation_notes, analyst_recommendation
        if (appeal_update.status is not None or 
            appeal_update.merchant_final_decision is not None or 
            appeal_update.final_order_status is not None):
            raise HTTPException(status_code=403, detail="Analysts cannot make the final merchant decision.")

        if appeal_update.investigation_status:
            appeal.investigation_status = appeal_update.investigation_status
            appeal.analyst_recommendation = appeal_update.investigation_status
        if appeal_update.investigation_notes:
            appeal.investigation_notes = appeal_update.investigation_notes
            appeal.analyst_feedback = appeal_update.investigation_notes
            
        db.commit()
        db.refresh(appeal)

        # Broadcast investigation report event via WebSocket with seller_id metadata
        investigation_payload = {
            "type": "ANALYST_INVESTIGATION_SUBMITTED",
            "data": {
                "id": appeal.id,
                "transaction_id": appeal.transaction_id,
                "transaction_code": tx.transaction_id if tx else "unknown",
                "seller_id": tx.seller_id if tx else "unknown",
                "product_name": tx.product_name if tx else "unknown",
                "seller_name": tx.seller_name if tx else "unknown",
                "user_email": appeal.user_email,
                "fraud_score": tx.fraud_score if tx else 0.0,
                "risk_level": "HIGH" if (tx and tx.fraud_score >= 70) else ("MEDIUM" if (tx and tx.fraud_score >= 40) else "LOW"),
                "investigation_status": appeal.investigation_status,
                "analyst_recommendation": appeal.analyst_recommendation,
                "investigation_notes": appeal.investigation_notes,
                "message": f"New Fraud Investigation: Security Analyst completed investigation for {tx.product_name if tx else 'order'}. Merchant decision required.",
                "updated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        await notification_manager.broadcast(investigation_payload)
        return appeal

    elif current_user.role == "merchant":
        # Merchant can only update: merchant_final_decision, merchant_decision_timestamp (or final_order_status)
        if (appeal_update.investigation_status is not None or 
            appeal_update.investigation_notes is not None or 
            appeal_update.analyst_recommendation is not None or 
            appeal_update.analyst_feedback is not None):
            raise HTTPException(status_code=403, detail="Merchants cannot edit analyst investigation notes or recommendations.")

        decision = appeal_update.final_order_status or appeal_update.merchant_final_decision
        if not decision:
            raise HTTPException(status_code=400, detail="Merchant must provide a final decision ('approved' or 'rejected')")

        # Verify the merchant owns the transaction
        user_seller_id = current_user.seller_id or get_merchant_seller_id(current_user.email)
        if tx and tx.seller_id != user_seller_id:
            raise HTTPException(status_code=403, detail="Not authorized to make a decision for this transaction")

        appeal.merchant_final_decision = decision
        appeal.final_order_status = decision
        appeal.merchant_decision_timestamp = datetime.datetime.utcnow()
        appeal.status = decision  # Update the appeal's overall resolution status

        # Update the linked transaction status accordingly
        if tx:
            if decision == "approved":
                tx.status = "approved"
                tx.is_flagged = False
            elif decision == "rejected":
                tx.status = "blocked"
                tx.is_flagged = False

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
                "seller_id": tx.seller_id if tx else "unknown",
                "user_email": appeal.user_email,
                "status": appeal.status,
                "merchant_final_decision": appeal.merchant_final_decision,
                "merchant_decision_timestamp": appeal.merchant_decision_timestamp.isoformat() if appeal.merchant_decision_timestamp else None,
                "updated_at": datetime.datetime.utcnow().isoformat()
            }
        }
        await notification_manager.broadcast(appeal_payload)
        return appeal

    else:
        raise HTTPException(status_code=403, detail="Only Security Analysts and Merchants can update appeals.")
