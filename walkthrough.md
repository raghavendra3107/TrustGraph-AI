# Production Deployment Preparation Guide

The TrustGraph AI codebase has been prepared and verified for production deployment to **Vercel** (Frontend) and **Render** (Backend & PostgreSQL).

---

## 📋 Audit & Configuration Summary

### 1. Frontend API Configuration (`frontend/src/services/api.ts`)
- Configured to use `import.meta.env.VITE_API_URL` with fallback to local development URL (`http://localhost:8001/api/v1`).
- Zero hardcoded production URLs.

### 2. Dynamic WebSocket Configuration (`frontend/src/context/AlertContext.tsx`)
- Dynamically derives the WebSocket URL from `VITE_WS_URL` or `VITE_API_URL`:
  - `https://backend.onrender.com/api/v1` $\rightarrow$ `wss://backend.onrender.com/ws`
  - Local development fallback: `ws://localhost:8001/ws`

### 3. Production CORS & Security (`backend/app/core/config.py` & `backend/main.py`)
- Restricts CORS origins in production using `FRONTEND_URL` and `BACKEND_CORS_ORIGINS` environment variables.
- Added `/health` endpoint returning `{"status": "ok"}`.

### 4. Database Dual-Compatibility (`backend/app/db/session.py`)
- Automatically normalizes Render/Heroku `postgres://` URLs to `postgresql://`.
- Preserves local SQLite development fallback (`sqlite:///./trustgraph.db`).

### 5. Environment Secrets & Git Protection (`.gitignore` & `.env.example`)
- Added `.env`, `.env.local`, and `*.env` rules to root `.gitignore`.
- Created safe `.env.example` placeholder files in root, `backend/`, and `frontend/`.

---

## 🚀 Environment Variables Required for Deployment

### A. Render (Backend Web Service & PostgreSQL)
Configure the following in the Render Dashboard under **Environment**:
- `DATABASE_URL`: Your PostgreSQL connection string (`postgresql://...`)
- `SECRET_KEY`: A strong random string for JWT signatures
- `FRONTEND_URL`: Your deployed Vercel URL (e.g., `https://trustgraph-ai.vercel.app`)

### B. Vercel (Frontend Project)
Configure the following in the Vercel Dashboard under **Project Settings > Environment Variables**:
- `VITE_API_URL`: `https://<your-render-backend-url>.onrender.com/api/v1`
- `VITE_WS_URL`: `wss://<your-render-backend-url>.onrender.com/ws` *(Optional, auto-derived if omitted)*

---

## 🛠 Platform Deployment Specifications

- **Backend Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Frontend Build Command**: `npm run build`
- **Frontend Output Directory**: `dist`

---

## ✅ Local Verification Results

- **Frontend Compilation**: `npm run build` completed in 527ms with **0 errors**.
- **Backend Import Check**: `python -c "import main"` completed with **0 errors**.
- **Health Check Endpoint**: `GET /health` returned `200 OK` (`{"status": "ok"}`).
- **Interactive Documentation**: `GET /docs` returned `200 OK`.
