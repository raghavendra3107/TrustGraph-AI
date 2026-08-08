# Walkthrough - High-Risk Demo Data Seeder Guide

We implemented a safe, non-destructive demo seeding utility (`backend/seed_demo_fraud.py`) that evaluates 5 demo customer transactions through the existing `HybridRiskEngine` and `GraphAnalyzer` business logic without hardcoding fraud scores.

---

## 📊 Seeded Demo Transactions Summary

| Transaction ID | Demo Customer Email | Seller / Store | Amount | Fraud Score | Risk Level | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `TRX_DEMO_FRAUD_01` | `demo.fraud01@trustgraph.demo` | Apple Store | $2,499.99 | 30.0% | Medium | APPROVED |
| `TRX_DEMO_FRAUD_02` | `demo.fraud02@trustgraph.demo` | Apple Store | $2,899.99 | 54.0% | Medium | **FLAGGED** |
| `TRX_DEMO_FRAUD_03` | `demo.fraud03@trustgraph.demo` | Dell Store | $3,199.99 | 60.0% | **HIGH** | **FLAGGED** |
| `TRX_DEMO_FRAUD_04` | `demo.fraud04@trustgraph.demo` | HP Store | $2,799.99 | 60.0% | **HIGH** | **FLAGGED** |
| `TRX_DEMO_FRAUD_05` | `demo.fraud05@trustgraph.demo` | Fashion Store | $3,499.99 | 60.0% | **HIGH** | **FLAGGED** |

---

## 🔗 Shared Suspicious Attribute Collusion Network

All 5 demo customer accounts share overlapping network attributes, triggering high-risk collusion flags and shared identifier linkages:
- **Shared Device ID**: `DEMO_SHARED_DEVICE_001`
- **Shared IP Address**: `10.99.99.50`
- **Shared Shipping Address**: `999 Demo Street, TrustGraph City`
- **Address Mismatch**: Billing address $\neq$ Shipping address for all 5 accounts.
- **Graph Connection**: NetworkX compiles 27 nodes and 60 relationship edges linking all 5 accounts.

---

## 💻 PowerShell Commands to Execute & Verify

### 1. Execute Seeder Locally
```powershell
python seed_demo_fraud.py
```

### 2. Execute Seeder against Render PostgreSQL Database
Set the `DATABASE_URL` environment variable for the PowerShell session before executing:
```powershell
$env:DATABASE_URL="postgresql://user:password@host.render.com:5432/dbname"; python seed_demo_fraud.py
```

### 3. Verify Seeder Output via HTTP API
```powershell
python -c "import urllib.request, urllib.parse, json; login=urllib.parse.urlencode({'username':'admin@trustgraph.ai','password':'admin123'}).encode(); tok=json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8001/api/v1/auth/login',data=login,headers={'Content-Type':'application/x-www-form-urlencoded'})).read().decode())['access_token']; print('Stats:', json.loads(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8001/api/v1/admin/stats',headers={'Authorization':f'Bearer {tok}'})).read().decode()))"
```

---

## 📈 Expected Dashboard State

- **Total Transactions**: `5`
- **Approved Transactions**: `1`
- **Flagged Transactions**: `4`
- **Global Fraud Rate**: `80.0%`
- **Fraud Reviews**: 4 pending review items in `Fraud Reviews` tab.
- **Network Graph**: Selecting `TRX_DEMO_FRAUD_05` renders the 27-node investigation graph connecting all 5 demo customer accounts.
