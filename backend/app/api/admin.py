from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.db.session import get_db
from app.models.models import Transaction, Appeal, Alert, User, SystemSetting
from app.schemas.schemas import DashboardStats, AlertResponse, SystemSettingsUpdate
from app.api.auth import get_current_user, get_current_admin
import datetime

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Total transaction count
    total_txs = db.query(Transaction).count()
    
    # Approved, blocked, and pending reviews count
    approved_txs = db.query(Transaction).filter(Transaction.status == "approved").count()
    blocked_txs = db.query(Transaction).filter(Transaction.status == "blocked").count()
    pending_reviews = db.query(Transaction).filter(Transaction.status == "flagged").count()
    
    # Appeals metrics
    total_appeals = db.query(Appeal).count()
    pending_appeals = db.query(Appeal).filter(Appeal.status == "pending").count()
    
    # High risk transaction count (score >= 80)
    high_risk_txs = db.query(Transaction).filter(Transaction.fraud_score >= 80.0).count()
    
    # Fraud Rate = (Flagged/Blocked transactions) / Total * 100
    flagged_count = db.query(Transaction).filter(Transaction.is_flagged == True).count()
    fraud_rate = round((flagged_count / total_txs * 100), 2) if total_txs > 0 else 0.0
    
    # Active alerts (unresolved)
    active_alerts = db.query(Alert).filter(Alert.is_resolved == False).count()
    
    # Revenue at risk: sum of amount for all blocked/flagged transactions in the last 30 days
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    revenue_at_risk = db.query(func.sum(Transaction.amount)).filter(
        Transaction.is_flagged == True,
        Transaction.transaction_time >= thirty_days_ago
    ).scalar() or 0.0
    revenue_at_risk = round(revenue_at_risk, 2)

    # Monthly trends (Simulated monthly chart data from db transactions)
    trends = []
    for i in range(6, -1, -1):
        day = datetime.datetime.utcnow() - datetime.timedelta(days=i)
        start_of_day = datetime.datetime(day.year, day.month, day.day, 0, 0, 0)
        end_of_day = datetime.datetime(day.year, day.month, day.day, 23, 59, 59)
        
        tx_count = db.query(Transaction).filter(
            Transaction.transaction_time >= start_of_day,
            Transaction.transaction_time <= end_of_day
        ).count()
        
        fraud_count = db.query(Transaction).filter(
            Transaction.is_flagged == True,
            Transaction.transaction_time >= start_of_day,
            Transaction.transaction_time <= end_of_day
        ).count()

        trends.append({
            "name": day.strftime("%b %d"),
            "transactions": tx_count,
            "fraud": fraud_count
        })

    # Risk Distribution: categories 0-20, 21-40, 41-60, 61-80, 81-100
    ranges = [
        ("0-20", 0, 20),
        ("21-40", 21, 40),
        ("41-60", 41, 60),
        ("61-80", 61, 80),
        ("81-100", 81, 100)
    ]
    risk_distribution = []
    for label, low, high in ranges:
        count = db.query(Transaction).filter(
            Transaction.fraud_score >= low,
            Transaction.fraud_score <= high
        ).count()
        risk_distribution.append({
            "range": label,
            "count": count
        })

    return {
        "total_transactions": total_txs,
        "approved_transactions": approved_txs,
        "blocked_transactions": blocked_txs,
        "pending_reviews": pending_reviews,
        "total_appeals": total_appeals,
        "fraud_rate": fraud_rate,
        "high_risk_transactions": high_risk_txs,
        "pending_appeals": pending_appeals,
        "active_alerts": active_alerts,
        "revenue_at_risk": revenue_at_risk,
        "monthly_trends": trends,
        "risk_distribution": risk_distribution
    }

@router.get("/alerts", response_model=List[AlertResponse])
def get_alerts(
    resolved: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Alert).filter(Alert.is_resolved == resolved).order_by(Alert.created_at.desc()).all()

@router.put("/alerts/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.is_resolved = True
    db.commit()
    db.refresh(alert)
    return alert

@router.get("/settings")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings}

@router.put("/settings")
def update_settings(
    settings_in: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    settings_dict = settings_in.dict()
    for key, val in settings_dict.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            setting = SystemSetting(key=key, value=val)
            db.add(setting)
        else:
            setting.value = val
    db.commit()
    return {"status": "success", "settings": settings_dict}

