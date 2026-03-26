# Smart Portfolio Analysis & Insights Engine

A full-stack multi-broker portfolio dashboard built with **React (Vite)** + **FastAPI (Python)**. Connect your Alpaca and Binance accounts to view real-time positions, capital, and P&L in one unified interface.

## Features

- 📊 **Real-time Dashboard** — auto-syncs live data with customizable intervals (15/30/60s).
- 🔄 **Manual Refresh** — trigger an immediate sync from the Dashboard at any time.
- 🏦 **Multi-Broker Hub** — connect Alpaca and Binance accounts into one interface.
- 🔐 **Dual-Layer Security** — Two-Factor Authentication (MFA) and Fernet API secret encryption.
- 🌙 **Theme Control** — toggle between Dark, Light, and System themes in App Settings.
- 👤 **UserProfile management** — centered profile management with avatar uploading.
- 📄 **Data Portability** — export your full portfolio and activity as clean PDF reports or JSON backups.
- 🔑 **Recovery Flow** — dedicated Forgot Password and secure Reset Password screens.

---

## Security

We prioritize the safety of your financial credentials:

1. **At-Rest Encryption**: Your Broker API Keys and Secrets are encrypted using AES-256 (via the Fernet specification) before they ever touch our database.
2. **2FA Support**: Enable Two-Factor Authentication in the **App Settings** for an extra layer of login security.
3. **Password Sovereignty**: Dedicated, mobile-responsive screens for password recovery and account-rotation.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/downloads/) v3.9+
- PostgreSQL *(optional — SQLite is used automatically as a fallback)*

---

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/anasfarock/portfolio-engine.git
cd portfolio-engine
```

### 2. Backend Setup

```powershell
# Windows
cd backend
setup.bat
```

```bash
# macOS / Linux
cd backend && chmod +x setup.sh && ./setup.sh
```

> Alternatively: `python -m venv venv` → activate → `pip install -r requirements.txt`

#### Configure `.env`

Create `backend/.env`:

```env
PORTFOLIO_DB_URL=postgresql://user:password@localhost/portfolio_db
SECRET_KEY=your_super_secret_jwt_key
ENCRYPTION_KEY=your_generated_fernet_key
```

> **SQLite fallback**: omit `PORTFOLIO_DB_URL` and a local `portfolio.db` file will be used automatically.

**Generate a valid `ENCRYPTION_KEY`:**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> ⚠️ `ENCRYPTION_KEY` is **required** — the backend will refuse to start without it.

#### Start the Backend
```bash
uvicorn main:app --reload
```
#### OR (For Powershell)
```bash
.\venv\Scripts\python.exe -m uvicorn main:app --reload
```
Backend runs at → `http://localhost:8000`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend runs at → `http://localhost:5173`

---

## Connecting a Broker

1. Sign in and open the **Avatar dropdown → Manage API Keys**
2. Click **+ Link Broker** and select your broker:

### Alpaca Paper Trading
| Field | Value |
|---|---|
| API Key | From [app.alpaca.markets](https://app.alpaca.markets/paper-trading/overview) |
| Secret Key | Your Alpaca secret |
| Endpoint | `https://paper-api.alpaca.markets` *(or leave blank)* |

### Binance Spot Demo
| Field | Value |
|---|---|
| API Key | From [demo.binance.com → API Management](https://demo.binance.com/en/my/settings/api-management) |
| Secret Key | Your Binance Demo secret |
| Endpoint | `https://demo-api.binance.com` *(or leave blank)* |

3. Click **Connect** — the dashboard will auto-sync on the next poll (within 15 seconds), or use the **🔄 Refresh** button to sync immediately.

---

## Dashboard

- **Total Capital** — total account equity across all connected brokers
- **Assets Value** — combined market value of all live positions
- **Active Positions** — count of open holdings
- **24h Return** — unrealized return percentage

Use the **🏦 Accounts** dropdown to filter the holdings table by broker.
