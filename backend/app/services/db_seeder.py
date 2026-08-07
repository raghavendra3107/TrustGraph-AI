import datetime
import random
import json
from sqlalchemy.orm import Session
from app.models.models import User, Transaction, Appeal, Alert, SystemSetting
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
            "full_name": "Apex Retailers",
            "role": "merchant"
        }
    ]
    for u in users_presets:
        existing_user = db.query(User).filter(User.email == u["email"]).first()
        if not existing_user:
            db.add(User(
                email=u["email"],
                hashed_password=get_password_hash(u["password"]),
                full_name=u["full_name"],
                role=u["role"]
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
    categories = ["Electronics", "Apparel", "Gift Cards", "Digital Goods", "Travel", "Jewelry"]
    emails = [
        "customer1@gmail.com", "customer2@yahoo.com", "customer3@outlook.com",
        "fraudster_alpha@tempmail.com", "fraudster_beta@tempmail.com"
    ]
    sellers = ["SELL_APEX_STORE", "SELL_EASY_RETAIL", "SELL_SUSPECT_SHOP"]
    delivery_partners = ["COURIER_DHL", "COURIER_FEDEX", "COURIER_EXPRESS_MESSENGER"]

    addresses = [
        "123 Main St, New York, NY 10001",
        "456 Oak Ave, Los Angeles, CA 90012",
        "789 Pine Rd, Chicago, IL 60611",
        "101 Fake St, London, UK EC1A",
        "999 Shadow Path, Moscow, RU 143000"
    ]

    transactions = []
    
    # Generate 25 normal/semi-normal transactions
    for i in range(25):
        is_fraudulent = (i % 6 == 0)  # Make some flagged
        
        tx_id = f"TRX{100000 + i}"
        user_email = random.choice(emails)
        amount = round(random.uniform(15.0, 950.0), 2)
        m_cat = random.choice(categories)
        device = random.choice(devices)
        ip = random.choice(ips)
        card = random.choice(cards)
        seller = random.choice(sellers[:2])
        delivery = random.choice(delivery_partners[:2])
        
        billing = random.choice(addresses[:3])
        shipping = billing
        
        # Inject anomalies for fraud
        if is_fraudulent:
            user_email = random.choice(emails[3:]) # tempmail users
            amount = round(random.uniform(1200.0, 4800.0), 2)
            m_cat = "Gift Cards" if i % 2 == 0 else "Electronics"
            device = "DEV_SHARED_SUSPECT_009"
            ip = "185.220.101.4"
            shipping = random.choice(addresses[3:]) # Shipping elsewhere
            seller = "SELL_SUSPECT_SHOP"
            delivery = "COURIER_EXPRESS_MESSENGER"
            velocity = 6
            collusion_val = 85.0 # Pre-calculate simulated graph collusion
        else:
            velocity = random.randint(1, 2)
            collusion_val = 10.0

        risk_score, report = hybrid_risk_engine.calculate_hybrid_risk(
            db=db,
            amount=amount,
            merchant_category=m_cat,
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
            merchant_category=m_cat,
            ip_address=ip,
            device_id=device,
            card_hash=card,
            billing_address=billing,
            shipping_address=shipping,
            seller_id=seller,
            delivery_partner=delivery,
            fraud_score=risk_score,
            is_flagged=is_flagged,
            status=status,
            risk_explanation=json.dumps(report), # Store the complete report serialized
            transaction_time=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(0, 15), hours=random.randint(1, 23))
        )
        transactions.append(tx)

    # Save transactions
    db.add_all(transactions)
    db.commit()

    # Refresh transactions to get their primary keys
    for tx in transactions:
        db.refresh(tx)

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
