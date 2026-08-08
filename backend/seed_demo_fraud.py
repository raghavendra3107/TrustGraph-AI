import datetime
import os
import sys

# Ensure backend root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.models import Transaction, FraudScore, Alert, Appeal
from app.services.fraud import fraud_classifier

def seed_demo_fraud():
    db = SessionLocal()
    print("=" * 75)
    print("  TRUSTGRAPH AI - HIGH-RISK DEMO FRAUD DATA SEEDER  ")
    print("=" * 75)

    demo_transactions = [
        {
            "transaction_id": "TRX_DEMO_FRAUD_01",
            "user_email": "demo.fraud01@trustgraph.demo",
            "customer_id": "DEMO_CUST_001",
            "amount": 2499.99,
            "currency": "USD",
            "merchant_category": "crypto",
            "product_name": "Crypto Voucher $2500",
            "product_category": "crypto",
            "seller_name": "Apple Store",
            "seller_id": "SELL_APPLE_STORE",
            "customer_location": "New York, USA",
            "seller_location": "Cupertino, USA",
            "ip_address": "10.99.99.50",
            "device_id": "DEMO_SHARED_DEVICE_001",
            "card_hash": "CARD_HASH_DEMO_9981",
            "billing_address": "100 Broadway, New York, NY 10001",
            "shipping_address": "999 Demo Street, TrustGraph City",
            "delivery_partner": "courier_express",
            "velocity": 5
        },
        {
            "transaction_id": "TRX_DEMO_FRAUD_02",
            "user_email": "demo.fraud02@trustgraph.demo",
            "customer_id": "DEMO_CUST_002",
            "amount": 2899.99,
            "currency": "USD",
            "merchant_category": "gift_cards",
            "product_name": "Digital Gift Card $2900",
            "product_category": "gift_cards",
            "seller_name": "Apple Store",
            "seller_id": "SELL_APPLE_STORE",
            "customer_location": "Brooklyn, USA",
            "seller_location": "Cupertino, USA",
            "ip_address": "10.99.99.50",
            "device_id": "DEMO_SHARED_DEVICE_001",
            "card_hash": "CARD_HASH_DEMO_9982",
            "billing_address": "200 Park Avenue, New York, NY 10017",
            "shipping_address": "999 Demo Street, TrustGraph City",
            "delivery_partner": "courier_express",
            "velocity": 5
        },
        {
            "transaction_id": "TRX_DEMO_FRAUD_03",
            "user_email": "demo.fraud03@trustgraph.demo",
            "customer_id": "DEMO_CUST_003",
            "amount": 3199.99,
            "currency": "USD",
            "merchant_category": "Electronics",
            "product_name": "Dell XPS 17 Ultra Laptop",
            "product_category": "Electronics",
            "seller_name": "Dell Store",
            "seller_id": "SELL_DELL_STORE",
            "customer_location": "Austin, USA",
            "seller_location": "Round Rock, USA",
            "ip_address": "10.99.99.50",
            "device_id": "DEMO_SHARED_DEVICE_001",
            "card_hash": "CARD_HASH_DEMO_9983",
            "billing_address": "300 Fifth Avenue, Austin, TX 78701",
            "shipping_address": "999 Demo Street, TrustGraph City",
            "delivery_partner": "courier_express",
            "velocity": 5
        },
        {
            "transaction_id": "TRX_DEMO_FRAUD_04",
            "user_email": "demo.fraud04@trustgraph.demo",
            "customer_id": "DEMO_CUST_004",
            "amount": 2799.99,
            "currency": "USD",
            "merchant_category": "Electronics",
            "product_name": "HP Omen Gaming Desktop 32GB",
            "product_category": "Electronics",
            "seller_name": "HP Store",
            "seller_id": "SELL_HP_STORE",
            "customer_location": "Palo Alto, USA",
            "seller_location": "Palo Alto, USA",
            "ip_address": "10.99.99.50",
            "device_id": "DEMO_SHARED_DEVICE_001",
            "card_hash": "CARD_HASH_DEMO_9984",
            "billing_address": "400 Madison Ave, Palo Alto, CA 94301",
            "shipping_address": "999 Demo Street, TrustGraph City",
            "delivery_partner": "courier_express",
            "velocity": 5
        },
        {
            "transaction_id": "TRX_DEMO_FRAUD_05",
            "user_email": "demo.fraud05@trustgraph.demo",
            "customer_id": "DEMO_CUST_005",
            "amount": 3499.99,
            "currency": "USD",
            "merchant_category": "luxury_goods",
            "product_name": "Designer Italian Leather Coat",
            "product_category": "luxury_goods",
            "seller_name": "Fashion Store",
            "seller_id": "SELL_FASHION_STORE",
            "customer_location": "Paris, France",
            "seller_location": "Paris, France",
            "ip_address": "10.99.99.50",
            "device_id": "DEMO_SHARED_DEVICE_001",
            "card_hash": "CARD_HASH_DEMO_9985",
            "billing_address": "500 Wall Street, New York, NY 10005",
            "shipping_address": "999 Demo Street, TrustGraph City",
            "delivery_partner": "courier_express",
            "velocity": 5
        }
    ]

    created_count = 0
    skipped_count = 0

    for item in demo_transactions:
        # Check if transaction already exists
        existing = db.query(Transaction).filter(Transaction.transaction_id == item["transaction_id"]).first()
        if existing:
            print(f"[SKIP] {item['transaction_id']} already exists for {item['user_email']}")
            skipped_count += 1
            continue

        # Evaluate through existing HybridRiskEngine / FraudClassifier logic (NO hardcoding!)
        score, factors, report = fraud_classifier.calculate_risk(
            amount=item["amount"],
            currency=item["currency"],
            merchant_category=item["merchant_category"],
            ip_address=item["ip_address"],
            device_id=item["device_id"],
            billing_address=item["billing_address"],
            shipping_address=item["shipping_address"],
            velocity_count=item.get("velocity", 5),
            user_email=item["user_email"],
            db=db
        )

        # Determine status based on risk score threshold
        status_str = "approved"
        is_flagged = False
        if score >= 70.0:
            status_str = "blocked"
            is_flagged = True
        elif score >= 40.0:
            status_str = "flagged"
            is_flagged = True

        # Create Transaction record
        tx = Transaction(
            transaction_id=item["transaction_id"],
            user_email=item["user_email"],
            amount=item["amount"],
            currency=item["currency"],
            merchant_category=item["merchant_category"],
            product_name=item["product_name"],
            product_category=item["product_category"],
            seller_name=item["seller_name"],
            customer_id=item["customer_id"],
            customer_location=item["customer_location"],
            seller_location=item["seller_location"],
            ip_address=item["ip_address"],
            device_id=item["device_id"],
            card_hash=item["card_hash"],
            billing_address=item["billing_address"],
            shipping_address=item["shipping_address"],
            seller_id=item["seller_id"],
            delivery_partner=item["delivery_partner"],
            fraud_score=score,
            is_flagged=is_flagged,
            status=status_str,
            risk_explanation=", ".join(factors)
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        # Create Detailed FraudScore record
        detailed_score = FraudScore(
            transaction_id=tx.id,
            overall_score=score,
            heuristics_score=report.get("rule_score", 0.0),
            history_score=report.get("xgb_score", 0.0),
            sharing_score=report.get("graph_score", 0.0),
            reasons=", ".join(factors)
        )
        db.add(detailed_score)

        # Create Alert and Appeal records if flagged
        severity = "critical" if score >= 80 else ("high" if score >= 60 else "medium")
        if is_flagged:
            alert = Alert(
                transaction_id=tx.id,
                severity=severity,
                message=f"High risk score {score:.1f}% detected for Transaction {tx.transaction_id}",
                is_resolved=False
            )
            db.add(alert)

            review = Appeal(
                transaction_id=tx.id,
                user_email=tx.user_email,
                reason=f"System flagged: Fraud score {score:.1f}% exceeds threshold.",
                status="pending",
                investigation_status="pending"
            )
            db.add(review)

        db.commit()
        created_count += 1

        print(f"[CREATED] ID: {tx.transaction_id:<18} | Email: {tx.user_email:<28} | Fraud Score: {score:>5.1f}% | Risk: {severity.upper():<8} | Status: {status_str.upper()}")

    db.close()
    print("-" * 75)
    print(f"Summary: Created {created_count} demo transactions, Skipped {skipped_count} existing.")
    print("=" * 75)

if __name__ == "__main__":
    seed_demo_fraud()
