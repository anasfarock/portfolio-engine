#!/bin/bash

echo "Setting up the Python Virtual Environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo ""
echo "=============================================="
echo "Setup Complete!"
echo "To start the backend server, run the following:"
echo "  source venv/bin/activate"
echo "  uvicorn main:app --reload --port 8000"
echo "=============================================="
echo ""
