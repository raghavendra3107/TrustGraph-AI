import numpy as np
from sqlalchemy.orm import Session
from app.models.models import SystemSetting, Transaction, Appeal
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
        graph_collusion_score: float = 0.0,
        user_email: str = ""
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates a hybrid risk score (0-100) combining rule-based heuristics, shared attribute metrics
        (Device, IP, Shipping Address), and customer history (returns, refunds, failed payments, complaints).
        """
        # Fetch active weights and thresholds from DB
        w_rule = cls.get_setting(db, "rule_weight", 0.3)
        w_xgb = cls.get_setting(db, "xgb_weight", 0.4)
        w_graph = cls.get_setting(db, "graph_weight", 0.3)
        
        fraud_threshold = cls.get_setting(db, "fraud_threshold", 70.0)

        # 1. Rule-Based Score Component (Heuristics)
        rule_score = 0.0
        rule_evidence = []

        if billing_address.strip().lower() != shipping_address.strip().lower():
            rule_score += 25.0
            rule_evidence.append("billing and shipping address mismatch (+25%)")

        if amount > 2000.0:
            rule_score += 30.0
            rule_evidence.append(f"high transaction amount: ${amount:,.2f} (+30%)")
        elif amount > 500.0:
            rule_score += 15.0
            rule_evidence.append(f"moderate transaction amount: ${amount:,.2f} (+15%)")

        if velocity_count > 4:
            rule_score += 25.0
            rule_evidence.append(f"high transaction frequency: {velocity_count} requests recently (+25%)")
        elif velocity_count > 2:
            rule_score += 10.0
            rule_evidence.append(f"moderate transaction frequency: {velocity_count} requests recently (+10%)")

        if merchant_category.strip().lower() in ["electronics", "gift_cards", "crypto", "luxury_goods"]:
            rule_score += 20.0
            rule_evidence.append(f"high-risk vertical category: '{merchant_category}' (+20%)")

        rule_score = min(max(rule_score, 0.0), 100.0)

        # 2. Relational Sharing Component (Shared Device, IP, Shipping Address)
        shared_device_users = 0
        shared_ip_users = 0
        shared_shipping_users = 0
        sharing_evidence = []
        
        if device_id and device_id != "unknown" and device_id.strip() != "":
            dev_users = db.query(Transaction.user_email).filter(
                Transaction.device_id == device_id
            )
            if user_email:
                dev_users = dev_users.filter(Transaction.user_email != user_email)
            dev_users = dev_users.distinct().all()
            shared_device_users = len(dev_users)
            if shared_device_users > 0:
                sharing_evidence.append(f"shared Device ID with {shared_device_users} other user account(s)")
                
        if ip_address and ip_address.strip() != "":
            ip_users = db.query(Transaction.user_email).filter(
                Transaction.ip_address == ip_address
            )
            if user_email:
                ip_users = ip_users.filter(Transaction.user_email != user_email)
            ip_users = ip_users.distinct().all()
            shared_ip_users = len(ip_users)
            if shared_ip_users > 0:
                sharing_evidence.append(f"shared IP Address with {shared_ip_users} other user account(s)")
                
        if shipping_address and shipping_address.strip() != "":
            shipping_users = db.query(Transaction.user_email).filter(
                Transaction.shipping_address == shipping_address
            )
            if user_email:
                shipping_users = shipping_users.filter(Transaction.user_email != user_email)
            shipping_users = shipping_users.distinct().all()
            shared_shipping_users = len(shipping_users)
            if shared_shipping_users > 0:
                sharing_evidence.append(f"shared Shipping Address with {shared_shipping_users} other user account(s)")

        # Calculate a sharing score (0-100)
        sharing_score = 0.0
        sharing_score += min(shared_device_users * 30.0, 50.0)
        sharing_score += min(shared_ip_users * 30.0, 40.0)
        sharing_score += min(shared_shipping_users * 20.0, 30.0)
        sharing_score = min(max(sharing_score, graph_collusion_score), 100.0)

        # 3. Customer History Component (Returns, Refunds, Failed Payments, Complaints)
        refund_count = 0
        return_count = 0
        wrong_item_complaints = 0
        failed_payment_attempts = 0
        history_evidence = []
        
        if user_email:
            # Query past transactions of the customer
            past_txs = db.query(Transaction).filter(Transaction.user_email == user_email).all()
            for tx in past_txs:
                if tx.status == "refunded":
                    refund_count += 1
                if tx.status == "blocked":
                    failed_payment_attempts += 1
            
            # Query appeals to extract complaints (wrong item / returns / refunds)
            user_appeals = db.query(Appeal).filter(Appeal.user_email == user_email).all()
            for app in user_appeals:
                reason_text = app.reason.lower()
                if "wrong item" in reason_text or "incorrect item" in reason_text or "defective" in reason_text:
                    wrong_item_complaints += 1
                if "return" in reason_text or "refund" in reason_text:
                    return_count += 1
                    
            if refund_count > 0:
                history_evidence.append(f"{refund_count} past refund request(s)")
            if return_count > 0:
                history_evidence.append(f"{return_count} past product return(s)")
            if wrong_item_complaints > 0:
                history_evidence.append(f"{wrong_item_complaints} wrong item complaint(s)")
            if failed_payment_attempts > 0:
                history_evidence.append(f"{failed_payment_attempts} failed payment attempt(s)")

        # Calculate customer history risk score (0-100)
        history_score = 0.0
        history_score += min(refund_count * 20.0, 30.0)
        history_score += min(return_count * 25.0, 30.0)
        history_score += min(wrong_item_complaints * 20.0, 20.0)
        history_score += min(failed_payment_attempts * 15.0, 20.0)
        history_score = min(history_score, 100.0)

        # 4. Combine score segments using normalized settings weights
        total_w = w_rule + w_xgb + w_graph
        w_rule_norm = w_rule / total_w
        w_xgb_norm = w_xgb / total_w
        w_graph_norm = w_graph / total_w

        combined_score = (w_rule_norm * rule_score) + (w_xgb_norm * history_score) + (w_graph_norm * sharing_score)
        combined_score = round(min(max(combined_score, 0.0), 100.0), 2)

        # Determine risk levels and actions
        # Requirements:
        # 0–30 → Low Risk
        # 31–79 → Medium Risk
        # 80–100 → High Risk
        risk_level = "Low"
        recommended_action = "APPROVE"
        
        if combined_score >= 80.0:
            risk_level = "High"
            recommended_action = "BLOCK_TRANSACTION"
        elif combined_score >= 31.0:
            risk_level = "Medium"
            recommended_action = "HOLD_FOR_MANUAL_REVIEW"

        # Combine all reasons
        reasons_list = []
        reasons_list.extend(rule_evidence)
        reasons_list.extend(sharing_evidence)
        reasons_list.extend(history_evidence)
        
        if not reasons_list:
            reasons_list.append("normal profile indicators")

        report = {
            "flagged_reason": cls._generate_reason(rule_evidence, sharing_evidence, history_evidence, combined_score),
            "evidence_used": reasons_list,
            "risk_level": risk_level,
            "recommended_action": recommended_action,
            "rule_score": rule_score,
            "xgb_score": history_score,
            "graph_score": sharing_score,
            "settings": {
                "rule_weight": w_rule,
                "xgb_weight": w_xgb,
                "graph_weight": w_graph,
                "fraud_threshold": fraud_threshold
            }
        }

        return combined_score, report

    @staticmethod
    def _generate_reason(rule_evidence: List[str], sharing_evidence: List[str], history_evidence: List[str], final_score: float) -> str:
        if final_score <= 30.0:
            return "Transaction parameters verify normal, low risk profiles."
            
        reasons = []
        if rule_evidence:
            reasons.append("breaches of operational heuristics")
        if sharing_evidence:
            reasons.append("shared device/IP/shipping credentials")
        if history_evidence:
            reasons.append("suspicious customer returns/refunds history")
            
        if not reasons:
            return "Elevated transactional parameters. Moderately suspicious."
            
        return f"Flagged due to {', '.join(reasons)} (Fraud Score: {final_score}%)."

hybrid_risk_engine = HybridRiskEngine()

class FraudClassifier:
    @staticmethod
    def calculate_risk(
        amount: float,
        currency: str,
        merchant_category: str,
        ip_address: str,
        device_id: str,
        billing_address: str,
        shipping_address: str,
        velocity_count: int,
        user_email: str = ""
    ) -> Tuple[float, List[str]]:
        from app.db.session import SessionLocal
        from app.services.graph import graph_analyzer
        
        db = SessionLocal()
        try:
            collusion_score = graph_analyzer.calculate_collusion_score(
                db=db,
                user_email=user_email,
                device_id=device_id,
                ip_address=ip_address,
                billing_address=billing_address
            )
            score, report = hybrid_risk_engine.calculate_hybrid_risk(
                db=db,
                amount=amount,
                merchant_category=merchant_category,
                ip_address=ip_address,
                device_id=device_id,
                billing_address=billing_address,
                shipping_address=shipping_address,
                velocity_count=velocity_count,
                graph_collusion_score=collusion_score,
                user_email=user_email
            )
            factors = report.get("evidence_used", [])
            return score, factors
        finally:
            db.close()

fraud_classifier = FraudClassifier()
