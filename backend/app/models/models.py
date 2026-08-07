import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="analyst")  # admin, analyst, merchant
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)
    user_email = Column(String, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    merchant_category = Column(String, nullable=False)
    transaction_time = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String, nullable=False)
    device_id = Column(String, nullable=False)
    card_hash = Column(String, nullable=False)
    billing_address = Column(String, nullable=False)
    shipping_address = Column(String, nullable=False)
    seller_id = Column(String, default="seller_default")
    delivery_partner = Column(String, default="courier_express")
    
    # Fraud indicators
    fraud_score = Column(Float, default=0.0)  # 0 to 100
    is_flagged = Column(Boolean, default=False)
    status = Column(String, default="approved")  # approved, flagged, blocked, refunded
    risk_explanation = Column(Text, nullable=True)  # JSON string or plain text explanation
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    appeal = relationship("Appeal", back_populates="transaction", uselist=False)
    alerts = relationship("Alert", back_populates="transaction")

class Appeal(Base):
    __tablename__ = "appeals"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), unique=True)
    user_email = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String, default="pending")  # pending, approved, rejected
    analyst_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    transaction = relationship("Transaction", back_populates="appeal")

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    severity = Column(String, default="medium")  # low, medium, high, critical
    message = Column(String, nullable=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    transaction = relationship("Transaction", back_populates="alerts")

# Simple graph entities for fraud ring analysis visualization
class GraphNode(Base):
    __tablename__ = "graph_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String, unique=True, index=True)  # e.g. "USER_john@gmail.com", "DEVICE_dev123"
    label = Column(String)  # user, device, card, transaction, ip
    name = Column(String)   # Human readable value
    fraud_risk = Column(Float, default=0.0) # 0 to 100

class GraphEdge(Base):
    __tablename__ = "graph_edges"
    
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, ForeignKey("graph_nodes.node_id"))
    target_id = Column(String, ForeignKey("graph_nodes.node_id"))
    label = Column(String)  # owns, transacted_from, used_card, linked_to
    weight = Column(Float, default=1.0)

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Float, nullable=False)

