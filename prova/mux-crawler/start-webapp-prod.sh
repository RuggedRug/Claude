#!/bin/bash
#
# start-webapp-prod.sh - Start the Flask webapp in production mode with Gunicorn
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Mux Crawler Webapp (Production Mode)..."

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    echo "Error: Virtual environment not found. Run setup-mac.sh first."
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found. Please configure it first."
    exit 1
fi

# Check if gunicorn is installed
if ! command -v gunicorn &> /dev/null; then
    echo "Installing gunicorn..."
    pip install gunicorn
fi

cd webapp

echo ""
echo "================================================"
echo "  Webapp starting at: http://localhost:5000"
echo "  Running with Gunicorn (4 workers)"
echo "  Press Ctrl+C to stop"
echo "================================================"
echo ""

# Start with Gunicorn
gunicorn --workers 4 --bind 0.0.0.0:5000 --access-logfile - --error-logfile - app:app
