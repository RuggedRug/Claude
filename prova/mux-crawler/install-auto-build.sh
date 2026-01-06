#!/bin/bash
#
# install-auto-build.sh - Install automatic build service on macOS
#
# This script sets up a launchd service that periodically checks
# for new commits and automatically rebuilds the application.
#
# Usage: ./install-auto-build.sh [options]
#
# Options:
#   --interval MINUTES   Check interval in minutes (default: 5)
#   --restart            Auto-restart webapp after builds
#   --notify             Show macOS notifications
#   --uninstall          Remove the auto-build service
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="com.muxcrawler.autobuild"
PLIST_FILE="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
LOG_DIR="$HOME/Library/Logs/MuxCrawler"
CHECK_INTERVAL=300  # 5 minutes in seconds
RESTART_WEBAPP=false
SHOW_NOTIFICATIONS=false
UNINSTALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --interval)
            CHECK_INTERVAL=$(( $2 * 60 ))
            shift 2
            ;;
        --restart)
            RESTART_WEBAPP=true
            shift
            ;;
        --notify)
            SHOW_NOTIFICATIONS=true
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        -h|--help)
            head -15 "$0" | tail -12
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

# Uninstall if requested
if [ "$UNINSTALL" = true ]; then
    echo -e "${BLUE}Uninstalling auto-build service...${NC}"

    # Stop the service
    if launchctl list | grep -q "$SERVICE_NAME"; then
        launchctl unload "$PLIST_FILE" 2>/dev/null || true
    fi

    # Remove plist
    rm -f "$PLIST_FILE"

    echo -e "${GREEN}Auto-build service uninstalled!${NC}"
    echo ""
    echo "Log files are still available at: $LOG_DIR"
    exit 0
fi

echo -e "${BLUE}Installing Mux Crawler Auto-Build Service${NC}"
echo "========================================"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"

# Build auto-build arguments
AUTO_BUILD_ARGS=""
if [ "$RESTART_WEBAPP" = true ]; then
    AUTO_BUILD_ARGS="$AUTO_BUILD_ARGS --restart"
fi
if [ "$SHOW_NOTIFICATIONS" = true ]; then
    AUTO_BUILD_ARGS="$AUTO_BUILD_ARGS --notify"
fi

# Create LaunchAgents directory if needed
mkdir -p "$HOME/Library/LaunchAgents"

# Create the plist file
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${SCRIPT_DIR}/auto-build.sh</string>
        <string>--log</string>
        <string>${LOG_DIR}/auto-build.log</string>
EOF

# Add optional arguments
if [ "$RESTART_WEBAPP" = true ]; then
    cat >> "$PLIST_FILE" << EOF
        <string>--restart</string>
EOF
fi

if [ "$SHOW_NOTIFICATIONS" = true ]; then
    cat >> "$PLIST_FILE" << EOF
        <string>--notify</string>
EOF
fi

# Complete the plist
cat >> "$PLIST_FILE" << EOF
    </array>

    <key>StartInterval</key>
    <integer>${CHECK_INTERVAL}</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/stderr.log</string>

    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
EOF

# Make auto-build.sh executable
chmod +x "$SCRIPT_DIR/auto-build.sh"

# Unload existing service if running
if launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${YELLOW}Stopping existing service...${NC}"
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# Load the new service
echo -e "${BLUE}Starting auto-build service...${NC}"
launchctl load "$PLIST_FILE"

# Verify it's running
sleep 1
if launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${GREEN}✓ Auto-build service installed and running!${NC}"
else
    echo -e "${RED}✗ Failed to start service. Check logs at: $LOG_DIR${NC}"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Check interval: $(( CHECK_INTERVAL / 60 )) minutes"
echo "  Auto-restart:   $RESTART_WEBAPP"
echo "  Notifications:  $SHOW_NOTIFICATIONS"
echo "  Log file:       $LOG_DIR/auto-build.log"
echo ""
echo "Commands:"
echo "  View logs:      tail -f $LOG_DIR/auto-build.log"
echo "  Check status:   launchctl list | grep $SERVICE_NAME"
echo "  Stop service:   launchctl unload $PLIST_FILE"
echo "  Start service:  launchctl load $PLIST_FILE"
echo "  Uninstall:      $0 --uninstall"
echo ""
echo -e "${GREEN}Auto-build is now active! It will check for updates every $(( CHECK_INTERVAL / 60 )) minutes.${NC}"
