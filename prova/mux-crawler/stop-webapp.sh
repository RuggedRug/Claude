#!/bin/bash
#
# stop-webapp.sh - Stop the Flask webapp
#

echo "Stopping Mux Crawler Webapp..."

# Kill Flask development server
pkill -f "python app.py" 2>/dev/null

# Kill Gunicorn if running
pkill -f "gunicorn.*webapp.app" 2>/dev/null

# Check if port 5000 is still in use
if lsof -i :5000 >/dev/null 2>&1; then
    echo "Force killing process on port 5000..."
    lsof -ti :5000 | xargs kill -9 2>/dev/null
fi

echo "Webapp stopped."
