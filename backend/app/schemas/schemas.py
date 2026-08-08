from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "analyst"
    is_active: bool = True
    seller_id: Optional[str] = None
    seller_name: Optional[str] = None
    assigned_category: Optional[str] = None
    seller_location: Optional[str] = None

class UserCreate(UserBase):
    password: str

class MerchantCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    seller_id: str
    seller_name: str
    assigned_category: Optional[str] = "Electronics"
    seller_location: Optional[str] = "Cupertino, USA"

class MerchantUpdate(BaseModel):
    full_name: Optional[str] = None
    seller_id: Optional[str] = None
    seller_name: Optional[str] = None
    assigned_category: Optional[str] = None
    seller_location: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionBase(BaseModel):
    transaction_id: str
    user_email: str
    amount: float
    currency: str = "USD"
    merchant_category: str
    product_name: Optional[str] = "Standard Product"
    product_category: Optional[str] = "Electronics"
    seller_name: Optional[str] = "Standard Store"
    customer_id: Optional[str] = "CUST-1001"
    customer_location: Optional[str] = "Hyderabad, India"
    seller_location: Optional[str] = "Cupertino, USA"
    ip_address: str
    device_id: str
    card_hash: str
    billing_address: str
    shipping_address: str
    seller_id: str = "seller_default"
    delivery_partner: str = "courier_express"

class TransactionCreate(TransactionBase):
    pass

# Appeal Schemas
class AppealBase(BaseModel):
    reason: str

class AppealCreate(BaseModel):
    transaction_id: int
    reason: str

class AppealUpdate(BaseModel):
    status: Optional[str] = None  # approved, rejected
    analyst_feedback: Optional[str] = None
    
    # Marketplace workflow updates
    investigation_status: Optional[str] = None  # recommended_approve, recommended_reject
    investigation_notes: Optional[str] = None
    analyst_recommendation: Optional[str] = None
    merchant_final_decision: Optional[str] = None
    final_order_status: Optional[str] = None  # approved, rejected

class AppealNestedResponse(BaseModel):
    id: int
    transaction_id: int
    user_email: str
    reason: str
    status: str
    analyst_feedback: Optional[str] = None
    investigation_status: Optional[str] = None
    investigation_notes: Optional[str] = None
    analyst_recommendation: Optional[str] = None
    merchant_final_decision: Optional[str] = None
    merchant_decision_timestamp: Optional[datetime] = None
    final_order_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TransactionResponse(TransactionBase):
    id: int
    fraud_score: float
    is_flagged: bool
    status: str
    risk_explanation: Optional[str] = None
    transaction_time: datetime
    created_at: datetime
    appeal: Optional[AppealNestedResponse] = None

    class Config:
        from_attributes = True

class AppealResponse(AppealNestedResponse):
    transaction: Optional[TransactionResponse] = None

# Alert Schemas
class AlertResponse(BaseModel):
    id: int
    transaction_id: int
    severity: str
    message: str
    is_resolved: bool
    created_at: datetime
    transaction: Optional[TransactionResponse] = None

    class Config:
        from_attributes = True

# Graph Schemas
class GraphNodeSchema(BaseModel):
    id: str
    label: str
    name: str
    fraud_risk: float

    class Config:
        from_attributes = True

class GraphEdgeSchema(BaseModel):
    id: Optional[int] = None
    source: str = Field(..., alias="source_id")
    target: str = Field(..., alias="target_id")
    label: str
    weight: float

    class Config:
        from_attributes = True
        populate_by_name = True

class SuspiciousFraudCluster(BaseModel):
    cluster_id: int
    customers: List[str]
    size: int
    average_fraud_risk: float
    max_fraud_risk: float
    shared_attributes: List[str]
    risk_level: str

class GraphResponse(BaseModel):
    nodes: List[GraphNodeSchema]
    edges: List[GraphEdgeSchema]
    collusion_score: float = 0.0
    connected_accounts: List[str] = []
    suspicious_fraud_clusters: List[SuspiciousFraudCluster] = []

# Dashboard DashboardStats Schema
class DashboardStats(BaseModel):
    total_transactions: int
    approved_transactions: int
    blocked_transactions: int
    pending_reviews: int
    total_appeals: int
    fraud_rate: float
    high_risk_transactions: int
    active_alerts: int
    pending_appeals: int
    revenue_at_risk: float
    monthly_trends: List[dict]
    risk_distribution: List[dict]
    flagged_transactions: Optional[int] = 0
    approval_rate: Optional[float] = 0.0
    product_performance: Optional[List[dict]] = []
    fraud_review_summary: Optional[dict] = None

# System Settings Schemas
class SystemSettingBase(BaseModel):
    key: str
    value: float

class SystemSettingResponse(SystemSettingBase):
    id: int

    class Config:
        from_attributes = True

class SystemSettingsUpdate(BaseModel):
    fraud_threshold: float
    graph_sensitivity: float
    rule_weight: float
    xgb_weight: float
    graph_weight: float

