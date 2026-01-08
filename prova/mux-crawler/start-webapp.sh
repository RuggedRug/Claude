#!/bin/bash
#
# start-webapp.sh - Start the Flask webapp in development mode
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Mux Crawler Webapp (Development Mode)..."

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    echo "Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r webapp/requirements.txt
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Copy .env.example and configure it."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created .env from .env.example - please edit it with your settings."
    fi
fi

# Start Flask in development mode
cd webapp
export FLASK_ENV=development
export FLASK_DEBUG=1

echo ""
echo "================================================"
echo "  Webapp starting at: http://localhost:5000"
echo "  Press Ctrl+C to stop"
echo "================================================"
echo ""

python app.py
