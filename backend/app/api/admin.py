from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.db.session import get_db
from app.models.models import Transaction, Appeal, Alert, User, SystemSetting
from app.schemas.schemas import DashboardStats, AlertResponse, SystemSettingsUpdate, UserResponse, MerchantCreate, MerchantUpdate
from app.api.auth import get_current_user, get_current_admin
from app.core.security import get_password_hash
import datetime

router = APIRouter()

def get_merchant_seller_id(email: str) -> str:
    mapping = {
        "merchant@trustgraph.ai": "SELL_APEX_STORE",
        "apple@trustgraph.ai": "SELL_APPLE_STORE",
        "dell@trustgraph.ai": "SELL_DELL_STORE",
        "hp@trustgraph.ai": "SELL_HP_STORE",
        "fashion@trustgraph.ai": "SELL_FASHION_STORE"
    }
    return mapping.get(email, "SELL_APEX_STORE")

def get_seller_id_for_user(user: User) -> Optional[str]:
    if user.role != "merchant":
        return None
    return user.seller_id or get_merchant_seller_id(user.email)

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seller_id = get_seller_id_for_user(current_user)
    is_merchant = seller_id is not None

    # Base Query
    tx_base = db.query(Transaction)
    if is_merchant:
        tx_base = tx_base.filter(Transaction.seller_id == seller_id)

    # Total transaction count
    total_txs = tx_base.count()
    
    # Approved, blocked, and pending reviews count
    approved_txs = tx_base.filter(Transaction.status == "approved").count()
    blocked_txs = tx_base.filter(Transaction.status == "blocked").count()
    pending_reviews = tx_base.filter(Transaction.status == "flagged").count()
    flagged_count = tx_base.filter(Transaction.is_flagged == True).count()
    
    # Appeals metrics
    appeals_base = db.query(Appeal)
    if is_merchant:
        appeals_base = appeals_base.join(Transaction).filter(Transaction.seller_id == seller_id)
    total_appeals = appeals_base.count()
    pending_appeals = appeals_base.filter(Appeal.status == "pending").count()
    
    # High risk transaction count (score >= 80)
    high_risk_txs = tx_base.filter(Transaction.fraud_score >= 80.0).count()
    
    # Rates
    fraud_rate = round((flagged_count / total_txs * 100), 2) if total_txs > 0 else 0.0
    approval_rate = round((approved_txs / total_txs * 100), 2) if total_txs > 0 else 0.0
    
    # Active alerts (unresolved)
    alerts_base = db.query(Alert).filter(Alert.is_resolved == False)
    if is_merchant:
        alerts_base = alerts_base.join(Transaction).filter(Transaction.seller_id == seller_id)
    active_alerts = alerts_base.count()
    
    # Revenue at risk
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    rev_query = db.query(func.sum(Transaction.amount)).filter(
        Transaction.is_flagged == True,
        Transaction.transaction_time >= thirty_days_ago
    )
    if is_merchant:
        rev_query = rev_query.filter(Transaction.seller_id == seller_id)
    revenue_at_risk = round(rev_query.scalar() or 0.0, 2)

    # Trends for last 7 days
    trends = []
    for i in range(6, -1, -1):
        day = datetime.datetime.utcnow() - datetime.timedelta(days=i)
        start_of_day = datetime.datetime(day.year, day.month, day.day, 0, 0, 0)
        end_of_day = datetime.datetime(day.year, day.month, day.day, 23, 59, 59)
        
        day_tx = tx_base.filter(
            Transaction.transaction_time >= start_of_day,
            Transaction.transaction_time <= end_of_day
        )
        
        tx_c = day_tx.count()
        app_c = day_tx.filter(Transaction.status == "approved").count()
        flag_c = day_tx.filter(Transaction.is_flagged == True).count()
        blk_c = day_tx.filter(Transaction.status == "blocked").count()

        trends.append({
            "name": day.strftime("%b %d"),
            "transactions": tx_c,
            "approved": app_c,
            "flagged": flag_c,
            "blocked": blk_c,
            "fraud": flag_c
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
        c = tx_base.filter(
            Transaction.fraud_score >= low,
            Transaction.fraud_score <= high
        ).count()
        risk_distribution.append({
            "range": label,
            "count": c
        })

    # Merchant Specific Aggregations
    product_performance = []
    fraud_review_summary = None

    if is_merchant:
        merchant_txs = tx_base.all()
        prod_map = {}
        for tx in merchant_txs:
            pname = tx.product_name or "Standard Item"
            if pname not in prod_map:
                prod_map[pname] = {"product": pname, "orders": 0, "approved": 0, "flagged": 0, "blocked": 0, "fraud_rate": 0.0}
            prod_map[pname]["orders"] += 1
            if tx.status == "approved":
                prod_map[pname]["approved"] += 1
            if tx.is_flagged or tx.status == "flagged":
                prod_map[pname]["flagged"] += 1
            if tx.status == "blocked":
                prod_map[pname]["blocked"] += 1

        for pdata in prod_map.values():
            pdata["fraud_rate"] = round((pdata["flagged"] / pdata["orders"] * 100), 1) if pdata["orders"] > 0 else 0.0
            product_performance.append(pdata)

        fraud_review_summary = {
            "pending_analyst_reviews": appeals_base.filter(
                (Appeal.investigation_status == "pending") | (Appeal.investigation_status == None)
            ).count(),
            "analyst_recommended_approval": appeals_base.filter(
                Appeal.investigation_status == "recommended_approve"
            ).count(),
            "analyst_recommended_rejection": appeals_base.filter(
                Appeal.investigation_status == "recommended_reject"
            ).count(),
            "merchant_decisions_completed": appeals_base.filter(
                Appeal.status.in_(["approved", "rejected"])
            ).count()
        }

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
        "risk_distribution": risk_distribution,
        "flagged_transactions": flagged_count,
        "approval_rate": approval_rate,
        "product_performance": product_performance,
        "fraud_review_summary": fraud_review_summary
    }

@router.get("/alerts", response_model=List[AlertResponse])
def get_alerts(
    resolved: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Alert).filter(Alert.is_resolved == resolved)
    seller_id = get_seller_id_for_user(current_user)
    if seller_id:
        query = query.join(Transaction).filter(Transaction.seller_id == seller_id)
    return query.order_by(Alert.created_at.desc()).all()

@router.put("/alerts/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "merchant":
        raise HTTPException(status_code=403, detail="Not authorized to resolve alerts")
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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can view system settings")
    settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings}

@router.put("/settings")
def update_settings(
    settings_in: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can update system settings")
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

@router.get("/merchants", response_model=List[UserResponse])
def get_merchants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can view merchant accounts")
    return db.query(User).filter(User.role == "merchant").order_by(User.created_at.desc()).all()

@router.post("/merchants", response_model=UserResponse, status_code=201)
def create_merchant(
    merchant_in: MerchantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can create merchant accounts")
    
    existing = db.query(User).filter(User.email == merchant_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    merchant = User(
        email=merchant_in.email,
        hashed_password=get_password_hash(merchant_in.password),
        full_name=merchant_in.full_name or merchant_in.seller_name,
        role="merchant",
        is_active=True,
        seller_id=merchant_in.seller_id,
        seller_name=merchant_in.seller_name,
        assigned_category=merchant_in.assigned_category,
        seller_location=merchant_in.seller_location
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    return merchant

@router.put("/merchants/{user_id}", response_model=UserResponse)
def update_merchant(
    user_id: int,
    merchant_in: MerchantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can update merchant accounts")
        
    merchant = db.query(User).filter(User.id == user_id, User.role == "merchant").first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant account not found")

    if merchant_in.full_name is not None:
        merchant.full_name = merchant_in.full_name
    if merchant_in.seller_id is not None:
        merchant.seller_id = merchant_in.seller_id
    if merchant_in.seller_name is not None:
        merchant.seller_name = merchant_in.seller_name
    if merchant_in.assigned_category is not None:
        merchant.assigned_category = merchant_in.assigned_category
    if merchant_in.seller_location is not None:
        merchant.seller_location = merchant_in.seller_location
    if merchant_in.is_active is not None:
        merchant.is_active = merchant_in.is_active

    db.commit()
    db.refresh(merchant)
    return merchant

