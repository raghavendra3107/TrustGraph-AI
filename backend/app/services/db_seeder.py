import datetime
import random
import json
from sqlalchemy.orm import Session
from app.models.models import User, Transaction, Appeal, Alert, SystemSetting, FraudScore
from app.core.security import get_password_hash
from app.services.fraud import hybrid_risk_engine

def seed_db(db: Session):
    # Check if database is already seeded
    if db.query(User).filter(User.email == "admin@trustgraph.ai").first():
        return

    print("Seeding database with initial mock data and thresholds...")

    # 1. Create System Settings
    settings_presets = [
        {"key": "fraud_threshold", "value": 70.0},
        {"key": "graph_sensitivity", "value": 50.0},
        {"key": "rule_weight", "value": 0.3},
        {"key": "xgb_weight", "value": 0.4},
        {"key": "graph_weight", "value": 0.3}
    ]
    for preset in settings_presets:
        existing_setting = db.query(SystemSetting).filter(SystemSetting.key == preset["key"]).first()
        if not existing_setting:
            db.add(SystemSetting(key=preset["key"], value=preset["value"]))
    db.commit()

    # 2. Create Users
    users_presets = [
        {
            "email": "admin@trustgraph.ai",
            "password": "admin123",
            "full_name": "System Administrator",
            "role": "admin"
        },
        {
            "email": "analyst@trustgraph.ai",
            "password": "analyst123",
            "full_name": "Sarah Jenkins (Senior Analyst)",
            "role": "analyst"
        },
        {
            "email": "merchant@trustgraph.ai",
            "password": "merchant123",
            "full_name": "Apex Store Manager",
            "role": "merchant",
            "seller_id": "SELL_APEX_STORE",
            "seller_name": "Apex Store",
            "assigned_category": "Electronics",
            "seller_location": "New York, USA"
        },
        {
            "email": "apple@trustgraph.ai",
            "password": "apple123",
            "full_name": "Apple Store Manager",
            "role": "merchant",
            "seller_id": "SELL_APPLE_STORE",
            "seller_name": "Apple Store",
            "assigned_category": "Electronics",
            "seller_location": "Cupertino, USA"
        },
        {
            "email": "dell@trustgraph.ai",
            "password": "dell123",
            "full_name": "Dell Store Manager",
            "role": "merchant",
            "seller_id": "SELL_DELL_STORE",
            "seller_name": "Dell Store",
            "assigned_category": "Electronics",
            "seller_location": "Round Rock, USA"
        },
        {
            "email": "hp@trustgraph.ai",
            "password": "hp123",
            "full_name": "HP Store Manager",
            "role": "merchant",
            "seller_id": "SELL_HP_STORE",
            "seller_name": "HP Store",
            "assigned_category": "Electronics",
            "seller_location": "Palo Alto, USA"
        },
        {
            "email": "fashion@trustgraph.ai",
            "password": "fashion123",
            "full_name": "Fashion Store Manager",
            "role": "merchant",
            "seller_id": "SELL_FASHION_STORE",
            "seller_name": "Fashion Store",
            "assigned_category": "Clothing",
            "seller_location": "Paris, France"
        }
    ]
    for u in users_presets:
        existing_user = db.query(User).filter(User.email == u["email"]).first()
        if not existing_user:
            db.add(User(
                email=u["email"],
                hashed_password=get_password_hash(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
                seller_id=u.get("seller_id"),
                seller_name=u.get("seller_name"),
                assigned_category=u.get("assigned_category"),
                seller_location=u.get("seller_location")
            ))
    db.commit()

    # 3. Mock transactions setup details
    devices = [
        "DEV_IPHONE_14_8AF2", "DEV_MACBOOK_PRO_9C41", "DEV_ANDROID_G21_6D10", 
        "DEV_WINDOWS_PC_12F8", "DEV_IPAD_AIR_4B23", "DEV_SHARED_SUSPECT_009"
    ]
    ips = [
        "198.51.100.12", "203.0.113.45", "192.0.2.146", 
        "185.220.101.4", "45.223.12.189"
    ]
    cards = [
        "411111XXXXXX1234", "550000XXXXXX5678", "378282XXXXXX9012", 
        "400000XXXXXX9999", "601111XXXXXX3344"
    ]
    emails = [
        "customer1@gmail.com", "customer2@yahoo.com", "customer3@outlook.com",
        "fraudster_alpha@tempmail.com", "fraudster_beta@tempmail.com"
    ]
    
    merchant_catalog = [
        {"seller_id": "SELL_APPLE_STORE", "seller_name": "Apple Store", "product_name": "iPhone 17", "product_category": "Electronics", "seller_location": "Cupertino, USA"},
        {"seller_id": "SELL_DELL_STORE", "seller_name": "Dell Store", "product_name": "Dell XPS", "product_category": "Electronics", "seller_location": "Round Rock, USA"},
        {"seller_id": "SELL_HP_STORE", "seller_name": "HP Store", "product_name": "HP Laptop", "product_category": "Electronics", "seller_location": "Palo Alto, USA"},
        {"seller_id": "SELL_FASHION_STORE", "seller_name": "Fashion Store", "product_name": "T-Shirt", "product_category": "Clothing", "seller_location": "Paris, France"},
        {"seller_id": "SELL_APEX_STORE", "seller_name": "Apex Store", "product_name": "Apex Smart Tablet", "product_category": "Electronics", "seller_location": "New York, USA"}
    ]
    
    delivery_partners = ["COURIER_DHL", "COURIER_FEDEX", "COURIER_EXPRESS_MESSENGER"]

    addresses = [
        "123 Main St, New York, NY 10001",
        "456 Oak Ave, Los Angeles, CA 90012",
        "789 Pine Rd, Chicago, IL 60611",
        "101 Fake St, London, UK EC1A",
        "999 Shadow Path, Moscow, RU 143000"
    ]

    transactions = []
    
    # Generate 25 normal/semi-normal transactions across merchants
    for i in range(25):
        is_fraudulent = (i % 5 == 0)  # Make every 5th transaction flagged/blocked
        
        tx_id = f"TRX{100000 + i}"
        user_email = random.choice(emails)
        amount = round(random.uniform(15.0, 950.0), 2)
        merchant_item = merchant_catalog[i % len(merchant_catalog)]
        
        device = random.choice(devices)
        ip = random.choice(ips)
        card = random.choice(cards)
        delivery = random.choice(delivery_partners[:2])
        
        billing = random.choice(addresses[:3])
        shipping = billing
        cust_id = f"CUST-100{i % 5 + 1}"
        cust_loc = "Hyderabad, India" if i % 2 == 0 else "Bangalore, India"
        
        # Inject anomalies for fraud
        if is_fraudulent:
            user_email = random.choice(emails[3:]) # tempmail users
            amount = round(random.uniform(1200.0, 4800.0), 2)
            device = "DEV_SHARED_SUSPECT_009"
            ip = "185.220.101.4"
            shipping = random.choice(addresses[3:]) # Shipping elsewhere
            delivery = "COURIER_EXPRESS_MESSENGER"
            velocity = 6
            collusion_val = 85.0 # Pre-calculate simulated graph collusion
        else:
            velocity = random.randint(1, 2)
            collusion_val = 10.0

        risk_score, report = hybrid_risk_engine.calculate_hybrid_risk(
            db=db,
            amount=amount,
            merchant_category=merchant_item["product_category"],
            ip_address=ip,
            device_id=device,
            billing_address=billing,
            shipping_address=shipping,
            velocity_count=velocity,
            graph_collusion_score=collusion_val,
            user_email=user_email
        )

        status = "approved"
        is_flagged = False
        if risk_score >= 70.0:
            status = "blocked"
            is_flagged = True
        elif risk_score >= 40.0:
            status = "flagged"
            is_flagged = True

        tx = Transaction(
            transaction_id=tx_id,
            user_email=user_email,
            amount=amount,
            currency="USD",
            merchant_category=merchant_item["product_category"],
            product_name=merchant_item["product_name"],
            product_category=merchant_item["product_category"],
            seller_name=merchant_item["seller_name"],
            customer_id=cust_id,
            customer_location=cust_loc,
            seller_location=merchant_item["seller_location"],
            ip_address=ip,
            device_id=device,
            card_hash=card,
            billing_address=billing,
            shipping_address=shipping,
            seller_id=merchant_item["seller_id"],
            delivery_partner=delivery,
            fraud_score=risk_score,
            is_flagged=is_flagged,
            status=status,
            risk_explanation=json.dumps(report),
            transaction_time=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(0, 15), hours=random.randint(1, 23))
        )
        transactions.append(tx)

    # Save transactions
    db.add_all(transactions)
    db.commit()

    # Refresh transactions to get their primary keys and seed detailed fraud scores
    for tx in transactions:
        db.refresh(tx)
        try:
            report_data = json.loads(tx.risk_explanation)
            h_score = report_data.get("rule_score", 0.0)
            hist_score = report_data.get("xgb_score", 0.0)
            sh_score = report_data.get("graph_score", 0.0)
            reasons_str = ", ".join(report_data.get("evidence_used", []))
        except Exception:
            h_score = tx.fraud_score * 0.4
            hist_score = tx.fraud_score * 0.3
            sh_score = tx.fraud_score * 0.3
            reasons_str = tx.risk_explanation or "Seeded transaction"
            
        detailed_score = FraudScore(
            transaction_id=tx.id,
            overall_score=tx.fraud_score,
            heuristics_score=h_score,
            history_score=hist_score,
            sharing_score=sh_score,
            reasons=reasons_str
        )
        db.add(detailed_score)
    db.commit()

    # 4. Create Alerts for flagged/blocked transactions
    for tx in transactions:
        if tx.is_flagged:
            severity = "critical" if tx.fraud_score >= 80 else ("high" if tx.fraud_score >= 60 else "medium")
            alert = Alert(
                transaction_id=tx.id,
                severity=severity,
                message=f"High risk score {tx.fraud_score}% detected for Transaction {tx.transaction_id}",
                is_resolved=False
            )
            db.add(alert)

    # 5. Create some Appeals for blocked/flagged transactions
    flagged_txs = [t for t in transactions if t.is_flagged]
    if len(flagged_txs) >= 3:
        # 1. Pending Appeal
        appeal1 = Appeal(
            transaction_id=flagged_txs[0].id,
            user_email=flagged_txs[0].user_email,
            reason="I made this purchase myself while travelling. Please approve it.",
            status="pending"
        )
        # 2. Approved Appeal
        appeal2 = Appeal(
            transaction_id=flagged_txs[1].id,
            user_email=flagged_txs[1].user_email,
            reason="This was a legitimate purchase for my business client.",
            status="approved",
            analyst_feedback="Verified customer identity via offline verification. Whitelisted."
        )
        flagged_txs[1].status = "approved"
        
        # 3. Rejected Appeal
        appeal3 = Appeal(
            transaction_id=flagged_txs[2].id,
            user_email=flagged_txs[2].user_email,
            reason="Please let my transaction go through. I need the gift cards immediately.",
            status="rejected",
            analyst_feedback="Confirmed fraud ring indicator: device and IP address blacklisted."
        )
        db.add_all([appeal1, appeal2, appeal3])
        
    db.commit()
    print("Database seeding completed successfully.")
