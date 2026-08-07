import numpy as np
from sqlalchemy.orm import Session
from app.models.models import SystemSetting, Transaction
from typing import Dict, List, Any, Tuple

class HybridRiskEngine:
    @staticmethod
    def get_setting(db: Session, key: str, default: float) -> float:
        try:
            setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            return setting.value if setting else default
        except Exception:
            return default

    @classmethod
    def calculate_hybrid_risk(
        cls,
        db: Session,
        amount: float,
        merchant_category: str,
        ip_address: str,
        device_id: str,
        billing_address: str,
        shipping_address: str,
        velocity_count: int,
        graph_collusion_score: float = 0.0
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates a hybrid risk score combining rule-based heuristics, simulated XGBoost probability, 
        and graph network collusion scores. Returns the combined score (0-100) and an AI Investigation Report.
        """
        # Fetch active weights and thresholds from DB
        w_rule = cls.get_setting(db, "rule_weight", 0.3)
        w_xgb = cls.get_setting(db, "xgb_weight", 0.4)
        w_graph = cls.get_setting(db, "graph_weight", 0.3)
        
        fraud_threshold = cls.get_setting(db, "fraud_threshold", 70.0)

        # 1. Rule-Based Score Component
        rule_score = 0.0
        rule_evidence = []

        if billing_address.strip().lower() != shipping_address.strip().lower():
            rule_score += 25.0
            rule_evidence.append("Address anomaly: billing and shipping mismatch (+25%)")

        if amount > 2000.0:
            rule_score += 30.0
            rule_evidence.append(f"Transaction value exceeds standard threshold: ${amount:,.2f} (+30%)")
        elif amount > 500.0:
            rule_score += 15.0
            rule_evidence.append(f"Moderate transaction value: ${amount:,.2f} (+15%)")

        if velocity_count > 4:
            rule_score += 25.0
            rule_evidence.append(f"High velocity frequency: {velocity_count} transactions in last hour (+25%)")
        elif velocity_count > 2:
            rule_score += 10.0
            rule_evidence.append(f"Moderate velocity frequency: {velocity_count} transactions in last hour (+10%)")

        if merchant_category.strip().lower() in ["electronics", "gift_cards", "crypto", "luxury_goods"]:
            rule_score += 15.0
            rule_evidence.append(f"High-risk category vertical: '{merchant_category}' (+15%)")

        rule_score = min(max(rule_score, 0.0), 100.0)

        # 2. Simulated XGBoost Probability Component
        # We model the feature vector evaluation dynamically.
        # This acts as an inferred regression score using features: amount, velocity, risk category.
        feature_vector = np.array([
            amount / 5000.0, 
            float(velocity_count) / 10.0,
            1.0 if merchant_category.strip().lower() in ["electronics", "gift_cards", "crypto"] else 0.0,
            1.0 if len(device_id) < 8 else 0.0
        ])
        
        # Simulated XGBoost model weights
        weights = np.array([1.8, 1.2, 0.9, 0.5])
        bias = -1.5
        
        # Calculate raw logit and apply sigmoid function
        logit = np.dot(feature_vector, weights) + bias
        xgb_probability = 1.0 / (1.0 + np.exp(-logit))
        xgb_score = round(xgb_probability * 100.0, 2)
        
        xgb_evidence = [
            f"XGBoost Model Probability: {xgb_probability:.4f}",
            f"Feature Importance Contribution: Amount Weight={weights[0]:.1f}, Velocity Weight={weights[1]:.1f}"
        ]

        # 3. Hybrid Combined Score
        # Normalise weights to sum to 1.0 if not already
        total_w = w_rule + w_xgb + w_graph
        w_rule_norm = w_rule / total_w
        w_xgb_norm = w_xgb / total_w
        w_graph_norm = w_graph / total_w

        combined_score = (w_rule_norm * rule_score) + (w_xgb_norm * xgb_score) + (w_graph_norm * graph_collusion_score)
        combined_score = round(min(max(combined_score, 0.0), 100.0), 2)

        # Determine risk levels and actions
        risk_level = "Low"
        recommended_action = "APPROVE"
        
        if combined_score >= 80.0:
            risk_level = "Critical"
            recommended_action = "BLOCK_TRANSACTION"
        elif combined_score >= fraud_threshold:
            risk_level = "High"
            recommended_action = "HOLD_FOR_MANUAL_REVIEW"
        elif combined_score >= 40.0:
            risk_level = "Medium"
            recommended_action = "HOLD_FOR_MANUAL_REVIEW"

        # Formulate AI Investigation Report
        evidence_list = []
        evidence_list.append(f"Rules Breached: {', '.join(rule_evidence) if rule_evidence else 'None'}")
        evidence_list.append(f"XGBoost Inference Flag: Probability {xgb_score}% based on feature metrics")
        evidence_list.append(f"NetworkX Graph Analysis: Collusion link score evaluated at {graph_collusion_score:.1f}%")

        report = {
            "flagged_reason": cls._generate_reason(rule_evidence, xgb_score, graph_collusion_score, combined_score),
            "evidence_used": evidence_list,
            "risk_level": risk_level,
            "recommended_action": recommended_action,
            "rule_score": rule_score,
            "xgb_score": xgb_score,
            "graph_score": graph_collusion_score,
            "settings": {
                "rule_weight": w_rule,
                "xgb_weight": w_xgb,
                "graph_weight": w_graph,
                "fraud_threshold": fraud_threshold
            }
        }

        return combined_score, report

    @staticmethod
    def _generate_reason(rule_evidence: List[str], xgb_score: float, graph_score: float, final_score: float) -> str:
        if final_score < 40.0:
            return "Transaction parameters verify normal, low risk profiles."
            
        reasons = []
        if rule_evidence:
            reasons.append("breaches of operational heuristics")
        if xgb_score > 60.0:
            reasons.append("high-risk feature distributions in XGBoost model")
        if graph_score > 50.0:
            reasons.append("graph collusion links mapping to suspected fraud rings")
            
        if not reasons:
            return "Elevated transactional parameters. Moderately suspicious."
            
        return f"Flagged due to {', '.join(reasons)} (Combined Confidence: {final_score}%)."

hybrid_risk_engine = HybridRiskEngine()
