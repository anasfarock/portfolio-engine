# Portfolio Engine

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
git clone <your-repository-url>
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

**Configuration Database (.env):**
Create a `.env` file in the `backend` folder to configure your database connection and secret key. If you omit this, the app will automatically use a local SQLite database (`portfolio.db`) for testing.
```env
# backend/.env
PORTFOLIO_DB_URL=postgres://your_username:your_password@localhost/portfolio_db
SECRET_KEY=your_super_secret_key_here
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
3. Register a new account.
4. Sign in to view your dashboard.