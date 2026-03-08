@echo off
echo Setting up the Python Virtual Environment...
python -m venv venv

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies from requirements.txt...
pip install -r requirements.txt

echo.
echo ==============================================
echo Setup Complete!
echo To start the backend server, run:
echo   uvicorn main:app --reload --port 8000
echo ==============================================
echo.
pause
