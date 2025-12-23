#!/bin/bash

# Setup script for local development

echo "🚀 Setting up DDoS Map for local development..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed. Please install it first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install it first."
    exit 1
fi

echo "✅ Python and Node.js found"

# Setup backend
echo ""
echo "📦 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp ../.env.example .env 2>/dev/null || echo "ALIENTVAULT_API_KEY=your_key_here" > .env
fi

cd ..

# Setup frontend
echo ""
echo "📦 Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local file..."
    cp .env.example .env.local
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python -m uvicorn app.main:app --reload"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000 in your browser"
