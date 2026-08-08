# TrustGraph AI

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-v0.100%2B-green)
![React](https://img.shields.io/badge/React-v19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-cyan)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

### E-Commerce Fraud Detection & Graph Collusion Analysis

**TrustGraph AI** is a full-stack e-commerce fraud detection and investigation platform designed to identify high-risk transactions, credit card fraud, velocity spikes, and complex fraud rings across multi-merchant marketplaces. 

By unifying rule-based heuristics, explainable AI (XAI) risk scoring, relational sharing metrics, and a **4-tier hierarchical NetworkX graph visualizer**, TrustGraph AI empowers security analysts to investigate collusive buyer accounts and gives merchants full autonomy to render final order decisions on their store volume.

---

## 🚀 Key Innovation & Platform Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend Layer (Vercel)"]
        UI["React 19 + Vite SPA"]
        WSClient["WebSocket Notification Subscriptions"]
    end

    subgraph Backend ["Backend API & Intelligence Layer (Render)"]
        API["FastAPI REST Services (/api/v1)"]
        WSServer["WebSocket Manager (/ws)"]
        RiskEngine["Hybrid Risk Engine"]
        GraphEngine["Graph Analyzer"]
    end

    subgraph Database ["Persistence Layer"]
        DB[("PostgreSQL / SQLite")]
    end

    UI --> API
    WSClient <--> WSServer
    API --> RiskEngine
    API --> GraphEngine
    RiskEngine --> DB
    GraphEngine --> DB
```

---

## 👥 System Roles & RBAC Matrix

TrustGraph AI enforces strict Role-Based Access Control (RBAC) across **three distinct authenticated roles**. There is **no Customer login role**—customers are external buyers represented through transaction metadata.

| Capabilities | Admin (`admin@trustgraph.ai`) | Security Analyst (`analyst@trustgraph.ai`) | Merchant (`apple@...`, `dell@...`, etc.) |
| :--- | :---: | :---: | :---: |
| **Marketplace Scope** | Global (All Stores) | Global (All Stores) | Store Isolated (`current_user.seller_id`) |
| **View Dashboard Stats** | Global Marketplace | Global Marketplace | Store Volume Only |
| **View Transaction Logs** | Read-Only | Read-Only | Store Volume Only |
| **Investigate Fraud Graph** | Full Graph | Full Graph | Transaction Investigation Graph |
| **Submit Investigation Notes** | ❌ | ✅ Yes | ❌ |
| **Submit Analyst Recommendation** | ❌ (Read-Only) | ✅ (Approve / Reject) | ❌ |
| **Final Order Approval / Rejection** | ❌ (Read-Only) | ❌ (Recommendation Only) | ✅ **FINAL DECISION AUTONOMY** |
| **Manage Merchant Accounts** | ✅ (Create / Enable / Disable) | ❌ | ❌ |
| **Configure System Settings** | ✅ (Thresholds & Weights) | ❌ | ❌ |

> [!IMPORTANT]
> **Autonomy Division**: Security Analysts conduct investigations and issue non-binding recommendations. Only the **Merchant** owning the order (`seller_id`) can make the final binding decision to **Approve Order** or **Reject Order**. Admin oversight is read-only for transaction decisions.

---

## 🔄 End-to-End System Workflow

```mermaid
flowchart TD
    A["Customer Places Order"] --> B["Validate Transaction"]
    B --> C["Check Customer History"]
    C --> D["Fraud Risk Engine"]
    D --> E["Calculate Risk Score (0-100)"]
    E --> F{"Risk Score Threshold"}

    F -->|"Low Risk (0-30)"| G["Approve Order"]
    F -->|"Medium Risk (31-79)"| H["Flag for Fraud Review"]
    F -->|"High Risk (80-100)"| I["Flag for Urgent Review"]

    H --> J["Security Analyst Investigation"]
    I --> J

    J --> K["Analyze 4-Tier Graph Network"]
    K --> L["Examine Shared Devices / IPs / Addresses"]
    L --> M["Submit Notes & Analyst Recommendation"]

    M --> N["Relevant Merchant Reviews Report"]
    N --> O{"Merchant Final Decision"}

    O -->|"Approve Order"| P["Order Approved"]
    O -->|"Reject Order"| Q["Order Blocked"]

    G --> R["Transaction Completed"]
    P --> R
    Q --> S["Fraud Case Closed"]
```

---

## 🛒 Multi-Merchant Marketplace Workflow & Data Isolation

TrustGraph AI isolates merchant transaction logs, reviews, statistics, and notifications by `seller_id`. 

### Supported Demo Merchant Accounts

- **Apple Store** (`apple@trustgraph.ai` | `SELL_APPLE_STORE`)
- **Dell Store** (`dell@trustgraph.ai` | `SELL_DELL_STORE`)
- **HP Store** (`hp@trustgraph.ai` | `SELL_HP_STORE`)
- **Fashion Store** (`fashion@trustgraph.ai` | `SELL_FASHION_STORE`)
- **Apex Retailers** (`merchant@trustgraph.ai` | `SELL_APEX_STORE`)

```text
[ Incoming Order ] ---> (seller_id: SELL_APPLE_STORE)
                                |
             +------------------+------------------+
             |                                     |
    [ Apple Merchant Dashboard ]          [ Dell Merchant Dashboard ]
    - Total Orders: 6                     - Total Orders: 6
    - Approved: 3                         - Approved: 6
    - Flagged: 4                          - Flagged: 0
    - Data Isolated (Apple Only)          - Data Isolated (Dell Only)
```

---

## 🕸 Hierarchical Fraud Investigation Graph

To eliminate chaotic force-directed layouts, TrustGraph AI visualizes transaction relationships using a **fixed 4-tier hub-and-spoke investigation graph**:

```mermaid
graph TD
    L0["Level 0: Buyer Account (Customer)"]
    L1["Level 1: Central Selected Transaction"]

    L2_Prod["Product"]
    L2_Merch["Merchant"]
    L2_IP["IP Address"]
    L2_Dev["Device ID"]
    L2_Bill["Billing Address"]
    L2_Ship["Shipping Address"]

    L3_UserA["Shared Account A"]
    L3_UserB["Shared Account B"]

    L0 -->|placed order| L1
    L1 -->|product| L2_Prod
    L1 -->|seller| L2_Merch
    L1 -->|customer IP| L2_IP
    L1 -->|device| L2_Dev
    L1 -->|billing| L2_Bill
    L1 -->|shipping| L2_Ship

    L2_IP -.->|shared with| L3_UserA
    L2_Dev -.->|shared with| L3_UserB

    classDef shared stroke:#ef4444,stroke-dasharray: 5 5;
    class L3_UserA,L3_UserB shared;
```

### Graph Layers & Edge Labels

- **Level 0 (Top)**: Buyer Customer Node (`placed order` $\rightarrow$ Central Transaction)
- **Level 1 (Center)**: Focal Transaction Card (Displays Transaction ID, Risk Score, Status)
- **Level 2 (Attribute Ring)**: Product (`product`), Merchant (`seller`), Customer IP (`customer IP`), Device ID (`device`), Billing Address (`billing`), Shipping Address (`shipping`)
- **Level 3 (Collusion Ring)**: Secondary buyer accounts linked via shared attributes (`shared with` rendered with **Red Dashed Edges**)

---

## 🔍 Explainable AI (XAI) Risk Engine

The `HybridRiskEngine` calculates a dynamic score from `0.0` to `100.0%` by evaluating three weighted pillars:

```python
combined_score = (w_rule * rule_score) + (w_xgb * history_score) + (w_graph * sharing_score)
```

1. **Rule-Based Heuristics (`rule_score`)**:
   - Billing & Shipping Address Mismatch: `+25%`
   - High Amount ($ > \$2,000$): `+30%` | Moderate Amount ($ > \$500$): `+15%`
   - Rapid Velocity Spikes ($> 4$ recent requests): `+25%`
   - High-Risk Category (`electronics`, `crypto`, `gift_cards`, `luxury_goods`): `+20%`
2. **Relational Attribute Sharing (`sharing_score`)**:
   - Shared Device ID with other users: `+30%` per user (up to `50%`)
   - Shared IP Address with other users: `+30%` per user (up to `40%`)
   - Shared Shipping Address with other users: `+20%` per user (up to `30%`)
3. **NetworkX Collusion Score (`graph_score`)**:
   - Evaluates multi-hop graph degree centrality and collusion risk.

---

## ⚡ Targeted Real-Time WebSocket Notifications

TrustGraph AI runs a dedicated WebSocket server (`/ws`). When an analyst completes an investigation recommendation or a new alert is generated, notifications are broadcasted live to connected merchant dashboards based on `seller_id` data isolation.

---

## 📊 Role-Specific Dashboards

- **Admin Dashboard**: Global marketplace transaction volume, total approved/blocked counts, system risk distribution, and merchant account management.
- **Analyst Dashboard**: Flagged transactions queue, risk score progress bars, XAI factor breakdowns, NetworkX graph canvas, and recommendation forms.
- **Merchant Dashboard**: Strictly scoped to `current_user.seller_id` displaying:
  - Total Orders
  - Approved Orders
  - Blocked Orders
  - Pending Reviews
  - Flagged Orders
  - Store Approval Rate (`%`)
  - Store Fraud Rate (`%`)
  - Revenue at Risk (`$`)

---

## 🛠 Technology Stack

| Component | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Core** | React 19, TypeScript, Vite | Single-page application architecture |
| **Frontend Styling** | Tailwind CSS v4, Lucide Icons | Glassmorphic dark theme, responsive components |
| **Charts & Visuals** | Recharts, HTML5 Canvas 2D | Financial trend charts & 4-tier graph engine |
| **Backend Framework** | Python 3.10+, FastAPI | Asynchronous REST APIs & WebSocket broker |
| **ORM & Database** | SQLAlchemy, PostgreSQL / SQLite | SQLite for local dev, PostgreSQL for production |
| **Graph & ML Engine** | NetworkX, NumPy, Scikit-Learn, XGBoost | Relational sharing & graph collusion analysis |
| **Authentication** | OAuth2 Password Bearer, PyJWT | JWT access tokens & passlib bcrypt hashing |
| **Cloud Deployment** | Vercel (Frontend), Render (Backend & DB)| Production multi-region cloud deployment |

---

## 📁 Repository Structure

```text
TrustGraph-AI/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI REST Routers (auth, transactions, appeals, graph, admin)
│   │   ├── core/         # Security, JWT, config, notifications
│   │   ├── db/           # SQLAlchemy session & database engines
│   │   ├── models/       # Database ORM Models (User, Transaction, Appeal, Alert, FraudScore)
│   │   ├── schemas/      # Pydantic validation schemas
│   │   └── services/     # HybridRiskEngine, GraphAnalyzer, db_seeder
│   ├── main.py           # FastAPI Application Entrypoint & /ws endpoint
│   ├── requirements.txt  # Python Dependencies
│   └── seed_demo_fraud.py # High-risk fraud demo seeder script
├── frontend/
│   ├── src/
│   │   ├── components/   # UI StatCards, GraphVisualizer, Sidebar, Modals
│   │   ├── context/      # AuthContext & AlertContext (WebSockets)
│   │   ├── pages/        # Dashboard, Transactions, Appeals, Admin, Login
│   │   ├── services/     # Axios API service
│   │   └── types/        # TypeScript interfaces
│   ├── package.json      # Node.js dependencies
│   ├── vercel.json       # Vercel SPA Routing Configuration
│   └── vite.config.ts    # Vite build configuration
├── .env.example          # Safe environment variables template
├── docker-compose.yml    # Docker Compose local stack setup
├── render.yaml           # Render Infrastructure-as-Code spec
└── README.md             # Project documentation
```

---

## 🌐 API Endpoint Reference

Documentation is automatically served via OpenAPI / Swagger at `/docs`.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user and issue JWT token |
| `GET` | `/api/v1/auth/me` | Authenticated | Fetch current user profile & merchant metadata |
| `GET` | `/api/v1/transactions/` | Authenticated | List transactions (Filtered by `seller_id` for merchants) |
| `POST` | `/api/v1/transactions/` | Authenticated | Submit new transaction for real-time risk scoring |
| `GET` | `/api/v1/appeals/` | Authenticated | List fraud reviews & investigation queue |
| `PUT` | `/api/v1/appeals/{id}` | Analyst / Merchant | Submit analyst recommendation or merchant final decision |
| `GET` | `/api/v1/graph/transaction/{code}` | Authenticated | Fetch 4-tier hierarchical graph network for transaction |
| `GET` | `/api/v1/admin/stats` | Authenticated | Fetch dashboard statistics (Data-isolated for merchants) |
| `POST` | `/api/v1/admin/merchants` | Admin Only | Create new merchant store account |
| `GET` | `/health` | Public | Service health check (`{"status": "ok"}`) |
| `WS` | `/ws` | Authenticated | Live WebSocket alert & notification channel |

---

## 🧪 Demo Data Seeding & Hackathon Script

TrustGraph AI includes a non-destructive demo seeder script (`backend/seed_demo_fraud.py`) that generates 5 customer transactions sharing suspicious network credentials (`DEMO_SHARED_DEVICE_001`, `10.99.99.50`, `999 Demo Street`).

### Seed Demo Transactions

```powershell
# Run against local database:
python backend/seed_demo_fraud.py

# Run against Render PostgreSQL database:
$env:DATABASE_URL="postgresql://user:password@host.render.com:5432/dbname"; python backend/seed_demo_fraud.py
```

---

## 💻 Local Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ☁️ Cloud Deployment Configuration

### Production Architecture
- **Frontend**: Deployed on **Vercel**
- **Backend**: Deployed on **Render Web Service**
- **Database**: Deployed on **Render PostgreSQL**

### Environment Variables

#### Backend (Render Dashboard)
```env
DATABASE_URL=postgresql://user:password@hostname:5432/trustgraph
SECRET_KEY=your_production_secret_key_here
FRONTEND_URL=https://your-app.vercel.app
BACKEND_CORS_ORIGINS=https://your-app.vercel.app
```

#### Frontend (Vercel Project Settings)
```env
VITE_API_URL=https://your-backend.onrender.com/api/v1
VITE_WS_URL=wss://your-backend.onrender.com/ws
```

---

## 🧪 Verification Commands

### Build Verification
```bash
# Frontend Compilation Check
cd frontend && npm run build

# Backend Import & Service Check
cd backend && python -c "import main"
```

### API Verification
- Health Endpoint: `GET /health` $\rightarrow$ `{"status": "ok"}`
- Interactive Docs: `GET /docs` $\rightarrow$ Swagger UI

---

## 🏆 Hackathon Value & Key Differentiators

1. **Explainable AI (XAI)**: Breaks down fraud scores into human-readable heuristic factors instead of black-box numbers.
2. **Graph Collusion Discovery**: Uncovers multi-account fraud rings sharing hidden devices, IP addresses, and physical addresses.
3. **Multi-Merchant Data Isolation**: Solves real-world marketplace privacy by strictly isolating merchant order volumes while retaining centralized fraud analysis.
4. **Analyst-to-Merchant Collaborative Decisioning**: Bridges security operations and merchant store owners through non-binding recommendations and merchant decision autonomy.
