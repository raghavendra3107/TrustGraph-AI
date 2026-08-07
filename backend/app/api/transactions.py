from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.models import Transaction, Alert, User
from app.schemas.schemas import TransactionCreate, TransactionResponse
from app.api.auth import get_current_user
from app.services.fraud import hybrid_risk_engine
from app.services.graph import graph_analyzer
from app.core.notifications import notification_manager
import datetime

router = APIRouter()

@router.get("/", response_model=List[TransactionResponse])
def read_transactions(
    status: Optional[str] = None,
    is_flagged: Optional[bool] = None,
    user_email: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Transaction)
    
    if status:
        query = query.filter(Transaction.status == status)
    if is_flagged is not None:
        query = query.filter(Transaction.is_flagged == is_flagged)
    if user_email:
        query = query.filter(Transaction.user_email == user_email)
        
    return query.order_by(Transaction.transaction_time.desc()).offset(offset).limit(limit).all()

@router.get("/{tx_id}", response_model=TransactionResponse)
def read_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    tx_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify transaction ID is unique
    existing_tx = db.query(Transaction).filter(Transaction.transaction_id == tx_in.transaction_id).first()
    if existing_tx:
        raise HTTPException(status_code=400, detail="Transaction ID already exists")

    # Fetch recent transactions to compute velocity
    one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    recent_count = db.query(Transaction).filter(
        Transaction.user_email == tx_in.user_email,
        Transaction.transaction_time >= one_hour_ago
    ).count()

    # Calculate graph collusion score dynamically
    collusion_score = graph_analyzer.calculate_collusion_score(
        db=db,
        user_email=tx_in.user_email,
        device_id=tx_in.device_id,
        ip_address=tx_in.ip_address,
        billing_address=tx_in.billing_address
    )

    # Calculate risk score using the hybrid risk engine
    fraud_score, report = hybrid_risk_engine.calculate_hybrid_risk(
        db=db,
        amount=tx_in.amount,
        merchant_category=tx_in.merchant_category,
        ip_address=tx_in.ip_address,
        device_id=tx_in.device_id,
        billing_address=tx_in.billing_address,
        shipping_address=tx_in.shipping_address,
        velocity_count=recent_count + 1,
        graph_collusion_score=collusion_score
    )

    # Determine status based on risk score threshold
    status_str = "approved"
    is_flagged = False
    if fraud_score >= 70.0:
        status_str = "blocked"
        is_flagged = True
    elif fraud_score >= 40.0:
        status_str = "flagged"
        is_flagged = True

    # Create transaction instance
    tx = Transaction(
        transaction_id=tx_in.transaction_id,
        user_email=tx_in.user_email,
        amount=tx_in.amount,
        currency=tx_in.currency,
        merchant_category=tx_in.merchant_category,
        ip_address=tx_in.ip_address,
        device_id=tx_in.device_id,
        card_hash=tx_in.card_hash,
        billing_address=tx_in.billing_address,
        shipping_address=tx_in.shipping_address,
        seller_id=tx_in.seller_id,
        delivery_partner=tx_in.delivery_partner,
        fraud_score=fraud_score,
        is_flagged=is_flagged,
        status=status_str,
        risk_explanation=report["flagged_reason"]
    )
    
    db.add(tx)
    db.commit()
    db.refresh(tx)

    # If flagged, create alert and broadcast via websocket
    if is_flagged:
        severity = "critical" if fraud_score >= 80 else ("high" if fraud_score >= 60 else "medium")
        alert = Alert(
            transaction_id=tx.id,
            severity=severity,
            message=f"High risk score {fraud_score}% detected for Transaction {tx.transaction_id}",
            is_resolved=False
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        
        # Broadcast alert to all active websocket connections
        alert_payload = {
            "type": "NEW_ALERT",
            "data": {
                "id": alert.id,
                "transaction_id": tx.id,
                "transaction_code": tx.transaction_id,
                "severity": severity,
                "message": alert.message,
                "fraud_score": fraud_score,
                "amount": tx.amount,
                "user_email": tx.user_email,
                "created_at": alert.created_at.isoformat()
            }
        }
        await notification_manager.broadcast(alert_payload)

    return tx
