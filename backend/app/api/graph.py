from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import GraphResponse
from app.api.auth import get_current_user
from app.services.graph import graph_analyzer
from app.models.models import User

router = APIRouter()

@router.get("/transaction/{transaction_id}", response_model=GraphResponse)
def get_transaction_network(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    graph_data = graph_analyzer.get_transaction_graph(db, transaction_id)
    if not graph_data["nodes"]:
        raise HTTPException(status_code=404, detail="Transaction not found or has no graph data")
    return graph_data

@router.get("/global", response_model=GraphResponse)
def get_global_network(
    limit: int = 40,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return graph_analyzer.get_global_fraud_graph(db, limit)
