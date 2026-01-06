#!/bin/bash
#
# auto-build.sh - Automatically check for updates and rebuild if needed
#
# This script:
# 1. Checks if there are new commits in the GitHub repository
# 2. If new commits exist, pulls them and rebuilds the application
# 3. Optionally restarts the web application
#
# Usage: ./auto-build.sh [options]
#
# Options:
#   --restart       Restart webapp after successful build
#   --notify        Show macOS notifications
#   --quiet         Suppress output (for cron/launchd)
#   --log FILE      Write output to log file
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="https://github.com/RuggedRug/Claude.git"
BRANCH="claude/setup-playwright-scripts-Q9Wer"
LOG_FILE=""
RESTART_WEBAPP=false
SHOW_NOTIFICATIONS=false
QUIET=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --restart)
            RESTART_WEBAPP=true
            shift
            ;;
        --notify)
            SHOW_NOTIFICATIONS=true
            shift
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        --log)
            LOG_FILE="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Logging functions
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    if [ "$QUIET" = false ]; then
        echo "$msg"
    fi
    if [ -n "$LOG_FILE" ]; then
        echo "$msg" >> "$LOG_FILE"
    fi
}

notify() {
    if [ "$SHOW_NOTIFICATIONS" = true ] && command -v osascript &> /dev/null; then
        osascript -e "display notification \"$1\" with title \"Mux Crawler Auto-Build\""
    fi
}

cd "$SCRIPT_DIR"

log "Starting auto-build check..."

# Check if this is a git repository
if [ ! -d ".git" ]; then
    # Check if we're in a subdirectory of a git repo
    GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
    if [ -z "$GIT_ROOT" ]; then
        log "ERROR: Not a git repository. Run setup-mac.sh first."
        exit 1
    fi
fi

# Fetch latest changes
log "Fetching from origin..."
if ! git fetch origin "$BRANCH" 2>/dev/null; then
    log "ERROR: Could not fetch from origin. Check network connection."
    exit 1
fi

# Check if we're behind
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

if [ -z "$REMOTE_COMMIT" ]; then
    log "ERROR: Could not find remote branch: origin/$BRANCH"
    exit 1
fi

BEHIND=$(git rev-list --count HEAD.."origin/$BRANCH" 2>/dev/null || echo "0")

if [ "$BEHIND" -eq 0 ]; then
    log "No new commits. Already up to date."
    exit 0
fi

log "Found $BEHIND new commit(s). Starting build..."
notify "Found $BEHIND new commits. Building..."

# Pull changes
log "Pulling changes..."
if ! git pull origin "$BRANCH"; then
    log "ERROR: Failed to pull changes"
    notify "Build failed: Could not pull changes"
    exit 1
fi

# Check for changes in requirements
REQUIREMENTS_CHANGED=$(git diff --name-only "$LOCAL_COMMIT".."$REMOTE_COMMIT" | grep -c "requirements.txt" || true)

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate

    # Reinstall Python dependencies if requirements changed
    if [ "$REQUIREMENTS_CHANGED" -gt 0 ]; then
        log "Requirements changed. Reinstalling Python dependencies..."
        pip install -r webapp/requirements.txt --quiet
    fi
fi

# Check for changes in package.json
PACKAGE_CHANGED=$(git diff --name-only "$LOCAL_COMMIT".."$REMOTE_COMMIT" | grep -c "package.json" || true)

# Reinstall Node dependencies if package.json changed
if [ "$PACKAGE_CHANGED" -gt 0 ]; then
    log "Package.json changed. Reinstalling Node dependencies..."
    npm install --silent
fi

# Run any build steps if needed (e.g., TypeScript compilation)
if [ -f "package.json" ] && grep -q '"build"' package.json; then
    log "Running npm build..."
    npm run build --silent 2>/dev/null || true
fi

# Show what was updated
log "Updated files:"
git diff --name-only "$LOCAL_COMMIT".."$REMOTE_COMMIT" | while read -r file; do
    log "  - $file"
done

# Restart webapp if requested
if [ "$RESTART_WEBAPP" = true ]; then
    log "Restarting webapp..."
    if [ -f "$SCRIPT_DIR/stop-webapp.sh" ]; then
        "$SCRIPT_DIR/stop-webapp.sh" 2>/dev/null || true
    fi
    if [ -f "$SCRIPT_DIR/start-webapp.sh" ]; then
        nohup "$SCRIPT_DIR/start-webapp.sh" > /dev/null 2>&1 &
        sleep 2
        log "Webapp restarted"
    fi
fi

log "Build completed successfully!"
notify "Build completed! $BEHIND commit(s) applied."

# Record last successful build
echo "$(date '+%Y-%m-%d %H:%M:%S') - $BEHIND commits from $LOCAL_COMMIT to $REMOTE_COMMIT" >> "$SCRIPT_DIR/.build-history"
