# Smart Portfolio Analysis & Insights Engine

A full-stack multi-broker portfolio intelligence platform built with **React (Vite)** + **FastAPI (Python)**. Connect your Alpaca and Binance accounts to view real-time positions, capital, P&L, and institutional-grade portfolio analytics in one unified interface.

---

## Features

- 📊 **Real-time Dashboard** — auto-syncs live data with customizable intervals (15/30/60s).
- 🔄 **Manual Refresh** — trigger an immediate sync from the Dashboard at any time.
- 🏦 **Multi-Broker Hub** — connect Alpaca and Binance accounts into one unified interface.
- 🔐 **Dual-Layer Security** — Two-Factor Authentication (MFA) and Fernet AES-256 API secret encryption.
- 📡 **Live Markets Page** — real-time price quotes for Stocks, Crypto, and Forex with 10s auto-refresh, top gainers/losers, and symbol search.
- 📰 **Financial News Aggregation** — aggregates and deduplicates articles from multiple free RSS sources across sectors, with ticker tagging and 30-min auto-refresh.
- 🤖 **AI-Powered Insights** — AI recommendations engine synthesizes attribution, sentiment, and financial signals into actionable portfolio guidance.
- 📈 **Portfolio Attribution** — Brinson-Fachler methodology decomposes returns into allocation and selection effects.
- 🗓️ **Calendar P&L View** — heatmap-style daily profit/loss calendar for trade journaling and pattern recognition.
- 💡 **Sentiment Analysis** — privacy-preserving local LLM (Mistral 7B via Ollama) processes financial news without external API calls.
- 📉 **Technical & Fundamental Analysis** — RSI, MACD, Bollinger Bands, valuation ratios, and peer comparison in one place.
- 🌙 **Theme Control** — toggle between Dark, Light, and System themes in App Settings.
- 👤 **Profile Management** — centered profile management with avatar uploading.
- 📄 **Data Portability** — export your full portfolio and activity as clean PDF reports or JSON backups.
- 📧 **Production-Ready Email Auth** — registration verification, MFA logins, and forgot-password flows backed by real OTPs delivered to your email.
- 🌐 **Google SSO** — seamless one-click registration and login via Google OAuth 2.0 (respects MFA rules).
- 🔔 **Automated Notifications** — opt-in email alerts for new logins and newly connected broker integrations.

---

## Architecture

```mermaid
graph TD
    subgraph Client["🖥️ Frontend (React + Vite)"]
        UI["Dashboard UI\nReact 18 + Tailwind CSS"]
        STATE["State Management\nRedux"]
        CHARTS["Visualizations\nRecharts"]
        WS_CLIENT["WebSocket Client\nReal-time updates"]
        AXIOS["HTTP Client\nAxios"]
    end

    subgraph Auth["🔐 Auth Layer"]
        JWT["JWT Sessions"]
        MFA["MFA / OTP\nEmail-based"]
        GOOGLE["Google SSO\nOAuth 2.0"]
        FERNET["Fernet AES-256\nKey Encryption"]
    end

    subgraph API["⚙️ Backend (FastAPI)"]
        REST["REST API\nFastAPI routes"]
        WS_SERVER["WebSocket Server\nReal-time push"]
        CELERY["Task Queue\nCelery + Redis"]
        ORM["ORM Layer\nSQLAlchemy"]
    end

    subgraph Data["🗄️ Data Layer"]
        PG[("PostgreSQL\nPrimary DB")]
        TSDB[("TimescaleDB\nTime-series")]
        REDIS[("Redis\nCache + Queue")]
    end

    subgraph Brokers["🏦 Broker Integration"]
        ALPACA["Alpaca\nPaper Trading API"]
        BINANCE["Binance\nSpot Demo API"]
    end

    subgraph Pipelines["📡 Data Pipelines"]
        MDP["Market Data Pipeline\nReal-time prices"]
        NAP["News Aggregation\n100+ RSS sources"]
    end

    subgraph Analytics["📊 Analytics Engines"]
        PAE["Portfolio Attribution\nBrinson-Fachler"]
        SA["Sentiment Analysis\nOllama + Mistral 7B"]
        FA["Financial Analysis\nValuation + Growth"]
        TA["Technical Analysis\nTA-Lib indicators"]
        AIE["AI Insights Engine\nRecommendations"]
        CAL["Calendar P&L\nDaily heatmap"]
        VIZ["Portfolio Visualization\nBenchmark comparison"]
    end

    UI --> AXIOS
    UI --> WS_CLIENT
    AXIOS --> REST
    WS_CLIENT --> WS_SERVER
    STATE --> UI
    CHARTS --> UI

    REST --> Auth
    REST --> ORM
    WS_SERVER --> CELERY
    CELERY --> Pipelines
    ORM --> PG
    ORM --> TSDB
    CELERY --> REDIS

    Pipelines --> ALPACA
    Pipelines --> BINANCE
    Pipelines --> NAP

    MDP --> TSDB
    NAP --> SA

    REST --> Analytics
    PAE --> PG
    SA --> PG
    FA --> TSDB
    TA --> TSDB
    AIE --> PAE
    AIE --> SA
    AIE --> FA
    AIE --> TA
    CAL --> TSDB
    VIZ --> PAE
```

---

## Security

Financial credential safety is a core design principle. See our [Security Policy](SECURITY.md) for details on encryption, MFA, and session management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Redux, Recharts, Axios |
| Backend | FastAPI, Python 3.10+, SQLAlchemy, Celery, JWT |
| Database | PostgreSQL, TimescaleDB (time-series), Redis (cache + queue) |
| Analytics | TA-Lib, pandas, NumPy, SciPy, scikit-learn |
| AI / NLP | Ollama, Mistral 7B (local LLM — no external API calls) |
| Auth | JWT, Fernet AES-256, Google OAuth 2.0, SMTP OTP |
| DevOps | Docker, CI/CD |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/downloads/) v3.9+
- [Ollama](https://ollama.com/) (for local Mistral 7B sentiment analysis)
- PostgreSQL *(optional — SQLite is used automatically as a fallback)*
- **Redis** *(optional — price caching for the Markets page. App works without it but fetches prices live on every request)*
  - **Windows**: Use [Memurai](https://memurai.com/get-memurai) (Redis-compatible). Install via PowerShell: `winget install Memurai.MemuraiDeveloper` or download the MSI directly.
  - **macOS/Linux**: `brew install redis` or `sudo apt install redis-server`
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

# Email Settings (Required for Registration & MFA)
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=your_brevo_email@example.com
SMTP_PASSWORD=your_brevo_smtp_password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME="Portfolio Engine"

# Google SSO (Required for "Sign in with Google")
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Redis & Celery (Optional — enables price caching for the Markets page)
# Windows: Install Memurai from https://memurai.com/get-memurai
REDIS_URL=redis://localhost:6379
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

> **SQLite fallback**: omit `PORTFOLIO_DB_URL` and a local `portfolio.db` file will be used automatically.
>
> **Email fallback**: if SMTP credentials are not provided, the app will not crash — it prints the 6-digit OTP directly to the backend terminal for local debugging.

**Generate a valid `ENCRYPTION_KEY`:**

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> ⚠️ `ENCRYPTION_KEY` is **required** — the backend will refuse to start without it.

#### Start the Backend

```bash
uvicorn main:app --reload
```

```powershell
# PowerShell
.\venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend runs at → `http://localhost:8000`

---

### 3. Ollama Setup (Sentiment Analysis)

The sentiment engine runs locally using Mistral 7B — no external API keys required.

```bash
# Install Ollama (https://ollama.com)
ollama pull mistral
ollama serve
```

Ollama runs at → `http://localhost:11434`

> If Ollama is not running, the sentiment analysis module will be skipped gracefully and other analytics will still function normally.

---

### 4. Frontend Setup

#### Configure `.env`

Create `frontend/.env`:

```env
# Required for "Sign in with Google"
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

#### Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at → `http://localhost:5173`

---

## Connecting a Broker

1. Sign in and open **Avatar dropdown → Manage API Keys**
2. Click **+ Link Broker**, select your broker, and optionally assign a **Nickname** (useful when connecting multiple accounts from the same provider)

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

| Metric | Description |
|---|---|
| Total Capital | Total account equity across all connected brokers |
| Assets Value | Combined market value of all live positions |
| Active Positions | Count of open holdings |
| 24h Return | Unrealized return percentage |

Use the **🏦 Accounts** dropdown to filter the holdings table and trade history by specific accounts or nicknames.

---

## Analytics Modules

### Portfolio Attribution Engine
Decomposes total portfolio returns into **allocation effect** (sector weighting decisions) and **selection effect** (stock-specific performance) using the institutional-grade Brinson-Fachler methodology. Identifies top and bottom contributors and provides structured explanations of performance drivers across selectable time horizons.

### Sentiment Analysis Module
Processes financial news from 100+ sources using a locally-hosted **Mistral 7B** model via Ollama — no data leaves your machine. Extracts sentiment scores (0–100), identifies market catalysts, and links sentiment signals directly to affected holdings in your portfolio. Runs in batches every 30 minutes.

### Financial Analysis Engine
Evaluates each holding across valuation ratios (P/E, P/B, EV/EBITDA), profitability metrics (ROE, ROA, margins), growth indicators, and balance sheet health. Includes peer comparison analysis to contextualise each security relative to its sector.

### Technical Analysis Module
Calculates 100+ indicators via **TA-Lib** including RSI, MACD, Bollinger Bands, SMA, and EMA. Produces a unified momentum score and trend identification output for each position, integrating cleanly with the attribution and sentiment layers.

### AI Insights & Recommendations Engine
Synthesises outputs from attribution, sentiment, financial, and technical analysis into transparent, data-backed recommendations. Surfaces actionable observations such as sector overexposure, concentration risk, and alignment with positive momentum — without opaque price predictions.

### Portfolio Visualization
Interactive charts for portfolio allocation, sector distribution, and benchmark comparison across selectable time horizons. Drill-down views from portfolio level → sector level → position level, with real-time updates via WebSocket.

### Calendar-Based P&L Analysis
A heatmap-style daily P&L calendar showing gain/loss for every trading day at a glance. Color-coded cells (green/red/neutral) with drill-down to position-level contribution for any given day. Includes monthly/weekly streak tracking and exportable reports for personal trade journaling.

---

## Implementation Status

### 1. User Authentication `[x]`
- Secure login with bcrypt password hashing
- Email registration with OTP verification
- JWT-based session token management
- Password reset and recovery flows
- Multi-factor authentication (MFA) via email OTP
- Google SSO via OAuth 2.0

### 2. Profile Management `[x]`
- User profile creation and editing with avatar upload
- Portfolio preferences and settings
- Risk profile assessment
- Notification preferences management
- Data export (PDF reports and JSON backups)

### 3. Multi-Broker Integration `[x]`
- OAuth 2.0 authentication with Alpaca and Binance
- AES-256 Fernet encrypted token storage
- Account linking, unlinking, and nickname support
- Real-time portfolio synchronization (15/30/60s intervals)
- Trade history import and tracking

### 4. Market Data Pipeline `[x]`
- Real-time price aggregation via yfinance (with Redis cache when available)
- Redis caching with 15s TTL — gracefully falls back to live fetch if Redis is offline
- Historical OHLCV data retrieval for charting
- Bid-ask spread tracking
- Dedicated **Markets** page with Stocks, Crypto & Forex watchlists, top gainers/losers, and 10s auto-refresh

### 5. News Aggregation Pipeline `[x]`
- Fetching from multiple financial RSS sources (Yahoo, CoinDesk, CNBC, etc.)
- Article deduplication and normalization via URL hashing
- Ticker and sector entity extraction using regex mapping
- Text cleaning and preprocessing (HTML stripping)
- Scheduled fetching every 30 minutes via Celery
- Dedicated **News** page with grid layout, sector filtering, and manual "Sync Now"

### 6. Portfolio Visualization `[x]`
- Interactive allocation and sector distribution charts (Recharts)
- Top holdings concentration risk analysis
- Historical backcast performance against S&P 500 benchmark
- Time-horizon selector (1mo / 3mo / ytd / 1y)
- Top and bottom contributor charts

### 7. Sentiment Analysis Module `[ ]`
- Financial news sentiment extraction
- Local LLM processing via Ollama + Mistral 7B
- Catalyst identification and classification
- Sentiment score calculation (0–100 scale)
- Batch processing for efficiency

### 8. Technical Analysis Module `[ ]`
- RSI, MACD, and Bollinger Bands via TA-Lib
- Simple and exponential moving averages (SMA, EMA)
- Trend identification algorithm
- Momentum scoring and evaluation
- Technical strength aggregation score

### 9. Financial Analysis Engine `[ ]`
- Valuation metrics (P/E, P/B, EV/EBITDA)
- Profitability metrics (ROE, ROA, net margin)
- Growth metrics computation (YoY revenue, EPS growth)
- Balance sheet health assessment (debt ratios, liquidity)
- Peer comparison analysis within sectors

### 10. Portfolio Attribution Engine `[ ]`
- Brinson-Fachler attribution methodology
- Allocation effect calculation (sector weighting decisions)
- Selection effect calculation (stock-specific performance)
- Interaction effect analysis
- Position-level attribution breakdown

### 11. AI Insights & Recommendations Engine `[ ]`
- Synthesis of attribution, sentiment, and financial analysis outputs
- Overexposure and concentration risk detection
- Sentiment-momentum alignment scoring
- Transparent, evidence-based recommendation generation
- Contextual insight summaries linking attribution with market signals

### 12. Calendar-Based P&L Analysis `[ ]`
- Daily P&L heatmap calendar (green / red / neutral day cells)
- Position-level drill-down contribution for any selected day
- Monthly and weekly aggregation with consecutive gain/loss streak tracking
- Exportable calendar reports for personal journaling and review

---

## Project Structure

```
portfolio-engine/
├── backend/
│   ├── main.py                  # FastAPI entry point & user/auth routes
│   ├── auth.py                  # JWT & password utility functions
│   ├── models.py                # SQLAlchemy ORM models
│   ├── schemas.py               # Pydantic models
│   ├── database.py              # Database connection
│   ├── encryption.py            # Fernet encryption service
│   ├── email_service.py         # SMTP email delivery
│   ├── celery_app.py            # Celery worker & beat schedule
│   ├── alpaca_sync.py           # Alpaca broker synchronization
│   ├── binance_sync.py          # Binance broker synchronization
│   ├── ibkr_sync.py             # IBKR broker synchronization
│   ├── pdf_export.py            # PDF report generation
│   ├── migrate_db.py            # DB schema migration utility
│   ├── routers/
│   │   ├── brokers.py           # Broker management routes
│   │   ├── portfolio.py         # Portfolio data routes
│   │   ├── market.py            # Market data & quotes routes
│   │   └── news.py              # News aggregation routes
│   ├── services/
│   │   ├── market_data.py       # Redis cache + yfinance price engine
│   │   └── news_service.py      # RSS feed fetching & deduplication
│   ├── tasks/
│   │   ├── market_tasks.py      # Celery background price refresh task
│   │   └── news_tasks.py        # Celery background news fetch task
│   ├── static/                  # Static assets (avatars, etc.)
│   └── requirements.txt         # Backend dependencies
│
└── frontend/
    ├── src/
    │   ├── main.jsx             # React entry point
    │   ├── App.jsx              # Main App component & routing
    │   ├── components/          # Reusable UI components
    │   ├── contexts/            # React Contexts (Auth, etc.)
    │   ├── hooks/               # Custom React hooks (useMarketData, etc.)
    │   ├── pages/               # Page components (Login, Dashboard, Markets, News, etc.)
    │   └── assets/              # Images and icons
    ├── package.json             # Frontend dependencies
    └── vite.config.js           # Vite configuration
```

---

## API Reference

The FastAPI backend auto-generates interactive API docs at:

- **Swagger UI** → `http://localhost:8000/docs`
- **ReDoc** → `http://localhost:8000/redoc`

All protected routes require a valid JWT Bearer token in the `Authorization` header.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_KEY` | ✅ Yes | Fernet key for broker secret encryption. App will not start without this. |
| `SECRET_KEY` | ✅ Yes | JWT signing secret |
| `PORTFOLIO_DB_URL` | No | PostgreSQL connection string. Omit to use SQLite fallback. |
| `SMTP_SERVER` | No | SMTP relay server (e.g. Brevo). Omit to print OTPs to terminal. |
| `SMTP_PORT` | No | SMTP port (typically 587) |
| `SMTP_USERNAME` | No | SMTP login username |
| `SMTP_PASSWORD` | No | SMTP password |
| `FROM_EMAIL` | No | Sender address for system emails |
| `FROM_NAME` | No | Display name for system emails |
| `GOOGLE_CLIENT_ID` | No | Google OAuth 2.0 client ID for SSO |
| `REDIS_URL` | No | Redis connection URL. Omit to disable price caching (Markets page still works via yfinance). |
| `CELERY_BROKER_URL` | No | Celery task broker URL (defaults to Redis) |
| `CELERY_RESULT_BACKEND` | No | Celery result backend URL (defaults to Redis) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth 2.0 client ID for SSO button |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
 
Developed as a Final Year Project at SZABIST University, Islamabad.
