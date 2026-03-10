# Smart Portfolio Analysis and Insights Engine

A comprehensive Portfolio Analysis and Insights Engine developed with a React (Vite) frontend powered by Tailwind CSS, and a FastAPI (Python) backend connected to PostgreSQL.

## Features
- **Frontend**: React, Vite, Tailwind CSS (with Dark/Light mode toggle), React Router, Axios.
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, JWT Authentication.

## Prerequisites
Before you begin, ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Python](https://www.python.org/downloads/) (v3.9 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (Optional for testing: SQLite is used as a fallback if PostgreSQL is not configured)

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/anasfarock/portfolio-engine.git
cd portfolio-engine
```

### 2. Backend Setup
Navigate to the `backend` directory. We have provided automated setup scripts to make creating the virtual environment and installing dependencies easy!

**For Windows:**
```powershell
cd backend
setup.bat
```

**For macOS/Linux:**
```bash
cd backend
chmod +x setup.sh
./setup.sh
```

*(Alternatively, you can manually create a virtual env: `python -m venv venv`, activate it with `venv\Scripts\activate` or `source venv/bin/activate`, and run `pip install -r requirements.txt`)*

**Configuration & Security (.env):**
Create a `.env` file in the `backend` folder to configure your database connection and secret encryption keys. 

* `PORTFOLIO_DB_URL`: If omitted, the app will automatically use a local SQLite database (`portfolio.db`) for testing.
* `SECRET_KEY`: Used for encrypting user JWT authentication sessions.
* `ENCRYPTION_KEY`: **[CRITICAL]** The backend securely hashes all Broker API secrets into the database using Fernet symmetric encryption. You **MUST** provide a valid 32-byte URL-safe base64 string or the backend will refuse to boot!

To generate a valid `ENCRYPTION_KEY` instantly on your machine, activate your python environment and run:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the generated string and paste it into `.env`:
```env
# backend/.env
PORTFOLIO_DB_URL=postgres://your_username:your_password@localhost/portfolio_db
SECRET_KEY=your_super_secret_key_here
ENCRYPTION_KEY=your_generated_fernet_key_here
```

**Run the Backend Server:**
Ensure your virtual environment is activated.
```bash
uvicorn main:app --reload --port 8000
```
*The FastAPI backend will now be running on [http://localhost:8000](http://localhost:8000).*

### 3. Frontend Setup
Open a new terminal window, navigate to the `frontend` directory, and install the Node modules.

```bash
cd frontend
npm install
```

**Run the Frontend Server:**
```bash
npm run dev
```
*The React application will now be running on [http://localhost:5173](http://localhost:5173).*

## App Usage
Once both servers are running:
1. Open your browser and navigate to `http://localhost:5173`.
2. Toggle between dark and light modes using the icon in the top right corner.
3. Register a new account and Sign in.
4. Open the User Avatar dropdown (Top Right) -> **Manage API Keys**.
5. Inside the "Alpaca" connection block, paste your specific Alpaca Paper API Key, Secret Key, and network endpoint.
6. Press the **Sync** button—the python worker will authenticate dynamically, ingest your portfolio allocations safely into the local database, and propagate them onto your Dashboard UI!
