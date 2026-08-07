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

class UserCreate(UserBase):
    password: str

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
    ip_address: str
    device_id: str
    card_hash: str
    billing_address: str
    shipping_address: str
    seller_id: str = "seller_default"
    delivery_partner: str = "courier_express"

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: int
    fraud_score: float
    is_flagged: bool
    status: str
    risk_explanation: Optional[str] = None
    transaction_time: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# Appeal Schemas
class AppealBase(BaseModel):
    reason: str

class AppealCreate(BaseModel):
    transaction_id: int
    reason: str

class AppealUpdate(BaseModel):
    status: str  # approved, rejected
    analyst_feedback: Optional[str] = None

class AppealResponse(BaseModel):
    id: int
    transaction_id: int
    user_email: str
    reason: str
    status: str
    analyst_feedback: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    transaction: Optional[TransactionResponse] = None

    class Config:
        from_attributes = True

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

class GraphResponse(BaseModel):
    nodes: List[GraphNodeSchema]
    edges: List[GraphEdgeSchema]

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

